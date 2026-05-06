// ============================================================
// Diff Reviewer — Orchestrator
// Runs scope, danger, and semantic checks; writes review file
// ============================================================

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import type { PatchPlan } from '../patch-engine/types.js'
import { replanPatch } from '../patch-engine/replanner.js'
import { parseCurrentTaskMd } from './task-parser.js'
import { checkScope } from './scope-checker.js'
import { checkDanger } from './danger-checker.js'
import { checkSemantic, ESCALATE_FLAG } from './semantic-checker.js'
import { worstOutcome, type ReviewResult, type DimensionResult } from './types.js'

// ---- Paths ----

const ORCHESTRATOR_DIR = path.resolve(process.cwd(), '.orchestrator')
const PLAN_FILE = path.join(ORCHESTRATOR_DIR, 'patches', 'plan.json')
const CURRENT_TASK_FILE = path.join(ORCHESTRATOR_DIR, 'current-task.md')
const PATCHES_DIR = path.join(ORCHESTRATOR_DIR, 'patches')

// ---- Diff helpers ----

/**
 * Extract changed file paths from a git diff.
 * Parses lines like: diff --git a/<path> b/<path>
 */
function parseChangedFiles(diffContent: string): string[] {
  const files: string[] = []
  const lines = diffContent.split('\n')
  for (const line of lines) {
    if (line.startsWith('diff --git a/')) {
      // Format: diff --git a/<path> b/<path>
      const parts = line.split(' ')
      // parts[2] = "a/<path>" — strip leading "a/"
      if (parts[2] && parts[2].startsWith('a/')) {
        files.push(parts[2].slice(2))
      }
    }
  }
  return files
}

/**
 * Run `git diff HEAD~1` and return the output, or empty string on error.
 */
function getGitDiff(): string {
  try {
    return execSync('git diff HEAD~1', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return ''
  }
}

// ---- Markdown renderer ----

function renderReviewMarkdown(
  patchId: string,
  result: ReviewResult,
  dimensions: DimensionResult[]
): string {
  const scope   = dimensions.find((d) => d.dimension === 'scope')!
  const danger  = dimensions.find((d) => d.dimension === 'danger')!
  const semantic = dimensions.find((d) => d.dimension === 'semantic')!

  return `# Diff Review: ${patchId}
> Reviewed: ${result.reviewed_at}
> Overall: ${result.overall.toUpperCase()}

## Scope: ${scope.outcome}
${scope.reason}${scope.details ? '\n' + scope.details.map((d) => `- ${d}`).join('\n') : ''}

## Danger: ${danger.outcome}
${danger.reason}${danger.details ? '\n' + danger.details.map((d) => `- ${d}`).join('\n') : ''}

## Semantic: ${semantic.outcome}
${semantic.reason}

---
**Should block**: ${result.should_block ? 'yes' : 'no'}
**Escalate to human**: ${result.escalate_to_human ? 'yes' : 'no'}
`
}

// ---- Public API ----

/**
 * Review a patch diff against scope, danger, and semantic dimensions.
 *
 * @param patchId            The patch_id to look up in plan.json
 * @param opts.diffContent   Pre-loaded diff text (skip git command)
 * @param opts.dryRun        If true, do not write the review file
 */
export async function reviewPatch(
  patchId: string,
  opts: { diffContent?: string; dryRun?: boolean } = {}
): Promise<ReviewResult> {
  // 1. Load PatchSpec from plan.json
  if (!fs.existsSync(PLAN_FILE)) {
    throw new Error(`plan.json not found at ${PLAN_FILE}. Run \`lco split\` first.`)
  }
  const plan: PatchPlan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf-8'))
  const spec = plan.patches.find((p) => p.patch_id === patchId)
  if (!spec) {
    throw new Error(`Patch "${patchId}" not found in plan.json.`)
  }

  // 2. Parse TaskBrief from current-task.md
  if (!fs.existsSync(CURRENT_TASK_FILE)) {
    throw new Error(
      `current-task.md not found at ${CURRENT_TASK_FILE}. Run \`lco compose\` first.`
    )
  }
  const taskContent = fs.readFileSync(CURRENT_TASK_FILE, 'utf-8')
  const brief = parseCurrentTaskMd(taskContent)

  // 3. Get diff
  const diffContent = opts.diffContent ?? getGitDiff()

  // 4. Parse changed files
  const changedFiles = parseChangedFiles(diffContent)

  // 5. Run all checkers in parallel
  const [scopeResult, dangerResult, semanticResult] = await Promise.all([
    Promise.resolve(checkScope(changedFiles, spec.files_allowed)),
    Promise.resolve(checkDanger(changedFiles, diffContent)),
    checkSemantic(diffContent, brief, spec.deliverable),
  ])

  const dimensions: DimensionResult[] = [scopeResult, dangerResult, semanticResult]

  // 6. Compute overall outcome
  const overall = worstOutcome(dimensions.map((d) => d.outcome))

  // 7. Flags
  // block if: any dimension is 'block', OR semantic check is a clear 'fail'
  const should_block =
    dimensions.some((d) => d.outcome === 'block') ||
    (semanticResult.outcome === 'fail' && !(semanticResult.details?.includes(ESCALATE_FLAG) ?? false))
  // escalate if: semantic result is uncertain (warn + ESCALATE_FLAG)
  const escalate_to_human =
    semanticResult.details?.includes(ESCALATE_FLAG) ?? false

  const reviewed_at = new Date().toISOString()
  const diff_lines = diffContent.split('\n').length

  const result: ReviewResult = {
    patch_id: patchId,
    overall,
    dimensions,
    diff_lines,
    reviewed_at,
    should_block,
    escalate_to_human,
  }

  // 8. On block, generate replan options so operator can choose retry/scope-down/skip.
  //    Skipped on dry-run because replanPatch also writes a replan file to .orchestrator/.
  if (should_block && !opts.dryRun) {
    const failureReason = dimensions
      .filter((d) => d.outcome === 'block' || d.outcome === 'fail')
      .map((d) => `[${d.dimension}] ${d.reason}`)
      .join(' | ') || 'diff review blocked'
    result.replan_options = replanPatch(spec, failureReason)
  }

  // 9. Write review file unless dry-run
  if (!opts.dryRun) {
    if (!fs.existsSync(PATCHES_DIR)) {
      fs.mkdirSync(PATCHES_DIR, { recursive: true })
    }
    const reviewPath = path.join(PATCHES_DIR, `${patchId}-diff-review.md`)
    fs.writeFileSync(reviewPath, renderReviewMarkdown(patchId, result, dimensions), 'utf-8')
  }

  return result
}

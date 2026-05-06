// ============================================================
// Handoff Generator — Main Generator
// Reads plan.json → renders Codex prompt → writes handoff file
// ============================================================

import fs from 'fs'
import path from 'path'
import type { ApprovalMode, HandoffPrompt } from './types.js'
import { renderCodexPrompt } from './codex-template.js'
import type { PatchPlan, PatchSpec } from '../patch-engine/types.js'

const ORCHESTRATOR_DIR = path.resolve(process.cwd(), '.orchestrator')
const PLAN_FILE = path.join(ORCHESTRATOR_DIR, 'patches', 'plan.json')
const HANDOFF_DIR = path.join(ORCHESTRATOR_DIR, 'handoff')

/**
 * Selects approval mode based on risk level.
 * full-auto is never auto-selected — only via explicit --mode flag.
 */
function selectApprovalMode(patch: PatchSpec, override?: ApprovalMode): ApprovalMode {
  if (override) return override
  if (patch.risk === 'high') return 'suggest'
  // medium and low both default to auto-edit
  return 'auto-edit'
}

/**
 * Builds the forbidden summary string.
 * Uses files_allowed list if present, otherwise falls back to patch scope.
 */
function buildForbiddenSummary(patch: PatchSpec): string {
  if (patch.files_allowed.length > 0) {
    return `All files outside: ${patch.files_allowed.join(', ')}`
  }
  return patch.scope
}

/**
 * Builds the instructions string from patch deliverable + scope.
 * Simple concatenation producing 2-3 sentences.
 */
function buildInstructions(patch: PatchSpec): string {
  const scopeSentence = patch.scope
    ? `Work within the following scope: ${patch.scope}.`
    : ''
  const deliverableSentence = patch.deliverable
    ? `The goal is to achieve: ${patch.deliverable}.`
    : ''
  const rollbackSentence = patch.rollback_note
    ? `If anything goes wrong, rollback with: ${patch.rollback_note}.`
    : ''

  return [scopeSentence, deliverableSentence, rollbackSentence]
    .filter(Boolean)
    .join(' ')
}

/**
 * Generates a Codex CLI handoff prompt for the given patch ID.
 *
 * @param patchId - The patch_id to find in plan.json
 * @param opts.mode - Override approval mode (auto-selected from risk if omitted)
 * @param opts.dryRun - If true, skip writing the file to disk
 * @returns The fully populated HandoffPrompt object
 */
export async function generateHandoff(
  patchId: string,
  opts: { mode?: ApprovalMode; dryRun?: boolean }
): Promise<HandoffPrompt> {
  // 1. Read plan.json
  if (!fs.existsSync(PLAN_FILE)) {
    throw new Error(
      `plan.json not found at ${PLAN_FILE}.\n` +
      `  Run \`lco split\` first to generate the patch plan.`
    )
  }

  const raw = fs.readFileSync(PLAN_FILE, 'utf-8')
  let plan: PatchPlan
  try {
    plan = JSON.parse(raw) as PatchPlan
  } catch {
    throw new Error(`Failed to parse plan.json — invalid JSON. File: ${PLAN_FILE}`)
  }

  // 2. Find the matching patch
  const patch = plan.patches.find((p) => p.patch_id === patchId)
  if (!patch) {
    const available = plan.patches.map((p) => p.patch_id).join(', ')
    throw new Error(
      `Patch "${patchId}" not found in plan.json.\n` +
      `  Available patch IDs: ${available || '(none)'}`
    )
  }

  // 3. Select approval mode
  const approval_mode = selectApprovalMode(patch, opts.mode)

  // 4. Build instructions
  const instructions = buildInstructions(patch)

  // 5. Build forbidden summary
  const forbidden_summary = buildForbiddenSummary(patch)

  // 6. Build HandoffPrompt
  const handoff: HandoffPrompt = {
    patch_id: patch.patch_id,
    goal: patch.title,
    allowed_files: patch.files_allowed,
    forbidden_summary,
    instructions,
    constraints: [],
    deliverable: patch.deliverable,
    approval_mode,
    generated_at: new Date().toISOString(),
  }

  // 7. Render markdown
  const markdown = renderCodexPrompt(handoff)

  // 8. Write to file unless dryRun
  if (!opts.dryRun) {
    fs.mkdirSync(HANDOFF_DIR, { recursive: true })
    const outFile = path.join(HANDOFF_DIR, `codex-prompt-${patchId}.md`)
    fs.writeFileSync(outFile, markdown, 'utf-8')
  }

  // 9. Return HandoffPrompt
  return handoff
}

/**
 * Returns the expected output file path for a given patch ID.
 * Useful for CLI to report the written location.
 */
export function getHandoffFilePath(patchId: string): string {
  return path.join(HANDOFF_DIR, `codex-prompt-${patchId}.md`)
}

// ============================================================
// Patch Engine — Replanner
// Receives a failure signal for a patch → proposes 3 options:
//   1. retry        — re-run patch as-is
//   2. scope-down   — narrow scope to minimal subset
//   3. skip         — defer the patch entirely
//
// Writes failure + options to .orchestrator/patches/<patch_id>-replan.md
// ============================================================

import fs from 'fs'
import path from 'path'
import type { PatchSpec, ReplanOption } from './types.js'

// ---- Paths ----

const ORCHESTRATOR_DIR = path.resolve(process.cwd(), '.orchestrator')
const PATCHES_DIR = path.join(ORCHESTRATOR_DIR, 'patches')

// ---- Helpers ----

function ensurePatchesDir(): void {
  fs.mkdirSync(PATCHES_DIR, { recursive: true })
}

function formatReplanMarkdown(
  patch: PatchSpec,
  failureReason: string,
  options: ReplanOption[]
): string {
  const now = new Date().toISOString()

  const optionLines = options.map((opt, i) => {
    const header = `### Option ${i + 1}: ${opt.action.toUpperCase()}`
    const scopeLine =
      opt.adjusted_scope !== undefined
        ? `\n**Adjusted scope**: ${opt.adjusted_scope}`
        : ''
    return `${header}${scopeLine}\n\n${opt.reasoning}`
  })

  return `# Replan: ${patch.patch_id}

> Generated: ${now}

## Failed Patch

- **ID**: ${patch.patch_id}
- **Title**: ${patch.title}
- **Scope**: ${patch.scope}
- **Risk**: ${patch.risk}
- **Files allowed**: ${patch.files_allowed.length > 0 ? patch.files_allowed.join(', ') : '(none)'}

## Failure Reason

${failureReason}

---

## Replan Options

${optionLines.join('\n\n---\n\n')}
`
}

// ---- Public API ----

/**
 * Given a failed patch and the reason for failure, produce exactly 3 replan options:
 *   1. retry       — re-run patch as-is
 *   2. scope-down  — reduce to minimal subset
 *   3. skip        — mark as deferred
 *
 * Also writes the result to .orchestrator/patches/<patch_id>-replan.md.
 * Never throws — errors are caught and logged.
 */
export function replanPatch(patch: PatchSpec, failureReason: string): ReplanOption[] {
  // Determine adjusted_scope for scope-down: first file or a concrete suggestion
  const minimalScope =
    patch.files_allowed.length > 0
      ? patch.files_allowed.slice(0, 1)[0]
      : `minimal subset of ${patch.scope}`

  const options: ReplanOption[] = [
    {
      action: 'retry',
      reasoning:
        `Retry "${patch.title}" as-is. The failure ("${failureReason}") ` +
        `may be transient — a transient Ollama timeout, a race condition, or ` +
        `an intermittent filesystem issue. No scope changes needed. ` +
        `Check Ollama health and re-run the patch.`,
    },
    {
      action: 'scope-down',
      reasoning:
        `Reduce "${patch.title}" to the smallest meaningful unit: only touch ` +
        `"${minimalScope}" instead of the full allowed list (${patch.files_allowed.join(', ') || patch.scope}). ` +
        `This limits blast radius and isolates the failure to one file.`,
      adjusted_scope: minimalScope,
    },
    {
      action: 'skip',
      reasoning:
        `Skip "${patch.title}" and mark it as deferred. ` +
        `Impact: the deliverable ("${patch.deliverable}") will not be completed in this run. ` +
        `Dependent patches (${patch.dependencies.length > 0 ? patch.dependencies.join(', ') : 'none'}) ` +
        `may also need to be deferred. Rollback note for reference: ${patch.rollback_note}.`,
    },
  ]

  // Write replan file
  try {
    ensurePatchesDir()
    const replanPath = path.join(PATCHES_DIR, `${patch.patch_id}-replan.md`)
    fs.writeFileSync(replanPath, formatReplanMarkdown(patch, failureReason, options), 'utf-8')
  } catch (err) {
    console.warn(
      `[replanner] Could not write replan file for ${patch.patch_id}: ` +
      (err instanceof Error ? err.message : String(err))
    )
  }

  return options
}

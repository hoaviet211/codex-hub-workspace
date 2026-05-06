// ============================================================
// Diff Reviewer — Scope Checker
// Block files that fall outside the PatchSpec.files_allowed list
// ============================================================

import type { DimensionResult } from './types.js'

/**
 * Check that all changed files are within the allowed scope.
 *
 * @param changedFiles  File paths extracted from the diff
 * @param allowedFiles  PatchSpec.files_allowed — empty means no constraint
 */
export function checkScope(
  changedFiles: string[],
  allowedFiles: string[]
): DimensionResult {
  // No constraint set — skip check
  if (allowedFiles.length === 0) {
    return {
      dimension: 'scope',
      outcome: 'pass',
      reason: 'No scope constraint set — all files allowed.',
    }
  }

  const outOfScope = changedFiles.filter((f) => !allowedFiles.includes(f))

  if (outOfScope.length > 0) {
    return {
      dimension: 'scope',
      outcome: 'block',
      reason: `${outOfScope.length} file(s) changed outside the allowed scope.`,
      details: outOfScope,
    }
  }

  return {
    dimension: 'scope',
    outcome: 'pass',
    reason: 'All changed files are within the allowed scope.',
  }
}

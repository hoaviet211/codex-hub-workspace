// ============================================================
// Diff Reviewer — Types
// ReviewOutcome, DimensionResult, ReviewResult
// ============================================================

import type { ReplanOption } from '../patch-engine/types.js'

export type ReviewOutcome = 'pass' | 'warn' | 'fail' | 'block'

export interface DimensionResult {
  dimension: 'scope' | 'danger' | 'semantic'
  outcome: ReviewOutcome
  reason: string
  details?: string[]   // specific files, patterns, etc.
}

export interface ReviewResult {
  patch_id: string
  overall: ReviewOutcome       // worst of all dimensions: block > fail > warn > pass
  dimensions: DimensionResult[]
  diff_lines: number
  reviewed_at: string
  should_block: boolean        // true if any dimension is 'block'
  escalate_to_human: boolean   // true if semantic outcome is ambiguous (warn with uncertainty note)
  replan_options?: ReplanOption[]  // populated by reviewer when should_block is true
}

// Outcome priority for computing overall (higher index = worse)
export const OUTCOME_PRIORITY: ReviewOutcome[] = ['pass', 'warn', 'fail', 'block']

/**
 * Return the worst (highest priority) outcome from a list.
 */
export function worstOutcome(outcomes: ReviewOutcome[]): ReviewOutcome {
  let worst: ReviewOutcome = 'pass'
  for (const o of outcomes) {
    if (OUTCOME_PRIORITY.indexOf(o) > OUTCOME_PRIORITY.indexOf(worst)) {
      worst = o
    }
  }
  return worst
}

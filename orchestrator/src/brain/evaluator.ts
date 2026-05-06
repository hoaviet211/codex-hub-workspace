// ============================================================
// Brain Layer — Evaluator
// Evaluates each patch result and decides whether to replan
// or escalate. Triggers Strategic Brain re-plan when needed.
// ============================================================

import {
  BrainState,
  EvalResult,
  FailureEntry,
  PatchOutcome,
  PatchResult,
} from './types.js'
import { applyTransition, loadState, saveState } from './state.js'
import { recordFailure } from './planner.js'

// --- Failure category detection ---

function classifyFailure(reason: string): FailureEntry['category'] {
  const lower = reason.toLowerCase()
  if (/gemma|ollama|model|json|parse|schema/.test(lower)) return 'gemma_failure'
  if (/scope|forbidden|file.*outside|not allowed/.test(lower)) return 'scope_violation'
  if (/diff|review|block|semantic/.test(lower)) return 'diff_rejected'
  if (/timeout|timed out|no response/.test(lower)) return 'timeout'
  return 'unknown'
}

// --- Consecutive failure counter ---

function countConsecutiveFails(
  failLog: FailureEntry[],
  patchId: string
): number {
  // Count how many times this patch has failed in a row
  const patchFails = failLog.filter((f) => f.patch_id === patchId)
  return patchFails.length
}

function countRecentFails(
  failLog: FailureEntry[],
  windowMs = 30 * 60 * 1000   // 30 min window
): number {
  const cutoff = Date.now() - windowMs
  return failLog.filter((f) => new Date(f.timestamp).getTime() > cutoff).length
}

// --- Recommendation engine ---

function buildRecommendation(
  failCount: number,
  category: FailureEntry['category'],
  recentFails: number
): EvalResult['recommendation'] {
  // Hard escalate if 3+ fails on same patch OR 5+ recent fails across all patches
  if (failCount >= 3 || recentFails >= 5) return 'escalate'

  switch (category) {
    case 'gemma_failure':
      return failCount >= 2 ? 'scope_down' : 'retry'
    case 'scope_violation':
      return 'scope_down'
    case 'diff_rejected':
      return failCount >= 2 ? 'skip' : 'scope_down'
    case 'timeout':
      return 'retry'
    default:
      return failCount >= 2 ? 'escalate' : 'retry'
  }
}

// --- Main evaluator function ---

export function evaluatePatch(result: PatchResult): EvalResult {
  const state = loadState()

  if (result.outcome === 'success') {
    // Mark patch as done, advance state
    const updatedQueue = state.patch_queue.map((p) =>
      p.patch_id === result.patch_id ? { ...p, status: 'done' as const } : p
    )
    const allDone = updatedQueue.every((p) =>
      p.status === 'done' || p.status === 'skipped'
    )

    const nextStatus = allDone ? 'done' : 'executing'
    const updatedState: BrainState = {
      ...state,
      patch_queue: updatedQueue,
      status: nextStatus,
      active_patch_id: allDone ? '' : state.active_patch_id,
      updated_at: new Date().toISOString(),
    }
    saveState(updatedState)

    return {
      should_replan: false,
      should_escalate: false,
      failure_category: 'unknown',
      recommendation: 'retry',   // not used for success
      reasoning: `Patch "${result.patch_id}" succeeded. ${allDone ? 'All patches done.' : 'Proceeding to next patch.'}`,
    }
  }

  // --- Failure path ---

  const category = classifyFailure(result.reason)
  const failCount = countConsecutiveFails(state.failure_log, result.patch_id) + 1
  const recentFails = countRecentFails(state.failure_log)
  const recommendation = buildRecommendation(failCount, category, recentFails)

  const shouldEscalate = recommendation === 'escalate'
  const shouldReplan = recommendation !== 'retry'

  // Write failure to log
  recordFailure({
    patch_id: result.patch_id,
    reason: result.reason,
    category,
    attempt_count: failCount,
  })

  // Transition state
  let updatedState = applyTransition(state, 'blocked')
  if (shouldEscalate) {
    updatedState = applyTransition(
      updatedState,
      'escalated',
      `Patch "${result.patch_id}" failed ${failCount}x. Category: ${category}. ${result.reason}`
    )
  }
  saveState(updatedState)

  return {
    should_replan: shouldReplan,
    should_escalate: shouldEscalate,
    failure_category: category,
    recommendation,
    reasoning:
      `Patch "${result.patch_id}" failed (attempt ${failCount}). ` +
      `Category: ${category}. Reason: ${result.reason}. ` +
      `Recommendation: ${recommendation}.`,
  }
}

// --- Checks whether state should escalate due to pattern of failures ---

export function shouldEscalateState(state: BrainState): boolean {
  const recentFails = countRecentFails(state.failure_log)
  return recentFails >= 5 || state.status === 'escalated'
}

// --- Checks a specific patch fail count ---

export function getFailCount(patchId: string): number {
  const state = loadState()
  return countConsecutiveFails(state.failure_log, patchId)
}

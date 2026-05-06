// ============================================================
// Brain Layer — Planner
// Decides mode, strategy, and initial patch queue for a goal.
// Also handles re-planning when patches fail.
// ============================================================

import {
  BrainMode,
  BrainState,
  EvalResult,
  FailureEntry,
  PatchQueueItem,
  PlanInput,
  PlanResult,
  STRATEGIES,
} from './types.js'
import { applyTransition, loadState, saveState } from './state.js'

// ---- Mode detection heuristics ----

function detectMode(goal: string): BrainMode {
  const lower = goal.toLowerCase()

  // fast: small, isolated changes
  if (/\b(fix typo|rename|add comment|update readme|bump version)\b/.test(lower)) {
    return 'fast'
  }

  // deep: architecture, refactor, migration, security
  if (/\b(refactor|migrate|architect|redesign|security|overhaul|extract module)\b/.test(lower)) {
    return 'deep'
  }

  // default: safe
  return 'safe'
}

// ---- Strategy selection from mode ----

function strategyForMode(mode: BrainMode): string {
  const map: Record<BrainMode, string> = {
    fast: 'fast_sequential',
    safe: 'safe_incremental',
    deep: 'deep_analysis',
  }
  return map[mode]
}

// ---- Build initial patch queue skeleton ----
// Concrete patch breakdown happens in Patch Engine (P4).
// Planner outputs a high-level ordered skeleton.

function buildInitialQueue(goal: string, mode: BrainMode): PatchQueueItem[] {
  const baseItems: PatchQueueItem[] = [
    {
      patch_id: 'p0-foundation',
      title: 'Foundation: project setup & dependencies',
      priority: 1,
      status: 'pending',
      dependencies: [],
    },
    {
      patch_id: 'p1-agent-core',
      title: 'Agent Core: Gemma loop + CLI',
      priority: 2,
      status: 'pending',
      dependencies: ['p0-foundation'],
    },
    {
      patch_id: 'p2-context',
      title: 'Context Composer: normalize task input',
      priority: 3,
      status: 'pending',
      dependencies: ['p1-agent-core'],
    },
  ]

  if (mode === 'deep') {
    // Insert analysis patch before foundation
    baseItems.unshift({
      patch_id: 'p-analysis',
      title: 'Deep Analysis: architecture review before coding',
      priority: 0,
      status: 'pending',
      dependencies: [],
    })
    // Update p0 to depend on analysis
    baseItems[1].dependencies = ['p-analysis']
  }

  return baseItems
}

// ---- Public API ----

export function planTask(input: PlanInput): PlanResult {
  const mode = input.mode ?? detectMode(input.goal)
  const strategyName = strategyForMode(mode)
  const strategy = STRATEGIES[strategyName]
  const patch_queue = buildInitialQueue(input.goal, mode)

  const reasoning =
    `Goal: "${input.goal}". ` +
    `Mode auto-detected as "${mode}". ` +
    `Strategy "${strategyName}" selected: ${strategy.description}. ` +
    `Initial queue has ${patch_queue.length} patches.`

  // Update brain state
  const state = loadState()
  const planning = applyTransition(state, 'planning')
  const executing = applyTransition(
    {
      ...planning,
      current_goal: input.goal,
      mode,
      active_strategy: strategyName,
      patch_queue,
    },
    'executing'
  )
  saveState(executing)

  return { strategy: strategyName, mode, patch_queue, reasoning }
}

export function replan(failureContext: EvalResult, currentState: BrainState): PlanResult {
  const state = applyTransition(currentState, 'replanning')

  // Filter out permanently failed patches
  const remaining = state.patch_queue.filter(
    (p) => p.status !== 'done' && p.status !== 'skipped'
  )

  if (failureContext.recommendation === 'scope_down') {
    // Scope down: split the failing patch into 2 smaller patches
    remaining.forEach((p) => {
      if (p.patch_id === state.active_patch_id) {
        p.title = `[scoped-down] ${p.title}`
      }
    })
  } else if (failureContext.recommendation === 'skip') {
    remaining.forEach((p) => {
      if (p.patch_id === state.active_patch_id) {
        p.status = 'skipped'
      }
    })
  }

  const mode = state.mode
  const strategyName = strategyForMode(mode)

  const updatedState: BrainState = {
    ...state,
    status: 'executing',
    patch_queue: remaining,
    active_strategy: strategyName,
    updated_at: new Date().toISOString(),
  }
  saveState(updatedState)

  const reasoning =
    `Re-plan triggered. Recommendation: "${failureContext.recommendation}". ` +
    `Reason: ${failureContext.reasoning}. ` +
    `${remaining.length} patches remain.`

  return {
    strategy: strategyName,
    mode,
    patch_queue: remaining,
    reasoning,
  }
}

export function markPatchActive(patchId: string): BrainState {
  const state = loadState()
  const updated: BrainState = { ...state, active_patch_id: patchId }
  saveState(updated)
  return updated
}

export function recordFailure(entry: Omit<FailureEntry, 'timestamp'>): void {
  const state = loadState()
  const failEntry: FailureEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }
  const updated: BrainState = {
    ...state,
    failure_log: [...state.failure_log, failEntry],
  }
  saveState(updated)
}

// ============================================================
// Brain Layer — Shared Types
// Strategic Brain Layer: Patch -1
// ============================================================

export type BrainMode = 'fast' | 'safe' | 'deep'

export type BrainStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'blocked'
  | 'replanning'
  | 'done'
  | 'escalated'

// Valid state transitions
export const VALID_TRANSITIONS: Record<BrainStatus, BrainStatus[]> = {
  idle: ['planning'],
  planning: ['executing'],
  executing: ['done', 'blocked'],
  blocked: ['replanning', 'escalated'],
  replanning: ['executing'],
  done: ['idle'],
  escalated: ['idle'],
}

export type PatternType = 'failure' | 'approval'

export interface LearnedPattern {
  pattern_type: PatternType
  context: {
    repo: string
    module: string
    task_type: string
  }
  confidence: number        // 0.0 – 1.0
  last_validated: string    // ISO date string
  expires_after_days: number
  description: string
}

export interface FailureEntry {
  patch_id: string
  timestamp: string         // ISO date string
  reason: string
  category: 'gemma_failure' | 'scope_violation' | 'diff_rejected' | 'timeout' | 'unknown'
  attempt_count: number
}

export interface PatchQueueItem {
  patch_id: string
  title: string
  priority: number          // 1 = highest
  status: 'pending' | 'executing' | 'done' | 'failed' | 'skipped'
  dependencies: string[]    // patch_ids that must complete first
}

export interface BrainState {
  current_goal: string
  mode: BrainMode
  status: BrainStatus
  active_patch_id: string
  active_strategy: string
  patch_queue: PatchQueueItem[]
  failure_log: FailureEntry[]
  learned_patterns: LearnedPattern[]
  escalation_reason: string | null
  updated_at: string        // ISO date string
}

// ---- Planner types ----

export interface PlanInput {
  goal: string
  mode?: BrainMode
  context_summary?: string
}

export interface PlanResult {
  strategy: string
  mode: BrainMode
  patch_queue: PatchQueueItem[]
  reasoning: string
}

// ---- Evaluator types ----

export type PatchOutcome = 'success' | 'fail' | 'partial'

export interface PatchResult {
  patch_id: string
  outcome: PatchOutcome
  reason: string
  files_changed?: string[]
  diff_review_status?: 'pass' | 'warn' | 'fail' | 'block'
}

export interface EvalResult {
  should_replan: boolean
  should_escalate: boolean
  failure_category: FailureEntry['category']
  recommendation: 'retry' | 'scope_down' | 'skip' | 'escalate'
  reasoning: string
}

// ---- Strategy types ----

export interface Strategy {
  name: string
  description: string
  patch_approach: 'sequential' | 'parallel' | 'dependency_first'
  max_patch_size: 'small' | 'medium' | 'large'
  review_strictness: 'lenient' | 'standard' | 'strict'
}

export const STRATEGIES: Record<string, Strategy> = {
  fast_sequential: {
    name: 'fast_sequential',
    description: 'Ship quickly, minimal overhead, sequential patches',
    patch_approach: 'sequential',
    max_patch_size: 'medium',
    review_strictness: 'lenient',
  },
  safe_incremental: {
    name: 'safe_incremental',
    description: 'Small patches, strict review, rollback-first design',
    patch_approach: 'dependency_first',
    max_patch_size: 'small',
    review_strictness: 'strict',
  },
  deep_analysis: {
    name: 'deep_analysis',
    description: 'Full context analysis, architecture review before coding',
    patch_approach: 'dependency_first',
    max_patch_size: 'small',
    review_strictness: 'strict',
  },
}

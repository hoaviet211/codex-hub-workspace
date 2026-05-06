// ============================================================
// Memory Manager — LCO-specific memory types
// Patch 5: file-based memory layer over .orchestrator/memory/
// ============================================================

export type LCOMemoryKind = 'repo' | 'task' | 'patch' | 'decision' | 'pattern' | 'failure'

export interface RepoMemory {
  kind: 'repo'
  git_hash: string
  root_files: string[]
  top_dirs: string[]
  scanned_at: string
}

export interface TaskMemory {
  kind: 'task'
  task_id: string
  goal: string
  scope: string
  suggested_mode: 'fast' | 'safe' | 'deep'
  created_at: string
}

export interface PatchMemory {
  kind: 'patch'
  patch_id: string
  title: string
  status: 'done' | 'failed' | 'skipped'
  deliverable: string
  completed_at: string
}

export interface DecisionMemory {
  kind: 'decision'
  decision_id: string
  context: string
  decision: string
  rationale: string
  made_at: string
}

export interface PatternMemory {
  kind: 'pattern'
  pattern_type: 'failure' | 'approval'
  context: { repo: string; module: string; task_type: string }
  description: string
  confidence: number               // 0.0 – 1.0
  last_validated: string           // ISO date
  expires_after_days: number       // default 30
}

export interface FailureMemory {
  kind: 'failure'
  patch_id: string
  category: string                 // "gemma_timeout" | "scope_creep" | "type_error" | "other"
  reason: string
  attempt_count: number
  recorded_at: string
}

export type LCOMemory =
  | RepoMemory
  | TaskMemory
  | PatchMemory
  | DecisionMemory
  | PatternMemory
  | FailureMemory

// ============================================================
// Patch Engine — Types
// PatchSpec, PatchPlan, ReplanOption
// ============================================================

export interface PatchSpec {
  patch_id: string          // "patch-001", "patch-002", ...
  title: string
  scope: string             // which module/layer
  files_allowed: string[]   // files this patch may touch
  rollback_note: string     // how to fully undo this patch
  deliverable: string       // what "done" looks like
  priority: number          // 1 = highest
  dependencies: string[]    // patch_ids that must complete first
  risk: 'low' | 'medium' | 'high'
  status: 'pending' | 'executing' | 'done' | 'failed' | 'skipped'
}

export interface PatchPlan {
  task_goal: string
  created_at: string
  patches: PatchSpec[]
  suggested_mode: 'fast' | 'safe' | 'deep'
}

export type ReplanAction = 'retry' | 'scope-down' | 'skip'

export interface ReplanOption {
  action: ReplanAction
  reasoning: string
  adjusted_scope?: string   // only for scope-down
}

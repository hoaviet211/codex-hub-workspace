// ============================================================
// Handoff Generator — Types
// HandoffPrompt, ApprovalMode
// ============================================================

export type ApprovalMode = 'suggest' | 'auto-edit' | 'full-auto'

export interface HandoffPrompt {
  patch_id: string
  goal: string
  allowed_files: string[]
  forbidden_summary: string      // short description of what's off-limits
  instructions: string           // detailed step-by-step
  constraints: string[]
  deliverable: string
  approval_mode: ApprovalMode
  generated_at: string
}

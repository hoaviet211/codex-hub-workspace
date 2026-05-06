// ============================================================
// Handoff Generator — Codex CLI Template Renderer
// Pure function — no side effects, easy to test
// ============================================================

import type { HandoffPrompt } from './types.js'

/**
 * Renders a HandoffPrompt into the Codex CLI natural language task format.
 * Codex performs better with concise, structured prompts — keep it clean.
 */
export function renderCodexPrompt(handoff: HandoffPrompt): string {
  const allowedFilesList = handoff.allowed_files
    .map((f) => `- ${f}`)
    .join('\n')

  const constraintsList = handoff.constraints
    .map((c) => `- ${c}`)
    .join('\n')

  return `# Objective
${handoff.goal}

# Allowed Scope
${allowedFilesList || '- (no specific files listed)'}

# Forbidden Scope
- DO NOT touch: ${handoff.forbidden_summary}
- Approval mode: ${handoff.approval_mode}

# Instructions
${handoff.instructions}
${constraintsList ? '\nAdditional constraints:\n' + constraintsList : ''}
# Deliverable
${handoff.deliverable}
`.trimEnd() + '\n'
}

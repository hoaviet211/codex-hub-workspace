// ============================================================
// Diff Reviewer — Semantic Checker
// Uses Gemma to verify the diff logic matches the task brief
// ============================================================

import {
  callGemmaStructured,
  TEMPERATURE,
  type JsonSchema,
} from '../agent-core/ollama-client.js'
import type { TaskBrief } from '../context-composer/composer.js'
import type { DimensionResult } from './types.js'

// ---- Gemma response schema ----

interface SemanticResponse {
  alignment: string   // 'pass' | 'warn' | 'fail'
  reason: string
  uncertain: boolean
}

const SEMANTIC_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    alignment: { type: 'string' },
    reason:    { type: 'string' },
    uncertain: { type: 'string' },   // grammar-constrained JSON encodes booleans as strings in some models
  },
  required: ['alignment', 'reason', 'uncertain'],
}

// ---- escalate flag carrier (communicated via details array) ----
export const ESCALATE_FLAG = '__escalate__'

// ---- Public API ----

/**
 * Ask Gemma whether the diff correctly implements the intended patch deliverable.
 * Never throws — always returns a DimensionResult.
 *
 * @param diffContent        Raw git diff text
 * @param brief              Parsed TaskBrief (goal + scope)
 * @param patchDeliverable   PatchSpec.deliverable string
 */
export async function checkSemantic(
  diffContent: string,
  brief: TaskBrief,
  patchDeliverable: string
): Promise<DimensionResult> {
  const systemPrompt = `You are a code reviewer. Given a git diff and a task brief, determine if the diff correctly implements the intended change.

## Task brief
Goal: ${brief.goal}
Scope: ${brief.scope}
Deliverable: ${patchDeliverable}

## Diff (truncated to 1500 chars)
${diffContent.slice(0, 1500)}

Output MUST match this schema:
{"alignment": "pass|warn|fail", "reason": "string", "uncertain": boolean}`

  try {
    const raw = await callGemmaStructured<Record<string, unknown>>(
      [{ role: 'system', content: systemPrompt }],
      SEMANTIC_SCHEMA,
      { temperature: TEMPERATURE.review }
    )

    // Normalize fields — some Gemma versions encode booleans as strings
    const alignment =
      typeof raw['alignment'] === 'string' ? raw['alignment'].trim().toLowerCase() : 'warn'
    const reason =
      typeof raw['reason'] === 'string' ? raw['reason'].trim() : 'No reason provided.'
    const uncertain =
      raw['uncertain'] === true ||
      raw['uncertain'] === 'true' ||
      raw['uncertain'] === 1

    // Map alignment → ReviewOutcome
    type ReviewOutcome = 'pass' | 'warn' | 'fail' | 'block'
    const outcomeMap: Record<string, ReviewOutcome> = {
      pass: 'pass',
      warn: 'warn',
      fail: 'fail',
    }
    const outcome: ReviewOutcome = outcomeMap[alignment] ?? 'warn'

    const details: string[] = []
    if (uncertain) details.push(ESCALATE_FLAG)

    return {
      dimension: 'semantic',
      outcome,
      reason,
      ...(details.length > 0 ? { details } : {}),
    }
  } catch {
    // Gemma unavailable — return warn so the pipeline doesn't hard-block
    return {
      dimension: 'semantic',
      outcome: 'warn',
      reason: 'Gemma unavailable — manual review required.',
      details: [ESCALATE_FLAG],
    }
  }
}

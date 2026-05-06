// ============================================================
// Context Composer — Raw input → TaskBrief JSON
//
// Flow:
//   1. Build messages (system prompt + user message)
//   2. Call Gemma via callGemmaStructured (3 retries built-in)
//   3. If Gemma fails → fallback: hardcoded template (empty fields / "safe")
//   4. Normalize + validate output (clamp suggested_mode to valid values)
//   5. composeAndPersist(): write .orchestrator/current-task.md + update state.json
//
// Gemma hardening applied:
//   - format param (grammar-constrained JSON) via callGemmaStructured
//   - few-shot examples in system prompt (prompts.ts)
//   - temperature: TEMPERATURE.compose (0.2) — slight flex for edge cases
//   - input cap enforced in buildComposerUserMessage()
// ============================================================

import fs from 'fs'
import path from 'path'
import {
  callGemmaStructured,
  JsonSchema,
  OllamaConnectionError,
  TEMPERATURE,
} from '../agent-core/ollama-client.js'
import { loadAgentState, saveAgentState } from '../agent-core/state.js'
import { COMPOSER_SYSTEM_PROMPT, buildComposerUserMessage } from './prompts.js'

// ---- Types ----

export type SuggestedMode = 'fast' | 'safe' | 'deep'

export interface TaskBrief {
  goal: string
  scope: string
  constraints: string[]
  open_questions: string[]
  suggested_mode: SuggestedMode
}

export interface ComposeResult {
  brief: TaskBrief
  /** true if Gemma failed all retries and fallback template was used */
  usedFallback: boolean
}

// ---- Ollama JSON schema (grammar-constrained generation — P0) ----

const TASK_BRIEF_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    goal:           { type: 'string' },
    scope:          { type: 'string' },
    constraints:    { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' } },
    suggested_mode: { type: 'string' },
  },
  required: ['goal', 'scope', 'constraints', 'open_questions', 'suggested_mode'],
}

// ---- Paths ----

const ORCHESTRATOR_DIR = path.resolve(process.cwd(), '.orchestrator')
const CURRENT_TASK_FILE = path.join(ORCHESTRATOR_DIR, 'current-task.md')

// ---- Fallback template ----
// Used when Gemma fails all 3 retries (per task-doc: fill missing field = empty string / "safe")

function buildFallbackBrief(rawInput: string): TaskBrief {
  return {
    goal: rawInput.trim().slice(0, 200) || '',
    scope: '',
    constraints: [],
    open_questions: [
      'Context Composer could not parse this input — please clarify the task.',
    ],
    suggested_mode: 'safe',
  }
}

// ---- Normalization ----

const VALID_MODES: SuggestedMode[] = ['fast', 'safe', 'deep']

/**
 * Normalize and validate a raw Gemma output object into a TaskBrief.
 * Coerces types and clamps suggested_mode to valid values.
 */
function normalizeBrief(
  raw: Record<string, unknown>,
  fallbackInput: string
): TaskBrief {
  const goal =
    typeof raw['goal'] === 'string' && raw['goal'].trim()
      ? raw['goal'].trim()
      : fallbackInput.trim().slice(0, 200)

  const scope =
    typeof raw['scope'] === 'string' ? raw['scope'].trim() : ''

  const constraints = Array.isArray(raw['constraints'])
    ? raw['constraints'].filter((c): c is string => typeof c === 'string')
    : []

  const openQuestions = Array.isArray(raw['open_questions'])
    ? raw['open_questions'].filter((q): q is string => typeof q === 'string')
    : []

  const rawMode =
    typeof raw['suggested_mode'] === 'string' ? raw['suggested_mode'] : 'safe'
  const suggestedMode: SuggestedMode = VALID_MODES.includes(
    rawMode as SuggestedMode
  )
    ? (rawMode as SuggestedMode)
    : 'safe'

  return { goal, scope, constraints, open_questions: openQuestions, suggested_mode: suggestedMode }
}

// ---- File writers ----

function ensureOrchestratorDir(): void {
  if (!fs.existsSync(ORCHESTRATOR_DIR)) {
    fs.mkdirSync(ORCHESTRATOR_DIR, { recursive: true })
  }
}

function formatBriefAsMarkdown(brief: TaskBrief, rawInput: string): string {
  const now = new Date().toISOString()
  const constraints =
    brief.constraints.length > 0
      ? brief.constraints.map((c) => `- ${c}`).join('\n')
      : '- (none)'
  const questions =
    brief.open_questions.length > 0
      ? brief.open_questions.map((q) => `- ${q}`).join('\n')
      : '- (none)'
  const rawPreview =
    rawInput.length > 500
      ? rawInput.slice(0, 500) + '...'
      : rawInput

  return `# Current Task Brief

> Generated: ${now}
> Mode: **${brief.suggested_mode}**

## Goal

${brief.goal}

## Scope

${brief.scope || '(not specified)'}

## Constraints

${constraints}

## Open Questions

${questions}

---

_Raw input:_ ${rawPreview}
`
}

function writeCurrentTask(brief: TaskBrief, rawInput: string): void {
  ensureOrchestratorDir()
  fs.writeFileSync(CURRENT_TASK_FILE, formatBriefAsMarkdown(brief, rawInput), 'utf-8')
}

function updateStateWithBrief(brief: TaskBrief): void {
  const state = loadAgentState()
  saveAgentState({
    ...state,
    goal: brief.goal,
    status: 'running',
    updated_at: new Date().toISOString(),
  })
}

// ---- Public API ----

/**
 * Normalize raw task input → TaskBrief.
 *
 * - Uses callGemmaStructured with grammar-constrained JSON (P0 format param)
 * - 3 retries handled inside callGemmaStructured (simplified prompt each retry)
 * - Falls back to hardcoded template if all retries fail
 * - Rethrows OllamaConnectionError (Ollama not running — not a fallback case)
 */
export async function composeTask(rawInput: string): Promise<ComposeResult> {
  if (!rawInput || rawInput.trim().length < 3) {
    return { brief: buildFallbackBrief(rawInput), usedFallback: true }
  }

  const messages = [
    { role: 'system' as const, content: COMPOSER_SYSTEM_PROMPT },
    { role: 'user' as const, content: buildComposerUserMessage(rawInput) },
  ]

  try {
    const raw = await callGemmaStructured<Record<string, unknown>>(
      messages,
      TASK_BRIEF_SCHEMA,
      { temperature: TEMPERATURE.compose }
    )
    const brief = normalizeBrief(raw, rawInput)
    return { brief, usedFallback: false }
  } catch (err) {
    if (err instanceof OllamaConnectionError) {
      throw err  // re-throw: Ollama is not running, can't fall back
    }
    // Gemma failed 3 times — use hardcoded template (per task-doc fallback spec)
    return { brief: buildFallbackBrief(rawInput), usedFallback: true }
  }
}

/**
 * Full compose pipeline: call Gemma → write .orchestrator/current-task.md
 * → update .orchestrator/state.json.
 *
 * Pass dryRun=true to skip file writes (for --dry-run CLI flag).
 */
export async function composeAndPersist(
  rawInput: string,
  dryRun = false
): Promise<ComposeResult> {
  const result = await composeTask(rawInput)

  if (!dryRun) {
    writeCurrentTask(result.brief, rawInput)
    updateStateWithBrief(result.brief)
  }

  return result
}

// ============================================================
// Patch Engine — Splitter
// task brief + repo map → patch sequence (via Gemma)
//
// Hardening applied:
//   - format param (grammar-constrained JSON) via callGemmaStructured
//   - 2 few-shot examples in system prompt
//   - temperature: TEMPERATURE.patch (0.4) — some creativity for good splits
//   - input cap at 1800 chars
//   - fallback: single-patch plan when Gemma fails all retries
// ============================================================

import fs from 'fs'
import path from 'path'
import {
  callGemmaStructured,
  JsonSchema,
  OllamaConnectionError,
  TEMPERATURE,
} from '../agent-core/ollama-client.js'
import type { TaskBrief } from '../context-composer/composer.js'
import type { Tier1Result } from '../workspace-scanner/types.js'
import type { PatchSpec, PatchPlan } from './types.js'
import { prioritizePatchPlan } from './prioritizer.js'

// ---- Paths ----

const ORCHESTRATOR_DIR = path.resolve(process.cwd(), '.orchestrator')
const PATCHES_DIR = path.join(ORCHESTRATOR_DIR, 'patches')
const PLAN_FILE = path.join(PATCHES_DIR, 'plan.json')

// ---- Input cap ----

const MAX_INPUT_CHARS = 1800

// ---- JSON schema for Ollama grammar-constrained generation ----

const PATCH_PLAN_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    patches: { type: 'array', items: { type: 'object' } },
  },
  required: ['patches'],
}

// ---- System prompt with few-shot examples ----

const SPLITTER_SYSTEM_PROMPT = `You are Patch Splitter. Your job is to break a task brief into an ordered sequence of small, rollback-safe patches.

## Examples

Example 1 — Simple task (2 patches):
Input task_goal: "Add user login endpoint"
Input scope: "src/auth/"
Input repo top dirs: ["src", "tests", "docs"]
Output: {"patches":[{"patch_id":"patch-001","title":"Add login route handler","scope":"src/auth/","files_allowed":["src/auth/login.ts","src/auth/types.ts"],"rollback_note":"Delete src/auth/login.ts and revert src/auth/types.ts","deliverable":"POST /auth/login returns JWT token","priority":1,"dependencies":[],"risk":"medium","status":"pending"},{"patch_id":"patch-002","title":"Add login tests","scope":"tests/auth/","files_allowed":["tests/auth/login.test.ts"],"rollback_note":"Delete tests/auth/login.test.ts","deliverable":"login route tests pass","priority":2,"dependencies":["patch-001"],"risk":"low","status":"pending"}]}

Example 2 — Complex task (4 patches):
Input task_goal: "Refactor data layer to repository pattern"
Input scope: "src/services/, src/models/"
Input repo top dirs: ["src", "tests", "migrations", "docs"]
Output: {"patches":[{"patch_id":"patch-001","title":"Define repository interfaces","scope":"src/models/","files_allowed":["src/models/repository.ts"],"rollback_note":"Delete src/models/repository.ts","deliverable":"IRepository<T> interface defined and exported","priority":1,"dependencies":[],"risk":"low","status":"pending"},{"patch_id":"patch-002","title":"Implement UserRepository","scope":"src/services/","files_allowed":["src/services/user-repository.ts"],"rollback_note":"Delete src/services/user-repository.ts","deliverable":"UserRepository implements IRepository, all CRUD methods work","priority":2,"dependencies":["patch-001"],"risk":"medium","status":"pending"},{"patch_id":"patch-003","title":"Implement OrderRepository","scope":"src/services/","files_allowed":["src/services/order-repository.ts"],"rollback_note":"Delete src/services/order-repository.ts","deliverable":"OrderRepository implements IRepository, all CRUD methods work","priority":3,"dependencies":["patch-001"],"risk":"medium","status":"pending"},{"patch_id":"patch-004","title":"Update service layer to use repositories","scope":"src/services/","files_allowed":["src/services/user.service.ts","src/services/order.service.ts"],"rollback_note":"Revert src/services/user.service.ts and src/services/order.service.ts to previous version","deliverable":"All service methods use repository pattern, no direct DB calls","priority":4,"dependencies":["patch-002","patch-003"],"risk":"high","status":"pending"}]}

## Rules
- Each patch must be small enough to complete in one focused session
- files_allowed must be specific file paths (not glob patterns)
- rollback_note must be actionable — how to fully undo this patch
- dependencies must reference patch_ids defined in this plan
- risk: "low" = new file only | "medium" = modifying existing | "high" = touching core/schema/auth
- status: always "pending" for new plans
- Output ONLY the JSON object — no explanation, no markdown fences

Output MUST match this schema exactly:
{"patches":[{"patch_id":"string","title":"string","scope":"string","files_allowed":["string"],"rollback_note":"string","deliverable":"string","priority":1,"dependencies":["string"],"risk":"low|medium|high","status":"pending"}]}`

// ---- User message builder ----

function buildSplitterUserMessage(brief: TaskBrief, repoMap: Tier1Result): string {
  const repoContext = [
    `Top dirs: ${repoMap.topDirs.slice(0, 10).join(', ')}`,
    `Root files: ${repoMap.rootFiles.slice(0, 10).join(', ')}`,
  ].join('\n')

  const raw =
    `Input task_goal: "${brief.goal}"\n` +
    `Input scope: "${brief.scope}"\n` +
    `Input constraints: ${brief.constraints.join('; ') || '(none)'}\n` +
    `Input repo context:\n${repoContext}\n` +
    `Output:`

  const capped =
    raw.length > MAX_INPUT_CHARS
      ? raw.slice(0, MAX_INPUT_CHARS) + '... [truncated]'
      : raw

  return capped
}

// ---- Patch normalization ----

const VALID_RISKS = ['low', 'medium', 'high'] as const
const VALID_STATUSES = ['pending', 'executing', 'done', 'failed', 'skipped'] as const

function normalizePatch(raw: unknown, index: number): PatchSpec {
  const obj = (typeof raw === 'object' && raw !== null && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {}

  const padded = String(index + 1).padStart(3, '0')
  const patch_id =
    typeof obj['patch_id'] === 'string' && obj['patch_id'].trim()
      ? obj['patch_id'].trim()
      : `patch-${padded}`

  const title =
    typeof obj['title'] === 'string' && obj['title'].trim()
      ? obj['title'].trim()
      : `Patch ${padded}`

  const scope =
    typeof obj['scope'] === 'string' ? obj['scope'].trim() : ''

  const files_allowed = Array.isArray(obj['files_allowed'])
    ? obj['files_allowed'].filter((f): f is string => typeof f === 'string')
    : []

  const rollback_note =
    typeof obj['rollback_note'] === 'string' && obj['rollback_note'].trim()
      ? obj['rollback_note'].trim()
      : 'manual revert'

  const deliverable =
    typeof obj['deliverable'] === 'string' && obj['deliverable'].trim()
      ? obj['deliverable'].trim()
      : ''

  const priority =
    typeof obj['priority'] === 'number' ? obj['priority'] : index + 1

  const dependencies = Array.isArray(obj['dependencies'])
    ? obj['dependencies'].filter((d): d is string => typeof d === 'string')
    : []

  const rawRisk = typeof obj['risk'] === 'string' ? obj['risk'] : 'medium'
  const risk: PatchSpec['risk'] = (VALID_RISKS as readonly string[]).includes(rawRisk)
    ? (rawRisk as PatchSpec['risk'])
    : 'medium'

  const rawStatus = typeof obj['status'] === 'string' ? obj['status'] : 'pending'
  const status: PatchSpec['status'] = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as PatchSpec['status'])
    : 'pending'

  return { patch_id, title, scope, files_allowed, rollback_note, deliverable, priority, dependencies, risk, status }
}

// ---- Fallback plan ----

function buildFallbackPlan(brief: TaskBrief): PatchPlan {
  const now = new Date().toISOString()
  const patch: PatchSpec = {
    patch_id: 'patch-001',
    title: brief.goal.slice(0, 80) || 'Main patch',
    scope: brief.scope || '(unknown)',
    files_allowed: [],
    rollback_note: 'manual revert',
    deliverable: brief.goal,
    priority: 1,
    dependencies: [],
    risk: 'medium',
    status: 'pending',
  }
  return {
    task_goal: brief.goal,
    created_at: now,
    patches: [patch],
    suggested_mode: brief.suggested_mode,
  }
}

// ---- File writer ----

function writePlanFile(plan: PatchPlan): void {
  fs.mkdirSync(PATCHES_DIR, { recursive: true })
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf-8')
}

// ---- Public API ----

/**
 * Split a task brief + repo map into an ordered PatchPlan using Gemma.
 *
 * Steps:
 *   1. Build messages with few-shot system prompt
 *   2. Call callGemmaStructured (3 retries built-in)
 *   3. If Gemma fails → single-patch fallback plan
 *   4. Normalize each patch object
 *   5. Call prioritizePatchPlan() to topologically sort
 *   6. Write plan to .orchestrator/patches/plan.json (unless dryRun)
 *
 * Rethrows OllamaConnectionError — Ollama not running is not a fallback case.
 */
export async function splitTask(
  brief: TaskBrief,
  repoMap: Tier1Result,
  dryRun = false
): Promise<PatchPlan> {
  const messages = [
    { role: 'system' as const, content: SPLITTER_SYSTEM_PROMPT },
    { role: 'user' as const, content: buildSplitterUserMessage(brief, repoMap) },
  ]

  let rawPatches: unknown[]

  try {
    const result = await callGemmaStructured<{ patches: unknown[] }>(
      messages,
      PATCH_PLAN_SCHEMA,
      { temperature: TEMPERATURE.patch }
    )
    rawPatches = Array.isArray(result['patches']) ? result['patches'] : []
  } catch (err) {
    if (err instanceof OllamaConnectionError) {
      throw err  // re-throw: Ollama not running
    }
    // Gemma failed all retries — use fallback plan
    console.warn('[splitter] Gemma failed — using single-patch fallback plan.')
    const fallback = buildFallbackPlan(brief)
    if (!dryRun) writePlanFile(fallback)
    return fallback
  }

  // Normalize patches
  const patches = rawPatches.map((raw, i) => normalizePatch(raw, i))

  const now = new Date().toISOString()
  const rawPlan: PatchPlan = {
    task_goal: brief.goal,
    created_at: now,
    patches,
    suggested_mode: brief.suggested_mode,
  }

  // Sort by dependency + risk
  const plan = prioritizePatchPlan(rawPlan)

  if (!dryRun) {
    writePlanFile(plan)
  }

  return plan
}

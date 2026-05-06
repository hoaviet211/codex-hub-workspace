// ============================================================
// Agent Core — Task State Manager
// Patch 1: reads/writes .orchestrator/state.json
// Schema: { task_id, goal, status, active_patch_id, created_at }
//
// Separate from brain/state.ts (BrainState) — this tracks the
// *current agent task session*, not the strategic brain layer.
// Brain state = long-term goal + patch queue.
// Agent state = what task is running RIGHT NOW + which patch.
// ============================================================

import fs from 'fs'
import path from 'path'

// ---- Schema ----

export type AgentTaskStatus = 'idle' | 'running' | 'done' | 'blocked'

export interface AgentState {
  task_id: string
  goal: string
  status: AgentTaskStatus
  active_patch_id: string
  created_at: string       // ISO date string
  updated_at: string       // ISO date string
}

// ---- Paths ----

const STATE_DIR = path.resolve(process.cwd(), '.orchestrator')
const STATE_FILE = path.join(STATE_DIR, 'state.json')

const INITIAL_STATE: AgentState = {
  task_id: '',
  goal: '',
  status: 'idle',
  active_patch_id: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ---- Helpers ----

function ensureDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
  }
}

function generateTaskId(): string {
  const now = new Date()
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  return `task-${stamp}`
}

// ---- Public API ----

export function loadAgentState(): AgentState {
  ensureDir()
  if (!fs.existsSync(STATE_FILE)) {
    return { ...INITIAL_STATE, updated_at: new Date().toISOString() }
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(raw) as AgentState
  } catch {
    console.warn('[AgentState] Failed to parse state.json — resetting to initial state')
    return { ...INITIAL_STATE, updated_at: new Date().toISOString() }
  }
}

export function saveAgentState(state: AgentState): void {
  ensureDir()
  const updated: AgentState = { ...state, updated_at: new Date().toISOString() }
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2), 'utf-8')
}

/** Create a new task and persist it. Returns the new state. */
export function createTask(goal: string, patchId = ''): AgentState {
  const now = new Date().toISOString()
  const state: AgentState = {
    task_id: generateTaskId(),
    goal,
    status: 'running',
    active_patch_id: patchId,
    created_at: now,
    updated_at: now,
  }
  saveAgentState(state)
  return state
}

/** Update just the status (and optionally active_patch_id). */
export function updateTaskStatus(
  status: AgentTaskStatus,
  activePatchId?: string
): AgentState {
  const current = loadAgentState()
  const next: AgentState = {
    ...current,
    status,
    ...(activePatchId !== undefined ? { active_patch_id: activePatchId } : {}),
    updated_at: new Date().toISOString(),
  }
  saveAgentState(next)
  return next
}

export function getStatePath(): string {
  return STATE_FILE
}

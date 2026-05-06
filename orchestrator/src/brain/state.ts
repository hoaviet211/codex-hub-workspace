// ============================================================
// Brain Layer — State Manager
// Reads/writes .orchestrator/brain-state.json
// ============================================================

import fs from 'fs'
import path from 'path'
import { BrainState, BrainStatus, VALID_TRANSITIONS } from './types.js'

const STATE_DIR = path.resolve(process.cwd(), '.orchestrator')
const STATE_FILE = path.join(STATE_DIR, 'brain-state.json')

const INITIAL_STATE: BrainState = {
  current_goal: '',
  mode: 'safe',
  status: 'idle',
  active_patch_id: '',
  active_strategy: '',
  patch_queue: [],
  failure_log: [],
  learned_patterns: [],
  escalation_reason: null,
  updated_at: new Date().toISOString(),
}

export function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true })
  }
}

export function loadState(): BrainState {
  ensureStateDir()
  if (!fs.existsSync(STATE_FILE)) {
    return { ...INITIAL_STATE, updated_at: new Date().toISOString() }
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(raw) as BrainState
  } catch {
    console.warn('[BrainState] Failed to parse brain-state.json — resetting to initial state')
    return { ...INITIAL_STATE, updated_at: new Date().toISOString() }
  }
}

export function saveState(state: BrainState): void {
  ensureStateDir()
  const updated: BrainState = { ...state, updated_at: new Date().toISOString() }
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2), 'utf-8')
}

export function transition(from: BrainStatus, to: BrainStatus): boolean {
  const allowed = VALID_TRANSITIONS[from]
  return allowed.includes(to)
}

export function applyTransition(
  state: BrainState,
  nextStatus: BrainStatus,
  escalationReason?: string
): BrainState {
  if (!transition(state.status, nextStatus)) {
    throw new Error(
      `[BrainState] Invalid transition: ${state.status} → ${nextStatus}. ` +
      `Allowed: ${VALID_TRANSITIONS[state.status].join(', ')}`
    )
  }
  return {
    ...state,
    status: nextStatus,
    escalation_reason: escalationReason ?? state.escalation_reason,
    updated_at: new Date().toISOString(),
  }
}

export function resetState(): BrainState {
  const fresh: BrainState = { ...INITIAL_STATE, updated_at: new Date().toISOString() }
  saveState(fresh)
  return fresh
}

export function getStatePath(): string {
  return STATE_FILE
}

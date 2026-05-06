// ============================================================
// Memory Manager — File-based memory layer
// Patch 5: reads/writes .orchestrator/memory/ files
//
// File layout:
//   .orchestrator/memory/
//     decisions.json    ← DecisionMemory[]
//     patterns.json     ← PatternMemory[]
//     failures.json     ← FailureMemory[]
//     tasks/task-YYYY-MM-DD.json  ← TaskMemory (one per day)
//     patches/patch-XXX.json      ← PatchMemory (written by Patch Engine, read here)
//
// Write strategy: read → append → write to .tmp → rename (atomic)
// ============================================================

import fs from 'fs'
import path from 'path'
import type {
  TaskMemory,
  PatchMemory,
  DecisionMemory,
  PatternMemory,
  FailureMemory,
} from './types.js'

// ---- Paths ----

const MEMORY_DIR = path.resolve(process.cwd(), '.orchestrator', 'memory')
const DECISIONS_FILE = path.join(MEMORY_DIR, 'decisions.json')
const PATTERNS_FILE = path.join(MEMORY_DIR, 'patterns.json')
const FAILURES_FILE = path.join(MEMORY_DIR, 'failures.json')
const TASKS_DIR = path.join(MEMORY_DIR, 'tasks')
const PATCHES_DIR = path.join(MEMORY_DIR, 'patches')

// ---- Helpers ----

function ensureMemoryDir(): void {
  for (const dir of [MEMORY_DIR, TASKS_DIR, PATCHES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

/**
 * Read a JSON array file. Returns an empty array if the file is missing or
 * cannot be parsed.
 */
function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return []
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as T[]
    return []
  } catch {
    console.warn(`[MemoryManager] Failed to parse ${filePath} — treating as empty array`)
    return []
  }
}

/**
 * Write an array to a JSON file atomically (write .tmp then rename).
 */
function writeJsonArrayAtomic<T>(filePath: string, data: T[]): void {
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, filePath)
}

/**
 * Append a single record to a JSON array file atomically.
 */
function appendToJsonFile<T>(filePath: string, record: T): void {
  ensureMemoryDir()
  const existing = readJsonArray<T>(filePath)
  existing.push(record)
  writeJsonArrayAtomic(filePath, existing)
}

// ---- Write Functions ----

/**
 * Write a TaskMemory record to tasks/task-YYYY-MM-DD.json (one file per day).
 * Multiple tasks on the same day are appended to the same file.
 */
export function writeTaskMemory(memory: TaskMemory): void {
  ensureMemoryDir()
  const dateStr = memory.created_at.slice(0, 10)  // "YYYY-MM-DD"
  const taskFile = path.join(TASKS_DIR, `task-${dateStr}.json`)
  appendToJsonFile<TaskMemory>(taskFile, memory)
}

/**
 * Write a PatchMemory record to patches/patch-XXX.json.
 * One file per patch_id — overwrites if it already exists (status may change).
 */
export function writePatchMemory(memory: PatchMemory): void {
  ensureMemoryDir()
  const patchFile = path.join(PATCHES_DIR, `${memory.patch_id}.json`)
  const tmpPath = patchFile + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(memory, null, 2), 'utf-8')
  fs.renameSync(tmpPath, patchFile)
}

/**
 * Append a DecisionMemory record to decisions.json.
 */
export function writeDecisionMemory(memory: DecisionMemory): void {
  appendToJsonFile<DecisionMemory>(DECISIONS_FILE, memory)
}

/**
 * Append a FailureMemory record to failures.json.
 */
export function writeFailureMemory(memory: FailureMemory): void {
  appendToJsonFile<FailureMemory>(FAILURES_FILE, memory)
}

/**
 * Write (replace) the full patterns array to patterns.json.
 * Used by pattern-learner and failure-analyzer after computing new patterns.
 */
export function writePatterns(patterns: PatternMemory[]): void {
  ensureMemoryDir()
  writeJsonArrayAtomic<PatternMemory>(PATTERNS_FILE, patterns)
}

// ---- Read Functions ----

export function readDecisions(): DecisionMemory[] {
  return readJsonArray<DecisionMemory>(DECISIONS_FILE)
}

export function readPatterns(): PatternMemory[] {
  return readJsonArray<PatternMemory>(PATTERNS_FILE)
}

export function readFailures(): FailureMemory[] {
  return readJsonArray<FailureMemory>(FAILURES_FILE)
}

/**
 * Read all patch memories from patches/. One JSON file per patch.
 * Skips any files that cannot be parsed.
 */
export function readPatchHistory(): PatchMemory[] {
  if (!fs.existsSync(PATCHES_DIR)) return []
  const files = fs.readdirSync(PATCHES_DIR).filter((f) => f.endsWith('.json'))
  const patches: PatchMemory[] = []
  for (const file of files) {
    const filePath = path.join(PATCHES_DIR, file)
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && (parsed as PatchMemory).kind === 'patch') {
        patches.push(parsed as PatchMemory)
      }
    } catch {
      console.warn(`[MemoryManager] Could not parse ${filePath} — skipping`)
    }
  }
  return patches
}

/**
 * Read all task memories across all daily task files.
 */
export function readAllTaskMemories(): TaskMemory[] {
  if (!fs.existsSync(TASKS_DIR)) return []
  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'))
  const tasks: TaskMemory[] = []
  for (const file of files) {
    const entries = readJsonArray<TaskMemory>(path.join(TASKS_DIR, file))
    tasks.push(...entries)
  }
  return tasks
}

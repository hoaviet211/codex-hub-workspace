// ============================================================
// Workspace Scanner — Cache
// Reads/writes .orchestrator/memory/repo.json
// Invalidation: git-hash comparison via `git rev-parse HEAD`
// ============================================================

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import type { RepoMap, Tier1Result, Tier2Result, Tier3Result } from './types.js'

// ---- Paths ----

const MEMORY_DIR = path.resolve(process.cwd(), '.orchestrator', 'memory')
const CACHE_FILE = path.join(MEMORY_DIR, 'repo.json')

// ---- Git hash ----

/** Get the current HEAD git hash, or "no-git" if not in a repo. */
export function getGitHash(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'no-git'
  }
}

// ---- Ensure dir ----

/** Create .orchestrator/memory/ directory if it does not exist. */
function ensureMemoryDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true })
  }
}

// ---- Read/write cache ----

/** Read the repo.json cache file, returning null on missing or parse error. */
export function readCache(): RepoMap | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8')
    return JSON.parse(raw) as RepoMap
  } catch {
    return null
  }
}

/** Write (or overwrite) the full RepoMap to .orchestrator/memory/repo.json. */
export function writeCache(map: RepoMap): void {
  try {
    ensureMemoryDir()
    fs.writeFileSync(CACHE_FILE, JSON.stringify(map, null, 2), 'utf-8')
  } catch (err) {
    console.warn('[cache] Failed to write repo.json:', err instanceof Error ? err.message : String(err))
  }
}

// ---- Cache-hit helpers ----

/** Return cached Tier1Result if git hash matches, otherwise null. */
export function getCachedTier1(): { result: Tier1Result; hash: string } | null {
  const cache = readCache()
  if (!cache || !cache.tier1) return null
  const currentHash = getGitHash()
  if (cache.git_hash !== currentHash) return null
  return { result: cache.tier1, hash: currentHash }
}

/** Merge new tier data into the cache file (creates if missing). */
export function mergeTierIntoCache(
  tier: 1 | 2 | 3,
  data: Tier1Result | Tier2Result | Tier3Result,
  gitHash: string
): void {
  const existing = readCache()
  const now = new Date().toISOString()

  const base: RepoMap = existing ?? {
    git_hash: gitHash,
    scanned_at: now,
    tier1: null,
    tier2: null,
    tier3: null,
  }

  const updated: RepoMap = {
    ...base,
    git_hash: gitHash,
    scanned_at: now,
    ...(tier === 1 ? { tier1: data as Tier1Result } : {}),
    ...(tier === 2 ? { tier2: data as Tier2Result } : {}),
    ...(tier === 3 ? { tier3: data as Tier3Result } : {}),
  }

  writeCache(updated)
}

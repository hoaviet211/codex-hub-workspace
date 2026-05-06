// ============================================================
// Workspace Scanner — Main scanner
// 3-tier scanning logic: Skeleton | Contextual | Deep
// Scanning root = process.cwd() (Codex Hub workspace root)
// File cap: 1000 files max (warns on overflow)
// ============================================================

import fs from 'fs'
import path from 'path'
import { getCachedTier1, getGitHash, mergeTierIntoCache } from './cache.js'
import type {
  FilePreview,
  ScanResultTier1,
  ScanResultTier2,
  ScanResultTier3,
  Tier1Result,
  Tier2Result,
  Tier3Result,
} from './types.js'

// ---- Constants ----

const WORKSPACE_ROOT = path.resolve(process.cwd())
const FILE_LIMIT = 1000
const TIER2_MAX_DEPTH = 4
const TIER3_PREVIEW_LINES = 20

// ---- Tier 1 config files ----

const TIER1_ROOT_FILES = ['package.json', 'tsconfig.json', 'config.yaml', 'AGENTS.md']

// ---- Utility: read JSON safely ----

/** Parse a JSON file, returning an empty object on any error. */
function safeReadJson(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ---- Utility: read YAML key-values as plain object (no dep) ----

/** Read a YAML-ish config file and return top-level key: value pairs as strings. */
function safeReadYaml(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const result: Record<string, unknown> = {}
    for (const line of raw.split('\n')) {
      const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim())
      if (match) {
        result[match[1]] = match[2].trim()
      }
    }
    return result
  } catch {
    return {}
  }
}

// ---- Utility: read first N lines ----

/** Read the first N lines of a text file, returning empty string on error. */
function readFirstLines(filePath: string, n: number): string {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return raw.split('\n').slice(0, n).join('\n')
  } catch {
    return ''
  }
}

// ---- Utility: recursive file walk with depth cap and file count cap ----

interface WalkOptions {
  maxDepth: number
  currentDepth?: number
  fileList?: string[]
  dirList?: string[]
  capped?: { hit: boolean }
}

/** Recursively collect files and dirs up to maxDepth, stopping at FILE_LIMIT total files. */
function walkDir(dir: string, opts: WalkOptions): void {
  const depth = opts.currentDepth ?? 0
  if (depth > opts.maxDepth) return

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    // skip hidden dirs (node_modules, .git, .orchestrator internals)
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      opts.dirList?.push(fullPath)
      walkDir(fullPath, { ...opts, currentDepth: depth + 1 })
    } else if (entry.isFile()) {
      if (opts.fileList) {
        if (opts.fileList.length >= FILE_LIMIT) {
          if (opts.capped) opts.capped.hit = true
          return
        }
        opts.fileList.push(fullPath)
      }
    }
  }
}

// ============================================================
// TIER 1 — Skeleton
// ============================================================

/** Tier 1: Read root config files + list top-level dirs. Cache-aware. */
export async function scanTier1(dryRun = false): Promise<ScanResultTier1> {
  // Cache check
  const cached = getCachedTier1()
  if (cached) {
    return { tier: 1, cacheHit: true, data: cached.result }
  }

  // Root files
  const rootFiles: string[] = []
  for (const name of TIER1_ROOT_FILES) {
    const full = path.join(WORKSPACE_ROOT, name)
    if (fs.existsSync(full)) rootFiles.push(full)
  }

  // Top-level dirs (no recursion)
  const topDirs: string[] = []
  try {
    const entries = fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        topDirs.push(entry.name)
      }
    }
  } catch {
    // swallow — return partial result
  }

  // Config summary: parse known config files
  const configSummary: Record<string, unknown> = {}

  const pkgPath = path.join(WORKSPACE_ROOT, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = safeReadJson(pkgPath)
    configSummary['package.json'] = {
      name: pkg['name'],
      version: pkg['version'],
      scripts: Object.keys((pkg['scripts'] as Record<string, unknown>) ?? {}),
    }
  }

  const tscPath = path.join(WORKSPACE_ROOT, 'tsconfig.json')
  if (fs.existsSync(tscPath)) {
    const tsc = safeReadJson(tscPath)
    configSummary['tsconfig.json'] = tsc
  }

  const configYamlPath = path.join(WORKSPACE_ROOT, 'config.yaml')
  if (fs.existsSync(configYamlPath)) {
    configSummary['config.yaml'] = safeReadYaml(configYamlPath)
  }

  const agentsPath = path.join(WORKSPACE_ROOT, 'AGENTS.md')
  if (fs.existsSync(agentsPath)) {
    configSummary['AGENTS.md'] = { exists: true }
  }

  const result: Tier1Result = { rootFiles, topDirs, configSummary }

  if (!dryRun) {
    const hash = getGitHash()
    mergeTierIntoCache(1, result, hash)
  }

  return { tier: 1, cacheHit: false, data: result }
}

// ============================================================
// TIER 2 — Contextual
// ============================================================

/** Tier 2: Find files/dirs whose paths contain any of the supplied keywords (depth ≤ 4). */
export async function scanTier2(keywords: string[], dryRun = false): Promise<ScanResultTier2> {
  const lowerKeywords = keywords.map((k) => k.toLowerCase())

  const allFiles: string[] = []
  const allDirs: string[] = []
  const capped = { hit: false }

  walkDir(WORKSPACE_ROOT, {
    maxDepth: TIER2_MAX_DEPTH,
    fileList: allFiles,
    dirList: allDirs,
    capped,
  })

  if (capped.hit) {
    console.warn(`[scanner] File limit (${FILE_LIMIT}) reached during Tier 2 scan.`)
  }

  const matchedFiles = allFiles.filter((f) => {
    const rel = f.toLowerCase()
    return lowerKeywords.some((kw) => rel.includes(kw))
  })

  const matchedDirs = allDirs.filter((d) => {
    const rel = d.toLowerCase()
    return lowerKeywords.some((kw) => rel.includes(kw))
  })

  const result: Tier2Result = { matchedFiles, matchedDirs }

  if (!dryRun) {
    const hash = getGitHash()
    mergeTierIntoCache(2, result, hash)
  }

  return { tier: 2, cacheHit: false, data: result }
}

// ============================================================
// TIER 3 — Deep
// ============================================================

/** Tier 3: Read the first 20 lines of each file in the allowed-path list. */
export async function scanTier3(allowedPaths: string[], dryRun = false): Promise<ScanResultTier3> {
  const files: FilePreview[] = []

  for (const filePath of allowedPaths) {
    const resolved = path.resolve(filePath)
    try {
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue
    } catch {
      continue
    }
    const preview = readFirstLines(resolved, TIER3_PREVIEW_LINES)
    files.push({ path: resolved, preview })
  }

  const result: Tier3Result = { files }

  if (!dryRun) {
    const hash = getGitHash()
    mergeTierIntoCache(3, result, hash)
  }

  return { tier: 3, cacheHit: false, data: result }
}

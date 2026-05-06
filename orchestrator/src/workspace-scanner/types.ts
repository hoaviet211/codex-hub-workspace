// ============================================================
// Workspace Scanner — Types
// Defines RepoMap, ScanResult, and tier-level output shapes
// ============================================================

// ---- Tier 1: Skeleton ----

/** Lightweight snapshot of the workspace root structure. */
export interface Tier1Result {
  rootFiles: string[]
  topDirs: string[]
  configSummary: Record<string, unknown>
}

// ---- Tier 2: Contextual ----

/** Files and directories whose paths match supplied keywords. */
export interface Tier2Result {
  matchedFiles: string[]
  matchedDirs: string[]
}

// ---- Tier 3: Deep ----

/** A single file with its first 20-line preview. */
export interface FilePreview {
  path: string
  preview: string
}

/** Per-file preview for an explicit allowed-path list. */
export interface Tier3Result {
  files: FilePreview[]
}

// ---- RepoMap (full cache envelope) ----

/** Full repo scan cache as persisted in .orchestrator/memory/repo.json. */
export interface RepoMap {
  git_hash: string
  scanned_at: string
  tier1: Tier1Result | null
  tier2: Tier2Result | null
  tier3: Tier3Result | null
}

// ---- ScanResult (discriminated by tier) ----

export type TierLevel = 1 | 2 | 3

export interface ScanResultTier1 {
  tier: 1
  cacheHit: boolean
  data: Tier1Result
}

export interface ScanResultTier2 {
  tier: 2
  cacheHit: false
  data: Tier2Result
}

export interface ScanResultTier3 {
  tier: 3
  cacheHit: false
  data: Tier3Result
}

export type ScanResult = ScanResultTier1 | ScanResultTier2 | ScanResultTier3

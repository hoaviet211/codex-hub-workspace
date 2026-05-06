// ============================================================
// Obsidian Exporter — Types
// Patch 8: export .orchestrator/ data → Obsidian vault markdown
// ============================================================

export interface VaultConfig {
  vaultPath: string
  projectName: string
  includePatterns: boolean    // default true
  includeDecisions: boolean   // default true
}

export interface ExportResult {
  filesWritten: string[]
  filesSkipped: string[]
  vaultPath: string
  exportedAt: string
}

// ============================================================
// Obsidian Exporter — Main Exporter
// Patch 8: reads .orchestrator/ data → writes Obsidian vault markdown
//
// Vault structure:
//   {vaultPath}/
//     Project-Overview.md       ← goal, mode, status, patch queue summary
//     Architecture-Map.md       ← top-level dir structure from repo.json
//     Tasks/
//       Task-{YYYY-MM-DD}.md    ← one file per task memory
//     Patches/
//       Patch-{id}.md           ← one file per patch memory
//     Decisions/
//       Decision-{id}.md        ← one file per decision memory
//     Patterns/
//       learned-patterns.md     ← all approval patterns in one file
//       failure-patterns.md     ← all failure patterns
// ============================================================

import fs from 'fs'
import path from 'path'
import { loadState } from '../brain/state.js'
import {
  readAllTaskMemories,
  readPatchHistory,
  readDecisions,
  readPatterns,
} from '../memory-manager/manager.js'
import type { VaultConfig, ExportResult } from './types.js'
import type { BrainState } from '../brain/types.js'
import type { TaskMemory, PatchMemory, DecisionMemory, PatternMemory, RepoMemory } from '../memory-manager/types.js'

// ---- Helpers ----

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeFile(filePath: string, content: string, filesWritten: string[]): void {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf-8')
  filesWritten.push(filePath)
}

function loadRepoMemory(): RepoMemory | null {
  const repoFile = path.resolve(process.cwd(), '.orchestrator', 'memory', 'repo.json')
  if (!fs.existsSync(repoFile)) return null
  try {
    const raw = fs.readFileSync(repoFile, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const asRepo = parsed as RepoMemory
      if (asRepo.kind === 'repo') {
        return asRepo
      }

      // Backward/forward compatibility:
      // Workspace Scanner writes RepoMap with tier1/tier2/tier3 envelope.
      // Convert tier1 snapshot into the RepoMemory shape expected by exporter.
      const asRepoMap = parsed as {
        git_hash?: unknown
        scanned_at?: unknown
        tier1?: { rootFiles?: unknown; topDirs?: unknown } | null
      }

      const gitHash = typeof asRepoMap.git_hash === 'string' ? asRepoMap.git_hash : 'no-git'
      const scannedAt = typeof asRepoMap.scanned_at === 'string' ? asRepoMap.scanned_at : new Date().toISOString()
      const rootFiles = Array.isArray(asRepoMap.tier1?.rootFiles)
        ? asRepoMap.tier1!.rootFiles.filter((v): v is string => typeof v === 'string')
        : []
      const topDirs = Array.isArray(asRepoMap.tier1?.topDirs)
        ? asRepoMap.tier1!.topDirs.filter((v): v is string => typeof v === 'string')
        : []

      return {
        kind: 'repo',
        git_hash: gitHash,
        scanned_at: scannedAt,
        root_files: rootFiles,
        top_dirs: topDirs,
      }
    }
    return null
  } catch {
    return null
  }
}

function loadBrainStateSafe(): BrainState | null {
  try {
    return loadState()
  } catch {
    return null
  }
}

// ---- Template Renderers ----

function renderProjectOverview(
  config: VaultConfig,
  brain: BrainState | null,
  tasks: TaskMemory[],
  patches: PatchMemory[],
  timestamp: string
): string {
  const patchQueueRows = brain && brain.patch_queue.length > 0
    ? brain.patch_queue
        .map((p) => `| ${p.patch_id} | ${p.title} | ${p.status} |`)
        .join('\n')
    : '| — | No patches in queue | — |'

  const taskLinks = tasks.length > 0
    ? [...new Set(tasks.map((t) => `[[Task-${t.created_at.slice(0, 10)}]]`))]
        .join('\n')
    : '_No tasks recorded yet._'

  const patchLinks = patches.length > 0
    ? patches.map((p) => `[[Patch-${p.patch_id}]]`).join('\n')
    : '_No patches recorded yet._'

  return `# Project: ${config.projectName}

> Exported: ${timestamp}

## Status
- Goal: ${brain?.current_goal || '_(not set)_'}
- Mode: ${brain?.mode || '_(not set)_'}
- Status: ${brain?.status || '_(not set)_'}

## Patches
| ID | Title | Status |
|---|---|---|
${patchQueueRows}

## Tasks
${taskLinks}

## Related
${patchLinks}
`
}

function renderArchitectureMap(repo: RepoMemory | null): string {
  const topDirs = repo && repo.top_dirs.length > 0
    ? repo.top_dirs.map((d) => `- ${d}`).join('\n')
    : '_No directory data available._'

  const rootFiles = repo && repo.root_files.length > 0
    ? repo.root_files.map((f) => `- ${f}`).join('\n')
    : '_No root file data available._'

  return `# Architecture Map

> Source: Workspace Scanner Tier 1

## Top-level Directories
${topDirs}

## Root Config Files
${rootFiles}
`
}

function renderTaskFile(task: TaskMemory): string {
  return `# Task: ${task.goal}

- Date: ${task.created_at}
- Mode: ${task.suggested_mode}
- Scope: ${task.scope}

[[Project-Overview]]
`
}

function renderPatchFile(patch: PatchMemory): string {
  return `# Patch: ${patch.title}

- Status: ${patch.status}
- Completed: ${patch.completed_at}
- Deliverable: ${patch.deliverable}

[[Project-Overview]]
`
}

function renderDecisionFile(decision: DecisionMemory): string {
  return `# Decision: ${decision.decision_id}

- Date: ${decision.made_at}
- Context: ${decision.context}

## Decision
${decision.decision}

## Rationale
${decision.rationale || '_No rationale recorded._'}

[[Project-Overview]]
`
}

function renderLearnedPatterns(patterns: PatternMemory[]): string {
  const approvalPatterns = patterns.filter((p) => p.pattern_type === 'approval')

  if (approvalPatterns.length === 0) {
    return `# Learned Patterns

_No approval patterns recorded yet._
`
  }

  const sections = approvalPatterns
    .map((p) =>
      `## ${p.description}
- Confidence: ${(p.confidence * 100).toFixed(0)}%
- Last validated: ${p.last_validated}
- Expires after: ${p.expires_after_days} days
- Context: ${JSON.stringify(p.context)}`
    )
    .join('\n\n')

  return `# Learned Patterns

${sections}
`
}

function renderFailurePatterns(patterns: PatternMemory[]): string {
  const failurePatterns = patterns.filter((p) => p.pattern_type === 'failure')

  if (failurePatterns.length === 0) {
    return `# Failure Patterns

_No failure patterns recorded yet._
`
  }

  const sections = failurePatterns
    .map((p) =>
      `## ${p.description}
- Confidence: ${(p.confidence * 100).toFixed(0)}%
- Context: ${JSON.stringify(p.context)}`
    )
    .join('\n\n')

  return `# Failure Patterns

${sections}
`
}

// ---- Main Export Function ----

export async function exportToObsidian(config: VaultConfig): Promise<ExportResult> {
  const exportedAt = new Date().toISOString()
  const filesWritten: string[] = []
  const filesSkipped: string[] = []

  const vault = config.vaultPath

  // ---- Load data sources (all optional) ----

  const brain = loadBrainStateSafe()
  if (!brain) filesSkipped.push('.orchestrator/brain-state.json')

  const repo = loadRepoMemory()
  if (!repo) filesSkipped.push('.orchestrator/memory/repo.json')

  let tasks: TaskMemory[] = []
  try {
    tasks = readAllTaskMemories()
  } catch {
    filesSkipped.push('.orchestrator/memory/tasks/')
  }

  let patches: PatchMemory[] = []
  try {
    patches = readPatchHistory()
  } catch {
    filesSkipped.push('.orchestrator/memory/patches/')
  }

  let decisions: DecisionMemory[] = []
  if (config.includeDecisions) {
    try {
      decisions = readDecisions()
    } catch {
      filesSkipped.push('.orchestrator/memory/decisions.json')
    }
  }

  let patterns: PatternMemory[] = []
  if (config.includePatterns) {
    try {
      patterns = readPatterns()
    } catch {
      filesSkipped.push('.orchestrator/memory/patterns.json')
    }
  }

  // ---- Write vault files ----

  // Project-Overview.md
  writeFile(
    path.join(vault, 'Project-Overview.md'),
    renderProjectOverview(config, brain, tasks, patches, exportedAt),
    filesWritten
  )

  // Architecture-Map.md
  writeFile(
    path.join(vault, 'Architecture-Map.md'),
    renderArchitectureMap(repo),
    filesWritten
  )

  // Tasks/Task-{date}.md — group by date (one file per unique date)
  if (tasks.length > 0) {
    const tasksByDate = new Map<string, TaskMemory[]>()
    for (const task of tasks) {
      const dateKey = task.created_at.slice(0, 10)
      const existing = tasksByDate.get(dateKey) ?? []
      existing.push(task)
      tasksByDate.set(dateKey, existing)
    }

    for (const [dateKey, dayTasks] of tasksByDate) {
      // Use the first task of the day as the representative (most recent goal wins)
      const representative = dayTasks[dayTasks.length - 1]
      writeFile(
        path.join(vault, 'Tasks', `Task-${dateKey}.md`),
        renderTaskFile(representative),
        filesWritten
      )
    }
  }

  // Patches/Patch-{id}.md
  for (const patch of patches) {
    writeFile(
      path.join(vault, 'Patches', `Patch-${patch.patch_id}.md`),
      renderPatchFile(patch),
      filesWritten
    )
  }

  // Decisions/Decision-{id}.md
  if (config.includeDecisions) {
    for (const decision of decisions) {
      writeFile(
        path.join(vault, 'Decisions', `Decision-${decision.decision_id}.md`),
        renderDecisionFile(decision),
        filesWritten
      )
    }
  }

  // Patterns/learned-patterns.md + failure-patterns.md
  if (config.includePatterns) {
    writeFile(
      path.join(vault, 'Patterns', 'learned-patterns.md'),
      renderLearnedPatterns(patterns),
      filesWritten
    )
    writeFile(
      path.join(vault, 'Patterns', 'failure-patterns.md'),
      renderFailurePatterns(patterns),
      filesWritten
    )
  }

  return {
    filesWritten,
    filesSkipped,
    vaultPath: vault,
    exportedAt,
  }
}

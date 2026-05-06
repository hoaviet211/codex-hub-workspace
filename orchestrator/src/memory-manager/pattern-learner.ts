// ============================================================
// Memory Manager — Pattern Learner
// Patch 5: detect recurring decisions → extract reusable patterns
//
// Logic:
//   1. Read decisions.json + patch history
//   2. Group decisions by context.module + context.task_type
//      (extracted from the decision's `context` string as best-effort)
//   3. If the same decision text appears 3+ times in the same context
//      group → create PatternMemory (type: 'approval')
//   4. shouldAutoSuggest: return highest-confidence non-expired pattern
// ============================================================

import type { DecisionMemory, PatternMemory } from './types.js'
import { readDecisions } from './manager.js'

// ---- Pattern extraction helpers ----

/**
 * Best-effort parse of a context string into { repo, module, task_type }.
 * Expects format: "repo:<r> module:<m> task:<t>" or falls back to defaults.
 */
function parseContextString(ctx: string): { repo: string; module: string; task_type: string } {
  const repoMatch = ctx.match(/repo:\s*(\S+)/i)
  const moduleMatch = ctx.match(/module:\s*(\S+)/i)
  const taskMatch = ctx.match(/task(?:_type)?:\s*(\S+)/i)

  return {
    repo: repoMatch ? repoMatch[1] : 'unknown',
    module: moduleMatch ? moduleMatch[1] : 'unknown',
    task_type: taskMatch ? taskMatch[1] : 'unknown',
  }
}

/** Stable grouping key for a decision. */
function groupKey(module: string, taskType: string, decision: string): string {
  return `${module}::${taskType}::${decision.trim().toLowerCase()}`
}

// ---- Public API ----

/**
 * Analyze all recorded decisions and extract PatternMemory entries for any
 * decision that recurs 3 or more times within the same module + task_type
 * context.
 *
 * Returns new patterns — the caller is responsible for persisting them via
 * writePatterns() from manager.ts.
 */
export function learnPatterns(): PatternMemory[] {
  const decisions: DecisionMemory[] = readDecisions()

  if (decisions.length === 0) return []

  // Group decisions by (module, task_type, decision text)
  type GroupEntry = {
    count: number
    lastDate: string
    sample: DecisionMemory
  }
  const groups = new Map<string, GroupEntry>()

  for (const d of decisions) {
    const { module, task_type, repo } = parseContextString(d.context)
    const key = groupKey(module, task_type, d.decision)

    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      if (d.made_at > existing.lastDate) {
        existing.lastDate = d.made_at
        existing.sample = d
      }
    } else {
      groups.set(key, {
        count: 1,
        lastDate: d.made_at,
        sample: d,
      })
    }
  }

  const patterns: PatternMemory[] = []
  const now = new Date().toISOString()

  for (const [, entry] of groups) {
    if (entry.count < 3) continue

    const { repo, module, task_type } = parseContextString(entry.sample.context)
    const confidence = Math.min(entry.count / 5, 1.0)

    patterns.push({
      kind: 'pattern',
      pattern_type: 'approval',
      context: { repo, module, task_type },
      description: `Recurring decision in ${module}/${task_type}: "${entry.sample.decision.slice(0, 120)}"`,
      confidence,
      last_validated: now,
      expires_after_days: 30,
    })
  }

  return patterns
}

/**
 * Given a module name and task type, return the highest-confidence
 * non-expired 'approval' pattern that matches, or null.
 *
 * Expiry check: current time > last_validated + expires_after_days * 86400000 ms
 */
export function shouldAutoSuggest(
  module: string,
  taskType: string,
  patterns: PatternMemory[]
): PatternMemory | null {
  const now = Date.now()

  const candidates = patterns.filter((p) => {
    if (p.pattern_type !== 'approval') return false
    if (p.context.module !== module || p.context.task_type !== taskType) return false

    const expiresAt =
      Date.parse(p.last_validated) + p.expires_after_days * 86_400_000
    if (now > expiresAt) return false

    return true
  })

  if (candidates.length === 0) return null

  // Return highest confidence
  return candidates.reduce((best, p) => (p.confidence > best.confidence ? p : best))
}

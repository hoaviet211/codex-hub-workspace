// ============================================================
// Memory Manager — Failure Analyzer
// Patch 5: detect recurring failure types → write failure patterns
//
// Logic:
//   1. Read failures.json
//   2. Group by category
//   3. If same category appears 2+ times → create PatternMemory (type: 'failure')
//   4. Confidence: Math.min(count / 5, 1.0) — saturates at 5 occurrences
// ============================================================

import type { FailureMemory, PatternMemory } from './types.js'
import { readFailures } from './manager.js'

// ---- Public API ----

/**
 * Analyze all recorded failures and extract PatternMemory entries for any
 * failure category that recurs 2 or more times.
 *
 * Returns new patterns — the caller is responsible for persisting them via
 * writePatterns() from manager.ts.
 */
export function analyzeFailures(): PatternMemory[] {
  const failures: FailureMemory[] = readFailures()

  if (failures.length === 0) return []

  // Group by category
  type GroupEntry = {
    count: number
    lastDate: string
    sampleReason: string
    samplePatchId: string
  }
  const groups = new Map<string, GroupEntry>()

  for (const f of failures) {
    const key = f.category.trim().toLowerCase()
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      if (f.recorded_at > existing.lastDate) {
        existing.lastDate = f.recorded_at
        existing.sampleReason = f.reason
        existing.samplePatchId = f.patch_id
      }
    } else {
      groups.set(key, {
        count: 1,
        lastDate: f.recorded_at,
        sampleReason: f.reason,
        samplePatchId: f.patch_id,
      })
    }
  }

  const patterns: PatternMemory[] = []
  const now = new Date().toISOString()

  for (const [category, entry] of groups) {
    if (entry.count < 2) continue

    const confidence = Math.min(entry.count / 5, 1.0)

    patterns.push({
      kind: 'pattern',
      pattern_type: 'failure',
      context: { repo: 'unknown', module: 'unknown', task_type: category },
      description: `Recurring failure category "${category}" (${entry.count}x). Example: "${entry.sampleReason.slice(0, 120)}"`,
      confidence,
      last_validated: now,
      expires_after_days: 30,
    })
  }

  return patterns
}

/**
 * Given a failure category, return the matching 'failure' pattern from the
 * supplied list, or null if none exists.
 */
export function getFailurePattern(
  category: string,
  patterns: PatternMemory[]
): PatternMemory | null {
  const normalised = category.trim().toLowerCase()
  const match = patterns.find(
    (p) =>
      p.pattern_type === 'failure' &&
      p.context.task_type.trim().toLowerCase() === normalised
  )
  return match ?? null
}

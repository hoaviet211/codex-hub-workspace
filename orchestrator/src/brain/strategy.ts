// ============================================================
// Brain Layer — Strategy
// Selects the right strategy for a goal+mode, learns from
// decisions, and applies confidence decay on learned patterns.
// ============================================================

import {
  BrainMode,
  BrainState,
  LearnedPattern,
  PatternType,
  Strategy,
  STRATEGIES,
} from './types.js'
import { loadState, saveState } from './state.js'

// ---- Strategy selection ----

export function selectStrategy(
  goal: string,
  mode: BrainMode,
  patterns: LearnedPattern[]
): Strategy {
  const lower = goal.toLowerCase()

  // Check learned approval patterns — if we've seen a similar goal succeed with a strategy, reuse it
  const matchingPattern = patterns.find(
    (p) =>
      p.pattern_type === 'approval' &&
      p.confidence >= 0.7 &&
      !isPatternExpired(p) &&
      lower.includes(p.context.task_type.toLowerCase())
  )

  if (matchingPattern) {
    const learnedStrategy = inferStrategyFromPattern(matchingPattern)
    if (learnedStrategy) {
      console.log(
        `[Strategy] Using learned pattern "${matchingPattern.description}" → ${learnedStrategy.name}`
      )
      return learnedStrategy
    }
  }

  // Fallback: mode-based selection
  const strategyMap: Record<BrainMode, string> = {
    fast: 'fast_sequential',
    safe: 'safe_incremental',
    deep: 'deep_analysis',
  }
  return STRATEGIES[strategyMap[mode]]
}

// ---- Pattern management ----

export function learnApprovalPattern(
  taskType: string,
  repoName: string,
  moduleName: string,
  description: string
): void {
  const state = loadState()
  const existing = state.learned_patterns.find(
    (p) =>
      p.pattern_type === 'approval' &&
      p.context.task_type === taskType &&
      p.context.repo === repoName
  )

  if (existing) {
    // Reinforce: bump confidence up (max 1.0) + refresh validation date
    const updated = state.learned_patterns.map((p) =>
      p === existing
        ? {
            ...p,
            confidence: Math.min(1.0, p.confidence + 0.15),
            last_validated: new Date().toISOString(),
          }
        : p
    )
    saveState({ ...state, learned_patterns: updated })
    console.log(
      `[Strategy] Reinforced approval pattern for "${taskType}" → confidence now ${(existing.confidence + 0.15).toFixed(2)}`
    )
  } else {
    // New pattern, start with moderate confidence
    const newPattern: LearnedPattern = {
      pattern_type: 'approval',
      context: { repo: repoName, module: moduleName, task_type: taskType },
      confidence: 0.5,
      last_validated: new Date().toISOString(),
      expires_after_days: 30,
      description,
    }
    saveState({
      ...state,
      learned_patterns: [...state.learned_patterns, newPattern],
    })
    console.log(`[Strategy] New approval pattern learned: "${description}"`)
  }
}

export function learnFailurePattern(
  taskType: string,
  repoName: string,
  moduleName: string,
  description: string
): void {
  const state = loadState()
  const existing = state.learned_patterns.find(
    (p) =>
      p.pattern_type === 'failure' &&
      p.context.task_type === taskType &&
      p.context.repo === repoName
  )

  if (existing) {
    const updated = state.learned_patterns.map((p) =>
      p === existing
        ? {
            ...p,
            confidence: Math.min(1.0, p.confidence + 0.2),
            last_validated: new Date().toISOString(),
          }
        : p
    )
    saveState({ ...state, learned_patterns: updated })
  } else {
    const newPattern: LearnedPattern = {
      pattern_type: 'failure',
      context: { repo: repoName, module: moduleName, task_type: taskType },
      confidence: 0.6,   // failures start with higher confidence — we trust negative signals
      last_validated: new Date().toISOString(),
      expires_after_days: 30,
      description,
    }
    saveState({
      ...state,
      learned_patterns: [...state.learned_patterns, newPattern],
    })
    console.log(`[Strategy] Failure pattern recorded: "${description}"`)
  }
}

// ---- Confidence decay ----
// Called on startup or periodically — patterns older than expires_after_days lose confidence

export function applyConfidenceDecay(): void {
  const state = loadState()
  const now = Date.now()

  const updated = state.learned_patterns.map((p) => {
    const ageMs = now - new Date(p.last_validated).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)

    if (ageDays > p.expires_after_days) {
      // Past expiry: decay to 0 (will be pruned)
      return { ...p, confidence: 0 }
    }

    if (ageDays > p.expires_after_days * 0.7) {
      // In last 30% of lifetime: start gentle decay
      const decayFactor = 1 - (ageDays - p.expires_after_days * 0.7) / (p.expires_after_days * 0.3)
      return { ...p, confidence: p.confidence * decayFactor }
    }

    return p
  })

  // Prune dead patterns
  const alive = updated.filter((p) => p.confidence > 0.1)

  if (alive.length !== state.learned_patterns.length) {
    console.log(
      `[Strategy] Pruned ${state.learned_patterns.length - alive.length} expired pattern(s)`
    )
  }

  saveState({ ...state, learned_patterns: alive })
}

// ---- Helpers ----

function isPatternExpired(pattern: LearnedPattern): boolean {
  const ageMs = Date.now() - new Date(pattern.last_validated).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return ageDays > pattern.expires_after_days
}

function inferStrategyFromPattern(pattern: LearnedPattern): Strategy | null {
  // Infer strategy from pattern context
  const taskType = pattern.context.task_type.toLowerCase()

  if (/fix|patch|hotfix/.test(taskType)) return STRATEGIES['safe_incremental']
  if (/feature|add|implement/.test(taskType)) return STRATEGIES['safe_incremental']
  if (/refactor|migrate|redesign/.test(taskType)) return STRATEGIES['deep_analysis']
  if (/rename|typo|comment/.test(taskType)) return STRATEGIES['fast_sequential']

  return null
}

// ---- Read patterns for external use ----

export function getLearnedPatterns(): LearnedPattern[] {
  return loadState().learned_patterns
}

export function getHighConfidencePatterns(
  type: PatternType,
  minConfidence = 0.7
): LearnedPattern[] {
  return loadState().learned_patterns.filter(
    (p) => p.pattern_type === type && p.confidence >= minConfidence && !isPatternExpired(p)
  )
}

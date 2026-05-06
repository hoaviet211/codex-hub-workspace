#!/usr/bin/env node
// ============================================================
// LCO CLI — Entry point
// Commands: lco status | lco plan "<goal>" | lco eval <patchId> <outcome>
//           lco split [--dry-run]
// ============================================================

import { Command } from 'commander'
import fs from 'fs'
import path from 'path'
import { loadState, resetState, getStatePath } from '../brain/state.js'
import { planTask } from '../brain/planner.js'
import { evaluatePatch } from '../brain/evaluator.js'
import { applyConfidenceDecay } from '../brain/strategy.js'
import type { BrainMode, PatchOutcome } from '../brain/types.js'
import { pingOllama, DEFAULT_MODEL } from '../agent-core/ollama-client.js'
import { runAgent } from '../agent-core/agent.js'
import { createTask, loadAgentState, getStatePath as getAgentStatePath } from '../agent-core/state.js'
import { composeAndPersist } from '../context-composer/composer.js'
import { scanTier1, scanTier2, scanTier3 } from '../workspace-scanner/scanner.js'
import { splitTask } from '../patch-engine/splitter.js'
import type { TaskBrief } from '../context-composer/composer.js'
import {
  writeDecisionMemory,
  writeFailureMemory,
  readDecisions,
  readPatterns,
  readFailures,
  readPatchHistory,
  writePatterns,
} from '../memory-manager/manager.js'
import { learnPatterns } from '../memory-manager/pattern-learner.js'
import { analyzeFailures } from '../memory-manager/failure-analyzer.js'
import type { DecisionMemory, FailureMemory } from '../memory-manager/types.js'
import { generateHandoff, getHandoffFilePath } from '../handoff-generator/generator.js'
import type { ApprovalMode } from '../handoff-generator/types.js'
import { reviewPatch } from '../diff-reviewer/reviewer.js'
import type { ReviewOutcome } from '../diff-reviewer/types.js'
import { exportToObsidian } from '../obsidian-exporter/exporter.js'
import type { VaultConfig } from '../obsidian-exporter/types.js'

// ---- Chalk (ESM — dynamic import for CJS compat) ----
async function getChalk() {
  // chalk v5 is pure ESM; use dynamic import for compat with ts-node CJS
  const { default: chalk } = await import('chalk')
  return chalk
}

// ---- Status display ----

async function cmdStatus() {
  const chalk = await getChalk()
  const state = loadState()

  const statusColor: Record<string, typeof chalk.green> = {
    idle: chalk.gray,
    planning: chalk.cyan,
    executing: chalk.green,
    blocked: chalk.yellow,
    replanning: chalk.blue,
    done: chalk.greenBright,
    escalated: chalk.red,
  }
  const color = statusColor[state.status] ?? chalk.white

  console.log(chalk.bold('\n── LCO Brain Status ──────────────────────────'))
  console.log(`  Goal:       ${state.current_goal || chalk.dim('(none)')  }`)
  console.log(`  Mode:       ${chalk.cyan(state.mode)}`)
  console.log(`  Status:     ${color(state.status.toUpperCase())}`)
  console.log(`  Strategy:   ${state.active_strategy || chalk.dim('(none)')}`)
  console.log(`  Active Patch: ${state.active_patch_id || chalk.dim('(none)')}`)
  console.log(`  Updated:    ${state.updated_at}`)

  if (state.escalation_reason) {
    console.log(chalk.red(`\n  !! ESCALATION: ${state.escalation_reason}`))
  }

  if (state.patch_queue.length > 0) {
    console.log(chalk.bold('\n  Patch Queue:'))
    state.patch_queue.forEach((p) => {
      const statusIcon: Record<string, string> = {
        pending: '○',
        executing: '▶',
        done: '✓',
        failed: '✗',
        skipped: '–',
      }
      const icon = statusIcon[p.status] ?? '?'
      console.log(`    [${icon}] ${p.patch_id} — ${p.title} (priority: ${p.priority})`)
    })
  }

  if (state.failure_log.length > 0) {
    console.log(chalk.bold(`\n  Failure Log (${state.failure_log.length} entries):`))
    state.failure_log.slice(-3).forEach((f) => {
      console.log(chalk.red(`    ✗ [${f.patch_id}] ${f.reason} (${f.category}, attempt ${f.attempt_count})`))
    })
  }

  if (state.learned_patterns.length > 0) {
    console.log(chalk.bold(`\n  Learned Patterns (${state.learned_patterns.length}):`))
    state.learned_patterns.slice(0, 5).forEach((p) => {
      console.log(
        `    [${p.pattern_type}] ${p.description} — confidence: ${(p.confidence * 100).toFixed(0)}%`
      )
    })
  }

  console.log(`\n  State file: ${chalk.dim(getStatePath())}`)
  console.log(chalk.bold('──────────────────────────────────────────────\n'))
}

// ---- Plan command ----

async function cmdPlan(goal: string, opts: { mode?: string }) {
  const chalk = await getChalk()
  const validModes: BrainMode[] = ['fast', 'safe', 'deep']
  const mode = validModes.includes(opts.mode as BrainMode)
    ? (opts.mode as BrainMode)
    : undefined

  applyConfidenceDecay()

  console.log(chalk.bold(`\nPlanning: "${goal}"`))
  const result = planTask({ goal, mode })

  console.log(chalk.green(`✓ Strategy:  ${result.strategy}`))
  console.log(chalk.green(`✓ Mode:      ${result.mode}`))
  console.log(chalk.dim(`  Reasoning: ${result.reasoning}`))
  console.log(`\nPatch queue (${result.patch_queue.length} patches):`)
  result.patch_queue.forEach((p) => {
    const deps = p.dependencies.length > 0 ? ` [after: ${p.dependencies.join(', ')}]` : ''
    console.log(`  ${p.priority}. ${p.patch_id} — ${p.title}${deps}`)
  })
  console.log()
}

// ---- Eval command ----

async function cmdEval(patchId: string, outcome: string, reason: string) {
  const chalk = await getChalk()
  const validOutcomes: PatchOutcome[] = ['success', 'fail', 'partial']

  if (!validOutcomes.includes(outcome as PatchOutcome)) {
    console.error(chalk.red(`Invalid outcome "${outcome}". Use: success | fail | partial`))
    process.exit(1)
  }

  const result = evaluatePatch({
    patch_id: patchId,
    outcome: outcome as PatchOutcome,
    reason,
  })

  const icon = result.should_escalate ? chalk.red('!!') : result.should_replan ? chalk.yellow('↻') : chalk.green('✓')
  console.log(`\n${icon} Eval result for "${patchId}":`)
  console.log(`  Reasoning:        ${result.reasoning}`)
  console.log(`  Recommendation:   ${chalk.cyan(result.recommendation)}`)
  console.log(`  Should replan:    ${result.should_replan}`)
  console.log(`  Should escalate:  ${result.should_escalate ? chalk.red('YES') : 'no'}`)
  console.log()
}

// ---- Ping command ----

async function cmdPing(opts: { model?: string }) {
  const chalk = await getChalk()
  const model = opts.model ?? DEFAULT_MODEL

  process.stdout.write(chalk.dim(`Pinging Ollama at http://localhost:11434 (model: ${model})...`))
  const result = await pingOllama(model)
  process.stdout.write('\n')

  if (!result.ok) {
    console.log(chalk.red(`✗ Ollama unreachable — ${result.error}`))
    process.exit(1)
  }

  console.log(chalk.green(`✓ Ollama is running  (${result.durationMs}ms)`))

  if (result.modelAvailable) {
    console.log(chalk.green(`✓ Model "${model}" is available`))
  } else {
    console.log(chalk.yellow(`⚠ Model "${model}" not found locally`))
    console.log(chalk.dim(`  Pull it with: ollama pull ${model}`))
  }
}

// ---- Reset command ----

async function cmdReset() {
  const chalk = await getChalk()
  resetState()
  console.log(chalk.green('✓ Brain state reset to idle.'))
}

// ---- Task command ----

async function cmdTask(goal: string, opts: { context?: string; dryRun?: boolean }) {
  const chalk = await getChalk()

  if (!goal || goal.trim().length < 3) {
    console.error(chalk.red('Error: goal must be at least 3 characters.'))
    process.exit(1)
  }

  const task = createTask(goal.trim())
  console.log(chalk.bold(`\n── LCO Task ──────────────────────────────────`))
  console.log(`  Task ID: ${chalk.cyan(task.task_id)}`)
  console.log(`  Goal:    ${goal.trim()}`)
  console.log(`  State:   ${getAgentStatePath()}`)
  console.log(chalk.bold('──────────────────────────────────────────────'))

  if (opts.dryRun) {
    console.log(chalk.dim('\n[dry-run] Skipping Ollama call. Task registered in state.json.'))
    const agentState = loadAgentState()
    console.log(chalk.dim(`  task_id:  ${agentState.task_id}`))
    console.log(chalk.dim(`  status:   ${agentState.status}`))
    console.log()
    return
  }

  console.log(chalk.dim('\nRunning agent loop (Ollama must be up)...\n'))

  try {
    const result = await runAgent({
      goal: goal.trim(),
      context: opts.context,
    })

    const statusColor =
      result.status === 'done'
        ? chalk.green
        : result.status === 'blocked'
        ? chalk.red
        : chalk.yellow

    console.log(`\n${statusColor(`[${result.status.toUpperCase()}]`)} after ${result.steps} step(s)`)

    if (result.tool_calls_made.length > 0) {
      console.log(chalk.dim(`  Tools used: ${result.tool_calls_made.join(' → ')}`))
    }

    console.log(chalk.bold('\nAnswer:'))
    console.log(result.answer)
    console.log()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Agent error: ${msg}`))

    // Check if it's an Ollama connection error and give helpful hint
    if (msg.includes('not running') || msg.includes('ECONNREFUSED')) {
      console.log(chalk.dim('  → Start Ollama with: ollama serve'))
      console.log(chalk.dim(`  → Pull model with: ollama pull ${DEFAULT_MODEL}`))
    }

    process.exit(1)
  }
}

// ---- Compose command ----

async function cmdCompose(rawInput: string, opts: { dryRun?: boolean }) {
  const chalk = await getChalk()

  if (!rawInput || rawInput.trim().length < 3) {
    console.error(chalk.red('Error: input must be at least 3 characters.'))
    process.exit(1)
  }

  console.log(chalk.bold('\n── LCO Context Composer ──────────────────────'))
  console.log(chalk.dim(`  Input: "${rawInput.slice(0, 80)}${rawInput.length > 80 ? '...' : ''}"`) )
  if (opts.dryRun) console.log(chalk.yellow('  [dry-run] Files will NOT be written.'))
  console.log()

  try {
    const result = await composeAndPersist(rawInput.trim(), opts.dryRun ?? false)

    const { brief, usedFallback } = result

    if (usedFallback) {
      console.log(chalk.yellow('⚠ Gemma unavailable — using fallback template.'))
    } else {
      console.log(chalk.green('✓ Task brief composed by Gemma.'))
    }

    console.log(chalk.bold('\n  Task Brief:'))
    console.log(`  Goal:       ${brief.goal || chalk.dim('(empty)')}`)
    console.log(`  Scope:      ${brief.scope || chalk.dim('(empty)')}`)
    console.log(`  Mode:       ${chalk.cyan(brief.suggested_mode)}`)

    if (brief.constraints.length > 0) {
      console.log(chalk.bold('\n  Constraints:'))
      brief.constraints.forEach((c) => console.log(`    - ${c}`))
    }

    if (brief.open_questions.length > 0) {
      console.log(chalk.bold('\n  Open Questions:'))
      brief.open_questions.forEach((q) => console.log(`    ? ${q}`))
    }

    if (!opts.dryRun) {
      console.log(chalk.dim('\n  Written to: .orchestrator/current-task.md'))
      console.log(chalk.dim('  state.json updated.'))
    }

    console.log(chalk.bold('──────────────────────────────────────────────\n'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Compose error: ${msg}`))
    if (msg.includes('not running') || msg.includes('ECONNREFUSED')) {
      console.log(chalk.dim('  → Start Ollama with: ollama serve'))
      console.log(chalk.dim(`  → Pull model with: ollama pull ${DEFAULT_MODEL}`))
    }
    process.exit(1)
  }
}

// ---- Scan command ----

async function cmdScan(opts: { tier?: string; keywords?: string; dryRun?: boolean }) {
  const chalk = await getChalk()

  const tierRaw = parseInt(opts.tier ?? '1', 10)
  const tier = (tierRaw === 1 || tierRaw === 2 || tierRaw === 3) ? tierRaw : 1
  const dryRun = opts.dryRun ?? false
  const keywords = opts.keywords
    ? opts.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : []

  console.log(chalk.bold(`\n── LCO Workspace Scanner ─────────────────────`))
  console.log(`  Tier:     ${chalk.cyan(String(tier))}`)
  if (dryRun) console.log(chalk.yellow('  [dry-run] Cache will NOT be updated.'))
  console.log()

  try {
    if (tier === 1) {
      const result = await scanTier1(dryRun)
      const hit = result.cacheHit ? chalk.green('HIT') : chalk.yellow('MISS')
      console.log(`  Cache:    ${hit}`)
      console.log(`  Root files found: ${result.data.rootFiles.length}`)
      console.log(`  Top-level dirs:   ${result.data.topDirs.join(', ') || chalk.dim('(none)')}`)
      console.log(`  Config keys:      ${Object.keys(result.data.configSummary).join(', ') || chalk.dim('(none)')}`)
      if (dryRun) {
        console.log(chalk.dim('\n  Result JSON:'))
        console.log(chalk.dim(JSON.stringify(result.data, null, 2)))
      }
    } else if (tier === 2) {
      if (keywords.length === 0) {
        console.error(chalk.red('Error: --keywords is required for tier 2.'))
        process.exit(1)
      }
      console.log(`  Keywords: ${keywords.join(', ')}`)
      const result = await scanTier2(keywords, dryRun)
      console.log(`  Matched files: ${result.data.matchedFiles.length}`)
      console.log(`  Matched dirs:  ${result.data.matchedDirs.length}`)
      if (result.data.matchedFiles.length > 0) {
        console.log(chalk.bold('\n  Matched files (first 10):'))
        result.data.matchedFiles.slice(0, 10).forEach((f) => console.log(`    ${chalk.dim(f)}`))
      }
      if (dryRun) {
        console.log(chalk.dim('\n  Result JSON:'))
        console.log(chalk.dim(JSON.stringify(result.data, null, 2)))
      }
    } else {
      if (keywords.length === 0) {
        console.error(chalk.red('Error: --keywords (allowed paths) is required for tier 3.'))
        process.exit(1)
      }
      console.log(`  Paths: ${keywords.join(', ')}`)
      const result = await scanTier3(keywords, dryRun)
      console.log(`  Files previewed: ${result.data.files.length}`)
      if (dryRun) {
        console.log(chalk.dim('\n  Result JSON:'))
        console.log(chalk.dim(JSON.stringify(result.data, null, 2)))
      }
    }

    console.log(chalk.bold('\n──────────────────────────────────────────────\n'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Scan error: ${msg}`))
    process.exit(1)
  }
}

// ---- Split command ----

const ORCHESTRATOR_DIR = path.resolve(process.cwd(), '.orchestrator')
const CURRENT_TASK_FILE = path.join(ORCHESTRATOR_DIR, 'current-task.md')

/**
 * Parse goal and scope from the markdown generated by composeAndPersist.
 * Extracts the ## Goal and ## Scope sections.
 */
function parseCurrentTaskMd(content: string): TaskBrief {
  const lines = content.split('\n')

  let goal = ''
  let scope = ''
  let inGoal = false
  let inScope = false

  for (const line of lines) {
    if (line.startsWith('## Goal')) {
      inGoal = true
      inScope = false
      continue
    }
    if (line.startsWith('## Scope')) {
      inScope = true
      inGoal = false
      continue
    }
    if (line.startsWith('## ') || line.startsWith('---')) {
      inGoal = false
      inScope = false
      continue
    }
    const trimmed = line.trim()
    if (inGoal && trimmed && trimmed !== '(not specified)') {
      goal = goal ? goal + ' ' + trimmed : trimmed
    }
    if (inScope && trimmed && trimmed !== '(not specified)') {
      scope = scope ? scope + ' ' + trimmed : trimmed
    }
  }

  return {
    goal: goal || '(unknown goal)',
    scope: scope || '',
    constraints: [],
    open_questions: [],
    suggested_mode: 'safe',
  }
}

async function cmdSplit(opts: { dryRun?: boolean }) {
  const chalk = await getChalk()

  // Check current-task.md exists
  if (!fs.existsSync(CURRENT_TASK_FILE)) {
    console.error(
      chalk.red(
        '✗ .orchestrator/current-task.md not found.\n' +
        '  Run `lco compose "<task>"` first to create it.'
      )
    )
    process.exit(1)
  }

  const dryRun = opts.dryRun ?? false

  console.log(chalk.bold('\n── LCO Split ─────────────────────────────────'))
  if (dryRun) console.log(chalk.yellow('  [dry-run] plan.json will NOT be written.'))
  console.log()

  // Parse brief from current-task.md
  const content = fs.readFileSync(CURRENT_TASK_FILE, 'utf-8')
  const brief = parseCurrentTaskMd(content)

  console.log(chalk.dim(`  Goal:  "${brief.goal.slice(0, 80)}${brief.goal.length > 80 ? '...' : ''}"`) )
  console.log(chalk.dim(`  Scope: "${brief.scope || '(not set)'}"`) )
  console.log()

  // Scan tier 1 for repo context
  process.stdout.write(chalk.dim('  Scanning repo (tier 1)...'))
  let repoMap
  try {
    const scanResult = await scanTier1(true /* dry — don't update cache */)
    repoMap = scanResult.data
    process.stdout.write(chalk.green(' done\n'))
  } catch (err) {
    process.stdout.write('\n')
    console.warn(chalk.yellow(`  ⚠ Scan failed: ${err instanceof Error ? err.message : String(err)} — using empty repo map.`))
    repoMap = { rootFiles: [], topDirs: [], configSummary: {} }
  }

  // Call Gemma to split
  process.stdout.write(chalk.dim('  Calling Gemma to split task...'))
  try {
    const plan = await splitTask(brief, repoMap, dryRun)
    process.stdout.write(chalk.green(' done\n\n'))

    console.log(chalk.bold(`  Patch Plan: "${plan.task_goal.slice(0, 60)}"` ))
    console.log(chalk.dim(`  Mode: ${plan.suggested_mode}  |  Patches: ${plan.patches.length}\n`))

    const riskColor = (r: string) =>
      r === 'high' ? chalk.red(r) : r === 'medium' ? chalk.yellow(r) : chalk.green(r)

    plan.patches.forEach((p) => {
      const deps = p.dependencies.length > 0 ? chalk.dim(` [after: ${p.dependencies.join(', ')}]`) : ''
      console.log(
        `  ${chalk.cyan(String(p.priority).padStart(2, ' '))}. ` +
        `${chalk.bold(p.patch_id)} — ${p.title}` +
        `\n      risk: ${riskColor(p.risk)}  scope: ${p.scope}` +
        deps
      )
    })

    if (!dryRun) {
      console.log(chalk.dim('\n  Plan written to: .orchestrator/patches/plan.json'))
    }
  } catch (err) {
    process.stdout.write('\n')
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Split error: ${msg}`))
    if (msg.includes('not running') || msg.includes('ECONNREFUSED')) {
      console.log(chalk.dim('  → Start Ollama with: ollama serve'))
      console.log(chalk.dim(`  → Pull model with: ollama pull ${DEFAULT_MODEL}`))
    }
    process.exit(1)
  }

  console.log(chalk.bold('──────────────────────────────────────────────\n'))
}

// ---- Memory command ----

/** Generate a short unique ID for decisions/failures. */
function shortId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

async function cmdMemory(sub: string, args: string[]) {
  const chalk = await getChalk()

  switch (sub) {
    case 'log-decision': {
      const [context = '', decision = ''] = args
      if (!context || !decision) {
        console.error(chalk.red('Usage: lco memory log-decision <context> <decision>'))
        process.exit(1)
      }
      const record: DecisionMemory = {
        kind: 'decision',
        decision_id: shortId(),
        context,
        decision,
        rationale: '',
        made_at: new Date().toISOString(),
      }
      writeDecisionMemory(record)
      console.log(chalk.green(`✓ Decision logged [${record.decision_id}]`))
      console.log(chalk.dim(`  context:  ${context}`))
      console.log(chalk.dim(`  decision: ${decision}`))
      break
    }

    case 'log-failure': {
      const [patchId = '', category = '', ...reasonParts] = args
      const reason = reasonParts.join(' ') || 'no reason provided'
      if (!patchId || !category) {
        console.error(chalk.red('Usage: lco memory log-failure <patchId> <category> <reason>'))
        process.exit(1)
      }
      const record: FailureMemory = {
        kind: 'failure',
        patch_id: patchId,
        category,
        reason,
        attempt_count: 1,
        recorded_at: new Date().toISOString(),
      }
      writeFailureMemory(record)
      console.log(chalk.green(`✓ Failure logged for patch "${patchId}" (category: ${category})`))
      break
    }

    case 'learn': {
      console.log(chalk.bold('\n── LCO Memory — Learning ─────────────────────'))

      const approvalPatterns = learnPatterns()
      const failurePatterns = analyzeFailures()
      const allNew = [...approvalPatterns, ...failurePatterns]

      if (allNew.length === 0) {
        console.log(chalk.dim('  No new patterns discovered (need 3+ approval decisions or 2+ failure categories).'))
      } else {
        // Merge with existing patterns (replace by description key to avoid dupes)
        const existing = readPatterns()
        const merged = [...existing]
        for (const p of allNew) {
          const idx = merged.findIndex(
            (e) => e.pattern_type === p.pattern_type && e.description === p.description
          )
          if (idx >= 0) {
            merged[idx] = p  // update confidence + last_validated
          } else {
            merged.push(p)
          }
        }
        writePatterns(merged)

        console.log(chalk.green(`✓ ${allNew.length} pattern(s) discovered and saved to patterns.json\n`))
        allNew.forEach((p) => {
          const conf = (p.confidence * 100).toFixed(0)
          console.log(
            `  [${chalk.cyan(p.pattern_type)}] ${p.description.slice(0, 100)} — confidence: ${conf}%`
          )
        })
      }

      console.log(chalk.bold('──────────────────────────────────────────────\n'))
      break
    }

    case 'show': {
      const decisions = readDecisions()
      const patterns = readPatterns()
      const failures = readFailures()
      const patches = readPatchHistory()

      console.log(chalk.bold('\n── LCO Memory Summary ────────────────────────'))

      console.log(chalk.bold(`\n  Decisions (${decisions.length}):`))
      if (decisions.length === 0) {
        console.log(chalk.dim('    (none)'))
      } else {
        decisions.slice(-5).forEach((d) => {
          console.log(`    [${chalk.dim(d.decision_id)}] ${d.decision.slice(0, 80)}`)
          console.log(chalk.dim(`      context: ${d.context}  |  ${d.made_at}`))
        })
        if (decisions.length > 5) console.log(chalk.dim(`    … and ${decisions.length - 5} more`))
      }

      console.log(chalk.bold(`\n  Patterns (${patterns.length}):`))
      if (patterns.length === 0) {
        console.log(chalk.dim('    (none — run `lco memory learn` to discover patterns)'))
      } else {
        patterns.forEach((p) => {
          const conf = (p.confidence * 100).toFixed(0)
          console.log(
            `    [${chalk.cyan(p.pattern_type)}] ${p.description.slice(0, 80)} — ${conf}%`
          )
        })
      }

      console.log(chalk.bold(`\n  Failures (${failures.length}):`))
      if (failures.length === 0) {
        console.log(chalk.dim('    (none)'))
      } else {
        failures.slice(-5).forEach((f) => {
          console.log(chalk.red(`    ✗ [${f.patch_id}] ${f.category}: ${f.reason.slice(0, 80)}`))
        })
        if (failures.length > 5) console.log(chalk.dim(`    … and ${failures.length - 5} more`))
      }

      console.log(chalk.bold(`\n  Patch History (${patches.length}):`))
      if (patches.length === 0) {
        console.log(chalk.dim('    (none)'))
      } else {
        patches.slice(-5).forEach((p) => {
          const statusColor =
            p.status === 'done' ? chalk.green : p.status === 'failed' ? chalk.red : chalk.yellow
          console.log(`    ${statusColor(`[${p.status}]`)} ${p.patch_id} — ${p.title}`)
        })
        if (patches.length > 5) console.log(chalk.dim(`    … and ${patches.length - 5} more`))
      }

      console.log(chalk.bold('──────────────────────────────────────────────\n'))
      break
    }

    default:
      console.error(chalk.red(`Unknown memory subcommand: "${sub}"`))
      console.log(chalk.dim('Available subcommands: log-decision | log-failure | learn | show'))
      process.exit(1)
  }
}

// ---- Handoff command ----

async function cmdHandoff(
  patchId: string,
  opts: { mode?: string; dryRun?: boolean }
) {
  const chalk = await getChalk()

  const validModes: ApprovalMode[] = ['suggest', 'auto-edit', 'full-auto']
  let mode: ApprovalMode | undefined

  if (opts.mode) {
    if (!validModes.includes(opts.mode as ApprovalMode)) {
      console.error(
        chalk.red(`Invalid mode "${opts.mode}". Use: suggest | auto-edit | full-auto`)
      )
      process.exit(1)
    }
    mode = opts.mode as ApprovalMode
  }

  const dryRun = opts.dryRun ?? false

  console.log(chalk.bold('\n── LCO Handoff Generator ─────────────────────'))
  console.log(`  Patch:    ${chalk.cyan(patchId)}`)
  if (mode) console.log(`  Mode:     ${chalk.cyan(mode)} (override)`)
  if (dryRun) console.log(chalk.yellow('  [dry-run] File will NOT be written.'))
  console.log()

  try {
    const handoff = await generateHandoff(patchId, { mode, dryRun })

    const { renderCodexPrompt } = await import('../handoff-generator/codex-template.js')
    const markdown = renderCodexPrompt(handoff)

    if (dryRun) {
      console.log(chalk.bold('  Rendered prompt (dry-run):\n'))
      console.log(markdown)
    } else {
      const outFile = getHandoffFilePath(patchId)
      console.log(chalk.green(`✓ Handoff written to: ${outFile}`))
      console.log(chalk.bold('\n  First 5 lines:'))
      markdown
        .split('\n')
        .slice(0, 5)
        .forEach((line) => console.log(`  ${chalk.dim(line)}`))
    }

    console.log(chalk.dim(`\n  Approval mode: ${handoff.approval_mode}`))
    console.log(chalk.dim(`  Generated at:  ${handoff.generated_at}`))
    console.log(chalk.bold('──────────────────────────────────────────────\n'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Handoff error: ${msg}`))
    process.exit(1)
  }
}

// ---- Review command ----

async function cmdReview(
  patchId: string,
  opts: { diff?: string; dryRun?: boolean }
) {
  const chalk = await getChalk()

  const outcomeColor: Record<ReviewOutcome, typeof chalk.green> = {
    pass:  chalk.green,
    warn:  chalk.yellow,
    fail:  chalk.red,
    block: chalk.red,
  }

  console.log(chalk.bold('\n── LCO Diff Reviewer ─────────────────────────'))
  console.log(`  Patch:    ${chalk.cyan(patchId)}`)
  if (opts.diff) console.log(`  Diff:     ${chalk.dim(opts.diff)} (from file)`)
  if (opts.dryRun) console.log(chalk.yellow('  [dry-run] Review file will NOT be written.'))
  console.log()

  // Load diff from file if --diff was provided
  let diffContent: string | undefined
  if (opts.diff) {
    const fs = await import('fs')
    if (!fs.default.existsSync(opts.diff)) {
      console.error(chalk.red(`✗ Diff file not found: ${opts.diff}`))
      process.exit(1)
    }
    diffContent = fs.default.readFileSync(opts.diff, 'utf-8')
  }

  try {
    const result = await reviewPatch(patchId, { diffContent, dryRun: opts.dryRun ?? false })

    const color = outcomeColor[result.overall]
    console.log(`  Overall:  ${color(result.overall.toUpperCase())}`)
    console.log(`  Lines:    ${result.diff_lines}`)
    console.log()

    for (const dim of result.dimensions) {
      const dc = outcomeColor[dim.outcome]
      console.log(`  ${chalk.bold(dim.dimension.padEnd(9))} ${dc(dim.outcome.padEnd(5))}  ${dim.reason}`)
      if (dim.details && dim.details.filter((d) => d !== '__escalate__').length > 0) {
        dim.details
          .filter((d) => d !== '__escalate__')
          .forEach((d) => console.log(`             ${chalk.dim('→')} ${d}`))
      }
    }

    console.log()

    if (result.should_block) {
      console.log(chalk.red('!! BLOCKED — review required before proceeding'))
      if (result.replan_options && result.replan_options.length > 0) {
        console.log(chalk.yellow(`   Replan options available: ${result.replan_options.map((o) => o.action).join(', ')}`))
      }
    }
    if (result.escalate_to_human) {
      console.log(chalk.yellow('⚠ ESCALATE — ambiguous semantic change, human review needed'))
    }
    if (!result.should_block && !result.escalate_to_human) {
      console.log(chalk.green('✓ Review passed — no blocking issues found.'))
    }

    if (!opts.dryRun) {
      console.log(
        chalk.dim(`\n  Review written to: .orchestrator/patches/${patchId}-diff-review.md`)
      )
      if (result.replan_options && result.replan_options.length > 0) {
        console.log(
          chalk.dim(`  Replan written to: .orchestrator/patches/${patchId}-replan.md`)
        )
      }
    }

    console.log(chalk.bold('──────────────────────────────────────────────\n'))

    // Exit non-zero if blocked
    if (result.should_block) process.exit(1)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Review error: ${msg}`))
    process.exit(1)
  }
}

// ---- Export command ----

async function cmdExport(opts: { vault?: string; project?: string; dryRun?: boolean }) {
  const chalk = await getChalk()

  const vaultPath = opts.vault ?? './ObsidianVault'
  const projectName = opts.project ?? 'Local Coding Orchestrator'
  const dryRun = opts.dryRun ?? false

  const config: VaultConfig = {
    vaultPath,
    projectName,
    includePatterns: true,
    includeDecisions: true,
  }

  console.log(chalk.bold('\n── LCO Obsidian Exporter ─────────────────────'))
  console.log(`  Vault:    ${chalk.cyan(vaultPath)}`)
  console.log(`  Project:  ${chalk.cyan(projectName)}`)
  if (dryRun) console.log(chalk.yellow('  [dry-run] Files will NOT be written.'))
  console.log()

  try {
    const result = await exportToObsidian(config)

    if (dryRun) {
      console.log(chalk.bold('  Files that WOULD be written:'))
      result.filesWritten.forEach((f) => console.log(`    ${chalk.green('+')} ${f}`))
      if (result.filesSkipped.length > 0) {
        console.log(chalk.bold('\n  Skipped (missing sources):'))
        result.filesSkipped.forEach((f) => console.log(`    ${chalk.dim('-')} ${f}`))
      }
    } else {
      console.log(chalk.green(`✓ ${result.filesWritten.length} file(s) written to vault: ${vaultPath}`))
      result.filesWritten.forEach((f) => console.log(`    ${chalk.dim(f)}`))
      if (result.filesSkipped.length > 0) {
        console.log(chalk.dim(`\n  Skipped (${result.filesSkipped.length} missing sources):`))
        result.filesSkipped.forEach((f) => console.log(`    ${chalk.dim('-')} ${f}`))
      }
    }

    console.log(chalk.bold('──────────────────────────────────────────────\n'))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`\n✗ Export error: ${msg}`))
    process.exit(1)
  }
}

// ---- CLI setup ----

const program = new Command()

program
  .name('lco')
  .description('Local Coding Orchestrator — Strategic Brain CLI')
  .version('0.1.0')

program
  .command('status')
  .description('Show current brain state: goal, mode, status, patches')
  .action(() => cmdStatus())

program
  .command('plan <goal>')
  .description('Plan a new task goal and build initial patch queue')
  .option('-m, --mode <mode>', 'Override mode: fast | safe | deep')
  .action((goal: string, opts: { mode?: string }) => cmdPlan(goal, opts))

program
  .command('eval <patchId> <outcome> [reason]')
  .description('Evaluate a patch result: outcome = success | fail | partial')
  .action((patchId: string, outcome: string, reason = 'no reason provided') =>
    cmdEval(patchId, outcome, reason)
  )

program
  .command('ping')
  .description('Check Ollama connection and model availability')
  .option('-m, --model <model>', `Model to check (default: ${DEFAULT_MODEL})`)
  .action((opts: { model?: string }) => cmdPing(opts))

program
  .command('reset')
  .description('Reset brain state to idle (clears goal, patches, failures)')
  .action(() => cmdReset())

program
  .command('task <goal>')
  .description('Run the Gemma agent on a goal (ReAct loop)')
  .option('-c, --context <text>', 'Optional compressed context to inject into the agent prompt')
  .option('--dry-run', 'Register task in state.json without calling Ollama')
  .action((goal: string, opts: { context?: string; dryRun?: boolean }) =>
    cmdTask(goal, opts)
  )

program
  .command('compose <input>')
  .description('Normalize raw task input → structured task brief JSON')
  .option('--dry-run', 'Print output to console without writing files')
  .action((input: string, opts: { dryRun?: boolean }) =>
    cmdCompose(input, opts)
  )

program
  .command('scan')
  .description('Scan the workspace (Tier 1: skeleton | Tier 2: keyword | Tier 3: deep preview)')
  .option('-t, --tier <1|2|3>', 'Scan tier to run (default: 1)')
  .option('-k, --keywords <words>', 'Comma-separated keywords (required for tier 2 & 3)')
  .option('--dry-run', 'Print result JSON to stdout without updating cache')
  .action((opts: { tier?: string; keywords?: string; dryRun?: boolean }) =>
    cmdScan(opts)
  )

program
  .command('split')
  .description('Split the current task brief into an ordered patch plan (requires current-task.md)')
  .option('--dry-run', 'Print patch plan to console without writing plan.json')
  .action((opts: { dryRun?: boolean }) => cmdSplit(opts))

program
  .command('memory <subcommand> [args...]')
  .description(
    'Memory Manager — log decisions/failures, learn patterns, show summary\n' +
    '  Subcommands:\n' +
    '    log-decision <context> <decision>         — log a decision to decisions.json\n' +
    '    log-failure  <patchId> <category> <reason> — log a failure to failures.json\n' +
    '    learn                                     — run pattern learning + print discovered patterns\n' +
    '    show                                      — print decisions, patterns, failures summary'
  )
  .action((subcommand: string, args: string[]) => cmdMemory(subcommand, args))

program
  .command('handoff <patchId>')
  .description('Generate a Codex CLI handoff prompt from a patch in plan.json')
  .option('-m, --mode <mode>', 'Override approval mode: suggest | auto-edit | full-auto')
  .option('--dry-run', 'Print rendered prompt to stdout without writing file')
  .action((patchId: string, opts: { mode?: string; dryRun?: boolean }) =>
    cmdHandoff(patchId, opts)
  )

program
  .command('review <patchId>')
  .description('Review the diff for a patch: scope, danger, and semantic checks')
  .option('--diff <file>', 'Read diff from a file instead of running git diff HEAD~1')
  .option('--dry-run', 'Print review to console without writing review file')
  .action((patchId: string, opts: { diff?: string; dryRun?: boolean }) =>
    cmdReview(patchId, opts)
  )

program
  .command('export')
  .description('Export .orchestrator/ data to an Obsidian vault')
  .option('--vault <path>', 'Path to Obsidian vault folder (default: ./ObsidianVault)')
  .option('--project <name>', 'Project name for headers (default: "Local Coding Orchestrator")')
  .option('--dry-run', 'Print list of files that WOULD be written without writing them')
  .action((opts: { vault?: string; project?: string; dryRun?: boolean }) =>
    cmdExport(opts)
  )

program.parseAsync(process.argv).catch((err) => {
  console.error(err)
  process.exit(1)
})

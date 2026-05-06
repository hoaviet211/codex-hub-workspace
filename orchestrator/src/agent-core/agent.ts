// ============================================================
// Agent Core — Gemma ReAct Agent
// Patch 1: ReAct loop (Reason + Act) powered by Gemma via Ollama.
//
// Loop:
//   1. Build system prompt (goal + tools whitelist)
//   2. Call Gemma — expect either a tool call JSON or final_answer
//   3. Validate tool call against registry (whitelist enforced)
//   4. Execute whitelisted tool, inject result back as user message
//   5. Repeat until final_answer or max steps reached
//
// Gemma Limitations handled here:
//   - Tool name hallucination → validateToolCall() blocks unknown names
//   - Structured output instability → callGemmaStructured with format param
//   - Long reasoning → cap MAX_STEPS, inject compressed history
// ============================================================

import path from 'path'
import fs from 'fs'
import {
  callGemmaStructured,
  callGemma,
  OllamaMessage,
  JsonSchema,
} from './ollama-client.js'
import {
  validateToolCall,
  buildToolsPromptSection,
  listToolNames,
  ToolCall,
  ToolResult,
} from './tool-registry.js'
import { loadAgentState, updateTaskStatus } from './state.js'

// ---- Config ----

export const MAX_STEPS = 15           // prevent infinite loops (raised from 8 — file analysis needs more steps)
export const MAX_INPUT_TOKENS = 4000  // raised from 1800 to handle tool results without dropping context

// ---- Types ----

export interface AgentInput {
  goal: string
  context?: string      // optional compressed context (from Context Composer in later patches)
}

export interface AgentOutput {
  answer: string
  steps: number
  tool_calls_made: string[]
  status: 'done' | 'blocked' | 'max_steps_reached'
}

// Schema Gemma must emit at every turn
const REACT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    thought: { type: 'string' },
    tool: { type: 'string' },
    params: { type: 'object' as unknown as string },  // nested object, validated separately
  },
  required: ['thought', 'tool'],
}

// ---- System prompt ----

function buildSystemPrompt(goal: string, context?: string): string {
  const toolsSection = buildToolsPromptSection()

  const contextSection = context
    ? `\n## Context\n${context.slice(0, 500)}\n`
    : ''

  return `You are a Local Coding Orchestrator agent. Your goal is to help accomplish the following task.

## Goal
${goal}
${contextSection}
${toolsSection}

## Instructions
- At each step output ONLY a JSON object with fields: thought, tool, params
- "thought" is your reasoning (1-2 sentences max — be brief)
- "tool" must be one of the allowed tool names listed above — do NOT invent new names
- "params" must match the tool's parameter schema
- When you have enough information, call "final_answer" with field "answer"
- Do NOT output anything outside the JSON

## Output MUST match this schema exactly:
{"thought": "...", "tool": "<tool_name>", "params": {...}}`
}

// ---- Tool executors (Patch 1 stubs — real impl in later patches) ----

const STATE_DIR = path.resolve(process.cwd(), '.orchestrator')

async function executeTool(call: ToolCall): Promise<ToolResult> {
  switch (call.tool) {
    case 'read_file': {
      const filePath = String(call.params['path'] ?? '')
      try {
        const abs = path.resolve(process.cwd(), filePath)
        const content = fs.readFileSync(abs, 'utf-8')
        return { tool: call.tool, ok: true, output: content.slice(0, 5000) }
      } catch (e) {
        return { tool: call.tool, ok: false, error: `Cannot read file: ${filePath}` }
      }
    }

    case 'list_files': {
      const dirPath = String(call.params['path'] ?? '.')
      try {
        const abs = path.resolve(process.cwd(), dirPath)
        const entries = fs.readdirSync(abs)
        return { tool: call.tool, ok: true, output: entries }
      } catch (e) {
        return { tool: call.tool, ok: false, error: `Cannot list directory: ${dirPath}` }
      }
    }

    case 'write_memory': {
      const key = String(call.params['key'] ?? 'unnamed')
      const value = String(call.params['value'] ?? '')
      try {
        const memDir = path.join(STATE_DIR, 'memory')
        if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true })
        fs.writeFileSync(path.join(memDir, `${key}.md`), value, 'utf-8')
        return { tool: call.tool, ok: true, output: `Written to memory/${key}.md` }
      } catch (e) {
        return { tool: call.tool, ok: false, error: `Cannot write memory key: ${key}` }
      }
    }

    case 'update_task_status': {
      const status = String(call.params['status'] ?? 'running') as 'running' | 'done' | 'blocked'
      updateTaskStatus(status)
      return { tool: call.tool, ok: true, output: `Task status updated to: ${status}` }
    }

    case 'final_answer': {
      // Handled by the loop — executor should not be called for this tool
      return { tool: call.tool, ok: true, output: call.params['answer'] }
    }

    default:
      return { tool: call.tool, ok: false, error: `No executor for tool: ${call.tool}` }
  }
}

// ---- ReAct loop ----

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const { goal, context } = input
  const systemPrompt = buildSystemPrompt(goal, context)

  const messages: OllamaMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Begin. Goal: ${goal}` },
  ]

  const toolCallsMade: string[] = []
  let steps = 0

  for (; steps < MAX_STEPS; steps++) {
    // Keep message history bounded — drop oldest assistant/tool messages if growing too large
    const effectiveMessages = trimMessages(messages)

    process.stdout.write(`  [step ${steps + 1}/${MAX_STEPS}] thinking...`)
    let parsed: Record<string, unknown>
    try {
      parsed = await callGemmaStructured<Record<string, unknown>>(
        effectiveMessages,
        REACT_SCHEMA,
        { temperature: 'structured' }
      )
    } catch (err) {
      process.stdout.write(' blocked\n')
      // Gemma call failed after all retries — block and surface to user
      updateTaskStatus('blocked')
      return {
        answer: `Agent blocked: Gemma call failed — ${err instanceof Error ? err.message : String(err)}`,
        steps,
        tool_calls_made: toolCallsMade,
        status: 'blocked',
      }
    }

    const thought = String(parsed['thought'] ?? '')
    const rawCall = { tool: parsed['tool'], params: parsed['params'] ?? {} }

    // Validate tool name against whitelist
    const validation = validateToolCall(rawCall)
    if (!validation.valid) {
      process.stdout.write(` invalid tool\n`)
      // Inject the error back so Gemma can self-correct on next step
      messages.push({
        role: 'assistant',
        content: JSON.stringify(parsed),
      })
      messages.push({
        role: 'user',
        content: `Tool call error: ${validation.reason}. Use only these tools: ${listToolNames().join(', ')}. Try again.`,
      })
      continue
    }

    const toolCall = validation.call
    toolCallsMade.push(toolCall.tool)

    process.stdout.write(` → ${toolCall.tool}(${JSON.stringify(toolCall.params).slice(0, 60)})\n`)

    // Final answer — exit loop
    if (toolCall.tool === 'final_answer') {
      const answer = String(toolCall.params['answer'] ?? thought)
      updateTaskStatus('done')
      return {
        answer,
        steps: steps + 1,
        tool_calls_made: toolCallsMade,
        status: 'done',
      }
    }

    // Execute tool
    const result = await executeTool(toolCall)

    // Inject tool result into conversation
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ thought, tool: toolCall.tool, params: toolCall.params }),
    })
    messages.push({
      role: 'user',
      content: result.ok
        ? `Tool result [${toolCall.tool}]: ${JSON.stringify(result.output)}`
        : `Tool error [${toolCall.tool}]: ${result.error}`,
    })
  }

  // Hit max steps without final_answer
  updateTaskStatus('blocked')
  return {
    answer: `Max steps (${MAX_STEPS}) reached without a final answer. Last thought logged.`,
    steps,
    tool_calls_made: toolCallsMade,
    status: 'max_steps_reached',
  }
}

// ---- Helpers ----

/**
 * Keep messages within token budget.
 * Always preserve system[0] + last user message.
 * Drops oldest assistant/user pairs from the middle when list grows.
 */
function trimMessages(messages: OllamaMessage[]): OllamaMessage[] {
  // Rough estimate: avg 60 chars/token
  const totalChars = messages.reduce((s, m) => s + m.content.length, 0)
  const estimatedTokens = Math.ceil(totalChars / 60)

  if (estimatedTokens <= MAX_INPUT_TOKENS) return messages

  // Keep system + first user + last 4 messages
  const system = messages[0]
  const tail = messages.slice(-4)
  return [system, ...tail]
}

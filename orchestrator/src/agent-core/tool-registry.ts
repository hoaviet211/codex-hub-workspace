// ============================================================
// Agent Core — Tool Registry
// Patch 1: whitelist-only tool names passed to Gemma.
// Per Gemma Limitations: Gemma may hallucinate tool names —
// we validate every tool call against this registry before execution.
// ============================================================

export interface ToolDefinition {
  /** Unique tool name — this is the ONLY string Gemma is allowed to emit */
  name: string
  description: string
  /** Human-readable list of accepted parameters (for prompt injection) */
  paramSchema: Record<string, string>
}

export interface ToolCall {
  tool: string
  params: Record<string, unknown>
}

export interface ToolResult {
  tool: string
  ok: boolean
  output?: unknown
  error?: string
}

// ---- Registry storage ----

const registry = new Map<string, ToolDefinition>()

// ---- Built-in tools (registered at module load) ----

const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read content of a file in the workspace',
    paramSchema: { path: 'string — relative path from workspace root' },
  },
  {
    name: 'list_files',
    description: 'List files/directories at a given path (1 level deep)',
    paramSchema: { path: 'string — relative directory path' },
  },
  {
    name: 'write_memory',
    description: 'Write a key-value entry to .orchestrator/memory/',
    paramSchema: {
      key: 'string — memory key / filename (no extension)',
      value: 'string — content to persist',
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the current task status in .orchestrator/state.json',
    paramSchema: {
      status: 'string — one of: running | done | blocked',
      reason: 'string (optional) — reason for status change',
    },
  },
  {
    name: 'final_answer',
    description: 'End the ReAct loop and return the final answer to the user',
    paramSchema: { answer: 'string — the final response or summary' },
  },
]

BUILTIN_TOOLS.forEach((t) => registry.set(t.name, t))

// ---- Public API ----

/** Register a custom tool. Throws if name already taken. */
export function registerTool(tool: ToolDefinition): void {
  if (registry.has(tool.name)) {
    throw new Error(`[ToolRegistry] Tool "${tool.name}" is already registered`)
  }
  registry.set(tool.name, tool)
}

/** Look up a registered tool by name. Returns undefined if not found. */
export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name)
}

/** Check if a tool name is whitelisted. */
export function isRegistered(name: string): boolean {
  return registry.has(name)
}

/** Return all registered tool names (used to build Gemma's system prompt). */
export function listToolNames(): string[] {
  return [...registry.keys()]
}

/** Return all tool definitions (used to inject tool descriptions into prompts). */
export function listTools(): ToolDefinition[] {
  return [...registry.values()]
}

/**
 * Validate a raw tool call emitted by Gemma.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateToolCall(call: unknown): { valid: true; call: ToolCall } | { valid: false; reason: string } {
  if (typeof call !== 'object' || call === null) {
    return { valid: false, reason: 'Tool call is not an object' }
  }
  const c = call as Record<string, unknown>

  if (typeof c['tool'] !== 'string' || c['tool'].trim() === '') {
    return { valid: false, reason: 'Missing or empty "tool" field' }
  }

  const toolName = c['tool'] as string

  if (!isRegistered(toolName)) {
    return {
      valid: false,
      reason: `Tool "${toolName}" is not in the whitelist. Allowed: ${listToolNames().join(', ')}`,
    }
  }

  const params = (typeof c['params'] === 'object' && c['params'] !== null)
    ? (c['params'] as Record<string, unknown>)
    : {}

  return { valid: true, call: { tool: toolName, params } }
}

/**
 * Build the tools section of a Gemma system prompt.
 * Injects ONLY registered names + descriptions — never raw function signatures.
 */
export function buildToolsPromptSection(): string {
  const lines = ['## Available Tools', '']
  for (const tool of registry.values()) {
    lines.push(`### ${tool.name}`)
    lines.push(tool.description)
    const params = Object.entries(tool.paramSchema)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join('\n')
    if (params) lines.push(`Parameters:\n${params}`)
    lines.push('')
  }
  lines.push(
    'To call a tool, output ONLY valid JSON in this format:',
    '{"tool": "<tool_name>", "params": { ... }}',
    '',
    'To finish, call the "final_answer" tool.',
    `Allowed tool names: ${listToolNames().join(' | ')}`,
    'DO NOT invent new tool names.'
  )
  return lines.join('\n')
}

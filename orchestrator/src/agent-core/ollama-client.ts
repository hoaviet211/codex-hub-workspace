// ============================================================
// Agent Core — Ollama Client
// Wraps the `ollama` npm package with:
//   - Ping / health check
//   - Gemma 4 call with retry (max 3 attempts)
//   - JSON schema enforcement via Ollama `format` param (P0 strategy)
//   - Temperature tuning helpers
//   - Clear error messages when Ollama is not running
// ============================================================

import { Ollama } from 'ollama'

// ---- Config ----

export const DEFAULT_MODEL = 'gemma4:e4b'
export const OLLAMA_BASE_URL = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
export const MAX_RETRIES = 3
export const REQUEST_TIMEOUT_MS = 30_000  // 30s per call
export const PING_TIMEOUT_MS = 5_000      // 5s for ping

// Per task-doc: temperature tuning by use case
export const TEMPERATURE = {
  structured: 0.0,   // JSON output — deterministic
  compose: 0.2,      // context composer — slight flex
  patch: 0.4,        // patch splitting — some creativity
  review: 0.1,       // semantic review — consistent
} as const

export type TemperaturePreset = keyof typeof TEMPERATURE

// ---- Types ----

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Subset of Ollama JSON schema format supported by grammar-constrained generation
export interface JsonSchema {
  type: 'object'
  properties: Record<string, { type: string; items?: { type: string } }>
  required?: string[]
}

export interface CallOptions {
  temperature?: number | TemperaturePreset
  format?: JsonSchema
  maxTokens?: number
  /** Override model — defaults to DEFAULT_MODEL */
  model?: string
}

export interface OllamaResponse {
  content: string
  /** Parsed JSON when `format` was provided and parse succeeded */
  parsed?: Record<string, unknown>
  model: string
  durationMs: number
  retryCount: number
}

export interface PingResult {
  ok: boolean
  /** Ollama version string if available */
  version?: string
  modelAvailable: boolean
  durationMs: number
  error?: string
}

// ---- Internal helpers ----

function resolveTemperature(temp: number | TemperaturePreset | undefined): number {
  if (temp === undefined) return TEMPERATURE.structured
  if (typeof temp === 'number') return temp
  return TEMPERATURE[temp]
}

/** Detect if an Error is a connection-refused / timeout style error */
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.message.includes('ECONNREFUSED') ||
    err.message.includes('fetch failed') ||
    err.message.includes('ECONNRESET') ||
    err.message.includes('ETIMEDOUT') ||
    err.message.includes('socket hang up')
  )
}

// Build the ollama client instance (re-used across calls)
const ollamaClient = new Ollama({ host: OLLAMA_BASE_URL })

// ---- Public API ----

/**
 * Ping Ollama and check whether the target model is available.
 * Always resolves (never throws) — check `result.ok`.
 */
export async function pingOllama(model = DEFAULT_MODEL): Promise<PingResult> {
  const start = Date.now()
  try {
    // list() is a lightweight endpoint — no inference cost
    const listResponse = await Promise.race([
      ollamaClient.list(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Ping timeout')), PING_TIMEOUT_MS)
      ),
    ])

    const version = undefined  // ollama npm client doesn't expose version directly
    const modelAvailable = listResponse.models.some(
      (m) => m.name === model || m.name.startsWith(model.split(':')[0])
    )

    return {
      ok: true,
      version,
      modelAvailable,
      durationMs: Date.now() - start,
    }
  } catch (err) {
    const error =
      isConnectionError(err)
        ? `Ollama is not running at ${OLLAMA_BASE_URL}. Start it with: ollama serve`
        : err instanceof Error
          ? err.message
          : String(err)

    return {
      ok: false,
      modelAvailable: false,
      durationMs: Date.now() - start,
      error,
    }
  }
}

/**
 * Call Gemma (or any Ollama model) with automatic retry on failure.
 *
 * Retry logic (per task-doc fallback strategy):
 *   Attempt 1: full prompt + schema
 *   Attempt 2: simplified system prompt
 *   Attempt 3: minimal prompt — last resort
 *   After 3 failures: throws OllamaCallError
 *
 * JSON enforcement: when `options.format` is provided, Ollama's grammar-
 * constrained generation guarantees valid JSON at the sampling layer.
 */
export async function callGemma(
  messages: OllamaMessage[],
  options: CallOptions = {}
): Promise<OllamaResponse> {
  const model = options.model ?? DEFAULT_MODEL
  const temperature = resolveTemperature(options.temperature)

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now()

    // Simplify system prompt on retries to reduce hallucination surface
    const effectiveMessages = simplifyForRetry(messages, attempt)

    try {
      const response = await Promise.race([
        ollamaClient.chat({
          model,
          messages: effectiveMessages,
          options: {
            temperature,
            ...(options.maxTokens !== undefined ? { num_predict: options.maxTokens } : {}),
          },
          // Ollama format: grammar-constrained JSON generation (P0 enhancement)
          ...(options.format !== undefined ? { format: options.format } : {}),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Ollama request timed out after ${REQUEST_TIMEOUT_MS}ms`)),
            REQUEST_TIMEOUT_MS
          )
        ),
      ])

      const content = response.message.content.trim()
      const durationMs = Date.now() - start

      // If format was provided, attempt JSON parse and validate required fields
      if (options.format) {
        const parsed = tryParseJson(content, options.format)
        if (parsed !== null) {
          return { content, parsed, model, durationMs, retryCount: attempt - 1 }
        }
        // JSON parse failed despite format param — retry
        lastError = new Error(`JSON parse failed on attempt ${attempt}: ${content.slice(0, 120)}`)
        continue
      }

      return { content, model, durationMs, retryCount: attempt - 1 }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      if (isConnectionError(error)) {
        // No point retrying — Ollama is not running
        throw new OllamaConnectionError(
          `Ollama is not running at ${OLLAMA_BASE_URL}. Start it with: ollama serve`,
          error
        )
      }

      lastError = error

      if (attempt < MAX_RETRIES) {
        // Brief backoff: 500ms × attempt number
        await sleep(500 * attempt)
      }
    }
  }

  throw new OllamaCallError(
    `Gemma call failed after ${MAX_RETRIES} attempts. Last error: ${lastError?.message ?? 'unknown'}`,
    lastError
  )
}

/**
 * Convenience wrapper: call Gemma and always return validated JSON.
 * Throws if schema validation fails after all retries.
 */
export async function callGemmaStructured<T extends Record<string, unknown>>(
  messages: OllamaMessage[],
  schema: JsonSchema,
  options: Omit<CallOptions, 'format'> = {}
): Promise<T> {
  const response = await callGemma(messages, { ...options, format: schema })
  if (!response.parsed) {
    throw new OllamaCallError('Structured call returned no valid JSON', null)
  }
  return response.parsed as T
}

// ---- Error classes ----

export class OllamaConnectionError extends Error {
  constructor(message: string, public readonly cause: Error | null) {
    super(message)
    this.name = 'OllamaConnectionError'
  }
}

export class OllamaCallError extends Error {
  constructor(message: string, public readonly cause: Error | null) {
    super(message)
    this.name = 'OllamaCallError'
  }
}

// ---- Internal utilities ----

function tryParseJson(
  content: string,
  schema: JsonSchema
): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(content)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null

    // Validate required fields
    const required = schema.required ?? []
    for (const field of required) {
      if (!(field in obj)) return null
    }
    return obj as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * On retries, strip down the system prompt to reduce token count and hallucination.
 * Attempt 1: original messages
 * Attempt 2: keep system + last user message only
 * Attempt 3: drop system, keep only last user message
 */
function simplifyForRetry(messages: OllamaMessage[], attempt: number): OllamaMessage[] {
  if (attempt === 1) return messages

  const systemMsg = messages.find((m) => m.role === 'system')
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')

  if (attempt === 2 && systemMsg && lastUser) {
    return [
      { role: 'system', content: systemMsg.content.split('\n## Examples')[0].trim() },
      lastUser,
    ]
  }

  // Attempt 3: minimal — just the user message
  if (lastUser) return [lastUser]
  return messages
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

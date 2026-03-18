/**
 * RLM Sub-LM Dispatch — pi CLI bridge
 *
 * Spawns lightweight pi instances in print mode for sub-LM calls.
 * This is the same pattern pi-subagents uses internally (execution.ts runSync):
 * spawn('pi', ['-p', ...args]) as a child process.
 *
 * Uses --no-session --no-tools --no-extensions --no-skills --no-themes
 * to minimize overhead — pure text-in, text-out LLM calls.
 *
 * Stored objects can be injected into prompts via the `inject` parameter.
 *
 * @module
 */

import { spawn } from 'node:child_process'
import type { StoreApi } from './store/index.ts'

// ─── Types ───────────────────────────────────────────────────

export interface LlmOpts {
  /** Model ID, e.g. 'anthropic/claude-haiku-4-5' */
  model?: string
  /** Stored object refs to inject: ['collection:key', ...] */
  inject?: string[]
  /** Timeout per call in ms (default: 30000) */
  timeout?: number
}

export interface LlmBatchItem {
  prompt: string
  model?: string
  inject?: string[]
}

// ─── Prompt Construction ─────────────────────────────────────

/** Parse an inject ref like 'collection:key' into parts */
function parseRef(ref: string): { col: string; key: string } | null {
  const sep = ref.indexOf(':')
  if (sep === -1) return null
  return { col: ref.slice(0, sep), key: ref.slice(sep + 1) }
}

/** Resolve inject refs from store, wrap as <context> blocks */
export async function buildInjectedPrompt(
  prompt: string,
  inject: string[] | undefined,
  store: StoreApi,
): Promise<string> {
  if (!inject?.length) return prompt

  const blocks = (await Promise.all(
    inject.map(async (ref) => {
      const parsed = parseRef(ref)
      if (!parsed) return ''
      const obj = await store.get(parsed.col, parsed.key)
      if (obj == null) return ''
      return `<context name="${ref}">\n${JSON.stringify(obj, null, 2)}\n</context>`
    })
  )).filter(Boolean)

  return blocks.length > 0
    ? blocks.join('\n') + '\n\n' + prompt
    : prompt
}

/** Build pi CLI args for a sub-LM call */
export function buildArgs(prompt: string, model?: string): string[] {
  const args = [
    '-p',               // print mode — process prompt and exit
    '--no-session',     // ephemeral — don't persist
    '--no-tools',       // text-in text-out — no tool calls
    '--no-extensions',  // skip extension loading
    '--no-skills',      // skip skill loading
    '--no-themes',      // skip theme loading
  ]
  if (model) args.push('--model', model)
  args.push(prompt)
  return args
}

// ─── Execution ───────────────────────────────────────────────

/**
 * Spawn a pi process and collect stdout.
 * Mirrors pi-subagents/execution.ts runSync pattern:
 * spawn('pi', args, { stdio: ['ignore', 'pipe', 'pipe'] })
 */
function spawnPi(args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('pi', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      setTimeout(() => !proc.killed && proc.kill('SIGKILL'), 3000)
    }, timeout)

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (killed) {
        reject(new Error(`Sub-LM call timed out after ${timeout}ms`))
      } else if (code !== 0) {
        reject(new Error(`pi exited with code ${code}: ${stderr.trim().slice(0, 200)}`))
      } else {
        resolve(stdout.trim())
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to spawn pi: ${err.message}`))
    })
  })
}

// ─── Bridge Factory ──────────────────────────────────────────

export interface LlmBridge {
  llm: (prompt: string, opts?: LlmOpts) => Promise<string>
  llm_batch: (prompts: Array<string | LlmBatchItem>, opts?: { concurrency?: number }) => Promise<string[]>
}

export interface LlmBridgeConfig {
  /** Max calls per ms invocation (default: 20) */
  maxCalls?: number
  /** Default model for sub-LM calls */
  defaultModel?: string
  /** Default timeout in ms (default: 30000) */
  defaultTimeout?: number
  /** Max concurrent batch calls (default: 3) */
  defaultConcurrency?: number
}

/**
 * Create a call-counted LLM bridge.
 * Each ms tool invocation gets a fresh bridge with its own counter.
 */
export function createLlmBridge(store: StoreApi, config?: LlmBridgeConfig): LlmBridge {
  const maxCalls = config?.maxCalls ?? 20
  const defaultModel = config?.defaultModel
  const defaultTimeout = config?.defaultTimeout ?? 30_000
  const defaultConcurrency = config?.defaultConcurrency ?? 3
  let callCount = 0

  function guardCalls(n: number): void {
    if (callCount + n > maxCalls) {
      throw new Error(
        `Sub-LM call limit exceeded: ${callCount + n} > ${maxCalls}. ` +
        `Use fewer calls or increase limit.`
      )
    }
    callCount += n
  }

  async function llm(prompt: string, opts?: LlmOpts): Promise<string> {
    guardCalls(1)
    const fullPrompt = await buildInjectedPrompt(prompt, opts?.inject, store)
    const args = buildArgs(fullPrompt, opts?.model ?? defaultModel)
    return spawnPi(args, opts?.timeout ?? defaultTimeout)
  }

  async function llm_batch(
    prompts: Array<string | LlmBatchItem>,
    opts?: { concurrency?: number },
  ): Promise<string[]> {
    guardCalls(prompts.length)
    const concurrency = opts?.concurrency ?? defaultConcurrency
    const results: string[] = []

    // Normalize
    const items: LlmBatchItem[] = prompts.map(p =>
      typeof p === 'string' ? { prompt: p } : p
    )

    // Process in batches (same pattern as pi-subagents mapConcurrent)
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency)
      const settled = await Promise.allSettled(
        batch.map(async (item) => {
          const fullPrompt = await buildInjectedPrompt(item.prompt, item.inject, store)
          const args = buildArgs(fullPrompt, item.model ?? defaultModel)
          return spawnPi(args, defaultTimeout)
        })
      )
      results.push(
        ...settled.map(r =>
          r.status === 'fulfilled'
            ? r.value
            : `[error: ${(r as PromiseRejectedResult).reason?.message ?? r.reason}]`
        )
      )
    }

    return results
  }

  return { llm, llm_batch }
}

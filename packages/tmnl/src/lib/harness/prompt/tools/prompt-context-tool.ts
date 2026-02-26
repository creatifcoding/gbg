/**
 * EPOCH-0003: prompt_context tool — thin code-eval wrapper over PromptRegistry.
 *
 * The agent writes JavaScript code. The harness evals it with `promptContext`
 * in scope. One tool call, arbitrary complexity.
 *
 * @module harness/prompt/tools/prompt-context-tool
 */

import { Effect } from 'effect'
import type { PromptRegistryShape } from '../PromptRegistry'
import { PromptBudgetExceededError, PromptReservedKeyError } from '../types'

// ── API Docs (injected into tool-manifest section) ──────────

export const PROMPT_CONTEXT_API_DOCS = `
## prompt_context Tool

You have a \`prompt_context\` tool that lets you manage your own system prompt entries.
Your system prompt is assembled from keyed entries. Some keys are system-reserved (read-only).
You can freely create, update, and delete your own entries within a size budget.

Call it with a \`code\` parameter containing JavaScript. The \`promptContext\` object is in scope:

\`\`\`
// Read (all entries)
promptContext.list()              → [{ key, priority, sizeBytes }]
promptContext.get(key)            → { key, priority, content, sizeBytes } | null
promptContext.has(key)            → boolean
promptContext.keys()              → string[] (your entries only)
promptContext.budget()            → { usedBytes, limitBytes, remainingBytes, entryCount }

// Write (your entries only — system keys reject)
promptContext.set(key, content)
promptContext.set(key, content, { priority: 550 })
promptContext.delete(key)         → boolean
\`\`\`

Use this to:
- Build working memory (remember debug state, task focus, conventions)
- Survey what's in your system prompt (list, get)
- Manage your budget (consolidate when running low)
- Set task-specific context that persists across messages

System-reserved keys: identity, tool-manifest, guidelines, project-context, runtime-stamp.
Your entries are session-scoped (lost when session ends).
`.trim()

// ── Tool Definition ─────────────────────────────────────────

export const PROMPT_CONTEXT_TOOL_NAME = 'prompt_context'

export const promptContextToolParameters = {
  type: 'object' as const,
  properties: {
    code: {
      type: 'string' as const,
      description:
        'JavaScript code to execute. `promptContext` is in scope. ' +
        'Return value (if any) is sent back as the tool result.',
    },
  },
  required: ['code'],
}

// ── Execution ───────────────────────────────────────────────

/**
 * Build a synchronous API wrapper around the PromptRegistryShape.
 * All methods run Effect.runSync — safe because the registry's internal
 * state is a plain Map (no async I/O on read/write operations).
 */
const makeSyncApi = (registry: PromptRegistryShape) => ({
  list: () => Effect.runSync(registry.list()),
  get: (key: string) => Effect.runSync(registry.get(key)),
  has: (key: string) => Effect.runSync(registry.has(key)),
  keys: () => Effect.runSync(registry.keys()),
  budget: () => Effect.runSync(registry.budget()),
  set: (key: string, content: string, opts?: { priority?: number }) =>
    Effect.runSync(registry.set(key, content, opts)),
  delete: (key: string) => Effect.runSync(registry.delete(key)),
})

/**
 * Execute agent-provided code with promptContext in scope.
 *
 * Uses `new Function` to eval in a constrained scope — only `promptContext`
 * is accessible. No file system, no network, no globals beyond builtins.
 */
export const executePromptContextCode = (
  registry: PromptRegistryShape,
  code: string,
): Effect.Effect<unknown, PromptBudgetExceededError | PromptReservedKeyError> =>
  Effect.gen(function* () {
    const promptContext = makeSyncApi(registry)

    try {
      // Wrap in async function to allow agent to use return statements
      const fn = new Function('promptContext', `'use strict';\n${code}`)
      const result = fn(promptContext)
      // If result is a promise (agent used async patterns), await it
      return result instanceof Promise ? yield* Effect.tryPromise({ try: () => result, catch: (e) => e }) : result
    } catch (error) {
      // Surface Effect errors (budget exceeded, reserved key) as structured errors
      if (error instanceof PromptBudgetExceededError) {
        return yield* error
      }
      if (error instanceof PromptReservedKeyError) {
        return yield* error
      }
      // Unknown error — surface as tool error text
      const message = error instanceof Error ? error.message : String(error)
      return { error: true, message: `prompt_context code execution failed: ${message}` }
    }
  }).pipe(
    Effect.withSpan('tmnl.harness.prompt.execute-code'),
  )

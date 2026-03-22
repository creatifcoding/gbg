/**
 * EPOCH-0003: PromptRegistry — Keyed system prompt registry as Effect Service.
 *
 * A flat key-value store of prompt entries. System-reserved keys are read-only
 * to the agent. Agent-owned keys have full CRUD within a configurable budget.
 * build() sorts by priority, concatenates, and traces with Effect.withSpan.
 *
 * @module harness/prompt/PromptRegistry
 */

import { Context, Effect, Layer } from 'effect'
import type { PromptEntry, PromptEntryMeta, PromptBudget } from './types'
import {
  RESERVED_KEYS,
  isReservedKey,
  PromptBudgetExceededError,
  PromptReservedKeyError,
  DEFAULT_AGENT_BUDGET_BYTES,
  DEFAULT_AGENT_PRIORITY,
} from './types'

// ── Registry Shape ──────────────────────────────────────────

export interface PromptRegistryShape {
  // ── Read (all entries) ──────────────────────────────────
  readonly list: () => Effect.Effect<ReadonlyArray<PromptEntryMeta>>
  readonly get: (key: string) => Effect.Effect<PromptEntry | null>
  readonly has: (key: string) => Effect.Effect<boolean>
  readonly keys: () => Effect.Effect<ReadonlyArray<string>>
  readonly budget: () => Effect.Effect<PromptBudget>

  // ── Write (agent-owned only) ────────────────────────────
  readonly set: (
    key: string,
    content: string,
    options?: { priority?: number },
  ) => Effect.Effect<void, PromptBudgetExceededError | PromptReservedKeyError>
  readonly delete: (key: string) => Effect.Effect<boolean, PromptReservedKeyError>

  // ── Assembly ────────────────────────────────────────────
  readonly build: () => Effect.Effect<string>
  readonly reload: () => Effect.Effect<void>
  readonly fork: () => Effect.Effect<PromptRegistryShape>
}

// ── Service Tag ─────────────────────────────────────────────

export class PromptRegistry extends Context.Tag('tmnl/harness/PromptRegistry')<
  PromptRegistry,
  PromptRegistryShape
>() {}

// ── Implementation ──────────────────────────────────────────

export interface PromptRegistryConfig {
  /** Agent write budget in bytes. Default: 16KB */
  readonly agentBudgetBytes?: number
}

/**
 * Create a concrete PromptRegistryShape backed by a mutable Map.
 *
 * NOT a Layer factory — returns a plain shape. The caller wraps it into
 * a Layer or stores it on a session record. This allows fork() to create
 * new instances without needing the DI container.
 */
export const makePromptRegistry = (
  config?: PromptRegistryConfig,
  /** Pre-populated entries (system sections). Keys in RESERVED_KEYS are enforced as read-only. */
  initialEntries?: ReadonlyArray<PromptEntry>,
): PromptRegistryShape => {
  const budgetLimit = config?.agentBudgetBytes ?? DEFAULT_AGENT_BUDGET_BYTES
  const entries = new Map<string, PromptEntry>()

  // Populate initial entries
  if (initialEntries) {
    for (const entry of initialEntries) {
      entries.set(entry.key, entry)
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  const byteLength = (s: string): number => new TextEncoder().encode(s).byteLength

  const computeAgentUsed = (): number => {
    let used = 0
    for (const [key, entry] of entries) {
      if (!isReservedKey(key)) {
        used += entry.sizeBytes
      }
    }
    return used
  }

  const agentEntryCount = (): number => {
    let count = 0
    for (const key of entries.keys()) {
      if (!isReservedKey(key)) count++
    }
    return count
  }

  // ── Shape ─────────────────────────────────────────────────

  const shape: PromptRegistryShape = {
    list: () =>
      Effect.sync(() => {
        const result: PromptEntryMeta[] = []
        for (const entry of entries.values()) {
          result.push({ key: entry.key, priority: entry.priority, sizeBytes: entry.sizeBytes })
        }
        return result
      }),

    get: (key) =>
      Effect.sync(() => entries.get(key) ?? null),

    has: (key) =>
      Effect.sync(() => entries.has(key)),

    keys: () =>
      Effect.sync(() => {
        const result: string[] = []
        for (const key of entries.keys()) {
          if (!isReservedKey(key)) result.push(key)
        }
        return result
      }),

    budget: () =>
      Effect.sync(() => {
        const used = computeAgentUsed()
        return {
          usedBytes: used,
          limitBytes: budgetLimit,
          remainingBytes: Math.max(0, budgetLimit - used),
          entryCount: agentEntryCount(),
        }
      }),

    set: (key, content, options) =>
      Effect.gen(function* () {
        // Reserved key check
        if (isReservedKey(key)) {
          return yield* new PromptReservedKeyError({
            key,
            message: `'${key}' is a system-reserved key and cannot be written by the agent.`,
          })
        }

        const contentBytes = byteLength(content)
        const existing = entries.get(key)
        const existingBytes = existing ? existing.sizeBytes : 0
        const delta = contentBytes - existingBytes
        const currentUsed = computeAgentUsed()
        const projectedUsed = currentUsed + delta

        // Budget check
        if (projectedUsed > budgetLimit) {
          return yield* new PromptBudgetExceededError({
            key,
            requestedBytes: contentBytes,
            remainingBytes: Math.max(0, budgetLimit - currentUsed + existingBytes),
            limitBytes: budgetLimit,
          })
        }

        const priority = options?.priority ?? existing?.priority ?? DEFAULT_AGENT_PRIORITY

        entries.set(key, {
          key,
          priority,
          content,
          sizeBytes: contentBytes,
        })
      }),

    delete: (key) =>
      Effect.gen(function* () {
        if (isReservedKey(key)) {
          return yield* new PromptReservedKeyError({
            key,
            message: `'${key}' is a system-reserved key and cannot be deleted.`,
          })
        }
        return entries.delete(key)
      }),

    build: () =>
      Effect.sync(() => {
        const sorted = Array.from(entries.values()).sort((a, b) => a.priority - b.priority)
        return sorted.map((e) => e.content).join('\n\n')
      }).pipe(
        Effect.withSpan('tmnl.harness.prompt.build', {
          attributes: {
            'prompt.sections': entries.size,
            'prompt.agent_entries': agentEntryCount(),
            'prompt.agent_budget_used': computeAgentUsed(),
            'prompt.agent_budget_limit': budgetLimit,
          },
        }),
      ),

    reload: () =>
      // Reload is a no-op on the base registry — sections provide their own reload logic.
      // The caller (makeDefaultRegistry) wires section reload into this.
      Effect.void,

    fork: () =>
      Effect.sync(() => {
        // Fork inherits system entries (deep copy), agent entries start empty.
        const systemEntries: PromptEntry[] = []
        for (const [key, entry] of entries) {
          if (isReservedKey(key)) {
            systemEntries.push({ ...entry })
          }
        }
        return makePromptRegistry(config, systemEntries)
      }),
  }

  return shape
}

// ── Default Layer (empty registry — populated by makeDefaultRegistry) ────

export const PromptRegistryLive = Layer.sync(PromptRegistry, () =>
  makePromptRegistry(),
)

/**
 * EPOCH-0003: Self-Adapting System Prompt Architecture — Core Types
 *
 * The system prompt is a keyed registry. No "kind" field — just entries.
 * Some keys are system-reserved (read-only to agent). Everything else
 * is agent-owned (full CRUD, budget-capped, session-scoped).
 *
 * @module harness/prompt/types
 */

import { Schema } from 'effect'

// ── Reserved Keys ───────────────────────────────────────────
// Internal enforcement — the agent discovers the boundary by trying to write.
export const RESERVED_KEYS = new Set([
  'identity',
  'tool-manifest',
  'guidelines',
  'project-context',
  'runtime-stamp',
  'compaction-summary',
] as const)

export type ReservedKey = 'identity' | 'tool-manifest' | 'guidelines' | 'project-context' | 'runtime-stamp' | 'compaction-summary'

export const isReservedKey = (key: string): key is ReservedKey =>
  RESERVED_KEYS.has(key as ReservedKey)

// ── Registry Entry ──────────────────────────────────────────
export const PromptEntry = Schema.Struct({
  /** Semantic key — the agent addresses entries by this */
  key: Schema.NonEmptyString,
  /** Assembly priority: lower = earlier in prompt.
   *  System entries: 0-400. Agent entries: 500-800 (default 600). Stamp: 900. */
  priority: Schema.Number.pipe(Schema.between(0, 1000)),
  /** The actual prompt text for this entry */
  content: Schema.String,
  /** Byte length of content (for budget tracking) */
  sizeBytes: Schema.Number,
})
export type PromptEntry = typeof PromptEntry.Type

// ── Entry Metadata (returned by list — no content) ──────────
export const PromptEntryMeta = Schema.Struct({
  key: Schema.NonEmptyString,
  priority: Schema.Number,
  sizeBytes: Schema.Number,
})
export type PromptEntryMeta = typeof PromptEntryMeta.Type

// ── Budget Info ─────────────────────────────────────────────
export const PromptBudget = Schema.Struct({
  /** Bytes used by agent-owned entries */
  usedBytes: Schema.Number,
  /** Configurable hard cap (default 16KB, env PI_HARNESS_PROMPT_AGENT_BUDGET_KB) */
  limitBytes: Schema.Number,
  /** Remaining budget */
  remainingBytes: Schema.Number,
  /** Number of agent-owned entries */
  entryCount: Schema.Number,
})
export type PromptBudget = typeof PromptBudget.Type

// ── Default Configuration ───────────────────────────────────
/** Default agent budget: 16KB */
export const DEFAULT_AGENT_BUDGET_BYTES = 16 * 1024

/** Default priority for agent-created entries */
export const DEFAULT_AGENT_PRIORITY = 600

// ── Error Types ─────────────────────────────────────────────
export class PromptBudgetExceededError extends Schema.TaggedError<PromptBudgetExceededError>()(
  'PromptBudgetExceededError',
  {
    key: Schema.String,
    requestedBytes: Schema.Number,
    remainingBytes: Schema.Number,
    limitBytes: Schema.Number,
  },
) {}

export class PromptReservedKeyError extends Schema.TaggedError<PromptReservedKeyError>()(
  'PromptReservedKeyError',
  {
    key: Schema.String,
    message: Schema.String,
  },
) {}

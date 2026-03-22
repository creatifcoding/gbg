/**
 * Minibuffer Schemas
 *
 * Effect Schema-backed types for the Emacs-inspired minibuffer system.
 * Uses branded primitives and literal unions for type safety.
 *
 * @module
 */

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// Minibuffer Mode (State Machine States)
// ─────────────────────────────────────────────────────────────

/**
 * Minibuffer operational modes.
 *
 * - idle: Dormant, may show echo message
 * - prompt: Generic text input (read-string)
 * - command: M-x command selection (completing-read)
 * - which-key: Key chord hints display
 * - y-or-n: Yes/no prompt (single keypress)
 * - message: Echo area message display
 */
export const MinibufferMode = Schema.Literal(
  "idle",
  "prompt",
  "command",
  "which-key",
  "y-or-n",
  "message"
)
export type MinibufferMode = typeof MinibufferMode.Type

// ─────────────────────────────────────────────────────────────
// Provider Identity
// ─────────────────────────────────────────────────────────────

/**
 * Completion provider identifier.
 * Branded string for type safety.
 */
export const ProviderId = Schema.String.pipe(
  Schema.brand("ProviderId"),
  Schema.minLength(1)
)
export type ProviderId = typeof ProviderId.Type

/**
 * History key for scoped input history.
 * Different prompts maintain separate histories.
 */
export const HistoryKey = Schema.String.pipe(
  Schema.brand("HistoryKey"),
  Schema.minLength(1)
)
export type HistoryKey = typeof HistoryKey.Type

// ─────────────────────────────────────────────────────────────
// Completion Item
// ─────────────────────────────────────────────────────────────

/**
 * A single completion item returned by a provider.
 */
export const Completion = Schema.Struct({
  /** The actual value (command ID, path, etc.) */
  value: Schema.Unknown,
  /** Display label */
  label: Schema.String,
  /** Optional description/subtitle */
  description: Schema.optional(Schema.String),
  /** Lucide icon name (optional) */
  icon: Schema.optional(Schema.String),
  /** Fuzzy match score (higher = better match) */
  score: Schema.optional(Schema.Number),
  /** Category/group for organizing completions */
  category: Schema.optional(Schema.String),
  /** Keyboard shortcut hint */
  shortcut: Schema.optional(Schema.String),
  /** Whether this item is disabled */
  disabled: Schema.optional(Schema.Boolean),
})
export type Completion = typeof Completion.Type

// ─────────────────────────────────────────────────────────────
// Which-Key Entry
// ─────────────────────────────────────────────────────────────

/**
 * A which-key hint entry showing available key bindings.
 */
export const WhichKeyEntry = Schema.Struct({
  /** The key to press (e.g., "f", "b", "SPC") */
  key: Schema.String,
  /** Description of what the key does */
  description: Schema.String,
  /** Whether this is a prefix key (has sub-bindings) */
  isPrefix: Schema.optional(Schema.Boolean),
  /** Category for grouping */
  category: Schema.optional(Schema.String),
})
export type WhichKeyEntry = typeof WhichKeyEntry.Type

// ─────────────────────────────────────────────────────────────
// Minibuffer State Snapshot
// ─────────────────────────────────────────────────────────────

/**
 * Complete minibuffer state for serialization/debugging.
 */
export const MinibufferState = Schema.Struct({
  mode: MinibufferMode,
  input: Schema.String,
  prompt: Schema.String,
  selectedIndex: Schema.Number,
  completions: Schema.Array(Completion),
  activeProvider: Schema.NullOr(ProviderId),
  whichKeyPrefix: Schema.String,
  whichKeyEntries: Schema.Array(WhichKeyEntry),
  message: Schema.String,
  messageTimestamp: Schema.NullOr(Schema.Number),
})
export type MinibufferState = typeof MinibufferState.Type

// ─────────────────────────────────────────────────────────────
// Drawer Config for Minibuffer
// ─────────────────────────────────────────────────────────────

/**
 * Default minibuffer drawer configuration.
 * Opens from bottom with specific height.
 */
export const MINIBUFFER_DRAWER_DEFAULTS = {
  side: "bottom" as const,
  height: 320,
  showBackdrop: true,
  closeOnOverlayClick: true,
  closeOnEscape: true,
  persistence: "ephemeral" as const,
} as const

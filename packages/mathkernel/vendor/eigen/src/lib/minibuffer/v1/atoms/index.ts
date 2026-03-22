/**
 * Minibuffer Atoms
 *
 * Reactive state for the minibuffer system using effect-atom.
 * Follows the Atom-as-State pattern: atoms are primary state,
 * service methods mutate atoms directly.
 *
 * @module
 */

import { Atom, Registry } from "@effect-atom/atom"
import type { Deferred } from "effect"

// Re-export Atom for consumers that need to set values
export { Atom }

// ─────────────────────────────────────────────────────────────
// Global Registry Singleton
// ─────────────────────────────────────────────────────────────

/**
 * Global registry singleton for minibuffer state mutations.
 * This is shared across all minibuffer operations AND React components.
 *
 * IMPORTANT: Use minibufferRegistry.set() instead of Atom.set()
 * Atom.set() returns an Effect, minibufferRegistry.set() mutates directly.
 */
export const minibufferRegistry = Registry.make()

// Runtime atom and ops are in ./runtime.ts to avoid circular dependency
// Import from '@/lib/minibuffer/atoms/runtime' for minibufferOps
import type {
  MinibufferMode,
  Completion,
  HistoryKey,
  ProviderId,
  WhichKeyEntry,
} from "../schemas/minibuffer"

// ─────────────────────────────────────────────────────────────
// Mode State
// ─────────────────────────────────────────────────────────────

/** Current operational mode */
export const minibufferModeAtom = Atom.make<MinibufferMode>("idle")

// ─────────────────────────────────────────────────────────────
// Input State
// ─────────────────────────────────────────────────────────────

/** Current input text */
export const minibufferInputAtom = Atom.make<string>("")

/** Current prompt text (e.g., "M-x ", "Find file: ") */
export const minibufferPromptAtom = Atom.make<string>("")

/** Selected completion index */
export const minibufferSelectedIndexAtom = Atom.make<number>(0)

// ─────────────────────────────────────────────────────────────
// Completion State
// ─────────────────────────────────────────────────────────────

/** Available completions from active provider */
export const minibufferCompletionsAtom = Atom.make<readonly Completion[]>([])

/** Currently active completion provider */
export const activeProviderAtom = Atom.make<ProviderId | null>(null)

// ─────────────────────────────────────────────────────────────
// Which-Key State
// ─────────────────────────────────────────────────────────────

/** Current key prefix (e.g., "C-x " when waiting for next key) */
export const whichKeyPrefixAtom = Atom.make<string>("")

/** Available bindings for current prefix */
export const whichKeyEntriesAtom = Atom.make<readonly WhichKeyEntry[]>([])

// ─────────────────────────────────────────────────────────────
// History State
// ─────────────────────────────────────────────────────────────

/** Input history keyed by purpose (command history, file history, etc.) */
export const minibufferHistoryAtom = Atom.make<ReadonlyMap<HistoryKey, readonly string[]>>(
  new Map()
)

/** Current history index when navigating with M-p/M-n */
export const historyIndexAtom = Atom.make<number>(-1)

// ─────────────────────────────────────────────────────────────
// Echo Area (Message) State
// ─────────────────────────────────────────────────────────────

/** Current echo message */
export const minibufferMessageAtom = Atom.make<string>("")

/** Message display timestamp (for auto-clear) */
export const minibufferMessageTimestampAtom = Atom.make<number | null>(null)

// ─────────────────────────────────────────────────────────────
// Blocking Resolution (Deferred)
// ─────────────────────────────────────────────────────────────

/**
 * Pending deferred for blocking operations.
 * When a prompt/read is active, this holds the Deferred that will
 * be resolved when the user submits or cancels.
 */
export const pendingDeferredAtom = Atom.make<Deferred.Deferred<string, never> | null>(null)

// ─────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────

/** Whether minibuffer is currently active (not idle) */
export const isMinibufferActiveAtom = Atom.make((get) => {
  const mode = get(minibufferModeAtom)
  return mode !== "idle"
})

/** Filtered completions based on input (if provider doesn't handle filtering) */
export const filteredCompletionsAtom = Atom.make((get) => {
  // For now, return completions as-is (provider handles filtering)
  // Future: implement client-side filtering as fallback
  return get(minibufferCompletionsAtom)
})

/** Currently selected completion */
export const selectedCompletionAtom = Atom.make((get) => {
  const completions = get(filteredCompletionsAtom)
  const index = get(minibufferSelectedIndexAtom)
  return completions[index] ?? null
})

/** Whether there's an active blocking operation */
export const hasPendingOperationAtom = Atom.make((get) => {
  return get(pendingDeferredAtom) !== null
})

// ─────────────────────────────────────────────────────────────
// Actions (Atom Setters)
// ─────────────────────────────────────────────────────────────

/**
 * Reset minibuffer to idle state.
 */
export function resetMinibuffer(): void {
  Atom.set(minibufferModeAtom, "idle")
  Atom.set(minibufferInputAtom, "")
  Atom.set(minibufferPromptAtom, "")
  Atom.set(minibufferSelectedIndexAtom, 0)
  Atom.set(minibufferCompletionsAtom, [])
  Atom.set(activeProviderAtom, null)
  Atom.set(whichKeyPrefixAtom, "")
  Atom.set(whichKeyEntriesAtom, [])
  Atom.set(historyIndexAtom, -1)
  Atom.set(pendingDeferredAtom, null)
}

/**
 * Set echo message with optional auto-clear.
 */
export function setMessage(text: string, timestamp?: number): void {
  Atom.set(minibufferMessageAtom, text)
  Atom.set(minibufferMessageTimestampAtom, timestamp ?? null)
}

/**
 * Clear echo message.
 */
export function clearMessage(): void {
  Atom.set(minibufferMessageAtom, "")
  Atom.set(minibufferMessageTimestampAtom, null)
}

/**
 * Navigate completions up/down.
 */
export function navigateCompletions(direction: "up" | "down"): void {
  const completions = Atom.get(filteredCompletionsAtom)
  const current = Atom.get(minibufferSelectedIndexAtom)

  if (completions.length === 0) return

  let next: number
  if (direction === "down") {
    next = (current + 1) % completions.length
  } else {
    next = current - 1 < 0 ? completions.length - 1 : current - 1
  }

  Atom.set(minibufferSelectedIndexAtom, next)
}

/**
 * Add input to history for given key.
 */
export function addToHistory(key: HistoryKey, value: string): void {
  if (!value.trim()) return

  const history = Atom.get(minibufferHistoryAtom)
  const existing = history.get(key) ?? []

  // Remove duplicate, prepend new value, limit to 100
  const updated = [value, ...existing.filter((h) => h !== value)].slice(0, 100)

  Atom.set(
    minibufferHistoryAtom,
    new Map(history).set(key, updated)
  )
}

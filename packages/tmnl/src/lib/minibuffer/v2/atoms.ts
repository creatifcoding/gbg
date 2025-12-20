/**
 * Minibuffer v2 — Bridge Atoms (Approach C: Hybrid)
 *
 * XState machine is source of truth.
 * Single snapshotAtom bridges to effect-atom.
 * All other atoms are derived selectors.
 *
 * Components use useAtomValue(modeAtom) — consistent with rest of codebase.
 * Effect streams watch resultAtom for command execution.
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"
import { createActor } from "xstate"
import { minibufferMachine } from "./machine"
import type {
  MinibufferSnapshot,
  MinibufferEvent,
  MinibufferContext,
  Completion,
  ProviderId,
  WhichKeyEntry,
} from "./machine"

// ─────────────────────────────────────────────────────────────
// Actor Singleton
// ─────────────────────────────────────────────────────────────

/**
 * The XState actor instance.
 * Created once at module load, started immediately.
 * All state flows through this actor.
 */
const actor = createActor(minibufferMachine)
actor.start()

// ─────────────────────────────────────────────────────────────
// Bridge Atom (Single Subscription Point)
// ─────────────────────────────────────────────────────────────

/**
 * Root snapshot atom — the bridge between XState and effect-atom.
 *
 * This is the ONLY atom that subscribes to the XState actor.
 * All other atoms derive from this, ensuring:
 * - Single subscription (no double-tracking)
 * - Consistent updates (all selectors see same snapshot)
 * - Proper cleanup (finalizer unsubscribes)
 */
export const snapshotAtom: Atom.Atom<MinibufferSnapshot> = Atom.make((get) => {
  const subscription = actor.subscribe((snapshot) => {
    get.setSelf(snapshot)
  })
  get.addFinalizer(() => subscription.unsubscribe())
  return actor.getSnapshot()
})

// ─────────────────────────────────────────────────────────────
// Selector Atoms (Derived, Memoized)
// ─────────────────────────────────────────────────────────────

/** Current mode (state value): "idle" | "prompt" | "command" | "yOrN" | "whichKey" */
export const modeAtom = Atom.make((get) => get(snapshotAtom).value as string)

/** Whether minibuffer is active (not idle) */
export const isActiveAtom = Atom.make((get) => get(snapshotAtom).value !== "idle")

/** Current prompt text (e.g., "M-x ", "Find file: ") */
export const promptAtom = Atom.make((get) => get(snapshotAtom).context.prompt)

/** Current input value */
export const inputAtom = Atom.make((get) => get(snapshotAtom).context.input)

/** Available completions from provider */
export const completionsAtom = Atom.make((get) => get(snapshotAtom).context.completions)

/** Currently selected completion index */
export const selectedIndexAtom = Atom.make((get) => get(snapshotAtom).context.selectedIndex)

/** Active provider ID (for command mode) */
export const providerIdAtom = Atom.make((get) => get(snapshotAtom).context.providerId)

/** Which-key prefix (e.g., "C-x ") */
export const whichKeyPrefixAtom = Atom.make((get) => get(snapshotAtom).context.whichKeyPrefix)

/** Which-key entries for current prefix */
export const whichKeyEntriesAtom = Atom.make((get) => get(snapshotAtom).context.whichKeyEntries)

/** Error state */
export const errorAtom = Atom.make((get) => get(snapshotAtom).context.error)

/**
 * Result of last completed operation.
 *
 * This is the key atom for Effect integration.
 * Effect stream watches this for command execution.
 *
 * Shape: { type: "submitted" | "selected" | "cancelled" | "confirmed" | "denied", value: string, completion?: Completion }
 */
export const resultAtom = Atom.make((get) => get(snapshotAtom).context.result)

// ─────────────────────────────────────────────────────────────
// Derived Atoms (Computed from selectors)
// ─────────────────────────────────────────────────────────────

/** Currently selected completion (derived from completions + selectedIndex) */
export const selectedCompletionAtom = Atom.make((get): Completion | null => {
  const completions = get(completionsAtom)
  const index = get(selectedIndexAtom)
  return completions[index] ?? null
})

/** Full context (for debugging or bulk access) */
export const contextAtom = Atom.make((get): MinibufferContext => get(snapshotAtom).context)

// ─────────────────────────────────────────────────────────────
// Operations (Send Events to Actor)
// ─────────────────────────────────────────────────────────────

/**
 * Send an event to the minibuffer actor.
 * Low-level API — prefer using `ops` for type-safe operations.
 */
export const send = (event: MinibufferEvent): void => {
  actor.send(event)
}

/**
 * Type-safe operation functions.
 *
 * Usage:
 * ```tsx
 * import { ops } from "@/lib/minibuffer/v2/atoms"
 *
 * // In event handler
 * ops.openCommand(COMMAND_PROVIDER_ID)
 * ops.updateInput("toggle")
 * ops.selectNext()
 * ops.submit()
 * ```
 */
export const ops = {
  // ─── Opening Modes ─────────────────────────────────────────

  /** Open prompt mode for text input */
  openPrompt: (prompt: string, defaultValue?: string): void => {
    send({ type: "OPEN_PROMPT", prompt, defaultValue })
  },

  /** Open command mode with completion provider */
  openCommand: (providerId: ProviderId, prompt?: string): void => {
    send({ type: "OPEN_COMMAND", providerId, prompt })
  },

  /** Open yes/no confirmation prompt */
  openYOrN: (prompt: string): void => {
    send({ type: "OPEN_Y_OR_N", prompt })
  },

  /** Open which-key hints for prefix */
  openWhichKey: (prefix: string, entries: readonly WhichKeyEntry[]): void => {
    send({ type: "OPEN_WHICH_KEY", prefix, entries })
  },

  // ─── Input ─────────────────────────────────────────────────

  /** Update input value (triggers completion refresh) */
  updateInput: (value: string): void => {
    send({ type: "INPUT_CHANGE", value })
  },

  /** Load completions from provider */
  loadCompletions: (completions: readonly Completion[]): void => {
    send({ type: "COMPLETIONS_LOADED", completions })
  },

  // ─── Navigation ────────────────────────────────────────────

  /** Select next completion (wraps around) */
  selectNext: (): void => {
    send({ type: "SELECT_NEXT" })
  },

  /** Select previous completion (wraps around) */
  selectPrev: (): void => {
    send({ type: "SELECT_PREV" })
  },

  /** Select completion at specific index */
  selectIndex: (index: number): void => {
    send({ type: "SELECT_INDEX", index })
  },

  // ─── Resolution ────────────────────────────────────────────

  /** Submit current input (prompt mode) or selected completion (command mode) */
  submit: (): void => {
    send({ type: "SUBMIT" })
  },

  /** Select a specific completion and close */
  selectCompletion: (completion: Completion): void => {
    send({ type: "SELECT_COMPLETION", completion })
  },

  /** Cancel operation and close */
  cancel: (): void => {
    send({ type: "CANCEL" })
  },

  /** Confirm yes/no prompt (y) */
  confirm: (): void => {
    send({ type: "CONFIRM" })
  },

  /** Deny yes/no prompt (n) */
  deny: (): void => {
    send({ type: "DENY" })
  },

  /** Select which-key entry */
  whichKeySelect: (key: string): void => {
    send({ type: "WHICH_KEY_SELECT", key })
  },

  // ─── Lifecycle ─────────────────────────────────────────────

  /** Clear result after consumption (Effect stream should call this) */
  clearResult: (): void => {
    send({ type: "CLEAR_RESULT" })
  },
} as const

// ─────────────────────────────────────────────────────────────
// Actor Access (Advanced)
// ─────────────────────────────────────────────────────────────

/**
 * Get the raw XState actor reference.
 *
 * For advanced use cases only. Prefer using:
 * - Selector atoms for reading state
 * - `ops` for sending events
 *
 * Use cases:
 * - Setting up Effect streams with actor.subscribe()
 * - Integration with external systems
 */
export const getActor = () => actor

/**
 * Get current snapshot synchronously.
 * Prefer using selector atoms for reactive updates.
 */
export const getSnapshot = () => actor.getSnapshot()

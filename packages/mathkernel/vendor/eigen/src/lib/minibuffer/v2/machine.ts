/**
 * Minibuffer v2 — XState Machine
 *
 * Event-driven minibuffer using XState v5.
 * No fiber suspension, no Deferred. React sends events, Effect reacts to completion.
 *
 * @module
 */

import { setup, assign, fromPromise } from "xstate"
import type { ActorRefFrom, SnapshotFrom } from "xstate"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Completion item from a provider */
export interface Completion {
  readonly value: string
  readonly label: string
  readonly description?: string
  readonly category?: string
  readonly score?: number
}

/** Provider ID for completion sources */
export type ProviderId = string & { readonly _brand: unique symbol }

/** Minibuffer operational modes (mapped to XState states) */
export type MinibufferMode = "idle" | "prompt" | "command" | "yOrN" | "whichKey"

/** Which-key entry for prefix hints */
export interface WhichKeyEntry {
  readonly key: string
  readonly label: string
  readonly isPrefix: boolean
}

/** Result of a minibuffer operation */
export type MinibufferResult = {
  type: "submitted" | "selected" | "cancelled" | "confirmed" | "denied"
  value: string
  completion?: Completion
} | null

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

export interface MinibufferContext {
  /** Current prompt text (e.g., "M-x ", "Find file: ") */
  prompt: string

  /** Current input value */
  input: string

  /** Available completions */
  completions: readonly Completion[]

  /** Currently selected completion index */
  selectedIndex: number

  /** Active provider ID (for command/completion modes) */
  providerId: ProviderId | null

  /** Which-key prefix (for which-key mode) */
  whichKeyPrefix: string

  /** Which-key entries */
  whichKeyEntries: readonly WhichKeyEntry[]

  /**
   * Result of the last completed operation.
   * Set when user submits/selects, cleared on next open.
   * Effect stream watches this for execution.
   */
  result: MinibufferResult

  /** Error from async operations */
  error: string | null
}

const initialContext: MinibufferContext = {
  prompt: "",
  input: "",
  completions: [],
  selectedIndex: 0,
  providerId: null,
  whichKeyPrefix: "",
  whichKeyEntries: [],
  result: null,
  error: null,
}

// ─────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────

export type MinibufferEvent =
  // Opening modes
  | { type: "OPEN_PROMPT"; prompt: string; defaultValue?: string }
  | { type: "OPEN_COMMAND"; providerId: ProviderId; prompt?: string }
  | { type: "OPEN_Y_OR_N"; prompt: string }
  | { type: "OPEN_WHICH_KEY"; prefix: string; entries: readonly WhichKeyEntry[] }

  // Input changes
  | { type: "INPUT_CHANGE"; value: string }
  | { type: "COMPLETIONS_LOADED"; completions: readonly Completion[] }

  // Navigation
  | { type: "SELECT_NEXT" }
  | { type: "SELECT_PREV" }
  | { type: "SELECT_INDEX"; index: number }

  // Resolution
  | { type: "SUBMIT" }
  | { type: "SELECT_COMPLETION"; completion: Completion }
  | { type: "CONFIRM" } // y-or-n: yes
  | { type: "DENY" } // y-or-n: no
  | { type: "CANCEL" }

  // Which-key
  | { type: "WHICH_KEY_SELECT"; key: string }

  // Reset (after result consumed)
  | { type: "CLEAR_RESULT" }

// ─────────────────────────────────────────────────────────────
// Machine Definition
// ─────────────────────────────────────────────────────────────

export const minibufferMachine = setup({
  types: {} as {
    context: MinibufferContext
    events: MinibufferEvent
  },
  actions: {
    clearResult: assign({ result: null }),
    clearError: assign({ error: null }),
    resetToInitial: assign(initialContext),

    setPromptContext: assign(({ event }) => {
      if (event.type !== "OPEN_PROMPT") return {}
      return {
        prompt: event.prompt,
        input: event.defaultValue ?? "",
        completions: [],
        selectedIndex: 0,
        result: null,
        error: null,
      }
    }),

    setCommandContext: assign(({ event }) => {
      if (event.type !== "OPEN_COMMAND") return {}
      return {
        prompt: event.prompt ?? "M-x ",
        input: "",
        completions: [],
        selectedIndex: 0,
        providerId: event.providerId,
        result: null,
        error: null,
      }
    }),

    setYOrNContext: assign(({ event }) => {
      if (event.type !== "OPEN_Y_OR_N") return {}
      return {
        prompt: `${event.prompt} (y or n) `,
        input: "",
        result: null,
        error: null,
      }
    }),

    setWhichKeyContext: assign(({ event }) => {
      if (event.type !== "OPEN_WHICH_KEY") return {}
      return {
        whichKeyPrefix: event.prefix,
        whichKeyEntries: event.entries,
        result: null,
        error: null,
      }
    }),

    updateInput: assign(({ event }) => {
      if (event.type !== "INPUT_CHANGE") return {}
      return { input: event.value, selectedIndex: 0 }
    }),

    updateCompletions: assign(({ event }) => {
      if (event.type !== "COMPLETIONS_LOADED") return {}
      return { completions: event.completions, selectedIndex: 0 }
    }),

    selectNext: assign(({ context }) => ({
      selectedIndex:
        context.completions.length === 0
          ? 0
          : (context.selectedIndex + 1) % context.completions.length,
    })),

    selectPrev: assign(({ context }) => ({
      selectedIndex:
        context.completions.length === 0
          ? 0
          : context.selectedIndex === 0
            ? context.completions.length - 1
            : context.selectedIndex - 1,
    })),

    selectIndex: assign(({ event, context }) => {
      if (event.type !== "SELECT_INDEX") return {}
      const index = Math.max(0, Math.min(event.index, context.completions.length - 1))
      return { selectedIndex: index }
    }),

    setSubmitResult: assign(({ context }) => ({
      result: {
        type: "submitted" as const,
        value: context.input,
      },
    })),

    setSelectResult: assign(({ event }) => {
      if (event.type !== "SELECT_COMPLETION") return {}
      return {
        result: {
          type: "selected" as const,
          value: typeof event.completion.value === "string"
            ? event.completion.value
            : String(event.completion.value),
          completion: event.completion,
        },
      }
    }),

    setCancelResult: assign({
      result: { type: "cancelled" as const, value: "" },
    }),

    setConfirmResult: assign({
      result: { type: "confirmed" as const, value: "y" },
    }),

    setDenyResult: assign({
      result: { type: "denied" as const, value: "n" },
    }),
  },
}).createMachine({
  id: "minibuffer",
  initial: "idle",
  context: initialContext,

  states: {
    idle: {
      on: {
        OPEN_PROMPT: {
          target: "prompt",
          actions: "setPromptContext",
        },
        OPEN_COMMAND: {
          target: "command",
          actions: "setCommandContext",
        },
        OPEN_Y_OR_N: {
          target: "yOrN",
          actions: "setYOrNContext",
        },
        OPEN_WHICH_KEY: {
          target: "whichKey",
          actions: "setWhichKeyContext",
        },
        CLEAR_RESULT: {
          actions: "clearResult",
        },
      },
    },

    prompt: {
      on: {
        INPUT_CHANGE: {
          actions: "updateInput",
        },
        SUBMIT: {
          target: "idle",
          actions: "setSubmitResult",
        },
        CANCEL: {
          target: "idle",
          actions: "setCancelResult",
        },
      },
    },

    command: {
      on: {
        INPUT_CHANGE: {
          actions: "updateInput",
        },
        COMPLETIONS_LOADED: {
          actions: "updateCompletions",
        },
        SELECT_NEXT: {
          actions: "selectNext",
        },
        SELECT_PREV: {
          actions: "selectPrev",
        },
        SELECT_INDEX: {
          actions: "selectIndex",
        },
        SELECT_COMPLETION: {
          target: "idle",
          actions: "setSelectResult",
        },
        SUBMIT: {
          // Submit with currently selected completion
          target: "idle",
          actions: assign(({ context }) => {
            const completion = context.completions[context.selectedIndex]
            if (!completion) {
              return { result: { type: "cancelled" as const, value: "" } }
            }
            return {
              result: {
                type: "selected" as const,
                value: typeof completion.value === "string"
                  ? completion.value
                  : String(completion.value),
                completion,
              },
            }
          }),
        },
        CANCEL: {
          target: "idle",
          actions: "setCancelResult",
        },
      },
    },

    yOrN: {
      on: {
        CONFIRM: {
          target: "idle",
          actions: "setConfirmResult",
        },
        DENY: {
          target: "idle",
          actions: "setDenyResult",
        },
        CANCEL: {
          target: "idle",
          actions: "setCancelResult",
        },
      },
    },

    whichKey: {
      on: {
        WHICH_KEY_SELECT: {
          target: "idle",
          actions: assign(({ event }) => {
            if (event.type !== "WHICH_KEY_SELECT") return {}
            return {
              result: {
                type: "selected" as const,
                value: event.key,
              },
            }
          }),
        },
        CANCEL: {
          target: "idle",
          actions: "setCancelResult",
        },
      },
    },
  },
})

// ─────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────

export type MinibufferMachine = typeof minibufferMachine
export type MinibufferActor = ActorRefFrom<MinibufferMachine>
export type MinibufferSnapshot = SnapshotFrom<MinibufferMachine>

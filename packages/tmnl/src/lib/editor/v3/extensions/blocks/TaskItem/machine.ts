/**
 * TaskCheckbox Animation Machine
 *
 * XState v5 machine for checkbox interaction states.
 * Manages hover, focus, toggle, and sheen animation triggers.
 *
 * Scene frames (ASCII):
 * ┌────────────────────────────────────────────────────────────┐
 * │  IDLE → HOVERING → (sheen sweep) → TOGGLING → CHECKED     │
 * │    ↑       ↓                            ↓                  │
 * │  LEAVE  TOGGLE                       sparkle               │
 * └────────────────────────────────────────────────────────────┘
 *
 * @module editor/v3/extensions/blocks/TaskItem/machine
 */

import { setup, assign } from 'xstate';

// =============================================================================
// Types
// =============================================================================

export interface TaskCheckboxContext {
  /** Current checked state */
  checked: boolean;
  /** Sheen animation progress (0-1) */
  sheenProgress: number;
  /** Whether sheen is currently animating */
  sheenActive: boolean;
  /** Sparkle burst active */
  sparkleActive: boolean;
}

export type TaskCheckboxEvent =
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'TOGGLE' }
  | { type: 'SHEEN_START' }
  | { type: 'SHEEN_END' }
  | { type: 'SPARKLE_END' }
  | { type: 'SET_CHECKED'; checked: boolean };

// =============================================================================
// Machine
// =============================================================================

export const taskCheckboxMachine = setup({
  types: {
    context: {} as TaskCheckboxContext,
    events: {} as TaskCheckboxEvent,
  },
  actions: {
    startSheen: assign({
      sheenActive: true,
      sheenProgress: 0,
    }),
    endSheen: assign({
      sheenActive: false,
      sheenProgress: 1,
    }),
    toggleChecked: assign({
      checked: ({ context }) => !context.checked,
      sparkleActive: true,
    }),
    endSparkle: assign({
      sparkleActive: false,
    }),
    setChecked: assign({
      checked: (_, event: { checked: boolean }) => event.checked,
    }),
  },
  guards: {
    isChecked: ({ context }) => context.checked,
    isUnchecked: ({ context }) => !context.checked,
  },
}).createMachine({
  id: 'taskCheckbox',
  initial: 'idle',
  context: {
    checked: false,
    sheenProgress: 0,
    sheenActive: false,
    sparkleActive: false,
  },

  states: {
    idle: {
      on: {
        HOVER: {
          target: 'hovering',
          actions: 'startSheen',
        },
        FOCUS: {
          target: 'focused',
          actions: 'startSheen',
        },
        TOGGLE: {
          target: 'toggling',
          actions: 'toggleChecked',
        },
        SET_CHECKED: {
          actions: assign({
            checked: ({ event }) => event.checked,
          }),
        },
      },
    },

    hovering: {
      on: {
        LEAVE: {
          target: 'idle',
          actions: 'endSheen',
        },
        TOGGLE: {
          target: 'toggling',
          actions: 'toggleChecked',
        },
        SHEEN_END: {
          actions: 'endSheen',
        },
        SET_CHECKED: {
          actions: assign({
            checked: ({ event }) => event.checked,
          }),
        },
      },
    },

    focused: {
      on: {
        BLUR: {
          target: 'idle',
          actions: 'endSheen',
        },
        TOGGLE: {
          target: 'toggling',
          actions: 'toggleChecked',
        },
        SHEEN_END: {
          actions: 'endSheen',
        },
        SET_CHECKED: {
          actions: assign({
            checked: ({ event }) => event.checked,
          }),
        },
      },
    },

    toggling: {
      on: {
        SPARKLE_END: [
          {
            target: 'checked',
            guard: 'isChecked',
          },
          {
            target: 'idle',
            guard: 'isUnchecked',
            actions: 'endSparkle',
          },
        ],
        HOVER: {
          // Allow hover while toggling
        },
        LEAVE: {
          // Allow leave while toggling
        },
        SET_CHECKED: {
          actions: assign({
            checked: ({ event }) => event.checked,
          }),
        },
      },
      after: {
        // Auto-transition after sparkle duration (400ms)
        400: [
          {
            target: 'checked',
            guard: 'isChecked',
            actions: 'endSparkle',
          },
          {
            target: 'idle',
            guard: 'isUnchecked',
            actions: 'endSparkle',
          },
        ],
      },
    },

    checked: {
      on: {
        TOGGLE: {
          target: 'toggling',
          actions: 'toggleChecked',
        },
        HOVER: {
          actions: 'startSheen',
        },
        LEAVE: {
          actions: 'endSheen',
        },
        SET_CHECKED: {
          actions: assign({
            checked: ({ event }) => event.checked,
          }),
        },
      },
    },
  },
});

export type TaskCheckboxMachine = typeof taskCheckboxMachine;

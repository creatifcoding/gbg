/**
 * Save State Machine
 *
 * XState machine for save-to-disk operations.
 *
 * @module editor/v3/machines/saveMachine
 */

import { setup, assign } from 'xstate';
import {
  type SaveState,
  type SaveError,
  type SaveMachineContext,
  type SaveMachineEvent,
  defaultSaveMachineContext,
} from '../schemas/save';

// Re-export types
export type { SaveState, SaveError, SaveMachineContext, SaveMachineEvent };
export { defaultSaveMachineContext };

// =============================================================================
// Machine Definition
// =============================================================================

export const saveMachine = setup({
  types: {
    context: {} as SaveMachineContext,
    events: {} as SaveMachineEvent,
  },
  actions: {
    setSaveParams: assign({
      path: ({ event }) => {
        if (event.type === 'SAVE') return event.path;
        return null;
      },
      content: ({ event }) => {
        if (event.type === 'SAVE') return event.content;
        return null;
      },
    }),
    setSaveSuccess: assign({
      lastSavedAt: () => new Date(),
      error: () => null,
      isDirty: () => false,
    }),
    setSaveError: assign({
      error: ({ event, context }) => {
        if (event.type === 'SAVE_ERROR') return event.error;
        return context.error;
      },
    }),
    clearError: assign({
      error: () => null,
    }),
    markDirty: assign({
      isDirty: () => true,
    }),
    clearDirty: assign({
      isDirty: () => false,
    }),
    setPath: assign({
      path: ({ event }) => {
        if (event.type === 'SET_PATH') return event.path;
        return null;
      },
    }),
    resetContext: assign({
      error: () => null,
      content: () => null,
    }),
  },
  guards: {
    hasPath: ({ context }) => context.path !== null,
    hasContent: ({ context }) => context.content !== null,
    canSave: ({ context }) => context.path !== null && context.isDirty,
  },
  delays: {
    savedDisplayDelay: ({ context }) => context.savedDisplayDuration,
  },
}).createMachine({
  id: 'save',
  initial: 'idle',
  context: defaultSaveMachineContext,
  on: {
    // Global events that can happen in any state
    MARK_DIRTY: {
      actions: 'markDirty',
    },
    SET_PATH: {
      actions: 'setPath',
    },
  },
  states: {
    idle: {
      on: {
        SAVE: {
          target: 'saving',
          actions: 'setSaveParams',
        },
      },
    },
    saving: {
      on: {
        SAVE_SUCCESS: {
          target: 'saved',
          actions: 'setSaveSuccess',
        },
        SAVE_ERROR: {
          target: 'error',
          actions: 'setSaveError',
        },
      },
    },
    saved: {
      after: {
        // Auto-transition back to idle after display duration
        savedDisplayDelay: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
      on: {
        SAVE: {
          target: 'saving',
          actions: 'setSaveParams',
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: 'saving',
          guard: 'hasContent',
        },
        RESET: {
          target: 'idle',
          actions: ['clearError', 'resetContext'],
        },
        SAVE: {
          target: 'saving',
          actions: 'setSaveParams',
        },
      },
    },
  },
});

// =============================================================================
// Helper Types
// =============================================================================

export type SaveMachine = typeof saveMachine;
export type SaveMachineSnapshot = ReturnType<typeof saveMachine.transition>;

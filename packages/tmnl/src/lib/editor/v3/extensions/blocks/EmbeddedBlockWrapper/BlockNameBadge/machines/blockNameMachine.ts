/**
 * Block Name Badge State Machine
 *
 * XState machine for block rename operations.
 * States: display → editing → submitting → success | error
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/machines
 */

import { setup, assign } from 'xstate';
import type { BlockId } from '../../shared';

// =============================================================================
// Types
// =============================================================================

export interface BlockNameMachineContext {
  blockId: BlockId;
  currentName: string | null;
  inputValue: string;
  error: string | null;
  onRename: ((name: string) => Promise<void>) | undefined;
}

export type BlockNameMachineEvent =
  | { type: 'EDIT' }
  | { type: 'CANCEL' }
  | { type: 'SUBMIT' }
  | { type: 'INPUT_CHANGE'; value: string }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'SET_NAME'; name: string | null }
  | {
      type: 'SET_ON_RENAME';
      handler: ((name: string) => Promise<void>) | undefined;
    };

export const defaultBlockNameMachineContext: Omit<
  BlockNameMachineContext,
  'blockId'
> = {
  currentName: null,
  inputValue: '',
  error: null,
  onRename: undefined,
};

// =============================================================================
// Machine Definition
// =============================================================================

export const blockNameMachine = setup({
  types: {
    context: {} as BlockNameMachineContext,
    events: {} as BlockNameMachineEvent,
  },
  actions: {
    prepareEdit: assign({
      inputValue: ({ context }) => context.currentName || '',
      error: () => null,
    }),
    updateInput: assign({
      inputValue: ({ event }: { event: BlockNameMachineEvent }) => {
        if (event.type === 'INPUT_CHANGE') return event.value;
        return '';
      },
      error: () => null,
    }),
    clearInput: assign({
      inputValue: () => '',
      error: () => null,
    }),
    setError: assign({
      error: ({ event }) => {
        if (event.type === 'ERROR') return event.error;
        return 'Unknown error';
      },
    }),
    clearError: assign({
      error: () => null,
    }),
    updateName: assign({
      currentName: ({ event }) => {
        if (event.type === 'SET_NAME') return event.name;
        return null;
      },
    }),
    updateOnRename: assign({
      onRename: ({ event }: { event: BlockNameMachineEvent }) => {
        if (event.type === 'SET_ON_RENAME') return event.handler;
        return undefined;
      },
    }),
  },
  guards: {
    canEdit: ({ context }) => context.onRename !== undefined,
    hasValidInput: ({ context }) => context.inputValue.trim().length > 0,
    nameChanged: ({ context }) =>
      context.inputValue.trim() !== (context.currentName || ''),
    noChange: ({ context }) =>
      context.inputValue.trim() === (context.currentName || ''),
    isEmpty: ({ context }) => context.inputValue.trim().length === 0,
  },
  delays: {
    successDisplayDuration: 500,
  },
}).createMachine({
  id: 'blockName',
  initial: 'display',
  context: ({ input }) => input as BlockNameMachineContext,
  on: {
    // Global events
    SET_NAME: {
      actions: 'updateName',
    },
    SET_ON_RENAME: {
      actions: 'updateOnRename',
    },
  },
  states: {
    display: {
      on: {
        EDIT: {
          target: 'editing',
          guard: 'canEdit',
          actions: 'prepareEdit',
        },
      },
    },
    editing: {
      on: {
        INPUT_CHANGE: {
          actions: 'updateInput',
        },
        CANCEL: {
          target: 'display',
          actions: 'clearInput',
        },
        SUBMIT: [
          {
            target: 'display',
            guard: 'isEmpty',
            actions: 'clearInput',
          },
          {
            target: 'display',
            guard: 'noChange',
            actions: 'clearInput',
          },
          {
            target: 'submitting',
            guard: 'hasValidInput',
          },
        ],
      },
    },
    submitting: {
      on: {
        SUCCESS: {
          target: 'success',
          actions: 'clearError',
        },
        ERROR: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    success: {
      after: {
        successDisplayDuration: {
          target: 'display',
          actions: 'clearInput',
        },
      },
      on: {
        EDIT: {
          target: 'editing',
          guard: 'canEdit',
          actions: 'prepareEdit',
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: 'submitting',
          guard: 'hasValidInput',
        },
        CANCEL: {
          target: 'display',
          actions: ['clearError', 'clearInput'],
        },
        EDIT: {
          target: 'editing',
          actions: ['clearError', 'prepareEdit'],
        },
      },
    },
  },
});

// =============================================================================
// Helper Types
// =============================================================================

export type BlockNameMachine = typeof blockNameMachine;
export type BlockNameMachineSnapshot = ReturnType<
  typeof blockNameMachine.transition
>;

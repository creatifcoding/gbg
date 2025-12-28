/**
 * Block Name Badge State Machine
 *
 * XState machine for block rename operations with live debounced validation.
 *
 * Architecture:
 * - Error is CONTEXT, not state — user stays in editing while errors show
 * - Debounced validation via cancel/send with delay
 * - Submission errors return to editing, not terminal state
 *
 * States: display → editing ←→ validating → submitting → success
 *                     ↑______________|  (errors shown via context)
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/machines
 */

import { setup, assign, fromPromise, sendTo, raise } from 'xstate';
import type { BlockId } from '../../shared';

// =============================================================================
// Types
// =============================================================================

export interface BlockNameMachineContext {
  blockId: BlockId;
  currentName: string | null;
  inputValue: string;
  /** Validation error shown during editing (live feedback) */
  validationError: string | null;
  /** Submission error shown after failed rename attempt */
  submissionError: string | null;
  /** Callback to validate name (optional, for server-side validation) */
  onValidate: ((name: string) => Promise<string | null>) | undefined;
  /** Callback to perform rename */
  onRename: ((name: string) => Promise<void>) | undefined;
}

export type BlockNameMachineEvent =
  | { type: 'EDIT' }
  | { type: 'CANCEL' }
  | { type: 'SUBMIT' }
  | { type: 'INPUT_CHANGE'; value: string }
  | { type: 'VALIDATE' }
  | { type: 'SET_NAME'; name: string | null }
  | {
      type: 'SET_ON_RENAME';
      handler: ((name: string) => Promise<void>) | undefined;
    }
  | {
      type: 'SET_ON_VALIDATE';
      handler: ((name: string) => Promise<string | null>) | undefined;
    };

export const defaultBlockNameMachineContext: Omit<
  BlockNameMachineContext,
  'blockId'
> = {
  currentName: null,
  inputValue: '',
  validationError: null,
  submissionError: null,
  onValidate: undefined,
  onRename: undefined,
};

// =============================================================================
// Validation Logic
// =============================================================================

/**
 * Client-side validation rules.
 * Returns error message or null if valid.
 */
const validateNameSync = (name: string): string | null => {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return null; // Empty is allowed (will be "untitled")
  }

  if (trimmed.length > 100) {
    return 'Name too long (max 100 characters)';
  }

  // Allow alphanumeric, hyphens, underscores, spaces
  if (!/^[\w\s-]+$/.test(trimmed)) {
    return 'Invalid characters (use letters, numbers, hyphens, underscores)';
  }

  return null;
};

// =============================================================================
// Actors (Invoked Services)
// =============================================================================

const validateNameActor = fromPromise<
  string | null,
  { name: string; onValidate?: (name: string) => Promise<string | null> }
>(async ({ input }) => {
  const { name, onValidate } = input;

  // Run client-side validation first
  const clientError = validateNameSync(name);
  if (clientError) {
    return clientError;
  }

  // Run server-side validation if provided
  if (onValidate) {
    const serverError = await onValidate(name);
    if (serverError) {
      return serverError;
    }
  }

  return null; // Valid
});

const submitRenameActor = fromPromise<
  void,
  { name: string; onRename: (name: string) => Promise<void> }
>(async ({ input }) => {
  const { name, onRename } = input;
  await onRename(name);
});

// =============================================================================
// Machine Definition
// =============================================================================

export const blockNameMachine = setup({
  types: {
    context: {} as BlockNameMachineContext,
    events: {} as BlockNameMachineEvent,
  },
  actors: {
    validateName: validateNameActor,
    submitRename: submitRenameActor,
  },
  actions: {
    prepareEdit: assign({
      inputValue: ({ context }) => context.currentName || '',
      validationError: () => null,
      submissionError: () => null,
    }),
    updateInput: assign({
      inputValue: ({ event }) => {
        if (event.type === 'INPUT_CHANGE') return event.value;
        return '';
      },
      // Clear submission error when user starts typing again
      submissionError: () => null,
    }),
    clearInput: assign({
      inputValue: () => '',
      validationError: () => null,
      submissionError: () => null,
    }),
    setValidationError: assign({
      validationError: (_, params: { error: string | null }) => params.error,
    }),
    clearValidationError: assign({
      validationError: () => null,
    }),
    setSubmissionError: assign({
      submissionError: (_, params: { error: string }) => params.error,
    }),
    clearSubmissionError: assign({
      submissionError: () => null,
    }),
    updateName: assign({
      currentName: ({ context, event }) => {
        if (event.type === 'SET_NAME') return event.name;
        // On successful submit, update currentName to inputValue
        return context.inputValue.trim() || null;
      },
    }),
    updateOnRename: assign({
      onRename: ({ event }) => {
        if (event.type === 'SET_ON_RENAME') return event.handler;
        return undefined;
      },
    }),
    updateOnValidate: assign({
      onValidate: ({ event }) => {
        if (event.type === 'SET_ON_VALIDATE') return event.handler;
        return undefined;
      },
    }),
  },
  guards: {
    canEdit: ({ context }) => context.onRename !== undefined,
    hasValidInput: ({ context }) => context.inputValue.trim().length > 0,
    noValidationError: ({ context }) => context.validationError === null,
    nameChanged: ({ context }) =>
      context.inputValue.trim() !== (context.currentName || ''),
    noChange: ({ context }) =>
      context.inputValue.trim() === (context.currentName || ''),
    isEmpty: ({ context }) => context.inputValue.trim().length === 0,
    canSubmit: ({ context }) =>
      context.validationError === null &&
      context.inputValue.trim().length > 0 &&
      context.inputValue.trim() !== (context.currentName || ''),
  },
  delays: {
    validationDebounce: 300,
    successDisplayDuration: 500,
  },
}).createMachine({
  id: 'blockName',
  initial: 'display',
  context: ({ input }) => input as BlockNameMachineContext,
  on: {
    // Global events (always handled)
    SET_NAME: {
      actions: 'updateName',
    },
    SET_ON_RENAME: {
      actions: 'updateOnRename',
    },
    SET_ON_VALIDATE: {
      actions: 'updateOnValidate',
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
      id: 'editing',
      on: {
        INPUT_CHANGE: {
          target: 'editing.debouncing',
          actions: 'updateInput',
        },
        CANCEL: {
          target: 'display',
          actions: 'clearInput',
        },
        SUBMIT: [
          // Empty or unchanged → just go back to display
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
          // Has validation error → stay in editing
          {
            target: 'editing',
            guard: ({ context }) => context.validationError !== null,
          },
          // Valid input → submit
          {
            target: 'submitting',
            guard: 'canSubmit',
          },
        ],
      },
      initial: 'idle',
      states: {
        idle: {
          // Just waiting for input or submit
        },
        debouncing: {
          // Wait for user to stop typing before validating
          after: {
            validationDebounce: 'validating',
          },
          on: {
            // New input restarts the debounce (handled by parent's INPUT_CHANGE → debouncing)
          },
        },
        validating: {
          invoke: {
            id: 'validateName',
            src: 'validateName',
            input: ({ context }) => ({
              name: context.inputValue,
              onValidate: context.onValidate,
            }),
            onDone: {
              target: 'idle',
              actions: [
                {
                  type: 'setValidationError',
                  params: ({ event }) => ({ error: event.output }),
                },
              ],
            },
            onError: {
              target: 'idle',
              actions: [
                {
                  type: 'setValidationError',
                  params: ({ event }) => ({
                    error:
                      event.error instanceof Error
                        ? event.error.message
                        : 'Validation failed',
                  }),
                },
              ],
            },
          },
        },
      },
    },

    submitting: {
      invoke: {
        id: 'submitRename',
        src: 'submitRename',
        input: ({ context }) => ({
          name: context.inputValue.trim(),
          onRename: context.onRename!,
        }),
        onDone: {
          target: 'success',
          actions: ['updateName', 'clearValidationError', 'clearSubmissionError'],
        },
        onError: {
          // Return to editing with submission error
          target: 'editing.idle',
          actions: [
            {
              type: 'setSubmissionError',
              params: ({ event }) => ({
                error:
                  event.error instanceof Error
                    ? event.error.message
                    : 'Rename failed',
              }),
            },
          ],
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
        // Allow immediate re-edit from success state
        EDIT: {
          target: 'editing',
          guard: 'canEdit',
          actions: 'prepareEdit',
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

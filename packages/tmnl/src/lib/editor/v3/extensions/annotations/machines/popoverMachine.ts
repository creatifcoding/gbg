/**
 * Annotation Popover Machine (XState v5)
 *
 * Canonical lifecycle contract for annotation popovers.
 * This machine models the behavioral truth for open/close/pin/edit states.
 *
 * Integration notes:
 * - Drive this machine through stx controller boundary.
 * - Keep `popoverOps` as mutation bridge to existing annotation atom/service surfaces.
 *
 * @module editor/v3/extensions/annotations/machines/popoverMachine
 */

import { assign, setup } from 'xstate';

import type { AnnotationId, IntentPayload } from '../schemas';
import type { PopoverAnchor, PopoverPlacement, PopoverTrigger } from '../services';

// =============================================================================
// Types
// =============================================================================

export type PopoverCloseReason =
  | 'manual'
  | 'outside'
  | 'escape'
  | 'selection-change'
  | 'save'
  | 'cancel'
  | 'blur'
  | 'invalid-anchor'
  | 'replaced';

export interface PopoverIntentData {
  readonly intentType: string;
  readonly intent: IntentPayload;
  readonly visualType?: string;
  readonly tags?: readonly string[];
}

export interface PopoverOpenPayload {
  readonly annotationId: AnnotationId;
  readonly markId: AnnotationId;
  readonly anchor: PopoverAnchor;
  readonly placement?: PopoverPlacement;
  readonly trigger: PopoverTrigger;
  readonly intentType?: string;
  readonly initialNoteText?: string;
  readonly intentData?: PopoverIntentData;
}

export interface PopoverMachineContext {
  readonly annotationId: AnnotationId | null;
  readonly markId: AnnotationId | null;
  readonly anchor: PopoverAnchor | null;
  readonly placement: PopoverPlacement;
  readonly trigger: PopoverTrigger;
  readonly intentType: string | null;
  readonly intentData: PopoverIntentData | null;
  readonly isPinned: boolean;
  readonly closeReason: PopoverCloseReason | null;
  readonly noteDraft: string | null;
  readonly noteOriginal: string | null;
}

export type PopoverMachineEvent =
  | ({ type: 'OPEN_HOVER' } & PopoverOpenPayload)
  | ({ type: 'OPEN_CLICK' } & PopoverOpenPayload)
  | ({ type: 'OPEN_MANUAL' } & PopoverOpenPayload)
  | { type: 'PIN' }
  | { type: 'UNPIN' }
  | { type: 'START_EDIT' }
  | { type: 'UPDATE_DRAFT'; value: string }
  | { type: 'SAVE_EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'ANCHOR_UPDATED'; anchor: PopoverAnchor }
  | { type: 'SELECTION_INVALIDATED' }
  | { type: 'ESCAPE' }
  | { type: 'OUTSIDE_CLICK' }
  | { type: 'CLOSE'; reason?: PopoverCloseReason }
  | { type: 'CONTENT_SYNCED'; noteText: string | null };

const DEFAULT_PLACEMENT: PopoverPlacement = 'top';

const defaultContext: PopoverMachineContext = {
  annotationId: null,
  markId: null,
  anchor: null,
  placement: DEFAULT_PLACEMENT,
  trigger: 'manual',
  intentType: null,
  intentData: null,
  isPinned: false,
  closeReason: null,
  noteDraft: null,
  noteOriginal: null,
};

const isOpenEvent = (
  event: PopoverMachineEvent
): event is Extract<PopoverMachineEvent, { type: 'OPEN_HOVER' | 'OPEN_CLICK' | 'OPEN_MANUAL' }> =>
  event.type === 'OPEN_HOVER' || event.type === 'OPEN_CLICK' || event.type === 'OPEN_MANUAL';

// =============================================================================
// Machine
// =============================================================================

export const popoverMachine = setup({
  types: {
    context: {} as PopoverMachineContext,
    events: {} as PopoverMachineEvent,
  },
  actions: {
    setOpenFromEvent: assign(({ event }) => {
      if (!isOpenEvent(event)) {
        return {};
      }

      return {
        annotationId: event.annotationId,
        markId: event.markId,
        anchor: event.anchor,
        placement: event.placement ?? DEFAULT_PLACEMENT,
        trigger: event.trigger,
        intentType: event.intentType ?? null,
        intentData: event.intentData ?? null,
        isPinned: event.type === 'OPEN_CLICK' || event.type === 'OPEN_MANUAL',
        closeReason: null,
        noteOriginal: event.initialNoteText ?? null,
        noteDraft: event.initialNoteText ?? null,
      };
    }),

    setPinned: assign({
      isPinned: () => true,
    }),

    setUnpinned: assign({
      isPinned: () => false,
    }),

    updateAnchor: assign(({ event, context }) => {
      if (event.type !== 'ANCHOR_UPDATED') {
        return { anchor: context.anchor };
      }

      return { anchor: event.anchor };
    }),

    startEditDraft: assign(({ context }) => ({
      noteDraft: context.noteDraft ?? context.noteOriginal ?? '',
    })),

    updateDraftValue: assign(({ event, context }) => {
      if (event.type !== 'UPDATE_DRAFT') {
        return { noteDraft: context.noteDraft };
      }

      return { noteDraft: event.value };
    }),

    syncOriginalNote: assign(({ event, context }) => {
      if (event.type !== 'CONTENT_SYNCED') {
        return { noteOriginal: context.noteOriginal, noteDraft: context.noteDraft };
      }

      return {
        noteOriginal: event.noteText,
        noteDraft: event.noteText,
      };
    }),

    commitDraft: assign(({ context }) => ({
      noteOriginal: context.noteDraft,
    })),

    resetDraftFromOriginal: assign(({ context }) => ({
      noteDraft: context.noteOriginal,
    })),

    setCloseReasonManual: assign({
      closeReason: () => 'manual' as const,
    }),

    setCloseReasonOutside: assign({
      closeReason: () => 'outside' as const,
    }),

    setCloseReasonEscape: assign({
      closeReason: () => 'escape' as const,
    }),

    setCloseReasonSelection: assign({
      closeReason: () => 'selection-change' as const,
    }),

    setCloseReasonSave: assign({
      closeReason: () => 'save' as const,
    }),

    setCloseReasonCancel: assign({
      closeReason: () => 'cancel' as const,
    }),

    setCloseReasonFromEvent: assign(({ event, context }) => {
      if (event.type !== 'CLOSE') {
        return { closeReason: context.closeReason };
      }

      return { closeReason: event.reason ?? 'manual' };
    }),

    clearActive: assign(({ context }) => ({
      ...defaultContext,
      closeReason: context.closeReason,
    })),
  },
  guards: {
    hasEditableNoteIntent: ({ context }) => context.intentType === 'Note',
  },
}).createMachine({
  id: 'annotationPopover',
  initial: 'closed',
  context: defaultContext,
  states: {
    closed: {
      on: {
        OPEN_HOVER: {
          target: 'open.hover',
          actions: 'setOpenFromEvent',
        },
        OPEN_CLICK: {
          target: 'open.pinned',
          actions: 'setOpenFromEvent',
        },
        OPEN_MANUAL: {
          target: 'open.pinned',
          actions: 'setOpenFromEvent',
        },
      },
    },

    open: {
      on: {
        OPEN_HOVER: {
          target: '.hover',
          actions: 'setOpenFromEvent',
        },
        OPEN_CLICK: {
          target: '.pinned',
          actions: 'setOpenFromEvent',
        },
        OPEN_MANUAL: {
          target: '.pinned',
          actions: 'setOpenFromEvent',
        },
        ANCHOR_UPDATED: {
          actions: 'updateAnchor',
        },
        CONTENT_SYNCED: {
          actions: 'syncOriginalNote',
        },
        SELECTION_INVALIDATED: {
          target: 'closed',
          actions: ['setCloseReasonSelection', 'clearActive'],
        },
        ESCAPE: {
          target: 'closed',
          actions: ['setCloseReasonEscape', 'clearActive'],
        },
        OUTSIDE_CLICK: {
          target: 'closed',
          actions: ['setCloseReasonOutside', 'clearActive'],
        },
        CLOSE: {
          target: 'closed',
          actions: ['setCloseReasonFromEvent', 'clearActive'],
        },
      },

      initial: 'hover',
      states: {
        hover: {
          on: {
            PIN: {
              target: 'pinned',
              actions: 'setPinned',
            },
            START_EDIT: {
              guard: 'hasEditableNoteIntent',
              target: 'editing',
              actions: ['setPinned', 'startEditDraft'],
            },
          },
        },

        pinned: {
          on: {
            // Pinned is sticky: hover events must never downgrade to hover.
            // Only explicit UNPIN may release pin state.
            OPEN_HOVER: {},
            UNPIN: {
              target: 'hover',
              actions: 'setUnpinned',
            },
            START_EDIT: {
              guard: 'hasEditableNoteIntent',
              target: 'editing',
              actions: ['setPinned', 'startEditDraft'],
            },
          },
        },

        editing: {
          on: {
            // While editing, suppress lifecycle close/open events to prevent
            // accidental dismissal and note loss. Only Save/Cancel can close.
            OPEN_HOVER: {},
            OPEN_CLICK: {},
            OPEN_MANUAL: {},
            SELECTION_INVALIDATED: {},
            ESCAPE: {},
            OUTSIDE_CLICK: {},
            CLOSE: {},

            UPDATE_DRAFT: {
              actions: 'updateDraftValue',
            },
            SAVE_EDIT: {
              target: '#annotationPopover.closed',
              actions: ['commitDraft', 'setCloseReasonSave', 'clearActive'],
            },
            CANCEL_EDIT: {
              target: '#annotationPopover.closed',
              actions: ['resetDraftFromOriginal', 'setCloseReasonCancel', 'clearActive'],
            },
          },
        },
      },
    },
  },
});

export type PopoverMachine = typeof popoverMachine;

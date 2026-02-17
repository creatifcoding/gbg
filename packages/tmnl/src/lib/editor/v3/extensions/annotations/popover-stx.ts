/**
 * Annotation Popover stx Controller
 *
 * Single-writer orchestration boundary for annotation popover lifecycle.
 *
 * Responsibilities:
 * - Own machine transitions (XState v5 popover contract)
 * - Bridge machine transitions to existing `popoverOps` integration surface
 * - Keep `popoverOps` as mutation boundary for annotation atoms/services
 *
 * @module editor/v3/extensions/annotations/popover-stx
 */

import type { SnapshotFrom } from 'xstate';

import { Cause, Option } from 'effect';
import { stx, type Stx } from '@/lib/stx';

import { annotationRegistry, popoverOps } from './atoms';
import {
  popoverMachine,
  type PopoverCloseReason,
  type PopoverMachine,
  type PopoverMachineEvent,
  type PopoverOpenPayload,
} from './machines';

interface AnnotationPopoverControllerData {
  readonly lastEventType: PopoverMachineEvent['type'] | null;
  readonly transitionCount: number;
  readonly lastCloseReason: PopoverCloseReason | null;
}

const initialData: AnnotationPopoverControllerData = {
  lastEventType: null,
  transitionCount: 0,
  lastCloseReason: null,
};

type AnnotationPopoverControllerStx = Stx<
  PopoverMachine,
  AnnotationPopoverControllerData,
  Record<string, never>,
  Record<string, never>
>;

type PopoverSnapshot = SnapshotFrom<PopoverMachine>;

let controllerStx: AnnotationPopoverControllerStx | null = null;

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env.DEV;

function debugLog(...args: unknown[]): void {
  if (!IS_DEV) return;
  console.debug('[PopoverDebug][stx]', ...args);
}

function debugError(...args: unknown[]): void {
  if (!IS_DEV) return;
  console.error('[PopoverDebug][stx]', ...args);
}

function debugFnResult(label: string, fnAtom: unknown): void {
  if (!IS_DEV) return;

  queueMicrotask(() => {
    try {
      const result = annotationRegistry.get(fnAtom as never) as Record<string, unknown>;
      if (result && result._tag === 'Failure') {
        const cause = (result as { cause?: Cause.Cause<unknown> }).cause;
        const defect = cause ? Option.getOrUndefined(Cause.dieOption(cause)) : undefined;
        const failure = cause ? Option.getOrUndefined(Cause.failureOption(cause)) : undefined;
        const pretty = cause ? Cause.pretty(cause) : undefined;

        debugError(`${label} failed`, {
          result,
          failure,
          defect,
          defectMessage: defect instanceof Error ? defect.message : undefined,
          defectStack: defect instanceof Error ? defect.stack : undefined,
          pretty,
        });
      } else {
        debugLog(`${label} result`, result);
      }
    } catch (error) {
      debugError(`${label} read failed`, error);
    }
  });
}

const shouldBridgeOpen = (
  event: PopoverMachineEvent,
  next: PopoverSnapshot
): event is Extract<PopoverMachineEvent, { type: 'OPEN_HOVER' | 'OPEN_CLICK' | 'OPEN_MANUAL' }> =>
  (event.type === 'OPEN_HOVER' || event.type === 'OPEN_CLICK' || event.type === 'OPEN_MANUAL') &&
  next.matches('open');

function bridgeEventToPopoverOps(
  prev: PopoverSnapshot,
  next: PopoverSnapshot,
  event: PopoverMachineEvent
): void {
  if (shouldBridgeOpen(event, next)) {
    const context = next.context;

    if (!context.annotationId || !context.markId || !context.anchor) {
      debugError('OPEN bridge skipped: missing required context', {
        event,
        context,
      });
      return;
    }

    debugLog('Bridge OPEN → popoverOps.show', {
      annotationId: context.annotationId,
      markId: context.markId,
      trigger: context.trigger,
      placement: context.placement,
      isPinned: context.isPinned,
    });

    annotationRegistry.set(popoverOps.show, {
      annotationId: context.annotationId,
      markId: context.markId,
      anchor: context.anchor,
      placement: context.placement,
      trigger: context.trigger,
      isPinned: context.isPinned,
      intentData: context.intentData ?? undefined,
    });

    debugFnResult('popoverOps.show', popoverOps.show);
    return;
  }

  if (event.type === 'ANCHOR_UPDATED' && next.matches('open')) {
    debugLog('Bridge ANCHOR_UPDATED → popoverOps.updateAnchor');
    annotationRegistry.set(popoverOps.updateAnchor, { anchor: event.anchor });
    debugFnResult('popoverOps.updateAnchor', popoverOps.updateAnchor);
    return;
  }

  if (event.type === 'PIN' && next.matches({ open: 'pinned' })) {
    debugLog('Bridge PIN → popoverOps.pin');
    annotationRegistry.set(popoverOps.pin, undefined);
    debugFnResult('popoverOps.pin', popoverOps.pin);
    return;
  }

  if (event.type === 'UNPIN' && next.matches({ open: 'hover' })) {
    debugLog('Bridge UNPIN → popoverOps.unpin');
    annotationRegistry.set(popoverOps.unpin, undefined);
    debugFnResult('popoverOps.unpin', popoverOps.unpin);
    return;
  }

  const wasOpen = prev.matches('open');
  const isOpen = next.matches('open');
  if (wasOpen && !isOpen) {
    debugLog('Bridge CLOSE → popoverOps.hide', {
      closeReason: next.context.closeReason,
      eventType: event.type,
    });
    annotationRegistry.set(popoverOps.hide, undefined);
    debugFnResult('popoverOps.hide', popoverOps.hide);
  }
}

export function getAnnotationPopoverControllerStx(): AnnotationPopoverControllerStx {
  if (!controllerStx) {
    controllerStx = stx({
      machine: popoverMachine,
      data: initialData,
    }) as AnnotationPopoverControllerStx;

    debugLog('controller created', {
      initialValue: controllerStx.actor?.getSnapshot().value,
    });
  }

  return controllerStx;
}

export function dispatchPopoverEvent(event: PopoverMachineEvent): void {
  const state = getAnnotationPopoverControllerStx();
  const actor = state.actor;
  const send = state.send;

  if (!actor || !send) {
    debugError('dispatchPopoverEvent: actor/send unavailable', {
      hasActor: !!actor,
      hasSend: !!send,
      event,
    });
    return;
  }

  const prev = actor.getSnapshot();
  debugLog('dispatch event', {
    eventType: event.type,
    prevValue: prev.value,
    prevContext: prev.context,
  });

  send(event);
  const next = actor.getSnapshot();

  debugLog('post-dispatch snapshot', {
    eventType: event.type,
    nextValue: next.value,
    nextContext: next.context,
  });

  bridgeEventToPopoverOps(prev, next, event);

  state.data.lastEventType.set(event.type);
  state.data.transitionCount.set(state.data.transitionCount.get() + 1);
  state.data.lastCloseReason.set(next.context.closeReason);
}

export const popoverControllerOps = {
  openHover(payload: PopoverOpenPayload): void {
    dispatchPopoverEvent({ type: 'OPEN_HOVER', ...payload });
  },

  openClick(payload: PopoverOpenPayload): void {
    dispatchPopoverEvent({ type: 'OPEN_CLICK', ...payload });
  },

  openManual(payload: PopoverOpenPayload): void {
    dispatchPopoverEvent({ type: 'OPEN_MANUAL', ...payload });
  },

  pin(): void {
    dispatchPopoverEvent({ type: 'PIN' });
  },

  unpin(): void {
    dispatchPopoverEvent({ type: 'UNPIN' });
  },

  startEdit(): void {
    dispatchPopoverEvent({ type: 'START_EDIT' });
  },

  updateDraft(value: string): void {
    dispatchPopoverEvent({ type: 'UPDATE_DRAFT', value });
  },

  saveEdit(): void {
    dispatchPopoverEvent({ type: 'SAVE_EDIT' });
  },

  cancelEdit(): void {
    dispatchPopoverEvent({ type: 'CANCEL_EDIT' });
  },

  contentSynced(noteText: string | null): void {
    dispatchPopoverEvent({ type: 'CONTENT_SYNCED', noteText });
  },

  updateAnchor(anchor: Extract<PopoverMachineEvent, { type: 'ANCHOR_UPDATED' }>['anchor']): void {
    dispatchPopoverEvent({ type: 'ANCHOR_UPDATED', anchor });
  },

  selectionInvalidated(): void {
    dispatchPopoverEvent({ type: 'SELECTION_INVALIDATED' });
  },

  escape(): void {
    dispatchPopoverEvent({ type: 'ESCAPE' });
  },

  outsideClick(): void {
    dispatchPopoverEvent({ type: 'OUTSIDE_CLICK' });
  },

  close(reason?: PopoverCloseReason): void {
    dispatchPopoverEvent({ type: 'CLOSE', reason });
  },
};

export function disposeAnnotationPopoverControllerStx(): void {
  if (controllerStx) {
    controllerStx.dispose();
    controllerStx = null;
  }
}

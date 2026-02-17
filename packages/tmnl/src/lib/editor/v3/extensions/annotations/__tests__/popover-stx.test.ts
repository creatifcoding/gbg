import { beforeEach, describe, expect, it } from 'vitest';

import {
  disposeAnnotationPopoverControllerStx,
  getAnnotationPopoverControllerStx,
  popoverControllerOps,
} from '../popover-stx';

const anchor = {
  _tag: 'virtual' as const,
  getBoundingClientRect: () =>
    ({ x: 10, y: 20, width: 30, height: 12, top: 20, left: 10, right: 40, bottom: 32 } as DOMRect),
};

describe('popover-stx controller', () => {
  beforeEach(() => {
    disposeAnnotationPopoverControllerStx();
    getAnnotationPopoverControllerStx();
  });

  it('tracks transition metadata for open/close lifecycle', () => {
    popoverControllerOps.openClick({
      annotationId: 'ann-1' as any,
      markId: 'mark-1' as any,
      anchor,
      placement: 'top',
      trigger: 'click',
      intentType: 'Note',
      initialNoteText: 'initial',
    });

    const afterOpen = getAnnotationPopoverControllerStx();
    expect(afterOpen.actor.getSnapshot().matches({ open: 'pinned' })).toBe(true);
    expect(afterOpen.data.lastEventType.get()).toBe('OPEN_CLICK');
    expect(afterOpen.data.transitionCount.get()).toBeGreaterThan(0);

    popoverControllerOps.close('manual');

    const afterClose = getAnnotationPopoverControllerStx();
    expect(afterClose.actor.getSnapshot().matches('closed')).toBe(true);
    expect(afterClose.data.lastEventType.get()).toBe('CLOSE');
    expect(afterClose.data.lastCloseReason.get()).toBe('manual');
  });

  it('supports note edit draft flow and save close reason', () => {
    popoverControllerOps.openClick({
      annotationId: 'ann-2' as any,
      markId: 'mark-2' as any,
      anchor,
      placement: 'top',
      trigger: 'click',
      intentType: 'Note',
      initialNoteText: 'before',
    });

    popoverControllerOps.startEdit();
    popoverControllerOps.updateDraft('after');

    const duringEdit = getAnnotationPopoverControllerStx().actor.getSnapshot();
    expect(duringEdit.matches({ open: 'editing' })).toBe(true);
    expect(duringEdit.context.noteDraft).toBe('after');

    popoverControllerOps.saveEdit();

    const afterSave = getAnnotationPopoverControllerStx();
    expect(afterSave.actor.getSnapshot().matches('closed')).toBe(true);
    expect(afterSave.data.lastCloseReason.get()).toBe('save');
  });

  it('uses cancel close reason for cancelled edits', () => {
    popoverControllerOps.openClick({
      annotationId: 'ann-3' as any,
      markId: 'mark-3' as any,
      anchor,
      placement: 'top',
      trigger: 'click',
      intentType: 'Note',
      initialNoteText: 'before',
    });

    popoverControllerOps.startEdit();
    popoverControllerOps.updateDraft('discard-me');
    popoverControllerOps.cancelEdit();

    const state = getAnnotationPopoverControllerStx();
    expect(state.actor.getSnapshot().matches('closed')).toBe(true);
    expect(state.data.lastCloseReason.get()).toBe('cancel');
  });
});

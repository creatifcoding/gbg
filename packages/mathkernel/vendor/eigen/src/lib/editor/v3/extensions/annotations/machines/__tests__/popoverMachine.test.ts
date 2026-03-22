import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';

import { popoverMachine } from '../popoverMachine';

function makeOpenPayload(overrides: Partial<{
  type: 'OPEN_HOVER' | 'OPEN_CLICK' | 'OPEN_MANUAL';
  intentType: string;
  initialNoteText: string | null;
}> = {}) {
  return {
    type: overrides.type ?? ('OPEN_HOVER' as const),
    annotationId: 'ann-1' as any,
    markId: 'mark-1' as any,
    anchor: {
      _tag: 'virtual' as const,
      getBoundingClientRect: () =>
        ({ x: 0, y: 0, width: 1, height: 1, top: 0, left: 0, right: 1, bottom: 1 } as DOMRect),
    },
    placement: 'top' as const,
    trigger: overrides.type === 'OPEN_HOVER' ? 'hover' as const : 'click' as const,
    intentType: overrides.intentType,
    initialNoteText: overrides.initialNoteText ?? undefined,
  };
}

describe('popoverMachine', () => {
  it('opens hover popover in open.hover state', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_HOVER' }));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ open: 'hover' })).toBe(true);
    expect(snapshot.context.isPinned).toBe(false);
    expect(snapshot.context.closeReason).toBeNull();
  });

  it('opens click popover in open.pinned state', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_CLICK' }));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ open: 'pinned' })).toBe(true);
    expect(snapshot.context.isPinned).toBe(true);
  });

  it('enters editing only for Note intents', () => {
    const noteActor = createActor(popoverMachine).start();
    noteActor.send(makeOpenPayload({ type: 'OPEN_CLICK', intentType: 'Note', initialNoteText: 'hello' }));
    noteActor.send({ type: 'START_EDIT' });
    expect(noteActor.getSnapshot().matches({ open: 'editing' })).toBe(true);

    const nonNoteActor = createActor(popoverMachine).start();
    nonNoteActor.send(makeOpenPayload({ type: 'OPEN_CLICK', intentType: 'Hyperlink' }));
    nonNoteActor.send({ type: 'START_EDIT' });
    expect(nonNoteActor.getSnapshot().matches({ open: 'editing' })).toBe(false);
    expect(nonNoteActor.getSnapshot().matches({ open: 'pinned' })).toBe(true);
  });

  it('syncs content and commits draft on save', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_CLICK', intentType: 'Note' }));
    actor.send({ type: 'CONTENT_SYNCED', noteText: 'initial' });
    actor.send({ type: 'START_EDIT' });
    actor.send({ type: 'UPDATE_DRAFT', value: 'changed' });
    actor.send({ type: 'SAVE_EDIT' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('closed')).toBe(true);
    expect(snapshot.context.closeReason).toBe('save');
    expect(snapshot.context.noteOriginal).toBeNull();
    expect(snapshot.context.noteDraft).toBeNull();
  });

  it('cancels edit without persisting draft and closes with cancel reason', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_CLICK', intentType: 'Note' }));
    actor.send({ type: 'CONTENT_SYNCED', noteText: 'original' });
    actor.send({ type: 'START_EDIT' });
    actor.send({ type: 'UPDATE_DRAFT', value: 'draft-only' });
    actor.send({ type: 'CANCEL_EDIT' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('closed')).toBe(true);
    expect(snapshot.context.closeReason).toBe('cancel');
  });

  it('handles selection invalidation by closing popover', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_HOVER' }));
    actor.send({ type: 'SELECTION_INVALIDATED' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('closed')).toBe(true);
    expect(snapshot.context.closeReason).toBe('selection-change');
  });

  it('does not close while editing on outside/escape/close/open events', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_CLICK', intentType: 'Note', initialNoteText: 'draft' }));
    actor.send({ type: 'START_EDIT' });
    actor.send({ type: 'UPDATE_DRAFT', value: 'dirty' });

    actor.send({ type: 'OUTSIDE_CLICK' });
    actor.send({ type: 'ESCAPE' });
    actor.send({ type: 'CLOSE', reason: 'manual' });
    actor.send(makeOpenPayload({ type: 'OPEN_HOVER' }));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ open: 'editing' })).toBe(true);
    expect(snapshot.context.noteDraft).toBe('dirty');
  });

  it('keeps pinned state sticky when OPEN_HOVER is received', () => {
    const actor = createActor(popoverMachine).start();

    actor.send(makeOpenPayload({ type: 'OPEN_CLICK', intentType: 'Note' }));
    expect(actor.getSnapshot().matches({ open: 'pinned' })).toBe(true);

    actor.send(makeOpenPayload({ type: 'OPEN_HOVER', intentType: 'Note' }));

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches({ open: 'pinned' })).toBe(true);
    expect(snapshot.context.isPinned).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

import { AnnotationPopover } from '../components/AnnotationPopover';
import {
  AnnotationRegistryProvider,
  activePopoverAtom,
  annotationRegistry,
  popoverContentAtom,
  popoverHoverStateAtom,
} from '../atoms';
import { IntentMark } from '../extension';
import { AnnotationNodeExtension } from '../node-extension';
import {
  disposeAnnotationPopoverControllerStx,
  getAnnotationPopoverControllerStx,
  popoverControllerOps,
} from '../popover-stx';

const nowIso = new Date().toISOString();
const visualStyleJson = JSON.stringify({
  type: 'highlight',
  color: 'accent.yellow',
  effect: 'none',
  animated: false,
});

const anchor = {
  _tag: 'virtual' as const,
  getBoundingClientRect: () =>
    ({ x: 20, y: 30, width: 40, height: 14, top: 30, left: 20, right: 60, bottom: 44 } as DOMRect),
};

function makeEditor(initialNote: string) {
  const markId = 'mark-note-1';
  const nodeId = 'node-note-1';

  const editor = new Editor({
    extensions: [Document, Paragraph, Text, IntentMark, AnnotationNodeExtension],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'annotated text',
              marks: [
                {
                  type: 'intentMark',
                  attrs: {
                    id: markId,
                    visualStyle: visualStyleJson,
                    intent: JSON.stringify({
                      _tag: 'Note',
                      annotationId: nodeId,
                      category: 'comment',
                      content: initialNote,
                    }),
                    tags: JSON.stringify(['note']),
                    createdAt: nowIso,
                    createdBy: 'manual',
                    references: null,
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'annotationNode',
          attrs: {
            id: nodeId,
            title: 'Note',
            documentId: 'doc-default',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          content: initialNote.length > 0 ? [{ type: 'text', text: initialNote }] : [],
        },
      ],
    },
  });

  return { editor, markId, nodeId };
}

function getNodeText(editor: Editor, nodeId: string): string {
  let text = '';
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'annotationNode' && node.attrs.id === nodeId) {
      text = node.textContent ?? '';
      return false;
    }
    return true;
  });
  return text;
}

function seedOpenPopover({
  markId,
  nodeId,
  initialNote,
  trigger,
}: {
  markId: string;
  nodeId: string;
  initialNote: string;
  trigger: 'hover' | 'click';
}) {
  const payload = {
    annotationId: markId as any,
    markId: markId as any,
    anchor,
    placement: 'top' as const,
    trigger,
    intentType: 'Note',
    initialNoteText: initialNote,
    intentData: {
      intentType: 'Note',
      intent: {
        _tag: 'Note',
        annotationId: nodeId,
        category: 'comment',
        content: initialNote,
      } as any,
    },
  };

  if (trigger === 'hover') {
    popoverControllerOps.openHover(payload);
  } else {
    popoverControllerOps.openClick(payload);
  }

  // Materialize open UI state for integration tests.
  // The machine remains the source of edit lifecycle truth.
  annotationRegistry.set(activePopoverAtom, {
    annotationId: markId as any,
    markId: markId as any,
    placement: 'top',
    trigger,
    isPinned: trigger === 'click',
    anchorRect: { x: 20, y: 30, width: 40, height: 14 },
  });

  annotationRegistry.set(popoverContentAtom, {
    title: 'Note',
    description: initialNote,
  });
}

describe('AnnotationPopover integration', () => {
  const editors: Editor[] = [];

  beforeEach(() => {
    disposeAnnotationPopoverControllerStx();
    getAnnotationPopoverControllerStx();

    annotationRegistry.set(activePopoverAtom, null);
    annotationRegistry.set(popoverContentAtom, null);
    annotationRegistry.set(popoverHoverStateAtom, { trigger: false, popover: false });
  });

  afterEach(() => {
    for (const editor of editors) {
      editor.destroy();
    }
    editors.length = 0;

    disposeAnnotationPopoverControllerStx();
    annotationRegistry.set(activePopoverAtom, null);
    annotationRegistry.set(popoverContentAtom, null);
    annotationRegistry.set(popoverHoverStateAtom, { trigger: false, popover: false });
  });

  it('supports hover and click open flows with correct pin state', async () => {
    const { editor, markId, nodeId } = makeEditor('Initial note');
    editors.push(editor);

    render(
      <AnnotationRegistryProvider>
        <AnnotationPopover editor={editor} />
      </AnnotationRegistryProvider>
    );

    await act(async () => {
      seedOpenPopover({ markId, nodeId, initialNote: 'Initial note', trigger: 'hover' });
    });

    await waitFor(() => {
      expect(screen.getByText('Edit note')).toBeInTheDocument();
    });

    const hoverSnapshot = getAnnotationPopoverControllerStx().actor.getSnapshot();
    expect(hoverSnapshot.matches({ open: 'hover' })).toBe(true);
    expect(annotationRegistry.get(activePopoverAtom)?.isPinned).toBe(false);

    await act(async () => {
      seedOpenPopover({ markId, nodeId, initialNote: 'Initial note', trigger: 'click' });
    });

    await waitFor(() => {
      expect(screen.getByText('Edit note')).toBeInTheDocument();
    });

    const clickSnapshot = getAnnotationPopoverControllerStx().actor.getSnapshot();
    expect(clickSnapshot.matches({ open: 'pinned' })).toBe(true);
    expect(annotationRegistry.get(activePopoverAtom)?.isPinned).toBe(true);
  });

  it('persists note edits on save', async () => {
    const { editor, markId, nodeId } = makeEditor('Initial note');
    editors.push(editor);

    render(
      <AnnotationRegistryProvider>
        <AnnotationPopover editor={editor} />
      </AnnotationRegistryProvider>
    );

    await act(async () => {
      seedOpenPopover({ markId, nodeId, initialNote: 'Initial note', trigger: 'click' });
    });

    await waitFor(() => {
      expect(screen.getByText('Edit note')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit note/i }));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Saved integration note' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(getNodeText(editor, nodeId)).toBe('Saved integration note');
    });
  });

  it('does not persist note edits on cancel', async () => {
    const { editor, markId, nodeId } = makeEditor('Original note');
    editors.push(editor);

    render(
      <AnnotationRegistryProvider>
        <AnnotationPopover editor={editor} />
      </AnnotationRegistryProvider>
    );

    await act(async () => {
      seedOpenPopover({ markId, nodeId, initialNote: 'Original note', trigger: 'click' });
    });

    await waitFor(() => {
      expect(screen.getByText('Edit note')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit note/i }));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Discarded note' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(getNodeText(editor, nodeId)).toBe('Original note');
    });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

import { AnnotationNodeExtension } from '../node-extension';

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, AnnotationNodeExtension],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'seed' }] }],
    },
  });
}

function findFirstAnnotationNode(editor: Editor) {
  let found:
    | {
        id: string;
        pos: number;
        text: string;
      }
    | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'annotationNode') {
      found = {
        id: String(node.attrs.id),
        pos,
        text: node.textContent ?? '',
      };
      return false;
    }

    return true;
  });

  return found;
}

function hasEmptyTextNode(editor: Editor): boolean {
  let hasEmpty = false;

  editor.state.doc.descendants((node) => {
    if (node.isText && (node.text ?? '') === '') {
      hasEmpty = true;
      return false;
    }

    return true;
  });

  return hasEmpty;
}

describe('AnnotationNodeExtension', () => {
  const editors: Editor[] = [];

  afterEach(() => {
    for (const editor of editors) {
      editor.destroy();
    }
    editors.length = 0;
  });

  it('does not insert empty text nodes when inserting empty content', () => {
    const editor = createEditor();
    editors.push(editor);

    const ok = editor.commands.insertAnnotationNode({
      content: '',
      title: 'Empty Note',
    });

    expect(ok).toBe(true);

    const node = findFirstAnnotationNode(editor);
    expect(node).not.toBeNull();
    expect(node?.text).toBe('');
    expect(hasEmptyTextNode(editor)).toBe(false);
  });

  it('updates node content to empty without creating empty text nodes', () => {
    const editor = createEditor();
    editors.push(editor);

    editor.commands.insertAnnotationNode({
      content: 'initial text',
      title: 'Editable Note',
    });

    const node = findFirstAnnotationNode(editor);
    expect(node).not.toBeNull();

    const updated = editor.commands.updateAnnotationNode(node!.id as any, {
      content: '',
    });

    expect(updated).toBe(true);

    const updatedNode = findFirstAnnotationNode(editor);
    expect(updatedNode).not.toBeNull();
    expect(updatedNode?.text).toBe('');
    expect(hasEmptyTextNode(editor)).toBe(false);
  });

  it('updates node content to non-empty text', () => {
    const editor = createEditor();
    editors.push(editor);

    editor.commands.insertAnnotationNode({
      content: 'initial text',
      title: 'Editable Note',
    });

    const node = findFirstAnnotationNode(editor);
    expect(node).not.toBeNull();

    const updated = editor.commands.updateAnnotationNode(node!.id as any, {
      content: 'next text',
    });

    expect(updated).toBe(true);

    const updatedNode = findFirstAnnotationNode(editor);
    expect(updatedNode?.text).toBe('next text');
    expect(hasEmptyTextNode(editor)).toBe(false);
  });
});

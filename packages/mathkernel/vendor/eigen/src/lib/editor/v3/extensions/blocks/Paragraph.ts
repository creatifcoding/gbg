/**
 * Paragraph Extension
 *
 * Basic paragraph block. The default text container.
 *
 * @module editor/v3/extensions/blocks/Paragraph
 */

import { Node, mergeAttributes } from '@tiptap/core';

export interface ParagraphOptions {
  /** HTML attributes for the paragraph element */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraph: {
      /** Set a paragraph node */
      setParagraph: () => ReturnType;
    };
  }
}

export const Paragraph = Node.create<ParagraphOptions>({
  name: 'paragraph',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'inline*',

  parseHTML() {
    return [{ tag: 'p' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setParagraph:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
    };
  },
});

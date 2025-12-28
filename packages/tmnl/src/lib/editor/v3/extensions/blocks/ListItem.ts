/**
 * ListItem Extension
 *
 * List item node for bullet and ordered lists.
 *
 * @module editor/v3/extensions/blocks/ListItem
 */

import { Node, mergeAttributes } from '@tiptap/core';

export interface ListItemOptions {
  /** HTML attributes for li element */
  HTMLAttributes: Record<string, unknown>;
  /** Bullet list type name */
  bulletListTypeName: string;
  /** Ordered list type name */
  orderedListTypeName: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    listItem: {
      /** Split list item at current position */
      splitListItem: (typeOrName: string) => ReturnType;
      /** Sink list item (increase indent) */
      sinkListItem: (typeOrName: string) => ReturnType;
      /** Lift list item (decrease indent) */
      liftListItem: (typeOrName: string) => ReturnType;
    };
  }
}

export const ListItem = Node.create<ListItemOptions>({
  name: 'listItem',

  addOptions() {
    return {
      HTMLAttributes: {},
      bulletListTypeName: 'bulletList',
      orderedListTypeName: 'orderedList',
    };
  },

  content: 'paragraph block*',

  defining: true,

  parseHTML() {
    return [{ tag: 'li' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    };
  },
});

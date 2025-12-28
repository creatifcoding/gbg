/**
 * BulletList Extension
 *
 * Unordered list block with bullet points.
 *
 * @module editor/v3/extensions/blocks/BulletList
 */

import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

export interface BulletListOptions {
  /** HTML attributes for the ul element */
  HTMLAttributes: Record<string, unknown>;
  /** Item type name (for list-item content) */
  itemTypeName: string;
  /** Keep marks when splitting */
  keepMarks: boolean;
  /** Keep attributes when splitting */
  keepAttributes: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bulletList: {
      /** Toggle a bullet list */
      toggleBulletList: () => ReturnType;
    };
  }
}

const inputRegex = /^\s*([-+*])\s$/;

export const BulletList = Node.create<BulletListOptions>({
  name: 'bulletList',

  addOptions() {
    return {
      HTMLAttributes: {},
      itemTypeName: 'listItem',
      keepMarks: false,
      keepAttributes: false,
    };
  },

  group: 'block list',

  content() {
    return `${this.options.itemTypeName}+`;
  },

  parseHTML() {
    return [{ tag: 'ul' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleBulletList:
        () =>
        ({ commands, chain }) => {
          if (this.options.keepAttributes) {
            return chain().toggleList(this.name, this.options.itemTypeName, this.options.keepMarks).run();
          }
          return commands.toggleList(this.name, this.options.itemTypeName, this.options.keepMarks);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () => this.editor.commands.toggleBulletList(),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
      }),
    ];
  },
});

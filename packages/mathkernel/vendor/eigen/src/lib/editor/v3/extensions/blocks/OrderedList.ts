/**
 * OrderedList Extension
 *
 * Ordered list block with numbers.
 *
 * @module editor/v3/extensions/blocks/OrderedList
 */

import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

export interface OrderedListOptions {
  /** HTML attributes for the ol element */
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
    orderedList: {
      /** Toggle an ordered list */
      toggleOrderedList: () => ReturnType;
    };
  }
}

const inputRegex = /^(\d+)\.\s$/;

export const OrderedList = Node.create<OrderedListOptions>({
  name: 'orderedList',

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

  addAttributes() {
    return {
      start: {
        default: 1,
        parseHTML: (element) => {
          return element.hasAttribute('start') ? parseInt(element.getAttribute('start') || '1', 10) : 1;
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'ol' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { start, ...rest } = HTMLAttributes;
    return [
      'ol',
      mergeAttributes(this.options.HTMLAttributes, rest, start === 1 ? {} : { start }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleOrderedList:
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
      'Mod-Shift-7': () => this.editor.commands.toggleOrderedList(),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => ({ start: +match[1] }),
        joinPredicate: (match, node) => node.childCount + node.attrs.start === +match[1],
      }),
    ];
  },
});

/**
 * TaskList Extension
 *
 * Task list (checkbox list) block.
 *
 * @module editor/v3/extensions/blocks/TaskList
 */

import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

export interface TaskListOptions {
  /** HTML attributes for the ul element */
  HTMLAttributes: Record<string, unknown>;
  /** Item type name */
  itemTypeName: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskList: {
      /** Toggle a task list */
      toggleTaskList: () => ReturnType;
    };
  }
}

const inputRegex = /^\s*(\[([( |x])?\])\s$/;

export const TaskList = Node.create<TaskListOptions>({
  name: 'taskList',

  addOptions() {
    return {
      HTMLAttributes: {},
      itemTypeName: 'taskItem',
    };
  },

  group: 'block list',

  content() {
    return `${this.options.itemTypeName}+`;
  },

  parseHTML() {
    return [
      {
        tag: `ul[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': this.name }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ commands }) => {
          return commands.toggleList(this.name, this.options.itemTypeName);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-9': () => this.editor.commands.toggleTaskList(),
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

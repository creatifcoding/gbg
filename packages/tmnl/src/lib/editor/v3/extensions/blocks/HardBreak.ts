/**
 * HardBreak Extension
 *
 * Hard line break (Shift+Enter).
 *
 * @module editor/v3/extensions/blocks/HardBreak
 */

import { Node, mergeAttributes } from '@tiptap/core';

export interface HardBreakOptions {
  /** Keep marks after hard break */
  keepMarks: boolean;
  /** HTML attributes for br element */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    hardBreak: {
      /** Insert a hard break */
      setHardBreak: () => ReturnType;
    };
  }
}

export const HardBreak = Node.create<HardBreakOptions>({
  name: 'hardBreak',

  addOptions() {
    return {
      keepMarks: true,
      HTMLAttributes: {},
    };
  },

  inline: true,

  group: 'inline',

  selectable: false,

  parseHTML() {
    return [{ tag: 'br' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['br', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  renderText() {
    return '\n';
  },

  addCommands() {
    return {
      setHardBreak:
        () =>
        ({ commands, chain, state, editor }) => {
          return commands.first([
            () => commands.exitCode(),
            () =>
              commands.command(() => {
                const { selection, storedMarks } = state;
                const { $from, $to } = selection;

                if (selection.empty && $from.parent.type.name === 'codeBlock') {
                  return false;
                }

                const marks =
                  storedMarks || ($to.parentOffset && $from.marks());

                return chain()
                  .insertContent({ type: this.name })
                  .command(({ tr, dispatch }) => {
                    if (dispatch && marks && this.options.keepMarks) {
                      tr.ensureMarks(marks);
                    }

                    return true;
                  })
                  .run();
              }),
          ]);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setHardBreak(),
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
    };
  },
});

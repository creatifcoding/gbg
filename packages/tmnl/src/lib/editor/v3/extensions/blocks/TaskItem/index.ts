/**
 * TaskItem Extension
 *
 * Enhanced task item (checkbox item) for task lists.
 * Features:
 * - VANTA-styled checkbox matching toolbar aesthetic
 * - XState-managed animation states
 * - Iridescent sheen sweep on hover/focus (anime.js)
 * - Sparkle burst on toggle
 * - Subtle glow for checked state
 *
 * @module editor/v3/extensions/blocks/TaskItem
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TaskItemView } from './TaskItemView';

// =============================================================================
// Types
// =============================================================================

export interface TaskItemOptions {
  /** Allow nested content */
  nested: boolean;
  /** HTML attributes for li element */
  HTMLAttributes: Record<string, unknown>;
  /** Callback when checkbox is toggled in readonly mode */
  onReadOnlyChecked?: (node: Node, checked: boolean) => boolean;
}

// =============================================================================
// Extension
// =============================================================================

export const TaskItem = Node.create<TaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      nested: true,
      HTMLAttributes: {},
      onReadOnlyChecked: undefined,
    };
  },

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+';
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes) => ({
          'data-checked': attributes.checked,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-checked': node.attrs.checked,
      }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
          },
        ],
        ['span'],
      ],
      ['div', 0],
    ];
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, () => boolean> = {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    };

    if (!this.options.nested) {
      return shortcuts;
    }

    return {
      ...shortcuts,
      Tab: () => this.editor.commands.sinkListItem(this.name),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskItemView);
  },
});

// =============================================================================
// Re-exports
// =============================================================================

export { TaskCheckbox } from './TaskCheckbox';
export { TaskItemView } from './TaskItemView';
export { taskCheckboxMachine } from './machine';
export type { TaskCheckboxContext, TaskCheckboxEvent } from './machine';
export {
  taskItemStyle,
  taskItemCheckedContentStyle,
  checkboxWrapperStyle,
  checkboxVisualStyle,
  sparkleContainerStyle,
  contentStyle,
  SHEEN_GRADIENT,
  CHECKED_GLOW,
  CHECKBOX_TIMING,
} from './styles';

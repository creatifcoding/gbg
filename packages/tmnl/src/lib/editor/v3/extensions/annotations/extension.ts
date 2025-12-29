/**
 * IntentMark TipTap Extension
 *
 * Custom mark extension for annotations with visual styling and semantic intents.
 * Stores complex attributes as JSON in data-* attributes.
 *
 * @module editor/v3/extensions/annotations/extension
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import type { MarkType } from '@tiptap/pm/model';
import {
  type AnnotationId,
  type VisualStyle,
  type IntentPayload,
  type CreationSource,
  generateAnnotationId,
  VisualStylePresets,
  Intent,
} from './schemas';

// =============================================================================
// Types
// =============================================================================

export interface IntentMarkOptions {
  /**
   * HTML attributes to add to all intent marks
   * @default {}
   */
  HTMLAttributes: Record<string, unknown>;

  /**
   * Default visual style for new marks
   * @default VisualStylePresets.highlight
   */
  defaultVisualStyle: VisualStyle;

  /**
   * Callback when a mark is clicked
   */
  onMarkClick?: (markId: AnnotationId, event: MouseEvent) => void;

  /**
   * Callback when a mark is hovered
   */
  onMarkHover?: (markId: AnnotationId, event: MouseEvent) => void;

  /**
   * Callback when hover ends
   */
  onMarkHoverEnd?: (markId: AnnotationId, event: MouseEvent) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    intentMark: {
      /**
       * Set an intent mark on the current selection
       */
      setIntentMark: (attributes: {
        visualStyle?: VisualStyle;
        intent: IntentPayload;
        tags?: string[];
      }) => ReturnType;

      /**
       * Toggle an intent mark on the current selection
       */
      toggleIntentMark: (attributes: {
        visualStyle?: VisualStyle;
        intent: IntentPayload;
        tags?: string[];
      }) => ReturnType;

      /**
       * Remove intent mark from selection
       */
      unsetIntentMark: () => ReturnType;

      /**
       * Update an existing intent mark by ID
       */
      updateIntentMark: (
        id: AnnotationId,
        updates: {
          visualStyle?: VisualStyle;
          intent?: IntentPayload;
          tags?: string[];
        }
      ) => ReturnType;

      /**
       * Add a highlight mark (convenience)
       */
      setHighlight: (options?: { color?: string; tags?: string[] }) => ReturnType;

      /**
       * Add a link mark (convenience)
       */
      setIntentLink: (href: string, options?: { target?: '_blank' | '_self' }) => ReturnType;
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate CSS class from visual style
 */
const getVisualStyleClass = (style: VisualStyle): string => {
  const classes = [`intent-mark`, `intent-mark--${style.type}`];

  if (style.effect !== 'none') {
    classes.push(`intent-mark--effect-${style.effect}`);
  }

  if (style.animated) {
    classes.push('intent-mark--animated');
  }

  return classes.join(' ');
};

/**
 * Generate inline styles from visual style
 */
const getVisualStyleCSS = (style: VisualStyle): string => {
  const styles: string[] = [];

  // Map TMNL color tokens to CSS variables
  const colorVar = `var(--tmnl-${style.color.replace('.', '-')}, ${style.color})`;

  switch (style.type) {
    case 'highlight':
      styles.push(`background-color: ${colorVar}`);
      styles.push('color: inherit');
      styles.push('border-radius: 2px');
      styles.push('padding: 0 2px');
      break;

    case 'pill':
      styles.push(`background-color: ${colorVar}`);
      styles.push('color: inherit');
      styles.push('border-radius: 9999px');
      styles.push('padding: 0 6px');
      break;

    case 'squiggle':
      styles.push(`text-decoration: wavy underline ${colorVar}`);
      styles.push('text-underline-offset: 2px');
      break;

    case 'underline':
      styles.push(`text-decoration: underline ${colorVar}`);
      styles.push('text-underline-offset: 2px');
      break;

    case 'none':
      // No visual styling
      break;
  }

  return styles.join('; ');
};

// =============================================================================
// Extension Definition
// =============================================================================

/**
 * IntentMark Extension
 *
 * A comprehensive annotation mark with:
 * - Configurable visual styles (highlight, pill, squiggle, underline)
 * - Semantic intents (link, popover, action, citation, note)
 * - Freeform tags for filtering
 * - Graph references for annotation linking
 */
export const IntentMark = Mark.create<IntentMarkOptions>({
  name: 'intentMark',

  priority: 1000,

  // Keep mark when splitting text
  keepOnSplit: false,

  // Allow exiting mark with arrow keys
  exitable: true,

  // Mark is inclusive (typing at edge extends mark)
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultVisualStyle: VisualStylePresets.highlight,
      onMarkClick: undefined,
      onMarkHover: undefined,
      onMarkHoverEnd: undefined,
    };
  },

  addAttributes() {
    return {
      // Unique identifier
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-annotation-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { 'data-annotation-id': attributes.id };
        },
      },

      // Visual style (JSON serialized)
      visualStyle: {
        default: JSON.stringify(this.options.defaultVisualStyle),
        parseHTML: (element) => {
          const attr = element.getAttribute('data-visual-style');
          return attr || JSON.stringify(this.options.defaultVisualStyle);
        },
        renderHTML: (attributes) => {
          if (!attributes.visualStyle) return {};
          return { 'data-visual-style': attributes.visualStyle };
        },
      },

      // Intent payload (JSON serialized)
      intent: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-intent'),
        renderHTML: (attributes) => {
          if (!attributes.intent) return {};
          return { 'data-intent': attributes.intent };
        },
      },

      // Tags (JSON array)
      tags: {
        default: '[]',
        parseHTML: (element) => element.getAttribute('data-tags') || '[]',
        renderHTML: (attributes) => {
          if (!attributes.tags || attributes.tags === '[]') return {};
          return { 'data-tags': attributes.tags };
        },
      },

      // Creation metadata
      createdAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-created-at'),
        renderHTML: (attributes) => {
          if (!attributes.createdAt) return {};
          return { 'data-created-at': attributes.createdAt };
        },
      },

      createdBy: {
        default: 'manual',
        parseHTML: (element) => element.getAttribute('data-created-by') || 'manual',
        renderHTML: (attributes) => {
          if (!attributes.createdBy) return {};
          return { 'data-created-by': attributes.createdBy };
        },
      },

      // References (JSON array of annotation IDs)
      references: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-references'),
        renderHTML: (attributes) => {
          if (!attributes.references) return {};
          return { 'data-references': attributes.references };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-annotation-id]',
      },
      {
        tag: 'mark[data-annotation-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Parse visual style for rendering
    let visualStyle: VisualStyle;
    try {
      visualStyle =
        typeof HTMLAttributes.visualStyle === 'string'
          ? JSON.parse(HTMLAttributes.visualStyle)
          : HTMLAttributes.visualStyle || this.options.defaultVisualStyle;
    } catch {
      visualStyle = this.options.defaultVisualStyle;
    }

    // Determine element tag based on visual type
    const tag = visualStyle.type === 'highlight' ? 'mark' : 'span';

    // Build class and style
    const className = getVisualStyleClass(visualStyle);
    const style = getVisualStyleCSS(visualStyle);

    return [
      tag,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: className,
        style,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setIntentMark:
        (attributes) =>
        ({ commands }) => {
          const id = generateAnnotationId();
          const visualStyle = attributes.visualStyle || this.options.defaultVisualStyle;

          return commands.setMark(this.name, {
            id,
            visualStyle: JSON.stringify(visualStyle),
            intent: JSON.stringify(attributes.intent),
            tags: JSON.stringify(attributes.tags || []),
            createdAt: new Date().toISOString(),
            createdBy: 'manual' as CreationSource,
            references: null,
          });
        },

      toggleIntentMark:
        (attributes) =>
        ({ commands }) => {
          const id = generateAnnotationId();
          const visualStyle = attributes.visualStyle || this.options.defaultVisualStyle;

          return commands.toggleMark(this.name, {
            id,
            visualStyle: JSON.stringify(visualStyle),
            intent: JSON.stringify(attributes.intent),
            tags: JSON.stringify(attributes.tags || []),
            createdAt: new Date().toISOString(),
            createdBy: 'manual' as CreationSource,
            references: null,
          });
        },

      unsetIntentMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },

      updateIntentMark:
        (id, updates) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false;

          let updated = false;

          // Find all marks with this ID and update them
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type.name === this.name && mark.attrs.id === id) {
                const newAttrs = { ...mark.attrs };

                if (updates.visualStyle) {
                  newAttrs.visualStyle = JSON.stringify(updates.visualStyle);
                }
                if (updates.intent) {
                  newAttrs.intent = JSON.stringify(updates.intent);
                }
                if (updates.tags) {
                  newAttrs.tags = JSON.stringify(updates.tags);
                }

                // Remove old mark and add new one
                const from = pos;
                const to = pos + node.nodeSize;

                tr.removeMark(from, to, mark.type);
                tr.addMark(from, to, mark.type.create(newAttrs));
                updated = true;
              }
            });
          });

          return updated;
        },

      setHighlight:
        (options) =>
        ({ commands }) => {
          const annotationId = generateAnnotationId();
          return commands.setIntentMark({
            visualStyle: {
              type: 'highlight',
              color: options?.color || 'accent.yellow',
              effect: 'none',
              animated: false,
            },
            intent: Intent.note(annotationId, 'comment'),
            tags: options?.tags,
          });
        },

      setIntentLink:
        (href, options) =>
        ({ commands }) => {
          return commands.setIntentMark({
            visualStyle: {
              type: 'underline',
              color: 'accent.blue',
              effect: 'none',
              animated: false,
            },
            intent: Intent.hyperlink(href, options?.target),
            tags: ['link'],
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () => this.editor.commands.setHighlight(),
      'Mod-Shift-u': () => this.editor.commands.unsetIntentMark(),
    };
  },
});

export default IntentMark;

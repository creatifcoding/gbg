/**
 * Callout Extension
 *
 * Custom callout/admonition block with variants (info, warning, error, success).
 *
 * @module editor/v3/extensions/blocks/Callout
 */

import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

import { VANTA_COLORS } from '@/components/portal/tokens';

// =============================================================================
// Types
// =============================================================================

export type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'note';

export interface CalloutOptions {
  /** HTML attributes for the callout container */
  HTMLAttributes: Record<string, unknown>;
  /** Available variants */
  variants: CalloutVariant[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Set a callout block */
      setCallout: (attributes?: { variant?: CalloutVariant }) => ReturnType;
      /** Toggle a callout block */
      toggleCallout: (attributes?: { variant?: CalloutVariant }) => ReturnType;
      /** Unset a callout block */
      unsetCallout: () => ReturnType;
      /** Update callout variant */
      updateCalloutVariant: (variant: CalloutVariant) => ReturnType;
    };
  }
}

// =============================================================================
// Variant Styles
// =============================================================================

const VARIANT_STYLES: Record<CalloutVariant, { bg: string; border: string; icon: string; label: string }> = {
  info: {
    bg: 'rgba(56, 189, 248, 0.1)',
    border: VANTA_COLORS.accent.cyan,
    icon: 'ℹ️',
    label: 'Info',
  },
  warning: {
    bg: 'rgba(251, 191, 36, 0.1)',
    border: VANTA_COLORS.accent.amber,
    icon: '⚠️',
    label: 'Warning',
  },
  error: {
    bg: 'rgba(248, 113, 113, 0.1)',
    border: VANTA_COLORS.accent.rose,
    icon: '❌',
    label: 'Error',
  },
  success: {
    bg: 'rgba(74, 222, 128, 0.1)',
    border: VANTA_COLORS.accent.emerald,
    icon: '✓',
    label: 'Success',
  },
  note: {
    bg: 'rgba(167, 139, 250, 0.1)',
    border: VANTA_COLORS.accent.violet,
    icon: '📝',
    label: 'Note',
  },
};

// =============================================================================
// NodeView Component
// =============================================================================

function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) || 'info';
  const styles = VARIANT_STYLES[variant];

  return (
    <NodeViewWrapper
      className="tmnl-callout"
      data-type="callout"
      data-variant={variant}
      style={{
        margin: '16px 0',
        padding: '16px',
        borderRadius: '4px',
        borderLeft: `3px solid ${styles.border}`,
        background: styles.bg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        {/* Icon and variant selector */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '16px' }}>{styles.icon}</span>
          {editor.isEditable && (
            <select
              value={variant}
              onChange={(e) => updateAttributes({ variant: e.target.value as CalloutVariant })}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--tmnl-font-mono)',
                background: 'transparent',
                border: 'none',
                color: styles.border,
                cursor: 'pointer',
                padding: 0,
                appearance: 'none',
                textAlign: 'center',
                width: '50px',
              }}
              contentEditable={false}
            >
              <option value="info">INFO</option>
              <option value="warning">WARN</option>
              <option value="error">ERROR</option>
              <option value="success">OK</option>
              <option value="note">NOTE</option>
            </select>
          )}
        </div>

        {/* Content */}
        <NodeViewContent
          className="callout-content"
          style={{
            flex: 1,
            color: VANTA_COLORS.text.primary,
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}

// =============================================================================
// Extension
// =============================================================================

const inputRegex = /^:::(\w+)?\s$/;

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  addOptions() {
    return {
      HTMLAttributes: {},
      variants: ['info', 'warning', 'error', 'success', 'note'],
    };
  },

  content: 'block+',

  group: 'block',

  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-variant') || 'info',
        renderHTML: (attributes) => ({
          'data-variant': attributes.variant,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
      {
        tag: '.callout',
      },
      {
        tag: '.admonition',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const variant = node.attrs.variant as CalloutVariant;
    const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        'data-variant': variant,
        class: 'callout',
        style: `border-left: 3px solid ${styles.border}; background: ${styles.bg}; padding: 16px; margin: 16px 0; border-radius: 4px;`,
      }),
      [
        'div',
        { style: 'display: flex; gap: 12px;' },
        ['span', { style: 'font-size: 16px;' }, styles.icon],
        ['div', { class: 'callout-content' }, 0],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
      updateCalloutVariant:
        (variant) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { variant });
        },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const variant = match[1];
          if (variant && this.options.variants.includes(variant as CalloutVariant)) {
            return { variant };
          }
          return { variant: 'info' };
        },
      }),
    ];
  },
});

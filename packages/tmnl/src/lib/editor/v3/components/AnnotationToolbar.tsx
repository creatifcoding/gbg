/**
 * AnnotationToolbar
 *
 * Floating selection menu for creating annotations.
 * Appears when text is selected in the editor.
 *
 * Uses TipTap's BubbleMenu for proper positioning.
 *
 * @module editor/v3/components/AnnotationToolbar
 */

import { forwardRef, useCallback, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { TextSelection, AllSelection } from '@tiptap/pm/state';

import {
  VANTA_COLORS,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';
import { Intent, type VisualStyle } from '../extensions/annotations/schemas';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationToolbarProps {
  /** TipTap editor instance */
  editor: Editor;
  /** Additional className */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Callback when annotation is created */
  onAnnotate?: (options: {
    intent: ReturnType<typeof Intent.note>;
    visualStyle: VisualStyle;
    tags: string[];
  }) => void;
}

// =============================================================================
// Icons (inline SVG for minimal deps)
// =============================================================================

const HighlightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const NoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// =============================================================================
// Button Component
// =============================================================================

interface ToolbarButtonProps {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      aria-pressed={active}
      title={tooltipText}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        minWidth: 28,
        height: 28,
        padding: 0,
        borderRadius: VANTA_BORDERS.radius.sm,
        border: 'none',
        backgroundColor: active
          ? VANTA_COLORS.surface.raised
          : 'transparent',
        color: active
          ? VANTA_COLORS.accent.cyan
          : VANTA_COLORS.text.secondary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: VANTA_ANIMATION.transition.colors,
      }}
    >
      {icon}
    </button>
  );
}

// =============================================================================
// Divider
// =============================================================================

function ToolbarDivider() {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        backgroundColor: VANTA_COLORS.surface.border,
        margin: `0 ${VANTA_SPACING['1']}`,
      }}
    />
  );
}

// =============================================================================
// Color Palette
// =============================================================================

const ANNOTATION_COLORS = [
  { name: 'Cyan', token: 'accent.cyan', color: '#00d4aa' },
  { name: 'Yellow', token: 'accent.yellow', color: '#ffd93d' },
  { name: 'Blue', token: 'accent.blue', color: '#4da6ff' },
  { name: 'Purple', token: 'accent.purple', color: '#a855f7' },
  { name: 'Orange', token: 'accent.orange', color: '#ff8c00' },
  { name: 'Green', token: 'accent.green', color: '#22c55e' },
];

// =============================================================================
// Style Selector
// =============================================================================

interface StyleSelectorProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

function StyleSelector({ selectedColor, onColorChange }: StyleSelectorProps) {
  // Cycle to next color on click
  const handleClick = () => {
    const currentIndex = ANNOTATION_COLORS.findIndex((c) => c.token === selectedColor);
    const nextIndex = (currentIndex + 1) % ANNOTATION_COLORS.length;
    onColorChange(ANNOTATION_COLORS[nextIndex].token);
  };

  const currentColor = ANNOTATION_COLORS.find((c) => c.token === selectedColor);

  return (
    <button
      onClick={handleClick}
      title={`Color: ${currentColor?.name || 'Yellow'} (click to change)`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: 28,
        padding: '0 6px',
        borderRadius: VANTA_BORDERS.radius.sm,
        border: 'none',
        backgroundColor: 'transparent',
        color: VANTA_COLORS.text.secondary,
        cursor: 'pointer',
        transition: VANTA_ANIMATION.transition.colors,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          backgroundColor: currentColor?.color || '#ffd93d',
          boxShadow: `0 0 6px ${currentColor?.color || '#ffd93d'}`,
        }}
      />
    </button>
  );
}

// =============================================================================
// Toolbar Content (extracted for BubbleMenu children)
// =============================================================================

interface ToolbarContentProps {
  editor: Editor;
  selectedStyle: 'highlight' | 'pill' | 'squiggle' | 'underline';
  selectedColor: string;
  onColorChange: (color: string) => void;
  onAnnotate?: AnnotationToolbarProps['onAnnotate'];
  className?: string;
  style?: React.CSSProperties;
}

const ToolbarContent = forwardRef<HTMLDivElement, ToolbarContentProps>(
  function ToolbarContent(
    { editor, selectedStyle, selectedColor, onColorChange, onAnnotate, className, style },
    ref
  ) {
    // Check if selection already has an intent mark
    const hasIntentMark = editor.isActive('intentMark');

    // Handle highlight action
    const handleHighlight = useCallback(() => {
      const visualStyle: VisualStyle = {
        type: selectedStyle,
        color: selectedColor,
        effect: 'none',
        animated: false,
      };

      // Unset existing mark first to ensure clean replacement
      editor
        .chain()
        .focus()
        .unsetIntentMark()
        .setIntentMark({
          visualStyle,
          intent: Intent.note('', 'comment'),
          tags: [],
        })
        .run();

      onAnnotate?.({
        intent: Intent.note('', 'comment'),
        visualStyle,
        tags: [],
      });
    }, [editor, selectedStyle, selectedColor, onAnnotate]);

    // Handle link action
    const handleLink = useCallback(() => {
      const url = prompt('Enter URL:');
      if (url) {
        editor.chain().focus().setIntentLink(url, { target: '_blank' }).run();
      }
    }, [editor]);

    // Handle note action
    const handleNote = useCallback(() => {
      const visualStyle: VisualStyle = {
        type: 'squiggle',
        color: 'accent.purple',
        effect: 'none',
        animated: true,
      };

      // Unset existing mark first to ensure clean replacement
      editor
        .chain()
        .focus()
        .unsetIntentMark()
        .setIntentMark({
          visualStyle,
          intent: Intent.note('', 'sticky'),
          tags: ['note'],
        })
        .run();

      onAnnotate?.({
        intent: Intent.note('', 'sticky'),
        visualStyle,
        tags: ['note'],
      });
    }, [editor, onAnnotate]);

    // Remove annotation
    const handleRemove = useCallback(() => {
      editor.chain().focus().unsetIntentMark().run();
    }, [editor]);

    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          backgroundColor: VANTA_COLORS.surface.elevated,
          borderRadius: VANTA_BORDERS.radius.md,
          border: VANTA_BORDERS.style.hairline,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          animation: 'annotationToolbarFadeIn 0.15s ease-out',
          ...style,
        }}
      >
        {/* Style/Color selector */}
        <StyleSelector selectedColor={selectedColor} onColorChange={onColorChange} />

        <ToolbarDivider />

        {/* Quick actions */}
        <ToolbarButton
          icon={<HighlightIcon />}
          label="Highlight"
          shortcut="⌘⇧H"
          active={hasIntentMark}
          onClick={handleHighlight}
        />

        <ToolbarButton icon={<LinkIcon />} label="Link" shortcut="⌘K" onClick={handleLink} />

        <ToolbarButton icon={<NoteIcon />} label="Note" onClick={handleNote} />

        {hasIntentMark && (
          <>
            <ToolbarDivider />
            <ToolbarButton
              icon={<CloseIcon />}
              label="Remove annotation"
              onClick={handleRemove}
            />
          </>
        )}
      </div>
    );
  }
);

// =============================================================================
// Main Component - Uses TipTap's BubbleMenu
// =============================================================================

export const AnnotationToolbar = forwardRef<HTMLDivElement, AnnotationToolbarProps>(
  function AnnotationToolbar({ editor, className, style, onAnnotate }, ref) {
    const [selectedStyle] = useState<'highlight' | 'pill' | 'squiggle' | 'underline'>('highlight');
    const [selectedColor, setSelectedColor] = useState('accent.yellow');

    // Don't render if editor is not ready
    if (!editor) {
      return null;
    }

    return (
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          placement: 'top',
          animation: 'fade',
          duration: 150,
          // Ensure it stays visible during interaction
          interactive: true,
          // Append to body to avoid clipping issues
          appendTo: () => document.body,
        }}
        // Only show when there's a text selection (not on node selections like images)
        shouldShow={({ editor, state }) => {
          const { from, to } = state.selection;
          const hasSelection = from !== to;
          // Allow TextSelection (normal selection) and AllSelection (Ctrl+A)
          const isTextLikeSelection =
            state.selection instanceof TextSelection ||
            state.selection instanceof AllSelection;
          return hasSelection && isTextLikeSelection && editor.isEditable;
        }}
      >
        <ToolbarContent
          ref={ref}
          editor={editor}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
          onAnnotate={onAnnotate}
          className={className}
          style={style}
        />
      </BubbleMenu>
    );
  }
);

export default AnnotationToolbar;

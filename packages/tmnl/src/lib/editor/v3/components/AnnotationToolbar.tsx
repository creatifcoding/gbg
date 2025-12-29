/**
 * AnnotationToolbar
 *
 * Floating selection menu for creating annotations.
 * Appears when text is selected in the editor.
 *
 * Uses custom positioning based on selection coords.
 *
 * @module editor/v3/components/AnnotationToolbar
 */

import {
  forwardRef,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';

import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';
import { Intent, VisualStylePresets, type VisualStyle } from '../extensions/annotations/schemas';

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

interface Position {
  top: number;
  left: number;
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

const SquiggleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 17c2-3 6-3 8 0s6 3 8 0" strokeLinecap="round" />
  </svg>
);

const PillIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="8" width="16" height="8" rx="4" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,9 12,15 18,9" />
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
  hasDropdown?: boolean;
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  hasDropdown = false,
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
        padding: hasDropdown ? '0 4px' : 0,
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
      {hasDropdown && <ChevronDownIcon />}
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
// Style Selector Dropdown
// =============================================================================

interface StyleSelectorProps {
  editor: Editor;
  selectedStyle: 'highlight' | 'pill' | 'squiggle' | 'underline';
  onStyleChange: (style: 'highlight' | 'pill' | 'squiggle' | 'underline') => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
}

function StyleSelector({
  editor,
  selectedStyle,
  onStyleChange,
  selectedColor,
  onColorChange,
}: StyleSelectorProps) {
  // Cycle to next color on click
  const handleClick = () => {
    const currentIndex = ANNOTATION_COLORS.findIndex(c => c.token === selectedColor);
    const nextIndex = (currentIndex + 1) % ANNOTATION_COLORS.length;
    onColorChange(ANNOTATION_COLORS[nextIndex].token);
  };

  const currentColor = ANNOTATION_COLORS.find(c => c.token === selectedColor);

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
// Selection Position Hook
// =============================================================================

function useSelectionPosition(editor: Editor): Position | null {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (!editor?.view) return;

    const updatePosition = () => {
      const { state } = editor;
      const { from, to } = state.selection;

      // No selection or collapsed selection
      if (from === to) {
        setPosition(null);
        return;
      }

      // Get selection coordinates
      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);

        // Position above the selection, centered
        const top = start.top - 48; // 48px above
        const left = (start.left + end.right) / 2;

        setPosition({ top, left });
      } catch {
        setPosition(null);
      }
    };

    // Update on selection change
    editor.on('selectionUpdate', updatePosition);
    editor.on('focus', updatePosition);
    editor.on('blur', () => setPosition(null));

    // Initial update
    updatePosition();

    return () => {
      editor.off('selectionUpdate', updatePosition);
      editor.off('focus', updatePosition);
      editor.off('blur', () => setPosition(null));
    };
  }, [editor]);

  return position;
}

// =============================================================================
// Main Component
// =============================================================================

export const AnnotationToolbar = forwardRef<HTMLDivElement, AnnotationToolbarProps>(
  function AnnotationToolbar({ editor, className, style, onAnnotate }, ref) {
    const [selectedStyle, setSelectedStyle] = useState<
      'highlight' | 'pill' | 'squiggle' | 'underline'
    >('highlight');
    const [selectedColor, setSelectedColor] = useState('accent.yellow');

    const position = useSelectionPosition(editor);

    // Check if selection already has an intent mark
    const hasIntentMark = editor.isActive('intentMark');

    // Check if there's a text selection
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    // Handle highlight action
    const handleHighlight = useCallback(() => {
      const visualStyle: VisualStyle = {
        type: selectedStyle,
        color: selectedColor,
        effect: 'none',
        animated: false,
      };

      editor.chain().focus().setIntentMark({
        visualStyle,
        intent: Intent.note('', 'comment'),
        tags: [],
      }).run();

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

      editor.chain().focus().setIntentMark({
        visualStyle,
        intent: Intent.note('', 'sticky'),
        tags: ['note'],
      }).run();

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

    // Don't render if no selection or not editable
    if (!hasSelection || !editor.isEditable || !position) {
      return null;
    }

    const toolbar = (
      <div
        ref={ref}
        className={className}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: VANTA_SPACING['1'],
          padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
          backgroundColor: VANTA_COLORS.surface.elevated,
          borderRadius: VANTA_BORDERS.radius.md,
          border: VANTA_BORDERS.style.hairline,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          zIndex: 9998,
          // CSS animation instead of framer-motion
          animation: 'annotationToolbarFadeIn 0.15s ease-out',
          ...style,
        }}
      >
        {/* Style/Color selector */}
        <StyleSelector
          editor={editor}
          selectedStyle={selectedStyle}
          onStyleChange={setSelectedStyle}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
        />

        <ToolbarDivider />

        {/* Quick actions */}
        <ToolbarButton
          icon={<HighlightIcon />}
          label="Highlight"
          shortcut="⌘⇧H"
          active={hasIntentMark}
          onClick={handleHighlight}
        />

        <ToolbarButton
          icon={<LinkIcon />}
          label="Link"
          shortcut="⌘K"
          onClick={handleLink}
        />

        <ToolbarButton
          icon={<NoteIcon />}
          label="Note"
          onClick={handleNote}
        />

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

    // Render to body to avoid DOM conflicts with editor mutations
    return createPortal(toolbar, document.body);
  }
);

export default AnnotationToolbar;

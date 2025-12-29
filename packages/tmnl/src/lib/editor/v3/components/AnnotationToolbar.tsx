/**
 * AnnotationToolbar
 *
 * Floating selection menu for creating annotations.
 * Appears when text is selected in the editor.
 *
 * Uses TipTap BubbleMenu with VANTA design tokens.
 *
 * @module editor/v3/components/AnnotationToolbar
 */

import { forwardRef, useCallback, useState, type ReactNode } from 'react';
import { BubbleMenu } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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

const ColorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
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
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <motion.button
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          onClick={disabled ? undefined : onClick}
          aria-label={label}
          aria-pressed={active}
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
        </motion.button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          style={{
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            backgroundColor: VANTA_COLORS.surface.base,
            borderRadius: VANTA_BORDERS.radius.sm,
            border: VANTA_BORDERS.style.subtle,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: VANTA_SPACING['2'],
              fontFamily: VANTA_TYPOGRAPHY.family.mono,
              fontSize: VANTA_TYPOGRAPHY.size.xs,
            }}
          >
            <span style={{ color: VANTA_COLORS.text.primary }}>{label}</span>
            {shortcut && (
              <span style={{ color: VANTA_COLORS.text.tertiary }}>{shortcut}</span>
            )}
          </div>
          <Tooltip.Arrow
            style={{
              fill: VANTA_COLORS.surface.base,
            }}
          />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
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
        backgroundColor: VANTA_COLORS.border.subtle,
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
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
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
              backgroundColor: selectedColor,
            }}
          />
          <ChevronDownIcon />
        </motion.button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          style={{
            minWidth: 160,
            padding: VANTA_SPACING['2'],
            backgroundColor: VANTA_COLORS.surface.elevated,
            borderRadius: VANTA_BORDERS.radius.md,
            border: VANTA_BORDERS.style.subtle,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
          }}
        >
          {/* Style options */}
          <div style={{ marginBottom: VANTA_SPACING['2'] }}>
            <div
              style={{
                fontSize: VANTA_TYPOGRAPHY.size.xs,
                color: VANTA_COLORS.text.tertiary,
                marginBottom: VANTA_SPACING['1'],
                fontFamily: VANTA_TYPOGRAPHY.family.mono,
              }}
            >
              Style
            </div>
            <div style={{ display: 'flex', gap: VANTA_SPACING['1'] }}>
              {[
                { key: 'highlight', icon: <HighlightIcon />, label: 'Highlight' },
                { key: 'pill', icon: <PillIcon />, label: 'Pill' },
                { key: 'squiggle', icon: <SquiggleIcon />, label: 'Squiggle' },
              ].map(({ key, icon, label }) => (
                <DropdownMenu.Item
                  key={key}
                  onSelect={() => onStyleChange(key as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: VANTA_BORDERS.radius.sm,
                    backgroundColor:
                      selectedStyle === key
                        ? VANTA_COLORS.surface.raised
                        : 'transparent',
                    color:
                      selectedStyle === key
                        ? VANTA_COLORS.accent.cyan
                        : VANTA_COLORS.text.secondary,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                  title={label}
                >
                  {icon}
                </DropdownMenu.Item>
              ))}
            </div>
          </div>

          <DropdownMenu.Separator
            style={{
              height: 1,
              backgroundColor: VANTA_COLORS.border.subtle,
              margin: `${VANTA_SPACING['2']} 0`,
            }}
          />

          {/* Color palette */}
          <div>
            <div
              style={{
                fontSize: VANTA_TYPOGRAPHY.size.xs,
                color: VANTA_COLORS.text.tertiary,
                marginBottom: VANTA_SPACING['1'],
                fontFamily: VANTA_TYPOGRAPHY.family.mono,
              }}
            >
              Color
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: VANTA_SPACING['1'],
              }}
            >
              {ANNOTATION_COLORS.map(({ name, token, color }) => (
                <DropdownMenu.Item
                  key={token}
                  onSelect={() => onColorChange(token)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: color,
                    cursor: 'pointer',
                    outline:
                      selectedColor === token
                        ? `2px solid ${VANTA_COLORS.accent.cyan}`
                        : 'none',
                    outlineOffset: 2,
                  }}
                  title={name}
                />
              ))}
            </div>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
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

    return (
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          duration: 150,
          placement: 'top',
          offset: [0, 8],
        }}
        shouldShow={({ editor, state }) => {
          // Only show when there's a text selection
          const { from, to } = state.selection;
          return from !== to && editor.isEditable;
        }}
      >
        <Tooltip.Provider delayDuration={300}>
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
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
              shortcut="Mod+Shift+H"
              active={hasIntentMark && editor.getAttributes('intentMark').visualStyle?.includes('highlight')}
              onClick={handleHighlight}
            />

            <ToolbarButton
              icon={<LinkIcon />}
              label="Link"
              shortcut="Mod+K"
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
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  }
                  label="Remove annotation"
                  onClick={handleRemove}
                />
              </>
            )}
          </motion.div>
        </Tooltip.Provider>
      </BubbleMenu>
    );
  }
);

export default AnnotationToolbar;

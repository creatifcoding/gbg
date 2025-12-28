/**
 * FormattingToolbar
 *
 * Text formatting toolbar for the block editor.
 * Stacks below ContextualToolbar to provide formatting controls.
 *
 * Uses VANTA design tokens and follows compound component pattern.
 *
 * @module editor/v3/components/FormattingToolbar
 */

import { forwardRef, createContext, useContext, type ReactNode, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { Editor } from '@tiptap/core';

import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

// =============================================================================
// Context
// =============================================================================

interface FormattingToolbarContextValue {
  editor: Editor | null;
}

const FormattingToolbarContext = createContext<FormattingToolbarContextValue | null>(null);

function useFormattingToolbar() {
  const context = useContext(FormattingToolbarContext);
  if (!context) {
    throw new Error('FormattingToolbar components must be used within FormattingToolbar.Root');
  }
  return context;
}

// =============================================================================
// Root
// =============================================================================

interface FormattingToolbarRootProps {
  editor: Editor | null;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const FormattingToolbarRoot = forwardRef<HTMLDivElement, FormattingToolbarRootProps>(
  function FormattingToolbarRoot({ editor, children, className, style }, ref) {
    if (!editor) return null;

    return (
      <FormattingToolbarContext.Provider value={{ editor }}>
        <Tooltip.Provider delayDuration={300}>
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
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
              ...style,
            }}
          >
            {children}
          </motion.div>
        </Tooltip.Provider>
      </FormattingToolbarContext.Provider>
    );
  }
);

// =============================================================================
// Button
// =============================================================================

interface FormattingButtonProps {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function FormattingButton({
  icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
}: FormattingButtonProps) {
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
            width: 28,
            height: 28,
            padding: 0,
            borderRadius: VANTA_BORDERS.radius.sm,
            border: 'none',
            backgroundColor: active ? VANTA_COLORS.surface.raised : 'transparent',
            color: active ? VANTA_COLORS.accent.cyan : VANTA_COLORS.text.secondary,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            transition: VANTA_ANIMATION.transition.colors,
          }}
        >
          {icon}
        </motion.button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          style={{
            padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2']}`,
            backgroundColor: VANTA_COLORS.surface.base,
            border: VANTA_BORDERS.style.default,
            borderRadius: VANTA_BORDERS.radius.sm,
            boxShadow: VANTA_BORDERS.shadow.elevated,
            ...VANTA_TYPOGRAPHY.preset.micro,
            color: VANTA_COLORS.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['2'],
            zIndex: 9999,
          }}
        >
          <span>{label}</span>
          {shortcut && (
            <span style={{ color: VANTA_COLORS.text.muted }}>{shortcut}</span>
          )}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// =============================================================================
// Divider
// =============================================================================

function FormattingDivider() {
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
// Group
// =============================================================================

interface FormattingGroupProps {
  children: ReactNode;
}

function FormattingGroup({ children }: FormattingGroupProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {children}
    </div>
  );
}

// =============================================================================
// Mark Buttons (Bold, Italic, Strike, Code)
// =============================================================================

function BoldButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<BoldIcon />}
      label="Bold"
      shortcut="⌘B"
      active={editor.isActive('bold')}
      onClick={() => editor.chain().focus().toggleBold().run()}
      disabled={!editor.can().chain().focus().toggleBold().run()}
    />
  );
}

function ItalicButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<ItalicIcon />}
      label="Italic"
      shortcut="⌘I"
      active={editor.isActive('italic')}
      onClick={() => editor.chain().focus().toggleItalic().run()}
      disabled={!editor.can().chain().focus().toggleItalic().run()}
    />
  );
}

function StrikeButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<StrikeIcon />}
      label="Strikethrough"
      shortcut="⌘⇧X"
      active={editor.isActive('strike')}
      onClick={() => editor.chain().focus().toggleStrike().run()}
      disabled={!editor.can().chain().focus().toggleStrike().run()}
    />
  );
}

function CodeButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<CodeIcon />}
      label="Inline Code"
      shortcut="⌘E"
      active={editor.isActive('code')}
      onClick={() => editor.chain().focus().toggleCode().run()}
      disabled={!editor.can().chain().focus().toggleCode().run()}
    />
  );
}

// =============================================================================
// Heading Buttons
// =============================================================================

function HeadingButton({ level }: { level: 1 | 2 | 3 }) {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  const icons = {
    1: <H1Icon />,
    2: <H2Icon />,
    3: <H3Icon />,
  };

  const shortcuts = {
    1: '⌘⌥1',
    2: '⌘⌥2',
    3: '⌘⌥3',
  };

  return (
    <FormattingButton
      icon={icons[level]}
      label={`Heading ${level}`}
      shortcut={shortcuts[level]}
      active={editor.isActive('heading', { level })}
      onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
    />
  );
}

// =============================================================================
// Block Buttons
// =============================================================================

function BulletListButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<ListIcon />}
      label="Bullet List"
      shortcut="⌘⇧8"
      active={editor.isActive('bulletList')}
      onClick={() => editor.chain().focus().toggleBulletList().run()}
    />
  );
}

function OrderedListButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<OrderedListIcon />}
      label="Numbered List"
      shortcut="⌘⇧7"
      active={editor.isActive('orderedList')}
      onClick={() => editor.chain().focus().toggleOrderedList().run()}
    />
  );
}

function TaskListButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<TaskListIcon />}
      label="Task List"
      shortcut="⌘⇧9"
      active={editor.isActive('taskList')}
      onClick={() => editor.chain().focus().toggleTaskList().run()}
    />
  );
}

function BlockquoteButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<QuoteIcon />}
      label="Quote"
      shortcut="⌘⇧B"
      active={editor.isActive('blockquote')}
      onClick={() => editor.chain().focus().toggleBlockquote().run()}
    />
  );
}

function CodeBlockButton() {
  const { editor } = useFormattingToolbar();
  if (!editor) return null;

  return (
    <FormattingButton
      icon={<CodeBlockIcon />}
      label="Code Block"
      active={editor.isActive('codeBlock')}
      onClick={() => editor.chain().focus().toggleCodeBlock().run()}
    />
  );
}

// =============================================================================
// Compound Export
// =============================================================================

export const FormattingToolbar = Object.assign(FormattingToolbarRoot, {
  Group: FormattingGroup,
  Divider: FormattingDivider,
  Button: FormattingButton,
  Bold: BoldButton,
  Italic: ItalicButton,
  Strike: StrikeButton,
  Code: CodeButton,
  Heading: HeadingButton,
  BulletList: BulletListButton,
  OrderedList: OrderedListButton,
  TaskList: TaskListButton,
  Blockquote: BlockquoteButton,
  CodeBlock: CodeBlockButton,
});

// =============================================================================
// Default Toolbar Configuration
// =============================================================================

interface DefaultFormattingToolbarProps {
  editor: Editor | null;
  className?: string;
  style?: React.CSSProperties;
}

export function DefaultFormattingToolbar({ editor, className, style }: DefaultFormattingToolbarProps) {
  return (
    <FormattingToolbar.Root editor={editor} className={className} style={style}>
      <FormattingToolbar.Group>
        <FormattingToolbar.Bold />
        <FormattingToolbar.Italic />
        <FormattingToolbar.Strike />
        <FormattingToolbar.Code />
      </FormattingToolbar.Group>

      <FormattingToolbar.Divider />

      <FormattingToolbar.Group>
        <FormattingToolbar.Heading level={1} />
        <FormattingToolbar.Heading level={2} />
        <FormattingToolbar.Heading level={3} />
      </FormattingToolbar.Group>

      <FormattingToolbar.Divider />

      <FormattingToolbar.Group>
        <FormattingToolbar.BulletList />
        <FormattingToolbar.OrderedList />
        <FormattingToolbar.TaskList />
      </FormattingToolbar.Group>

      <FormattingToolbar.Divider />

      <FormattingToolbar.Group>
        <FormattingToolbar.Blockquote />
        <FormattingToolbar.CodeBlock />
      </FormattingToolbar.Group>
    </FormattingToolbar.Root>
  );
}

// =============================================================================
// Icons (14x14)
// =============================================================================

function BoldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 3.6 3.9h.2" />
      <path d="M8.7 19.1c2.3.6 4.4 1 6.2.9 2.7 0 5.3-.7 5.3-3.6 0-1.5-1.8-3.3-3.6-3.9h-.2" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function H1Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17 18V6" />
    </svg>
  );
}

function H2Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
    </svg>
  );
}

function H3Icon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
      <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  );
}

function TaskListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m3 17 2 2 4-4" />
      <line x1="13" y1="6" x2="21" y2="6" />
      <line x1="13" y1="12" x2="21" y2="12" />
      <line x1="13" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
    </svg>
  );
}

function CodeBlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  );
}

/**
 * BlockDragHandle Compound Component
 *
 * Block-level controls for drag-and-drop reordering and quick actions.
 * Uses @tiptap/extension-drag-handle-react with Radix DropdownMenu.
 *
 * USAGE:
 * ```tsx
 * <BlockHandle.Root editor={editor}>
 *   <BlockHandle.Grip />
 *   <BlockHandle.AddButton onClick={handleAdd} />
 *   <BlockHandle.Menu>
 *     <BlockHandle.MenuItem onClick={handleDuplicate}>Duplicate</BlockHandle.MenuItem>
 *     <BlockHandle.MenuItem onClick={handleDelete} destructive>Delete</BlockHandle.MenuItem>
 *   </BlockHandle.Menu>
 * </BlockHandle.Root>
 * ```
 *
 * @module editor/v3/components/BlockDragHandle
 */

import {
  createContext,
  useContext,
  forwardRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { GripVertical, Plus, MoreHorizontal, Copy, Trash2 } from 'lucide-react';
import type { Editor } from '@tiptap/core';
import { VANTA_COLORS, VANTA_BORDERS, VANTA_SPACING, VANTA_TYPOGRAPHY, VANTA_ANIMATION } from '@/components/portal/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface BlockHandleContextValue {
  editor: Editor;
}

const BlockHandleContext = createContext<BlockHandleContextValue | null>(null);

const useBlockHandle = () => {
  const ctx = useContext(BlockHandleContext);
  if (!ctx) throw new Error('BlockHandle components must be used within BlockHandle.Root');
  return ctx;
};

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockHandleRootProps {
  children: ReactNode;
  editor: Editor;
  className?: string;
  style?: CSSProperties;
}

function BlockHandleRoot({ children, editor, className = '', style }: BlockHandleRootProps) {
  return (
    <BlockHandleContext.Provider value={{ editor }}>
      <DragHandle editor={editor}>
        <div
          className={`block-handle ${className}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: VANTA_SPACING['0.5'],
            opacity: 0,
            transition: VANTA_ANIMATION.transition.opacity,
            ...style,
          }}
        >
          {children}
        </div>
      </DragHandle>
    </BlockHandleContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grip (Drag Handle)
// ─────────────────────────────────────────────────────────────────────────────

interface GripProps {
  className?: string;
  style?: CSSProperties;
}

function Grip({ className = '', style }: GripProps) {
  return (
    <button
      className={`block-handle-grip ${className}`}
      style={{
        padding: VANTA_SPACING['1'],
        borderRadius: VANTA_BORDERS.radius.sm,
        border: 'none',
        background: 'transparent',
        color: VANTA_COLORS.text.muted,
        cursor: 'grab',
        transition: VANTA_ANIMATION.transition.colors,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      title="Drag to reorder"
    >
      <GripVertical size={14} />
      <style>{`
        .block-handle-grip:hover {
          background: ${VANTA_COLORS.surface.hover};
          color: ${VANTA_COLORS.text.secondary};
        }
        .block-handle-grip:active {
          cursor: grabbing;
        }
      `}</style>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddButton
// ─────────────────────────────────────────────────────────────────────────────

interface AddButtonProps {
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

function AddButton({ onClick, className = '', style }: AddButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`block-handle-add ${className}`}
      style={{
        padding: VANTA_SPACING['1'],
        borderRadius: VANTA_BORDERS.radius.sm,
        border: 'none',
        background: 'transparent',
        color: VANTA_COLORS.text.muted,
        cursor: 'pointer',
        transition: VANTA_ANIMATION.transition.colors,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      title="Add block below"
    >
      <Plus size={14} />
      <style>{`
        .block-handle-add:hover {
          background: ${VANTA_COLORS.surface.hover};
          color: ${VANTA_COLORS.text.secondary};
        }
      `}</style>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu (Dropdown)
// ─────────────────────────────────────────────────────────────────────────────

interface MenuProps {
  children: ReactNode;
  className?: string;
}

function Menu({ children, className = '' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`block-handle-menu-trigger ${className}`}
          style={{
            padding: VANTA_SPACING['1'],
            borderRadius: VANTA_BORDERS.radius.sm,
            border: 'none',
            background: 'transparent',
            color: VANTA_COLORS.text.muted,
            cursor: 'pointer',
            transition: VANTA_ANIMATION.transition.colors,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Block options"
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          align="start"
          sideOffset={8}
          style={{
            minWidth: '160px',
            background: VANTA_COLORS.surface.elevated,
            border: VANTA_BORDERS.style.default,
            borderRadius: VANTA_BORDERS.radius.md,
            boxShadow: VANTA_BORDERS.shadow.elevated,
            padding: VANTA_SPACING['1'],
            zIndex: 50,
          }}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>

      <style>{`
        .block-handle-menu-trigger:hover {
          background: ${VANTA_COLORS.surface.hover};
          color: ${VANTA_COLORS.text.secondary};
        }
      `}</style>
    </DropdownMenu.Root>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MenuItem
// ─────────────────────────────────────────────────────────────────────────────

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

function MenuItem({
  children,
  onClick,
  icon,
  destructive = false,
  disabled = false,
  className = '',
  style,
}: MenuItemProps) {
  const textColor = destructive ? VANTA_COLORS.accent.rose : VANTA_COLORS.text.secondary;
  const hoverBg = destructive ? VANTA_COLORS.accent.roseGlow : VANTA_COLORS.surface.hover;

  return (
    <DropdownMenu.Item
      onClick={onClick}
      disabled={disabled}
      className={`block-handle-menu-item ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['2'],
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['2']}`,
        borderRadius: VANTA_BORDERS.radius.sm,
        color: textColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        outline: 'none',
        ...VANTA_TYPOGRAPHY.preset.body,
        ...style,
      }}
    >
      {icon}
      {children}
      <style>{`
        .block-handle-menu-item:hover:not([data-disabled]),
        .block-handle-menu-item:focus {
          background: ${hoverBg};
          color: ${destructive ? VANTA_COLORS.accent.rose : VANTA_COLORS.text.primary};
        }
      `}</style>
    </DropdownMenu.Item>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MenuSeparator
// ─────────────────────────────────────────────────────────────────────────────

interface MenuSeparatorProps {
  className?: string;
  style?: CSSProperties;
}

function MenuSeparator({ className = '', style }: MenuSeparatorProps) {
  return (
    <DropdownMenu.Separator
      className={className}
      style={{
        height: '1px',
        background: VANTA_COLORS.surface.border,
        margin: `${VANTA_SPACING['1']} 0`,
        ...style,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound Export
// ─────────────────────────────────────────────────────────────────────────────

export const BlockHandle = Object.assign(BlockHandleRoot, {
  Grip,
  AddButton,
  Menu,
  MenuItem,
  MenuSeparator,
});

// ─────────────────────────────────────────────────────────────────────────────
// Prebuilt: DefaultBlockHandle
// ─────────────────────────────────────────────────────────────────────────────

export interface DefaultBlockHandleProps {
  editor: Editor;
  onAddBlock?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

/**
 * Pre-built BlockHandle with common actions.
 */
export function DefaultBlockHandle({
  editor,
  onAddBlock,
  onDuplicate,
  onDelete,
}: DefaultBlockHandleProps) {
  return (
    <BlockHandle editor={editor}>
      {onAddBlock && <BlockHandle.AddButton onClick={onAddBlock} />}
      <BlockHandle.Grip />
      <BlockHandle.Menu>
        {onDuplicate && (
          <BlockHandle.MenuItem onClick={onDuplicate} icon={<Copy size={14} />}>
            Duplicate
          </BlockHandle.MenuItem>
        )}
        {onDelete && (
          <>
            <BlockHandle.MenuSeparator />
            <BlockHandle.MenuItem onClick={onDelete} icon={<Trash2 size={14} />} destructive>
              Delete
            </BlockHandle.MenuItem>
          </>
        )}
      </BlockHandle.Menu>
    </BlockHandle>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (for parent container)
// ─────────────────────────────────────────────────────────────────────────────

export const blockHandleStyles = `
  /* Show block handle on block hover */
  .ProseMirror .block-handle-wrapper {
    position: absolute;
    left: -40px;
    top: 0;
  }

  .ProseMirror [data-node-view-wrapper]:hover .block-handle,
  .ProseMirror .block-handle-wrapper:hover .block-handle {
    opacity: 1;
  }

  /* Drag handle active state */
  .block-handle-grip:active {
    cursor: grabbing !important;
  }
`;

export type { BlockHandleRootProps, MenuItemProps as BlockHandleMenuItemProps };

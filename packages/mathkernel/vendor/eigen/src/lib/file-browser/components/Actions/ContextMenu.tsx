/**
 * ContextMenu Component
 *
 * Level 3: Right-click context menu for file operations.
 *
 * @module file-browser/components/Actions
 */

import { memo, useCallback, useEffect, useRef } from 'react'
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  FolderPlus,
  FileEdit,
  RefreshCw,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react'

import { DARK_SIDE } from '../../tokens'

// =============================================================================
// Types
// =============================================================================

export interface ContextMenuAction {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  onAction?: () => void
}

export interface ContextMenuProps {
  /** X position */
  x: number
  /** Y position */
  y: number
  /** Menu actions */
  actions: ContextMenuAction[]
  /** Called when menu should close */
  onClose: () => void
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Default Actions Factory
// =============================================================================

export function createFileContextActions(opts: {
  hasSelection: boolean
  hasClipboard: boolean
  canPaste: boolean
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onDelete?: () => void
  onNewFolder?: () => void
  onRename?: () => void
  onRefresh?: () => void
  onToggleHidden?: () => void
  onInspect?: () => void
}): ContextMenuAction[] {
  return [
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy size={14} />,
      shortcut: 'Ctrl+C',
      disabled: !opts.hasSelection,
      onAction: opts.onCopy,
    },
    {
      id: 'cut',
      label: 'Cut',
      icon: <Scissors size={14} />,
      shortcut: 'Ctrl+X',
      disabled: !opts.hasSelection,
      onAction: opts.onCut,
    },
    {
      id: 'paste',
      label: 'Paste',
      icon: <Clipboard size={14} />,
      shortcut: 'Ctrl+V',
      disabled: !opts.canPaste,
      onAction: opts.onPaste,
    },
    {
      id: 'sep1',
      label: '',
      separator: true,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 size={14} />,
      shortcut: 'Del',
      disabled: !opts.hasSelection,
      danger: true,
      onAction: opts.onDelete,
    },
    {
      id: 'rename',
      label: 'Rename',
      icon: <FileEdit size={14} />,
      shortcut: 'F2',
      disabled: !opts.hasSelection,
      onAction: opts.onRename,
    },
    {
      id: 'sep2',
      label: '',
      separator: true,
    },
    {
      id: 'newFolder',
      label: 'New Folder',
      icon: <FolderPlus size={14} />,
      shortcut: 'Ctrl+Shift+N',
      onAction: opts.onNewFolder,
    },
    {
      id: 'refresh',
      label: 'Refresh',
      icon: <RefreshCw size={14} />,
      shortcut: 'F5',
      onAction: opts.onRefresh,
    },
    {
      id: 'sep3',
      label: '',
      separator: true,
    },
    {
      id: 'toggleHidden',
      label: 'Toggle Hidden',
      icon: <EyeOff size={14} />,
      shortcut: 'Ctrl+H',
      onAction: opts.onToggleHidden,
    },
    {
      id: 'inspect',
      label: 'Inspect',
      icon: <Info size={14} />,
      shortcut: 'Ctrl+I',
      disabled: !opts.hasSelection,
      onAction: opts.onInspect,
    },
  ]
}

// =============================================================================
// Component
// =============================================================================

export const ContextMenu = memo(function ContextMenu({
  x,
  y,
  actions,
  onClose,
  className = '',
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Handle action click
  const handleAction = useCallback(
    (action: ContextMenuAction) => {
      if (action.disabled || action.separator) return
      action.onAction?.()
      onClose()
    },
    [onClose]
  )

  return (
    <div
      ref={menuRef}
      className={`context-menu ${className}`}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: DARK_SIDE.zIndex.tooltip,
        minWidth: '180px',
        background: DARK_SIDE.colors.surface,
        border: `1px solid ${DARK_SIDE.colors.border.default}`,
        padding: DARK_SIDE.spacing['1'],
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
      }}
      role="menu"
    >
      {actions.map((action) =>
        action.separator ? (
          <div
            key={action.id}
            style={{
              height: '1px',
              background: DARK_SIDE.colors.border.subtle,
              margin: `${DARK_SIDE.spacing['1']} 0`,
            }}
          />
        ) : (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={action.disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: DARK_SIDE.spacing['2'],
              width: '100%',
              padding: `${DARK_SIDE.spacing['1.5']} ${DARK_SIDE.spacing['2']}`,
              background: 'transparent',
              border: 'none',
              cursor: action.disabled ? 'not-allowed' : 'pointer',
              fontSize: DARK_SIDE.typography.size.xs,
              fontFamily: DARK_SIDE.typography.family.mono,
              color: action.disabled
                ? DARK_SIDE.colors.text.muted
                : action.danger
                  ? DARK_SIDE.colors.accent.red
                  : DARK_SIDE.colors.text.secondary,
              opacity: action.disabled ? 0.5 : 1,
              transition: `all ${DARK_SIDE.animation.duration.fast}`,
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (!action.disabled) {
                e.currentTarget.style.background = DARK_SIDE.colors.surfaceHover
                e.currentTarget.style.color = action.danger
                  ? DARK_SIDE.colors.accent.red
                  : DARK_SIDE.colors.accent.green
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = action.disabled
                ? DARK_SIDE.colors.text.muted
                : action.danger
                  ? DARK_SIDE.colors.accent.red
                  : DARK_SIDE.colors.text.secondary
            }}
            role="menuitem"
          >
            {action.icon && (
              <span style={{ width: '14px', display: 'flex', alignItems: 'center' }}>
                {action.icon}
              </span>
            )}
            <span style={{ flex: 1 }}>{action.label}</span>
            {action.shortcut && (
              <span style={{ color: DARK_SIDE.colors.text.muted, fontSize: '10px' }}>
                {action.shortcut}
              </span>
            )}
          </button>
        )
      )}
    </div>
  )
})

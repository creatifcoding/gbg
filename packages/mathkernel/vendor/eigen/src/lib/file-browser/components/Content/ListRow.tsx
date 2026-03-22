/**
 * ListRow Component
 *
 * Level 3: Single file/directory row in list view.
 *
 * @module file-browser/components/Content
 */

import { memo, useCallback, type MouseEvent, type KeyboardEvent } from 'react'
import { Folder, File, FileText, FileCode, Lock, Link as LinkIcon } from 'lucide-react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import type { FileEntry } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

export interface ListRowProps {
  /** File entry data */
  entry: FileEntry
  /** Is this row selected */
  isSelected: boolean
  /** Is this row focused */
  isFocused: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Helpers
// =============================================================================

/** Format file size for display */
function formatSize(bytes: number): string {
  if (bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / Math.pow(1024, exp)
  return `${size.toFixed(exp > 0 ? 1 : 0)} ${units[exp]}`
}

/** Format timestamp for display */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/** Get icon for file type */
function getFileIcon(entry: FileEntry) {
  if (entry.type === 'directory') {
    return <Folder size={14} />
  }

  if (entry.type === 'symlink') {
    return <LinkIcon size={14} style={{ color: DARK_SIDE.colors.fileType.symlink }} />
  }

  // File type by extension
  const ext = entry.extension?.toLowerCase()
  if (ext) {
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'c', 'cpp', 'java'].includes(ext)) {
      return <FileCode size={14} />
    }
    if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml'].includes(ext)) {
      return <FileText size={14} />
    }
  }

  return <File size={14} />
}

// =============================================================================
// Component
// =============================================================================

export const ListRow = memo(function ListRow({
  entry,
  isSelected,
  isFocused,
  className = '',
}: ListRowProps) {
  const { select, toggleSelect, rangeSelect, navigate } = useFileBrowserContext()

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (e.shiftKey) {
        rangeSelect(entry.id)
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelect(entry.id)
      } else {
        select(entry.id)
      }
    },
    [entry.id, select, toggleSelect, rangeSelect]
  )

  const handleDoubleClick = useCallback(() => {
    if (entry.type === 'directory') {
      navigate(entry.path)
    }
  }, [entry, navigate])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (entry.type === 'directory') {
          navigate(entry.path)
        }
      }
    },
    [entry, navigate]
  )

  const iconColor = (() => {
    if (entry.type === 'directory') return DARK_SIDE.colors.fileType.directory
    if (entry.type === 'symlink') return DARK_SIDE.colors.fileType.symlink
    if (entry.hidden) return DARK_SIDE.colors.fileType.hidden
    if (entry.permissions?.executable) return DARK_SIDE.colors.fileType.executable
    return DARK_SIDE.colors.fileType.file
  })()

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={`list-row ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '3fr 100px 80px 140px',
        gap: DARK_SIDE.spacing['2'],
        padding: `${DARK_SIDE.spacing['2']} ${DARK_SIDE.spacing['4']}`,
        background: isSelected
          ? DARK_SIDE.colors.surfaceSelected
          : 'transparent',
        borderLeft: isSelected
          ? `2px solid ${DARK_SIDE.colors.accent.green}`
          : '2px solid transparent',
        cursor: 'pointer',
        transition: `background ${DARK_SIDE.animation.duration.fast}`,
        outline: isFocused ? `1px solid ${DARK_SIDE.colors.border.focus}` : 'none',
        outlineOffset: '-1px',
      }}
      tabIndex={0}
      role="row"
      aria-selected={isSelected}
      data-file-id={entry.id}
      data-file-type={entry.type}
    >
      {/* Name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DARK_SIDE.spacing['2'],
          minWidth: 0,
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.sm,
          color: isSelected
            ? DARK_SIDE.colors.accent.green
            : entry.hidden
              ? DARK_SIDE.colors.text.tertiary
              : DARK_SIDE.colors.text.primary,
        }}
        role="cell"
      >
        <span style={{ color: iconColor, flexShrink: 0 }}>{getFileIcon(entry)}</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={entry.name}
        >
          {entry.name}
        </span>
        {!entry.permissions?.writable && (
          <Lock
            size={10}
            style={{ color: DARK_SIDE.colors.accent.red, flexShrink: 0 }}
          />
        )}
      </div>

      {/* Size */}
      <div
        style={{
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.xs,
          color: isSelected
            ? DARK_SIDE.colors.accent.green
            : DARK_SIDE.colors.text.secondary,
          textAlign: 'right',
        }}
        role="cell"
      >
        {entry.type === 'directory' ? '--' : formatSize(entry.size)}
      </div>

      {/* Type */}
      <div
        style={{
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.xs,
          color: isSelected
            ? DARK_SIDE.colors.accent.green
            : DARK_SIDE.colors.text.tertiary,
          textTransform: 'uppercase',
        }}
        role="cell"
      >
        {entry.type === 'directory'
          ? 'DIR'
          : entry.extension?.toUpperCase() || 'FILE'}
      </div>

      {/* Modified */}
      <div
        style={{
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.xs,
          color: isSelected
            ? DARK_SIDE.colors.accent.green
            : DARK_SIDE.colors.text.tertiary,
          textAlign: 'right',
        }}
        role="cell"
      >
        {formatDate(entry.modifiedAt)}
      </div>

      {/* Hover styles */}
      <style>{`
        .list-row:not([aria-selected="true"]):hover {
          background: ${DARK_SIDE.colors.surfaceHover} !important;
        }
        .list-row:not([aria-selected="true"]):hover > div:first-child {
          color: ${DARK_SIDE.colors.accent.cyan} !important;
        }
      `}</style>
    </div>
  )
})

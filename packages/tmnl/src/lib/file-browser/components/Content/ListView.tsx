/**
 * ListView Component
 *
 * Level 3: File list display with virtual scrolling support.
 *
 * @module file-browser/components/Content
 */

import { memo, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import { ListHeader } from './ListHeader'
import { ListRow } from './ListRow'

// =============================================================================
// Types
// =============================================================================

export interface ListViewProps {
  /** Show column headers */
  showHeader?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

const ListViewRoot = memo(function ListView({
  showHeader = true,
  className = '',
}: ListViewProps) {
  const {
    entries,
    selectedFiles,
    focusedFile,
    isLoading,
    hasError,
    errorMessage,
    select,
    navigate,
  } = useFileBrowserContext()

  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll focused item into view
  useEffect(() => {
    if (focusedFile && containerRef.current) {
      const focusedElement = containerRef.current.querySelector(
        `[data-file-id="${focusedFile}"]`
      )
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedFile])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (entries.length === 0) return

      const currentIndex = focusedFile
        ? entries.findIndex((entry) => entry.id === focusedFile)
        : -1

      let nextIndex = currentIndex

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          nextIndex = Math.min(currentIndex + 1, entries.length - 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          nextIndex = Math.max(currentIndex - 1, 0)
          break
        case 'Home':
          e.preventDefault()
          nextIndex = 0
          break
        case 'End':
          e.preventDefault()
          nextIndex = entries.length - 1
          break
        case 'PageDown':
          e.preventDefault()
          nextIndex = Math.min(currentIndex + 10, entries.length - 1)
          break
        case 'PageUp':
          e.preventDefault()
          nextIndex = Math.max(currentIndex - 10, 0)
          break
        case 'Enter':
          if (currentIndex >= 0) {
            const entry = entries[currentIndex]
            if (entry.type === 'directory') {
              navigate(entry.path)
            }
          }
          return
        default:
          return
      }

      if (nextIndex !== currentIndex && nextIndex >= 0) {
        select(entries[nextIndex].id)
      }
    },
    [entries, focusedFile, select, navigate]
  )

  // Loading state
  if (isLoading && entries.length === 0) {
    return (
      <div
        className={`list-view list-view--loading ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: DARK_SIDE.colors.text.muted,
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.sm,
        }}
      >
        <span style={{ color: DARK_SIDE.colors.accent.green }}>
          SCANNING...
        </span>
      </div>
    )
  }

  // Error state
  if (hasError) {
    return (
      <div
        className={`list-view list-view--error ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: DARK_SIDE.spacing['2'],
          flex: 1,
          padding: DARK_SIDE.spacing['4'],
          color: DARK_SIDE.colors.accent.red,
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.sm,
          textAlign: 'center',
        }}
      >
        <span>ERROR</span>
        <span style={{ color: DARK_SIDE.colors.text.tertiary }}>
          {errorMessage || 'Failed to load directory'}
        </span>
      </div>
    )
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div
        className={`list-view list-view--empty ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: DARK_SIDE.colors.text.muted,
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.sm,
        }}
      >
        DIRECTORY_EMPTY
      </div>
    )
  }

  return (
    <div
      className={`list-view ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: DARK_SIDE.colors.surface,
      }}
      role="grid"
      aria-label="File list"
    >
      {/* Header */}
      {showHeader && <ListHeader />}

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="list-view-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="rowgroup"
      >
        {entries.map((entry) => (
          <ListRow
            key={entry.id}
            entry={entry}
            isSelected={selectedFiles.has(entry.id)}
            isFocused={focusedFile === entry.id}
          />
        ))}
      </div>

      {/* Scrollbar styles */}
      <style>{`
        .list-view-content::-webkit-scrollbar {
          width: 6px;
        }
        .list-view-content::-webkit-scrollbar-track {
          background: ${DARK_SIDE.colors.surfaceAlt};
        }
        .list-view-content::-webkit-scrollbar-thumb {
          background: ${DARK_SIDE.colors.border.default};
        }
        .list-view-content::-webkit-scrollbar-thumb:hover {
          background: ${DARK_SIDE.colors.accent.green};
          box-shadow: 0 0 5px ${DARK_SIDE.colors.accent.greenGlow};
        }
      `}</style>
    </div>
  )
})

// =============================================================================
// Compound Export
// =============================================================================

export const ListView = Object.assign(ListViewRoot, {
  Header: ListHeader,
  Row: ListRow,
})

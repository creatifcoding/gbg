/**
 * IconView Component
 *
 * Level 3: Grid of file/folder icons.
 *
 * @module file-browser/components/Content
 */

import { memo, useCallback, useRef, useEffect, type KeyboardEvent } from 'react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import { IconTile } from './IconTile'

// =============================================================================
// Types
// =============================================================================

export type IconSize = 'sm' | 'md' | 'lg'

export interface IconViewProps {
  /** Icon size */
  iconSize?: IconSize
  /** Gap between icons */
  gap?: number
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

const IconViewRoot = memo(function IconView({
  iconSize = 'md',
  gap = 8,
  className = '',
}: IconViewProps) {
  const {
    entries,
    selectedFiles,
    focusedFile,
    isLoading,
    select,
    toggleSelect,
    rangeSelect,
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

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (entries.length === 0) return

      const currentIndex = focusedFile
        ? entries.findIndex((entry) => entry.id === focusedFile)
        : -1

      // Calculate columns based on container width
      const container = containerRef.current
      if (!container) return

      const tileWidth = iconSize === 'sm' ? 80 : iconSize === 'md' ? 100 : 120
      const cols = Math.floor(container.clientWidth / (tileWidth + gap))

      let nextIndex = currentIndex

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          nextIndex = Math.min(currentIndex + 1, entries.length - 1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          nextIndex = Math.max(currentIndex - 1, 0)
          break
        case 'ArrowDown':
          e.preventDefault()
          nextIndex = Math.min(currentIndex + cols, entries.length - 1)
          break
        case 'ArrowUp':
          e.preventDefault()
          nextIndex = Math.max(currentIndex - cols, 0)
          break
        case 'Home':
          e.preventDefault()
          nextIndex = 0
          break
        case 'End':
          e.preventDefault()
          nextIndex = entries.length - 1
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
    [entries, focusedFile, select, navigate, iconSize, gap]
  )

  // Handle tile click
  const handleTileClick = useCallback(
    (entryId: string, e: React.MouseEvent) => {
      if (e.shiftKey) {
        rangeSelect(entryId)
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelect(entryId)
      } else {
        select(entryId)
      }
    },
    [select, toggleSelect, rangeSelect]
  )

  // Handle tile double-click
  const handleTileDoubleClick = useCallback(
    (entry: (typeof entries)[0]) => {
      if (entry.type === 'directory') {
        navigate(entry.path)
      }
    },
    [navigate]
  )

  // Loading state
  if (isLoading && entries.length === 0) {
    return (
      <div
        className={`icon-view icon-view--loading ${className}`}
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
        <span style={{ color: DARK_SIDE.colors.accent.green }}>SCANNING...</span>
      </div>
    )
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div
        className={`icon-view icon-view--empty ${className}`}
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
      ref={containerRef}
      className={`icon-view ${className}`}
      style={{
        flex: 1,
        padding: DARK_SIDE.spacing['4'],
        overflowY: 'auto',
        overflowX: 'hidden',
        background: DARK_SIDE.colors.surface,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="grid"
      aria-label="File grid"
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: `${gap}px`,
        }}
      >
        {entries.map((entry) => (
          <IconTile
            key={entry.id}
            entry={entry}
            isSelected={selectedFiles.has(entry.id)}
            isFocused={focusedFile === entry.id}
            iconSize={iconSize}
            onClick={(e) => handleTileClick(entry.id, e)}
            onDoubleClick={() => handleTileDoubleClick(entry)}
          />
        ))}
      </div>

      {/* Scrollbar styles */}
      <style>{`
        .icon-view::-webkit-scrollbar {
          width: 6px;
        }
        .icon-view::-webkit-scrollbar-track {
          background: ${DARK_SIDE.colors.surfaceAlt};
        }
        .icon-view::-webkit-scrollbar-thumb {
          background: ${DARK_SIDE.colors.border.default};
        }
        .icon-view::-webkit-scrollbar-thumb:hover {
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

export const IconView = Object.assign(IconViewRoot, {
  Tile: IconTile,
})

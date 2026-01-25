/**
 * WindowManager - Emacs-Style Pane Renderer
 *
 * Renders recursive pane tree with resizable splits.
 * Uses overlayRegistry for synchronous state access.
 *
 * @module lib/windows/components/WindowManager
 */

import React, { useCallback, useRef, useState, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import {
  rootPaneAtom,
  focusedPaneIdAtom,
  windowActions,
} from '../atoms'
import {
  type PaneNode,
  type PaneId,
  type SplitPane,
  type ContentPane,
  isContentPane,
  isSplitPane,
} from '../schemas'

// =============================================================================
// Types
// =============================================================================

interface WindowManagerProps {
  /** Render function for pane content */
  renderContent: (pane: ContentPane, isFocused: boolean) => React.ReactNode
  /** Optional class name */
  className?: string
}

interface PaneRendererProps {
  node: PaneNode
  focusedId: PaneId | null
  renderContent: (pane: ContentPane, isFocused: boolean) => React.ReactNode
}

interface SplitRendererProps {
  split: SplitPane
  focusedId: PaneId | null
  renderContent: (pane: ContentPane, isFocused: boolean) => React.ReactNode
}

// =============================================================================
// Split Renderer
// =============================================================================

function SplitRenderer({ split, focusedId, renderContent }: SplitRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [ratio, setRatio] = useState(split.ratio)

  // Refs for stable handler access to latest values
  const ratioRef = useRef(ratio)
  const isDraggingRef = useRef(isDragging)

  // Sync refs with state
  useEffect(() => {
    ratioRef.current = ratio
  }, [ratio])

  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  // Sync ratio from atom
  useEffect(() => {
    setRatio(split.ratio)
  }, [split.ratio])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  // Stable handlers using refs - no dependencies on changing state
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      let newRatio: number

      if (split.direction === 'horizontal') {
        newRatio = (e.clientY - rect.top) / rect.height
      } else {
        newRatio = (e.clientX - rect.left) / rect.width
      }

      // Clamp to 10%-90%
      newRatio = Math.max(0.1, Math.min(0.9, newRatio))
      setRatio(newRatio)
    },
    [split.direction]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    // Persist to atom using ref for latest ratio
    windowActions.resizeSplit(split.id, ratioRef.current)
  }, [split.id])

  // Add/remove listeners only when drag state changes
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const isHorizontal = split.direction === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full',
        isHorizontal ? 'flex-col' : 'flex-row'
      )}
    >
      {/* First pane */}
      <div
        style={{
          [isHorizontal ? 'height' : 'width']: `${ratio * 100}%`,
        }}
        className="overflow-hidden"
      >
        <PaneRenderer
          node={split.first}
          focusedId={focusedId}
          renderContent={renderContent}
        />
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          'flex-shrink-0 bg-surface-2 hover:bg-accent-blue/50 transition-colors',
          isHorizontal
            ? 'h-1 w-full cursor-row-resize'
            : 'h-full w-1 cursor-col-resize',
          isDragging && 'bg-accent-blue'
        )}
        onMouseDown={handleMouseDown}
      />

      {/* Second pane */}
      <div
        style={{
          [isHorizontal ? 'height' : 'width']: `${(1 - ratio) * 100}%`,
        }}
        className="overflow-hidden"
      >
        <PaneRenderer
          node={split.second}
          focusedId={focusedId}
          renderContent={renderContent}
        />
      </div>
    </div>
  )
}

// =============================================================================
// Content Pane Renderer
// =============================================================================

function ContentPaneRenderer({
  pane,
  isFocused,
  renderContent,
}: {
  pane: ContentPane
  isFocused: boolean
  renderContent: (pane: ContentPane, isFocused: boolean) => React.ReactNode
}) {
  const handleFocus = useCallback(() => {
    windowActions.focusPane(pane.id)
  }, [pane.id])

  return (
    <div
      className={cn(
        'h-full w-full overflow-auto',
        isFocused && 'ring-1 ring-accent-blue ring-inset'
      )}
      onClick={handleFocus}
      onFocus={handleFocus}
    >
      {renderContent(pane, isFocused)}
    </div>
  )
}

// =============================================================================
// Pane Renderer (Recursive)
// =============================================================================

function PaneRenderer({ node, focusedId, renderContent }: PaneRendererProps) {
  if (isSplitPane(node)) {
    return (
      <SplitRenderer
        split={node}
        focusedId={focusedId}
        renderContent={renderContent}
      />
    )
  }

  if (isContentPane(node)) {
    return (
      <ContentPaneRenderer
        pane={node}
        isFocused={node.id === focusedId}
        renderContent={renderContent}
      />
    )
  }

  return null
}

// =============================================================================
// Window Manager
// =============================================================================

export function WindowManager({ renderContent, className }: WindowManagerProps) {
  const root = useAtomValue(rootPaneAtom)
  const focusedId = useAtomValue(focusedPaneIdAtom)

  return (
    <div className={cn('h-full w-full', className)}>
      <PaneRenderer
        node={root}
        focusedId={focusedId}
        renderContent={renderContent}
      />
    </div>
  )
}

export default WindowManager

/**
 * Separator — draggable divider between split panels
 *
 * SM reference: §4.3 Separators
 *   - Column separator: col-resize, 0→4px wide on hover
 *   - Expands on hover for easier grab
 *
 * Lives as a CSS Grid child between panel tracks.
 * The grid track itself is 0px; the separator expands via
 * negative margin + padding to create a grab area without
 * affecting grid layout.
 *
 * @module
 */

import { memo, useCallback, useRef, useState } from 'react'

// =============================================================================
// Constants
// =============================================================================

/** Hover/active grab area (always present for hit-testing) */
const GRAB_SIZE = 12
/** Hover highlight color — subtle surface raise (MorphChat DNA) */
const HOVER_COLOR = 'rgba(255, 255, 255, 0.06)'
/** Active/dragging highlight color — cyan accent */
const ACTIVE_COLOR = 'rgba(8, 145, 178, 0.4)'

// =============================================================================
// Props
// =============================================================================

export interface SeparatorProps {
  /** Split direction: which way the children are laid out */
  direction: 'horizontal' | 'vertical'
  /** Path identifier for this separator (used as key) */
  splitPath: string
  /** Called with delta in px when the user drags. Parent handles tree update. */
  onMove?: (delta: number) => void
}

// =============================================================================
// Component
// =============================================================================

export const Separator = memo(function Separator({
  direction,
  splitPath,
  onMove,
}: SeparatorProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const startPos = useRef(0)

  const isHorizontal = direction === 'horizontal'
  const cursor = isHorizontal ? 'col-resize' : 'row-resize'

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)

      startPos.current = isHorizontal ? e.clientX : e.clientY
      setIsDragging(true)
    },
    [isHorizontal],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const current = isHorizontal ? e.clientX : e.clientY
      const delta = current - startPos.current
      startPos.current = current
      onMove?.(delta)
    },
    [isDragging, isHorizontal, onMove],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const target = e.currentTarget as HTMLElement
      target.releasePointerCapture(e.pointerId)
      setIsDragging(false)
    },
    [],
  )

  const active = isDragging || isHovered
  const color = isDragging ? ACTIVE_COLOR : isHovered ? HOVER_COLOR : 'transparent'

  return (
    <div
      data-separator
      data-separator-direction={direction}
      data-separator-path={splitPath}
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      tabIndex={0}
      style={{
        // Grid child — track is 0px, we expand outward with negative margins
        // so the grab zone overlaps neighboring panels without affecting layout
        width: isHorizontal ? 0 : '100%',
        height: isHorizontal ? '100%' : 0,
        // Grab area extends into neighboring panels
        marginLeft: isHorizontal ? `${-(GRAB_SIZE / 2)}px` : undefined,
        marginRight: isHorizontal ? `${-(GRAB_SIZE / 2)}px` : undefined,
        marginTop: !isHorizontal ? `${-(GRAB_SIZE / 2)}px` : undefined,
        marginBottom: !isHorizontal ? `${-(GRAB_SIZE / 2)}px` : undefined,
        paddingLeft: isHorizontal ? `${GRAB_SIZE / 2}px` : undefined,
        paddingRight: isHorizontal ? `${GRAB_SIZE / 2}px` : undefined,
        paddingTop: !isHorizontal ? `${GRAB_SIZE / 2}px` : undefined,
        paddingBottom: !isHorizontal ? `${GRAB_SIZE / 2}px` : undefined,
        // Visual
        position: 'relative',
        cursor,
        background: color,
        // Smooth color transition, instant when dragging
        transition: isDragging ? 'none' : 'background 150ms ease-out',
        // Stacking
        zIndex: 10,
        // Interaction
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    />
  )
})

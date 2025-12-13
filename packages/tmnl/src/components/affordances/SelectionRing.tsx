/**
 * SelectionRing
 *
 * Visual affordance for selected items.
 * Renders as an animated border ring around the target element.
 *
 * @pattern Capability affordance (like GlowRing, Badge)
 * @module
 */

import { useRef, useEffect } from 'react'
import { COLORS, TIMING, EASING } from '@/lib/capabilities/tokens'
import type { SelectableData, AccentColor } from '@/lib/capabilities/types'

// =============================================================================
// Props
// =============================================================================

export interface SelectionRingProps extends Partial<SelectableData> {
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * Selection ring affordance.
 *
 * Renders an animated border ring that indicates selection state.
 * Supports multiple visual styles: ring, background, border.
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <Card>Content</Card>
 *   <SelectionRing selected={true} style="ring" color="cyan" />
 * </div>
 * ```
 */
export function SelectionRing({
  selected = false,
  style = 'ring',
  color = 'cyan',
  className = '',
}: SelectionRingProps) {
  const ringRef = useRef<HTMLDivElement>(null)

  // Get color tokens
  const colorTokens = COLORS[color as AccentColor] ?? COLORS.cyan

  // Animate on selection change
  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return

    if (selected) {
      // Animate in
      ring.style.opacity = '0'
      ring.style.transform = 'scale(1.02)'

      requestAnimationFrame(() => {
        ring.style.transition = `opacity ${TIMING.fast}ms ${EASING.css.easeOut}, transform ${TIMING.fast}ms ${EASING.css.easeOut}`
        ring.style.opacity = '1'
        ring.style.transform = 'scale(1)'
      })
    } else {
      // Animate out
      ring.style.transition = `opacity ${TIMING.fast}ms ${EASING.css.easeOut}`
      ring.style.opacity = '0'
    }
  }, [selected])

  if (!selected) return null

  // Style variants
  const getStyleProps = (): React.CSSProperties => {
    switch (style) {
      case 'ring':
        return {
          border: `2px solid ${colorTokens.solid}`,
          boxShadow: `
            0 0 0 1px ${colorTokens.border},
            0 0 12px ${colorTokens.glow},
            inset 0 0 8px ${colorTokens.glow}
          `,
        }
      case 'background':
        return {
          backgroundColor: colorTokens.muted,
          border: `1px solid ${colorTokens.border}`,
        }
      case 'border':
        return {
          border: `2px solid ${colorTokens.border}`,
        }
      default:
        return {}
    }
  }

  return (
    <div
      ref={ringRef}
      className={`absolute inset-0 pointer-events-none rounded ${className}`}
      style={{
        ...getStyleProps(),
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      {/* Corner accents for TMNL aesthetic */}
      {style === 'ring' && (
        <>
          <Corner position="tl" color={colorTokens.solid} />
          <Corner position="tr" color={colorTokens.solid} />
          <Corner position="bl" color={colorTokens.solid} />
          <Corner position="br" color={colorTokens.solid} />
        </>
      )}
    </div>
  )
}

// =============================================================================
// Corner Accent
// =============================================================================

function Corner({
  position,
  color,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br'
  color: string
}) {
  const size = 8
  const positionStyles: Record<string, React.CSSProperties> = {
    tl: { top: -2, left: -2 },
    tr: { top: -2, right: -2 },
    bl: { bottom: -2, left: -2 },
    br: { bottom: -2, right: -2 },
  }

  const borderStyles: Record<string, React.CSSProperties> = {
    tl: { borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` },
    tr: { borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` },
    bl: { borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` },
    br: { borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` },
  }

  return (
    <div
      className="absolute"
      style={{
        width: size,
        height: size,
        ...positionStyles[position],
        ...borderStyles[position],
      }}
    />
  )
}

export default SelectionRing

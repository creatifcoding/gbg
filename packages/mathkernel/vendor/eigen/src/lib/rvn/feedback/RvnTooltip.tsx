/**
 * RvnTooltip - Brutalist Tooltip
 *
 * Simple hover tooltip with black background and monospace text.
 * No animations, no fanciness - just brutalist information display.
 *
 * Features:
 * - 4 positions: top, bottom, left, right
 * - Black bg, white text, monospace font
 * - No border-radius (0px corners)
 * - 10px padding, compact display
 *
 * @example
 * ```tsx
 * <RvnTooltip content="UNIT STATUS: ACTIVE">
 *   <button>TX-99</button>
 * </RvnTooltip>
 * ```
 */

import * as React from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnTooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface RvnTooltipProps {
  /** Trigger element */
  children: React.ReactElement
  /** Tooltip content */
  content: React.ReactNode
  /** Tooltip position relative to trigger */
  position?: RvnTooltipPosition
  /** Delay before showing (ms) */
  showDelay?: number
  /** Delay before hiding (ms) */
  hideDelay?: number
  /** Additional inline styles for tooltip */
  style?: React.CSSProperties
  /** Disable tooltip */
  disabled?: boolean
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const OFFSET = 8 // Gap between trigger and tooltip

// Position-specific styles
const POSITION_STYLES: Record<RvnTooltipPosition, React.CSSProperties> = {
  top: {
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: `${OFFSET}px`,
  },
  bottom: {
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: `${OFFSET}px`,
  },
  left: {
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: `${OFFSET}px`,
  },
  right: {
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: `${OFFSET}px`,
  },
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  wrapper: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  tooltip: {
    position: 'absolute' as const,
    zIndex: 9999,
    padding: '10px',
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.regular,
    lineHeight: 1.3,
    whiteSpace: 'nowrap' as const,
    borderRadius: RVN_BORDERS.radius,
    pointerEvents: 'none' as const,
  },
} as const

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RvnTooltip - Brutalist hover tooltip
 *
 * @example Top position (default)
 * ```tsx
 * <RvnTooltip content="DEPLOY UNIT">
 *   <RvnButton>DEPLOY</RvnButton>
 * </RvnTooltip>
 * ```
 *
 * @example Right position with multiline
 * ```tsx
 * <RvnTooltip
 *   content={<>STATUS: ACTIVE<br />FUEL: 87%</>}
 *   position="right"
 * >
 *   <span>TX-99</span>
 * </RvnTooltip>
 * ```
 */
export function RvnTooltip({
  children,
  content,
  position = 'top',
  showDelay = 200,
  hideDelay = 0,
  style,
  disabled = false,
}: RvnTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const showTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimeouts = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const handleMouseEnter = () => {
    if (disabled) return
    clearTimeouts()
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, showDelay)
  }

  const handleMouseLeave = () => {
    clearTimeouts()
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, hideDelay)
  }

  const handleFocus = () => {
    if (disabled) return
    clearTimeouts()
    setIsVisible(true)
  }

  const handleBlur = () => {
    clearTimeouts()
    setIsVisible(false)
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => clearTimeouts()
  }, [])

  const tooltipStyle: React.CSSProperties = {
    ...styles.tooltip,
    ...POSITION_STYLES[position],
    ...style,
  }

  // Generate unique ID for accessibility
  const tooltipId = React.useId()

  return (
    <span
      style={styles.wrapper}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-rvn-tooltip-wrapper=""
    >
      {React.cloneElement(children, {
        'aria-describedby': isVisible ? tooltipId : undefined,
      })}
      {isVisible && !disabled && (
        <span
          id={tooltipId}
          style={tooltipStyle}
          role="tooltip"
          data-rvn-tooltip=""
          data-position={position}
        >
          {content}
        </span>
      )}
    </span>
  )
}

RvnTooltip.displayName = 'RvnTooltip'

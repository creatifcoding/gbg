/**
 * RvnCard - Simple Card Component
 *
 * Brutalist card with 3px border, 4px offset shadow, and sharp edges.
 * Simpler than Panel - use for content blocks without header/footer structure.
 *
 * @example
 * ```tsx
 * <RvnCard>
 *   <h2>Card Title</h2>
 *   <p>Card content...</p>
 * </RvnCard>
 * ```
 *
 * @example With shadow disabled
 * ```tsx
 * <RvnCard shadow={false}>
 *   <p>Flat card without shadow</p>
 * </RvnCard>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Enable box shadow (default: true) */
  shadow?: boolean
  /** Padding size variant */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Interactive card with hover state */
  interactive?: boolean
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const paddingSizes = {
  none: '0',
  sm: 'var(--rvn-space-s, 10px)',
  md: 'var(--rvn-space-m, 20px)',
  lg: 'var(--rvn-space-l, 30px)',
} as const

const styles = {
  base: {
    border: 'var(--rvn-border, 3px solid #000000)',
    background: 'var(--rvn-surface, #ffffff)',
    borderRadius: 'var(--rvn-radius, 0)',
    position: 'relative' as const,
    transition: 'box-shadow 100ms ease-out, transform 100ms ease-out',
  },
  shadow: {
    boxShadow: 'var(--rvn-shadow, 4px 4px 0px rgba(0, 0, 0, 1))',
  },
  interactive: {
    cursor: 'pointer',
  },
  interactiveHover: {
    boxShadow: 'var(--rvn-shadow-lg, 6px 6px 0px rgba(0, 0, 0, 1))',
  },
  interactiveActive: {
    boxShadow: 'none',
    transform: 'translate(4px, 4px)',
  },
} as const

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Brutalist card component
 */
export function RvnCard({
  children,
  shadow = true,
  padding = 'lg',
  interactive = false,
  style,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  ...props
}: RvnCardProps) {
  const [isPressed, setIsPressed] = React.useState(false)

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsPressed(true)
      }
      onMouseDown?.(e)
    },
    [interactive, onMouseDown]
  )

  const handleMouseUp = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsPressed(false)
      }
      onMouseUp?.(e)
    },
    [interactive, onMouseUp]
  )

  const handleMouseLeave = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsPressed(false)
      }
      onMouseLeave?.(e)
    },
    [interactive, onMouseLeave]
  )

  const cardStyle: React.CSSProperties = {
    ...styles.base,
    padding: paddingSizes[padding],
    ...(shadow && styles.shadow),
    ...(interactive && styles.interactive),
    ...(interactive && isPressed && styles.interactiveActive),
    ...style,
  }

  return (
    <div
      style={cardStyle}
      data-rvn-card=""
      data-interactive={interactive ? '' : undefined}
      data-pressed={isPressed ? '' : undefined}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Name
// -----------------------------------------------------------------------------

RvnCard.displayName = 'RvnCard'

// -----------------------------------------------------------------------------
// Export Types
// -----------------------------------------------------------------------------

export type { RvnCardProps }

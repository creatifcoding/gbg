/**
 * RvnTabButton
 *
 * Numbered tab button with right border separation.
 * Used in tabbed interfaces for data panels.
 *
 * Patterns extracted from:
 * - react-app(25).js: TabButton with numbered prefix
 *
 * @example
 * ```tsx
 * <RvnTabButton index={1} active onClick={handleClick}>Overview</RvnTabButton>
 * <RvnTabButton index={2}>Details</RvnTabButton>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnTabButtonProps {
  children: React.ReactNode
  /** Tab index number (displayed as prefix) */
  index?: number
  /** Whether this tab is active */
  active?: boolean
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  /** Disable the tab */
  disabled?: boolean
  /** Hide the right border (for last item) */
  noBorder?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const baseStyles: React.CSSProperties = {
  fontFamily: 'var(--rvn-font-mono)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  background: 'transparent',
  border: 'none',
  borderRight: '1px solid var(--rvn-border, #000000)',
  padding: 'var(--rvn-space-s, 10px) var(--rvn-space-m, 20px)',
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rvn-space-xs, 4px)',
}

const getStateStyles = (
  active: boolean,
  hovered: boolean,
  disabled: boolean
): React.CSSProperties => {
  if (disabled) {
    return {
      color: 'var(--rvn-text-subtle, #999999)',
      background: 'transparent',
      cursor: 'not-allowed',
      opacity: 0.5,
    }
  }

  if (active) {
    return {
      color: 'var(--rvn-text-inverse, #ffffff)',
      background: 'var(--rvn-text-main, #000000)',
    }
  }

  if (hovered) {
    return {
      color: 'var(--rvn-text-main, #000000)',
      background: 'var(--rvn-surface-highlight, #f0f0f0)',
    }
  }

  return {
    color: 'var(--rvn-text-muted, #666666)',
    background: 'transparent',
  }
}

const indexStyles: React.CSSProperties = {
  fontWeight: 900,
  opacity: 0.5,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnTabButton = React.forwardRef<HTMLButtonElement, RvnTabButtonProps>(
  (
    {
      children,
      index,
      active = false,
      onClick,
      disabled = false,
      noBorder = false,
      className,
      style,
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false)

    const combinedStyles: React.CSSProperties = {
      ...baseStyles,
      ...getStateStyles(active, isHovered, disabled),
      ...(noBorder ? { borderRight: 'none' } : {}),
      ...style,
    }

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        style={combinedStyles}
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => !disabled && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-selected={active}
        role="tab"
      >
        {index !== undefined && (
          <span style={indexStyles}>{String(index).padStart(2, '0')}</span>
        )}
        {children}
      </button>
    )
  }
)

RvnTabButton.displayName = 'RvnTabButton'

export type { RvnTabButtonProps }

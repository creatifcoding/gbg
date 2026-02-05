/**
 * RvnNavItem
 *
 * Navigation item with brutalist active state.
 * Active state: inverted colors (black bg, white text)
 * Hover follows same pattern.
 *
 * Patterns extracted from:
 * - react-app(24).js: Nav items with active state
 * - react-app(31).js: NavItem component with hover
 *
 * @example
 * ```tsx
 * <RvnNavItem active>Briefing</RvnNavItem>
 * <RvnNavItem onClick={() => navigate('/intel')}>Intel</RvnNavItem>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnNavItemProps {
  children: React.ReactNode
  /** Whether this item is active */
  active?: boolean
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
  /** Link href (defaults to #) */
  href?: string
  /** Disable the item */
  disabled?: boolean
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
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  textTransform: 'uppercase',
  transition: 'all 0.2s',
  cursor: 'pointer',
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
      padding: '0',
      cursor: 'not-allowed',
      opacity: 0.5,
    }
  }

  if (active || hovered) {
    return {
      color: 'var(--rvn-text-inverse, #ffffff)',
      background: 'var(--rvn-text-main, #000000)',
      padding: '0 5px',
    }
  }

  return {
    color: 'var(--rvn-text-muted, #666666)',
    background: 'transparent',
    padding: '0',
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnNavItem = React.forwardRef<HTMLAnchorElement, RvnNavItemProps>(
  (
    {
      children,
      active = false,
      onClick,
      href = '#',
      disabled = false,
      className,
      style,
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false)

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      if (!disabled && onClick) {
        onClick(e)
      }
    }

    const combinedStyles: React.CSSProperties = {
      ...baseStyles,
      ...getStateStyles(active, isHovered, disabled),
      ...style,
    }

    return (
      <a
        ref={ref}
        href={disabled ? undefined : href}
        className={className}
        style={combinedStyles}
        onClick={handleClick}
        onMouseEnter={() => !disabled && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled}
      >
        {children}
      </a>
    )
  }
)

RvnNavItem.displayName = 'RvnNavItem'

export type { RvnNavItemProps }

/**
 * RvnTabBar
 *
 * Container for RvnTabButton components.
 * Provides consistent layout and optional border.
 *
 * @example
 * ```tsx
 * <RvnTabBar>
 *   <RvnTabButton index={1} active>Overview</RvnTabButton>
 *   <RvnTabButton index={2}>Details</RvnTabButton>
 *   <RvnTabButton index={3} noBorder>History</RvnTabButton>
 * </RvnTabBar>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnTabBarProps {
  children: React.ReactNode
  /** Show border around the tab bar */
  bordered?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const tabBarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
}

const borderedStyles: React.CSSProperties = {
  border: 'var(--rvn-border-width, 3px) solid var(--rvn-border, #000000)',
  background: 'var(--rvn-surface, #ffffff)',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnTabBar = React.forwardRef<HTMLDivElement, RvnTabBarProps>(
  ({ children, bordered = false, className, style }, ref) => {
    const combinedStyles: React.CSSProperties = {
      ...tabBarStyles,
      ...(bordered ? borderedStyles : {}),
      ...style,
    }

    return (
      <div
        ref={ref}
        className={className}
        style={combinedStyles}
        role="tablist"
      >
        {children}
      </div>
    )
  }
)

RvnTabBar.displayName = 'RvnTabBar'

export type { RvnTabBarProps }

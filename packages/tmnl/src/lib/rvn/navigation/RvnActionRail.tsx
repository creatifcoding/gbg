/**
 * RvnActionRail
 *
 * Vertical action button strip (80px wide).
 * Used for primary actions in sidebar layouts.
 *
 * Patterns extracted from:
 * - react-app(31).js: ActionRail concept
 * - spacing.ts: actionRailWidth (80px)
 *
 * @example
 * ```tsx
 * <RvnActionRail>
 *   <RvnActionRail.Button icon={<HomeIcon />} label="Home" active />
 *   <RvnActionRail.Button icon={<SettingsIcon />} label="Settings" />
 *   <RvnActionRail.Spacer />
 *   <RvnActionRail.Button icon={<LogoutIcon />} label="Exit" />
 * </RvnActionRail>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnActionRailProps {
  children: React.ReactNode
  /** Position on screen */
  position?: 'left' | 'right'
  /** Show border */
  bordered?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnActionRailButtonProps {
  /** Icon element */
  icon: React.ReactNode
  /** Accessible label (shown on hover/screen readers) */
  label: string
  /** Whether this action is active */
  active?: boolean
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  /** Disable the button */
  disabled?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnActionRailSpacerProps {
  /** Flex grow value (default: 1) */
  grow?: number
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const railStyles: React.CSSProperties = {
  width: 'var(--rvn-action-rail-width, 80px)',
  minWidth: 'var(--rvn-action-rail-width, 80px)',
  maxWidth: 'var(--rvn-action-rail-width, 80px)',
  background: 'var(--rvn-surface, #ffffff)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: 'var(--rvn-space-s, 10px) 0',
  gap: 'var(--rvn-space-xs, 4px)',
  height: '100%',
}

const buttonBaseStyles: React.CSSProperties = {
  width: '56px',
  height: '56px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  border: '2px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontFamily: 'var(--rvn-font-mono)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
}

const getButtonStateStyles = (
  active: boolean,
  hovered: boolean,
  disabled: boolean
): React.CSSProperties => {
  if (disabled) {
    return {
      color: 'var(--rvn-text-subtle, #999999)',
      borderColor: 'transparent',
      opacity: 0.5,
      cursor: 'not-allowed',
    }
  }

  if (active) {
    return {
      color: 'var(--rvn-text-inverse, #ffffff)',
      background: 'var(--rvn-text-main, #000000)',
      borderColor: 'var(--rvn-border, #000000)',
    }
  }

  if (hovered) {
    return {
      color: 'var(--rvn-text-main, #000000)',
      borderColor: 'var(--rvn-border, #000000)',
    }
  }

  return {
    color: 'var(--rvn-text-muted, #666666)',
    borderColor: 'transparent',
  }
}

const iconContainerStyles: React.CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

const RvnActionRailButton = React.forwardRef<
  HTMLButtonElement,
  RvnActionRailButtonProps
>(
  (
    {
      icon,
      label,
      active = false,
      onClick,
      disabled = false,
      className,
      style,
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false)

    const combinedStyles: React.CSSProperties = {
      ...buttonBaseStyles,
      ...getButtonStateStyles(active, isHovered, disabled),
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
        aria-label={label}
        title={label}
        aria-pressed={active}
      >
        <div style={iconContainerStyles}>{icon}</div>
      </button>
    )
  }
)
RvnActionRailButton.displayName = 'RvnActionRail.Button'

const RvnActionRailSpacer: React.FC<RvnActionRailSpacerProps> = ({
  grow = 1,
}) => {
  return <div style={{ flex: grow }} aria-hidden="true" />
}
RvnActionRailSpacer.displayName = 'RvnActionRail.Spacer'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const RvnActionRailRoot = React.forwardRef<HTMLElement, RvnActionRailProps>(
  (
    { children, position = 'left', bordered = true, className, style },
    ref
  ) => {
    const borderStyle =
      bordered && position === 'left'
        ? { borderRight: 'var(--rvn-border-width, 3px) solid var(--rvn-border, #000000)' }
        : bordered && position === 'right'
          ? { borderLeft: 'var(--rvn-border-width, 3px) solid var(--rvn-border, #000000)' }
          : {}

    const combinedStyles: React.CSSProperties = {
      ...railStyles,
      ...borderStyle,
      ...style,
    }

    return (
      <nav
        ref={ref}
        className={className}
        style={combinedStyles}
        aria-label="Action rail"
      >
        {children}
      </nav>
    )
  }
)
RvnActionRailRoot.displayName = 'RvnActionRail'

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnActionRail = Object.assign(RvnActionRailRoot, {
  Button: RvnActionRailButton,
  Spacer: RvnActionRailSpacer,
})

export type {
  RvnActionRailProps,
  RvnActionRailButtonProps,
  RvnActionRailSpacerProps,
}

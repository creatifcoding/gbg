/**
 * RvnToolbar - Brutalist Toolbar Component
 *
 * Wraps Base UI Toolbar with RVN styling:
 * - 3px border
 * - Black background
 * - Icon button layout
 *
 * @example
 * ```tsx
 * <RvnToolbar.Root>
 *   <RvnToolbar.Button>
 *     <Icon />
 *   </RvnToolbar.Button>
 *   <RvnToolbar.Separator />
 *   <RvnToolbar.Group>
 *     <RvnToolbar.Button>A</RvnToolbar.Button>
 *     <RvnToolbar.Button>B</RvnToolbar.Button>
 *   </RvnToolbar.Group>
 * </RvnToolbar.Root>
 * ```
 */

import * as React from 'react'
import { Toolbar } from '@base-ui-components/react/toolbar'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnToolbarRootProps extends React.ComponentProps<typeof Toolbar.Root> {
  /** Toolbar visual variant */
  variant?: 'default' | 'inverted'
}

export interface RvnToolbarButtonProps extends React.ComponentProps<typeof Toolbar.Button> {
  /** Is this button currently active/pressed */
  active?: boolean
}

export interface RvnToolbarSeparatorProps extends React.ComponentProps<typeof Toolbar.Separator> {}
export interface RvnToolbarGroupProps extends React.ComponentProps<typeof Toolbar.Group> {}
export interface RvnToolbarLinkProps extends React.ComponentProps<typeof Toolbar.Link> {}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface RvnToolbarContextValue {
  variant: 'default' | 'inverted'
}

const RvnToolbarContext = React.createContext<RvnToolbarContextValue>({
  variant: 'default',
})

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: RVN_SPACING.xs,
    padding: RVN_SPACING.xs,
    border: RVN_BORDERS.primary,
    background: RVN_COLORS.black,
    borderRadius: RVN_BORDERS.radius,
  } as React.CSSProperties,
  rootInverted: {
    background: RVN_COLORS.surface,
  } as React.CSSProperties,
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    minHeight: '32px',
    padding: RVN_SPACING.xs,
    background: 'transparent',
    border: 'none',
    color: RVN_COLORS.textInverse,
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    borderRadius: RVN_BORDERS.radius,
  } as React.CSSProperties,
  buttonInverted: {
    color: RVN_COLORS.textMain,
  } as React.CSSProperties,
  buttonHover: {
    background: 'rgba(255, 255, 255, 0.1)',
  } as React.CSSProperties,
  buttonHoverInverted: {
    background: RVN_COLORS.surfaceHighlight,
  } as React.CSSProperties,
  buttonActive: {
    background: RVN_COLORS.white,
    color: RVN_COLORS.black,
  } as React.CSSProperties,
  buttonActiveInverted: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
  } as React.CSSProperties,
  separator: {
    width: '1px',
    height: '24px',
    background: 'rgba(255, 255, 255, 0.3)',
    margin: `0 ${RVN_SPACING.xs}`,
  } as React.CSSProperties,
  separatorInverted: {
    background: RVN_COLORS.borderMuted,
  } as React.CSSProperties,
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  } as React.CSSProperties,
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    minHeight: '32px',
    padding: RVN_SPACING.xs,
    color: RVN_COLORS.textInverse,
    textDecoration: 'none',
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    transition: 'all 0.15s ease',
  } as React.CSSProperties,
  linkInverted: {
    color: RVN_COLORS.textMain,
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLDivElement, RvnToolbarRootProps>(
  ({ variant = 'default', style, ...props }, ref) => (
    <RvnToolbarContext.Provider value={{ variant }}>
      <Toolbar.Root
        ref={ref}
        style={{
          ...styles.root,
          ...(variant === 'inverted' ? styles.rootInverted : {}),
          ...style,
        }}
        {...props}
      />
    </RvnToolbarContext.Provider>
  )
)
Root.displayName = 'RvnToolbar.Root'

const Button = React.forwardRef<HTMLButtonElement, RvnToolbarButtonProps>(
  ({ active = false, style, ...props }, ref) => {
    const { variant } = React.useContext(RvnToolbarContext)
    const [isHovered, setIsHovered] = React.useState(false)
    const isInverted = variant === 'inverted'

    const getActiveStyle = () => {
      if (!active) return {}
      return isInverted ? styles.buttonActiveInverted : styles.buttonActive
    }

    const getHoverStyle = () => {
      if (!isHovered || active) return {}
      return isInverted ? styles.buttonHoverInverted : styles.buttonHover
    }

    return (
      <Toolbar.Button
        ref={ref}
        style={{
          ...styles.button,
          ...(isInverted ? styles.buttonInverted : {}),
          ...getHoverStyle(),
          ...getActiveStyle(),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-active={active || undefined}
        {...props}
      />
    )
  }
)
Button.displayName = 'RvnToolbar.Button'

const Separator = React.forwardRef<HTMLDivElement, RvnToolbarSeparatorProps>(
  ({ style, ...props }, ref) => {
    const { variant } = React.useContext(RvnToolbarContext)

    return (
      <Toolbar.Separator
        ref={ref}
        style={{
          ...styles.separator,
          ...(variant === 'inverted' ? styles.separatorInverted : {}),
          ...style,
        }}
        {...props}
      />
    )
  }
)
Separator.displayName = 'RvnToolbar.Separator'

const Group = React.forwardRef<HTMLDivElement, RvnToolbarGroupProps>(
  ({ style, ...props }, ref) => (
    <Toolbar.Group
      ref={ref}
      style={{ ...styles.group, ...style }}
      {...props}
    />
  )
)
Group.displayName = 'RvnToolbar.Group'

const Link = React.forwardRef<HTMLAnchorElement, RvnToolbarLinkProps>(
  ({ style, ...props }, ref) => {
    const { variant } = React.useContext(RvnToolbarContext)
    const [isHovered, setIsHovered] = React.useState(false)

    return (
      <Toolbar.Link
        ref={ref}
        style={{
          ...styles.link,
          ...(variant === 'inverted' ? styles.linkInverted : {}),
          ...(isHovered
            ? variant === 'inverted'
              ? styles.buttonHoverInverted
              : styles.buttonHover
            : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    )
  }
)
Link.displayName = 'RvnToolbar.Link'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnToolbar = {
  Root,
  Button,
  Separator,
  Group,
  Link,
}

export {
  Root as RvnToolbarRoot,
  Button as RvnToolbarButton,
  Separator as RvnToolbarSeparator,
  Group as RvnToolbarGroup,
  Link as RvnToolbarLink,
}

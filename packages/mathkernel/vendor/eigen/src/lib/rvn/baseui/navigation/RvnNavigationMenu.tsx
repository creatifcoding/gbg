/**
 * RvnNavigationMenu - Brutalist Navigation Menu Component
 *
 * Wraps Base UI NavigationMenu with RVN styling:
 * - Horizontal layout
 * - Inverted active state (black bg, white text)
 * - Uppercase text
 *
 * @example
 * ```tsx
 * <RvnNavigationMenu.Root>
 *   <RvnNavigationMenu.List>
 *     <RvnNavigationMenu.Item>
 *       <RvnNavigationMenu.Link href="/briefing" active>Briefing</RvnNavigationMenu.Link>
 *     </RvnNavigationMenu.Item>
 *     <RvnNavigationMenu.Item>
 *       <RvnNavigationMenu.Link href="/deployments">Deployments</RvnNavigationMenu.Link>
 *     </RvnNavigationMenu.Item>
 *   </RvnNavigationMenu.List>
 * </RvnNavigationMenu.Root>
 * ```
 */

import * as React from 'react'
import { NavigationMenu } from '@base-ui-components/react/navigation-menu'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnNavigationMenuRootProps extends React.ComponentProps<typeof NavigationMenu.Root> {}
export interface RvnNavigationMenuListProps extends React.ComponentProps<typeof NavigationMenu.List> {}
export interface RvnNavigationMenuItemProps extends React.ComponentProps<typeof NavigationMenu.Item> {}

export interface RvnNavigationMenuLinkProps extends React.ComponentProps<typeof NavigationMenu.Link> {
  /** Whether this link is currently active */
  active?: boolean
}

export interface RvnNavigationMenuTriggerProps extends React.ComponentProps<typeof NavigationMenu.Trigger> {
  /** Whether this trigger is currently active */
  active?: boolean
}

export interface RvnNavigationMenuPortalProps extends React.ComponentProps<typeof NavigationMenu.Portal> {}
export interface RvnNavigationMenuContentProps extends React.ComponentProps<typeof NavigationMenu.Content> {}
export interface RvnNavigationMenuViewportProps extends React.ComponentProps<typeof NavigationMenu.Viewport> {}

// Note: Base UI NavigationMenu does not have an Indicator component
// We provide a custom indicator implementation below

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  list: {
    display: 'flex',
    alignItems: 'center',
    gap: RVN_SPACING.l,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  item: {
    position: 'relative' as const,
  } as React.CSSProperties,
  link: {
    display: 'inline-block',
    color: RVN_COLORS.textMuted,
    textDecoration: 'none',
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    padding: `0 ${RVN_SPACING.xs}`,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    fontFamily: 'inherit',
    textTransform: 'inherit' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  linkActive: {
    color: RVN_COLORS.textInverse,
    background: RVN_COLORS.black,
    padding: `0 ${RVN_SPACING.xs}`,
  } as React.CSSProperties,
  linkHover: {
    color: RVN_COLORS.textMain,
  } as React.CSSProperties,
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: RVN_SPACING.xs,
    color: RVN_COLORS.textMuted,
    textDecoration: 'none',
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    padding: `0 ${RVN_SPACING.xs}`,
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    fontFamily: 'inherit',
    textTransform: 'inherit' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  content: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    background: RVN_COLORS.surface,
    border: `3px solid ${RVN_COLORS.border}`,
    minWidth: '200px',
    padding: RVN_SPACING.m,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
    zIndex: 1000,
  } as React.CSSProperties,
  viewport: {
    position: 'relative' as const,
  } as React.CSSProperties,
  indicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    height: '3px',
    background: RVN_COLORS.black,
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLDivElement, RvnNavigationMenuRootProps>(
  ({ style, ...props }, ref) => (
    <NavigationMenu.Root
      ref={ref}
      style={{ ...styles.root, ...style }}
      {...props}
    />
  )
)
Root.displayName = 'RvnNavigationMenu.Root'

const List = React.forwardRef<HTMLDivElement, RvnNavigationMenuListProps>(
  ({ style, ...props }, ref) => (
    <NavigationMenu.List
      ref={ref}
      style={{ ...styles.list, ...style }}
      {...props}
    />
  )
)
List.displayName = 'RvnNavigationMenu.List'

const Item = React.forwardRef<HTMLDivElement, RvnNavigationMenuItemProps>(
  ({ style, ...props }, ref) => (
    <NavigationMenu.Item
      ref={ref}
      style={{ ...styles.item, ...style }}
      {...props}
    />
  )
)
Item.displayName = 'RvnNavigationMenu.Item'

const Link = React.forwardRef<HTMLAnchorElement, RvnNavigationMenuLinkProps>(
  ({ active, style, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)

    return (
      <NavigationMenu.Link
        ref={ref}
        style={{
          ...styles.link,
          ...(isHovered && !active ? styles.linkHover : {}),
          ...(active ? styles.linkActive : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    )
  }
)
Link.displayName = 'RvnNavigationMenu.Link'

const Trigger = React.forwardRef<HTMLButtonElement, RvnNavigationMenuTriggerProps>(
  ({ active, style, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)

    return (
      <NavigationMenu.Trigger
        ref={ref}
        style={{
          ...styles.trigger,
          ...(isHovered && !active ? styles.linkHover : {}),
          ...(active ? styles.linkActive : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      />
    )
  }
)
Trigger.displayName = 'RvnNavigationMenu.Trigger'

const Portal = (props: RvnNavigationMenuPortalProps) => <NavigationMenu.Portal {...props} />
Portal.displayName = 'RvnNavigationMenu.Portal'

const Content = React.forwardRef<HTMLDivElement, RvnNavigationMenuContentProps>(
  ({ style, ...props }, ref) => (
    <NavigationMenu.Content
      ref={ref}
      style={{ ...styles.content, ...style }}
      {...props}
    />
  )
)
Content.displayName = 'RvnNavigationMenu.Content'

const Viewport = React.forwardRef<HTMLDivElement, RvnNavigationMenuViewportProps>(
  ({ style, ...props }, ref) => (
    <NavigationMenu.Viewport
      ref={ref}
      style={{ ...styles.viewport, ...style }}
      {...props}
    />
  )
)
Viewport.displayName = 'RvnNavigationMenu.Viewport'

// Custom Indicator component (Base UI NavigationMenu doesn't have one)
// This is a simple styled div that can be used as a visual indicator
export interface RvnNavigationMenuIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {}

const Indicator = React.forwardRef<HTMLDivElement, RvnNavigationMenuIndicatorProps>(
  ({ style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.indicator, ...style }}
      {...props}
    />
  )
)
Indicator.displayName = 'RvnNavigationMenu.Indicator'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnNavigationMenu = {
  Root,
  List,
  Item,
  Link,
  Trigger,
  Portal,
  Content,
  Viewport,
  Indicator,
}

export {
  Root as RvnNavigationMenuRoot,
  List as RvnNavigationMenuList,
  Item as RvnNavigationMenuItem,
  Link as RvnNavigationMenuLink,
  Trigger as RvnNavigationMenuTrigger,
  Portal as RvnNavigationMenuPortal,
  Content as RvnNavigationMenuContent,
  Viewport as RvnNavigationMenuViewport,
  Indicator as RvnNavigationMenuIndicator,
}

/**
 * RvnMenubar - Brutalist Menubar Component
 *
 * Wraps Base UI Menubar (container) and Menu (compound) with RVN styling:
 * - Black background, white text
 * - 3px border bottom
 * - Inverted active items
 *
 * Base UI Pattern:
 * - Menubar is a simple container component
 * - Menu.Root/Trigger/Portal/Positioner/Popup/Item are used for each menu
 *
 * @example
 * ```tsx
 * <RvnMenubar.Root>
 *   <RvnMenubar.Menu>
 *     <RvnMenubar.Trigger>File</RvnMenubar.Trigger>
 *     <RvnMenubar.Portal>
 *       <RvnMenubar.Positioner>
 *         <RvnMenubar.Popup>
 *           <RvnMenubar.Item>New</RvnMenubar.Item>
 *           <RvnMenubar.Item>Open</RvnMenubar.Item>
 *         </RvnMenubar.Popup>
 *       </RvnMenubar.Positioner>
 *     </RvnMenubar.Portal>
 *   </RvnMenubar.Menu>
 * </RvnMenubar.Root>
 * ```
 */

import * as React from 'react'
import { Menubar } from '@base-ui-components/react/menubar'
import { Menu } from '@base-ui-components/react/menu'
import { Separator } from '@base-ui-components/react/separator'
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

export interface RvnMenubarRootProps extends React.ComponentProps<typeof Menubar> {}
export interface RvnMenubarMenuProps extends React.ComponentProps<typeof Menu.Root> {}
export interface RvnMenubarTriggerProps extends React.ComponentProps<typeof Menu.Trigger> {}
export interface RvnMenubarPortalProps extends React.ComponentProps<typeof Menu.Portal> {}
export interface RvnMenubarPositionerProps extends React.ComponentProps<typeof Menu.Positioner> {}
export interface RvnMenubarPopupProps extends React.ComponentProps<typeof Menu.Popup> {}
export interface RvnMenubarItemProps extends React.ComponentProps<typeof Menu.Item> {}
export interface RvnMenubarSeparatorProps extends React.ComponentProps<typeof Separator> {}
export interface RvnMenubarGroupProps extends React.ComponentProps<typeof Menu.Group> {}
export interface RvnMenubarGroupLabelProps extends React.ComponentProps<typeof Menu.GroupLabel> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    display: 'flex',
    alignItems: 'center',
    background: RVN_COLORS.black,
    borderBottom: RVN_BORDERS.primary,
    padding: `0 ${RVN_SPACING.m}`,
    minHeight: '40px',
    gap: RVN_SPACING.xs,
  } as React.CSSProperties,
  trigger: {
    background: 'transparent',
    border: 'none',
    color: RVN_COLORS.textInverse,
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.15s ease',
  } as React.CSSProperties,
  triggerActive: {
    background: RVN_COLORS.white,
    color: RVN_COLORS.black,
  } as React.CSSProperties,
  positioner: {
    zIndex: 1000,
  } as React.CSSProperties,
  popup: {
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    minWidth: '160px',
    padding: RVN_SPACING.xs,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
  } as React.CSSProperties,
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    color: RVN_COLORS.textMain,
    letterSpacing: '0.03em',
    transition: 'all 0.1s ease',
  } as React.CSSProperties,
  itemHighlighted: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
  } as React.CSSProperties,
  separator: {
    height: '1px',
    background: RVN_COLORS.border,
    margin: `${RVN_SPACING.xs} 0`,
  } as React.CSSProperties,
  groupLabel: {
    padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
    fontFamily: RVN_FONTS.mono,
    fontSize: '12px',
    color: RVN_COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

// Root is the Menubar container
const Root = React.forwardRef<HTMLDivElement, RvnMenubarRootProps>(
  ({ style, ...props }, ref) => (
    <Menubar
      ref={ref}
      style={{ ...styles.root, ...style }}
      {...props}
    />
  )
)
Root.displayName = 'RvnMenubar.Root'

// MenuWrapper wraps Menu.Root for each menu in the menubar
const MenuWrapper = (props: RvnMenubarMenuProps) => <Menu.Root {...props} />
MenuWrapper.displayName = 'RvnMenubar.Menu'

const Trigger = React.forwardRef<HTMLButtonElement, RvnMenubarTriggerProps>(
  ({ style, ...props }, ref) => {
    const [isActive, setIsActive] = React.useState(false)

    return (
      <Menu.Trigger
        ref={ref}
        style={{
          ...styles.trigger,
          ...(isActive ? styles.triggerActive : {}),
          ...style,
        }}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        {...props}
      />
    )
  }
)
Trigger.displayName = 'RvnMenubar.Trigger'

const Portal = (props: RvnMenubarPortalProps) => <Menu.Portal {...props} />
Portal.displayName = 'RvnMenubar.Portal'

const Positioner = React.forwardRef<HTMLDivElement, RvnMenubarPositionerProps>(
  ({ style, ...props }, ref) => (
    <Menu.Positioner
      ref={ref}
      style={{ ...styles.positioner, ...style }}
      {...props}
    />
  )
)
Positioner.displayName = 'RvnMenubar.Positioner'

const Popup = React.forwardRef<HTMLDivElement, RvnMenubarPopupProps>(
  ({ style, ...props }, ref) => (
    <Menu.Popup
      ref={ref}
      style={{ ...styles.popup, ...style }}
      {...props}
    />
  )
)
Popup.displayName = 'RvnMenubar.Popup'

const Item = React.forwardRef<HTMLDivElement, RvnMenubarItemProps>(
  ({ style, ...props }, ref) => {
    const [isHighlighted, setIsHighlighted] = React.useState(false)

    return (
      <Menu.Item
        ref={ref}
        style={{
          ...styles.item,
          ...(isHighlighted ? styles.itemHighlighted : {}),
          ...style,
        }}
        onMouseEnter={() => setIsHighlighted(true)}
        onMouseLeave={() => setIsHighlighted(false)}
        {...props}
      />
    )
  }
)
Item.displayName = 'RvnMenubar.Item'

const MenuSeparator = React.forwardRef<HTMLDivElement, RvnMenubarSeparatorProps>(
  ({ style, ...props }, ref) => (
    <Separator
      ref={ref}
      style={{ ...styles.separator, ...style }}
      {...props}
    />
  )
)
MenuSeparator.displayName = 'RvnMenubar.Separator'

const Group = React.forwardRef<HTMLDivElement, RvnMenubarGroupProps>(
  (props, ref) => <Menu.Group ref={ref} {...props} />
)
Group.displayName = 'RvnMenubar.Group'

const GroupLabel = React.forwardRef<HTMLDivElement, RvnMenubarGroupLabelProps>(
  ({ style, ...props }, ref) => (
    <Menu.GroupLabel
      ref={ref}
      style={{ ...styles.groupLabel, ...style }}
      {...props}
    />
  )
)
GroupLabel.displayName = 'RvnMenubar.GroupLabel'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnMenubar = {
  Root,
  Menu: MenuWrapper,
  Trigger,
  Portal,
  Positioner,
  Popup,
  Item,
  Separator: MenuSeparator,
  Group,
  GroupLabel,
}

export {
  Root as RvnMenubarRoot,
  MenuWrapper as RvnMenubarMenu,
  Trigger as RvnMenubarTrigger,
  Portal as RvnMenubarPortal,
  Positioner as RvnMenubarPositioner,
  Popup as RvnMenubarPopup,
  Item as RvnMenubarItem,
  MenuSeparator as RvnMenubarSeparator,
  Group as RvnMenubarGroup,
  GroupLabel as RvnMenubarGroupLabel,
}

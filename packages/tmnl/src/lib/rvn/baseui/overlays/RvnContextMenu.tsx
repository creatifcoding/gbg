/**
 * RvnContextMenu - Brutalist Context Menu (Base UI Wrapper)
 *
 * Wraps Base UI Menu with RVN brutalist styling for right-click context menus:
 * - 3px border menu
 * - Black bg, white text items
 * - Inverted hover state
 *
 * @example
 * ```tsx
 * <RvnContextMenu.Root>
 *   <RvnContextMenu.Trigger>
 *     <div>Right-click me</div>
 *   </RvnContextMenu.Trigger>
 *   <RvnContextMenu.Portal>
 *     <RvnContextMenu.Positioner>
 *       <RvnContextMenu.Popup>
 *         <RvnContextMenu.Item onSelect={() => console.log('Edit')}>
 *           Edit
 *         </RvnContextMenu.Item>
 *         <RvnContextMenu.Separator />
 *         <RvnContextMenu.Item onSelect={() => console.log('Delete')}>
 *           Delete
 *         </RvnContextMenu.Item>
 *       </RvnContextMenu.Popup>
 *     </RvnContextMenu.Positioner>
 *   </RvnContextMenu.Portal>
 * </RvnContextMenu.Root>
 * ```
 */

import * as React from 'react'
import { Menu } from '@base-ui-components/react/menu'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SHADOWS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnContextMenuPopupProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Popup> {
  minWidth?: string
}

export interface RvnContextMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Item> {
  destructive?: boolean
}

export interface RvnContextMenuSeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnContextMenuLabelProps
  extends React.HTMLAttributes<HTMLDivElement> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  popup: {
    background: RVN_COLORS.black,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: RVN_SHADOWS.default,
    padding: `${RVN_SPACING.xs} 0`,
    minWidth: '180px',
    zIndex: 1000,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: RVN_SPACING.s,
    padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
    background: 'transparent',
    color: RVN_COLORS.white,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    outline: 'none',
  },
  itemHover: {
    background: '#333333',
  },
  itemDestructive: {
    color: '#ff6b6b',
  },
  separator: {
    height: '1px',
    background: '#333333',
    margin: `${RVN_SPACING.xs} 0`,
  },
  label: {
    padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
    color: RVN_COLORS.textMuted,
    fontFamily: RVN_FONTS.mono,
    fontSize: '10px',
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Popup({ style, minWidth = '180px', children, ...props }: RvnContextMenuPopupProps) {
  return (
    <Menu.Popup
      style={{ ...styles.popup, minWidth, ...style }}
      data-rvn-context-menu-popup=""
      {...props}
    >
      {children}
    </Menu.Popup>
  )
}

function Item({ style, destructive = false, children, ...props }: RvnContextMenuItemProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  const itemStyle: React.CSSProperties = {
    ...styles.item,
    ...(isHovered ? styles.itemHover : {}),
    ...(destructive ? styles.itemDestructive : {}),
    ...style,
  }

  return (
    <Menu.Item
      style={itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-rvn-context-menu-item=""
      data-destructive={destructive || undefined}
      {...props}
    >
      {children}
    </Menu.Item>
  )
}

function Separator({ style, ...props }: RvnContextMenuSeparatorProps) {
  return (
    <div
      style={{ ...styles.separator, ...style }}
      role="separator"
      data-rvn-context-menu-separator=""
      {...props}
    />
  )
}

function Label({ style, children, ...props }: RvnContextMenuLabelProps) {
  return (
    <div
      style={{ ...styles.label, ...style }}
      data-rvn-context-menu-label=""
      {...props}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Popup.displayName = 'RvnContextMenu.Popup'
Item.displayName = 'RvnContextMenu.Item'
Separator.displayName = 'RvnContextMenu.Separator'
Label.displayName = 'RvnContextMenu.Label'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnContextMenu = {
  Root: Menu.Root,
  Trigger: Menu.Trigger,
  Portal: Menu.Portal,
  Positioner: Menu.Positioner,
  Popup,
  Item,
  Separator,
  Label,
  Group: Menu.Group,
  GroupLabel: Menu.GroupLabel,
  Arrow: Menu.Arrow,
}

export type {
  RvnContextMenuPopupProps as PopupProps,
  RvnContextMenuItemProps as ItemProps,
  RvnContextMenuSeparatorProps as SeparatorProps,
  RvnContextMenuLabelProps as LabelProps,
}

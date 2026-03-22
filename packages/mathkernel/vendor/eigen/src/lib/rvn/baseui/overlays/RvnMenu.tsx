/**
 * RvnMenu - Brutalist Dropdown Menu (Base UI Wrapper)
 *
 * Wraps Base UI Menu with RVN brutalist styling:
 * - 3px border
 * - Black items
 * - Monospace text
 *
 * @example
 * ```tsx
 * <RvnMenu.Root>
 *   <RvnMenu.Trigger>
 *     <RvnButton>Actions</RvnButton>
 *   </RvnMenu.Trigger>
 *   <RvnMenu.Portal>
 *     <RvnMenu.Positioner>
 *       <RvnMenu.Popup>
 *         <RvnMenu.Item onSelect={() => console.log('Deploy')}>
 *           Deploy Unit
 *         </RvnMenu.Item>
 *         <RvnMenu.Item onSelect={() => console.log('Status')}>
 *           Check Status
 *         </RvnMenu.Item>
 *         <RvnMenu.Separator />
 *         <RvnMenu.Item destructive onSelect={() => console.log('Recall')}>
 *           Emergency Recall
 *         </RvnMenu.Item>
 *       </RvnMenu.Popup>
 *     </RvnMenu.Positioner>
 *   </RvnMenu.Portal>
 * </RvnMenu.Root>
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

export interface RvnMenuPopupProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Popup> {
  minWidth?: string
}

export interface RvnMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.Item> {
  destructive?: boolean
  icon?: React.ReactNode
}

export interface RvnMenuSeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnMenuLabelProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnMenuCheckboxItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.CheckboxItem> {}

export interface RvnMenuRadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof Menu.RadioGroup> {}

export interface RvnMenuRadioItemProps
  extends React.ComponentPropsWithoutRef<typeof Menu.RadioItem> {}

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
    minWidth: '200px',
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
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  itemIcon: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  checkbox: {
    width: '14px',
    height: '14px',
    border: `1px solid ${RVN_COLORS.white}`,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '10px',
  },
  radio: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: `1px solid ${RVN_COLORS.white}`,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: RVN_COLORS.white,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Popup({ style, minWidth = '200px', children, ...props }: RvnMenuPopupProps) {
  return (
    <Menu.Popup
      style={{ ...styles.popup, minWidth, ...style }}
      data-rvn-menu-popup=""
      {...props}
    >
      {children}
    </Menu.Popup>
  )
}

function Item({
  style,
  destructive = false,
  icon,
  disabled,
  children,
  ...props
}: RvnMenuItemProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  const itemStyle: React.CSSProperties = {
    ...styles.item,
    ...(isHovered && !disabled ? styles.itemHover : {}),
    ...(destructive ? styles.itemDestructive : {}),
    ...(disabled ? styles.itemDisabled : {}),
    ...style,
  }

  return (
    <Menu.Item
      style={itemStyle}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-rvn-menu-item=""
      data-destructive={destructive || undefined}
      {...props}
    >
      {icon && <span style={styles.itemIcon}>{icon}</span>}
      {children}
    </Menu.Item>
  )
}

function Separator({ style, ...props }: RvnMenuSeparatorProps) {
  return (
    <div
      style={{ ...styles.separator, ...style }}
      role="separator"
      data-rvn-menu-separator=""
      {...props}
    />
  )
}

function Label({ style, children, ...props }: RvnMenuLabelProps) {
  return (
    <div
      style={{ ...styles.label, ...style }}
      data-rvn-menu-label=""
      {...props}
    >
      {children}
    </div>
  )
}

function CheckboxItem({ style, children, ...props }: RvnMenuCheckboxItemProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  const itemStyle: React.CSSProperties = {
    ...styles.item,
    ...(isHovered ? styles.itemHover : {}),
    ...style,
  }

  return (
    <Menu.CheckboxItem
      style={itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-rvn-menu-checkbox-item=""
      {...props}
    >
      <Menu.CheckboxItemIndicator
        render={<span style={styles.checkbox}>{'\u2713'}</span>}
      />
      {children}
    </Menu.CheckboxItem>
  )
}

function RadioGroup({ children, ...props }: RvnMenuRadioGroupProps) {
  return (
    <Menu.RadioGroup data-rvn-menu-radio-group="" {...props}>
      {children}
    </Menu.RadioGroup>
  )
}

function RadioItem({ style, children, ...props }: RvnMenuRadioItemProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  const itemStyle: React.CSSProperties = {
    ...styles.item,
    ...(isHovered ? styles.itemHover : {}),
    ...style,
  }

  return (
    <Menu.RadioItem
      style={itemStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-rvn-menu-radio-item=""
      {...props}
    >
      <Menu.RadioItemIndicator
        render={
          <span style={styles.radio}>
            <span style={styles.radioDot} />
          </span>
        }
      />
      {children}
    </Menu.RadioItem>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Popup.displayName = 'RvnMenu.Popup'
Item.displayName = 'RvnMenu.Item'
Separator.displayName = 'RvnMenu.Separator'
Label.displayName = 'RvnMenu.Label'
CheckboxItem.displayName = 'RvnMenu.CheckboxItem'
RadioGroup.displayName = 'RvnMenu.RadioGroup'
RadioItem.displayName = 'RvnMenu.RadioItem'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnMenu = {
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
  CheckboxItem,
  RadioGroup,
  RadioItem,
  Arrow: Menu.Arrow,
  SubmenuTrigger: Menu.SubmenuTrigger,
}

export type {
  RvnMenuPopupProps as PopupProps,
  RvnMenuItemProps as ItemProps,
  RvnMenuSeparatorProps as SeparatorProps,
  RvnMenuLabelProps as LabelProps,
  RvnMenuCheckboxItemProps as CheckboxItemProps,
  RvnMenuRadioGroupProps as RadioGroupProps,
  RvnMenuRadioItemProps as RadioItemProps,
}

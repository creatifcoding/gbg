/**
 * Context menu item definitions and accent colors.
 *
 * @module floating/components/context-menu-items
 */

import type { ReactNode } from 'react'

export interface MenuItem {
  label: string
  icon?: ReactNode
  action: () => void
  danger?: boolean
  separator?: false
}

export interface MenuSeparator {
  separator: true
}

export type MenuEntry = MenuItem | MenuSeparator

export const ACCENT_COLORS = [
  { label: 'Default', color: undefined },
  { label: 'Mauve', color: '#c4a1b1' },
  { label: 'Sage', color: '#4ade80' },
  { label: 'Amber', color: '#f59e0b' },
  { label: 'Rose', color: '#f43f5e' },
] as const

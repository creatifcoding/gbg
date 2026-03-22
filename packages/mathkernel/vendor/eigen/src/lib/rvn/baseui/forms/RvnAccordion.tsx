/**
 * RvnAccordion - Brutalist Accordion (Base UI)
 *
 * Wraps Base UI Accordion with RVN styling.
 *
 * Features:
 * - 3px black border
 * - Black header with white text
 * - No border-radius
 * - anime.js FLIP animations (optional)
 */

import * as React from 'react'
import { Accordion as BaseAccordion } from '@base-ui-components/react/accordion'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnAccordionProps {
  /** Controlled open items */
  value?: string[]
  /** Default open items (uncontrolled) */
  defaultValue?: string[]
  /** Change handler */
  onValueChange?: (value: string[]) => void
  /** Allow multiple items open */
  multiple?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Accordion items */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

export interface RvnAccordionItemProps {
  /** Item value (unique identifier) */
  value: string
  /** Disabled state */
  disabled?: boolean
  /** Item content */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

export interface RvnAccordionHeaderProps {
  /** Header content */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

export interface RvnAccordionPanelProps {
  /** Panel content */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const rootStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  overflow: 'hidden',
}

const itemStyles: CSSProperties = {
  borderBottom: RVN_BORDERS.primary,
}

const itemLastStyles: CSSProperties = {
  borderBottom: 'none',
}

const headerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '12px 16px',
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.heading,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
  textAlign: 'left',
}

const headerHoverStyles: CSSProperties = {
  background: '#222',
}

const triggerIndicatorStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: '14px',
  transition: 'transform 200ms ease-out',
}

const triggerIndicatorOpenStyles: CSSProperties = {
  transform: 'rotate(90deg)',
}

const panelStyles: CSSProperties = {
  padding: RVN_SPACING.panelPadding,
  background: RVN_COLORS.surface,
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.body,
  lineHeight: 1.5,
  color: RVN_COLORS.textMain,
  overflow: 'hidden',
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

export function RvnAccordion({
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  disabled = false,
  children,
  className,
  style,
}: RvnAccordionProps) {
  return (
    <BaseAccordion.Root
      className={clsx('rvn-accordion', className)}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      style={{ ...rootStyles, ...style }}
    >
      {children}
    </BaseAccordion.Root>
  )
}

export function RvnAccordionItem({
  value,
  disabled = false,
  children,
  className,
  style,
}: RvnAccordionItemProps) {
  return (
    <BaseAccordion.Item
      value={value}
      disabled={disabled}
      className={clsx('rvn-accordion-item', className)}
      style={{ ...itemStyles, ...style }}
    >
      {children}
    </BaseAccordion.Item>
  )
}

export function RvnAccordionHeader({
  children,
  className,
  style,
}: RvnAccordionHeaderProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <BaseAccordion.Header>
      <BaseAccordion.Trigger
        className={clsx('rvn-accordion-trigger', className)}
        style={{
          ...headerStyles,
          ...(isHovered && headerHoverStyles),
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>{children}</span>
        <span style={triggerIndicatorStyles}>&#9654;</span>
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  )
}

export function RvnAccordionPanel({
  children,
  className,
  style,
}: RvnAccordionPanelProps) {
  return (
    <BaseAccordion.Panel
      className={clsx('rvn-accordion-panel', className)}
      style={{ ...panelStyles, ...style }}
    >
      {children}
    </BaseAccordion.Panel>
  )
}

// Convenience compound export
export const Accordion = {
  Root: RvnAccordion,
  Item: RvnAccordionItem,
  Header: RvnAccordionHeader,
  Panel: RvnAccordionPanel,
}

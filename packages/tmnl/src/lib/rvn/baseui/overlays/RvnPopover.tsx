/**
 * RvnPopover - Brutalist Popover (Base UI Wrapper)
 *
 * Wraps Base UI Popover with RVN brutalist styling:
 * - 3px border
 * - 4px shadow
 * - Arrow styling
 *
 * @example
 * ```tsx
 * <RvnPopover.Root>
 *   <RvnPopover.Trigger>
 *     <RvnButton>Show Info</RvnButton>
 *   </RvnPopover.Trigger>
 *   <RvnPopover.Portal>
 *     <RvnPopover.Positioner>
 *       <RvnPopover.Popup>
 *         <RvnPopover.Arrow />
 *         <RvnPopover.Title>Unit Information</RvnPopover.Title>
 *         <RvnPopover.Body>
 *           <p>Status: Active</p>
 *           <p>Fuel: 87%</p>
 *         </RvnPopover.Body>
 *       </RvnPopover.Popup>
 *     </RvnPopover.Positioner>
 *   </RvnPopover.Portal>
 * </RvnPopover.Root>
 * ```
 */

import * as React from 'react'
import { Popover } from '@base-ui-components/react/popover'
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

export interface RvnPopoverPopupProps
  extends React.ComponentPropsWithoutRef<typeof Popover.Popup> {
  minWidth?: string
  maxWidth?: string
}

export interface RvnPopoverArrowProps
  extends React.ComponentPropsWithoutRef<typeof Popover.Arrow> {}

export interface RvnPopoverTitleProps
  extends React.ComponentPropsWithoutRef<typeof Popover.Title> {}

export interface RvnPopoverDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof Popover.Description> {}

export interface RvnPopoverBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnPopoverCloseProps
  extends React.ComponentPropsWithoutRef<typeof Popover.Close> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  popup: {
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
    zIndex: 1000,
    overflow: 'hidden',
  },
  arrow: {
    width: '12px',
    height: '12px',
    background: RVN_COLORS.surface,
    borderLeft: RVN_BORDERS.primary,
    borderTop: RVN_BORDERS.primary,
    transform: 'rotate(45deg)',
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: RVN_COLORS.white,
    background: RVN_COLORS.black,
    padding: RVN_SPACING.s,
    margin: 0,
  },
  description: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textMuted,
    padding: `0 ${RVN_SPACING.s}`,
    paddingTop: RVN_SPACING.xs,
    margin: 0,
  },
  body: {
    padding: RVN_SPACING.s,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMain,
    lineHeight: 1.5,
  },
  closeButton: {
    position: 'absolute' as const,
    top: RVN_SPACING.xs,
    right: RVN_SPACING.xs,
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: `1px solid ${RVN_COLORS.white}`,
    color: RVN_COLORS.white,
    fontFamily: RVN_FONTS.mono,
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: RVN_BORDERS.radius,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Popup({
  style,
  minWidth = '200px',
  maxWidth = '400px',
  children,
  ...props
}: RvnPopoverPopupProps) {
  return (
    <Popover.Popup
      style={{ ...styles.popup, minWidth, maxWidth, ...style }}
      data-rvn-popover-popup=""
      {...props}
    >
      {children}
    </Popover.Popup>
  )
}

function Arrow({ style, ...props }: RvnPopoverArrowProps) {
  return (
    <Popover.Arrow
      style={{ ...styles.arrow, ...style }}
      data-rvn-popover-arrow=""
      {...props}
    />
  )
}

function Title({ style, children, ...props }: RvnPopoverTitleProps) {
  return (
    <Popover.Title
      style={{ ...styles.title, ...style }}
      data-rvn-popover-title=""
      {...props}
    >
      {children}
    </Popover.Title>
  )
}

function Description({ style, children, ...props }: RvnPopoverDescriptionProps) {
  return (
    <Popover.Description
      style={{ ...styles.description, ...style }}
      data-rvn-popover-description=""
      {...props}
    >
      {children}
    </Popover.Description>
  )
}

function Body({ style, children, ...props }: RvnPopoverBodyProps) {
  return (
    <div
      style={{ ...styles.body, ...style }}
      data-rvn-popover-body=""
      {...props}
    >
      {children}
    </div>
  )
}

function Close({ style, children, ...props }: RvnPopoverCloseProps) {
  return (
    <Popover.Close
      style={{ ...styles.closeButton, ...style }}
      data-rvn-popover-close=""
      {...props}
    >
      {children ?? '\u2715'}
    </Popover.Close>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Popup.displayName = 'RvnPopover.Popup'
Arrow.displayName = 'RvnPopover.Arrow'
Title.displayName = 'RvnPopover.Title'
Description.displayName = 'RvnPopover.Description'
Body.displayName = 'RvnPopover.Body'
Close.displayName = 'RvnPopover.Close'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnPopover = {
  Root: Popover.Root,
  Trigger: Popover.Trigger,
  Portal: Popover.Portal,
  Positioner: Popover.Positioner,
  Popup,
  Arrow,
  Title,
  Description,
  Body,
  Close,
}

export type {
  RvnPopoverPopupProps as PopupProps,
  RvnPopoverArrowProps as ArrowProps,
  RvnPopoverTitleProps as TitleProps,
  RvnPopoverDescriptionProps as DescriptionProps,
  RvnPopoverBodyProps as BodyProps,
  RvnPopoverCloseProps as CloseProps,
}

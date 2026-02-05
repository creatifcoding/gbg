/**
 * RvnDialog - Brutalist Dialog (Base UI Wrapper)
 *
 * Wraps Base UI Dialog with RVN brutalist styling:
 * - 3px border
 * - Black header row
 * - Portal rendering
 * - Escape to close
 *
 * @example
 * ```tsx
 * <RvnDialog.Root open={isOpen} onOpenChange={setIsOpen}>
 *   <RvnDialog.Trigger>
 *     <RvnButton>Open Dialog</RvnButton>
 *   </RvnDialog.Trigger>
 *   <RvnDialog.Portal>
 *     <RvnDialog.Backdrop />
 *     <RvnDialog.Popup>
 *       <RvnDialog.Header>
 *         <RvnDialog.Title>Unit Details</RvnDialog.Title>
 *         <RvnDialog.Close />
 *       </RvnDialog.Header>
 *       <RvnDialog.Body>
 *         <p>Dialog content here</p>
 *       </RvnDialog.Body>
 *       <RvnDialog.Footer>
 *         <RvnButton onClick={() => setIsOpen(false)}>Close</RvnButton>
 *       </RvnDialog.Footer>
 *     </RvnDialog.Popup>
 *   </RvnDialog.Portal>
 * </RvnDialog.Root>
 * ```
 */

import * as React from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
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

export interface RvnDialogBackdropProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Backdrop> {}

export interface RvnDialogPopupProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Popup> {
  maxWidth?: string
  maxHeight?: string
}

export interface RvnDialogHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnDialogTitleProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Title> {}

export interface RvnDialogCloseProps
  extends React.ComponentPropsWithoutRef<typeof Dialog.Close> {}

export interface RvnDialogBodyProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnDialogFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  popup: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: '8px 8px 0px rgba(0,0,0,0.2)',
    zIndex: 1001,
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
    padding: RVN_SPACING.s,
    gap: RVN_SPACING.s,
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
    flex: 1,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    background: 'transparent',
    border: `1px solid ${RVN_COLORS.white}`,
    color: RVN_COLORS.white,
    fontFamily: RVN_FONTS.mono,
    fontSize: '16px',
    fontWeight: RVN_FONT_WEIGHTS.bold,
    cursor: 'pointer',
    borderRadius: RVN_BORDERS.radius,
  },
  body: {
    padding: RVN_SPACING.m,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMain,
    flex: 1,
    overflowY: 'auto' as const,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: RVN_SPACING.s,
    padding: RVN_SPACING.s,
    borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Backdrop({ style, ...props }: RvnDialogBackdropProps) {
  return (
    <Dialog.Backdrop
      style={{ ...styles.backdrop, ...style }}
      data-rvn-dialog-backdrop=""
      {...props}
    />
  )
}

function Popup({
  style,
  maxWidth = '600px',
  maxHeight = '90vh',
  children,
  ...props
}: RvnDialogPopupProps) {
  return (
    <Dialog.Popup
      style={{ ...styles.popup, maxWidth, maxHeight, ...style }}
      data-rvn-dialog-popup=""
      {...props}
    >
      {children}
    </Dialog.Popup>
  )
}

function Header({ style, children, ...props }: RvnDialogHeaderProps) {
  return (
    <div
      style={{ ...styles.header, ...style }}
      data-rvn-dialog-header=""
      {...props}
    >
      {children}
    </div>
  )
}

function Title({ style, children, ...props }: RvnDialogTitleProps) {
  return (
    <Dialog.Title
      style={{ ...styles.title, ...style }}
      data-rvn-dialog-title=""
      {...props}
    >
      {children}
    </Dialog.Title>
  )
}

function Close({ style, children, ...props }: RvnDialogCloseProps) {
  return (
    <Dialog.Close
      style={{ ...styles.closeButton, ...style }}
      data-rvn-dialog-close=""
      {...props}
    >
      {children ?? '\u2715'}
    </Dialog.Close>
  )
}

function Body({ style, children, ...props }: RvnDialogBodyProps) {
  return (
    <div
      style={{ ...styles.body, ...style }}
      data-rvn-dialog-body=""
      {...props}
    >
      {children}
    </div>
  )
}

function Footer({ style, children, ...props }: RvnDialogFooterProps) {
  return (
    <div
      style={{ ...styles.footer, ...style }}
      data-rvn-dialog-footer=""
      {...props}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Backdrop.displayName = 'RvnDialog.Backdrop'
Popup.displayName = 'RvnDialog.Popup'
Header.displayName = 'RvnDialog.Header'
Title.displayName = 'RvnDialog.Title'
Close.displayName = 'RvnDialog.Close'
Body.displayName = 'RvnDialog.Body'
Footer.displayName = 'RvnDialog.Footer'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnDialog = {
  Root: Dialog.Root,
  Trigger: Dialog.Trigger,
  Portal: Dialog.Portal,
  Backdrop,
  Popup,
  Header,
  Title,
  Description: Dialog.Description,
  Close,
  Body,
  Footer,
}

export type {
  RvnDialogBackdropProps as BackdropProps,
  RvnDialogPopupProps as PopupProps,
  RvnDialogHeaderProps as HeaderProps,
  RvnDialogTitleProps as TitleProps,
  RvnDialogCloseProps as CloseProps,
  RvnDialogBodyProps as BodyProps,
  RvnDialogFooterProps as FooterProps,
}

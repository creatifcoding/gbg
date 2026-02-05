/**
 * RvnAlertDialog - Brutalist Alert Dialog (Base UI Wrapper)
 *
 * Wraps Base UI AlertDialog with RVN brutalist styling:
 * - 3px black border modal
 * - Black header
 * - 70% black overlay backdrop
 * - Brutalist buttons
 *
 * @example
 * ```tsx
 * <RvnAlertDialog.Root open={isOpen} onOpenChange={setIsOpen}>
 *   <RvnAlertDialog.Trigger>
 *     <RvnButton>Delete Unit</RvnButton>
 *   </RvnAlertDialog.Trigger>
 *   <RvnAlertDialog.Portal>
 *     <RvnAlertDialog.Backdrop />
 *     <RvnAlertDialog.Popup>
 *       <RvnAlertDialog.Title>Confirm Deletion</RvnAlertDialog.Title>
 *       <RvnAlertDialog.Description>
 *         This action cannot be undone.
 *       </RvnAlertDialog.Description>
 *       <RvnAlertDialog.Actions>
 *         <RvnAlertDialog.Cancel>Cancel</RvnAlertDialog.Cancel>
 *         <RvnAlertDialog.Confirm>Delete</RvnAlertDialog.Confirm>
 *       </RvnAlertDialog.Actions>
 *     </RvnAlertDialog.Popup>
 *   </RvnAlertDialog.Portal>
 * </RvnAlertDialog.Root>
 * ```
 */

import * as React from 'react'
import { AlertDialog } from '@base-ui-components/react/alert-dialog'
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

export interface RvnAlertDialogBackdropProps
  extends React.ComponentPropsWithoutRef<typeof AlertDialog.Backdrop> {}

export interface RvnAlertDialogPopupProps
  extends React.ComponentPropsWithoutRef<typeof AlertDialog.Popup> {
  maxWidth?: string
}

export interface RvnAlertDialogTitleProps
  extends React.ComponentPropsWithoutRef<typeof AlertDialog.Title> {}

export interface RvnAlertDialogDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof AlertDialog.Description> {}

export interface RvnAlertDialogActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export interface RvnAlertDialogCancelProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface RvnAlertDialogConfirmProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger'
}

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
    minWidth: '320px',
    maxWidth: '480px',
    overflow: 'hidden',
  },
  header: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
    padding: RVN_SPACING.s,
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
  },
  description: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMain,
    padding: RVN_SPACING.m,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: RVN_SPACING.s,
    padding: RVN_SPACING.s,
    borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
  },
  cancelButton: {
    padding: '10px 20px',
    background: 'transparent',
    border: RVN_BORDERS.primary,
    color: RVN_COLORS.textMain,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    boxShadow: RVN_SHADOWS.default,
    borderRadius: RVN_BORDERS.radius,
  },
  confirmButton: {
    padding: '10px 20px',
    background: RVN_COLORS.black,
    border: RVN_BORDERS.primary,
    color: RVN_COLORS.white,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    boxShadow: RVN_SHADOWS.default,
    borderRadius: RVN_BORDERS.radius,
  },
  confirmButtonDanger: {
    background: '#c0392b',
    borderColor: '#c0392b',
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Backdrop({ style, ...props }: RvnAlertDialogBackdropProps) {
  return (
    <AlertDialog.Backdrop
      style={{ ...styles.backdrop, ...style }}
      data-rvn-alert-dialog-backdrop=""
      {...props}
    />
  )
}

function Popup({ style, maxWidth = '480px', children, ...props }: RvnAlertDialogPopupProps) {
  return (
    <AlertDialog.Popup
      style={{ ...styles.popup, maxWidth, ...style }}
      data-rvn-alert-dialog-popup=""
      {...props}
    >
      {children}
    </AlertDialog.Popup>
  )
}

function Title({ style, children, ...props }: RvnAlertDialogTitleProps) {
  return (
    <div style={styles.header}>
      <AlertDialog.Title
        style={{ ...styles.title, ...style }}
        data-rvn-alert-dialog-title=""
        {...props}
      >
        {children}
      </AlertDialog.Title>
    </div>
  )
}

function Description({ style, children, ...props }: RvnAlertDialogDescriptionProps) {
  return (
    <AlertDialog.Description
      style={{ ...styles.description, ...style }}
      data-rvn-alert-dialog-description=""
      {...props}
    >
      {children}
    </AlertDialog.Description>
  )
}

function Actions({ style, children, ...props }: RvnAlertDialogActionsProps) {
  return (
    <div
      style={{ ...styles.actions, ...style }}
      data-rvn-alert-dialog-actions=""
      {...props}
    >
      {children}
    </div>
  )
}

function Cancel({ style, children, ...props }: RvnAlertDialogCancelProps) {
  return (
    <AlertDialog.Close
      render={
        <button
          type="button"
          style={{ ...styles.cancelButton, ...style }}
          data-rvn-alert-dialog-cancel=""
          {...props}
        >
          {children}
        </button>
      }
    />
  )
}

function Confirm({ style, variant = 'default', children, ...props }: RvnAlertDialogConfirmProps) {
  const buttonStyle = {
    ...styles.confirmButton,
    ...(variant === 'danger' ? styles.confirmButtonDanger : {}),
    ...style,
  }

  return (
    <AlertDialog.Close
      render={
        <button
          type="button"
          style={buttonStyle}
          data-rvn-alert-dialog-confirm=""
          data-variant={variant}
          {...props}
        >
          {children}
        </button>
      }
    />
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Backdrop.displayName = 'RvnAlertDialog.Backdrop'
Popup.displayName = 'RvnAlertDialog.Popup'
Title.displayName = 'RvnAlertDialog.Title'
Description.displayName = 'RvnAlertDialog.Description'
Actions.displayName = 'RvnAlertDialog.Actions'
Cancel.displayName = 'RvnAlertDialog.Cancel'
Confirm.displayName = 'RvnAlertDialog.Confirm'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnAlertDialog = {
  Root: AlertDialog.Root,
  Trigger: AlertDialog.Trigger,
  Portal: AlertDialog.Portal,
  Backdrop,
  Popup,
  Title,
  Description,
  Actions,
  Cancel,
  Confirm,
  Close: AlertDialog.Close,
}

export type {
  RvnAlertDialogBackdropProps as BackdropProps,
  RvnAlertDialogPopupProps as PopupProps,
  RvnAlertDialogTitleProps as TitleProps,
  RvnAlertDialogDescriptionProps as DescriptionProps,
  RvnAlertDialogActionsProps as ActionsProps,
  RvnAlertDialogCancelProps as CancelProps,
  RvnAlertDialogConfirmProps as ConfirmProps,
}

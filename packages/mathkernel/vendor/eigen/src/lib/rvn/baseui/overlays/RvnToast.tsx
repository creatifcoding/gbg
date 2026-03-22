/**
 * RvnToast - Brutalist Toast (Base UI Wrapper)
 *
 * Wraps Base UI Toast with RVN brutalist styling:
 * - 3px border
 * - Black bg for alerts
 * - Monospace text
 * - Position: bottom-right
 *
 * @example
 * ```tsx
 * // Using the toast provider
 * <RvnToast.Provider>
 *   <App />
 *   <RvnToast.Viewport />
 * </RvnToast.Provider>
 *
 * // Triggering a toast (from within provider)
 * const toastManager = useRvnToast()
 * toastManager.add({ title: 'Unit Deployed', description: 'TX-99 is now active' })
 *
 * // Or using explicit components
 * <RvnToast.Root>
 *   <RvnToast.Title>Unit Deployed</RvnToast.Title>
 *   <RvnToast.Description>TX-99 is now active</RvnToast.Description>
 *   <RvnToast.Close />
 * </RvnToast.Root>
 * ```
 */

import * as React from 'react'
import { Toast, useToastManager } from '@base-ui-components/react/toast'
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

export type RvnToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface RvnToastRootProps
  extends React.ComponentPropsWithoutRef<typeof Toast.Root> {
  variant?: RvnToastVariant
}

export interface RvnToastViewportProps
  extends React.ComponentPropsWithoutRef<typeof Toast.Viewport> {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export interface RvnToastTitleProps
  extends React.ComponentPropsWithoutRef<typeof Toast.Title> {}

export interface RvnToastDescriptionProps
  extends React.ComponentPropsWithoutRef<typeof Toast.Description> {}

export interface RvnToastCloseProps
  extends React.ComponentPropsWithoutRef<typeof Toast.Close> {}

export interface RvnToastActionProps
  extends React.ComponentPropsWithoutRef<typeof Toast.Action> {}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const VARIANT_ICONS: Record<RvnToastVariant, string> = {
  info: '\u25CF', // Bullet
  success: '\u2713', // Checkmark
  warning: '\u26A0', // Warning
  error: '\u2715', // X
}

const POSITION_STYLES: Record<
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  React.CSSProperties
> = {
  'top-left': { top: RVN_SPACING.m, left: RVN_SPACING.m },
  'top-right': { top: RVN_SPACING.m, right: RVN_SPACING.m },
  'bottom-left': { bottom: RVN_SPACING.m, left: RVN_SPACING.m },
  'bottom-right': { bottom: RVN_SPACING.m, right: RVN_SPACING.m },
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  viewport: {
    position: 'fixed' as const,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: RVN_SPACING.s,
    maxWidth: '400px',
    width: '100%',
    padding: 0,
    margin: 0,
    listStyle: 'none',
  },
  root: {
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: '4px 4px 0px rgba(0, 0, 0, 1)',
    padding: RVN_SPACING.s,
    display: 'flex',
    alignItems: 'flex-start',
    gap: RVN_SPACING.s,
    position: 'relative' as const,
  },
  rootError: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
  },
  rootWarning: {
    borderLeftWidth: '6px',
    borderLeftColor: '#D4AC0D',
  },
  rootSuccess: {
    borderLeftWidth: '6px',
    borderLeftColor: RVN_COLORS.black,
  },
  icon: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    lineHeight: 1,
    flexShrink: 0,
    width: '20px',
    textAlign: 'center' as const,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
    margin: 0,
    marginBottom: '4px',
  },
  description: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    lineHeight: 1.4,
    margin: 0,
    opacity: 0.8,
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
    border: `1px solid currentColor`,
    color: 'inherit',
    fontFamily: RVN_FONTS.mono,
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: RVN_BORDERS.radius,
    opacity: 0.6,
  },
  action: {
    padding: '6px 12px',
    background: RVN_COLORS.black,
    border: 'none',
    color: RVN_COLORS.white,
    fontFamily: RVN_FONTS.mono,
    fontSize: '10px',
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    borderRadius: RVN_BORDERS.radius,
    marginTop: RVN_SPACING.xs,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Viewport({
  style,
  position = 'bottom-right',
  ...props
}: RvnToastViewportProps) {
  return (
    <Toast.Viewport
      style={{ ...styles.viewport, ...POSITION_STYLES[position], ...style }}
      data-rvn-toast-viewport=""
      data-position={position}
      {...props}
    />
  )
}

function Root({
  style,
  variant = 'info',
  children,
  ...props
}: RvnToastRootProps) {
  const variantStyle: React.CSSProperties =
    variant === 'error'
      ? styles.rootError
      : variant === 'warning'
        ? styles.rootWarning
        : variant === 'success'
          ? styles.rootSuccess
          : {}

  const iconColor =
    variant === 'error'
      ? '#ff6b6b'
      : variant === 'warning'
        ? '#D4AC0D'
        : variant === 'success'
          ? '#2ecc71'
          : RVN_COLORS.textMain

  return (
    <Toast.Root
      style={{ ...styles.root, ...variantStyle, ...style }}
      data-rvn-toast=""
      data-variant={variant}
      {...props}
    >
      <span
        style={{ ...styles.icon, color: iconColor }}
        aria-hidden="true"
      >
        {VARIANT_ICONS[variant]}
      </span>
      <div style={styles.content}>{children}</div>
    </Toast.Root>
  )
}

function Title({ style, children, ...props }: RvnToastTitleProps) {
  return (
    <Toast.Title
      style={{ ...styles.title, ...style }}
      data-rvn-toast-title=""
      {...props}
    >
      {children}
    </Toast.Title>
  )
}

function Description({ style, children, ...props }: RvnToastDescriptionProps) {
  return (
    <Toast.Description
      style={{ ...styles.description, ...style }}
      data-rvn-toast-description=""
      {...props}
    >
      {children}
    </Toast.Description>
  )
}

function Close({ style, children, ...props }: RvnToastCloseProps) {
  return (
    <Toast.Close
      style={{ ...styles.closeButton, ...style }}
      data-rvn-toast-close=""
      {...props}
    >
      {children ?? '\u2715'}
    </Toast.Close>
  )
}

function Action({ style, children, ...props }: RvnToastActionProps) {
  return (
    <Toast.Action
      style={{ ...styles.action, ...style }}
      data-rvn-toast-action=""
      {...props}
    >
      {children}
    </Toast.Action>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Viewport.displayName = 'RvnToast.Viewport'
Root.displayName = 'RvnToast.Root'
Title.displayName = 'RvnToast.Title'
Description.displayName = 'RvnToast.Description'
Close.displayName = 'RvnToast.Close'
Action.displayName = 'RvnToast.Action'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnToast = {
  Provider: Toast.Provider,
  Viewport,
  Root,
  Title,
  Description,
  Close,
  Action,
}

// Re-export the useToastManager hook as useRvnToast for convenience
export { useToastManager as useRvnToast }
export { useToastManager }

// Type aliases for convenience
export type RootProps = RvnToastRootProps
export type ViewportProps = RvnToastViewportProps
export type TitleProps = RvnToastTitleProps
export type DescriptionProps = RvnToastDescriptionProps
export type CloseProps = RvnToastCloseProps
export type ActionProps = RvnToastActionProps

/**
 * RvnAlert - Brutalist Inline Alert
 *
 * Inline alert box for contextual messages within content.
 * Features left border accent, variant icons, and optional dismiss.
 *
 * Features:
 * - 4 variants: info, success, warning, error
 * - Left border accent for visual distinction
 * - Unicode icons matching variant
 * - Optional dismiss button
 * - Compound pattern for custom layouts
 *
 * @example
 * ```tsx
 * <RvnAlert variant="warning">
 *   <RvnAlert.Title>PERIMETER BREACH</RvnAlert.Title>
 *   <RvnAlert.Description>
 *     Unauthorized access detected at sector 7-G.
 *   </RvnAlert.Description>
 * </RvnAlert>
 * ```
 */

import * as React from 'react'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
  RVN_PATTERNS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnAlertVariant = 'info' | 'success' | 'warning' | 'error'

interface RvnAlertContextValue {
  variant: RvnAlertVariant
}

export interface RvnAlertProps {
  /** Alert content */
  children: React.ReactNode
  /** Visual variant */
  variant?: RvnAlertVariant
  /** Show dismiss button */
  dismissible?: boolean
  /** Callback when dismissed */
  onDismiss?: () => void
  /** Additional inline styles */
  style?: React.CSSProperties
}

export interface RvnAlertTitleProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export interface RvnAlertDescriptionProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export interface RvnAlertIconProps {
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const VARIANT_ICONS: Record<RvnAlertVariant, string> = {
  info: '\u25CF', // ●
  success: '\u2713', // ✓
  warning: '\u26A0', // ⚠
  error: '\u2715', // ✕
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const RvnAlertContext = React.createContext<RvnAlertContextValue | null>(null)

function useRvnAlert(): RvnAlertContextValue {
  const context = React.use(RvnAlertContext)
  if (!context) {
    throw new Error('RvnAlert compound components must be used within RvnAlert')
  }
  return context
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: RVN_SPACING.s,
    padding: RVN_SPACING.s,
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    borderLeftWidth: '6px',
    borderLeftStyle: 'solid' as const,
  },
  icon: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    lineHeight: 1.2,
    flexShrink: 0,
    width: '18px',
    textAlign: 'center' as const,
    color: RVN_COLORS.textMain,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    color: RVN_COLORS.textMain,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
    margin: 0,
    marginBottom: '4px',
  },
  description: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.regular,
    color: RVN_COLORS.textMain,
    lineHeight: 1.4,
    margin: 0,
  },
  dismissButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    color: RVN_COLORS.textMain,
    padding: 0,
    lineHeight: 1,
    opacity: 0.6,
    transition: 'opacity 0.15s',
    flexShrink: 0,
  },
} as const

// Error variant background with stripes
const errorBackground: React.CSSProperties = {
  position: 'relative' as const,
  overflow: 'hidden',
}

// -----------------------------------------------------------------------------
// Compound Components
// -----------------------------------------------------------------------------

/**
 * RvnAlert.Icon - Icon slot (auto-populated by variant if not provided)
 */
function Icon({ style }: RvnAlertIconProps) {
  const { variant } = useRvnAlert()

  return (
    <span style={{ ...styles.icon, ...style }} aria-hidden="true">
      {VARIANT_ICONS[variant]}
    </span>
  )
}

/**
 * RvnAlert.Title - Alert heading
 */
function Title({ children, style }: RvnAlertTitleProps) {
  return (
    <h4 style={{ ...styles.title, ...style }} data-rvn-alert-title="">
      {children}
    </h4>
  )
}

/**
 * RvnAlert.Description - Alert body text
 */
function Description({ children, style }: RvnAlertDescriptionProps) {
  return (
    <p style={{ ...styles.description, ...style }} data-rvn-alert-description="">
      {children}
    </p>
  )
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * RvnAlert - Brutalist inline alert
 *
 * @example Simple usage
 * ```tsx
 * <RvnAlert variant="info">
 *   System update available. Deploy when ready.
 * </RvnAlert>
 * ```
 *
 * @example Compound usage
 * ```tsx
 * <RvnAlert variant="error" dismissible onDismiss={handleDismiss}>
 *   <RvnAlert.Title>CRITICAL FAILURE</RvnAlert.Title>
 *   <RvnAlert.Description>
 *     Reactor core temperature exceeding safe limits.
 *   </RvnAlert.Description>
 * </RvnAlert>
 * ```
 */
function RvnAlertRoot({
  children,
  variant = 'info',
  dismissible = false,
  onDismiss,
  style,
}: RvnAlertProps) {
  const [dismissed, setDismissed] = React.useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  // Check if children is a simple string/number (not compound usage)
  const isSimpleContent =
    typeof children === 'string' || typeof children === 'number'

  const containerStyle: React.CSSProperties = {
    ...styles.container,
    borderLeftColor: RVN_COLORS.black,
    ...(variant === 'error' && errorBackground),
    ...style,
  }

  return (
    <RvnAlertContext.Provider value={{ variant }}>
      <div
        style={containerStyle}
        data-rvn-alert=""
        data-variant={variant}
        role="alert"
      >
        <Icon />
        <div style={styles.content}>
          {isSimpleContent ? (
            <Description>{children}</Description>
          ) : (
            children
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            style={styles.dismissButton}
            onClick={handleDismiss}
            aria-label="Dismiss alert"
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6'
            }}
          >
            {'\u2715'}
          </button>
        )}
      </div>
    </RvnAlertContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

RvnAlertRoot.displayName = 'RvnAlert'
Icon.displayName = 'RvnAlert.Icon'
Title.displayName = 'RvnAlert.Title'
Description.displayName = 'RvnAlert.Description'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnAlert = Object.assign(RvnAlertRoot, {
  Icon,
  Title,
  Description,
})

// Export hook for advanced usage
export { useRvnAlert }

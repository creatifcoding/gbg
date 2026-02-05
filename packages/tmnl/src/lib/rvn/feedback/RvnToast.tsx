/**
 * RvnToast - Brutalist Toast Notification
 *
 * Fixed-position notification with auto-dismiss and progress bar.
 * Follows RVN brutalist design: 3px borders, no radius, monospace font.
 *
 * Features:
 * - 4 variants: info, success, warning, error
 * - Auto-dismiss with configurable duration
 * - Visual progress bar showing remaining time
 * - Manual dismiss via close button
 * - Stack multiple toasts
 *
 * @example
 * ```tsx
 * <RvnToast
 *   variant="success"
 *   message="UNIT DEPLOYED SUCCESSFULLY"
 *   duration={5000}
 *   onClose={() => setShowToast(false)}
 * />
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
  RVN_SHADOWS,
  RVN_PATTERNS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface RvnToastProps {
  /** Toast message content */
  message: React.ReactNode
  /** Visual variant */
  variant?: RvnToastVariant
  /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
  duration?: number
  /** Callback when toast is dismissed */
  onClose?: () => void
  /** Show close button */
  showClose?: boolean
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const VARIANT_ICONS: Record<RvnToastVariant, string> = {
  info: '\u25CF', // ●
  success: '\u2713', // ✓
  warning: '\u26A0', // ⚠
  error: '\u2715', // ✕
}

const VARIANT_STYLES: Record<RvnToastVariant, React.CSSProperties> = {
  info: {
    borderLeftWidth: '6px',
    borderLeftColor: RVN_COLORS.black,
  },
  success: {
    borderLeftWidth: '6px',
    borderLeftColor: RVN_COLORS.black,
  },
  warning: {
    borderLeftWidth: '6px',
    borderLeftColor: RVN_COLORS.black,
  },
  error: {
    borderLeftWidth: '6px',
    borderLeftColor: RVN_COLORS.black,
  },
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  container: {
    position: 'fixed' as const,
    bottom: RVN_SPACING.m,
    right: RVN_SPACING.m,
    zIndex: 9999,
    minWidth: '300px',
    maxWidth: '400px',
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    boxShadow: RVN_SHADOWS.default,
    overflow: 'hidden',
  },
  content: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: RVN_SPACING.s,
    padding: RVN_SPACING.s,
  },
  icon: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    lineHeight: 1,
    flexShrink: 0,
    width: '20px',
    textAlign: 'center' as const,
    color: RVN_COLORS.textMain,
  },
  message: {
    flex: 1,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.medium,
    color: RVN_COLORS.textMain,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
    lineHeight: 1.4,
  },
  closeButton: {
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
  },
  progressBar: {
    height: '4px',
    background: RVN_COLORS.surfaceHighlight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: RVN_COLORS.black,
    transition: 'width linear',
  },
  errorContainer: {
    background: RVN_PATTERNS.criticalStripe,
  },
} as const

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RvnToast - Brutalist toast notification
 *
 * @example Info toast
 * ```tsx
 * <RvnToast message="NEW INTEL RECEIVED" variant="info" />
 * ```
 *
 * @example Error toast with no auto-dismiss
 * ```tsx
 * <RvnToast
 *   message="CONNECTION LOST"
 *   variant="error"
 *   duration={0}
 *   onClose={() => setError(null)}
 * />
 * ```
 */
export function RvnToast({
  message,
  variant = 'info',
  duration = 5000,
  onClose,
  showClose = true,
  style,
}: RvnToastProps) {
  const [progress, setProgress] = React.useState(100)
  const [isHovered, setIsHovered] = React.useState(false)

  // Auto-dismiss timer
  React.useEffect(() => {
    if (duration <= 0 || isHovered) return undefined

    const startTime = Date.now()
    const endTime = startTime + duration

    const updateProgress = () => {
      const now = Date.now()
      const remaining = Math.max(0, endTime - now)
      const percent = (remaining / duration) * 100
      setProgress(percent)

      if (remaining <= 0) {
        onClose?.()
      }
    }

    const interval = setInterval(updateProgress, 50)
    return () => clearInterval(interval)
  }, [duration, isHovered, onClose])

  const containerStyle: React.CSSProperties = {
    ...styles.container,
    ...VARIANT_STYLES[variant],
    ...style,
  }

  // Error variant gets stripe pattern in the background
  const contentStyle: React.CSSProperties = {
    ...styles.content,
    ...(variant === 'error' && {
      background: RVN_COLORS.surface,
      position: 'relative' as const,
    }),
  }

  return (
    <div
      style={containerStyle}
      data-rvn-toast=""
      data-variant={variant}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="alert"
      aria-live="polite"
    >
      <div style={contentStyle}>
        <span style={styles.icon} aria-hidden="true">
          {VARIANT_ICONS[variant]}
        </span>
        <div style={styles.message}>{message}</div>
        {showClose && (
          <button
            type="button"
            style={styles.closeButton}
            onClick={onClose}
            aria-label="Dismiss notification"
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
      {duration > 0 && (
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
              transitionDuration: isHovered ? '0s' : '50ms',
            }}
          />
        </div>
      )}
    </div>
  )
}

RvnToast.displayName = 'RvnToast'

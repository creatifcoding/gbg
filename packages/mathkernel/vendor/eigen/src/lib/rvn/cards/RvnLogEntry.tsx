/**
 * RvnLogEntry
 *
 * Log/message entry component for communication logs.
 * Features: timestamp + message, alert state with inverted badge.
 *
 * Source pattern: react-app(33).js - LogEntry
 */

import * as React from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../tokens'
import { RvnCard } from './RvnCard'
import type { BadgeLevel } from './RvnCard'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type LogLevel = 'INFO' | 'ALERT' | 'WARNING' | 'ERROR' | 'SUCCESS' | 'DEBUG'

interface RvnLogEntryProps {
  /** Timestamp string (e.g., "14:02", "2024-01-15 14:02:33") */
  timestamp?: string
  /** Log message content */
  message: string
  /** Log level/type */
  level?: LogLevel
  /** Source/origin identifier */
  source?: string
  /** Whether entry is alert state */
  alert?: boolean
  /** Click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  entry: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    paddingBottom: RVN_SPACING.s,
    borderBottom: `1px solid ${RVN_COLORS.borderMuted}`,
    marginBottom: RVN_SPACING.s,
    display: 'flex',
    alignItems: 'flex-start',
    gap: RVN_SPACING.s,
    lineHeight: 1.5,
  },
  timestamp: {
    fontWeight: RVN_FONT_WEIGHTS.black,
    color: RVN_COLORS.textMain,
    flexShrink: 0,
    minWidth: '48px',
  },
  message: {
    color: RVN_COLORS.textMain,
    flex: 1,
  },
  source: {
    color: RVN_COLORS.textMuted,
    fontSize: RVN_FONT_SIZES.caption,
  },
} as const

// -----------------------------------------------------------------------------
// Level Mapping
// -----------------------------------------------------------------------------

function mapLevelToBadgeLevel(level: LogLevel): BadgeLevel {
  switch (level) {
    case 'INFO':
      return 'info'
    case 'ALERT':
      return 'alert'
    case 'WARNING':
      return 'warning'
    case 'ERROR':
      return 'error'
    case 'SUCCESS':
      return 'success'
    case 'DEBUG':
      return 'debug'
    default:
      return 'info'
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Log Entry for communication/event logs
 *
 * @example Basic with timestamp
 * ```tsx
 * <RvnLogEntry
 *   timestamp="14:02"
 *   message="Engaging hostile unit at perimeter."
 * />
 * ```
 *
 * @example Alert state
 * ```tsx
 * <RvnLogEntry
 *   message="Power core below threshold."
 *   level="ALERT"
 * />
 * ```
 *
 * @example With source
 * ```tsx
 * <RvnLogEntry
 *   timestamp="14:02:33"
 *   message="Connection established"
 *   level="INFO"
 *   source="COMMS"
 * />
 * ```
 */
export const RvnLogEntry = React.forwardRef<HTMLDivElement, RvnLogEntryProps>(
  function RvnLogEntry(
    { timestamp, message, level, source, alert = false, onClick, className, style },
    ref
  ) {
    // Determine if we should show alert styling
    const isAlert = alert || level === 'ALERT' || level === 'ERROR'
    const effectiveLevel = level || (alert ? 'ALERT' : undefined)

    const entryStyle: React.CSSProperties = {
      ...styles.entry,
      ...(onClick ? { cursor: 'pointer' } : {}),
      ...style,
    }

    return (
      <div
        ref={ref}
        className={className}
        style={entryStyle}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        data-rvn-log-entry=""
        data-level={effectiveLevel}
        data-alert={isAlert || undefined}
      >
        {/* Level badge (for alerts) */}
        {effectiveLevel && (
          <RvnCard.Badge level={mapLevelToBadgeLevel(effectiveLevel)}>
            {effectiveLevel}
          </RvnCard.Badge>
        )}

        {/* Timestamp (when not alert) */}
        {timestamp && !isAlert && <span style={styles.timestamp}>{timestamp}</span>}

        {/* Message */}
        <span style={styles.message}>{message}</span>

        {/* Source identifier */}
        {source && <span style={styles.source}>[{source}]</span>}
      </div>
    )
  }
)

RvnLogEntry.displayName = 'RvnLogEntry'

// -----------------------------------------------------------------------------
// Compound: Log Container
// -----------------------------------------------------------------------------

interface RvnLogContainerProps {
  /** Max height for scrolling */
  maxHeight?: string | number
  /** Children (RvnLogEntry components) */
  children: React.ReactNode
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

/**
 * Container for log entries with optional scrolling
 *
 * @example
 * ```tsx
 * <RvnLogContainer maxHeight={300}>
 *   <RvnLogEntry timestamp="14:02" message="Message 1" />
 *   <RvnLogEntry timestamp="14:01" message="Message 2" />
 *   <RvnLogEntry level="ALERT" message="Alert message" />
 * </RvnLogContainer>
 * ```
 */
export const RvnLogContainer = React.forwardRef<HTMLDivElement, RvnLogContainerProps>(
  function RvnLogContainer({ maxHeight, children, className, style }, ref) {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
      ...style,
    }

    return (
      <div
        ref={ref}
        className={className}
        style={containerStyle}
        data-rvn-log-container=""
      >
        {children}
      </div>
    )
  }
)

RvnLogContainer.displayName = 'RvnLogContainer'

export type { RvnLogEntryProps, RvnLogContainerProps, LogLevel }

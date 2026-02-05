/**
 * RvnErrorDisplay
 *
 * Renders parsed error messages with RVN dark theme styling.
 * Handles XML tags from Claude API error responses with structured display.
 */

import * as React from 'react'
import { memo, useMemo } from 'react'
import {
  RVN_DARK,
  RVN_FONTS,
  RVN_FONT_SIZES,
} from './rvn-tokens'
import {
  parseErrorXml,
  getErrorTypeBadge,
  getMainErrorMessage,
  getErrorPaths,
  getErrorCause,
  type ParsedError,
} from '../../utils/errorParser'

// =============================================================================
// Types
// =============================================================================

export interface RvnErrorDisplayProps {
  /** The error message text (may contain XML tags) */
  errorMessage: string
  /** Custom style overrides */
  style?: React.CSSProperties
  /** Custom className */
  className?: string
}

// =============================================================================
// Styles
// =============================================================================

const errorStyles = {
  container: {
    background: RVN_DARK.errorBg,
    border: `1px solid ${RVN_DARK.errorBorder}`,
    padding: '8px 12px',
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
  },
  tagBadge: {
    display: 'inline-block',
    background: '#330000',
    color: '#ff6666',
    padding: '2px 6px',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontSize: '10px', // Exception to 12px floor for compact badges
    fontWeight: 700,
    fontFamily: RVN_FONTS.mono,
  },
  message: {
    color: '#ff6666',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    lineHeight: 1.4,
  },
  pathContainer: {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: `1px solid ${RVN_DARK.errorBorder}`,
  },
  pathLabel: {
    color: '#ff4444',
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: 600,
    marginBottom: '2px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  path: {
    color: RVN_DARK.textBright,
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    background: '#1a0808',
    padding: '4px 8px',
    borderLeft: '2px solid #ff3333',
    marginTop: '4px',
    wordBreak: 'break-all' as const,
  },
  causeContainer: {
    marginTop: '8px',
    paddingTop: '6px',
    borderTop: `1px solid ${RVN_DARK.errorBorder}`,
  },
  causeLabel: {
    color: '#ff4444',
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: 600,
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  causeContent: {
    color: RVN_DARK.textMuted,
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    background: '#0d0505',
    padding: '6px 8px',
    maxHeight: '100px',
    overflow: 'auto',
    lineHeight: 1.3,
  },
  plainText: {
    color: RVN_DARK.textMuted,
    fontSize: RVN_FONT_SIZES.label,
    marginTop: '6px',
    fontStyle: 'italic' as const,
  },
} as const

// =============================================================================
// Sub-components
// =============================================================================

interface ErrorBadgeProps {
  text: string
}

const ErrorBadge = memo(function ErrorBadge({ text }: ErrorBadgeProps) {
  return <div style={errorStyles.tagBadge}>{text}</div>
})

interface ErrorPathsProps {
  paths: string[]
}

const ErrorPaths = memo(function ErrorPaths({ paths }: ErrorPathsProps) {
  if (paths.length === 0) return null

  return (
    <div style={errorStyles.pathContainer}>
      <div style={errorStyles.pathLabel}>Path</div>
      {paths.map((path, i) => (
        <div key={i} style={errorStyles.path}>
          {path}
        </div>
      ))}
    </div>
  )
})

interface ErrorCauseProps {
  cause: string
}

const ErrorCause = memo(function ErrorCause({ cause }: ErrorCauseProps) {
  const [expanded, setExpanded] = React.useState(false)
  const isLong = cause.length > 200

  return (
    <div style={errorStyles.causeContainer}>
      <div
        style={errorStyles.causeLabel}
        onClick={() => setExpanded(!expanded)}
      >
        Cause {isLong && (expanded ? '▼' : '▶')}
      </div>
      {(!isLong || expanded) && (
        <div style={errorStyles.causeContent}>{cause}</div>
      )}
    </div>
  )
})

// =============================================================================
// Main Component
// =============================================================================

/**
 * Renders structured error display
 */
const StructuredErrorDisplay = memo(function StructuredErrorDisplay({
  parsed,
  style,
}: {
  parsed: ParsedError
  style?: React.CSSProperties
}) {
  const badge = getErrorTypeBadge(parsed)
  const mainMessage = getMainErrorMessage(parsed)
  const paths = getErrorPaths(parsed)
  const cause = getErrorCause(parsed)

  return (
    <div style={{ ...errorStyles.container, ...style }}>
      {/* Error type badge */}
      {badge && <ErrorBadge text={badge} />}

      {/* Main error message */}
      {mainMessage && (
        <div style={errorStyles.message}>{mainMessage}</div>
      )}

      {/* File paths */}
      <ErrorPaths paths={paths} />

      {/* Cause/stack trace */}
      {cause && <ErrorCause cause={cause} />}

      {/* Any remaining plain text not captured by tags */}
      {parsed.plainText && !mainMessage && (
        <div style={errorStyles.plainText}>{parsed.plainText}</div>
      )}
    </div>
  )
})

/**
 * Renders plain error display (fallback when no XML tags)
 */
const PlainErrorDisplay = memo(function PlainErrorDisplay({
  message,
  style,
}: {
  message: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{ ...errorStyles.container, ...style }}>
      <div style={errorStyles.message}>{message}</div>
    </div>
  )
})

/**
 * RvnErrorDisplay - Main export
 *
 * Renders error messages with RVN styling.
 * Parses XML tags from Claude API errors and displays them with structure.
 */
export const RvnErrorDisplay = memo(function RvnErrorDisplay({
  errorMessage,
  style,
  className,
}: RvnErrorDisplayProps) {
  // Parse the error message
  const parsed = useMemo(
    () => parseErrorXml(errorMessage),
    [errorMessage]
  )

  // Choose display based on whether XML tags were found
  if (parsed.hasXmlTags) {
    return (
      <div className={className}>
        <StructuredErrorDisplay parsed={parsed} style={style} />
      </div>
    )
  }

  return (
    <div className={className}>
      <PlainErrorDisplay message={errorMessage} style={style} />
    </div>
  )
})

export default RvnErrorDisplay

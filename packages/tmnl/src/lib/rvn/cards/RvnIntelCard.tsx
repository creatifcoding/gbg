/**
 * RvnIntelCard
 *
 * Intelligence briefing card for displaying classified information
 * with priority level indicators and source attribution.
 *
 * Layout:
 * +-----------------------------+
 * | [CLASSIFICATION]            | <- Black bar with white text
 * +-----------------------------+
 * | TITLE                       | <- 14px bold uppercase
 * | Summary text here...        | <- 13px body
 * +-----------------------------+
 * | Source * Timestamp          | <- 10px mono footer
 * +-----------------------------+
 *
 * Priority colors left border:
 * - low: #666666
 * - medium: #000000
 * - high: #ff0000
 * - critical: diagonal stripes (red/black)
 *
 * Implementation: Thin wrapper around RvnCard compound component.
 */

import * as React from 'react'
import { RvnCard } from './RvnCard'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_WEIGHTS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Classification = 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET'
type Priority = 'low' | 'medium' | 'high' | 'critical'

interface RvnIntelCardProps {
  /** Security classification level */
  classification: Classification
  /** Brief title/subject line */
  title: string
  /** Summary content */
  summary: string
  /** Intelligence source identifier */
  source?: string
  /** Timestamp of intel */
  timestamp?: string
  /** Priority level affects left border color */
  priority?: Priority
  /** Click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#666666',
  medium: '#000000',
  high: '#ff0000',
  critical: '#ff0000', // Border color for non-stripe part
}

const CRITICAL_STRIPE =
  'repeating-linear-gradient(45deg, #ff0000, #ff0000 5px, #000000 5px, #000000 10px)'

// -----------------------------------------------------------------------------
// Styles (kept for intel-specific title/summary formatting)
// -----------------------------------------------------------------------------

const titleStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: '14px',
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
  margin: 0,
  lineHeight: 1.2,
}

const summaryStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: '13px',
  fontWeight: RVN_FONT_WEIGHTS.regular,
  color: RVN_COLORS.textMain,
  lineHeight: 1.4,
  margin: 0,
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getPriorityBorderStyle(priority: Priority): React.CSSProperties {
  if (priority === 'critical') {
    return {
      borderLeft: '6px solid transparent',
      backgroundImage: CRITICAL_STRIPE,
      backgroundSize: '6px 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'left',
    }
  }

  return {
    borderLeft: `6px solid ${PRIORITY_COLORS[priority]}`,
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Intelligence Briefing Card
 *
 * @example
 * ```tsx
 * <RvnIntelCard
 *   classification="SECRET"
 *   title="Movement Analysis Report"
 *   summary="Hostile assets detected in sector 7-G. Recommend immediate tactical reassessment."
 *   source="SIGINT-4A"
 *   timestamp="2024-01-15 14:32Z"
 *   priority="high"
 *   onClick={() => console.log('View full brief')}
 * />
 * ```
 */
export const RvnIntelCard = React.forwardRef<HTMLDivElement, RvnIntelCardProps>(
  function RvnIntelCard(
    {
      classification,
      title,
      summary,
      source,
      timestamp,
      priority = 'medium',
      onClick,
      className,
      style,
    },
    ref
  ) {
    const priorityBorderStyle = getPriorityBorderStyle(priority)
    const hasFooter = source || timestamp

    return (
      <RvnCard
        ref={ref}
        variant="intel"
        onClick={onClick}
        className={className}
        style={{ ...priorityBorderStyle, ...style }}
        data-rvn-intel-card=""
        data-classification={classification}
        data-priority={priority}
      >
        {/* Classification Bar */}
        <RvnCard.Header classification>{classification}</RvnCard.Header>

        {/* Content Area */}
        <RvnCard.Body>
          <h3 style={titleStyle}>{title}</h3>
          <p style={summaryStyle}>{summary}</p>
        </RvnCard.Body>

        {/* Footer with source and timestamp */}
        {hasFooter && (
          <RvnCard.Footer>
            {source && <span>{source}</span>}
            {source && timestamp && <RvnCard.Divider />}
            {timestamp && <span>{timestamp}</span>}
          </RvnCard.Footer>
        )}
      </RvnCard>
    )
  }
)

RvnIntelCard.displayName = 'RvnIntelCard'

export type { RvnIntelCardProps, Classification, Priority }

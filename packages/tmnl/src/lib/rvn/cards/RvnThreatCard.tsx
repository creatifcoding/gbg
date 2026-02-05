/**
 * RvnThreatCard
 *
 * Threat assessment card showing threat level with visual meter.
 * Thin wrapper around RvnCard compound component.
 *
 * Layout:
 * +-----------------------------+
 * | # THREAT-ID    [LEVEL BAR] | <- Header with threat meter
 * +-----------------------------+
 * | TYPE: Hostile Vehicle       |
 * | Description text...         |
 * +-----------------------------+
 * | LAT 34.0522 * LNG -118.2437| <- Coordinates footer
 * +-----------------------------+
 *
 * Level colors:
 * - minimal: #00ff00 (green)
 * - low: #88ff00 (yellow-green)
 * - moderate: #ffff00 (yellow)
 * - high: #ff8800 (orange)
 * - critical: #ff0000 with diagonal stripes
 */

import * as React from 'react'
import { RvnCard } from './RvnCard'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_COLORS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ThreatLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'critical'

interface Coordinates {
  lat: number
  lng: number
}

interface RvnThreatCardProps {
  /** Threat identifier code */
  threatId: string
  /** Type/classification of threat */
  threatType: string
  /** Threat level determines meter color */
  level: ThreatLevel
  /** Description of the threat */
  description: string
  /** Last updated timestamp */
  lastUpdated?: string
  /** Geographic coordinates */
  coordinates?: Coordinates
  /** Click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Style Constants
// -----------------------------------------------------------------------------

const threatIdContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const threatIconStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: '14px',
  fontWeight: RVN_FONT_WEIGHTS.bold,
  color: RVN_COLORS.textMain,
}

const threatIdStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: '14px',
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
}

const typeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '6px',
}

const typeLabelStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMuted,
}

const typeValueStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: '13px',
  fontWeight: RVN_FONT_WEIGHTS.bold,
  color: RVN_COLORS.textMain,
}

const descriptionStyle: React.CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: '13px',
  fontWeight: RVN_FONT_WEIGHTS.regular,
  color: RVN_COLORS.textMain,
  lineHeight: 1.4,
  margin: 0,
}

const footerStyle: React.CSSProperties = {
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '4px',
}

const coordinatesStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatCoordinate(value: number, isLatitude: boolean): string {
  const absValue = Math.abs(value)
  const direction = isLatitude
    ? value >= 0
      ? 'N'
      : 'S'
    : value >= 0
      ? 'E'
      : 'W'
  return `${absValue.toFixed(4)}${direction}`
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Threat Assessment Card
 *
 * @example
 * ```tsx
 * <RvnThreatCard
 *   threatId="THR-2847"
 *   threatType="Hostile Vehicle"
 *   level="high"
 *   description="Unidentified armored vehicle approaching perimeter from the northeast. Speed indicates potential breach attempt."
 *   coordinates={{ lat: 34.0522, lng: -118.2437 }}
 *   lastUpdated="14:32:18Z"
 *   onClick={() => console.log('View threat details')}
 * />
 * ```
 */
export const RvnThreatCard = React.forwardRef<HTMLDivElement, RvnThreatCardProps>(
  function RvnThreatCard(
    {
      threatId,
      threatType,
      level,
      description,
      lastUpdated,
      coordinates,
      onClick,
      className,
      style,
    },
    ref
  ) {
    const hasFooter = coordinates || lastUpdated

    return (
      <RvnCard
        ref={ref}
        variant="threat"
        onClick={onClick}
        className={className}
        style={style}
        data-rvn-threat-card=""
        data-threat-level={level}
      >
        {/* Header with Threat ID and Level Meter */}
        <RvnCard.Header>
          <div style={threatIdContainerStyle}>
            <span style={threatIconStyle}>#</span>
            <span style={threatIdStyle}>{threatId}</span>
          </div>
          <RvnCard.Meter level={level} />
        </RvnCard.Header>

        {/* Content Area */}
        <RvnCard.Body>
          <div style={typeRowStyle}>
            <span style={typeLabelStyle}>Type:</span>
            <span style={typeValueStyle}>{threatType}</span>
          </div>
          <p style={descriptionStyle}>{description}</p>
        </RvnCard.Body>

        {/* Footer with Coordinates and Timestamp */}
        {hasFooter && (
          <RvnCard.Footer style={footerStyle}>
            {coordinates && (
              <div style={coordinatesStyle}>
                <span>LAT {formatCoordinate(coordinates.lat, true)}</span>
                <RvnCard.Divider />
                <span>LNG {formatCoordinate(coordinates.lng, false)}</span>
              </div>
            )}
            {lastUpdated && <span>{lastUpdated}</span>}
          </RvnCard.Footer>
        )}
      </RvnCard>
    )
  }
)

RvnThreatCard.displayName = 'RvnThreatCard'

export type { RvnThreatCardProps, ThreatLevel, Coordinates }

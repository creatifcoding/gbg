/**
 * RvnUnitCard
 *
 * Card component for displaying unit/entity status with telemetry.
 * Features: monospace code display, status badge, selection state (inverted),
 * disabled state, power bar with critical striping.
 *
 * Source pattern: react-app(24).js - UnitCard
 *
 * This is a thin wrapper around the RvnCard compound component.
 */

import * as React from 'react'
import { RvnCard, type StatusType } from './RvnCard'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type UnitStatus = 'NOMINAL' | 'ALERT' | 'OFFLINE' | 'CRITICAL'

interface TelemetryData {
  label: string
  value: number | string
}

interface RvnUnitCardProps {
  /** Unit identifier code (e.g., TX-99) */
  code: string
  /** Unit status */
  status: UnitStatus
  /** Power/charge level (0-100) */
  powerLevel?: number
  /** Primary location identifier */
  location?: string
  /** Current mission/task */
  mission?: string
  /** Additional telemetry data */
  telemetry?: TelemetryData[]
  /** Whether card is selected (inverted colors) */
  selected?: boolean
  /** Disabled/offline state */
  disabled?: boolean
  /** Button label (defaults based on status) */
  actionLabel?: string
  /** Action button click handler */
  onAction?: () => void
  /** Card click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Status Mapping
// -----------------------------------------------------------------------------

function mapStatus(status: UnitStatus): StatusType {
  const mapping: Record<UnitStatus, StatusType> = {
    NOMINAL: 'nominal',
    ALERT: 'alert',
    OFFLINE: 'offline',
    CRITICAL: 'critical',
  }
  return mapping[status]
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Unit Card for entity status display with telemetry
 *
 * @example
 * ```tsx
 * <RvnUnitCard
 *   code="TX-99"
 *   status="ALERT"
 *   powerLevel={24}
 *   location="S04-ALPHA"
 *   mission="INTERCEPT"
 *   onAction={() => console.log('View profile')}
 * />
 * ```
 */
export const RvnUnitCard = React.forwardRef<HTMLDivElement, RvnUnitCardProps>(
  function RvnUnitCard(
    {
      code,
      status,
      powerLevel,
      location,
      mission,
      telemetry,
      selected = false,
      disabled = false,
      actionLabel,
      onAction,
      onClick,
      className,
      style,
    },
    ref
  ) {
    const isOffline = status === 'OFFLINE'
    const effectiveDisabled = disabled || isOffline
    const defaultActionLabel = isOffline ? 'Initiate Boot' : 'View Profile'

    return (
      <RvnCard
        ref={ref}
        variant="unit"
        selected={selected}
        disabled={effectiveDisabled}
        shadow="lg"
        onClick={onClick}
        className={className}
        style={style}
        data-rvn-unit-card=""
      >
        <RvnCard.Header>
          <RvnCard.Title>{code}</RvnCard.Title>
          <RvnCard.Status status={mapStatus(status)}>{status}</RvnCard.Status>
        </RvnCard.Header>

        <RvnCard.Body>
          {powerLevel !== undefined && (
            <RvnCard.Telemetry value={powerLevel} label="Power Core" />
          )}

          {(location || mission) && (
            <RvnCard.StatGroup>
              {location && (
                <RvnCard.Stat label="Location" value={location} orientation="vertical" />
              )}
              {mission && (
                <RvnCard.Stat label="Mission" value={mission} orientation="vertical" />
              )}
            </RvnCard.StatGroup>
          )}

          {telemetry?.map((item, i) => (
            <RvnCard.Stat key={i} label={item.label} value={item.value} />
          ))}
        </RvnCard.Body>

        {onAction && (
          <RvnCard.Actions>
            <RvnCard.Action onClick={onAction} disabled={effectiveDisabled}>
              {actionLabel || defaultActionLabel}
            </RvnCard.Action>
          </RvnCard.Actions>
        )}
      </RvnCard>
    )
  }
)

RvnUnitCard.displayName = 'RvnUnitCard'

export type { RvnUnitCardProps, UnitStatus, TelemetryData }

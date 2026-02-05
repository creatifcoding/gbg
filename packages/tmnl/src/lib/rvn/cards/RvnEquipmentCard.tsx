/**
 * RvnEquipmentCard
 *
 * Card component for displaying equipment/hardware status.
 * Thin wrapper around RvnCard compound component.
 *
 * Source pattern: react-app(33).js - EquipmentCard
 */

import * as React from 'react'
import { RvnCard, type StatusType } from './RvnCard'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type EquipmentStatus = 'NOMINAL' | 'HOT' | 'ALERT' | 'OFFLINE' | 'STANDBY'

interface RvnEquipmentCardProps {
  /** Category label (e.g., OPTICS, WEAPON, COMMS) */
  category: string
  /** Model code (e.g., MK-IV, ARC-R) */
  model: string
  /** Status indicator */
  status: EquipmentStatus
  /** Optional click handler */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Status Mapping
// -----------------------------------------------------------------------------

const STATUS_MAP: Record<EquipmentStatus, StatusType> = {
  NOMINAL: 'nominal',
  HOT: 'hot',
  ALERT: 'alert',
  OFFLINE: 'offline',
  STANDBY: 'standby',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Equipment Card for hardware status display
 *
 * @example
 * ```tsx
 * <RvnEquipmentCard
 *   category="OPTICS"
 *   model="MK-IV"
 *   status="NOMINAL"
 * />
 * ```
 */
export const RvnEquipmentCard = React.forwardRef<HTMLDivElement, RvnEquipmentCardProps>(
  function RvnEquipmentCard(
    { category, model, status, onClick, className, style },
    ref
  ) {
    return (
      <RvnCard
        ref={ref}
        variant="equipment"
        onClick={onClick}
        className={className}
        style={style}
        data-rvn-equipment-card=""
      >
        <RvnCard.Body>
          <RvnCard.Category>{category}</RvnCard.Category>
          <RvnCard.Title style={{ fontSize: '13px' }}>{model}</RvnCard.Title>
          <RvnCard.Status status={STATUS_MAP[status]}>{status}</RvnCard.Status>
        </RvnCard.Body>
      </RvnCard>
    )
  }
)

RvnEquipmentCard.displayName = 'RvnEquipmentCard'

export type { RvnEquipmentCardProps, EquipmentStatus }

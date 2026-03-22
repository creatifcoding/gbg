/**
 * RVN Cards
 *
 * Specialized card components for the RVN design system.
 *
 * Components:
 * - RvnCard: Compound component system (composable primitives)
 * - RvnEquipmentCard: Hardware/equipment status display
 * - RvnUnitCard: Unit/entity status with telemetry
 * - RvnObjectiveItem: Task/objective list items with checkbox
 * - RvnThreatStat: Label/value pair for data display
 * - RvnLogEntry: Communication/event log entries
 * - RvnIntelCard: Intelligence briefing card with classification
 * - RvnThreatCard: Threat assessment card with level meter
 */

// Compound Component System
export { RvnCard, useRvnCard } from './RvnCard'
export type {
  RvnCardVariant,
  RvnCardContextValue,
  StatusType,
  MeterLevel,
  BadgeLevel,
  PriorityLevel,
} from './RvnCard'

export { RvnEquipmentCard } from './RvnEquipmentCard'
export type { RvnEquipmentCardProps, EquipmentStatus } from './RvnEquipmentCard'

export { RvnUnitCard } from './RvnUnitCard'
export type { RvnUnitCardProps, UnitStatus, TelemetryData } from './RvnUnitCard'

export { RvnObjectiveItem } from './RvnObjectiveItem'
export type {
  RvnObjectiveItemProps,
  ObjectivePriority,
  ObjectiveStatus,
} from './RvnObjectiveItem'

export { RvnThreatStat, RvnThreatStatGroup } from './RvnThreatStat'
export type {
  RvnThreatStatProps,
  RvnThreatStatGroupProps,
  StatVariant,
  StatOrientation,
  StatTrend,
} from './RvnThreatStat'

export { RvnLogEntry, RvnLogContainer } from './RvnLogEntry'
export type { RvnLogEntryProps, RvnLogContainerProps, LogLevel } from './RvnLogEntry'

export { RvnIntelCard } from './RvnIntelCard'
export type {
  RvnIntelCardProps,
  Classification,
  Priority as IntelPriority,
} from './RvnIntelCard'

export { RvnThreatCard } from './RvnThreatCard'
export type {
  RvnThreatCardProps,
  ThreatLevel,
  Coordinates,
} from './RvnThreatCard'

/**
 * IIoT Repository Layer Composition
 *
 * Combines all repository layers into a single composable layer.
 * Use `IIoTRepositoriesLive` to provide all repositories at once.
 *
 * @module
 */

import { Layer } from 'effect'

// Asset repositories (ISA-95 hierarchy order)
import { EnterpriseRepoLive } from './EnterpriseRepo'
import { SiteRepoLive } from './SiteRepo'
import { AreaRepoLive } from './AreaRepo'
import { PlantRepoLive } from './PlantRepo'
import { LineRepoLive } from './LineRepo'
import { WorkCellRepoLive } from './WorkCellRepo'
import { MachineRepoLive } from './MachineRepo'
import { SensorRepoLive } from './SensorRepo'
import { DeviceRepoLive } from './DeviceRepo'

// Alarm repositories
import { AlarmRepoLive } from './AlarmRepo'
import { AlarmContextRepoLive } from './AlarmContextRepo'

// Config repositories
import { DeviceConfigRepoLive } from './DeviceConfigRepo'

// Work order repositories
import { WorkOrderRepoLive } from './WorkOrderRepo'
import { WorkOrderTransitionRepoLive } from './WorkOrderTransitionRepo'

// Equipment state repositories
import { EquipmentStateRepoLive } from './EquipmentStateRepo'

// Reading repositories (Composite PK)
import { SensorReadingRepoLive } from './SensorReadingRepo'
import { AggregatedReadingRepoLive } from './AggregatedReadingRepo'
import { AnalyticsRecordRepoLive } from './AnalyticsRecordRepo'

// Reactor repositories
import { ReactorCheckpointRepoLive } from './ReactorCheckpointRepo'

// =============================================================================
// Composed Layers
// =============================================================================

/**
 * ISA-95 Hierarchy repositories (Enterprise → Site → Area)
 *
 * Top-level hierarchy entities that don't depend on Plant/Line.
 * Requires: SqlClient.SqlClient
 */
export const HierarchyRepositoriesLive = Layer.mergeAll(
  EnterpriseRepoLive,
  SiteRepoLive,
  AreaRepoLive
)

/**
 * Asset repositories (Plant, Line, WorkCell, Machine, Sensor, Device)
 *
 * Manufacturing/process-level assets.
 * Requires: SqlClient.SqlClient
 */
export const AssetRepositoriesLive = Layer.mergeAll(
  PlantRepoLive,
  LineRepoLive,
  WorkCellRepoLive,
  MachineRepoLive,
  SensorRepoLive,
  DeviceRepoLive
)

/**
 * Alarm repositories (Alarm, AlarmContext)
 *
 * Requires: SqlClient.SqlClient
 */
export const AlarmRepositoriesLive = Layer.mergeAll(
  AlarmRepoLive,
  AlarmContextRepoLive
)

/**
 * Config repositories (DeviceConfig)
 *
 * Requires: SqlClient.SqlClient
 */
export const ConfigRepositoriesLive = Layer.mergeAll(
  DeviceConfigRepoLive
)

/**
 * Work order repositories (WorkOrder, WorkOrderTransition)
 *
 * Requires: SqlClient.SqlClient
 */
export const WorkOrderRepositoriesLive = Layer.mergeAll(
  WorkOrderRepoLive,
  WorkOrderTransitionRepoLive
)

/**
 * Equipment state repositories (EquipmentState)
 *
 * Requires: SqlClient.SqlClient
 */
export const EquipmentStateRepositoriesLive = Layer.mergeAll(
  EquipmentStateRepoLive
)

/**
 * Reading repositories (SensorReading, AggregatedReading, AnalyticsRecord)
 *
 * Requires: SqlClient.SqlClient
 */
export const ReadingRepositoriesLive = Layer.mergeAll(
  SensorReadingRepoLive,
  AggregatedReadingRepoLive,
  AnalyticsRecordRepoLive
)

/**
 * Reactor repositories.
 * Requires: SqlClient.SqlClient
 */
export const ReactorRepositoriesLive = Layer.mergeAll(
  ReactorCheckpointRepoLive
)

/**
 * All IIoT repositories combined
 *
 * Provides:
 * - EnterpriseRepo, SiteRepo, AreaRepo (hierarchy)
 * - PlantRepo, LineRepo, WorkCellRepo, MachineRepo, SensorRepo, DeviceRepo (assets)
 * - AlarmRepo, AlarmContextRepo (alarms)
 * - SensorReadingRepo, AggregatedReadingRepo, AnalyticsRecordRepo (readings)
 * - DeviceConfigRepo (config)
 * - EquipmentStateRepo (equipment states)
 * - WorkOrderRepo (work orders)
 * - ReactorCheckpointRepo (reactor replay/dedupe)
 *
 * Requires: SqlClient.SqlClient
 */
export const IIoTRepositoriesLive = Layer.mergeAll(
  HierarchyRepositoriesLive,
  AssetRepositoriesLive,
  AlarmRepositoriesLive,
  ReadingRepositoriesLive,
  ConfigRepositoriesLive,
  EquipmentStateRepositoriesLive,
  WorkOrderRepositoriesLive,
  ReactorRepositoriesLive
)

// =============================================================================
// Re-exports
// =============================================================================

// ISA-95 Hierarchy repos
export { EnterpriseRepo, EnterpriseRepoLive, type EnterpriseRepository, type EnterpriseRepoError } from './EnterpriseRepo'
export { SiteRepo, SiteRepoLive, type SiteRepository, type SiteRepoError } from './SiteRepo'
export { AreaRepo, AreaRepoLive, type AreaRepository, type AreaRepoError } from './AreaRepo'

// Asset repos
export { PlantRepo, PlantRepoLive, type PlantRepository } from './PlantRepo'
export { LineRepo, LineRepoLive, type LineRepository } from './LineRepo'
export { WorkCellRepo, WorkCellRepoLive, type WorkCellRepository, type WorkCellRepoError } from './WorkCellRepo'
export { MachineRepo, MachineRepoLive, type MachineRepository } from './MachineRepo'
export { SensorRepo, SensorRepoLive, type SensorRepository } from './SensorRepo'
export { DeviceRepo, DeviceRepoLive, type DeviceRepository, type DeviceRepoError } from './DeviceRepo'

// Alarm repos
export { AlarmRepo, AlarmRepoLive, type AlarmRepository } from './AlarmRepo'
export { AlarmContextRepo, AlarmContextRepoLive, type AlarmContextRepository } from './AlarmContextRepo'

// Reading repos
export { SensorReadingRepo, SensorReadingRepoLive, type SensorReadingRepository } from './SensorReadingRepo'
export { AggregatedReadingRepo, AggregatedReadingRepoLive, type AggregatedReadingRepository } from './AggregatedReadingRepo'
export { AnalyticsRecordRepo, AnalyticsRecordRepoLive, type AnalyticsRecordRepository } from './AnalyticsRecordRepo'

// Config repos
export { DeviceConfigRepo, DeviceConfigRepoLive, type DeviceConfigRepository, type DeviceConfigRepoError, AuditLogEntry } from './DeviceConfigRepo'

// Equipment state repos
export { EquipmentStateRepo, EquipmentStateRepoLive, type EquipmentStateRepository, type EquipmentStateRepoError } from './EquipmentStateRepo'

// Work order repos
export { WorkOrderRepo, WorkOrderRepoLive, type WorkOrderRepository, type WorkOrderRepoError } from './WorkOrderRepo'
export { WorkOrderTransitionRepo, WorkOrderTransitionRepoLive, type WorkOrderTransitionRepository, type WorkOrderTransitionRepoError } from './WorkOrderTransitionRepo'

// Reactor repos
export {
  ReactorCheckpointRepo,
  ReactorCheckpointRepoLive,
  ReactorCheckpointRepoInMemory,
  markProcessedIfPresent,
  type ReactorCheckpointRepository,
  type ReactorCheckpointRepoError,
} from './ReactorCheckpointRepo'

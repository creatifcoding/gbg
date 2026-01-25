/**
 * IIoT Repository Layer Composition
 *
 * Combines all repository layers into a single composable layer.
 * Use `IIoTRepositoriesLive` to provide all repositories at once.
 *
 * @module
 */

import { Layer } from 'effect'

// Asset repositories
import { PlantRepoLive } from './PlantRepo'
import { LineRepoLive } from './LineRepo'
import { MachineRepoLive } from './MachineRepo'
import { SensorRepoLive } from './SensorRepo'

// Alarm repositories
import { AlarmRepoLive } from './AlarmRepo'
import { AlarmContextRepoLive } from './AlarmContextRepo'

// Reading repositories (Composite PK)
import { SensorReadingRepoLive } from './SensorReadingRepo'
import { AggregatedReadingRepoLive } from './AggregatedReadingRepo'
import { AnalyticsRecordRepoLive } from './AnalyticsRecordRepo'

// =============================================================================
// Composed Layers
// =============================================================================

/**
 * Asset repositories (Plant, Line, Machine, Sensor)
 *
 * Requires: SqlClient.SqlClient
 */
export const AssetRepositoriesLive = Layer.mergeAll(
  PlantRepoLive,
  LineRepoLive,
  MachineRepoLive,
  SensorRepoLive
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
 * All IIoT repositories combined
 *
 * Provides:
 * - PlantRepo, LineRepo, MachineRepo, SensorRepo (assets)
 * - AlarmRepo, AlarmContextRepo (alarms)
 * - SensorReadingRepo, AggregatedReadingRepo, AnalyticsRecordRepo (readings)
 *
 * Requires: SqlClient.SqlClient
 */
export const IIoTRepositoriesLive = Layer.mergeAll(
  AssetRepositoriesLive,
  AlarmRepositoriesLive,
  ReadingRepositoriesLive
)

// =============================================================================
// Re-exports
// =============================================================================

// Asset repos
export { PlantRepo, PlantRepoLive, type PlantRepository } from './PlantRepo'
export { LineRepo, LineRepoLive, type LineRepository } from './LineRepo'
export { MachineRepo, MachineRepoLive, type MachineRepository } from './MachineRepo'
export { SensorRepo, SensorRepoLive, type SensorRepository } from './SensorRepo'

// Alarm repos
export { AlarmRepo, AlarmRepoLive, type AlarmRepository } from './AlarmRepo'
export { AlarmContextRepo, AlarmContextRepoLive, type AlarmContextRepository } from './AlarmContextRepo'

// Reading repos
export { SensorReadingRepo, SensorReadingRepoLive, type SensorReadingRepository } from './SensorReadingRepo'
export { AggregatedReadingRepo, AggregatedReadingRepoLive, type AggregatedReadingRepository } from './AggregatedReadingRepo'
export { AnalyticsRecordRepo, AnalyticsRecordRepoLive, type AnalyticsRecordRepository } from './AnalyticsRecordRepo'

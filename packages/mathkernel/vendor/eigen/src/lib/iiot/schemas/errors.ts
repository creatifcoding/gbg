/**
 * IIoT Error Schemas
 *
 * Tagged errors for IIoT operations using Effect's Data.TaggedError pattern.
 *
 * @module
 */

import { Data } from 'effect'
import type { DeviceId, AlarmId, MachineId, PlantId } from './identifiers'
import { HierarchyError } from './hierarchy'

// Re-export HierarchyError from hierarchy module
export { HierarchyError }

// =============================================================================
// Database Errors
// =============================================================================

/** Error connecting to the IIoT database */
export class IIoTConnectionError extends Data.TaggedError('IIoTConnectionError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** Error executing a query */
export class IIoTQueryError extends Data.TaggedError('IIoTQueryError')<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Sensor Errors
// =============================================================================

/** Sensor/device not found */
export class DeviceNotFoundError extends Data.TaggedError('DeviceNotFoundError')<{
  readonly deviceId: DeviceId
}> {}

/** Invalid sensor reading */
export class InvalidReadingError extends Data.TaggedError('InvalidReadingError')<{
  readonly deviceId: DeviceId
  readonly message: string
  readonly value?: number
}> {}

// =============================================================================
// Asset Errors
// =============================================================================

/** Machine not found in asset hierarchy */
export class MachineNotFoundError extends Data.TaggedError('MachineNotFoundError')<{
  readonly machineId: MachineId
}> {}

/** Plant not found in asset hierarchy */
export class PlantNotFoundError extends Data.TaggedError('PlantNotFoundError')<{
  readonly plantId: PlantId
}> {}

// Note: HierarchyError is defined in hierarchy/path.ts with specific error codes
// Re-exported via hierarchy/index.ts

// =============================================================================
// Alarm Errors
// =============================================================================

/** Alarm not found */
export class AlarmNotFoundError extends Data.TaggedError('AlarmNotFoundError')<{
  readonly alarmId: AlarmId
}> {}

/** Alarm already acknowledged */
export class AlarmAlreadyAcknowledgedError extends Data.TaggedError('AlarmAlreadyAcknowledgedError')<{
  readonly alarmId: AlarmId
}> {}

/** Alarm already cleared */
export class AlarmAlreadyClearedError extends Data.TaggedError('AlarmAlreadyClearedError')<{
  readonly alarmId: AlarmId
}> {}

// =============================================================================
// Graph Errors
// =============================================================================

/** Error executing Cypher query on Apache AGE */
export class GraphQueryError extends Data.TaggedError('GraphQueryError')<{
  readonly query: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Union Types
// =============================================================================

/** All IIoT service errors */
export type IIoTServiceError =
  | IIoTConnectionError
  | IIoTQueryError
  | DeviceNotFoundError
  | InvalidReadingError
  | MachineNotFoundError
  | PlantNotFoundError
  | HierarchyError
  | AlarmNotFoundError
  | AlarmAlreadyAcknowledgedError
  | AlarmAlreadyClearedError
  | GraphQueryError

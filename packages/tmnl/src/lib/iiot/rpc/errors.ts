/**
 * IIoT RPC Error Schemas
 *
 * Schema.TaggedError definitions for RPC error channel.
 * These are separate from the internal Data.TaggedError types used by services.
 *
 * @module
 */

import { Schema } from 'effect'
import { DeviceId, AlarmId, MachineId, PlantId } from '../schemas/identifiers'

// =============================================================================
// Query Errors
// =============================================================================

/** Error executing IIoT query */
export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()('RpcQueryError', {
  operation: Schema.String,
  message: Schema.String,
}) {}

/** Error executing graph query */
export class RpcGraphError extends Schema.TaggedError<RpcGraphError>()('RpcGraphError', {
  message: Schema.String,
}) {}

// =============================================================================
// Sensor Errors
// =============================================================================

/** Sensor/device not found */
export class RpcDeviceNotFoundError extends Schema.TaggedError<RpcDeviceNotFoundError>()(
  'RpcDeviceNotFoundError',
  {
    deviceId: DeviceId,
  }
) {}

/** Invalid sensor reading */
export class RpcInvalidReadingError extends Schema.TaggedError<RpcInvalidReadingError>()(
  'RpcInvalidReadingError',
  {
    deviceId: DeviceId,
    message: Schema.String,
  }
) {}

// =============================================================================
// Asset Errors
// =============================================================================

/** Machine not found */
export class RpcMachineNotFoundError extends Schema.TaggedError<RpcMachineNotFoundError>()(
  'RpcMachineNotFoundError',
  {
    machineId: MachineId,
  }
) {}

/** Plant not found */
export class RpcPlantNotFoundError extends Schema.TaggedError<RpcPlantNotFoundError>()(
  'RpcPlantNotFoundError',
  {
    plantId: PlantId,
  }
) {}

/** Asset hierarchy error */
export class RpcHierarchyError extends Schema.TaggedError<RpcHierarchyError>()('RpcHierarchyError', {
  message: Schema.String,
}) {}

// =============================================================================
// Alarm Errors
// =============================================================================

/** Alarm not found */
export class RpcAlarmNotFoundError extends Schema.TaggedError<RpcAlarmNotFoundError>()(
  'RpcAlarmNotFoundError',
  {
    alarmId: AlarmId,
  }
) {}

/** Alarm already acknowledged */
export class RpcAlarmAlreadyAcknowledgedError extends Schema.TaggedError<RpcAlarmAlreadyAcknowledgedError>()(
  'RpcAlarmAlreadyAcknowledgedError',
  {
    alarmId: AlarmId,
  }
) {}

/** Alarm already cleared */
export class RpcAlarmAlreadyClearedError extends Schema.TaggedError<RpcAlarmAlreadyClearedError>()(
  'RpcAlarmAlreadyClearedError',
  {
    alarmId: AlarmId,
  }
) {}

// =============================================================================
// Workflow Errors
// =============================================================================

/** Workflow error */
export class RpcWorkflowError extends Schema.TaggedError<RpcWorkflowError>()('RpcWorkflowError', {
  workflowId: Schema.String,
  message: Schema.String,
}) {}

/** Alarm lifecycle workflow error */
export class RpcAlarmWorkflowError extends Schema.TaggedError<RpcAlarmWorkflowError>()(
  'RpcAlarmWorkflowError',
  {
    alarmId: AlarmId,
    message: Schema.String,
  }
) {}

/** Monitor device workflow error */
export class RpcMonitorWorkflowError extends Schema.TaggedError<RpcMonitorWorkflowError>()(
  'RpcMonitorWorkflowError',
  {
    deviceId: DeviceId,
    message: Schema.String,
  }
) {}

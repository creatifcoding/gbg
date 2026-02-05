/**
 * SensorEntity - Effect Cluster Entity for Sensor Reading Aggregation
 *
 * Manages sensor state and provides real-time reading aggregation.
 * Sensors are read-intensive and optimized for streaming queries.
 *
 * Entity Lifecycle:
 * - GetLatest: Get most recent reading
 * - GetAggregated: Get aggregated readings over time window
 * - Subscribe: Stream real-time readings
 *
 * Note: Raw readings are stored in TimescaleDB (NOT event sourced).
 * This entity provides a stateful view for real-time operations.
 *
 * @module
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { SensorId, DeviceId, MachineId } from '../schemas/identifiers'
import {
  SensorReading,
  AggregatedReading,
  TimeBucket,
  OpcUaQuality,
} from '../schemas/readings'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Sensor not found error */
export class RpcSensorNotFoundError extends Schema.TaggedError<RpcSensorNotFoundError>()(
  'RpcSensorNotFoundError',
  {
    sensorId: SensorId,
  }
) {}

/** No readings available error */
export class RpcNoReadingsError extends Schema.TaggedError<RpcNoReadingsError>()(
  'RpcNoReadingsError',
  {
    sensorId: SensorId,
    message: Schema.String,
  }
) {}

/** Query error */
export class RpcSensorQueryError extends Schema.TaggedError<RpcSensorQueryError>()(
  'RpcSensorQueryError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Sensor State Representation
// =============================================================================

/** Sensor state for entity */
export const SensorState = Schema.Struct({
  sensorId: SensorId,
  deviceId: DeviceId,
  machineId: MachineId,
  name: Schema.NonEmptyString,
  unit: Schema.optionalWith(Schema.String, { as: 'Option' }),
  lastReading: Schema.optionalWith(SensorReading, { as: 'Option' }),
  lastQuality: Schema.optionalWith(OpcUaQuality, { as: 'Option' }),
  isOnline: Schema.Boolean,
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
})
export type SensorState = Schema.Schema.Type<typeof SensorState>

/** Reading statistics */
export const ReadingStats = Schema.Struct({
  sensorId: SensorId,
  count: Schema.Number,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddev: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  avgQuality: Schema.Number,
  periodStart: Schema.DateTimeUtc,
  periodEnd: Schema.DateTimeUtc,
})
export type ReadingStats = Schema.Schema.Type<typeof ReadingStats>

// =============================================================================
// RPC Tags
// =============================================================================

export const SensorEntityType = 'Sensor' as const
export const SensorGetStateTag = `${SensorEntityType}.GetState` as const
export const SensorGetLatestTag = `${SensorEntityType}.GetLatest` as const
export const SensorGetAggregatedTag = `${SensorEntityType}.GetAggregated` as const
export const SensorGetStatsTag = `${SensorEntityType}.GetStats` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Get sensor state
 */
export class GetSensorStateRpc extends Rpc.make(SensorGetStateTag, {
  payload: Schema.Struct({
    sensorId: SensorId,
  }),
  success: SensorState,
  error: RpcSensorNotFoundError,
}) {}

/**
 * Get latest reading for sensor
 */
export class GetLatestReadingRpc extends Rpc.make(SensorGetLatestTag, {
  payload: Schema.Struct({
    sensorId: SensorId,
  }),
  success: SensorReading,
  error: Schema.Union(RpcSensorNotFoundError, RpcNoReadingsError),
}) {}

/**
 * Get aggregated readings for time window
 */
export class GetAggregatedReadingsRpc extends Rpc.make(SensorGetAggregatedTag, {
  payload: Schema.Struct({
    sensorId: SensorId,
    bucket: TimeBucket,
    since: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    until: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
    limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
  }),
  success: Schema.Array(AggregatedReading),
  error: Schema.Union(RpcSensorNotFoundError, RpcSensorQueryError),
}) {}

/**
 * Get reading statistics for time period
 */
export class GetReadingStatsRpc extends Rpc.make(SensorGetStatsTag, {
  payload: Schema.Struct({
    sensorId: SensorId,
    since: Schema.DateTimeUtc,
    until: Schema.DateTimeUtc,
  }),
  success: ReadingStats,
  error: Schema.Union(RpcSensorNotFoundError, RpcSensorQueryError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Sensor Entity
 *
 * Provides stateful sensor operations for real-time monitoring.
 * Each sensor instance is keyed by sensorId.
 *
 * Note: This entity is optimized for reads. Writes go directly
 * to TimescaleDB via the repository layer.
 */
export const SensorEntity = Entity.make(SensorEntityType, [
  GetSensorStateRpc,
  GetLatestReadingRpc,
  GetAggregatedReadingsRpc,
  GetReadingStatsRpc,
])

/**
 * Type helper for Sensor Entity
 */
export type SensorEntity = typeof SensorEntity

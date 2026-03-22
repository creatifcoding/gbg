/**
 * SensorRpcs - RPC Definitions for Sensor Operations
 *
 * Stateless time-series queries exposed via Effect RPC.
 * All tags imported from centralized tags.ts.
 *
 * @module
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'
import { DeviceId } from '../schemas/identifiers'
import { SensorReading, AggregatedReading, TimeBucket } from '../schemas/readings'
import { RpcQueryError } from './errors'
import {
  SensorReadingGetLatestTag,
  SensorReadingQueryTag,
  SensorReadingSubscribeTag,
  AggregatedReadingQueryTag,
} from '../tags'

// =============================================================================
// GetLatest - Get most recent reading for a device
// =============================================================================

export const GetLatest = Rpc.make(SensorReadingGetLatestTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,
  }),
  success: Schema.OptionFromNullOr(SensorReading),
  error: RpcQueryError,
})

// =============================================================================
// Query - Query readings with optional time range
// =============================================================================

export const Query = Rpc.make(SensorReadingQueryTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,
    since: Schema.optional(Schema.DateTimeUtc),
    until: Schema.optional(Schema.DateTimeUtc),
    limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  }),
  success: SensorReading,
  error: RpcQueryError,
  stream: true, // Streaming response
})

// =============================================================================
// QueryAggregated - Query from continuous aggregates
// =============================================================================

export const QueryAggregated = Rpc.make(AggregatedReadingQueryTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,
    bucket: TimeBucket,
    since: Schema.optional(Schema.DateTimeUtc),
    until: Schema.optional(Schema.DateTimeUtc),
  }),
  success: AggregatedReading,
  error: RpcQueryError,
  stream: true, // Streaming response
})

// =============================================================================
// Subscribe - Real-time sensor reading subscription
// =============================================================================

export const Subscribe = Rpc.make(SensorReadingSubscribeTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,
    pollIntervalMs: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({ default: 5000 })
      )
    ),
  }),
  success: SensorReading,
  error: RpcQueryError,
  stream: true, // Streaming response - emits readings as they arrive
})

// =============================================================================
// RpcGroup Export
// =============================================================================

export const SensorRpcs = RpcGroup.make(
  GetLatest,
  Query,
  QueryAggregated,
  Subscribe
)

// Export type for client typing
export type SensorRpcs = typeof SensorRpcs

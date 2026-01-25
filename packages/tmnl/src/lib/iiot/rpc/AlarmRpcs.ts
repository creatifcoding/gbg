/**
 * AlarmRpcs - RPC Definitions for Alarm Operations
 *
 * Combines:
 * 1. Entity-derived RPCs via EntityProxy.toRpcGroup(AlarmEntity)
 * 2. Stateless query operations (QueryAlarms, GetAlarmContext, GetAlarmStats)
 *
 * Per DeepWiki: EntityProxy.toRpcGroup creates standard and "discard" RPCs
 * for each Entity operation. These are combined with stateless RPCs using
 * RpcGroup.make with spread of requests.values().
 *
 * @module
 */

import { Rpc, RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { Schema } from 'effect'
import { AlarmId, DeviceId } from '../schemas/identifiers'
import { Alarm, AlarmContext, AlarmQueryParams, AlarmSeverity } from '../schemas/alarms'
import { AlarmEntity } from '../entity/AlarmEntity'
import { RpcQueryError, RpcAlarmNotFoundError } from './errors'
import {
  AlarmQueryTag,
  AlarmContextGetTag,
  AlarmGetStatsTag,
} from '../tags'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from AlarmEntity
 *
 * Per DeepWiki, EntityProxy.toRpcGroup creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 *
 * Tags derived (from tags.ts):
 * - Alarm.Create, Alarm.CreateDiscard
 * - Alarm.Get, Alarm.GetDiscard
 * - Alarm.Acknowledge, Alarm.AcknowledgeDiscard
 * - Alarm.Clear, Alarm.ClearDiscard
 */
export class AlarmEntityRpcs extends EntityProxy.toRpcGroup(AlarmEntity) {}

// =============================================================================
// Stateless Query RPCs
// =============================================================================

/**
 * Query alarms with filters (streaming)
 *
 * Stateless operation that queries the database directly.
 */
export const QueryAlarms = Rpc.make(AlarmQueryTag, {
  payload: AlarmQueryParams,
  success: Alarm,
  error: RpcQueryError,
  stream: true,
})

/**
 * Get alarm context (readings around alarm time)
 *
 * Returns sensor readings before and after the alarm trigger time
 * for root cause analysis.
 */
export const GetAlarmContext = Rpc.make(AlarmContextGetTag, {
  payload: Schema.Struct({
    alarmId: AlarmId,
    windowMs: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({ default: 60000 }) // 1 minute default
      )
    ),
  }),
  success: Schema.Array(AlarmContext),
  error: Schema.Union(RpcQueryError, RpcAlarmNotFoundError),
})

/**
 * Alarm statistics schema
 */
export const AlarmStats = Schema.Struct({
  total: Schema.Number,
  open: Schema.Number,
  acknowledged: Schema.Number,
  cleared: Schema.Number,
  bySeverity: Schema.Record({
    key: AlarmSeverity,
    value: Schema.Number,
  }),
})
export type AlarmStats = Schema.Schema.Type<typeof AlarmStats>

/**
 * Get alarm statistics
 *
 * Returns aggregate counts of alarms by status and severity.
 */
export const GetAlarmStats = Rpc.make(AlarmGetStatsTag, {
  payload: Schema.Struct({
    deviceId: Schema.optional(DeviceId),
    since: Schema.optional(Schema.DateTimeUtc),
  }),
  success: AlarmStats,
  error: RpcQueryError,
})

/**
 * Stateless alarm query RPCs
 */
export const StatelessAlarmRpcs = RpcGroup.make(
  QueryAlarms,
  GetAlarmContext,
  GetAlarmStats
)

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

/**
 * Combined Alarm RPCs
 *
 * Merges entity-derived RPCs (lifecycle operations) with stateless RPCs
 * (query operations) into a single RpcGroup.
 *
 * Available operations:
 *
 * Entity operations (via EntityProxy):
 * - Alarm.Create / Alarm.CreateDiscard
 * - Alarm.Get / Alarm.GetDiscard
 * - Alarm.Acknowledge / Alarm.AcknowledgeDiscard
 * - Alarm.Clear / Alarm.ClearDiscard
 *
 * Stateless operations:
 * - Alarm.Query (streaming)
 * - AlarmContext.Get
 * - Alarm.GetStats
 */
export const AlarmRpcs = RpcGroup.make(
  // Spread entity-derived RPCs
  ...Array.from(AlarmEntityRpcs.requests.values()),
  // Spread stateless RPCs
  ...Array.from(StatelessAlarmRpcs.requests.values())
)

// Export type for client typing
export type AlarmRpcs = typeof AlarmRpcs

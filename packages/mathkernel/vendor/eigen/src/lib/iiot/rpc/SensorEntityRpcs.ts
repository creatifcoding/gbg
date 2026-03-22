/**
 * SensorEntityRpcs - Entity-Derived RPC Group for Sensor Entity Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Sensor entity operation (GetState, GetLatest, GetAggregated, GetStats).
 *
 * Note: This is distinct from SensorRpcs.ts which contains stateless
 * time-series query RPCs (GetLatest, Query, QueryAggregated, Subscribe).
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { SensorEntity } from '../entity/SensorEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from SensorEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class SensorReadingEntityRpcs extends EntityProxy.toRpcGroup(SensorEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const SensorEntityRpcs = RpcGroup.make(
  ...Array.from(SensorReadingEntityRpcs.requests.values())
)

export type SensorEntityRpcs = typeof SensorEntityRpcs

/**
 * SensorAssetRpcs - Entity-Derived RPC Group for SensorAsset Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each SensorAsset entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { SensorAssetEntity } from '../entity/SensorAssetEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from SensorAssetEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class SensorAssetEntityRpcs extends EntityProxy.toRpcGroup(SensorAssetEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const SensorAssetRpcs = RpcGroup.make(
  ...Array.from(SensorAssetEntityRpcs.requests.values())
)

export type SensorAssetRpcs = typeof SensorAssetRpcs

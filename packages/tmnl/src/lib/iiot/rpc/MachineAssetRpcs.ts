/**
 * MachineAssetRpcs - Entity-Derived RPC Group for MachineAsset Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each MachineAsset entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { MachineAssetEntity } from '../entity/MachineAssetEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from MachineAssetEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class MachineAssetEntityRpcs extends EntityProxy.toRpcGroup(MachineAssetEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const MachineAssetRpcs = RpcGroup.make(
  ...Array.from(MachineAssetEntityRpcs.requests.values())
)

export type MachineAssetRpcs = typeof MachineAssetRpcs

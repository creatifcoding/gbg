/**
 * AssetEntityRpcs - Entity-Derived RPC Group for Asset Hierarchy Entity Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Asset entity operation (Get, GetChildren, GetHierarchy, Update).
 *
 * Note: This is distinct from AssetRpcs.ts which contains stateless
 * graph query RPCs (ListPlants, GetPlantHierarchy, etc.).
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { AssetEntity } from '../entity/AssetEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from AssetEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class AssetHierarchyEntityRpcs extends EntityProxy.toRpcGroup(AssetEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const AssetEntityRpcs = RpcGroup.make(
  ...Array.from(AssetHierarchyEntityRpcs.requests.values())
)

export type AssetEntityRpcs = typeof AssetEntityRpcs

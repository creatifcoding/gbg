/**
 * PlantRpcs - Entity-Derived RPC Group for Plant Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Plant entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { PlantEntity } from '../entity/PlantEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from PlantEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class PlantEntityRpcs extends EntityProxy.toRpcGroup(PlantEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const PlantRpcs = RpcGroup.make(
  ...Array.from(PlantEntityRpcs.requests.values())
)

export type PlantRpcs = typeof PlantRpcs

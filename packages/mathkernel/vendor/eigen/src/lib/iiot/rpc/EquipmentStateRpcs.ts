/**
 * EquipmentStateRpcs - Entity-Derived RPC Group for Equipment State Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each EquipmentState entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { EquipmentStateEntity } from '../entity/EquipmentStateEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from EquipmentStateEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class EquipmentStateEntityRpcs extends EntityProxy.toRpcGroup(EquipmentStateEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const EquipmentStateRpcs = RpcGroup.make(
  ...Array.from(EquipmentStateEntityRpcs.requests.values())
)

export type EquipmentStateRpcs = typeof EquipmentStateRpcs

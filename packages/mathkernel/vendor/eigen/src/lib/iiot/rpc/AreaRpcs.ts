/**
 * AreaRpcs - Entity-Derived RPC Group for Area Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Area entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { AreaEntity } from '../entity/AreaEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from AreaEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class AreaEntityRpcs extends EntityProxy.toRpcGroup(AreaEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const AreaRpcs = RpcGroup.make(
  ...Array.from(AreaEntityRpcs.requests.values())
)

export type AreaRpcs = typeof AreaRpcs

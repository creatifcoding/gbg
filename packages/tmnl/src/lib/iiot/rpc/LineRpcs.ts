/**
 * LineRpcs - Entity-Derived RPC Group for Line Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Line entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { LineEntity } from '../entity/LineEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from LineEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class LineEntityRpcs extends EntityProxy.toRpcGroup(LineEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const LineRpcs = RpcGroup.make(
  ...Array.from(LineEntityRpcs.requests.values())
)

export type LineRpcs = typeof LineRpcs

/**
 * WorkCellRpcs - Entity-Derived RPC Group for WorkCell Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each WorkCell entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { WorkCellEntity } from '../entity/WorkCellEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from WorkCellEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class WorkCellEntityRpcs extends EntityProxy.toRpcGroup(WorkCellEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const WorkCellRpcs = RpcGroup.make(
  ...Array.from(WorkCellEntityRpcs.requests.values())
)

export type WorkCellRpcs = typeof WorkCellRpcs

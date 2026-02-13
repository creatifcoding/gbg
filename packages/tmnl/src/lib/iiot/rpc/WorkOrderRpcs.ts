/**
 * WorkOrderRpcs - Entity-Derived RPC Group for WorkOrder Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each WorkOrder entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { WorkOrderEntity } from '../entity/WorkOrderEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from WorkOrderEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class WorkOrderEntityRpcs extends EntityProxy.toRpcGroup(WorkOrderEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const WorkOrderRpcs = RpcGroup.make(
  ...Array.from(WorkOrderEntityRpcs.requests.values())
)

export type WorkOrderRpcs = typeof WorkOrderRpcs

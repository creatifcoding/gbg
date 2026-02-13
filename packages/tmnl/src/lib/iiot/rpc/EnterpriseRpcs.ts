/**
 * EnterpriseRpcs - Entity-Derived RPC Group for Enterprise Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Enterprise entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { EnterpriseEntity } from '../entity/EnterpriseEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from EnterpriseEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class EnterpriseEntityRpcs extends EntityProxy.toRpcGroup(EnterpriseEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const EnterpriseRpcs = RpcGroup.make(
  ...Array.from(EnterpriseEntityRpcs.requests.values())
)

export type EnterpriseRpcs = typeof EnterpriseRpcs

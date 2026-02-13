/**
 * SiteRpcs - Entity-Derived RPC Group for Site Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Site entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { SiteEntity } from '../entity/SiteEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from SiteEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class SiteEntityRpcs extends EntityProxy.toRpcGroup(SiteEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const SiteRpcs = RpcGroup.make(
  ...Array.from(SiteEntityRpcs.requests.values())
)

export type SiteRpcs = typeof SiteRpcs

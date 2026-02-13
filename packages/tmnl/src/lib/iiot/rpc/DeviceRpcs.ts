/**
 * DeviceRpcs - Entity-Derived RPC Group for Device Operations
 *
 * Uses EntityProxy.toRpcGroup() to create standard and "discard" RPCs
 * for each Device entity operation.
 *
 * @module
 */

import { RpcGroup } from '@effect/rpc'
import { EntityProxy } from '@effect/cluster'
import { DeviceAssetEntity } from '../entity/DeviceEntity'

// =============================================================================
// Entity-Derived RPCs
// =============================================================================

/**
 * Entity-derived RPC group from DeviceAssetEntity
 *
 * Creates for each Entity RPC:
 * - ${entity.type}.${rpc._tag} - standard call with entityId + payload
 * - ${entity.type}.${rpc._tag}Discard - fire-and-forget variant
 */
export class DeviceEntityRpcs extends EntityProxy.toRpcGroup(DeviceAssetEntity) {}

// =============================================================================
// Combined RpcGroup Export
// =============================================================================

export const DeviceRpcs = RpcGroup.make(
  ...Array.from(DeviceEntityRpcs.requests.values())
)

export type DeviceRpcs = typeof DeviceRpcs

/**
 * IIoT Raw RPC Server
 *
 * Exposes all entity RPCs via a binary /rpc endpoint using
 * RpcServer.layerProtocolHttpRouter(). This runs alongside
 * the REST API for programmatic/binary clients.
 *
 * Architecture:
 * ```
 * POST /rpc (ndjson/msgpack)
 *   -> RpcServer protocol
 *     -> EntityProxyServer.layerRpcHandlers (per entity)
 *       -> entity.client(entityId).RpcName(payload)
 *         -> Sharding -> EntityManager -> Mailbox -> Entity behavior
 * ```
 *
 * Wire format options:
 * - ndjson (default) — human-readable, good for debugging
 * - msgpack — compact binary, production-optimized
 *
 * @module @gbg/tmnl/iiot/http/rpc-server
 */

import * as RpcServer from '@effect/rpc/RpcServer'
import { RpcSerialization } from '@effect/rpc'
import { EntityProxyServer } from '@effect/cluster'
import { Layer } from 'effect'
import { IIoTRpcs } from '../rpc'

// Entity imports — direct imports to avoid barrel name collisions
import { AlarmEntity } from '../entity/AlarmEntity'
import { PlantEntity } from '../entity/PlantEntity'
import { LineEntity } from '../entity/LineEntity'
import { WorkCellEntity } from '../entity/WorkCellEntity'
import { MachineAssetEntity } from '../entity/MachineAssetEntity'
import { DeviceAssetEntity } from '../entity/DeviceEntity'
import { SensorAssetEntity } from '../entity/SensorAssetEntity'
import { EnterpriseEntity } from '../entity/EnterpriseEntity'
import { SiteEntity } from '../entity/SiteEntity'
import { AreaEntity } from '../entity/AreaEntity'
import { WorkOrderEntity } from '../entity/WorkOrderEntity'
import { EquipmentStateEntity } from '../entity/EquipmentStateEntity'
import { AssetEntity } from '../entity/AssetEntity'

// =============================================================================
// Entity RPC Handlers (proxy through cluster)
// =============================================================================

/**
 * Combined RPC handler layer for all 13 entities.
 *
 * Each layerRpcHandlers() call creates handlers that:
 * 1. Resolve the entity client from the cluster
 * 2. Forward RPC requests to the correct entity instance
 * 3. Handle standard + discard (fire-and-forget) variants
 */
const EntityRpcHandlers = Layer.mergeAll(
  EntityProxyServer.layerRpcHandlers(AlarmEntity),
  EntityProxyServer.layerRpcHandlers(EnterpriseEntity),
  EntityProxyServer.layerRpcHandlers(SiteEntity),
  EntityProxyServer.layerRpcHandlers(AreaEntity),
  EntityProxyServer.layerRpcHandlers(PlantEntity),
  EntityProxyServer.layerRpcHandlers(LineEntity),
  EntityProxyServer.layerRpcHandlers(WorkCellEntity),
  EntityProxyServer.layerRpcHandlers(MachineAssetEntity),
  EntityProxyServer.layerRpcHandlers(DeviceAssetEntity),
  EntityProxyServer.layerRpcHandlers(SensorAssetEntity),
  EntityProxyServer.layerRpcHandlers(WorkOrderEntity),
  EntityProxyServer.layerRpcHandlers(EquipmentStateEntity),
  EntityProxyServer.layerRpcHandlers(AssetEntity),
)

// =============================================================================
// RPC Server Layer
// =============================================================================

/**
 * Core RPC server layer.
 *
 * Combines:
 * - IIoTRpcs group (all entity-derived RPCs)
 * - EntityRpcHandlers (proxy handlers through cluster)
 */
const RpcServerCore = RpcServer.layer(IIoTRpcs).pipe(
  Layer.provide(EntityRpcHandlers),
)

// =============================================================================
// Protocol Layers (choose one per deployment)
// =============================================================================

/**
 * Raw /rpc endpoint using ndjson serialization.
 *
 * Human-readable wire format, good for development and debugging.
 * Mounts at /rpc on the HttpRouter.
 *
 * Requires: Cluster layer (TestRunner or BunClusterHttp)
 */
export const IIoTRpcNdjson = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolHttpRouter({ path: '/rpc' }),
  RpcSerialization.layerNdjson,
)

/**
 * Raw /rpc endpoint using msgpack serialization.
 *
 * Compact binary wire format, optimized for production throughput.
 * Mounts at /rpc on the HttpRouter.
 *
 * Requires: Cluster layer (TestRunner or BunClusterHttp)
 */
export const IIoTRpcMsgPack = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolHttpRouter({ path: '/rpc' }),
  RpcSerialization.layerMsgPack,
)

/**
 * Default RPC server layer (ndjson for dev, switch to msgpack for prod).
 */
export const IIoTRpcServer = IIoTRpcNdjson

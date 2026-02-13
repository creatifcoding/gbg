/**
 * IIoT EntityProxyServer Handlers
 *
 * Creates HttpApi handler layers for all 13 entities using
 * EntityProxyServer.layerHttpApi(). Each handler routes HTTP
 * requests through the cluster to entity actors.
 *
 * Request flow:
 *   HTTP POST /api/alarms/Acknowledge/:entityId
 *     -> EntityProxyServer handler
 *       -> entity.client(entityId).Acknowledge(payload)
 *         -> Sharding -> EntityManager -> Mailbox -> Entity behavior
 *
 * @module @gbg/tmnl/iiot/http/proxy-handlers
 */

import { EntityProxyServer } from '@effect/cluster'
import { Layer } from 'effect'
import { IIoTApi } from './api'

// Entity imports - direct imports to avoid barrel name collisions
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
// Proxy Handler Layers
// =============================================================================

/**
 * Combined proxy handler layer for all IIoT entities.
 *
 * Each layerHttpApi call creates a Layer that:
 * 1. Satisfies the HttpApiGroup contract for that entity
 * 2. Routes requests through the entity client (cluster-aware)
 * 3. Handles serialization/deserialization via Effect Schema
 *
 * The group names must match those used in IIoTApi.add() calls.
 */
export const ProxyHandlers = Layer.mergeAll(
  // ISA-18.2 Alarms
  EntityProxyServer.layerHttpApi(IIoTApi, 'alarms', AlarmEntity),
  // ISA-95 Asset Hierarchy (top-down)
  EntityProxyServer.layerHttpApi(IIoTApi, 'enterprises', EnterpriseEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'sites', SiteEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'areas', AreaEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'plants', PlantEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'lines', LineEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'workcells', WorkCellEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'machines', MachineAssetEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'devices', DeviceAssetEntity),
  EntityProxyServer.layerHttpApi(IIoTApi, 'sensors', SensorAssetEntity),
  // Work Orders (FDA 21 CFR Part 11)
  EntityProxyServer.layerHttpApi(IIoTApi, 'workorders', WorkOrderEntity),
  // Equipment State (OEE)
  EntityProxyServer.layerHttpApi(IIoTApi, 'equipment', EquipmentStateEntity),
  // Asset Hierarchy Queries
  EntityProxyServer.layerHttpApi(IIoTApi, 'assets', AssetEntity),
)

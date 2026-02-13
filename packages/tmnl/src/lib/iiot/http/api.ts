/**
 * IIoT HttpApi Definition
 *
 * Composes all 13 entity HttpApiGroups into a single HttpApi
 * using EntityProxy.toHttpApiGroup(). Each entity gets auto-generated
 * POST endpoints for every Rpc.make() operation.
 *
 * Generated endpoint pattern:
 *   POST /api/{domain}/{rpcTag}/:entityId
 *
 * @module @gbg/tmnl/iiot/http/api
 */

import { EntityProxy } from '@effect/cluster'
import { HttpApi } from '@effect/platform'
import { OpenApi } from '@effect/platform'

// Middleware
import { IIoTAuthMiddleware } from './middleware/auth'
import { IIoTRateLimitMiddleware } from './middleware/rate-limit'

// Query groups - manual HttpApiGroups for stateless RPCs
import { AssetQueryGroup, SensorQueryGroup, AlarmQueryGroup, WorkOrderQueryGroup } from './query-api'

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
// IIoT HttpApi
// =============================================================================

/**
 * Combined IIoT HttpApi
 *
 * All 13 entity domains exposed as REST endpoints:
 *
 * ISA-18.2 Alarms:
 *   POST /api/alarms/{Create|Get|Acknowledge|Clear}/:entityId
 *
 * ISA-95 Asset Hierarchy:
 *   POST /api/enterprises/{Create|Get|Restructure|...}/:entityId
 *   POST /api/sites/{Create|Get|BeginConstruction|...}/:entityId
 *   POST /api/areas/{Create|Get|Restrict|...}/:entityId
 *   POST /api/plants/{Create|Get|CompleteCommissioning|...}/:entityId
 *   POST /api/lines/{Create|Get|Start|Stop|...}/:entityId
 *   POST /api/workcells/{Create|Get|BeginSetup|...}/:entityId
 *   POST /api/machines/{Create|Get|Activate|...}/:entityId
 *   POST /api/devices/{Create|Get|GoOnline|...}/:entityId
 *   POST /api/sensors/{Create|Get|StartCalibration|...}/:entityId
 *
 * Work Orders (FDA 21 CFR Part 11):
 *   POST /api/workorders/{Create|Get|Submit|Approve|...}/:entityId
 *
 * Equipment State (OEE):
 *   POST /api/equipment/{GetCurrent|Transition|GetOee|...}/:entityId
 *
 * Asset Hierarchy Queries:
 *   POST /api/assets/{Get|GetChildren|GetHierarchy|Update}/:entityId
 */
export class IIoTApi extends HttpApi.make('iiot-api')
  .annotateContext(OpenApi.annotations({
    title: 'IIoT Asset Management API',
    version: '3.0.0',
    description: 'REST API for ISA-95 IIoT asset hierarchy and operations',
  }))
  // Rate limiting (runs first — before auth)
  .middleware(IIoTRateLimitMiddleware)
  // Auth middleware (provide IIoTAuthDisabledLayer for dev/tests, IIoTAuthBearerLayer for prod)
  .middleware(IIoTAuthMiddleware)
  // ISA-18.2 Alarms
  .add(EntityProxy.toHttpApiGroup('alarms', AlarmEntity).prefix('/api/alarms'))
  // ISA-95 Asset Hierarchy (top-down)
  .add(EntityProxy.toHttpApiGroup('enterprises', EnterpriseEntity).prefix('/api/enterprises'))
  .add(EntityProxy.toHttpApiGroup('sites', SiteEntity).prefix('/api/sites'))
  .add(EntityProxy.toHttpApiGroup('areas', AreaEntity).prefix('/api/areas'))
  .add(EntityProxy.toHttpApiGroup('plants', PlantEntity).prefix('/api/plants'))
  .add(EntityProxy.toHttpApiGroup('lines', LineEntity).prefix('/api/lines'))
  .add(EntityProxy.toHttpApiGroup('workcells', WorkCellEntity).prefix('/api/workcells'))
  .add(EntityProxy.toHttpApiGroup('machines', MachineAssetEntity).prefix('/api/machines'))
  .add(EntityProxy.toHttpApiGroup('devices', DeviceAssetEntity).prefix('/api/devices'))
  .add(EntityProxy.toHttpApiGroup('sensors', SensorAssetEntity).prefix('/api/sensors'))
  // Work Orders (FDA 21 CFR Part 11)
  .add(EntityProxy.toHttpApiGroup('workorders', WorkOrderEntity).prefix('/api/workorders'))
  // Equipment State (OEE)
  .add(EntityProxy.toHttpApiGroup('equipment', EquipmentStateEntity).prefix('/api/equipment'))
  // Asset Hierarchy Queries
  .add(EntityProxy.toHttpApiGroup('assets', AssetEntity).prefix('/api/assets'))
  // Stateless Query Endpoints (not entity-derived)
  .add(AssetQueryGroup.prefix('/api'))
  .add(SensorQueryGroup.prefix('/api'))
  .add(AlarmQueryGroup.prefix('/api'))
  .add(WorkOrderQueryGroup.prefix('/api'))
{}

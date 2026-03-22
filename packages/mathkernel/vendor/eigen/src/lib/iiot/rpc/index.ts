/**
 * IIoT RPC Barrel Export
 *
 * All RPC definitions for the IIoT system, organized into domain-specific groups
 * and composed into a single {@link IIoTRpcs} group for server mounting.
 *
 * RPC categories:
 * - **Stateless query RPCs** — SensorRpcs, AssetRpcs (no entity state)
 * - **Entity-derived RPCs** — Generated via EntityProxy.toRpcGroup() from cluster entities
 * - **Realtime streaming RPCs** — WebSocket-based subscriptions (readings, alarms, equipment, invalidations)
 *
 * @module @gbg/tmnl/iiot/rpc
 * @see {@link IIoTRpcs} for the combined RPC group
 * @see {@link RealtimeRpcs} for WebSocket streaming subscriptions
 */

import { RpcGroup } from '@effect/rpc'

// Individual RPC groups - re-export all
export * from './SensorRpcs'
export * from './AssetRpcs'
export * from './AlarmRpcs'
export * from './errors'

// Realtime streaming RPCs
export * from './RealtimeRpcs'

// Entity-derived RPC groups
export * from './WorkOrderRpcs'
export * from './EquipmentStateRpcs'
export * from './PlantRpcs'
export * from './LineRpcs'
export * from './WorkCellRpcs'
export * from './MachineAssetRpcs'
export * from './DeviceRpcs'
export * from './SensorAssetRpcs'
export * from './EnterpriseRpcs'
export * from './SiteRpcs'
export * from './AreaRpcs'
export * from './AssetEntityRpcs'
export * from './SensorEntityRpcs'

// Import for composition
import { SensorRpcs } from './SensorRpcs'
import { AssetRpcs } from './AssetRpcs'
import { AlarmRpcs } from './AlarmRpcs'
import { WorkOrderRpcs } from './WorkOrderRpcs'
import { EquipmentStateRpcs } from './EquipmentStateRpcs'
import { PlantRpcs } from './PlantRpcs'
import { LineRpcs } from './LineRpcs'
import { WorkCellRpcs } from './WorkCellRpcs'
import { MachineAssetRpcs } from './MachineAssetRpcs'
import { DeviceRpcs } from './DeviceRpcs'
import { SensorAssetRpcs } from './SensorAssetRpcs'
import { EnterpriseRpcs } from './EnterpriseRpcs'
import { SiteRpcs } from './SiteRpcs'
import { AreaRpcs } from './AreaRpcs'
import { AssetEntityRpcs } from './AssetEntityRpcs'
import { SensorEntityRpcs } from './SensorEntityRpcs'
import { RealtimeRpcs } from './RealtimeRpcs'

// =============================================================================
// Combined IIoT RPC Group
// =============================================================================

/**
 * Combined IIoT RPCs
 *
 * Single RpcGroup containing all IIoT operations:
 *
 * Stateless query RPCs:
 * - Sensor: GetLatest, Query, QueryAggregated, Subscribe
 * - Asset: GetSensorHierarchy, GetPlantHierarchy, GetMachineWithSensors, etc.
 *
 * Entity-derived RPCs (via EntityProxy.toRpcGroup):
 * - Alarm: Create, Get, Acknowledge, Clear + Query, Context, Stats
 * - WorkOrder: Create, Get, Submit, Approve, Reject, Start, Suspend, Resume, Complete, Fail, Cancel, Close
 * - EquipmentState: GetCurrent, GetHistory, Transition, UpdateReason, GetOee, GetDurations
 * - Plant: Create, Get, CompleteCommissioning, ScheduledShutdown, Restart, EmergencyShutdown, etc.
 * - Line: Create, Get, Start, Stop, BeginChangeover, CompleteChangeover, MarkStarved, etc.
 * - WorkCell: Create, Get, BeginSetup, CompleteSetup, Stop, MarkBlocked, ClearBlocked, etc.
 * - MachineAsset: Create, Get, Activate, GoIdle, Resume, MarkFaulted, ScheduleRepair, etc.
 * - Device: Create, Get, GoOnline, GoOffline, MarkFaulted, ClearFault, etc.
 * - SensorAsset: Create, Get, StartCalibration, CompleteCalibration, FailCalibration, etc.
 * - Enterprise: Create, Get, Restructure, CompleteRestructuring, Merge, Dissolve
 * - Site: Create, Get, BeginConstruction, Commission, SeasonalShutdown, Reopen, Close, Decommission
 * - Area: Create, Get, Restrict, ClearRestriction, EnterMaintenance, ExitMaintenance, etc.
 * - Asset (hierarchy): Get, GetChildren, GetHierarchy, Update
 * - Sensor (readings): GetState, GetLatest, GetAggregated, GetStats
 */
export const IIoTRpcs = RpcGroup.make(
  // Stateless query RPCs
  ...Array.from(SensorRpcs.requests.values()),
  ...Array.from(AssetRpcs.requests.values()),
  // Entity-derived RPCs
  ...Array.from(AlarmRpcs.requests.values()),
  ...Array.from(WorkOrderRpcs.requests.values()),
  ...Array.from(EquipmentStateRpcs.requests.values()),
  ...Array.from(PlantRpcs.requests.values()),
  ...Array.from(LineRpcs.requests.values()),
  ...Array.from(WorkCellRpcs.requests.values()),
  ...Array.from(MachineAssetRpcs.requests.values()),
  ...Array.from(DeviceRpcs.requests.values()),
  ...Array.from(SensorAssetRpcs.requests.values()),
  ...Array.from(EnterpriseRpcs.requests.values()),
  ...Array.from(SiteRpcs.requests.values()),
  ...Array.from(AreaRpcs.requests.values()),
  ...Array.from(AssetEntityRpcs.requests.values()),
  ...Array.from(SensorEntityRpcs.requests.values()),
  // Realtime streaming RPCs
  ...Array.from(RealtimeRpcs.requests.values()),
)

// Export type for client typing
export type IIoTRpcs = typeof IIoTRpcs

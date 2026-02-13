/**
 * IIoT Entity Barrel Export
 *
 * Effect Cluster Entity definitions for IIoT domain aggregates.
 * Each entity is a distributed actor managing lifecycle state via
 * Machine-backed handlers and graph-validated state transitions.
 *
 * Entity Boundaries (per ADR-0012):
 * - **Alarm**: EVENT SOURCED — ISA-18.2 lifecycle (triggered -> acknowledged -> cleared)
 * - **WorkOrder**: EVENT SOURCED — FDA 21 CFR Part 11 compliance (draft -> approved -> completed)
 * - **EquipmentState**: EVENT SOURCED — OEE tracking (running -> faulted -> idle)
 * - **Asset**: NOT event sourced — ISA-95 hierarchy queries
 * - **Sensor**: NOT event sourced — TimescaleDB time-series reads
 *
 * ISA-95 asset entities (Enterprise, Site, Area, Plant, Line, WorkCell, Machine, Device, Sensor)
 * are NOT barrel-exported here due to generic RPC error name collisions.
 * Import them directly: `import { SiteEntity } from './SiteEntity'`
 *
 * @module @gbg/tmnl/iiot/entity
 * @see {@link EntityHandlersLayer} for composed handler layers
 * @see {@link EntityTestingStack} for test-ready composition
 */

// Alarm Entity - ISA-18.2 lifecycle (EVENT SOURCED)
export {
  AlarmEntity,
  AlarmEntityHandlers,
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
  type AlarmEntity as AlarmEntityType,
} from './AlarmEntity'

// Asset Entity - ISA-95 hierarchy (NOT event sourced)
export {
  AssetEntity,
  GetAssetRpc,
  GetChildrenRpc,
  GetHierarchyRpc,
  UpdateAssetRpc,
  RpcAssetNotFoundError,
  RpcAssetValidationError,
  RpcAssetHierarchyError,
  AssetRecord,
  AssetPath,
  AssetEntityType,
  AssetGetTag,
  AssetGetChildrenTag,
  AssetGetHierarchyTag,
  AssetUpdateTag,
  type AssetEntity as AssetEntityTypeAlias,
} from './AssetEntity'

// Sensor Entity - Reading aggregation (NOT event sourced)
export {
  SensorEntity,
  GetSensorStateRpc,
  GetLatestReadingRpc,
  GetAggregatedReadingsRpc,
  GetReadingStatsRpc,
  RpcSensorNotFoundError,
  RpcNoReadingsError,
  RpcSensorQueryError,
  SensorState,
  ReadingStats,
  SensorEntityType,
  SensorGetStateTag,
  SensorGetLatestTag,
  SensorGetAggregatedTag,
  SensorGetStatsTag,
  type SensorEntity as SensorEntityTypeAlias,
} from './SensorEntity'

// WorkOrder Entity - FDA 21 CFR Part 11 lifecycle (EVENT SOURCED)
export {
  WorkOrderEntity,
  WorkOrderEntityHandlers,
  CreateWorkOrderRpc,
  GetWorkOrderRpc,
  SubmitWorkOrderRpc,
  ApproveWorkOrderRpc,
  RejectWorkOrderRpc,
  StartWorkOrderRpc,
  SuspendWorkOrderRpc,
  ResumeWorkOrderRpc,
  CompleteWorkOrderRpc,
  FailWorkOrderRpc,
  CancelWorkOrderRpc,
  CloseWorkOrderRpc,
  RpcWorkOrderNotFoundError,
  RpcWorkOrderTransitionError,
  RpcWorkOrderValidationError,
  WorkOrderEntityType,
  WorkOrderCreateTag,
  WorkOrderGetTag,
  WorkOrderSubmitTag,
  WorkOrderApproveTag,
  WorkOrderRejectTag,
  WorkOrderStartTag,
  WorkOrderSuspendTag,
  WorkOrderResumeTag,
  WorkOrderCompleteTag,
  WorkOrderFailTag,
  WorkOrderCancelTag,
  WorkOrderCloseTag,
  type WorkOrderEntity as WorkOrderEntityTypeAlias,
} from './WorkOrderEntity'

// EquipmentState Entity - OEE tracking (EVENT SOURCED)
export {
  EquipmentStateEntity,
  EquipmentStateEntityHandlers,
  GetCurrentStateRpc,
  GetStateHistoryRpc,
  TransitionStateRpc,
  UpdateStateReasonRpc,
  GetOeeRpc,
  GetDurationsRpc,
  RpcEquipmentStateNotFoundError,
  RpcMachineStateNotFoundError,
  RpcEquipmentTransitionError,
  RpcOeeCalculationError,
  OeeResult,
  EquipmentStateEntityType,
  EquipmentStateGetCurrentTag,
  EquipmentStateGetHistoryTag,
  EquipmentStateTransitionTag,
  EquipmentStateUpdateReasonTag,
  EquipmentStateGetOeeTag,
  EquipmentStateGetDurationsTag,
  type EquipmentStateEntity as EquipmentStateEntityTypeAlias,
} from './EquipmentStateEntity'

// ─────────────────────────────────────────────────────────────────────────────
// ISA-95 Asset Entities
//
// NOT barrel-exported because entity files share generic RPC error names
// (RpcNotFoundError, RpcTransitionError, RpcQueryError).
// Import directly from the specific entity file:
//
//   import { EnterpriseEntity, EnterpriseEntityHandlers } from './EnterpriseEntity'
//   import { SiteEntity, SiteEntityHandlers } from './SiteEntity'
//   import { AreaEntity, AreaEntityHandlers } from './AreaEntity'
//   import { PlantEntity, PlantEntityHandlers } from './PlantEntity'
//   import { LineEntity, LineEntityHandlers } from './LineEntity'
//   import { WorkCellEntity, WorkCellEntityHandlers } from './WorkCellEntity'
//   import { MachineAssetEntity, MachineAssetEntityHandlers } from './MachineAssetEntity'
//   import { DeviceEntity, DeviceEntityHandlers } from './DeviceEntity'
//   import { SensorAssetEntity, SensorAssetEntityHandlers } from './SensorAssetEntity'
//
// Their handlers are composed in EntityStack.EntityHandlersLayer.
// ─────────────────────────────────────────────────────────────────────────────

// Entity Stack - Layer composition for testing and production
export {
  EntityHandlersLayer,
  EntityTestingStack,
  EntityProductionHandlersWithEvents,
} from './EntityStack'

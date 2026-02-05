/**
 * IIoT Entity Barrel Export
 *
 * Effect Cluster Entity definitions for IIoT domain aggregates.
 * Each entity is a distributed actor managing lifecycle state.
 *
 * Entity Boundaries (per ADR-0012):
 * - Alarm: EVENT SOURCED - ISA-18.2 lifecycle
 * - WorkOrder: EVENT SOURCED - FDA 21 CFR Part 11 compliance
 * - EquipmentState: EVENT SOURCED - OEE tracking
 * - Asset: NOT event sourced - hierarchy queries
 * - Sensor: NOT event sourced - TimescaleDB reads
 *
 * @module
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

// Entity Stack - Layer composition for testing and production
export {
  EntityHandlersLayer,
  EntityTestingStack,
  EntityProductionHandlersWithEvents,
} from './EntityStack'

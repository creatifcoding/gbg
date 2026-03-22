/**
 * State Transition Graphs
 *
 * Effect Graph.directed definitions for validating entity state transitions.
 * Graphs are immutable after creation and used to validate transitions
 * before persisting state changes.
 *
 * NOTE: For graphs with overlapping validator names (canDecommission, canMarkFaulted, etc.),
 * prefer namespace imports: `MachineAssetGraph.canDecommission(state)`.
 * The aliased named exports below are for convenience in single-graph contexts.
 *
 * @module
 */

// Alarm State Graph (ISA-18.2)
export * as AlarmGraph from './alarm-state-graph'
export {
  alarmStateGraph,
  canAcknowledgeAlarm,
  canClearAlarm,
  canShelveAlarm,
  canSuppressAlarm,
  canTakeAlarmOutOfService,
  canReturnAlarmToService,
  type AlarmStateNode,
  type AlarmTransitionAction,
} from './alarm-state-graph'

// Work Order Graph (FDA 21 CFR Part 11)
export * as WorkOrderGraph from './work-order-graph'
export {
  workOrderStateGraph,
  canSubmitWorkOrder,
  canApproveWorkOrder,
  canRejectWorkOrder,
  canStartWorkOrder,
  canSuspendWorkOrder,
  canResumeWorkOrder,
  canCompleteWorkOrder,
  canFailWorkOrder,
  canCancelWorkOrder,
  canCloseWorkOrder,
  isTerminalState as isWorkOrderTerminalState,
  type WorkOrderStateNode,
  type WorkOrderTransitionAction,
} from './work-order-graph'

// Equipment State Graph (ISA-95 / OEE)
export * as EquipmentGraph from './equipment-state-graph'
export {
  equipmentStateGraph,
  canStartProduction,
  canStopProduction,
  canEnterPlannedDowntime,
  canReportBreakdown,
  canStartSetup,
  canCompleteSetup,
  canBecomeBlocked,
  isAvailabilityLoss,
  isPerformanceLoss,
  isProductive,
  type EquipmentStateNode,
  type EquipmentTransitionAction,
} from './equipment-state-graph'

// Enterprise State Graph (ISA-95 Level 4)
export * as EnterpriseGraph from './enterprise-graph'
export {
  enterpriseStateGraph,
  canRestructure,
  canCompleteRestructuring,
  canMerge,
  canDissolve,
  isTerminalState as isEnterpriseTerminalState,
  type EnterpriseStateNode,
  type EnterpriseTransitionAction,
} from './enterprise-graph'

// Site State Graph (ISA-95 Level 3)
export * as SiteGraph from './site-graph'
export {
  siteStateGraph,
  canBeginConstruction,
  canCommission,
  canSeasonalShutdown,
  canReopen,
  canClose,
  canDecommission as canDecommissionSite,
  isTerminalState as isSiteTerminalState,
  type SiteStateNode,
  type SiteTransitionAction,
} from './site-graph'

// Area State Graph (ISA-95 Level 2)
export * as AreaGraph from './area-graph'
export {
  areaStateGraph,
  canRestrict,
  canClearRestriction,
  canEnterMaintenance as canEnterAreaMaintenance,
  canExitMaintenance,
  canDeactivate,
  canActivate as canActivateArea,
  canDecommission as canDecommissionArea,
  isTerminalState as isAreaTerminalState,
  type AreaStateNode,
  type AreaTransitionAction,
} from './area-graph'

// Plant State Graph (ISA-95 Level 3 Functional)
export * as PlantGraph from './plant-graph'
export {
  plantStateGraph,
  canCompleteCommissioning,
  canScheduledShutdown,
  canRestart,
  canEmergencyShutdown,
  canBeginEmergencyMaintenance,
  canCompleteMaintenanceRestart,
  canMaintenanceShutdown,
  canDecommission as canDecommissionPlant,
  isTerminalState as isPlantTerminalState,
  type PlantStateNode,
  type PlantTransitionAction,
} from './plant-graph'

// Line State Graph (ISA-95 Level 1 / OEE)
export * as LineGraph from './line-graph'
export {
  lineStateGraph,
  canStart as canStartLine,
  canStop as canStopLine,
  canBeginChangeover,
  canCompleteChangeover,
  canMarkStarved,
  canClearStarved,
  canMarkBlocked as canMarkLineBlocked,
  canClearBlocked as canClearLineBlocked,
  canEnterMaintenance as canEnterLineMaintenance,
  canCompleteMaintenance as canCompleteLineMaintenance,
  canDecommission as canDecommissionLine,
  isTerminalState as isLineTerminalState,
  isProductive as isLineProductive,
  isPerformanceLoss as isLinePerformanceLoss,
  isAvailabilityLoss as isLineAvailabilityLoss,
  type LineStateNode,
  type LineTransitionAction,
} from './line-graph'

// WorkCell State Graph (ISA-95 Level 1)
export * as WorkcellGraph from './workcell-graph'
export {
  workcellStateGraph,
  canBeginSetup,
  canCompleteSetup as canCompleteWorkcellSetup,
  canStop as canStopWorkcell,
  canMarkBlocked as canMarkWorkcellBlocked,
  canClearBlocked as canClearWorkcellBlocked,
  canMarkFaulted as canMarkWorkcellFaulted,
  canClearFault as canClearWorkcellFault,
  canEnterMaintenance as canEnterWorkcellMaintenance,
  canCompleteMaintenance as canCompleteWorkcellMaintenance,
  canDecommission as canDecommissionWorkcell,
  isTerminalState as isWorkcellTerminalState,
  type WorkcellStateNode,
  type WorkcellTransitionAction,
} from './workcell-graph'

// Machine Asset Graph (ISA-95 Equipment Module)
export * as MachineAssetGraph from './machine-asset-graph'
export {
  machineAssetStateGraph,
  canActivate as canActivateMachine,
  canGoIdle,
  canResume as canResumeMachine,
  canMarkFaulted as canMarkMachineFaulted,
  canScheduleRepair,
  canEmergencyRepair,
  canScheduleMaintenance,
  canCompleteMaintenance as canCompleteMachineMaintenance,
  canRetire,
  canDecommission as canDecommissionMachine,
  isTerminalState as isMachineTerminalState,
  type MachineAssetStateNode,
  type MachineAssetTransitionAction,
} from './machine-asset-graph'

// Device Graph (ISA-95 Control Module - actuation)
export * as DeviceGraph from './device-graph'
export {
  deviceStateGraph,
  canGoOnline,
  canGoOffline,
  canMarkFaulted as canMarkDeviceFaulted,
  canClearFault as canClearDeviceFault,
  canStartFirmwareUpdate,
  canCompleteFirmwareUpdate,
  canFailFirmwareUpdate,
  canDecommission as canDecommissionDevice,
  isTerminalState as isDeviceTerminalState,
  type DeviceStateNode,
  type DeviceTransitionAction,
} from './device-graph'

// Sensor Graph (ISA-95 Control Module - sensing)
export * as SensorGraph from './sensor-graph'
export {
  sensorStateGraph,
  canStartCalibration,
  canCompleteCalibration,
  canFailCalibration,
  canFlagForCalibration,
  canMarkFaulted as canMarkSensorFaulted,
  canClearFault as canClearSensorFault,
  canTakeOffline,
  canBringOnline,
  canDecommission as canDecommissionSensor,
  isTerminalState as isSensorTerminalState,
  type SensorStateNode,
  type SensorTransitionAction,
} from './sensor-graph'

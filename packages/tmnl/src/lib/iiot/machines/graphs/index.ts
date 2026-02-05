/**
 * State Transition Graphs
 *
 * Effect Graph.directed definitions for validating entity state transitions.
 * Graphs are immutable after creation and used to validate transitions
 * before persisting state changes.
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
  isTerminalState,
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

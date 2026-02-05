/**
 * Operational Events — Runtime Business Events
 *
 * Exports all operational event schemas for IIoT event sourcing.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational
 */

// Alarm Events (ISA-18.2)
export {
  AlarmTriggered,
  AlarmAcknowledged,
  AlarmCleared,
  AlarmEscalated,
  AlarmShelved,
  AlarmUnshelved,
  AlarmSuppressed,
  AlarmOutOfService,
  AlarmReturnedToService,
  AlarmConfigChanged,
  ALARM_EVENT_TAGS,
  type AlarmTriggeredType,
  type AlarmAcknowledgedType,
  type AlarmClearedType,
  type AlarmEscalatedType,
  type AlarmShelvedType,
  type AlarmUnshelvedType,
  type AlarmSuppressedType,
  type AlarmOutOfServiceType,
  type AlarmReturnedToServiceType,
  type AlarmConfigChangedType,
  type AlarmEvent,
  type AlarmEventTag,
} from './alarm-events'

// WorkOrder Context Events (EL-3.5-8)
export {
  // Branded Types
  WorkOrderContextId,
  ResourceId,
  ExternalRefId,
  // Supporting Types
  ResourceType,
  SnapshotReason,
  // Events
  ContextCreated,
  ContextUpdated,
  ContextSnapshotted,
  AssetAttached,
  AssetDetached,
  ResourceAllocated,
  ResourceReleased,
  ExternalRefLinked,
  ExternalRefUnlinked,
  ChildWorkOrderSpawned,
  // Tags and Union
  CONTEXT_EVENT_TAGS,
  type ContextCreatedType,
  type ContextUpdatedType,
  type ContextSnapshottedType,
  type AssetAttachedType,
  type AssetDetachedType,
  type ResourceAllocatedType,
  type ResourceReleasedType,
  type ExternalRefLinkedType,
  type ExternalRefUnlinkedType,
  type ChildWorkOrderSpawnedType,
  type ContextEvent,
  type ContextEventTag,
} from './context-events'

// Task Instance Events (EL-3.9-12)
export {
  // Branded Types
  TaskDefinitionId,
  // Events
  TaskBecameReady,
  TaskStarted,
  TaskProgressUpdated,
  TaskBlocked,
  TaskUnblocked,
  TaskCompleted,
  TaskFailed,
  TaskSkipped,
  TaskCompensated,
  // Tags and Union
  TASK_EVENT_TAGS,
  type TaskBecameReadyType,
  type TaskStartedType,
  type TaskProgressUpdatedType,
  type TaskBlockedType,
  type TaskUnblockedType,
  type TaskCompletedType,
  type TaskFailedType,
  type TaskSkippedType,
  type TaskCompensatedType,
  type TaskEvent,
  type TaskEventTag,
} from './task-events'

// Approval Events (EL-3.13-16)
export {
  // Branded Types
  ApprovalRequestId,
  ApproverId,
  ApprovalLevel,
  // Supporting Types
  ApprovalStatus,
  EscalationReason,
  // Events
  ApprovalRequested,
  ApprovalGranted,
  ApprovalRejected,
  ApprovalEscalated,
  ApprovalCompleted,
  ApprovalExpired,
  // Tags and Union
  APPROVAL_EVENT_TAGS,
  type ApprovalRequestedType,
  type ApprovalGrantedType,
  type ApprovalRejectedType,
  type ApprovalEscalatedType,
  type ApprovalCompletedType,
  type ApprovalExpiredType,
  type ApprovalEvent,
  type ApprovalEventTag,
} from './approval-events'

// WorkOrder Lifecycle Events (EL-3.1-4)
export {
  // Events
  WorkOrderCreated,
  WorkOrderSubmitted,
  WorkOrderApproved,
  WorkOrderRejected,
  WorkOrderStarted,
  WorkOrderSuspended,
  WorkOrderResumed,
  WorkOrderCompleted,
  WorkOrderFailed,
  WorkOrderCancelled,
  WorkOrderClosed,
  // Tags and Union
  WORK_ORDER_EVENT_TAGS,
  type WorkOrderCreatedType,
  type WorkOrderSubmittedType,
  type WorkOrderApprovedType,
  type WorkOrderRejectedType,
  type WorkOrderStartedType,
  type WorkOrderSuspendedType,
  type WorkOrderResumedType,
  type WorkOrderCompletedType,
  type WorkOrderFailedType,
  type WorkOrderCancelledType,
  type WorkOrderClosedType,
  type WorkOrderEvent,
  type WorkOrderEventTag,
} from './work-order-events'

// Equipment State Events (EL-4.1-3)
export {
  // Enums
  EquipmentState,
  MaintenanceType,
  FaultSeverity,
  MaintenanceOutcome,
  FaultClearMethod,
  // Events
  EquipmentStateChanged,
  MaintenanceModeEntered,
  MaintenanceModeExited,
  PerformanceDegraded,
  FaultDetected,
  FaultCleared,
  // Tags and Union
  EQUIPMENT_STATE_EVENT_TAGS,
  type EquipmentStateChangedType,
  type MaintenanceModeEnteredType,
  type MaintenanceModeExitedType,
  type PerformanceDegradedType,
  type FaultDetectedType,
  type FaultClearedType,
  type EquipmentStateEvent,
  type EquipmentStateEventTag,
} from './equipment-state-events'

// Workflow Definition Events (EL-3.11-12)
export {
  // Supporting Types
  TaskTemplate,
  VersionChange,
  // Events
  DefinitionCreated,
  DefinitionVersioned,
  DefinitionActivated,
  DefinitionDeprecated,
  DefinitionArchived,
  // Tags and Union
  WORKFLOW_DEFINITION_EVENT_TAGS,
  type DefinitionCreatedType,
  type DefinitionVersionedType,
  type DefinitionActivatedType,
  type DefinitionDeprecatedType,
  type DefinitionArchivedType,
  type WorkflowDefinitionEvent,
  type WorkflowDefinitionEventTag,
} from './workflow-definition-events'

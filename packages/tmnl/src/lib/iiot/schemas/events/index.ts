/**
 * Event Schemas — Three Divergent Event Categories
 *
 * @module @gbg/tmnl/iiot/schemas/events
 * @see thoughts/shared/specs/entity-system/03-event-hierarchy.md
 */

// Base Classes
export {
  BaseStructuralEvent,
  BaseOperationalEvent,
  BaseTemporalEvent,
  type BaseStructuralEventType,
  type BaseOperationalEventType,
  type BaseTemporalEventType,
} from './base'

// Quality Codes
export { OpcQuality, type OpcQuality as OpcQualityType } from './base'

// Routing & Type Guards
export {
  getEventStorage,
  isStructuralEvent,
  isOperationalEvent,
  isTemporalEvent,
  type EventStorage,
} from './base'

// EventGroup Definitions (for EventLog integration)
export {
  StructuralEvents,
  OperationalEvents,
  AlarmEvents,
  EquipmentStateEvents,
  StructuralEventFields,
  OperationalEventFields,
  type IIoTEvents,
  type AlarmEventTypes,
  type EquipmentStateEventTypes,
} from './groups'

// =============================================================================
// Structural Entity Lifecycle Events
// =============================================================================

// Upper Hierarchy (Enterprise, Site, Area)
// Note: AreaType is NOT re-exported here - import from assets/area/schema instead
export {
  EnterpriseCreated,
  EnterpriseUpdated,
  EnterpriseDecommissioned,
  SiteCreated,
  SiteUpdated,
  SiteDecommissioned,
  AreaCreated,
  AreaUpdated,
  AreaDecommissioned,
  UpperHierarchyEvent,
  type EnterpriseCreatedType,
  type EnterpriseUpdatedType,
  type EnterpriseDecommissionedType,
  type SiteCreatedType,
  type SiteUpdatedType,
  type SiteDecommissionedType,
  type AreaCreatedType,
  type AreaUpdatedType,
  type AreaDecommissionedType,
  type UpperHierarchyEventType,
} from './structural'

// Middle Hierarchy (Plant, Line, WorkCell)
export {
  PlantCreated,
  PlantUpdated,
  PlantRelocated,
  PlantDecommissioned,
  LineCreated,
  LineUpdated,
  LineConfigChanged,
  LineRelocated,
  LineDecommissioned,
  WorkCellCreated,
  WorkCellUpdated,
  WorkCellDecommissioned,
  MiddleHierarchyEvent,
  type PlantCreatedType,
  type PlantUpdatedType,
  type PlantRelocatedType,
  type PlantDecommissionedType,
  type LineCreatedType,
  type LineUpdatedType,
  type LineConfigChangedType,
  type LineRelocatedType,
  type LineDecommissionedType,
  type WorkCellCreatedType,
  type WorkCellUpdatedType,
  type WorkCellDecommissionedType,
  type MiddleHierarchyEventType,
} from './structural'

// Lower Hierarchy (Machine, Sensor, Device)
// Note: SensorType, MeasurementUnit, DeviceType, ControlMode are NOT re-exported here
// Import them from assets/sensor/schema or assets/device/schema instead
// Only SensorThresholds is unique to events (used in threshold change events)
export {
  MachineCreated,
  MachineUpdated,
  MachineConfigChanged,
  MachineRelocated,
  MachineDecommissioned,
  SensorCreated,
  SensorUpdated,
  SensorCalibrated,
  SensorThresholdChanged,
  SensorDecommissioned,
  DeviceCreated,
  DeviceUpdated,
  DeviceDecommissioned,
  SensorThresholds,
  LowerHierarchyEvent,
  type MachineCreatedType,
  type MachineUpdatedType,
  type MachineConfigChangedType,
  type MachineRelocatedType,
  type MachineDecommissionedType,
  type SensorCreatedType,
  type SensorUpdatedType,
  type SensorCalibratedType,
  type SensorThresholdChangedType,
  type SensorDecommissionedType,
  type DeviceCreatedType,
  type DeviceUpdatedType,
  type DeviceDecommissionedType,
  type SensorThresholdsType,
  type LowerHierarchyEventType,
} from './structural'

// Combined Structural Events
export {
  AllStructuralEvents,
  type AllStructuralEvents as AllStructuralEventsType,
  STRUCTURAL_EVENT_TAGS,
  type StructuralEventTag,
} from './structural'

// =============================================================================
// Operational Events (Alarm Events - ISA-18.2)
// =============================================================================

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
} from './operational'

// =============================================================================
// Operational Events (Task Instance Events - EL-3.9-12)
// =============================================================================

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
} from './operational'

// =============================================================================
// Operational Events (Equipment State Events - EL-4.1-3)
// =============================================================================

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
} from './operational'

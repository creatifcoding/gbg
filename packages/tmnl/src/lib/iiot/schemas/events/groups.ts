/**
 * EventGroup Definitions for IIoT Event Sourcing
 *
 * Defines EventGroups for use with @effect/experimental EventLog.
 * Events are organized into two categories:
 * - StructuralEvents: Entity lifecycle (created, updated, decommissioned)
 * - OperationalEvents: Runtime business events (state changes, alarms)
 *
 * @module @gbg/tmnl/iiot/schemas/events/groups
 * @see @effect/experimental/EventGroup
 * @see thoughts/shared/specs/entity-system/03-event-hierarchy.md
 */

import { Schema } from 'effect'
import * as EventGroup from '@effect/experimental/EventGroup'
import { EventId, EquipmentLevel, AssetId, EnterpriseId, SiteId, AreaId, PlantId, LineId, WorkCellId, MachineId, SensorId, DeviceId, AlarmId, WorkOrderId, WorkflowDefinitionId, TaskInstanceId, WorkOrderContextId, ResourceId, ExternalRefId, SyncId, PropagationId } from '../identifiers'
import { AlarmSeverity, AlarmType } from '../alarms'
import { WorkOrderPriority, WorkOrderOutcome, SuspensionReason, WorkOrderFinalStatus, WorkOrderType } from '../work-orders'

// =============================================================================
// Import Equipment State Events (ISA-95/OEE Compliant)
// =============================================================================

import {
  EquipmentState,
  MaintenanceType,
  MaintenanceOutcome,
  FaultSeverity,
  FaultClearMethod,
} from './operational/equipment-state-events'

// =============================================================================
// Import Regulatory Events (FDA 21 CFR Part 11, ISO 9001)
// =============================================================================

import {
  // Batch Events (FDA 21 CFR Part 11)
  BatchStarted,
  ParameterRecorded,
  BatchCompleted,
  BatchDeviation,
  BatchId,
  ParameterId,
  DeviationId,
  ElectronicSignature,
  DeviationType,
  DeviationSeverity,
} from './regulatory/batch-events'

import {
  // Quality Events (ISO 9001)
  InspectionCompleted,
  NCROpened,
  NCRClosed,
  CAPACreated,
  CAPAResolved,
  InspectionId,
  NCRId,
  CAPAId,
  InspectionResult,
  NCRSeverity,
  CAPAType,
  EffectivenessRating,
} from './regulatory/quality-events'

import {
  // Operator Events (General Audit)
  OperatorLogin,
  OperatorLogout,
  ParameterOverride,
  ManualAcknowledgment,
  ShiftHandoff,
  SessionId,
  OverrideId,
  AcknowledgmentId,
  HandoffId,
  AuthMethod,
  LogoutReason,
  AcknowledgmentTargetType,
} from './regulatory/operator-events'

// =============================================================================
// Import L3 Sync Operation Events (ISA-95 Level 3)
// =============================================================================

import {
  L3SyncStarted,
  L3SyncProgress,
  L3SyncCompleted,
  L3SyncFailed,
  ExternalChangeDetected,
  SyncType,
  SyncProgressStatus,
  ExternalChangeType,
  ChangeId,
} from './operational/l3-sync-events'

// =============================================================================
// Import Approval Events (FDA 4-Eyes Principle Compliance)
// =============================================================================

import {
  ApprovalRequestId,
  ApproverId,
  ApprovalLevel,
  EscalationReason,
  ApprovalStatus,
} from './operational/approval-events'

// =============================================================================
// Import Task Events (ISA-95 Level 3 Task Execution)
// =============================================================================

import {
  TaskDefinitionId,
} from './operational/task-events'

import { BlockingReason, CompensationResult, TaskStatus } from '../task-instance'

// =============================================================================
// Import WorkOrderContext Events (ISA-95 Level 3 Context Management)
// =============================================================================

import {
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
  ResourceType,
  SnapshotReason,
} from './operational/context-events'

// =============================================================================
// Import Workflow Definition Events (ISA-95 Level 3)
// =============================================================================

import {
  DefinitionCreated,
  DefinitionVersioned,
  DefinitionActivated,
  DefinitionDeprecated,
  DefinitionArchived,
  TaskTemplate,
  VersionChange,
} from './operational/workflow-definition-events'

// =============================================================================
// Import Structural Events
// =============================================================================

import {
  // Upper Hierarchy
  EnterpriseCreated,
  EnterpriseUpdated,
  EnterpriseDecommissioned,
  SiteCreated,
  SiteUpdated,
  SiteDecommissioned,
  AreaCreated,
  AreaUpdated,
  AreaDecommissioned,
  AreaType,
  // Middle Hierarchy
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
  // Lower Hierarchy
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
  SensorType,
  MeasurementUnit,
  SensorThresholds,
  DeviceType,
  ControlMode,
} from './structural'

// =============================================================================
// Payload Schemas (derived from base event fields)
// =============================================================================

/**
 * Common fields for structural event payloads.
 * Mirrors BaseStructuralEvent fields for EventGroup compatibility.
 */
const StructuralEventFields = {
  /** Unique event identifier (ULID) */
  eventId: EventId,

  /** When the event occurred */
  occurredAt: Schema.DateTimeUtc,

  /** Principal/actor that caused this event */
  causedBy: Schema.String,

  /** Entity this event affects */
  entityId: AssetId,

  /** ISA-95 equipment level */
  entityType: EquipmentLevel,

  /** Full hierarchy path from root to entity */
  hierarchyPath: Schema.Array(AssetId),

  /** Correlation ID for transactions */
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Schema version for evolution */
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

/**
 * Common fields for operational event payloads.
 * Mirrors BaseOperationalEvent fields for EventGroup compatibility.
 */
const OperationalEventFields = {
  /** Unique event identifier (ULID) */
  eventId: EventId,

  /** When the event occurred */
  occurredAt: Schema.DateTimeUtc,

  /** Principal/actor that caused this event */
  causedBy: Schema.String,

  /** Entity this event affects */
  entityId: AssetId,

  /** ISA-95 equipment level */
  entityType: EquipmentLevel,

  /** Correlation ID for transactions */
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Schema version for evolution */
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

// =============================================================================
// Placeholder Payload Schemas (kept for backwards compatibility)
// =============================================================================

/**
 * Base structural event payload.
 * @deprecated Use concrete event payloads instead
 */
const BaseStructuralEventPayload = Schema.Struct(StructuralEventFields)

/**
 * Base operational event payload.
 * Used as placeholder until concrete operational events are wired (Task 1.5.3).
 */
const BaseOperationalEventPayload = Schema.Struct(OperationalEventFields)

// =============================================================================
// Entity-Specific Payload Schemas
// =============================================================================

// --- Enterprise Payloads ---

const EnterpriseCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  name: Schema.NonEmptyString,
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const EnterpriseUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const EnterpriseDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Site Payloads ---

const SiteCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  siteId: SiteId,
  enterpriseId: EnterpriseId,
  name: Schema.NonEmptyString,
  timezone: Schema.String,
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  latitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  longitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})

const SiteUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  siteId: SiteId,
  enterpriseId: EnterpriseId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  latitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  longitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SiteDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  siteId: SiteId,
  enterpriseId: EnterpriseId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Area Payloads ---

const AreaCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  areaId: AreaId,
  siteId: SiteId,
  name: Schema.NonEmptyString,
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AreaUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  areaId: AreaId,
  siteId: SiteId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AreaDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  areaId: AreaId,
  siteId: SiteId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Plant Payloads ---

const PlantCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  name: Schema.NonEmptyString,
  timezone: Schema.String,
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  initialConfig: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { as: 'Option' }),
})

const PlantUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),
  siteCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const PlantRelocatedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  previousSiteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  previousAreaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  newSiteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  newAreaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
})

const PlantDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  plantId: PlantId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Line Payloads ---

const LineCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  name: Schema.NonEmptyString,
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  operatingHoursPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 24)), { as: 'Option' }),
  shiftsPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.between(1, 4)), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  initialConfig: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { as: 'Option' }),
})

const LineUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  operatingHoursPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 24)), { as: 'Option' }),
  shiftsPerDay: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.between(1, 4)), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const LineConfigChangedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  configKey: Schema.NonEmptyString,
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  newValue: Schema.Unknown,
  reason: Schema.NonEmptyString,
  requiresRestart: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const LineRelocatedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  previousPlantId: PlantId,
  newPlantId: PlantId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
})

const LineDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  lineId: LineId,
  plantId: PlantId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- WorkCell Payloads ---

const WorkCellCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  workCellId: WorkCellId,
  lineId: LineId,
  name: Schema.NonEmptyString,
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),
  cycleTimeSeconds: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  position: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const WorkCellUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  workCellId: WorkCellId,
  lineId: LineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  cellType: Schema.optionalWith(Schema.String, { as: 'Option' }),
  cycleTimeSeconds: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  position: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const WorkCellDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  workCellId: WorkCellId,
  lineId: LineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Machine Payloads ---

const MachineCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  name: Schema.NonEmptyString,
  machineType: Schema.NonEmptyString,
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  installationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  initialConfig: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { as: 'Option' }),
})

const MachineUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  machineType: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  manufacturer: Schema.optionalWith(Schema.String, { as: 'Option' }),
  modelNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  serialNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const MachineConfigChangedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  configKey: Schema.NonEmptyString,
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  newValue: Schema.Unknown,
  reason: Schema.NonEmptyString,
  requiresRestart: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const MachineRelocatedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  previousLineId: LineId,
  previousWorkCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  newLineId: LineId,
  newWorkCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
})

const MachineDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  machineId: MachineId,
  lineId: LineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  totalOperationalHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Sensor Payloads ---

const SensorCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  name: Schema.NonEmptyString,
  sensorType: SensorType,
  unit: MeasurementUnit,
  sampleRateMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  thresholds: Schema.optionalWith(SensorThresholds, { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  sensorType: Schema.optionalWith(SensorType, { as: 'Option' }),
  unit: Schema.optionalWith(MeasurementUnit, { as: 'Option' }),
  sampleRateMs: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorCalibratedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  calibrationDate: Schema.DateTimeUtc,
  nextCalibrationDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  calibratedBy: Schema.NonEmptyString,
  certificateNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
  offsetAdjustment: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  gainAdjustment: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorThresholdChangedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  previousThresholds: SensorThresholds,
  newThresholds: SensorThresholds,
  reason: Schema.NonEmptyString,
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const SensorDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  sensorId: SensorId,
  machineId: MachineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  totalReadingsCount: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.nonNegative()), { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// --- Device Payloads ---

const DeviceCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  deviceId: DeviceId,
  machineId: MachineId,
  name: Schema.NonEmptyString,
  deviceType: DeviceType,
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  powerUnit: Schema.optionalWith(Schema.Literal('W', 'kW', 'HP'), { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const DeviceUpdatedPayload = Schema.Struct({
  ...StructuralEventFields,
  deviceId: DeviceId,
  machineId: MachineId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  deviceType: Schema.optionalWith(DeviceType, { as: 'Option' }),
  controlMode: Schema.optionalWith(ControlMode, { as: 'Option' }),
  ratedPower: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  powerUnit: Schema.optionalWith(Schema.Literal('W', 'kW', 'HP'), { as: 'Option' }),
  opcUaNodeId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const DeviceDecommissionedPayload = Schema.Struct({
  ...StructuralEventFields,
  deviceId: DeviceId,
  machineId: MachineId,
  reason: Schema.NonEmptyString,
  effectiveDate: Schema.DateTimeUtc,
  totalOperationHours: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// =============================================================================
// Alarm Event Payloads (ISA-18.2 Compliant)
// =============================================================================

const AlarmTriggeredPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  alarmType: AlarmType,
  triggerValue: Schema.Number,
  thresholdValue: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  unit: Schema.optionalWith(Schema.String, { as: 'Option' }),
  message: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
})

const AlarmAcknowledgedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  acknowledgedBy: Schema.NonEmptyString,
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmClearedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  clearValue: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  autoClear: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmEscalatedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  escalationLevel: Schema.Number.pipe(Schema.int(), Schema.positive()),
  escalatedTo: Schema.NonEmptyString,
  elapsedSeconds: Schema.Number.pipe(Schema.positive()),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmShelvedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  shelvedBy: Schema.NonEmptyString,
  shelvedUntil: Schema.DateTimeUtc,
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmUnshelvedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  autoUnshelve: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  unshelvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmSuppressedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  suppressedBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmOutOfServicePayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  disabledBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  expectedReturnDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
})

const AlarmReturnedToServicePayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  returnedBy: Schema.NonEmptyString,
  initialState: Schema.Literal('unacknowledged', 'cleared'),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const AlarmConfigChangedPayload = Schema.Struct({
  ...OperationalEventFields,
  alarmId: AlarmId,
  deviceId: DeviceId,
  changedBy: Schema.NonEmptyString,
  changes: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      previous: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
      new: Schema.Unknown,
    }),
  }),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// =============================================================================
// Equipment State Event Payloads (ISA-95/OEE Compliant)
// =============================================================================

/**
 * EquipmentStateChanged payload for state machine transitions.
 */
const EquipmentStateChangedPayload = Schema.Struct({
  ...OperationalEventFields,
  machineId: MachineId,
  previousState: EquipmentState,
  newState: EquipmentState,
  propagationId: Schema.optional(PropagationId),
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  triggeredBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * MaintenanceModeEntered payload for equipment entering maintenance.
 */
const MaintenanceModeEnteredPayload = Schema.Struct({
  ...OperationalEventFields,
  machineId: MachineId,
  maintenanceType: MaintenanceType,
  scheduledDuration: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  technician: Schema.optionalWith(Schema.String, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * MaintenanceModeExited payload for equipment exiting maintenance.
 */
const MaintenanceModeExitedPayload = Schema.Struct({
  ...OperationalEventFields,
  machineId: MachineId,
  actualDuration: Schema.Number.pipe(Schema.nonNegative()),
  outcome: MaintenanceOutcome,
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  technician: Schema.optionalWith(Schema.String, { as: 'Option' }),
  nextMaintenanceDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * PerformanceDegraded payload for equipment operating below optimal.
 */
const PerformanceDegradedPayload = Schema.Struct({
  ...OperationalEventFields,
  machineId: MachineId,
  performancePercent: Schema.Number.pipe(Schema.between(0, 100)),
  expectedPerformance: Schema.Number.pipe(Schema.between(0, 100)),
  degradationReason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  affectedMetrics: Schema.Array(Schema.String),
  oeeImpact: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { as: 'Option' }),
})

/**
 * FaultDetected payload for equipment faults.
 */
const FaultDetectedPayload = Schema.Struct({
  ...OperationalEventFields,
  machineId: MachineId,
  faultCode: Schema.NonEmptyString,
  faultSeverity: FaultSeverity,
  faultDescription: Schema.String,
  affectedComponent: Schema.optionalWith(Schema.String, { as: 'Option' }),
  sensorReadings: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Number }),
    { as: 'Option' }
  ),
  recommendedAction: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * FaultCleared payload for resolved equipment faults.
 */
const FaultClearedPayload = Schema.Struct({
  ...OperationalEventFields,
  machineId: MachineId,
  faultCode: Schema.NonEmptyString,
  clearMethod: FaultClearMethod,
  verifiedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
  resolutionNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  downtime: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
})

// =============================================================================
// Work Order Event Payloads (ISA-95 Level 3)
// =============================================================================

/**
 * WorkOrderCreated payload for new work order creation.
 */
const WorkOrderCreatedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  templateId: Schema.optionalWith(WorkflowDefinitionId, { as: 'Option' }),
  priority: WorkOrderPriority,
  scheduledStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
  title: Schema.NonEmptyString,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
})

/**
 * WorkOrderSubmitted payload for work order submitted for approval.
 */
const WorkOrderSubmittedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * WorkOrderApproved payload for approved work orders.
 */
const WorkOrderApprovedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  approvedBy: Schema.NonEmptyString,
  approvalLevel: Schema.Number.pipe(Schema.int(), Schema.positive()),
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * WorkOrderRejected payload for rejected work orders.
 */
const WorkOrderRejectedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  rejectedBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
})

/**
 * WorkOrderStarted payload for work order execution start.
 */
const WorkOrderStartedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  startedBy: Schema.NonEmptyString,
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * WorkOrderSuspended payload for temporarily paused work orders.
 */
const WorkOrderSuspendedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  suspendedBy: Schema.NonEmptyString,
  reason: SuspensionReason,
  expectedResume: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  propagationId: Schema.optional(PropagationId),
  causedByPropagationId: Schema.optional(PropagationId),
})

/**
 * WorkOrderResumed payload for resumed work orders.
 */
const WorkOrderResumedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  resumedBy: Schema.NonEmptyString,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  causedByPropagationId: Schema.optional(PropagationId),
})

/**
 * WorkOrderCompleted payload for successfully completed work orders.
 */
const WorkOrderCompletedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  completedBy: Schema.NonEmptyString,
  outcome: WorkOrderOutcome,
  summary: Schema.NonEmptyString,
  actualDurationMinutes: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { as: 'Option' }
  ),
})

/**
 * WorkOrderFailed payload for failed work orders.
 */
const WorkOrderFailedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  failedTaskId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),
  failureReason: Schema.NonEmptyString,
  reportedBy: Schema.NonEmptyString,
})

/**
 * WorkOrderCancelled payload for cancelled work orders.
 */
const WorkOrderCancelledPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  cancelledBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  compensationRequired: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
})

/**
 * WorkOrderClosed payload for archived work orders.
 */
const WorkOrderClosedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  closedBy: Schema.NonEmptyString,
  finalStatus: WorkOrderFinalStatus,
  archiveReference: Schema.optionalWith(Schema.String, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// =============================================================================
// WorkOrderContext Event Payloads (ISA-95 Level 3 Context Management)
// =============================================================================

/**
 * ContextCreated payload for initial context creation.
 */
const ContextCreatedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  initialAssets: Schema.Array(AssetId),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
})

/**
 * ContextUpdated payload for context field updates.
 */
const ContextUpdatedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  fieldName: Schema.NonEmptyString,
  previousValue: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  newValue: Schema.Unknown,
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ContextSnapshotted payload for immutable snapshots.
 */
const ContextSnapshottedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  snapshotId: Schema.NonEmptyString,
  snapshotData: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  snapshotReason: SnapshotReason,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * AssetAttached payload for asset linking.
 */
const AssetAttachedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  attachedAssetId: AssetId,
  assetRole: Schema.Literal('primary_target', 'secondary_target', 'support', 'reference'),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * AssetDetached payload for asset unlinking.
 */
const AssetDetachedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  detachedAssetId: AssetId,
  reason: Schema.Literal('scope_change', 'error_correction', 'work_complete', 'asset_unavailable', 'other'),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ResourceAllocated payload for resource assignment.
 */
const ResourceAllocatedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  resourceId: ResourceId,
  resourceType: ResourceType,
  resourceName: Schema.NonEmptyString,
  quantity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  unit: Schema.optionalWith(Schema.String, { as: 'Option' }),
  allocatedBy: Schema.NonEmptyString,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ResourceReleased payload for resource freeing.
 */
const ResourceReleasedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  resourceId: ResourceId,
  releaseReason: Schema.Literal('work_complete', 'not_needed', 'replaced', 'returned_defective', 'other'),
  releasedBy: Schema.NonEmptyString,
  quantityReturned: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
  conditionNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ExternalRefLinked payload for external system reference.
 */
const ExternalRefLinkedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  externalRefId: ExternalRefId,
  externalSystem: Schema.NonEmptyString,
  externalType: Schema.NonEmptyString,
  externalIdentifier: Schema.NonEmptyString,
  linkUrl: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
})

/**
 * ExternalRefUnlinked payload for removing external reference.
 */
const ExternalRefUnlinkedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  externalRefId: ExternalRefId,
  reason: Schema.Literal('duplicate_link', 'error_correction', 'external_deleted', 'sync_failure', 'other'),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ChildWorkOrderSpawned payload for child work order creation.
 */
const ChildWorkOrderSpawnedPayload = Schema.Struct({
  ...OperationalEventFields,
  workOrderId: WorkOrderId,
  contextId: WorkOrderContextId,
  childWorkOrderId: WorkOrderId,
  childType: WorkOrderType,
  reason: Schema.NonEmptyString,
  inheritAssets: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  inheritResources: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

// =============================================================================
// Task Instance Event Payloads (ISA-95 Level 3 Task Execution)
// =============================================================================

/**
 * TaskBecameReady payload for task ready state.
 */
const TaskBecameReadyPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  taskDefinitionId: TaskDefinitionId,
  satisfiedDependencies: Schema.Array(TaskInstanceId),
  previousStatus: TaskStatus,
})

/**
 * TaskStarted payload for task execution start.
 */
const TaskStartedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  taskDefinitionId: TaskDefinitionId,
  startedBy: Schema.NonEmptyString,
  targetAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),
  estimatedDurationMinutes: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
})

/**
 * TaskProgressUpdated payload for progress updates.
 */
const TaskProgressUpdatedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  previousProgress: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  newProgress: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  updatedBy: Schema.NonEmptyString,
})

/**
 * TaskBlocked payload for blocked tasks.
 */
const TaskBlockedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  blockingReason: BlockingReason,
  blockedBy: Schema.NonEmptyString,
  details: Schema.optionalWith(Schema.String, { as: 'Option' }),
  blockedDependencyIds: Schema.optionalWith(Schema.Array(TaskInstanceId), { as: 'Option' }),
})

/**
 * TaskUnblocked payload for unblocked tasks.
 */
const TaskUnblockedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  previousBlockingReason: BlockingReason,
  unblockedBy: Schema.NonEmptyString,
  resolutionNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * TaskCompleted payload for successful completion.
 */
const TaskCompletedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  taskDefinitionId: TaskDefinitionId,
  completedBy: Schema.NonEmptyString,
  durationMinutes: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  output: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * TaskFailed payload for failed tasks.
 */
const TaskFailedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  taskDefinitionId: TaskDefinitionId,
  failedBy: Schema.NonEmptyString,
  error: Schema.NonEmptyString,
  errorCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  retryable: Schema.Boolean,
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

/**
 * TaskSkipped payload for skipped tasks.
 */
const TaskSkippedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  taskDefinitionId: TaskDefinitionId,
  skippedBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * TaskCompensated payload for compensating actions (saga pattern).
 */
const TaskCompensatedPayload = Schema.Struct({
  ...OperationalEventFields,
  taskInstanceId: TaskInstanceId,
  workOrderId: WorkOrderId,
  taskDefinitionId: TaskDefinitionId,
  compensatedBy: Schema.NonEmptyString,
  compensationResult: CompensationResult,
  originalError: Schema.optionalWith(Schema.String, { as: 'Option' }),
  compensationAction: Schema.NonEmptyString,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// =============================================================================
// Approval Event Payloads (FDA 4-Eyes Principle Compliance)
// =============================================================================

/**
 * ApprovalRequested payload for approval request creation.
 */
const ApprovalRequestedPayload = Schema.Struct({
  ...OperationalEventFields,
  approvalRequestId: ApprovalRequestId,
  requestedBy: ApproverId,
  requiredLevel: ApprovalLevel,
  requestType: Schema.NonEmptyString,
  subjectId: Schema.NonEmptyString,
  subjectType: Schema.NonEmptyString,
  expiresAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  justification: Schema.optionalWith(Schema.String, { as: 'Option' }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
})

/**
 * ApprovalGranted payload for approved requests.
 */
const ApprovalGrantedPayload = Schema.Struct({
  ...OperationalEventFields,
  approvalRequestId: ApprovalRequestId,
  approvedBy: ApproverId,
  approvalLevel: ApprovalLevel,
  conditions: Schema.optionalWith(Schema.String, { as: 'Option' }),
  validUntil: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ApprovalRejected payload for rejected requests.
 */
const ApprovalRejectedPayload = Schema.Struct({
  ...OperationalEventFields,
  approvalRequestId: ApprovalRequestId,
  rejectedBy: ApproverId,
  approvalLevel: ApprovalLevel,
  reason: Schema.NonEmptyString,
  canResubmit: Schema.Boolean,
  suggestedChanges: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ApprovalEscalated payload for escalated requests.
 */
const ApprovalEscalatedPayload = Schema.Struct({
  ...OperationalEventFields,
  approvalRequestId: ApprovalRequestId,
  fromLevel: ApprovalLevel,
  toLevel: ApprovalLevel,
  escalatedTo: ApproverId,
  escalationReason: EscalationReason,
  elapsedSeconds: Schema.Number.pipe(Schema.nonNegative()),
  previousApprovers: Schema.Array(Schema.String),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ApprovalCompleted payload for completed approval process.
 */
const ApprovalCompletedPayload = Schema.Struct({
  ...OperationalEventFields,
  approvalRequestId: ApprovalRequestId,
  finalStatus: Schema.Literal('approved', 'rejected', 'expired'),
  totalLevelsRequired: ApprovalLevel,
  totalLevelsCompleted: ApprovalLevel,
  approvers: Schema.Array(Schema.String),
  totalDurationSeconds: Schema.Number.pipe(Schema.nonNegative()),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * ApprovalExpired payload for expired requests.
 */
const ApprovalExpiredPayload = Schema.Struct({
  ...OperationalEventFields,
  approvalRequestId: ApprovalRequestId,
  expiredAt: Schema.DateTimeUtc,
  lastActiveLevel: ApprovalLevel,
  pendingApprovers: Schema.Array(Schema.String),
  autoRenew: Schema.Boolean,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// =============================================================================
// EventGroup Definitions
// =============================================================================

/**
 * Structural Events — Entity Lifecycle & Configuration
 *
 * These events capture the "shape" of the system:
 * - Entity creation (EnterpriseCreated, PlantCreated, MachineCreated, etc.)
 * - Entity updates (configuration changes)
 * - Entity decommissioning
 *
 * Stored in EventLog, replayed from origin to reconstruct state.
 */
export const StructuralEvents = EventGroup.empty
  // --- Enterprise ---
  .add({
    tag: 'EnterpriseCreated',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseCreatedPayload,
  })
  .add({
    tag: 'EnterpriseUpdated',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseUpdatedPayload,
  })
  .add({
    tag: 'EnterpriseDecommissioned',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseDecommissionedPayload,
  })
  // --- Site ---
  .add({
    tag: 'SiteCreated',
    primaryKey: (payload) => payload.siteId,
    payload: SiteCreatedPayload,
  })
  .add({
    tag: 'SiteUpdated',
    primaryKey: (payload) => payload.siteId,
    payload: SiteUpdatedPayload,
  })
  .add({
    tag: 'SiteDecommissioned',
    primaryKey: (payload) => payload.siteId,
    payload: SiteDecommissionedPayload,
  })
  // --- Area ---
  .add({
    tag: 'AreaCreated',
    primaryKey: (payload) => payload.areaId,
    payload: AreaCreatedPayload,
  })
  .add({
    tag: 'AreaUpdated',
    primaryKey: (payload) => payload.areaId,
    payload: AreaUpdatedPayload,
  })
  .add({
    tag: 'AreaDecommissioned',
    primaryKey: (payload) => payload.areaId,
    payload: AreaDecommissionedPayload,
  })
  // --- Plant ---
  .add({
    tag: 'PlantCreated',
    primaryKey: (payload) => payload.plantId,
    payload: PlantCreatedPayload,
  })
  .add({
    tag: 'PlantUpdated',
    primaryKey: (payload) => payload.plantId,
    payload: PlantUpdatedPayload,
  })
  .add({
    tag: 'PlantRelocated',
    primaryKey: (payload) => payload.plantId,
    payload: PlantRelocatedPayload,
  })
  .add({
    tag: 'PlantDecommissioned',
    primaryKey: (payload) => payload.plantId,
    payload: PlantDecommissionedPayload,
  })
  // --- Line ---
  .add({
    tag: 'LineCreated',
    primaryKey: (payload) => payload.lineId,
    payload: LineCreatedPayload,
  })
  .add({
    tag: 'LineUpdated',
    primaryKey: (payload) => payload.lineId,
    payload: LineUpdatedPayload,
  })
  .add({
    tag: 'LineConfigChanged',
    primaryKey: (payload) => payload.lineId,
    payload: LineConfigChangedPayload,
  })
  .add({
    tag: 'LineRelocated',
    primaryKey: (payload) => payload.lineId,
    payload: LineRelocatedPayload,
  })
  .add({
    tag: 'LineDecommissioned',
    primaryKey: (payload) => payload.lineId,
    payload: LineDecommissionedPayload,
  })
  // --- WorkCell ---
  .add({
    tag: 'WorkCellCreated',
    primaryKey: (payload) => payload.workCellId,
    payload: WorkCellCreatedPayload,
  })
  .add({
    tag: 'WorkCellUpdated',
    primaryKey: (payload) => payload.workCellId,
    payload: WorkCellUpdatedPayload,
  })
  .add({
    tag: 'WorkCellDecommissioned',
    primaryKey: (payload) => payload.workCellId,
    payload: WorkCellDecommissionedPayload,
  })
  // --- Machine ---
  .add({
    tag: 'MachineCreated',
    primaryKey: (payload) => payload.machineId,
    payload: MachineCreatedPayload,
  })
  .add({
    tag: 'MachineUpdated',
    primaryKey: (payload) => payload.machineId,
    payload: MachineUpdatedPayload,
  })
  .add({
    tag: 'MachineConfigChanged',
    primaryKey: (payload) => payload.machineId,
    payload: MachineConfigChangedPayload,
  })
  .add({
    tag: 'MachineRelocated',
    primaryKey: (payload) => payload.machineId,
    payload: MachineRelocatedPayload,
  })
  .add({
    tag: 'MachineDecommissioned',
    primaryKey: (payload) => payload.machineId,
    payload: MachineDecommissionedPayload,
  })
  // --- Sensor ---
  .add({
    tag: 'SensorCreated',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorCreatedPayload,
  })
  .add({
    tag: 'SensorUpdated',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorUpdatedPayload,
  })
  .add({
    tag: 'SensorCalibrated',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorCalibratedPayload,
  })
  .add({
    tag: 'SensorThresholdChanged',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorThresholdChangedPayload,
  })
  .add({
    tag: 'SensorDecommissioned',
    primaryKey: (payload) => payload.sensorId,
    payload: SensorDecommissionedPayload,
  })
  // --- Device ---
  .add({
    tag: 'DeviceCreated',
    primaryKey: (payload) => payload.deviceId,
    payload: DeviceCreatedPayload,
  })
  .add({
    tag: 'DeviceUpdated',
    primaryKey: (payload) => payload.deviceId,
    payload: DeviceUpdatedPayload,
  })
  .add({
    tag: 'DeviceDecommissioned',
    primaryKey: (payload) => payload.deviceId,
    payload: DeviceDecommissionedPayload,
  })

/**
 * Operational Events — Runtime Business Events
 *
 * These events capture the "behavior" of the system:
 * - State transitions (StateStarted, StateEnded)
 * - Alarms (triggered, acknowledged, cleared)
 * - Maintenance actions
 *
 * Stored in EventLog, supports time-travel queries.
 *
 * NOTE: Currently contains placeholder events. Concrete events (StateStarted,
 * StateEnded, etc.) will be wired in Task 1.5.3.
 */
export const OperationalEvents = EventGroup.empty
  .add({
    tag: 'BaseOperationalEvent',
    primaryKey: (payload) => payload.entityId,
    payload: BaseOperationalEventPayload,
  })

/**
 * Alarm Events — ISA-18.2 Compliant Alarm State Transitions
 *
 * These events capture the full alarm lifecycle per ISA-18.2:
 * - Triggering: AlarmTriggered
 * - Acknowledgment: AlarmAcknowledged
 * - Resolution: AlarmCleared
 * - Escalation: AlarmEscalated
 * - Suppression: AlarmShelved, AlarmUnshelved, AlarmSuppressed
 * - Maintenance: AlarmOutOfService, AlarmReturnedToService
 * - Configuration: AlarmConfigChanged
 *
 * Stored in EventLog for full audit trail and temporal queries.
 *
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */
export const AlarmEvents = EventGroup.empty
  .add({
    tag: 'AlarmTriggered',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmTriggeredPayload,
  })
  .add({
    tag: 'AlarmAcknowledged',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmAcknowledgedPayload,
  })
  .add({
    tag: 'AlarmCleared',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmClearedPayload,
  })
  .add({
    tag: 'AlarmEscalated',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmEscalatedPayload,
  })
  .add({
    tag: 'AlarmShelved',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmShelvedPayload,
  })
  .add({
    tag: 'AlarmUnshelved',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmUnshelvedPayload,
  })
  .add({
    tag: 'AlarmSuppressed',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmSuppressedPayload,
  })
  .add({
    tag: 'AlarmOutOfService',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmOutOfServicePayload,
  })
  .add({
    tag: 'AlarmReturnedToService',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmReturnedToServicePayload,
  })
  .add({
    tag: 'AlarmConfigChanged',
    primaryKey: (payload) => payload.alarmId,
    payload: AlarmConfigChangedPayload,
  })

/**
 * Equipment State Events — ISA-95/OEE Compliant State Transitions
 *
 * These events capture the equipment state lifecycle:
 * - EquipmentStateChanged: State machine transition (operational/degraded/faulted/maintenance/offline)
 * - MaintenanceModeEntered: Equipment enters maintenance state
 * - MaintenanceModeExited: Equipment exits maintenance state
 * - PerformanceDegraded: Equipment operating below optimal
 * - FaultDetected: Equipment fault occurred
 * - FaultCleared: Fault condition resolved
 *
 * These events support OEE (Overall Equipment Effectiveness) calculations:
 * - Availability = Uptime / Planned Production Time
 * - Performance = Actual Output / Theoretical Output
 *
 * Stored in EventLog for full audit trail and temporal queries.
 *
 * @see ISA-95/IEC 62264 for equipment state standards
 * @see OEE standard for effectiveness calculations
 */
export const EquipmentStateEvents = EventGroup.empty
  .add({
    tag: 'EquipmentStateChanged',
    primaryKey: (payload) => payload.machineId,
    payload: EquipmentStateChangedPayload,
  })
  .add({
    tag: 'MaintenanceModeEntered',
    primaryKey: (payload) => payload.machineId,
    payload: MaintenanceModeEnteredPayload,
  })
  .add({
    tag: 'MaintenanceModeExited',
    primaryKey: (payload) => payload.machineId,
    payload: MaintenanceModeExitedPayload,
  })
  .add({
    tag: 'PerformanceDegraded',
    primaryKey: (payload) => payload.machineId,
    payload: PerformanceDegradedPayload,
  })
  .add({
    tag: 'FaultDetected',
    primaryKey: (payload) => payload.machineId,
    payload: FaultDetectedPayload,
  })
  .add({
    tag: 'FaultCleared',
    primaryKey: (payload) => payload.machineId,
    payload: FaultClearedPayload,
  })

/**
 * Work Order Events — ISA-95 Level 3 Work Order Lifecycle
 *
 * These events capture the full work order lifecycle per ISA-95:
 * - Creation: WorkOrderCreated
 * - Approval: WorkOrderSubmitted, WorkOrderApproved, WorkOrderRejected
 * - Execution: WorkOrderStarted, WorkOrderSuspended, WorkOrderResumed
 * - Completion: WorkOrderCompleted, WorkOrderFailed, WorkOrderCancelled
 * - Archival: WorkOrderClosed
 *
 * Stored in EventLog for full audit trail and FDA 21 CFR Part 11 compliance.
 *
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */
export const WorkOrderEvents = EventGroup.empty
  .add({
    tag: 'WorkOrderCreated',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderCreatedPayload,
  })
  .add({
    tag: 'WorkOrderSubmitted',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderSubmittedPayload,
  })
  .add({
    tag: 'WorkOrderApproved',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderApprovedPayload,
  })
  .add({
    tag: 'WorkOrderRejected',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderRejectedPayload,
  })
  .add({
    tag: 'WorkOrderStarted',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderStartedPayload,
  })
  .add({
    tag: 'WorkOrderSuspended',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderSuspendedPayload,
  })
  .add({
    tag: 'WorkOrderResumed',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderResumedPayload,
  })
  .add({
    tag: 'WorkOrderCompleted',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderCompletedPayload,
  })
  .add({
    tag: 'WorkOrderFailed',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderFailedPayload,
  })
  .add({
    tag: 'WorkOrderCancelled',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderCancelledPayload,
  })
  .add({
    tag: 'WorkOrderClosed',
    primaryKey: (payload) => payload.workOrderId,
    payload: WorkOrderClosedPayload,
  })

// =============================================================================
// Batch Event Payloads (FDA 21 CFR Part 11)
// =============================================================================

const BatchStartedPayload = Schema.Struct({
  ...OperationalEventFields,
  batchId: BatchId,
  productCode: Schema.NonEmptyString,
  lotNumber: Schema.NonEmptyString,
  startedBy: Schema.NonEmptyString,
  plannedQuantity: Schema.Number.pipe(Schema.positive()),
  equipmentIds: Schema.Array(AssetId),
  electronicSignature: ElectronicSignature,
  auditTrailId: Schema.NonEmptyString,
})

const ParameterRecordedPayload = Schema.Struct({
  ...OperationalEventFields,
  batchId: BatchId,
  parameterId: ParameterId,
  parameterName: Schema.NonEmptyString,
  value: Schema.Number,
  unit: Schema.NonEmptyString,
  recordedBy: Schema.NonEmptyString,
  recordedAt: Schema.DateTimeUtc,
  withinSpec: Schema.Boolean,
  electronicSignature: ElectronicSignature,
  auditTrailId: Schema.NonEmptyString,
})

const BatchCompletedPayload = Schema.Struct({
  ...OperationalEventFields,
  batchId: BatchId,
  completedBy: Schema.NonEmptyString,
  actualQuantity: Schema.Number.pipe(Schema.positive()),
  yieldPercentage: Schema.Number,
  completedAt: Schema.DateTimeUtc,
  electronicSignature: ElectronicSignature,
  auditTrailId: Schema.NonEmptyString,
})

const BatchDeviationPayload = Schema.Struct({
  ...OperationalEventFields,
  batchId: BatchId,
  deviationId: DeviationId,
  deviationType: DeviationType,
  description: Schema.NonEmptyString,
  severity: DeviationSeverity,
  detectedBy: Schema.NonEmptyString,
  correctiveAction: Schema.optionalWith(Schema.String, { as: 'Option' }),
  electronicSignature: ElectronicSignature,
  auditTrailId: Schema.NonEmptyString,
})

// =============================================================================
// Quality Event Payloads (ISO 9001)
// =============================================================================

const InspectionCompletedPayload = Schema.Struct({
  ...OperationalEventFields,
  inspectionId: InspectionId,
  inspectorId: Schema.NonEmptyString,
  itemId: Schema.NonEmptyString,
  result: InspectionResult,
  criteria: Schema.Array(Schema.String),
  measurements: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
})

const NCROpenedPayload = Schema.Struct({
  ...OperationalEventFields,
  ncrId: NCRId,
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  severity: NCRSeverity,
  affectedItems: Schema.Array(Schema.String),
  detectedBy: Schema.NonEmptyString,
  detectedAt: Schema.DateTimeUtc,
})

const NCRClosedPayload = Schema.Struct({
  ...OperationalEventFields,
  ncrId: NCRId,
  closedBy: Schema.NonEmptyString,
  resolution: Schema.NonEmptyString,
  rootCause: Schema.NonEmptyString,
  closedAt: Schema.DateTimeUtc,
  linkedCAPAId: Schema.optionalWith(CAPAId, { as: 'Option' }),
})

const CAPACreatedPayload = Schema.Struct({
  ...OperationalEventFields,
  capaId: CAPAId,
  type: CAPAType,
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  linkedNCRIds: Schema.Array(NCRId),
  assignedTo: Schema.NonEmptyString,
  dueDate: Schema.DateTimeUtc,
})

const CAPAResolvedPayload = Schema.Struct({
  ...OperationalEventFields,
  capaId: CAPAId,
  resolvedBy: Schema.NonEmptyString,
  resolution: Schema.NonEmptyString,
  verificationMethod: Schema.NonEmptyString,
  effectivenessRating: EffectivenessRating,
  resolvedAt: Schema.DateTimeUtc,
})

// =============================================================================
// Operator Event Payloads (General Audit)
// =============================================================================

const OperatorLoginPayload = Schema.Struct({
  ...OperationalEventFields,
  sessionId: SessionId,
  operatorId: Schema.NonEmptyString,
  workstation: Schema.NonEmptyString,
  loginAt: Schema.DateTimeUtc,
  authMethod: AuthMethod,
})

const OperatorLogoutPayload = Schema.Struct({
  ...OperationalEventFields,
  sessionId: SessionId,
  operatorId: Schema.NonEmptyString,
  logoutAt: Schema.DateTimeUtc,
  reason: LogoutReason,
})

const ParameterOverridePayload = Schema.Struct({
  ...OperationalEventFields,
  overrideId: OverrideId,
  operatorId: Schema.NonEmptyString,
  parameterId: Schema.NonEmptyString,
  previousValue: Schema.String,
  newValue: Schema.String,
  reason: Schema.NonEmptyString,
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const ManualAcknowledgmentPayload = Schema.Struct({
  ...OperationalEventFields,
  acknowledgmentId: AcknowledgmentId,
  operatorId: Schema.NonEmptyString,
  targetType: AcknowledgmentTargetType,
  targetId: Schema.NonEmptyString,
  comment: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

const ShiftHandoffPayload = Schema.Struct({
  ...OperationalEventFields,
  handoffId: HandoffId,
  outgoingOperatorId: Schema.NonEmptyString,
  incomingOperatorId: Schema.NonEmptyString,
  handoffAt: Schema.DateTimeUtc,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
  openItems: Schema.Array(Schema.String),
})

// =============================================================================
// L3 Sync Operation Event Payloads (ISA-95 Level 3)
// =============================================================================

/**
 * L3SyncStarted payload for sync operation initiation.
 */
const L3SyncStartedPayload = Schema.Struct({
  ...OperationalEventFields,
  syncId: SyncId,
  targetSystem: Schema.NonEmptyString,
  syncType: SyncType,
  initiatedBy: Schema.NonEmptyString,
})

/**
 * L3SyncProgress payload for sync progress updates.
 */
const L3SyncProgressPayload = Schema.Struct({
  ...OperationalEventFields,
  syncId: SyncId,
  recordsProcessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  totalRecords: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  status: SyncProgressStatus,
})

/**
 * L3SyncCompleted payload for successful sync completion.
 */
const L3SyncCompletedPayload = Schema.Struct({
  ...OperationalEventFields,
  syncId: SyncId,
  recordsCreated: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  recordsUpdated: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  recordsDeleted: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  duration: Schema.Number.pipe(Schema.nonNegative()),
})

/**
 * L3SyncFailed payload for sync failure.
 */
const L3SyncFailedPayload = Schema.Struct({
  ...OperationalEventFields,
  syncId: SyncId,
  errorCode: Schema.NonEmptyString,
  errorMessage: Schema.NonEmptyString,
  failedAt: Schema.DateTimeUtc,
  retryable: Schema.Boolean,
})

/**
 * ExternalChangeDetected payload for external system changes.
 */
const ExternalChangeDetectedPayload = Schema.Struct({
  ...OperationalEventFields,
  changeId: ChangeId,
  sourceSystem: Schema.NonEmptyString,
  changeType: ExternalChangeType,
  affectedEntities: Schema.Array(Schema.String),
})

// =============================================================================
// Workflow Definition Event Payloads (ISA-95 Level 3)
// =============================================================================

/**
 * DefinitionCreated payload for new workflow definition.
 */
const DefinitionCreatedPayload = Schema.Struct({
  ...OperationalEventFields,
  definitionId: WorkflowDefinitionId,
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  createdBy: Schema.NonEmptyString,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  taskTemplates: Schema.Array(TaskTemplate),
})

/**
 * DefinitionVersioned payload for workflow definition versioning.
 */
const DefinitionVersionedPayload = Schema.Struct({
  ...OperationalEventFields,
  definitionId: WorkflowDefinitionId,
  previousVersion: Schema.NonEmptyString,
  newVersion: Schema.NonEmptyString,
  changes: Schema.Array(VersionChange),
  versionedBy: Schema.NonEmptyString,
  changeNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * DefinitionActivated payload for workflow activation.
 */
const DefinitionActivatedPayload = Schema.Struct({
  ...OperationalEventFields,
  definitionId: WorkflowDefinitionId,
  version: Schema.NonEmptyString,
  activatedBy: Schema.NonEmptyString,
  effectiveFrom: Schema.DateTimeUtc,
  previousActiveVersion: Schema.optionalWith(Schema.String, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

/**
 * DefinitionDeprecated payload for workflow deprecation.
 */
const DefinitionDeprecatedPayload = Schema.Struct({
  ...OperationalEventFields,
  definitionId: WorkflowDefinitionId,
  version: Schema.NonEmptyString,
  deprecatedBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  replacementId: Schema.optionalWith(WorkflowDefinitionId, { as: 'Option' }),
  deprecationDate: Schema.DateTimeUtc,
  sunsetDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
})

/**
 * DefinitionArchived payload for workflow archival.
 */
const DefinitionArchivedPayload = Schema.Struct({
  ...OperationalEventFields,
  definitionId: WorkflowDefinitionId,
  version: Schema.NonEmptyString,
  archivedBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
  archiveReference: Schema.optionalWith(Schema.String, { as: 'Option' }),
  retentionPeriodDays: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' }
  ),
})

// =============================================================================
// Regulatory EventGroups
// =============================================================================

/**
 * Batch Events — FDA 21 CFR Part 11 Compliant Batch Records
 *
 * These events capture batch production lifecycle:
 * - BatchStarted: Batch production initiated
 * - ParameterRecorded: Critical process parameter recorded
 * - BatchCompleted: Batch production completed
 * - BatchDeviation: Deviation from batch record detected
 *
 * All events include electronic signatures for FDA compliance.
 *
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ISA-88 for batch control standards
 */
export const BatchEvents = EventGroup.empty
  .add({
    tag: 'BatchStarted',
    primaryKey: (payload) => payload.batchId,
    payload: BatchStartedPayload,
  })
  .add({
    tag: 'ParameterRecorded',
    primaryKey: (payload) => payload.batchId,
    payload: ParameterRecordedPayload,
  })
  .add({
    tag: 'BatchCompleted',
    primaryKey: (payload) => payload.batchId,
    payload: BatchCompletedPayload,
  })
  .add({
    tag: 'BatchDeviation',
    primaryKey: (payload) => payload.batchId,
    payload: BatchDeviationPayload,
  })

/**
 * Quality Events — ISO 9001 Quality Management
 *
 * These events support the ISO 9001 quality loop:
 * - InspectionCompleted: Quality inspection completed
 * - NCROpened: Non-Conformance Report opened
 * - NCRClosed: NCR resolved and closed
 * - CAPACreated: Corrective/Preventive Action created
 * - CAPAResolved: CAPA completed and verified
 *
 * Enables full quality management traceability.
 *
 * @see ISO 9001:2015 for quality management systems
 */
export const QualityEvents = EventGroup.empty
  .add({
    tag: 'InspectionCompleted',
    primaryKey: (payload) => payload.inspectionId,
    payload: InspectionCompletedPayload,
  })
  .add({
    tag: 'NCROpened',
    primaryKey: (payload) => payload.ncrId,
    payload: NCROpenedPayload,
  })
  .add({
    tag: 'NCRClosed',
    primaryKey: (payload) => payload.ncrId,
    payload: NCRClosedPayload,
  })
  .add({
    tag: 'CAPACreated',
    primaryKey: (payload) => payload.capaId,
    payload: CAPACreatedPayload,
  })
  .add({
    tag: 'CAPAResolved',
    primaryKey: (payload) => payload.capaId,
    payload: CAPAResolvedPayload,
  })

/**
 * Operator Events — Regulatory Compliance Audit Trail
 *
 * These events capture operator interactions for audit compliance:
 * - OperatorLogin: Operator logged into system
 * - OperatorLogout: Operator logged out
 * - ParameterOverride: Operator manually overrode a parameter
 * - ManualAcknowledgment: Operator acknowledged a condition/alarm
 * - ShiftHandoff: Shift handoff between operators
 *
 * Critical for FDA 21 CFR Part 11 electronic signature compliance.
 *
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ISA-95/IEC 62264 for operations management
 */
export const OperatorEvents = EventGroup.empty
  .add({
    tag: 'OperatorLogin',
    primaryKey: (payload) => payload.sessionId,
    payload: OperatorLoginPayload,
  })
  .add({
    tag: 'OperatorLogout',
    primaryKey: (payload) => payload.sessionId,
    payload: OperatorLogoutPayload,
  })
  .add({
    tag: 'ParameterOverride',
    primaryKey: (payload) => payload.overrideId,
    payload: ParameterOverridePayload,
  })
  .add({
    tag: 'ManualAcknowledgment',
    primaryKey: (payload) => payload.acknowledgmentId,
    payload: ManualAcknowledgmentPayload,
  })
  .add({
    tag: 'ShiftHandoff',
    primaryKey: (payload) => payload.handoffId,
    payload: ShiftHandoffPayload,
  })

// =============================================================================
// Context Events (ISA-95 Level 3 Context Management)
// =============================================================================

/**
 * Context Events — Work Order Context Management
 *
 * These events track the operational context of work orders:
 * - ContextCreated: Initial context for work order
 * - ContextUpdated: Context field updated
 * - ContextSnapshotted: Immutable point-in-time snapshot
 * - AssetAttached/AssetDetached: Asset linking/unlinking
 * - ResourceAllocated/ResourceReleased: Resource management
 * - ExternalRefLinked/ExternalRefUnlinked: External system references
 * - ChildWorkOrderSpawned: Child work order creation
 *
 * Stored in EventLog for full audit trail.
 *
 * @see ISA-95/IEC 62264 for operations management
 */
export const ContextEvents = EventGroup.empty
  .add({
    tag: 'ContextCreated',
    primaryKey: (payload) => payload.contextId,
    payload: ContextCreatedPayload,
  })
  .add({
    tag: 'ContextUpdated',
    primaryKey: (payload) => payload.contextId,
    payload: ContextUpdatedPayload,
  })
  .add({
    tag: 'ContextSnapshotted',
    primaryKey: (payload) => payload.contextId,
    payload: ContextSnapshottedPayload,
  })
  .add({
    tag: 'AssetAttached',
    primaryKey: (payload) => payload.contextId,
    payload: AssetAttachedPayload,
  })
  .add({
    tag: 'AssetDetached',
    primaryKey: (payload) => payload.contextId,
    payload: AssetDetachedPayload,
  })
  .add({
    tag: 'ResourceAllocated',
    primaryKey: (payload) => payload.contextId,
    payload: ResourceAllocatedPayload,
  })
  .add({
    tag: 'ResourceReleased',
    primaryKey: (payload) => payload.contextId,
    payload: ResourceReleasedPayload,
  })
  .add({
    tag: 'ExternalRefLinked',
    primaryKey: (payload) => payload.contextId,
    payload: ExternalRefLinkedPayload,
  })
  .add({
    tag: 'ExternalRefUnlinked',
    primaryKey: (payload) => payload.contextId,
    payload: ExternalRefUnlinkedPayload,
  })
  .add({
    tag: 'ChildWorkOrderSpawned',
    primaryKey: (payload) => payload.contextId,
    payload: ChildWorkOrderSpawnedPayload,
  })

// =============================================================================
// Task Events (ISA-95 Level 3 Task Execution)
// =============================================================================

/**
 * Task Events — Task Instance Lifecycle
 *
 * These events track task execution within work orders:
 * - TaskBecameReady: Dependencies satisfied, task can start
 * - TaskStarted: Task execution began
 * - TaskProgressUpdated: Progress percentage updated
 * - TaskBlocked/TaskUnblocked: Blocking and resolution
 * - TaskCompleted: Successfully finished
 * - TaskFailed: Failed with error
 * - TaskSkipped: Intentionally skipped
 * - TaskCompensated: Compensating action executed (saga pattern)
 *
 * Stored in EventLog for full audit trail.
 *
 * @see ISA-95/IEC 62264 for operations management
 */
export const TaskEvents = EventGroup.empty
  .add({
    tag: 'TaskBecameReady',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskBecameReadyPayload,
  })
  .add({
    tag: 'TaskStarted',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskStartedPayload,
  })
  .add({
    tag: 'TaskProgressUpdated',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskProgressUpdatedPayload,
  })
  .add({
    tag: 'TaskBlocked',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskBlockedPayload,
  })
  .add({
    tag: 'TaskUnblocked',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskUnblockedPayload,
  })
  .add({
    tag: 'TaskCompleted',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskCompletedPayload,
  })
  .add({
    tag: 'TaskFailed',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskFailedPayload,
  })
  .add({
    tag: 'TaskSkipped',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskSkippedPayload,
  })
  .add({
    tag: 'TaskCompensated',
    primaryKey: (payload) => payload.taskInstanceId,
    payload: TaskCompensatedPayload,
  })

// =============================================================================
// Approval Events (FDA 4-Eyes Principle Compliance)
// =============================================================================

/**
 * Approval Events — Approval Workflow State Transitions
 *
 * These events track the approval workflow lifecycle:
 * - ApprovalRequested: Approval request created
 * - ApprovalGranted: Request approved
 * - ApprovalRejected: Request denied with reason
 * - ApprovalEscalated: Escalated to higher authority
 * - ApprovalCompleted: Approval process finished
 * - ApprovalExpired: Request expired without action
 *
 * Critical for FDA 21 CFR Part 11 4-eyes principle compliance.
 *
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ADR-0012 for ES boundaries (approvals ARE event sourced)
 */
export const ApprovalEvents = EventGroup.empty
  .add({
    tag: 'ApprovalRequested',
    primaryKey: (payload) => payload.approvalRequestId,
    payload: ApprovalRequestedPayload,
  })
  .add({
    tag: 'ApprovalGranted',
    primaryKey: (payload) => payload.approvalRequestId,
    payload: ApprovalGrantedPayload,
  })
  .add({
    tag: 'ApprovalRejected',
    primaryKey: (payload) => payload.approvalRequestId,
    payload: ApprovalRejectedPayload,
  })
  .add({
    tag: 'ApprovalEscalated',
    primaryKey: (payload) => payload.approvalRequestId,
    payload: ApprovalEscalatedPayload,
  })
  .add({
    tag: 'ApprovalCompleted',
    primaryKey: (payload) => payload.approvalRequestId,
    payload: ApprovalCompletedPayload,
  })
  .add({
    tag: 'ApprovalExpired',
    primaryKey: (payload) => payload.approvalRequestId,
    payload: ApprovalExpiredPayload,
  })

/**
 * Combined IIoT Event Groups
 *
 * Merges structural, operational, and alarm events for use with EventLog.schema.
 * This is the complete set of events that the IIoT EventLog will handle.
 *
 * @example
 * ```typescript
 * import { IIoTEventLogSchema } from './groups'
 * import * as EventLog from '@effect/experimental/EventLog'
 *
 * // Create EventLog layer with this schema
 * const layer = EventLog.layer(IIoTEventLogSchema)
 * ```
 */
export type IIoTEvents =
  | EventGroup.EventGroup.Events<typeof StructuralEvents>
  | EventGroup.EventGroup.Events<typeof OperationalEvents>
  | EventGroup.EventGroup.Events<typeof AlarmEvents>
  | EventGroup.EventGroup.Events<typeof EquipmentStateEvents>
  | EventGroup.EventGroup.Events<typeof WorkOrderEvents>
  | EventGroup.EventGroup.Events<typeof ContextEvents>
  | EventGroup.EventGroup.Events<typeof TaskEvents>
  | EventGroup.EventGroup.Events<typeof ApprovalEvents>
  | EventGroup.EventGroup.Events<typeof BatchEvents>
  | EventGroup.EventGroup.Events<typeof QualityEvents>
  | EventGroup.EventGroup.Events<typeof OperatorEvents>

/**
 * Alarm event type union for handlers and type guards.
 */
export type AlarmEventTypes = EventGroup.EventGroup.Events<typeof AlarmEvents>

/**
 * Equipment state event type union for handlers and type guards.
 */
export type EquipmentStateEventTypes = EventGroup.EventGroup.Events<typeof EquipmentStateEvents>

/**
 * Work order event type union for handlers and type guards.
 */
export type WorkOrderEventTypes = EventGroup.EventGroup.Events<typeof WorkOrderEvents>

/**
 * Context event type union for handlers and type guards.
 */
export type ContextEventTypes = EventGroup.EventGroup.Events<typeof ContextEvents>

/**
 * Task event type union for handlers and type guards.
 */
export type TaskEventTypes = EventGroup.EventGroup.Events<typeof TaskEvents>

/**
 * Approval event type union for handlers and type guards.
 */
export type ApprovalEventTypes = EventGroup.EventGroup.Events<typeof ApprovalEvents>

/**
 * Batch event type union for handlers and type guards.
 */
export type BatchEventTypes = EventGroup.EventGroup.Events<typeof BatchEvents>

/**
 * Quality event type union for handlers and type guards.
 */
export type QualityEventTypes = EventGroup.EventGroup.Events<typeof QualityEvents>

/**
 * Operator event type union for handlers and type guards.
 */
export type OperatorEventTypes = EventGroup.EventGroup.Events<typeof OperatorEvents>

// =============================================================================
// Exports for Infrastructure Layer
// =============================================================================

export { StructuralEventFields, OperationalEventFields }

// Note: All EventGroups are already exported at declaration

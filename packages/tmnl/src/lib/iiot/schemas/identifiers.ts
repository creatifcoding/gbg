/**
 * IIoT Domain Identifiers
 *
 * Branded types for type-safe identifiers across the IIoT domain.
 * Follows ISA-95 equipment hierarchy: Enterprise → Site → Area → Line → Machine → Sensor
 *
 * @module
 * @see ADR-0012 for ES boundaries
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'

// =============================================================================
// ISA-95 Equipment Level Enum
// =============================================================================

/**
 * ISA-95 equipment hierarchy levels.
 *
 * Maps to automation pyramid:
 * - L4: Enterprise (ERP, BI)
 * - L3: Site (MES/MOM) - AMS scope
 * - L2: Area (SCADA/HMI) - IIoT scope
 * - L1: Line/Machine (PLC/DCS)
 * - L0: Sensor (Physical process)
 */
export const EquipmentLevel = Schema.Literal(
  'enterprise',
  'site',
  'area',
  'plant',
  'line',
  'workcell',
  'machine',
  'sensor',
  'device'
)
export type EquipmentLevel = Schema.Schema.Type<typeof EquipmentLevel>

// =============================================================================
// Branded Identifiers (ISA-95 Hierarchy)
// =============================================================================

/** Enterprise identifier (multi-site corporation) */
export const EnterpriseId = Schema.String.pipe(Schema.brand('EnterpriseId'))
export type EnterpriseId = Schema.Schema.Type<typeof EnterpriseId>

/** Site identifier (physical location) */
export const SiteId = Schema.String.pipe(Schema.brand('SiteId'))
export type SiteId = Schema.Schema.Type<typeof SiteId>

/** Area identifier (sub-site zone) */
export const AreaId = Schema.String.pipe(Schema.brand('AreaId'))
export type AreaId = Schema.Schema.Type<typeof AreaId>

/** Plant identifier (e.g., 'PLANT-A') - alias for Site in simplified hierarchy */
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>

/** Production line identifier (e.g., 'LINE-001') - ISA-95 Work Center */
export const LineId = Schema.String.pipe(Schema.brand('LineId'))
export type LineId = Schema.Schema.Type<typeof LineId>

/** Work cell identifier (e.g., 'WCL-001') - ISA-95 Work Unit Group */
export const WorkCellId = Schema.String.pipe(Schema.brand('WorkCellId'))
export type WorkCellId = Schema.Schema.Type<typeof WorkCellId>

/** Machine identifier (e.g., 'MCH-001') - ISA-95 Work Unit */
export const MachineId = Schema.String.pipe(Schema.brand('MachineId'))
export type MachineId = Schema.Schema.Type<typeof MachineId>

/** Sensor identifier (e.g., 'SNS-001') - ISA-95 Control Module (sensing) */
export const SensorId = Schema.String.pipe(Schema.brand('SensorId'))
export type SensorId = Schema.Schema.Type<typeof SensorId>

/** Device identifier (e.g., 'DEV-001') - ISA-95 Control Module (actuation) */
export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
export type DeviceId = Schema.Schema.Type<typeof DeviceId>

/** Generic asset identifier for cross-level references */
export const AssetId = Schema.String.pipe(Schema.brand('AssetId'))
export type AssetId = Schema.Schema.Type<typeof AssetId>

// =============================================================================
// Domain Identifiers
// =============================================================================

/** Alarm identifier (e.g., 'ALM-abc123') */
export const AlarmId = Schema.String.pipe(Schema.brand('AlarmId'))
export type AlarmId = Schema.Schema.Type<typeof AlarmId>

/** Work order identifier (e.g., 'WO-2026-00001') */
export const WorkOrderId = Schema.String.pipe(Schema.brand('WorkOrderId'))
export type WorkOrderId = Schema.Schema.Type<typeof WorkOrderId>

/** Task instance identifier within a work order (e.g., 'TASK-abc123') */
export const TaskInstanceId = Schema.String.pipe(Schema.brand('TaskInstanceId'))
export type TaskInstanceId = Schema.Schema.Type<typeof TaskInstanceId>

/** Task definition identifier referencing workflow template (e.g., 'TDEF-maintenance-step-1') */
export const TaskDefinitionId = Schema.String.pipe(Schema.brand('TaskDefinitionId'))
export type TaskDefinitionId = Schema.Schema.Type<typeof TaskDefinitionId>

/** Approval request identifier (e.g., 'APRV-abc123') */
export const ApprovalId = Schema.String.pipe(Schema.brand('ApprovalId'))
export type ApprovalId = Schema.Schema.Type<typeof ApprovalId>

/** L3 sync operation identifier (e.g., 'SYNC-abc123') */
export const SyncId = Schema.String.pipe(Schema.brand('SyncId'))
export type SyncId = Schema.Schema.Type<typeof SyncId>

/** Workflow definition identifier (e.g., 'WF-maintenance-v1') */
export const WorkflowDefinitionId = Schema.String.pipe(Schema.brand('WorkflowDefinitionId'))
export type WorkflowDefinitionId = Schema.Schema.Type<typeof WorkflowDefinitionId>

/** Context snapshot identifier for immutable audit records */
export const ContextSnapshotId = Schema.String.pipe(Schema.brand('ContextSnapshotId'))
export type ContextSnapshotId = Schema.Schema.Type<typeof ContextSnapshotId>

/** Work order context identifier (e.g., 'CTX-abc123') */
export const WorkOrderContextId = Schema.String.pipe(Schema.brand('WorkOrderContextId'))
export type WorkOrderContextId = Schema.Schema.Type<typeof WorkOrderContextId>

/** Resource identifier for tools, materials, equipment (e.g., 'RES-abc123') */
export const ResourceId = Schema.String.pipe(Schema.brand('ResourceId'))
export type ResourceId = Schema.Schema.Type<typeof ResourceId>

/** External system reference identifier (e.g., 'EXTREF-abc123') */
export const ExternalRefId = Schema.String.pipe(Schema.brand('ExternalRefId'))
export type ExternalRefId = Schema.Schema.Type<typeof ExternalRefId>

// Note: EquipmentStateId is defined in equipment-state/schema.ts with pattern validation
// Re-exported via equipment-state/index.ts

// =============================================================================
// Event Sourcing Identifiers
// =============================================================================

/** Event identifier (journal entry, e.g., 'EVT-abc123') */
export const EventId = Schema.String.pipe(Schema.brand('EventId'))
export type EventId = Schema.Schema.Type<typeof EventId>

/** Fact identifier (extensible metadata, e.g., 'FACT-abc123') */
export const FactId = Schema.String.pipe(Schema.brand('FactId'))
export type FactId = Schema.Schema.Type<typeof FactId>

/** Propagation identifier for Reactor causal DAGs (e.g., 'PROP-abc123') */
export const PropagationId = Schema.String.pipe(Schema.brand('PropagationId'))
export type PropagationId = Schema.Schema.Type<typeof PropagationId>

/** Relationship edge identifier for graph/audit correlation (e.g., 'EDGE-abc123') */
export const EdgeId = Schema.String.pipe(Schema.brand('EdgeId'))
export type EdgeId = Schema.Schema.Type<typeof EdgeId>

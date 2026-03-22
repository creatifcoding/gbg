/**
 * IIoT Integration Test Fixtures
 *
 * Reusable test data with TEST- prefix for isolation.
 * All IDs use TEST- prefix so cleanup can target them specifically.
 *
 * @module
 */

import { DateTime, Option, Schema } from 'effect'
import { Model } from '@effect/sql'
import type {
  PlantId,
  LineId,
  MachineId,
  DeviceId,
  AlarmId,
  WorkOrderId,
  WorkflowDefinitionId,
  EnterpriseId,
  SiteId,
  AreaId,
  WorkCellId,
} from '../../schemas/identifiers'
import type { SensorType, MeasurementUnit } from '../../schemas/assets'
import type { AlarmType, AlarmSeverity } from '../../schemas/alarms'
import { QualityScore } from '../../schemas/readings'
import type { QualityScore as QualityScoreType } from '../../schemas/readings'
import type {
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../../schemas/work-orders'
import type {
  EquipmentStateId,
  StateType,
  StateReason,
} from '../../schemas/equipment-state/schema'
import type {
  DeviceConfigId,
  ConfigVersion,
  ConfigStatus,
} from '../../schemas/device-config/schema'

// =============================================================================
// Schema Helpers
// =============================================================================

/**
 * Helper to create properly typed QualityScore values using Effect Schema.
 * Uses Schema.decodeSync to validate and brand the value at runtime.
 */
const makeQualityScore = (value: number): QualityScoreType =>
  Schema.decodeSync(QualityScore)(value)

// =============================================================================
// Test Identifiers
// =============================================================================

export const testIds = {
  // Hierarchy IDs (for parent relationships)
  enterprise1: 'TEST-ENT-001' as EnterpriseId,
  site1: 'TEST-SIT-001' as SiteId,
  area1: 'TEST-ARA-001' as AreaId,
  workcell1: 'TEST-WCL-001' as WorkCellId,

  // Asset IDs
  // Note: IDs must match schema patterns (e.g., MCH-* for MachineId)
  plant1: 'TEST-PLANT-001' as PlantId,
  plant2: 'TEST-PLANT-002' as PlantId,
  line1: 'TEST-LINE-001' as LineId,
  line2: 'TEST-LINE-002' as LineId,
  machine1: 'MCH-test-001' as MachineId,
  machine2: 'MCH-test-002' as MachineId,
  device1: 'TEST-TMP-001' as DeviceId,
  device2: 'TEST-VIB-001' as DeviceId,
  device3: 'TEST-TMP-002' as DeviceId,

  // Alarm IDs (for manually created alarms in tests)
  // Note: AlarmRepo.insert generates IDs, so these are for reference only
  alarm1: 'TEST-ALM-001' as AlarmId,
  alarm2: 'TEST-ALM-002' as AlarmId,

  // Work Order IDs
  workOrder1: 'WO-TEST-2026-00001' as WorkOrderId,
  workOrder2: 'WO-TEST-2026-00002' as WorkOrderId,
  workflowDef1: 'WF-TEST-maintenance-v1' as WorkflowDefinitionId,
  workflowDef2: 'WF-TEST-inspection-v1' as WorkflowDefinitionId,

  // Equipment State IDs (EST- prefix with pattern validation)
  equipmentState1: 'EST-test-mch001-20260130-001' as EquipmentStateId,
  equipmentState2: 'EST-test-mch001-20260130-002' as EquipmentStateId,
  equipmentState3: 'EST-test-mch002-20260130-001' as EquipmentStateId,

  // Device Config IDs (CFG- prefix with pattern validation)
  deviceConfig1: 'CFG-test-sensor-01-v1' as DeviceConfigId,
  deviceConfig2: 'CFG-test-sensor-01-v2' as DeviceConfigId,
  deviceConfig3: 'CFG-test-device-01-v1' as DeviceConfigId,

  // Non-existent IDs for negative tests
  nonExistentPlant: 'TEST-PLANT-NONEXISTENT' as PlantId,
  nonExistentLine: 'TEST-LINE-NONEXISTENT' as LineId,
  nonExistentMachine: 'TEST-MCH-NONEXISTENT' as MachineId,
  nonExistentDevice: 'TEST-DEV-NONEXISTENT' as DeviceId,
  nonExistentAlarm: 'TEST-ALM-NONEXISTENT' as AlarmId,
  nonExistentWorkOrder: 'WO-TEST-NONEXISTENT' as WorkOrderId,
  nonExistentWorkflowDef: 'WF-TEST-NONEXISTENT' as WorkflowDefinitionId,
  nonExistentEquipmentState: 'EST-test-nonexistent' as EquipmentStateId,
  nonExistentDeviceConfig: 'CFG-test-nonexistent' as DeviceConfigId,
} as const

// =============================================================================
// Hierarchy Paths (for materialized path column)
// =============================================================================

const hierarchyPaths = {
  enterprise: `/${testIds.enterprise1}`,
  site: `/${testIds.enterprise1}/${testIds.site1}`,
  plant1: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}`,
  plant2: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant2}`,
  line1: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}/${testIds.line1}`,
  line2: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}/${testIds.line2}`,
  machine1: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}/${testIds.line1}/${testIds.machine1}`,
  machine2: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}/${testIds.line1}/${testIds.machine2}`,
  sensor1: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}/${testIds.line1}/${testIds.machine1}/${testIds.device1}`,
  sensor2: `/${testIds.enterprise1}/${testIds.site1}/${testIds.plant1}/${testIds.line1}/${testIds.machine1}/${testIds.device2}`,
}

// =============================================================================
// Asset Fixtures (Insert Types)
// =============================================================================

export const testPlant1Insert = {
  id: testIds.plant1,
  name: 'Test Plant Alpha' as const,
  status: 'active' as const,
  hierarchyPath: hierarchyPaths.plant1,
  enterpriseId: testIds.enterprise1,
  siteId: Option.some(testIds.site1),
  areaId: Option.none<AreaId>(),
  timezone: 'America/New_York',
  description: Option.none<string>(),
  siteCode: Option.none<string>(),
  location: Option.some('Test Location A' as unknown),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testPlant2Insert = {
  id: testIds.plant2,
  name: 'Test Plant Beta' as const,
  status: 'active' as const,
  hierarchyPath: hierarchyPaths.plant2,
  enterpriseId: testIds.enterprise1,
  siteId: Option.some(testIds.site1),
  areaId: Option.none<AreaId>(),
  timezone: 'America/Chicago',
  description: Option.none<string>(),
  siteCode: Option.none<string>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testLine1Insert = {
  id: testIds.line1,
  name: 'Test Line One' as const,
  status: 'active' as const,
  hierarchyPath: hierarchyPaths.line1,
  enterpriseId: testIds.enterprise1,
  siteId: testIds.site1,
  areaId: Option.none<AreaId>(),
  plantId: testIds.plant1,
  description: Option.none<string>(),
  capacity: Option.none<number>(),
  operatingHoursPerDay: Option.none<number>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testLine2Insert = {
  id: testIds.line2,
  name: 'Test Line Two' as const,
  status: 'active' as const,
  hierarchyPath: hierarchyPaths.line2,
  enterpriseId: testIds.enterprise1,
  siteId: testIds.site1,
  areaId: Option.none<AreaId>(),
  plantId: testIds.plant1,
  description: Option.none<string>(),
  capacity: Option.none<number>(),
  operatingHoursPerDay: Option.none<number>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testMachine1Insert = {
  id: testIds.machine1,
  name: 'Test Machine Alpha' as const,
  status: 'active' as const,
  machineType: 'CNC' as const,
  hierarchyPath: hierarchyPaths.machine1,
  enterpriseId: testIds.enterprise1,
  siteId: testIds.site1,
  areaId: Option.none<AreaId>(),
  plantId: testIds.plant1,
  lineId: testIds.line1,
  workcellId: Option.none<WorkCellId>(),
  description: Option.none<string>(),
  manufacturer: Option.none<string>(),
  modelNumber: Option.some('Model X-100'),
  serialNumber: Option.none<string>(),
  installationDate: Option.none<Date>(),
  lastMaintenanceDate: Option.none<Date>(),
  nextMaintenanceDate: Option.none<Date>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testMachine2Insert = {
  id: testIds.machine2,
  name: 'Test Machine Beta' as const,
  status: 'active' as const,
  machineType: 'Press' as const,
  hierarchyPath: hierarchyPaths.machine2,
  enterpriseId: testIds.enterprise1,
  siteId: testIds.site1,
  areaId: Option.none<AreaId>(),
  plantId: testIds.plant1,
  lineId: testIds.line1,
  workcellId: Option.none<WorkCellId>(),
  description: Option.none<string>(),
  manufacturer: Option.none<string>(),
  modelNumber: Option.none<string>(),
  serialNumber: Option.none<string>(),
  installationDate: Option.none<Date>(),
  lastMaintenanceDate: Option.none<Date>(),
  nextMaintenanceDate: Option.none<Date>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testSensor1Insert = {
  deviceId: testIds.device1,
  name: 'Test Sensor Alpha' as const,
  status: 'active' as const,
  type: 'temperature' as SensorType,
  unit: 'celsius' as MeasurementUnit,
  hierarchyPath: hierarchyPaths.sensor1,
  enterpriseId: testIds.enterprise1,
  siteId: testIds.site1,
  areaId: Option.none<AreaId>(),
  plantId: testIds.plant1,
  lineId: testIds.line1,
  workcellId: Option.none<WorkCellId>(),
  machineId: testIds.machine1,
  description: Option.none<string>(),
  sampleRateMs: Option.none<number>(),
  thresholdHigh: Option.none<number>(),
  thresholdCritical: Option.none<number>(),
  thresholdLow: Option.none<number>(),
  opcUaNodeId: Option.none<string>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

export const testSensor2Insert = {
  deviceId: testIds.device2,
  name: 'Test Sensor Beta' as const,
  status: 'active' as const,
  type: 'vibration' as SensorType,
  unit: 'mm_s' as MeasurementUnit,
  hierarchyPath: hierarchyPaths.sensor2,
  enterpriseId: testIds.enterprise1,
  siteId: testIds.site1,
  areaId: Option.none<AreaId>(),
  plantId: testIds.plant1,
  lineId: testIds.line1,
  workcellId: Option.none<WorkCellId>(),
  machineId: testIds.machine1,
  description: Option.none<string>(),
  sampleRateMs: Option.none<number>(),
  thresholdHigh: Option.none<number>(),
  thresholdCritical: Option.none<number>(),
  thresholdLow: Option.none<number>(),
  opcUaNodeId: Option.none<string>(),
  location: Option.none<unknown>(),
  metadata: Option.none<Record<string, unknown>>(),
  createdAt: Model.Override(DateTime.unsafeNow()),
  updatedAt: Option.none<Date>(),
}

// =============================================================================
// Alarm Fixtures (Insert Types)
// =============================================================================

export const testAlarm1Insert = {
  deviceId: testIds.device1,
  alarmType: 'high_temperature' as AlarmType,
  severity: 'warning' as AlarmSeverity,
  message: Option.some('Temperature exceeded threshold'),
  triggeredAt: Model.Override(DateTime.unsafeNow()),
  acknowledgedAt: Option.none<Date>(),
  acknowledgedBy: Option.none<string>(),
  clearedAt: Option.none<Date>(),
  metadata: Option.some({ threshold: 80, actualValue: 85 }),
}

export const testAlarm2Insert = {
  deviceId: testIds.device1,
  alarmType: 'sensor_fault' as AlarmType,
  severity: 'critical' as AlarmSeverity,
  message: Option.none(),
  triggeredAt: Model.Override(DateTime.unsafeNow()),
  acknowledgedAt: Option.none<Date>(),
  acknowledgedBy: Option.none<string>(),
  clearedAt: Option.none<Date>(),
  metadata: Option.none(),
}

// =============================================================================
// Reading Fixtures (Insert Types)
// =============================================================================

const now = new Date()
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

export const testSensorReading1Insert = {
  time: now,
  deviceId: testIds.device1,
  value: 25.5,
  quality: makeQualityScore(100),
}

export const testSensorReading2Insert = {
  time: oneHourAgo,
  deviceId: testIds.device1,
  value: 24.2,
  quality: makeQualityScore(95),
}

export const testSensorReadingBatch = [
  { time: now, deviceId: testIds.device1, value: 25.5, quality: makeQualityScore(100) },
  { time: oneHourAgo, deviceId: testIds.device1, value: 24.2, quality: makeQualityScore(95) },
  { time: twoHoursAgo, deviceId: testIds.device1, value: 23.8, quality: makeQualityScore(90) },
]

export const testAnalyticsRecord1Insert = {
  hour: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()),
  deviceId: testIds.device1,
  avgValue: 24.5,
  minValue: 23.0,
  maxValue: 26.0,
  stddev: Option.some(1.2),
  sampleCount: 360,
}

export const testAnalyticsRecord2Insert = {
  hour: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1),
  deviceId: testIds.device1,
  avgValue: 23.8,
  minValue: 22.5,
  maxValue: 25.0,
  stddev: Option.none(),
  sampleCount: 360,
}

// =============================================================================
// Alarm Context Note
// =============================================================================

// AlarmContextRepo is now a read-only repository backed by a materialized view.
// The view is refreshed from iiot.alarms + iiot.sensor_readings joins.
// To test alarm context:
//   1. Create sensor readings via SensorReadingRepo.insertBatch()
//   2. Create alarms via AlarmRepo.insert()
//   3. Refresh the view via AlarmContextRepo.refresh()
//   4. Query via AlarmContextRepo.findByAlarm()

// =============================================================================
// Update Fixtures
// =============================================================================

export const testPlant1Update = {
  id: testIds.plant1,
  name: 'Updated Plant Alpha',
  location: Option.some('Updated Location'),
}

export const testMachine1Update = {
  id: testIds.machine1,
  name: 'Updated Machine Alpha',
}

export const testSensor1Update = {
  deviceId: testIds.device1,
  type: 'humidity' as SensorType,
  unit: 'percent' as MeasurementUnit,
}

// =============================================================================
// Work Order Fixtures (Insert Types)
// =============================================================================

/**
 * Work Order Insert with optional fields populated.
 * Represents a preventive maintenance work order.
 */
export const testWorkOrder1Insert = {
  workflowDefinitionId: testIds.workflowDef1,
  workflowVersion: '1.0.0',
  title: 'Test PM - Line 1 Monthly' as const,
  description: 'Scheduled preventive maintenance for Line 1',
  type: 'preventive_maintenance' as WorkOrderType,
  priority: 'normal' as WorkOrderPriority,
  status: 'created' as WorkOrderStatus,
  createdBy: 'test-user-001',
  createdAt: Model.Override(DateTime.unsafeNow()),
  scheduledStart: Option.some(new Date(now.getTime() + 24 * 60 * 60 * 1000)), // Tomorrow
  dueDate: Option.some(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)), // In a week
  actualStart: Option.none<Date>(),
  actualEnd: Option.none<Date>(),
  expectedResume: Option.none<Date>(),
  parentWorkOrderId: Option.none<WorkOrderId>(),
  primaryAssetId: Option.none(),
  failedTaskId: Option.none(),
  assignedTo: Option.some('maintenance-team-alpha'),
  summary: Option.none<string>(),
  failureReason: Option.none<string>(),
  cancellationReason: Option.none<string>(),
  outcome: Option.none(),
  suspensionReason: Option.none(),
  finalStatus: Option.none(),
  compensationRequired: false,
  metadata: Option.some({ estimatedHours: 4, skillLevel: 'standard' }),
  transitions: [] as const, // Transitions stored in normalized table
}

/**
 * Work Order Insert with minimal required fields.
 * Represents an emergency repair work order.
 */
export const testWorkOrder2Insert = {
  workflowDefinitionId: testIds.workflowDef2,
  workflowVersion: '1.0.0',
  title: 'Test Emergency Repair - MCH-001' as const,
  description: 'Urgent repair needed',
  type: 'emergency_repair' as WorkOrderType,
  priority: 'urgent' as WorkOrderPriority,
  status: 'created' as WorkOrderStatus,
  createdBy: 'test-user-002',
  createdAt: Model.Override(DateTime.unsafeNow()),
  scheduledStart: Option.none<Date>(),
  dueDate: Option.none<Date>(),
  actualStart: Option.none<Date>(),
  actualEnd: Option.none<Date>(),
  expectedResume: Option.none<Date>(),
  parentWorkOrderId: Option.none<WorkOrderId>(),
  primaryAssetId: Option.none(),
  failedTaskId: Option.none(),
  assignedTo: Option.none<string>(),
  summary: Option.none<string>(),
  failureReason: Option.none<string>(),
  cancellationReason: Option.none<string>(),
  outcome: Option.none(),
  suspensionReason: Option.none(),
  finalStatus: Option.none(),
  compensationRequired: false,
  metadata: Option.none(),
  transitions: [] as const, // Transitions stored in normalized table
}

/**
 * Work Order Update fixture.
 * Simulates transitioning to started state.
 */
export const testWorkOrder1Update = {
  id: testIds.workOrder1,
  status: 'started' as WorkOrderStatus,
  assignedTo: Option.some('maintenance-tech-001'),
  actualStart: Option.some(new Date()),
}

// =============================================================================
// Equipment State Fixtures (Insert Types)
// =============================================================================

/**
 * Equipment State Insert - Running state.
 * Machine is actively producing.
 */
export const testEquipmentState1Insert = {
  machineId: testIds.machine1,
  state: 'running' as StateType,
  reason: Option.some('production' as StateReason),
  startedAt: Model.Override(DateTime.unsafeNow()),
  endedAt: Option.none<Date>(),
  operatorId: Option.some('operator-001'),
  notes: Option.some('Normal production run'),
  metadata: Option.some({ shiftId: 'A', productCode: 'PROD-001' }),
}

/**
 * Equipment State Insert - Idle state with reason.
 * Machine is available but not producing.
 */
export const testEquipmentState2Insert = {
  machineId: testIds.machine1,
  state: 'idle' as StateType,
  reason: Option.some('no_operator' as StateReason),
  startedAt: Model.Override(DateTime.unsafeNow()),
  endedAt: Option.none<Date>(),
  operatorId: Option.none<string>(),
  notes: Option.some('Shift change in progress'),
  metadata: Option.none(),
}

/**
 * Equipment State Insert - Planned downtime.
 * For OEE availability loss testing.
 */
export const testEquipmentStatePlannedDowntimeInsert = {
  machineId: testIds.machine1,
  state: 'planned_downtime' as StateType,
  reason: Option.some('scheduled_maintenance' as StateReason),
  startedAt: Model.Override(DateTime.unsafeNow()),
  endedAt: Option.none<Date>(),
  operatorId: Option.some('maintenance-tech-001'),
  notes: Option.some('Weekly PM window'),
  metadata: Option.some({ workOrderId: testIds.workOrder1 }),
}

/**
 * Equipment State Insert - Unplanned downtime.
 * For OEE unplanned downtime testing.
 */
export const testEquipmentStateUnplannedDowntimeInsert = {
  machineId: testIds.machine1,
  state: 'unplanned_downtime' as StateType,
  reason: Option.some('breakdown' as StateReason),
  startedAt: Model.Override(DateTime.unsafeNow()),
  endedAt: Option.none<Date>(),
  operatorId: Option.some('operator-001'),
  notes: Option.some('Motor failure - maintenance called'),
  metadata: Option.some({ faultCode: 'E-101', priority: 'critical' }),
}

/**
 * Equipment State Insert - Setup state.
 * For changeover testing.
 */
export const testEquipmentStateSetupInsert = {
  machineId: testIds.machine2,
  state: 'setup' as StateType,
  reason: Option.some('changeover' as StateReason),
  startedAt: Model.Override(DateTime.unsafeNow()),
  endedAt: Option.none<Date>(),
  operatorId: Option.some('operator-002'),
  notes: Option.some('Changing from PROD-001 to PROD-002'),
  metadata: Option.some({ fromProduct: 'PROD-001', toProduct: 'PROD-002' }),
}

/**
 * Equipment State Insert - Blocked state.
 * Machine is starved or blocked.
 */
export const testEquipmentStateBlockedInsert = {
  machineId: testIds.machine2,
  state: 'blocked' as StateType,
  reason: Option.some('starved' as StateReason),
  startedAt: Model.Override(DateTime.unsafeNow()),
  endedAt: Option.none<Date>(),
  operatorId: Option.none<string>(),
  notes: Option.some('Waiting for upstream material'),
  metadata: Option.none(),
}

// =============================================================================
// Device Config Fixtures (Insert Types)
// =============================================================================

/**
 * Device Config Insert - Draft configuration.
 * Initial sensor configuration awaiting approval.
 */
export const testDeviceConfig1Insert = {
  targetType: 'sensor' as const,
  targetId: testIds.device1 as string,
  version: 1 as ConfigVersion,
  status: 'draft' as ConfigStatus,
  config: {
    precision: 2,
    filterCoefficient: 0.1,
  },
  createdBy: 'config-admin-001',
  createdAt: Model.Override(DateTime.unsafeNow()),
  sampleRateMs: Option.some(1000),
  thresholds: Option.some({
    low: 15,
    high: 80,
    criticalLow: 10,
    criticalHigh: 90,
  }),
  updatedBy: Option.none<string>(),
  approvedBy: Option.none<string>(),
  changeReason: Option.some('Initial configuration'),
  updatedAt: Option.none<Date>(),
  approvedAt: Option.none<Date>(),
  previousVersionId: Option.none<DeviceConfigId>(),
}

/**
 * Device Config Insert - Active configuration with thresholds.
 * Approved and active sensor configuration.
 */
export const testDeviceConfig2Insert = {
  targetType: 'sensor' as const,
  targetId: testIds.device1 as string,
  version: 2 as ConfigVersion,
  status: 'active' as ConfigStatus,
  config: {
    precision: 3,
    filterCoefficient: 0.05,
    smoothingEnabled: true,
  },
  createdBy: 'config-admin-001',
  createdAt: Model.Override(DateTime.unsafeNow()),
  sampleRateMs: Option.some(500),
  thresholds: Option.some({
    low: 18,
    high: 75,
    criticalLow: 12,
    criticalHigh: 85,
  }),
  updatedBy: Option.some('config-admin-002'),
  approvedBy: Option.some('supervisor-001'),
  changeReason: Option.some('Adjusted thresholds after calibration'),
  updatedAt: Option.some(new Date()),
  approvedAt: Option.some(new Date()),
  previousVersionId: Option.some(testIds.deviceConfig1),
}

/**
 * Device Config Insert - Device (actuator) configuration.
 * Configuration for a device rather than sensor.
 */
export const testDeviceConfig3Insert = {
  targetType: 'device' as const,
  targetId: testIds.device2 as string,
  version: 1 as ConfigVersion,
  status: 'draft' as ConfigStatus,
  config: {
    controlMode: 'proportional',
    responseTime: 100,
    deadband: 0.5,
  },
  createdBy: 'config-admin-001',
  createdAt: Model.Override(DateTime.unsafeNow()),
  sampleRateMs: Option.none<number>(),
  thresholds: Option.none(),
  updatedBy: Option.none<string>(),
  approvedBy: Option.none<string>(),
  changeReason: Option.some('Initial actuator configuration'),
  updatedAt: Option.none<Date>(),
  approvedAt: Option.none<Date>(),
  previousVersionId: Option.none<DeviceConfigId>(),
}

/**
 * Device Config Update fixture.
 * Simulates updating configuration values.
 */
export const testDeviceConfig1Update = {
  id: testIds.deviceConfig1,
  config: {
    precision: 3,
    filterCoefficient: 0.08,
    newField: 'added',
  },
  changeReason: 'Updated precision and filter after testing',
  updatedBy: 'config-admin-002',
  sampleRateMs: Option.some(750),
  thresholds: Option.some({
    low: 16,
    high: 78,
    criticalLow: 11,
    criticalHigh: 88,
  }),
}

// =============================================================================
// Time Utilities
// =============================================================================

export const testDates = {
  now,
  oneHourAgo,
  twoHoursAgo,
  oneDayAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  oneWeekAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
}

/**
 * IIoT Integration Test Fixtures
 *
 * Reusable test data with TEST- prefix for isolation.
 * All IDs use TEST- prefix so cleanup can target them specifically.
 *
 * @module
 */

import { Option } from 'effect'
import type {
  PlantId,
  LineId,
  MachineId,
  DeviceId,
  AlarmId,
} from '../../schemas/identifiers'
import type { SensorType, MeasurementUnit } from '../../schemas/assets'
import type { AlarmType, AlarmSeverity } from '../../schemas/alarms'
import type { QualityScore } from '../../schemas/readings'

// =============================================================================
// Test Identifiers
// =============================================================================

export const testIds = {
  // Asset IDs
  plant1: 'TEST-PLANT-001' as PlantId,
  plant2: 'TEST-PLANT-002' as PlantId,
  line1: 'TEST-LINE-001' as LineId,
  line2: 'TEST-LINE-002' as LineId,
  machine1: 'TEST-MCH-001' as MachineId,
  machine2: 'TEST-MCH-002' as MachineId,
  device1: 'TEST-TMP-001' as DeviceId,
  device2: 'TEST-VIB-001' as DeviceId,
  device3: 'TEST-TMP-002' as DeviceId,

  // Alarm IDs (for manually created alarms in tests)
  // Note: AlarmRepo.insert generates IDs, so these are for reference only
  alarm1: 'TEST-ALM-001' as AlarmId,
  alarm2: 'TEST-ALM-002' as AlarmId,

  // Non-existent IDs for negative tests
  nonExistentPlant: 'TEST-PLANT-NONEXISTENT' as PlantId,
  nonExistentLine: 'TEST-LINE-NONEXISTENT' as LineId,
  nonExistentMachine: 'TEST-MCH-NONEXISTENT' as MachineId,
  nonExistentDevice: 'TEST-DEV-NONEXISTENT' as DeviceId,
  nonExistentAlarm: 'TEST-ALM-NONEXISTENT' as AlarmId,
} as const

// =============================================================================
// Asset Fixtures (Insert Types)
// =============================================================================

export const testPlant1Insert = {
  id: testIds.plant1,
  name: 'Test Plant Alpha' as const,
  location: Option.some('Test Location A'),
}

export const testPlant2Insert = {
  id: testIds.plant2,
  name: 'Test Plant Beta' as const,
  location: Option.none(),
}

export const testLine1Insert = {
  id: testIds.line1,
  name: 'Test Line One' as const,
  plantId: testIds.plant1,
}

export const testLine2Insert = {
  id: testIds.line2,
  name: 'Test Line Two' as const,
  plantId: testIds.plant1,
}

export const testMachine1Insert = {
  id: testIds.machine1,
  name: 'Test Machine Alpha' as const,
  model: Option.some('Model X-100'),
  lineId: testIds.line1,
}

export const testMachine2Insert = {
  id: testIds.machine2,
  name: 'Test Machine Beta' as const,
  model: Option.none(),
  lineId: testIds.line1,
}

export const testSensor1Insert = {
  deviceId: testIds.device1,
  type: 'temperature' as SensorType,
  unit: 'celsius' as MeasurementUnit,
  machineId: testIds.machine1,
}

export const testSensor2Insert = {
  deviceId: testIds.device2,
  type: 'vibration' as SensorType,
  unit: 'mm/s' as MeasurementUnit,
  machineId: testIds.machine1,
}

// =============================================================================
// Alarm Fixtures (Insert Types)
// =============================================================================

export const testAlarm1Insert = {
  deviceId: testIds.device1,
  alarmType: 'high_temperature' as AlarmType,
  severity: 'warning' as AlarmSeverity,
  message: Option.some('Temperature exceeded threshold'),
  metadata: Option.some({ threshold: 80, actualValue: 85 }),
}

export const testAlarm2Insert = {
  deviceId: testIds.device1,
  alarmType: 'sensor_fault' as AlarmType,
  severity: 'critical' as AlarmSeverity,
  message: Option.none(),
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
  quality: 100 as QualityScore,
}

export const testSensorReading2Insert = {
  time: oneHourAgo,
  deviceId: testIds.device1,
  value: 24.2,
  quality: 95 as QualityScore,
}

export const testSensorReadingBatch = [
  { time: now, deviceId: testIds.device1, value: 25.5, quality: 100 as QualityScore },
  { time: oneHourAgo, deviceId: testIds.device1, value: 24.2, quality: 95 as QualityScore },
  { time: twoHoursAgo, deviceId: testIds.device1, value: 23.8, quality: 90 as QualityScore },
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
  model: Option.some('Model X-200'),
}

export const testSensor1Update = {
  deviceId: testIds.device1,
  type: 'humidity' as SensorType,
  unit: 'percent' as MeasurementUnit,
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

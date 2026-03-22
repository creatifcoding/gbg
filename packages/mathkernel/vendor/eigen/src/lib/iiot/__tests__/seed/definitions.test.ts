/**
 * Schema-Aware Mock Data Seeder - Definition Tests
 *
 * TDD tests for type-safe seed definitions.
 * Validates that definitions satisfy Model.insert.Type shapes.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Option } from 'effect'

// Import definitions (will be created in implementation phase)
import {
  mockPlantInserts,
  mockLineInserts,
  mockMachineInserts,
  mockSensorInserts,
  type SensorSpec,
  sensorSpecs,
  mockAlarmInserts,
} from '../../seed/mock-data'

// Import schemas for type validation
import type { PlantId, LineId, MachineId, DeviceId } from '../../schemas/identifiers'
import type { SensorType, MeasurementUnit } from '../../schemas/assets'
import type { AlarmType, AlarmSeverity } from '../../schemas/alarms'

// =============================================================================
// Feature 1.1: Asset Definitions Tests
// =============================================================================

describe('Asset Definitions', () => {
  describe('Plant Definitions', () => {
    it('should have at least one plant', () => {
      expect(mockPlantInserts.length).toBeGreaterThan(0)
    })

    it('should have branded PlantId', () => {
      mockPlantInserts.forEach((plant) => {
        expect(typeof plant.id).toBe('string')
        // Branded types are structurally strings but semantically PlantId
      })
    })

    it('should have name as NonEmptyString', () => {
      mockPlantInserts.forEach((plant) => {
        expect(typeof plant.name).toBe('string')
        expect(plant.name.length).toBeGreaterThan(0)
      })
    })

    it('should have location as Option<string>', () => {
      mockPlantInserts.forEach((plant) => {
        // Should be Option type (has _tag property)
        expect(Option.isOption(plant.location)).toBe(true)
      })
    })
  })

  describe('Line Definitions', () => {
    it('should have at least one line', () => {
      expect(mockLineInserts.length).toBeGreaterThan(0)
    })

    it('should reference existing plant IDs', () => {
      const plantIds = new Set(mockPlantInserts.map((p) => p.id))
      mockLineInserts.forEach((line) => {
        expect(plantIds.has(line.plantId)).toBe(true)
      })
    })
  })

  describe('Machine Definitions', () => {
    it('should have at least one machine', () => {
      expect(mockMachineInserts.length).toBeGreaterThan(0)
    })

    it('should reference existing line IDs', () => {
      const lineIds = new Set(mockLineInserts.map((l) => l.id))
      mockMachineInserts.forEach((machine) => {
        expect(lineIds.has(machine.lineId)).toBe(true)
      })
    })

    it('should have modelNumber as Option<string>', () => {
      mockMachineInserts.forEach((machine) => {
        expect(Option.isOption(machine.modelNumber)).toBe(true)
      })
    })
  })

  describe('Sensor Definitions', () => {
    it('should have at least one sensor', () => {
      expect(mockSensorInserts.length).toBeGreaterThan(0)
    })

    it('should reference existing machine IDs', () => {
      const machineIds = new Set(mockMachineInserts.map((m) => m.id))
      mockSensorInserts.forEach((sensor) => {
        expect(machineIds.has(sensor.machineId)).toBe(true)
      })
    })

    it('should have valid sensor types', () => {
      const validTypes: SensorType[] = [
        'temperature',
        'vibration',
        'humidity',
        'speed',
        'current',
        'pressure',
        'flow',
        'level',
      ]
      mockSensorInserts.forEach((sensor) => {
        expect(validTypes).toContain(sensor.type)
      })
    })

    it('should have valid measurement units', () => {
      const validUnits: MeasurementUnit[] = [
        'celsius',
        'fahrenheit',
        'kelvin',
        'psi',
        'bar',
        'pascal',
        'kpa',
        'mm_s',
        'in_s',
        'g',
        'l_min',
        'gpm',
        'm3_h',
        'meters',
        'feet',
        'mm',
        'inches',
        'percent',
        'rpm',
        'ampere',
        'volt',
        'watt',
        'newton',
        'nm',
        'kg',
        'count',
        'unitless',
      ]
      mockSensorInserts.forEach((sensor) => {
        expect(validUnits).toContain(sensor.unit)
      })
    })
  })
})

// =============================================================================
// Feature 1.2: Sensor Spec Definitions Tests
// =============================================================================

describe('Sensor Spec Definitions', () => {
  it('should have sensor specs array', () => {
    expect(Array.isArray(sensorSpecs)).toBe(true)
    expect(sensorSpecs.length).toBeGreaterThan(0)
  })

  it('should have branded DeviceId', () => {
    sensorSpecs.forEach((spec) => {
      expect(typeof spec.deviceId).toBe('string')
    })
  })

  it('should have valid value ranges', () => {
    sensorSpecs.forEach((spec) => {
      expect(spec.valueMin).toBeLessThan(spec.valueMax)
      expect(typeof spec.qualityThreshold).toBe('number')
      expect(spec.qualityThreshold).toBeGreaterThanOrEqual(0)
      expect(spec.qualityThreshold).toBeLessThanOrEqual(1)
    })
  })

  it('should have row count category', () => {
    sensorSpecs.forEach((spec) => {
      expect(['primary', 'secondary']).toContain(spec.rows)
    })
  })

  it('sensor specs should match mockSensorInserts devices', () => {
    const sensorDeviceIds = new Set(mockSensorInserts.map((s) => s.deviceId))
    sensorSpecs.forEach((spec) => {
      expect(sensorDeviceIds.has(spec.deviceId)).toBe(true)
    })
  })
})

// =============================================================================
// Feature 1.3: Alarm Scenario Definitions Tests
// =============================================================================

describe('Alarm Scenario Definitions', () => {
  it('should have alarm definitions array', () => {
    expect(Array.isArray(mockAlarmInserts)).toBe(true)
    expect(mockAlarmInserts.length).toBeGreaterThan(0)
  })

  it('should have branded DeviceId', () => {
    mockAlarmInserts.forEach((alarm) => {
      expect(typeof alarm.deviceId).toBe('string')
    })
  })

  it('should have valid alarm types', () => {
    const validTypes: AlarmType[] = [
      'high_temperature',
      'low_temperature',
      'high_vibration',
      'overcurrent',
      'undercurrent',
      'high_pressure',
      'low_pressure',
      'high_humidity',
      'low_humidity',
      'speed_deviation',
      'communication_loss',
      'sensor_fault',
      'maintenance_due',
      'custom',
    ]
    mockAlarmInserts.forEach((alarm) => {
      expect(validTypes).toContain(alarm.alarmType)
    })
  })

  it('should have valid severity levels', () => {
    const validSeverities: AlarmSeverity[] = ['info', 'warning', 'critical', 'emergency']
    mockAlarmInserts.forEach((alarm) => {
      expect(validSeverities).toContain(alarm.severity)
    })
  })

  it('should have message as Option<string>', () => {
    mockAlarmInserts.forEach((alarm) => {
      expect(Option.isOption(alarm.message)).toBe(true)
    })
  })

  it('should have metadata as Option<Record>', () => {
    mockAlarmInserts.forEach((alarm) => {
      expect(Option.isOption(alarm.metadata)).toBe(true)
    })
  })

  it('should reference existing sensor device IDs', () => {
    const sensorDeviceIds = new Set(mockSensorInserts.map((s) => s.deviceId))
    mockAlarmInserts.forEach((alarm) => {
      expect(sensorDeviceIds.has(alarm.deviceId)).toBe(true)
    })
  })
})

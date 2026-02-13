/**
 * IIoT Schemas - BDD Tests
 *
 * Feature: IIoT Domain Type Validation
 *   As an IIoT system developer
 *   I want schemas that validate domain types at runtime
 *   So that invalid data is rejected early
 */

import { describe, it, expect } from 'vitest'
import { Schema, Option } from 'effect'
import {
  PlantId as LegacyPlantId,
  DeviceId,
  AlarmId,
} from '../schemas/identifiers'
import {
  Plant,
  makePlantId,
  Machine,
  makeMachineId,
  Sensor,
  makeSensorId,
  SensorType,
} from '../schemas/assets'
import { HierarchyPath, PathSegment } from '../schemas/hierarchy'
import {
  QualityScore,
  TimeBucket,
} from '../schemas/readings'
import {
  AlarmSeverity,
  AlarmType,
} from '../schemas/alarms'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create encoded HierarchyPath data for Plant level.
 * The encoded form requires segments in their encoded shape.
 */
const createEncodedPlantHierarchyPath = () => ({
  _tag: 'HierarchyPath' as const,
  segments: [
    { _tag: 'PathSegment' as const, level: 'enterprise', id: 'ENT-acme' },
    { _tag: 'PathSegment' as const, level: 'site', id: 'SIT-chicago' },
    { _tag: 'PathSegment' as const, level: 'plant', id: 'PLT-main' },
  ],
  materialized: '/ENT-acme/SIT-chicago/PLT-main',
  depth: 3,
})

/**
 * Create encoded HierarchyPath data for Machine level.
 */
const createEncodedMachineHierarchyPath = (machineSlug: string) => ({
  _tag: 'HierarchyPath' as const,
  segments: [
    { _tag: 'PathSegment' as const, level: 'enterprise', id: 'ENT-acme' },
    { _tag: 'PathSegment' as const, level: 'site', id: 'SIT-chicago' },
    { _tag: 'PathSegment' as const, level: 'plant', id: 'PLT-main' },
    { _tag: 'PathSegment' as const, level: 'line', id: 'LIN-assembly' },
    { _tag: 'PathSegment' as const, level: 'machine', id: `MCH-${machineSlug}` },
  ],
  materialized: `/ENT-acme/SIT-chicago/PLT-main/LIN-assembly/MCH-${machineSlug}`,
  depth: 5,
})

/**
 * Create encoded HierarchyPath data for Sensor level.
 */
const createEncodedSensorHierarchyPath = (sensorSlug: string) => ({
  _tag: 'HierarchyPath' as const,
  segments: [
    { _tag: 'PathSegment' as const, level: 'enterprise', id: 'ENT-acme' },
    { _tag: 'PathSegment' as const, level: 'site', id: 'SIT-chicago' },
    { _tag: 'PathSegment' as const, level: 'plant', id: 'PLT-main' },
    { _tag: 'PathSegment' as const, level: 'line', id: 'LIN-assembly' },
    { _tag: 'PathSegment' as const, level: 'machine', id: 'MCH-robot-01' },
    { _tag: 'PathSegment' as const, level: 'sensor', id: `SNS-${sensorSlug}` },
  ],
  materialized: `/ENT-acme/SIT-chicago/PLT-main/LIN-assembly/MCH-robot-01/SNS-${sensorSlug}`,
  depth: 6,
})

// ISO timestamp for test data
const TEST_TIMESTAMP = '2026-01-15T10:30:00.000Z'

// =============================================================================
// Feature: Branded Identifiers
// =============================================================================

describe('Feature: Branded Identifiers', () => {
  describe('Scenario: Valid identifier encoding', () => {
    it('Given a valid string, When encoding as PlantId, Then it should succeed', () => {
      // Using legacy PlantId (simple brand without pattern validation)
      const result = Schema.decodeUnknownSync(LegacyPlantId)('PLANT-001')
      expect(result).toBe('PLANT-001')
    })

    it('Given a valid string, When encoding as DeviceId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(DeviceId)('TMP-001')
      expect(result).toBe('TMP-001')
    })

    it('Given a valid string, When encoding as AlarmId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(AlarmId)('ALM-001')
      expect(result).toBe('ALM-001')
    })
  })

  describe('Scenario: Invalid identifier encoding', () => {
    it('Given a number, When encoding as PlantId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(LegacyPlantId)(123)).toThrow()
    })

    it('Given null, When encoding as DeviceId, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(DeviceId)(null)).toThrow()
    })
  })
})

// =============================================================================
// Feature: Asset Hierarchy Schemas
// =============================================================================

describe('Feature: Asset Hierarchy Schemas', () => {
  describe('Scenario: Valid Plant encoding', () => {
    it('Given valid plant data, When decoding, Then it should produce a Plant', () => {
      // ENCODED input: strings for timestamps, omit optional fields
      const data = {
        _tag: 'Plant' as const,
        id: 'PLT-chicago-assembly',
        name: 'Chicago Assembly',
        status: 'operational' as const,
        timezone: 'America/Chicago',
        hierarchyPath: createEncodedPlantHierarchyPath(),
        enterpriseId: 'ENT-acme',
        siteId: 'SIT-chicago',
        createdAt: TEST_TIMESTAMP,
      }

      const result = Schema.decodeUnknownSync(Plant)(data)
      expect(result._tag).toBe('Plant')
      expect(result.name).toBe('Chicago Assembly')
    })
  })

  describe('Scenario: Valid Machine encoding', () => {
    it('Given machine data with model, When decoding, Then model should be optional', () => {
      const withModel = {
        _tag: 'Machine' as const,
        id: 'MCH-welding-robot-001',
        name: 'Welding Robot',
        status: 'commissioned' as const,
        // Required parent IDs for Machine
        enterpriseId: 'ENT-acme',
        siteId: 'SIT-chicago',
        plantId: 'PLT-main',
        lineId: 'LIN-assembly',
        // Hierarchy and timestamps (encoded as string)
        hierarchyPath: createEncodedMachineHierarchyPath('welding-robot-001'),
        createdAt: TEST_TIMESTAMP,
        // Machine-specific fields
        machineType: 'Welding Robot',
        modelNumber: 'FANUC R-2000',
      }

      const withoutModel = {
        _tag: 'Machine' as const,
        id: 'MCH-press-001',
        name: 'Press',
        status: 'commissioned' as const,
        // Required parent IDs
        enterpriseId: 'ENT-acme',
        siteId: 'SIT-chicago',
        plantId: 'PLT-main',
        lineId: 'LIN-assembly',
        // Hierarchy and timestamps
        hierarchyPath: createEncodedMachineHierarchyPath('press-001'),
        createdAt: TEST_TIMESTAMP,
        // Machine-specific fields
        machineType: 'Hydraulic Press',
        // modelNumber omitted
      }

      // modelNumber is stored as Option on the decoded type
      expect(Option.getOrNull(Schema.decodeUnknownSync(Machine)(withModel).modelNumber)).toBe('FANUC R-2000')
      expect(Option.isNone(Schema.decodeUnknownSync(Machine)(withoutModel).modelNumber)).toBe(true)
    })
  })

  describe('Scenario: Valid Sensor encoding', () => {
    it('Given sensor with valid type and unit, When decoding, Then it should succeed', () => {
      const data = {
        _tag: 'Sensor' as const,
        id: 'SNS-temp-001',
        name: 'Temperature Sensor 001',
        status: 'active' as const,
        // Hierarchy and timestamps (encoded as string)
        hierarchyPath: createEncodedSensorHierarchyPath('temp-001'),
        createdAt: TEST_TIMESTAMP,
        // Sensor-specific fields
        sensorType: 'temperature' as const,
        unit: 'celsius' as const,
      }

      const result = Schema.decodeUnknownSync(Sensor)(data)
      expect(result.sensorType).toBe('temperature')
      expect(result.unit).toBe('celsius')
    })
  })

  describe('Scenario: Sensor type enum validation', () => {
    it('Given valid sensor types, When decoding, Then all should succeed', () => {
      const validTypes = ['temperature', 'vibration', 'humidity', 'speed', 'current', 'pressure', 'flow', 'level']

      validTypes.forEach((type) => {
        expect(Schema.decodeUnknownSync(SensorType)(type)).toBe(type)
      })
    })

    it('Given invalid sensor type, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(SensorType)('invalid_type')).toThrow()
    })
  })
})

// =============================================================================
// Feature: Sensor Reading Schemas
// =============================================================================

describe('Feature: Sensor Reading Schemas', () => {
  describe('Scenario: Valid QualityScore', () => {
    it('Given value in range 0-100, When decoding, Then it should succeed', () => {
      expect(Schema.decodeUnknownSync(QualityScore)(0)).toBe(0)
      expect(Schema.decodeUnknownSync(QualityScore)(50)).toBe(50)
      expect(Schema.decodeUnknownSync(QualityScore)(100)).toBe(100)
    })

    it('Given value outside range, When decoding, Then it should fail', () => {
      expect(() => Schema.decodeUnknownSync(QualityScore)(-1)).toThrow()
      expect(() => Schema.decodeUnknownSync(QualityScore)(101)).toThrow()
    })
  })

  describe('Scenario: TimeBucket literals', () => {
    it('Given valid bucket names, When decoding, Then all should succeed', () => {
      const validBuckets = ['1min', '5min', '15min', '1hour', '1day']

      validBuckets.forEach((bucket) => {
        expect(Schema.decodeUnknownSync(TimeBucket)(bucket)).toBe(bucket)
      })
    })
  })
})

// =============================================================================
// Feature: Alarm Schemas
// =============================================================================

describe('Feature: Alarm Schemas', () => {
  describe('Scenario: AlarmSeverity levels', () => {
    it('Given valid severity levels, When decoding, Then all should succeed', () => {
      const validSeverities = ['info', 'warning', 'critical', 'emergency']

      validSeverities.forEach((severity) => {
        expect(Schema.decodeUnknownSync(AlarmSeverity)(severity)).toBe(severity)
      })
    })
  })

  describe('Scenario: AlarmType categories', () => {
    it('Given valid alarm types, When decoding, Then all should succeed', () => {
      const validTypes = [
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

      validTypes.forEach((type) => {
        expect(Schema.decodeUnknownSync(AlarmType)(type)).toBe(type)
      })
    })
  })
})

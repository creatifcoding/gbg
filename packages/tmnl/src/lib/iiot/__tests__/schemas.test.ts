/**
 * IIoT Schemas - BDD Tests
 *
 * Feature: IIoT Domain Type Validation
 *   As an IIoT system developer
 *   I want schemas that validate domain types at runtime
 *   So that invalid data is rejected early
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  PlantId,
  DeviceId,
  AlarmId,
} from '../schemas/identifiers'
import {
  Plant,
  Machine,
  Sensor,
  SensorType,
} from '../schemas/assets'
import {
  QualityScore,
  TimeBucket,
} from '../schemas/readings'
import {
  AlarmSeverity,
  AlarmType,
} from '../schemas/alarms'

// =============================================================================
// Feature: Branded Identifiers
// =============================================================================

describe('Feature: Branded Identifiers', () => {
  describe('Scenario: Valid identifier encoding', () => {
    it('Given a valid string, When encoding as PlantId, Then it should succeed', () => {
      const result = Schema.decodeUnknownSync(PlantId)('PLANT-001')
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
      expect(() => Schema.decodeUnknownSync(PlantId)(123)).toThrow()
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
      const data = {
        _tag: 'Plant' as const,
        id: 'PLANT-001',
        name: 'Chicago Assembly',
        location: 'Chicago, IL',
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
        id: 'MCH-001',
        name: 'Welding Robot',
        lineId: 'LINE-001',
        model: 'FANUC R-2000',
      }

      const withoutModel = {
        _tag: 'Machine' as const,
        id: 'MCH-002',
        name: 'Press',
        lineId: 'LINE-001',
      }

      expect(Schema.decodeUnknownSync(Machine)(withModel).model).toBe('FANUC R-2000')
      expect(Schema.decodeUnknownSync(Machine)(withoutModel).model).toBeUndefined()
    })
  })

  describe('Scenario: Valid Sensor encoding', () => {
    it('Given sensor with valid type and unit, When decoding, Then it should succeed', () => {
      const data = {
        _tag: 'Sensor' as const,
        deviceId: 'TMP-001',
        machineId: 'MCH-001',
        type: 'temperature',
        unit: 'celsius',
      }

      const result = Schema.decodeUnknownSync(Sensor)(data)
      expect(result.type).toBe('temperature')
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

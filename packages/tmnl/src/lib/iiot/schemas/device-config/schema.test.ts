/**
 * DeviceConfig Schema Tests
 *
 * Device configuration management with versioning and audit trail.
 * Supports FDA 21 CFR Part 11 compliance through approval workflows.
 */

import { describe, it, expect } from 'vitest'
import { DateTime, Option, Schema } from 'effect'
import {
  DeviceConfigId,
  makeDeviceConfigId,
  ConfigVersion,
  ConfigStatus,
  DeviceConfig,
  CreateConfigParams,
  UpdateConfigParams,
  ActivateConfigParams,
  ApproveConfigParams,
  RejectConfigParams,
} from './schema'

// =============================================================================
// DeviceConfigId Tests
// =============================================================================

describe('DeviceConfigId', () => {
  it('should validate correct CFG- prefixed IDs', () => {
    const validIds = ['CFG-temp-sensor-01', 'CFG-motor-config-v1', 'CFG-pump-main']

    for (const id of validIds) {
      const result = Schema.decodeSync(DeviceConfigId)(id)
      expect(result).toBe(id)
    }
  })

  it('should reject IDs without CFG- prefix', () => {
    const invalidIds = ['SNS-config-01', 'DEV-config', 'config-01', 'cfg-lowercase']

    for (const id of invalidIds) {
      expect(() => Schema.decodeSync(DeviceConfigId)(id)).toThrow()
    }
  })

  it('should reject empty or malformed slugs', () => {
    const invalidIds = ['CFG-', 'CFG-@invalid', 'CFG-has space']

    for (const id of invalidIds) {
      expect(() => Schema.decodeSync(DeviceConfigId)(id)).toThrow()
    }
  })
})

describe('makeDeviceConfigId', () => {
  it('should create DeviceConfigId with CFG- prefix', () => {
    const id = makeDeviceConfigId('temp-config-01')
    expect(id).toBe('CFG-temp-config-01')
  })

  it('should handle alphanumeric slugs with hyphens', () => {
    expect(makeDeviceConfigId('motor-settings-v2')).toBe('CFG-motor-settings-v2')
    expect(makeDeviceConfigId('sensor42')).toBe('CFG-sensor42')
  })
})

// =============================================================================
// ConfigVersion Tests
// =============================================================================

describe('ConfigVersion', () => {
  it('should accept positive integers', () => {
    const validVersions = [1, 2, 10, 100, 999]

    for (const version of validVersions) {
      const result = Schema.decodeSync(ConfigVersion)(version)
      expect(result).toBe(version)
    }
  })

  it('should reject zero', () => {
    expect(() => Schema.decodeSync(ConfigVersion)(0)).toThrow()
  })

  it('should reject negative numbers', () => {
    expect(() => Schema.decodeSync(ConfigVersion)(-1)).toThrow()
    expect(() => Schema.decodeSync(ConfigVersion)(-100)).toThrow()
  })

  it('should reject non-integers', () => {
    expect(() => Schema.decodeSync(ConfigVersion)(1.5)).toThrow()
    expect(() => Schema.decodeSync(ConfigVersion)(2.99)).toThrow()
  })
})

// =============================================================================
// ConfigStatus Tests
// =============================================================================

describe('ConfigStatus', () => {
  it('should accept all valid status values', () => {
    const validStatuses = ['draft', 'active', 'archived', 'rejected']

    for (const status of validStatuses) {
      const result = Schema.decodeSync(ConfigStatus)(status)
      expect(result).toBe(status)
    }
  })

  it('should reject invalid status values', () => {
    expect(() => Schema.decodeSync(ConfigStatus)('pending')).toThrow()
    expect(() => Schema.decodeSync(ConfigStatus)('deleted')).toThrow()
    expect(() => Schema.decodeSync(ConfigStatus)('invalid')).toThrow()
  })
})

// =============================================================================
// DeviceConfig Entity Tests
// =============================================================================

describe('DeviceConfig', () => {
  const createValidConfig = () =>
    new DeviceConfig({
      id: makeDeviceConfigId('temp-sensor-01-v1'),
      targetType: 'sensor',
      targetId: 'SNS-temp-01',
      version: 1 as Schema.Schema.Type<typeof ConfigVersion>,
      status: 'active',
      config: { sampleRate: 1000, precision: 2 },
      sampleRateMs: Option.some(1000),
      thresholds: Option.some({
        low: Option.some(10),
        high: Option.some(85),
        criticalLow: Option.some(5),
        criticalHigh: Option.some(95),
      }),
      createdBy: 'operator-001',
      createdAt: DateTime.unsafeNow(),
      updatedBy: Option.none(),
      updatedAt: Option.none(),
      approvedBy: Option.some('supervisor-001'),
      approvedAt: Option.some(DateTime.unsafeNow()),
      changeReason: Option.some('Initial configuration'),
      previousVersionId: Option.none(),
    })

  it('should create a valid DeviceConfig instance', () => {
    const config = createValidConfig()

    expect(config._tag).toBe('DeviceConfig')
    expect(config.id).toBe('CFG-temp-sensor-01-v1')
    expect(config.targetType).toBe('sensor')
    expect(config.version).toBe(1)
    expect(config.status).toBe('active')
  })

  describe('isActive', () => {
    it('should return true for active status', () => {
      const config = createValidConfig()
      expect(config.isActive()).toBe(true)
    })

    it('should return false for non-active status', () => {
      const draftConfig = new DeviceConfig({
        ...createValidConfig(),
        status: 'draft',
      })
      expect(draftConfig.isActive()).toBe(false)

      const archivedConfig = new DeviceConfig({
        ...createValidConfig(),
        status: 'archived',
      })
      expect(archivedConfig.isActive()).toBe(false)

      const rejectedConfig = new DeviceConfig({
        ...createValidConfig(),
        status: 'rejected',
      })
      expect(rejectedConfig.isActive()).toBe(false)
    })
  })

  describe('requiresApproval', () => {
    it('should return true for draft status', () => {
      const draftConfig = new DeviceConfig({
        ...createValidConfig(),
        status: 'draft',
      })
      expect(draftConfig.requiresApproval()).toBe(true)
    })

    it('should return false for non-draft statuses', () => {
      const activeConfig = createValidConfig()
      expect(activeConfig.requiresApproval()).toBe(false)

      const archivedConfig = new DeviceConfig({
        ...createValidConfig(),
        status: 'archived',
      })
      expect(archivedConfig.requiresApproval()).toBe(false)
    })
  })

  it('should support device target type', () => {
    const deviceConfig = new DeviceConfig({
      ...createValidConfig(),
      targetType: 'device',
      targetId: 'DEV-motor-01',
    })

    expect(deviceConfig.targetType).toBe('device')
    expect(deviceConfig.targetId).toBe('DEV-motor-01')
  })

  it('should handle optional fields as Option', () => {
    const minimalConfig = new DeviceConfig({
      id: makeDeviceConfigId('minimal-config'),
      targetType: 'sensor',
      targetId: 'SNS-test-01',
      version: 1 as Schema.Schema.Type<typeof ConfigVersion>,
      status: 'draft',
      config: {},
      sampleRateMs: Option.none(),
      thresholds: Option.none(),
      createdBy: 'system',
      createdAt: DateTime.unsafeNow(),
      updatedBy: Option.none(),
      updatedAt: Option.none(),
      approvedBy: Option.none(),
      approvedAt: Option.none(),
      changeReason: Option.none(),
      previousVersionId: Option.none(),
    })

    expect(Option.isNone(minimalConfig.sampleRateMs)).toBe(true)
    expect(Option.isNone(minimalConfig.thresholds)).toBe(true)
    expect(Option.isNone(minimalConfig.approvedBy)).toBe(true)
    expect(Option.isNone(minimalConfig.previousVersionId)).toBe(true)
  })

  it('should track version history via previousVersionId', () => {
    const v1Config = createValidConfig()
    const v2Config = new DeviceConfig({
      ...createValidConfig(),
      id: makeDeviceConfigId('temp-sensor-01-v2'),
      version: 2 as Schema.Schema.Type<typeof ConfigVersion>,
      previousVersionId: Option.some(v1Config.id),
      changeReason: Option.some('Updated thresholds'),
    })

    expect(v2Config.version).toBe(2)
    expect(Option.getOrThrow(v2Config.previousVersionId)).toBe('CFG-temp-sensor-01-v1')
  })
})

// =============================================================================
// CreateConfigParams Tests
// =============================================================================

describe('CreateConfigParams', () => {
  it('should validate valid create params', () => {
    const params = {
      targetType: 'sensor',
      targetId: 'SNS-temp-01',
      config: { sampleRate: 1000 },
      createdBy: 'operator-001',
    }

    const result = Schema.decodeSync(CreateConfigParams)(params)
    expect(result.targetType).toBe('sensor')
    expect(result.targetId).toBe('SNS-temp-01')
    expect(result.createdBy).toBe('operator-001')
  })

  it('should accept device target type', () => {
    const params = {
      targetType: 'device',
      targetId: 'DEV-motor-01',
      config: { controlMode: 'auto' },
      createdBy: 'engineer-001',
    }

    const result = Schema.decodeSync(CreateConfigParams)(params)
    expect(result.targetType).toBe('device')
  })

  it('should reject invalid target types', () => {
    const params = {
      targetType: 'machine',
      targetId: 'MCH-test',
      config: {},
      createdBy: 'test',
    }

    expect(() => Schema.decodeSync(CreateConfigParams)(params)).toThrow()
  })
})

// =============================================================================
// UpdateConfigParams Tests
// =============================================================================

describe('UpdateConfigParams', () => {
  it('should validate valid update params', () => {
    const params = {
      id: 'CFG-temp-sensor-01-v1',
      config: { sampleRate: 2000 },
      changeReason: 'Increased sample rate for better accuracy',
      updatedBy: 'engineer-001',
    }

    const result = Schema.decodeSync(UpdateConfigParams)(params)
    expect(result.id).toBe('CFG-temp-sensor-01-v1')
    expect(result.changeReason).toBe('Increased sample rate for better accuracy')
  })

  it('should reject invalid config IDs', () => {
    const params = {
      id: 'invalid-id',
      config: {},
      changeReason: 'test',
      updatedBy: 'test',
    }

    expect(() => Schema.decodeSync(UpdateConfigParams)(params)).toThrow()
  })
})

// =============================================================================
// ActivateConfigParams Tests
// =============================================================================

describe('ActivateConfigParams', () => {
  it('should validate valid activate params', () => {
    const params = {
      id: 'CFG-temp-sensor-01-v2',
      activatedBy: 'supervisor-001',
    }

    const result = Schema.decodeSync(ActivateConfigParams)(params)
    expect(result.id).toBe('CFG-temp-sensor-01-v2')
    expect(result.activatedBy).toBe('supervisor-001')
  })
})

// =============================================================================
// ApproveConfigParams Tests
// =============================================================================

describe('ApproveConfigParams', () => {
  it('should validate valid approve params', () => {
    const params = {
      id: 'CFG-temp-sensor-01-v1',
      approvedBy: 'qa-001',
    }

    const result = Schema.decodeSync(ApproveConfigParams)(params)
    expect(result.id).toBe('CFG-temp-sensor-01-v1')
    expect(result.approvedBy).toBe('qa-001')
  })

  it('should accept optional notes', () => {
    const params = {
      id: 'CFG-temp-sensor-01-v1',
      approvedBy: 'qa-001',
      notes: 'Reviewed and approved per SOP-123',
    }

    const result = Schema.decodeSync(ApproveConfigParams)(params)
    expect(result.notes).toBe('Reviewed and approved per SOP-123')
  })
})

// =============================================================================
// RejectConfigParams Tests
// =============================================================================

describe('RejectConfigParams', () => {
  it('should validate valid reject params', () => {
    const params = {
      id: 'CFG-temp-sensor-01-v1',
      rejectedBy: 'qa-001',
      reason: 'Threshold values exceed safe operating limits',
    }

    const result = Schema.decodeSync(RejectConfigParams)(params)
    expect(result.id).toBe('CFG-temp-sensor-01-v1')
    expect(result.reason).toBe('Threshold values exceed safe operating limits')
  })

  it('should require a non-empty reason', () => {
    const params = {
      id: 'CFG-temp-sensor-01-v1',
      rejectedBy: 'qa-001',
      reason: '',
    }

    expect(() => Schema.decodeSync(RejectConfigParams)(params)).toThrow()
  })
})

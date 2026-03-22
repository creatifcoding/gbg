/**
 * DeviceConfig Audit Event Tests
 *
 * Audit trail events for configuration changes.
 * Supports FDA 21 CFR Part 11 electronic records compliance.
 */

import { describe, it, expect } from 'vitest'
import { DateTime, Option, Schema } from 'effect'
import {
  ConfigCreated,
  ConfigUpdated,
  ConfigActivated,
  ConfigArchived,
  ConfigApproved,
  ConfigRejected,
} from './audit'
import { makeDeviceConfigId, ConfigVersion } from './schema'

// =============================================================================
// ConfigCreated Event Tests
// =============================================================================

describe('ConfigCreated', () => {
  it('should create a valid ConfigCreated event', () => {
    const event = new ConfigCreated({
      configId: makeDeviceConfigId('temp-sensor-01-v1'),
      targetType: 'sensor',
      targetId: 'SNS-temp-01',
      version: 1 as Schema.Schema.Type<typeof ConfigVersion>,
      config: { sampleRate: 1000 },
      createdBy: 'operator-001',
      createdAt: DateTime.unsafeNow(),
    })

    expect(event._tag).toBe('ConfigCreated')
    expect(event.configId).toBe('CFG-temp-sensor-01-v1')
    expect(event.targetType).toBe('sensor')
    expect(event.version).toBe(1)
  })
})

// =============================================================================
// ConfigUpdated Event Tests
// =============================================================================

describe('ConfigUpdated', () => {
  it('should create a valid ConfigUpdated event', () => {
    const event = new ConfigUpdated({
      configId: makeDeviceConfigId('temp-sensor-01-v2'),
      previousVersionId: makeDeviceConfigId('temp-sensor-01-v1'),
      version: 2 as Schema.Schema.Type<typeof ConfigVersion>,
      config: { sampleRate: 2000 },
      changeReason: 'Increased sample rate',
      updatedBy: 'engineer-001',
      updatedAt: DateTime.unsafeNow(),
    })

    expect(event._tag).toBe('ConfigUpdated')
    expect(event.version).toBe(2)
    expect(event.previousVersionId).toBe('CFG-temp-sensor-01-v1')
    expect(event.changeReason).toBe('Increased sample rate')
  })
})

// =============================================================================
// ConfigActivated Event Tests
// =============================================================================

describe('ConfigActivated', () => {
  it('should create a valid ConfigActivated event', () => {
    const event = new ConfigActivated({
      configId: makeDeviceConfigId('temp-sensor-01-v2'),
      previousActiveId: Option.some(makeDeviceConfigId('temp-sensor-01-v1')),
      activatedBy: 'supervisor-001',
      activatedAt: DateTime.unsafeNow(),
    })

    expect(event._tag).toBe('ConfigActivated')
    expect(event.configId).toBe('CFG-temp-sensor-01-v2')
    expect(Option.getOrThrow(event.previousActiveId)).toBe('CFG-temp-sensor-01-v1')
  })

  it('should handle activation with no previous active config', () => {
    const event = new ConfigActivated({
      configId: makeDeviceConfigId('temp-sensor-01-v1'),
      previousActiveId: Option.none(),
      activatedBy: 'supervisor-001',
      activatedAt: DateTime.unsafeNow(),
    })

    expect(Option.isNone(event.previousActiveId)).toBe(true)
  })
})

// =============================================================================
// ConfigArchived Event Tests
// =============================================================================

describe('ConfigArchived', () => {
  it('should create a valid ConfigArchived event', () => {
    const event = new ConfigArchived({
      configId: makeDeviceConfigId('temp-sensor-01-v1'),
      archivedBy: 'system',
      archivedAt: DateTime.unsafeNow(),
      reason: 'Superseded by v2',
    })

    expect(event._tag).toBe('ConfigArchived')
    expect(event.configId).toBe('CFG-temp-sensor-01-v1')
    expect(event.reason).toBe('Superseded by v2')
  })
})

// =============================================================================
// ConfigApproved Event Tests
// =============================================================================

describe('ConfigApproved', () => {
  it('should create a valid ConfigApproved event', () => {
    const event = new ConfigApproved({
      configId: makeDeviceConfigId('temp-sensor-01-v1'),
      approvedBy: 'qa-001',
      approvedAt: DateTime.unsafeNow(),
      notes: Option.some('Reviewed per SOP-123'),
    })

    expect(event._tag).toBe('ConfigApproved')
    expect(event.configId).toBe('CFG-temp-sensor-01-v1')
    expect(event.approvedBy).toBe('qa-001')
    expect(Option.getOrThrow(event.notes)).toBe('Reviewed per SOP-123')
  })

  it('should handle approval without notes', () => {
    const event = new ConfigApproved({
      configId: makeDeviceConfigId('temp-sensor-01-v1'),
      approvedBy: 'qa-001',
      approvedAt: DateTime.unsafeNow(),
      notes: Option.none(),
    })

    expect(Option.isNone(event.notes)).toBe(true)
  })
})

// =============================================================================
// ConfigRejected Event Tests
// =============================================================================

describe('ConfigRejected', () => {
  it('should create a valid ConfigRejected event', () => {
    const event = new ConfigRejected({
      configId: makeDeviceConfigId('temp-sensor-01-v1'),
      rejectedBy: 'qa-001',
      rejectedAt: DateTime.unsafeNow(),
      reason: 'Threshold values exceed safe operating limits',
    })

    expect(event._tag).toBe('ConfigRejected')
    expect(event.configId).toBe('CFG-temp-sensor-01-v1')
    expect(event.rejectedBy).toBe('qa-001')
    expect(event.reason).toBe('Threshold values exceed safe operating limits')
  })
})

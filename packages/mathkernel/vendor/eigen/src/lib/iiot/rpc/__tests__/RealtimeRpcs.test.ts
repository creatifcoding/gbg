/**
 * RealtimeRpcs - Test Suite
 *
 * TDD tests for the real-time streaming RPC definitions.
 * Validates schema roundtrips, RPC group composition, and error handling.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Schema, DateTime } from 'effect'
import {
  RealtimeError,
  AlarmEvent,
  EquipmentStateChange,
  CacheInvalidation,
  SubscribeReadings,
  SubscribeAlarms,
  SubscribeEquipmentState,
  SubscribeInvalidations,
  RealtimeRpcs,
} from '../RealtimeRpcs'
import { DeviceId, PlantId, AlarmId } from '../../schemas/identifiers'
import { AlarmSeverity } from '../../schemas/alarms'

// =============================================================================
// Test Helpers
// =============================================================================

const testDeviceId = 'DEV-test-001' as DeviceId
const testPlantId = 'PLANT-A' as PlantId
const testAlarmId = 'ALM-test-001' as AlarmId
const testSeverity = 'critical' as AlarmSeverity
/** ISO string for decodeUnknownSync (encoded representation of DateTimeUtc) */
const testTimestampStr = '2026-02-09T08:00:00.000Z'
/** DateTime.Utc for constructor-based roundtrip tests */
const testTimestamp = DateTime.unsafeNow()

// =============================================================================
// RealtimeError
// =============================================================================

describe('RealtimeError', () => {
  it('should decode a valid RealtimeError', () => {
    const input = {
      _tag: 'RealtimeError',
      message: 'Subscription failed',
      code: 'SUBSCRIPTION_FAILED',
    }
    const decoded = Schema.decodeUnknownSync(RealtimeError)(input)
    expect(decoded._tag).toBe('RealtimeError')
    expect(decoded.message).toBe('Subscription failed')
    expect(decoded.code).toBe('SUBSCRIPTION_FAILED')
  })

  it.each([
    'SUBSCRIPTION_FAILED',
    'INVALID_FILTER',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
  ] as const)('should accept code: %s', (code) => {
    const input = {
      _tag: 'RealtimeError',
      message: `Error: ${code}`,
      code,
    }
    const decoded = Schema.decodeUnknownSync(RealtimeError)(input)
    expect(decoded.code).toBe(code)
  })

  it('should reject invalid code', () => {
    const input = {
      _tag: 'RealtimeError',
      message: 'bad',
      code: 'UNKNOWN_CODE',
    }
    expect(() => Schema.decodeUnknownSync(RealtimeError)(input)).toThrow()
  })

  it('should roundtrip encode/decode', () => {
    const error = new RealtimeError({
      message: 'Rate limited',
      code: 'RATE_LIMITED',
    })
    const encoded = Schema.encodeSync(RealtimeError)(error)
    const decoded = Schema.decodeUnknownSync(RealtimeError)(encoded)
    expect(decoded.message).toBe('Rate limited')
    expect(decoded.code).toBe('RATE_LIMITED')
  })
})

// =============================================================================
// AlarmEvent
// =============================================================================

describe('AlarmEvent', () => {
  const allEventTypes = [
    'triggered', 'acknowledged', 'cleared', 'escalated',
    'shelved', 'unshelved', 'suppressed', 'out_of_service',
    'returned_to_service', 'config_changed',
  ] as const

  it('should decode a valid AlarmEvent', () => {
    const input = {
      _tag: 'AlarmEvent',
      eventType: 'triggered',
      alarmId: testAlarmId,
      deviceId: testDeviceId,
      severity: testSeverity,
      timestamp: testTimestamp,
    }
    const decoded = Schema.decodeUnknownSync(AlarmEvent)(input)
    expect(decoded._tag).toBe('AlarmEvent')
    expect(decoded.eventType).toBe('triggered')
    expect(decoded.alarmId).toBe(testAlarmId)
    expect(decoded.deviceId).toBe(testDeviceId)
  })

  it.each(allEventTypes)('should accept eventType: %s', (eventType) => {
    const input = {
      _tag: 'AlarmEvent',
      eventType,
      alarmId: testAlarmId,
      deviceId: testDeviceId,
      severity: testSeverity,
      timestamp: testTimestamp,
    }
    const decoded = Schema.decodeUnknownSync(AlarmEvent)(input)
    expect(decoded.eventType).toBe(eventType)
  })

  it('should reject invalid eventType', () => {
    const input = {
      _tag: 'AlarmEvent',
      eventType: 'invalid_type',
      alarmId: testAlarmId,
      deviceId: testDeviceId,
      severity: testSeverity,
      timestamp: testTimestamp,
    }
    expect(() => Schema.decodeUnknownSync(AlarmEvent)(input)).toThrow()
  })

  it('should accept optional detail field', () => {
    const input = {
      _tag: 'AlarmEvent',
      eventType: 'escalated',
      alarmId: testAlarmId,
      deviceId: testDeviceId,
      severity: testSeverity,
      timestamp: testTimestamp,
      detail: { reason: 'timeout', level: 3 },
    }
    const decoded = Schema.decodeUnknownSync(AlarmEvent)(input)
    expect(decoded.detail).toEqual({ reason: 'timeout', level: 3 })
  })

  it('should roundtrip encode/decode', () => {
    const event = new AlarmEvent({
      eventType: 'acknowledged',
      alarmId: testAlarmId,
      deviceId: testDeviceId,
      severity: testSeverity,
      timestamp: testTimestamp,
    })
    const encoded = Schema.encodeSync(AlarmEvent)(event)
    const decoded = Schema.decodeUnknownSync(AlarmEvent)(encoded)
    expect(decoded.eventType).toBe('acknowledged')
    expect(decoded.alarmId).toBe(testAlarmId)
  })
})

// =============================================================================
// EquipmentStateChange
// =============================================================================

describe('EquipmentStateChange', () => {
  it('should decode a valid EquipmentStateChange', () => {
    const input = {
      _tag: 'EquipmentStateChange',
      entityType: 'Machine',
      entityId: 'MCH-001',
      previousState: 'running',
      currentState: 'faulted',
      changedAt: testTimestamp,
    }
    const decoded = Schema.decodeUnknownSync(EquipmentStateChange)(input)
    expect(decoded._tag).toBe('EquipmentStateChange')
    expect(decoded.entityType).toBe('Machine')
    expect(decoded.previousState).toBe('running')
    expect(decoded.currentState).toBe('faulted')
  })

  it('should accept optional changedBy field', () => {
    const input = {
      _tag: 'EquipmentStateChange',
      entityType: 'Device',
      entityId: 'DEV-001',
      previousState: 'online',
      currentState: 'offline',
      changedAt: testTimestamp,
      changedBy: 'operator-john',
    }
    const decoded = Schema.decodeUnknownSync(EquipmentStateChange)(input)
    expect(decoded.changedBy).toBe('operator-john')
  })

  it('should roundtrip encode/decode', () => {
    const change = new EquipmentStateChange({
      entityType: 'Line',
      entityId: 'LINE-001',
      previousState: 'idle',
      currentState: 'running',
      changedAt: testTimestamp,
    })
    const encoded = Schema.encodeSync(EquipmentStateChange)(change)
    const decoded = Schema.decodeUnknownSync(EquipmentStateChange)(encoded)
    expect(decoded.entityType).toBe('Line')
    expect(decoded.currentState).toBe('running')
  })
})

// =============================================================================
// CacheInvalidation
// =============================================================================

describe('CacheInvalidation', () => {
  it('should decode a valid CacheInvalidation', () => {
    const input = {
      _tag: 'CacheInvalidation',
      cacheKey: 'alarms:plant-a:*',
      invalidatedAt: testTimestamp,
    }
    const decoded = Schema.decodeUnknownSync(CacheInvalidation)(input)
    expect(decoded._tag).toBe('CacheInvalidation')
    expect(decoded.cacheKey).toBe('alarms:plant-a:*')
  })

  it('should accept optional reason field', () => {
    const input = {
      _tag: 'CacheInvalidation',
      cacheKey: 'readings:dev-001',
      invalidatedAt: testTimestamp,
      reason: 'New reading ingested',
    }
    const decoded = Schema.decodeUnknownSync(CacheInvalidation)(input)
    expect(decoded.reason).toBe('New reading ingested')
  })

  it('should roundtrip encode/decode', () => {
    const invalidation = new CacheInvalidation({
      cacheKey: 'hierarchy:plant-a',
      invalidatedAt: testTimestamp,
    })
    const encoded = Schema.encodeSync(CacheInvalidation)(invalidation)
    const decoded = Schema.decodeUnknownSync(CacheInvalidation)(encoded)
    expect(decoded.cacheKey).toBe('hierarchy:plant-a')
  })
})

// =============================================================================
// RpcGroup Composition
// =============================================================================

describe('RealtimeRpcs RpcGroup', () => {
  it('should contain all 4 RPCs', () => {
    const requests = RealtimeRpcs.requests
    expect(requests.size).toBe(4)
  })

  it('should contain SubscribeReadings', () => {
    const tags = Array.from(RealtimeRpcs.requests.keys())
    expect(tags).toContain('Realtime.SubscribeReadings')
  })

  it('should contain SubscribeAlarms', () => {
    const tags = Array.from(RealtimeRpcs.requests.keys())
    expect(tags).toContain('Realtime.SubscribeAlarms')
  })

  it('should contain SubscribeEquipmentState', () => {
    const tags = Array.from(RealtimeRpcs.requests.keys())
    expect(tags).toContain('Realtime.SubscribeEquipmentState')
  })

  it('should contain SubscribeInvalidations', () => {
    const tags = Array.from(RealtimeRpcs.requests.keys())
    expect(tags).toContain('Realtime.SubscribeInvalidations')
  })
})

// =============================================================================
// Streaming RPC Definitions
// =============================================================================

describe('SubscribeReadings', () => {
  it('should be defined as a streaming RPC', () => {
    // Verify the RPC exists and is exported
    expect(SubscribeReadings).toBeDefined()
  })
})

describe('SubscribeAlarms', () => {
  it('should be defined as a streaming RPC', () => {
    expect(SubscribeAlarms).toBeDefined()
  })
})

describe('SubscribeEquipmentState', () => {
  it('should be defined as a streaming RPC', () => {
    expect(SubscribeEquipmentState).toBeDefined()
  })
})

describe('SubscribeInvalidations', () => {
  it('should be defined as a streaming RPC', () => {
    expect(SubscribeInvalidations).toBeDefined()
  })
})

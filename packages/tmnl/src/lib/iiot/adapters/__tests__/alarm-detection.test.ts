/**
 * AlarmDetector Service Tests
 *
 * Tests the alarm threshold detection service with deadband logic.
 * Covers pure threshold checking and stateful deadband behavior.
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/alarm-detection
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { DateTime, Effect } from 'effect'
import {
  checkThresholds,
  ThresholdViolation,
  AlarmDetector,
  AlarmDetectorLive,
  type SensorThresholds,
} from '../alarm-detection'

// =============================================================================
// Helper: build SensorThresholds with defaults
// =============================================================================

const makeThresholds = (
  deviceId: string,
  overrides: Partial<Omit<SensorThresholds, 'deviceId'>> = {},
): SensorThresholds => ({
  deviceId,
  thresholdHigh: overrides.thresholdHigh,
  thresholdCritical: overrides.thresholdCritical,
  thresholdLow: overrides.thresholdLow,
  thresholdCriticalLow: overrides.thresholdCriticalLow,
})

// =============================================================================
// Test Suite: checkThresholds (pure function)
// =============================================================================

describe('checkThresholds', () => {
  const allThresholds = makeThresholds('DEV-test', {
    thresholdHigh: 80,
    thresholdCritical: 95,
    thresholdLow: 10,
    thresholdCriticalLow: 5,
  })

  // Test 1: Value below all thresholds -> 'normal'
  it('returns normal when value is within all thresholds', () => {
    expect(checkThresholds(50, allThresholds)).toBe('normal')
  })

  // Test 2: Value >= thresholdHigh -> 'high'
  it('returns high when value >= thresholdHigh', () => {
    expect(checkThresholds(80, allThresholds)).toBe('high')
    expect(checkThresholds(85, allThresholds)).toBe('high')
  })

  // Test 3: Value >= thresholdCritical -> 'critical_high'
  it('returns critical_high when value >= thresholdCritical', () => {
    expect(checkThresholds(95, allThresholds)).toBe('critical_high')
    expect(checkThresholds(100, allThresholds)).toBe('critical_high')
  })

  // Test 4: Value <= thresholdLow -> 'low'
  it('returns low when value <= thresholdLow', () => {
    expect(checkThresholds(10, allThresholds)).toBe('low')
    expect(checkThresholds(8, allThresholds)).toBe('low')
  })

  // Test 5: Value <= thresholdCriticalLow -> 'critical_low'
  it('returns critical_low when value <= thresholdCriticalLow', () => {
    expect(checkThresholds(5, allThresholds)).toBe('critical_low')
    expect(checkThresholds(2, allThresholds)).toBe('critical_low')
  })

  // Test 6: No thresholds configured (all undefined) -> 'normal'
  it('returns normal when no thresholds are configured', () => {
    const noThresholds = makeThresholds('DEV-empty')
    expect(checkThresholds(999, noThresholds)).toBe('normal')
    expect(checkThresholds(-999, noThresholds)).toBe('normal')
  })

  // Test 7: Only high threshold set, value below -> 'normal'
  it('returns normal when only high threshold set and value is below', () => {
    const highOnly = makeThresholds('DEV-high', { thresholdHigh: 80 })
    expect(checkThresholds(50, highOnly)).toBe('normal')
  })

  // Test 8: Critical takes priority over high when value exceeds both
  it('critical_high takes priority over high when value exceeds both', () => {
    expect(checkThresholds(95, allThresholds)).toBe('critical_high')
    // At exactly critical threshold
    expect(checkThresholds(95, allThresholds)).toBe('critical_high')
  })

  it('critical_low takes priority over low when value is at or below both', () => {
    expect(checkThresholds(5, allThresholds)).toBe('critical_low')
    expect(checkThresholds(3, allThresholds)).toBe('critical_low')
  })
})

// =============================================================================
// Test Suite: AlarmDetector service (deadband)
// =============================================================================

describe('AlarmDetector', () => {
  const TestLayer = AlarmDetectorLive

  // Test 9: First threshold crossing triggers violation
  it.effect('first threshold crossing triggers violation', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      yield* detector.registerThresholds(
        makeThresholds('DEV-001', { thresholdHigh: 80, thresholdCritical: 95 })
      )
      const now = DateTime.unsafeNow()
      const result = yield* detector.checkReading('DEV-001', 85, now)
      expect(result).not.toBeNull()
      expect(result!.status).toBe('high')
      expect(result!.deviceId).toBe('DEV-001')
      expect(result!.value).toBe(85)
    }).pipe(Effect.provide(TestLayer))
  )

  // Test 10: Subsequent readings above threshold suppress (return null)
  it.effect('subsequent readings above threshold are suppressed', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      yield* detector.registerThresholds(
        makeThresholds('DEV-002', { thresholdHigh: 80 })
      )
      const now = DateTime.unsafeNow()
      // First crossing triggers
      const first = yield* detector.checkReading('DEV-002', 85, now)
      expect(first).not.toBeNull()
      // Second reading still above -- suppressed
      const second = yield* detector.checkReading('DEV-002', 90, now)
      expect(second).toBeNull()
      // Third reading still above -- suppressed
      const third = yield* detector.checkReading('DEV-002', 88, now)
      expect(third).toBeNull()
    }).pipe(Effect.provide(TestLayer))
  )

  // Test 11: Return to normal clears tracking (return null)
  it.effect('return to normal clears tracking', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      yield* detector.registerThresholds(
        makeThresholds('DEV-003', { thresholdHigh: 80 })
      )
      const now = DateTime.unsafeNow()
      // Trigger alarm
      yield* detector.checkReading('DEV-003', 85, now)
      // Return to normal -- should return null (no violation for normal)
      const normalResult = yield* detector.checkReading('DEV-003', 50, now)
      expect(normalResult).toBeNull()
    }).pipe(Effect.provide(TestLayer))
  )

  // Test 12: New crossing after return to normal triggers again
  it.effect('new crossing after return to normal triggers again', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      yield* detector.registerThresholds(
        makeThresholds('DEV-004', { thresholdHigh: 80 })
      )
      const now = DateTime.unsafeNow()
      // First crossing
      const first = yield* detector.checkReading('DEV-004', 85, now)
      expect(first).not.toBeNull()
      // Return to normal
      yield* detector.checkReading('DEV-004', 50, now)
      // New crossing -- should trigger again
      const second = yield* detector.checkReading('DEV-004', 90, now)
      expect(second).not.toBeNull()
      expect(second!.status).toBe('high')
    }).pipe(Effect.provide(TestLayer))
  )

  // Test 13: Unregistered device returns null (no thresholds)
  it.effect('unregistered device returns null', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      const now = DateTime.unsafeNow()
      const result = yield* detector.checkReading('DEV-unknown', 999, now)
      expect(result).toBeNull()
    }).pipe(Effect.provide(TestLayer))
  )

  // Test 14: Register thresholds then check works
  it.effect('register thresholds then check works', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      // Check before registration -- null
      const now = DateTime.unsafeNow()
      const before = yield* detector.checkReading('DEV-005', 999, now)
      expect(before).toBeNull()
      // Register
      yield* detector.registerThresholds(
        makeThresholds('DEV-005', { thresholdCritical: 90 })
      )
      // Check after registration -- violation
      const after = yield* detector.checkReading('DEV-005', 95, now)
      expect(after).not.toBeNull()
      expect(after!.status).toBe('critical_high')
    }).pipe(Effect.provide(TestLayer))
  )

  // Test 15: Different devices tracked independently
  it.effect('different devices are tracked independently', () =>
    Effect.gen(function* () {
      const detector = yield* AlarmDetector
      yield* detector.registerThresholds(
        makeThresholds('DEV-A', { thresholdHigh: 80 })
      )
      yield* detector.registerThresholds(
        makeThresholds('DEV-B', { thresholdHigh: 80 })
      )
      const now = DateTime.unsafeNow()
      // Trigger alarm on DEV-A
      const aFirst = yield* detector.checkReading('DEV-A', 85, now)
      expect(aFirst).not.toBeNull()
      // DEV-B should still trigger independently
      const bFirst = yield* detector.checkReading('DEV-B', 85, now)
      expect(bFirst).not.toBeNull()
      // DEV-A is suppressed, DEV-B is suppressed
      const aSecond = yield* detector.checkReading('DEV-A', 90, now)
      expect(aSecond).toBeNull()
      const bSecond = yield* detector.checkReading('DEV-B', 90, now)
      expect(bSecond).toBeNull()
      // DEV-A returns to normal, DEV-B stays in alarm
      yield* detector.checkReading('DEV-A', 50, now)
      // DEV-A can trigger again
      const aThird = yield* detector.checkReading('DEV-A', 85, now)
      expect(aThird).not.toBeNull()
      // DEV-B still suppressed (never returned to normal)
      const bThird = yield* detector.checkReading('DEV-B', 85, now)
      expect(bThird).toBeNull()
    }).pipe(Effect.provide(TestLayer))
  )

  // Tag identity
  it('AlarmDetector.key is tmnl/iiot/AlarmDetector', () => {
    expect(AlarmDetector.key).toBe('tmnl/iiot/AlarmDetector')
  })

  // ThresholdViolation schema
  it('ThresholdViolation has correct _tag', () => {
    const now = DateTime.unsafeNow()
    const violation = new ThresholdViolation({
      deviceId: 'DEV-test',
      value: 95,
      status: 'critical_high',
      timestamp: now,
    })
    expect(violation._tag).toBe('ThresholdViolation')
    expect(violation.deviceId).toBe('DEV-test')
    expect(violation.value).toBe(95)
    expect(violation.status).toBe('critical_high')
  })
})

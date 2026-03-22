/**
 * AlarmDetector Service -- Threshold Detection with Deadband
 *
 * Monitors incoming sensor readings against configured thresholds and
 * emits ThresholdViolation events when values cross alarm boundaries.
 *
 * Deadband logic prevents alarm storms from noisy sensors:
 * 1. Reading crosses threshold (normal -> high): TRIGGER violation
 * 2. Next reading still above threshold (high -> high): SUPPRESS (already in alarm)
 * 3. Reading returns to normal (high -> normal): Clear tracking
 * 4. Reading crosses threshold again (normal -> high): TRIGGER new violation
 *
 * @module @gbg/tmnl/iiot/adapters/alarm-detection
 * @see Phase 5 Stream Architecture (Epic 19), Section 6
 */

import { Context, Effect, Layer, HashMap, Ref, Option, Schema } from 'effect'

// =============================================================================
// ThresholdStatus -- result of checking a reading against thresholds
// =============================================================================

/**
 * Result of checking a sensor reading value against configured thresholds.
 *
 * Ordered by severity: critical_high > high > normal > low > critical_low
 */
export const ThresholdStatus = Schema.Literal(
  'normal',
  'high',
  'critical_high',
  'low',
  'critical_low',
)
export type ThresholdStatus = Schema.Schema.Type<typeof ThresholdStatus>

// =============================================================================
// SensorThresholds -- threshold configuration for a device
// =============================================================================

/**
 * Threshold configuration for a sensor/device.
 *
 * All threshold fields are optional -- only configured thresholds are checked.
 * Uses Schema.optional (not Schema.optionalWith with Option) so consumers
 * can pass plain objects without wrapping in Option.
 */
export const SensorThresholds = Schema.Struct({
  deviceId: Schema.String,
  thresholdHigh: Schema.optional(Schema.Number),
  thresholdCritical: Schema.optional(Schema.Number),
  thresholdLow: Schema.optional(Schema.Number),
  thresholdCriticalLow: Schema.optional(Schema.Number),
})
export type SensorThresholds = Schema.Schema.Type<typeof SensorThresholds>

// =============================================================================
// ThresholdViolation -- emitted when a threshold is crossed
// =============================================================================

/**
 * Emitted when a sensor reading crosses a threshold boundary.
 *
 * Only emitted on the TRANSITION from normal to alarm state (deadband).
 * Subsequent readings that remain in alarm are suppressed.
 */
export class ThresholdViolation extends Schema.TaggedClass<ThresholdViolation>()(
  'ThresholdViolation',
  {
    deviceId: Schema.String,
    value: Schema.Number,
    status: ThresholdStatus,
    timestamp: Schema.DateTimeUtc,
  }
) {}

// =============================================================================
// checkThresholds -- pure function
// =============================================================================

/**
 * Check a value against sensor thresholds.
 *
 * Evaluation order (highest severity first):
 * 1. critical_high: value >= thresholdCritical
 * 2. high: value >= thresholdHigh
 * 3. critical_low: value <= thresholdCriticalLow
 * 4. low: value <= thresholdLow
 * 5. normal: none of the above
 *
 * @param value - The sensor reading value
 * @param thresholds - Configured thresholds for the sensor
 * @returns The threshold status for this value
 */
export const checkThresholds = (
  value: number,
  thresholds: SensorThresholds,
): ThresholdStatus => {
  if (thresholds.thresholdCritical !== undefined && value >= thresholds.thresholdCritical)
    return 'critical_high'
  if (thresholds.thresholdHigh !== undefined && value >= thresholds.thresholdHigh)
    return 'high'
  if (thresholds.thresholdCriticalLow !== undefined && value <= thresholds.thresholdCriticalLow)
    return 'critical_low'
  if (thresholds.thresholdLow !== undefined && value <= thresholds.thresholdLow)
    return 'low'
  return 'normal'
}

// =============================================================================
// AlarmDetector Service Interface
// =============================================================================

/**
 * Shape of the AlarmDetector service.
 *
 * Provides:
 * - registerThresholds: Register sensor thresholds for monitoring
 * - checkReading: Check a single reading with deadband logic
 */
export interface AlarmDetectorShape {
  /** Register sensor thresholds for monitoring. Overwrites previous thresholds for same deviceId. */
  readonly registerThresholds: (thresholds: SensorThresholds) => Effect.Effect<void>

  /**
   * Check a single reading against registered thresholds, with deadband logic.
   *
   * Returns ThresholdViolation when transitioning from normal to alarm state.
   * Returns null when:
   * - No thresholds registered for this device
   * - Value is normal
   * - Already in alarm state (suppressed by deadband)
   * - Returning to normal from alarm
   */
  readonly checkReading: (
    deviceId: string,
    value: number,
    timestamp: typeof Schema.DateTimeUtc.Type,
  ) => Effect.Effect<ThresholdViolation | null>
}

export class AlarmDetector extends Context.Tag('tmnl/iiot/AlarmDetector')<
  AlarmDetector,
  AlarmDetectorShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates the AlarmDetector implementation.
 *
 * State:
 * - thresholdCache: HashMap<deviceId, SensorThresholds> -- registered thresholds
 * - activeAlarms: HashMap<deviceId, ThresholdStatus> -- current alarm status per device
 *
 * Deadband logic:
 * - Alarm triggers only on normal -> alarm transition
 * - Subsequent alarm readings are suppressed
 * - Returning to normal clears the tracking entry
 */
const makeAlarmDetector = Effect.gen(function* () {
  // Sensor threshold cache: deviceId -> SensorThresholds
  const thresholdCache = yield* Ref.make(HashMap.empty<string, SensorThresholds>())
  // Active alarm tracking: deviceId -> current ThresholdStatus (for deadband)
  const activeAlarms = yield* Ref.make(HashMap.empty<string, ThresholdStatus>())

  const registerThresholds = (thresholds: SensorThresholds): Effect.Effect<void> =>
    Ref.update(thresholdCache, HashMap.set(thresholds.deviceId, thresholds))

  const checkReading = (
    deviceId: string,
    value: number,
    timestamp: typeof Schema.DateTimeUtc.Type,
  ): Effect.Effect<ThresholdViolation | null> =>
    Effect.gen(function* () {
      const cache = yield* Ref.get(thresholdCache)
      const maybeThresholds = HashMap.get(cache, deviceId)
      if (Option.isNone(maybeThresholds)) return null

      const status = checkThresholds(value, maybeThresholds.value)
      const current = HashMap.get(yield* Ref.get(activeAlarms), deviceId)

      // Deadband: was the device in normal state (or not tracked)?
      const wasNormal = Option.isNone(current) || current.value === 'normal'

      // Update tracking state
      yield* Ref.update(activeAlarms, HashMap.set(deviceId, status))

      // If returning to normal from alarm, clear tracking entry
      if (status === 'normal' && !wasNormal) {
        yield* Ref.update(activeAlarms, HashMap.remove(deviceId))
      }

      // Only emit violation when transitioning from normal to alarm
      if (status !== 'normal' && wasNormal) {
        return new ThresholdViolation({
          deviceId,
          value,
          status,
          timestamp,
        })
      }

      return null
    })

  return AlarmDetector.of({ registerThresholds, checkReading })
})

// =============================================================================
// Live Layer
// =============================================================================

export const AlarmDetectorLive: Layer.Layer<AlarmDetector> = Layer.effect(
  AlarmDetector,
  makeAlarmDetector,
)

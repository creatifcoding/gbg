/**
 * SenML Payload Generator (RFC 8428)
 *
 * Generates RFC 8428 compliant sensor measurement payloads.
 * Reference: https://datatracker.ietf.org/doc/html/rfc8428
 *
 * Example output (small tier):
 * ```json
 * [
 *   {"bn":"urn:dev:ow:10e2073a01:","bt":1702000000,"n":"temperature","u":"Cel","v":23.5},
 *   {"n":"humidity","u":"%RH","v":67.3}
 * ]
 * ```
 *
 * @module
 */

import type { PayloadGenerator, PayloadTier } from '../types'
import { PAYLOAD_SIZE_TARGETS } from '../types'

// ============================================================================
// SENML RECORD TYPE
// ============================================================================

/**
 * SenML record per RFC 8428.
 *
 * Base fields (b*) apply to all subsequent records until overridden.
 * Regular fields (n, u, v, etc.) are per-record.
 */
interface SenMLRecord {
  /** Base name - prepended to record names */
  bn?: string
  /** Base time - added to record time offsets */
  bt?: number
  /** Base unit - default unit for records */
  bu?: string
  /** Base value - added to record values */
  bv?: number
  /** Base sum - added to record sums */
  bs?: number
  /** Base version - SenML version (defaults to 10) */
  bver?: number
  /** Name - sensor/measurement name */
  n?: string
  /** Unit - measurement unit (IANA registered) */
  u?: string
  /** Value - numeric measurement */
  v?: number
  /** String value - for text measurements */
  vs?: string
  /** Boolean value - for binary states */
  vb?: boolean
  /** Data value - base64 encoded binary */
  vd?: string
  /** Time - relative time offset from base time */
  t?: number
  /** Sum - running total */
  s?: number
  /** Update time - next expected update */
  ut?: number
}

// ============================================================================
// SENSOR DEFINITIONS
// ============================================================================

/** Sensor type definitions with IANA unit codes */
const SENSOR_TYPES = [
  { name: 'temperature', unit: 'Cel', range: [15, 35] as const },
  { name: 'humidity', unit: '%RH', range: [30, 90] as const },
  { name: 'pressure', unit: 'Pa', range: [95000, 105000] as const },
  { name: 'voltage', unit: 'V', range: [3.0, 3.6] as const },
  { name: 'current', unit: 'A', range: [0, 2.5] as const },
  { name: 'power', unit: 'W', range: [0, 100] as const },
  { name: 'luminosity', unit: 'lx', range: [0, 10000] as const },
  { name: 'co2', unit: 'ppm', range: [400, 2000] as const },
  { name: 'sound', unit: 'dB', range: [30, 90] as const },
  { name: 'acceleration', unit: 'm/s2', range: [-10, 10] as const },
  { name: 'gyroscope', unit: 'rad/s', range: [-5, 5] as const },
  { name: 'magnetometer', unit: 'T', range: [-100, 100] as const },
  { name: 'battery', unit: '%EL', range: [0, 100] as const },
  { name: 'rssi', unit: 'dBm', range: [-100, -30] as const },
  { name: 'distance', unit: 'm', range: [0, 50] as const },
  { name: 'flow', unit: 'l/s', range: [0, 10] as const },
] as const

/** Tier configuration for payload size control */
const TIER_CONFIG = {
  small: { sensorCount: 2, historyPoints: 0 },   // ~500 bytes
  medium: { sensorCount: 8, historyPoints: 5 },  // ~3 kB
  large: { sensorCount: 16, historyPoints: 20 }, // ~20 kB
} as const

// ============================================================================
// GENERATOR IMPLEMENTATION
// ============================================================================

/**
 * Generate a random value within the sensor's range.
 */
const randomInRange = (range: readonly [number, number]): number => {
  const [min, max] = range
  const value = min + Math.random() * (max - min)
  // Round to 2 decimal places for realistic sensor precision
  return Math.round(value * 100) / 100
}

/**
 * Generate a device URN based on event index.
 * Format: urn:dev:ow:{8-digit-hex}:
 */
const generateDeviceUrn = (eventIndex: number): string => {
  const deviceId = (eventIndex % 1000).toString(16).padStart(8, '0')
  return `urn:dev:ow:${deviceId}:`
}

/**
 * SenML payload generator.
 *
 * Produces RFC 8428 compliant sensor measurement arrays.
 */
export const senmlGenerator: PayloadGenerator = {
  id: 'senml',
  name: 'SenML (RFC 8428)',
  description: 'IoT sensor telemetry — smart buildings, environmental monitoring',

  generate(tier: PayloadTier, eventIndex: number): SenMLRecord[] {
    const config = TIER_CONFIG[tier]
    const baseTime = Math.floor(Date.now() / 1000) // Unix timestamp in seconds
    const deviceUrn = generateDeviceUrn(eventIndex)

    const records: SenMLRecord[] = []

    for (let i = 0; i < config.sensorCount; i++) {
      const sensor = SENSOR_TYPES[i % SENSOR_TYPES.length]
      const value = randomInRange(sensor.range)

      if (i === 0) {
        // First record carries base fields
        records.push({
          bn: deviceUrn,
          bt: baseTime,
          n: sensor.name,
          u: sensor.unit,
          v: value,
        })
      } else {
        // Subsequent records omit base fields
        records.push({
          n: sensor.name,
          u: sensor.unit,
          v: value,
        })
      }

      // Add historical points for medium/large tiers
      for (let h = 1; h <= config.historyPoints; h++) {
        const historicalValue = randomInRange(sensor.range)
        records.push({
          n: sensor.name,
          t: -h, // Relative time offset (seconds ago)
          v: historicalValue,
        })
      }
    }

    return records
  },

  estimateSizeBytes(tier: PayloadTier): number {
    return PAYLOAD_SIZE_TARGETS[tier]
  },
}

export type { SenMLRecord }

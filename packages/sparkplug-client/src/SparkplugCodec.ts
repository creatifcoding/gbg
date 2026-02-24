/**
 * SparkplugCodec — Protobuf encode/decode + metric value helpers.
 *
 * Wraps `sparkplug-payload` (the Eclipse Tahu protobuf codec) with
 * typed helpers for metric value extraction and quality reading.
 *
 * sparkplug-payload uses a factory pattern:
 *   `require('sparkplug-payload').get('spBv1.0')` → { encodePayload, decodePayload }
 *
 * @module @selfcharters/sparkplug-client/SparkplugCodec
 * @see Sparkplug 3.0.0 Spec §6 Payloads
 */

// sparkplug-payload is CJS with factory pattern — we use createRequire for ESM compat
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const spBv1 = require('sparkplug-payload').get('spBv1.0') as {
  encodePayload: (payload: UPayload) => Uint8Array
  decodePayload: (bytes: Uint8Array | Buffer) => UPayload
}

// =============================================================================
// Types (from sparkplug-payload, not exported by the package)
// =============================================================================

/** Sparkplug B metric property value */
export interface UPropertyValue {
  readonly type: string
  readonly value: unknown
}

/** Sparkplug B metric */
export interface UMetric {
  readonly name?: string
  readonly alias?: number | Long
  readonly timestamp?: number | Long
  readonly dataType?: number
  readonly value?: unknown
  readonly type?: string
  readonly properties?: Record<string, UPropertyValue>
}

/** Sparkplug B payload (Unified Payload) */
export interface UPayload {
  readonly timestamp?: number | Long
  readonly metrics?: UMetric[]
  readonly seq?: number
  readonly uuid?: string
  readonly body?: Uint8Array
}

/** Long value type (protobufjs uses Long for 64-bit integers) */
interface Long {
  readonly low: number
  readonly high: number
  readonly unsigned: boolean
  toNumber(): number
}

// =============================================================================
// Encode / Decode (re-exported from sparkplug-payload)
// =============================================================================

/**
 * Encode a UPayload object to protobuf binary.
 *
 * @param payload - The payload to encode
 * @returns Protobuf-encoded bytes
 */
export const encodePayload = (payload: UPayload): Uint8Array =>
  spBv1.encodePayload(payload)

/**
 * Decode protobuf binary to a UPayload object.
 *
 * @param bytes - Protobuf-encoded bytes
 * @returns Decoded payload
 */
export const decodePayload = (bytes: Uint8Array | Buffer): UPayload =>
  spBv1.decodePayload(bytes)

// =============================================================================
// Metric value extraction
// =============================================================================

/**
 * Known Sparkplug B metric data types that resolve to numbers.
 */
const NUMERIC_TYPES = new Set([
  'Int8', 'Int16', 'Int32', 'Int64',
  'UInt8', 'UInt16', 'UInt32', 'UInt64',
  'Float', 'Double',
])

/**
 * Coerce a Long value (protobufjs 64-bit int) to a JS number.
 */
const longToNumber = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    return (v as Long).toNumber()
  }
  return null
}

/**
 * Extract a numeric value from a Sparkplug B metric.
 *
 * Handles type coercion:
 * - Numeric types (Int*, UInt*, Float, Double) → number
 * - Boolean → 1 or 0
 * - All others → null
 *
 * @param metric - The metric to extract value from
 * @returns Numeric value or null if not convertible
 */
export const decodeMetricValue = (metric: UMetric): number | null => {
  const { value, type } = metric
  if (value == null) return null

  if (type && NUMERIC_TYPES.has(type)) {
    return longToNumber(value)
  }

  if (type === 'Boolean') {
    return value ? 1 : 0
  }

  return null
}

// =============================================================================
// Quality extraction
// =============================================================================

/**
 * Extract the Quality property from a Sparkplug B metric.
 *
 * Quality is stored as a metric property:
 *   `metric.properties.Quality.value`
 *
 * The value is an integer bitmask per the Sparkplug spec:
 * - >= 192: Good
 * - >= 64:  Uncertain
 * - < 64:   Bad
 *
 * @param metric - The metric to extract quality from
 * @returns Quality value as string (for downstream mapSparkplugQuality), or undefined
 */
export const extractQuality = (metric: UMetric): string | undefined => {
  const quality = metric.properties?.['Quality']
  if (quality == null) return undefined

  const val = quality.value
  if (val == null) return undefined

  return String(val)
}

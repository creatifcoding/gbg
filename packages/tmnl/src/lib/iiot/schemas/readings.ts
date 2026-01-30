/**
 * IIoT Sensor Readings Schemas
 *
 * Effect Schema definitions for time-series sensor data.
 * These map to TimescaleDB hypertables in the database.
 *
 * Supports tiered latency model per aligned architecture:
 * - Hot (<1s): Direct hypertable queries
 * - Warm (1-60s): readings_1min continuous aggregate
 * - Cold (>60s): readings_1hour continuous aggregate
 *
 * @module @gbg/tmnl/iiot/schemas/readings
 * @see ADR-0012 for persistence strategy (NOT event sourced - TimescaleDB)
 * @see OPC UA Part 8 for quality code standards
 */

import { Match, pipe, Schema } from 'effect'
import { DeviceId } from './identifiers'

// Re-export AssetId for convenience in reading contexts
export { AssetId } from './identifiers'

// =============================================================================
// OPC-UA Quality Codes
// =============================================================================

/**
 * OPC-UA Quality Status Codes (simplified).
 *
 * Based on OPC UA Part 8 - Data Access:
 * - good: Value is good (0x00)
 * - good_local_override: Value overridden locally (0x40)
 * - uncertain: Value is uncertain (0x40000000)
 * - uncertain_sensor_calibration: Sensor needs calibration (0x40200000)
 * - bad: Value is bad (0x80000000)
 * - bad_sensor_failure: Sensor has failed (0x80100000)
 * - bad_no_communication: Communication loss (0x80110000)
 * - bad_configuration_error: Configuration error (0x80140000)
 *
 * @see OPC UA Part 8 - Data Access, Section 5.6
 */
export const OpcUaQuality = Schema.Literal(
  'good',
  'good_local_override',
  'uncertain',
  'uncertain_sensor_calibration',
  'uncertain_last_usable_value',
  'bad',
  'bad_sensor_failure',
  'bad_no_communication',
  'bad_configuration_error',
  'bad_not_connected',
  'bad_device_failure'
).pipe(
  Schema.brand('@gbg/tmnl/iiot/OpcUaQuality'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/OpcUaQuality',
    description: 'OPC-UA quality status code',
  })
)
export type OpcUaQuality = typeof OpcUaQuality.Type

/**
 * Map OPC-UA quality to numeric score (0-100).
 * - good: 100
 * - good_local_override: 90
 * - uncertain_*: 50-69
 * - bad_*: 0
 */
/** Raw quality string type for Match.type (unbranded) */
type OpcUaQualityRaw =
  | 'good'
  | 'good_local_override'
  | 'uncertain'
  | 'uncertain_sensor_calibration'
  | 'uncertain_last_usable_value'
  | 'bad'
  | 'bad_sensor_failure'
  | 'bad_no_communication'
  | 'bad_configuration_error'
  | 'bad_not_connected'
  | 'bad_device_failure'

/** Exhaustive matcher for OPC-UA quality to numeric score */
const qualityToScoreMatcher = pipe(
  Match.type<OpcUaQualityRaw>(),
  Match.when('good', () => 100),
  Match.when('good_local_override', () => 90),
  Match.when('uncertain', () => 60),
  Match.when('uncertain_sensor_calibration', () => 55),
  Match.when('uncertain_last_usable_value', () => 50),
  Match.when('bad', () => 0),
  Match.when('bad_sensor_failure', () => 0),
  Match.when('bad_no_communication', () => 0),
  Match.when('bad_configuration_error', () => 0),
  Match.when('bad_not_connected', () => 0),
  Match.when('bad_device_failure', () => 0),
  Match.exhaustive
)

export const opcUaQualityToScore = (quality: OpcUaQuality): number =>
  qualityToScoreMatcher(quality as OpcUaQualityRaw)

/**
 * Check if quality indicates a usable value.
 */
export const isQualityUsable = (quality: OpcUaQuality): boolean => {
  return quality.startsWith('good') || quality.startsWith('uncertain')
}

/**
 * Check if quality indicates a good value.
 */
export const isQualityGood = (quality: OpcUaQuality): boolean => {
  return quality.startsWith('good')
}

// =============================================================================
// Data Quality (Legacy Numeric)
// =============================================================================

/**
 * Data quality score (0-100, where 100 is highest quality).
 * Legacy numeric representation for backward compatibility.
 * Prefer OpcUaQuality for new code.
 */
export const QualityScore = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 100),
  Schema.brand('QualityScore')
)
export type QualityScore = Schema.Schema.Type<typeof QualityScore>

// =============================================================================
// Sensor Readings
// =============================================================================

/**
 * Raw sensor reading from TimescaleDB hypertable.
 *
 * Supports both OPC-UA quality codes (preferred) and legacy numeric scores.
 * The tiered latency model determines which table to query:
 * - Hot (<1s): iiot.sensor_readings hypertable
 * - Warm (1-60s): iiot.readings_1min continuous aggregate
 * - Cold (>60s): iiot.readings_1hour continuous aggregate
 */
export class SensorReading extends Schema.TaggedClass<SensorReading>()('SensorReading', {
  /** Timestamp of the reading (UTC) */
  time: Schema.DateTimeUtc,
  /** Device that produced the reading */
  deviceId: DeviceId,
  /** Measured value */
  value: Schema.Number,
  /** OPC-UA quality code (preferred) */
  opcUaQuality: Schema.optional(OpcUaQuality),
  /** Legacy numeric quality score (0-100) */
  quality: QualityScore,
}) {
  /**
   * Check if this reading has usable data quality.
   */
  isUsable(): boolean {
    if (this.opcUaQuality) {
      return isQualityUsable(this.opcUaQuality)
    }
    return this.quality >= 50
  }

  /**
   * Check if this reading has good data quality.
   */
  isGood(): boolean {
    if (this.opcUaQuality) {
      return isQualityGood(this.opcUaQuality)
    }
    return this.quality >= 90
  }
}

/** Aggregated reading (from continuous aggregates) */
export class AggregatedReading extends Schema.TaggedClass<AggregatedReading>()('AggregatedReading', {
  bucket: Schema.DateTimeUtc,
  deviceId: DeviceId,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddevValue: Schema.optional(Schema.Number),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}

/** Time bucket granularity for aggregation queries */
export const TimeBucket = Schema.Literal('1min', '5min', '15min', '1hour', '1day')
export type TimeBucket = Schema.Schema.Type<typeof TimeBucket>

// =============================================================================
// Columnar Analytics (pg_mooncake tier)
// =============================================================================

/** Historical analytics record (from pg_mooncake columnstore) */
export class AnalyticsRecord extends Schema.TaggedClass<AnalyticsRecord>()('AnalyticsRecord', {
  deviceId: DeviceId,
  hour: Schema.DateTimeUtc,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddev: Schema.optional(Schema.Number),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
}) {}

// =============================================================================
// Query Parameters
// =============================================================================

/** Parameters for time-series queries */
export const TimeSeriesQueryParams = Schema.Struct({
  deviceId: DeviceId,
  since: Schema.optional(Schema.DateTimeUtc),
  until: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type TimeSeriesQueryParams = Schema.Schema.Type<typeof TimeSeriesQueryParams>

/** Parameters for aggregated queries */
export const AggregatedQueryParams = Schema.Struct({
  deviceId: DeviceId,
  bucket: TimeBucket,
  since: Schema.optional(Schema.DateTimeUtc),
  until: Schema.optional(Schema.DateTimeUtc),
})
export type AggregatedQueryParams = Schema.Schema.Type<typeof AggregatedQueryParams>

/** Parameters for batch insert */
export const InsertReadingsParams = Schema.Struct({
  readings: Schema.Array(
    Schema.Struct({
      time: Schema.DateTimeUtc,
      deviceId: DeviceId,
      value: Schema.Number,
      quality: Schema.optional(QualityScore),
    })
  ),
})
export type InsertReadingsParams = Schema.Schema.Type<typeof InsertReadingsParams>

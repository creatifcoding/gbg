/**
 * IIoT Sensor Readings Schemas
 *
 * Effect Schema definitions for time-series sensor data.
 * These map to TimescaleDB hypertables in the database.
 *
 * @module
 */

import { Schema } from 'effect'
import { DeviceId } from './identifiers'

// =============================================================================
// Data Quality
// =============================================================================

/** Data quality score (0-100, where 100 is highest quality) */
export const QualityScore = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 100),
  Schema.brand('QualityScore')
)
export type QualityScore = Schema.Schema.Type<typeof QualityScore>

// =============================================================================
// Sensor Readings
// =============================================================================

/** Raw sensor reading from TimescaleDB hypertable */
export const SensorReading = Schema.Struct({
  _tag: Schema.Literal('SensorReading'),
  time: Schema.DateTimeUtc,
  deviceId: DeviceId,
  value: Schema.Number,
  quality: QualityScore,
})
export type SensorReading = Schema.Schema.Type<typeof SensorReading>

/** Aggregated reading (from continuous aggregates) */
export const AggregatedReading = Schema.Struct({
  _tag: Schema.Literal('AggregatedReading'),
  bucket: Schema.DateTimeUtc,
  deviceId: DeviceId,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddevValue: Schema.optional(Schema.Number),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type AggregatedReading = Schema.Schema.Type<typeof AggregatedReading>

/** Time bucket granularity for aggregation queries */
export const TimeBucket = Schema.Literal('1min', '5min', '15min', '1hour', '1day')
export type TimeBucket = Schema.Schema.Type<typeof TimeBucket>

// =============================================================================
// Columnar Analytics (pg_mooncake tier)
// =============================================================================

/** Historical analytics record (from pg_mooncake columnstore) */
export const AnalyticsRecord = Schema.Struct({
  _tag: Schema.Literal('AnalyticsRecord'),
  deviceId: DeviceId,
  hour: Schema.DateTimeUtc,
  avgValue: Schema.Number,
  minValue: Schema.Number,
  maxValue: Schema.Number,
  stddev: Schema.optional(Schema.Number),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive()),
})
export type AnalyticsRecord = Schema.Schema.Type<typeof AnalyticsRecord>

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

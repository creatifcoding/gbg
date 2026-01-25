/**
 * SensorReadingModel DDL - Co-located database schema for Sensor Readings
 *
 * TimescaleDB hypertable with space partitioning for high cardinality workloads.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Sensor Readings Hypertable DDL
// =============================================================================

/**
 * Creates the sensor_readings hypertable in the iiot schema.
 *
 * Columns derived from SensorReadingModel:
 * - time: TIMESTAMPTZ NOT NULL (composite PK part 1)
 * - device_id: TEXT NOT NULL (composite PK part 2)
 * - value: DOUBLE PRECISION NOT NULL
 * - quality: INTEGER DEFAULT 100
 *
 * TimescaleDB features:
 * - Hypertable chunked by day
 * - Space partition by device_id hash (4 partitions)
 */
export const createSensorReadingsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create base table
  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sensor_readings (
      time        TIMESTAMPTZ NOT NULL,
      device_id   TEXT NOT NULL,
      value       DOUBLE PRECISION NOT NULL,
      quality     INTEGER DEFAULT 100,
      CONSTRAINT sensor_readings_pkey PRIMARY KEY (time, device_id)
    )
  `

  // Convert to hypertable (chunk by day)
  // sql.unsafe for TimescaleDB extension functions
  yield* sql.unsafe(`SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '1 day'), if_not_exists => TRUE)`)

  // Add space partition for high cardinality workloads
  yield* sql.unsafe(`SELECT add_dimension('iiot.sensor_readings', by_hash('device_id', 4), if_not_exists => TRUE)`)

  // Indexes for efficient queries
  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_device ON iiot.sensor_readings (device_id, time DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_quality ON iiot.sensor_readings (quality) WHERE quality < 100`
})

// =============================================================================
// Continuous Aggregates DDL
// =============================================================================

/**
 * Creates 1-minute continuous aggregate for sensor readings.
 * Maps to AggregatedReadingModel (1-min bucket).
 */
export const createReadings1MinAggregate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS iiot.readings_1min
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 minute', time) AS bucket,
      device_id,
      AVG(value) AS avg_value,
      MIN(value) AS min_value,
      MAX(value) AS max_value,
      STDDEV(value) AS stddev_value,
      COUNT(*) AS sample_count
    FROM iiot.sensor_readings
    GROUP BY bucket, device_id
    WITH NO DATA
  `)

  // Refresh policy: update every minute, with 1-minute lag
  yield* sql.unsafe(`
    SELECT add_continuous_aggregate_policy('iiot.readings_1min',
      start_offset => INTERVAL '1 hour',
      end_offset => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute',
      if_not_exists => TRUE
    )
  `)
})

/**
 * Creates 1-hour continuous aggregate (aggregates from 1-min view).
 * Maps to AggregatedReadingModel (1-hour bucket).
 */
export const createReadings1HourAggregate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS iiot.readings_1hour
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 hour', bucket) AS bucket,
      device_id,
      AVG(avg_value) AS avg_value,
      MIN(min_value) AS min_value,
      MAX(max_value) AS max_value,
      AVG(stddev_value) AS avg_stddev,
      SUM(sample_count) AS sample_count
    FROM iiot.readings_1min
    GROUP BY time_bucket('1 hour', bucket), device_id
    WITH NO DATA
  `)

  yield* sql.unsafe(`
    SELECT add_continuous_aggregate_policy('iiot.readings_1hour',
      start_offset => INTERVAL '4 hours',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    )
  `)
})

// =============================================================================
// Compression & Retention Policies DDL
// =============================================================================

/**
 * Enables compression and retention policies on sensor_readings.
 */
export const createCompressionPolicies = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Enable compression on sensor_readings
  yield* sql.unsafe(`
    ALTER TABLE iiot.sensor_readings SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'device_id',
      timescaledb.compress_orderby = 'time DESC'
    )
  `)

  // Compress raw data after 7 days
  yield* sql.unsafe(`SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '7 days', if_not_exists => TRUE)`)

  // Drop raw data after 30 days (aggregates preserved longer)
  yield* sql.unsafe(`SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '30 days', if_not_exists => TRUE)`)
})

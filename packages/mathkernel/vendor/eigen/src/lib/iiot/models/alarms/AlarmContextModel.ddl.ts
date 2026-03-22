/**
 * AlarmContextModel DDL - Materialized View for Alarm Context
 *
 * Pre-computed sensor readings around alarm events for root cause analysis.
 * Uses materialized view for fast reads without write amplification.
 *
 * Decision: Materialized view chosen over table because:
 * - No retention mismatch (pg_mooncake → Iceberg keeps cold data)
 * - No write amplification during alarm spikes
 * - Pre-computed for fast operator triage
 * - Refresh on-demand or scheduled
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Alarm Context Materialized View DDL
// =============================================================================

/**
 * Default context window around alarm events (±5 minutes)
 */
export const DEFAULT_CONTEXT_WINDOW = '5 minutes'

/**
 * Creates the alarm_context materialized view.
 *
 * If alarm_context exists as a table, it is dropped first.
 * Joins alarms with sensor_readings within ±5 minute window.
 * Explicit columns (no SELECT *) for covering index efficiency.
 *
 * Schema:
 * - alarm_id: TEXT
 * - device_id: TEXT
 * - reading_time: TIMESTAMPTZ
 * - value: DOUBLE PRECISION
 * - quality: INTEGER
 * - offset_seconds: DOUBLE PRECISION (seconds from alarm trigger)
 */
export const createAlarmContextView = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Drop existing table or view if exists (migration from table to matview)
  yield* sql.unsafe(`DROP TABLE IF EXISTS iiot.alarm_context CASCADE`)
  yield* sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS iiot.alarm_context CASCADE`)

  yield* sql.unsafe(`
    CREATE MATERIALIZED VIEW iiot.alarm_context AS
    SELECT
      a.id AS alarm_id,
      a.device_id,
      sr.time AS reading_time,
      sr.value,
      sr.quality,
      EXTRACT(EPOCH FROM (sr.time - a.triggered_at)) AS offset_seconds
    FROM iiot.alarms a
    JOIN iiot.sensor_readings sr
      ON sr.device_id = a.device_id
      AND sr.time BETWEEN a.triggered_at - INTERVAL '${DEFAULT_CONTEXT_WINDOW}'
                      AND a.triggered_at + INTERVAL '${DEFAULT_CONTEXT_WINDOW}'
    WITH NO DATA
  `)

  // Index for fast alarm lookups
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_alarm_context_alarm_id
    ON iiot.alarm_context (alarm_id)
  `)

  // Index for time-ordered retrieval within an alarm
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_alarm_context_alarm_time
    ON iiot.alarm_context (alarm_id, reading_time)
  `)

  // Unique index required for REFRESH CONCURRENTLY
  yield* sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alarm_context_unique
    ON iiot.alarm_context (alarm_id, reading_time)
  `)
})

/**
 * Refreshes the alarm_context materialized view.
 * Call after new alarms are created or on a schedule.
 */
export const refreshAlarmContextView = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`REFRESH MATERIALIZED VIEW iiot.alarm_context`)
})

/**
 * Refreshes the alarm_context materialized view concurrently.
 * Allows reads during refresh (requires unique index).
 */
export const refreshAlarmContextViewConcurrently = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create unique index if not exists (required for CONCURRENTLY)
  yield* sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alarm_context_unique
    ON iiot.alarm_context (alarm_id, reading_time)
  `)

  yield* sql.unsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY iiot.alarm_context`)
})

// =============================================================================
// Dynamic Query Function (for variable time windows)
// =============================================================================

/**
 * Creates function for dynamic time window queries.
 * Use when you need a different window than the materialized view's ±5min.
 */
export const createGetAlarmContextFunction = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.get_alarm_context(
        p_alarm_id TEXT,
        p_window INTERVAL DEFAULT INTERVAL '5 minutes'
    )
    RETURNS TABLE (
        alarm_id TEXT,
        device_id TEXT,
        reading_time TIMESTAMPTZ,
        value DOUBLE PRECISION,
        quality INTEGER,
        offset_seconds DOUBLE PRECISION
    )
    LANGUAGE SQL STABLE AS $$
        SELECT
            a.id AS alarm_id,
            sr.device_id,
            sr.time AS reading_time,
            sr.value,
            sr.quality,
            EXTRACT(EPOCH FROM (sr.time - a.triggered_at)) AS offset_seconds
        FROM iiot.alarms a
        JOIN iiot.sensor_readings sr
          ON sr.device_id = a.device_id
          AND sr.time BETWEEN a.triggered_at - p_window
                          AND a.triggered_at + p_window
        WHERE a.id = p_alarm_id
        ORDER BY sr.time;
    $$
  `)
})

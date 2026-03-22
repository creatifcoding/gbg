/**
 * AnalyticsRecordModel DDL - Co-located database schema for Historical Analytics
 *
 * Uses pg_lake Iceberg tables for efficient analytics queries,
 * with fallback to regular table if extension not available.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Sensor Analytics Table DDL (pg_lake Iceberg)
// =============================================================================

/**
 * Creates the sensor_analytics table in the iiot schema.
 *
 * Columns derived from AnalyticsRecordModel:
 * - hour: TIMESTAMPTZ (composite PK part 1)
 * - device_id: TEXT (composite PK part 2)
 * - avg_value: REAL
 * - min_value: REAL
 * - max_value: REAL
 * - stddev: REAL (nullable)
 * - sample_count: INTEGER
 *
 * Storage: pg_lake Iceberg table for historical analytics (DuckDB-powered),
 * or regular table if pg_lake not available.
 */
export const createSensorAnalyticsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Try Iceberg table first, fallback to regular table
  yield* sql.unsafe(`
    DO $$
    BEGIN
        -- Try to create Iceberg table (pg_lake)
        EXECUTE '
            CREATE TABLE IF NOT EXISTS iiot.sensor_analytics (
                device_id   TEXT,
                hour        TIMESTAMPTZ,
                avg_value   REAL,
                min_value   REAL,
                max_value   REAL,
                stddev      REAL,
                sample_count INTEGER,
                PRIMARY KEY (hour, device_id)
            ) USING iceberg
            WITH (partition_by = ''day(hour), bucket(16, device_id)'')
        ';
        RAISE NOTICE 'Created iiot.sensor_analytics as Iceberg table';
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: create regular table if pg_lake not available
        CREATE TABLE IF NOT EXISTS iiot.sensor_analytics (
            device_id   TEXT,
            hour        TIMESTAMPTZ,
            avg_value   REAL,
            min_value   REAL,
            max_value   REAL,
            stddev      REAL,
            sample_count INTEGER,
            PRIMARY KEY (hour, device_id)
        );
        CREATE INDEX IF NOT EXISTS idx_analytics_device ON iiot.sensor_analytics (device_id, hour DESC);
        RAISE NOTICE 'Created iiot.sensor_analytics as regular table (pg_lake not available)';
    END $$
  `)
})

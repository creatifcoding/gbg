/**
 * IIoT Helper Functions DDL
 *
 * Database functions for common operations:
 * - get_device_readings: Recent readings for a device
 * - get_machine_sensors: All sensors for a machine with latest values
 * - get_sensor_hierarchy: Asset hierarchy path for a sensor
 * - health_check: Database health status
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Device Readings Function DDL
// =============================================================================

/**
 * Creates function to get recent readings for a device.
 */
export const createGetDeviceReadingsFunction = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.get_device_readings(
        p_device_id TEXT,
        p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 hour'
    )
    RETURNS TABLE (
        "time" TIMESTAMPTZ,
        value DOUBLE PRECISION,
        quality INTEGER
    )
    LANGUAGE SQL STABLE AS $$
        SELECT "time", value, quality
        FROM iiot.sensor_readings
        WHERE device_id = p_device_id
          AND "time" >= p_since
        ORDER BY "time" DESC;
    $$
  `)
})

// =============================================================================
// Machine Sensors Function DDL
// =============================================================================

/**
 * Creates function to get all sensors for a machine (graph + time-series join).
 */
export const createGetMachineSensorsFunction = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.get_machine_sensors(p_machine_id TEXT)
    RETURNS TABLE (
        device_id TEXT,
        sensor_type TEXT,
        unit TEXT,
        latest_value DOUBLE PRECISION,
        latest_time TIMESTAMPTZ
    )
    LANGUAGE plpgsql VOLATILE AS $func$
    DECLARE
        rec RECORD;
        sql_query TEXT;
    BEGIN
        -- VOLATILE allows SET LOCAL for search_path (cypher operators require ag_catalog)
        SET LOCAL search_path = ag_catalog, iiot, public;

        -- Build the full SQL query with embedded cypher
        sql_query := format($sql$
            WITH machine_sensors AS (
                SELECT ms.device_id::text AS device_id, ms.sensor_type::text AS sensor_type, ms.unit::text AS unit
                FROM cypher('iiot_graph', $$
                    MATCH (m:machine {id: %L})<-[:monitors]-(s:sensor)
                    RETURN s.device_id AS device_id, s.type AS sensor_type, s.unit AS unit
                $$) AS ms(device_id agtype, sensor_type agtype, unit agtype)
            ),
            latest_readings AS (
                SELECT DISTINCT ON (sr.device_id)
                    sr.device_id,
                    sr.value AS latest_value,
                    sr.time AS latest_time
                FROM iiot.sensor_readings sr
                WHERE sr.device_id IN (SELECT ms2.device_id FROM machine_sensors ms2)
                ORDER BY sr.device_id, sr.time DESC
            )
            SELECT
                ms.device_id,
                ms.sensor_type,
                ms.unit,
                lr.latest_value,
                lr.latest_time
            FROM machine_sensors ms
            LEFT JOIN latest_readings lr ON ms.device_id = lr.device_id
        $sql$, p_machine_id);

        -- Execute the query
        FOR rec IN EXECUTE sql_query LOOP
            device_id := rec.device_id;
            sensor_type := rec.sensor_type;
            unit := rec.unit;
            latest_value := rec.latest_value;
            latest_time := rec.latest_time;
            RETURN NEXT;
        END LOOP;
    END;
    $func$
  `)
})

// =============================================================================
// Sensor Hierarchy Function DDL
// =============================================================================

/**
 * Creates function to get asset hierarchy path for a sensor.
 */
export const createGetSensorHierarchyFunction = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.get_sensor_hierarchy(p_device_id TEXT)
    RETURNS TABLE (
        device_id TEXT,
        machine_name TEXT,
        line_name TEXT,
        plant_name TEXT
    )
    LANGUAGE plpgsql VOLATILE AS $func$
    DECLARE
        rec RECORD;
        sql_query TEXT;
    BEGIN
        -- VOLATILE allows SET LOCAL for search_path (cypher operators require ag_catalog)
        SET LOCAL search_path = ag_catalog, iiot, public;

        sql_query := format($sql$
            SELECT
                r.device_id::text AS device_id,
                r.machine_name::text AS machine_name,
                r.line_name::text AS line_name,
                r.plant_name::text AS plant_name
            FROM cypher('iiot_graph', $$
                MATCH (s:sensor {device_id: %L})-[:monitors]->(m:machine)<-[:contains]-(l:line)<-[:contains]-(p:plant)
                RETURN s.device_id AS device_id, m.name AS machine_name, l.name AS line_name, p.name AS plant_name
            $$) AS r(device_id agtype, machine_name agtype, line_name agtype, plant_name agtype)
        $sql$, p_device_id);

        FOR rec IN EXECUTE sql_query LOOP
            device_id := rec.device_id;
            machine_name := rec.machine_name;
            line_name := rec.line_name;
            plant_name := rec.plant_name;
            RETURN NEXT;
        END LOOP;
    END;
    $func$
  `)
})

// =============================================================================
// Health Check Function DDL
// =============================================================================

/**
 * Creates function for database health check.
 */
export const createHealthCheckFunction = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.health_check()
    RETURNS TABLE (
        component TEXT,
        status TEXT,
        details TEXT
    )
    LANGUAGE SQL STABLE AS $$
        -- Check TimescaleDB hypertable
        SELECT 'timescaledb_hypertable'::TEXT, 'ok'::TEXT,
               format('sensor_readings: %s chunks', (SELECT COUNT(*) FROM timescaledb_information.chunks WHERE hypertable_name = 'sensor_readings'))

        UNION ALL

        -- Check Apache AGE graph
        SELECT 'age_graph'::TEXT, 'ok'::TEXT,
               format('iiot_graph exists: %s', EXISTS(SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'iiot_graph'))

        UNION ALL

        -- Check continuous aggregates
        SELECT 'continuous_aggregates'::TEXT, 'ok'::TEXT,
               format('%s continuous aggregates', (SELECT COUNT(*) FROM timescaledb_information.continuous_aggregates WHERE materialization_hypertable_schema = 'iiot'))

        UNION ALL

        -- Check compression
        SELECT 'compression_policies'::TEXT, 'ok'::TEXT,
               format('%s compression policies', (SELECT COUNT(*) FROM timescaledb_information.jobs WHERE proc_name = 'policy_compression'))

        UNION ALL

        -- Check pg_lake (Iceberg analytics)
        SELECT 'pg_lake'::TEXT,
               CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_lake') THEN 'ok' ELSE 'not_installed' END,
               CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_lake')
                    THEN 'Iceberg storage available (DuckDB-powered)'
                    ELSE 'using regular tables for analytics' END;
    $$
  `)
})

// =============================================================================
// Combined Functions Export
// =============================================================================

export const createAllFunctions = Effect.all([
  createGetDeviceReadingsFunction,
  createGetMachineSensorsFunction,
  createGetSensorHierarchyFunction,
  createHealthCheckFunction,
])

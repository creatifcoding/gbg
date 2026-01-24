-- =============================================================================
-- TMNL IIoT Database Schema Initialization
-- Unified storage: TimescaleDB (time-series) + Apache AGE (graph) + pg_mooncake (columnar)
-- =============================================================================

-- =============================================================================
-- 1. Extension Setup
-- =============================================================================

-- TimescaleDB (already enabled in base image, but ensure it's loaded)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Apache AGE for graph queries
-- Note: AGE is preloaded via shared_preload_libraries in postgres CMD
-- No need for LOAD 'age' - it's loaded at server startup
CREATE EXTENSION IF NOT EXISTS age;
SET search_path = ag_catalog, "$user", public;

-- pg_mooncake for columnar analytics (optional - may not be installed)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_mooncake;
    RAISE NOTICE 'pg_mooncake extension enabled';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_mooncake not available - continuing without columnar storage';
END $$;

-- Additional useful extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Verify extensions
DO $$
BEGIN
    RAISE NOTICE 'TimescaleDB version: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
    RAISE NOTICE 'Apache AGE version: %', (SELECT extversion FROM pg_extension WHERE extname = 'age');
END $$;

-- =============================================================================
-- 2. Create IIoT Schema
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS iiot;

-- =============================================================================
-- 3. Graph Layer (Apache AGE) - Asset Hierarchy & Relationships
-- =============================================================================

-- Create the IIoT graph (named 'iiot_graph' to avoid schema conflict with 'iiot')
SELECT create_graph('iiot_graph');

-- Create initial asset hierarchy via Cypher
-- Plants
SELECT * FROM cypher('iiot_graph', $$
    CREATE (:plant {id: 'PLANT-A', name: 'Chicago Assembly', location: 'Chicago, IL'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:plant {id: 'PLANT-B', name: 'Detroit Manufacturing', location: 'Detroit, MI'})
$$) AS (v agtype);

-- Production Lines
SELECT * FROM cypher('iiot_graph', $$
    CREATE (:line {id: 'LINE-001', name: 'Body Assembly', plant_id: 'PLANT-A'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:line {id: 'LINE-002', name: 'Paint Shop', plant_id: 'PLANT-A'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:line {id: 'LINE-003', name: 'Final Assembly', plant_id: 'PLANT-B'})
$$) AS (v agtype);

-- Machines
SELECT * FROM cypher('iiot_graph', $$
    CREATE (:machine {id: 'MCH-001', name: 'Welding Robot Alpha', model: 'FANUC R-2000iC/210F', line_id: 'LINE-001'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:machine {id: 'MCH-002', name: 'Welding Robot Beta', model: 'FANUC R-2000iC/210F', line_id: 'LINE-001'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:machine {id: 'MCH-003', name: 'Paint Booth 1', model: 'Durr EcoPaint', line_id: 'LINE-002'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:machine {id: 'MCH-004', name: 'Conveyor System A', model: 'Bosch TS5', line_id: 'LINE-003'})
$$) AS (v agtype);

-- Sensors (with device_id matching time-series table)
SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'TMP-001', type: 'temperature', unit: 'celsius', machine_id: 'MCH-001'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'VIB-001', type: 'vibration', unit: 'mm/s', machine_id: 'MCH-001'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'TMP-002', type: 'temperature', unit: 'celsius', machine_id: 'MCH-002'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'VIB-002', type: 'vibration', unit: 'mm/s', machine_id: 'MCH-002'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'TMP-003', type: 'temperature', unit: 'celsius', machine_id: 'MCH-003'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'HUM-001', type: 'humidity', unit: 'percent', machine_id: 'MCH-003'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'SPD-001', type: 'speed', unit: 'm/min', machine_id: 'MCH-004'})
$$) AS (v agtype);

SELECT * FROM cypher('iiot_graph', $$
    CREATE (:sensor {device_id: 'CUR-001', type: 'current', unit: 'amps', machine_id: 'MCH-004'})
$$) AS (v agtype);

-- Create relationships: plant -> line -> machine -> sensor

-- Plant contains Line relationships
SELECT * FROM cypher('iiot_graph', $$
    MATCH (p:plant {id: 'PLANT-A'}), (l:line {id: 'LINE-001'})
    CREATE (p)-[:contains]->(l)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (p:plant {id: 'PLANT-A'}), (l:line {id: 'LINE-002'})
    CREATE (p)-[:contains]->(l)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (p:plant {id: 'PLANT-B'}), (l:line {id: 'LINE-003'})
    CREATE (p)-[:contains]->(l)
$$) AS (e agtype);

-- Line contains Machine relationships
SELECT * FROM cypher('iiot_graph', $$
    MATCH (l:line {id: 'LINE-001'}), (m:machine {id: 'MCH-001'})
    CREATE (l)-[:contains]->(m)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (l:line {id: 'LINE-001'}), (m:machine {id: 'MCH-002'})
    CREATE (l)-[:contains]->(m)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (l:line {id: 'LINE-002'}), (m:machine {id: 'MCH-003'})
    CREATE (l)-[:contains]->(m)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (l:line {id: 'LINE-003'}), (m:machine {id: 'MCH-004'})
    CREATE (l)-[:contains]->(m)
$$) AS (e agtype);

-- Sensor monitors Machine relationships
SELECT * FROM cypher('iiot_graph', $$
    MATCH (m:machine {id: 'MCH-001'}), (s:sensor)
    WHERE s.machine_id = 'MCH-001'
    CREATE (s)-[:monitors]->(m)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (m:machine {id: 'MCH-002'}), (s:sensor)
    WHERE s.machine_id = 'MCH-002'
    CREATE (s)-[:monitors]->(m)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (m:machine {id: 'MCH-003'}), (s:sensor)
    WHERE s.machine_id = 'MCH-003'
    CREATE (s)-[:monitors]->(m)
$$) AS (e agtype);

SELECT * FROM cypher('iiot_graph', $$
    MATCH (m:machine {id: 'MCH-004'}), (s:sensor)
    WHERE s.machine_id = 'MCH-004'
    CREATE (s)-[:monitors]->(m)
$$) AS (e agtype);

-- =============================================================================
-- 4. Time-Series Layer (TimescaleDB) - Sensor Readings
-- =============================================================================

-- Main sensor readings hypertable
CREATE TABLE iiot.sensor_readings (
    time        TIMESTAMPTZ NOT NULL,
    device_id   TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    quality     INTEGER DEFAULT 100,

    CONSTRAINT sensor_readings_pkey PRIMARY KEY (time, device_id)
);

-- Convert to hypertable (chunk by day)
SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '1 day'));

-- Add space partition for high cardinality workloads
SELECT add_dimension('iiot.sensor_readings', by_hash('device_id', 4));

-- Indexes for efficient queries
CREATE INDEX idx_readings_device ON iiot.sensor_readings (device_id, time DESC);
CREATE INDEX idx_readings_quality ON iiot.sensor_readings (quality) WHERE quality < 100;

-- =============================================================================
-- 5. Continuous Aggregates (TimescaleDB) - Rollups
-- =============================================================================

-- 1-minute aggregates
CREATE MATERIALIZED VIEW iiot.readings_1min
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
WITH NO DATA;

-- Refresh policy: update every minute, with 1-minute lag
SELECT add_continuous_aggregate_policy('iiot.readings_1min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- 1-hour aggregates
CREATE MATERIALIZED VIEW iiot.readings_1hour
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
WITH NO DATA;

SELECT add_continuous_aggregate_policy('iiot.readings_1hour',
    start_offset => INTERVAL '4 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- =============================================================================
-- 6. Compression Policies (TimescaleDB)
-- =============================================================================

-- Compress raw data after 7 days
ALTER TABLE iiot.sensor_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'device_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '7 days');

-- =============================================================================
-- 7. Retention Policies (TimescaleDB)
-- =============================================================================

-- Drop raw data after 30 days (aggregates preserved longer)
SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '30 days');

-- =============================================================================
-- 8. Columnar Analytics Layer (pg_mooncake) - Historical Analytics
-- =============================================================================

-- Note: This block only executes if pg_mooncake is installed
DO $$
BEGIN
    -- Create columnstore table for historical analytics
    EXECUTE '
        CREATE TABLE iiot.sensor_analytics (
            device_id   TEXT,
            hour        TIMESTAMPTZ,
            avg_value   REAL,
            min_value   REAL,
            max_value   REAL,
            stddev      REAL,
            sample_count INTEGER
        ) USING columnstore
    ';
    RAISE NOTICE 'Created iiot.sensor_analytics columnstore table';
EXCEPTION WHEN OTHERS THEN
    -- Fallback: create regular table if columnstore not available
    CREATE TABLE IF NOT EXISTS iiot.sensor_analytics (
        device_id   TEXT,
        hour        TIMESTAMPTZ,
        avg_value   REAL,
        min_value   REAL,
        max_value   REAL,
        stddev      REAL,
        sample_count INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_device ON iiot.sensor_analytics (device_id, hour DESC);
    RAISE NOTICE 'Created iiot.sensor_analytics as regular table (columnstore not available)';
END $$;

-- =============================================================================
-- 9. Alarm & Event Tables
-- =============================================================================

-- Alarms table with graph integration
CREATE TABLE iiot.alarms (
    id          TEXT PRIMARY KEY DEFAULT 'ALM-' || gen_random_uuid()::TEXT,
    device_id   TEXT NOT NULL,
    alarm_type  TEXT NOT NULL,
    severity    TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
    message     TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    cleared_at  TIMESTAMPTZ,
    acknowledged_by TEXT,
    metadata    JSONB DEFAULT '{}'
);

CREATE INDEX idx_alarms_device ON iiot.alarms (device_id, triggered_at DESC);
CREATE INDEX idx_alarms_severity ON iiot.alarms (severity, triggered_at DESC);
CREATE INDEX idx_alarms_open ON iiot.alarms (triggered_at DESC) WHERE cleared_at IS NULL;

-- Create alarm nodes in graph when alarms are inserted
-- Note: Uses EXECUTE because AGE cypher() requires literal string constants
CREATE OR REPLACE FUNCTION iiot.alarm_graph_trigger()
RETURNS TRIGGER AS $func$
DECLARE
    sql_create TEXT;
    sql_link TEXT;
BEGIN
    -- AGE is preloaded via shared_preload_libraries - no LOAD needed
    -- Set search_path for EXECUTE context (cypher operators require ag_catalog)
    SET LOCAL search_path = ag_catalog, iiot, public;

    -- Build SQL to create alarm node in graph
    sql_create := format($sql$
        SELECT * FROM cypher('iiot_graph', $$
            CREATE (:alarm {id: %L, alarm_type: %L, severity: %L, timestamp: %L})
        $$) AS (v agtype)
    $sql$, NEW.id, NEW.alarm_type, NEW.severity, NEW.triggered_at::TEXT);

    EXECUTE sql_create;

    -- Build SQL to link alarm to sensor
    sql_link := format($sql$
        SELECT * FROM cypher('iiot_graph', $$
            MATCH (a:alarm {id: %L}), (s:sensor {device_id: %L}) CREATE (a)-[:triggered_by]->(s)
        $$) AS (e agtype)
    $sql$, NEW.id, NEW.device_id);

    EXECUTE sql_link;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Don't fail insert if graph update fails
    RAISE WARNING 'Failed to update alarm graph: %', SQLERRM;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER alarm_graph_sync
AFTER INSERT ON iiot.alarms
FOR EACH ROW EXECUTE FUNCTION iiot.alarm_graph_trigger();

-- =============================================================================
-- 10. Helper Functions
-- =============================================================================

-- Get recent readings for a device
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
$$;

-- Get all sensors for a machine (graph + time-series join)
-- Note: Uses EXECUTE because AGE cypher() requires literal string constants
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
    -- AGE is preloaded via shared_preload_libraries - no LOAD needed
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
$func$;

-- Get asset hierarchy path for a sensor
-- Note: Uses EXECUTE because AGE cypher() requires literal string constants
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
    -- AGE is preloaded via shared_preload_libraries - no LOAD needed
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
$func$;

-- Get readings around an alarm for root cause analysis
CREATE OR REPLACE FUNCTION iiot.get_alarm_context(
    p_alarm_id TEXT,
    p_window INTERVAL DEFAULT INTERVAL '5 minutes'
)
RETURNS TABLE (
    alarm_id TEXT,
    device_id TEXT,
    reading_time TIMESTAMPTZ,
    value DOUBLE PRECISION,
    offset_from_alarm INTERVAL
)
LANGUAGE SQL STABLE AS $$
    WITH alarm_info AS (
        SELECT id, device_id, triggered_at
        FROM iiot.alarms
        WHERE id = p_alarm_id
    )
    SELECT
        ai.id AS alarm_id,
        sr.device_id,
        sr.time AS reading_time,
        sr.value,
        sr.time - ai.triggered_at AS offset_from_alarm
    FROM alarm_info ai
    JOIN iiot.sensor_readings sr ON sr.device_id = ai.device_id
    WHERE sr.time BETWEEN ai.triggered_at - p_window AND ai.triggered_at + p_window
    ORDER BY sr.time;
$$;

-- Database health check
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

    -- Check pg_mooncake
    SELECT 'pg_mooncake'::TEXT,
           CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_mooncake') THEN 'ok' ELSE 'not_installed' END,
           CASE WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_mooncake')
                THEN 'columnar storage available'
                ELSE 'using regular tables for analytics' END;
$$;

-- =============================================================================
-- 11. Mock Data Generation
-- =============================================================================

-- Generate mock sensor readings (500K rows per sensor type for testing)
INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'TMP-001',
    20 + (random() * 10),  -- Temperature: 20-30 C
    CASE WHEN random() > 0.05 THEN 100 ELSE 50 END
FROM generate_series(1, 100000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'VIB-001',
    random() * 5,  -- Vibration: 0-5 mm/s
    CASE WHEN random() > 0.05 THEN 100 ELSE 50 END
FROM generate_series(1, 100000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'TMP-002',
    22 + (random() * 8),  -- Temperature: 22-30 C
    CASE WHEN random() > 0.05 THEN 100 ELSE 50 END
FROM generate_series(1, 100000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'VIB-002',
    random() * 4,  -- Vibration: 0-4 mm/s
    CASE WHEN random() > 0.05 THEN 100 ELSE 50 END
FROM generate_series(1, 100000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'TMP-003',
    35 + (random() * 25),  -- Paint booth: 35-60 C
    CASE WHEN random() > 0.02 THEN 100 ELSE 75 END
FROM generate_series(1, 100000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'HUM-001',
    40 + (random() * 30),  -- Humidity: 40-70%
    CASE WHEN random() > 0.02 THEN 100 ELSE 75 END
FROM generate_series(1, 100000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'SPD-001',
    10 + (random() * 5),  -- Speed: 10-15 m/min
    CASE WHEN random() > 0.03 THEN 100 ELSE 80 END
FROM generate_series(1, 50000);

INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
SELECT
    NOW() - (random() * INTERVAL '30 days'),
    'CUR-001',
    5 + (random() * 10),  -- Current: 5-15 amps
    CASE WHEN random() > 0.03 THEN 100 ELSE 80 END
FROM generate_series(1, 50000);

-- Generate some mock alarms
INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, triggered_at)
VALUES
    ('TMP-001', 'high_temperature', 'warning', 'Temperature exceeded threshold: 29.5C', NOW() - INTERVAL '2 hours'),
    ('VIB-001', 'high_vibration', 'critical', 'Vibration exceeded critical threshold: 4.8 mm/s', NOW() - INTERVAL '1 hour'),
    ('TMP-003', 'high_temperature', 'warning', 'Paint booth temperature high: 58C', NOW() - INTERVAL '30 minutes'),
    ('CUR-001', 'overcurrent', 'critical', 'Current spike detected: 14.2 amps', NOW() - INTERVAL '15 minutes');

-- Refresh continuous aggregates with initial data
CALL refresh_continuous_aggregate('iiot.readings_1min', NULL, NULL);
CALL refresh_continuous_aggregate('iiot.readings_1hour', NULL, NULL);

-- =============================================================================
-- 12. Permissions
-- =============================================================================

GRANT USAGE ON SCHEMA iiot TO iiot;
GRANT USAGE ON SCHEMA ag_catalog TO iiot;
GRANT ALL ON ALL TABLES IN SCHEMA iiot TO iiot;
GRANT ALL ON ALL SEQUENCES IN SCHEMA iiot TO iiot;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA iiot TO iiot;
GRANT SELECT ON ALL TABLES IN SCHEMA ag_catalog TO iiot;

-- =============================================================================
-- 13. Verification Queries (Run after initialization)
-- =============================================================================

DO $do$
DECLARE
    readings_count BIGINT;
    graph_sensors BIGINT;
    alarms_count BIGINT;
BEGIN
    -- Count sensor readings
    SELECT COUNT(*) INTO readings_count FROM iiot.sensor_readings;
    RAISE NOTICE 'Sensor readings loaded: %', readings_count;

    -- Count graph sensors (using EXECUTE for AGE cypher)
    EXECUTE $cypher$
        SELECT cnt::bigint FROM cypher('iiot_graph', $$
            MATCH (s:sensor) RETURN COUNT(s) AS cnt
        $$) AS (cnt agtype)
    $cypher$ INTO graph_sensors;
    RAISE NOTICE 'Graph sensors created: %', graph_sensors;

    -- Count alarms
    SELECT COUNT(*) INTO alarms_count FROM iiot.alarms;
    RAISE NOTICE 'Alarms created: %', alarms_count;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'IIoT Database initialization complete!';
    RAISE NOTICE '========================================';
END $do$;

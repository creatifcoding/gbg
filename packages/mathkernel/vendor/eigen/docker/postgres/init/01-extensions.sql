-- =============================================================================
-- TMNL PostgreSQL Extensions Setup
-- Enables PostGIS (spatial), TimescaleDB (time-series), Apache AGE (graph),
-- and pg_lake (Iceberg analytics)
-- =============================================================================

-- Enable PostGIS for spatial data types and functions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable TimescaleDB for time-series optimization
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable Apache AGE for graph queries (asset hierarchy, event causality)
CREATE EXTENSION IF NOT EXISTS age;
SET search_path = ag_catalog, "$user", public;

-- Enable pg_lake for Iceberg analytics (DuckDB-powered)
-- CASCADE installs: pg_extension_base, pg_map, pg_lake_engine, pg_lake_iceberg, pg_lake_table, pg_lake_copy
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;
    RAISE NOTICE 'pg_lake extension enabled (Iceberg + DuckDB analytics)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_lake not available: % - continuing without Iceberg storage', SQLERRM;
END $$;

-- Enable additional useful extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS btree_gist;          -- GiST index support for exclusion constraints

-- Verify extensions are installed
DO $$
BEGIN
  RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
  RAISE NOTICE 'TimescaleDB version: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
  RAISE NOTICE 'Apache AGE version: %', (SELECT extversion FROM pg_extension WHERE extname = 'age');
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_lake') THEN
    RAISE NOTICE 'pg_lake version: %', (SELECT extversion FROM pg_extension WHERE extname = 'pg_lake');
  END IF;
END $$;

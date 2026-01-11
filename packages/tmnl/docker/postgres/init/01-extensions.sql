-- =============================================================================
-- TMNL PostgreSQL Extensions Setup
-- Enables PostGIS (spatial) and TimescaleDB (time-series) extensions
-- =============================================================================

-- Enable PostGIS for spatial data types and functions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable TimescaleDB for time-series optimization
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable additional useful extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;  -- Query performance monitoring
CREATE EXTENSION IF NOT EXISTS btree_gist;          -- GiST index support for exclusion constraints

-- Verify extensions are installed
DO $$
BEGIN
  RAISE NOTICE 'PostGIS version: %', PostGIS_Version();
  RAISE NOTICE 'TimescaleDB version: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
END $$;

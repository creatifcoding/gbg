-- =============================================================================
-- Electric SQL Setup - Logical Replication Configuration
-- Must run before other init scripts (hence 00- prefix)
-- =============================================================================

-- Note: wal_level=logical is set via POSTGRES_INITDB_ARGS in docker-compose
-- This script creates the entity schema and Electric publication

-- Create entity schema for ECS
CREATE SCHEMA IF NOT EXISTS entity;

-- Grant permissions
GRANT USAGE ON SCHEMA entity TO tmnl;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA entity TO tmnl;
ALTER DEFAULT PRIVILEGES IN SCHEMA entity GRANT ALL ON TABLES TO tmnl;

-- Create publication for Electric (will add tables as they're created)
-- Electric uses this to track changes
CREATE PUBLICATION electric_pub;

-- Helper function to add table to Electric publication
CREATE OR REPLACE FUNCTION entity.add_to_electric(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER PUBLICATION electric_pub ADD TABLE entity.%I', table_name);
  RAISE NOTICE 'Added entity.% to Electric publication', table_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON PUBLICATION electric_pub IS 'Publication for ElectricSQL sync - entity tables';

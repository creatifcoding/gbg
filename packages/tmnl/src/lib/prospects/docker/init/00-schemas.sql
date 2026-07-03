-- =============================================================================
-- Prospect Pipeline — PostgreSQL Init Script
--
-- Creates the 'prospects' schema and the Effect Cluster schema.
-- Runs on first container start only (docker-entrypoint-initdb.d).
-- =============================================================================

-- Prospect pipeline schema
CREATE SCHEMA IF NOT EXISTS prospects;

-- Grant usage
GRANT ALL ON SCHEMA prospects TO prospects;
ALTER DEFAULT PRIVILEGES IN SCHEMA prospects GRANT ALL ON TABLES TO prospects;
ALTER DEFAULT PRIVILEGES IN SCHEMA prospects GRANT ALL ON SEQUENCES TO prospects;

-- Set search path so unqualified table names resolve to prospects schema
ALTER DATABASE prospects SET search_path TO prospects, public;

-- Log
DO $$ BEGIN RAISE NOTICE 'Prospects schema created.'; END $$;

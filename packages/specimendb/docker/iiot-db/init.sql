-- =============================================================================
-- specimendb catalog bootstrap
-- Copied from packages/tmnl/docker/iiot-db/init.sql (minimal).
-- =============================================================================
--
-- This file is minimal by design.
--
-- SCHEMA MANAGEMENT:
--   All schema DDL is managed by Effect SQL Migrator:
--   - packages/specimendb/src/repos/pg.ts
--
-- USER SETUP:
--   The 'specimendb' user is created by Docker's entrypoint via POSTGRES_USER.
--   No CREATE ROLE needed here.
--
-- =============================================================================

-- This file intentionally left minimal.
-- All DDL is managed by Effect SQL Migrator.

-- Verify the user exists (for debugging)
DO $$
BEGIN
    RAISE NOTICE 'specimendb database bootstrap complete.';
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Run Effect SQL Migrator to apply schema.';
END $$;

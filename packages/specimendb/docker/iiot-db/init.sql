-- =============================================================================
-- specimendb catalog database bootstrap
-- =============================================================================
--
-- Minimal by design. Copied from packages/tmnl/docker/iiot-db/init.sql.
--
-- SCHEMA MANAGEMENT:
--   Catalog DDL is the Effect SQL Migrator in packages/specimendb.
--   Do not create specimens / components / lab_entities here.
--   Do not load geoint init SQL.
--
-- USER SETUP:
--   The 'specimen' user is created by Docker's entrypoint via POSTGRES_USER.
--   No CREATE ROLE needed here.
--
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'specimendb database bootstrap complete.';
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: run the Effect SQL Migrator to apply catalog schema.';
END $$;

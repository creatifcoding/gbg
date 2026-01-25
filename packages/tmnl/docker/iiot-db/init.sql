-- =============================================================================
-- TMNL IIoT Database Bootstrap
-- =============================================================================
--
-- This file is minimal by design.
--
-- SCHEMA MANAGEMENT:
--   All schema DDL is managed by Effect SQL Migrator via co-located DDL files:
--   - src/lib/iiot/models/_migrations.ts     (Migration registry)
--   - src/lib/iiot/models/_infrastructure.ddl.ts (Extensions, schema, graph)
--   - src/lib/iiot/models/_functions.ddl.ts  (Helper functions)
--   - src/lib/iiot/models/_graph-seed.ddl.ts (Graph asset hierarchy)
--   - src/lib/iiot/models/assets/*.ddl.ts    (Asset tables)
--   - src/lib/iiot/models/readings/*.ddl.ts  (Time-series tables)
--   - src/lib/iiot/models/alarms/*.ddl.ts    (Alarm tables)
--
-- MOCK DATA:
--   For development data, use the seed module:
--   - src/lib/iiot/seed/mock-data.ts
--
-- RUNNING MIGRATIONS:
--   ```ts
--   import { PgMigrator } from '@effect/sql-pg'
--   import { iiotMigrationLoader } from './models/_migrations'
--
--   const MigratorLive = PgMigrator.layer({ loader: iiotMigrationLoader })
--   // Run via Effect.provide(MigratorLive)
--   ```
--
-- USER SETUP:
--   The 'iiot' user is created by Docker's entrypoint via POSTGRES_USER env var.
--   No CREATE ROLE needed here.
--
-- =============================================================================

-- This file intentionally left minimal.
-- All DDL is managed by Effect SQL Migrator.

-- Verify the user exists (for debugging)
DO $$
BEGIN
    RAISE NOTICE 'IIoT database bootstrap complete.';
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Run Effect SQL Migrator to apply schema.';
END $$;

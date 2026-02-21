/**
 * Genifer Infrastructure DDL — Schema creation and permissions
 *
 * Must run before any table DDL.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Schema DDL
// =============================================================================

/**
 * Creates the `genifer` PostgreSQL schema for all genifer tables.
 */
export const createGeniferSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE SCHEMA IF NOT EXISTS genifer`
})

// =============================================================================
// Permissions DDL
// =============================================================================

/**
 * Grants permissions on genifer schema to the current user.
 */
export const grantGeniferPermissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    DO $$
    DECLARE
      current_role text := CURRENT_USER;
    BEGIN
      EXECUTE format('GRANT USAGE ON SCHEMA genifer TO %I', current_role);
      EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA genifer TO %I', current_role);
      EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA genifer TO %I', current_role);
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA genifer TO %I', current_role);
      RAISE NOTICE 'Granted genifer schema permissions to %', current_role;
    END $$
  `)
})

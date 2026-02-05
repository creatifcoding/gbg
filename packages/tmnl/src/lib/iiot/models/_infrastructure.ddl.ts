/**
 * IIoT Infrastructure DDL - Extensions, Schema, and Graph Setup
 *
 * These must run before any table DDL.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// PostgreSQL Extensions DDL
// =============================================================================

/**
 * Sets up required extensions for IIoT infrastructure:
 * - TimescaleDB: Time-series hypertables, continuous aggregates
 * - Apache AGE: Graph database for asset hierarchy
 * - pg_lake: Iceberg analytics with DuckDB-powered queries (optional)
 * - pg_stat_statements: Query performance monitoring
 * - btree_gist: GiST index support
 *
 * NOTE: pg_lake requires shared_preload_libraries = 'pg_extension_base' in postgresql.conf
 */
export const createExtensions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // TimescaleDB (already enabled in base image, ensure loaded)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`)

  // Apache AGE for graph queries
  // Note: AGE is preloaded via shared_preload_libraries
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS age`)
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // pg_lake for Iceberg analytics (optional)
  // Requires: shared_preload_libraries = 'pg_extension_base' in postgresql.conf
  // CASCADE installs: pg_extension_base, pg_map, pg_lake_engine, pg_lake_iceberg, pg_lake_table, pg_lake_copy
  yield* sql.unsafe(`
    DO $$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;
        RAISE NOTICE 'pg_lake extension enabled (Iceberg + DuckDB analytics)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_lake not available - continuing without Iceberg storage';
    END $$
  `)

  // Additional useful extensions
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist`)

  // Verify extensions
  yield* sql.unsafe(`
    DO $$
    BEGIN
        RAISE NOTICE 'TimescaleDB version: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
        RAISE NOTICE 'Apache AGE version: %', (SELECT extversion FROM pg_extension WHERE extname = 'age');
    END $$
  `)
})

// =============================================================================
// Schema & Graph DDL
// =============================================================================

/**
 * Creates the iiot schema for all IIoT tables.
 */
export const createSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE SCHEMA IF NOT EXISTS iiot`
})

/**
 * Creates the Apache AGE graph for asset hierarchy.
 * Named 'iiot_graph' to avoid conflict with 'iiot' schema.
 *
 * Idempotent: checks ag_catalog.ag_graph before creating.
 */
export const createGraph = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  // Check if graph exists before creating (create_graph has no IF NOT EXISTS)
  yield* sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'iiot_graph') THEN
        PERFORM create_graph('iiot_graph');
        RAISE NOTICE 'Created AGE graph: iiot_graph';
      ELSE
        RAISE NOTICE 'AGE graph iiot_graph already exists';
      END IF;
    END $$
  `)
})

// =============================================================================
// Permissions DDL
// =============================================================================

/**
 * Grants permissions on iiot schema to the current user.
 * Uses CURRENT_USER for portability across different database setups.
 */
export const grantPermissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Use DO block with EXECUTE to dynamically grant to CURRENT_USER
  yield* sql.unsafe(`
    DO $$
    DECLARE
      current_role text := CURRENT_USER;
    BEGIN
      EXECUTE format('GRANT USAGE ON SCHEMA iiot TO %I', current_role);
      EXECUTE format('GRANT USAGE ON SCHEMA ag_catalog TO %I', current_role);
      EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA iiot TO %I', current_role);
      EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA iiot TO %I', current_role);
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA iiot TO %I', current_role);
      EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA ag_catalog TO %I', current_role);
      RAISE NOTICE 'Granted iiot schema permissions to %', current_role;
    END $$
  `)
})

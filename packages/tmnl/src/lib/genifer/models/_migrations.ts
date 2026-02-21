/**
 * Genifer Migrations — Aggregated DDL for Migrator.fromRecord
 *
 * Uses a SEPARATE migration table (`genifer_migrations`) to avoid
 * collisions with iiot's `effect_sql_migrations`.
 *
 * Migration order:
 * 0001 - Schema creation + permissions
 * 0002 - Trees table (generation metadata)
 * 0003 - Elements table (leaves-as-graph)
 * 0004 - Composites table (agent-created reusable fragments)
 * 0005 - Signals table (append-only quality events)
 * 0006 - Composite rankings materialized view
 *
 * @module
 */

import { Effect } from 'effect'
import { Migrator } from '@effect/sql'

import { createGeniferSchema, grantGeniferPermissions } from './_infrastructure.ddl'
import { createGeniferTreesTable } from './GeniferTreeModel.ddl'
import { createGeniferElementsTable } from './GeniferElementModel.ddl'
import { createGeniferCompositesTable } from './GeniferCompositeModel.ddl'
import { createGeniferSignalsTable, createCompositeRankingsView } from './GeniferSignalModel.ddl'

// =============================================================================
// Migration Record
// =============================================================================

/**
 * Genifer migrations as a Record for Migrator.fromRecord.
 *
 * Each key follows pattern: "NNNN_description"
 * Each value is an Effect<void, SqlError, SqlClient>
 */
export const geniferMigrations = {
  // Infrastructure: schema + permissions (must run first)
  '0001_genifer_schema': Effect.gen(function* () {
    yield* createGeniferSchema
    yield* grantGeniferPermissions
  }),

  // Trees: one row per generate()/refine() call
  '0002_genifer_trees': createGeniferTreesTable,

  // Elements: every UIElement is a row (graph-in-table)
  // Depends on trees (FK: tree_id → genifer.trees.id)
  '0003_genifer_elements': createGeniferElementsTable,

  // Composites: agent-created reusable fragments
  '0004_genifer_composites': createGeniferCompositesTable,

  // Signals: append-only quality events on trees/elements/composites
  '0005_genifer_signals': createGeniferSignalsTable,

  // Composite rankings: materialized view for quality-sorted composites
  // Depends on composites table
  '0006_composite_rankings': createCompositeRankingsView,
} as const

// =============================================================================
// Migration Loader
// =============================================================================

/**
 * Migration loader for use with PgMigrator.layer.
 *
 * Usage:
 * ```ts
 * import { PgMigrator } from '@effect/sql-pg'
 * import { geniferMigrationLoader } from './models/_migrations'
 *
 * const MigratorLive = PgMigrator.layer({
 *   loader: geniferMigrationLoader,
 * })
 * ```
 */
export const geniferMigrationLoader = Migrator.fromRecord(geniferMigrations)

// =============================================================================
// Type Exports
// =============================================================================

export type GeniferMigrationKey = keyof typeof geniferMigrations

/**
 * Genifer Migrations — Aggregated DDL for Migrator.fromRecord
 *
 * Migration order:
 * 0001 - Trees table (generation metadata)
 * 0002 - Elements table (leaves-as-graph)
 * 0003 - Composites table (agent-created reusable fragments)
 * 0004 - Signals table (append-only quality events)
 * 0005 - Composite rankings materialized view
 *
 * @module
 */

import { Migrator } from '@effect/sql'

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
  // Trees: one row per generate()/refine() call
  '0001_genifer_trees': createGeniferTreesTable,

  // Elements: every UIElement is a row (graph-in-table)
  // Depends on trees (FK: tree_id → genifer_trees.id)
  '0002_genifer_elements': createGeniferElementsTable,

  // Composites: agent-created reusable fragments
  '0003_genifer_composites': createGeniferCompositesTable,

  // Signals: append-only quality events on trees/elements/composites
  '0004_genifer_signals': createGeniferSignalsTable,

  // Composite rankings: materialized view for quality-sorted composites
  // Depends on composites table
  '0005_composite_rankings': createCompositeRankingsView,
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

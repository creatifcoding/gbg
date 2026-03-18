/**
 * SQLite migrations for @tmnl/datagrid.
 *
 * Uses Effect v4 Migrator.fromRecord — inline, versioned, transaction-wrapped.
 *
 * @module
 */

import type * as SqlClient from "effect-v4/unstable/sql/SqlClient"

// ─── Migration SQL ──────────────────────────────────

/** DDL for cells, columns, named_ranges tables */
export const MIGRATION_0001_INIT = `
  CREATE TABLE IF NOT EXISTS cells (
    sheet_id  TEXT    NOT NULL,
    col       INTEGER NOT NULL,
    row       INTEGER NOT NULL,
    payload   TEXT    NOT NULL DEFAULT '{"_tag":"Empty"}',
    clock     INTEGER NOT NULL DEFAULT 0,
    agent_id  TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (sheet_id, col, row)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS columns (
    sheet_id  TEXT    NOT NULL,
    col       INTEGER NOT NULL,
    name      TEXT    NOT NULL,
    dtype     TEXT    NOT NULL DEFAULT 'string',
    schema    TEXT,
    width     INTEGER DEFAULT 120,
    PRIMARY KEY (sheet_id, col)
  );

  CREATE TABLE IF NOT EXISTS named_ranges (
    sheet_id  TEXT    NOT NULL,
    name      TEXT    NOT NULL,
    start_col INTEGER NOT NULL,
    start_row INTEGER NOT NULL,
    end_col   INTEGER NOT NULL,
    end_row   INTEGER NOT NULL,
    PRIMARY KEY (sheet_id, name)
  );

  CREATE TABLE IF NOT EXISTS ops_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    sheet_id  TEXT    NOT NULL,
    col       INTEGER NOT NULL,
    row       INTEGER NOT NULL,
    payload   TEXT    NOT NULL,
    clock     INTEGER NOT NULL,
    agent_id  TEXT,
    timestamp TEXT    DEFAULT (datetime('now')),
    outcome   TEXT    NOT NULL DEFAULT 'applied'
  );
`

/** FTS5 index for cell content search */
export const MIGRATION_0002_FTS = `
  CREATE VIRTUAL TABLE IF NOT EXISTS cells_fts
    USING fts5(payload, content=cells, content_rowid=rowid);
`

// ─── Direct DDL execution (for spikes / no Migrator) ─

/**
 * Run all migrations directly on a sql client.
 * Used by spikes that don't need the full Migrator infrastructure.
 */
export function runMigrations(sql: SqlClient.SqlClient): void {
  // SqlClient.execute returns Effect — we use unsafe for direct sync spike usage
  // In production code, use Migrator.fromRecord
  ;(sql as any).executeRaw?.(MIGRATION_0001_INIT)
  // FTS5 may fail on some builds — non-critical for spikes
  try {
    ;(sql as any).executeRaw?.(MIGRATION_0002_FTS)
  } catch {
    // FTS5 not available — skip
  }
}

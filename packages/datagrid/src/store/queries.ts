/**
 * SQLite queries for @tmnl/datagrid.
 *
 * Typed query helpers that work with the cells, columns,
 * named_ranges, and ops_log tables defined in migrations.ts.
 *
 * These are pure functions that return SQL strings + params.
 * Consumers execute them via their SqlClient.
 *
 * @module
 */

import type { CellValue } from "../schemas/cell-value"
import type { RangeRect, ColRow } from "../schemas/addressing"

// ─── Cell queries ───────────────────────────────────

export interface CellRow {
  readonly sheet_id: string
  readonly col: number
  readonly row: number
  readonly payload: string
  readonly clock: number
  readonly agent_id: string | null
  readonly updated_at: string
}

export const cellQueries = {
  /** Read a single cell */
  get: (sheetId: string, col: number, row: number) => ({
    sql: `SELECT * FROM cells WHERE sheet_id = ? AND col = ? AND row = ?`,
    params: [sheetId, col, row] as const,
  }),

  /** Upsert a cell */
  upsert: (sheetId: string, col: number, row: number, payload: string, clock: number, agentId: string | null) => ({
    sql: `INSERT INTO cells (sheet_id, col, row, payload, clock, agent_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(sheet_id, col, row) DO UPDATE SET
            payload = excluded.payload,
            clock = excluded.clock,
            agent_id = excluded.agent_id,
            updated_at = datetime('now')`,
    params: [sheetId, col, row, payload, clock, agentId] as const,
  }),

  /** Read a range of cells */
  range: (sheetId: string, range: RangeRect) => ({
    sql: `SELECT * FROM cells
          WHERE sheet_id = ?
            AND col >= ? AND col <= ?
            AND row >= ? AND row <= ?
          ORDER BY row, col`,
    params: [sheetId, range.start.col, range.end.col, range.start.row, range.end.row] as const,
  }),

  /** Read all cells for a sheet */
  allForSheet: (sheetId: string) => ({
    sql: `SELECT * FROM cells WHERE sheet_id = ? ORDER BY row, col`,
    params: [sheetId] as const,
  }),

  /** Delete a cell */
  delete: (sheetId: string, col: number, row: number) => ({
    sql: `DELETE FROM cells WHERE sheet_id = ? AND col = ? AND row = ?`,
    params: [sheetId, col, row] as const,
  }),

  /** Delete all cells in a range */
  deleteRange: (sheetId: string, range: RangeRect) => ({
    sql: `DELETE FROM cells
          WHERE sheet_id = ?
            AND col >= ? AND col <= ?
            AND row >= ? AND row <= ?`,
    params: [sheetId, range.start.col, range.end.col, range.start.row, range.end.row] as const,
  }),

  /** Count cells for a sheet */
  count: (sheetId: string) => ({
    sql: `SELECT COUNT(*) as cnt FROM cells WHERE sheet_id = ?`,
    params: [sheetId] as const,
  }),

  /** Query by json_extract on payload _tag */
  byTag: (sheetId: string, tag: string) => ({
    sql: `SELECT * FROM cells
          WHERE sheet_id = ?
            AND json_extract(payload, '$._tag') = ?
          ORDER BY row, col`,
    params: [sheetId, tag] as const,
  }),
} as const

// ─── Column queries ─────────────────────────────────

export interface ColumnRow {
  readonly sheet_id: string
  readonly col: number
  readonly name: string
  readonly dtype: string
  readonly schema: string | null
  readonly width: number
}

export const columnQueries = {
  /** Get all columns for a sheet */
  allForSheet: (sheetId: string) => ({
    sql: `SELECT * FROM columns WHERE sheet_id = ? ORDER BY col`,
    params: [sheetId] as const,
  }),

  /** Get a single column */
  get: (sheetId: string, col: number) => ({
    sql: `SELECT * FROM columns WHERE sheet_id = ? AND col = ?`,
    params: [sheetId, col] as const,
  }),

  /** Upsert a column */
  upsert: (sheetId: string, col: number, name: string, dtype: string, schema: string | null, width: number) => ({
    sql: `INSERT INTO columns (sheet_id, col, name, dtype, schema, width)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(sheet_id, col) DO UPDATE SET
            name = excluded.name,
            dtype = excluded.dtype,
            schema = excluded.schema,
            width = excluded.width`,
    params: [sheetId, col, name, dtype, schema, width] as const,
  }),

  /** Delete a column */
  delete: (sheetId: string, col: number) => ({
    sql: `DELETE FROM columns WHERE sheet_id = ? AND col = ?`,
    params: [sheetId, col] as const,
  }),
} as const

// ─── Named range queries ────────────────────────────

export interface NamedRangeRow {
  readonly sheet_id: string
  readonly name: string
  readonly start_col: number
  readonly start_row: number
  readonly end_col: number
  readonly end_row: number
}

export const namedRangeQueries = {
  /** Get a named range */
  get: (sheetId: string, name: string) => ({
    sql: `SELECT * FROM named_ranges WHERE sheet_id = ? AND name = ?`,
    params: [sheetId, name] as const,
  }),

  /** List all named ranges for a sheet */
  allForSheet: (sheetId: string) => ({
    sql: `SELECT * FROM named_ranges WHERE sheet_id = ? ORDER BY name`,
    params: [sheetId] as const,
  }),

  /** Upsert a named range */
  upsert: (sheetId: string, name: string, range: RangeRect) => ({
    sql: `INSERT INTO named_ranges (sheet_id, name, start_col, start_row, end_col, end_row)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(sheet_id, name) DO UPDATE SET
            start_col = excluded.start_col,
            start_row = excluded.start_row,
            end_col = excluded.end_col,
            end_row = excluded.end_row`,
    params: [sheetId, name, range.start.col, range.start.row, range.end.col, range.end.row] as const,
  }),

  /** Delete a named range */
  delete: (sheetId: string, name: string) => ({
    sql: `DELETE FROM named_ranges WHERE sheet_id = ? AND name = ?`,
    params: [sheetId, name] as const,
  }),

  /** Convert row → RangeRect */
  toRangeRect: (row: NamedRangeRow): RangeRect => ({
    start: { col: row.start_col, row: row.start_row },
    end: { col: row.end_col, row: row.end_row },
  }),
} as const

// ─── Ops log queries ────────────────────────────────

export interface OpsLogRow {
  readonly id: number
  readonly sheet_id: string
  readonly col: number
  readonly row: number
  readonly payload: string
  readonly clock: number
  readonly agent_id: string | null
  readonly timestamp: string
  readonly outcome: string
}

export const opsLogQueries = {
  /** Insert an op */
  insert: (sheetId: string, col: number, row: number, payload: string, clock: number, agentId: string | null, outcome: string) => ({
    sql: `INSERT INTO ops_log (sheet_id, col, row, payload, clock, agent_id, outcome)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params: [sheetId, col, row, payload, clock, agentId, outcome] as const,
  }),

  /** Recent ops */
  recent: (sheetId: string, limit: number = 100) => ({
    sql: `SELECT * FROM ops_log WHERE sheet_id = ? ORDER BY id DESC LIMIT ?`,
    params: [sheetId, limit] as const,
  }),

  /** Ops for a specific cell */
  forCell: (sheetId: string, col: number, row: number, limit: number = 50) => ({
    sql: `SELECT * FROM ops_log
          WHERE sheet_id = ? AND col = ? AND row = ?
          ORDER BY id DESC LIMIT ?`,
    params: [sheetId, col, row, limit] as const,
  }),

  /** Count ops */
  count: (sheetId: string) => ({
    sql: `SELECT COUNT(*) as cnt FROM ops_log WHERE sheet_id = ?`,
    params: [sheetId] as const,
  }),

  /** Prune old ops */
  prune: (sheetId: string, keepLast: number) => ({
    sql: `DELETE FROM ops_log
          WHERE sheet_id = ? AND id NOT IN (
            SELECT id FROM ops_log WHERE sheet_id = ? ORDER BY id DESC LIMIT ?
          )`,
    params: [sheetId, sheetId, keepLast] as const,
  }),
} as const

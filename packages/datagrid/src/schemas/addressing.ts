/**
 * Cell addressing — Hybrid A1/R1C1/Named system.
 *
 * Internal canonical form is ColRow (0-indexed col, row).
 * A1 notation is sugar: "A1" → { col: 0, row: 0 }.
 * Named ranges are aliases stored in SQLite.
 *
 * CellKey is a Schema-branded TemplateLiteral "${number}:${number}".
 * HashMap-friendly O(1) identity. Every Cell owns one.
 *
 * @module
 */

import { Schema } from "effect"

// ─── Core address types ─────────────────────────────

export interface ColRow {
  readonly col: number
  readonly row: number
}

export interface RangeRect {
  readonly start: ColRow
  readonly end: ColRow
}

/** Anything that can identify a single cell */
export type CellAddress = ColRow | string

/** Anything that can identify a rectangular range */
export type RangeAddress = RangeRect | string

// ─── A1 ↔ ColRow conversion ────────────────────────

const A_CODE = "A".charCodeAt(0)

/** Column letters to 0-indexed number: A→0, B→1, Z→25, AA→26 */
export function colLetterToIndex(letters: string): number {
  let index = 0
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - A_CODE + 1)
  }
  return index - 1
}

/** 0-indexed column number to letters: 0→A, 1→B, 25→Z, 26→AA */
export function colIndexToLetter(index: number): string {
  let result = ""
  let n = index + 1
  while (n > 0) {
    n--
    result = String.fromCharCode(A_CODE + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

const A1_PATTERN = /^([A-Z]+)(\d+)$/

/** Parse "A1" → { col: 0, row: 0 }. Returns null if not A1 notation. */
export function parseA1(addr: string): ColRow | null {
  const match = addr.toUpperCase().match(A1_PATTERN)
  if (!match) return null
  return {
    col: colLetterToIndex(match[1]),
    row: parseInt(match[2], 10) - 1,
  }
}

/** Format { col: 0, row: 0 } → "A1" */
export function formatA1(addr: ColRow): string {
  return `${colIndexToLetter(addr.col)}${addr.row + 1}`
}

/** Resolve any CellAddress to canonical ColRow */
export function resolveCell(addr: CellAddress): ColRow {
  if (typeof addr === "object") return addr
  const parsed = parseA1(addr)
  if (parsed) return parsed
  throw new Error(`Cannot resolve cell address: "${addr}" — not A1 notation and not a named range`)
}

// ─── Range parsing ──────────────────────────────────

const RANGE_PATTERN = /^([A-Z]+\d+):([A-Z]+\d+)$/

/** Parse "A1:C10" → RangeRect. Returns null if not a range string. */
export function parseRange(addr: string): RangeRect | null {
  const match = addr.toUpperCase().match(RANGE_PATTERN)
  if (!match) return null
  const start = parseA1(match[1])
  const end = parseA1(match[2])
  if (!start || !end) return null
  return { start, end }
}

/** Format RangeRect → "A1:C10" */
export function formatRange(range: RangeRect): string {
  return `${formatA1(range.start)}:${formatA1(range.end)}`
}

/** Resolve any RangeAddress to canonical RangeRect */
export function resolveRange(addr: RangeAddress): RangeRect {
  if (typeof addr === "object") return addr
  const parsed = parseRange(addr)
  if (parsed) return parsed
  throw new Error(`Cannot resolve range address: "${addr}"`)
}

// ─── Range iteration ────────────────────────────────

/** Iterate all ColRow addresses in a range, row-major order */
export function* iterateRange(range: RangeRect): Generator<ColRow> {
  for (let row = range.start.row; row <= range.end.row; row++) {
    for (let col = range.start.col; col <= range.end.col; col++) {
      yield { col, row }
    }
  }
}

/** Count cells in a range */
export function rangeSize(range: RangeRect): number {
  return (range.end.col - range.start.col + 1) * (range.end.row - range.start.row + 1)
}

// ─── CellKey (Schema-branded) ───────────────────────

/**
 * Schema-branded cell key: `${sheetId}:${col}:${row}`.
 *
 * Sheet-relative identity. Every Cell owns one.
 * Globally unique across sheets in the same grid.
 *
 * - Branded via `Schema.brand("CellKey")` — plain strings
 *   are not assignable without going through the schema.
 * - Pattern validated at decode time via Schema.filter.
 * - HashMap-friendly O(1) lookup.
 *
 * Construction:
 *   cellKey("sheet-1", { col: 3, row: 7 })  → CellKey "sheet-1:3:7"
 *   CellKeySchema.make("sheet-1:3:7") → CellKey (unchecked)
 *   Schema.decodeSync(CellKeySchema)(str)   → CellKey (validated)
 */
const CELLKEY_RE = /^[^:]+:\d+:\d+$/

export const CellKeySchema = Schema.String
  .check(Schema.makeFilter<string>(
    (s) => CELLKEY_RE.test(s) ? undefined : "Expected format: sheetId:col:row",
    { expected: "CellKey (sheetId:col:row)" },
  ))
  .pipe(Schema.brand("CellKey"))

export type CellKey = typeof CellKeySchema.Type

/** Stable branded key for a cell: sheetId + ColRow → CellKey */
export function cellKey(sheetId: string, addr: ColRow): CellKey {
  return CellKeySchema.make(`${sheetId}:${addr.col}:${addr.row}`)
}

/** Parse CellKey back to { sheetId, col, row } */
export function parseCellKey(key: CellKey): { sheetId: string; col: number; row: number } {
  const s = key as string
  const lastColon = s.lastIndexOf(":")
  const midColon = s.lastIndexOf(":", lastColon - 1)
  return {
    sheetId: s.slice(0, midColon),
    col: parseInt(s.slice(midColon + 1, lastColon), 10),
    row: parseInt(s.slice(lastColon + 1), 10),
  }
}

/** Validate an arbitrary string as CellKey */
export function validateCellKey(s: string): CellKey | null {
  return CELLKEY_RE.test(s) ? CellKeySchema.make(s) : null
}

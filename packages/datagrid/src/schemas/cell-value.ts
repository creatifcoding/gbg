/**
 * CellValue — Effect v4 Schema discriminated union for cell payloads.
 *
 * 8 variants: Empty, Number, String, Boolean, Date, Json, Error, Formula.
 * Encoded as JSON TEXT in SQLite via Schema.decodeTo + SchemaTransformation.fromJsonString.
 *
 * @module
 */

import { Schema, SchemaGetter } from "effect"

// ─── Cell value variants (TaggedStruct) ─────────────

export const CellEmpty = Schema.TaggedStruct("Empty", {})

export const CellNumber = Schema.TaggedStruct("Number", {
  value: Schema.Number,
})

export const CellString = Schema.TaggedStruct("String", {
  value: Schema.String,
})

export const CellBoolean = Schema.TaggedStruct("Boolean", {
  value: Schema.Boolean,
})

export const CellDate = Schema.TaggedStruct("Date", {
  /** ISO 8601 string */
  value: Schema.String,
})

export const CellJson = Schema.TaggedStruct("Json", {
  value: Schema.Unknown,
})

export const CellError = Schema.TaggedStruct("Error", {
  error: Schema.String,
})

export const CellFormula = Schema.TaggedStruct("Formula", {
  /** Source expression (e.g. "=A1+B1") or Effect program identifier */
  src: Schema.String,
  /** Addresses this formula depends on (for DAG) */
  deps: Schema.Array(Schema.String),
  /** Cached computed result (null if not yet evaluated) */
  cached: Schema.NullOr(Schema.Unknown),
})

// ─── Union ──────────────────────────────────────────

export const CellValue = Schema.Union([
  CellEmpty,
  CellNumber,
  CellString,
  CellBoolean,
  CellDate,
  CellJson,
  CellError,
  CellFormula,
])
export type CellValue = typeof CellValue.Type

// ─── JSON codec: String ↔ CellValue ────────────────
// v4 pattern: Schema.String.pipe(Schema.decodeTo(target, { decode, encode }))

export const CellValueFromString = Schema.String.pipe(
  Schema.decodeTo(CellValue, {
    decode: SchemaGetter.transform((s: string) => JSON.parse(s) as CellValue),
    encode: SchemaGetter.transform((v: CellValue) => JSON.stringify(v)),
  })
)

// ─── Constructors ───────────────────────────────────

export const empty = (): CellValue => ({ _tag: "Empty" })
export const num = (value: number): CellValue => ({ _tag: "Number", value })
export const str = (value: string): CellValue => ({ _tag: "String", value })
export const bool = (value: boolean): CellValue => ({ _tag: "Boolean", value })
export const date = (value: string | globalThis.Date): CellValue => ({
  _tag: "Date",
  value: value instanceof globalThis.Date ? value.toISOString() : value,
})
export const json = (value: unknown): CellValue => ({ _tag: "Json", value })
export const error = (msg: string): CellValue => ({ _tag: "Error", error: msg })
export const formula = (src: string, deps: string[] = [], cached: unknown = null): CellValue => ({
  _tag: "Formula", src, deps, cached,
})

// ─── Extractors ─────────────────────────────────────

/** Extract numeric value from cell, or 0 */
export const extractNumber = (cell: CellValue): number => {
  switch (cell._tag) {
    case "Number": return cell.value
    case "Boolean": return cell.value ? 1 : 0
    case "String": { const n = parseFloat(cell.value); return isNaN(n) ? 0 : n }
    case "Formula": return typeof cell.cached === "object" && cell.cached !== null
      ? extractNumber(cell.cached as CellValue)
      : 0
    default: return 0
  }
}

/** Extract display string from cell */
export const extractDisplay = (cell: CellValue): string => {
  switch (cell._tag) {
    case "Empty": return ""
    case "Number": return globalThis.String(cell.value)
    case "String": return cell.value
    case "Boolean": return cell.value ? "TRUE" : "FALSE"
    case "Date": return cell.value
    case "Json": return JSON.stringify(cell.value)
    case "Error": return `#ERR: ${cell.error}`
    case "Formula": return typeof cell.cached === "object" && cell.cached !== null
      ? extractDisplay(cell.cached as CellValue)
      : ""
  }
}

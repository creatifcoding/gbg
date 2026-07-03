/**
 * SchemaRegistry — G9
 *
 * Column-level default schema with per-cell override.
 *
 * Resolution chain:
 *   cell override → column schema → global default (CellValue)
 *
 * Each registered schema can validate and coerce values on write.
 * Context-injected, composable with CellCache.
 *
 * @module
 */

import { Effect, Context, Layer, Schema } from "effect"

import { CellValue } from "../schemas/cell-value"
import type { ColRow } from "../schemas/addressing"

// ─── Types ──────────────────────────────────────────

/**
 * A cell-level schema descriptor.
 *
 * `validate` checks a CellValue against column/cell constraints.
 * `coerce` optionally transforms a raw input into the expected type.
 */
export interface CellSchema {
  readonly id: string
  readonly name: string
  /** Validate a CellValue. Returns issues array (empty = valid). */
  readonly validate: (value: typeof CellValue.Type) => ReadonlyArray<string>
  /** Optional coercion: transform a value to the expected shape */
  readonly coerce?: (value: typeof CellValue.Type) => typeof CellValue.Type
}

/**
 * Column-level schema binding.
 */
export interface ColumnSchemaBinding {
  readonly colIndex: number
  readonly schema: CellSchema
}

// ─── Config ─────────────────────────────────────────

export interface SchemaRegistryConfigShape {
  /** Global default schemas to pre-register */
  readonly defaults?: ReadonlyArray<CellSchema>
  /** Column → schema bindings to pre-register */
  readonly columnBindings?: ReadonlyArray<ColumnSchemaBinding>
}

export class SchemaRegistryConfig extends Context.Service<SchemaRegistryConfig, SchemaRegistryConfigShape>()(
  "@tmnl/datagrid/SchemaRegistryConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface SchemaRegistryShape {
  // ── Schema CRUD ─────────────────────────────
  /** Register a reusable schema */
  readonly registerSchema: (schema: CellSchema) => void
  /** Get a schema by ID */
  readonly getSchema: (id: string) => CellSchema | undefined
  /** List all registered schemas */
  readonly listSchemas: () => ReadonlyArray<CellSchema>
  /** Remove a schema (unbinds all columns/cells using it) */
  readonly removeSchema: (id: string) => void

  // ── Column bindings ─────────────────────────
  /** Bind a schema to a column (all cells in that column use it) */
  readonly bindColumn: (colIndex: number, schemaId: string) => void
  /** Unbind a column schema */
  readonly unbindColumn: (colIndex: number) => void
  /** Get column binding */
  readonly getColumnBinding: (colIndex: number) => CellSchema | undefined

  // ── Cell overrides ──────────────────────────
  /** Override schema for a specific cell */
  readonly overrideCell: (addr: ColRow, schemaId: string) => void
  /** Remove cell-level override */
  readonly clearCellOverride: (addr: ColRow) => void
  /** Get cell-level override */
  readonly getCellOverride: (addr: ColRow) => CellSchema | undefined

  // ── Resolution ──────────────────────────────
  /**
   * Resolve the effective schema for a cell.
   * Priority: cell override → column binding → undefined (no validation)
   */
  readonly resolve: (addr: ColRow) => CellSchema | undefined

  /**
   * Validate a value against the resolved schema for a cell.
   * Returns issues array (empty = valid, undefined schema = always valid).
   */
  readonly validate: (addr: ColRow, value: typeof CellValue.Type) => ReadonlyArray<string>

  /**
   * Coerce a value through the resolved schema, if coercion is defined.
   * Returns original value if no coercion defined.
   */
  readonly coerce: (addr: ColRow, value: typeof CellValue.Type) => typeof CellValue.Type
}

// ─── Service tag ────────────────────────────────────

export class SchemaRegistry extends Context.Service<SchemaRegistry, SchemaRegistryShape>()(
  "@tmnl/datagrid/SchemaRegistry",
) {}

// ─── Layer implementation ───────────────────────────

const cellOverrideKey = (addr: ColRow): string => `${addr.col}:${addr.row}`

export const SchemaRegistryLive: Layer.Layer<SchemaRegistry, never, SchemaRegistryConfig> = Layer.effect(
  SchemaRegistry,
  Effect.gen(function*() {
    const config = yield* SchemaRegistryConfig

    // ── Internal state ──────────────────────────
    const schemas = new Map<string, CellSchema>()
    const columnBindings = new Map<number, string>() // colIndex → schemaId
    const cellOverrides = new Map<string, string>()   // "col:row" → schemaId

    // ── Pre-register defaults ───────────────────
    if (config.defaults) {
      for (const s of config.defaults) schemas.set(s.id, s)
    }
    if (config.columnBindings) {
      for (const b of config.columnBindings) {
        schemas.set(b.schema.id, b.schema)
        columnBindings.set(b.colIndex, b.schema.id)
      }
    }

    // ── Implementation ──────────────────────────

    const registerSchema = (schema: CellSchema): void => {
      schemas.set(schema.id, schema)
    }

    const getSchema = (id: string): CellSchema | undefined => schemas.get(id)

    const listSchemas = (): ReadonlyArray<CellSchema> => [...schemas.values()]

    const removeSchema = (id: string): void => {
      schemas.delete(id)
      // Unbind any columns/cells referencing this schema
      for (const [col, sid] of columnBindings) {
        if (sid === id) columnBindings.delete(col)
      }
      for (const [key, sid] of cellOverrides) {
        if (sid === id) cellOverrides.delete(key)
      }
    }

    const bindColumn = (colIndex: number, schemaId: string): void => {
      columnBindings.set(colIndex, schemaId)
    }

    const unbindColumn = (colIndex: number): void => {
      columnBindings.delete(colIndex)
    }

    const getColumnBinding = (colIndex: number): CellSchema | undefined => {
      const id = columnBindings.get(colIndex)
      return id ? schemas.get(id) : undefined
    }

    const overrideCell = (addr: ColRow, schemaId: string): void => {
      cellOverrides.set(cellOverrideKey(addr), schemaId)
    }

    const clearCellOverride = (addr: ColRow): void => {
      cellOverrides.delete(cellOverrideKey(addr))
    }

    const getCellOverride = (addr: ColRow): CellSchema | undefined => {
      const id = cellOverrides.get(cellOverrideKey(addr))
      return id ? schemas.get(id) : undefined
    }

    const resolve = (addr: ColRow): CellSchema | undefined => {
      // Priority: cell override → column binding
      const cellId = cellOverrides.get(cellOverrideKey(addr))
      if (cellId) {
        const s = schemas.get(cellId)
        if (s) return s
      }
      const colId = columnBindings.get(addr.col)
      if (colId) {
        const s = schemas.get(colId)
        if (s) return s
      }
      return undefined
    }

    const validate = (addr: ColRow, value: typeof CellValue.Type): ReadonlyArray<string> => {
      const schema = resolve(addr)
      if (!schema) return [] // No schema = always valid
      return schema.validate(value)
    }

    const coerce = (addr: ColRow, value: typeof CellValue.Type): typeof CellValue.Type => {
      const schema = resolve(addr)
      if (!schema?.coerce) return value
      return schema.coerce(value)
    }

    return SchemaRegistry.of({
      registerSchema, getSchema, listSchemas, removeSchema,
      bindColumn, unbindColumn, getColumnBinding,
      overrideCell, clearCellOverride, getCellOverride,
      resolve, validate, coerce,
    })
  }),
)

// ─── Built-in schemas ───────────────────────────────

/** Only allows Number cells */
export const NumberOnlySchema: CellSchema = {
  id: "builtin:number-only",
  name: "Number Only",
  validate: (v) => v._tag === "Number" || v._tag === "Empty" ? [] : [`Expected Number, got ${v._tag}`],
  coerce: (v) => {
    if (v._tag === "String") {
      const n = parseFloat(v.value)
      if (!isNaN(n)) return { _tag: "Number", value: n } as typeof CellValue.Type
    }
    return v
  },
}

/** Only allows String cells */
export const StringOnlySchema: CellSchema = {
  id: "builtin:string-only",
  name: "String Only",
  validate: (v) => v._tag === "String" || v._tag === "Empty" ? [] : [`Expected String, got ${v._tag}`],
}

/** Only allows Boolean cells */
export const BooleanOnlySchema: CellSchema = {
  id: "builtin:boolean-only",
  name: "Boolean Only",
  validate: (v) => v._tag === "Boolean" || v._tag === "Empty" ? [] : [`Expected Boolean, got ${v._tag}`],
}

/** Number within range */
export const numberRangeSchema = (min: number, max: number): CellSchema => ({
  id: `builtin:number-range-${min}-${max}`,
  name: `Number [${min}, ${max}]`,
  validate: (v) => {
    if (v._tag === "Empty") return []
    if (v._tag !== "Number") return [`Expected Number, got ${v._tag}`]
    if (v.value < min) return [`Value ${v.value} below minimum ${min}`]
    if (v.value > max) return [`Value ${v.value} above maximum ${max}`]
    return []
  },
  coerce: (v) => {
    if (v._tag === "Number") {
      return { _tag: "Number", value: Math.min(max, Math.max(min, v.value)) } as typeof CellValue.Type
    }
    return v
  },
})

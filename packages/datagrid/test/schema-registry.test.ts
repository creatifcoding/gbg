/**
 * SchemaRegistry tests (G9)
 *
 * Validates schema CRUD, column bindings, cell overrides,
 * resolution chain, validation, coercion, and built-in schemas.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer, Context } from "effect"

import { num, str, bool, empty, type CellValue } from "../src/schemas/cell-value"
import type { ColRow } from "../src/schemas/addressing"
import {
  SchemaRegistry, SchemaRegistryConfig, SchemaRegistryLive,
  NumberOnlySchema, StringOnlySchema, BooleanOnlySchema,
  numberRangeSchema,
  type CellSchema,
} from "../src/services/schema-registry"

// ─── Test harness ───────────────────────────────────

const addr = (col: number, row: number): ColRow => ({ col, row })

function makeRegistry(opts?: { defaults?: CellSchema[]; columnBindings?: { colIndex: number; schema: CellSchema }[] }) {
  const configLayer = Layer.succeed(SchemaRegistryConfig)(SchemaRegistryConfig.of({
    defaults: opts?.defaults,
    columnBindings: opts?.columnBindings,
  }))
  const layer = Layer.provide(SchemaRegistryLive, configLayer)
  return Effect.runSync(Effect.gen(function*() {
    const sm = yield* Effect.scoped(layer.pipe(Layer.build))
    return Context.get(sm, SchemaRegistry)
  }))
}

// ─── Tests ──────────────────────────────────────────

describe("SchemaRegistry (G9)", () => {

  // ── Schema CRUD ───────────────────────────────

  describe("schema CRUD", () => {
    it("registers and retrieves a schema", () => {
      const reg = makeRegistry()
      reg.registerSchema(NumberOnlySchema)
      expect(reg.getSchema("builtin:number-only")).toBe(NumberOnlySchema)
    })

    it("lists all registered schemas", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema, StringOnlySchema] })
      const list = reg.listSchemas()
      expect(list.length).toBe(2)
      expect(list.map(s => s.id)).toContain("builtin:number-only")
      expect(list.map(s => s.id)).toContain("builtin:string-only")
    })

    it("removes a schema and unbinds all references", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")
      reg.overrideCell(addr(0, 0), "builtin:number-only")

      reg.removeSchema("builtin:number-only")

      expect(reg.getSchema("builtin:number-only")).toBeUndefined()
      expect(reg.getColumnBinding(0)).toBeUndefined()
      expect(reg.getCellOverride(addr(0, 0))).toBeUndefined()
    })
  })

  // ── Column bindings ───────────────────────────

  describe("column bindings", () => {
    it("binds and resolves column schema", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")

      expect(reg.getColumnBinding(0)).toBe(NumberOnlySchema)
      expect(reg.resolve(addr(0, 5))).toBe(NumberOnlySchema)
    })

    it("unbinds column schema", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")
      reg.unbindColumn(0)

      expect(reg.getColumnBinding(0)).toBeUndefined()
      expect(reg.resolve(addr(0, 5))).toBeUndefined()
    })

    it("pre-registers column bindings from config", () => {
      const reg = makeRegistry({
        columnBindings: [{ colIndex: 0, schema: NumberOnlySchema }],
      })
      expect(reg.getColumnBinding(0)).toBe(NumberOnlySchema)
    })
  })

  // ── Cell overrides ────────────────────────────

  describe("cell overrides", () => {
    it("overrides column schema for a specific cell", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema, StringOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")
      reg.overrideCell(addr(0, 3), "builtin:string-only")

      // Cell override wins
      expect(reg.resolve(addr(0, 3))).toBe(StringOnlySchema)
      // Other cells in same column use column binding
      expect(reg.resolve(addr(0, 0))).toBe(NumberOnlySchema)
    })

    it("clears cell override, falls back to column", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema, StringOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")
      reg.overrideCell(addr(0, 3), "builtin:string-only")
      reg.clearCellOverride(addr(0, 3))

      expect(reg.resolve(addr(0, 3))).toBe(NumberOnlySchema)
    })
  })

  // ── Resolution chain ──────────────────────────

  describe("resolution", () => {
    it("returns undefined when no schema bound", () => {
      const reg = makeRegistry()
      expect(reg.resolve(addr(5, 5))).toBeUndefined()
    })

    it("cell override → column binding → undefined", () => {
      const reg = makeRegistry({
        defaults: [NumberOnlySchema, StringOnlySchema, BooleanOnlySchema],
      })

      // No binding → undefined
      expect(reg.resolve(addr(0, 0))).toBeUndefined()

      // Column binding
      reg.bindColumn(0, "builtin:number-only")
      expect(reg.resolve(addr(0, 0))?.id).toBe("builtin:number-only")

      // Cell override takes precedence
      reg.overrideCell(addr(0, 0), "builtin:string-only")
      expect(reg.resolve(addr(0, 0))?.id).toBe("builtin:string-only")
    })
  })

  // ── Validation ────────────────────────────────

  describe("validation", () => {
    it("no schema → always valid", () => {
      const reg = makeRegistry()
      expect(reg.validate(addr(0, 0), num(42))).toEqual([])
      expect(reg.validate(addr(0, 0), str("hi"))).toEqual([])
    })

    it("NumberOnly rejects String", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")

      expect(reg.validate(addr(0, 0), num(42))).toEqual([])
      expect(reg.validate(addr(0, 0), empty())).toEqual([])
      expect(reg.validate(addr(0, 0), str("oops"))).toHaveLength(1)
    })

    it("numberRangeSchema validates bounds", () => {
      const schema = numberRangeSchema(0, 100)
      const reg = makeRegistry({ defaults: [schema] })
      reg.bindColumn(0, schema.id)

      expect(reg.validate(addr(0, 0), num(50))).toEqual([])
      expect(reg.validate(addr(0, 0), num(-1))).toHaveLength(1)
      expect(reg.validate(addr(0, 0), num(101))).toHaveLength(1)
      expect(reg.validate(addr(0, 0), empty())).toEqual([])
    })
  })

  // ── Coercion ──────────────────────────────────

  describe("coercion", () => {
    it("no schema → passthrough", () => {
      const reg = makeRegistry()
      const v = str("hello")
      expect(reg.coerce(addr(0, 0), v)).toBe(v)
    })

    it("NumberOnly coerces String '42' to Number", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")

      const result = reg.coerce(addr(0, 0), str("42"))
      expect(result).toEqual(num(42))
    })

    it("NumberOnly leaves non-numeric String unchanged", () => {
      const reg = makeRegistry({ defaults: [NumberOnlySchema] })
      reg.bindColumn(0, "builtin:number-only")

      const v = str("abc")
      expect(reg.coerce(addr(0, 0), v)).toBe(v)
    })

    it("numberRangeSchema clamps values", () => {
      const schema = numberRangeSchema(0, 100)
      const reg = makeRegistry({ defaults: [schema] })
      reg.bindColumn(0, schema.id)

      expect(reg.coerce(addr(0, 0), num(150))).toEqual(num(100))
      expect(reg.coerce(addr(0, 0), num(-50))).toEqual(num(0))
      expect(reg.coerce(addr(0, 0), num(50))).toEqual(num(50))
    })
  })

  // ── Built-in schemas ──────────────────────────

  describe("built-in schemas", () => {
    it("BooleanOnlySchema validates correctly", () => {
      expect(BooleanOnlySchema.validate(bool(true))).toEqual([])
      expect(BooleanOnlySchema.validate(empty())).toEqual([])
      expect(BooleanOnlySchema.validate(num(1))).toHaveLength(1)
    })

    it("StringOnlySchema validates correctly", () => {
      expect(StringOnlySchema.validate(str("hi"))).toEqual([])
      expect(StringOnlySchema.validate(empty())).toEqual([])
      expect(StringOnlySchema.validate(num(1))).toHaveLength(1)
    })
  })
})

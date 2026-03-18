/**
 * AG-Grid Bridge — readOnlyEdit tests (G5 + SYN-1)
 *
 * Validates the STX-Primary architecture:
 * - cellEditRequest → validate → coerce → commit pipeline
 * - UndoStack integration
 * - SchemaRegistry integration
 * - Error atom routing
 * - Paste handling
 * - gridOptions fragment
 */

import { describe, it, expect, vi } from "vitest"
import { Effect, Layer, ServiceMap } from "effect-v4"
import { AtomRegistry } from "effect-v4/unstable/reactivity"

import {
  num, str, bool, empty, type CellValue, extractDisplay,
} from "../src/schemas/cell-value"
import type { ColRow } from "../src/schemas/addressing"
import { cellKey } from "../src/schemas/addressing"

import { CellCache, CellCacheConfig, CellCacheLive } from "../src/services/cell-cache"
import { UndoStack, UndoStackConfig, UndoStackLive } from "../src/services/undo-stack"
import { SchemaRegistry, SchemaRegistryConfig, SchemaRegistryLive, NumberOnlySchema, numberRangeSchema } from "../src/services/schema-registry"
import { makeCellErrorStore } from "../src/services/cell-errors"

import {
  GridBridge, generateColDefs, generateDefaultColDefs, parseEditorValue,
  type GridBridgeConfig, type EditRequestResult,
} from "../src/bridge/ag-grid"
import type { GridTransaction } from "../src/bridge/transactions"

// ─── Harness ────────────────────────────────────────

const addr = (col: number, row: number): ColRow => ({ col, row })

function makeTestEnv(opts?: {
  schemaDefaults?: Parameters<typeof SchemaRegistryConfig.of>[0]["defaults"]
  columnBindings?: Parameters<typeof SchemaRegistryConfig.of>[0]["columnBindings"]
}) {
  const registry = AtomRegistry.make()
  const sheetId = "test"
  const db = new Map<string, CellValue>()
  const applied: GridTransaction[] = []

  // Build CellCache
  const cellCacheConfigLayer = Layer.succeed(CellCacheConfig)(CellCacheConfig.of({
    sheetId, registry,
    readCell: (sid, col, row) => db.get(cellKey(sid, { col, row })) ?? null,
    writeCell: (sid, col, row, value) => Effect.sync(() => { db.set(cellKey(sid, { col, row }), value) }),
    writeCellBulk: (sid, entries) => Effect.sync(() => {
      for (const e of entries) db.set(cellKey(sid, { col: e.col, row: e.row }), e.value)
    }),
  }))
  const cellCacheLayer = Layer.provide(CellCacheLive, cellCacheConfigLayer)
  const ccSM = Effect.runSync(Effect.scoped(cellCacheLayer.pipe(Layer.build)))
  const cellCache = ServiceMap.get(ccSM, CellCache)

  // Build UndoStack
  const undoConfigLayer = Layer.succeed(UndoStackConfig)(UndoStackConfig.of({ registry, cellCache }))
  const undoLayer = Layer.provide(UndoStackLive, undoConfigLayer)
  const undoSM = Effect.runSync(Effect.scoped(undoLayer.pipe(Layer.build)))
  const undoStack = ServiceMap.get(undoSM, UndoStack)

  // Build SchemaRegistry
  const schemaConfigLayer = Layer.succeed(SchemaRegistryConfig)(SchemaRegistryConfig.of({
    defaults: opts?.schemaDefaults,
    columnBindings: opts?.columnBindings,
  }))
  const schemaLayer = Layer.provide(SchemaRegistryLive, schemaConfigLayer)
  const schemaSM = Effect.runSync(Effect.scoped(schemaLayer.pipe(Layer.build)))
  const schemaRegistry = ServiceMap.get(schemaSM, SchemaRegistry)

  // Build ErrorStore
  const errorStore = makeCellErrorStore(registry, sheetId)

  // Fake datagrid shape (minimal — only what bridge needs)
  const datagrid = {
    sheetId,
    cells: cellCache,
    registry,
    getCell: (a: ColRow) => cellCache.get(a),
    getCellAtom: (a: ColRow) => cellCache.getAtom(a),
    family: cellCache.family,
  } as any

  // Build bridge
  const bridge = new GridBridge({
    datagrid,
    applyTransaction: (tx) => applied.push(tx),
    scheduleFlush: (cb) => cb(), // Synchronous for tests
    undoStack,
    schemaRegistry,
    errorStore,
  })

  return { bridge, cellCache, undoStack, schemaRegistry, errorStore, registry, applied, db }
}

// ─── Tests ──────────────────────────────────────────

describe("AG-Grid Bridge — readOnlyEdit (G5 + SYN-1)", () => {

  // ── parseEditorValue ──────────────────────────

  describe("parseEditorValue", () => {
    it("empty string → Empty", () => {
      expect(parseEditorValue("")).toEqual(empty())
    })

    it("numeric string → Number", () => {
      expect(parseEditorValue("42")).toEqual(num(42))
      expect(parseEditorValue("3.14")).toEqual(num(3.14))
    })

    it("boolean strings → Boolean", () => {
      expect(parseEditorValue("true")).toEqual(bool(true))
      expect(parseEditorValue("FALSE")).toEqual(bool(false))
    })

    it("text → String", () => {
      expect(parseEditorValue("hello")).toEqual(str("hello"))
      expect(parseEditorValue("42abc")).toEqual(str("42abc"))
    })

    it("respects dtype hint for number", () => {
      expect(parseEditorValue("42", "number")).toEqual(num(42))
    })
  })

  // ── cellEditRequest pipeline ──────────────────

  describe("handleCellEditRequest", () => {
    it("commits a valid edit through STX pipeline", () => {
      const { bridge, cellCache } = makeTestEnv()

      const result = bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "42",
      })

      expect(result.success).toBe(true)
      expect(result.addr).toEqual({ col: 0, row: 0 })
      expect(cellCache.get({ col: 0, row: 0 })).toEqual(num(42))
    })

    it("records in UndoStack", () => {
      const { bridge, undoStack, cellCache } = makeTestEnv()

      bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "hello",
      })

      expect(undoStack.canUndo()).toBe(true)
      Effect.runSync(undoStack.undo())
      expect(cellCache.get({ col: 0, row: 0 })).toEqual(empty())
    })

    it("validates via SchemaRegistry — rejects invalid", () => {
      const { bridge, cellCache, errorStore } = makeTestEnv({
        schemaDefaults: [NumberOnlySchema],
        columnBindings: [{ colIndex: 0, schema: NumberOnlySchema }],
      })

      const result = bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "not-a-number",
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.source).toBe("validation")

      // Cell unchanged
      expect(cellCache.get({ col: 0, row: 0 })).toEqual(empty())

      // Error atom populated
      expect(errorStore.getError({ col: 0, row: 0 })).not.toBeNull()
    })

    it("coerces via SchemaRegistry before validation", () => {
      const { bridge, cellCache } = makeTestEnv({
        schemaDefaults: [NumberOnlySchema],
        columnBindings: [{ colIndex: 0, schema: NumberOnlySchema }],
      })

      // String "42" → coerced to Number 42 → passes validation
      const result = bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "42",
      })

      expect(result.success).toBe(true)
      expect(cellCache.get({ col: 0, row: 0 })).toEqual(num(42))
    })

    it("clears previous error on successful edit", () => {
      const { bridge, errorStore } = makeTestEnv({
        schemaDefaults: [NumberOnlySchema],
        columnBindings: [{ colIndex: 0, schema: NumberOnlySchema }],
      })

      // Invalid edit → error
      bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "oops",
      })
      expect(errorStore.getError({ col: 0, row: 0 })).not.toBeNull()

      // Valid edit → clears error
      bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "99",
      })
      expect(errorStore.getError({ col: 0, row: 0 })).toBeNull()
    })

    it("fires onEditResult callback", () => {
      const onEditResult = vi.fn()
      const env = makeTestEnv()
      const bridge = new GridBridge({
        datagrid: env.bridge.datagrid,
        applyTransaction: () => {},
        scheduleFlush: (cb) => cb(),
        onEditResult,
      })

      bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "hello",
      })

      expect(onEditResult).toHaveBeenCalledOnce()
      expect(onEditResult.mock.calls[0]![0].success).toBe(true)
    })
  })

  // ── Paste handling ────────────────────────────

  describe("handlePasteRequest", () => {
    it("commits multiple cells atomically", () => {
      const { bridge, cellCache } = makeTestEnv()

      const results = bridge.handlePasteRequest([
        { addr: addr(0, 0), rawValue: "1" },
        { addr: addr(1, 0), rawValue: "2" },
        { addr: addr(2, 0), rawValue: "3" },
      ])

      expect(results.filter(r => r.success)).toHaveLength(3)
      expect(cellCache.get(addr(0, 0))).toEqual(num(1))
      expect(cellCache.get(addr(1, 0))).toEqual(num(2))
      expect(cellCache.get(addr(2, 0))).toEqual(num(3))
    })

    it("records paste as single undo entry", () => {
      const { bridge, undoStack, cellCache } = makeTestEnv()

      bridge.handlePasteRequest([
        { addr: addr(0, 0), rawValue: "A" },
        { addr: addr(1, 0), rawValue: "B" },
      ])

      expect(undoStack.undoDepth()).toBe(1)

      Effect.runSync(undoStack.undo())
      expect(cellCache.get(addr(0, 0))).toEqual(empty())
      expect(cellCache.get(addr(1, 0))).toEqual(empty())
    })

    it("rejects invalid cells, commits valid ones", () => {
      const { bridge, cellCache } = makeTestEnv({
        schemaDefaults: [NumberOnlySchema],
        columnBindings: [{ colIndex: 0, schema: NumberOnlySchema }],
      })

      const results = bridge.handlePasteRequest([
        { addr: addr(0, 0), rawValue: "42" },   // valid (col 0 = number-only)
        { addr: addr(0, 1), rawValue: "oops" },  // invalid (col 0 = number-only)
        { addr: addr(1, 0), rawValue: "hello" }, // valid (col 1 = no schema)
      ])

      const succeeded = results.filter(r => r.success)
      const failed = results.filter(r => !r.success)

      expect(succeeded).toHaveLength(2)
      expect(failed).toHaveLength(1)
      expect(failed[0]!.addr).toEqual(addr(0, 1))
    })
  })

  // ── gridOptions ───────────────────────────────

  describe("gridOptions", () => {
    it("returns readOnlyEdit fragment", () => {
      const { bridge } = makeTestEnv()
      const opts = bridge.gridOptions()

      expect(opts.readOnlyEdit).toBe(true)
      expect(opts.undoRedoCellEditing).toBe(false)
      expect(typeof opts.onCellEditRequest).toBe("function")
      expect(typeof opts.getRowId).toBe("function")
    })
  })

  // ── Atom → AG-Grid subscription ───────────────

  describe("subscribeRange", () => {
    it("queues AG-Grid transactions on atom changes", () => {
      const { bridge, cellCache, applied } = makeTestEnv()

      bridge.subscribeRange(0, 0, [0, 1])

      // Write to cell → should trigger subscription → queue transaction
      Effect.runSync(cellCache.transactionalSetBulk([
        { addr: addr(0, 0), value: num(42) },
      ]))

      bridge.flush()

      expect(applied.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── generateColDefs ───────────────────────────

  describe("generateColDefs", () => {
    it("generates colDefs with pure valueGetters", () => {
      const { bridge } = makeTestEnv()

      const cols = generateDefaultColDefs(3, bridge.datagrid)
      expect(cols).toHaveLength(3)
      expect(cols[0]!.field).toBe("col_0")
      expect(cols[0]!.headerName).toBe("A")

      // valueGetter reads from atom (initially empty)
      const display = cols[0]!.valueGetter({ data: { _rowIndex: 0 } })
      expect(display).toBe("")
    })
  })

  // ── numberRangeSchema coercion ────────────────

  describe("range schema coercion", () => {
    it("clamps values within range", () => {
      const schema = numberRangeSchema(0, 100)
      const { bridge, cellCache } = makeTestEnv({
        schemaDefaults: [schema],
        columnBindings: [{ colIndex: 0, schema }],
      })

      bridge.handleCellEditRequest({
        colDef: { field: "col_0" },
        data: { _rowIndex: 0 },
        newValue: "150",
      })

      // Should be clamped to 100
      expect(cellCache.get(addr(0, 0))).toEqual(num(100))
    })
  })
})

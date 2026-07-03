/**
 * Tests for bridge/transactions.ts and bridge/ag-grid.ts.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { Effect } from "effect"
import {
  type CellValue, type DatagridConfigShape, type RangeRect,
  num, str, empty,
  extractDisplay, extractNumber,
  makeDatagridLayer, Datagrid,
  TransactionCollector, type GridTransaction,
  GridBridge, generateColDefs, generateDefaultColDefs,
  type ColumnMeta,
} from "../src/index"

// ── Memory store (reused from services.test.ts pattern) ──

function makeMemoryStore() {
  const cells = new Map<string, CellValue>()
  const ranges = new Map<string, RangeRect>()
  const cellDbKey = (s: string, c: number, r: number) => `${s}:${c}:${r}`
  const rangeDbKey = (s: string, n: string) => `${s}:${n}`
  return {
    readCell: (s: string, c: number, r: number) => cells.get(cellDbKey(s, c, r)) ?? null,
    writeCell: (s: string, c: number, r: number, v: CellValue) => Effect.sync(() => { cells.set(cellDbKey(s, c, r), v) }),
    writeCellBulk: (s: string, es: ReadonlyArray<{ col: number; row: number; value: CellValue }>) =>
      Effect.sync(() => { for (const e of es) cells.set(cellDbKey(s, e.col, e.row), e.value) }),
    upsertNamedRange: (s: string, n: string, r: RangeRect) => Effect.sync(() => { ranges.set(rangeDbKey(s, n), r) }),
    getNamedRange: (s: string, n: string) => Effect.sync(() => ranges.get(rangeDbKey(s, n)) ?? null),
    listNamedRanges: (s: string) => Effect.sync(() => {
      const result: { name: string; range: RangeRect }[] = []
      for (const [k, r] of ranges) if (k.startsWith(`${s}:`)) result.push({ name: k.slice(s.length + 1), range: r })
      return result
    }),
    deleteNamedRange: (s: string, n: string) => Effect.sync(() => { ranges.delete(rangeDbKey(s, n)) }),
  }
}

function makeConfig(store: ReturnType<typeof makeMemoryStore>): DatagridConfigShape {
  return { sheetId: "sheet-1", agentId: "agent-a", ...store }
}

// ─── TransactionCollector ───────────────────────────

describe("TransactionCollector", () => {
  it("batches multiple updates into one transaction", () => {
    const txns: GridTransaction[] = []
    let pendingCb: (() => void) | null = null
    const collector = new TransactionCollector({
      onFlush: (tx) => txns.push(tx),
      scheduleFlush: (cb) => { pendingCb = cb }, // deferred
    })

    collector.queueUpdate("s1", 0, 0, "10")
    collector.queueUpdate("s1", 0, 1, "20")
    collector.queueUpdate("s1", 0, 2, "30")

    // Not flushed yet
    expect(txns).toHaveLength(0)

    // Trigger flush
    pendingCb!()

    // All same row → coalesced into 1 row update in 1 transaction
    expect(txns).toHaveLength(1)
    expect(txns[0].update).toHaveLength(1)
    expect(txns[0].update![0].data).toEqual({ "0": "10", "1": "20", "2": "30" })
  })

  it("coalesces same-row writes", () => {
    const txns: GridTransaction[] = []
    let pendingCb: (() => void) | null = null
    const collector = new TransactionCollector({
      onFlush: (tx) => txns.push(tx),
      scheduleFlush: (cb) => { pendingCb = cb },
    })

    collector.queueUpdate("s1", 5, 0, "first")
    collector.queueUpdate("s1", 5, 0, "second") // same cell — overwrites

    pendingCb!()

    expect(txns).toHaveLength(1)
    expect(txns[0].update![0].data["0"]).toBe("second")
    expect(collector.stats.totalCoalesced).toBe(1)
  })

  it("separates different rows", () => {
    const txns: GridTransaction[] = []
    let pendingCb: (() => void) | null = null
    const collector = new TransactionCollector({
      onFlush: (tx) => txns.push(tx),
      scheduleFlush: (cb) => { pendingCb = cb },
    })

    collector.queueUpdate("s1", 0, 0, "row0")
    collector.queueUpdate("s1", 1, 0, "row1")

    pendingCb!()

    expect(txns).toHaveLength(1) // still 1 transaction
    expect(txns[0].update).toHaveLength(2) // but 2 row updates
  })

  it("manual flush clears pending", () => {
    const txns: GridTransaction[] = []
    let flushScheduled = false
    const collector = new TransactionCollector({
      onFlush: (tx) => txns.push(tx),
      scheduleFlush: () => { flushScheduled = true }, // don't auto-flush
    })

    collector.queueUpdate("s1", 0, 0, "v")
    expect(collector.pendingCount).toBe(1)
    expect(txns).toHaveLength(0)

    collector.flush()
    expect(collector.pendingCount).toBe(0)
    expect(txns).toHaveLength(1)
  })

  it("stats track correctly", () => {
    let pendingCb: (() => void) | null = null
    const collector = new TransactionCollector({
      onFlush: () => {},
      scheduleFlush: (cb) => { pendingCb = cb },
    })

    collector.queueUpdate("s1", 0, 0, "a")
    collector.queueUpdate("s1", 1, 0, "b")
    collector.queueUpdate("s1", 0, 1, "c") // coalesced with row 0

    pendingCb!()

    expect(collector.stats.totalTransactions).toBe(1)
    expect(collector.stats.totalRowUpdates).toBe(2) // 2 unique rows
    expect(collector.stats.totalCoalesced).toBe(1)
  })
})

// ─── ColDef generation ──────────────────────────────

describe("generateColDefs", () => {
  it("generates colDefs from column metadata", async () => {
    const store = makeMemoryStore()
    const config = makeConfig(store)
    const layer = makeDatagridLayer(config)

    await Effect.runPromise(
      Effect.gen(function*() {
        const dg = yield* Datagrid
        yield* dg.setCell("A1", num(42))

        const columns: ColumnMeta[] = [
          { col: 0, name: "Price", dtype: "number", width: 100 },
          { col: 1, name: "Name", dtype: "string" },
          { col: 2, name: "Total", dtype: "formula" },
        ]

        const colDefs = generateColDefs(columns, dg)
        expect(colDefs).toHaveLength(3)

        // Check fields
        expect(colDefs[0].field).toBe("col_0")
        expect(colDefs[0].headerName).toBe("Price")
        expect(colDefs[0].width).toBe(100)
        expect(colDefs[0].editable).toBe(true)
        expect(colDefs[0].type).toBe("numericColumn")

        // Formula column
        expect(colDefs[2].headerName).toBe("ƒ Total")
        expect(colDefs[2].editable).toBe(false)

        // ValueGetter
        const val = colDefs[0].valueGetter({ data: { _rowIndex: 0 } })
        expect(val).toBe("42")
      }).pipe(Effect.provide(layer)),
    )
  })

  it("generateDefaultColDefs uses spreadsheet headers", async () => {
    const store = makeMemoryStore()
    const config = makeConfig(store)
    const layer = makeDatagridLayer(config)

    await Effect.runPromise(
      Effect.gen(function*() {
        const dg = yield* Datagrid
        const colDefs = generateDefaultColDefs(3, dg)
        expect(colDefs.map(c => c.headerName)).toEqual(["A", "B", "C"])
      }).pipe(Effect.provide(layer)),
    )
  })
})

// ─── GridBridge ─────────────────────────────────────

describe("GridBridge", () => {
  it("wires datagrid writes to transactions", async () => {
    const store = makeMemoryStore()
    const config = makeConfig(store)
    const layer = makeDatagridLayer(config)
    const txns: GridTransaction[] = []

    await Effect.runPromise(
      Effect.gen(function*() {
        const dg = yield* Datagrid

        const bridge = new GridBridge({
          datagrid: dg,
          applyTransaction: (tx) => txns.push(tx),
          scheduleFlush: (cb) => cb(), // immediate
        })

        // Subscribe to row 0, cols 0-2
        bridge.subscribeRange(0, 0, [0, 1, 2])

        // Write cells
        yield* dg.setCell("A1", num(100))
        yield* dg.setCell("B1", str("hello"))

        expect(txns.length).toBeGreaterThanOrEqual(1)

        bridge.destroy()
      }).pipe(Effect.provide(layer)),
    )
  })

  it("generateRowData produces correct structure", async () => {
    const store = makeMemoryStore()
    const config = makeConfig(store)
    const layer = makeDatagridLayer(config)

    await Effect.runPromise(
      Effect.gen(function*() {
        const dg = yield* Datagrid

        yield* dg.setCells([
          { addr: "A1", value: num(1) },
          { addr: "B1", value: str("x") },
          { addr: "A2", value: num(2) },
          { addr: "B2", value: str("y") },
        ])

        const bridge = new GridBridge({
          datagrid: dg,
          applyTransaction: () => {},
        })

        const rowData = bridge.generateRowData(2, 2)
        expect(rowData).toHaveLength(2)
        expect(rowData[0]._rowIndex).toBe(0)
        expect(rowData[0]["col_0"]).toBe("1")
        expect(rowData[0]["col_1"]).toBe("x")
        expect(rowData[1]["col_0"]).toBe("2")
        expect(rowData[1]["col_1"]).toBe("y")

        bridge.destroy()
      }).pipe(Effect.provide(layer)),
    )
  })
})

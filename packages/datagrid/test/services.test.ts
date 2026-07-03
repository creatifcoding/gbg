/**
 * Integration tests for @tmnl/datagrid services.
 *
 * Tests the full Datagrid service composition with in-memory
 * SQLite stubs — validates cell CRUD, formulas, CRDT, ranges,
 * and sub-service wiring.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { Effect } from "effect"
import { AtomRegistry } from "effect/unstable/reactivity"
import {
  type CellValue, type DatagridConfigShape, type RangeRect,
  empty, num, str, bool, formula, error,
  makeDatagridLayer, Datagrid,
  extractNumber, extractDisplay,
  cellKey,
} from "../src/index"

// ── In-memory SQLite stub ───────────────────────────

function makeMemoryStore() {
  const cells = new Map<string, CellValue>()
  const ranges = new Map<string, RangeRect>()

  const cellDbKey = (sheetId: string, col: number, row: number) => `${sheetId}:${col}:${row}`
  const rangeDbKey = (sheetId: string, name: string) => `${sheetId}:${name}`

  return {
    cells,
    ranges,
    readCell: (sheetId: string, col: number, row: number) =>
      cells.get(cellDbKey(sheetId, col, row)) ?? null,
    writeCell: (sheetId: string, col: number, row: number, value: CellValue) =>
      Effect.sync(() => { cells.set(cellDbKey(sheetId, col, row), value) }),
    writeCellBulk: (sheetId: string, entries: ReadonlyArray<{ col: number; row: number; value: CellValue }>) =>
      Effect.sync(() => { for (const e of entries) cells.set(cellDbKey(sheetId, e.col, e.row), e.value) }),
    upsertNamedRange: (sheetId: string, name: string, range: RangeRect) =>
      Effect.sync(() => { ranges.set(rangeDbKey(sheetId, name), range) }),
    getNamedRange: (sheetId: string, name: string) =>
      Effect.sync(() => ranges.get(rangeDbKey(sheetId, name)) ?? null),
    listNamedRanges: (sheetId: string) =>
      Effect.sync(() => {
        const result: { name: string; range: RangeRect }[] = []
        for (const [key, range] of ranges) {
          if (key.startsWith(`${sheetId}:`)) {
            result.push({ name: key.slice(sheetId.length + 1), range })
          }
        }
        return result
      }),
    deleteNamedRange: (sheetId: string, name: string) =>
      Effect.sync(() => { ranges.delete(rangeDbKey(sheetId, name)) }),
  }
}

function makeConfig(store: ReturnType<typeof makeMemoryStore>, opts?: { sheetId?: string; agentId?: string }): DatagridConfigShape {
  return {
    sheetId: opts?.sheetId ?? "sheet-1",
    agentId: opts?.agentId ?? "agent-alpha",
    readCell: store.readCell,
    writeCell: store.writeCell,
    writeCellBulk: store.writeCellBulk,
    upsertNamedRange: store.upsertNamedRange,
    getNamedRange: store.getNamedRange,
    listNamedRanges: store.listNamedRanges,
    deleteNamedRange: store.deleteNamedRange,
  }
}

async function runWithDatagrid<A>(config: DatagridConfigShape, fn: (dg: typeof Datagrid.Type) => Effect.Effect<A>): Promise<A> {
  const layer = makeDatagridLayer(config)
  const program = Effect.gen(function*() {
    const dg = yield* Datagrid
    return yield* fn(dg)
  }).pipe(Effect.provide(layer))

  return Effect.runPromise(program)
}

// ─── Tests ──────────────────────────────────────────

describe("@tmnl/datagrid services", () => {
  let store: ReturnType<typeof makeMemoryStore>
  let config: DatagridConfigShape

  beforeEach(() => {
    store = makeMemoryStore()
    config = makeConfig(store)
  })

  // ── Cell CRUD ───────────────────────────────────

  describe("cell CRUD", () => {
    it("read empty cell returns Empty", async () => {
      await runWithDatagrid(config, (dg) => Effect.sync(() => {
        const v = dg.getCell({ col: 0, row: 0 })
        expect(v._tag).toBe("Empty")
      }))
    })

    it("write and read cell via ColRow", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell({ col: 0, row: 0 }, num(42))
        const v = dg.getCell({ col: 0, row: 0 })
        expect(v._tag).toBe("Number")
        expect(extractNumber(v)).toBe(42)
      }))
    })

    it("write and read cell via A1 string", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("B3", str("hello"))
        const v = dg.getCell("B3")
        expect(v._tag).toBe("String")
        expect(extractDisplay(v)).toBe("hello")
      }))
    })

    it("bulk write", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCells([
          { addr: "A1", value: num(1) },
          { addr: "A2", value: num(2) },
          { addr: "A3", value: num(3) },
        ])
        expect(extractNumber(dg.getCell("A1"))).toBe(1)
        expect(extractNumber(dg.getCell("A2"))).toBe(2)
        expect(extractNumber(dg.getCell("A3"))).toBe(3)
      }))
    })

    it("persists to memory store", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("C5", num(99))
      }))
      // Verify the store got the write
      const key = `sheet-1:2:4` // C=col2, 5=row4 (0-indexed)
      expect(store.cells.has(key)).toBe(true)
    })

    it("getCellAtom returns reactive atom", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("A1", num(10))
        const atom = dg.getCellAtom("A1")
        expect(dg.registry.get(atom)._tag).toBe("Number")
        expect(extractNumber(dg.registry.get(atom))).toBe(10)
      }))
    })
  })

  // ── Range ops ──────────────────────────────────

  describe("range ops", () => {
    it("getRange reads cells", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCells([
          { addr: "A1", value: num(1) },
          { addr: "B1", value: num(2) },
          { addr: "A2", value: num(3) },
          { addr: "B2", value: num(4) },
        ])
        const range = dg.getRange("A1:B2")
        expect(range).toHaveLength(4)
        const values = range.map(r => extractNumber(r.value))
        expect(values).toEqual([1, 2, 3, 4])
      }))
    })

    it("setRange writes cells", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setRange("A1:C1", [num(10), num(20), num(30)])
        expect(extractNumber(dg.getCell("A1"))).toBe(10)
        expect(extractNumber(dg.getCell("B1"))).toBe(20)
        expect(extractNumber(dg.getCell("C1"))).toBe(30)
      }))
    })

    it("clearRange empties cells", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setRange("A1:B1", [num(1), num(2)])
        yield* dg.clearRange("A1:B1")
        expect(dg.getCell("A1")._tag).toBe("Empty")
        expect(dg.getCell("B1")._tag).toBe("Empty")
      }))
    })
  })

  // ── Formulas ──────────────────────────────────

  describe("formulas", () => {
    it("register and evaluate formula", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("A1", num(10))
        yield* dg.setCell("B1", num(20))

        const reg = dg.registerFormula(
          "C1", "=A1+B1",
          ["A1", "B1"],
          (deps) => {
            const a = extractNumber(deps[0]) ?? 0
            const b = extractNumber(deps[1]) ?? 0
            return num(a + b)
          },
        )

        expect(reg.addr).toBe(cellKey("sheet-1", { col: 2, row: 0 }))
        expect(reg.deps).toHaveLength(2)

        // Read derived atom
        const result = dg.registry.get(reg.atom)
        expect(extractNumber(result)).toBe(30)
      }))
    })

    it("formula updates when deps change", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("A1", num(5))

        const reg = dg.registerFormula(
          "B1", "=A1*2",
          ["A1"],
          (deps) => num((extractNumber(deps[0]) ?? 0) * 2),
        )

        expect(extractNumber(dg.registry.get(reg.atom))).toBe(10)

        // Update dep
        yield* dg.setCell("A1", num(7))

        // Derived atom should update
        expect(extractNumber(dg.registry.get(reg.atom))).toBe(14)
      }))
    })

    it("detects cycle", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        // Self-reference
        const cycle = dg.detectCycle("A1", ["A1"])
        expect(cycle).not.toBeNull()
      }))
    })

    it("throws on circular reference in registerFormula", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        dg.registerFormula("B1", "=A1", ["A1"], (d) => d[0])
        expect(() => {
          dg.registerFormula("A1", "=B1", ["B1"], (d) => d[0])
        }).toThrow("Circular reference")
      }))
    })

    it("unregister removes formula", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("A1", num(1))
        dg.registerFormula("B1", "=A1", ["A1"], (d) => d[0])
        dg.unregisterFormula("B1")
        expect(dg.formulas.getFormula({ col: 1, row: 0 })).toBeNull()
      }))
    })
  })

  // ── CRDT ──────────────────────────────────────

  describe("CRDT", () => {
    it("applies remote op", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        const result = yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(42), clock: 1, agentId: "agent-beta",
        })
        expect(result.applied).toBe(true)
        expect(result.reason).toBe("accepted")

        // Cell should be updated
        expect(extractNumber(dg.getCell("A1"))).toBe(42)
      }))
    })

    it("rejects stale op", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        // Apply high-clock op first
        yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(100), clock: 10, agentId: "agent-beta",
        })

        // Stale op should be rejected
        const result = yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(50), clock: 5, agentId: "agent-gamma",
        })
        expect(result.applied).toBe(false)
        expect(result.reason).toBe("rejected-stale")

        // Cell should still have the winning value
        expect(extractNumber(dg.getCell("A1"))).toBe(100)
      }))
    })

    it("tiebreaks by agent_id", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(1), clock: 5, agentId: "agent-a",
        })

        // Same clock, higher agent_id wins
        const result = yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(2), clock: 5, agentId: "agent-z",
        })
        expect(result.applied).toBe(true)
        expect(extractNumber(dg.getCell("A1"))).toBe(2)

        // Lower agent_id at same clock loses
        const result2 = yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(3), clock: 5, agentId: "agent-b",
        })
        expect(result2.applied).toBe(false)
        expect(result2.reason).toBe("rejected-tiebreak")
      }))
    })

    it("batch merge", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        const results = yield* dg.applyRemoteOps([
          { sheetId: "sheet-1", col: 0, row: 0, payload: num(1), clock: 1, agentId: "a1" },
          { sheetId: "sheet-1", col: 1, row: 0, payload: num(2), clock: 1, agentId: "a1" },
          { sheetId: "sheet-1", col: 2, row: 0, payload: num(3), clock: 1, agentId: "a1" },
        ])
        expect(results).toHaveLength(3)
        expect(results.every(r => r.applied)).toBe(true)
      }))
    })

    it("clock increments on receive", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        expect(dg.clock()).toBe(0)
        yield* dg.applyRemoteOp({
          sheetId: "sheet-1", col: 0, row: 0,
          payload: num(1), clock: 10, agentId: "remote",
        })
        // Lamport: max(local, remote) + 1 = max(0, 10) + 1 = 11
        expect(dg.clock()).toBe(11)
      }))
    })
  })

  // ── Address resolver ──────────────────────────

  describe("address resolution", () => {
    it("resolves A1 notation", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("D7", num(42))
        const v = dg.getCell({ col: 3, row: 6 }) // D=3, 7=row6 (0-indexed)
        expect(extractNumber(v)).toBe(42)
      }))
    })

    it("named ranges", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.nameRange("prices", "A1:A100")
        const resolved = yield* dg.resolveAlias("prices")
        expect(resolved).not.toBeNull()
        expect(resolved!.start.col).toBe(0)
        expect(resolved!.start.row).toBe(0)
        expect(resolved!.end.col).toBe(0)
        expect(resolved!.end.row).toBe(99)
      }))
    })
  })

  // ── Reactive layer ────────────────────────────

  describe("reactive layer", () => {
    it("family is accessible and functional", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("A1", num(77))
        const val = dg.family.get(cellKey("sheet-1", { col: 0, row: 0 }))
        expect(extractNumber(val)).toBe(77)
      }))
    })

    it("atom subscriptions fire on writes", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        const atom = dg.getCellAtom("A1")
        const values: CellValue[] = []
        dg.registry.subscribe(atom, (v) => values.push(v))

        yield* dg.setCell("A1", num(1))
        yield* dg.setCell("A1", num(2))
        yield* dg.setCell("A1", num(3))

        // Should have initial + 3 updates
        expect(values.length).toBeGreaterThanOrEqual(3)
        expect(extractNumber(values[values.length - 1])).toBe(3)
      }))
    })
  })

  // ── Sub-service access ────────────────────────

  describe("sub-service access", () => {
    it("cells sub-service accessible", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        expect(dg.cells.sheetId).toBe("sheet-1")
      }))
    })

    it("formulas sub-service tracks registrations", async () => {
      await runWithDatagrid(config, (dg) => Effect.gen(function*() {
        yield* dg.setCell("A1", num(1))
        dg.registerFormula("B1", "=A1", ["A1"], (d) => d[0])
        expect(dg.formulas.allFormulas()).toHaveLength(1)
      }))
    })

    it("crdt sub-service has correct agentId", async () => {
      await runWithDatagrid(config, (dg) => Effect.sync(() => {
        expect(dg.crdt.agentId).toBe("agent-alpha")
      }))
    })
  })
})

/**
 * Formula Subscription Bridge — proves the unified atom model.
 *
 * These tests verify that formula results flow back into CellCache
 * via the subscription bridge, eliminating the "two atom universes"
 * problem. Before the bridge, CellCache.get(formulaAddr) returned
 * the stale/empty initial value; now it returns the live computed
 * result.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer, ServiceMap } from "effect-v4"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"

import {
  num, str, empty, type CellValue, extractNumber,
} from "../src/schemas/cell-value"
import type { ColRow } from "../src/schemas/addressing"
import { cellKey } from "../src/schemas/addressing"

import { CellCache, CellCacheConfig, CellCacheLive } from "../src/services/cell-cache"
import { FormulaEngine, FormulaEngineConfig, FormulaEngineLive } from "../src/services/formula-engine"

// ─── Test harness ───────────────────────────────────

const addr = (col: number, row: number): ColRow => ({ col, row })

function makeEnv() {
  const registry = AtomRegistry.make()
  const sheetId = "test"
  const db = new Map<string, CellValue>()

  const ccConfigLayer = Layer.succeed(CellCacheConfig)(CellCacheConfig.of({
    sheetId, registry,
    readCell: (sid, col, row) => db.get(cellKey(sid, { col, row })) ?? null,
    writeCell: (sid, col, row, value) => Effect.sync(() => { db.set(cellKey(sid, { col, row }), value) }),
    writeCellBulk: (sid, entries) => Effect.sync(() => {
      for (const e of entries) db.set(cellKey(sid, { col: e.col, row: e.row }), e.value)
    }),
  }))
  const ccLayer = Layer.provide(CellCacheLive, ccConfigLayer)
  const ccSM = Effect.runSync(Effect.scoped(ccLayer.pipe(Layer.build)))
  const cellCache = ServiceMap.get(ccSM, CellCache)

  const feConfigLayer = Layer.succeed(FormulaEngineConfig)(FormulaEngineConfig.of({
    sheetId, registry,
    getCellAtom: (a) => cellCache.getAtom(a),
  }))
  const feLayer = Layer.provide(FormulaEngineLive, feConfigLayer)
  const feSM = Effect.runSync(Effect.scoped(feLayer.pipe(Layer.build)))
  const formulaEngine = ServiceMap.get(feSM, FormulaEngine)

  return { cellCache, formulaEngine, registry, db }
}

// ─── Tests ──────────────────────────────────────────

describe("Formula Subscription Bridge (Unified Atom Model)", () => {

  // ── Core bridge behavior ────────────────────────

  it("register() seeds CellCache with initial computed value", () => {
    const { cellCache, formulaEngine } = makeEnv()

    // A0=10, B0=20
    Effect.runSync(cellCache.set(addr(0, 0), num(10)))
    Effect.runSync(cellCache.set(addr(1, 0), num(20)))

    // Register C0 = A0 + B0
    formulaEngine.register(
      addr(2, 0), "=A0+B0",
      [addr(0, 0), addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)),
    )

    // THE KEY ASSERTION: CellCache.get(C0) returns the formula result
    // Before the bridge, this returned empty() — the stale initial value
    const result = cellCache.get(addr(2, 0))
    expect(extractNumber(result)).toBe(30)
  })

  it("dep change propagates through bridge to CellCache", () => {
    const { cellCache, formulaEngine, registry } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(10)))
    Effect.runSync(cellCache.set(addr(1, 0), num(20)))

    formulaEngine.register(
      addr(2, 0), "=A0+B0",
      [addr(0, 0), addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)),
    )

    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(30)

    // Update A0 → derived recomputes → subscription writes to CellCache
    registry.set(cellCache.getAtom(addr(0, 0)), num(100))

    // CellCache now reflects the recomputed formula
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(120) // 100 + 20
  })

  it("transactionalSetBulk propagates to formula cells via bridge", () => {
    const { cellCache, formulaEngine } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(5)))
    Effect.runSync(cellCache.set(addr(1, 0), num(10)))

    formulaEngine.register(
      addr(2, 0), "=A0+B0",
      [addr(0, 0), addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)),
    )

    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(15)

    // Atomic multi-cell update
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(50) },
      { addr: addr(1, 0), value: num(100) },
    ]))

    // Formula sees both updates via CellCache
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(150)
  })

  // ── Chained formulas ────────────────────────────

  it("chained formulas propagate automatically through CellCache", () => {
    const { cellCache, formulaEngine } = makeEnv()

    // A0 = 10
    Effect.runSync(cellCache.set(addr(0, 0), num(10)))

    // B0 = A0 * 2
    formulaEngine.register(
      addr(1, 0), "=A0*2",
      [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2),
    )

    // C0 = B0 + 1 — reads B0's CellCache atom (which is bridged)
    formulaEngine.register(
      addr(2, 0), "=B0+1",
      [addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) + 1),
    )

    // Initial: A0=10 → B0=20 → C0=21
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(20)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(21)

    // Update A0 → chain propagates: A0=50 → B0=100 → C0=101
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(50) },
    ]))

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(100)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(101)
  })

  it("three-level chain: A0 → B0 → C0 → D0", () => {
    const { cellCache, formulaEngine } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(1)))

    // B0 = A0 + 1
    formulaEngine.register(addr(1, 0), "=A0+1", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) + 1))

    // C0 = B0 * 3
    formulaEngine.register(addr(2, 0), "=B0*3", [addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) * 3))

    // D0 = C0 - 2
    formulaEngine.register(addr(3, 0), "=C0-2", [addr(2, 0)],
      (deps) => num(extractNumber(deps[0]!) - 2))

    // A0=1 → B0=2 → C0=6 → D0=4
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(2)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(6)
    expect(extractNumber(cellCache.get(addr(3, 0)))).toBe(4)

    // A0=10 → B0=11 → C0=33 → D0=31
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(10) },
    ]))

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(11)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(33)
    expect(extractNumber(cellCache.get(addr(3, 0)))).toBe(31)
  })

  // ── registerAtom path ───────────────────────────

  it("registerAtom() bridges caller-provided atom to CellCache", () => {
    const { cellCache, formulaEngine, registry } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(7)))

    // Caller builds their own derived atom
    const depAtom = cellCache.getAtom(addr(0, 0))
    const customAtom = Atom.make((get: Atom.Context) => {
      return num(extractNumber(get(depAtom)) * 10)
    })
    registry.mount(customAtom)

    formulaEngine.registerAtom(
      addr(1, 0), "=A0*10",
      [addr(0, 0)],
      customAtom,
    )

    // CellCache sees the bridged value
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(70)

    // Update dep → propagates
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(3) },
    ]))

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(30)
  })

  // ── Cleanup ─────────────────────────────────────

  it("unregister() stops bridge subscription", () => {
    const { cellCache, formulaEngine, registry } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(10)))

    formulaEngine.register(
      addr(1, 0), "=A0*2",
      [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2),
    )

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(20)

    // Unregister — subscription should stop
    formulaEngine.unregister(addr(1, 0))

    // Update dep — CellCache should NOT update for the unregistered formula
    registry.set(cellCache.getAtom(addr(0, 0)), num(999))

    // B0 should still be 20 (last bridged value), not 1998
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(20)
  })

  it("re-register replaces subscription cleanly", () => {
    const { cellCache, formulaEngine } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(5)))

    // First: B0 = A0 * 2
    formulaEngine.register(addr(1, 0), "=A0*2", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2))

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(10)

    // Re-register: B0 = A0 * 3
    formulaEngine.register(addr(1, 0), "=A0*3", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 3))

    // New formula takes effect immediately
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(15)
  })

  // ── Fan-out: one data cell, multiple formulas ───

  it("multiple formulas depending on same data cell all update", () => {
    const { cellCache, formulaEngine } = makeEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(10)))

    // B0 = A0 + 1
    formulaEngine.register(addr(1, 0), "=A0+1", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) + 1))

    // C0 = A0 * 2
    formulaEngine.register(addr(2, 0), "=A0*2", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2))

    // D0 = A0 - 3
    formulaEngine.register(addr(3, 0), "=A0-3", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) - 3))

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(11)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(20)
    expect(extractNumber(cellCache.get(addr(3, 0)))).toBe(7)

    // Update A0 → all three update via bridge
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(100) },
    ]))

    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(101)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(200)
    expect(extractNumber(cellCache.get(addr(3, 0)))).toBe(97)
  })

  // ── Diamond dependency (A0 → B0, A0 → C0, B0+C0 → D0) ──

  it("diamond dependency resolves correctly", () => {
    const { cellCache, formulaEngine } = makeEnv()

    // A0 = 10
    Effect.runSync(cellCache.set(addr(0, 0), num(10)))

    // B0 = A0 + 1
    formulaEngine.register(addr(1, 0), "=A0+1", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) + 1))

    // C0 = A0 * 2
    formulaEngine.register(addr(2, 0), "=A0*2", [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2))

    // D0 = B0 + C0
    formulaEngine.register(addr(3, 0), "=B0+C0", [addr(1, 0), addr(2, 0)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)))

    // A0=10 → B0=11 → C0=20 → D0=31
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(11)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(20)
    expect(extractNumber(cellCache.get(addr(3, 0)))).toBe(31)

    // Update A0 → everything cascades
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(5) },
    ]))

    // A0=5 → B0=6 → C0=10 → D0=16
    expect(extractNumber(cellCache.get(addr(1, 0)))).toBe(6)
    expect(extractNumber(cellCache.get(addr(2, 0)))).toBe(10)
    expect(extractNumber(cellCache.get(addr(3, 0)))).toBe(16)
  })
})

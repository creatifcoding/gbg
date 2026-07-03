/**
 * FormulaConsistency — G4 tests.
 *
 * Validates deferred recalc: formulas see consistent post-commit
 * state, not partial transaction state.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer, Context } from "effect"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"

import {
  num, str, empty, type CellValue, extractNumber,
} from "../src/schemas/cell-value"
import type { ColRow } from "../src/schemas/addressing"
import { cellKey } from "../src/schemas/addressing"

import { CellCache, CellCacheConfig, CellCacheLive } from "../src/services/cell-cache"
import { FormulaEngine, FormulaEngineConfig, FormulaEngineLive } from "../src/services/formula-engine"
import { FormulaConsistency, FormulaConsistencyConfig, FormulaConsistencyLive } from "../src/services/formula-consistency"

// ─── Harness ────────────────────────────────────────

const addr = (col: number, row: number): ColRow => ({ col, row })

function makeTestEnv() {
  const registry = AtomRegistry.make()
  const sheetId = "test"
  const db = new Map<string, CellValue>()

  // CellCache
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
  const cellCache = Context.get(ccSM, CellCache)

  // FormulaEngine
  const feConfigLayer = Layer.succeed(FormulaEngineConfig)(FormulaEngineConfig.of({
    sheetId, registry,
    getCellAtom: (a) => cellCache.getAtom(a),
  }))
  const feLayer = Layer.provide(FormulaEngineLive, feConfigLayer)
  const feSM = Effect.runSync(Effect.scoped(feLayer.pipe(Layer.build)))
  const formulaEngine = Context.get(feSM, FormulaEngine)

  // FormulaConsistency
  const fcConfigLayer = Layer.succeed(FormulaConsistencyConfig)(FormulaConsistencyConfig.of({
    sheetId, registry, cellCache, formulaEngine,
  }))
  const fcLayer = Layer.provide(FormulaConsistencyLive, fcConfigLayer)
  const fcSM = Effect.runSync(Effect.scoped(fcLayer.pipe(Layer.build)))
  const consistency = Context.get(fcSM, FormulaConsistency)

  return { cellCache, formulaEngine, consistency, registry }
}

// ─── Tests ──────────────────────────────────────────

describe("FormulaConsistency (G4)", () => {

  it("recalcAffected triggers formula recomputation", () => {
    const { cellCache, formulaEngine, consistency, registry } = makeTestEnv()

    // Set A0=10, B0=20
    Effect.runSync(cellCache.set(addr(0, 0), num(10)))
    Effect.runSync(cellCache.set(addr(1, 0), num(20)))

    // Register C0 = A0 + B0
    const reg = formulaEngine.register(
      addr(2, 0), "=A0+B0",
      [addr(0, 0), addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)),
    )

    // Read initial formula value
    expect(extractNumber(registry.get(reg.atom))).toBe(30)

    // Update A0 via transactional bulk
    Effect.runSync(cellCache.transactionalSetBulk([{ addr: addr(0, 0), value: num(50) }]))

    // Recalc affected
    const recalced = consistency.recalcAffected([addr(0, 0)])
    expect(recalced.length).toBeGreaterThanOrEqual(1)

    // Formula should now reflect new value
    expect(extractNumber(registry.get(reg.atom))).toBe(70) // 50 + 20
  })

  it("recalcAll recomputes all formulas", () => {
    const { cellCache, formulaEngine, consistency, registry } = makeTestEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(5)))

    const reg = formulaEngine.register(
      addr(1, 0), "=A0*2",
      [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2),
    )

    expect(extractNumber(registry.get(reg.atom))).toBe(10)

    // Update without recalc
    Effect.runSync(cellCache.transactionalSetBulk([{ addr: addr(0, 0), value: num(100) }]))

    // Force full recalc
    const recalced = consistency.recalcAll()
    expect(recalced.length).toBeGreaterThanOrEqual(1)
    expect(extractNumber(registry.get(reg.atom))).toBe(200)
  })

  it("hasDependents returns true when formulas depend on cell", () => {
    const { cellCache, formulaEngine, consistency } = makeTestEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(1)))

    formulaEngine.register(
      addr(1, 0), "=A0",
      [addr(0, 0)],
      (deps) => deps[0]!,
    )

    expect(consistency.hasDependents([addr(0, 0)])).toBe(true)
    expect(consistency.hasDependents([addr(5, 5)])).toBe(false)
  })

  it("stateAtom tracks recalc metadata", () => {
    const { cellCache, formulaEngine, consistency, registry } = makeTestEnv()

    Effect.runSync(cellCache.set(addr(0, 0), num(1)))
    formulaEngine.register(
      addr(1, 0), "=A0",
      [addr(0, 0)],
      (deps) => deps[0]!,
    )

    const before = registry.get(consistency.stateAtom)
    expect(before.recalcCount).toBe(0)

    consistency.recalcAffected([addr(0, 0)])

    const after = registry.get(consistency.stateAtom)
    expect(after.recalcCount).toBe(1)
    expect(after.affectedCount).toBeGreaterThanOrEqual(1)
    expect(after.lastRecalcAt).toBeGreaterThan(0)
  })

  it("chained formulas recalc in correct topo order", () => {
    const { cellCache, formulaEngine, consistency, registry } = makeTestEnv()

    // A0 = 10, A1 = 5
    Effect.runSync(cellCache.set(addr(0, 0), num(10)))
    Effect.runSync(cellCache.set(addr(0, 1), num(5)))

    // B0 = A0 * 2 (depends on data cell A0)
    const b0 = formulaEngine.register(
      addr(1, 0), "=A0*2",
      [addr(0, 0)],
      (deps) => num(extractNumber(deps[0]!) * 2),
    )

    // B1 = A0 + A1 (depends on two data cells)
    const b1 = formulaEngine.register(
      addr(1, 1), "=A0+A1",
      [addr(0, 0), addr(0, 1)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)),
    )

    expect(extractNumber(registry.get(b0.atom))).toBe(20)
    expect(extractNumber(registry.get(b1.atom))).toBe(15)

    // Update A0 → should affect both B0 and B1
    Effect.runSync(cellCache.transactionalSetBulk([{ addr: addr(0, 0), value: num(100) }]))
    consistency.recalcAffected([addr(0, 0)])

    expect(extractNumber(registry.get(b0.atom))).toBe(200)
    expect(extractNumber(registry.get(b1.atom))).toBe(105) // 100 + 5
  })

  it("recalcAffected returns empty for cells with no formula dependents", () => {
    const { consistency } = makeTestEnv()
    const recalced = consistency.recalcAffected([addr(99, 99)])
    expect(recalced).toHaveLength(0)
  })

  it("multi-cell transaction → single recalc pass sees consistent state", () => {
    const { cellCache, formulaEngine, consistency, registry } = makeTestEnv()

    // A0 = 10, B0 = 20
    Effect.runSync(cellCache.set(addr(0, 0), num(10)))
    Effect.runSync(cellCache.set(addr(1, 0), num(20)))

    // C0 = A0 + B0
    const c0 = formulaEngine.register(
      addr(2, 0), "=A0+B0",
      [addr(0, 0), addr(1, 0)],
      (deps) => num(extractNumber(deps[0]!) + extractNumber(deps[1]!)),
    )

    // Atomically update BOTH A0 and B0
    Effect.runSync(cellCache.transactionalSetBulk([
      { addr: addr(0, 0), value: num(100) },
      { addr: addr(1, 0), value: num(200) },
    ]))

    // Single recalc pass — formula should see BOTH updated values
    consistency.recalcAffected([addr(0, 0), addr(1, 0)])
    expect(extractNumber(registry.get(c0.atom))).toBe(300)
  })
})

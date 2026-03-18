/**
 * SPIKE S2 — Effect Formulas
 *
 * Prove Atom-based DAG can serve as formula engine.
 * Dependency tracking, incremental recalc, cycle detection.
 *
 * H4: 1000 chained formula cells recalculate in < 50ms
 * H5: Derived atom formulas compose correctly
 * H6: Circular dependency detected
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "@tmnl/stx"
import {
  type CellValue,
  num, error, extractNumber,
  cellKey, type ColRow,
} from "../src/index.js"

// ─── Minimal FormulaEngine (spike-only) ─────────────

type FormulaFn = (get: (addr: ColRow) => number) => number

class SpikeFormulaEngine {
  private cells: Map<string, Atom.Writable<CellValue>> = new Map()
  private formulas: Map<string, FormulaFn> = new Map()
  private deps: Map<string, Set<string>> = new Map()   // formula → its dependencies
  private rdeps: Map<string, Set<string>> = new Map()  // cell → formulas that depend on it
  private registry: AtomRegistry

  constructor(registry: AtomRegistry) {
    this.registry = registry
  }

  /** Set a data cell */
  set(addr: ColRow, value: CellValue): void {
    const key = cellKey("test", addr)
    let atom = this.cells.get(key)
    if (!atom) {
      atom = Atom.make<CellValue>(value)
      this.cells.set(key, atom)
    } else {
      this.registry.set(atom, value)
    }
  }

  /** Get cell value */
  get(addr: ColRow): CellValue {
    const key = cellKey("test", addr)
    const atom = this.cells.get(key)
    return atom ? this.registry.get(atom) : num(0)
  }

  /** Register a formula cell */
  registerFormula(addr: ColRow, depAddrs: ColRow[], fn: FormulaFn): boolean {
    const key = cellKey("test", addr)

    // Cycle detection: DFS from deps back to addr
    const visited = new Set<string>()
    const hasCycle = (target: string): boolean => {
      if (target === key) return true
      if (visited.has(target)) return false
      visited.add(target)
      const targetDeps = this.deps.get(target)
      if (targetDeps) {
        for (const dep of targetDeps) {
          if (hasCycle(dep)) return true
        }
      }
      return false
    }

    for (const dep of depAddrs) {
      if (hasCycle(cellKey("test", dep))) {
        // Cycle detected — set error
        let atom = this.cells.get(key)
        if (!atom) {
          atom = Atom.make<CellValue>(error(`Circular dependency detected: ${key}`))
          this.cells.set(key, atom)
        } else {
          this.registry.set(atom, error(`Circular dependency detected: ${key}`))
        }
        return false
      }
    }

    // Register formula
    this.formulas.set(key, fn)
    const depKeys = new Set(depAddrs.map(d => cellKey("test", d)))
    this.deps.set(key, depKeys)

    // Update reverse deps
    for (const depKey of depKeys) {
      if (!this.rdeps.has(depKey)) this.rdeps.set(depKey, new Set())
      this.rdeps.get(depKey)!.add(key)
    }

    // Initial calculation
    this.recalcSingle(key)
    return true
  }

  /** Recalculate a single formula */
  private recalcSingle(key: string): void {
    const fn = this.formulas.get(key)
    if (!fn) return

    const getter = (addr: ColRow): number => {
      return extractNumber(this.get(addr))
    }

    try {
      const result = fn(getter)
      let atom = this.cells.get(key)
      if (!atom) {
        atom = Atom.make<CellValue>(num(result))
        this.cells.set(key, atom)
      } else {
        this.registry.set(atom, num(result))
      }
    } catch (e) {
      let atom = this.cells.get(key)
      const errValue = error(String(e))
      if (!atom) {
        atom = Atom.make<CellValue>(errValue)
        this.cells.set(key, atom)
      } else {
        this.registry.set(atom, errValue)
      }
    }
  }

  /** Propagate dirty recalculation from a changed cell */
  recalcFrom(addr: ColRow): number {
    const key = cellKey("test", addr)
    const dirty = this.topologicalSort(key)
    for (const dirtyKey of dirty) {
      this.recalcSingle(dirtyKey)
    }
    return dirty.length
  }

  /** Topological sort of downstream formulas */
  private topologicalSort(startKey: string): string[] {
    const order: string[] = []
    const visited = new Set<string>()

    const visit = (key: string): void => {
      if (visited.has(key)) return
      visited.add(key)
      const dependents = this.rdeps.get(key)
      if (dependents) {
        for (const dep of dependents) {
          visit(dep)
        }
      }
      if (this.formulas.has(key)) {
        order.push(key)
      }
    }

    // Start from the rdeps of the changed cell
    const dependents = this.rdeps.get(startKey)
    if (dependents) {
      for (const dep of dependents) {
        visit(dep)
      }
    }

    return order.reverse() // Reverse for correct evaluation order
  }
}

// ─── Tests ──────────────────────────────────────────

describe("S2: Effect Formulas", () => {

  it("basic formula: C1 = A1 + B1", () => {
    const registry = AtomRegistry.make()
    const engine = new SpikeFormulaEngine(registry)

    engine.set({ col: 0, row: 0 }, num(10))  // A1 = 10
    engine.set({ col: 1, row: 0 }, num(20))  // B1 = 20

    engine.registerFormula(
      { col: 2, row: 0 },                     // C1
      [{ col: 0, row: 0 }, { col: 1, row: 0 }], // depends on A1, B1
      (get) => get({ col: 0, row: 0 }) + get({ col: 1, row: 0 }),
    )

    expect(extractNumber(engine.get({ col: 2, row: 0 }))).toBe(30)
  })

  it("cascading recalc: change source → formula updates", () => {
    const registry = AtomRegistry.make()
    const engine = new SpikeFormulaEngine(registry)

    engine.set({ col: 0, row: 0 }, num(5))
    engine.registerFormula(
      { col: 1, row: 0 },
      [{ col: 0, row: 0 }],
      (get) => get({ col: 0, row: 0 }) * 2,
    )

    expect(extractNumber(engine.get({ col: 1, row: 0 }))).toBe(10)

    // Change source
    engine.set({ col: 0, row: 0 }, num(100))
    engine.recalcFrom({ col: 0, row: 0 })

    expect(extractNumber(engine.get({ col: 1, row: 0 }))).toBe(200)
  })

  it("H4: 1000-chain cascade recalculates in < 50ms", () => {
    const registry = AtomRegistry.make()
    const engine = new SpikeFormulaEngine(registry)

    // Cell A1 is the source
    engine.set({ col: 0, row: 0 }, num(1))

    // Chain: cell i = cell (i-1) + 1
    for (let i = 1; i <= 1000; i++) {
      engine.registerFormula(
        { col: i, row: 0 },
        [{ col: i - 1, row: 0 }],
        ((idx: number) => (get: (a: ColRow) => number) => get({ col: idx - 1, row: 0 }) + 1)(i),
      )
    }

    // Verify chain end
    expect(extractNumber(engine.get({ col: 1000, row: 0 }))).toBe(1001)

    // Now change the source and time the cascade
    const start = performance.now()
    engine.set({ col: 0, row: 0 }, num(100))
    const recalced = engine.recalcFrom({ col: 0, row: 0 })
    const elapsed = performance.now() - start

    expect(extractNumber(engine.get({ col: 1000, row: 0 }))).toBe(1100)
    console.log(`  S2/H4: 1000-chain cascade in ${elapsed.toFixed(2)}ms (${recalced} formulas recalced)`)
    expect(elapsed).toBeLessThan(50)
  })

  it("H4-perf: 10K independent formulas recalc in < 100ms", () => {
    const registry = AtomRegistry.make()
    const engine = new SpikeFormulaEngine(registry)

    // 10K cells, each formula depends on cell 0
    engine.set({ col: 0, row: 0 }, num(1))

    for (let i = 1; i <= 10_000; i++) {
      engine.registerFormula(
        { col: 0, row: i },
        [{ col: 0, row: 0 }],
        (get) => get({ col: 0, row: 0 }) * i,
      )
    }

    const start = performance.now()
    engine.set({ col: 0, row: 0 }, num(5))
    const recalced = engine.recalcFrom({ col: 0, row: 0 })
    const elapsed = performance.now() - start

    console.log(`  S2/H4-perf: 10K fan-out recalc in ${elapsed.toFixed(2)}ms (${recalced} formulas)`)
    expect(elapsed).toBeLessThan(100)
    expect(extractNumber(engine.get({ col: 0, row: 500 }))).toBe(2500) // 5 * 500
  })

  it("H6: circular dependency detected → CellError", () => {
    const registry = AtomRegistry.make()
    const engine = new SpikeFormulaEngine(registry)

    // A1 depends on B1
    engine.set({ col: 1, row: 0 }, num(10))
    engine.registerFormula(
      { col: 0, row: 0 },
      [{ col: 1, row: 0 }],
      (get) => get({ col: 1, row: 0 }),
    )

    // B1 depends on A1 → CYCLE
    const ok = engine.registerFormula(
      { col: 1, row: 0 },
      [{ col: 0, row: 0 }],
      (get) => get({ col: 0, row: 0 }),
    )

    expect(ok).toBe(false)
    const val = engine.get({ col: 1, row: 0 })
    expect(val._tag).toBe("Error")
    if (val._tag === "Error") {
      expect(val.error).toContain("Circular")
    }
  })

  it("H6: self-reference detected → CellError", () => {
    const registry = AtomRegistry.make()
    const engine = new SpikeFormulaEngine(registry)

    // A1 = A1 (self-reference)
    const ok = engine.registerFormula(
      { col: 0, row: 0 },
      [{ col: 0, row: 0 }],
      (get) => get({ col: 0, row: 0 }),
    )

    expect(ok).toBe(false)
  })
})

/**
 * FormulaEngineV2 — StackVM-powered formula engine tests.
 *
 * Tests the unified service: register → recalcDirty → result in CellStore.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer } from "effect-v4"
import type { CellValue } from "../src/schemas/cell-value"
import * as CV from "../src/schemas/cell-value"
import {
  FormulaEngineV2, FormulaEngineV2Config, FormulaEngineV2Live,
  type CellStore,
} from "../src/services/formula-engine-v2"

// ─── Test Helpers ───────────────────────────────────

function makeStore(initial?: Record<string, CellValue>): CellStore & { cells: Map<string, CellValue> } {
  const cells = new Map<string, CellValue>(
    initial ? Object.entries(initial) : []
  )
  return {
    cells,
    get: (addr) => cells.get(addr) ?? CV.empty(),
    set: (addr, value) => cells.set(addr, value),
  }
}

function makeTestLayer(store: CellStore) {
  return FormulaEngineV2Live.pipe(
    Layer.provide(Layer.succeed(FormulaEngineV2Config, FormulaEngineV2Config.of({ cellStore: store }))),
  )
}

/** Run an Effect that uses FormulaEngineV2 */
function run<A, E>(store: CellStore, effect: Effect.Effect<A, E, FormulaEngineV2>) {
  return Effect.runPromise(effect.pipe(Effect.provide(makeTestLayer(store))))
}

// ═══════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════

describe("FormulaEngineV2", () => {
  describe("registration", () => {
    it("registers a formula and extracts deps", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(20) })
      const record = await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        return yield* e.register("C1", "A1 B1 +")
      }))

      expect(record.addr).toBe("C1")
      expect(record.deps).toEqual(["A1", "B1"])
      expect(record.ir.length).toBeGreaterThan(0)
    })

    it("getFormula returns registered formula", async () => {
      const store = makeStore()
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        const f = e.getFormula("C1")
        expect(f).toBeDefined()
        expect(f!.expr).toBe("A1 B1 +")
      }))
    })

    it("allFormulas lists all registrations", async () => {
      const store = makeStore()
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        yield* e.register("D1", "C1 2 *")
        expect(e.allFormulas()).toHaveLength(2)
      }))
    })

    it("rejects circular dependency", async () => {
      const store = makeStore()
      const result = await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        return yield* Effect.result(e.register("A1", "C1 1 +"))
      }))
      // Result.Result: Failure = error case in v4
      expect(result._tag).toBe("Failure")
    })

    it("rejects invalid expression", async () => {
      const store = makeStore()
      await expect(
        run(store, Effect.gen(function*() {
          const e = yield* FormulaEngineV2
          yield* e.register("C1", "A1 BOGUS_OP +")
        }))
      ).rejects.toThrow()
    })
  })

  // ═══════════════════════════════════════════════════════
  // RECALC
  // ═══════════════════════════════════════════════════════

  describe("recalcDirty", () => {
    it("recalculates single formula", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(20) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        const result = yield* e.recalcDirty(["A1"])

        expect(result.recalculated).toEqual(["C1"])
        expect(result.errors).toHaveLength(0)
        expect(store.get("C1")).toEqual(CV.num(30))
      }))
    })

    it("cascading recalc: A1 → C1 → D1", async () => {
      const store = makeStore({ A1: CV.num(5), B1: CV.num(3) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        yield* e.register("D1", "C1 2 *")

        // Initial recalc
        const r1 = yield* e.recalcDirty(["A1", "B1"])
        expect(store.get("C1")).toEqual(CV.num(8))   // 5 + 3
        expect(store.get("D1")).toEqual(CV.num(16))  // 8 * 2
        expect(r1.recalculated).toHaveLength(2)

        // Change A1 → cascading update
        store.set("A1", CV.num(100))
        const r2 = yield* e.recalcDirty(["A1"])
        expect(store.get("C1")).toEqual(CV.num(103)) // 100 + 3
        expect(store.get("D1")).toEqual(CV.num(206)) // 103 * 2
      }))
    })

    it("diamond dependency: A1 → B1, A1 → C1, B1+C1 → D1", async () => {
      const store = makeStore({ A1: CV.num(10) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("B1", "A1 2 *")
        yield* e.register("C1", "A1 3 +")
        yield* e.register("D1", "B1 C1 +")

        const r = yield* e.recalcDirty(["A1"])
        expect(store.get("B1")).toEqual(CV.num(20))  // 10 * 2
        expect(store.get("C1")).toEqual(CV.num(13))  // 10 + 3
        expect(store.get("D1")).toEqual(CV.num(33))  // 20 + 13
        expect(r.recalculated).toHaveLength(3)
      }))
    })

    it("error propagation: DIV/0 cascades", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(0) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 /")
        yield* e.register("D1", "C1 1 +")

        yield* e.recalcDirty(["A1", "B1"])
        expect(store.get("C1")._tag).toBe("Error")
        expect(store.get("D1")._tag).toBe("Error")
      }))
    })

    it("no affected formulas → empty result", async () => {
      const store = makeStore({ A1: CV.num(10) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        const r = yield* e.recalcDirty(["A1"])
        expect(r.recalculated).toHaveLength(0)
      }))
    })

    it("reports duration", async () => {
      const store = makeStore({ A1: CV.num(1) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("B1", "A1 1 +")
        const r = yield* e.recalcDirty(["A1"])
        expect(r.durationMs).toBeGreaterThanOrEqual(0)
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // RECALC ALL
  // ═══════════════════════════════════════════════════════

  describe("recalcAll", () => {
    it("recalculates all formulas in topo order", async () => {
      const store = makeStore({ A1: CV.num(5) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("B1", "A1 2 *")
        yield* e.register("C1", "B1 1 +")

        const r = yield* e.recalcAll()
        expect(store.get("B1")).toEqual(CV.num(10)) // 5 * 2
        expect(store.get("C1")).toEqual(CV.num(11)) // 10 + 1
        expect(r.recalculated).toHaveLength(2)
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // UNREGISTER
  // ═══════════════════════════════════════════════════════

  describe("unregister", () => {
    it("removes formula from recalc", async () => {
      const store = makeStore({ A1: CV.num(10) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("B1", "A1 2 *")
        yield* e.recalcDirty(["A1"])
        expect(store.get("B1")).toEqual(CV.num(20))

        // Unregister
        yield* e.unregister("B1")
        expect(e.getFormula("B1")).toBeUndefined()

        // Change A1 — B1 should NOT recalc
        store.set("A1", CV.num(999))
        const r = yield* e.recalcDirty(["A1"])
        expect(r.recalculated).toHaveLength(0)
        expect(store.get("B1")).toEqual(CV.num(20)) // unchanged
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // DEPENDENCY QUERIES
  // ═══════════════════════════════════════════════════════

  describe("dependency queries", () => {
    it("dependentsOf returns formula cells", async () => {
      const store = makeStore()

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("B1", "A1 2 *")
        yield* e.register("C1", "A1 3 +")
        const deps = yield* e.dependentsOf("A1")
        expect(deps).toContain("B1")
        expect(deps).toContain("C1")
      }))
    })

    it("dependenciesOf returns deps", async () => {
      const store = makeStore()

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        expect(e.dependenciesOf("C1")).toEqual(["A1", "B1"])
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // RE-REGISTRATION (formula update)
  // ═══════════════════════════════════════════════════════

  describe("re-registration", () => {
    it("updating a formula changes its expression", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(5) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("C1", "A1 B1 +")
        yield* e.recalcDirty(["A1"])
        expect(store.get("C1")).toEqual(CV.num(15)) // 10 + 5

        // Re-register with new expression
        yield* e.unregister("C1")
        yield* e.register("C1", "A1 B1 *")
        yield* e.recalcDirty(["A1"])
        expect(store.get("C1")).toEqual(CV.num(50)) // 10 * 5
      }))
    })

    it("re-registering updates deps correctly", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(5), C1: CV.num(3) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.register("D1", "A1 B1 +")
        expect(e.dependenciesOf("D1")).toEqual(["A1", "B1"])

        // Re-register with different deps
        yield* e.unregister("D1")
        yield* e.register("D1", "A1 C1 *")
        expect(e.dependenciesOf("D1")).toEqual(["A1", "C1"])

        // B1 change should NOT affect D1 anymore
        store.set("B1", CV.num(999))
        const r = yield* e.recalcDirty(["B1"])
        expect(r.recalculated).toHaveLength(0)
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ═══════════════════════════════════════════════════════

  describe("bulk operations", () => {
    it("handles many dirty cells efficiently", async () => {
      const initial: Record<string, CellValue> = {}
      for (let i = 0; i < 100; i++) {
        initial[`A${i + 1}`] = CV.num(i)
      }
      const store = makeStore(initial)

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // Register 50 formulas: B_i = A_i * 2
        for (let i = 0; i < 50; i++) {
          yield* e.register(`B${i + 1}`, `A${i + 1} 2 *`)
        }

        // Change all A cells → recalc all B formulas
        const dirty = Array.from({ length: 50 }, (_, i) => `A${i + 1}`)
        const r = yield* e.recalcDirty(dirty)
        expect(r.recalculated).toHaveLength(50)
        expect(r.durationMs).toBeLessThan(100) // should be fast

        // Spot check
        expect(store.get("B1")).toEqual(CV.num(0))   // 0 * 2
        expect(store.get("B10")).toEqual(CV.num(18))  // 9 * 2
        expect(store.get("B50")).toEqual(CV.num(98))  // 49 * 2
      }))
    })

    it("chain of 20 formulas cascades correctly", async () => {
      const store = makeStore({ A1: CV.num(1) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // Chain: B1=A1+1, C1=B1+1, D1=C1+1, ..., T1=S1+1
        const letters = "BCDEFGHIJKLMNOPQRST".split("")
        let prev = "A1"
        for (const letter of letters) {
          const addr = `${letter}1`
          yield* e.register(addr, `${prev} 1 +`)
          prev = addr
        }

        yield* e.recalcDirty(["A1"])

        // A1=1, B1=2, C1=3, ..., T1=20
        expect(store.get("B1")).toEqual(CV.num(2))
        expect(store.get("T1")).toEqual(CV.num(20))

        // Change A1 → full cascade
        store.set("A1", CV.num(100))
        yield* e.recalcDirty(["A1"])
        expect(store.get("T1")).toEqual(CV.num(119)) // 100 + 19
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════

  describe("performance", () => {
    it("1000 independent formulas recalc within 50ms", async () => {
      const initial: Record<string, CellValue> = {}
      for (let i = 0; i < 1000; i++) {
        initial[`A${i + 1}`] = CV.num(i)
      }
      const store = makeStore(initial)

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        for (let i = 0; i < 1000; i++) {
          yield* e.register(`B${i + 1}`, `A${i + 1} 2 *`)
        }

        const dirty = Array.from({ length: 1000 }, (_, i) => `A${i + 1}`)
        const r = yield* e.recalcDirty(dirty)
        expect(r.recalculated).toHaveLength(1000)
        expect(r.durationMs).toBeLessThan(50)
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // INFIX FORMULAS
  // ═══════════════════════════════════════════════════════

  describe("infix formulas", () => {
    it("registerInfix: =A1+B1", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(20) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=A1+B1")
        yield* e.recalcDirty(["A1", "B1"])
        expect(store.get("C1")).toEqual(CV.num(30))
      }))
    })

    it("registerInfix: =A1+B1*2 (precedence)", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(5) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=A1+B1*2")
        yield* e.recalcDirty(["A1", "B1"])
        expect(store.get("C1")).toEqual(CV.num(20)) // 10 + 5*2
      }))
    })

    it("registerInfix: =SUM(A1:A3)+B1", async () => {
      const store = makeStore({ A1: CV.num(1), A2: CV.num(2), A3: CV.num(3), B1: CV.num(10) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=SUM(A1:A3)+B1")
        yield* e.recalcDirty(["A1", "A2", "A3", "B1"])
        expect(store.get("C1")).toEqual(CV.num(16)) // (1+2+3)+10
      }))
    })

    it("registerInfix: cascading with infix", async () => {
      const store = makeStore({ A1: CV.num(10) })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=A1*2")
        yield* e.registerInfix("C1", "=B1+5")
        yield* e.recalcDirty(["A1"])
        expect(store.get("B1")).toEqual(CV.num(20))
        expect(store.get("C1")).toEqual(CV.num(25))
      }))
    })
  })

  // ═══════════════════════════════════════════════════════
  // CONDITIONAL FORMULAS
  // ═══════════════════════════════════════════════════════

  describe("conditional formulas", () => {
    it("IF formula picks branch based on condition cell", async () => {
      const store = makeStore({
        A1: CV.num(1),    // condition (truthy)
        B1: CV.num(100),  // true branch
        C1: CV.num(200),  // false branch
      })

      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // Stack: false_val, true_val, condition → IF
        yield* e.register("D1", "C1 B1 A1 IF")
        yield* e.recalcDirty(["A1"])
        expect(store.get("D1")).toEqual(CV.num(100)) // A1=1 (truthy) → B1

        // Change condition to 0 (falsy)
        store.set("A1", CV.num(0))
        yield* e.recalcDirty(["A1"])
        expect(store.get("D1")).toEqual(CV.num(200)) // A1=0 (falsy) → C1
      }))
    })

    it("IFERROR: =IFERROR(A1/B1, 0) handles div-by-zero gracefully", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(0) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=IFERROR(A1/B1, 0)")
        const r1 = yield* e.recalcAll()
        expect(store.cells.get("C1")).toEqual(CV.num(0))
        expect(r1.errors.length).toBe(0)

        // Fix B1 → should now compute normally
        store.cells.set("B1", CV.num(2))
        const r2 = yield* e.recalcDirty(["B1"])
        expect(store.cells.get("C1")).toEqual(CV.num(5))
        expect(r2.errors.length).toBe(0)
      }))
    })

    it("nested: =ROUND(SUM(A1, A2, A3) / 3, 2) averages with rounding", async () => {
      const store = makeStore({ A1: CV.num(1), A2: CV.num(2), A3: CV.num(3) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=ROUND(SUM(A1, A2, A3) / 3, 2)")
        const r = yield* e.recalcAll()
        expect(store.cells.get("B1")).toEqual(CV.num(2))
        expect(r.errors.length).toBe(0)
      }))
    })

    it("volatile: =NOW() recalcs on every dirty cycle", async () => {
      const store = makeStore({ A1: CV.num(1) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=NOW()")
        const r1 = yield* e.recalcAll()
        const v1 = store.cells.get("B1")
        expect(v1?._tag).toBe("Number")

        // Volatile formulas recalc even when unrelated cell changes
        store.cells.set("A1", CV.num(2))
        yield* e.recalcDirty(["A1"])
        const v2 = store.cells.get("B1")
        expect(v2?._tag).toBe("Number")
        // NOW() should have recalced (value >= previous)
        if (v1?._tag === "Number" && v2?._tag === "Number") {
          expect(v2.value).toBeGreaterThanOrEqual(v1.value)
        }

        // Check volatile flag on record
        const rec = e.getFormula("B1")
        expect(rec?.volatile).toBe(true)
      }))
    })

    it("named range: =SUM(Revenue) where Revenue=A1:A3", async () => {
      const store = makeStore({ A1: CV.num(100), A2: CV.num(200), A3: CV.num(300) })
      const layer = FormulaEngineV2Live.pipe(
        Layer.provide(Layer.succeed(FormulaEngineV2Config, FormulaEngineV2Config.of({
          cellStore: store,
          namedRanges: { Revenue: "A1:A3" },
        }))),
      )
      await Effect.runPromise(Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=SUM(Revenue)")
        yield* e.recalcAll()
        expect(store.cells.get("B1")).toEqual(CV.num(600))
      }).pipe(Effect.provide(layer)))
    })

    it("named range: defineRange at runtime", async () => {
      const store = makeStore({ A1: CV.num(10), A2: CV.num(20) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        e.defineRange("Prices", "A1:A2")
        yield* e.registerInfix("B1", "=SUM(Prices)")
        yield* e.recalcAll()
        expect(store.cells.get("B1")).toEqual(CV.num(30))

        const ranges = e.namedRanges()
        expect(ranges["Prices"]).toBe("A1:A2")
      }))
    })

    it("validate: valid formula returns deps and IR info", async () => {
      const store = makeStore()
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        const result = yield* e.validate("=A1+B1*2")
        expect(result.valid).toBe(true)
        expect(result.deps).toContain("A1")
        expect(result.deps).toContain("B1")
        expect(result.irLength).toBeGreaterThan(0)
        expect(result.volatile).toBe(false)
      }))
    })

    it("validate: invalid formula returns error", async () => {
      const store = makeStore()
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        const result = yield* e.validate("=((A1+")
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.deps).toEqual([])
      }))
    })

    it("validate: volatile formula detected", async () => {
      const store = makeStore()
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        const result = yield* e.validate("=NOW()")
        expect(result.valid).toBe(true)
        expect(result.volatile).toBe(true)
      }))
    })

    it("comparison chain: =IF(A1>=10, 1, 0) with >= operator", async () => {
      const store = makeStore({ A1: CV.num(10) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=IF(A1>=10, 1, 0)")
        yield* e.recalcAll()
        expect(store.cells.get("B1")).toEqual(CV.num(1))

        store.cells.set("A1", CV.num(9))
        yield* e.recalcDirty(["A1"])
        expect(store.cells.get("B1")).toEqual(CV.num(0))
      }))
    })

    it("text formulas: =UPPER(A1) & \" \" & UPPER(B1)", async () => {
      const store = makeStore({ A1: CV.str("hello"), B1: CV.str("world") })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", '=UPPER(A1) & " " & UPPER(B1)')
        yield* e.recalcAll()
        expect(store.cells.get("C1")).toEqual(CV.str("HELLO WORLD"))

        store.cells.set("A1", CV.str("good"))
        yield* e.recalcDirty(["A1"])
        expect(store.cells.get("C1")).toEqual(CV.str("GOOD WORLD"))
      }))
    })

    it("realistic: tax calc with ROUND, IF, SUM, named range", async () => {
      const store = makeStore({
        A1: CV.num(1000),  // Income
        A2: CV.num(2000),
        A3: CV.num(500),
        B1: CV.num(0.2),   // Tax rate
      })
      const layer = FormulaEngineV2Live.pipe(
        Layer.provide(Layer.succeed(FormulaEngineV2Config, FormulaEngineV2Config.of({
          cellStore: store,
          namedRanges: { Income: "A1:A3" },
        }))),
      )
      await Effect.runPromise(Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // C1: Total income
        yield* e.registerInfix("C1", "=SUM(Income)")
        // C2: Tax (20% of income, rounded to 2 decimals)
        yield* e.registerInfix("C2", "=ROUND(C1 * B1, 2)")
        // C3: Net (income - tax), with error protection
        yield* e.registerInfix("C3", "=IFERROR(C1 - C2, 0)")

        const r = yield* e.recalcAll()
        expect(store.cells.get("C1")).toEqual(CV.num(3500))  // 1000+2000+500
        expect(store.cells.get("C2")).toEqual(CV.num(700))   // 3500*0.2
        expect(store.cells.get("C3")).toEqual(CV.num(2800))  // 3500-700
        expect(r.errors.length).toBe(0)

        // Change income → cascading recalc
        store.cells.set("A2", CV.num(3000))
        const r2 = yield* e.recalcDirty(["A2"])
        expect(store.cells.get("C1")).toEqual(CV.num(4500))  // 1000+3000+500
        expect(store.cells.get("C2")).toEqual(CV.num(900))   // 4500*0.2
        expect(store.cells.get("C3")).toEqual(CV.num(3600))  // 4500-900
        expect(r2.recalculated.length).toBeGreaterThanOrEqual(3)
      }).pipe(Effect.provide(layer)))
    })
  })
})

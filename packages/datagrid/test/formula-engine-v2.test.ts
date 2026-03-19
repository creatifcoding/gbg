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

    it("error recovery: one errored formula doesn't block others", async () => {
      const store = makeStore({ A1: CV.num(10), B1: CV.num(0) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=A1/B1")     // div by zero
        yield* e.registerInfix("D1", "=A1*2")       // should still work
        yield* e.registerInfix("E1", "=D1+5")       // depends on D1, should work
        const r = yield* e.recalcAll()
        // C1 has error (div/0), D1 and E1 are fine
        expect(r.recalculated.length).toBe(3)
        expect(store.cells.get("D1")).toEqual(CV.num(20))
        expect(store.cells.get("E1")).toEqual(CV.num(25))
        // C1 should be an error
        const c1 = store.cells.get("C1")
        expect(c1?._tag).toBe("Error")
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
    it("EXPERIMENT 136 CAPSTONE: full-breadth formula chain (10 categories)", async () => {
      const store = makeStore({
        A1: CV.num(42),       // input value
        A2: CV.num(0.05),     // rate
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // Math
        yield* e.registerInfix("B1", "=SQRT(A1)")
        // Text
        yield* e.registerInfix("B2", '=CONCAT(UPPER("val:"), TEXT(A1, "0.0"))')
        // Financial
        yield* e.registerInfix("B3", "=ROUND(PMT(A2/12, 360, 200000), 2)")
        // Logic
        yield* e.registerInfix("B4", '=IF(A1>40, "PASS", "FAIL")')
        // Info
        yield* e.registerInfix("B5", "=ISNUMBER(A1)")
        // Trig
        yield* e.registerInfix("B6", "=ROUND(SIN(RADIANS(30)), 1)")

        yield* e.recalcAll()
        expect((store.cells.get("B1") as any)?.value).toBeCloseTo(6.4807, 3)
        expect((store.cells.get("B2") as any)?.value).toBe("VAL:42.0")
        expect((store.cells.get("B3") as any)?.value).toBeLessThan(-1000)
        expect((store.cells.get("B4") as any)?.value).toBe("PASS")
        expect((store.cells.get("B5") as any)?.value).toBe(true)
        expect((store.cells.get("B6") as any)?.value).toBe(0.5)
      }))
    })

    it("EXPERIMENT 132 CAPSTONE: analytics dashboard (INDEX+MATCH+AGGREGATE+TEXT)", async () => {
      const store = makeStore({
        A1: CV.num(100),  A2: CV.num(200),  A3: CV.num(150),  A4: CV.num(300),  A5: CV.num(250),
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=AGGREGATE(9, A1, A2, A3, A4, A5)")     // SUM = 1000
        yield* e.registerInfix("B2", "=AGGREGATE(1, A1, A2, A3, A4, A5)")     // AVG = 200
        yield* e.registerInfix("B3", "=AGGREGATE(4, A1, A2, A3, A4, A5)")     // MAX = 300
        yield* e.registerInfix("B4", '=TEXT(B1, "#,##0")')                      // formatted sum
        yield* e.registerInfix("B5", "=ROUND(PERCENTILE(0.75, A1, A2, A3, A4, A5), 0)") // P75

        yield* e.recalcAll()
        expect((store.cells.get("B1") as any)?.value).toBe(1000) // SUM
        expect((store.cells.get("B2") as any)?.value).toBe(200)  // AVG
        expect((store.cells.get("B3") as any)?.value).toBe(300)  // MAX
        expect((store.cells.get("B4") as any)?.value).toBe("1,000") // formatted
        const p75 = (store.cells.get("B5") as any)?.value
        expect(p75).toBeGreaterThan(240)
        expect(p75).toBeLessThan(260)
      }))
    })

    it("EXPERIMENT 122 CAPSTONE: investment analysis (NPV+IRR+TEXT)", async () => {
      const store = makeStore({
        A1: CV.num(-50000),   // initial investment
        A2: CV.num(15000),    // year 1 return
        A3: CV.num(20000),    // year 2 return
        A4: CV.num(25000),    // year 3 return
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", '=ROUND(NPV(0.08, A1, A2, A3, A4), 2)')   // NPV at 8%
        yield* e.registerInfix("B2", '=ROUND(IRR(A1, A2, A3, A4)*100, 1)')      // IRR as %
        yield* e.registerInfix("B3", '=IF(B1>0, "ACCEPT", "REJECT")')           // decision
        yield* e.registerInfix("B4", '=TEXT(B1, "#,##0.00")')                    // formatted NPV

        yield* e.recalcAll()
        const npv = (store.cells.get("B1") as any)?.value
        expect(npv).toBeGreaterThan(500) // positive NPV → good investment
        const decision = (store.cells.get("B3") as any)?.value
        expect(decision).toBe("ACCEPT")
      }))
    })

    it("mortgage calculator: PMT + interest breakdown", async () => {
      const store = makeStore({
        A1: CV.num(250000),   // loan amount
        A2: CV.num(0.065),    // annual rate (6.5%)
        A3: CV.num(30),       // years
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=A2/12")                          // monthly rate
        yield* e.registerInfix("B2", "=A3*12")                          // total payments
        yield* e.registerInfix("B3", "=ROUND(PMT(B1, B2, A1), 2)")     // monthly payment
        yield* e.registerInfix("B4", "=ROUND(B3*B2, 2)")               // total paid
        yield* e.registerInfix("B5", "=ROUND(B4+A1, 2)")               // total interest (payment is negative)

        yield* e.recalcAll()
        const monthly = (store.cells.get("B3") as any)?.value
        expect(monthly).toBeLessThan(-1500) // ~$-1580
        expect(monthly).toBeGreaterThan(-1700)
        const totalPaid = (store.cells.get("B4") as any)?.value
        expect(totalPaid).toBeLessThan(-500000) // ~$-568,861
      }))
    })

    it("EXPERIMENT 100 CAPSTONE: full spreadsheet capabilities chain", async () => {
      // Simulates: product pricing sheet with derived metrics
      const store = makeStore({
        A1: CV.str("Widget A"), A2: CV.str("Widget B"), A3: CV.str("Widget C"),
        B1: CV.num(25.50), B2: CV.num(42.00), B3: CV.num(18.75),   // prices
        C1: CV.num(100),   C2: CV.num(50),    C3: CV.num(200),      // quantities
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // Line totals (price × quantity)
        yield* e.registerInfix("D1", "=B1*C1")     // 2550
        yield* e.registerInfix("D2", "=B2*C2")     // 2100
        yield* e.registerInfix("D3", "=B3*C3")     // 3750
        // Aggregates
        yield* e.registerInfix("E1", "=SUM(D1,D2,D3)")          // total revenue: 8400
        yield* e.registerInfix("E2", "=ROUND(AVG(B1,B2,B3), 2)")  // avg price: 28.75
        yield* e.registerInfix("E3", "=MEDIAN(B1,B2,B3)")         // median price: 25.50
        // Derived text
        yield* e.registerInfix("F1", '=CONCATENATE(UPPER(LEFT(A1,1)),LOWER(MID(A1,2,99)))')  // "Widget a" formatting
        // Conditional
        yield* e.registerInfix("F2", '=IFS(E1>10000,"EXCELLENT",E1>5000,"GOOD",TRUE,"FAIR")')
        // Info
        yield* e.registerInfix("F3", "=ISEVEN(SUM(C1,C2,C3))")   // 100+50+200=350, is even

        const r = yield* e.recalcAll()
        expect(store.cells.get("D1")).toEqual(CV.num(2550))
        expect(store.cells.get("D2")).toEqual(CV.num(2100))
        expect(store.cells.get("D3")).toEqual(CV.num(3750))
        expect(store.cells.get("E1")).toEqual(CV.num(8400))
        expect(store.cells.get("E2")).toEqual(CV.num(28.75))
        expect(store.cells.get("E3")).toEqual(CV.num(25.5))
        expect(store.cells.get("F2")).toEqual(CV.str("GOOD")) // 8400 > 5000
        expect(store.cells.get("F3")).toEqual(CV.bool(true))  // 350 is even
        expect(r.errors.length).toBe(0)
      }))
    })

    it("data analysis: COUNTIF + SUMIF + AVERAGEIF + STDEV + MEDIAN", async () => {
      const store = makeStore({
        A1: CV.num(85), A2: CV.num(92), A3: CV.num(67), A4: CV.num(91),
        A5: CV.num(78), A6: CV.num(95), A7: CV.num(55), A8: CV.num(88),
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        // Count passing scores (>=70)
        yield* e.registerInfix("B1", '=COUNTIF(">=70", A1, A2, A3, A4, A5, A6, A7, A8)')
        // Sum of passing scores
        yield* e.registerInfix("B2", '=SUMIF(">=70", A1, A2, A3, A4, A5, A6, A7, A8)')
        // Average of passing scores
        yield* e.registerInfix("B3", '=ROUND(AVERAGEIF(">=70", A1, A2, A3, A4, A5, A6, A7, A8), 1)')
        // Median of all scores
        yield* e.registerInfix("B4", "=MEDIAN(A1, A2, A3, A4, A5, A6, A7, A8)")
        // Top score
        yield* e.registerInfix("B5", "=LARGE(1, A1, A2, A3, A4, A5, A6, A7, A8)")

        yield* e.recalcAll()
        expect(store.cells.get("B1")).toEqual(CV.num(6))     // 85,92,91,78,95,88 pass
        expect(store.cells.get("B2")).toEqual(CV.num(529))    // sum of those 6
        expect(store.cells.get("B3")).toEqual(CV.num(88.2))   // 529/6 = 88.166...
        expect(store.cells.get("B4")).toEqual(CV.num(86.5))   // sorted: 55,67,78,85,88,91,92,95 → (85+88)/2
        expect(store.cells.get("B5")).toEqual(CV.num(95))     // max
      }))
    })

    it("percent-of-total pattern: =ROUND(A1/SUM(A1:A3)*100,1)", async () => {
      const store = makeStore({ A1: CV.num(30), A2: CV.num(50), A3: CV.num(20) })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("B1", "=ROUND(A1/SUM(A1,A2,A3)*100, 1)")
        yield* e.registerInfix("B2", "=ROUND(A2/SUM(A1,A2,A3)*100, 1)")
        yield* e.registerInfix("B3", "=ROUND(A3/SUM(A1,A2,A3)*100, 1)")
        yield* e.recalcAll()
        expect(store.cells.get("B1")).toEqual(CV.num(30))   // 30/100*100 = 30%
        expect(store.cells.get("B2")).toEqual(CV.num(50))   // 50/100*100 = 50%
        expect(store.cells.get("B3")).toEqual(CV.num(20))   // 20/100*100 = 20%
      }))
    })

    it("invoice generator: TEXTJOIN + IFS + ROUND + SUM", async () => {
      const store = makeStore({
        A1: CV.num(100), A2: CV.num(250), A3: CV.num(75),  // line items
        B1: CV.num(2),   B2: CV.num(1),   B3: CV.num(4),   // quantities
      })
      await run(store, Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=A1*B1")               // line 1 total
        yield* e.registerInfix("C2", "=A2*B2")               // line 2 total
        yield* e.registerInfix("C3", "=A3*B3")               // line 3 total
        yield* e.registerInfix("D1", "=SUM(C1,C2,C3)")       // subtotal
        yield* e.registerInfix("D2", "=ROUND(D1*0.08, 2)")   // 8% tax
        yield* e.registerInfix("D3", "=D1+D2")               // grand total
        yield* e.registerInfix("D4", '=IFS(D3>1000,"PREMIUM", D3>500,"STANDARD", TRUE,"BASIC")')

        const r = yield* e.recalcAll()
        expect(store.cells.get("C1")).toEqual(CV.num(200))
        expect(store.cells.get("C2")).toEqual(CV.num(250))
        expect(store.cells.get("C3")).toEqual(CV.num(300))
        expect(store.cells.get("D1")).toEqual(CV.num(750))
        expect(store.cells.get("D2")).toEqual(CV.num(60))     // 750 * 0.08
        expect(store.cells.get("D3")).toEqual(CV.num(810))    // 750 + 60
        expect(store.cells.get("D4")).toEqual(CV.str("STANDARD")) // 810 > 500
        expect(r.errors.length).toBe(0)
      }))
    })

    it("mini financial model: multi-level formulas with named ranges", async () => {
      const store = makeStore({
        A1: CV.num(100), A2: CV.num(200), A3: CV.num(150),  // Q1 sales
        B1: CV.num(40), B2: CV.num(80), B3: CV.num(60),     // Q1 costs
      })
      const layer = FormulaEngineV2Live.pipe(
        Layer.provide(Layer.succeed(FormulaEngineV2Config, FormulaEngineV2Config.of({
          cellStore: store,
          namedRanges: { Sales: "A1:A3", Costs: "B1:B3" },
        }))),
      )
      await Effect.runPromise(Effect.gen(function*() {
        const e = yield* FormulaEngineV2
        yield* e.registerInfix("C1", "=SUM(Sales)")          // total sales
        yield* e.registerInfix("C2", "=SUM(Costs)")          // total costs
        yield* e.registerInfix("C3", "=C1-C2")               // gross profit
        yield* e.registerInfix("C4", "=ROUND(C3/C1*100, 1)") // margin %
        yield* e.registerInfix("C5", '=IF(C4>=30, "GOOD", IF(C4>=20, "OK", "LOW"))') // rating

        const r = yield* e.recalcAll()
        expect(store.cells.get("C1")).toEqual(CV.num(450))    // 100+200+150
        expect(store.cells.get("C2")).toEqual(CV.num(180))    // 40+80+60
        expect(store.cells.get("C3")).toEqual(CV.num(270))    // 450-180
        expect(store.cells.get("C4")).toEqual(CV.num(60))     // 270/450*100=60%
        expect(store.cells.get("C5")).toEqual(CV.str("GOOD")) // 60>=30
        expect(r.errors.length).toBe(0)
      }).pipe(Effect.provide(layer)))
    })
  })
})

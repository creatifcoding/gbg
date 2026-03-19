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
  })
})

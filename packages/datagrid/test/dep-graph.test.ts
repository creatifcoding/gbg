/**
 * DepGraph — Dependency tracking with Effect v4 Graph.
 *
 * Tests: registration, cycle detection, topo eval order,
 * dependents/dependencies, unregister, diamond deps.
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"

import {
  makeDepGraph, CircularDepError,
} from "../src/services/dep-graph"

describe("DepGraph", () => {
  describe("registration", () => {
    it("registers a formula with deps", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1+1", ["A1"]))
      expect(g.hasFormula("B1")).toBe(true)
      expect(g.getFormulaSrc("B1")).toBe("=A1+1")
      expect(g.dependencies("B1")).toEqual(["A1"])
    })

    it("lazily creates data nodes for deps", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("C1", "=A1+B1", ["A1", "B1"]))
      expect(g.nodeCount()).toBe(3)
      expect(g.hasFormula("A1")).toBe(false)
      expect(g.hasFormula("B1")).toBe(false)
    })

    it("re-registration replaces old formula", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("C1", "=A1+B1", ["A1", "B1"]))
      await Effect.runPromise(g.registerFormula("C1", "=A1*2", ["A1"]))
      expect(g.getFormulaSrc("C1")).toBe("=A1*2")
      expect(g.dependencies("C1")).toEqual(["A1"])
      // B1 should no longer show C1 as dependent
      expect(g.dependents("B1")).not.toContain("C1")
    })
  })

  describe("cycle detection", () => {
    it("rejects self-reference", async () => {
      const g = makeDepGraph()
      const result = await Effect.runPromise(
        g.registerFormula("A1", "=A1", ["A1"]).pipe(
          Effect.catch((e) => Effect.succeed(e)),
        )
      )
      expect(result._tag).toBe("CircularDepError")
    })

    it("rejects simple cycle: A→B→A", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))

      const result = await Effect.runPromise(
        g.registerFormula("A1", "=B1", ["B1"]).pipe(
          Effect.catch((e) => Effect.succeed(e)),
        )
      )
      expect(result._tag).toBe("CircularDepError")
    })

    it("rejects transitive cycle: A→B→C→A", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))
      await Effect.runPromise(g.registerFormula("C1", "=B1", ["B1"]))

      const result = await Effect.runPromise(
        g.registerFormula("A1", "=C1", ["C1"]).pipe(
          Effect.catch((e) => Effect.succeed(e)),
        )
      )
      expect(result._tag).toBe("CircularDepError")
      expect((result as CircularDepError).addr).toBe("A1")
    })

    it("allows non-cyclic diamond: A→C, B→C, both read by D", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("C1", "=A1+B1", ["A1", "B1"]))
      await Effect.runPromise(g.registerFormula("D1", "=C1*2", ["C1"]))

      expect(g.hasFormula("C1")).toBe(true)
      expect(g.hasFormula("D1")).toBe(true)
    })

    it("preserves old edges on cycle rejection", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))

      // Try to create cycle — should fail
      await Effect.runPromise(
        g.registerFormula("A1", "=B1", ["B1"]).pipe(
          Effect.catch(() => Effect.void),
        )
      )

      // B1 should still have its original formula
      expect(g.hasFormula("B1")).toBe(true)
      expect(g.dependencies("B1")).toEqual(["A1"])
    })
  })

  describe("eval order", () => {
    it("returns dependents in topo order", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1+1", ["A1"]))
      await Effect.runPromise(g.registerFormula("C1", "=B1*2", ["B1"]))

      const order = g.evalOrder(["A1"])
      // A1 changed → B1 must eval before C1
      expect(order).toEqual(["B1", "C1"])
    })

    it("handles diamond dependencies", async () => {
      const g = makeDepGraph()
      // A1 → B1, A1 → C1, B1+C1 → D1
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))
      await Effect.runPromise(g.registerFormula("C1", "=A1", ["A1"]))
      await Effect.runPromise(g.registerFormula("D1", "=B1+C1", ["B1", "C1"]))

      const order = g.evalOrder(["A1"])
      // D1 must come after both B1 and C1
      const idxB = order.indexOf("B1")
      const idxC = order.indexOf("C1")
      const idxD = order.indexOf("D1")
      expect(idxD).toBeGreaterThan(idxB)
      expect(idxD).toBeGreaterThan(idxC)
    })

    it("returns empty for cells with no dependents", () => {
      const g = makeDepGraph()
      expect(g.evalOrder(["Z99"])).toEqual([])
    })

    it("handles multiple dirty cells", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("C1", "=A1+B1", ["A1", "B1"]))

      const order = g.evalOrder(["A1", "B1"])
      expect(order).toContain("C1")
    })
  })

  describe("unregister", () => {
    it("removes formula and reverts to data node", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))
      g.unregister("B1")

      expect(g.hasFormula("B1")).toBe(false)
      expect(g.getFormulaSrc("B1")).toBeNull()
      expect(g.dependents("A1")).not.toContain("B1")
    })

    it("unregistered cell no longer appears in eval order", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))
      g.unregister("B1")

      expect(g.evalOrder(["A1"])).toEqual([])
    })
  })

  describe("queries", () => {
    it("dependents returns direct dependents", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))
      await Effect.runPromise(g.registerFormula("C1", "=A1", ["A1"]))

      const deps = g.dependents("A1")
      expect(deps.sort()).toEqual(["B1", "C1"])
    })

    it("dependencies returns direct deps", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("D1", "=B1+C1", ["B1", "C1"]))
      expect(g.dependencies("D1").sort()).toEqual(["B1", "C1"])
    })

    it("allFormulas returns all registered formulas", async () => {
      const g = makeDepGraph()
      await Effect.runPromise(g.registerFormula("B1", "=A1", ["A1"]))
      await Effect.runPromise(g.registerFormula("C1", "=A1", ["A1"]))

      const all = g.allFormulas().sort()
      expect(all).toEqual(["B1", "C1"])
    })
  })
})

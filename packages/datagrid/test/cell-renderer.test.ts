/**
 * CellRenderer — G12 tests.
 *
 * Phase-aware visual treatment for AG-Grid cells.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer, ServiceMap } from "effect-v4"
import { AtomRegistry } from "effect-v4/unstable/reactivity"

import type { ColRow } from "../src/schemas/addressing"
import { cellKey } from "../src/schemas/addressing"
import { makeCellErrorStore } from "../src/services/cell-errors"

import {
  CellRenderer, CellRendererConfig, CellRendererLive,
  type CellPhaseInput, type CellVisual,
} from "../src/services/cell-renderer"

// ─── Harness ────────────────────────────────────────

const addr = (col: number, row: number): ColRow => ({ col, row })

function makeTestEnv() {
  const registry = AtomRegistry.make()
  const sheetId = "test"
  const errorStore = makeCellErrorStore(registry, sheetId)

  const configLayer = Layer.succeed(CellRendererConfig)(CellRendererConfig.of({
    registry, sheetId, errorStore,
  }))
  const layer = Layer.provide(CellRendererLive, configLayer)
  const sm = Effect.runSync(Effect.scoped(layer.pipe(Layer.build)))
  const renderer = ServiceMap.get(sm, CellRenderer)

  return { renderer, errorStore, registry }
}

const idle: CellPhaseInput = {
  interaction: "idle", freshness: "current",
  computation: "ready", permission: "unlocked", errors: [],
}

// ─── Tests ──────────────────────────────────────────

describe("CellRenderer (G12)", () => {

  describe("getCellVisual — pure phase → visual mapping", () => {

    it("idle cell → no classes, no tooltip, interactive", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual(idle)

      expect(visual.classes).toHaveLength(0)
      expect(visual.tooltip).toBeNull()
      expect(visual.interactive).toBe(true)
      expect(visual.showSpinner).toBe(false)
      expect(visual.flashCommit).toBe(false)
    })

    it("dirty → amber border class", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({ ...idle, interaction: "dirty" })

      expect(visual.classes).toContain("tmnl-cell--dirty")
      expect(visual.style.borderColor).toBe("#f59e0b")
    })

    it("error → red border + tooltip", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({
        ...idle, interaction: "error", errors: ["Invalid number"],
      })

      expect(visual.classes).toContain("tmnl-cell--error")
      expect(visual.style.borderColor).toBe("#ef4444")
      expect(visual.tooltip).toBe("Invalid number")
    })

    it("stale → dimmed + tooltip", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({ ...idle, freshness: "stale" })

      expect(visual.classes).toContain("tmnl-cell--stale")
      expect(visual.style.opacity).toBe("0.5")
      expect(visual.tooltip).toContain("Stale")
    })

    it("locked → grayed out, not interactive", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({ ...idle, permission: "locked" })

      expect(visual.classes).toContain("tmnl-cell--locked")
      expect(visual.style.cursor).toBe("not-allowed")
      expect(visual.interactive).toBe(false)
    })

    it("committed → flash class", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({ ...idle, interaction: "committed" })

      expect(visual.classes).toContain("tmnl-cell--committed")
      expect(visual.flashCommit).toBe(true)
    })

    it("computing → spinner", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({ ...idle, computation: "computing" })

      expect(visual.classes).toContain("tmnl-cell--computing")
      expect(visual.showSpinner).toBe(true)
    })

    it("committing → spinner", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({ ...idle, interaction: "committing" })

      expect(visual.classes).toContain("tmnl-cell--committing")
      expect(visual.showSpinner).toBe(true)
    })

    it("multi-axis: locked + stale", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getCellVisual({
        ...idle, permission: "locked", freshness: "stale",
      })

      expect(visual.classes).toContain("tmnl-cell--locked")
      expect(visual.classes).toContain("tmnl-cell--stale")
      expect(visual.interactive).toBe(false)
    })
  })

  describe("getVisualForCell — reads from phase family + error store", () => {

    it("reads default idle phase for unset cells", () => {
      const { renderer } = makeTestEnv()
      const visual = renderer.getVisualForCell(addr(0, 0))

      expect(visual.classes).toHaveLength(0)
      expect(visual.interactive).toBe(true)
    })

    it("respects setPhase", () => {
      const { renderer } = makeTestEnv()

      renderer.setPhase(addr(0, 0), { ...idle, interaction: "dirty" })
      const visual = renderer.getVisualForCell(addr(0, 0))

      expect(visual.classes).toContain("tmnl-cell--dirty")
    })

    it("incorporates error store issues in tooltip", () => {
      const { renderer, errorStore } = makeTestEnv()

      renderer.setPhase(addr(0, 0), { ...idle, interaction: "error" })
      errorStore.setError(addr(0, 0), {
        _tag: "CellError", source: "validation",
        issues: ["Must be a number", "Range 0-100"],
        timestamp: Date.now(),
      })

      const visual = renderer.getVisualForCell(addr(0, 0))
      expect(visual.tooltip).toBe("Must be a number; Range 0-100")
    })
  })

  describe("AG-Grid callbacks", () => {

    it("cellStyleCallback returns style object", () => {
      const { renderer } = makeTestEnv()
      renderer.setPhase(addr(0, 0), { ...idle, interaction: "dirty" })

      const style = renderer.cellStyleCallback({
        data: { _rowIndex: 0 },
        colDef: { field: "col_0" },
      })

      expect(style.borderColor).toBe("#f59e0b")
    })

    it("cellClassCallback returns space-separated classes", () => {
      const { renderer } = makeTestEnv()
      renderer.setPhase(addr(0, 0), { ...idle, permission: "locked" })

      const cls = renderer.cellClassCallback({
        data: { _rowIndex: 0 },
        colDef: { field: "col_0" },
      })

      expect(cls).toContain("tmnl-cell--locked")
    })

    it("tooltipCallback returns error text", () => {
      const { renderer, errorStore } = makeTestEnv()
      renderer.setPhase(addr(0, 0), { ...idle, interaction: "error", errors: ["Bad value"] })

      const tip = renderer.tooltipCallback({
        data: { _rowIndex: 0 },
        colDef: { field: "col_0" },
      })

      expect(tip).toBe("Bad value")
    })

    it("tooltipCallback returns null for clean cells", () => {
      const { renderer } = makeTestEnv()

      const tip = renderer.tooltipCallback({
        data: { _rowIndex: 0 },
        colDef: { field: "col_0" },
      })

      expect(tip).toBeNull()
    })

    it("callbacks return defaults for unknown fields", () => {
      const { renderer } = makeTestEnv()

      expect(renderer.cellStyleCallback({ data: { _rowIndex: 0 } })).toEqual({})
      expect(renderer.cellClassCallback({ data: { _rowIndex: 0 } })).toBe("")
      expect(renderer.tooltipCallback({ data: { _rowIndex: 0 } })).toBeNull()
    })
  })

  describe("phase atom", () => {
    it("getPhaseAtom provides reactive subscription", () => {
      const { renderer, registry } = makeTestEnv()

      const atom = renderer.getPhaseAtom(addr(0, 0))
      expect(registry.get(atom).interaction).toBe("idle")

      renderer.setPhase(addr(0, 0), { ...idle, interaction: "editing" })
      expect(registry.get(atom).interaction).toBe("editing")
    })
  })
})

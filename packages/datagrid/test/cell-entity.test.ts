/**
 * Cell TaggedClass — G8 validation.
 *
 * Tests the 4-axis state machine, transition guards,
 * derived getters, and Schema encode/decode.
 */
import { describe, it, expect } from "vitest"
import { Schema } from "effect"
import {
  Cell, makeCell,
  cellKey,
  num, str, empty, error,
} from "../src/index"

const KEY = cellKey("sheet-1", { col: 0, row: 0 })

describe("Cell TaggedClass", () => {

  // ─── Construction ─────────────────────────────

  it("makeCell creates idle cell with defaults", () => {
    const cell = makeCell(KEY)
    expect(cell._tag).toBe("Cell")
    expect(cell.cellKey).toBe(KEY)
    expect(cell.value).toBeNull()
    expect(cell.version).toBe(0)
    expect(cell.interaction).toBe("idle")
    expect(cell.freshness).toBe("current")
    expect(cell.computation).toBe("ready")
    expect(cell.permission).toBe("unlocked")
    expect(cell.lastDraft).toBeNull()
    expect(cell.errors).toEqual([])
    expect(cell.errorSource).toBeNull()
    expect(cell.formula).toBeNull()
    expect(cell.schemaOverride).toBeNull()
  })

  it("makeCell with initial value", () => {
    const cell = makeCell(KEY, num(42))
    expect(cell.hasValue).toBe(true)
    expect(cell.value).toEqual({ _tag: "Number", value: 42 })
  })

  it("is instanceof Cell", () => {
    const cell = makeCell(KEY)
    expect(cell).toBeInstanceOf(Cell)
  })

  // ─── Derived getters ──────────────────────────

  it("isEditable when unlocked and not committing", () => {
    const cell = makeCell(KEY)
    expect(cell.isEditable).toBe(true)
    expect(cell.lock().isEditable).toBe(false)
  })

  it("hasError when interaction=error", () => {
    const cell = makeCell(KEY)
    expect(cell.hasError).toBe(false)
    const errCell = cell.select().enterEdit().submit().commitFail(["oops"], "validation")
    expect(errCell.hasError).toBe(true)
  })

  it("isDirty when editing or dirty", () => {
    const cell = makeCell(KEY)
    expect(cell.isDirty).toBe(false)
    const editing = cell.select().enterEdit()
    expect(editing.isDirty).toBe(true)
    const dirty = editing.markDirty()
    expect(dirty.isDirty).toBe(true)
  })

  it("needsAttention when stale or error", () => {
    const cell = makeCell(KEY)
    expect(cell.needsAttention).toBe(false)
    expect(cell.markStale().needsAttention).toBe(true)
  })

  it("canUndo when lastDraft exists and idle/selected", () => {
    const cell = makeCell(KEY, num(1))
    expect(cell.canUndo).toBe(false)
    // Enter edit, then cancel → pushes value to lastDraft
    const cancelled = cell.select().enterEdit().cancelEdit()
    expect(cancelled.canUndo).toBe(true)
    expect(cancelled.lastDraft).toEqual({ _tag: "Number", value: 1 })
  })

  // ─── Interaction axis ─────────────────────────

  it("idle → selected → editing → dirty → committing → committed → idle", () => {
    let cell = makeCell(KEY, num(0))
    expect(cell.interaction).toBe("idle")

    cell = cell.select()
    expect(cell.interaction).toBe("selected")

    cell = cell.enterEdit()
    expect(cell.interaction).toBe("editing")

    cell = cell.markDirty()
    expect(cell.interaction).toBe("dirty")

    cell = cell.submit()
    expect(cell.interaction).toBe("committing")

    cell = cell.commitOk(num(99), 1)
    expect(cell.interaction).toBe("committed")
    expect(cell.value).toEqual({ _tag: "Number", value: 99 })
    expect(cell.version).toBe(1)

    cell = cell.settle()
    expect(cell.interaction).toBe("idle")
  })

  it("commitFail → error → retry → editing", () => {
    let cell = makeCell(KEY).select().enterEdit().submit()
    cell = cell.commitFail(["bad value"], "validation")
    expect(cell.interaction).toBe("error")
    expect(cell.errors).toEqual(["bad value"])
    expect(cell.errorSource).toBe("validation")

    cell = cell.retry()
    expect(cell.interaction).toBe("editing")
    expect(cell.errors).toEqual([])
  })

  it("cancelEdit pushes value to lastDraft", () => {
    const cell = makeCell(KEY, str("hello"))
    const cancelled = cell.select().enterEdit().cancelEdit()
    expect(cancelled.interaction).toBe("idle")
    expect(cancelled.lastDraft).toEqual({ _tag: "String", value: "hello" })
  })

  // ─── Cross-axis guards ────────────────────────

  it("locked blocks enterEdit", () => {
    const cell = makeCell(KEY).lock()
    const attempted = cell.select().enterEdit()
    // select succeeds (not guarded by lock), but enterEdit blocks
    expect(attempted.interaction).toBe("selected")
  })

  it("enterEdit blocked from idle when locked", () => {
    const cell = makeCell(KEY).lock().enterEdit()
    expect(cell.interaction).toBe("idle")
  })

  // ─── Freshness axis ──────────────────────────

  it("markStale / refresh cycle", () => {
    let cell = makeCell(KEY, num(1))
    expect(cell.freshness).toBe("current")

    cell = cell.markStale()
    expect(cell.freshness).toBe("stale")

    cell = cell.refresh(num(2), 5)
    expect(cell.freshness).toBe("current")
    expect(cell.value).toEqual({ _tag: "Number", value: 2 })
    expect(cell.version).toBe(5)
  })

  // ─── Computation axis ─────────────────────────

  it("startComputing / finishComputing", () => {
    let cell = makeCell(KEY)
    expect(cell.computation).toBe("ready")

    cell = cell.startComputing()
    expect(cell.computation).toBe("computing")

    cell = cell.finishComputing(num(42))
    expect(cell.computation).toBe("ready")
    expect(cell.value).toEqual({ _tag: "Number", value: 42 })
  })

  // ─── Permission axis ─────────────────────────

  it("lock / unlock", () => {
    let cell = makeCell(KEY)
    expect(cell.permission).toBe("unlocked")

    cell = cell.lock()
    expect(cell.permission).toBe("locked")

    cell = cell.unlock()
    expect(cell.permission).toBe("unlocked")
  })

  // ─── Undo ─────────────────────────────────────

  it("restoreDraft brings back lastDraft", () => {
    const cell = makeCell(KEY, num(10))
    const cancelled = cell.select().enterEdit().cancelEdit()
    expect(cancelled.canUndo).toBe(true)

    const restored = cancelled.restoreDraft()
    expect(restored.interaction).toBe("editing")
    expect(restored.value).toEqual({ _tag: "Number", value: 10 })
    expect(restored.lastDraft).toBeNull()
  })

  it("restoreDraft is no-op when no draft", () => {
    const cell = makeCell(KEY)
    expect(cell.restoreDraft()).toBe(cell)
  })

  // ─── Schema override / Formula ────────────────

  it("withSchemaOverride", () => {
    const cell = makeCell(KEY)
    const overridden = cell.withSchemaOverride("date-iso")
    expect(overridden.schemaOverride).toBe("date-iso")

    const cleared = overridden.withSchemaOverride(null)
    expect(cleared.schemaOverride).toBeNull()
  })

  it("withFormula", () => {
    const cell = makeCell(KEY)
    const formulaCell = cell.withFormula("=A1+B1")
    expect(formulaCell.formula).toBe("=A1+B1")
  })

  // ─── Schema encode/decode ─────────────────────

  it("encode → decode roundtrip", () => {
    const cell = makeCell(KEY, num(42))
    const encoded = Schema.encodeSync(Cell)(cell)
    expect(encoded._tag).toBe("Cell")
    expect(encoded.cellKey).toBe(KEY)

    const decoded = Schema.decodeSync(Cell)(encoded)
    expect(decoded).toBeInstanceOf(Cell)
    expect(decoded.value).toEqual({ _tag: "Number", value: 42 })
    expect(decoded.isEditable).toBe(true)
  })

  // ─── Invalid transitions are no-ops ───────────

  it("deselect from idle is no-op", () => {
    const cell = makeCell(KEY)
    expect(cell.deselect()).toBe(cell)
  })

  it("select from editing is no-op", () => {
    const cell = makeCell(KEY).select().enterEdit()
    expect(cell.select()).toBe(cell)
  })

  it("markDirty from idle is no-op", () => {
    const cell = makeCell(KEY)
    expect(cell.markDirty()).toBe(cell)
  })

  it("submit from idle is no-op", () => {
    const cell = makeCell(KEY)
    expect(cell.submit()).toBe(cell)
  })

  it("commitOk from idle is no-op", () => {
    const cell = makeCell(KEY)
    expect(cell.commitOk(num(1), 1)).toBe(cell)
  })

  it("settle from idle is no-op", () => {
    const cell = makeCell(KEY)
    expect(cell.settle()).toBe(cell)
  })

  it("retry from idle is no-op", () => {
    const cell = makeCell(KEY)
    expect(cell.retry()).toBe(cell)
  })
})

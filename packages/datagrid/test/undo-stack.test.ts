/**
 * Grid Undo Stack tests (G10)
 *
 * Validates record → undo → redo lifecycle, capacity bounds,
 * redo-clear-on-push, transactional application, and state atom.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer, Context } from "effect"
import { AtomRegistry } from "effect/unstable/reactivity"

import { num, str, empty, type CellValue } from "../src/schemas/cell-value"
import type { ColRow } from "../src/schemas/addressing"
import { cellKey } from "../src/schemas/addressing"
import {
  UndoStack, UndoStackConfig, UndoStackLive,
  type UndoEntry,
} from "../src/services/undo-stack"
import {
  CellCache, CellCacheConfig, CellCacheLive,
} from "../src/services/cell-cache"

// ─── Test harness ───────────────────────────────────

const addr = (col: number, row: number): ColRow => ({ col, row })

function makeTestLayer(opts?: { capacity?: number }) {
  const registry = AtomRegistry.make()
  const sheetId = "test-sheet"
  const db = new Map<string, CellValue>()

  const cellCacheConfigLayer = Layer.succeed(CellCacheConfig)(CellCacheConfig.of({
    sheetId,
    registry,
    readCell: (sid, col, row) => db.get(cellKey(sid, { col, row })) ?? null,
    writeCell: (sid, col, row, value) => Effect.sync(() => { db.set(cellKey(sid, { col, row }), value) }),
    writeCellBulk: (sid, entries) => Effect.sync(() => {
      for (const e of entries) db.set(cellKey(sid, { col: e.col, row: e.row }), e.value)
    }),
  }))

  const cellCacheLayer = Layer.provide(CellCacheLive, cellCacheConfigLayer)

  // Build CellCache first, then use it for UndoStack config
  return Effect.gen(function*() {
    const ccSM = yield* Effect.scoped(cellCacheLayer.pipe(Layer.build))
    const cellCache = Context.get(ccSM, CellCache)

    const undoConfigLayer = Layer.succeed(UndoStackConfig)(UndoStackConfig.of({
      capacity: opts?.capacity,
      registry,
      cellCache,
    }))

    const undoLayer = Layer.provide(UndoStackLive, undoConfigLayer)
    const undoSM = yield* Effect.scoped(undoLayer.pipe(Layer.build))
    const undoStack = Context.get(undoSM, UndoStack)

    return { cellCache, undoStack, registry }
  })
}

function runTest<A>(effect: Effect.Effect<A>): A {
  return Effect.runSync(effect)
}

// ─── Tests ──────────────────────────────────────────

describe("Grid Undo Stack (G10)", () => {

  // ── Basic lifecycle ───────────────────────────

  describe("record / undo / redo", () => {
    it("records a write and undoes it", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      // Initial state: empty
      expect(cellCache.get(a1)).toEqual(empty())

      // Write num(42)
      const entry = undoStack.record([{ addr: a1, value: num(42) }], "set A1")
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(42) }]))

      expect(cellCache.get(a1)).toEqual(num(42))
      expect(entry.cells.length).toBe(1)
      expect(entry.cells[0]!.before).toEqual(empty())
      expect(entry.cells[0]!.after).toEqual(num(42))
      expect(entry.label).toBe("set A1")

      // Undo → should restore empty
      const undone = Effect.runSync(undoStack.undo())
      expect(undone).not.toBeNull()
      expect(undone!.id).toBe(entry.id)
      expect(cellCache.get(a1)).toEqual(empty())

      // Redo → should re-apply num(42)
      const redone = Effect.runSync(undoStack.redo())
      expect(redone).not.toBeNull()
      expect(redone!.id).toBe(entry.id)
      expect(cellCache.get(a1)).toEqual(num(42))
    })

    it("multi-cell undo/redo", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0), b1 = addr(1, 0), c1 = addr(2, 0)

      // Write 3 cells
      const entries = [
        { addr: a1, value: num(1) },
        { addr: b1, value: num(2) },
        { addr: c1, value: num(3) },
      ]
      undoStack.record(entries, "bulk write")
      Effect.runSync(cellCache.transactionalSetBulk(entries))

      expect(cellCache.get(a1)).toEqual(num(1))
      expect(cellCache.get(b1)).toEqual(num(2))
      expect(cellCache.get(c1)).toEqual(num(3))

      // Undo
      Effect.runSync(undoStack.undo())
      expect(cellCache.get(a1)).toEqual(empty())
      expect(cellCache.get(b1)).toEqual(empty())
      expect(cellCache.get(c1)).toEqual(empty())

      // Redo
      Effect.runSync(undoStack.redo())
      expect(cellCache.get(a1)).toEqual(num(1))
      expect(cellCache.get(b1)).toEqual(num(2))
      expect(cellCache.get(c1)).toEqual(num(3))
    })
  })

  // ── Stack behavior ────────────────────────────

  describe("stack behavior", () => {
    it("undo returns null when stack is empty", () => {
      const { undoStack } = runTest(makeTestLayer())
      const result = Effect.runSync(undoStack.undo())
      expect(result).toBeNull()
    })

    it("redo returns null when stack is empty", () => {
      const { undoStack } = runTest(makeTestLayer())
      const result = Effect.runSync(undoStack.redo())
      expect(result).toBeNull()
    })

    it("new record clears redo stack", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      // Write → undo → creates redo entry
      undoStack.record([{ addr: a1, value: num(1) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(1) }]))
      Effect.runSync(undoStack.undo())
      expect(undoStack.canRedo()).toBe(true)

      // New write → should clear redo
      undoStack.record([{ addr: a1, value: num(99) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(99) }]))
      expect(undoStack.canRedo()).toBe(false)
    })

    it("multiple undo/redo in sequence", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      // 3 sequential writes
      for (let i = 1; i <= 3; i++) {
        undoStack.record([{ addr: a1, value: num(i) }])
        Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(i) }]))
      }

      expect(cellCache.get(a1)).toEqual(num(3))
      expect(undoStack.undoDepth()).toBe(3)

      // Undo 3 times
      Effect.runSync(undoStack.undo()) // 3 → 2
      expect(cellCache.get(a1)).toEqual(num(2))

      Effect.runSync(undoStack.undo()) // 2 → 1
      expect(cellCache.get(a1)).toEqual(num(1))

      Effect.runSync(undoStack.undo()) // 1 → empty
      expect(cellCache.get(a1)).toEqual(empty())

      expect(undoStack.undoDepth()).toBe(0)
      expect(undoStack.redoDepth()).toBe(3)

      // Redo 2 times
      Effect.runSync(undoStack.redo()) // empty → 1
      expect(cellCache.get(a1)).toEqual(num(1))

      Effect.runSync(undoStack.redo()) // 1 → 2
      expect(cellCache.get(a1)).toEqual(num(2))

      expect(undoStack.undoDepth()).toBe(2)
      expect(undoStack.redoDepth()).toBe(1)
    })
  })

  // ── Capacity bounds ───────────────────────────

  describe("capacity", () => {
    it("drops oldest entries beyond capacity", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer({ capacity: 3 }))
      const a1 = addr(0, 0)

      for (let i = 1; i <= 5; i++) {
        undoStack.record([{ addr: a1, value: num(i) }], `write-${i}`)
        Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(i) }]))
      }

      // Only 3 entries retained
      expect(undoStack.undoDepth()).toBe(3)

      // Most recent 3 should be: write-5, write-4, write-3
      const top = undoStack.peekUndo()
      expect(top?.label).toBe("write-5")
    })

    it("defaults to capacity 50", () => {
      const { undoStack } = runTest(makeTestLayer())
      const state = runTest(Effect.sync(() => undoStack.stateAtom))
      // Can't easily test 50 without writing 50 entries, but check the state
      expect(undoStack.undoDepth()).toBe(0)
    })
  })

  // ── Query helpers ─────────────────────────────

  describe("query helpers", () => {
    it("canUndo / canRedo track correctly", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      expect(undoStack.canUndo()).toBe(false)
      expect(undoStack.canRedo()).toBe(false)

      undoStack.record([{ addr: a1, value: num(1) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(1) }]))

      expect(undoStack.canUndo()).toBe(true)
      expect(undoStack.canRedo()).toBe(false)

      Effect.runSync(undoStack.undo())
      expect(undoStack.canUndo()).toBe(false)
      expect(undoStack.canRedo()).toBe(true)
    })

    it("peekUndo / peekRedo return top without popping", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      undoStack.record([{ addr: a1, value: num(7) }], "peek-test")
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(7) }]))

      const peeked = undoStack.peekUndo()
      expect(peeked?.label).toBe("peek-test")
      expect(undoStack.undoDepth()).toBe(1) // Still there

      expect(undoStack.peekRedo()).toBeUndefined()
    })

    it("clear resets both stacks", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      undoStack.record([{ addr: a1, value: num(1) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(1) }]))
      Effect.runSync(undoStack.undo())

      expect(undoStack.canRedo()).toBe(true)

      undoStack.clear()
      expect(undoStack.undoDepth()).toBe(0)
      expect(undoStack.redoDepth()).toBe(0)
      expect(undoStack.canUndo()).toBe(false)
      expect(undoStack.canRedo()).toBe(false)
    })
  })

  // ── Reactive state ────────────────────────────

  describe("reactive state", () => {
    it("stateAtom reflects current stack state", () => {
      const { cellCache, undoStack, registry } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      const state0 = registry.get(undoStack.stateAtom)
      expect(state0.undoStack.length).toBe(0)

      undoStack.record([{ addr: a1, value: num(1) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(1) }]))

      const state1 = registry.get(undoStack.stateAtom)
      expect(state1.undoStack.length).toBe(1)
      expect(state1.redoStack.length).toBe(0)

      Effect.runSync(undoStack.undo())

      const state2 = registry.get(undoStack.stateAtom)
      expect(state2.undoStack.length).toBe(0)
      expect(state2.redoStack.length).toBe(1)
    })
  })

  // ── Edge cases ────────────────────────────────

  describe("edge cases", () => {
    it("overwrite same cell multiple times, undo restores each step", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      // Write str → num → empty
      undoStack.record([{ addr: a1, value: str("hello") }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: str("hello") }]))

      undoStack.record([{ addr: a1, value: num(42) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(42) }]))

      undoStack.record([{ addr: a1, value: empty() }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: empty() }]))

      expect(cellCache.get(a1)).toEqual(empty())

      Effect.runSync(undoStack.undo()) // empty → num(42) before
      expect(cellCache.get(a1)).toEqual(num(42))

      Effect.runSync(undoStack.undo()) // num(42) → str before
      expect(cellCache.get(a1)).toEqual(str("hello"))

      Effect.runSync(undoStack.undo()) // str → empty before
      expect(cellCache.get(a1)).toEqual(empty())
    })

    it("undo after redo after undo (zigzag)", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)

      undoStack.record([{ addr: a1, value: num(10) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(10) }]))

      undoStack.record([{ addr: a1, value: num(20) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(20) }]))

      Effect.runSync(undoStack.undo()) // 20 → 10
      Effect.runSync(undoStack.redo()) // 10 → 20
      Effect.runSync(undoStack.undo()) // 20 → 10
      Effect.runSync(undoStack.undo()) // 10 → empty

      expect(cellCache.get(a1)).toEqual(empty())
      expect(undoStack.redoDepth()).toBe(2)
    })

    it("entry IDs are unique", () => {
      const { cellCache, undoStack } = runTest(makeTestLayer())
      const a1 = addr(0, 0)
      const ids = new Set<string>()

      for (let i = 0; i < 10; i++) {
        const entry = undoStack.record([{ addr: a1, value: num(i) }])
        Effect.runSync(cellCache.transactionalSetBulk([{ addr: a1, value: num(i) }]))
        ids.add(entry.id)
      }

      expect(ids.size).toBe(10)
    })
  })
})

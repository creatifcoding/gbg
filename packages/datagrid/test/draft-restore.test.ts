/**
 * DraftRestore — G11 tests.
 *
 * Cell-scoped draft restoration with context-dependent undo dispatch.
 */

import { describe, it, expect } from "vitest"
import { Effect, Layer, ServiceMap } from "effect-v4"
import { AtomRegistry } from "effect-v4/unstable/reactivity"

import {
  num, str, empty, type CellValue,
} from "../src/schemas/cell-value"
import type { ColRow } from "../src/schemas/addressing"
import { cellKey } from "../src/schemas/addressing"

import { CellCache, CellCacheConfig, CellCacheLive } from "../src/services/cell-cache"
import { UndoStack, UndoStackConfig, UndoStackLive } from "../src/services/undo-stack"
import { DraftRestore, DraftRestoreConfig, DraftRestoreLive } from "../src/services/draft-restore"

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
  const cellCache = ServiceMap.get(ccSM, CellCache)

  // UndoStack
  const undoConfigLayer = Layer.succeed(UndoStackConfig)(UndoStackConfig.of({ registry, cellCache }))
  const undoLayer = Layer.provide(UndoStackLive, undoConfigLayer)
  const undoSM = Effect.runSync(Effect.scoped(undoLayer.pipe(Layer.build)))
  const undoStack = ServiceMap.get(undoSM, UndoStack)

  // DraftRestore
  const drConfigLayer = Layer.succeed(DraftRestoreConfig)(DraftRestoreConfig.of({
    registry, sheetId, cellCache, undoStack,
  }))
  const drLayer = Layer.provide(DraftRestoreLive, drConfigLayer)
  const drSM = Effect.runSync(Effect.scoped(drLayer.pipe(Layer.build)))
  const draftRestore = ServiceMap.get(drSM, DraftRestore)

  return { cellCache, undoStack, draftRestore, registry }
}

// ─── Tests ──────────────────────────────────────────

describe("DraftRestore (G11)", () => {

  describe("draft CRUD", () => {
    it("saveDraft + getDraft round-trips", () => {
      const { draftRestore } = makeTestEnv()
      draftRestore.saveDraft(addr(0, 0), str("hello"))
      expect(draftRestore.getDraft(addr(0, 0))).toEqual(str("hello"))
    })

    it("getDraft returns null for cells without drafts", () => {
      const { draftRestore } = makeTestEnv()
      expect(draftRestore.getDraft(addr(99, 99))).toBeNull()
    })

    it("consumeDraft returns value and clears it", () => {
      const { draftRestore } = makeTestEnv()
      draftRestore.saveDraft(addr(0, 0), num(42))

      const draft = draftRestore.consumeDraft(addr(0, 0))
      expect(draft).toEqual(num(42))

      // Second consume returns null
      expect(draftRestore.consumeDraft(addr(0, 0))).toBeNull()
    })

    it("clearDraft removes the draft", () => {
      const { draftRestore } = makeTestEnv()
      draftRestore.saveDraft(addr(0, 0), str("draft"))
      draftRestore.clearDraft(addr(0, 0))
      expect(draftRestore.getDraft(addr(0, 0))).toBeNull()
    })
  })

  describe("dispatchUndo — context-dependent", () => {
    it("focused cell with draft → DraftRestored", () => {
      const { draftRestore, cellCache } = makeTestEnv()

      // Write initial value
      Effect.runSync(cellCache.set(addr(0, 0), str("current")))

      // Save draft (simulates cancel-edit)
      draftRestore.saveDraft(addr(0, 0), str("draft-value"))

      // Dispatch undo with focused cell
      const result = Effect.runSync(draftRestore.dispatchUndo(addr(0, 0)))

      expect(result._tag).toBe("DraftRestored")
      if (result._tag === "DraftRestored") {
        expect(result.draft).toEqual(str("draft-value"))
        expect(result.addr).toEqual(addr(0, 0))
      }

      // Cell value restored to draft
      expect(cellCache.get(addr(0, 0))).toEqual(str("draft-value"))
    })

    it("focused cell without draft → GridUndo", () => {
      const { draftRestore, undoStack, cellCache } = makeTestEnv()

      // Create an undo-able entry
      undoStack.record([{ addr: addr(0, 0), value: num(99) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: addr(0, 0), value: num(99) }]))

      // Focus cell with no draft → falls through to grid undo
      const result = Effect.runSync(draftRestore.dispatchUndo(addr(0, 0)))
      expect(result._tag).toBe("GridUndo")
    })

    it("no focused cell + undo available → GridUndo", () => {
      const { draftRestore, undoStack, cellCache } = makeTestEnv()

      undoStack.record([{ addr: addr(0, 0), value: num(50) }])
      Effect.runSync(cellCache.transactionalSetBulk([{ addr: addr(0, 0), value: num(50) }]))

      const result = Effect.runSync(draftRestore.dispatchUndo(null))
      expect(result._tag).toBe("GridUndo")
    })

    it("no focused cell + no undo → NothingToUndo", () => {
      const { draftRestore } = makeTestEnv()

      const result = Effect.runSync(draftRestore.dispatchUndo(null))
      expect(result._tag).toBe("NothingToUndo")
    })

    it("draft consumed after restore — not repeatable", () => {
      const { draftRestore, cellCache } = makeTestEnv()

      draftRestore.saveDraft(addr(0, 0), str("once"))
      Effect.runSync(draftRestore.dispatchUndo(addr(0, 0)))

      // Second dispatch — no draft remaining
      const result = Effect.runSync(draftRestore.dispatchUndo(addr(0, 0)))
      expect(result._tag).toBe("NothingToUndo")
    })
  })

  describe("draft atom", () => {
    it("getDraftAtom provides reactive subscription", () => {
      const { draftRestore, registry } = makeTestEnv()

      const atom = draftRestore.getDraftAtom(addr(0, 0))
      expect(registry.get(atom).lastDraft).toBeNull()

      draftRestore.saveDraft(addr(0, 0), num(77))
      expect(registry.get(atom).lastDraft).toEqual(num(77))
    })
  })
})

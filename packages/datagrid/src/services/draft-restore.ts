/**
 * DraftRestore — Cell-scoped draft restoration (G11).
 *
 * When a cell edit is cancelled (Escape), the draft is stored
 * in Cell.lastDraft. When that cell is focused and Ctrl+Z is
 * pressed, this service restores the draft and enters editing.
 *
 * Context-dependent dispatch:
 *   - Cell focused + lastDraft exists → cell undo (restore draft)
 *   - Grid focused (no cell selected)  → grid undo (UndoStack)
 *   - Cell focused + no lastDraft      → grid undo (UndoStack)
 *
 * @module
 */

import { Effect, Context, Layer } from "effect"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import { stxFamily, type StxFamily } from "@tmnl/stx"
import type { CellValue } from "../schemas/cell-value"
import type { ColRow } from "../schemas/addressing"
import { cellKey } from "../schemas/addressing"
import type { CellCacheShape } from "./cell-cache"
import type { UndoStackShape } from "./undo-stack"
import { Cell, type InteractionPhase } from "../schemas/cell"

// ─── Config ─────────────────────────────────────────

export interface DraftRestoreConfigShape {
  readonly registry: AtomRegistry.AtomRegistry
  readonly sheetId: string
  readonly cellCache: CellCacheShape
  readonly undoStack?: UndoStackShape
}

export class DraftRestoreConfig extends Context.Service<DraftRestoreConfig, DraftRestoreConfigShape>()(
  "@tmnl/datagrid/DraftRestoreConfig",
) {}

// ─── Cell interaction state (lightweight per-cell UI state) ────

export interface CellDraftState {
  readonly interaction: InteractionPhase
  readonly lastDraft: CellValue | null
}

const DEFAULT_DRAFT_STATE: CellDraftState = {
  interaction: "idle",
  lastDraft: null,
}

// ─── Undo dispatch result ───────────────────────────

export type UndoDispatchResult =
  | { readonly _tag: "DraftRestored"; readonly addr: ColRow; readonly draft: CellValue }
  | { readonly _tag: "GridUndo" }
  | { readonly _tag: "NothingToUndo" }

// ─── Service interface ──────────────────────────────

export interface DraftRestoreShape {
  /**
   * Store a draft when cell edit is cancelled.
   */
  readonly saveDraft: (addr: ColRow, draft: CellValue) => void

  /**
   * Get the stored draft for a cell (null if none).
   */
  readonly getDraft: (addr: ColRow) => CellValue | null

  /**
   * Consume the draft: returns it and clears it.
   */
  readonly consumeDraft: (addr: ColRow) => CellValue | null

  /**
   * Clear the draft for a cell.
   */
  readonly clearDraft: (addr: ColRow) => void

  /**
   * Context-dependent Ctrl+Z dispatch.
   *
   * If focusedCell is provided and has a draft → restore draft.
   * Otherwise → delegate to UndoStack (grid undo).
   */
  readonly dispatchUndo: (
    focusedCell: ColRow | null,
  ) => Effect.Effect<UndoDispatchResult>

  /**
   * Get the draft atom for a cell (for React subscriptions).
   */
  readonly getDraftAtom: (addr: ColRow) => ReturnType<StxFamily<string, CellDraftState>>

  /** The draft family */
  readonly family: StxFamily<string, CellDraftState>
}

// ─── Service tag ────────────────────────────────────

export class DraftRestore extends Context.Service<DraftRestore, DraftRestoreShape>()(
  "@tmnl/datagrid/DraftRestore",
) {}

// ─── Layer ──────────────────────────────────────────

export const DraftRestoreLive = Layer.effect(
  DraftRestore,
  Effect.gen(function*() {
    const config = yield* DraftRestoreConfig
    const { registry, sheetId, cellCache, undoStack } = config

    const family = stxFamily(
      (_key: string): CellDraftState => DEFAULT_DRAFT_STATE,
      registry,
    )

    // Track cells with active drafts
    const activeDrafts = new Set<string>()

    function saveDraft(addr: ColRow, draft: CellValue): void {
      const key = cellKey(sheetId, addr)
      family.set(key, { interaction: "idle", lastDraft: draft })
      activeDrafts.add(key)
    }

    function getDraft(addr: ColRow): CellValue | null {
      const key = cellKey(sheetId, addr)
      return family.get(key).lastDraft
    }

    function consumeDraft(addr: ColRow): CellValue | null {
      const key = cellKey(sheetId, addr)
      const state = family.get(key)
      if (state.lastDraft === null) return null

      const draft = state.lastDraft
      family.set(key, DEFAULT_DRAFT_STATE)
      activeDrafts.delete(key)
      return draft
    }

    function clearDraft(addr: ColRow): void {
      const key = cellKey(sheetId, addr)
      family.set(key, DEFAULT_DRAFT_STATE)
      activeDrafts.delete(key)
    }

    function dispatchUndo(
      focusedCell: ColRow | null,
    ): Effect.Effect<UndoDispatchResult> {
      // Cell-scoped: restore draft if focused cell has one
      if (focusedCell) {
        const draft = consumeDraft(focusedCell)
        if (draft !== null) {
          return cellCache.set(focusedCell, draft).pipe(
            Effect.as<UndoDispatchResult>({ _tag: "DraftRestored", addr: focusedCell, draft }),
            Effect.orElseSucceed((): UndoDispatchResult => ({ _tag: "NothingToUndo" })),
          )
        }
      }

      // Grid-scoped: delegate to UndoStack
      if (undoStack?.canUndo()) {
        return undoStack.undo().pipe(
          Effect.as<UndoDispatchResult>({ _tag: "GridUndo" }),
          Effect.orElseSucceed((): UndoDispatchResult => ({ _tag: "NothingToUndo" })),
        )
      }

      return Effect.succeed<UndoDispatchResult>({ _tag: "NothingToUndo" })
    }

    return DraftRestore.of({
      saveDraft,
      getDraft,
      consumeDraft,
      clearDraft,
      dispatchUndo,
      getDraftAtom: (addr) => family(cellKey(sheetId, addr)),
      family,
    })
  }),
)

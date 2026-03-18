/**
 * Grid Undo Stack — G10
 *
 * Grid-level undo/redo with real transactional semantics.
 * Each entry captures before/after snapshots per cell.
 * Undo/redo applies values via CellCache.transactionalSetBulk.
 *
 * Capacity bounded (default 50). Redo stack clears on new push.
 *
 * @module
 */

import { Effect, ServiceMap, Layer } from "effect-v4"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"

import type { CellValue } from "../schemas/cell-value"
import type { ColRow } from "../schemas/addressing"
import type { CellCacheShape } from "./cell-cache"
import { CellWriteError } from "./cell-errors"

// ─── Types ──────────────────────────────────────────

export interface CellSnapshot {
  readonly addr: ColRow
  readonly before: CellValue
  readonly after: CellValue
}

export interface UndoEntry {
  readonly id: string
  readonly timestamp: number
  readonly cells: ReadonlyArray<CellSnapshot>
  readonly label?: string
}

export interface UndoStackState {
  readonly undoStack: ReadonlyArray<UndoEntry>
  readonly redoStack: ReadonlyArray<UndoEntry>
  readonly capacity: number
}

// ─── Config ─────────────────────────────────────────

export interface UndoStackConfigShape {
  /** Maximum undo entries (default 50) */
  readonly capacity?: number
  /** Registry for state atoms */
  readonly registry: AtomRegistry.AtomRegistry
  /** CellCache for reading current + applying undo/redo */
  readonly cellCache: CellCacheShape
}

export class UndoStackConfig extends ServiceMap.Service<UndoStackConfig, UndoStackConfigShape>()(
  "@tmnl/datagrid/UndoStackConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface UndoStackShape {
  /**
   * Record a transactional write — captures before-values from
   * current cell state, pushes entry, clears redo stack.
   *
   * Call this BEFORE applying the write via transactionalSetBulk.
   * The caller is responsible for actually applying the write
   * after this returns.
   */
  readonly record: (
    entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>,
    label?: string,
  ) => UndoEntry

  /**
   * Undo the most recent entry.
   * Applies before-values via transactionalSetBulk.
   * Moves entry to redo stack.
   */
  readonly undo: () => Effect.Effect<UndoEntry | null, CellWriteError>

  /**
   * Redo the most recently undone entry.
   * Applies after-values via transactionalSetBulk.
   * Moves entry back to undo stack.
   */
  readonly redo: () => Effect.Effect<UndoEntry | null, CellWriteError>

  /** Can undo? */
  readonly canUndo: () => boolean

  /** Can redo? */
  readonly canRedo: () => boolean

  /** Current undo stack depth */
  readonly undoDepth: () => number

  /** Current redo stack depth */
  readonly redoDepth: () => number

  /** Clear both stacks */
  readonly clear: () => void

  /** Peek at the top undo entry without popping */
  readonly peekUndo: () => UndoEntry | undefined

  /** Peek at the top redo entry without popping */
  readonly peekRedo: () => UndoEntry | undefined

  /** Reactive state atom */
  readonly stateAtom: Atom.Writable<UndoStackState, UndoStackState>
}

// ─── Service tag ────────────────────────────────────

export class UndoStack extends ServiceMap.Service<UndoStack, UndoStackShape>()(
  "@tmnl/datagrid/UndoStack",
) {}

// ─── Layer implementation ───────────────────────────

let _entryCounter = 0

export const UndoStackLive: Layer.Layer<UndoStack, never, UndoStackConfig> = Layer.effect(
  UndoStack,
  Effect.gen(function*() {
    const config = yield* UndoStackConfig
    const capacity = config.capacity ?? 50
    const cellCache = config.cellCache
    const registry = config.registry

    // ── State atom ──────────────────────────────
    const stateAtom: Atom.Writable<UndoStackState, UndoStackState> = Atom.make<UndoStackState>({
      undoStack: [],
      redoStack: [],
      capacity,
    })
    registry.mount(stateAtom)

    // ── Helpers ─────────────────────────────────

    const getState = (): UndoStackState => registry.get(stateAtom)
    const setState = (s: UndoStackState): void => { registry.set(stateAtom, s) }

    const makeId = (): string => `undo-${++_entryCounter}-${Date.now()}`

    // ── Operations ──────────────────────────────

    const record = (
      entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>,
      label?: string,
    ): UndoEntry => {
      const cells: CellSnapshot[] = entries.map(e => ({
        addr: e.addr,
        before: cellCache.get(e.addr),
        after: e.value,
      }))

      const entry: UndoEntry = {
        id: makeId(),
        timestamp: Date.now(),
        cells,
        label,
      }

      const state = getState()
      const undoStack = [entry, ...state.undoStack].slice(0, capacity)

      setState({
        ...state,
        undoStack,
        redoStack: [], // New action clears redo
      })

      return entry
    }

    const undo = (): Effect.Effect<UndoEntry | null, CellWriteError> =>
      Effect.gen(function*() {
        const state = getState()
        if (state.undoStack.length === 0) return null

        const [entry, ...rest] = state.undoStack
        if (!entry) return null

        // Apply before-values
        yield* cellCache.transactionalSetBulk(
          entry.cells.map(c => ({ addr: c.addr, value: c.before })),
        )

        // Move to redo stack
        setState({
          ...state,
          undoStack: rest,
          redoStack: [entry, ...state.redoStack],
        })

        return entry
      })

    const redo = (): Effect.Effect<UndoEntry | null, CellWriteError> =>
      Effect.gen(function*() {
        const state = getState()
        if (state.redoStack.length === 0) return null

        const [entry, ...rest] = state.redoStack
        if (!entry) return null

        // Apply after-values
        yield* cellCache.transactionalSetBulk(
          entry.cells.map(c => ({ addr: c.addr, value: c.after })),
        )

        // Move back to undo stack
        setState({
          ...state,
          undoStack: [entry, ...state.undoStack],
          redoStack: rest,
        })

        return entry
      })

    // ── Service interface ───────────────────────

    return UndoStack.of({
      record,
      undo,
      redo,

      canUndo: () => getState().undoStack.length > 0,
      canRedo: () => getState().redoStack.length > 0,
      undoDepth: () => getState().undoStack.length,
      redoDepth: () => getState().redoStack.length,

      clear: () => setState({ undoStack: [], redoStack: [], capacity }),

      peekUndo: () => getState().undoStack[0],
      peekRedo: () => getState().redoStack[0],

      stateAtom,
    })
  }),
)

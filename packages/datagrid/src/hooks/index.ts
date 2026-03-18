/**
 * React hooks for @tmnl/datagrid.
 *
 * Hooks provide surgical subscriptions to individual cells,
 * ranges, and formulas via the Datagrid's AtomRegistry.
 *
 * Uses useSyncExternalStore directly — no intermediary layers.
 *
 * v2: useCellError (error atom subscription), useTrySetCell
 * (Result-returning setter), useTransactionalPaste.
 *
 * @module
 */

import { useSyncExternalStore, useCallback, useMemo, useRef } from "react"
import { Effect } from "effect-v4"
import * as Result from "effect-v4/Result"
import type { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import type { CellValue } from "../schemas/cell-value"
import type { ColRow, CellAddress, RangeAddress } from "../schemas/addressing"
import type { DatagridShape } from "../services/datagrid"
import type { CellErrorState } from "../services/cell-errors"
import type { CellWriteError } from "../services/cell-errors"
import { extractDisplay, extractNumber } from "../schemas/cell-value"

// ─── Cell hook ──────────────────────────────────────

/**
 * Subscribe to a single cell's value.
 * Re-renders only when this specific cell changes.
 */
export function useCell(
  datagrid: DatagridShape,
  addr: CellAddress,
): CellValue {
  const atom = useMemo(() => datagrid.getCellAtom(addr), [datagrid, addr])
  const registry = datagrid.registry

  const subscribe = useCallback(
    (onStoreChange: () => void) => registry.subscribe(atom, onStoreChange),
    [registry, atom],
  )

  const getSnapshot = useCallback(
    () => registry.get(atom),
    [registry, atom],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Subscribe to a cell's display string.
 */
export function useCellDisplay(
  datagrid: DatagridShape,
  addr: CellAddress,
): string {
  const value = useCell(datagrid, addr)
  return extractDisplay(value)
}

/**
 * Subscribe to a cell's numeric value.
 */
export function useCellNumber(
  datagrid: DatagridShape,
  addr: CellAddress,
): number {
  const value = useCell(datagrid, addr)
  return extractNumber(value)
}

// ─── Cell writer ────────────────────────────────────

/**
 * Returns a fire-and-forget setter for a specific cell.
 * Errors are discarded. Use useTrySetCell for Result feedback.
 */
export function useCellSetter(
  datagrid: DatagridShape,
  addr: CellAddress,
): (value: CellValue) => void {
  return useCallback(
    (value: CellValue) => {
      Effect.runPromise(datagrid.setCell(addr, value))
    },
    [datagrid, addr],
  )
}

/**
 * Returns a Result-returning setter for a specific cell.
 *
 * On validation failure: returns Result.fail(CellWriteError)
 * and posts the error to the cell's error atom.
 *
 * On success: returns Result.succeed(CellValue) and clears
 * the error atom.
 */
export function useTrySetCell(
  datagrid: DatagridShape,
  addr: CellAddress,
): (value: CellValue) => Promise<Result.Result<CellValue, CellWriteError>> {
  return useCallback(
    (value: CellValue) => {
      const resolved = datagrid.addresses.toColRow(addr)
      return Effect.runPromise(datagrid.cells.trySet(resolved, value))
    },
    [datagrid, addr],
  )
}

// ─── Cell error hook ────────────────────────────────

/**
 * Subscribe to a cell's error state.
 *
 * Returns null when the cell is clean (no write errors).
 * Returns CellErrorState when the last write failed.
 *
 * This allows components to show validation feedback
 * independently of the cell's data value.
 */
export function useCellError(
  datagrid: DatagridShape,
  addr: CellAddress,
): CellErrorState | null {
  const errorStore = datagrid.cells.errorStore
  const resolved = useMemo(() => datagrid.addresses.toColRow(addr), [datagrid, addr])
  const atom = useMemo(
    () => errorStore?.getErrorAtom(resolved) ?? null,
    [errorStore, resolved],
  )
  const registry = datagrid.registry

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!atom) return () => {}
      return registry.subscribe(atom, onStoreChange)
    },
    [registry, atom],
  )

  const getSnapshot = useCallback(
    () => {
      if (!atom) return null
      return registry.get(atom)
    },
    [registry, atom],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ─── Range hook ─────────────────────────────────────

/**
 * Subscribe to a range of cells.
 *
 * NOTE: This creates subscriptions to every cell in the range.
 * For large ranges (>1000 cells), prefer the AG-Grid bridge
 * with Server-Side Row Model instead.
 */
export function useRange(
  datagrid: DatagridShape,
  range: RangeAddress,
): ReadonlyArray<{ addr: ColRow; value: CellValue }> {
  const rangeData = useMemo(() => datagrid.getRange(range), [datagrid, range])

  const atomsRef = useRef<Atom.Atom<CellValue>[]>([])
  useMemo(() => {
    atomsRef.current = rangeData.map(({ addr }) => datagrid.getCellAtom(addr))
  }, [datagrid, rangeData])

  const versionRef = useRef(0)

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubs = atomsRef.current.map((atom) =>
        datagrid.registry.subscribe(atom, () => {
          versionRef.current++
          onStoreChange()
        }),
      )
      return () => unsubs.forEach((u) => u())
    },
    [datagrid],
  )

  const getSnapshot = useCallback(
    () => datagrid.getRange(range),
    [datagrid, range, versionRef.current],
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ─── Transactional paste hook ───────────────────────

/**
 * Returns a function that atomically sets multiple cells.
 *
 * Uses transactionalSetBulk: all atoms update in one Atom.batch,
 * DB write included — if any validation or DB failure, all cells
 * roll back. Errors posted to the error store.
 */
export function useTransactionalPaste(
  datagrid: DatagridShape,
): (entries: ReadonlyArray<{ addr: CellAddress; value: CellValue }>) => Promise<Result.Result<void, CellWriteError>> {
  return useCallback(
    (entries) => {
      const resolved = entries.map(e => ({
        addr: datagrid.addresses.toColRow(e.addr),
        value: e.value,
      }))
      return Effect.runPromise(
        datagrid.cells.transactionalSetBulk(resolved).pipe(
          Effect.map((): Result.Result<void, CellWriteError> => Result.succeed(undefined)),
          Effect.catchTag("CellWriteError", (e: CellWriteError) =>
            Effect.succeed(Result.fail(e) as Result.Result<void, CellWriteError>),
          ),
        ),
      )
    },
    [datagrid],
  )
}

// ─── Formula hook ───────────────────────────────────

/**
 * Subscribe to a formula cell's computed value.
 * The formula must already be registered via datagrid.registerFormula().
 */
export function useFormula(
  datagrid: DatagridShape,
  addr: CellAddress,
): CellValue | null {
  const reg = useMemo(() => {
    const resolved = datagrid.addresses.toColRow(
      typeof addr === "string" ? datagrid.addresses.toColRow(addr) : addr,
    )
    return datagrid.formulas.getFormula(resolved)
  }, [datagrid, addr])

  const registry = datagrid.registry

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!reg) return () => {}
      return registry.subscribe(reg.atom, onStoreChange)
    },
    [registry, reg],
  )

  const getSnapshot = useCallback(() => {
    if (!reg) return null
    return registry.get(reg.atom)
  }, [registry, reg])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ─── Clock hook ─────────────────────────────────────

/**
 * Get the current CRDT Lamport clock.
 * Not reactive — call when needed for display.
 */
export function useClock(datagrid: DatagridShape): number {
  return datagrid.clock()
}

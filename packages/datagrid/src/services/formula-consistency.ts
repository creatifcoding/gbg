/**
 * FormulaConsistency — Post-commit formula recalculation (G4).
 *
 * Ensures formulas never observe partial transaction state.
 *
 * Strategy: deferred recalc. When transactionalSetBulk commits,
 * we collect all dirty cells, compute the topo-order of affected
 * formulas, and recalculate them in a single Atom.batch pass
 * AFTER the data atoms have settled.
 *
 * This avoids the alternative (formulas reading TxRefs inside
 * the transaction boundary) which would create contention and
 * complicate the STM protocol.
 *
 * @module
 */

import { Effect, Context, Layer } from "effect"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import type { CellValue } from "../schemas/cell-value"
import type { ColRow } from "../schemas/addressing"
import { validateCellKey } from "../schemas/addressing"
import type { FormulaEngineShape } from "./formula-engine"
import type { CellCacheShape } from "./cell-cache"

/** Parse a raw "sheetId:col:row" string → ColRow (unbranded, for internal use) */
function parseCellKeyRaw(raw: string): ColRow | null {
  const lastColon = raw.lastIndexOf(":")
  if (lastColon === -1) return null
  const midColon = raw.lastIndexOf(":", lastColon - 1)
  if (midColon === -1) return null
  const col = parseInt(raw.slice(midColon + 1, lastColon), 10)
  const row = parseInt(raw.slice(lastColon + 1), 10)
  if (isNaN(col) || isNaN(row)) return null
  return { col, row }
}

// ─── Config ─────────────────────────────────────────

export interface FormulaConsistencyConfigShape {
  readonly registry: AtomRegistry.AtomRegistry
  readonly cellCache: CellCacheShape
  readonly formulaEngine: FormulaEngineShape
  readonly sheetId: string
}

export class FormulaConsistencyConfig extends Context.Service<FormulaConsistencyConfig, FormulaConsistencyConfigShape>()(
  "@tmnl/datagrid/FormulaConsistencyConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface FormulaConsistencyShape {
  /**
   * Recalculate all formulas affected by dirty cells.
   *
   * Call this AFTER transactionalSetBulk commits.
   * Computes topo order → reads fresh atom values → writes results.
   *
   * Returns the list of recalculated formula addresses.
   */
  readonly recalcAffected: (
    dirtyCells: ReadonlyArray<ColRow>,
  ) => ReadonlyArray<string>

  /**
   * Recalculate ALL formulas in topo order.
   * Used for full-grid refresh (e.g. after paste, undo).
   */
  readonly recalcAll: () => ReadonlyArray<string>

  /**
   * Check whether any formulas depend on the given cells.
   */
  readonly hasDependents: (cells: ReadonlyArray<ColRow>) => boolean

  /**
   * Atom that tracks the last recalc timestamp + count.
   * Useful for UI indicators ("formulas recalculated").
   */
  readonly stateAtom: Atom.Writable<FormulaRecalcState, FormulaRecalcState>
}

export interface FormulaRecalcState {
  readonly lastRecalcAt: number
  readonly recalcCount: number
  readonly affectedCount: number
}

// ─── Service tag ────────────────────────────────────

export class FormulaConsistency extends Context.Service<FormulaConsistency, FormulaConsistencyShape>()(
  "@tmnl/datagrid/FormulaConsistency",
) {}

// ─── Layer ──────────────────────────────────────────

export const FormulaConsistencyLive = Layer.effect(
  FormulaConsistency,
  Effect.gen(function*() {
    const config = yield* FormulaConsistencyConfig
    const { registry, cellCache, formulaEngine, sheetId } = config

    const stateAtom = Atom.make<FormulaRecalcState>({
      lastRecalcAt: 0,
      recalcCount: 0,
      affectedCount: 0,
    })
    registry.mount(stateAtom)

    function recalcAffected(dirtyCells: ReadonlyArray<ColRow>): ReadonlyArray<string> {
      // Get topo-ordered formula addresses affected by dirty cells
      const topoOrder = formulaEngine.topoOrder(dirtyCells)

      if (topoOrder.length === 0) return []

      // Recalculate in topo order within a single batch
      // (derived atoms auto-recompute via registry.get, but
      //  we force a read to trigger recomputation)
      const recalced: string[] = []

      Atom.batch(() => {
        for (const formulaAddr of topoOrder) {
          const validated = validateCellKey(formulaAddr)
          if (!validated) continue
          const parsed = parseCellKeyRaw(formulaAddr)
          if (!parsed) continue

          const reg = formulaEngine.getFormula(parsed)
          if (!reg) continue

          // Force-read the derived atom to trigger recomputation
          // The atom's `get` function reads fresh dep values
          registry.get(reg.atom)
          recalced.push(formulaAddr)
        }
      })

      // Update state
      const prev = registry.get(stateAtom)
      registry.set(stateAtom, {
        lastRecalcAt: Date.now(),
        recalcCount: prev.recalcCount + 1,
        affectedCount: recalced.length,
      })

      return recalced
    }

    function recalcAll(): ReadonlyArray<string> {
      const allFormulas = formulaEngine.allFormulas()
      if (allFormulas.length === 0) return []

      // Extract ColRow from all formula addrs for topo order
      const formulaAddrs = allFormulas
        .map(f => parseCellKeyRaw(f.addr))
        .filter((a): a is ColRow => a !== null)

      return recalcAffected(formulaAddrs)
    }

    function hasDependents(cells: ReadonlyArray<ColRow>): boolean {
      for (const cell of cells) {
        if (formulaEngine.dependents(cell).length > 0) return true
      }
      return false
    }

    return FormulaConsistency.of({
      recalcAffected,
      recalcAll,
      hasDependents,
      stateAtom,
    })
  }),
)

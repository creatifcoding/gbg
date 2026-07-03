/**
 * FormulaEngine — Dependency tracking + unified atom bridge.
 *
 * String formulas are parsed into deps[], managed in a DAG,
 * and recalculated in topological order. Derived atom formulas
 * use Atom.make((get) => ...) and auto-track deps through the
 * registry.
 *
 * ## Subscription Bridge (Unified Atom Model)
 *
 * When a formula is registered, the derived atom's output is
 * subscribed and written back to the CellCache writable atom
 * for that cell. This closes the loop:
 *
 *   dep atom changes → derived atom recomputes → subscription
 *   fires → CellCache atom updated → valueGetter sees it
 *
 * This eliminates the "two atom universes" problem: formula
 * results live in CellCache alongside data cells. Chained
 * formulas propagate automatically (D0 reads C0's CellCache
 * atom, which is updated by C0's subscription).
 *
 * @module
 */

import { Effect, Context, Layer } from "effect"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import type { CellValue } from "../schemas/cell-value"
import type { ColRow } from "../schemas/addressing"
import { cellKey } from "../schemas/addressing"

// ─── Types ──────────────────────────────────────────

export interface FormulaRegistration {
  readonly addr: string
  readonly src: string
  readonly deps: ReadonlyArray<string>
  readonly atom: Atom.Atom<CellValue>
}

// ─── Config ─────────────────────────────────────────

export interface FormulaEngineConfigShape {
  readonly sheetId: string
  readonly registry: AtomRegistry.AtomRegistry
  readonly getCellAtom: (addr: ColRow) => Atom.Writable<CellValue, CellValue>
}

export class FormulaEngineConfig extends Context.Service<FormulaEngineConfig, FormulaEngineConfigShape>()(
  "@tmnl/datagrid/FormulaEngineConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface FormulaEngineShape {
  readonly register: (
    addr: ColRow, src: string, deps: ReadonlyArray<ColRow>,
    compute: (depValues: ReadonlyArray<CellValue>) => CellValue,
  ) => FormulaRegistration
  readonly registerAtom: (
    addr: ColRow, src: string, deps: ReadonlyArray<ColRow>,
    atom: Atom.Atom<CellValue>,
  ) => FormulaRegistration
  readonly unregister: (addr: ColRow) => void
  readonly getFormula: (addr: ColRow) => FormulaRegistration | null
  readonly allFormulas: () => ReadonlyArray<FormulaRegistration>
  readonly detectCycle: (addr: ColRow, deps: ReadonlyArray<ColRow>) => ReadonlyArray<string> | null
  readonly dependents: (addr: ColRow) => ReadonlyArray<string>
  readonly dependencies: (addr: ColRow) => ReadonlyArray<string>
  readonly topoOrder: (dirty: ReadonlyArray<ColRow>) => ReadonlyArray<string>
}

// ─── Service tag ────────────────────────────────────

export class FormulaEngine extends Context.Service<FormulaEngine, FormulaEngineShape>()(
  "@tmnl/datagrid/FormulaEngine",
) {}

// ─── Layer ──────────────────────────────────────────

export const FormulaEngineLive = Layer.effect(
  FormulaEngine,
  Effect.gen(function*() {
    const config = yield* FormulaEngineConfig
    const sheetId = config.sheetId

    const formulas = new Map<string, FormulaRegistration>()
    const rdeps = new Map<string, Set<string>>()
    const fdeps = new Map<string, Set<string>>()

    // ── Subscription Bridge ────────────────────────
    // Tracks unsubscribe functions per formula cell.
    // When a derived atom recomputes, the subscription
    // writes the result back to the CellCache writable
    // atom, unifying the two atom universes.
    const subscriptions = new Map<string, () => void>()

    function addEdges(addr: string, deps: ReadonlyArray<string>): void {
      fdeps.set(addr, new Set(deps))
      for (const dep of deps) {
        let rev = rdeps.get(dep)
        if (!rev) { rev = new Set(); rdeps.set(dep, rev) }
        rev.add(addr)
      }
    }

    function removeEdges(addr: string): void {
      const forward = fdeps.get(addr)
      if (forward) {
        for (const dep of forward) rdeps.get(dep)?.delete(addr)
        fdeps.delete(addr)
      }
    }

    function detectCycleImpl(addr: ColRow, deps: ReadonlyArray<ColRow>): ReadonlyArray<string> | null {
      const target = cellKey(sheetId, addr)
      const depKeys = deps.map(d => cellKey(sheetId, d))

      // Self-reference
      if (depKeys.includes(target)) return [target, target]

      // Temporarily add edges, then DFS from target
      const savedFdeps = fdeps.get(target)
      fdeps.set(target, new Set(depKeys))

      const visited = new Set<string>()
      const path: string[] = []

      function dfs(current: string): boolean {
        if (current === target && path.length > 0) { path.push(current); return true }
        if (visited.has(current)) return false
        visited.add(current)
        path.push(current)
        const forward = fdeps.get(current)
        if (forward) {
          for (const next of forward) {
            if (dfs(next)) return true
          }
        }
        path.pop()
        return false
      }

      let found = false
      for (const dep of depKeys) {
        visited.clear()
        path.length = 0
        if (dfs(dep)) { found = true; break }
      }

      // Restore
      if (savedFdeps) fdeps.set(target, savedFdeps)
      else fdeps.delete(target)

      return found ? path : null
    }

    function topoOrderImpl(dirty: ReadonlyArray<ColRow>): ReadonlyArray<string> {
      const result: string[] = []
      const visited = new Set<string>()

      function visit(addr: string): void {
        if (visited.has(addr)) return
        visited.add(addr)
        const rev = rdeps.get(addr)
        if (rev) { for (const d of rev) visit(d) }
        result.push(addr)
      }

      for (const d of dirty) visit(cellKey(sheetId, d))
      return result.reverse()
    }

    return FormulaEngine.of({
      register(addr, src, deps, compute) {
        const key = cellKey(sheetId, addr)
        const depKeys = deps.map(d => cellKey(sheetId, d))

        // Clean up previous registration (edges + subscription)
        removeEdges(key)
        subscriptions.get(key)?.()
        subscriptions.delete(key)

        const depAtoms = deps.map(d => config.getCellAtom(d))
        const derived = Atom.make((get: Atom.FnContext) => {
          const values = depAtoms.map(a => get(a)) as ReadonlyArray<CellValue>
          return compute(values)
        })
        config.registry.mount(derived)
        addEdges(key, depKeys)

        // ── Subscription Bridge ──────────────────────
        // Subscribe to derived atom → write result back to
        // CellCache's writable atom. This closes the loop so
        // valueGetter (which reads CellCache) sees formula results.
        const writableAtom = config.getCellAtom(addr)
        const unsub = config.registry.subscribe(derived, (value) => {
          config.registry.set(writableAtom, value)
        })
        subscriptions.set(key, unsub)

        // Force initial computation → seed CellCache with first result
        const initialValue = config.registry.get(derived)
        config.registry.set(writableAtom, initialValue)

        const reg: FormulaRegistration = { addr: key, src, deps: depKeys, atom: derived }
        formulas.set(key, reg)
        return reg
      },

      registerAtom(addr, src, deps, atom) {
        const key = cellKey(sheetId, addr)
        const depKeys = deps.map(d => cellKey(sheetId, d))

        // Clean up previous registration
        removeEdges(key)
        subscriptions.get(key)?.()
        subscriptions.delete(key)

        addEdges(key, depKeys)

        // ── Subscription Bridge (caller-provided atom) ──
        const writableAtom = config.getCellAtom(addr)
        const unsub = config.registry.subscribe(atom, (value) => {
          config.registry.set(writableAtom, value)
        })
        subscriptions.set(key, unsub)

        // Seed CellCache with current value
        const initialValue = config.registry.get(atom)
        config.registry.set(writableAtom, initialValue)

        const reg: FormulaRegistration = { addr: key, src, deps: depKeys, atom }
        formulas.set(key, reg)
        return reg
      },

      unregister(addr) {
        const key = cellKey(sheetId, addr)
        removeEdges(key)
        subscriptions.get(key)?.()
        subscriptions.delete(key)
        formulas.delete(key)
      },

      getFormula: (addr) => formulas.get(cellKey(sheetId, addr)) ?? null,
      allFormulas: () => Array.from(formulas.values()),
      detectCycle: detectCycleImpl,
      dependents: (addr) => Array.from(rdeps.get(cellKey(sheetId, addr)) ?? []),
      dependencies: (addr) => Array.from(fdeps.get(cellKey(sheetId, addr)) ?? []),
      topoOrder: topoOrderImpl,
    })
  }),
)

/**
 * FormulaEngineV2 — StackVM-powered formula engine.
 *
 * Composes StackVM + DepGraph + VMCellBridge into a single
 * service for formula registration, dependency tracking,
 * and topological recalculation.
 *
 * ## Architecture
 *
 * ```
 * User edits cell A1
 *   → recalcDirty(["A1"])
 *     → DepGraph.affectedBy(["A1"]) → [C1, D1] (topo-sorted)
 *     → for each: compile expr → eval with CellContext → write result
 * ```
 *
 * ## Key Differences from FormulaEngine v1
 *
 * - **IR-based eval**: Formulas compile to StackIR, not callbacks
 * - **A1-aware compiler**: Cell refs (A1, B2) → READ_CELL opcodes
 * - **Auto dep extraction**: `extractDeps(expr)` replaces manual dep lists
 * - **Error propagation**: DIV/0 in A1 propagates through all dependents
 * - **CellContext injection**: VM reads cells at eval time, not compile time
 *
 * @module
 */

import { Effect, ServiceMap, Layer, Schema } from "effect-v4"
import type { CellValue } from "../schemas/cell-value"
import { cellToVM, vmToCell } from "./vm-cell-bridge"
import {
  compileExprSync, compileInfixSync, extractDeps, extractDepsInfix, evalProgram,
  isVolatileIR,
  type StackIR, type VMValue, type CellContext,
  num, vmError,
  CompileError,
} from "./stack-vm"
import { makeDepGraph, CircularDepError, type CellNode } from "./dep-graph"

// ─── Types ──────────────────────────────────────────

/** Internal formula record — stores compiled IR + metadata */
export interface FormulaRecord {
  readonly addr: string
  readonly expr: string
  readonly deps: ReadonlyArray<string>
  readonly ir: StackIR
  readonly volatile: boolean
}

/** Result of a recalc pass */
export interface RecalcResult {
  readonly recalculated: ReadonlyArray<string>
  readonly errors: ReadonlyArray<{ addr: string; error: string }>
  readonly durationMs: number
}

/** Cell store interface — the engine reads/writes cell values through this */
export interface CellStore {
  readonly get: (addr: string) => CellValue
  readonly set: (addr: string, value: CellValue) => void
}

// ─── Config ─────────────────────────────────────────

export interface FormulaEngineV2ConfigShape {
  readonly cellStore: CellStore
}

export class FormulaEngineV2Config extends ServiceMap.Service<FormulaEngineV2Config, FormulaEngineV2ConfigShape>()(
  "@tmnl/datagrid/FormulaEngineV2Config",
) {}

// ─── Service interface ──────────────────────────────

export interface FormulaEngineV2Shape {
  /**
   * Register a formula using RPN notation.
   *
   * Compiles the expression, extracts deps, registers in DepGraph.
   * Returns the compiled FormulaRecord.
   *
   * @throws CompileError if expression is invalid
   * @throws CircularDepError if formula creates a cycle
   */
  readonly register: (addr: string, expr: string) => Effect.Effect<FormulaRecord, CompileError | CircularDepError>

  /**
   * Register a formula using infix notation (=A1+B1*2).
   *
   * Uses shunting-yard parser for operator precedence.
   * Strips leading `=` if present.
   */
  readonly registerInfix: (addr: string, expr: string) => Effect.Effect<FormulaRecord, CompileError | CircularDepError>

  /**
   * Register with explicit deps (for pre-compiled IR).
   */
  readonly registerIR: (addr: string, ir: StackIR, deps: ReadonlyArray<string>) => Effect.Effect<FormulaRecord, CircularDepError>

  /**
   * Unregister a formula.
   */
  readonly unregister: (addr: string) => Effect.Effect<void>

  /**
   * Recalculate all formulas affected by dirty cells.
   *
   * 1. Queries DepGraph for affected formulas (topo-sorted)
   * 2. Evaluates each formula's IR with CellContext
   * 3. Writes results back to CellStore
   *
   * Returns recalc stats.
   */
  readonly recalcDirty: (dirtyCells: ReadonlyArray<string>) => Effect.Effect<RecalcResult>

  /**
   * Recalculate ALL formulas in topo order.
   */
  readonly recalcAll: () => Effect.Effect<RecalcResult>

  /**
   * Get a formula record by address.
   */
  readonly getFormula: (addr: string) => FormulaRecord | undefined

  /**
   * Get all registered formulas.
   */
  readonly allFormulas: () => ReadonlyArray<FormulaRecord>

  /**
   * Get direct dependents of a cell.
   */
  readonly dependentsOf: (addr: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Get direct dependencies of a formula.
   */
  readonly dependenciesOf: (addr: string) => ReadonlyArray<string>
}

// ─── Service tag ────────────────────────────────────

export class FormulaEngineV2 extends ServiceMap.Service<FormulaEngineV2, FormulaEngineV2Shape>()(
  "@tmnl/datagrid/FormulaEngineV2",
) {}

// ─── Layer ──────────────────────────────────────────

export const FormulaEngineV2Live = Layer.effect(
  FormulaEngineV2,
  Effect.gen(function*() {
    const config = yield* FormulaEngineV2Config
    const { cellStore } = config

    // Internal state
    const formulas = new Map<string, FormulaRecord>()
    const graph = makeDepGraph()

    // Build CellContext from cellStore
    const makeCellContext = (): CellContext => ({
      readCell: (addr: string): VMValue => cellToVM(cellStore.get(addr)),
      writeCell: (addr: string, v: VMValue): void => cellStore.set(addr, vmToCell(v)),
    })

    /**
     * Evaluate a single formula and write result to cellStore.
     * Returns error message if eval fails.
     */
    function evalFormula(record: FormulaRecord): string | null {
      try {
        const ctx = makeCellContext()
        const state = Effect.runSync(evalProgram(record.ir, ctx))
        const result = state.stack[state.stack.length - 1] ?? num(0)
        cellStore.set(record.addr, vmToCell(result))
        return null
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        cellStore.set(record.addr, { _tag: "Error", code: "GENERAL", message: msg })
        return msg
      }
    }

    /**
     * Run recalc for a set of affected formula addresses (already topo-sorted).
     */
    function runRecalc(topoOrder: ReadonlyArray<string>): RecalcResult {
      const start = performance.now()
      const recalculated: string[] = []
      const errors: { addr: string; error: string }[] = []

      for (const addr of topoOrder) {
        const record = formulas.get(addr)
        if (!record) continue

        const err = evalFormula(record)
        recalculated.push(addr)
        if (err) errors.push({ addr, error: err })
      }

      return {
        recalculated,
        errors,
        durationMs: performance.now() - start,
      }
    }

    return FormulaEngineV2.of({
      register: (addr, expr) =>
        Effect.gen(function*() {
          const ir = compileExprSync(expr)
          const deps = extractDeps(expr)
          yield* graph.registerFormula(addr, expr, deps)
          const record: FormulaRecord = { addr, expr, deps, ir, volatile: isVolatileIR(ir) }
          formulas.set(addr, record)
          return record
        }),

      registerInfix: (addr, expr) =>
        Effect.gen(function*() {
          const ir = compileInfixSync(expr)
          const deps = extractDepsInfix(expr)
          yield* graph.registerFormula(addr, expr, deps)
          const record: FormulaRecord = { addr, expr, deps, ir, volatile: isVolatileIR(ir) }
          formulas.set(addr, record)
          return record
        }),

      registerIR: (addr, ir, deps) =>
        Effect.gen(function*() {
          yield* graph.registerFormula(addr, `[IR:${ir.length}ops]`, deps)
          const record: FormulaRecord = { addr, expr: `[IR:${ir.length}ops]`, deps, ir, volatile: isVolatileIR(ir) }
          formulas.set(addr, record)
          return record
        }),

      unregister: (addr) =>
        Effect.sync(() => {
          graph.unregister(addr)
          formulas.delete(addr)
        }),

      recalcDirty: (dirtyCells) =>
        Effect.sync(() => {
          const topoOrder = graph.evalOrder(dirtyCells)
          // Volatile formulas always recalc — append any not already in order
          const orderSet = new Set(topoOrder)
          const volatiles = Array.from(formulas.values())
            .filter(r => r.volatile && !orderSet.has(r.addr))
            .map(r => r.addr)
          return runRecalc([...topoOrder, ...volatiles])
        }),

      recalcAll: () =>
        Effect.sync(() => {
          // Get all formula addrs — evalOrder returns topo-sorted subset
          const allAddrs = graph.allFormulas()
          const allNodes = new Set<string>()
          for (const addr of allAddrs) {
            for (const dep of graph.dependencies(addr)) allNodes.add(dep)
          }
          const topoOrder = graph.evalOrder([...allNodes])
          // Also include formulas with no deps (volatile, constants) that topo missed
          const orderSet = new Set(topoOrder)
          const missed = allAddrs.filter(a => !orderSet.has(a))
          return runRecalc([...missed, ...topoOrder])
        }),

      getFormula: (addr) => formulas.get(addr),

      allFormulas: () => Array.from(formulas.values()),

      dependentsOf: (addr) =>
        Effect.sync(() => graph.dependents(addr)),

      dependenciesOf: (addr) => formulas.get(addr)?.deps.slice() ?? [],
    })
  }),
)

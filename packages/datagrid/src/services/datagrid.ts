/**
 * Datagrid — Main orchestration service.
 *
 * Composes CellCache, AddressResolver, FormulaEngine, and CrdtLayer
 * into a single cohesive API.
 *
 * @module
 */

import { Effect, ServiceMap, Layer } from "effect-v4"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import type { StxFamily } from "@tmnl/stx"

import type { CellValue } from "../schemas/cell-value"
import type { ColRow, RangeRect, CellAddress, RangeAddress } from "../schemas/addressing"
import { cellKey, iterateRange } from "../schemas/addressing"
import { empty } from "../schemas/cell-value"

import { CellCache, CellCacheConfig, CellCacheLive, type CellCacheShape } from "./cell-cache"
import { AddressResolver, AddressResolverConfig, AddressResolverLive, type AddressResolverShape } from "./address-resolver"
import { FormulaEngine, FormulaEngineConfig, FormulaEngineLive, type FormulaEngineShape, type FormulaRegistration } from "./formula-engine"
import { CrdtLayer, CrdtLayerConfig, CrdtLayerLive, type CrdtLayerShape, type CellOp, type MergeResult } from "./crdt-layer"

// ─── Config ─────────────────────────────────────────

export interface DatagridConfigShape {
  readonly sheetId: string
  readonly agentId: string
  readonly readCell: (sheetId: string, col: number, row: number) => CellValue | null
  readonly writeCell: (sheetId: string, col: number, row: number, value: CellValue) => Effect.Effect<void>
  readonly writeCellBulk: (sheetId: string, entries: ReadonlyArray<{ col: number; row: number; value: CellValue }>) => Effect.Effect<void>
  readonly upsertNamedRange: (sheetId: string, name: string, range: RangeRect) => Effect.Effect<void>
  readonly getNamedRange: (sheetId: string, name: string) => Effect.Effect<RangeRect | null>
  readonly listNamedRanges: (sheetId: string) => Effect.Effect<ReadonlyArray<{ name: string; range: RangeRect }>>
  readonly deleteNamedRange: (sheetId: string, name: string) => Effect.Effect<void>
}

export class DatagridConfig extends ServiceMap.Service<DatagridConfig, DatagridConfigShape>()(
  "@tmnl/datagrid/DatagridConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface DatagridShape {
  readonly sheetId: string
  readonly agentId: string

  readonly getCell: (addr: CellAddress) => CellValue
  readonly setCell: (addr: CellAddress, value: CellValue) => Effect.Effect<void>
  readonly setCells: (entries: ReadonlyArray<{ addr: CellAddress; value: CellValue }>) => Effect.Effect<void>
  readonly getCellAtom: (addr: CellAddress) => Atom.Writable<CellValue, CellValue>

  readonly getRange: (range: RangeAddress) => ReadonlyArray<{ addr: ColRow; value: CellValue }>
  readonly setRange: (range: RangeAddress, values: ReadonlyArray<CellValue>) => Effect.Effect<void>
  readonly clearRange: (range: RangeAddress) => Effect.Effect<void>

  readonly registerFormula: (
    addr: CellAddress, src: string, deps: ReadonlyArray<CellAddress>,
    compute: (depValues: ReadonlyArray<CellValue>) => CellValue,
  ) => FormulaRegistration
  readonly unregisterFormula: (addr: CellAddress) => void
  readonly detectCycle: (addr: CellAddress, deps: ReadonlyArray<CellAddress>) => ReadonlyArray<string> | null

  readonly nameRange: (alias: string, range: RangeAddress) => Effect.Effect<void>
  readonly resolveAlias: (alias: string) => Effect.Effect<RangeRect | null>

  readonly applyRemoteOp: (op: CellOp) => Effect.Effect<MergeResult>
  readonly applyRemoteOps: (ops: ReadonlyArray<CellOp>) => Effect.Effect<ReadonlyArray<MergeResult>>
  readonly clock: () => number

  readonly family: StxFamily<string, CellValue>
  readonly registry: AtomRegistry.AtomRegistry

  readonly cells: CellCacheShape
  readonly addresses: AddressResolverShape
  readonly formulas: FormulaEngineShape
  readonly crdt: CrdtLayerShape
}

// ─── Service tag ────────────────────────────────────

export class Datagrid extends ServiceMap.Service<Datagrid, DatagridShape>()(
  "@tmnl/datagrid/Datagrid",
) {}

// ─── Layer factory ──────────────────────────────────

/**
 * Create a fully-wired Datagrid layer from config.
 *
 * This composes all 4 sub-service layers with their configs,
 * then builds the top-level Datagrid that owns the shared
 * AtomRegistry and wires everything together.
 */
export function makeDatagridLayer(config: DatagridConfigShape): Layer.Layer<Datagrid> {
  const registry = AtomRegistry.make()
  const { sheetId, agentId } = config

  // We can't easily compose Effect v4 layers with cross-cutting
  // shared state (the registry) without a factory approach.
  // So we build sub-services eagerly and wire the Datagrid as
  // a simple Layer.succeed with the composed implementation.

  return Layer.effect(
    Datagrid,
    Effect.gen(function*() {
      // ── Build sub-services ─────────────────────
      // CellCache
      const cellCacheConfigLayer = Layer.succeed(CellCacheConfig)(CellCacheConfig.of({
        sheetId, registry,
        readCell: config.readCell,
        writeCell: config.writeCell,
        writeCellBulk: config.writeCellBulk,
      }))
      const cellCacheLayer = Layer.provide(CellCacheLive, cellCacheConfigLayer)
      const cellsSM = yield* Effect.scoped(cellCacheLayer.pipe(Layer.build))
      const cells = ServiceMap.get(cellsSM, CellCache)

      // AddressResolver
      const addrConfigLayer = Layer.succeed(AddressResolverConfig)(AddressResolverConfig.of({
        upsertNamedRange: config.upsertNamedRange,
        getNamedRange: config.getNamedRange,
        listNamedRanges: config.listNamedRanges,
        deleteNamedRange: config.deleteNamedRange,
      }))
      const addrLayer = Layer.provide(AddressResolverLive, addrConfigLayer)
      const addrSM = yield* Effect.scoped(addrLayer.pipe(Layer.build))
      const addresses = ServiceMap.get(addrSM, AddressResolver)

      // FormulaEngine
      const formulaConfigLayer = Layer.succeed(FormulaEngineConfig)(FormulaEngineConfig.of({
        sheetId,
        registry,
        getCellAtom: (addr: ColRow) => cells.getAtom(addr),
      }))
      const formulaLayer = Layer.provide(FormulaEngineLive, formulaConfigLayer)
      const formulaSM = yield* Effect.scoped(formulaLayer.pipe(Layer.build))
      const formulas = ServiceMap.get(formulaSM, FormulaEngine)

      // CrdtLayer
      const crdtConfigLayer = Layer.succeed(CrdtLayerConfig)(CrdtLayerConfig.of({
        sheetId,
        agentId,
        onApply: (op) => cells.family.set(cellKey(sheetId, { col: op.col, row: op.row }), op.payload),
      }))
      const crdtLayerInner = Layer.provide(CrdtLayerLive, crdtConfigLayer)
      const crdtSM = yield* Effect.scoped(crdtLayerInner.pipe(Layer.build))
      const crdt = ServiceMap.get(crdtSM, CrdtLayer)

      // ── High-level API ────────────────────────
      const resolve = (addr: CellAddress): ColRow => addresses.toColRow(addr)

      return Datagrid.of({
        sheetId, agentId,

        getCell: (addr) => cells.get(resolve(addr)),
        setCell: (addr, value) => cells.set(resolve(addr), value),
        setCells: (entries) => cells.setBulk(entries.map(e => ({ addr: resolve(e.addr), value: e.value }))),
        getCellAtom: (addr) => cells.getAtom(resolve(addr)),

        getRange: (range) => {
          const rect = addresses.toRange(range)
          const result: { addr: ColRow; value: CellValue }[] = []
          for (const addr of iterateRange(rect)) result.push({ addr, value: cells.get(addr) })
          return result
        },
        setRange: (range, values) => {
          const rect = addresses.toRange(range)
          const entries: { addr: ColRow; value: CellValue }[] = []
          let i = 0
          for (const addr of iterateRange(rect)) { if (i >= values.length) break; entries.push({ addr, value: values[i++] }) }
          return cells.setBulk(entries)
        },
        clearRange: (range) => {
          const rect = addresses.toRange(range)
          const entries: { addr: ColRow; value: CellValue }[] = []
          for (const addr of iterateRange(rect)) entries.push({ addr, value: empty() })
          return cells.setBulk(entries)
        },

        registerFormula: (addr, src, deps, compute) => {
          const cr = resolve(addr)
          const depCrs = deps.map(d => resolve(d))
          const cycle = formulas.detectCycle(cr, depCrs)
          if (cycle) throw new Error(`Circular reference detected: ${cycle.join(" → ")}`)
          return formulas.register(cr, src, depCrs, compute)
        },
        unregisterFormula: (addr) => formulas.unregister(resolve(addr)),
        detectCycle: (addr, deps) => formulas.detectCycle(resolve(addr), deps.map(d => resolve(d))),

        nameRange: (alias, range) => addresses.name(sheetId, alias, addresses.toRange(range)),
        resolveAlias: (alias) => addresses.resolveAlias(sheetId, alias),

        applyRemoteOp: (op) => crdt.apply(op),
        applyRemoteOps: (ops) => crdt.merge(ops),
        clock: crdt.clock,

        family: cells.family,
        registry,
        cells, addresses, formulas, crdt,
      })
    }),
  )
}

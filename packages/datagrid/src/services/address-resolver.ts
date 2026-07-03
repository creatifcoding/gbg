/**
 * AddressResolver — A1 ↔ R1C1 ↔ Named alias translation.
 *
 * @module
 */

import { Effect, Context, Layer } from "effect"
import {
  type ColRow, type RangeRect, type CellAddress, type RangeAddress,
  formatA1, resolveCell, resolveRange, formatRange,
} from "../schemas/addressing"

// ─── Config ─────────────────────────────────────────

export interface AddressResolverConfigShape {
  readonly upsertNamedRange: (sheetId: string, name: string, range: RangeRect) => Effect.Effect<void>
  readonly getNamedRange: (sheetId: string, name: string) => Effect.Effect<RangeRect | null>
  readonly listNamedRanges: (sheetId: string) => Effect.Effect<ReadonlyArray<{ name: string; range: RangeRect }>>
  readonly deleteNamedRange: (sheetId: string, name: string) => Effect.Effect<void>
}

export class AddressResolverConfig extends Context.Service<AddressResolverConfig, AddressResolverConfigShape>()(
  "@tmnl/datagrid/AddressResolverConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface AddressResolverShape {
  readonly toColRow: (addr: CellAddress) => ColRow
  readonly toA1: (addr: ColRow) => string
  readonly toRange: (addr: RangeAddress) => RangeRect
  readonly formatRange: (range: RangeRect) => string
  readonly name: (sheetId: string, alias: string, range: RangeRect) => Effect.Effect<void>
  readonly resolveAlias: (sheetId: string, alias: string) => Effect.Effect<RangeRect | null>
  readonly listAliases: (sheetId: string) => Effect.Effect<ReadonlyArray<{ name: string; range: RangeRect }>>
  readonly deleteAlias: (sheetId: string, alias: string) => Effect.Effect<void>
}

// ─── Service tag ────────────────────────────────────

export class AddressResolver extends Context.Service<AddressResolver, AddressResolverShape>()(
  "@tmnl/datagrid/AddressResolver",
) {}

// ─── Layer ──────────────────────────────────────────

export const AddressResolverLive = Layer.effect(
  AddressResolver,
  Effect.gen(function*() {
    const config = yield* AddressResolverConfig

    return AddressResolver.of({
      toColRow: (addr) => resolveCell(addr),
      toA1: (addr) => formatA1(addr),
      toRange: (addr) => resolveRange(addr),
      formatRange: (range) => formatRange(range),
      name: (sheetId, alias, range) => config.upsertNamedRange(sheetId, alias, range),
      resolveAlias: (sheetId, alias) => config.getNamedRange(sheetId, alias),
      listAliases: (sheetId) => config.listNamedRanges(sheetId),
      deleteAlias: (sheetId, alias) => config.deleteNamedRange(sheetId, alias),
    })
  }),
)

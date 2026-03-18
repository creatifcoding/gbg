/**
 * CellCache — Lazy atom hydration backed by transactional stxFamily.
 *
 * Every cell is a TxRef+Atom pair in a transactional stxFamily
 * keyed by CellKey. Atoms are created on first access, initialized
 * from SQLite, and GC'd by Atom.family's WeakRef +
 * FinalizationRegistry when no subscribers hold a reference.
 *
 * v3: transactionalSetBulk uses real multiStoreTransaction —
 * TxRef writes within Effect.transaction(), committed values
 * flushed to Atom layer via Atom.batch in a single notification
 * pass. On transaction failure, TxRef journal discarded — atoms
 * unchanged. DB persistence is a separate phase after commit.
 *
 * @module
 */

import { Effect, ServiceMap, Layer } from "effect-v4"
import * as Result from "effect-v4/Result"
import * as TxRef from "effect-v4/TxRef"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import {
  stxFamily, type StxFamily,
  multiStoreTransaction, type TxStoreDescriptor,
} from "@tmnl/stx"
import {
  type CellValue,
  CellValue as CellValueSchema,
  empty, type ColRow, type CellKey, CellKeySchema, cellKey, parseCellKey,
} from "../index"
import {
  type CellErrorState, type CellErrorStoreShape,
  CellWriteError,
} from "./cell-errors"

// ─── Config (injected by Datagrid) ──────────────────

export interface CellCacheConfigShape {
  readonly sheetId: string
  readonly registry?: AtomRegistry.AtomRegistry
  readonly readCell: (sheetId: string, col: number, row: number) => CellValue | null
  readonly writeCell: (sheetId: string, col: number, row: number, value: CellValue) => Effect.Effect<void>
  readonly writeCellBulk: (
    sheetId: string,
    entries: ReadonlyArray<{ col: number; row: number; value: CellValue }>,
  ) => Effect.Effect<void>
  /** Optional: validate CellValue before write. Returns issues or empty array. */
  readonly validateCell?: (sheetId: string, col: number, row: number, value: CellValue) => ReadonlyArray<string>
  /** Optional: error store for per-cell error feedback */
  readonly errorStore?: CellErrorStoreShape
}

export class CellCacheConfig extends ServiceMap.Service<CellCacheConfig, CellCacheConfigShape>()(
  "@tmnl/datagrid/CellCacheConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface CellCacheShape {
  readonly getAtom: (addr: ColRow) => Atom.Writable<CellValue, CellValue>
  readonly get: (addr: ColRow) => CellValue

  // ── Fire-and-forget (existing API, preserved) ─────
  readonly set: (addr: ColRow, value: CellValue) => Effect.Effect<void>
  readonly setBulk: (entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>) => Effect.Effect<void>
  readonly invalidate: (addr: ColRow) => Effect.Effect<void>

  // ── Result-first (new) ────────────────────────────
  /** Try to set a cell, returning Result instead of throwing */
  readonly trySet: (addr: ColRow, value: CellValue) => Effect.Effect<Result.Result<CellValue, CellWriteError>>
  /** Try to set multiple cells, returning per-cell Results */
  readonly trySetBulk: (
    entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>,
  ) => Effect.Effect<ReadonlyArray<{ addr: ColRow; result: Result.Result<CellValue, CellWriteError> }>>

  // ── Transactional (new) ───────────────────────────
  /**
   * Set multiple cells atomically via multiStoreTransaction.
   *
   * TxRef writes inside Effect.transaction(). On commit, all
   * values flush to Atom layer in a single Atom.batch pass.
   * DB persistence follows — if DB fails, atoms roll back
   * to their DB state. Per-cell errors posted to error store.
   */
  readonly transactionalSetBulk: (
    entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>,
  ) => Effect.Effect<void, CellWriteError>

  readonly family: StxFamily<string, CellValue>
  readonly registry: AtomRegistry.AtomRegistry
  readonly sheetId: string
  readonly errorStore: CellErrorStoreShape | undefined
}

// ─── Service tag ────────────────────────────────────

export class CellCache extends ServiceMap.Service<CellCache, CellCacheShape>()(
  "@tmnl/datagrid/CellCache",
) {}

// ─── Layer ──────────────────────────────────────────

export const CellCacheLive = Layer.effect(
  CellCache,
  Effect.gen(function*() {
    const config = yield* CellCacheConfig
    const registry = config.registry ?? AtomRegistry.make()
    const sheetId = config.sheetId
    const errorStore = config.errorStore

    // ── DB ops ─────────────────────────────────────

    const readFromDb = (key: CellKey): CellValue => {
      const cr = parseCellKey(key)
      return config.readCell(sheetId, cr.col, cr.row) ?? empty()
    }

    const writeToDb = (key: CellKey, value: CellValue): Effect.Effect<void> => {
      const cr = parseCellKey(key)
      return config.writeCell(sheetId, cr.col, cr.row, value)
    }

    const writeBulkToDb = (entries: ReadonlyArray<{ key: CellKey; value: CellValue }>): Effect.Effect<void> => {
      return config.writeCellBulk(sheetId, entries.map(e => {
        const cr = parseCellKey(e.key)
        return { col: cr.col, row: cr.row, value: e.value }
      }))
    }

    // ── Validation ─────────────────────────────────

    const validateCell = (addr: ColRow, value: CellValue): ReadonlyArray<string> => {
      if (config.validateCell) {
        return config.validateCell(sheetId, addr.col, addr.row, value)
      }
      return []
    }

    // ── Family (transactional: TxRef+Atom per cell) ──

    const family = stxFamily(
      (key: string) => readFromDb(CellKeySchema.makeUnsafe(key)),
      { registry, transactional: true },
    )

    // ── Basic ops (preserved) ──────────────────────

    const getAtom = (addr: ColRow) => family(cellKey(sheetId, addr))
    const get = (addr: ColRow) => family.get(cellKey(sheetId, addr))

    const set = (addr: ColRow, value: CellValue): Effect.Effect<void> => {
      const key = cellKey(sheetId, addr)
      return Effect.gen(function*() {
        family.set(key, value)
        if (errorStore) errorStore.clearError(addr)
        yield* writeToDb(key, value)
      })
    }

    const setBulk = (entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>): Effect.Effect<void> => {
      return Effect.gen(function*() {
        const keyed = entries.map(e => ({ key: cellKey(sheetId, e.addr), value: e.value }))
        for (const { key, value } of keyed) family.set(key, value)
        if (errorStore) {
          for (const e of entries) errorStore.clearError(e.addr)
        }
        yield* writeBulkToDb(keyed)
      })
    }

    const invalidate = (addr: ColRow): Effect.Effect<void> => {
      return Effect.sync(() => {
        const key = cellKey(sheetId, addr)
        family.set(key, readFromDb(key))
        if (errorStore) errorStore.clearError(addr)
      })
    }

    // ── Result-first ops (new) ─────────────────────

    const trySet = (addr: ColRow, value: CellValue): Effect.Effect<Result.Result<CellValue, CellWriteError>> => {
      return Effect.gen(function*() {
        // Validate
        const issues = validateCell(addr, value)
        if (issues.length > 0) {
          const err = new CellWriteError({
            col: addr.col, row: addr.row,
            issues: [...issues],
            source: "validation",
          })
          if (errorStore) {
            errorStore.setError(addr, {
              _tag: "CellError",
              source: "validation",
              issues,
              timestamp: Date.now(),
            })
          }
          return Result.fail(err)
        }

        // Write atom + DB
        const key = cellKey(sheetId, addr)
        family.set(key, value)
        if (errorStore) errorStore.clearError(addr)

        const dbResult = yield* Effect.result(writeToDb(key, value))
        if (Result.isFailure(dbResult)) {
          // DB write failed — roll back atom
          family.set(key, readFromDb(key))
          const err = new CellWriteError({
            col: addr.col, row: addr.row,
            issues: ["Database write failed"],
            source: "db",
          })
          if (errorStore) {
            errorStore.setError(addr, {
              _tag: "CellError",
              source: "db",
              issues: ["Database write failed"],
              timestamp: Date.now(),
            })
          }
          return Result.fail(err)
        }

        return Result.succeed(value)
      })
    }

    const trySetBulk = (
      entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>,
    ): Effect.Effect<ReadonlyArray<{ addr: ColRow; result: Result.Result<CellValue, CellWriteError> }>> => {
      return Effect.gen(function*() {
        const results: Array<{ addr: ColRow; result: Result.Result<CellValue, CellWriteError> }> = []
        const valid: Array<{ addr: ColRow; key: CellKey; value: CellValue }> = []

        // Phase 1: Validate all
        for (const entry of entries) {
          const issues = validateCell(entry.addr, entry.value)
          if (issues.length > 0) {
            const err = new CellWriteError({
              col: entry.addr.col, row: entry.addr.row,
              issues: [...issues],
              source: "validation",
            })
            if (errorStore) {
              errorStore.setError(entry.addr, {
                _tag: "CellError",
                source: "validation",
                issues,
                timestamp: Date.now(),
              })
            }
            results.push({ addr: entry.addr, result: Result.fail(err) })
          } else {
            valid.push({ addr: entry.addr, key: cellKey(sheetId, entry.addr), value: entry.value })
            results.push({ addr: entry.addr, result: Result.succeed(entry.value) })
          }
        }

        // Phase 2: Write valid entries (atoms + DB)
        if (valid.length > 0) {
          for (const { key, value, addr } of valid) {
            family.set(key, value)
            if (errorStore) errorStore.clearError(addr)
          }
          yield* writeBulkToDb(valid.map(v => ({ key: v.key, value: v.value })))
        }

        return results
      })
    }

    // ── Transactional ops (real STM via multiStoreTransaction) ──

    const transactionalSetBulk = (
      entries: ReadonlyArray<{ addr: ColRow; value: CellValue }>,
    ): Effect.Effect<void, CellWriteError> => {
      return Effect.gen(function*() {
        // Phase 1: Validate all entries up front (before transaction)
        for (const entry of entries) {
          const issues = validateCell(entry.addr, entry.value)
          if (issues.length > 0) {
            if (errorStore) {
              errorStore.setError(entry.addr, {
                _tag: "CellError",
                source: "validation",
                issues,
                timestamp: Date.now(),
              })
            }
            yield* Effect.fail(new CellWriteError({
              col: entry.addr.col, row: entry.addr.row,
              issues: [...issues],
              source: "validation",
            }))
          }
        }

        // Phase 2: Build descriptors + execute atomic transaction
        const keyed = entries.map(e => ({
          key: cellKey(sheetId, e.addr),
          addr: e.addr,
          value: e.value,
        }))

        const descriptors = family.descriptors(keyed.map(e => e.key))

        // multiStoreTransaction: TxRef writes → Atom.batch sync on commit
        yield* multiStoreTransaction(
          descriptors as ReadonlyArray<TxStoreDescriptor<unknown>>,
          (refs) =>
            Effect.gen(function*() {
              for (const entry of keyed) {
                const ref = refs.get(entry.key)
                if (ref) yield* TxRef.set(ref, entry.value)
              }
            }),
        ).pipe(
          // Map StxTxValidationError → CellWriteError (entityMeta validation)
          Effect.catchTag("StxTxValidationError", (e) =>
            Effect.fail(new CellWriteError({
              col: entries[0].addr.col, row: entries[0].addr.row,
              issues: e.issues as string[],
              source: "validation",
            }))
          ),
        )

        // Phase 3: Clear errors on successful commit
        if (errorStore) {
          for (const entry of entries) errorStore.clearError(entry.addr)
        }

        // Phase 4: Persist to DB — if fails, roll back atoms to DB state
        const dbResult = yield* Effect.result(writeBulkToDb(keyed.map(e => ({ key: e.key, value: e.value }))))

        if (Result.isFailure(dbResult)) {
          // Roll back ALL atoms to DB state
          Atom.batch(() => {
            for (const { key } of keyed) {
              family.set(key, readFromDb(key))
            }
          })
          yield* Effect.fail(new CellWriteError({
            col: entries[0].addr.col, row: entries[0].addr.row,
            issues: ["Bulk database write failed — all cells rolled back"],
            source: "db",
          }))
        }
      })
    }

    return CellCache.of({
      getAtom, get, set, setBulk, invalidate,
      trySet, trySetBulk, transactionalSetBulk,
      family, registry, sheetId, errorStore,
    })
  }),
)

/**
 * @tmnl/datagrid — Result-first + transactional cell operations.
 *
 * Tests:
 * 1. trySet — validation passes → Result.succeed, validation fails → Result.fail + error atom
 * 2. trySetBulk — mixed valid/invalid entries, per-cell Results
 * 3. transactionalSetBulk — atomic update, rollback on failure
 * 4. CellErrorStore — error atoms track write failures
 * 5. CellWriteError — Schema.TaggedErrorClass, catchable by _tag
 */
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import * as Result from "effect/Result"
import { AtomRegistry } from "effect/unstable/reactivity"
import { Layer, Context } from "effect"
import {
  CellCache, CellCacheConfig, CellCacheLive,
  CellWriteError, makeCellErrorStore,
  type CellValue,
  num, str, empty,
} from "../src/index"

// ─── Test DB (in-memory) ────────────────────────────

function makeTestDb() {
  const store = new Map<string, CellValue>()
  let bulkWriteError = false

  return {
    store,
    setBulkWriteError(v: boolean) { bulkWriteError = v },
    readCell: (_sheetId: string, col: number, row: number): CellValue | null =>
      store.get(`${col}:${row}`) ?? null,
    writeCell: (_sheetId: string, col: number, row: number, value: CellValue) => {
      store.set(`${col}:${row}`, value)
      return Effect.void
    },
    writeCellBulk: (_sheetId: string, entries: ReadonlyArray<{ col: number; row: number; value: CellValue }>) => {
      if (bulkWriteError) {
        return Effect.fail(new Error("DB bulk write failed"))
      }
      for (const e of entries) store.set(`${e.col}:${e.row}`, e.value)
      return Effect.void
    },
  }
}

// ─── Build CellCache ────────────────────────────────

function buildCellCache(opts: {
  validate?: (sheetId: string, col: number, row: number, value: CellValue) => ReadonlyArray<string>
  db?: ReturnType<typeof makeTestDb>
} = {}) {
  const db = opts.db ?? makeTestDb()
  const registry = AtomRegistry.make()
  const errorStore = makeCellErrorStore(registry, "test")

  const configLayer = Layer.succeed(CellCacheConfig)(CellCacheConfig.of({
    sheetId: "test",
    registry,
    readCell: db.readCell,
    writeCell: db.writeCell,
    writeCellBulk: db.writeCellBulk,
    validateCell: opts.validate,
    errorStore,
  }))

  const cacheLayer = Layer.provide(CellCacheLive, configLayer)
  const sm = Effect.runSync(Effect.scoped(cacheLayer.pipe(Layer.build)))
  const cache = Context.get(sm, CellCache)

  return { cache, db, registry, errorStore }
}

// ═══════════════════════════════════════════════════════
// 1. trySet — Result-returning single-cell write
// ═══════════════════════════════════════════════════════

describe("trySet — Result-returning single cell write", () => {
  it("succeeds when no validation is configured", () => {
    const { cache } = buildCellCache()

    const result = Effect.runSync(cache.trySet({ col: 0, row: 0 }, num(42)))
    expect(Result.isSuccess(result)).toBe(true)
    expect(cache.get({ col: 0, row: 0 })).toEqual(num(42))
  })

  it("succeeds when validation passes", () => {
    const { cache } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value > 0 ? [] : ["Must be positive number"],
    })

    const result = Effect.runSync(cache.trySet({ col: 0, row: 0 }, num(10)))
    expect(Result.isSuccess(result)).toBe(true)
  })

  it("returns Result.fail on validation failure", () => {
    const { cache, errorStore } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value > 0 ? [] : ["Must be positive number"],
    })

    const result = Effect.runSync(cache.trySet({ col: 1, row: 1 }, num(-5)))
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("CellWriteError")
      expect(result.failure.source).toBe("validation")
      expect(result.failure.issues).toContain("Must be positive number")
    }

    // Error atom should be populated
    const errState = errorStore.getError({ col: 1, row: 1 })
    expect(errState).not.toBeNull()
    expect(errState!.source).toBe("validation")
  })

  it("clears error atom on successful write after failure", () => {
    const { cache, errorStore } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value > 0 ? [] : ["Must be positive number"],
    })

    // Fail first
    Effect.runSync(cache.trySet({ col: 0, row: 0 }, num(-1)))
    expect(errorStore.getError({ col: 0, row: 0 })).not.toBeNull()

    // Succeed — error cleared
    Effect.runSync(cache.trySet({ col: 0, row: 0 }, num(10)))
    expect(errorStore.getError({ col: 0, row: 0 })).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════
// 2. trySetBulk — per-cell Results
// ═══════════════════════════════════════════════════════

describe("trySetBulk — per-cell Result array", () => {
  it("all succeed when no validation", () => {
    const { cache } = buildCellCache()

    const results = Effect.runSync(cache.trySetBulk([
      { addr: { col: 0, row: 0 }, value: num(1) },
      { addr: { col: 1, row: 0 }, value: num(2) },
      { addr: { col: 2, row: 0 }, value: num(3) },
    ]))

    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(Result.isSuccess(r.result)).toBe(true)
    }
  })

  it("mixed valid/invalid — only valid entries are written", () => {
    const { cache, errorStore } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value >= 0 ? [] : ["No negatives"],
    })

    const results = Effect.runSync(cache.trySetBulk([
      { addr: { col: 0, row: 0 }, value: num(10) },   // valid
      { addr: { col: 1, row: 0 }, value: num(-5) },   // invalid
      { addr: { col: 2, row: 0 }, value: num(20) },   // valid
    ]))

    // First and third succeed, second fails
    expect(Result.isSuccess(results[0].result)).toBe(true)
    expect(Result.isFailure(results[1].result)).toBe(true)
    expect(Result.isSuccess(results[2].result)).toBe(true)

    // Valid cells written, invalid cell unchanged
    expect(cache.get({ col: 0, row: 0 })).toEqual(num(10))
    expect(cache.get({ col: 2, row: 0 })).toEqual(num(20))

    // Error on invalid cell
    expect(errorStore.getError({ col: 1, row: 0 })?.source).toBe("validation")
    // Clean cells have no error
    expect(errorStore.getError({ col: 0, row: 0 })).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════
// 3. transactionalSetBulk — atomic commit/rollback
// ═══════════════════════════════════════════════════════

describe("transactionalSetBulk — atomic bulk operations", () => {
  it("commits all cells atomically on success", () => {
    const { cache, db } = buildCellCache()

    Effect.runSync(cache.transactionalSetBulk([
      { addr: { col: 0, row: 0 }, value: num(100) },
      { addr: { col: 1, row: 0 }, value: num(200) },
      { addr: { col: 2, row: 0 }, value: num(300) },
    ]))

    // All atoms updated
    expect(cache.get({ col: 0, row: 0 })).toEqual(num(100))
    expect(cache.get({ col: 1, row: 0 })).toEqual(num(200))
    expect(cache.get({ col: 2, row: 0 })).toEqual(num(300))

    // All persisted to DB
    expect(db.store.get("0:0")).toEqual(num(100))
    expect(db.store.get("1:0")).toEqual(num(200))
    expect(db.store.get("2:0")).toEqual(num(300))
  })

  it("rejects and writes nothing when validation fails", () => {
    const { cache, db, errorStore } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value >= 0 ? [] : ["No negatives"],
    })

    // Pre-populate
    Effect.runSync(cache.transactionalSetBulk([
      { addr: { col: 0, row: 0 }, value: num(10) },
      { addr: { col: 1, row: 0 }, value: num(20) },
    ]))

    // Now try a batch where one entry is invalid
    const exit = Effect.runSyncExit(cache.transactionalSetBulk([
      { addr: { col: 0, row: 0 }, value: num(99) },  // valid
      { addr: { col: 1, row: 0 }, value: num(-1) },  // invalid — entire batch fails
    ]))

    expect(exit._tag).toBe("Failure")

    // NEITHER cell should have changed
    expect(cache.get({ col: 0, row: 0 })).toEqual(num(10))
    expect(cache.get({ col: 1, row: 0 })).toEqual(num(20))
  })

  it("rolls back atoms when DB write fails", () => {
    const db = makeTestDb()
    const { cache } = buildCellCache({ db })

    // Pre-populate
    Effect.runSync(cache.transactionalSetBulk([
      { addr: { col: 0, row: 0 }, value: num(10) },
    ]))

    // Enable DB failure
    db.setBulkWriteError(true)

    const exit = Effect.runSyncExit(cache.transactionalSetBulk([
      { addr: { col: 0, row: 0 }, value: num(999) },
    ]))

    expect(exit._tag).toBe("Failure")

    // Atom rolled back to DB state
    expect(cache.get({ col: 0, row: 0 })).toEqual(num(10))
  })

  it("large batch (100 cells) commits atomically", () => {
    const { cache } = buildCellCache()
    const entries = Array.from({ length: 100 }, (_, i) => ({
      addr: { col: i, row: 0 },
      value: num(i * 10),
    }))

    Effect.runSync(cache.transactionalSetBulk(entries))

    for (let i = 0; i < 100; i++) {
      expect(cache.get({ col: i, row: 0 })).toEqual(num(i * 10))
    }
  })
})

// ═══════════════════════════════════════════════════════
// 4. CellErrorStore — error atom lifecycle
// ═══════════════════════════════════════════════════════

describe("CellErrorStore", () => {
  it("starts clean (null)", () => {
    const registry = AtomRegistry.make()
    const store = makeCellErrorStore(registry, "test")
    expect(store.getError({ col: 0, row: 0 })).toBeNull()
  })

  it("setError → getError round-trips", () => {
    const registry = AtomRegistry.make()
    const store = makeCellErrorStore(registry, "test")

    store.setError({ col: 1, row: 2 }, {
      _tag: "CellError",
      source: "validation",
      issues: ["too big"],
      timestamp: 1000,
    })

    const err = store.getError({ col: 1, row: 2 })
    expect(err).not.toBeNull()
    expect(err!.source).toBe("validation")
    expect(err!.issues).toEqual(["too big"])
  })

  it("clearError resets to null", () => {
    const registry = AtomRegistry.make()
    const store = makeCellErrorStore(registry, "test")

    store.setError({ col: 0, row: 0 }, {
      _tag: "CellError",
      source: "db",
      issues: ["timeout"],
      timestamp: 1000,
    })
    expect(store.getError({ col: 0, row: 0 })).not.toBeNull()

    store.clearError({ col: 0, row: 0 })
    expect(store.getError({ col: 0, row: 0 })).toBeNull()
  })

  it("clearAll resets all tracked errors", () => {
    const registry = AtomRegistry.make()
    const store = makeCellErrorStore(registry, "test")

    store.setError({ col: 0, row: 0 }, { _tag: "CellError", source: "validation", issues: ["a"], timestamp: 1 })
    store.setError({ col: 1, row: 0 }, { _tag: "CellError", source: "validation", issues: ["b"], timestamp: 2 })
    store.setError({ col: 2, row: 0 }, { _tag: "CellError", source: "db", issues: ["c"], timestamp: 3 })

    store.clearAll()

    expect(store.getError({ col: 0, row: 0 })).toBeNull()
    expect(store.getError({ col: 1, row: 0 })).toBeNull()
    expect(store.getError({ col: 2, row: 0 })).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════
// 5. CellWriteError — Schema.TaggedErrorClass
// ═══════════════════════════════════════════════════════

describe("CellWriteError — Schema.TaggedErrorClass", () => {
  it("has correct _tag discriminant", () => {
    const err = new CellWriteError({
      col: 3, row: 5,
      issues: ["negative value"],
      source: "validation",
    })
    expect(err._tag).toBe("CellWriteError")
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain("Cell (3,5)")
    expect(err.message).toContain("validation")
  })

  it("is catchable via Effect.catchTag", () => {
    const result = Effect.runSync(
      Effect.fail(new CellWriteError({
        col: 0, row: 0,
        issues: ["bad"],
        source: "constraint",
      })).pipe(
        Effect.catchTag("CellWriteError", (e) =>
          Effect.succeed(`caught: ${e.source} on (${e.col},${e.row})`),
        ),
      ),
    )
    expect(result).toBe("caught: constraint on (0,0)")
  })

  it("source field is a Schema.Literals value", () => {
    const sources: Array<"validation" | "constraint" | "db" | "conflict"> = [
      "validation", "constraint", "db", "conflict",
    ]
    for (const source of sources) {
      const err = new CellWriteError({ col: 0, row: 0, issues: [], source })
      expect(err.source).toBe(source)
    }
  })
})

// ═══════════════════════════════════════════════════════
// 6. Chaos: rapid mixed operations
// ═══════════════════════════════════════════════════════

describe("Chaos: rapid mixed Result + transactional operations", () => {
  it("500 trySet calls — errors tracked per cell, successes persisted", () => {
    const { cache, errorStore } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value >= 0 ? [] : ["negative"],
    })

    let successes = 0
    let failures = 0

    for (let i = 0; i < 500; i++) {
      const col = i % 10
      const row = Math.floor(i / 10)
      const value = num(i % 3 === 0 ? -i : i) // every 3rd is negative

      const result = Effect.runSync(cache.trySet({ col, row }, value))
      if (Result.isSuccess(result)) successes++
      else failures++
    }

    expect(successes).toBeGreaterThan(300)
    expect(failures).toBeGreaterThan(100)
  })

  it("100 transactional bulk writes — all-or-nothing per batch", () => {
    const { cache } = buildCellCache({
      validate: (_s, _c, _r, value) =>
        value._tag === "Number" && value.value >= 0 ? [] : ["negative"],
    })

    let committed = 0
    let rejected = 0

    for (let batch = 0; batch < 100; batch++) {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        addr: { col: i, row: batch },
        value: num(batch % 7 === 0 ? -1 : batch * 10 + i), // every 7th batch has a bad value
      }))

      const exit = Effect.runSyncExit(cache.transactionalSetBulk(entries))
      if (exit._tag === "Success") committed++
      else rejected++
    }

    expect(committed).toBeGreaterThan(80)
    expect(rejected).toBeGreaterThan(10)

    // Spot-check: a committed batch should have all its cells
    const goodBatch = 1 // batch 1 is not divisible by 7
    for (let i = 0; i < 5; i++) {
      expect(cache.get({ col: i, row: goodBatch })).toEqual(num(goodBatch * 10 + i))
    }
  })
})

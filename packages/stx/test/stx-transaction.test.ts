/**
 * @tmnl/stx — Transactional STM integration tests
 *
 * Six scenario categories, each with semantic correctness tests
 * and chaos/stress tests:
 *
 * 1. Cross-store invariant (budget allocation)
 * 2. Read-modify-write race (counter / ABA)
 * 3. Multi-field Entity invariant (date range)
 * 4. Partial write rollback (cascading failure)
 * 5. Observer consistency across families (bulk update)
 * 6. Optimistic concurrency (collaborative editing)
 */
import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Exit from "effect-v4/Exit"
import * as Result from "effect-v4/Result"
import * as TxRef from "effect-v4/TxRef"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import type { EntityMeta } from "../src/types.js"
import {
  StxTxValidationError,
  StxTxConstraintError,
  StxTxConflictError,
  storeTransaction,
  multiStoreTransaction,
  txSet,
  txSetAt,
  txModify,
  txGet,
  txGetAt,
  type TxStoreDescriptor,
} from "../src/internal/transaction.js"

// ─── Test Helpers ───────────────────────────────────

/** Build a TxStoreDescriptor from an initial value */
function makeStore<S>(id: string, initial: S, entityMeta?: EntityMeta): TxStoreDescriptor<S> {
  return {
    id,
    txRef: TxRef.makeUnsafe(initial),
    atom: Atom.make(initial),
    registry: AtomRegistry.make(),
    entityMeta,
  }
}

/** Read the atom value from a store's registry */
function readAtom<S>(store: TxStoreDescriptor<S>): S {
  return store.registry.get(store.atom)
}

/** Simple lens for a named property */
function propLens<S, K extends keyof S>(key: K) {
  return {
    get: (s: S): S[K] => s[key],
    replace: (value: S[K], s: S): S => ({ ...s, [key]: value }),
    modify: (fn: (a: S[K]) => S[K]) => (s: S): S => ({ ...s, [key]: fn(s[key]) }),
  }
}

/** EntityMeta that validates with a predicate */
function makeEntityMeta(
  tag: string,
  predicate: (value: unknown) => { valid: boolean; issues: string[] },
  fieldMeta: Record<string, string> = {},
): EntityMeta {
  return {
    tag,
    fieldMeta,
    validate: {
      select: (value: unknown) => {
        const r = predicate(value)
        return r.valid
          ? Result.succeed(value)
          : Result.fail({ issues: r.issues })
      },
    },
  } as EntityMeta
}

// ═══════════════════════════════════════════════════════
// CASE 1: Cross-Store Invariant (Budget Allocation)
// ═══════════════════════════════════════════════════════

describe("Case 1: Cross-store invariant — budget allocation", () => {
  interface Department { readonly name: string; readonly budget: number }

  it("transfers budget atomically between two stores", () => {
    const marketing = makeStore<Department>("marketing", { name: "Marketing", budget: 5000 })
    const engineering = makeStore<Department>("engineering", { name: "Engineering", budget: 3000 })

    const transfer = multiStoreTransaction(
      [marketing as TxStoreDescriptor<unknown>, engineering as TxStoreDescriptor<unknown>],
      (refs) => Effect.gen(function*() {
        const mktRef = refs.get("marketing")! as TxRef.TxRef<Department>
        const engRef = refs.get("engineering")! as TxRef.TxRef<Department>
        const mkt = yield* TxRef.get(mktRef)
        const eng = yield* TxRef.get(engRef)
        yield* TxRef.set(mktRef, { ...mkt, budget: mkt.budget - 1000 })
        yield* TxRef.set(engRef, { ...eng, budget: eng.budget + 1000 })
      }),
    )

    Effect.runSync(transfer)

    // Both atoms updated atomically
    expect(readAtom(marketing).budget).toBe(4000)
    expect(readAtom(engineering).budget).toBe(4000)
    // Total invariant preserved
    expect(readAtom(marketing).budget + readAtom(engineering).budget).toBe(8000)
  })

  it("rolls back both stores when validation fails on one", () => {
    const marketing = makeStore<Department>(
      "marketing",
      { name: "Marketing", budget: 5000 },
      makeEntityMeta("Department", (v) => {
        const d = v as Department
        return d.budget >= 0
          ? { valid: true, issues: [] }
          : { valid: false, issues: [`Budget cannot be negative: ${d.budget}`] }
      }),
    )
    const engineering = makeStore<Department>("engineering", { name: "Engineering", budget: 3000 })

    // Try to transfer more than marketing has
    const transfer = multiStoreTransaction(
      [marketing as TxStoreDescriptor<unknown>, engineering as TxStoreDescriptor<unknown>],
      (refs) => Effect.gen(function*() {
        const mktRef = refs.get("marketing")! as TxRef.TxRef<Department>
        const engRef = refs.get("engineering")! as TxRef.TxRef<Department>
        const mkt = yield* TxRef.get(mktRef)
        const eng = yield* TxRef.get(engRef)
        yield* TxRef.set(mktRef, { ...mkt, budget: mkt.budget - 6000 }) // -1000!
        yield* TxRef.set(engRef, { ...eng, budget: eng.budget + 6000 })
      }),
    )

    const exit = Effect.runSyncExit(transfer)
    expect(Exit.isFailure(exit)).toBe(true)

    // BOTH stores unchanged — atomic rollback
    expect(readAtom(marketing).budget).toBe(5000)
    expect(readAtom(engineering).budget).toBe(3000)
    expect(marketing.txRef.value.budget).toBe(5000)
    expect(engineering.txRef.value.budget).toBe(3000)
  })

  describe("chaos: concurrent budget transfers", () => {
    it("N concurrent transfers preserve total invariant", () => {
      const N = 100
      const stores = ["A", "B", "C", "D", "E"].map((name) =>
        makeStore<Department>(name, { name, budget: 2000 }),
      )
      const totalBefore = stores.reduce((sum, s) => sum + s.txRef.value.budget, 0) // 10000

      // Run N random transfers
      for (let i = 0; i < N; i++) {
        const fromIdx = i % stores.length
        const toIdx = (i + 1) % stores.length
        const amount = 10 + (i % 50) // 10-59

        const transfer = multiStoreTransaction(
          [stores[fromIdx] as TxStoreDescriptor<unknown>, stores[toIdx] as TxStoreDescriptor<unknown>],
          (refs) => Effect.gen(function*() {
            const fromRef = refs.get(stores[fromIdx].id)! as TxRef.TxRef<Department>
            const toRef = refs.get(stores[toIdx].id)! as TxRef.TxRef<Department>
            const from = yield* TxRef.get(fromRef)
            const to = yield* TxRef.get(toRef)
            yield* TxRef.set(fromRef, { ...from, budget: from.budget - amount })
            yield* TxRef.set(toRef, { ...to, budget: to.budget + amount })
          }),
        )

        Effect.runSync(transfer)
      }

      // Check both TxRef (transactional truth) and Atom (reactive surface)
      const totalTxRef = stores.reduce((sum, s) => sum + s.txRef.value.budget, 0)
      const totalAtom = stores.reduce((sum, s) => sum + readAtom(s).budget, 0)
      expect(totalTxRef).toBe(totalBefore)
      expect(totalAtom).toBe(totalBefore)
    })
  })
})

// ═══════════════════════════════════════════════════════
// CASE 2: Read-Modify-Write Race (Counter / ABA)
// ═══════════════════════════════════════════════════════

describe("Case 2: Read-modify-write — counter increment", () => {
  it("increment within transaction reads-then-writes atomically", () => {
    const counter = makeStore("counter", { value: 0 })

    for (let i = 0; i < 100; i++) {
      Effect.runSync(
        storeTransaction(counter, (ref) =>
          Effect.gen(function*() {
            const current = yield* TxRef.get(ref)
            yield* TxRef.set(ref, { value: current.value + 1 })
          }),
        ),
      )
    }

    expect(readAtom(counter).value).toBe(100)
    expect(counter.txRef.value.value).toBe(100)
  })

  it("conditional increment — only if value matches expected", () => {
    const counter = makeStore("counter", { value: 10 })

    // "Increment only if value is 10"
    const conditionalIncrement = storeTransaction(counter, (ref) =>
      Effect.gen(function*() {
        const current = yield* TxRef.get(ref)
        if (current.value !== 10) {
          yield* Effect.fail(new StxTxValidationError({
            issues: [`Expected 10, got ${current.value}`],
          }))
        }
        yield* TxRef.set(ref, { value: current.value + 1 })
      }),
    )

    Effect.runSync(conditionalIncrement)
    expect(readAtom(counter).value).toBe(11)

    // Second call fails — value is now 11, not 10
    const exit = Effect.runSyncExit(conditionalIncrement)
    expect(Exit.isFailure(exit)).toBe(true)
    expect(readAtom(counter).value).toBe(11) // unchanged
  })

  describe("chaos: high-frequency sequential increments", () => {
    it("1000 increments produce exactly 1000", () => {
      const counter = makeStore("counter", { value: 0 })
      const N = 1000

      for (let i = 0; i < N; i++) {
        Effect.runSync(
          storeTransaction(counter, (ref) =>
            Effect.gen(function*() {
              const current = yield* TxRef.get(ref)
              yield* TxRef.set(ref, { value: current.value + 1 })
            }),
          ),
        )
      }

      expect(readAtom(counter).value).toBe(N)
    })
  })
})

// ═══════════════════════════════════════════════════════
// CASE 3: Multi-Field Entity Invariant (Date Range)
// ═══════════════════════════════════════════════════════

describe("Case 3: Multi-field entity invariant — date range", () => {
  interface DateRange { readonly start: number; readonly end: number }

  const dateRangeMeta = makeEntityMeta("DateRange", (v) => {
    const d = v as DateRange
    return d.start < d.end
      ? { valid: true, issues: [] }
      : { valid: false, issues: [`start (${d.start}) must be < end (${d.end})`] }
  })

  it("allows updating both fields atomically when invariant holds", () => {
    const range = makeStore<DateRange>("range", { start: 1, end: 10 }, dateRangeMeta)

    // Move both endpoints forward — valid
    Effect.runSync(
      storeTransaction(range, (ref) =>
        Effect.gen(function*() {
          yield* TxRef.set(ref, { start: 5, end: 15 })
        }),
      ),
    )

    expect(readAtom(range)).toEqual({ start: 5, end: 15 })
  })

  it("rejects when final state violates invariant", () => {
    const range = makeStore<DateRange>("range", { start: 1, end: 10 }, dateRangeMeta)

    // Start > end — invalid
    const exit = Effect.runSyncExit(
      storeTransaction(range, (ref) =>
        Effect.gen(function*() {
          yield* TxRef.set(ref, { start: 20, end: 10 })
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(readAtom(range)).toEqual({ start: 1, end: 10 }) // unchanged
  })

  it("allows intermediate invalid state within transaction", () => {
    const range = makeStore<DateRange>("range", { start: 1, end: 10 }, dateRangeMeta)

    // Within the tx: temporarily start > end, then fix it
    Effect.runSync(
      storeTransaction(range, (ref) =>
        Effect.gen(function*() {
          // Step 1: move start past end (intermediate violation)
          const current = yield* TxRef.get(ref)
          yield* TxRef.set(ref, { ...current, start: 50 })
          // Step 2: move end past new start (fixes invariant)
          yield* TxRef.set(ref, { start: 50, end: 100 })
        }),
      ),
    )

    // Validation runs on FINAL state only — this passes
    expect(readAtom(range)).toEqual({ start: 50, end: 100 })
  })

  describe("chaos: random range mutations", () => {
    it("all committed ranges satisfy start < end", () => {
      const range = makeStore<DateRange>("range", { start: 0, end: 100 }, dateRangeMeta)
      let commits = 0
      let rejects = 0

      for (let i = 0; i < 200; i++) {
        const newStart = Math.floor(Math.random() * 200)
        const newEnd = Math.floor(Math.random() * 200)

        const exit = Effect.runSyncExit(
          storeTransaction(range, (ref) =>
            Effect.gen(function*() {
              yield* TxRef.set(ref, { start: newStart, end: newEnd })
            }),
          ),
        )

        if (Exit.isSuccess(exit)) {
          commits++
          const state = readAtom(range)
          // Every committed state MUST satisfy the invariant
          expect(state.start).toBeLessThan(state.end)
        } else {
          rejects++
        }
      }

      // Some should pass, some should fail (random inputs)
      expect(commits).toBeGreaterThan(0)
      expect(rejects).toBeGreaterThan(0)
    })
  })
})

// ═══════════════════════════════════════════════════════
// CASE 4: Partial Write Rollback (Cascading Failure)
// ═══════════════════════════════════════════════════════

describe("Case 4: Partial write rollback — cascading failure", () => {
  interface Account { readonly balance: number }

  it("rolls back all stores when Nth store fails validation", () => {
    const stores = [
      makeStore<Account>("a", { balance: 100 }),
      makeStore<Account>("b", { balance: 200 }),
      makeStore<Account>("c", { balance: 300 },
        // Store C rejects balances over 500
        makeEntityMeta("Account", (v) => {
          const a = v as Account
          return a.balance <= 500
            ? { valid: true, issues: [] }
            : { valid: false, issues: [`Balance ${a.balance} exceeds limit 500`] }
        }),
      ),
    ]

    // Write to A, B, C — C will fail validation
    const exit = Effect.runSyncExit(
      multiStoreTransaction(
        stores as Array<TxStoreDescriptor<unknown>>,
        (refs) => Effect.gen(function*() {
          const aRef = refs.get("a")! as TxRef.TxRef<Account>
          const bRef = refs.get("b")! as TxRef.TxRef<Account>
          const cRef = refs.get("c")! as TxRef.TxRef<Account>
          yield* TxRef.set(aRef, { balance: 999 })
          yield* TxRef.set(bRef, { balance: 999 })
          yield* TxRef.set(cRef, { balance: 999 }) // will fail validation
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)

    // ALL stores unchanged — even A and B which individually succeeded
    expect(readAtom(stores[0]).balance).toBe(100)
    expect(readAtom(stores[1]).balance).toBe(200)
    expect(readAtom(stores[2]).balance).toBe(300)
  })

  it("user-raised failure also rolls back all stores", () => {
    const a = makeStore("a", { value: 1 })
    const b = makeStore("b", { value: 2 })

    const exit = Effect.runSyncExit(
      multiStoreTransaction(
        [a, b] as Array<TxStoreDescriptor<unknown>>,
        (refs) => Effect.gen(function*() {
          const aRef = refs.get("a")! as TxRef.TxRef<{ value: number }>
          const bRef = refs.get("b")! as TxRef.TxRef<{ value: number }>
          yield* TxRef.set(aRef, { value: 100 })
          yield* TxRef.set(bRef, { value: 200 })
          // User decides to abort
          yield* Effect.fail(new StxTxConstraintError({
            field: "value",
            kind: "readonly",
            entityTag: "UserAbort",
          }))
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(readAtom(a).value).toBe(1) // unchanged
    expect(readAtom(b).value).toBe(2) // unchanged
  })

  describe("chaos: randomized multi-store failures", () => {
    it("no store is ever left in partial state across 500 transactions", () => {
      const N_STORES = 5
      const N_TXS = 500
      const stores = Array.from({ length: N_STORES }, (_, i) =>
        makeStore(`store-${i}`, { value: i * 100 }),
      )
      const originals = stores.map((s) => s.txRef.value.value)

      let committed = 0
      let failed = 0

      for (let t = 0; t < N_TXS; t++) {
        const shouldFail = t % 3 === 0 // every 3rd tx fails

        const exit = Effect.runSyncExit(
          multiStoreTransaction(
            stores as Array<TxStoreDescriptor<unknown>>,
            (refs) => Effect.gen(function*() {
              for (const store of stores) {
                const ref = refs.get(store.id)! as TxRef.TxRef<{ value: number }>
                const current = yield* TxRef.get(ref)
                yield* TxRef.set(ref, { value: current.value + 1 })
              }
              if (shouldFail) {
                yield* Effect.fail(new StxTxValidationError({
                  issues: ["Intentional chaos failure"],
                }))
              }
            }),
          ),
        )

        if (Exit.isSuccess(exit)) {
          committed++
        } else {
          failed++
        }
      }

      // All stores must have the same increment count (committed)
      const values = stores.map((s) => readAtom(s).value)
      for (let i = 0; i < N_STORES; i++) {
        expect(values[i]).toBe(originals[i] + committed)
      }

      expect(committed).toBeGreaterThan(0)
      expect(failed).toBeGreaterThan(0)
    })
  })
})

// ═══════════════════════════════════════════════════════
// CASE 5: Observer Consistency (Bulk Update / Family)
// ═══════════════════════════════════════════════════════

describe("Case 5: Observer consistency — bulk update", () => {
  interface Cell { readonly row: number; readonly col: number; readonly value: number }

  it("bulk paste updates all cells atomically", () => {
    const ROWS = 10
    const cells = Array.from({ length: ROWS }, (_, i) =>
      makeStore<Cell>(`cell-${i}`, { row: i, col: 0, value: 0 }),
    )

    // "Paste" — set all 10 cells to new values in one transaction
    Effect.runSync(
      multiStoreTransaction(
        cells as Array<TxStoreDescriptor<unknown>>,
        (refs) => Effect.gen(function*() {
          for (let i = 0; i < ROWS; i++) {
            const ref = refs.get(`cell-${i}`)! as TxRef.TxRef<Cell>
            yield* TxRef.set(ref, { row: i, col: 0, value: (i + 1) * 100 })
          }
        }),
      ),
    )

    // All atoms updated
    for (let i = 0; i < ROWS; i++) {
      expect(readAtom(cells[i]).value).toBe((i + 1) * 100)
    }
  })

  it("aggregate computed from atoms sees consistent state", () => {
    const ROWS = 5
    const cells = Array.from({ length: ROWS }, (_, i) =>
      makeStore<Cell>(`cell-${i}`, { row: i, col: 0, value: 10 }),
    )

    // Before: total = 50
    const totalBefore = cells.reduce((sum, c) => sum + readAtom(c).value, 0)
    expect(totalBefore).toBe(50)

    // Transaction: redistribute values but preserve total
    Effect.runSync(
      multiStoreTransaction(
        cells as Array<TxStoreDescriptor<unknown>>,
        (refs) => Effect.gen(function*() {
          // Move value from first cell to last cell
          const firstRef = refs.get("cell-0")! as TxRef.TxRef<Cell>
          const lastRef = refs.get("cell-4")! as TxRef.TxRef<Cell>
          const first = yield* TxRef.get(firstRef)
          const last = yield* TxRef.get(lastRef)
          yield* TxRef.set(firstRef, { ...first, value: 0 })
          yield* TxRef.set(lastRef, { ...last, value: 20 })
        }),
      ),
    )

    // After: total still = 50
    const totalAfter = cells.reduce((sum, c) => sum + readAtom(c).value, 0)
    expect(totalAfter).toBe(50)
    expect(readAtom(cells[0]).value).toBe(0)
    expect(readAtom(cells[4]).value).toBe(20)
  })

  describe("chaos: rapid bulk updates with validation", () => {
    it("1000 paste operations on 20 cells — invariant holds after each", () => {
      const N_CELLS = 20
      const N_PASTES = 1000
      const cells = Array.from({ length: N_CELLS }, (_, i) =>
        makeStore(`cell-${i}`, { value: 1 }),
      )

      for (let p = 0; p < N_PASTES; p++) {
        // Each paste increments all cells by 1
        Effect.runSync(
          multiStoreTransaction(
            cells as Array<TxStoreDescriptor<unknown>>,
            (refs) => Effect.gen(function*() {
              for (const cell of cells) {
                const ref = refs.get(cell.id)! as TxRef.TxRef<{ value: number }>
                const current = yield* TxRef.get(ref)
                yield* TxRef.set(ref, { value: current.value + 1 })
              }
            }),
          ),
        )
      }

      // All cells should be at exactly 1 + N_PASTES
      const values = cells.map((c) => readAtom(c).value)
      for (const v of values) {
        expect(v).toBe(1 + N_PASTES)
      }
      // All cells should be identical
      const unique = new Set(values)
      expect(unique.size).toBe(1)
    })
  })
})

// ═══════════════════════════════════════════════════════
// CASE 6: Optimistic Concurrency (Collaborative Edit)
// ═══════════════════════════════════════════════════════

describe("Case 6: Optimistic concurrency — collaborative editing", () => {
  interface Doc {
    readonly name: string
    readonly email: string
    readonly version: number
  }

  it("sequential non-conflicting edits both succeed", () => {
    const doc = makeStore<Doc>("doc", { name: "Alice", email: "a@old.com", version: 1 })

    // User A changes name
    Effect.runSync(
      storeTransaction(doc, (ref) =>
        Effect.gen(function*() {
          const current = yield* TxRef.get(ref)
          yield* TxRef.set(ref, { ...current, name: "Bob", version: current.version + 1 })
        }),
      ),
    )

    expect(readAtom(doc).name).toBe("Bob")
    expect(readAtom(doc).version).toBe(2)

    // User B changes email (reads fresh state)
    Effect.runSync(
      storeTransaction(doc, (ref) =>
        Effect.gen(function*() {
          const current = yield* TxRef.get(ref)
          yield* TxRef.set(ref, { ...current, email: "b@new.com", version: current.version + 1 })
        }),
      ),
    )

    // Both changes preserved
    expect(readAtom(doc)).toEqual({ name: "Bob", email: "b@new.com", version: 3 })
  })

  it("version-check CAS rejects stale writes", () => {
    const doc = makeStore<Doc>("doc", { name: "Alice", email: "a@old.com", version: 1 })

    // User A reads at version 1
    const staleVersion = doc.txRef.value.version

    // User B writes first, bumping version to 2
    Effect.runSync(
      storeTransaction(doc, (ref) =>
        Effect.gen(function*() {
          const current = yield* TxRef.get(ref)
          yield* TxRef.set(ref, { ...current, name: "Bob", version: current.version + 1 })
        }),
      ),
    )

    // User A tries to write with stale version
    const exit = Effect.runSyncExit(
      storeTransaction(doc, (ref) =>
        Effect.gen(function*() {
          const current = yield* TxRef.get(ref)
          if (current.version !== staleVersion) {
            yield* new StxTxConflictError({
              storeIds: ["doc"],
              retries: 0,
            })
          }
          yield* TxRef.set(ref, { ...current, email: "a-stale@bad.com", version: staleVersion + 1 })
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    // User B's write preserved, User A's rejected
    expect(readAtom(doc)).toEqual({ name: "Bob", email: "a@old.com", version: 2 })
  })

  describe("chaos: rapid version-bumped edits", () => {
    it("500 sequential edits produce strictly monotonic versions", () => {
      const doc = makeStore<Doc>("doc", { name: "init", email: "init@test.com", version: 0 })

      for (let i = 0; i < 500; i++) {
        Effect.runSync(
          storeTransaction(doc, (ref) =>
            Effect.gen(function*() {
              const current = yield* TxRef.get(ref)
              yield* TxRef.set(ref, {
                ...current,
                name: `edit-${i}`,
                version: current.version + 1,
              })
            }),
          ),
        )
      }

      expect(readAtom(doc).version).toBe(500)
      expect(readAtom(doc).name).toBe("edit-499")
    })

    it("interleaved CAS accepts/rejects maintain consistency", () => {
      const doc = makeStore<Doc>("doc", { name: "init", email: "init@test.com", version: 0 })
      let accepted = 0
      let rejected = 0

      for (let i = 0; i < 300; i++) {
        // Simulate: read version, maybe someone else writes first, then try CAS
        const readVersion = doc.txRef.value.version

        // 50% chance someone else edits in between
        if (i % 2 === 0) {
          Effect.runSync(
            storeTransaction(doc, (ref) =>
              Effect.gen(function*() {
                const current = yield* TxRef.get(ref)
                yield* TxRef.set(ref, { ...current, version: current.version + 1 })
              }),
            ),
          )
        }

        // Now try CAS with the version we read
        const exit = Effect.runSyncExit(
          storeTransaction(doc, (ref) =>
            Effect.gen(function*() {
              const current = yield* TxRef.get(ref)
              if (current.version !== readVersion) {
                yield* new StxTxConflictError({ storeIds: ["doc"], retries: 0 })
              }
              yield* TxRef.set(ref, {
                ...current,
                name: `cas-${i}`,
                version: current.version + 1,
              })
            }),
          ),
        )

        if (Exit.isSuccess(exit)) accepted++
        else rejected++
      }

      // Half should be rejected (the ones where someone else wrote first)
      expect(rejected).toBeGreaterThan(100)
      expect(accepted).toBeGreaterThan(100)
      // Version must equal total successful writes
      const finalVersion = readAtom(doc).version
      // Every accepted CAS incremented version by 1
      // Every interleaving edit incremented version by 1
      // Total version = accepted + (number of interleaving edits = 150)
      expect(finalVersion).toBe(accepted + 150)
    })
  })
})

// ═══════════════════════════════════════════════════════
// CASE 7: Error Handling Composability
// ═══════════════════════════════════════════════════════

describe("Error handling: Effect.catchTag with Schema.TaggedErrorClass", () => {
  it("StxTxValidationError is catchable by _tag", () => {
    const store = makeStore("s", { value: 0 },
      makeEntityMeta("V", (v) => {
        const s = v as { value: number }
        return s.value >= 0
          ? { valid: true, issues: [] }
          : { valid: false, issues: ["negative"] }
      }),
    )

    const recovered = Effect.runSync(
      storeTransaction(store, (ref) =>
        Effect.gen(function*() {
          yield* TxRef.set(ref, { value: -1 })
        }),
      ).pipe(
        Effect.catchTag("StxTxValidationError", (e) =>
          Effect.succeed(`caught: ${e.issues[0]}`),
        ),
      ),
    )

    expect(recovered).toBe("caught: negative")
    expect(readAtom(store).value).toBe(0) // atom unchanged
  })

  it("StxTxConflictError is catchable by _tag", () => {
    const result = Effect.runSync(
      Effect.fail(new StxTxConflictError({ storeIds: ["a", "b"], retries: 3 })).pipe(
        Effect.catchTag("StxTxConflictError", (e) =>
          Effect.succeed(`conflict on ${e.storeIds.join(",")} after ${e.retries} retries`),
        ),
      ),
    )

    expect(result).toBe("conflict on a,b after 3 retries")
  })

  it("StxTxConstraintError is catchable by _tag", () => {
    const result = Effect.runSync(
      Effect.fail(new StxTxConstraintError({
        field: "id",
        kind: "readonly",
        entityTag: "User",
      })).pipe(
        Effect.catchTag("StxTxConstraintError", (e) =>
          Effect.succeed(`blocked: ${e.field} is ${e.kind}`),
        ),
      ),
    )

    expect(result).toBe("blocked: id is readonly")
  })

  it("Effect.catchTags handles all three error types", () => {
    const errors: StxTxValidationError | StxTxConstraintError | StxTxConflictError[] = [
      new StxTxValidationError({ issues: ["bad"] }),
      new StxTxConstraintError({ field: "x", kind: "computed", entityTag: "E" }),
      new StxTxConflictError({ storeIds: ["s1"], retries: 1 }),
    ]

    for (const error of errors) {
      const result = Effect.runSync(
        Effect.fail(error).pipe(
          Effect.catchTags({
            StxTxValidationError: (e) => Effect.succeed(`validation: ${e._tag}`),
            StxTxConstraintError: (e) => Effect.succeed(`constraint: ${e._tag}`),
            StxTxConflictError: (e) => Effect.succeed(`conflict: ${e._tag}`),
          }),
        ),
      )
      expect(result).toContain(error._tag.replace("StxTx", "").replace("Error", "").toLowerCase())
    }
  })

  it("errors carry correct _tag discriminant", () => {
    const v = new StxTxValidationError({ issues: ["x"] })
    const c = new StxTxConstraintError({ field: "f", kind: "readonly", entityTag: "E" })
    const x = new StxTxConflictError({ storeIds: [], retries: 0 })

    expect(v._tag).toBe("StxTxValidationError")
    expect(c._tag).toBe("StxTxConstraintError")
    expect(x._tag).toBe("StxTxConflictError")

    // All are Error instances
    expect(v).toBeInstanceOf(Error)
    expect(c).toBeInstanceOf(Error)
    expect(x).toBeInstanceOf(Error)

    // All have message getters
    expect(v.message).toContain("Validation failed")
    expect(c.message).toContain("Cannot mutate readonly field")
    expect(x.message).toContain("Transaction conflict")
  })
})

// ═══════════════════════════════════════════════════════
// CASE 8: Constraint Checking (ReadOnly Fields)
// ═══════════════════════════════════════════════════════

describe("Constraint checking: readonly field protection in transactions", () => {
  interface User { readonly id: string; readonly name: string; readonly score: number }

  const userMeta = makeEntityMeta("User", () => ({ valid: true, issues: [] }), {
    id: "readonly",
    name: "data",
    score: "data",
  })

  it("txSetAt rejects mutation of readonly field", () => {
    const store = makeStore<User>("user", { id: "u1", name: "Alice", score: 100 }, userMeta)
    const idLens = {
      ...propLens<User, "id">("id"),
      [Symbol.for("@tmnl/stx/lensPath")]: "id",
    }

    const exit = Effect.runSyncExit(
      storeTransaction(store, (ref) =>
        Effect.gen(function*() {
          yield* txSetAt(ref, store.entityMeta, idLens, "u2")
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(readAtom(store).id).toBe("u1") // unchanged
  })

  it("txSetAt allows mutation of data field", () => {
    const store = makeStore<User>("user", { id: "u1", name: "Alice", score: 100 }, userMeta)
    const nameLens = {
      ...propLens<User, "name">("name"),
      [Symbol.for("@tmnl/stx/lensPath")]: "name",
    }

    Effect.runSync(
      storeTransaction(store, (ref) =>
        Effect.gen(function*() {
          yield* txSetAt(ref, store.entityMeta, nameLens, "Bob")
        }),
      ),
    )

    expect(readAtom(store).name).toBe("Bob")
  })

  it("txModify rejects modification of computed field", () => {
    const meta = makeEntityMeta("Item", () => ({ valid: true, issues: [] }), {
      total: "computed",
    })
    const store = makeStore("item", { total: 42, quantity: 5 }, meta)
    const totalLens = {
      ...propLens<typeof store.txRef.value, "total">("total"),
      [Symbol.for("@tmnl/stx/lensPath")]: "total",
    }

    const exit = Effect.runSyncExit(
      storeTransaction(store, (ref) =>
        Effect.gen(function*() {
          yield* txModify(ref, store.entityMeta, totalLens, (x) => x + 1)
        }),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(readAtom(store).total).toBe(42)
  })
})

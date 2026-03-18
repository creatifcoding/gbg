/**
 * @tmnl/stx — Transactional family tests (G1)
 *
 * Validates that stxFamily with `{ transactional: true }` creates
 * TxRef+Atom pairs per member, enables storeTransaction / multiStoreTransaction,
 * and keeps Atom state in sync after commit.
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as TxRef from "effect-v4/TxRef"
import { AtomRegistry } from "effect-v4/unstable/reactivity"
import { stxFamily, storeTransaction, multiStoreTransaction, type TxStoreDescriptor } from "../src/index.js"

// ─── Test data ──────────────────────────────────────

interface CellValue {
  readonly _tag: string
  readonly value?: number | string
}

const empty = (): CellValue => ({ _tag: "Empty" })
const num = (n: number): CellValue => ({ _tag: "Number", value: n })

// ─── Tests ──────────────────────────────────────────

describe("stxFamily transactional mode (G1)", () => {

  // ── Construction ──────────────────────────────

  it("non-transactional family has transactional=false", () => {
    const family = stxFamily((k: string) => empty())
    expect(family.transactional).toBe(false)
  })

  it("transactional family has transactional=true", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )
    expect(family.transactional).toBe(true)
  })

  it("non-transactional family.descriptor returns undefined", () => {
    const family = stxFamily((k: string) => empty())
    family("a") // materialize
    expect(family.descriptor("a")).toBeUndefined()
  })

  it("non-transactional member.descriptor is undefined", () => {
    const family = stxFamily((k: string) => empty())
    const member = family.member("a")
    expect(member.descriptor).toBeUndefined()
  })

  // ── Descriptor shape ──────────────────────────

  it("transactional member has descriptor with TxRef + Atom", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )
    const member = family.member("cell-0")
    expect(member.descriptor).toBeDefined()
    const desc = member.descriptor!
    expect(desc.id).toBe("cell-0")
    expect(desc.txRef).toBeDefined()
    expect(desc.atom).toBe(member.atom)
    expect(desc.registry).toBe(reg)
  })

  it("family.descriptor(key) returns same descriptor as member", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )
    const member = family.member("x")
    const desc = family.descriptor("x")
    expect(desc).toBe(member.descriptor)
  })

  it("family.descriptors returns array for multiple keys", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )
    const descs = family.descriptors(["a", "b", "c"])
    expect(descs).toHaveLength(3)
    expect(descs[0]!.id).toBe("a")
    expect(descs[1]!.id).toBe("b")
    expect(descs[2]!.id).toBe("c")
  })

  it("non-transactional descriptors returns empty array", () => {
    const family = stxFamily((k: string) => empty())
    expect(family.descriptors(["a", "b"])).toEqual([])
  })

  // ── TxRef initial value matches Atom ──────────

  it("TxRef initial value matches factory output", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => num(parseInt(k)),
      { registry: reg, transactional: true },
    )
    const desc = family.descriptor("42")!
    expect(desc.txRef.value).toEqual(num(42))
    expect(family.get("42")).toEqual(num(42))
  })

  // ── storeTransaction ─────────────────────────

  it("storeTransaction commits to both TxRef and Atom", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )
    const desc = family.descriptor("cell-0")!

    Effect.runSync(
      storeTransaction(desc, (ref) =>
        Effect.gen(function*() {
          yield* TxRef.set(ref, num(99))
        })
      )
    )

    // Atom layer updated
    expect(family.get("cell-0")).toEqual(num(99))
    // TxRef committed
    expect(desc.txRef.value).toEqual(num(99))
  })

  it("storeTransaction rollback on failure — Atom unchanged", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => num(0),
      { registry: reg, transactional: true },
    )
    const desc = family.descriptor("x")!

    const result = Effect.runSyncExit(
      storeTransaction(desc, (ref) =>
        Effect.gen(function*() {
          yield* TxRef.set(ref, num(99))
          return yield* Effect.fail(new Error("boom"))
        })
      )
    )

    // Transaction failed — Atom and TxRef unchanged
    expect(family.get("x")).toEqual(num(0))
    expect(result._tag).toBe("Failure")
  })

  // ── multiStoreTransaction ─────────────────────

  it("multiStoreTransaction commits multiple cells atomically", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => num(0),
      { registry: reg, transactional: true },
    )

    const descs = family.descriptors(["a", "b", "c"])

    Effect.runSync(
      multiStoreTransaction(
        descs as ReadonlyArray<TxStoreDescriptor<unknown>>,
        (refs) =>
          Effect.gen(function*() {
            yield* TxRef.set(refs.get("a")!, num(10))
            yield* TxRef.set(refs.get("b")!, num(20))
            yield* TxRef.set(refs.get("c")!, num(30))
          })
      )
    )

    expect(family.get("a")).toEqual(num(10))
    expect(family.get("b")).toEqual(num(20))
    expect(family.get("c")).toEqual(num(30))
  })

  it("multiStoreTransaction rolls back ALL on failure", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => num(0),
      { registry: reg, transactional: true },
    )

    const descs = family.descriptors(["a", "b"])

    const result = Effect.runSyncExit(
      multiStoreTransaction(
        descs as ReadonlyArray<TxStoreDescriptor<unknown>>,
        (refs) =>
          Effect.gen(function*() {
            yield* TxRef.set(refs.get("a")!, num(100))
            yield* TxRef.set(refs.get("b")!, num(200))
            return yield* Effect.fail(new Error("rollback"))
          })
      )
    )

    // Both unchanged
    expect(family.get("a")).toEqual(num(0))
    expect(family.get("b")).toEqual(num(0))
    expect(result._tag).toBe("Failure")
  })

  // ── Immediate API still works ─────────────────

  it("set/get still works outside transactions", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )

    family.set("k", num(42))
    expect(family.get("k")).toEqual(num(42))
  })

  it("member.set/get still works outside transactions", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )

    const m = family.member("k")
    m.set(num(7))
    expect(m.get()).toEqual(num(7))
  })

  // ── Backward compatibility ────────────────────

  it("existing stxFamily(factory, registry) signature still works", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily((k: string) => empty(), reg)
    family.set("x", num(1))
    expect(family.get("x")).toEqual(num(1))
    expect(family.transactional).toBe(false)
  })

  it("stxFamily(factory) with no second arg still works", () => {
    const family = stxFamily((k: string) => empty())
    family.set("x", num(1))
    expect(family.get("x")).toEqual(num(1))
  })

  // ── Descriptor stability ──────────────────────

  it("same key returns same descriptor (referentially stable)", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => empty(),
      { registry: reg, transactional: true },
    )
    const d1 = family.descriptor("a")
    const d2 = family.descriptor("a")
    expect(d1).toBe(d2)
  })

  // ── Read within transaction ───────────────────

  it("TxRef.get reads uncommitted writes within same transaction", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(
      (k: string) => num(0),
      { registry: reg, transactional: true },
    )
    const desc = family.descriptor("k")!

    let readBack: CellValue | undefined

    Effect.runSync(
      storeTransaction(desc, (ref) =>
        Effect.gen(function*() {
          yield* TxRef.set(ref, num(42))
          readBack = yield* TxRef.get(ref)
        })
      )
    )

    expect(readBack).toEqual(num(42))
  })
})

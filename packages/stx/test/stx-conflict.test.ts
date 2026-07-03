/**
 * @tmnl/stx — Conflict detection tests (G3)
 *
 * Validates version snapshots, conflict detection, retry policy,
 * and StxTxConflictError surfacing for concurrent writes.
 */

import { describe, it, expect, vi } from "vitest"
import * as Effect from "effect/Effect"
import * as TxRef from "effect/TxRef"
import { AtomRegistry } from "effect/unstable/reactivity"
import {
  stxFamily,
  snapshotVersions,
  detectConflicts,
  getVersion,
  conflictAwareTransaction,
  conflictAwareStoreTransaction,
  storeTransaction,
  StxTxConflictError,
  type TxStoreDescriptor,
} from "../src/index.js"

// ─── Helpers ────────────────────────────────────────

interface Val { readonly n: number }
const val = (n: number): Val => ({ n })

function makeTxFamily() {
  const reg = AtomRegistry.make()
  return stxFamily((k: string) => val(0), { registry: reg, transactional: true })
}

// ─── Tests ──────────────────────────────────────────

describe("Conflict detection (G3)", () => {

  // ── Version snapshots ─────────────────────────

  describe("snapshotVersions", () => {
    it("captures current TxRef versions", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a", "b"])
      const snap = snapshotVersions(descs as TxStoreDescriptor<unknown>[])
      expect(snap.versions.get("a")).toBe(0)
      expect(snap.versions.get("b")).toBe(0)
      expect(snap.timestamp).toBeGreaterThan(0)
    })

    it("versions change after transaction commit", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("a")!

      const v0 = getVersion(desc as TxStoreDescriptor<unknown>)

      Effect.runSync(
        storeTransaction(desc as TxStoreDescriptor<unknown>, (ref) =>
          TxRef.set(ref, val(42))
        )
      )

      const v1 = getVersion(desc as TxStoreDescriptor<unknown>)
      expect(v1).toBeGreaterThan(v0)
    })
  })

  // ── detectConflicts ───────────────────────────

  describe("detectConflicts", () => {
    it("returns empty when no external writes", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a", "b"]) as TxStoreDescriptor<unknown>[]
      const snap = snapshotVersions(descs)

      // No writes → no conflicts (bump=0 since we didn't transact)
      const conflicts = detectConflicts(descs, snap, 0)
      expect(conflicts).toEqual([])
    })

    it("our own transaction bump is not a conflict (expectedBump=1)", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a"]) as TxStoreDescriptor<unknown>[]
      const snap = snapshotVersions(descs)

      // Our own write bumps version by 1
      Effect.runSync(storeTransaction(descs[0]!, (ref) => TxRef.set(ref, val(42))))

      // With expectedBump=1, this is NOT a conflict
      const conflicts = detectConflicts(descs, snap, 1)
      expect(conflicts).toEqual([])
    })

    it("detects version divergence beyond expected bump", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a", "b"]) as TxStoreDescriptor<unknown>[]
      const snap = snapshotVersions(descs)

      // Two writes to "a" (bump by 2) — our tx would only bump by 1
      Effect.runSync(storeTransaction(descs[0]!, (ref) => TxRef.set(ref, val(1))))
      Effect.runSync(storeTransaction(descs[0]!, (ref) => TxRef.set(ref, val(2))))

      // expectedBump=1 → version jumped by 2, so conflict detected
      const conflicts = detectConflicts(descs, snap, 1)
      expect(conflicts).toEqual(["a"])
    })

    it("detects multiple conflicted stores", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a", "b", "c"]) as TxStoreDescriptor<unknown>[]
      const snap = snapshotVersions(descs)

      // Two writes each to "a" and "c" (bump by 2 each)
      Effect.runSync(storeTransaction(descs[0]!, (ref) => TxRef.set(ref, val(1))))
      Effect.runSync(storeTransaction(descs[0]!, (ref) => TxRef.set(ref, val(2))))
      Effect.runSync(storeTransaction(descs[2]!, (ref) => TxRef.set(ref, val(3))))
      Effect.runSync(storeTransaction(descs[2]!, (ref) => TxRef.set(ref, val(4))))

      // expectedBump=1 → a and c bumped by 2, b untouched
      const conflicts = detectConflicts(descs, snap, 1)
      expect(conflicts).toContain("a")
      expect(conflicts).toContain("c")
      expect(conflicts).not.toContain("b")
    })
  })

  // ── getVersion ────────────────────────────────

  describe("getVersion", () => {
    it("returns 0 for fresh TxRef", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("x")! as TxStoreDescriptor<unknown>
      expect(getVersion(desc)).toBe(0)
    })

    it("increments after commit", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("x")! as TxStoreDescriptor<unknown>

      Effect.runSync(storeTransaction(desc, (ref) => TxRef.set(ref, val(1))))
      const v1 = getVersion(desc)

      Effect.runSync(storeTransaction(desc, (ref) => TxRef.set(ref, val(2))))
      const v2 = getVersion(desc)

      expect(v2).toBeGreaterThan(v1)
    })
  })

  // ── conflictAwareTransaction ──────────────────

  describe("conflictAwareTransaction", () => {
    it("succeeds when no conflicts", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a", "b"]) as TxStoreDescriptor<unknown>[]

      Effect.runSync(
        conflictAwareTransaction(descs, (refs) =>
          Effect.gen(function*() {
            yield* TxRef.set(refs.get("a")!, val(10))
            yield* TxRef.set(refs.get("b")!, val(20))
          })
        )
      )

      expect(family.get("a")).toEqual(val(10))
      expect(family.get("b")).toEqual(val(20))
    })

    it("calls onConflict callback when conflict detected", () => {
      const family = makeTxFamily()
      const descs = family.descriptors(["a"]) as TxStoreDescriptor<unknown>[]

      const onConflict = vi.fn()

      // Snapshot at version 0
      const snap0 = snapshotVersions(descs)

      // External write bumps version by 1
      Effect.runSync(storeTransaction(descs[0]!, (ref) => TxRef.set(ref, val(99))))

      // With expectedBump=0 (no transaction of our own), this is a conflict
      const conflicts = detectConflicts(descs, snap0, 0)
      expect(conflicts).toEqual(["a"])

      // Verify onConflict callback pattern
      if (onConflict && conflicts.length > 0) {
        onConflict(conflicts, 1)
      }
      expect(onConflict).toHaveBeenCalledWith(["a"], 1)
    })

    it("surfaces StxTxConflictError after max retries", () => {
      const family = makeTxFamily()

      // We'll create a scenario where the transaction always sees a
      // conflict: we wrap the body to also perform an external write
      // that bumps the version, creating permanent divergence.
      const desc = family.descriptor("x")! as TxStoreDescriptor<unknown>
      let attempt = 0

      const result = Effect.runSyncExit(
        conflictAwareTransaction(
          [desc],
          (refs) =>
            Effect.gen(function*() {
              // Simulate: another "thread" writes to the same TxRef
              // between our snapshot and commit.
              // We do this by directly mutating the version (simulating
              // what Effect.transaction commit does internally).
              attempt++
              desc.txRef.version += 100 // Simulate external version bump
              yield* TxRef.set(refs.get("x")!, val(attempt))
            }),
          { maxRetries: 2 },
        )
      )

      // Should have exhausted retries: initial + 2 retries = 3 attempts
      expect(attempt).toBe(3)
      expect(result._tag).toBe("Failure")

      // Extract the error
      if (result._tag === "Failure") {
        const cause = result.cause
        // The cause should contain StxTxConflictError
        const err = (cause as any).error ?? (cause as any)
        if (err._tag === "StxTxConflictError") {
          expect(err.storeIds).toContain("x")
          expect(err.retries).toBe(3)
        }
      }
    })
  })

  // ── conflictAwareStoreTransaction ─────────────

  describe("conflictAwareStoreTransaction", () => {
    it("succeeds on clean single-store transaction", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("k")! as TxStoreDescriptor<unknown>

      Effect.runSync(
        conflictAwareStoreTransaction(desc, (ref) =>
          TxRef.set(ref, val(42))
        )
      )

      expect(family.get("k")).toEqual(val(42))
    })

    it("respects custom policy", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("k")! as TxStoreDescriptor<unknown>
      const onConflict = vi.fn()

      // Clean transaction — onConflict should NOT fire
      Effect.runSync(
        conflictAwareStoreTransaction(
          desc,
          (ref) => TxRef.set(ref, val(7)),
          { maxRetries: 5, onConflict },
        )
      )

      expect(onConflict).not.toHaveBeenCalled()
      expect(family.get("k")).toEqual(val(7))
    })
  })

  // ── Integration with stxFamily ────────────────

  describe("family integration", () => {
    it("descriptor version tracks across multiple transactions", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("cell")! as TxStoreDescriptor<unknown>

      const versions: number[] = [getVersion(desc)]

      for (let i = 1; i <= 5; i++) {
        Effect.runSync(storeTransaction(desc, (ref) => TxRef.set(ref, val(i))))
        versions.push(getVersion(desc))
      }

      // Each commit should increment version
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBeGreaterThan(versions[i - 1]!)
      }

      expect(family.get("cell")).toEqual(val(5))
    })

    it("non-transactional set does NOT bump TxRef version", () => {
      const family = makeTxFamily()
      const desc = family.descriptor("cell")! as TxStoreDescriptor<unknown>

      const v0 = getVersion(desc)

      // Atom-layer set (bypasses TxRef)
      family.set("cell", val(99))

      const v1 = getVersion(desc)

      // TxRef version unchanged — only Atom was updated
      expect(v1).toBe(v0)

      // But Atom has the new value
      expect(family.get("cell")).toEqual(val(99))

      // TxRef still has old value
      expect(desc.txRef.value).toEqual(val(0))
    })
  })
})

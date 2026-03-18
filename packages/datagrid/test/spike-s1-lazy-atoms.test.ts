/**
 * SPIKE S1 — Lazy Cell Atoms
 *
 * Prove STX can back millions of cells without millions of atoms.
 * Lazy hydration via Map + WeakRef + FinalizationRegistry.
 *
 * H1: 100K cells in backing store, 100 subscribed → 100 live atoms
 * H2: Unsubscribe → atoms eligible for GC
 * H3: External write → invalidated atom reflects new value
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "@tmnl/stx"
import {
  type CellValue,
  num, str, empty, extractNumber,
  cellKey, type ColRow,
} from "../src/index.js"

// ─── Minimal CellCache (spike-only, not the real service) ────

class SpikeCellCache {
  private backing: Map<string, CellValue> = new Map()
  private cache: Map<string, WeakRef<Atom.Writable<CellValue>>> = new Map()
  private gcRegistry: FinalizationRegistry<string>
  private _gcCount = 0

  constructor() {
    this.gcRegistry = new FinalizationRegistry<string>((key) => {
      this.cache.delete(key)
      this._gcCount++
    })
  }

  /** Seed backing store (simulates SQLite) */
  seed(addr: ColRow, value: CellValue): void {
    this.backing.set(cellKey("test", addr), value)
  }

  /** Bulk seed */
  seedBulk(count: number, factory: (i: number) => [ColRow, CellValue]): void {
    for (let i = 0; i < count; i++) {
      const [addr, value] = factory(i)
      this.backing.set(cellKey("test", addr), value)
    }
  }

  /** Get or hydrate an atom for a cell */
  get(addr: ColRow): Atom.Writable<CellValue> {
    const key = cellKey("test", addr)
    const existing = this.cache.get(key)?.deref()
    if (existing) return existing

    // Hydrate from backing store
    const value = this.backing.get(key) ?? empty()
    const atom = Atom.make<CellValue>(value)
    this.cache.set(key, new WeakRef(atom))
    this.gcRegistry.register(atom, key)
    return atom
  }

  /** Invalidate: re-read from backing store */
  invalidate(registry: AtomRegistry, addr: ColRow): void {
    const key = cellKey("test", addr)
    const ref = this.cache.get(key)?.deref()
    if (ref) {
      const value = this.backing.get(key) ?? empty()
      registry.set(ref, value)
    }
  }

  /** Simulate external write (e.g., CRDT merge) */
  externalWrite(addr: ColRow, value: CellValue): void {
    this.backing.set(cellKey("test", addr), value)
  }

  get activeCount(): number {
    let count = 0
    for (const [, ref] of this.cache) {
      if (ref.deref()) count++
    }
    return count
  }

  get backingCount(): number {
    return this.backing.size
  }

  get gcCount(): number {
    return this._gcCount
  }
}

// ─── Tests ──────────────────────────────────────────

describe("S1: Lazy Cell Atoms", () => {

  it("H1: 100K backing cells, 100 subscribed → exactly 100 live atoms", () => {
    const cache = new SpikeCellCache()
    const registry = AtomRegistry.make()

    // Seed 100K cells in backing store
    cache.seedBulk(100_000, (i) => [
      { col: i % 100, row: Math.floor(i / 100) },
      num(i * 1.5),
    ])
    expect(cache.backingCount).toBe(100_000)
    expect(cache.activeCount).toBe(0) // No atoms yet

    // Subscribe to 100 cells
    const atoms: Atom.Writable<CellValue>[] = []
    for (let i = 0; i < 100; i++) {
      const atom = cache.get({ col: i, row: 0 })
      atoms.push(atom)
      // Read to keep reference alive
      registry.get(atom)
    }

    expect(cache.activeCount).toBe(100)
  })

  it("H1-perf: hydration throughput — 10K atom creates in < 50ms", () => {
    const cache = new SpikeCellCache()
    const registry = AtomRegistry.make()

    cache.seedBulk(10_000, (i) => [
      { col: i % 100, row: Math.floor(i / 100) },
      num(i),
    ])

    const start = performance.now()
    const atoms: Atom.Writable<CellValue>[] = []
    for (let i = 0; i < 10_000; i++) {
      const atom = cache.get({ col: i % 100, row: Math.floor(i / 100) })
      atoms.push(atom)
      registry.get(atom)
    }
    const elapsed = performance.now() - start

    expect(atoms.length).toBe(10_000)
    console.log(`  S1/H1-perf: 10K atom hydrations in ${elapsed.toFixed(2)}ms (${(10_000 / elapsed * 1000).toFixed(0)} hydrations/sec)`)
    expect(elapsed).toBeLessThan(50)
  })

  it("H2: cache deduplication — same address returns same atom", () => {
    const cache = new SpikeCellCache()
    const registry = AtomRegistry.make()

    cache.seed({ col: 0, row: 0 }, num(42))

    const atom1 = cache.get({ col: 0, row: 0 })
    const atom2 = cache.get({ col: 0, row: 0 })

    expect(atom1).toBe(atom2) // Same reference
    expect(registry.get(atom1)).toEqual(num(42))
  })

  it("H3: external write → invalidation → atom reflects new value", () => {
    const cache = new SpikeCellCache()
    const registry = AtomRegistry.make()

    cache.seed({ col: 0, row: 0 }, num(42))
    const atom = cache.get({ col: 0, row: 0 })
    expect(registry.get(atom)).toEqual(num(42))

    // External write (simulates CRDT merge or bulk import)
    cache.externalWrite({ col: 0, row: 0 }, str("updated"))
    cache.invalidate(registry, { col: 0, row: 0 })

    expect(registry.get(atom)).toEqual(str("updated"))
  })

  it("H3-perf: invalidation throughput — 10K invalidations in < 20ms", () => {
    const cache = new SpikeCellCache()
    const registry = AtomRegistry.make()

    cache.seedBulk(10_000, (i) => [
      { col: i % 100, row: Math.floor(i / 100) },
      num(i),
    ])

    // Hydrate all
    for (let i = 0; i < 10_000; i++) {
      const atom = cache.get({ col: i % 100, row: Math.floor(i / 100) })
      registry.get(atom)
    }

    // External write all
    for (let i = 0; i < 10_000; i++) {
      cache.externalWrite(
        { col: i % 100, row: Math.floor(i / 100) },
        num(i * 2),
      )
    }

    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      cache.invalidate(registry, { col: i % 100, row: Math.floor(i / 100) })
    }
    const elapsed = performance.now() - start

    console.log(`  S1/H3-perf: 10K invalidations in ${elapsed.toFixed(2)}ms (${(10_000 / elapsed * 1000).toFixed(0)} invalidations/sec)`)
    expect(elapsed).toBeLessThan(20)

    // Verify correctness
    const val = registry.get(cache.get({ col: 50, row: 0 }))
    expect(extractNumber(val)).toBe(100) // 50 * 2
  })

  it("atom read throughput — 100K reads in < 10ms", () => {
    const cache = new SpikeCellCache()
    const registry = AtomRegistry.make()

    cache.seedBulk(1000, (i) => [
      { col: i % 100, row: Math.floor(i / 100) },
      num(i),
    ])

    // Hydrate 1000 atoms
    const atoms: Atom.Writable<CellValue>[] = []
    for (let i = 0; i < 1000; i++) {
      atoms.push(cache.get({ col: i % 100, row: Math.floor(i / 100) }))
    }

    // Read each atom 100x (100K total reads)
    const start = performance.now()
    let sum = 0
    for (let round = 0; round < 100; round++) {
      for (const atom of atoms) {
        sum += extractNumber(registry.get(atom))
      }
    }
    const elapsed = performance.now() - start

    console.log(`  S1/read-perf: 100K atom reads in ${elapsed.toFixed(2)}ms (${(100_000 / elapsed * 1000).toFixed(0)} reads/sec)`)
    expect(elapsed).toBeLessThan(10)
    expect(sum).toBeGreaterThan(0)
  })
})

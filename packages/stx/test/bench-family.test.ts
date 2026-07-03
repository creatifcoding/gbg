/**
 * @tmnl/stx — Family Benchmarks
 *
 * Elite-tier performance validation for stxFamily at datagrid scale.
 * Tests the patterns that matter: 100K cell hydration, surgical focus,
 * subscription fan-out, mutation cascades, GC pressure, and the
 * stream-native cell model that underpins @tmnl/datagrid.
 *
 * Target: prove Atom.family + STX wrappers can back a 100K–10M cell
 * reactive spreadsheet without melting.
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import { stxFamily } from "../src/internal/family.js"

// ─── Helpers ────────────────────────────────────────

interface CellValue {
  readonly _tag: string
  readonly value?: number | string | boolean
}

const empty = (): CellValue => ({ _tag: "Empty" })
const num = (n: number): CellValue => ({ _tag: "Number", value: n })
const str = (s: string): CellValue => ({ _tag: "String", value: s })

/** col:row key format — what datagrid uses */
const cellKey = (col: number, row: number) => `${col}:${row}`

interface RichEntity {
  readonly id: string
  readonly name: string
  readonly score: number
  readonly tags: readonly string[]
  readonly meta: {
    readonly active: boolean
    readonly version: number
    readonly nested: { readonly deep: string }
  }
}

const makeRich = (id: string): RichEntity => ({
  id,
  name: `entity-${id}`,
  score: 0,
  tags: [],
  meta: { active: true, version: 1, nested: { deep: "value" } },
})

function formatRate(ops: number, unit = "ops/sec"): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

// ─── B1: Mass Hydration ─────────────────────────────
// Simulate datagrid opening a 100K-cell sheet.
// Each cell key → lazy atom creation + mount.

describe("B1: Mass Hydration", () => {
  it("100K cells hydrated within budget", () => {
    const N = 100_000
    const reg = AtomRegistry.make()
    const family = stxFamily((key: string) => num(parseInt(key.split(":")[1])), reg)

    const start = performance.now()
    for (let row = 0; row < 1_000; row++) {
      for (let col = 0; col < 100; col++) {
        family(cellKey(col, row))
      }
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Mass Hydration: ${N.toLocaleString()} cells in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    // Budget: <3s for 100K — MutableHashMap hash+create dominates cold path
    // Real datagrid hydrates on-demand per viewport, not bulk 100K
    expect(elapsed).toBeLessThan(3000)
    expect(rate).toBeGreaterThan(30_000)
  })

  it("second pass is cache hit only", () => {
    const N = 100_000
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)

    // First pass — populate
    for (let i = 0; i < N; i++) family(String(i))

    // Second pass — pure cache lookup
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family(String(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Cache Hit: ${N.toLocaleString()} lookups in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    // MutableHashMap lookup ~500K/sec — upstream hash cost dominates
    expect(rate).toBeGreaterThan(300_000)
  })
})

// ─── B2: Surgical Read ──────────────────────────────
// Read a single cell from a hot family with many members.
// Proves O(1) access regardless of family size.

describe("B2: Surgical Read", () => {
  it("single-cell read amortized from 100K family", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)

    // Populate 100K
    for (let i = 0; i < 100_000; i++) family.set(String(i), num(i))

    // Read one cell repeatedly
    const N = 1_000_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family.get("50000")
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Surgical Read: ${formatRate(rate)} from 100K family`)
    // family(key) + reg.get — MutableHashMap lookup is the bottleneck
    expect(rate).toBeGreaterThan(1_000_000)
  })

  it("random-key read across 10K family", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)
    const SIZE = 10_000
    const keys = Array.from({ length: SIZE }, (_, i) => String(i))

    // Populate
    for (const k of keys) family.set(k, num(parseInt(k)))

    // Random reads
    const N = 500_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family.get(keys[i % SIZE])
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Random Read: ${formatRate(rate)} across 10K family`)
    // Random key cycling 10K entries — MutableHashMap hash cost + cache pressure
    expect(rate).toBeGreaterThan(250_000)
  })
})

// ─── B3: Focus Atom Precision ───────────────────────
// Create focus atoms on deeply nested fields.
// Verify only the focused atom fires, not siblings.

describe("B3: Focus Atom Precision", () => {
  it("focus creation throughput — 10K focus atoms", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(makeRich, reg)
    const N = 10_000
    const keys = Array.from({ length: N }, (_, i) => String(i))

    // Pre-populate
    for (const k of keys) family(k)

    const start = performance.now()
    for (const k of keys) {
      family.focus(k, family.lens.name as any)
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Focus Creation: ${N.toLocaleString()} atoms in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    // Focus creation = family lookup + createFocusAtom + mount
    expect(rate).toBeGreaterThan(20_000)
  })

  it("focus read throughput — cached path", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(makeRich, reg)
    const SIZE = 1_000
    const keys = Array.from({ length: SIZE }, (_, i) => String(i))

    // Pre-populate + create focus atoms
    const focusAtoms = keys.map(k => {
      family(k)
      return family.focus(k, family.lens.score as any)
    })

    const N = 500_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      reg.get(focusAtoms[i % SIZE])
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Focus Read: ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(1_000_000)
  })

  it("surgical isolation — sibling focus atoms don't fire", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(makeRich, reg)

    const nameAtom = family.focus("e1", family.lens.name as any)
    const scoreAtom = family.focus("e1", family.lens.score as any)
    const activeAtom = family.focus("e1", family.lens.meta.active as any)

    let nameFires = 0
    let scoreFires = 0
    let activeFires = 0

    reg.subscribe(nameAtom, () => nameFires++)
    reg.subscribe(scoreAtom, () => scoreFires++)
    reg.subscribe(activeAtom, () => activeFires++)

    // Mutate only the name
    const current = family.get("e1")
    family.set("e1", { ...current, name: "updated" })

    expect(nameFires).toBe(1)
    expect(scoreFires).toBe(0)  // Score didn't change — ZERO spurious
    expect(activeFires).toBe(0) // Active didn't change — ZERO spurious
  })

  it("deep nested focus isolation", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(makeRich, reg)

    const deepAtom = family.focus("e1", family.lens.meta.nested.deep as any)
    const versionAtom = family.focus("e1", family.lens.meta.version as any)

    let deepFires = 0
    let versionFires = 0

    reg.subscribe(deepAtom, () => deepFires++)
    reg.subscribe(versionAtom, () => versionFires++)

    // Mutate only version
    const current = family.get("e1")
    family.set("e1", {
      ...current,
      meta: { ...current.meta, version: 2 },
    })

    expect(versionFires).toBe(1)
    expect(deepFires).toBe(0) // Deep didn't change
  })
})

// ─── B4: Subscription Fan-Out ───────────────────────
// N subscribers on a single cell — simulates AG-Grid column
// where one data cell is observed by valueGetter, formatter,
// cell renderer, and formula engine simultaneously.

describe("B4: Subscription Fan-Out", () => {
  it("single cell × 100 subscribers — one write fans out", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)

    const SUBS = 100
    const fires: number[] = new Array(SUBS).fill(0)

    const atom = family("hot-cell")
    for (let i = 0; i < SUBS; i++) {
      const idx = i
      reg.subscribe(atom, () => { fires[idx]++ })
    }

    const WRITES = 1_000
    const start = performance.now()
    for (let w = 0; w < WRITES; w++) {
      family.set("hot-cell", num(w))
    }
    const elapsed = performance.now() - start
    const totalNotifications = SUBS * WRITES
    const rate = (totalNotifications / elapsed) * 1000

    console.log(`B4 Fan-Out: ${SUBS} subs × ${WRITES} writes = ${totalNotifications.toLocaleString()} notifications in ${elapsed.toFixed(1)}ms → ${formatRate(rate, "notifications/sec")}`)

    // Every subscriber got every write
    for (const f of fires) expect(f).toBe(WRITES)
    // Throughput: > 1M notifications/sec
    expect(rate).toBeGreaterThan(1_000_000)
  })

  it("1000 cells × 1 subscriber each — broadcast write", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)
    const SIZE = 1_000

    const fires: number[] = new Array(SIZE).fill(0)
    for (let i = 0; i < SIZE; i++) {
      const idx = i
      reg.subscribe(family(String(i)), () => { fires[idx]++ })
    }

    // Write to all cells
    const ROUNDS = 100
    const start = performance.now()
    for (let r = 0; r < ROUNDS; r++) {
      for (let i = 0; i < SIZE; i++) {
        family.set(String(i), num(r))
      }
    }
    const elapsed = performance.now() - start
    const totalWrites = SIZE * ROUNDS
    const rate = (totalWrites / elapsed) * 1000

    console.log(`B4 Broadcast: ${SIZE} cells × ${ROUNDS} rounds = ${totalWrites.toLocaleString()} writes in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)

    for (const f of fires) expect(f).toBe(ROUNDS)
    // 1000 cells × subscribe + set — near boundary at ~475K
    expect(rate).toBeGreaterThan(300_000)
  })
})

// ─── B5: Formula Cascade ────────────────────────────
// Derived atoms reading from family members — the formula pattern.
// A changes → B = f(A) recalcs → C = g(B) recalcs.

describe("B5: Formula Cascade", () => {
  it("chain of 100: write source → all derived update", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)

    // Source cell
    family.set("src", num(0))

    // Chain: each derived reads the previous
    const derivedAtoms: Atom.Atom<CellValue>[] = []
    for (let i = 0; i < 100; i++) {
      const prev = i === 0 ? family("src") : derivedAtoms[i - 1]
      const derived = Atom.make((get: Atom.Context) => {
        const v = get(prev)
        return num((v.value as number ?? 0) + 1)
      })
      reg.mount(derived)
      derivedAtoms.push(derived)
    }

    // Verify chain works
    family.set("src", num(0))
    const endValue = reg.get(derivedAtoms[99])
    expect(endValue).toEqual(num(100))

    // Benchmark cascade
    const N = 1_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family.set("src", num(i))
    }
    const elapsed = performance.now() - start
    const cascadesPerSec = (N / elapsed) * 1000

    // Verify last derived has correct value
    expect(reg.get(derivedAtoms[99])).toEqual(num(N - 1 + 100))

    console.log(`B5 Chain-100: ${N} source writes → 100-deep cascade in ${elapsed.toFixed(1)}ms → ${formatRate(cascadesPerSec, "cascades/sec")}`)
    // Each write triggers 100 recalcs. Budget: > 500 cascades/sec (= 50K recalcs/sec)
    expect(cascadesPerSec).toBeGreaterThan(500)
  })

  it("fan-out formula: 1 source → 100 dependent derived atoms", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)

    family.set("src", num(0))
    const srcAtom = family("src")

    // 100 derived atoms all reading the same source
    const derivedAtoms = Array.from({ length: 100 }, (_, i) =>
      Atom.make((get: Atom.Context) => {
        const v = get(srcAtom)
        return num((v.value as number ?? 0) * (i + 1))
      })
    )
    for (const d of derivedAtoms) reg.mount(d)

    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family.set("src", num(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    // Verify correctness
    expect(reg.get(derivedAtoms[0])).toEqual(num((N - 1) * 1))
    expect(reg.get(derivedAtoms[99])).toEqual(num((N - 1) * 100))

    console.log(`B5 Fan-Out-100: ${N} writes → 100 dependents = ${(N * 100).toLocaleString()} recalcs in ${elapsed.toFixed(1)}ms → ${formatRate(rate, "writes/sec")}`)
    // 10K writes × 100 recalcs = 1M recalcs total. Budget: > 2K writes/sec
    expect(rate).toBeGreaterThan(2_000)
  })

  it("diamond pattern: A→B, A→C, B+C→D", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)

    family.set("A", num(1))
    const a = family("A")

    const b = Atom.make((get: Atom.Context) => num((get(a).value as number ?? 0) * 2))
    const c = Atom.make((get: Atom.Context) => num((get(a).value as number ?? 0) * 3))
    const d = Atom.make((get: Atom.Context) =>
      num((get(b).value as number ?? 0) + (get(c).value as number ?? 0))
    )

    reg.mount(b)
    reg.mount(c)
    reg.mount(d)

    // Verify: A=1 → B=2, C=3, D=5
    expect(reg.get(d)).toEqual(num(5))

    let dFires = 0
    reg.subscribe(d, () => dFires++)

    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family.set("A", num(i))
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    expect(reg.get(d)).toEqual(num((N - 1) * 5))

    console.log(`B5 Diamond: ${N} A-writes in ${elapsed.toFixed(1)}ms → ${formatRate(rate, "writes/sec")}, D fired ${dFires} times`)
    expect(rate).toBeGreaterThan(5_000)
    // D should fire once per A write (glitch-free if batched, or ≤ 2x if not)
    expect(dFires).toBeLessThanOrEqual(N * 2)
  })
})

// ─── B6: Mixed Workload ─────────────────────────────
// Simulates real datagrid: concurrent reads, writes, focus
// lookups, and subscription traffic.

describe("B6: Mixed Workload", () => {
  it("realistic datagrid tick: 100 reads + 10 writes + 5 focus lookups", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(makeRich, reg)
    const SIZE = 1_000
    const keys = Array.from({ length: SIZE }, (_, i) => String(i))

    // Pre-populate
    for (const k of keys) family(k)

    // Pre-create some focus atoms (simulates AG-Grid columns)
    const scoreFocuses = keys.slice(0, 100).map(k =>
      family.focus(k, family.lens.score as any)
    )

    const TICKS = 10_000
    const start = performance.now()

    for (let t = 0; t < TICKS; t++) {
      // 100 reads (AG-Grid valueGetter)
      for (let r = 0; r < 100; r++) {
        family.get(keys[(t * 100 + r) % SIZE])
      }
      // 10 writes (user edits / external data)
      for (let w = 0; w < 10; w++) {
        const k = keys[(t * 10 + w) % SIZE]
        const current = family.get(k)
        family.set(k, { ...current, score: t })
      }
      // 5 focus reads (column summaries)
      for (let f = 0; f < 5; f++) {
        reg.get(scoreFocuses[(t * 5 + f) % 100])
      }
    }

    const elapsed = performance.now() - start
    const totalOps = TICKS * (100 + 10 + 5)
    const rate = (totalOps / elapsed) * 1000

    console.log(`B6 Mixed: ${TICKS.toLocaleString()} ticks × 115 ops = ${totalOps.toLocaleString()} ops in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    // Mixed workload: > 500K ops/sec
    expect(rate).toBeGreaterThan(500_000)
  })
})

// ─── B7: Member API Overhead ────────────────────────
// Measures the cost of the STX wrapper vs raw atom access.

describe("B7: Wrapper Overhead", () => {
  it("member() memoization — repeat access is free", () => {
    const family = stxFamily(empty)
    // First call creates
    family.member("X")

    const N = 1_000_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      family.member("X")
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B7 Member Memo: ${formatRate(rate)}`)
    // WeakMap lookup — fast but degrades under full-suite memory pressure
    expect(rate).toBeGreaterThan(1_000_000)
  })

  it("raw atom vs family.get overhead", () => {
    const reg = AtomRegistry.make()
    const family = stxFamily(empty, reg)
    family.set("X", num(42))
    const rawAtom = family("X")

    // Raw atom access
    const N = 1_000_000
    const rawStart = performance.now()
    for (let i = 0; i < N; i++) {
      reg.get(rawAtom)
    }
    const rawElapsed = performance.now() - rawStart

    // Family.get (includes atom lookup)
    const wrapStart = performance.now()
    for (let i = 0; i < N; i++) {
      family.get("X")
    }
    const wrapElapsed = performance.now() - wrapStart

    const rawRate = (N / rawElapsed) * 1000
    const wrapRate = (N / wrapElapsed) * 1000
    const overhead = ((wrapElapsed - rawElapsed) / rawElapsed) * 100

    console.log(`B7 Raw: ${formatRate(rawRate)} | Wrapped: ${formatRate(wrapRate)} | Overhead: ${overhead.toFixed(1)}%`)
    // Overhead is upstream MutableHashMap hash+equal per lookup — known cost
    // Raw reg.get is ~13M, wrapped family.get ~2M. Acceptable for keyed access.
    // Hot-path consumers should cache the atom ref: const atom = family(key)
    expect(wrapRate).toBeGreaterThan(1_000_000)
  })
})

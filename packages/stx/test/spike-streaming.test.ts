/**
 * STX v2 Spike — Streaming Integration
 *
 * Tests Atom.make(Effect), Atom.make(Stream), Atom.pull(Stream)
 * with autoLens + focus atoms.
 *
 * Throughput benchmarks: how fast can we push stream values through
 * the Atom → AsyncResult → focus atom pipeline?
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as AsyncResult from "effect-v4/unstable/reactivity/AsyncResult"
import * as Effect from "effect-v4/Effect"
import * as Stream from "effect-v4/Stream"
import * as Chunk from "effect-v4/Chunk"
import { autoLens, fromEffect, fromStream, fromPull } from "../src/index.js"

// ─── SPIKE 1: Atom.make(Effect) basics ──────────────

describe("Atom.make(Effect) — async result lifecycle", () => {
  it("sync effect resolves immediately", () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make(Effect.succeed({ name: "Alice", level: 42 }))
    registry.mount(atom)

    const result = registry.get(atom)
    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toEqual({ name: "Alice", level: 42 })
    }
  })

  it("focus on AsyncResult success value via derived atom", () => {
    const registry = AtomRegistry.make()
    type User = { name: string; level: number }
    const atom = Atom.make(Effect.succeed<User>({ name: "Alice", level: 42 }))
    registry.mount(atom)

    const lens = autoLens<User>()

    // Derived atom: unwrap AsyncResult → get name
    const nameAtom = Atom.make<string | undefined>((get) => {
      const result = get(atom)
      if (result._tag === "Success") return lens.name.get(result.value)
      return undefined
    })
    registry.mount(nameAtom)

    expect(registry.get(nameAtom)).toBe("Alice")
  })
})

// ─── SPIKE 2: Atom.make(Stream) — latest value ─────

describe("Atom.make(Stream) — latest value tracking", () => {
  it("stream of values → atom tracks latest", () => {
    const registry = AtomRegistry.make()

    // Finite stream of 3 items — should resolve to last
    const stream = Stream.fromIterable([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ])

    const atom = Atom.make(stream)
    registry.mount(atom)

    const result = registry.get(atom)
    // Stream completes synchronously → should have latest value
    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toEqual({ x: 3, y: 30 })
    }
  })
})

// ─── SPIKE 3: Atom.pull — accumulation ──────────────

describe("Atom.pull — pull-based accumulation", () => {
  it("pull accumulates chunks", () => {
    const registry = AtomRegistry.make()

    const stream = Stream.fromIterable([1, 2, 3, 4, 5, 6]).pipe(
      Stream.grouped(2), // chunks of 2
    )

    const pullAtom = Atom.pull(stream)
    registry.mount(pullAtom)

    // First pull
    registry.set(pullAtom, undefined as any)
    let result = registry.get(pullAtom)

    if (result._tag === "Success") {
      expect(result.value.items.length).toBeGreaterThanOrEqual(1)
    }
  })
})

// ─── SPIKE 4: fromEffect integration ───────────────

describe("fromEffect — STX async wrapper", () => {
  it("creates StxAsync with lens + focus + value atoms", () => {
    const registry = AtomRegistry.make()
    type State = { users: Array<{ id: string; name: string }>; total: number }

    const stxA = fromEffect(
      Effect.succeed<State>({
        users: [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }],
        total: 2,
      }),
      registry,
    )

    // value atom unwraps AsyncResult
    expect(registry.get(stxA.value)).toEqual({
      users: [{ id: "1", name: "Alice" }, { id: "2", name: "Bob" }],
      total: 2,
    })

    // loading should be false (resolved)
    expect(registry.get(stxA.loading)).toBe(false)

    // focus on total
    const totalAtom = stxA.focus(stxA.lens.total)
    expect(registry.get(totalAtom)).toBe(2)
  })

  it("focus atoms are surgical on AsyncResult success value", () => {
    const registry = AtomRegistry.make()
    type S = { a: number; b: string; c: { d: number } }

    const stxA = fromEffect(Effect.succeed<S>({ a: 1, b: "hello", c: { d: 42 } }), registry)

    const aAtom = stxA.focus(stxA.lens.a)
    const bAtom = stxA.focus(stxA.lens.b)
    const dAtom = stxA.focus(stxA.lens.c.d)

    expect(registry.get(aAtom)).toBe(1)
    expect(registry.get(bAtom)).toBe("hello")
    expect(registry.get(dAtom)).toBe(42)
  })

  it("focus atoms memoized", () => {
    const registry = AtomRegistry.make()
    const stxA = fromEffect(Effect.succeed({ x: 1 }), registry)

    const a1 = stxA.focus(stxA.lens.x)
    const a2 = stxA.focus(stxA.lens.x)
    expect(a1).toBe(a2)
  })
})

// ─── SPIKE 5: fromStream integration ───────────────

describe("fromStream — STX stream wrapper", () => {
  it("tracks latest value from stream with focus", () => {
    const registry = AtomRegistry.make()
    type Tick = { price: number; volume: number; ts: number }

    const stxS = fromStream(
      Stream.fromIterable<Tick>([
        { price: 100, volume: 50, ts: 1 },
        { price: 101, volume: 30, ts: 2 },
        { price: 99, volume: 80, ts: 3 },
      ]),
      registry,
    )

    const priceAtom = stxS.focus(stxS.lens.price)
    const volAtom = stxS.focus(stxS.lens.volume)

    // Latest value from stream
    expect(registry.get(priceAtom)).toBe(99)
    expect(registry.get(volAtom)).toBe(80)
  })
})

// ─── SPIKE 6: fromPull integration ─────────────────

describe("fromPull — STX pull wrapper", () => {
  it("creates pull-based instance with items/done/loading atoms", () => {
    const registry = AtomRegistry.make()

    const stxP = fromPull(
      Stream.fromIterable([10, 20, 30, 40, 50]).pipe(Stream.grouped(2)),
      registry,
    )

    // Initial state
    const initialItems = registry.get(stxP.items)
    // Should be empty or have first chunk depending on eager evaluation
    expect(Array.isArray(initialItems)).toBe(true)

    // Pull
    stxP.pull()
    const items = registry.get(stxP.items)
    expect(items.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── BENCH: Throughput — stream → focus atom pipeline ─

describe("BENCH: Streaming throughput", () => {
  it("10k synchronous stream items → focus atom notification count", () => {
    const registry = AtomRegistry.make()
    const N = 10_000

    type Tick = { value: number; label: string }

    const items = Array.from({ length: N }, (_, i) => ({
      value: i,
      label: `tick-${i}`,
    }))

    const stream = Stream.fromIterable(items)

    // Atom.make(stream) tracks LATEST value
    const atom = Atom.make(stream)
    registry.mount(atom)

    // Focus on just the value field
    const lens = autoLens<Tick>()
    const valueAtom = Atom.make<number | undefined>((get) => {
      const result = get(atom)
      if (result._tag === "Success") return lens.value.get(result.value)
      return undefined
    })
    registry.mount(valueAtom)

    let notifs = 0
    registry.subscribe(valueAtom, () => { notifs++ })
    notifs = 0

    // The stream already completed synchronously.
    // Check final value is N-1 (last item)
    const finalValue = registry.get(valueAtom)
    expect(finalValue).toBe(N - 1)

    console.log(`\n  Stream throughput: ${N} items → ${notifs} focus notifications`)
    console.log(`  Final value: ${finalValue}`)
  })

  it("raw Atom.make update throughput with AsyncResult wrapping", () => {
    const registry = AtomRegistry.make()
    const N = 10_000

    type S = { x: number; y: number }

    // Simulate "streaming" by repeatedly setting a writable atom
    const atom = Atom.make<AsyncResult.AsyncResult<S, never>>(
      AsyncResult.success({ x: 0, y: 0 })
    )
    registry.mount(atom)

    const lens = autoLens<S>()
    const xAtom = Atom.make<number | undefined>((get) => {
      const result = get(atom)
      if (result._tag === "Success") return lens.x.get(result.value)
      return undefined
    })
    const yAtom = Atom.make<number | undefined>((get) => {
      const result = get(atom)
      if (result._tag === "Success") return lens.y.get(result.value)
      return undefined
    })

    registry.mount(xAtom)
    registry.mount(yAtom)

    let xN = 0, yN = 0
    registry.subscribe(xAtom, () => { xN++ })
    registry.subscribe(yAtom, () => { yN++ })
    xN = 0; yN = 0

    const start = performance.now()

    // Update only x, 10k times
    for (let i = 0; i < N; i++) {
      registry.set(atom, AsyncResult.success({ x: i + 1, y: 0 }))
    }

    const elapsed = performance.now() - start
    const opsPerSec = Math.floor(N / (elapsed / 1000))

    console.log(`\n  AsyncResult update throughput: ${N} updates in ${elapsed.toFixed(1)}ms (${opsPerSec.toLocaleString()} ops/sec)`)
    console.log(`  x notifications: ${xN}, y notifications: ${yN}`)

    // x should fire N times (each update changes x)
    expect(xN).toBe(N)
    // y should fire 0 times (value stays 0)
    expect(yN).toBe(0)
  })

  it("fromEffect + focus throughput: simulated refetch cycle", () => {
    const registry = AtomRegistry.make()
    const CYCLES = 1000

    type State = { count: number; status: string; data: { value: number } }

    const atom = Atom.make<AsyncResult.AsyncResult<State, never>>(
      AsyncResult.success({ count: 0, status: "idle", data: { value: 0 } })
    )
    registry.mount(atom)

    const lens = autoLens<State>()
    const countAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.count.get(r.value) : undefined
    })
    const statusAtom = Atom.make<string | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.status.get(r.value) : undefined
    })
    const dataValueAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.data.value.get(r.value) : undefined
    })

    registry.mount(countAtom)
    registry.mount(statusAtom)
    registry.mount(dataValueAtom)

    let countN = 0, statusN = 0, dataValueN = 0
    registry.subscribe(countAtom, () => { countN++ })
    registry.subscribe(statusAtom, () => { statusN++ })
    registry.subscribe(dataValueAtom, () => { dataValueN++ })
    countN = 0; statusN = 0; dataValueN = 0

    const start = performance.now()

    // Simulate refetch cycles: update count+data, keep status same
    for (let i = 0; i < CYCLES; i++) {
      registry.set(atom, AsyncResult.success({
        count: i + 1,
        status: "idle",     // never changes
        data: { value: i * 10 },
      }))
    }

    const elapsed = performance.now() - start
    const opsPerSec = Math.floor(CYCLES / (elapsed / 1000))

    console.log(`\n  Refetch cycle throughput: ${CYCLES} cycles in ${elapsed.toFixed(1)}ms (${opsPerSec.toLocaleString()} ops/sec)`)
    console.log(`  count: ${countN}, status: ${statusN}, dataValue: ${dataValueN}`)

    expect(countN).toBe(CYCLES)
    expect(statusN).toBe(0)         // never changed
    // First cycle: data.value = 0*10 = 0 (same as initial) → Object.is skip
    expect(dataValueN).toBe(CYCLES - 1)
  })
})

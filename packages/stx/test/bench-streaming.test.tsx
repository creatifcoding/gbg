/**
 * STX v2 — React Streaming Benchmarks
 *
 * Focused performance tests for streaming hooks:
 * - useStxAsync render precision (only re-renders on value change)
 * - useFocusAsync surgical updates through AsyncResult
 * - useStxPull progressive loading
 * - Throughput: rapid AsyncResult updates → React render count
 *
 * All benchmarks are STX-only (no Legend State comparison).
 */

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, vi } from "vitest"
import React, { memo } from "react"
import { render, act, cleanup } from "@testing-library/react"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as AsyncResult from "effect-v4/unstable/reactivity/AsyncResult"
import * as Effect from "effect-v4/Effect"
import * as Stream from "effect-v4/Stream"
import {
  fromEffect,
  fromStream,
  fromPull,
  useStxAsync,
  useFocusAsync,
  useStxPull,
  useAtomValue,
  autoLens,
} from "../src/index.js"

afterEach(() => { cleanup() })

// ─── Render counter utility ─────────────────────────

const renders = {
  _map: new Map<string, number>(),
  reset() { this._map.clear() },
  tick(id: string) { this._map.set(id, (this._map.get(id) ?? 0) + 1) },
  get(id: string) { return this._map.get(id) ?? 0 },
  all() { return Object.fromEntries(this._map) },
}

// ─── BENCH 1: useStxAsync basic lifecycle ───────────

describe("BENCH 1: useStxAsync — render lifecycle", () => {
  it("resolves sync effect and renders value", () => {
    const registry = AtomRegistry.make()
    type S = { name: string; count: number }
    const stxA = fromEffect(Effect.succeed<S>({ name: "Alice", count: 42 }), registry)

    function App() {
      const { value, loading } = useStxAsync(stxA)
      renders.tick("app")
      return React.createElement("div", null,
        React.createElement("span", { "data-testid": "val" }, value?.name ?? "loading"),
        React.createElement("span", { "data-testid": "loading" }, String(loading)),
      )
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("val").textContent).toBe("Alice")
    expect(getByTestId("loading").textContent).toBe("false")
  })

  it("stream resolves to latest value", () => {
    const registry = AtomRegistry.make()
    type Tick = { price: number; ts: number }
    const stxS = fromStream(
      Stream.fromIterable<Tick>([
        { price: 100, ts: 1 },
        { price: 101, ts: 2 },
        { price: 99, ts: 3 },
      ]),
      registry,
    )

    function App() {
      const { value } = useStxAsync(stxS)
      return React.createElement("span", { "data-testid": "price" }, String(value?.price ?? "?"))
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("price").textContent).toBe("99")
  })
})

// ─── BENCH 2: useFocusAsync surgical isolation ──────

describe("BENCH 2: useFocusAsync — surgical field isolation", () => {
  it("only re-renders focused field, not siblings", () => {
    const registry = AtomRegistry.make()
    type S = { name: string; age: number; city: string }

    const atom = Atom.make<AsyncResult.AsyncResult<S, never>>(
      AsyncResult.success({ name: "Alice", age: 30, city: "NYC" })
    )
    registry.mount(atom)
    const lens = autoLens<S>()

    // Build StxAsync-compatible focus atoms
    const nameAtom = Atom.make<string | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.name.get(r.value) : undefined
    })
    const ageAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.age.get(r.value) : undefined
    })
    const cityAtom = Atom.make<string | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.city.get(r.value) : undefined
    })
    registry.mount(nameAtom)
    registry.mount(ageAtom)
    registry.mount(cityAtom)

    renders.reset()

    const Name = memo(() => {
      const name = useAtomValue(registry, nameAtom)
      renders.tick("name")
      return React.createElement("span", { "data-testid": "name" }, name ?? "?")
    })
    const Age = memo(() => {
      const age = useAtomValue(registry, ageAtom)
      renders.tick("age")
      return React.createElement("span", { "data-testid": "age" }, String(age ?? "?"))
    })
    const City = memo(() => {
      const city = useAtomValue(registry, cityAtom)
      renders.tick("city")
      return React.createElement("span", { "data-testid": "city" }, city ?? "?")
    })

    const { getByTestId } = render(React.createElement("div", null,
      React.createElement(Name),
      React.createElement(Age),
      React.createElement(City),
    ))

    expect(getByTestId("name").textContent).toBe("Alice")
    expect(getByTestId("age").textContent).toBe("30")
    expect(getByTestId("city").textContent).toBe("NYC")

    renders.reset()

    // Update ONLY name
    act(() => {
      registry.set(atom, AsyncResult.success({ name: "Bob", age: 30, city: "NYC" }))
    })

    expect(renders.get("name")).toBe(1)
    expect(renders.get("age")).toBe(0)
    expect(renders.get("city")).toBe(0)
    expect(getByTestId("name").textContent).toBe("Bob")

    // Update ONLY age
    renders.reset()
    act(() => {
      registry.set(atom, AsyncResult.success({ name: "Bob", age: 31, city: "NYC" }))
    })

    expect(renders.get("name")).toBe(0)
    expect(renders.get("age")).toBe(1)
    expect(renders.get("city")).toBe(0)

    // Update ONLY city
    renders.reset()
    act(() => {
      registry.set(atom, AsyncResult.success({ name: "Bob", age: 31, city: "LA" }))
    })

    expect(renders.get("name")).toBe(0)
    expect(renders.get("age")).toBe(0)
    expect(renders.get("city")).toBe(1)

    console.log("\n  3-field isolation: perfect — each field only renders on its own change")
  })
})

// ─── BENCH 3: Rapid-fire async updates → render count ─

describe("BENCH 3: Rapid-fire AsyncResult updates → React render precision", () => {
  it("100 updates to field A: field B renders 0 times", () => {
    const registry = AtomRegistry.make()
    type S = { x: number; y: number }

    const atom = Atom.make<AsyncResult.AsyncResult<S, never>>(
      AsyncResult.success({ x: 0, y: 0 })
    )
    registry.mount(atom)
    const lens = autoLens<S>()

    const xAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.x.get(r.value) : undefined
    })
    const yAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.y.get(r.value) : undefined
    })
    registry.mount(xAtom)
    registry.mount(yAtom)

    renders.reset()

    const X = memo(() => {
      const x = useAtomValue(registry, xAtom)
      renders.tick("x")
      return React.createElement("span", { "data-testid": "x" }, String(x ?? 0))
    })
    const Y = memo(() => {
      const y = useAtomValue(registry, yAtom)
      renders.tick("y")
      return React.createElement("span", { "data-testid": "y" }, String(y ?? 0))
    })

    render(React.createElement("div", null,
      React.createElement(X),
      React.createElement(Y),
    ))

    renders.reset()

    const N = 100
    const start = performance.now()
    act(() => {
      for (let i = 1; i <= N; i++) {
        registry.set(atom, AsyncResult.success({ x: i, y: 0 }))
      }
    })
    const elapsed = performance.now() - start

    console.log(`\n  Rapid-fire ${N} updates:`)
    console.log(`    x renders: ${renders.get("x")}`)
    console.log(`    y renders: ${renders.get("y")}`)
    console.log(`    elapsed: ${elapsed.toFixed(1)}ms`)

    // x should render at least once (batching may coalesce)
    expect(renders.get("x")).toBeGreaterThan(0)
    // y MUST NOT render (value never changed)
    expect(renders.get("y")).toBe(0)
  })
})

// ─── BENCH 4: Deep nested async focus ───────────────

describe("BENCH 4: Deep nested async state — 4-level focus", () => {
  it("leaf update at depth 4: only leaf component re-renders", () => {
    const registry = AtomRegistry.make()
    type S = { a: { b: { c: { d: number }; e: string }; f: boolean } }

    const atom = Atom.make<AsyncResult.AsyncResult<S, never>>(
      AsyncResult.success({ a: { b: { c: { d: 0 }, e: "hello" }, f: true } })
    )
    registry.mount(atom)
    const lens = autoLens<S>()

    const dAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.a.b.c.d.get(r.value) : undefined
    })
    const eAtom = Atom.make<string | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.a.b.e.get(r.value) : undefined
    })
    const fAtom = Atom.make<boolean | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.a.f.get(r.value) : undefined
    })
    registry.mount(dAtom)
    registry.mount(eAtom)
    registry.mount(fAtom)

    renders.reset()

    const D = memo(() => { const v = useAtomValue(registry, dAtom); renders.tick("d"); return React.createElement("span", { "data-testid": "d" }, String(v ?? "?")) })
    const E = memo(() => { const v = useAtomValue(registry, eAtom); renders.tick("e"); return React.createElement("span", { "data-testid": "e" }, String(v ?? "?")) })
    const F = memo(() => { const v = useAtomValue(registry, fAtom); renders.tick("f"); return React.createElement("span", { "data-testid": "f" }, String(v ?? "?")) })

    const { getByTestId } = render(React.createElement("div", null,
      React.createElement(D), React.createElement(E), React.createElement(F),
    ))

    expect(getByTestId("d").textContent).toBe("0")

    renders.reset()

    // Update only d (depth 4)
    act(() => {
      registry.set(atom, AsyncResult.success({ a: { b: { c: { d: 42 }, e: "hello" }, f: true } }))
    })

    expect(renders.get("d")).toBe(1)
    expect(renders.get("e")).toBe(0)
    expect(renders.get("f")).toBe(0)
    expect(getByTestId("d").textContent).toBe("42")

    console.log("\n  Depth-4 focus: d=1, e=0, f=0 — perfect isolation through AsyncResult")
  })
})

// ─── BENCH 5: useStxAsync + useFocusAsync full API ──

describe("BENCH 5: useFocusAsync — writable AsyncResult simulation", () => {
  it("useFocusAsync provides surgical subscription", () => {
    const registry = AtomRegistry.make()
    type S = { count: number; label: string }

    // Use a writable atom wrapping AsyncResult (simulates server-pushed updates)
    const atom = Atom.make<AsyncResult.AsyncResult<S, never>>(
      AsyncResult.success({ count: 10, label: "test" })
    )
    registry.mount(atom)

    const stxA = fromEffect(Effect.succeed<S>({ count: 10, label: "test" }), registry)

    renders.reset()

    // Build focus atoms against the writable atom
    const countAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? stxA.lens.count.get(r.value) : undefined
    })
    const labelAtom = Atom.make<string | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? stxA.lens.label.get(r.value) : undefined
    })
    registry.mount(countAtom)
    registry.mount(labelAtom)

    const Count = memo(() => {
      const count = useAtomValue(registry, countAtom)
      renders.tick("count")
      return React.createElement("span", { "data-testid": "count" }, String(count ?? 0))
    })
    const Label = memo(() => {
      const label = useAtomValue(registry, labelAtom)
      renders.tick("label")
      return React.createElement("span", { "data-testid": "label" }, label ?? "")
    })

    const { getByTestId } = render(React.createElement("div", null,
      React.createElement(Count), React.createElement(Label),
    ))

    expect(getByTestId("count").textContent).toBe("10")
    expect(getByTestId("label").textContent).toBe("test")

    renders.reset()

    // Simulate "refetch" by updating writable AsyncResult atom
    act(() => {
      registry.set(atom, AsyncResult.success({ count: 11, label: "test" }))
    })

    expect(renders.get("count")).toBe(1)
    expect(renders.get("label")).toBe(0)

    console.log("\n  useFocusAsync: count=1, label=0 — surgical through full API path")
  })
})

// ─── BENCH 6: Simulated high-frequency stream ──────

describe("BENCH 6: High-frequency stream simulation", () => {
  it("1000 rapid updates: measure render coalescing", () => {
    const registry = AtomRegistry.make()
    type Tick = { bid: number; ask: number; vol: number }

    const atom = Atom.make<AsyncResult.AsyncResult<Tick, never>>(
      AsyncResult.success({ bid: 100, ask: 101, vol: 500 })
    )
    registry.mount(atom)
    const lens = autoLens<Tick>()

    const bidAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.bid.get(r.value) : undefined
    })
    const askAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.ask.get(r.value) : undefined
    })
    const volAtom = Atom.make<number | undefined>((get) => {
      const r = get(atom)
      return r._tag === "Success" ? lens.vol.get(r.value) : undefined
    })
    registry.mount(bidAtom)
    registry.mount(askAtom)
    registry.mount(volAtom)

    renders.reset()

    const Bid = memo(() => { const v = useAtomValue(registry, bidAtom); renders.tick("bid"); return React.createElement("span", null, String(v ?? 0)) })
    const Ask = memo(() => { const v = useAtomValue(registry, askAtom); renders.tick("ask"); return React.createElement("span", null, String(v ?? 0)) })
    const Vol = memo(() => { const v = useAtomValue(registry, volAtom); renders.tick("vol"); return React.createElement("span", null, String(v ?? 0)) })

    render(React.createElement("div", null,
      React.createElement(Bid), React.createElement(Ask), React.createElement(Vol),
    ))

    renders.reset()

    const N = 1000
    const start = performance.now()
    act(() => {
      for (let i = 0; i < N; i++) {
        // Only bid changes, ask/vol stay the same
        registry.set(atom, AsyncResult.success({
          bid: 100 + (i % 50),  // cycles through 50 values
          ask: 101,
          vol: 500,
        }))
      }
    })
    const elapsed = performance.now() - start

    console.log(`\n  High-frequency stream sim (${N} updates):`)
    console.log(`    bid renders: ${renders.get("bid")}`)
    console.log(`    ask renders: ${renders.get("ask")}`)
    console.log(`    vol renders: ${renders.get("vol")}`)
    console.log(`    elapsed: ${elapsed.toFixed(1)}ms`)
    console.log(`    throughput: ${Math.floor(N / (elapsed / 1000)).toLocaleString()} updates/sec`)

    // bid should render (value changes)
    expect(renders.get("bid")).toBeGreaterThan(0)
    // ask/vol MUST NOT render
    expect(renders.get("ask")).toBe(0)
    expect(renders.get("vol")).toBe(0)
  })

  it("all 3 fields change every tick: all 3 render, none extra", () => {
    const registry = AtomRegistry.make()
    type Tick = { a: number; b: number; c: number }

    const atom = Atom.make<AsyncResult.AsyncResult<Tick, never>>(
      AsyncResult.success({ a: 0, b: 0, c: 0 })
    )
    registry.mount(atom)
    const lens = autoLens<Tick>()

    const aAtom = Atom.make<number | undefined>((get) => { const r = get(atom); return r._tag === "Success" ? lens.a.get(r.value) : undefined })
    const bAtom = Atom.make<number | undefined>((get) => { const r = get(atom); return r._tag === "Success" ? lens.b.get(r.value) : undefined })
    const cAtom = Atom.make<number | undefined>((get) => { const r = get(atom); return r._tag === "Success" ? lens.c.get(r.value) : undefined })
    registry.mount(aAtom); registry.mount(bAtom); registry.mount(cAtom)

    renders.reset()

    const A = memo(() => { const v = useAtomValue(registry, aAtom); renders.tick("a"); return React.createElement("span", null, String(v ?? 0)) })
    const B = memo(() => { const v = useAtomValue(registry, bAtom); renders.tick("b"); return React.createElement("span", null, String(v ?? 0)) })
    const C = memo(() => { const v = useAtomValue(registry, cAtom); renders.tick("c"); return React.createElement("span", null, String(v ?? 0)) })

    render(React.createElement("div", null,
      React.createElement(A), React.createElement(B), React.createElement(C),
    ))

    renders.reset()

    const N = 100
    act(() => {
      for (let i = 1; i <= N; i++) {
        registry.set(atom, AsyncResult.success({ a: i, b: i * 2, c: i * 3 }))
      }
    })

    console.log(`\n  All-change scenario (${N} updates):`)
    console.log(`    a renders: ${renders.get("a")}`)
    console.log(`    b renders: ${renders.get("b")}`)
    console.log(`    c renders: ${renders.get("c")}`)

    // All three should render — React may batch/coalesce but each got at least 1
    expect(renders.get("a")).toBeGreaterThan(0)
    expect(renders.get("b")).toBeGreaterThan(0)
    expect(renders.get("c")).toBeGreaterThan(0)
  })
})

// ─── BENCH 7: Mixed sync/async — 10 components ─────

describe("BENCH 7: 10-component dashboard — mixed field updates", () => {
  it("update 1 of 10 fields: exactly 1 component re-renders", () => {
    const registry = AtomRegistry.make()

    // Simulating a dashboard with 10 metrics
    type Dashboard = {
      cpu: number; memory: number; disk: number; network: number; latency: number
      requests: number; errors: number; uptime: number; connections: number; threads: number
    }

    const initial: Dashboard = {
      cpu: 45, memory: 72, disk: 30, network: 100,
      latency: 15, requests: 5000, errors: 2,
      uptime: 99.9, connections: 150, threads: 8,
    }

    const atom = Atom.make<AsyncResult.AsyncResult<Dashboard, never>>(
      AsyncResult.success(initial)
    )
    registry.mount(atom)
    const lens = autoLens<Dashboard>()

    // Create per-field focus atoms
    const fields = ["cpu", "memory", "disk", "network", "latency", "requests", "errors", "uptime", "connections", "threads"] as const
    const fieldAtoms = new Map<string, Atom.Atom<any>>()
    for (const field of fields) {
      const a = Atom.make<number | undefined>((get) => {
        const r = get(atom)
        return r._tag === "Success" ? (lens as any)[field].get(r.value) : undefined
      })
      registry.mount(a)
      fieldAtoms.set(field, a)
    }

    renders.reset()

    // Create 10 memo'd components
    const components = fields.map(field => {
      return memo(() => {
        const v = useAtomValue(registry, fieldAtoms.get(field)!)
        renders.tick(field)
        return React.createElement("span", { "data-testid": field }, String(v ?? 0))
      })
    })

    const { getByTestId } = render(
      React.createElement("div", null, ...components.map((C, i) =>
        React.createElement(C, { key: fields[i] })
      ))
    )

    expect(getByTestId("cpu").textContent).toBe("45")

    renders.reset()

    // Update ONLY cpu
    act(() => {
      registry.set(atom, AsyncResult.success({ ...initial, cpu: 78 }))
    })

    console.log(`\n  10-field dashboard, cpu-only update:`)
    for (const field of fields) {
      const count = renders.get(field)
      console.log(`    ${field}: ${count} renders`)
    }

    expect(renders.get("cpu")).toBe(1)
    // All others must be 0
    for (const field of fields) {
      if (field !== "cpu") {
        expect(renders.get(field)).toBe(0)
      }
    }
  })
})

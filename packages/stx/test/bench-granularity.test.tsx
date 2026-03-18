/**
 * STX v2 Granularity Benchmark — vs Legend State
 *
 * Counts ACTUAL React component re-renders to prove surgical reactivity.
 * Uses raw useSyncExternalStore against AtomRegistry — zero intermediaries.
 *
 * Test matrix:
 * - 200 items, update 1 → how many components re-render?
 * - Deep nested state, update leaf → which ancestors re-render?
 * - Rapid-fire updates (100x) → total render count
 * - Raw throughput: 10k updates, notification precision
 */

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest"
import React, { useRef, useSyncExternalStore, memo } from "react"
import { render, act } from "@testing-library/react"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import { Optic } from "effect-v4"
import { observable } from "@legendapp/state"
import { useSelector } from "@legendapp/state/react"

// ─────────────────────────────────────────────────────
// ZERO-INTERMEDIARY HOOK: useSyncExternalStore + AtomRegistry
//
// This is the esoteric part: we bypass @effect/atom-react entirely
// and wire React 19's concurrent-safe primitive directly to the
// AtomRegistry's notification system. No wrappers, no abstractions.
// ─────────────────────────────────────────────────────

function useAtomValue<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A {
  return useSyncExternalStore(
    (onStoreChange) => {
      // Mount ensures dependency tracking activates
      registry.mount(atom)
      // Subscribe returns unsubscribe
      const unsub = registry.subscribe(atom, onStoreChange)
      return unsub
    },
    () => registry.get(atom),     // getSnapshot
    () => registry.get(atom),     // getServerSnapshot
  )
}

// ─────────────────────────────────────────────────────
// Instrumentation: render counter
// ─────────────────────────────────────────────────────

const counters = {
  renders: new Map<string, number>(),
  reset() { this.renders.clear() },
  tick(id: string) {
    this.renders.set(id, (this.renders.get(id) ?? 0) + 1)
  },
  total() {
    let sum = 0
    for (const v of this.renders.values()) sum += v
    return sum
  },
  get(id: string) { return this.renders.get(id) ?? 0 },
  dump() {
    const entries: Record<string, number> = {}
    for (const [k, v] of this.renders) entries[k] = v
    return entries
  },
}

function useRenderCount(id: string) {
  counters.tick(id)
}

// ─────────────────────────────────────────────────────
// autoLens (class-aware)
// ─────────────────────────────────────────────────────

function autoLens<S>(optic?: any): any {
  const root = optic ?? Optic.id<S>()
  const cache = new Map<string | symbol, any>()
  return new Proxy(root, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === "symbol") return target[prop]
      if (prop === "get" || prop === "getResult" || prop === "getAll") return target[prop].bind(target)
      if (prop === "_optic") return target
      if (prop === "replace") {
        return (value: any, state: any) => {
          const proto = Object.getPrototypeOf(state)
          if (proto && proto.constructor !== Object) {
            const shell = Object.assign(Object.create(Object.prototype), state)
            const updated = target.replace(value, shell)
            return Object.assign(Object.create(proto), updated)
          }
          return target.replace(value, state)
        }
      }
      if (prop === "modify") {
        return (fn: any) => (state: any) => {
          const proto = Object.getPrototypeOf(state)
          if (proto && proto.constructor !== Object) {
            const shell = Object.assign(Object.create(Object.prototype), state)
            const updated = target.modify(fn)(shell)
            return Object.assign(Object.create(proto), updated)
          }
          return target.modify(fn)(state)
        }
      }
      if (!cache.has(prop)) cache.set(prop, autoLens(target.key(String(prop))))
      return cache.get(prop)
    },
  })
}

// ─────────────────────────────────────────────────────
// BENCH 1: N items, update 1 — re-render count
// ─────────────────────────────────────────────────────

describe("BENCH 1: 200 items, single update", () => {
  const N = 200

  type Item = { id: number; value: number; label: string }
  type State = { items: Item[] }

  const makeItems = (): Item[] =>
    Array.from({ length: N }, (_, i) => ({ id: i, value: i * 10, label: `item-${i}` }))

  it("STX v2: update 1 of 200 → only 1 item re-renders", () => {
    counters.reset()

    const registry = AtomRegistry.make()
    const stateAtom = Atom.make<State>({ items: makeItems() })
    const lens = autoLens<State>()

    // Per-item derived atom
    const itemValueAtom = Atom.family((idx: number) =>
      Atom.make((get) => lens.items.get(get(stateAtom))[idx]?.value ?? -1)
    )

    const ItemComp = memo(({ idx, reg }: { idx: number; reg: AtomRegistry.AtomRegistry }) => {
      const value = useAtomValue(reg, itemValueAtom(idx))
      useRenderCount(`item-${idx}`)
      return React.createElement("span", { "data-testid": `item-${idx}` }, String(value))
    })

    const App = () =>
      React.createElement(
        "div", null,
        Array.from({ length: N }, (_, i) =>
          React.createElement(ItemComp, { key: i, idx: i, reg: registry })
        )
      )

    const { unmount } = render(React.createElement(App))
    counters.reset()

    act(() => {
      const s = registry.get(stateAtom)
      const newItems = s.items.map((item, i) =>
        i === 42 ? { ...item, value: 9999 } : item
      )
      registry.set(stateAtom, { items: newItems })
    })

    const afterRenders = counters.total()
    const item42Renders = counters.get("item-42")

    console.log(`\n  STX v2: ${afterRenders} re-renders after updating item 42 of ${N}`)
    console.log(`  item-42 renders: ${item42Renders}`)

    expect(item42Renders).toBe(1)
    expect(afterRenders).toBe(1) // ONLY item-42

    unmount()
  })

  it("Legend State: update 1 of 200 → count re-renders", () => {
    counters.reset()

    const state$ = observable<State>({ items: makeItems() })

    const ItemComp = memo(({ idx }: { idx: number }) => {
      const value = useSelector(() => state$.items[idx]?.value.get())
      useRenderCount(`ls-item-${idx}`)
      return React.createElement("span", { "data-testid": `ls-item-${idx}` }, String(value))
    })

    const App = () =>
      React.createElement(
        "div", null,
        Array.from({ length: N }, (_, i) =>
          React.createElement(ItemComp, { key: i, idx: i })
        )
      )

    const { unmount } = render(React.createElement(App))
    counters.reset()

    act(() => {
      state$.items[42].value.set(9999)
    })

    const afterRenders = counters.total()
    const item42Renders = counters.get("ls-item-42")

    console.log(`  Legend State: ${afterRenders} re-renders after updating item 42 of ${N}`)
    console.log(`  ls-item-42 renders: ${item42Renders}`)

    expect(item42Renders).toBeGreaterThanOrEqual(1)

    unmount()
  })
})

// ─────────────────────────────────────────────────────
// BENCH 2: Deep nested state — leaf update propagation
// ─────────────────────────────────────────────────────

describe("BENCH 2: Deep nested state, leaf update", () => {
  type DeepState = {
    a: { b: { c: { d: number; e: string }; f: number }; g: boolean }
    h: { i: number; j: string }
    k: number
  }

  const initial: DeepState = {
    a: { b: { c: { d: 1, e: "deep" }, f: 2 }, g: true },
    h: { i: 3, j: "shallow" },
    k: 0,
  }

  it("STX v2: update d (4 levels deep) — only d-subscriber re-renders", () => {
    counters.reset()

    const registry = AtomRegistry.make()
    const stateAtom = Atom.make<DeepState>(initial)
    const lens = autoLens<DeepState>()

    const dAtom = Atom.make((get) => lens.a.b.c.d.get(get(stateAtom)))
    const eAtom = Atom.make((get) => lens.a.b.c.e.get(get(stateAtom)))
    const fAtom = Atom.make((get) => lens.a.b.f.get(get(stateAtom)))
    const kAtom = Atom.make((get) => lens.k.get(get(stateAtom)))

    const D = () => { const v = useAtomValue(registry, dAtom); useRenderCount("d"); return React.createElement("span", null, v) }
    const E = () => { const v = useAtomValue(registry, eAtom); useRenderCount("e"); return React.createElement("span", null, v) }
    const F = () => { const v = useAtomValue(registry, fAtom); useRenderCount("f"); return React.createElement("span", null, v) }
    const K = () => { const v = useAtomValue(registry, kAtom); useRenderCount("k"); return React.createElement("span", null, v) }

    const App = () => React.createElement("div", null,
      React.createElement(D), React.createElement(E),
      React.createElement(F), React.createElement(K),
    )

    const { unmount } = render(React.createElement(App))
    counters.reset()

    act(() => {
      const s = registry.get(stateAtom)
      registry.set(stateAtom, lens.a.b.c.d.replace(999, s))
    })

    console.log("\n  STX v2 deep update:", counters.dump())
    expect(counters.get("d")).toBe(1)
    expect(counters.get("e")).toBe(0)
    expect(counters.get("f")).toBe(0)
    expect(counters.get("k")).toBe(0)

    unmount()
  })
})

// ─────────────────────────────────────────────────────
// BENCH 3: Rapid-fire 100 updates — isolation
// ─────────────────────────────────────────────────────

describe("BENCH 3: Rapid-fire 100 updates", () => {
  type State = { x: number; y: number; z: number }

  it("STX v2: 100 updates to x — y/z NEVER re-render", () => {
    counters.reset()

    const registry = AtomRegistry.make()
    const stateAtom = Atom.make<State>({ x: 0, y: 0, z: 0 })
    const lens = autoLens<State>()

    const xAtom = Atom.make((get) => lens.x.get(get(stateAtom)))
    const yAtom = Atom.make((get) => lens.y.get(get(stateAtom)))
    const zAtom = Atom.make((get) => lens.z.get(get(stateAtom)))

    const X = () => { const v = useAtomValue(registry, xAtom); useRenderCount("x"); return React.createElement("span", null, v) }
    const Y = () => { const v = useAtomValue(registry, yAtom); useRenderCount("y"); return React.createElement("span", null, v) }
    const Z = () => { const v = useAtomValue(registry, zAtom); useRenderCount("z"); return React.createElement("span", null, v) }

    const App = () => React.createElement("div", null,
      React.createElement(X), React.createElement(Y), React.createElement(Z),
    )

    const { unmount } = render(React.createElement(App))
    counters.reset()

    act(() => {
      for (let i = 1; i <= 100; i++) {
        const s = registry.get(stateAtom)
        registry.set(stateAtom, lens.x.replace(i, s))
      }
    })

    console.log("\n  STX v2 rapid-fire:", counters.dump())
    expect(counters.get("x")).toBeGreaterThanOrEqual(1)
    expect(counters.get("y")).toBe(0)
    expect(counters.get("z")).toBe(0)

    unmount()
  })

  it("Legend State: 100 updates to x — count y/z renders", () => {
    counters.reset()

    const state$ = observable<State>({ x: 0, y: 0, z: 0 })

    const X = () => { const v = useSelector(() => state$.x.get()); useRenderCount("ls-x"); return React.createElement("span", null, v) }
    const Y = () => { const v = useSelector(() => state$.y.get()); useRenderCount("ls-y"); return React.createElement("span", null, v) }
    const Z = () => { const v = useSelector(() => state$.z.get()); useRenderCount("ls-z"); return React.createElement("span", null, v) }

    const App = () => React.createElement("div", null,
      React.createElement(X), React.createElement(Y), React.createElement(Z),
    )

    const { unmount } = render(React.createElement(App))
    counters.reset()

    act(() => {
      for (let i = 1; i <= 100; i++) {
        state$.x.set(i)
      }
    })

    console.log("  Legend State rapid-fire:", counters.dump())
    expect(counters.get("ls-x")).toBeGreaterThanOrEqual(1)

    unmount()
  })
})

// ─────────────────────────────────────────────────────
// BENCH 4: Raw throughput (no React overhead)
// ─────────────────────────────────────────────────────

describe("BENCH 4: Raw throughput", () => {
  it("STX v2: 10k updates, notification precision", () => {
    const registry = AtomRegistry.make()
    const N = 10_000
    const stateAtom = Atom.make<{ values: number[] }>({ values: new Array(100).fill(0) })
    const lens = autoLens<{ values: number[] }>()

    const v0Atom = Atom.make((get) => lens.values.get(get(stateAtom))[0] ?? 0)
    registry.mount(v0Atom)
    let v0Notifs = 0
    registry.subscribe(v0Atom, () => { v0Notifs++ })
    v0Notifs = 0

    const start = performance.now()

    for (let i = 0; i < N; i++) {
      const s = registry.get(stateAtom)
      const newValues = [...s.values]
      newValues[i % 100] = i
      registry.set(stateAtom, { values: newValues })
    }

    const elapsed = performance.now() - start
    const opsPerSec = Math.floor(N / (elapsed / 1000))

    console.log(`\n  STX v2: ${N} updates in ${elapsed.toFixed(1)}ms (${opsPerSec.toLocaleString()} ops/sec)`)
    console.log(`  v0 notifications: ${v0Notifs} (expected: 100)`)

    // First iteration sets values[0] = 0 (same as initial) → Object.is skip = 99
    expect(v0Notifs).toBe(99)
  })

  it("Legend State: 10k proxy updates", () => {
    const N = 10_000
    const state$ = observable<{ values: number[] }>({ values: new Array(100).fill(0) })

    let v0Notifs = 0
    state$.values[0].onChange(() => { v0Notifs++ })

    const start = performance.now()

    for (let i = 0; i < N; i++) {
      state$.values[i % 100].set(i)
    }

    const elapsed = performance.now() - start
    const opsPerSec = Math.floor(N / (elapsed / 1000))

    console.log(`  Legend State: ${N} updates in ${elapsed.toFixed(1)}ms (${opsPerSec.toLocaleString()} ops/sec)`)
    console.log(`  v0 notifications: ${v0Notifs}`)
  })
})

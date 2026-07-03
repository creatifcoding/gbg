/**
 * Spike: Validate atom→registry→useSyncExternalStore pipeline
 * for all streaming materializers.
 *
 * Uses inline useAtomFromRegistry (same as streaming/hooks.ts) to bypass
 * the @effect/atom-react import resolution issue in vitest.
 *
 * Also validates the NEW streaming hooks (useStxLatest etc.) which now
 * use instance.registry directly instead of RegistryContext.
 */

import { describe, test, expect, afterEach } from "vitest"
import { act, render, screen, waitFor, cleanup } from "@testing-library/react"
import * as React from "react"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Fiber from "effect/Fiber"

import { stxLatest } from "../src/streaming/latest.js"
import { stxFeed } from "../src/streaming/feed.js"
import { stxReduce } from "../src/streaming/reduce.js"
import { useStxLatest, useStxFeed, useStxReduce } from "../src/streaming/hooks.js"

afterEach(cleanup)

// ── Inline useAtomFromRegistry (same as streaming/hooks.ts) ─────────────────

function useAtomFromRegistry<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A {
  const store = React.useMemo(() => ({
    subscribe: (f: () => void) => registry.subscribe(atom, f),
    snapshot: () => registry.get(atom),
  }), [registry, atom])
  return React.useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("atom-react: explicit registry (no context)", () => {

  test("baseline: registry.set triggers re-render", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make("init")
    registry.mount(atom)

    function C() {
      const v = useAtomFromRegistry(registry, atom)
      return <div data-testid="v">{v}</div>
    }

    render(<C />)
    expect(screen.getByTestId("v").textContent).toBe("init")

    act(() => { registry.set(atom, "updated") })

    await waitFor(() => {
      expect(screen.getByTestId("v").textContent).toBe("updated")
    })
  })

  test("registry.set from Effect.runFork", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make<number>(0)
    registry.mount(atom)

    function C() {
      const v = useAtomFromRegistry(registry, atom)
      return <div data-testid="v">{v}</div>
    }

    render(<C />)
    const fiber = Effect.runFork(Effect.sync(() => { registry.set(atom, 99) }))
    await Effect.runPromise(Fiber.join(fiber))
    await waitFor(() => { expect(screen.getByTestId("v").textContent).toBe("99") })
  })

  test("Stream.runForEachArray + registry.set", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make<number>(0)
    registry.mount(atom)
    const stream = Stream.make(1, 2, 3)

    function C() {
      const v = useAtomFromRegistry(registry, atom)
      return <div data-testid="v">{v}</div>
    }

    render(<C />)
    const fiber = Effect.runFork(
      Stream.runForEachArray(stream, (chunk) =>
        Effect.sync(() => { registry.set(atom, chunk[chunk.length - 1]) })
      )
    )
    await Effect.runPromise(Fiber.join(fiber))
    await waitFor(() => { expect(screen.getByTestId("v").textContent).toBe("3") })
  })
})

describe("streaming hooks: useStxLatest/Feed/Reduce (explicit registry)", () => {

  test("useStxLatest re-renders on sync stream", async () => {
    const registry = AtomRegistry.make()
    const stream = Stream.make(10, 20, 30)
    const latest = stxLatest<number>(stream, registry)

    function C() {
      const { value, loading } = useStxLatest(latest)
      return (
        <div>
          <span data-testid="val">{value ?? "none"}</span>
          <span data-testid="load">{String(loading)}</span>
        </div>
      )
    }

    render(<C />)

    await waitFor(() => {
      expect(screen.getByTestId("val").textContent).toBe("30")
    }, { timeout: 2000 })

    latest.control.dispose()
  })

  test("useStxFeed re-renders on sync stream", async () => {
    const registry = AtomRegistry.make()
    const stream = Stream.make("a", "b", "c")
    const feed = stxFeed<string>(stream, { mode: "append" }, registry)

    function C() {
      const { items } = useStxFeed(feed)
      return <div data-testid="items">{(items as string[]).join(",")}</div>
    }

    render(<C />)
    await waitFor(() => {
      expect(screen.getByTestId("items").textContent).toBe("a,b,c")
    }, { timeout: 2000 })

    feed.control.dispose()
  })

  test("useStxReduce re-renders on sync stream", async () => {
    const registry = AtomRegistry.make()
    const stream = Stream.make(1, 2, 3)
    const reduce = stxReduce<number, number>(
      stream,
      { initial: 0, apply: (s, e) => s + e },
      registry,
    )

    function C() {
      const { state } = useStxReduce(reduce)
      return <div data-testid="state">{state as number}</div>
    }

    render(<C />)
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("6")
    }, { timeout: 2000 })

    reduce.control.dispose()
  })

  test("useStxLatest with tick stream re-renders incrementally", async () => {
    const registry = AtomRegistry.make()
    let counter = 0
    const stream = Stream.tick("50 millis").pipe(
      Stream.mapEffect(() => Effect.sync(() => ++counter)),
      Stream.take(5),
    )
    const latest = stxLatest<number>(stream, registry)
    const renders: number[] = []

    function C() {
      const { value } = useStxLatest(latest)
      if (value !== undefined) renders.push(value as number)
      return <div data-testid="tick">{value ?? "none"}</div>
    }

    render(<C />)
    await waitFor(() => {
      expect(screen.getByTestId("tick").textContent).toBe("5")
    }, { timeout: 3000 })

    console.log("[tick] renders:", renders)
    expect(renders.length).toBeGreaterThan(0)
    expect(renders[renders.length - 1]).toBe(5)

    latest.control.dispose()
  })

  // No Provider needed! Hooks use instance.registry directly.
  test("useStxLatest works WITHOUT RegistryContext.Provider", async () => {
    const registry = AtomRegistry.make()
    const stream = Stream.make(42)
    const latest = stxLatest<number>(stream, registry)

    function C() {
      const { value } = useStxLatest(latest)
      return <div data-testid="noprovider">{value ?? "none"}</div>
    }

    // No provider wrapping — hooks use instance.registry directly
    render(<C />)

    await waitFor(() => {
      expect(screen.getByTestId("noprovider").textContent).toBe("42")
    }, { timeout: 2000 })

    latest.control.dispose()
  })
})

describe("proof: RegistryContext mismatch = bug", () => {

  test("mismatched registries = no updates", async () => {
    const writerRegistry = AtomRegistry.make()
    const readerRegistry = AtomRegistry.make()

    const atom = Atom.make<number>(0)
    writerRegistry.mount(atom)
    readerRegistry.mount(atom)

    function C() {
      const v = useAtomFromRegistry(readerRegistry, atom)
      return <div data-testid="mismatch">{v}</div>
    }

    render(<C />)
    expect(screen.getByTestId("mismatch").textContent).toBe("0")

    act(() => { writerRegistry.set(atom, 42) })
    await new Promise(r => setTimeout(r, 200))
    // STILL 0 — reader registry never got notified
    expect(screen.getByTestId("mismatch").textContent).toBe("0")
  })
})

/**
 * STX v2 — React hooks tests
 *
 * Tests useStx, useFocus, useAtomValue, useStxSet
 * with real React 19 rendering via @testing-library/react + happy-dom.
 */

// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from "vitest"
import React, { memo } from "react"
import { render, act, cleanup } from "@testing-library/react"
import { Schema } from "effect"
import { stx, useStx, useFocus, useAtomValue, useStxSet } from "../src/index.js"

afterEach(() => { cleanup() })

// ─── Render counter ─────────────────────────────────

const counters = {
  renders: new Map<string, number>(),
  reset() { this.renders.clear() },
  tick(id: string) { this.renders.set(id, (this.renders.get(id) ?? 0) + 1) },
  get(id: string) { return this.renders.get(id) ?? 0 },
}

// ─── Fixtures ───────────────────────────────────────

type SimpleState = { count: number; label: string; nested: { x: number; y: number } }
const makeSimple = (): SimpleState => ({ count: 0, label: "test", nested: { x: 1, y: 2 } })

class TaggedState extends Schema.TaggedClass<TaggedState>()("TaggedState", {
  value: Schema.Number,
  name: Schema.String,
}) {
  get doubled() { return this.value * 2 }
}

// ─── useStx ─────────────────────────────────────────

describe("useStx", () => {
  it("renders initial state", () => {
    const store = stx(makeSimple())

    function App() {
      const { value } = useStx(store)
      return React.createElement("div", { "data-testid": "count" }, String(value.count))
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("count").textContent).toBe("0")
  })

  it("re-renders on setAt", () => {
    const store = stx(makeSimple())

    function App() {
      const { value, lens, setAt } = useStx(store)
      return React.createElement("div", null,
        React.createElement("span", { "data-testid": "count" }, String(value.count)),
        React.createElement("button", {
          "data-testid": "btn",
          onClick: () => setAt(lens.count, value.count + 1)
        }, "+"),
      )
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("count").textContent).toBe("0")

    act(() => { getByTestId("btn").click() })
    expect(getByTestId("count").textContent).toBe("1")

    act(() => { getByTestId("btn").click() })
    expect(getByTestId("count").textContent).toBe("2")
  })

  it("re-renders on modify", () => {
    const store = stx(makeSimple())

    function App() {
      const { value, lens, modify } = useStx(store)
      return React.createElement("div", null,
        React.createElement("span", { "data-testid": "x" }, String(value.nested.x)),
        React.createElement("button", {
          "data-testid": "btn",
          onClick: () => modify(lens.nested.x, (n: number) => n * 10),
        }, "×10"),
      )
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("x").textContent).toBe("1")

    act(() => { getByTestId("btn").click() })
    expect(getByTestId("x").textContent).toBe("10")
  })

  it("works with TaggedClass", () => {
    const store = stx(new TaggedState({ value: 5, name: "test" }))

    function App() {
      const { value, lens, setAt } = useStx(store)
      return React.createElement("div", null,
        React.createElement("span", { "data-testid": "doubled" }, String(value.doubled)),
        React.createElement("button", {
          "data-testid": "btn",
          onClick: () => setAt(lens.value, 10),
        }, "set 10"),
      )
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("doubled").textContent).toBe("10") // 5 * 2

    act(() => { getByTestId("btn").click() })
    expect(getByTestId("doubled").textContent).toBe("20") // 10 * 2
  })
})

// ─── useFocus ───────────────────────────────────────

describe("useFocus", () => {
  it("subscribes to specific path only", () => {
    counters.reset()
    const store = stx(makeSimple())

    const CountComp = memo(() => {
      const count = useFocus(store, store.lens.count)
      counters.tick("count")
      return React.createElement("span", { "data-testid": "count" }, String(count))
    })

    const LabelComp = memo(() => {
      const label = useFocus(store, store.lens.label)
      counters.tick("label")
      return React.createElement("span", { "data-testid": "label" }, label)
    })

    render(React.createElement("div", null,
      React.createElement(CountComp),
      React.createElement(LabelComp),
    ))

    counters.reset()

    // Update count only
    act(() => { store.setAt(store.lens.count, 42) })

    expect(counters.get("count")).toBe(1)
    expect(counters.get("label")).toBe(0) // NOT re-rendered
  })

  it("deep focus is surgical", () => {
    counters.reset()
    const store = stx(makeSimple())

    const XComp = memo(() => {
      const x = useFocus(store, store.lens.nested.x)
      counters.tick("x")
      return React.createElement("span", null, String(x))
    })

    const YComp = memo(() => {
      const y = useFocus(store, store.lens.nested.y)
      counters.tick("y")
      return React.createElement("span", null, String(y))
    })

    render(React.createElement("div", null,
      React.createElement(XComp),
      React.createElement(YComp),
    ))

    counters.reset()

    // Update x only
    act(() => { store.setAt(store.lens.nested.x, 999) })

    expect(counters.get("x")).toBe(1)
    expect(counters.get("y")).toBe(0)
  })
})

// ─── useAtomValue ──────────────────────────────────

describe("useAtomValue", () => {
  it("subscribes to any atom", () => {
    const store = stx(makeSimple())
    const xAtom = store.focus(store.lens.nested.x)

    function App() {
      const x = useAtomValue(store.registry, xAtom)
      return React.createElement("span", { "data-testid": "x" }, String(x))
    }

    const { getByTestId } = render(React.createElement(App))
    expect(getByTestId("x").textContent).toBe("1")

    act(() => { store.setAt(store.lens.nested.x, 77) })
    expect(getByTestId("x").textContent).toBe("77")
  })
})

// ─── useStxSet ──────────────────────────────────────

describe("useStxSet", () => {
  it("provides write ops without subscribing", () => {
    counters.reset()
    const store = stx(makeSimple())

    const Writer = memo(() => {
      const { setAt, lens } = useStxSet(store)
      counters.tick("writer")
      return React.createElement("button", {
        "data-testid": "btn",
        onClick: () => setAt(lens.count, 999),
      }, "write")
    })

    const Reader = memo(() => {
      const count = useFocus(store, store.lens.count)
      counters.tick("reader")
      return React.createElement("span", { "data-testid": "val" }, String(count))
    })

    const { getByTestId } = render(React.createElement("div", null,
      React.createElement(Writer),
      React.createElement(Reader),
    ))

    counters.reset()

    act(() => { getByTestId("btn").click() })

    // Reader re-renders (subscribed), Writer does NOT
    expect(counters.get("reader")).toBe(1)
    expect(counters.get("writer")).toBe(0)
    expect(getByTestId("val").textContent).toBe("999")
  })
})

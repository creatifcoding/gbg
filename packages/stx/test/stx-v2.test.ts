/**
 * STX v2 — Core unit tests
 *
 * Tests the real src/ modules (not spikes).
 * Covers: autoLens, class-patch, focus atoms, stx factory.
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import { Optic, Schema } from "effect-v4"
import {
  stx,
  autoLens,
  createFocusAtom,
  isClassInstance,
  classAwareReplace,
  classAwareModify,
} from "../src/index.js"

// ─── Test Fixtures ──────────────────────────────────

class AppState extends Schema.TaggedClass<AppState>()("AppState", {
  counter: Schema.Number,
  user: Schema.Struct({ name: Schema.String, level: Schema.Number }),
  items: Schema.Array(Schema.Struct({ id: Schema.String, active: Schema.Boolean })),
}) {
  get doubled() { return this.counter * 2 }
  get greeting() { return `Hello ${this.user.name}` }
}

type Plain = { x: number; y: string; nested: { a: number; b: number } }

const makeApp = () => new AppState({
  counter: 0,
  user: { name: "Alice", level: 42 },
  items: [{ id: "a", active: true }, { id: "b", active: false }],
})

const makePlain = (): Plain => ({ x: 1, y: "hello", nested: { a: 10, b: 20 } })

// ─── internal/class-patch ───────────────────────────

describe("internal/class-patch", () => {
  it("isClassInstance: true for TaggedClass", () => {
    expect(isClassInstance(makeApp())).toBe(true)
  })

  it("isClassInstance: false for plain objects", () => {
    expect(isClassInstance({ a: 1 })).toBe(false)
    expect(isClassInstance({ _tag: "X", a: 1 })).toBe(false) // TaggedStruct
  })

  it("isClassInstance: false for null/undefined/primitives", () => {
    expect(isClassInstance(null)).toBe(false)
    expect(isClassInstance(undefined)).toBe(false)
    expect(isClassInstance(42)).toBe(false)
    expect(isClassInstance("str")).toBe(false)
  })

  it("classAwareReplace preserves class", () => {
    const s1 = makeApp()
    const optic = Optic.id<AppState>().key("counter")
    const s2 = classAwareReplace(optic, 10, s1)

    expect(s2).toBeInstanceOf(AppState)
    expect(s2.counter).toBe(10)
    expect(s2.doubled).toBe(20)
    expect(s2._tag).toBe("AppState")
  })

  it("classAwareReplace passthrough for plain objects", () => {
    const s1 = makePlain()
    const optic = Optic.id<Plain>().key("x")
    const s2 = classAwareReplace(optic, 99, s1)

    expect(s2.x).toBe(99)
    expect(s2.y).toBe("hello")
  })

  it("classAwareReplace preserves VALUE equality on untouched branches", () => {
    const s1 = makeApp()
    const optic = Optic.id<AppState>().key("counter")
    const s2 = classAwareReplace(optic, 10, s1)

    // Value equality preserved (deep equal) — what focus atoms actually check
    expect(s2.user).toStrictEqual(s1.user)
    expect(s2.items).toStrictEqual(s1.items)
    // Counter changed
    expect(s2.counter).toBe(10)
    expect(s1.counter).toBe(0) // immutable
  })

  it("classAwareModify preserves class + sharing", () => {
    const s1 = makeApp()
    const optic = Optic.id<AppState>().key("counter")
    const s2 = classAwareModify(optic, (n: number) => n + 5, s1)

    expect(s2).toBeInstanceOf(AppState)
    expect(s2.counter).toBe(5)
    expect(s2.doubled).toBe(10)
    expect(s2.user).toBe(s1.user)
  })
})

// ─── internal/auto-lens ─────────────────────────────

describe("internal/auto-lens", () => {
  it("get reads values", () => {
    const lens = autoLens<Plain>()
    const s = makePlain()

    expect(lens.x.get(s)).toBe(1)
    expect(lens.y.get(s)).toBe("hello")
    expect(lens.nested.a.get(s)).toBe(10)
  })

  it("replace creates new state", () => {
    const lens = autoLens<Plain>()
    const s1 = makePlain()
    const s2 = lens.x.replace(99, s1)

    expect(s2.x).toBe(99)
    expect(s2.y).toBe("hello")
    expect(s1.x).toBe(1) // immutable
  })

  it("modify applies function", () => {
    const lens = autoLens<Plain>()
    const s1 = makePlain()
    const s2 = lens.nested.a.modify((n: number) => n * 3)(s1)

    expect(s2.nested.a).toBe(30)
    expect(s2.nested.b).toBe(20) // sibling preserved
  })

  it("memoized: same path → same proxy", () => {
    const lens = autoLens<Plain>()
    expect(lens.nested.a).toBe(lens.nested.a)
    expect(lens.x).toBe(lens.x)
  })

  it("class-aware: replace on TaggedClass preserves class", () => {
    const lens = autoLens<AppState>()
    const s1 = makeApp()
    const s2 = lens.counter.replace(10, s1)

    expect(s2).toBeInstanceOf(AppState)
    expect(s2.doubled).toBe(20)
    expect(s2.greeting).toBe("Hello Alice")
  })

  it("class-aware: deep replace preserves class + value equality", () => {
    const lens = autoLens<AppState>()
    const s1 = makeApp()
    const s2 = lens.user.name.replace("Bob", s1)

    expect(s2).toBeInstanceOf(AppState)
    expect(s2.greeting).toBe("Hello Bob")
    expect(s2.items).toStrictEqual(s1.items) // value preserved
    expect(s2.counter).toBe(s1.counter) // primitive identity preserved
  })

  it("_optic escapes to raw optic", () => {
    const lens = autoLens<Plain>()
    const raw = lens.x._optic
    expect(raw).toBeDefined()
    expect(typeof raw.get).toBe("function")
  })
})

// ─── internal/focus ─────────────────────────────────

describe("internal/focus", () => {
  it("focus atom derives value from root", () => {
    const registry = AtomRegistry.make()
    const root = Atom.make(makePlain())
    registry.mount(root)

    const lens = autoLens<Plain>()
    const xAtom = createFocusAtom(root, lens.x)
    registry.mount(xAtom)

    expect(registry.get(xAtom)).toBe(1)
  })

  it("focus atom updates when focused path changes", () => {
    const registry = AtomRegistry.make()
    const root = Atom.make(makePlain())
    const lens = autoLens<Plain>()
    const xAtom = createFocusAtom(root, lens.x)
    registry.mount(root)
    registry.mount(xAtom)

    let notified = 0
    registry.subscribe(xAtom, () => { notified++ })
    notified = 0

    registry.set(root, lens.x.replace(99, registry.get(root)))
    expect(registry.get(xAtom)).toBe(99)
    expect(notified).toBe(1)
  })

  it("focus atom skips when other paths change", () => {
    const registry = AtomRegistry.make()
    const root = Atom.make(makePlain())
    const lens = autoLens<Plain>()
    const xAtom = createFocusAtom(root, lens.x)
    registry.mount(root)
    registry.mount(xAtom)

    let notified = 0
    registry.subscribe(xAtom, () => { notified++ })
    notified = 0

    // Change y (not x)
    registry.set(root, lens.y.replace("world", registry.get(root)))
    expect(notified).toBe(0) // Object.is skip
  })

  it("focus atom memoized: same path → same atom", () => {
    const root = Atom.make(makePlain())
    const lens = autoLens<Plain>()

    const a1 = createFocusAtom(root, lens.x)
    const a2 = createFocusAtom(root, lens.x)
    expect(a1).toBe(a2)
  })

  it("different paths → different atoms", () => {
    const root = Atom.make(makePlain())
    const lens = autoLens<Plain>()

    const xAtom = createFocusAtom(root, lens.x)
    const yAtom = createFocusAtom(root, lens.y)
    expect(xAtom).not.toBe(yAtom)
  })
})

// ─── stx factory ────────────────────────────────────

describe("stx factory", () => {
  it("creates instance with atom, lens, registry", () => {
    const store = stx(makePlain())

    expect(store.atom).toBeDefined()
    expect(store.lens).toBeDefined()
    expect(store.registry).toBeDefined()
    expect(store.get()).toEqual(makePlain())
  })

  it("set replaces root state", () => {
    const store = stx(makePlain())
    store.set({ x: 99, y: "new", nested: { a: 0, b: 0 } })

    expect(store.get().x).toBe(99)
    expect(store.get().y).toBe("new")
  })

  it("setAt replaces at lens path", () => {
    const store = stx(makePlain())
    store.setAt(store.lens.x, 42)

    expect(store.get().x).toBe(42)
    expect(store.get().y).toBe("hello") // untouched
  })

  it("modify applies function at lens path", () => {
    const store = stx(makePlain())
    store.modify(store.lens.nested.a, (n: number) => n * 10)

    expect(store.get().nested.a).toBe(100)
    expect(store.get().nested.b).toBe(20) // sibling
  })

  it("getAt reads specific path", () => {
    const store = stx(makePlain())
    expect(store.getAt(store.lens.nested.b)).toBe(20)
  })

  it("focus creates derived atom", () => {
    const store = stx(makePlain())
    const xAtom = store.focus(store.lens.x)

    expect(store.registry.get(xAtom)).toBe(1)
  })

  it("focus atom surgical: only fires on target change", () => {
    const store = stx(makePlain())
    const xAtom = store.focus(store.lens.x)
    const yAtom = store.focus(store.lens.y)

    let xN = 0, yN = 0
    store.registry.subscribe(xAtom, () => { xN++ })
    store.registry.subscribe(yAtom, () => { yN++ })
    xN = 0; yN = 0

    store.setAt(store.lens.x, 99)
    expect(xN).toBe(1)
    expect(yN).toBe(0)
  })

  it("works with TaggedClass", () => {
    const store = stx(makeApp())

    expect(store.get()).toBeInstanceOf(AppState)
    expect(store.get().doubled).toBe(0)

    store.setAt(store.lens.counter, 10)

    expect(store.get()).toBeInstanceOf(AppState)
    expect(store.get().doubled).toBe(20)
    expect(store.get().greeting).toBe("Hello Alice")
  })

  it("TaggedClass: deep update preserves class + value equality", () => {
    const store = stx(makeApp())
    const original = store.get()

    store.setAt(store.lens.user.name, "Bob")
    const updated = store.get()

    expect(updated).toBeInstanceOf(AppState)
    expect(updated.greeting).toBe("Hello Bob")
    expect(updated.items).toStrictEqual(original.items) // value preserved
    expect(updated.counter).toBe(original.counter) // primitive identity
  })

  it("focus on TaggedClass field is surgical", () => {
    const store = stx(makeApp())
    const nameAtom = store.focus(store.lens.user.name)
    const counterAtom = store.focus(store.lens.counter)

    let nameN = 0, counterN = 0
    store.registry.subscribe(nameAtom, () => { nameN++ })
    store.registry.subscribe(counterAtom, () => { counterN++ })
    nameN = 0; counterN = 0

    store.setAt(store.lens.user.name, "Bob")
    expect(nameN).toBe(1)
    expect(counterN).toBe(0)

    store.setAt(store.lens.counter, 5)
    expect(nameN).toBe(1) // still 1 from before
    expect(counterN).toBe(1)
  })

  it("accepts shared registry", () => {
    const shared = AtomRegistry.make()
    const store = stx(makePlain(), shared)

    expect(store.registry).toBe(shared)
    expect(shared.get(store.atom)).toEqual(makePlain())
  })
})

// ─── Arbitrary class support ────────────────────────

describe("arbitrary class support", () => {
  class Vector {
    x: number
    y: number
    constructor(x: number, y: number) {
      this.x = x
      this.y = y
    }
    get magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2) }
    add(other: Vector) { return new Vector(this.x + other.x, this.y + other.y) }
  }

  it("preserves arbitrary class through optic", () => {
    type State = { position: Vector; label: string }
    const store = stx<State>({ position: new Vector(3, 4), label: "origin" })

    store.setAt(store.lens.position.x, 6)
    const pos = store.get().position

    // prototype restored
    expect(pos).toBeInstanceOf(Vector)
    expect(pos.x).toBe(6)
    expect(pos.y).toBe(4)
    // magnitude computes (getter works)
    expect(pos.magnitude).toBeCloseTo(7.211, 2)
  })

  class Config {
    values: Map<string, number>
    constructor(values: Map<string, number>) {
      this.values = values
    }
    get total() {
      let sum = 0
      for (const v of this.values.values()) sum += v
      return sum
    }
  }

  it("preserves class with Map internal state", () => {
    // Config with Map — nested inside a plain object (not directly optic-navigated)
    type S = { config: Config; active: boolean }
    const store = stx<S>({
      config: new Config(new Map([["a", 1], ["b", 2]])),
      active: true,
    })

    // Changing sibling preserves config class + Map
    store.setAt(store.lens.active, false)
    const cfg = store.get().config

    expect(cfg).toBeInstanceOf(Config)
    expect(cfg.values).toBeInstanceOf(Map)
    expect(cfg.total).toBe(3)
    expect(store.get().active).toBe(false)
  })
})

/**
 * STX v2 Spike — Full Factory
 *
 * The `stx()` factory that auto-generates:
 * - Writable root Atom<T> (where T is a plain object / TaggedStruct type)
 * - Auto-lens tree (.lens.user.name → optic chain)
 * - .focus(lens.path) → derived Atom that only fires on that path's change
 * - .set(lens.path, value) → immutable update via optic
 * - .modify(lens.path, fn) → immutable update via optic function
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import { Optic, Schema } from "effect-v4"

// ─────────────────────────────────────────────────────
// autoLens (from spike-auto-lens)
// ─────────────────────────────────────────────────────

function autoLens<S>(optic?: any): any {
  const root = optic ?? Optic.id<S>()
  const cache = new Map<string | symbol, any>()

  return new Proxy(root, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === "symbol") return target[prop]
      if (prop === "get" || prop === "replace" || prop === "modify" ||
          prop === "getResult" || prop === "getAll") {
        return target[prop].bind(target)
      }
      if (prop === "_optic") return target

      if (!cache.has(prop)) {
        const next = target.key(String(prop))
        cache.set(prop, autoLens(next))
      }
      return cache.get(prop)
    },
  })
}

// ─────────────────────────────────────────────────────
// stx() factory — v2 spike
// ─────────────────────────────────────────────────────

interface StxInstance<T> {
  /** Root atom — single source of truth */
  readonly atom: Atom.Writable<T>

  /** Auto-lens tree: .lens.user.name → optic chain */
  readonly lens: any // LensProxy<T, T> — typed in real impl

  /**
   * Focus on a path → derived Atom that fires only when that value changes.
   * Uses Object.is equality (Atom internals) for skip.
   */
  focus<A>(lens: { get: (s: T) => A }): Atom.Atom<A>

  /**
   * Set a focused value immutably.
   */
  set<A>(lens: { replace: (value: A, state: T) => T }, value: A): void

  /**
   * Modify a focused value with a function.
   */
  modify<A>(lens: { modify: (f: (a: A) => A) => (s: T) => T }, f: (a: A) => A): void

  /**
   * Get current state snapshot.
   */
  get(): T

  /**
   * Registry for atom operations.
   */
  readonly registry: AtomRegistry.AtomRegistry
}

function stx<T>(
  initial: T,
  registry?: AtomRegistry.AtomRegistry,
): StxInstance<T> {
  const reg = registry ?? AtomRegistry.make()
  const atom = Atom.make<T>(initial)

  // Focus cache: same lens path → same derived atom (memoized)
  const focusCache = new WeakMap<any, Atom.Atom<any>>()

  const lens = autoLens<T>()

  return {
    atom,
    lens,
    registry: reg,

    focus<A>(l: { get: (s: T) => A; _optic?: any }): Atom.Atom<A> {
      // Use the raw optic as cache key
      const cacheKey = l._optic ?? l
      if (focusCache.has(cacheKey)) return focusCache.get(cacheKey)!

      const derived = Atom.make((get) => l.get(get(atom)))
      reg.mount(derived)
      focusCache.set(cacheKey, derived)
      return derived
    },

    set<A>(l: { replace: (value: A, state: T) => T }, value: A): void {
      const current = reg.get(atom)
      reg.set(atom, l.replace(value, current))
    },

    modify<A>(l: { modify: (f: (a: A) => A) => (s: T) => T }, f: (a: A) => A): void {
      const current = reg.get(atom)
      reg.set(atom, l.modify(f)(current))
    },

    get(): T {
      return reg.get(atom)
    },
  }
}

// ─────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────

describe("stx() factory: autoLens + Atom + focus", () => {
  type State = {
    user: { name: string; age: number }
    settings: { theme: string; fontSize: number }
    counter: number
  }

  it("creates instance with initial state", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    expect(s.get().user.name).toBe("Alice")
    expect(s.get().counter).toBe(0)
  })

  it("lens reads via auto-chain", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    expect(s.lens.user.name.get(s.get())).toBe("Alice")
    expect(s.lens.settings.theme.get(s.get())).toBe("dark")
    expect(s.lens.counter.get(s.get())).toBe(0)
  })

  it("set() updates focused value immutably", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    const before = s.get()
    s.set(s.lens.user.name, "Bob")

    expect(s.get().user.name).toBe("Bob")
    expect(s.get().settings).toBe(before.settings) // structural sharing
  })

  it("modify() applies function to focused value", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    s.modify(s.lens.counter, n => n + 1)
    expect(s.get().counter).toBe(1)

    s.modify(s.lens.user.age, a => a + 5)
    expect(s.get().user.age).toBe(35)
  })

  it("focus() creates derived atom per path", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    const nameAtom = s.focus(s.lens.user.name)
    const themeAtom = s.focus(s.lens.settings.theme)
    const counterAtom = s.focus(s.lens.counter)

    expect(s.registry.get(nameAtom)).toBe("Alice")
    expect(s.registry.get(themeAtom)).toBe("dark")
    expect(s.registry.get(counterAtom)).toBe(0)
  })

  it("focus() is memoized — same path returns same atom", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    const a1 = s.focus(s.lens.user.name)
    const a2 = s.focus(s.lens.user.name)

    expect(a1).toBe(a2) // referentially identical
  })

  it("SURGICAL: focus atom fires only for its path", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    const nameAtom = s.focus(s.lens.user.name)
    const themeAtom = s.focus(s.lens.settings.theme)
    const counterAtom = s.focus(s.lens.counter)

    let nameN = 0, themeN = 0, counterN = 0
    s.registry.subscribe(nameAtom, () => { nameN++ })
    s.registry.subscribe(themeAtom, () => { themeN++ })
    s.registry.subscribe(counterAtom, () => { counterN++ })
    nameN = 0; themeN = 0; counterN = 0

    // Change only name
    s.set(s.lens.user.name, "Bob")
    expect(nameN).toBe(1)
    expect(themeN).toBe(0)
    expect(counterN).toBe(0)

    // Change only counter
    nameN = 0
    s.modify(s.lens.counter, n => n + 1)
    expect(counterN).toBe(1)
    expect(nameN).toBe(0)
    expect(themeN).toBe(0)

    // Change only theme
    counterN = 0
    s.set(s.lens.settings.theme, "light")
    expect(themeN).toBe(1)
    expect(nameN).toBe(0)
    expect(counterN).toBe(0)
  })

  it("SKIP: same value → zero notifications", () => {
    const s = stx<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark", fontSize: 14 },
      counter: 0,
    })

    const nameAtom = s.focus(s.lens.user.name)
    let nameN = 0
    s.registry.subscribe(nameAtom, () => { nameN++ })
    nameN = 0

    // Set to same value
    s.set(s.lens.user.name, "Alice")
    expect(nameN).toBe(0)
  })
})

describe("stx() with Schema.TaggedStruct", () => {
  const TodoState = Schema.TaggedStruct("TodoState", {
    todos: Schema.Array(Schema.Struct({
      id: Schema.String,
      text: Schema.String,
      done: Schema.Boolean,
    })),
    filter: Schema.Literal("all", "active", "done"),
    nextId: Schema.Number,
  })
  type TodoState = typeof TodoState.Type

  it("works with Schema-validated initial state", () => {
    const initial = Schema.decodeUnknownSync(TodoState)({
      _tag: "TodoState",
      todos: [{ id: "1", text: "Test STX", done: false }],
      filter: "all",
      nextId: 2,
    })

    const s = stx(initial)

    expect(s.get()._tag).toBe("TodoState")
    expect(s.lens.filter.get(s.get())).toBe("all")
    expect(s.lens.nextId.get(s.get())).toBe(2)
  })

  it("surgical updates on schema-backed state", () => {
    const initial: TodoState = {
      _tag: "TodoState",
      todos: [{ id: "1", text: "Test", done: false }],
      filter: "all",
      nextId: 2,
    }

    const s = stx(initial)
    const filterAtom = s.focus(s.lens.filter)
    const nextIdAtom = s.focus(s.lens.nextId)

    let filterN = 0, nextIdN = 0
    s.registry.subscribe(filterAtom, () => { filterN++ })
    s.registry.subscribe(nextIdAtom, () => { nextIdN++ })
    filterN = 0; nextIdN = 0

    s.set(s.lens.filter, "active")
    expect(filterN).toBe(1)
    expect(nextIdN).toBe(0)

    s.modify(s.lens.nextId, n => n + 1)
    expect(nextIdN).toBe(1)
    expect(filterN).toBe(1) // unchanged from before
  })
})

describe("stx() with shared registry", () => {
  it("multiple stx instances share a registry", () => {
    const registry = AtomRegistry.make()

    const s1 = stx({ count: 0, label: "A" }, registry)
    const s2 = stx({ count: 0, label: "B" }, registry)

    const count1 = s1.focus(s1.lens.count)
    const count2 = s2.focus(s2.lens.count)

    let n1 = 0, n2 = 0
    registry.subscribe(count1, () => { n1++ })
    registry.subscribe(count2, () => { n2++ })
    n1 = 0; n2 = 0

    // Update only s1
    s1.set(s1.lens.count, 42)
    expect(n1).toBe(1)
    expect(n2).toBe(0)
    expect(registry.get(count2)).toBe(0)
  })
})

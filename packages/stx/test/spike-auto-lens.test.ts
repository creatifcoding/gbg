/**
 * STX v2 Spike — Auto-Lens
 *
 * Proxy-based optic tree that auto-chains Optic.id<T>().key() calls.
 * Combined with Atom for reactive state → surgical subscriptions.
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import { Optic, Schema } from "effect-v4"

// ─────────────────────────────────────────────────────
// autoLens: the core primitive
// ─────────────────────────────────────────────────────

type LensProxy<S, A> = {
  /** Get the focused value */
  get(state: S): A
  /** Replace the focused value immutably */
  replace(value: A, state: S): S
  /** Modify the focused value with a function */
  modify(f: (a: A) => A): (state: S) => S
  /** Get Result (for checked optics) */
  getResult(state: S): any
  /** Raw optic access */
  readonly _optic: any
} & (A extends Record<string, any>
  ? { readonly [K in keyof A]: LensProxy<S, A[K]> }
  : {})

function autoLens<S>(optic?: any): LensProxy<S, S> {
  const root = optic ?? Optic.id<S>()
  const cache = new Map<string | symbol, any>()

  return new Proxy(root, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === "symbol") return target[prop]

      // Forward optic methods
      if (prop === "get" || prop === "replace" || prop === "modify" ||
          prop === "getResult" || prop === "getAll") {
        return target[prop].bind(target)
      }
      if (prop === "_optic") return target

      // Auto-chain with memoization
      if (!cache.has(prop)) {
        const next = target.key(String(prop))
        cache.set(prop, autoLens(next))
      }
      return cache.get(prop)
    },
  }) as any
}

// ─────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────

describe("autoLens: proxy-based optic chain", () => {
  type State = {
    user: { name: string; age: number; address: { city: string; zip: string } }
    settings: { theme: string; fontSize: number }
    counter: number
    items: Array<{ id: string; active: boolean }>
  }

  const lens = autoLens<State>()

  const initial: State = {
    user: { name: "Alice", age: 30, address: { city: "Portland", zip: "97201" } },
    settings: { theme: "dark", fontSize: 14 },
    counter: 0,
    items: [
      { id: "a", active: true },
      { id: "b", active: false },
    ],
  }

  it("reads leaf values", () => {
    expect(lens.user.name.get(initial)).toBe("Alice")
    expect(lens.user.age.get(initial)).toBe(30)
    expect(lens.settings.theme.get(initial)).toBe("dark")
    expect(lens.counter.get(initial)).toBe(0)
  })

  it("reads nested values (3 levels deep)", () => {
    expect(lens.user.address.city.get(initial)).toBe("Portland")
    expect(lens.user.address.zip.get(initial)).toBe("97201")
  })

  it("reads intermediate objects", () => {
    expect(lens.user.get(initial)).toEqual(initial.user)
    expect(lens.settings.get(initial)).toEqual(initial.settings)
    expect(lens.user.address.get(initial)).toEqual({ city: "Portland", zip: "97201" })
  })

  it("replaces immutably with structural sharing", () => {
    const s2 = lens.user.name.replace("Bob", initial)

    expect(s2.user.name).toBe("Bob")
    expect(s2.settings).toBe(initial.settings) // untouched branch
    expect(s2.user.address).toBe(initial.user.address) // untouched sibling
    expect(s2.items).toBe(initial.items)
  })

  it("replaces deep values", () => {
    const s2 = lens.user.address.city.replace("Seattle", initial)

    expect(s2.user.address.city).toBe("Seattle")
    expect(s2.user.address.zip).toBe("97201") // sibling preserved
    expect(s2.settings).toBe(initial.settings) // untouched branch
  })

  it("modifies via function", () => {
    const s2 = lens.counter.modify(n => n + 1)(initial)
    expect(s2.counter).toBe(1)
    expect(s2.user).toBe(initial.user)
  })

  it("memoizes proxy instances", () => {
    expect(lens.user.name).toBe(lens.user.name)
    expect(lens.user.address.city).toBe(lens.user.address.city)
    expect(lens.settings).toBe(lens.settings)
  })
})

describe("autoLens + Atom: surgical reactivity", () => {
  type State = {
    name: string
    theme: string
    count: number
    nested: { a: number; b: number }
  }

  const lens = autoLens<State>()

  it("derived atoms fire only for their focused value", () => {
    const registry = AtomRegistry.make()

    const stateAtom = Atom.make<State>({
      name: "Alice", theme: "dark", count: 0,
      nested: { a: 1, b: 2 },
    })

    // Derived atoms via autoLens
    const nameAtom = Atom.make((get) => lens.name.get(get(stateAtom)))
    const themeAtom = Atom.make((get) => lens.theme.get(get(stateAtom)))
    const countAtom = Atom.make((get) => lens.count.get(get(stateAtom)))
    const nestedAAtom = Atom.make((get) => lens.nested.a.get(get(stateAtom)))

    // Mount all
    registry.mount(nameAtom)
    registry.mount(themeAtom)
    registry.mount(countAtom)
    registry.mount(nestedAAtom)

    let nameN = 0, themeN = 0, countN = 0, nestedAN = 0
    registry.subscribe(nameAtom, () => { nameN++ })
    registry.subscribe(themeAtom, () => { themeN++ })
    registry.subscribe(countAtom, () => { countN++ })
    registry.subscribe(nestedAAtom, () => { nestedAN++ })
    nameN = 0; themeN = 0; countN = 0; nestedAN = 0

    // Change only name
    const s1 = registry.get(stateAtom)
    registry.set(stateAtom, lens.name.replace("Bob", s1))

    expect(nameN).toBe(1)
    expect(themeN).toBe(0) // ← surgical: theme didn't change
    expect(countN).toBe(0)
    expect(nestedAN).toBe(0)

    // Change only nested.a
    nameN = 0
    const s2 = registry.get(stateAtom)
    registry.set(stateAtom, lens.nested.a.replace(99, s2))

    expect(nestedAN).toBe(1)
    expect(nameN).toBe(0)
    expect(themeN).toBe(0)
    expect(countN).toBe(0)
  })

  it("same value → no notification (Object.is)", () => {
    const registry = AtomRegistry.make()

    const stateAtom = Atom.make<State>({
      name: "Alice", theme: "dark", count: 0,
      nested: { a: 1, b: 2 },
    })

    const nameAtom = Atom.make((get) => lens.name.get(get(stateAtom)))
    registry.mount(nameAtom)

    let notifs = 0
    registry.subscribe(nameAtom, () => { notifs++ })
    notifs = 0

    // Set same value
    const s1 = registry.get(stateAtom)
    registry.set(stateAtom, lens.name.replace("Alice", s1))

    expect(notifs).toBe(0) // Object.is("Alice", "Alice") → skip
  })

  it("autoLens for immutable updates in the registry", () => {
    const registry = AtomRegistry.make()

    const stateAtom = Atom.make<State>({
      name: "Alice", theme: "dark", count: 0,
      nested: { a: 1, b: 2 },
    })

    // Helper: update a focused value in the atom
    function setFocused<A>(atom: Atom.Writable<State>, l: any, value: A) {
      const current = registry.get(atom)
      registry.set(atom, l.replace(value, current))
    }

    setFocused(stateAtom, lens.name, "Bob")
    expect(registry.get(stateAtom).name).toBe("Bob")

    setFocused(stateAtom, lens.nested.a, 42)
    expect(registry.get(stateAtom).nested.a).toBe(42)
    expect(registry.get(stateAtom).name).toBe("Bob") // preserved
  })
})

describe("autoLens + Atom.family: per-entity focus", () => {
  type State = {
    entities: Record<string, { name: string; value: number }>
  }

  const lens = autoLens<State>()

  it("family atoms per entity key", () => {
    const registry = AtomRegistry.make()

    const stateAtom = Atom.make<State>({
      entities: {
        x: { name: "X", value: 1 },
        y: { name: "Y", value: 2 },
        z: { name: "Z", value: 3 },
      },
    })

    // Family: one atom per entity
    const entityAtom = Atom.family((id: string) =>
      Atom.make((get) => {
        const entities = lens.entities.get(get(stateAtom))
        return entities[id] ?? null
      })
    )

    registry.mount(entityAtom("x"))
    registry.mount(entityAtom("y"))

    let xN = 0, yN = 0
    registry.subscribe(entityAtom("x"), () => { xN++ })
    registry.subscribe(entityAtom("y"), () => { yN++ })
    xN = 0; yN = 0

    // Update only entity "x"
    const s1 = registry.get(stateAtom)
    registry.set(stateAtom, {
      entities: { ...s1.entities, x: { ...s1.entities.x, value: 99 } },
    })

    expect(registry.get(entityAtom("x"))?.value).toBe(99)
    expect(registry.get(entityAtom("y"))?.value).toBe(2)

    expect(xN).toBe(1)
    // y's value didn't change, but the entities record ref changed
    // This is the Record<string, T> granularity challenge
    // yN may or may not fire depending on object identity
  })
})

describe("autoLens: Schema.TaggedStruct (plain object, optic-safe)", () => {
  // TaggedStruct creates a plain object type (no class prototype)
  // → Optic replace works correctly

  const AppState = Schema.TaggedStruct("AppState", {
    counter: Schema.Number,
    name: Schema.String,
    nested: Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
    }),
  })
  type AppState = typeof AppState.Type

  const lens = autoLens<AppState>()

  it("works with TaggedStruct values", () => {
    const state: AppState = { _tag: "AppState", counter: 0, name: "test", nested: { x: 1, y: 2 } }

    expect(lens.counter.get(state)).toBe(0)
    expect(lens.name.get(state)).toBe("test")
    expect(lens.nested.x.get(state)).toBe(1)
    expect(lens._tag.get(state)).toBe("AppState")
  })

  it("replaces immutably", () => {
    const s1: AppState = { _tag: "AppState", counter: 0, name: "test", nested: { x: 1, y: 2 } }
    const s2 = lens.counter.replace(42, s1)

    expect(s2.counter).toBe(42)
    expect(s2.nested).toBe(s1.nested)
    expect(s2._tag).toBe("AppState")
  })

  it("deep replace preserves siblings", () => {
    const s1: AppState = { _tag: "AppState", counter: 0, name: "test", nested: { x: 1, y: 2 } }
    const s2 = lens.nested.x.replace(99, s1)

    expect(s2.nested.x).toBe(99)
    expect(s2.nested.y).toBe(2)
    expect(s2.counter).toBe(0)
  })
})

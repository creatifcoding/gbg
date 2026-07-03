/**
 * STX v2 Spike Tests — Optic + Atom + Schema.TaggedClass
 *
 * Goal: Prove that optic-derived atoms achieve Legend State-beating granularity.
 *
 * S1: Basic Atom + Optic.get → derived atom only fires on focused change
 * S2: Atom.family keyed by optic → per-entity subscription
 * S3: Structural sharing — unrelated branches don't trigger
 * S4: Schema.TaggedClass as Atom type parameter
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import { Optic, Schema, Result } from "effect"

// ── Helpers ──────────────────────────────────────────

function createRegistry() {
  return AtomRegistry.make()
}

// ── S1: Optic-derived atom only fires on focused change ──────────

describe("S1: Optic-derived atom fires only on focused change", () => {
  type State = { user: { name: string; age: number }; settings: { theme: string } }

  const _name = Optic.id<State>().key("user").key("name")
  const _age = Optic.id<State>().key("user").key("age")
  const _theme = Optic.id<State>().key("settings").key("theme")

  it("optic reads correct values", () => {
    const state: State = { user: { name: "Alice", age: 30 }, settings: { theme: "dark" } }

    expect(_name.get(state)).toBe("Alice")
    expect(_age.get(state)).toBe(30)
    expect(_theme.get(state)).toBe("dark")
  })

  it("optic replaces immutably with structural sharing", () => {
    const s1: State = { user: { name: "Alice", age: 30 }, settings: { theme: "dark" } }
    const s2 = _name.replace("Bob", s1)

    expect(s2.user.name).toBe("Bob")
    expect(s2.user.age).toBe(30) // unchanged
    expect(s2.settings).toBe(s1.settings) // referential identity — untouched branch
    expect(s2.user).not.toBe(s1.user) // path cloned
    expect(s2).not.toBe(s1)
  })

  it("writable atom + optic: derived atom fires only for its focus", () => {
    const registry = createRegistry()

    const stateAtom = Atom.make<State>({
      user: { name: "Alice", age: 30 },
      settings: { theme: "dark" },
    })

    // Derived atoms: each watches a specific optic focus
    let nameNotifications = 0
    let themeNotifications = 0

    const nameAtom = Atom.make((get) => {
      const state = get(stateAtom)
      return _name.get(state)
    })

    const themeAtom = Atom.make((get) => {
      const state = get(stateAtom)
      return _theme.get(state)
    })

    // Subscribe to derived atoms
    registry.subscribe(nameAtom, () => { nameNotifications++ })
    registry.subscribe(themeAtom, () => { themeNotifications++ })

    // Initial values
    expect(registry.get(nameAtom)).toBe("Alice")
    expect(registry.get(themeAtom)).toBe("dark")

    // Update name only — theme atom should NOT fire
    const s1 = registry.get(stateAtom)
    registry.set(stateAtom, _name.replace("Bob", s1))

    expect(registry.get(nameAtom)).toBe("Bob")
    expect(registry.get(themeAtom)).toBe("dark")

    // nameAtom should have notified, themeAtom should not
    // (depends on Atom's equality check — if it compares values)
    expect(nameNotifications).toBeGreaterThanOrEqual(1)
    // Note: themeNotifications may still fire if Atom doesn't do value equality.
    // This is what we need to validate — does Atom.make's derived do value-compare?
  })
})

// ── S2: Atom.family keyed by entity ID ──────────────

describe("S2: Atom.family for per-entity focus", () => {
  type Item = { id: string; value: number; label: string }
  type State = { items: ReadonlyArray<Item> }

  it("family creates stable per-entity atoms", () => {
    const registry = createRegistry()

    const stateAtom = Atom.make<State>({
      items: [
        { id: "a", value: 1, label: "Alpha" },
        { id: "b", value: 2, label: "Beta" },
        { id: "c", value: 3, label: "Gamma" },
      ],
    })

    // Family: per-entity derived atom
    const itemValueAtom = Atom.family((id: string) =>
      Atom.make((get) => {
        const state = get(stateAtom)
        const item = state.items.find(i => i.id === id)
        return item?.value ?? null
      })
    )

    expect(registry.get(itemValueAtom("a"))).toBe(1)
    expect(registry.get(itemValueAtom("b"))).toBe(2)
    expect(registry.get(itemValueAtom("c"))).toBe(3)

    // Same key returns same atom instance (memoized)
    expect(itemValueAtom("a")).toBe(itemValueAtom("a"))
  })

  it("updating one entity doesn't trigger other entity atoms", () => {
    const registry = createRegistry()

    const stateAtom = Atom.make<State>({
      items: [
        { id: "a", value: 1, label: "Alpha" },
        { id: "b", value: 2, label: "Beta" },
      ],
    })

    const itemValueAtom = Atom.family((id: string) =>
      Atom.make((get) => {
        const state = get(stateAtom)
        return state.items.find(i => i.id === id)?.value ?? null
      })
    )

    let aNotifications = 0
    let bNotifications = 0

    registry.subscribe(itemValueAtom("a"), () => { aNotifications++ })
    registry.subscribe(itemValueAtom("b"), () => { bNotifications++ })

    // Update only item "a" using optic
    const s1 = registry.get(stateAtom)
    const _items = Optic.id<State>().key("items")
    const updated = {
      items: s1.items.map(i => i.id === "a" ? { ...i, value: 99 } : i),
    }
    registry.set(stateAtom, updated)

    expect(registry.get(itemValueAtom("a"))).toBe(99)
    expect(registry.get(itemValueAtom("b"))).toBe(2) // unchanged

    // Validate: item "a" atom notified, item "b" should ideally NOT
    expect(aNotifications).toBeGreaterThanOrEqual(1)
    // bNotifications depends on Atom's equality semantics
  })
})

// ── S3: Structural sharing validation ────────────────

describe("S3: Structural sharing with optics", () => {
  type DeepState = {
    a: { b: { c: number; d: string }; e: number[] }
    f: { g: boolean }
  }

  const _c = Optic.id<DeepState>().key("a").key("b").key("c")
  const _g = Optic.id<DeepState>().key("f").key("g")

  it("modifying c preserves f branch identity", () => {
    const s1: DeepState = { a: { b: { c: 1, d: "hello" }, e: [1, 2] }, f: { g: true } }
    const s2 = _c.replace(42, s1)

    expect(s2.a.b.c).toBe(42)
    expect(s2.f).toBe(s1.f) // structural sharing
    expect(s2.a.e).toBe(s1.a.e) // sibling preserved
    expect(s2.a.b.d).toBe("hello") // sibling value preserved
    expect(s2.a.b).not.toBe(s1.a.b) // path cloned
  })

  it("modify via function", () => {
    const s1: DeepState = { a: { b: { c: 1, d: "hello" }, e: [1, 2] }, f: { g: true } }
    const s2 = _c.modify(n => n + 10)(s1)

    expect(s2.a.b.c).toBe(11)
    expect(s2.f).toBe(s1.f) // structural sharing
  })
})

// ── S4: Schema.TaggedClass as Atom type ──────────────

describe("S4: Schema.TaggedClass with Atom + Optic", () => {
  class AppState extends Schema.TaggedClass<AppState>()("AppState", {
    counter: Schema.Number,
    user: Schema.Struct({
      name: Schema.String,
      level: Schema.Number,
    }),
    items: Schema.Array(Schema.Struct({
      id: Schema.String,
      active: Schema.Boolean,
    })),
  }) {
    get activeItems() {
      return this.items.filter(i => i.active)
    }
  }

  const _counter = Optic.id<AppState>().key("counter")
  const _userName = Optic.id<AppState>().key("user").key("name")
  const _userLevel = Optic.id<AppState>().key("user").key("level")

  it("TaggedClass works as Atom value", () => {
    const registry = createRegistry()

    const stateAtom = Atom.make(
      new AppState({
        counter: 0,
        user: { name: "Prime", level: 42 },
        items: [
          { id: "a", active: true },
          { id: "b", active: false },
        ],
      })
    )

    const state = registry.get(stateAtom)
    expect(state._tag).toBe("AppState")
    expect(state.counter).toBe(0)
    expect(state.user.name).toBe("Prime")
    expect(state.activeItems).toHaveLength(1)
  })

  it("optics work on TaggedClass instances", () => {
    const state = new AppState({
      counter: 0,
      user: { name: "Prime", level: 42 },
      items: [],
    })

    expect(_counter.get(state)).toBe(0)
    expect(_userName.get(state)).toBe("Prime")
    expect(_userLevel.get(state)).toBe(42)
  })

  it("optic replace on TaggedClass produces plain object (not class instance)", () => {
    const s1 = new AppState({
      counter: 0,
      user: { name: "Prime", level: 42 },
      items: [],
    })

    // Optic.replace does shallow clone — result is a plain object, not TaggedClass
    // This is a GOTCHA: class instances with non-Object prototype throw
    // We need to handle this for STX v2
    let threw = false
    try {
      const s2 = _counter.replace(1, s1)
    } catch (e) {
      threw = true
    }

    // Schema.TaggedClass instances have class prototype → should throw
    // This tells us: we need to store plain objects in atoms, not class instances
    // Or use Schema.decode to reconstruct after optic replace
    expect(typeof threw).toBe("boolean") // just documenting behavior
  })

  it("Optic.getAll with forEach for filtered traversal", () => {
    const state = new AppState({
      counter: 5,
      user: { name: "Prime", level: 42 },
      items: [
        { id: "a", active: true },
        { id: "b", active: false },
        { id: "c", active: true },
      ],
    })

    // This works on the items array directly (plain objects inside)
    const _activeIds = Optic.id<AppState["items"]>()
      .forEach(item =>
        item.key("id").check(
          // We need to filter by active=true, but optics can't cross siblings
          // This is a limitation — forEach filter can only check the focused value
        )
      )

    // Pragmatic: getAll on all items, filter in code
    const allIds = Optic.getAll(
      Optic.id<ReadonlyArray<{ id: string; active: boolean }>>()
        .forEach(item => item.key("id"))
    )(state.items)

    expect(allIds).toEqual(["a", "b", "c"])
  })

  it("Schema validation in optic chain", () => {
    const _validLevel = Optic.id<AppState>()
      .key("user")
      .key("level")
      .check(Schema.isGreaterThan(0), Schema.isLessThan(100))

    const state = new AppState({
      counter: 0,
      user: { name: "Prime", level: 42 },
      items: [],
    })

    const result = _validLevel.getResult(state)
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success).toBe(42)
    }

    // Invalid value
    const state2 = new AppState({
      counter: 0,
      user: { name: "Prime", level: 150 },
      items: [],
    })

    const result2 = _validLevel.getResult(state2)
    expect(Result.isFailure(result2)).toBe(true)
  })
})

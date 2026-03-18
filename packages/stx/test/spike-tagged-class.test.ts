/**
 * STX v2 Spike — TaggedClass Clone Patch
 *
 * Proves that Schema.TaggedClass instances can be used with Optic
 * via Object.create(proto) + Object.assign reconstruction.
 *
 * Key insight: don't use `new Ctor(plain)` (deep copies), use
 * `Object.create(proto) + Object.assign(result, updated)` which
 * preserves structural sharing from Optic.replace.
 */

import { describe, it, expect } from "vitest"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import { Optic, Schema } from "effect-v4"

// ─────────────────────────────────────────────────────
// classAwareReplace / classAwareModify
// ─────────────────────────────────────────────────────

function isClassInstance(state: unknown): state is object {
  const proto = Object.getPrototypeOf(state)
  return proto !== null && proto.constructor !== Object
}

function classAwareReplace<S extends object, A>(
  optic: { replace: (value: A, state: S) => S },
  value: A,
  state: S,
): S {
  if (!isClassInstance(state)) return optic.replace(value, state)

  const proto = Object.getPrototypeOf(state)
  // Create plain-prototype copy (optic can spread it)
  const shell = Object.assign(Object.create(Object.prototype), state)
  // Optic replace on plain object → structural sharing preserved
  const updated = optic.replace(value, shell)
  // Reconstruct: prototype for methods, assign for data
  return Object.assign(Object.create(proto), updated) as S
}

function classAwareModify<S extends object, A>(
  optic: { modify: (f: (a: A) => A) => (state: S) => S },
  fn: (a: A) => A,
  state: S,
): S {
  if (!isClassInstance(state)) return optic.modify(fn)(state)

  const proto = Object.getPrototypeOf(state)
  const shell = Object.assign(Object.create(Object.prototype), state)
  const updated = optic.modify(fn)(shell)
  return Object.assign(Object.create(proto), updated) as S
}

// ─────────────────────────────────────────────────────
// autoLens v2: class-aware
// ─────────────────────────────────────────────────────

function autoLens<S>(optic?: any): any {
  const root = optic ?? Optic.id<S>()
  const cache = new Map<string | symbol, any>()

  return new Proxy(root, {
    get(target: any, prop: string | symbol) {
      if (typeof prop === "symbol") return target[prop]

      if (prop === "get" || prop === "getResult" || prop === "getAll") {
        return target[prop].bind(target)
      }
      if (prop === "_optic") return target

      // Class-aware replace/modify
      if (prop === "replace") {
        return (value: any, state: any) => classAwareReplace(target, value, state)
      }
      if (prop === "modify") {
        return (fn: any) => (state: any) => classAwareModify(target, fn, state)
      }

      if (!cache.has(prop)) {
        cache.set(prop, autoLens(target.key(String(prop))))
      }
      return cache.get(prop)
    },
  })
}

// ─────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────

describe("TaggedClass clone patch", () => {
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
    get doubled() { return this.counter * 2 }
    get greeting() { return `Hello ${this.user.name}` }
    get activeItems() { return this.items.filter(i => i.active) }
  }

  const lens = autoLens<AppState>()
  const make = () => new AppState({
    counter: 0,
    user: { name: "Alice", level: 42 },
    items: [
      { id: "a", active: true },
      { id: "b", active: false },
    ],
  })

  it("preserves instanceof after replace", () => {
    const s1 = make()
    const s2 = lens.counter.replace(10, s1)
    expect(s2).toBeInstanceOf(AppState)
  })

  it("preserves _tag after replace", () => {
    const s1 = make()
    const s2 = lens.counter.replace(10, s1)
    expect(s2._tag).toBe("AppState")
  })

  it("preserves computed getters after replace", () => {
    const s1 = make()
    const s2 = lens.counter.replace(10, s1)
    expect(s2.doubled).toBe(20)

    const s3 = lens.user.name.replace("Bob", s1)
    expect(s3.greeting).toBe("Hello Bob")
  })

  it("structural sharing: untouched branches keep ref identity", () => {
    const s1 = make()

    // Counter change → user ref preserved
    const s2 = lens.counter.replace(10, s1)
    expect(s2.user).toBe(s1.user)
    expect(s2.items).toBe(s1.items)

    // User.name change → items ref preserved
    const s3 = lens.user.name.replace("Bob", s1)
    expect(s3.items).toBe(s1.items)
    expect(s3.user).not.toBe(s1.user) // user was touched
  })

  it("modify preserves class + structural sharing", () => {
    const s1 = make()
    const s2 = lens.counter.modify((n: number) => n + 5)(s1)

    expect(s2).toBeInstanceOf(AppState)
    expect(s2.counter).toBe(5)
    expect(s2.doubled).toBe(10)
    expect(s2.user).toBe(s1.user) // untouched
  })

  it("deep nested replace preserves sibling branches", () => {
    const s1 = make()
    const s2 = lens.user.level.replace(99, s1)

    expect(s2).toBeInstanceOf(AppState)
    expect(s2.user.level).toBe(99)
    expect(s2.user.name).toBe("Alice") // sibling preserved
    expect(s2.items).toBe(s1.items) // untouched branch
    expect(s2.counter).toBe(0)
  })
})

describe("TaggedClass + autoLens + Atom: surgical reactivity", () => {
  class State extends Schema.TaggedClass<State>()("State", {
    count: Schema.Number,
    label: Schema.String,
    nested: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  }) {
    get doubled() { return this.count * 2 }
  }

  const lens = autoLens<State>()

  it("derived atoms fire only for their focused path", () => {
    const registry = AtomRegistry.make()
    const stateAtom = Atom.make(
      new State({ count: 0, label: "test", nested: { x: 1, y: 2 } })
    )

    const countAtom = Atom.make((get) => lens.count.get(get(stateAtom)))
    const labelAtom = Atom.make((get) => lens.label.get(get(stateAtom)))
    const xAtom = Atom.make((get) => lens.nested.x.get(get(stateAtom)))

    registry.mount(countAtom)
    registry.mount(labelAtom)
    registry.mount(xAtom)

    let countN = 0, labelN = 0, xN = 0
    registry.subscribe(countAtom, () => { countN++ })
    registry.subscribe(labelAtom, () => { labelN++ })
    registry.subscribe(xAtom, () => { xN++ })
    countN = 0; labelN = 0; xN = 0

    // Change count
    const s1 = registry.get(stateAtom)
    registry.set(stateAtom, lens.count.replace(5, s1))
    expect(countN).toBe(1)
    expect(labelN).toBe(0)
    expect(xN).toBe(0)

    // Verify class methods still work
    const s2 = registry.get(stateAtom)
    expect(s2).toBeInstanceOf(State)
    expect(s2.doubled).toBe(10)

    // Change nested.x
    countN = 0
    registry.set(stateAtom, lens.nested.x.replace(99, s2))
    expect(xN).toBe(1)
    expect(countN).toBe(0)
    expect(labelN).toBe(0)
  })

  it("Object.is skip works on same value", () => {
    const registry = AtomRegistry.make()
    const stateAtom = Atom.make(
      new State({ count: 0, label: "test", nested: { x: 1, y: 2 } })
    )

    const countAtom = Atom.make((get) => lens.count.get(get(stateAtom)))
    registry.mount(countAtom)

    let n = 0
    registry.subscribe(countAtom, () => { n++ })
    n = 0

    const s1 = registry.get(stateAtom)
    registry.set(stateAtom, lens.count.replace(0, s1)) // same value
    expect(n).toBe(0) // Object.is(0, 0) → skip
  })
})

describe("plain objects still work (no regression)", () => {
  it("plain object replace works normally", () => {
    type S = { a: number; b: string }
    const lens = autoLens<S>()

    const s1: S = { a: 1, b: "hello" }
    const s2 = lens.a.replace(42, s1)

    expect(s2.a).toBe(42)
    expect(s2.b).toBe("hello")
  })

  it("TaggedStruct works (plain object with _tag)", () => {
    const MyStruct = Schema.TaggedStruct("MyStruct", {
      x: Schema.Number,
      y: Schema.String,
    })
    type MyStruct = typeof MyStruct.Type
    const lens = autoLens<MyStruct>()

    const s1: MyStruct = { _tag: "MyStruct", x: 1, y: "hi" }
    const s2 = lens.x.replace(99, s1)

    expect(s2.x).toBe(99)
    expect(s2._tag).toBe("MyStruct")
  })
})

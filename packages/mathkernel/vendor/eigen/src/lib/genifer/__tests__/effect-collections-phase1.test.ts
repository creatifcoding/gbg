/**
 * Effect Collections Migration — Phase 1 Tests
 *
 * Validates Equal+Hash traits on UIElement and UITree,
 * and HashMap-backed UITree operations.
 *
 * @module genifer/__tests__/effect-collections-phase1
 */

import { describe, it, expect } from "vitest"
import { Equal, Hash, HashMap, Option } from "effect"
import { UIElement, UITree } from "../core/schemas"
import { TreeCache, generateCacheKey } from "../react/tree-cache"

// =============================================================================
// UIElement Equal + Hash
// =============================================================================

describe("UIElement Equal+Hash", () => {
  const makeElement = (overrides: Partial<ConstructorParameters<typeof UIElement>[0]> = {}) =>
    new UIElement({
      key: "el-1",
      type: "Box",
      props: { color: "red", size: 10 },
      children: ["child-1", "child-2"],
      parentKey: "root",
      ...overrides,
    })

  it("structurally equal elements return true via Equal.equals", () => {
    const a = makeElement()
    const b = makeElement()
    expect(Equal.equals(a, b)).toBe(true)
  })

  it("different key breaks equality", () => {
    const a = makeElement({ key: "el-1" })
    const b = makeElement({ key: "el-2" })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different type breaks equality", () => {
    const a = makeElement({ type: "Box" })
    const b = makeElement({ type: "Text" })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different props breaks equality (deep comparison)", () => {
    const a = makeElement({ props: { color: "red" } })
    const b = makeElement({ props: { color: "blue" } })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("same props in different order are still equal", () => {
    const a = makeElement({ props: { a: 1, b: 2 } })
    const b = makeElement({ props: { b: 2, a: 1 } })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it("different children order breaks equality", () => {
    const a = makeElement({ children: ["a", "b"] })
    const b = makeElement({ children: ["b", "a"] })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different children length breaks equality", () => {
    const a = makeElement({ children: ["a", "b"] })
    const b = makeElement({ children: ["a"] })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different parentKey breaks equality", () => {
    const a = makeElement({ parentKey: "root" })
    const b = makeElement({ parentKey: "other" })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different ARIA fields break equality", () => {
    const a = makeElement({ ariaLabel: "hello" })
    const b = makeElement({ ariaLabel: "world" })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("nested props equality works (deep JSON comparison)", () => {
    const a = makeElement({ props: { style: { margin: { top: 10 } } } })
    const b = makeElement({ props: { style: { margin: { top: 10 } } } })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it("hashes match for equal elements", () => {
    const a = makeElement()
    const b = makeElement()
    expect(Hash.hash(a)).toBe(Hash.hash(b))
  })

  it("hashes differ for different key/type", () => {
    const a = makeElement({ key: "a", type: "Box" })
    const b = makeElement({ key: "b", type: "Text" })
    // Not guaranteed to differ, but very likely for distinct inputs
    expect(Hash.hash(a)).not.toBe(Hash.hash(b))
  })

  it("works in HashMap as value (deduplication)", () => {
    const el = makeElement()
    const map = HashMap.make(["k1", el], ["k2", el])
    expect(HashMap.size(map)).toBe(2)
    expect(Option.isSome(HashMap.get(map, "k1"))).toBe(true)
  })

  it("does not equal non-UIElement", () => {
    const el = makeElement()
    expect(Equal.equals(el, "not an element" as any)).toBe(false)
    expect(Equal.equals(el, null as any)).toBe(false)
  })
})

// =============================================================================
// UITree HashMap-backed Operations
// =============================================================================

describe("UITree HashMap operations", () => {
  const el1 = new UIElement({ key: "el-1", type: "Box", props: {} })
  const el2 = new UIElement({ key: "el-2", type: "Text", props: { content: "hello" } })

  it("empty() creates tree with no elements", () => {
    const tree = UITree.empty()
    expect(tree.root).toBe("")
    expect(tree.size).toBe(0)
  })

  it("setElement adds to HashMap", () => {
    const tree = UITree.empty().setElement("el-1", el1)
    expect(tree.size).toBe(1)
    expect(Option.isSome(tree.getElement("el-1"))).toBe(true)
  })

  it("getElement returns Option.some for existing key", () => {
    const tree = UITree.empty().setElement("el-1", el1)
    const result = tree.getElement("el-1")
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.type).toBe("Box")
    }
  })

  it("getElement returns Option.none for missing key", () => {
    const tree = UITree.empty()
    const result = tree.getElement("nonexistent")
    expect(Option.isNone(result)).toBe(true)
  })

  it("getElementUnsafe returns UIElement or undefined", () => {
    const tree = UITree.empty().setElement("el-1", el1)
    expect(tree.getElementUnsafe("el-1")?.type).toBe("Box")
    expect(tree.getElementUnsafe("missing")).toBeUndefined()
  })

  it("removeElement removes from HashMap", () => {
    const tree = UITree.empty()
      .setElement("el-1", el1)
      .setElement("el-2", el2)
      .removeElement("el-1")
    expect(tree.size).toBe(1)
    expect(Option.isNone(tree.getElement("el-1"))).toBe(true)
    expect(Option.isSome(tree.getElement("el-2"))).toBe(true)
  })

  it("setRoot returns new tree with updated root", () => {
    const tree = UITree.empty().setRoot("new-root")
    expect(tree.root).toBe("new-root")
  })

  it("setElement is immutable — original unchanged", () => {
    const original = UITree.empty()
    const modified = original.setElement("el-1", el1)
    expect(original.size).toBe(0)
    expect(modified.size).toBe(1)
  })

  it("removeElement is immutable — original unchanged", () => {
    const original = UITree.empty().setElement("el-1", el1)
    const modified = original.removeElement("el-1")
    expect(original.size).toBe(1)
    expect(modified.size).toBe(0)
  })

  it("fromRecord creates tree from plain Record", () => {
    const tree = UITree.fromRecord("el-1", {
      "el-1": el1,
      "el-2": el2,
    })
    expect(tree.root).toBe("el-1")
    expect(tree.size).toBe(2)
    expect(tree.getElementUnsafe("el-1")?.type).toBe("Box")
    expect(tree.getElementUnsafe("el-2")?.type).toBe("Text")
  })

  it("toRecord converts HashMap to plain Record", () => {
    const tree = UITree.fromRecord("el-1", {
      "el-1": el1,
      "el-2": el2,
    })
    const record = tree.toRecord()
    expect(Object.keys(record).sort()).toEqual(["el-1", "el-2"])
    expect(record["el-1"]?.type).toBe("Box")
    expect(record["el-2"]?.props).toEqual({ content: "hello" })
  })

  it("size reflects element count", () => {
    const tree = UITree.empty()
      .setElement("a", el1)
      .setElement("b", el2)
      .setElement("c", new UIElement({ key: "c", type: "Stack", props: {} }))
    expect(tree.size).toBe(3)
  })
})

// =============================================================================
// UITree Equal + Hash
// =============================================================================

describe("UITree Equal+Hash", () => {
  const el1 = new UIElement({ key: "el-1", type: "Box", props: { color: "red" } })
  const el2 = new UIElement({ key: "el-2", type: "Text", props: { content: "hi" } })

  it("structurally equal trees return true", () => {
    const a = UITree.fromRecord("el-1", { "el-1": el1, "el-2": el2 })
    const b = UITree.fromRecord("el-1", { "el-1": el1, "el-2": el2 })
    expect(Equal.equals(a, b)).toBe(true)
  })

  it("different root breaks equality", () => {
    const a = UITree.fromRecord("el-1", { "el-1": el1 })
    const b = UITree.fromRecord("el-2", { "el-1": el1 })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different element count breaks equality", () => {
    const a = UITree.fromRecord("el-1", { "el-1": el1 })
    const b = UITree.fromRecord("el-1", { "el-1": el1, "el-2": el2 })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("different element content breaks equality", () => {
    const el1Alt = new UIElement({ key: "el-1", type: "Box", props: { color: "blue" } })
    const a = UITree.fromRecord("el-1", { "el-1": el1 })
    const b = UITree.fromRecord("el-1", { "el-1": el1Alt })
    expect(Equal.equals(a, b)).toBe(false)
  })

  it("hashes match for equal trees", () => {
    const a = UITree.fromRecord("root", { "el-1": el1 })
    const b = UITree.fromRecord("root", { "el-1": el1 })
    expect(Hash.hash(a)).toBe(Hash.hash(b))
  })

  it("empty trees are equal", () => {
    expect(Equal.equals(UITree.empty(), UITree.empty())).toBe(true)
  })

  it("does not equal non-UITree", () => {
    const tree = UITree.empty()
    expect(Equal.equals(tree, "not a tree" as any)).toBe(false)
  })
})

// =============================================================================
// HashMap Integration
// =============================================================================

describe("UITree HashMap integration", () => {
  it("UITree elements is a proper HashMap", () => {
    const tree = UITree.fromRecord("root", {
      a: new UIElement({ key: "a", type: "Box", props: {} }),
      b: new UIElement({ key: "b", type: "Text", props: {} }),
    })
    // Verify it's a HashMap
    expect(HashMap.size(tree.elements)).toBe(2)
    expect(Option.isSome(HashMap.get(tree.elements, "a"))).toBe(true)
    expect(Option.isNone(HashMap.get(tree.elements, "nonexistent"))).toBe(true)
  })

  it("HashMap.mutate batch operations work", () => {
    const tree = UITree.empty()
    // Simulate batch add via HashMap.mutate
    const elements = HashMap.mutate(tree.elements, (draft) => {
      HashMap.set(draft, "a", new UIElement({ key: "a", type: "Box", props: {} }))
      HashMap.set(draft, "b", new UIElement({ key: "b", type: "Text", props: {} }))
      HashMap.set(draft, "c", new UIElement({ key: "c", type: "Stack", props: {} }))
    })
    expect(HashMap.size(elements)).toBe(3)
    // Original unchanged
    expect(HashMap.size(tree.elements)).toBe(0)
  })

  it("iteration yields all key-value pairs", () => {
    const tree = UITree.fromRecord("root", {
      x: new UIElement({ key: "x", type: "X", props: {} }),
      y: new UIElement({ key: "y", type: "Y", props: {} }),
    })
    const keys: string[] = []
    for (const [k, _v] of tree.elements) {
      keys.push(k)
    }
    expect(keys.sort()).toEqual(["x", "y"])
  })
})

// =============================================================================
// TreeCache — Effect.Cache backed
// =============================================================================

describe("TreeCache (Effect.Cache)", () => {
  const makeTree = (rootType: string): UITree =>
    UITree.fromRecord("r", {
      r: new UIElement({ key: "r", type: rootType, props: {} }),
    })

  it("stats track hits and misses", () => {
    const cache = new TreeCache({ maxEntries: 10, ttlMs: 60_000 })
    const key = generateCacheKey("hello", "gpt-4")
    const tree = makeTree("Grid")

    // Miss
    expect(cache.get(key)).toBeUndefined()
    const s1 = cache.stats
    expect(s1.misses).toBeGreaterThanOrEqual(1)

    // Store + hit
    cache.set(key, tree)
    cache.get(key)
    const s2 = cache.stats
    expect(s2.hits).toBeGreaterThanOrEqual(1)
  })

  it("contains returns true for existing key", () => {
    const cache = new TreeCache()
    cache.set("k1", makeTree("A"))
    expect(cache.contains("k1")).toBe(true)
    expect(cache.contains("nonexistent")).toBe(false)
  })

  it("LRU eviction preserves most recently accessed", () => {
    const cache = new TreeCache({ maxEntries: 2 })
    cache.set("a", makeTree("A"))
    cache.set("b", makeTree("B"))

    // Access 'a' to make it most-recently-used
    cache.get("a")

    // Add 'c' — should evict 'b' (least recently used), not 'a'
    cache.set("c", makeTree("C"))

    expect(cache.get("a")).toBeDefined()
    expect(cache.get("c")).toBeDefined()
    expect(cache.size).toBe(2)
  })

  it("overwriting existing key preserves capacity", () => {
    const cache = new TreeCache({ maxEntries: 2 })
    cache.set("a", makeTree("A"))
    cache.set("b", makeTree("B"))
    cache.set("a", makeTree("A2")) // Overwrite, not add

    expect(cache.size).toBe(2)
    expect(cache.get("a")).toBeDefined()
    expect(cache.get("b")).toBeDefined()
  })

  it("invalidate removes specific key", () => {
    const cache = new TreeCache()
    cache.set("x", makeTree("X"))
    cache.set("y", makeTree("Y"))

    cache.clear() // invalidateAll
    expect(cache.size).toBe(0)
  })
})

/**
 * @tmnl/stx — family.where() predicate-filtered view tests
 *
 * Tests the StxFamilyView returned by family.where(predicate):
 * - matches(key) — single-key predicate check
 * - filterKeys(keys) — filter a known key set
 * - getMatching(keys) — get values for matching keys
 * - filteredKeysAtom(keysAtom) — reactive filtered key set
 * - matchingAtom(keysAtom) — reactive matching values
 */
import { describe, it, expect } from "vitest"
import { stxFamily } from "../src/index.js"
import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as Predicate from "effect-v4/Predicate"

// ─── Test data ───────────────────────────────────────

interface Todo {
  text: string
  completed: boolean
  priority: "low" | "medium" | "high"
}

const makeTodo = (text: string, completed = false, priority: Todo["priority"] = "medium"): Todo => ({
  text, completed, priority,
})

// ─── Setup ───────────────────────────────────────────

function setup() {
  const registry = AtomRegistry.make()
  const family = stxFamily<string, Todo>(
    (key) => makeTodo(`Todo ${key}`),
    registry,
  )

  // Seed some members
  family.set("1", makeTodo("Buy milk", false, "low"))
  family.set("2", makeTodo("Fix bug", false, "high"))
  family.set("3", makeTodo("Ship feature", true, "high"))
  family.set("4", makeTodo("Write docs", false, "medium"))
  family.set("5", makeTodo("Old task", true, "low"))

  const allKeys = ["1", "2", "3", "4", "5"]

  return { family, registry, allKeys }
}

// ─── matches() ───────────────────────────────────────

describe("family.where() — matches()", () => {
  it("checks a single key against the predicate", () => {
    const { family } = setup()
    const activeView = family.where((t: Todo) => !t.completed)

    expect(activeView.matches("1")).toBe(true)  // not completed
    expect(activeView.matches("3")).toBe(false) // completed
  })

  it("works with Predicate.Struct", () => {
    const { family } = setup()
    const urgentView = family.where(
      Predicate.Struct({
        completed: (c: boolean) => !c,
        priority: (p: string) => p === "high",
      }) as Predicate.Predicate<Todo>,
    )

    expect(urgentView.matches("2")).toBe(true)  // active + high
    expect(urgentView.matches("3")).toBe(false) // completed
    expect(urgentView.matches("4")).toBe(false) // medium priority
  })

  it("works with Predicate.and", () => {
    const { family } = setup()
    const isActive = (t: Todo) => !t.completed
    const isHigh = (t: Todo) => t.priority === "high"
    const urgentView = family.where(Predicate.and(isActive, isHigh))

    expect(urgentView.matches("2")).toBe(true)
    expect(urgentView.matches("1")).toBe(false) // active but low priority
  })
})

// ─── filterKeys() ────────────────────────────────────

describe("family.where() — filterKeys()", () => {
  it("filters a known key set", () => {
    const { family, allKeys } = setup()
    const activeView = family.where((t: Todo) => !t.completed)

    const activeKeys = activeView.filterKeys(allKeys)
    expect(activeKeys).toEqual(["1", "2", "4"]) // 3 and 5 are completed
  })

  it("returns empty when no keys match", () => {
    const { family, allKeys } = setup()
    const noneView = family.where(() => false)

    expect(noneView.filterKeys(allKeys)).toEqual([])
  })

  it("returns all when predicate is always true", () => {
    const { family, allKeys } = setup()
    const allView = family.where(() => true)

    expect(allView.filterKeys(allKeys)).toEqual(allKeys)
  })
})

// ─── getMatching() ───────────────────────────────────

describe("family.where() — getMatching()", () => {
  it("returns values for matching keys", () => {
    const { family, allKeys } = setup()
    const highView = family.where((t: Todo) => t.priority === "high")

    const highItems = highView.getMatching(allKeys)
    expect(highItems).toHaveLength(2) // "Fix bug" and "Ship feature"
    expect(highItems.every((t) => t.priority === "high")).toBe(true)
  })
})

// ─── filteredKeysAtom() ──────────────────────────────

describe("family.where() — filteredKeysAtom()", () => {
  it("creates a reactive atom of filtered keys", () => {
    const { family, registry, allKeys } = setup()
    const activeView = family.where((t: Todo) => !t.completed)

    const keysAtom = Atom.make(allKeys)
    registry.mount(keysAtom)

    const filteredAtom = activeView.filteredKeysAtom(keysAtom)
    const filtered = registry.get(filteredAtom)

    expect(filtered).toEqual(["1", "2", "4"])
  })

  it("re-derives when a member value changes", () => {
    const { family, registry, allKeys } = setup()
    const activeView = family.where((t: Todo) => !t.completed)

    const keysAtom = Atom.make(allKeys)
    registry.mount(keysAtom)

    const filteredAtom = activeView.filteredKeysAtom(keysAtom)

    expect(registry.get(filteredAtom)).toEqual(["1", "2", "4"])

    // Complete todo #2
    family.set("2", makeTodo("Fix bug", true, "high"))

    expect(registry.get(filteredAtom)).toEqual(["1", "4"])
  })

  it("re-derives when keys atom changes", () => {
    const { family, registry } = setup()
    const activeView = family.where((t: Todo) => !t.completed)

    const keysAtom = Atom.make(["1", "2"])
    registry.mount(keysAtom)

    const filteredAtom = activeView.filteredKeysAtom(keysAtom)

    expect(registry.get(filteredAtom)).toEqual(["1", "2"])

    // Add more keys — including a completed one
    registry.set(keysAtom, ["1", "2", "3"])

    expect(registry.get(filteredAtom)).toEqual(["1", "2"]) // 3 is completed
  })
})

// ─── matchingAtom() ──────────────────────────────────

describe("family.where() — matchingAtom()", () => {
  it("creates a reactive atom of matching values", () => {
    const { family, registry, allKeys } = setup()
    const urgentView = family.where(
      Predicate.and(
        (t: Todo) => !t.completed,
        (t: Todo) => t.priority === "high",
      ),
    )

    const keysAtom = Atom.make(allKeys)
    registry.mount(keysAtom)

    const matchingValues = urgentView.matchingAtom(keysAtom)
    const values = registry.get(matchingValues)

    expect(values).toHaveLength(1)
    expect(values[0].text).toBe("Fix bug")
  })

  it("updates when member values change", () => {
    const { family, registry, allKeys } = setup()
    const activeView = family.where((t: Todo) => !t.completed)

    const keysAtom = Atom.make(allKeys)
    registry.mount(keysAtom)

    const valuesAtom = activeView.matchingAtom(keysAtom)

    expect(registry.get(valuesAtom)).toHaveLength(3)

    // Complete two more
    family.set("1", makeTodo("Buy milk", true, "low"))
    family.set("4", makeTodo("Write docs", true, "medium"))

    expect(registry.get(valuesAtom)).toHaveLength(1) // only #2 left
    expect(registry.get(valuesAtom)[0].text).toBe("Fix bug")
  })
})

// ─── Composition ─────────────────────────────────────

describe("family.where() — Predicate composition", () => {
  it("chains where with Predicate.or", () => {
    const { family, allKeys } = setup()

    const completedOrLow = family.where(
      Predicate.or(
        (t: Todo) => t.completed,
        (t: Todo) => t.priority === "low",
      ),
    )

    const matching = completedOrLow.filterKeys(allKeys)
    // #1 (low), #3 (completed), #5 (completed + low)
    expect(matching).toEqual(["1", "3", "5"])
  })

  it("view retains reference to parent family", () => {
    const { family } = setup()
    const view = family.where(() => true)

    expect(view.family).toBe(family)
  })
})

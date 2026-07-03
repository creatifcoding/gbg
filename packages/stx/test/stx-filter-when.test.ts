/**
 * @tmnl/stx — filter() + when() derived atom tests
 *
 * Tests the two complementary predicate-driven derived atom primitives:
 * - store.filter(lens, project) → Atom<B>
 * - store.when(lens, predicate, onFailure) → Atom<Result<A, E>>
 */
import { describe, it, expect } from "vitest"
import { stx } from "../src/index.js"
import * as Result from "effect/Result"
import * as Predicate from "effect/Predicate"

// ─── Test data ───────────────────────────────────────

interface Todo {
  id: string
  text: string
  completed: boolean
  priority: "low" | "medium" | "high"
}

interface AppState {
  todos: Todo[]
  selectedId: string | null
  user: { email: string; name: string }
}

const makeTodos = (): Todo[] => [
  { id: "1", text: "Buy milk", completed: false, priority: "low" },
  { id: "2", text: "Fix bug", completed: false, priority: "high" },
  { id: "3", text: "Ship feature", completed: true, priority: "high" },
  { id: "4", text: "Write docs", completed: false, priority: "medium" },
]

const makeState = (): AppState => ({
  todos: makeTodos(),
  selectedId: "2",
  user: { email: "alice@example.com", name: "Alice" },
})

// ─── store.filter() ──────────────────────────────────

describe("store.filter()", () => {
  it("projects a filtered subset of an array", () => {
    const store = stx(makeState())
    const activeAtom = store.filter(
      store.lens.todos,
      (todos: Todo[]) => todos.filter((t) => !t.completed),
    )

    const active = store.registry.get(activeAtom)
    expect(active).toHaveLength(3) // items 1, 2, 4
    expect(active.every((t: Todo) => !t.completed)).toBe(true)
  })

  it("works with Predicate.Struct composition", () => {
    const store = stx(makeState())

    const isUrgent = Predicate.Struct({
      completed: (c: boolean) => !c,
      priority: (p: string) => p === "high",
    })

    const urgentAtom = store.filter(
      store.lens.todos,
      (todos: Todo[]) => todos.filter(isUrgent as (t: Todo) => boolean),
    )

    const urgent = store.registry.get(urgentAtom)
    expect(urgent).toHaveLength(1) // only "Fix bug"
    expect(urgent[0].text).toBe("Fix bug")
  })

  it("works with Predicate.and composition", () => {
    const store = stx(makeState())

    const isActive = (t: Todo) => !t.completed
    const isHighPriority = (t: Todo) => t.priority === "high"
    const isUrgentActive = Predicate.and(isActive, isHighPriority)

    const urgentAtom = store.filter(
      store.lens.todos,
      (todos: Todo[]) => todos.filter(isUrgentActive),
    )

    const urgent = store.registry.get(urgentAtom)
    expect(urgent).toHaveLength(1)
    expect(urgent[0].id).toBe("2")
  })

  it("re-derives when root state changes", () => {
    const store = stx(makeState())
    const activeAtom = store.filter(
      store.lens.todos,
      (todos: Todo[]) => todos.filter((t) => !t.completed),
    )

    expect(store.registry.get(activeAtom)).toHaveLength(3)

    // Complete one todo
    store.modify(store.lens.todos, (todos: Todo[]) =>
      todos.map((t) => (t.id === "2" ? { ...t, completed: true } : t)),
    )

    expect(store.registry.get(activeAtom)).toHaveLength(2)
  })

  it("projects scalar values (not just arrays)", () => {
    const store = stx(makeState())
    const emailDomain = store.filter(
      store.lens.user.email,
      (email: string) => email.split("@")[1] ?? "",
    )

    expect(store.registry.get(emailDomain)).toBe("example.com")
  })

  it("returns memoized atom for same lens + project", () => {
    const store = stx(makeState())
    const project = (todos: Todo[]) => todos.filter((t) => !t.completed)

    const a1 = store.filter(store.lens.todos, project)
    const a2 = store.filter(store.lens.todos, project)
    expect(a1).toBe(a2) // same reference
  })
})

// ─── store.when() ────────────────────────────────────

describe("store.when()", () => {
  it("returns Success when predicate passes", () => {
    const store = stx(makeState())
    const validEmail = store.when(
      store.lens.user.email,
      (email: string) => email.includes("@"),
      (email: string) => `Invalid email: ${email}`,
    )

    const result = store.registry.get(validEmail)
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success).toBe("alice@example.com")
    }
  })

  it("returns Failure when predicate rejects", () => {
    const store = stx({ email: "not-an-email", name: "Bob" })
    const validEmail = store.when(
      store.lens.email,
      (email: string) => email.includes("@"),
      (email: string) => `Invalid email: ${email}`,
    )

    const result = store.registry.get(validEmail)
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBe("Invalid email: not-an-email")
    }
  })

  it("flips when underlying value changes", () => {
    const store = stx({ email: "bad", name: "Bob" })
    const validEmail = store.when(
      store.lens.email,
      (email: string) => email.includes("@"),
      (email: string) => `Invalid: ${email}`,
    )

    // Initially fails
    expect(Result.isFailure(store.registry.get(validEmail))).toBe(true)

    // Fix the email
    store.setAt(store.lens.email, "bob@example.com")

    // Now succeeds
    const result = store.registry.get(validEmail)
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success).toBe("bob@example.com")
    }
  })

  it("composes with Result.match for rendering", () => {
    const store = stx(makeState())
    const validEmail = store.when(
      store.lens.user.email,
      (email: string) => email.includes("@"),
      (email: string) => `Invalid: ${email}`,
    )

    const label = Result.match(store.registry.get(validEmail), {
      onSuccess: (e) => `✓ ${e}`,
      onFailure: (e) => `✗ ${e}`,
    })
    expect(label).toBe("✓ alice@example.com")
  })

  it("composes with Result.map for transformation", () => {
    const store = stx(makeState())
    const emailDomain = store.when(
      store.lens.user.email,
      (email: string) => email.includes("@"),
      () => "no-domain",
    )

    const domain = Result.map(
      store.registry.get(emailDomain),
      (email) => email.split("@")[1],
    )
    expect(Result.isSuccess(domain)).toBe(true)
    if (Result.isSuccess(domain)) {
      expect(domain.success).toBe("example.com")
    }
  })

  it("works with Predicate.isNotNull for nullable checks", () => {
    const store = stx(makeState())
    const selectedAtom = store.when(
      store.lens.selectedId,
      Predicate.isNotNull as (v: string | null) => boolean,
      () => "Nothing selected",
    )

    const r1 = store.registry.get(selectedAtom)
    expect(Result.isSuccess(r1)).toBe(true)

    // Clear selection
    store.setAt(store.lens.selectedId, null)

    const r2 = store.registry.get(selectedAtom)
    expect(Result.isFailure(r2)).toBe(true)
    if (Result.isFailure(r2)) {
      expect(r2.failure).toBe("Nothing selected")
    }
  })

  it("returns memoized atom for same lens + predicate + onFailure", () => {
    const store = stx(makeState())
    const pred = (email: string) => email.includes("@")
    const onFail = (email: string) => `bad: ${email}`

    const a1 = store.when(store.lens.user.email, pred, onFail)
    const a2 = store.when(store.lens.user.email, pred, onFail)
    expect(a1).toBe(a2)
  })
})

// ─── Composition: filter + when together ─────────────

describe("filter() + when() composition", () => {
  it("filter narrows the set, when gates individual selection", () => {
    const store = stx(makeState())

    // filter: get active todos
    const activeAtom = store.filter(
      store.lens.todos,
      (todos: Todo[]) => todos.filter((t) => !t.completed),
    )

    // when: gate selectedId
    const selectedAtom = store.when(
      store.lens.selectedId,
      Predicate.isNotNull as (v: string | null) => boolean,
      () => "No selection",
    )

    const active = store.registry.get(activeAtom)
    const selected = store.registry.get(selectedAtom)

    expect(active).toHaveLength(3)
    expect(Result.isSuccess(selected)).toBe(true)

    // Can find the selected item in active list
    if (Result.isSuccess(selected)) {
      const found = active.find((t: Todo) => t.id === selected.success)
      expect(found).toBeDefined()
      expect(found!.text).toBe("Fix bug")
    }
  })
})

/**
 * @tmnl/entity — guard() + refine() tests
 *
 * Tests Entity.guard() and Entity.refine() for composable predicate/refinement
 * factories that integrate with Predicate.Struct, Predicate.and/or, and Result.liftPredicate.
 */
import { describe, it, expect } from "vitest"
import { Entity } from "../src/entity.js"
import * as Schema from "effect-v4/Schema"
import * as Predicate from "effect-v4/Predicate"
import * as Result from "effect-v4/Result"

// ─── Test Entity ─────────────────────────────────────

const Priority = Schema.Literals(["low", "medium", "high"] as const)

class Todo extends Entity("Todo")({
  id: Entity.generated(Schema.Number),
  text: Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority: Priority,
}) {}

// ─── Entity.guard() ──────────────────────────────────

describe("Entity.guard()", () => {
  const activeTodo = new Todo({
    id: 1, text: "Buy milk", completed: false, priority: "high",
  })
  const completedTodo = new Todo({
    id: 2, text: "Ship it", completed: true, priority: "low",
  })
  const mediumTodo = new Todo({
    id: 3, text: "Old stuff", completed: false, priority: "medium",
  })

  it("creates a predicate from a plain function", () => {
    const isActive = Todo.guard((t: Todo) => !t.completed)

    expect(isActive(activeTodo)).toBe(true)
    expect(isActive(completedTodo)).toBe(false)
  })

  it("works with Predicate.Struct for field-level checks", () => {
    const isActive = Todo.guard(
      Predicate.Struct({
        completed: (c: boolean) => !c,
      }) as Predicate.Predicate<Todo>,
    )

    expect(isActive(activeTodo)).toBe(true)
    expect(isActive(completedTodo)).toBe(false)
  })

  it("composes with Predicate.and", () => {
    const isActive = Todo.guard((t: Todo) => !t.completed)
    const isHighPriority = Todo.guard((t: Todo) => t.priority === "high")
    const isUrgent = Predicate.and(isActive, isHighPriority)

    expect(isUrgent(activeTodo)).toBe(true)   // active + high
    expect(isUrgent(completedTodo)).toBe(false) // completed
    expect(isUrgent(mediumTodo)).toBe(false)   // medium priority
  })

  it("composes with Predicate.or", () => {
    const isCompleted = Todo.guard((t: Todo) => t.completed)
    const isLowPriority = Todo.guard((t: Todo) => t.priority === "low")
    const isDone = Predicate.or(isCompleted, isLowPriority)

    expect(isDone(activeTodo)).toBe(false)     // not completed, high priority
    expect(isDone(completedTodo)).toBe(true)   // completed
    expect(isDone(mediumTodo)).toBe(false)     // not completed, medium priority
  })

  it("composes with Predicate.not", () => {
    const isActive = Todo.guard((t: Todo) => !t.completed)
    const isInactive = Predicate.not(isActive)

    expect(isInactive(activeTodo)).toBe(false)
    expect(isInactive(completedTodo)).toBe(true)
  })

  it("works with Array.filter", () => {
    const todos = [activeTodo, completedTodo, mediumTodo]
    const isActive = Todo.guard((t: Todo) => !t.completed)

    const active = todos.filter(isActive)
    expect(active).toHaveLength(2) // activeTodo + mediumTodo
    expect(active.every((t) => !t.completed)).toBe(true)
  })

  it("works with Result.liftPredicate", () => {
    const isActive = Todo.guard((t: Todo) => !t.completed)

    const r1 = Result.liftPredicate(activeTodo, isActive, (t) => `${t.text} is completed`)
    expect(Result.isSuccess(r1)).toBe(true)

    const r2 = Result.liftPredicate(completedTodo, isActive, (t) => `${t.text} is completed`)
    expect(Result.isFailure(r2)).toBe(true)
    if (Result.isFailure(r2)) {
      expect(r2.failure).toBe("Ship it is completed")
    }
  })

  it("works with Result.filterOrFail on an existing Result", () => {
    const isHighPriority = Todo.guard((t: Todo) => t.priority === "high")

    const r = Result.filterOrFail(
      Result.succeed(activeTodo),
      isHighPriority,
      (t) => `${t.text} is not high priority`,
    )
    expect(Result.isSuccess(r)).toBe(true)

    const r2 = Result.filterOrFail(
      Result.succeed(completedTodo),
      isHighPriority,
      (t) => `${t.text} is not high priority`,
    )
    expect(Result.isFailure(r2)).toBe(true)
  })

  it("composes with Predicate.every for multiple checks", () => {
    const checks: Predicate.Predicate<Todo>[] = [
      (t) => !t.completed,
      (t) => t.priority === "high",
      (t) => t.text.length > 0,
    ]
    const allChecks = Predicate.every(checks)

    expect(allChecks(activeTodo)).toBe(true)     // passes all
    expect(allChecks(completedTodo)).toBe(false)  // fails: completed
    expect(allChecks(mediumTodo)).toBe(false)    // fails: medium priority
  })
})

// ─── Entity.refine() ─────────────────────────────────

describe("Entity.refine()", () => {
  // Narrowed type — completed is literally false
  interface ActiveTodo extends Todo {
    readonly completed: false
  }

  const activeTodo = new Todo({
    id: 1, text: "Buy milk", completed: false, priority: "high",
  })
  const completedTodo = new Todo({
    id: 2, text: "Ship it", completed: true, priority: "low",
  })

  it("creates a type-narrowing refinement", () => {
    const isActive = Todo.refine<Todo, ActiveTodo>(
      (t): t is ActiveTodo => t.completed === false,
    )

    expect(isActive(activeTodo)).toBe(true)
    expect(isActive(completedTodo)).toBe(false)
  })

  it("narrows type in conditional", () => {
    const isActive = Todo.refine<Todo, ActiveTodo>(
      (t): t is ActiveTodo => t.completed === false,
    )

    const todo: Todo = activeTodo

    if (isActive(todo)) {
      // TypeScript narrows todo to ActiveTodo here
      const _: false = todo.completed
      expect(_).toBe(false)
    }
  })

  it("works with Result.liftPredicate for typed narrowing", () => {
    const isActive = Todo.refine<Todo, ActiveTodo>(
      (t): t is ActiveTodo => t.completed === false,
    )

    const r = Result.liftPredicate(
      activeTodo as Todo,
      isActive,
      (t) => `${t.text} is not active`,
    )

    expect(Result.isSuccess(r)).toBe(true)
    // The Result type should be Result<ActiveTodo, string>
    if (Result.isSuccess(r)) {
      expect(r.success.completed).toBe(false)
    }
  })

  it("composes with Predicate.and (refinement + predicate)", () => {
    const isActive = Todo.refine<Todo, ActiveTodo>(
      (t): t is ActiveTodo => t.completed === false,
    )
    const isHighPriority: Predicate.Predicate<Todo> = (t) => t.priority === "high"

    // Predicate.and preserves the refinement when first arg is a refinement
    const isUrgent = Predicate.and(isActive, isHighPriority)

    expect(isUrgent(activeTodo)).toBe(true)
    expect(isUrgent(completedTodo)).toBe(false)
  })
})

// ─── Composition: guard + refine + Result pipeline ───

describe("guard + refine + Result pipeline", () => {
  it("full pipeline: decode → guard → transform", () => {
    const wire = { id: 1, text: "Test", completed: false, priority: "high" }

    const isActive = Todo.guard((t: Todo) => !t.completed)

    const pipeline = Result.gen(function*() {
      const todo = yield* Todo.codec.decode(wire)
      yield* Result.filterOrFail(
        Result.succeed(todo as Todo),
        isActive,
        () => "Todo is completed",
      )
      return todo
    })

    expect(Result.isSuccess(pipeline)).toBe(true)
  })

  it("pipeline fails when guard rejects", () => {
    const wire = { id: 2, text: "Done", completed: true, priority: "low" }

    const isActive = Todo.guard((t: Todo) => !t.completed)

    const pipeline = Result.gen(function*() {
      const todo = yield* Todo.codec.decode(wire)
      yield* Result.filterOrFail(
        Result.succeed(todo as Todo),
        isActive,
        () => "Todo is completed",
      )
      return todo
    })

    expect(Result.isFailure(pipeline)).toBe(true)
    if (Result.isFailure(pipeline)) {
      expect(pipeline.failure).toBe("Todo is completed")
    }
  })
})

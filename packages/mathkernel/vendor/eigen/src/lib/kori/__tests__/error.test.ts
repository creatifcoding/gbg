/**
 * KORI Error Hierarchy Tests
 *
 * Unit tests for exhaustive error handling via Data.TaggedError.
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect, pipe, Exit, Match } from "effect"
import {
  // Entity errors
  EntityNotFound,
  EntityAlreadyExists,
  EntityDestroyed,
  // Trait errors
  TraitMissing,
  TraitAlreadyAttached,
  TraitValidationFailed,
  // Query errors
  QueryEmpty,
  QueryMultipleResults,
  // World errors
  WorldDisposed,
  WorldLocked,
  // Schema errors
  SchemaValidationError,
  SchemaTransformError,
  // Stream errors
  BackpressureExceeded,
  SubscriptionFailed,
  // Actor/Graph errors
  ActorSpawnFailed,
  NodeExecutionFailed,
  GraphCycleDetected,
  // Union
  type KoriError,
} from "../errors"

// ─────────────────────────────────────────────────────────────────────────────
// Error Construction Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Error construction", () => {
  it("EntityNotFound has correct _tag", () => {
    const error = new EntityNotFound({ entityId: "e1", worldId: "w1" })

    expect(error._tag).toBe("EntityNotFound")
    expect(error.entityId).toBe("e1")
    expect(error.worldId).toBe("w1")
  })

  it("EntityAlreadyExists has correct _tag", () => {
    const error = new EntityAlreadyExists({ entityId: "e1", worldId: "w1" })

    expect(error._tag).toBe("EntityAlreadyExists")
  })

  it("EntityDestroyed has correct _tag", () => {
    const error = new EntityDestroyed({ entityId: "e1" })

    expect(error._tag).toBe("EntityDestroyed")
  })

  it("TraitMissing has correct _tag", () => {
    const error = new TraitMissing({ entityId: "e1", traitId: "Health" })

    expect(error._tag).toBe("TraitMissing")
    expect(error.traitId).toBe("Health")
  })

  it("TraitAlreadyAttached has correct _tag", () => {
    const error = new TraitAlreadyAttached({ entityId: "e1", traitId: "Health" })

    expect(error._tag).toBe("TraitAlreadyAttached")
  })

  it("TraitValidationFailed has correct _tag", () => {
    const error = new TraitValidationFailed({
      traitId: "Health",
      reason: "Invalid data",
      data: { bad: "data" },
    })

    expect(error._tag).toBe("TraitValidationFailed")
    expect(error.reason).toBe("Invalid data")
  })

  it("QueryEmpty has correct _tag", () => {
    const error = new QueryEmpty({ queryDescription: "entities with Health" })

    expect(error._tag).toBe("QueryEmpty")
  })

  it("QueryMultipleResults has correct _tag", () => {
    const error = new QueryMultipleResults({
      queryDescription: "single entity",
      count: 5,
    })

    expect(error._tag).toBe("QueryMultipleResults")
    expect(error.count).toBe(5)
  })

  it("WorldDisposed has correct _tag", () => {
    const error = new WorldDisposed({ worldId: "w1" })

    expect(error._tag).toBe("WorldDisposed")
  })

  it("WorldLocked has correct _tag", () => {
    const error = new WorldLocked({ worldId: "w1", reason: "batch in progress" })

    expect(error._tag).toBe("WorldLocked")
  })

  it("SchemaValidationError has correct _tag", () => {
    const error = new SchemaValidationError({
      schemaId: "Position2D",
      message: "Expected number",
      path: ["x"],
    })

    expect(error._tag).toBe("SchemaValidationError")
    expect(error.path).toEqual(["x"])
  })

  it("SchemaTransformError has correct _tag", () => {
    const error = new SchemaTransformError({
      from: "string",
      to: "number",
      reason: "Invalid format",
    })

    expect(error._tag).toBe("SchemaTransformError")
  })

  it("BackpressureExceeded has correct _tag", () => {
    const error = new BackpressureExceeded({
      queueName: "mutations",
      limit: 1024,
      current: 1024,
    })

    expect(error._tag).toBe("BackpressureExceeded")
  })

  it("SubscriptionFailed has correct _tag", () => {
    const error = new SubscriptionFailed({
      streamId: "query-stream-1",
      reason: "Connection lost",
    })

    expect(error._tag).toBe("SubscriptionFailed")
  })

  it("ActorSpawnFailed has correct _tag", () => {
    const error = new ActorSpawnFailed({
      actorId: "actor-1",
      reason: "Invalid machine",
    })

    expect(error._tag).toBe("ActorSpawnFailed")
  })

  it("NodeExecutionFailed has correct _tag", () => {
    const error = new NodeExecutionFailed({
      nodeId: "node-1",
      graphId: "graph-1",
      cause: new Error("timeout"),
    })

    expect(error._tag).toBe("NodeExecutionFailed")
  })

  it("GraphCycleDetected has correct _tag", () => {
    const error = new GraphCycleDetected({
      graphId: "graph-1",
      cycle: ["A", "B", "C", "A"],
    })

    expect(error._tag).toBe("GraphCycleDetected")
    expect(error.cycle).toEqual(["A", "B", "C", "A"])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Effect.catchTag Pattern Matching Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Effect.catchTag exhaustive matching", () => {
  it("catchTag handles EntityNotFound", async () => {
    const effect = pipe(
      Effect.fail(new EntityNotFound({ entityId: "e1", worldId: "w1" })),
      Effect.catchTag("EntityNotFound", (e) =>
        Effect.succeed(`recovered: ${e.entityId}`)
      )
    )

    const result = await Effect.runPromise(effect)
    expect(result).toBe("recovered: e1")
  })

  it("catchTag handles TraitMissing", async () => {
    const effect = pipe(
      Effect.fail(new TraitMissing({ entityId: "e1", traitId: "Health" })),
      Effect.catchTag("TraitMissing", (e) =>
        Effect.succeed(`missing trait: ${e.traitId}`)
      )
    )

    const result = await Effect.runPromise(effect)
    expect(result).toBe("missing trait: Health")
  })

  it("catchTag propagates unhandled errors", async () => {
    const effect = pipe(
      Effect.fail(new WorldDisposed({ worldId: "w1" })),
      Effect.catchTag("EntityNotFound", () => Effect.succeed("handled"))
    )

    const exit = await Effect.runPromiseExit(effect)
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("multiple catchTag chains work", async () => {
    const createEffect = (error: KoriError) =>
      pipe(
        Effect.fail(error),
        Effect.catchTag("EntityNotFound", () => Effect.succeed("entity-not-found")),
        Effect.catchTag("TraitMissing", () => Effect.succeed("trait-missing")),
        Effect.catchTag("WorldDisposed", () => Effect.succeed("world-disposed"))
      )

    const r1 = await Effect.runPromise(
      createEffect(new EntityNotFound({ entityId: "e1", worldId: "w1" }))
    )
    const r2 = await Effect.runPromise(
      createEffect(new TraitMissing({ entityId: "e1", traitId: "Health" }))
    )
    const r3 = await Effect.runPromise(
      createEffect(new WorldDisposed({ worldId: "w1" }))
    )

    expect(r1).toBe("entity-not-found")
    expect(r2).toBe("trait-missing")
    expect(r3).toBe("world-disposed")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Error Exhaustiveness Tests (Type-Level)
// ─────────────────────────────────────────────────────────────────────────────

describe("KoriError union exhaustiveness", () => {
  /**
   * Helper to test that all error types are accounted for.
   * This uses a switch on _tag for runtime exhaustiveness checking.
   */
  const handleAllErrors = (error: KoriError): string => {
    switch (error._tag) {
      case "EntityNotFound":
        return `EntityNotFound: ${error.entityId}`
      case "EntityAlreadyExists":
        return `EntityAlreadyExists: ${error.entityId}`
      case "EntityDestroyed":
        return `EntityDestroyed: ${error.entityId}`
      case "TraitMissing":
        return `TraitMissing: ${error.traitId}`
      case "TraitAlreadyAttached":
        return `TraitAlreadyAttached: ${error.traitId}`
      case "TraitValidationFailed":
        return `TraitValidationFailed: ${error.traitId}`
      case "QueryEmpty":
        return `QueryEmpty: ${error.queryDescription}`
      case "QueryMultipleResults":
        return `QueryMultipleResults: ${error.count}`
      case "WorldDisposed":
        return `WorldDisposed: ${error.worldId}`
      case "WorldLocked":
        return `WorldLocked: ${error.worldId}`
      case "SchemaValidationError":
        return `SchemaValidationError: ${error.schemaId}`
      case "SchemaTransformError":
        return `SchemaTransformError: ${error.from} -> ${error.to}`
      case "BackpressureExceeded":
        return `BackpressureExceeded: ${error.queueName}`
      case "SubscriptionFailed":
        return `SubscriptionFailed: ${error.streamId}`
      case "ActorSpawnFailed":
        return `ActorSpawnFailed: ${error.actorId}`
      case "NodeExecutionFailed":
        return `NodeExecutionFailed: ${error.nodeId}`
      case "GraphCycleDetected":
        return `GraphCycleDetected: ${error.graphId}`
    }
    // If TypeScript allows reaching here, the union is not exhaustive
    const _exhaustive: never = error
    return _exhaustive
  }

  it("handles all 17 error types", () => {
    const errors: KoriError[] = [
      new EntityNotFound({ entityId: "e1", worldId: "w1" }),
      new EntityAlreadyExists({ entityId: "e1", worldId: "w1" }),
      new EntityDestroyed({ entityId: "e1" }),
      new TraitMissing({ entityId: "e1", traitId: "t1" }),
      new TraitAlreadyAttached({ entityId: "e1", traitId: "t1" }),
      new TraitValidationFailed({ traitId: "t1", reason: "r", data: {} }),
      new QueryEmpty({ queryDescription: "q" }),
      new QueryMultipleResults({ queryDescription: "q", count: 2 }),
      new WorldDisposed({ worldId: "w1" }),
      new WorldLocked({ worldId: "w1", reason: "r" }),
      new SchemaValidationError({ schemaId: "s1", message: "m", path: [] }),
      new SchemaTransformError({ from: "a", to: "b", reason: "r" }),
      new BackpressureExceeded({ queueName: "q", limit: 1, current: 1 }),
      new SubscriptionFailed({ streamId: "s1", reason: "r" }),
      new ActorSpawnFailed({ actorId: "a1", reason: "r" }),
      new NodeExecutionFailed({ nodeId: "n1", graphId: "g1", cause: null }),
      new GraphCycleDetected({ graphId: "g1", cycle: [] }),
    ]

    // All errors should be handled without throwing
    for (const error of errors) {
      expect(() => handleAllErrors(error)).not.toThrow()
    }

    expect(errors.length).toBe(17)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Error is Error Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Errors extend Error", () => {
  it("EntityNotFound is instanceof Error", () => {
    const error = new EntityNotFound({ entityId: "e1", worldId: "w1" })

    expect(error instanceof Error).toBe(true)
  })

  it("TraitValidationFailed is instanceof Error", () => {
    const error = new TraitValidationFailed({
      traitId: "t1",
      reason: "invalid",
      data: {},
    })

    expect(error instanceof Error).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Error Equality Tests (Data.TaggedError)
// ─────────────────────────────────────────────────────────────────────────────

describe("Error equality (Data.TaggedError)", () => {
  it("identical errors are equal", () => {
    const e1 = new EntityNotFound({ entityId: "e1", worldId: "w1" })
    const e2 = new EntityNotFound({ entityId: "e1", worldId: "w1" })

    // Data.TaggedError uses structural equality
    expect(e1).toEqual(e2)
  })

  it("different data means not equal", () => {
    const e1 = new EntityNotFound({ entityId: "e1", worldId: "w1" })
    const e2 = new EntityNotFound({ entityId: "e2", worldId: "w1" })

    expect(e1).not.toEqual(e2)
  })
})

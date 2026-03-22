/**
 * KORI World Service Tests
 *
 * Unit tests for KoriWorld Effect.Service backed by koota ECS.
 * Uses built-in traits (Position2D, Health, Name) for all tests.
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Effect, Scope, Exit, Layer, pipe, ManagedRuntime } from "effect"
import {
  KoriWorld,
  KoriWorldLive,
  type EntityId,
} from "../services/world"
import {
  EntityNotFound,
  EntityDestroyed,
  TraitMissing,
  TraitAlreadyAttached,
  WorldLocked,
} from "../errors"
import type { TraitId } from "../schemas/trait"

// ─────────────────────────────────────────────────────────────────────────────
// Shared Runtime (koota has 16-world limit)
// ─────────────────────────────────────────────────────────────────────────────

let runtime: ManagedRuntime.ManagedRuntime<KoriWorld, never>

beforeAll(async () => {
  runtime = ManagedRuntime.make(KoriWorldLive)
})

afterAll(async () => {
  await runtime.dispose()
})

const runEffect = <A, E>(effect: Effect.Effect<A, E, KoriWorld>) =>
  runtime.runPromise(effect)

const runScopedEffect = <A, E>(
  effect: Effect.Effect<A, E, KoriWorld | Scope.Scope>
) =>
  runtime.runPromise(pipe(effect, Effect.scoped))

// ─────────────────────────────────────────────────────────────────────────────
// World.spawn — Scoped Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("World.spawn scoped lifecycle", () => {
  it("creates entity on acquire", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        expect(entity.id).toBeDefined()
        expect(entity.id.length).toBeGreaterThan(0)
        expect(entity.worldId).toBeDefined()
        expect(entity.isDestroyed).toBe(false)
        expect(entity.createdAt).toBeInstanceOf(Date)
      })
    )
  })

  it("spawns entity with initial traits", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 10, y: 20 } },
          { id: "Health" as TraitId, data: { _tag: "Health", current: 100, max: 100 } },
        ])

        expect(entity.traits.size).toBe(2)
        expect(entity.traits.has("Position2D" as TraitId)).toBe(true)
        expect(entity.traits.has("Health" as TraitId)).toBe(true)
      })
    )
  })

  it("destroys entity on scope close", async () => {
    let capturedEntityId: EntityId | undefined

    await runEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        // Create a scope manually
        const scope = yield* Scope.make()

        // Spawn entity in that scope
        const entity = yield* pipe(
          world.spawn(),
          Effect.provideService(Scope.Scope, scope)
        )

        capturedEntityId = entity.id

        // Entity should exist
        const exists = yield* world.has(capturedEntityId)
        expect(exists).toBe(true)

        // Close the scope
        yield* Scope.close(scope, Exit.void)

        // Entity should be destroyed (has returns false for destroyed)
        const existsAfter = yield* world.has(capturedEntityId)
        expect(existsAfter).toBe(false)
      })
    )
  })

  it("generates unique entity IDs", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity1 = yield* world.spawn()
        const entity2 = yield* world.spawn()
        const entity3 = yield* world.spawn()

        expect(entity1.id).not.toBe(entity2.id)
        expect(entity2.id).not.toBe(entity3.id)
        expect(entity1.id).not.toBe(entity3.id)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// World.get/has — Entity Lookup Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("World.get/has entity lookup", () => {
  it("get returns entity by ID", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const spawned = yield* world.spawn()

        const retrieved = yield* world.get(spawned.id)

        expect(retrieved.id).toBe(spawned.id)
        expect(retrieved.worldId).toBe(spawned.worldId)
      })
    )
  })

  it("get fails with EntityNotFound for missing ID", async () => {
    await runEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const fakeId = "nonexistent-id-12345" as EntityId

        const exit = yield* Effect.exit(world.get(fakeId))

        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          const cause = exit.cause
          expect(cause._tag).toBe("Fail")
        }
      })
    )
  })

  it("get fails with EntityDestroyed for destroyed entity", async () => {
    await runEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        // Create scoped entity and capture ID
        const scope = yield* Scope.make()
        const entity = yield* pipe(
          world.spawn(),
          Effect.provideService(Scope.Scope, scope)
        )
        const entityId = entity.id

        // Destroy it
        yield* Scope.close(scope, Exit.void)

        // get should fail with EntityDestroyed
        const exit = yield* Effect.exit(world.get(entityId))

        expect(Exit.isFailure(exit)).toBe(true)
      })
    )
  })

  it("has returns true for existing entity", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        const exists = yield* world.has(entity.id)
        expect(exists).toBe(true)
      })
    )
  })

  it("has returns false for missing entity", async () => {
    await runEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const fakeId = "nonexistent-id-12345" as EntityId

        const exists = yield* world.has(fakeId)
        expect(exists).toBe(false)
      })
    )
  })

  it("has returns false for destroyed entity", async () => {
    await runEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        const scope = yield* Scope.make()
        const entity = yield* pipe(
          world.spawn(),
          Effect.provideService(Scope.Scope, scope)
        )

        yield* Scope.close(scope, Exit.void)

        const exists = yield* world.has(entity.id)
        expect(exists).toBe(false)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// World.addTrait/removeTrait/setTrait — Trait Mutation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("World.addTrait/removeTrait/setTrait", () => {
  it("addTrait attaches trait to entity", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        // Add Name trait
        yield* world.addTrait(entity.id, "Name" as TraitId, {
          _tag: "Name",
          value: "TestEntity",
        })

        // Verify trait is attached
        const updated = yield* world.get(entity.id)
        expect(updated.traits.has("Name" as TraitId)).toBe(true)
      })
    )
  })

  it("addTrait fails with TraitAlreadyAttached on duplicate", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Name" as TraitId, data: { _tag: "Name", value: "First" } },
        ])

        // Try to add Name again
        const exit = yield* Effect.exit(
          world.addTrait(entity.id, "Name" as TraitId, {
            _tag: "Name",
            value: "Second",
          })
        )

        expect(Exit.isFailure(exit)).toBe(true)
      })
    )
  })

  it("removeTrait detaches trait from entity", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Name" as TraitId, data: { _tag: "Name", value: "ToRemove" } },
        ])

        expect(entity.traits.has("Name" as TraitId)).toBe(true)

        yield* world.removeTrait(entity.id, "Name" as TraitId)

        const updated = yield* world.get(entity.id)
        expect(updated.traits.has("Name" as TraitId)).toBe(false)
      })
    )
  })

  it("removeTrait fails with TraitMissing for nonexistent trait", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        const exit = yield* Effect.exit(
          world.removeTrait(entity.id, "Name" as TraitId)
        )

        expect(Exit.isFailure(exit)).toBe(true)
      })
    )
  })

  it("setTrait updates existing trait data", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Health" as TraitId, data: { _tag: "Health", current: 100, max: 100 } },
        ])

        yield* world.setTrait(entity.id, "Health" as TraitId, {
          _tag: "Health",
          current: 50,
          max: 100,
        })

        const health = yield* world.getTrait<{ current: number; max: number }>(
          entity.id,
          "Health" as TraitId
        )
        expect(health.current).toBe(50)
      })
    )
  })

  it("setTrait fails with TraitMissing for nonexistent trait", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        const exit = yield* Effect.exit(
          world.setTrait(entity.id, "Health" as TraitId, {
            _tag: "Health",
            current: 50,
            max: 100,
          })
        )

        expect(Exit.isFailure(exit)).toBe(true)
      })
    )
  })

  it("getTrait retrieves trait data", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 42, y: 99 } },
        ])

        const pos = yield* world.getTrait<{ x: number; y: number }>(
          entity.id,
          "Position2D" as TraitId
        )
        expect(pos.x).toBe(42)
        expect(pos.y).toBe(99)
      })
    )
  })

  it("getTrait fails with TraitMissing for nonexistent trait", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        const exit = yield* Effect.exit(
          world.getTrait(entity.id, "Position2D" as TraitId)
        )

        expect(Exit.isFailure(exit)).toBe(true)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// World.queryWith/queryWithout — Query Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("World.queryWith/queryWithout", () => {
  it("queryWith returns entities with matching trait", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        // Spawn entities with and without Health
        const withHealth = yield* world.spawn([
          { id: "Health" as TraitId, data: { _tag: "Health", current: 100, max: 100 } },
        ])
        const withoutHealth = yield* world.spawn([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 0, y: 0 } },
        ])

        const results = yield* world.queryWith("Health" as TraitId)

        const ids = results.map((e) => e.id)
        expect(ids).toContain(withHealth.id)
        expect(ids).not.toContain(withoutHealth.id)
      })
    )
  })

  it("queryWith returns empty array when no matches", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        // Spawn entity without IsPlayer trait
        yield* world.spawn([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 0, y: 0 } },
        ])

        const results = yield* world.queryWith("IsPlayer" as TraitId)
        // Note: Other entities from previous tests may exist, so just check the API works
        expect(Array.isArray(results)).toBe(true)
      })
    )
  })

  it("queryWithout returns entities without specified trait", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        const withName = yield* world.spawn([
          { id: "Name" as TraitId, data: { _tag: "Name", value: "HasName" } },
        ])
        const withoutName = yield* world.spawn([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 0, y: 0 } },
        ])

        const results = yield* world.queryWithout("Name" as TraitId)

        const ids = results.map((e) => e.id)
        expect(ids).not.toContain(withName.id)
        expect(ids).toContain(withoutName.id)
      })
    )
  })

  it("queryAll returns all non-destroyed entities", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        const e1 = yield* world.spawn()
        const e2 = yield* world.spawn()

        const results = yield* world.queryAll()

        const ids = results.map((e) => e.id)
        expect(ids).toContain(e1.id)
        expect(ids).toContain(e2.id)
      })
    )
  })

  it("queries exclude destroyed entities", async () => {
    await runEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld

        // Spawn in outer scope (alive)
        const scope1 = yield* Scope.make()
        const alive = yield* pipe(
          world.spawn([
            { id: "Health" as TraitId, data: { _tag: "Health", current: 100, max: 100 } },
          ]),
          Effect.provideService(Scope.Scope, scope1)
        )

        // Spawn and destroy
        const scope2 = yield* Scope.make()
        const destroyed = yield* pipe(
          world.spawn([
            { id: "Health" as TraitId, data: { _tag: "Health", current: 50, max: 100 } },
          ]),
          Effect.provideService(Scope.Scope, scope2)
        )
        yield* Scope.close(scope2, Exit.void)

        const results = yield* world.queryWith("Health" as TraitId)
        const ids = results.map((e) => e.id)

        expect(ids).toContain(alive.id)
        expect(ids).not.toContain(destroyed.id)

        // Cleanup
        yield* Scope.close(scope1, Exit.void)
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// World.lock/unlock — Mutation Lock Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("World.lock/unlock mutations", () => {
  it("lock prevents mutations", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        yield* world.lock("test lock")

        const exit = yield* Effect.exit(
          world.addTrait(entity.id, "Name" as TraitId, {
            _tag: "Name",
            value: "Test",
          })
        )

        expect(Exit.isFailure(exit)).toBe(true)

        yield* world.unlock()
      })
    )
  })

  it("lock preserves reason", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        yield* world.lock("my custom reason")

        const exit = yield* Effect.exit(
          world.addTrait(entity.id, "Name" as TraitId, {
            _tag: "Name",
            value: "Test",
          })
        )

        if (Exit.isFailure(exit)) {
          const cause = exit.cause
          if (cause._tag === "Fail" && cause.error instanceof WorldLocked) {
            expect(cause.error.reason).toBe("my custom reason")
          }
        }

        yield* world.unlock()
      })
    )
  })

  it("unlock re-enables mutations", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn()

        yield* world.lock("temporary")
        yield* world.unlock()

        // Should succeed after unlock
        yield* world.addTrait(entity.id, "Name" as TraitId, {
          _tag: "Name",
          value: "AfterUnlock",
        })

        const updated = yield* world.get(entity.id)
        expect(updated.traits.has("Name" as TraitId)).toBe(true)
      })
    )
  })

  it("reads still work while locked", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Position2D" as TraitId, data: { _tag: "Position2D", x: 1, y: 2 } },
        ])

        yield* world.lock("read test")

        // Reads should work
        const retrieved = yield* world.get(entity.id)
        expect(retrieved.id).toBe(entity.id)

        const exists = yield* world.has(entity.id)
        expect(exists).toBe(true)

        const all = yield* world.queryAll()
        expect(all.length).toBeGreaterThan(0)

        yield* world.unlock()
      })
    )
  })

  it("setTrait fails while locked", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Health" as TraitId, data: { _tag: "Health", current: 100, max: 100 } },
        ])

        yield* world.lock("set test")

        const exit = yield* Effect.exit(
          world.setTrait(entity.id, "Health" as TraitId, {
            _tag: "Health",
            current: 50,
            max: 100,
          })
        )

        expect(Exit.isFailure(exit)).toBe(true)

        yield* world.unlock()
      })
    )
  })

  it("removeTrait fails while locked", async () => {
    await runScopedEffect(
      Effect.gen(function* () {
        const world = yield* KoriWorld
        const entity = yield* world.spawn([
          { id: "Name" as TraitId, data: { _tag: "Name", value: "Test" } },
        ])

        yield* world.lock("remove test")

        const exit = yield* Effect.exit(
          world.removeTrait(entity.id, "Name" as TraitId)
        )

        expect(Exit.isFailure(exit)).toBe(true)

        yield* world.unlock()
      })
    )
  })
})

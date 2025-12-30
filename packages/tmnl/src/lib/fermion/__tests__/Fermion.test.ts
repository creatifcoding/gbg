/**
 * @file Fermion core tests
 * @module @tmnl/fermion/__tests__/Fermion.test
 */

import { describe, it, expect, beforeEach } from "vitest"
import { Effect, Schema, Duration } from "effect"
import { Registry } from "@effect-atom/atom"
import * as Result from "@effect-atom/atom/Result"
import { fromSchema, makeSimpleMemoryAlgebra, NotFoundError } from "../index"

// Helper to run Effects with AtomRegistry provided
const runWithRegistry = <A, E>(
  registry: Registry.Registry,
  effect: Effect.Effect<A, E, Registry.AtomRegistry>
) =>
  Effect.runPromise(
    effect.pipe(Effect.provideService(Registry.AtomRegistry, registry))
  )

// ============================================================================
// Test Schemas
// ============================================================================

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
})
type User = typeof UserSchema.Type

const OrderSchema = Schema.Struct({
  userId: Schema.String,
  orderId: Schema.String,
  total: Schema.Number,
})
type Order = typeof OrderSchema.Type

// ============================================================================
// Basic Family Tests
// ============================================================================

describe("Fermion", () => {
  describe("fromSchema builder", () => {
    it("creates a family with single key", async () => {
      const { algebra, store } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map([["user-1", { id: "user-1", name: "Alice", email: "alice@test.com" }]])
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .buildWithDeps()

      // Verify the family is callable
      expect(typeof userFamily).toBe("function")
      expect(userFamily._tag).toBe("Fermion")
      expect(userFamily.keyField).toBe("id")

      // Verify atom creation
      const atom = userFamily("user-1")
      expect(atom).toBeDefined()

      // Same key returns same atom (memoization)
      expect(userFamily("user-1")).toBe(atom)
    })

    it("creates a family with composite key", async () => {
      const { algebra } = makeSimpleMemoryAlgebra<Order, { userId: string; orderId: string }>(
        (o) => ({ userId: o.userId, orderId: o.orderId }),
        new Map()
      )

      const orderFamily = fromSchema(OrderSchema)
        .withCompositeKey(["userId", "orderId"])
        .withFetch(algebra.fetch)
        .buildWithDeps()

      expect(orderFamily.keyField).toEqual(["userId", "orderId"])
    })

    it("throws when built without key", () => {
      expect(() => {
        fromSchema(UserSchema)
          .withFetch(() => Effect.succeed({ id: "1", name: "Test", email: "test@test.com" }))
          // @ts-expect-error - intentionally missing withKey
          .buildWithDeps()
      }).toThrow("Fermion requires a key field")
    })

    it("throws when built without fetch", () => {
      expect(() => {
        fromSchema(UserSchema)
          .withKey("id")
          // @ts-expect-error - intentionally missing withFetch
          .buildWithDeps()
      }).toThrow("Fermion requires a fetch operation")
    })
  })

  describe("fetch operation", () => {
    it("fetches and updates atom", async () => {
      const testUser: User = { id: "user-1", name: "Alice", email: "alice@test.com" }
      const { algebra, store } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map([["user-1", testUser]])
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .buildWithDeps()

      const r = Registry.make()
      const atom = userFamily("user-1")

      // Initial state should be initial
      const initialResult = r.get(atom)
      expect(Result.isInitial(initialResult)).toBe(true)

      // Fetch and verify
      const fetched = await runWithRegistry(r, userFamily.fetch("user-1"))
      expect(fetched).toEqual(testUser)

      // Atom should now have success state
      const successResult = r.get(atom)
      expect(Result.isSuccess(successResult)).toBe(true)
      if (Result.isSuccess(successResult)) {
        expect(successResult.value).toEqual(testUser)
      }
    })

    it("handles fetch errors", async () => {
      const { algebra } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map() // Empty - will cause NotFoundError
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .buildWithDeps()

      const r = Registry.make()
      const atom = userFamily("nonexistent")

      // Fetch should fail
      const result = await Effect.runPromise(
        userFamily.fetch("nonexistent").pipe(
          Effect.either,
          Effect.provideService(Registry.AtomRegistry, r)
        )
      )

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(NotFoundError)
      }

      // Atom should have failure state
      const failureResult = r.get(atom)
      expect(Result.isFailure(failureResult)).toBe(true)
    })
  })

  describe("persist operation", () => {
    it("persists and updates atom", async () => {
      const { algebra, store } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map()
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .withPersist(algebra.persist!)
        .buildWithDeps()

      const r = Registry.make()
      const newUser: User = { id: "user-2", name: "Bob", email: "bob@test.com" }

      // Persist the new user
      await runWithRegistry(r, userFamily.persist(newUser))

      // Verify store was updated
      expect(store.get("user-2")).toEqual(newUser)

      // Verify atom was updated
      const atom = userFamily("user-2")
      const result = r.get(atom)
      expect(Result.isSuccess(result)).toBe(true)
      if (Result.isSuccess(result)) {
        expect(result.value).toEqual(newUser)
      }
    })
  })

  describe("remove operation", () => {
    it("removes and resets atom", async () => {
      const testUser: User = { id: "user-1", name: "Alice", email: "alice@test.com" }
      const { algebra, store } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map([["user-1", testUser]])
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .withRemove(algebra.remove!)
        .buildWithDeps()

      const r = Registry.make()

      // First fetch to populate atom
      await runWithRegistry(r, userFamily.fetch("user-1"))
      expect(Result.isSuccess(r.get(userFamily("user-1")))).toBe(true)

      // Remove
      await runWithRegistry(r, userFamily.remove("user-1"))

      // Store should be empty
      expect(store.has("user-1")).toBe(false)

      // Atom should be reset to initial
      expect(Result.isInitial(r.get(userFamily("user-1")))).toBe(true)
    })
  })

  describe("invalidate operation", () => {
    it("resets atom without API call", async () => {
      const testUser: User = { id: "user-1", name: "Alice", email: "alice@test.com" }
      const { algebra, store } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map([["user-1", testUser]])
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .buildWithDeps()

      const r = Registry.make()

      // Fetch to populate
      await runWithRegistry(r, userFamily.fetch("user-1"))
      expect(Result.isSuccess(r.get(userFamily("user-1")))).toBe(true)

      // Invalidate
      await runWithRegistry(r, userFamily.invalidate("user-1"))

      // Atom should be initial, but store unchanged
      expect(Result.isInitial(r.get(userFamily("user-1")))).toBe(true)
      expect(store.has("user-1")).toBe(true) // Still in store
    })
  })

  describe("prefetch operation", () => {
    it("fetches multiple keys in parallel", async () => {
      const users: User[] = [
        { id: "user-1", name: "Alice", email: "alice@test.com" },
        { id: "user-2", name: "Bob", email: "bob@test.com" },
        { id: "user-3", name: "Charlie", email: "charlie@test.com" },
      ]
      const { algebra } = makeSimpleMemoryAlgebra<User, string>(
        (u) => u.id,
        new Map(users.map((u) => [u.id, u]))
      )

      const userFamily = fromSchema(UserSchema)
        .withKey("id")
        .withFetch(algebra.fetch)
        .buildWithDeps()

      const r = Registry.make()

      // Prefetch all users
      await runWithRegistry(r, userFamily.prefetch(["user-1", "user-2", "user-3"]))

      // All atoms should have success state
      for (const user of users) {
        const result = r.get(userFamily(user.id))
        expect(Result.isSuccess(result)).toBe(true)
        if (Result.isSuccess(result)) {
          expect(result.value).toEqual(user)
        }
      }
    })
  })
})

// ============================================================================
// Key Extraction Tests
// ============================================================================

describe("Key extraction", () => {
  it("extracts single key correctly", async () => {
    let capturedKey: string | undefined
    const r = Registry.make()

    const userFamily = fromSchema(UserSchema)
      .withKey("id")
      .withFetch((id) => {
        capturedKey = id
        return Effect.succeed({ id, name: "Test", email: "test@test.com" })
      })
      .buildWithDeps()

    await runWithRegistry(r, userFamily.fetch("my-key"))
    expect(capturedKey).toBe("my-key")
  })

  it("extracts composite key correctly", async () => {
    let capturedKey: { userId: string; orderId: string } | undefined
    const r = Registry.make()

    const orderFamily = fromSchema(OrderSchema)
      .withCompositeKey(["userId", "orderId"])
      .withFetch((key) => {
        capturedKey = key
        return Effect.succeed({ ...key, total: 100 })
      })
      .buildWithDeps()

    await runWithRegistry(r, orderFamily.fetch({ userId: "u-1", orderId: "o-2" }))
    expect(capturedKey).toEqual({ userId: "u-1", orderId: "o-2" })
  })
})

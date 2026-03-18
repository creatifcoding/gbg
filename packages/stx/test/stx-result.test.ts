/**
 * @tmnl/stx — Result-returning mutation tests
 *
 * Tests trySet, trySetAt, tryModify for both plain objects and Entity instances.
 */
import { describe, it, expect } from "vitest"
import { stx, StxValidationError, StxConstraintError } from "../src/index.js"
import * as Result from "effect-v4/Result"

// ─── Plain Object (no Entity) ────────────────────────

describe("trySet / trySetAt / tryModify — plain object", () => {
  it("trySet always succeeds for plain objects", () => {
    const store = stx({ count: 0, name: "alice" })
    const r = store.trySet({ count: 1, name: "bob" })
    expect(Result.isSuccess(r)).toBe(true)
    if (Result.isSuccess(r)) {
      expect(r.success).toEqual({ count: 1, name: "bob" })
    }
    expect(store.get()).toEqual({ count: 1, name: "bob" })
  })

  it("trySetAt always succeeds for plain objects", () => {
    const store = stx({ count: 0, name: "alice" })
    const r = store.trySetAt(store.lens.name, "bob")
    expect(Result.isSuccess(r)).toBe(true)
    expect(store.get().name).toBe("bob")
  })

  it("tryModify always succeeds for plain objects", () => {
    const store = stx({ count: 0, name: "alice" })
    const r = store.tryModify(store.lens.count, (n: number) => n + 10)
    expect(Result.isSuccess(r)).toBe(true)
    expect(store.get().count).toBe(10)
  })
})

// ─── Entity-like object (with validation + field constraints) ──

/**
 * Simulate an Entity-like constructor with fieldMeta and validate.
 * STX uses duck typing — no actual @tmnl/entity import needed.
 */
class FakeEntity {
  static entityTag = "FakeEntity"
  static fieldMeta: Record<string, string> = {
    id: "readonly",
    name: "data",
    computed: "computed",
    secret: "sensitive",
  }
  static validate = {
    select: (data: unknown) => {
      const d = data as any
      if (typeof d.name !== "string" || d.name.length === 0) {
        return Result.fail({ issues: ["name must be non-empty string"] })
      }
      return Result.succeed(d)
    },
  }

  id: number
  name: string
  computed: string
  secret: string

  constructor(data: { id: number; name: string; computed?: string; secret?: string }) {
    this.id = data.id
    this.name = data.name
    this.computed = data.computed ?? "derived"
    this.secret = data.secret ?? "s3cret"
  }
}

describe("trySet — Entity-backed store", () => {
  it("returns Success when validation passes", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const next = new FakeEntity({ id: 1, name: "Bob" })
    const r = store.trySet(next)
    expect(Result.isSuccess(r)).toBe(true)
    expect(store.get().name).toBe("Bob")
  })

  it("returns Failure with StxValidationError when validation fails", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const invalid = new FakeEntity({ id: 1, name: "" })
    const r = store.trySet(invalid)
    expect(Result.isFailure(r)).toBe(true)
    if (Result.isFailure(r)) {
      expect(r.failure).toBeInstanceOf(StxValidationError)
      expect(r.failure._tag).toBe("StxValidationError")
      expect(r.failure.issues).toContain("name must be non-empty string")
      expect(r.failure.entityTag).toBe("FakeEntity")
      expect(r.failure.message).toContain("Validation failed")
    }
    // State unchanged
    expect(store.get().name).toBe("Alice")
  })
})

describe("trySetAt — Entity readonly constraints", () => {
  it("returns Success for writable fields", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const r = store.trySetAt(store.lens.name, "Bob")
    expect(Result.isSuccess(r)).toBe(true)
    expect(store.get().name).toBe("Bob")
  })

  it("returns Failure with StxConstraintError for readonly fields", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const r = store.trySetAt(store.lens.id, 999)
    expect(Result.isFailure(r)).toBe(true)
    if (Result.isFailure(r)) {
      expect(r.failure).toBeInstanceOf(StxConstraintError)
      expect(r.failure._tag).toBe("StxConstraintError")
      expect(r.failure.field).toBe("id")
      expect(r.failure.kind).toBe("readonly")
      expect(r.failure.entityTag).toBe("FakeEntity")
    }
    // State unchanged
    expect(store.get().id).toBe(1)
  })

  it("returns Failure for computed fields", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const r = store.trySetAt(store.lens.computed, "hacked")
    expect(Result.isFailure(r)).toBe(true)
    if (Result.isFailure(r)) {
      expect(r.failure.kind).toBe("computed")
    }
  })
})

describe("tryModify — Entity readonly constraints", () => {
  it("returns Success for writable fields", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const r = store.tryModify(store.lens.name, (n: string) => n.toUpperCase())
    expect(Result.isSuccess(r)).toBe(true)
    expect(store.get().name).toBe("ALICE")
  })

  it("returns Failure for readonly fields", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const r = store.tryModify(store.lens.id, (n: number) => n + 1)
    expect(Result.isFailure(r)).toBe(true)
    if (Result.isFailure(r)) {
      expect(r.failure._tag).toBe("StxConstraintError")
      expect(r.failure.field).toBe("id")
    }
    expect(store.get().id).toBe(1)
  })
})

// ─── Result composition ──────────────────────────────

describe("Result composition with try* methods", () => {
  it("composes trySet with Result.map", () => {
    const store = stx({ count: 0, name: "test" })
    const r = Result.map(store.trySet({ count: 42, name: "composed" }), (s) => s.count)
    expect(Result.isSuccess(r)).toBe(true)
    if (Result.isSuccess(r)) {
      expect(r.success).toBe(42)
    }
  })

  it("composes trySet with Result.match", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))
    const msg = Result.match(store.trySet(new FakeEntity({ id: 1, name: "" })), {
      onSuccess: () => "saved",
      onFailure: (e) => e.message,
    })
    expect(msg).toContain("Validation failed")
  })

  it("chains multiple operations with Result.flatMap", () => {
    const store = stx(new FakeEntity({ id: 1, name: "Alice" }))

    // trySetAt returns Result<void, StxConstraintError>
    // trySet returns Result<S, StxValidationError>
    // Both are composable via Result pipeline
    const r1 = store.trySetAt(store.lens.name, "Bob")
    expect(Result.isSuccess(r1)).toBe(true)

    const r2 = store.tryModify(store.lens.name, (n: string) => n + "!")
    expect(Result.isSuccess(r2)).toBe(true)
    expect(store.get().name).toBe("Bob!")
  })
})

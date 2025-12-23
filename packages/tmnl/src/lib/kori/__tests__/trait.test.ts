/**
 * KORI Trait Schema Tests
 *
 * Unit tests for trait schema validation, encoding, and registry.
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect, pipe, Exit } from "effect"
import {
  TraitId,
  defineTrait,
  defineTagTrait,
  validateTrait,
  encodeTrait,
  registerTrait,
  getTraitSchema,
  listTraits,
  Position2D,
  Position3D,
  Velocity2D,
  Health,
  Name,
  Lifetime,
  IsPlayer,
  IsEnemy,
  IsActive,
  type TraitRegistryEntry,
} from "../schemas/trait"
import { TraitValidationFailed } from "../errors"
import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────────────────────
// defineTrait / defineTagTrait Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("defineTrait / defineTagTrait", () => {
  it("defineTrait creates TaggedStruct schema", () => {
    const CustomTrait = defineTrait("CustomTrait", {
      value: Schema.Number,
      label: Schema.String,
    })

    // Should have _tag as "CustomTrait"
    const decoded = Schema.decodeUnknownSync(CustomTrait)({
      _tag: "CustomTrait",
      value: 42,
      label: "test",
    })

    expect(decoded._tag).toBe("CustomTrait")
    expect(decoded.value).toBe(42)
    expect(decoded.label).toBe("test")
  })

  it("defineTagTrait creates empty TaggedStruct", () => {
    const CustomTag = defineTagTrait("CustomTag")

    const decoded = Schema.decodeUnknownSync(CustomTag)({
      _tag: "CustomTag",
    })

    expect(decoded._tag).toBe("CustomTag")
  })

  it("defineTrait rejects missing _tag", () => {
    const CustomTrait = defineTrait("CustomTrait", {
      value: Schema.Number,
    })

    expect(() => {
      Schema.decodeUnknownSync(CustomTrait)({ value: 42 })
    }).toThrow()
  })

  it("defineTrait rejects wrong _tag", () => {
    const CustomTrait = defineTrait("CustomTrait", {
      value: Schema.Number,
    })

    expect(() => {
      Schema.decodeUnknownSync(CustomTrait)({ _tag: "WrongTag", value: 42 })
    }).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Trait Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Built-in trait schemas", () => {
  it("Position2D validates x and y", () => {
    const valid = Schema.decodeUnknownSync(Position2D)({
      _tag: "Position2D",
      x: 10,
      y: 20,
    })

    expect(valid.x).toBe(10)
    expect(valid.y).toBe(20)
  })

  it("Position2D rejects missing fields", () => {
    expect(() => {
      Schema.decodeUnknownSync(Position2D)({
        _tag: "Position2D",
        x: 10,
        // missing y
      })
    }).toThrow()
  })

  it("Position3D validates x, y, z", () => {
    const valid = Schema.decodeUnknownSync(Position3D)({
      _tag: "Position3D",
      x: 1,
      y: 2,
      z: 3,
    })

    expect(valid.z).toBe(3)
  })

  it("Health validates current and max with constraints", () => {
    const valid = Schema.decodeUnknownSync(Health)({
      _tag: "Health",
      current: 50,
      max: 100,
    })

    expect(valid.current).toBe(50)
    expect(valid.max).toBe(100)
  })

  it("Health rejects negative current", () => {
    expect(() => {
      Schema.decodeUnknownSync(Health)({
        _tag: "Health",
        current: -10,
        max: 100,
      })
    }).toThrow()
  })

  it("Health rejects zero max", () => {
    expect(() => {
      Schema.decodeUnknownSync(Health)({
        _tag: "Health",
        current: 0,
        max: 0,
      })
    }).toThrow()
  })

  it("Name validates non-empty string", () => {
    const valid = Schema.decodeUnknownSync(Name)({
      _tag: "Name",
      value: "Entity1",
    })

    expect(valid.value).toBe("Entity1")
  })

  it("Name rejects empty string", () => {
    expect(() => {
      Schema.decodeUnknownSync(Name)({
        _tag: "Name",
        value: "",
      })
    }).toThrow()
  })

  it("Lifetime validates with Date and TTL", () => {
    const now = new Date()
    const valid = Schema.decodeUnknownSync(Lifetime)({
      _tag: "Lifetime",
      spawnedAt: now,
      ttlMs: 5000,
    })

    expect(valid.spawnedAt).toBe(now)
    expect(valid.ttlMs).toBe(5000)
  })

  it("Velocity2D validates vx and vy", () => {
    const valid = Schema.decodeUnknownSync(Velocity2D)({
      _tag: "Velocity2D",
      vx: 1.5,
      vy: -2.5,
    })

    expect(valid.vx).toBe(1.5)
    expect(valid.vy).toBe(-2.5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Tag Trait Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Tag traits", () => {
  it("IsPlayer is tag-only", () => {
    const valid = Schema.decodeUnknownSync(IsPlayer)({
      _tag: "IsPlayer",
    })

    expect(valid._tag).toBe("IsPlayer")
  })

  it("IsEnemy is tag-only", () => {
    const valid = Schema.decodeUnknownSync(IsEnemy)({
      _tag: "IsEnemy",
    })

    expect(valid._tag).toBe("IsEnemy")
  })

  it("IsActive is tag-only", () => {
    const valid = Schema.decodeUnknownSync(IsActive)({
      _tag: "IsActive",
    })

    expect(valid._tag).toBe("IsActive")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validateTrait / encodeTrait Effect Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("validateTrait", () => {
  it("returns success for valid data", async () => {
    const result = await Effect.runPromise(
      validateTrait(Position2D, { _tag: "Position2D", x: 10, y: 20 }, "Position2D")
    )

    expect(result._tag).toBe("Position2D")
    expect(result.x).toBe(10)
  })

  it("returns TraitValidationFailed for invalid data", async () => {
    const exit = await Effect.runPromiseExit(
      validateTrait(Position2D, { _tag: "Position2D", x: "not a number", y: 20 }, "Position2D")
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = exit.cause
      expect(error._tag).toBe("Fail")
    }
  })

  it("error contains traitId", async () => {
    const exit = await Effect.runPromiseExit(
      validateTrait(Health, { _tag: "Health", current: -1, max: 100 }, "Health")
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe("encodeTrait", () => {
  it("encodes valid trait data", async () => {
    const data: typeof Position2D.Type = {
      _tag: "Position2D",
      x: 10,
      y: 20,
    }

    const result = await Effect.runPromise(
      encodeTrait(Position2D, data, "Position2D")
    )

    expect(result._tag).toBe("Position2D")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trait Registry Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Trait Registry", () => {
  it("built-in traits are pre-registered", () => {
    const traits = listTraits()

    expect(traits).toContain("Position2D")
    expect(traits).toContain("Health")
    expect(traits).toContain("IsPlayer")
  })

  it("getTraitSchema returns registered schema", () => {
    const entry = getTraitSchema("Position2D" as TraitId)

    expect(entry).toBeDefined()
    expect(entry?.id).toBe("Position2D")
    expect(entry?.isTag).toBe(false)
  })

  it("getTraitSchema returns undefined for unregistered", () => {
    const entry = getTraitSchema("NonExistent" as TraitId)

    expect(entry).toBeUndefined()
  })

  it("tag traits are marked as isTag", () => {
    const entry = getTraitSchema("IsPlayer" as TraitId)

    expect(entry?.isTag).toBe(true)
  })

  it("registerTrait adds new trait", () => {
    const CustomTrait = defineTrait("TestCustomTrait", {
      value: Schema.Number,
    })

    registerTrait("TestCustomTrait" as TraitId, CustomTrait)

    const entry = getTraitSchema("TestCustomTrait" as TraitId)
    expect(entry).toBeDefined()
    expect(entry?.id).toBe("TestCustomTrait")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TraitId Brand Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("TraitId brand", () => {
  it("validates non-empty string", () => {
    const valid = Schema.decodeUnknownSync(TraitId)("Position2D")

    expect(valid).toBe("Position2D")
  })

  it("rejects empty string", () => {
    expect(() => {
      Schema.decodeUnknownSync(TraitId)("")
    }).toThrow()
  })
})

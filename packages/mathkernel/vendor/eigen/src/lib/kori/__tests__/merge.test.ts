/**
 * KORI Merge Service Tests
 *
 * Unit tests for KoriMerge Effect.Service (defu integration).
 *
 * @module
 */

import { describe, it, expect } from "vitest"
import { Effect, pipe } from "effect"
import {
  KoriMerge,
  KoriMergeLive,
  sumMerger,
  concatMerger,
  maxMerger,
  minMerger,
  composeMergers,
  type MergeStrategy,
} from "../services/merge"
import type { TraitId } from "../schemas/trait"

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

const runEffect = <A, E>(effect: Effect.Effect<A, E, KoriMerge>) =>
  Effect.runPromise(pipe(effect, Effect.provide(KoriMergeLive)))

// ─────────────────────────────────────────────────────────────────────────────
// Merge.merge/mergeFn/mergeArrayFn Tests (tmnl-mn1e)
// ─────────────────────────────────────────────────────────────────────────────

describe("Merge.merge/mergeFn/mergeArrayFn", () => {
  it("merge uses leftmost priority (target wins)", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = { a: 1, b: 2 }
        const source = { a: 10, c: 3 }

        return yield* merge.merge(target, source)
      })
    )

    expect(result.a).toBe(1) // target wins
    expect(result.b).toBe(2) // from target
    expect(result.c).toBe(3) // from source (not in target)
  })

  it("merge handles nested objects", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = { nested: { a: 1 } }
        const source = { nested: { a: 10, b: 2 } }

        return yield* merge.merge(target, source)
      })
    )

    expect(result.nested.a).toBe(1) // target wins
    expect(result.nested.b).toBe(2) // from source
  })

  it("merge handles multiple sources", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = { a: 1 }
        const source1 = { b: 2 }
        const source2 = { c: 3 }
        const source3 = { d: 4 }

        return yield* merge.merge(target, source1, source2, source3)
      })
    )

    expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 })
  })

  it("merge preserves undefined values in target", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = { a: undefined as number | undefined }
        const source = { a: 10 }

        return yield* merge.merge(target, source)
      })
    )

    // defu fills undefined with source value
    expect(result.a).toBe(10)
  })

  it("mergeFn calls functions with default value", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = {
          value: (defaultVal: number) => defaultVal * 2,
        }
        const defaults = { value: 10 }

        return yield* merge.mergeFn(target as any, defaults)
      })
    )

    expect(result.value).toBe(20) // function called with 10, returns 20
  })

  it("mergeArrayFn calls functions only for array defaults", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = {
          items: (arr: number[]) => [...arr, 4],
          scalar: (val: number) => val * 2, // won't be called
        }
        const defaults = {
          items: [1, 2, 3],
          scalar: 10,
        }

        return yield* merge.mergeArrayFn(target as any, defaults)
      })
    )

    expect(result.items).toEqual([1, 2, 3, 4]) // function called
    // scalar function is NOT called since default is not an array
    expect(typeof result.scalar).toBe("function")
  })

  it("merge handles arrays correctly", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const target = { items: [1, 2] }
        const source = { items: [3, 4] }

        return yield* merge.merge(target, source)
      })
    )

    // defu merges arrays by combining them (target first, then source fills)
    expect(result.items).toEqual([1, 2, 3, 4])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Merge.createMerger Custom Strategies Tests (tmnl-qor7)
// ─────────────────────────────────────────────────────────────────────────────

describe("Merge.createMerger custom strategies", () => {
  it("sumMerger adds numeric values", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge
        const sumMerge = merge.createMerger(sumMerger)

        const target = { count: 5, name: "test" }
        const source = { count: 10, name: "other" }

        return yield* sumMerge(target, source)
      })
    )

    expect(result.count).toBe(15) // 5 + 10
    expect(result.name).toBe("test") // non-numeric uses default merge
  })

  it("concatMerger concatenates arrays", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge
        const concatMerge = merge.createMerger(concatMerger)

        const target = { items: [1, 2], value: 10 }
        const source = { items: [3, 4], value: 20 }

        return yield* concatMerge(target, source)
      })
    )

    // concatMerger appends source to target array (defu calls with source first)
    expect(result.items).toEqual([3, 4, 1, 2])
    expect(result.value).toBe(10) // non-array uses default
  })

  it("maxMerger takes maximum numeric value", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge
        const maxMerge = merge.createMerger(maxMerger)

        const target = { health: 50, mana: 100 }
        const source = { health: 80, mana: 50 }

        return yield* maxMerge(target, source)
      })
    )

    expect(result.health).toBe(80) // max(50, 80)
    expect(result.mana).toBe(100) // max(100, 50)
  })

  it("minMerger takes minimum numeric value", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge
        const minMerge = merge.createMerger(minMerger)

        const target = { damage: 50, armor: 100 }
        const source = { damage: 80, armor: 50 }

        return yield* minMerge(target, source)
      })
    )

    expect(result.damage).toBe(50) // min(50, 80)
    expect(result.armor).toBe(50) // min(100, 50)
  })

  it("composeMergers chains multiple mergers", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        // Compose: try sum first, then concat
        const composed = composeMergers(sumMerger, concatMerger)
        const composedMerge = merge.createMerger(composed)

        const target = { count: 5, items: [1, 2], name: "a" }
        const source = { count: 10, items: [3, 4], name: "b" }

        return yield* composedMerge(target, source)
      })
    )

    expect(result.count).toBe(15) // sumMerger handles this
    expect(result.items).toEqual([3, 4, 1, 2]) // concatMerger handles this (defu order)
    expect(result.name).toBe("a") // default merge
  })

  it("custom merger for specific keys", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        // Custom merger that only handles 'special' key
        // Note: defu calls merger with (obj, key, value) where obj[key] is target, value is source
        const specialMerger = (obj: any, key: string, value: any) => {
          if (key === "special") {
            obj[key] = `${obj[key]}-${value}`
            return true
          }
          return false
        }

        const customMerge = merge.createMerger(specialMerger)

        const target = { special: "target", normal: 1 }
        const source = { special: "source", normal: 2 }

        return yield* customMerge(target, source)
      })
    )

    // defu merger receives (obj=target, key, value=source), result is obj[key]-value
    expect(result.special).toBe("source-target")
    expect(result.normal).toBe(1) // default merge
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Merge.composeTrait Multi-Source Tests (tmnl-qean)
// ─────────────────────────────────────────────────────────────────────────────

describe("Merge.composeTrait multi-source", () => {
  it("composeTrait with default strategy", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["Position2D", "Health"] as TraitId[]
        const data = [
          { x: 10, y: 20 },
          { current: 100, max: 100 },
          { z: 0, extra: true }, // additional source
        ]

        return yield* merge.composeTrait(traitIds, data)
      })
    )

    expect(result.merged.x).toBe(10)
    expect(result.merged.y).toBe(20)
    expect(result.merged.current).toBe(100)
    expect(result.merged.z).toBe(0)
    expect(result.merged.extra).toBe(true)
    expect(result.strategy).toBe("default")
    expect(result.sourceTraitIds).toEqual(["Position2D", "Health"])
  })

  it("composeTrait with fn strategy", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["Stats"] as TraitId[]
        const data = [
          { computed: (val: number) => val * 2 },
          { computed: 10 },
        ]

        return yield* merge.composeTrait(traitIds, data, { strategy: "fn" })
      })
    )

    expect(result.merged.computed).toBe(20)
    expect(result.strategy).toBe("fn")
  })

  it("composeTrait with arrayFn strategy", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["Inventory"] as TraitId[]
        const data = [
          { items: (arr: string[]) => [...arr, "sword"] },
          { items: ["shield", "potion"] },
        ]

        return yield* merge.composeTrait(traitIds, data, { strategy: "arrayFn" })
      })
    )

    expect(result.merged.items).toEqual(["shield", "potion", "sword"])
    expect(result.strategy).toBe("arrayFn")
  })

  it("composeTrait with custom strategy", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["Stats"] as TraitId[]
        const data = [
          { strength: 10, agility: 5 },
          { strength: 5, agility: 10 },
          { strength: 3, agility: 3 },
        ]

        return yield* merge.composeTrait(traitIds, data, {
          strategy: "custom",
          customMerger: sumMerger,
        })
      })
    )

    expect(result.merged.strength).toBe(18) // 10 + 5 + 3
    expect(result.merged.agility).toBe(18) // 5 + 10 + 3
    expect(result.strategy).toBe("custom")
  })

  it("composeTrait tracks sourceTraitIds correctly", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["A", "B", "C", "D"] as TraitId[]
        const data = [{}, {}, {}, {}]

        return yield* merge.composeTrait(traitIds, data)
      })
    )

    expect(result.sourceTraitIds).toEqual(["A", "B", "C", "D"])
  })

  it("composeTrait handles empty data array", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = [] as TraitId[]
        const data: Array<Record<string, unknown>> = []

        return yield* merge.composeTrait(traitIds, data)
      })
    )

    expect(result.merged).toEqual({})
  })

  it("composeTrait handles single source", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["Single"] as TraitId[]
        const data = [{ value: 42 }]

        return yield* merge.composeTrait(traitIds, data)
      })
    )

    expect(result.merged.value).toBe(42)
  })

  it("composeTrait with fn strategy and single source", async () => {
    const result = await runEffect(
      Effect.gen(function* () {
        const merge = yield* KoriMerge

        const traitIds = ["Single"] as TraitId[]
        const data = [{ value: 42 }]

        return yield* merge.composeTrait(traitIds, data, { strategy: "fn" })
      })
    )

    expect(result.merged.value).toBe(42)
    expect(result.strategy).toBe("fn")
  })
})

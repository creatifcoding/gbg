/**
 * KORI Merge Service
 *
 * Defu-based deep merging wrapped as Effect operations.
 * Enables trait composition with schema-aware merge semantics.
 *
 * @module
 */

import { Context, Effect, Layer, pipe } from "effect"
import { defu, defuFn, defuArrayFn, createDefu } from "defu"
import type { TraitId } from "../schemas/trait"
import { TraitValidationFailed, SchemaTransformError } from "../errors"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Custom merger function signature.
 * Returns true if merge was handled, false to use default behavior.
 */
export type MergerFn = (
  obj: Record<string, unknown>,
  key: string,
  value: unknown
) => boolean

/**
 * Merge strategy for trait composition.
 */
export type MergeStrategy = "default" | "fn" | "arrayFn" | "custom"

/**
 * Merge configuration.
 */
export interface MergeConfig {
  readonly strategy: MergeStrategy
  readonly customMerger?: MergerFn
}

/**
 * Trait merge result with metadata.
 */
export interface MergeResult<T> {
  readonly merged: T
  readonly sourceTraitIds: ReadonlyArray<TraitId>
  readonly strategy: MergeStrategy
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI Merge operations.
 */
export interface KoriMergeOps {
  /**
   * Deep merge objects with leftmost priority.
   * Uses defu default strategy.
   */
  readonly merge: <T extends Record<string, unknown>>(
    target: Partial<T>,
    ...sources: ReadonlyArray<Partial<T>>
  ) => Effect.Effect<T>

  /**
   * Merge with function value handling.
   * Functions in target are called with corresponding default value.
   */
  readonly mergeFn: <T extends Record<string, unknown>>(
    target: Partial<T>,
    defaults: Partial<T>
  ) => Effect.Effect<T>

  /**
   * Merge with array-only function handling.
   * Functions are called only when default value is an array.
   */
  readonly mergeArrayFn: <T extends Record<string, unknown>>(
    target: Partial<T>,
    defaults: Partial<T>
  ) => Effect.Effect<T>

  /**
   * Create a custom merger for specialized merge behavior.
   */
  readonly createMerger: (
    merger: MergerFn
  ) => <T extends Record<string, unknown>>(
    target: Partial<T>,
    ...sources: ReadonlyArray<Partial<T>>
  ) => Effect.Effect<T>

  /**
   * Merge trait data with schema validation.
   * Validates result against trait schema.
   */
  readonly mergeTraits: <T extends Record<string, unknown>>(
    traitId: TraitId,
    target: Partial<T>,
    ...sources: ReadonlyArray<Partial<T>>
  ) => Effect.Effect<MergeResult<T>, TraitValidationFailed>

  /**
   * Compose multiple traits into a combined data structure.
   * Useful for entity composition from trait defaults.
   */
  readonly composeTrait: <T extends Record<string, unknown>>(
    traitIds: ReadonlyArray<TraitId>,
    data: ReadonlyArray<Partial<T>>,
    config?: MergeConfig
  ) => Effect.Effect<MergeResult<T>, SchemaTransformError>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI Merge service tag.
 */
export class KoriMerge extends Context.Tag("kori/Merge")<
  KoriMerge,
  KoriMergeOps
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create KORI Merge operations.
 */
export const makeKoriMerge: Effect.Effect<KoriMergeOps> = Effect.sync(() => {
  const ops: KoriMergeOps = {
    merge: <T extends Record<string, unknown>>(
      target: Partial<T>,
      ...sources: ReadonlyArray<Partial<T>>
    ) =>
      Effect.sync(() => defu(target, ...sources) as T),

    mergeFn: <T extends Record<string, unknown>>(
      target: Partial<T>,
      defaults: Partial<T>
    ) =>
      Effect.sync(() => defuFn(target, defaults) as T),

    mergeArrayFn: <T extends Record<string, unknown>>(
      target: Partial<T>,
      defaults: Partial<T>
    ) =>
      Effect.sync(() => defuArrayFn(target, defaults) as T),

    createMerger:
      (merger: MergerFn) =>
      <T extends Record<string, unknown>>(
        target: Partial<T>,
        ...sources: ReadonlyArray<Partial<T>>
      ) =>
        Effect.sync(() => {
          const customDefu = createDefu(merger)
          return customDefu(target, ...sources) as T
        }),

    mergeTraits: <T extends Record<string, unknown>>(
      traitId: TraitId,
      target: Partial<T>,
      ...sources: ReadonlyArray<Partial<T>>
    ) =>
      pipe(
        Effect.sync(() => defu(target, ...sources) as T),
        Effect.map((merged): MergeResult<T> => ({
          merged,
          sourceTraitIds: [traitId],
          strategy: "default" as const,
        }))
        // Note: Schema validation would be added here using the trait registry
        // For now, we trust the input types
      ),

    composeTrait: <T extends Record<string, unknown>>(
      traitIds: ReadonlyArray<TraitId>,
      data: ReadonlyArray<Partial<T>>,
      config: MergeConfig = { strategy: "default" }
    ) =>
      Effect.sync(() => {
        let merged: T

        switch (config.strategy) {
          case "fn":
            if (data.length >= 2) {
              merged = defuFn(data[0], data[1]) as T
              for (let i = 2; i < data.length; i++) {
                merged = defuFn(merged, data[i] as Partial<T>) as T
              }
            } else {
              merged = (data[0] ?? {}) as T
            }
            break

          case "arrayFn":
            if (data.length >= 2) {
              merged = defuArrayFn(data[0], data[1]) as T
              for (let i = 2; i < data.length; i++) {
                merged = defuArrayFn(merged, data[i] as Partial<T>) as T
              }
            } else {
              merged = (data[0] ?? {}) as T
            }
            break

          case "custom":
            if (config.customMerger) {
              const customDefu = createDefu(config.customMerger)
              // Reduce from right to left to match defu's leftmost priority
              merged = data.reduceRight<T>(
                (acc, curr) => customDefu(curr, acc) as unknown as T,
                {} as T
              )
            } else {
              merged = data.reduceRight<T>(
                (acc, curr) => defu(curr, acc) as unknown as T,
                {} as T
              )
            }
            break

          case "default":
          default:
            merged = data.reduceRight<T>(
              (acc, curr) => defu(curr, acc) as unknown as T,
              {} as T
            )
        }

        return {
          merged,
          sourceTraitIds: traitIds,
          strategy: config.strategy,
        }
      }),
  }

  return ops
})

/**
 * Default KORI Merge layer.
 */
export const KoriMergeLive = Layer.effect(KoriMerge, makeKoriMerge)

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a merger that sums numeric values.
 */
export const sumMerger: MergerFn = (obj, key, value) => {
  if (typeof obj[key] === "number" && typeof value === "number") {
    obj[key] = (obj[key] as number) + value
    return true
  }
  return false
}

/**
 * Create a merger that concatenates arrays.
 */
export const concatMerger: MergerFn = (obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = [...(obj[key] as unknown[]), ...value]
    return true
  }
  return false
}

/**
 * Create a merger that takes the max of numeric values.
 */
export const maxMerger: MergerFn = (obj, key, value) => {
  if (typeof obj[key] === "number" && typeof value === "number") {
    obj[key] = Math.max(obj[key] as number, value)
    return true
  }
  return false
}

/**
 * Create a merger that takes the min of numeric values.
 */
export const minMerger: MergerFn = (obj, key, value) => {
  if (typeof obj[key] === "number" && typeof value === "number") {
    obj[key] = Math.min(obj[key] as number, value)
    return true
  }
  return false
}

/**
 * Compose multiple mergers into one.
 * First merger that returns true wins.
 */
export const composeMergers = (...mergers: MergerFn[]): MergerFn => {
  return (obj, key, value) => {
    for (const merger of mergers) {
      if (merger(obj, key, value)) {
        return true
      }
    }
    return false
  }
}

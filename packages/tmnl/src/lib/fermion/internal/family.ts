/**
 * @file Core family factory implementation for Fermion
 * @module @tmnl/fermion/internal/family
 *
 * This module contains the internal implementation of makeFamily,
 * which creates the callable Fermion object.
 */

import { Effect, Layer, pipe, Cause } from "effect"
import { Atom, Registry } from "@effect-atom/atom"
import * as Result from "@effect-atom/atom/Result"
import type { Schema } from "effect"
import type { Fermion, FermionConfig } from "../types"
import { FermionTypeId } from "./symbols"
import { extractKey, serializeKey } from "./keys"

/**
 * Create a Fermion family from configuration
 *
 * @internal
 */
export const makeFamily = <A, I, E, R, K>(
  schema: Schema.Schema<A, I, R>,
  config: FermionConfig<A, I, E, R, K>,
  _providedLayers?: Layer.Layer<any, any, any>
): Fermion<A, I, E, R, K> => {
  // Create the atom family for memoized atom creation per key
  const atomFamily = Atom.family((key: K) => {
    // Create base atom with initial Result state
    // Use keepAlive to prevent auto-reset when no subscribers
    let baseAtom = Atom.make<Result.Result<A, E>>(Result.initial()).pipe(
      Atom.keepAlive
    )

    // Apply TTL if configured (idle timeout for cleanup)
    if (config.ttl) {
      baseAtom = Atom.setIdleTTL(baseAtom, config.ttl)
    }

    return baseAtom
  })

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Fetch implementation - fetches entity and updates atom
   *
   * Note: The R type includes AtomRegistry requirements from Atom.set operations.
   * Callers must provide AtomRegistry in their runtime.
   */
  const fetch = (key: K): Effect.Effect<A, E, R | Registry.AtomRegistry> =>
    pipe(
      Effect.Do,
      // Set atom to waiting state (optionally with previous value)
      Effect.flatMap(() => {
        const atom = atomFamily(key)
        return pipe(
          Atom.get(atom),
          Effect.flatMap((currentValue) =>
            Atom.set(atom, Result.waiting(currentValue))
          ),
          Effect.catchAll(() =>
            // If no registry available, just continue without waiting state
            Effect.void
          )
        )
      }),
      Effect.bind("beforeResult", () =>
        config.algebra.beforeFetch
          ? config.algebra.beforeFetch(key)
          : Effect.void
      ),
      Effect.bind("fetchedValue", () => config.algebra.fetch(key)),
      Effect.bind("finalValue", ({ fetchedValue }) =>
        config.algebra.afterFetch
          ? config.algebra.afterFetch(key, fetchedValue)
          : Effect.succeed(fetchedValue)
      ),
      // Set atom to success state
      Effect.tap(({ finalValue }) => {
        const atom = atomFamily(key)
        return Atom.set(atom, Result.success(finalValue))
      }),
      Effect.map(({ finalValue }) => finalValue),
      // On error, set atom to failure state
      Effect.tapError((error) => {
        const atom = atomFamily(key)
        return Atom.set(atom, Result.failure(Cause.fail(error as E)))
      }),
      Effect.withSpan("Fermion.fetch", {
        attributes: { key: serializeKey(key) }
      })
    )

  /**
   * Persist implementation - persists value and updates atom
   */
  const persist = (value: A): Effect.Effect<void, E, R | Registry.AtomRegistry> => {
    if (!config.algebra.persist) {
      return Effect.void as Effect.Effect<void, E, R | Registry.AtomRegistry>
    }

    return pipe(
      Effect.Do,
      Effect.bind("valueToStore", () =>
        config.algebra.beforePersist
          ? config.algebra.beforePersist(value)
          : Effect.succeed(value)
      ),
      Effect.tap(({ valueToStore }) => config.algebra.persist!(valueToStore)),
      Effect.tap(({ valueToStore }) => {
        const key = extractKey(valueToStore, config.key as keyof A) as unknown as K
        const atom = atomFamily(key)
        return Atom.set(atom, Result.success(valueToStore))
      }),
      Effect.tap(({ valueToStore }) =>
        config.algebra.afterPersist
          ? config.algebra.afterPersist(valueToStore)
          : Effect.void
      ),
      Effect.asVoid,
      Effect.withSpan("Fermion.persist")
    )
  }

  /**
   * Remove implementation - removes entity and resets atom
   */
  const remove = (key: K): Effect.Effect<void, E, R | Registry.AtomRegistry> => {
    const atom = atomFamily(key)

    if (!config.algebra.remove) {
      return Atom.set(atom, Result.initial()) as Effect.Effect<void, E, R | Registry.AtomRegistry>
    }

    return pipe(
      config.algebra.remove(key),
      Effect.tap(() => Atom.set(atom, Result.initial())),
      Effect.withSpan("Fermion.remove", {
        attributes: { key: serializeKey(key) }
      })
    )
  }

  /**
   * Invalidate implementation - resets atom to initial without API call
   */
  const invalidate = (key: K): Effect.Effect<void, never, Registry.AtomRegistry> => {
    const atom = atomFamily(key)
    return Atom.set(atom, Result.initial())
  }

  /**
   * Prefetch implementation - fetch multiple keys in parallel
   */
  const prefetch = (keys: readonly K[]): Effect.Effect<void, E, R | Registry.AtomRegistry> =>
    pipe(
      Effect.all(keys.map(fetch), { concurrency: "unbounded" }),
      Effect.asVoid,
      Effect.withSpan("Fermion.prefetch", {
        attributes: { count: keys.length }
      })
    )

  // ============================================================================
  // Build the callable Fermion object
  // ============================================================================

  // Create the base callable function
  const callable = (key: K) => atomFamily(key)

  // Create the fermion object with all properties
  const fermion = Object.assign(callable, {
    [FermionTypeId]: FermionTypeId,
    _tag: "Fermion" as const,
    schema,
    keyField: config.key,
    fetch,
    persist,
    remove,
    atomFor: atomFamily,
    invalidate,
    prefetch,
  }) as unknown as Fermion<A, I, E, R, K>

  return fermion
}

/**
 * Type guard for Fermion instances
 */
export const isFermion = <A, I, E, R, K>(
  value: unknown
): value is Fermion<A, I, E, R, K> =>
  typeof value === "function" &&
  value !== null &&
  FermionTypeId in (value as object)

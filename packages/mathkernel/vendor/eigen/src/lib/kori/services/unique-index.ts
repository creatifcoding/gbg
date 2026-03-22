/**
 * KORI UniqueIndex Service
 *
 * Effect.Service subservice for enforcing unique trait values across entities.
 * Uses HashMap for O(1) lookups, Stream for bulk operations, and pipe for composition.
 *
 * Architecture:
 * - HashMap<TraitId, HashMap<UniqueKey, EntityId>> — nested index structure
 * - Stream.fromIterable + Stream.tap for bulk index operations
 * - Effect.gen for sequential validation flows
 * - Ref for mutable state within Effect context
 *
 * @pattern Effect.Service subservice
 * @module
 */

import {
  Context,
  Effect,
  Layer,
  Ref,
  HashMap,
  Option,
  Stream,
  pipe,
  Chunk,
} from "effect"
import type { TraitId } from "../schemas/trait"
import {
  isUniqueTrait,
  getUniqueKeyExtractor,
  getTraitSchema,
} from "../schemas/trait"
import { TraitValueNotUnique } from "../errors"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Index entry: entityId that owns a unique key
 */
export interface IndexEntry {
  readonly entityId: string
  readonly traitId: TraitId
  readonly key: string
}

/**
 * Index mutation event for reactive streams
 */
export type IndexMutation =
  | { readonly _tag: "Register"; readonly entry: IndexEntry }
  | { readonly _tag: "Unregister"; readonly entry: IndexEntry }
  | { readonly _tag: "Clear"; readonly traitId: TraitId }

/**
 * Index state: HashMap<TraitId, HashMap<UniqueKey, EntityId>>
 */
export type IndexState = HashMap.HashMap<
  TraitId,
  HashMap.HashMap<string, string>
>

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UniqueIndex operations.
 */
export interface UniqueIndexOps {
  /**
   * Check if a unique key is available for a trait.
   * Returns Option.none if available, Option.some(entityId) if taken.
   */
  readonly check: (
    traitId: TraitId,
    key: string
  ) => Effect.Effect<Option.Option<string>>

  /**
   * Register a unique key for an entity.
   * Fails with TraitValueNotUnique if key already exists.
   */
  readonly register: (
    traitId: TraitId,
    key: string,
    entityId: string
  ) => Effect.Effect<void, TraitValueNotUnique>

  /**
   * Unregister a unique key (when entity destroyed or trait removed).
   */
  readonly unregister: (
    traitId: TraitId,
    key: string
  ) => Effect.Effect<void>

  /**
   * Unregister all keys for an entity across all traits.
   * Useful for entity destruction.
   */
  readonly unregisterEntity: (
    entityId: string
  ) => Effect.Effect<void>

  /**
   * Update a unique key (change value while maintaining same entity).
   * Atomically unregisters old key and registers new key.
   */
  readonly update: (
    traitId: TraitId,
    oldKey: string,
    newKey: string,
    entityId: string
  ) => Effect.Effect<void, TraitValueNotUnique>

  /**
   * Validate trait data for uniqueness before insertion.
   * Does NOT register — only checks.
   */
  readonly validateUnique: (
    traitId: TraitId,
    data: unknown,
    entityId: string
  ) => Effect.Effect<void, TraitValueNotUnique>

  /**
   * Register trait data (extract key and register).
   */
  readonly registerFromData: (
    traitId: TraitId,
    data: unknown,
    entityId: string
  ) => Effect.Effect<void, TraitValueNotUnique>

  /**
   * Unregister trait data (extract key and unregister).
   */
  readonly unregisterFromData: (
    traitId: TraitId,
    data: unknown
  ) => Effect.Effect<void>

  /**
   * Get all entries for a trait as a stream.
   */
  readonly entriesStream: (
    traitId: TraitId
  ) => Stream.Stream<IndexEntry>

  /**
   * Get all unique traits that have entries.
   */
  readonly registeredTraits: () => Effect.Effect<ReadonlyArray<TraitId>>

  /**
   * Get index statistics.
   */
  readonly stats: () => Effect.Effect<{
    readonly traitCount: number
    readonly totalEntries: number
    readonly entriesPerTrait: ReadonlyMap<TraitId, number>
  }>

  /**
   * Clear all entries for a trait.
   */
  readonly clearTrait: (traitId: TraitId) => Effect.Effect<void>

  /**
   * Clear entire index.
   */
  readonly clearAll: () => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UniqueIndex service tag.
 */
export class UniqueIndex extends Context.Tag("kori/UniqueIndex")<
  UniqueIndex,
  UniqueIndexOps
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a UniqueIndex service implementation.
 */
export const makeUniqueIndex: Effect.Effect<UniqueIndexOps> = Effect.gen(
  function* () {
    // Core state: nested HashMap for O(1) lookups
    const indexRef = yield* Ref.make<IndexState>(HashMap.empty())

    // Reverse index: entityId → Set<{traitId, key}> for efficient entity cleanup
    const reverseRef = yield* Ref.make<
      HashMap.HashMap<string, Chunk.Chunk<{ traitId: TraitId; key: string }>>
    >(HashMap.empty())

    // ─── Internal Helpers ────────────────────────────────────────────────────

    /**
     * Get the trait index, creating if needed
     */
    const getTraitIndex = (
      state: IndexState,
      traitId: TraitId
    ): HashMap.HashMap<string, string> =>
      pipe(
        HashMap.get(state, traitId),
        Option.getOrElse(() => HashMap.empty())
      )

    /**
     * Extract unique key from trait data
     */
    const extractKey = (
      traitId: TraitId,
      data: unknown
    ): Option.Option<string> => {
      if (!isUniqueTrait(traitId)) return Option.none()
      const extractor = getUniqueKeyExtractor(traitId)
      if (!extractor) return Option.none()
      return Option.some(extractor(data))
    }

    // ─── Service Implementation ──────────────────────────────────────────────

    const ops: UniqueIndexOps = {
      check: (traitId, key) =>
        pipe(
          Ref.get(indexRef),
          Effect.map((state) =>
            pipe(
              getTraitIndex(state, traitId),
              (traitIndex) => HashMap.get(traitIndex, key)
            )
          )
        ),

      register: (traitId, key, entityId) =>
        Effect.gen(function* () {
          // Check if key already exists
          const existing = yield* ops.check(traitId, key)
          if (Option.isSome(existing)) {
            yield* Effect.fail(
              new TraitValueNotUnique({
                traitId: traitId as string,
                key,
                existingEntityId: existing.value,
                attemptedEntityId: entityId,
              })
            )
            return
          }

          // Register in main index
          yield* Ref.update(indexRef, (state) =>
            pipe(
              getTraitIndex(state, traitId),
              (traitIndex) => HashMap.set(traitIndex, key, entityId),
              (updatedTraitIndex) =>
                HashMap.set(state, traitId, updatedTraitIndex)
            )
          )

          // Register in reverse index for cleanup
          yield* Ref.update(reverseRef, (reverse) =>
            pipe(
              HashMap.get(reverse, entityId),
              Option.getOrElse(() => Chunk.empty<{ traitId: TraitId; key: string }>()),
              (existing) => Chunk.append(existing, { traitId, key }),
              (updated) => HashMap.set(reverse, entityId, updated)
            )
          )
        }),

      unregister: (traitId, key) =>
        Effect.gen(function* () {
          // Get entity before removing
          const state = yield* Ref.get(indexRef)
          const entityId = pipe(
            getTraitIndex(state, traitId),
            (traitIndex) => HashMap.get(traitIndex, key)
          )

          // Remove from main index
          yield* Ref.update(indexRef, (state) =>
            pipe(
              getTraitIndex(state, traitId),
              (traitIndex) => HashMap.remove(traitIndex, key),
              (updatedTraitIndex) =>
                HashMap.set(state, traitId, updatedTraitIndex)
            )
          )

          // Remove from reverse index
          if (Option.isSome(entityId)) {
            yield* Ref.update(reverseRef, (reverse) =>
              pipe(
                HashMap.get(reverse, entityId.value),
                Option.map((entries) =>
                  Chunk.filter(
                    entries,
                    (e) => !(e.traitId === traitId && e.key === key)
                  )
                ),
                Option.match({
                  onNone: () => reverse,
                  onSome: (filtered) =>
                    Chunk.isEmpty(filtered)
                      ? HashMap.remove(reverse, entityId.value)
                      : HashMap.set(reverse, entityId.value, filtered),
                })
              )
            )
          }
        }),

      unregisterEntity: (entityId) =>
        Effect.gen(function* () {
          // Get all entries for this entity
          const reverse = yield* Ref.get(reverseRef)
          const entries = pipe(
            HashMap.get(reverse, entityId),
            Option.getOrElse(() => Chunk.empty<{ traitId: TraitId; key: string }>())
          )

          // Stream through entries and unregister each
          yield* pipe(
            Stream.fromIterable(entries),
            Stream.tap((entry) =>
              Ref.update(indexRef, (state) =>
                pipe(
                  getTraitIndex(state, entry.traitId),
                  (traitIndex) => HashMap.remove(traitIndex, entry.key),
                  (updatedTraitIndex) =>
                    HashMap.set(state, entry.traitId, updatedTraitIndex)
                )
              )
            ),
            Stream.runDrain
          )

          // Remove from reverse index
          yield* Ref.update(reverseRef, (reverse) =>
            HashMap.remove(reverse, entityId)
          )
        }),

      update: (traitId, oldKey, newKey, entityId) =>
        Effect.gen(function* () {
          // Skip if no change
          if (oldKey === newKey) return

          // Check if new key is available
          const existing = yield* ops.check(traitId, newKey)
          if (Option.isSome(existing) && existing.value !== entityId) {
            yield* Effect.fail(
              new TraitValueNotUnique({
                traitId: traitId as string,
                key: newKey,
                existingEntityId: existing.value,
                attemptedEntityId: entityId,
              })
            )
            return
          }

          // Atomic update: remove old, add new
          yield* ops.unregister(traitId, oldKey)
          yield* ops.register(traitId, newKey, entityId)
        }),

      validateUnique: (traitId, data, entityId) =>
        Effect.gen(function* () {
          const keyOpt = extractKey(traitId, data)
          if (Option.isNone(keyOpt)) return // Not a unique trait

          const key = keyOpt.value
          const existing = yield* ops.check(traitId, key)

          if (Option.isSome(existing) && existing.value !== entityId) {
            yield* Effect.fail(
              new TraitValueNotUnique({
                traitId: traitId as string,
                key,
                existingEntityId: existing.value,
                attemptedEntityId: entityId,
              })
            )
          }
        }),

      registerFromData: (traitId, data, entityId) =>
        Effect.gen(function* () {
          const keyOpt = extractKey(traitId, data)
          if (Option.isNone(keyOpt)) return // Not a unique trait

          yield* ops.register(traitId, keyOpt.value, entityId)
        }),

      unregisterFromData: (traitId, data) =>
        Effect.gen(function* () {
          const keyOpt = extractKey(traitId, data)
          if (Option.isNone(keyOpt)) return // Not a unique trait

          yield* ops.unregister(traitId, keyOpt.value)
        }),

      entriesStream: (traitId) =>
        pipe(
          Stream.fromEffect(Ref.get(indexRef)),
          Stream.flatMap((state) =>
            pipe(
              getTraitIndex(state, traitId),
              HashMap.toEntries,
              (entries) =>
                Stream.fromIterable(
                  entries.map(([key, entityId]) => ({
                    entityId,
                    traitId,
                    key,
                  }))
                )
            )
          )
        ),

      registeredTraits: () =>
        pipe(
          Ref.get(indexRef),
          Effect.map((state) =>
            pipe(
              HashMap.keys(state),
              (keys) => Array.from(keys)
            )
          )
        ),

      stats: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(indexRef)

          const traitCount = HashMap.size(state)
          let totalEntries = 0
          const entriesPerTrait = new Map<TraitId, number>()

          // Stream through traits to collect stats
          yield* pipe(
            Stream.fromIterable(HashMap.toEntries(state)),
            Stream.tap(([traitId, traitIndex]) =>
              Effect.sync(() => {
                const count = HashMap.size(traitIndex)
                totalEntries += count
                entriesPerTrait.set(traitId, count)
              })
            ),
            Stream.runDrain
          )

          return {
            traitCount,
            totalEntries,
            entriesPerTrait: entriesPerTrait as ReadonlyMap<TraitId, number>,
          }
        }),

      clearTrait: (traitId) =>
        Effect.gen(function* () {
          // Get all entries for this trait
          const state = yield* Ref.get(indexRef)
          const traitIndex = getTraitIndex(state, traitId)

          // Stream through entries and clean reverse index
          yield* pipe(
            Stream.fromIterable(HashMap.toEntries(traitIndex)),
            Stream.tap(([key, entityId]) =>
              Ref.update(reverseRef, (reverse) =>
                pipe(
                  HashMap.get(reverse, entityId),
                  Option.map((entries) =>
                    Chunk.filter(
                      entries,
                      (e) => !(e.traitId === traitId && e.key === key)
                    )
                  ),
                  Option.match({
                    onNone: () => reverse,
                    onSome: (filtered) =>
                      Chunk.isEmpty(filtered)
                        ? HashMap.remove(reverse, entityId)
                        : HashMap.set(reverse, entityId, filtered),
                  })
                )
              )
            ),
            Stream.runDrain
          )

          // Clear the trait index
          yield* Ref.update(indexRef, (state) =>
            HashMap.remove(state, traitId)
          )
        }),

      clearAll: () =>
        Effect.gen(function* () {
          yield* Ref.set(indexRef, HashMap.empty())
          yield* Ref.set(reverseRef, HashMap.empty())
        }),
    }

    return ops
  }
)

/**
 * Default UniqueIndex layer.
 */
export const UniqueIndexLive = Layer.effect(UniqueIndex, makeUniqueIndex)

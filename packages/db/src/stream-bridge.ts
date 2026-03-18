/**
 * @tmnl/db — Effect.Stream bridge
 *
 * Bridges TanStack DB's callback-based `subscribeChanges` into
 * Effect.Stream, enabling composition with all STX streaming
 * materializers (stxReduce, stxFeed, stxLatest, etc.).
 *
 * Pattern: Stream.async wraps the push-based subscribeChanges
 * into a pull-based Effect.Stream.
 *
 * @example
 * ```ts
 * import { collectionChanges, collectionStream } from "@tmnl/db/stream"
 * import { stxLatest } from "@tmnl/stx"
 *
 * // Raw change events as a Stream
 * const changes$ = collectionChanges(todosCollection)
 *
 * // Full collection state as a Stream (re-snapshot on every change)
 * const state$ = collectionStream(todosCollection)
 *
 * // Wire into STX streaming
 * const latest = stxLatest(state$, registry)
 * ```
 *
 * @module
 */

import * as Stream from "effect-v4/Stream"
import * as Effect from "effect-v4/Effect"
import type { CollectionLike, ChangeMessageLike } from "@tmnl/stx"

/**
 * Bridge a TanStack DB Collection's change events into an Effect.Stream.
 *
 * Each emission is an array of ChangeMessages from a single
 * `subscribeChanges` callback invocation.
 *
 * The stream completes when disposed (fiber interruption).
 *
 * @param collection - TanStack DB Collection (or any CollectionLike)
 * @returns Stream of change message batches
 */
export function collectionChanges<T extends object>(
  collection: CollectionLike<T>,
): Stream.Stream<Array<ChangeMessageLike<T>>> {
  return Stream.async<Array<ChangeMessageLike<T>>>((emit) => {
    const sub = collection.subscribeChanges((changes) => {
      emit.single(changes)
    })

    // Return cleanup — called on fiber interruption
    return Effect.sync(() => {
      sub.unsubscribe()
    })
  })
}

/**
 * Bridge a TanStack DB Collection's full state into an Effect.Stream.
 *
 * Each emission is a fresh snapshot of `Array.from(collection.values())`,
 * emitted whenever the collection changes.
 *
 * First emission is the initial state (eager).
 *
 * @param collection - TanStack DB Collection (or any CollectionLike)
 * @returns Stream of full state snapshots
 */
export function collectionStream<T extends object>(
  collection: CollectionLike<T>,
): Stream.Stream<Array<T>> {
  return Stream.async<Array<T>>((emit) => {
    // Emit initial state eagerly
    emit.single(Array.from(collection.values()))

    const sub = collection.subscribeChanges(() => {
      emit.single(Array.from(collection.values()))
    })

    return Effect.sync(() => {
      sub.unsubscribe()
    })
  })
}

/**
 * Bridge a TanStack DB Collection into a Stream of individual items.
 *
 * Flattens each change batch into individual change messages.
 * Useful for per-item processing pipelines.
 *
 * @param collection - TanStack DB Collection (or any CollectionLike)
 * @returns Stream of individual change messages
 */
export function collectionItemChanges<T extends object>(
  collection: CollectionLike<T>,
): Stream.Stream<ChangeMessageLike<T>> {
  return Stream.flatMap(
    collectionChanges(collection),
    (batch) => Stream.fromIterable(batch),
  )
}

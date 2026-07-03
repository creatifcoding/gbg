/**
 * Generic async pattern wrappers for Effect Streams.
 *
 * These utilities wrap common async patterns (callbacks, iterables) into Effect Streams.
 * They are NOT NATS-specific - the actual NATS logic lives in each service.
 *
 * v3 → v4: Stream.asyncEffect replaced by Stream.callback (queue-based).
 * fromAsyncIterable, ensuring, unwrap, mapEffect all stable.
 *
 * @module @tmnl/msh/utils/stream
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as Queue from 'effect/Queue';

/**
 * Wraps a callback-based subscription pattern into an Effect Stream.
 *
 * v4 uses Stream.callback with a Queue instead of the removed Stream.asyncEffect.
 * The subscribe function receives callbacks for emitting values, errors, and completion.
 * Cleanup is registered via Effect.acquireRelease within the callback scope.
 *
 * @example
 * ```ts
 * const stream = fromCallback<Msg, MyError>(
 *   (onValue, onError, onEnd) => {
 *     const sub = nc.subscribe("events", {
 *       callback: (err, msg) => {
 *         if (err) onError(new MyError({ cause: err }));
 *         else onValue(msg);
 *       }
 *     });
 *     return () => sub.unsubscribe();
 *   }
 * );
 * ```
 */
export const fromCallback = <A, E>(
  subscribe: (
    onValue: (value: A) => void,
    onError: (error: E) => void,
    onEnd: () => void,
  ) => () => void,
): Stream.Stream<A, E> =>
  Stream.callback<A, E>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        subscribe(
          (value) => Queue.offerUnsafe(queue, value),
          (_error) => Queue.endUnsafe(queue),
          () => Queue.endUnsafe(queue),
        ),
      ),
      (cleanup) => Effect.sync(cleanup),
    ),
  );

/**
 * Wraps an AsyncIterable into an Effect Stream.
 *
 * Uses Effect's built-in Stream.fromAsyncIterable with optional cleanup support.
 * Prefer `fromCallback` when callbacks are available - it's more Effect-native.
 */
export const fromAsyncIterable = <A, E>(
  iterable: AsyncIterable<A>,
  onError: (cause: unknown) => E,
  cleanup?: () => void,
): Stream.Stream<A, E> =>
  cleanup
    ? Stream.ensuring(
        Stream.fromAsyncIterable(iterable, onError),
        Effect.sync(cleanup),
      )
    : Stream.fromAsyncIterable(iterable, onError);

/**
 * Wraps an Effect that produces an AsyncIterable into a Stream.
 *
 * Use when you need to perform an Effect (e.g., get a resource) before iterating.
 */
export const fromEffectAsyncIterable = <A, E, R>(
  getIterable: Effect.Effect<AsyncIterable<A>, E, R>,
  onIterError: (error: unknown) => E,
  cleanup?: (iterable: AsyncIterable<A>) => void,
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.map(getIterable, (iterable) =>
      fromAsyncIterable(iterable, onIterError, () => cleanup?.(iterable)),
    ),
  );

/**
 * Like fromEffectAsyncIterable but with a transform step for each item.
 */
export const fromEffectAsyncIterableWithTransform = <A, B, E1, E2, R1, R2>(
  getIterable: Effect.Effect<AsyncIterable<A>, E1, R1>,
  transform: (item: A) => Effect.Effect<B, E2, R2>,
  onIterError: (error: unknown) => E1,
  cleanup?: (iterable: AsyncIterable<A>) => void,
): Stream.Stream<B, E1 | E2, R1 | R2> =>
  Stream.unwrap(
    Effect.map(getIterable, (iterable) =>
      Stream.mapEffect(
        fromAsyncIterable(iterable, onIterError, () => cleanup?.(iterable)),
        transform,
      ),
    ),
  );

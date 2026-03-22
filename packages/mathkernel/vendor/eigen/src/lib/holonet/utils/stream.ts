/**
 * Generic async pattern wrappers for Effect Streams.
 *
 * These utilities wrap common async patterns (callbacks, iterables) into Effect Streams.
 * They are NOT NATS-specific - the actual NATS logic lives in each service.
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';

/**
 * Wraps a callback-based subscription pattern into an Effect Stream.
 *
 * This is the most Effect-native pattern - no Promises, no async/await.
 * The subscribe function receives callbacks for emitting values, errors, and completion.
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
    onEnd: () => void
  ) => () => void
): Stream.Stream<A, E> =>
  Stream.asyncEffect<A, E>((emit) =>
    Effect.sync(() => {
      const cleanup = subscribe(
        (value) => emit.single(value),
        (error) => emit.fail(error),
        () => emit.end()
      );
      return Effect.sync(cleanup);
    })
  );

/**
 * Wraps an AsyncIterable into an Effect Stream.
 *
 * Uses Effect's built-in Stream.fromAsyncIterable with optional cleanup support.
 * Prefer `fromCallback` when callbacks are available - it's more Effect-native.
 *
 * @example
 * ```ts
 * const stream = fromAsyncIterable(
 *   someAsyncIterable,
 *   (err) => new MyError({ cause: err }),
 *   () => watcher.stop()
 * );
 * ```
 */
export const fromAsyncIterable = <A, E>(
  iterable: AsyncIterable<A>,
  onError: (cause: unknown) => E,
  cleanup?: () => void
): Stream.Stream<A, E> =>
  cleanup
    ? Stream.ensuring(
        Stream.fromAsyncIterable(iterable, onError),
        Effect.sync(cleanup)
      )
    : Stream.fromAsyncIterable(iterable, onError);

/**
 * Wraps an Effect that produces an AsyncIterable into a Stream.
 *
 * Use when you need to perform an Effect (e.g., get a resource) before iterating.
 *
 * @example
 * ```ts
 * const stream = fromEffectAsyncIterable(
 *   Effect.tryPromise(() => getWatcher()),
 *   (err) => new MyError({ cause: err })
 * );
 * ```
 */
export const fromEffectAsyncIterable = <A, E, R>(
  getIterable: Effect.Effect<AsyncIterable<A>, E, R>,
  onIterError: (error: unknown) => E,
  cleanup?: (iterable: AsyncIterable<A>) => void
): Stream.Stream<A, E, R> =>
  Stream.unwrap(
    Effect.map(getIterable, (iterable) =>
      fromAsyncIterable(iterable, onIterError, () => cleanup?.(iterable))
    )
  );

/**
 * Like fromEffectAsyncIterable but with a transform step for each item.
 *
 * @example
 * ```ts
 * const stream = fromEffectAsyncIterableWithTransform(
 *   Effect.tryPromise(() => nc.subscribe("events")),
 *   (msg) => decodeMessage(msg),
 *   (err) => new SubscribeError({ cause: err }),
 *   (err) => new IterationError({ cause: err }),
 *   (sub) => sub.unsubscribe()
 * );
 * ```
 */
export const fromEffectAsyncIterableWithTransform = <A, B, E1, E2, R1, R2>(
  getIterable: Effect.Effect<AsyncIterable<A>, E1, R1>,
  transform: (item: A) => Effect.Effect<B, E2, R2>,
  onIterError: (error: unknown) => E1,
  cleanup?: (iterable: AsyncIterable<A>) => void
): Stream.Stream<B, E1 | E2, R1 | R2> =>
  Stream.unwrap(
    Effect.map(getIterable, (iterable) =>
      Stream.mapEffect(
        fromAsyncIterable(iterable, onIterError, () => cleanup?.(iterable)),
        transform
      )
    )
  );

// ============================================================================
// Legacy exports for backward compatibility during migration
// These match the old API signatures so existing services don't break
// ============================================================================

/**
 * @deprecated Use fromEffectAsyncIterable instead
 */
export const effectToStream = fromEffectAsyncIterable;

/**
 * @deprecated Use fromEffectAsyncIterableWithTransform instead
 */
export const effectToStreamWithTransform = fromEffectAsyncIterableWithTransform;

/**
 * Legacy wrapper matching old subscriptionToStream signature.
 * @deprecated Migrate to fromCallback (if callback API available) or fromEffectAsyncIterable
 */
export const subscriptionToStream = <A, E1, E2>(
  getSubscription: () => Promise<AsyncIterable<A>>,
  onIterError: (error: unknown) => E1,
  onSubscribeError: (error: unknown) => E2,
  cleanup?: (sub: AsyncIterable<A>) => void
): Stream.Stream<A, E1 | E2> =>
  fromEffectAsyncIterable(
    Effect.tryPromise({
      try: getSubscription,
      catch: onSubscribeError,
    }),
    onIterError,
    cleanup
  );

/**
 * Legacy wrapper matching old subscriptionToStreamWithTransform signature.
 * @deprecated Migrate to fromCallback (if callback API available) or fromEffectAsyncIterableWithTransform
 */
export const subscriptionToStreamWithTransform = <A, B, E1, E2, E3, R>(
  getSubscription: () => Promise<AsyncIterable<A>>,
  transform: (item: A) => Effect.Effect<B, E3, R>,
  onSubscribeError: (error: unknown) => E1,
  onIterError: (error: unknown) => E2,
  cleanup?: (sub: AsyncIterable<A>) => void
): Stream.Stream<B, E1 | E2 | E3, R> =>
  fromEffectAsyncIterableWithTransform(
    Effect.tryPromise({
      try: getSubscription,
      catch: onSubscribeError,
    }),
    transform,
    onIterError,
    cleanup
  );

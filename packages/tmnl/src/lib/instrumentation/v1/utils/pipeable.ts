/**
 * Pipeable utilities for Effect instrumentation
 *
 * @module instrumentation/v1/utils/pipeable
 */

import { Effect, Cause } from 'effect';
import { InstrumentationService } from '../services/InstrumentationService';
import type { SpanAttributes, SpanKind } from '../types';

/**
 * Wraps an Effect with automatic span creation and capture
 */
export const withInstrumentedSpan = <A, E, R>(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
  }
) => {
  return (
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | InstrumentationService> =>
    Effect.gen(function* () {
      const service = yield* InstrumentationService;

      const spanId = yield* service.startSpan(
        name,
        options?.kind ?? 'internal',
        options?.attributes ?? {}
      );

      try {
        const result = yield* effect;
        yield* service.endSpan(spanId, 'ok');
        return result;
      } catch (error) {
        yield* service.endSpan(spanId, 'error');
        return yield* Effect.fail(error as E);
      }
    });
};

/**
 * Tap into an Effect to trace intermediate values
 */
export const tapTrace = <A>(
  eventName: string,
  extractAttributes?: (value: A) => SpanAttributes
) => {
  return <E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | InstrumentationService> =>
    Effect.gen(function* () {
      const service = yield* InstrumentationService;
      const value = yield* effect;

      const attributes = extractAttributes?.(value) ?? {};
      const spanId = yield* service.startSpan(
        eventName,
        'internal',
        attributes
      );
      yield* service.endSpan(spanId, 'ok');

      return value;
    });
};

/**
 * Capture errors with full Cause information
 */
export const captureError = <E>(
  eventName: string,
  extractAttributes?: (cause: Cause.Cause<E>) => SpanAttributes
) => {
  return <A, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | InstrumentationService> =>
    effect.pipe(
      Effect.tapErrorCause((cause) =>
        Effect.gen(function* () {
          const service = yield* InstrumentationService;
          const attributes = extractAttributes?.(cause) ?? {};

          const spanId = yield* service.startSpan(eventName, 'internal', {
            ...attributes,
            'error.cause': Cause.pretty(cause),
          });

          yield* service.endSpan(spanId, 'error');
        })
      )
    );
};

/**
 * Create a traced function from a regular function
 */
export const traced = <Args extends readonly unknown[], A>(
  name: string,
  fn: (...args: Args) => A,
  options?: {
    kind?: SpanKind;
    attributes?: (...args: Args) => SpanAttributes;
  }
) => {
  return (...args: Args): Effect.Effect<A, never, InstrumentationService> =>
    Effect.gen(function* () {
      const service = yield* InstrumentationService;

      const spanId = yield* service.startSpan(
        name,
        options?.kind ?? 'internal',
        options?.attributes?.(...args) ?? {}
      );

      try {
        const result = fn(...args);
        yield* service.endSpan(spanId, 'ok');
        return result;
      } catch (error) {
        yield* service.endSpan(spanId, 'error');
        throw error;
      }
    });
};

/**
 * Time an Effect execution
 */
export const timed = (spanName: string) => {
  return <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | InstrumentationService> =>
    Effect.gen(function* () {
      const service = yield* InstrumentationService;
      const spanId = yield* service.startSpan(spanName, 'internal', {});

      try {
        const result = yield* effect;
        yield* service.endSpan(spanId, 'ok');
        return result;
      } catch (error) {
        yield* service.endSpan(spanId, 'error');
        return yield* Effect.fail(error as E);
      }
    });
};

/**
 * Batch multiple spans together (useful for parallel operations)
 */
export const batchSpans = <
  T extends Record<string, Effect.Effect<any, any, any>>
>(
  parentSpanName: string,
  operations: T
): Effect.Effect<
  { [K in keyof T]: T[K] extends Effect.Effect<infer A, any, any> ? A : never },
  T[keyof T] extends Effect.Effect<any, infer E, any> ? E : never,
  | (T[keyof T] extends Effect.Effect<any, any, infer R> ? R : never)
  | InstrumentationService
> =>
  Effect.gen(function* () {
    const service = yield* InstrumentationService;

    const parentSpanId = yield* service.startSpan(parentSpanName, 'internal', {
      'batch.size': Object.keys(operations).length,
    });

    try {
      const results = {} as any;

      const entries = Object.entries(operations);
      const effects = entries.map(([key, effect]) =>
        effect.pipe(withInstrumentedSpan(`${parentSpanName}.${key}`))
      );

      const values = yield* Effect.all(effects, { concurrency: 'unbounded' });

      entries.forEach(([key], index) => {
        results[key] = values[index];
      });

      yield* service.endSpan(parentSpanId, 'ok');

      return results;
    } catch (error) {
      yield* service.endSpan(parentSpanId, 'error');
      return yield* Effect.fail(error as any);
    }
  });

/**
 * Generic NATS error wrapping utilities for MSH services
 *
 * Provides consistent error handling patterns across all services.
 *
 * @module @tmnl/msh/utils/errors
 */

import * as Effect from 'effect/Effect';

/**
 * Generic NATS error wrapper factory
 *
 * Creates a reusable error wrapping function for NATS operations.
 *
 * @example
 * ```typescript
 * const wrapPubSubError = wrapNatsError(
 *   (cause) => new MshPublishError({ message: 'Publish failed', cause })
 * );
 *
 * const publish = (subject: string, data: Uint8Array) =>
 *   Effect.tryPromise({
 *     try: () => nc.publish(subject, data),
 *     catch: wrapPubSubError('publish')
 *   });
 * ```
 */
export const wrapNatsError =
  <E>(createError: (cause: unknown) => E) =>
  (_operation: string) =>
  (err: unknown): E =>
    createError(err);

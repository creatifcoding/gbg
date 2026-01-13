/**
 * Generic schema validation utilities for Holonet services
 *
 * Provides consistent Effect-native validation patterns across all services.
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { ParseResult } from 'effect';

/**
 * Generic schema validation helper
 *
 * Wraps Schema.decodeUnknown to provide consistent validation across services.
 *
 * @example
 * ```typescript
 * const validated = yield* validateSchema(MyConfigSchema, userInput);
 * ```
 */
export const validateSchema = <A, I>(
  schema: Schema.Schema<A, I>,
  input: unknown
): Effect.Effect<A, ParseResult.ParseError> =>
  Schema.decodeUnknown(schema)(input);

/**
 * Generic schema validation utilities for MSH services
 *
 * @module @tmnl/msh/utils/validation
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

/**
 * Generic schema validation helper.
 * Wraps Schema.decodeUnknownEffect for consistent validation.
 */
export const validateSchema = <S extends Schema.Top>(
  schema: S,
  input: unknown,
): Effect.Effect<S['Type'], Schema.SchemaError, S['DecodingServices']> =>
  Schema.decodeUnknownEffect(schema)(input);

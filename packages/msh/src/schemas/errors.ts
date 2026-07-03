/**
 * Shared schema-level errors for MSH
 *
 * @module @tmnl/msh/schemas/errors
 */

import * as Schema from 'effect/Schema';

/**
 * Generic decode error used by shared codec utilities.
 */
export class MshDecodeError extends Schema.TaggedErrorClass<MshDecodeError>(
  '@tmnl/msh/MshDecodeError',
)('Msh/Decode', {
  message: Schema.String,
  subject: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
}) {}

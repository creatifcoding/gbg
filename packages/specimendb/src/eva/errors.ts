/**
 * EVA source errors. Shape mined from ava-domain SourceError. Not tmnl.
 *
 * @module @tmnl/specimendb/eva/errors
 */

import * as Schema from 'effect/Schema';

export class SourceError extends Schema.TaggedErrorClass<SourceError>(
  '@tmnl/specimendb/eva/SourceError',
)('SourceError', {
  sourceId: Schema.String,
  operation: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

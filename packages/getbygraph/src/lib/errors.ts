/**
 * Graph errors. Components remain SoT. This package is a projection.
 *
 * @module @gbg/graph/errors
 */

import * as Schema from 'effect/Schema';

export class GraphError extends Schema.TaggedErrorClass<GraphError>('@gbg/graph/GraphError')(
  'GraphError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

/**
 * Genifer RPC Error Schemas
 *
 * Schema.TaggedError definitions for the genifer error channel.
 *
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Query Errors
// =============================================================================

/** Error executing genifer query */
export class GeniferQueryError extends Schema.TaggedError<GeniferQueryError>()('GeniferQueryError', {
  operation: Schema.String,
  message: Schema.String,
}) {}

// =============================================================================
// Not Found Errors
// =============================================================================

/** Tree not found */
export class GeniferTreeNotFoundError extends Schema.TaggedError<GeniferTreeNotFoundError>()(
  'GeniferTreeNotFoundError',
  { treeId: Schema.String }
) {}

/** Composite not found */
export class GeniferCompositeNotFoundError extends Schema.TaggedError<GeniferCompositeNotFoundError>()(
  'GeniferCompositeNotFoundError',
  { compositeId: Schema.String }
) {}

// =============================================================================
// Validation Errors
// =============================================================================

/** Invalid rating value */
export class GeniferInvalidRatingError extends Schema.TaggedError<GeniferInvalidRatingError>()(
  'GeniferInvalidRatingError',
  {
    value: Schema.Number,
    message: Schema.String,
  }
) {}

/** Persistence error */
export class GeniferPersistenceError extends Schema.TaggedError<GeniferPersistenceError>()(
  'GeniferPersistenceError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

/**
 * Genifer RPC Error Schemas
 *
 * Schema.TaggedError definitions for the RPC error channel.
 * Pattern: follows iiot/rpc/errors.ts exactly.
 *
 * @module genifer/rpc/errors
 */

import { Schema } from 'effect'

// =============================================================================
// Query Errors
// =============================================================================

/** Generic query/repo failure */
export class RpcGeniferQueryError extends Schema.TaggedError<RpcGeniferQueryError>()(
  'RpcGeniferQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

// =============================================================================
// Not Found Errors
// =============================================================================

/** Tree not found */
export class RpcGeniferTreeNotFoundError extends Schema.TaggedError<RpcGeniferTreeNotFoundError>()(
  'RpcGeniferTreeNotFoundError',
  {
    treeId: Schema.String,
  },
) {}

/** Element not found */
export class RpcGeniferElementNotFoundError extends Schema.TaggedError<RpcGeniferElementNotFoundError>()(
  'RpcGeniferElementNotFoundError',
  {
    treeId: Schema.String,
    elementKey: Schema.String,
  },
) {}

/** Composite not found */
export class RpcGeniferCompositeNotFoundError extends Schema.TaggedError<RpcGeniferCompositeNotFoundError>()(
  'RpcGeniferCompositeNotFoundError',
  {
    name: Schema.String,
  },
) {}

// =============================================================================
// Validation Errors
// =============================================================================

/** Input validation failure */
export class RpcGeniferValidationError extends Schema.TaggedError<RpcGeniferValidationError>()(
  'RpcGeniferValidationError',
  {
    field: Schema.String,
    message: Schema.String,
  },
) {}

/**
 * Durable-Streams Error Type Hierarchy
 *
 * Comprehensive error types for the durable-streams HTTP protocol layer.
 * Follows the Error Propagation Flow from the architecture plan:
 *
 *   NATS Layer → Bridge Services → Protocol Handlers → HTTP Response
 *
 * Each error maps to a specific HTTP status code for client handling.
 *
 * @module holonet/durable-streams/schemas/errors
 */

import { Data, Schema } from 'effect';

// =============================================================================
// HTTP Status Code Mapping
// =============================================================================

/**
 * Maps error tags to HTTP status codes for protocol handlers
 */
export const ERROR_STATUS_CODES = {
  // Auth Errors (4xx)
  InvalidTokenError: 401,
  ForbiddenError: 403,
  TokenRefreshRequired: 401,

  // Protocol Errors (4xx)
  InvalidOffsetError: 400,
  StreamNotFoundError: 404,
  StreamExistsError: 409,
  ContentTypeMismatch: 409,
  SequenceConflictError: 409,
  SchemaNotFoundError: 400,
  SchemaValidationError: 422,

  // Live Mode Errors
  LongPollTimeoutError: 204, // Not an error - just no data
  SSEConnectionError: 500,
  SubscriptionError: 500,

  // Internal Errors (5xx)
  NatsConnectionError: 503,
  CodecError: 500,
  UnexpectedError: 500,
} as const;

export type ErrorTag = keyof typeof ERROR_STATUS_CODES;

// =============================================================================
// Auth Errors
// =============================================================================

/**
 * JWT token is malformed, expired, or invalid
 */
export class InvalidTokenError extends Data.TaggedError('InvalidTokenError')<{
  readonly reason: string;
  readonly token?: string; // Redacted in logs
}> {}

/**
 * Valid token but insufficient permissions for operation
 */
export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly operation: string;
  readonly requiredPermission: string;
  readonly streamId?: string;
}> {}

/**
 * Token is about to expire and needs refresh
 */
export class TokenRefreshRequired extends Data.TaggedError('TokenRefreshRequired')<{
  readonly expiresIn: number; // Seconds until expiry
}> {}

// =============================================================================
// Protocol Errors
// =============================================================================

/**
 * Offset format is invalid (not a number, negative, etc.)
 */
export class InvalidOffsetError extends Data.TaggedError('InvalidOffsetError')<{
  readonly offset: string;
  readonly reason: string;
}> {}

/**
 * Requested stream does not exist
 */
export class StreamNotFoundError extends Data.TaggedError('StreamNotFoundError')<{
  readonly streamId: string;
}> {}

/**
 * Attempted to create a stream that already exists
 */
export class StreamExistsError extends Data.TaggedError('StreamExistsError')<{
  readonly streamId: string;
}> {}

/**
 * Content-Type header doesn't match stream's declared schema
 */
export class ContentTypeMismatch extends Data.TaggedError('ContentTypeMismatch')<{
  readonly streamId: string;
  readonly expected: string;
  readonly received: string;
}> {}

/**
 * Producer sequence number gap detected (idempotency conflict)
 */
export class SequenceConflictError extends Data.TaggedError('SequenceConflictError')<{
  readonly streamId: string;
  readonly producerId: string;
  readonly expectedSeq: number;
  readonly receivedSeq: number;
}> {}

// =============================================================================
// Live Mode Errors
// =============================================================================

/**
 * Long-poll timeout - no data within specified duration
 * Note: This is not really an error, just signals "no new data"
 */
export class LongPollTimeoutError extends Data.TaggedError('LongPollTimeoutError')<{
  readonly streamId: string;
  readonly timeout: number; // Milliseconds
  readonly lastOffset: number;
}> {}

/**
 * SSE connection was interrupted
 */
export class SSEConnectionError extends Data.TaggedError('SSEConnectionError')<{
  readonly streamId: string;
  readonly reason: string;
  readonly lastOffset?: number;
}> {}

/**
 * NATS consumer subscription failed
 */
export class SubscriptionError extends Data.TaggedError('SubscriptionError')<{
  readonly streamId: string;
  readonly consumerName?: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Internal Errors
// =============================================================================

/**
 * NATS server is unavailable or connection lost
 */
export class NatsConnectionError extends Data.TaggedError('NatsConnectionError')<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Catch-all for unexpected errors
 */
export class UnexpectedError extends Data.TaggedError('UnexpectedError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Error Union Types
// =============================================================================

/**
 * All authentication-related errors
 */
export type AuthError = InvalidTokenError | ForbiddenError | TokenRefreshRequired;

/**
 * All protocol-related errors (client can fix)
 */
export type ProtocolError =
  | InvalidOffsetError
  | StreamNotFoundError
  | StreamExistsError
  | ContentTypeMismatch
  | SequenceConflictError;

/**
 * All live mode errors
 */
export type LiveModeError = LongPollTimeoutError | SSEConnectionError | SubscriptionError;

/**
 * All internal errors (server-side)
 */
export type InternalError = NatsConnectionError | UnexpectedError;

/**
 * All durable-stream errors
 */
export type DurableStreamError = AuthError | ProtocolError | LiveModeError | InternalError;

// =============================================================================
// Error Response Schema (for HTTP API)
// =============================================================================

/**
 * Standard error response schema for HTTP API
 */
export const ErrorResponse = Schema.Struct({
  error: Schema.String,
  message: Schema.String,
  code: Schema.optional(Schema.String),
  details: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

export type ErrorResponse = typeof ErrorResponse.Type;

// =============================================================================
// Error Helpers
// =============================================================================

/**
 * Get HTTP status code for an error
 */
export const getStatusCode = (error: DurableStreamError): number => {
  const tag = error._tag as ErrorTag;
  return ERROR_STATUS_CODES[tag] ?? 500;
};

/**
 * Convert error to HTTP response body
 */
export const toErrorResponse = (error: DurableStreamError): ErrorResponse => ({
  error: toSnakeCase(error._tag.replace(/Error$/, '')),
  message: getErrorMessage(error),
  code: error._tag,
  details: getErrorDetails(error),
});

/**
 * Convert PascalCase to snake_case
 */
const toSnakeCase = (str: string): string =>
  str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

/**
 * Get human-readable error message
 */
const getErrorMessage = (error: DurableStreamError): string => {
  switch (error._tag) {
    case 'InvalidTokenError':
      return `Authentication failed: ${error.reason}`;
    case 'ForbiddenError':
      return `Forbidden: operation '${error.operation}' requires permission '${error.requiredPermission}'`;
    case 'TokenRefreshRequired':
      return `Token expires in ${error.expiresIn} seconds, please refresh`;
    case 'InvalidOffsetError':
      return `Invalid offset '${error.offset}': ${error.reason}`;
    case 'StreamNotFoundError':
      return `Stream '${error.streamId}' not found`;
    case 'StreamExistsError':
      return `Stream '${error.streamId}' already exists`;
    case 'ContentTypeMismatch':
      return `Content-Type mismatch: expected '${error.expected}', received '${error.received}'`;
    case 'SequenceConflictError':
      return `Sequence conflict: expected ${error.expectedSeq}, received ${error.receivedSeq}`;
    case 'LongPollTimeoutError':
      return `No new data within ${error.timeout}ms`;
    case 'SSEConnectionError':
      return `SSE connection error: ${error.reason}`;
    case 'SubscriptionError':
      return `Subscription error: ${error.reason}`;
    case 'NatsConnectionError':
      return `NATS connection error: ${error.reason}`;
    case 'UnexpectedError':
      return `Unexpected error: ${error.message}`;
    default:
      return 'Unknown error';
  }
};

/**
 * Extract error details for debugging (without sensitive info)
 */
const getErrorDetails = (error: DurableStreamError): Record<string, unknown> | undefined => {
  switch (error._tag) {
    case 'StreamNotFoundError':
    case 'StreamExistsError':
      return { streamId: error.streamId };
    case 'SequenceConflictError':
      return {
        streamId: error.streamId,
        producerId: error.producerId,
        expectedSeq: error.expectedSeq,
        receivedSeq: error.receivedSeq,
      };
    case 'LongPollTimeoutError':
      return { streamId: error.streamId, lastOffset: error.lastOffset };
    case 'SSEConnectionError':
      return { streamId: error.streamId, lastOffset: error.lastOffset };
    default:
      return undefined;
  }
};

// =============================================================================
// Re-exports from existing modules
// =============================================================================

// Re-export existing errors that are part of the hierarchy
export {
  CodecError,
  SchemaValidationError,
  MissingSchemaHeaderError,
} from '../services/StreamCodecService';

export {
  SchemaNotFoundError,
  StreamSchemaNotFoundError,
  SchemaAlreadyRegisteredError,
  ContentTypeParseError,
} from '@/lib/holonet/core/schema';

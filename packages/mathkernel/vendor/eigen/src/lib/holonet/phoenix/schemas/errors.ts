/**
 * Holonet Phoenix Error Schemas and Tagged Errors
 *
 * @module holonet/phoenix/schemas/errors
 */

import { Data, Schema } from 'effect';

// =============================================================================
// Schema-level protocol error codes
// =============================================================================

export const PhoenixProtocolErrorCode = Schema.Literal(
  'join_timeout',
  'join_rejected',
  'replay_decode_failed',
  'replay_apply_failed',
  'replay_ack_timeout',
  'replay_ack_rejected',
  'cursor_stale',
  'auth_failed',
  'not_connected',
  'buffer_overflow',
  'transport_closed',
);
export type PhoenixProtocolErrorCode = typeof PhoenixProtocolErrorCode.Type;

export const PhoenixProtocolError = Schema.Struct({
  code: PhoenixProtocolErrorCode,
  message: Schema.String,
  correlationId: Schema.optional(Schema.String),
  replaySessionId: Schema.optional(Schema.String),
  lastSeenEventId: Schema.optional(Schema.String),
});
export type PhoenixProtocolError = typeof PhoenixProtocolError.Type;

// =============================================================================
// Runtime tagged errors
// =============================================================================

export namespace PhoenixErrors {
  export class AuthTokenError extends Data.TaggedError('Holonet/Phoenix/AuthTokenError')<{
    readonly message: string;
    readonly cause?: unknown;
  }> {}

  export class TransportError extends Data.TaggedError('Holonet/Phoenix/TransportError')<{
    readonly message: string;
    readonly code: PhoenixProtocolErrorCode;
    readonly cause?: unknown;
  }> {}

  export class JoinError extends Data.TaggedError('Holonet/Phoenix/JoinError')<{
    readonly message: string;
    readonly cause?: unknown;
  }> {}

  export class ReplayAckRejectedError extends Data.TaggedError(
    'Holonet/Phoenix/ReplayAckRejectedError',
  )<{
    readonly message: string;
    readonly replaySessionId: string;
    readonly cause?: unknown;
  }> {}

  export class ReplayAckTimeoutError extends Data.TaggedError(
    'Holonet/Phoenix/ReplayAckTimeoutError',
  )<{
    readonly replaySessionId: string;
    readonly timeoutMs: number;
  }> {}

  export class NotConnectedError extends Data.TaggedError('Holonet/Phoenix/NotConnectedError')<{
    readonly operation: string;
  }> {}

  export class BufferOverflowError extends Data.TaggedError('Holonet/Phoenix/BufferOverflowError')<{
    readonly maxBuffer: number;
    readonly policy: 'drop-oldest' | 'drop-newest' | 'fail-session';
  }> {}

  export type Error =
    | AuthTokenError
    | TransportError
    | JoinError
    | ReplayAckRejectedError
    | ReplayAckTimeoutError
    | NotConnectedError
    | BufferOverflowError;
}

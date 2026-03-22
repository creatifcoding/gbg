/**
 * Tsingou Adapter Errors — Tagged error hierarchy.
 *
 * Every adapter error is a Data.TaggedError, enabling:
 *   - Effect.catchTag / Effect.catchTags for precise recovery
 *   - Typed error channels (no `unknown` escape hatches)
 *   - Pattern matching on _tag
 *   - yield* in Effect.gen (yieldable errors)
 *
 * @module tsingou-flow/adapters/errors
 */

import { Data } from 'effect'

// =============================================================================
// Connection Errors
// =============================================================================

export class AdapterConnectError extends Data.TaggedError('AdapterConnectError')<{
  readonly adapterId: string
  readonly kind: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class AdapterDisconnectError extends Data.TaggedError('AdapterDisconnectError')<{
  readonly adapterId: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// HTTP-Specific Errors
// =============================================================================

export class HttpRequestError extends Data.TaggedError('HttpRequestError')<{
  readonly adapterId: string
  readonly url: string
  readonly method: string
  readonly statusCode?: number
  readonly message: string
  readonly cause?: unknown
}> {}

export class HttpParseError extends Data.TaggedError('HttpParseError')<{
  readonly adapterId: string
  readonly url: string
  readonly message: string
  readonly rawBody?: string
  readonly cause?: unknown
}> {}

export class HttpAuthError extends Data.TaggedError('HttpAuthError')<{
  readonly adapterId: string
  readonly url: string
  readonly statusCode: number
  readonly message: string
}> {}

export class HttpTimeoutError extends Data.TaggedError('HttpTimeoutError')<{
  readonly adapterId: string
  readonly url: string
  readonly timeoutMs: number
}> {}

export class SseConnectionError extends Data.TaggedError('SseConnectionError')<{
  readonly adapterId: string
  readonly url: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// WebSocket Errors
// =============================================================================

export class WsConnectError extends Data.TaggedError('WsConnectError')<{
  readonly adapterId: string
  readonly url: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class WsMessageError extends Data.TaggedError('WsMessageError')<{
  readonly adapterId: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// NATS Errors
// =============================================================================

export class NatsSubscribeError extends Data.TaggedError('NatsSubscribeError')<{
  readonly adapterId: string
  readonly subject: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// File Watch Errors
// =============================================================================

export class FileWatchError extends Data.TaggedError('FileWatchError')<{
  readonly adapterId: string
  readonly path: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class FileParseError extends Data.TaggedError('FileParseError')<{
  readonly adapterId: string
  readonly path: string
  readonly format: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// RSS Errors
// =============================================================================

export class RssFetchError extends Data.TaggedError('RssFetchError')<{
  readonly adapterId: string
  readonly feedUrl: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class RssParseError extends Data.TaggedError('RssParseError')<{
  readonly adapterId: string
  readonly feedUrl: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Serial Errors
// =============================================================================

export class SerialConnectError extends Data.TaggedError('SerialConnectError')<{
  readonly adapterId: string
  readonly port: string
  readonly baudRate: number
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Signal Errors
// =============================================================================

export class SignalValidationError extends Data.TaggedError('SignalValidationError')<{
  readonly adapterId: string
  readonly kind: string
  readonly message: string
  readonly rawPayload?: unknown
}> {}

export class SignalQueueFullError extends Data.TaggedError('SignalQueueFullError')<{
  readonly adapterId: string
  readonly queueCapacity: number
}> {}

// =============================================================================
// Union Type (all adapter errors)
// =============================================================================

export type AdapterError =
  | AdapterConnectError
  | AdapterDisconnectError
  | HttpRequestError
  | HttpParseError
  | HttpAuthError
  | HttpTimeoutError
  | SseConnectionError
  | WsConnectError
  | WsMessageError
  | NatsSubscribeError
  | FileWatchError
  | FileParseError
  | RssFetchError
  | RssParseError
  | SerialConnectError
  | SignalValidationError
  | SignalQueueFullError

/**
 * WebSocket Signal Schema
 *
 * Source: WebSocket client connecting to arbitrary servers
 * Covers: Real-time data feeds, chat streams, market data, etc.
 *
 * @module tsingou-flow/schemas/websocket-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// WebSocket Payload
// =============================================================================

export const WebSocketMessageType = Schema.Literal('text', 'binary')
export type WebSocketMessageType = typeof WebSocketMessageType.Type

export const WebSocketPayload = Schema.Struct({
  /** WebSocket server URL */
  url: Schema.String,

  /** Decoded message data */
  data: Schema.Unknown,

  /** Message type */
  type: WebSocketMessageType,

  /** Sub-protocol negotiated (if any) */
  protocol: Schema.optional(Schema.String),

  /** Raw byte length (for binary messages) */
  byteLength: Schema.optional(Schema.Number),

  /** Message sequence from this connection (auto-incremented) */
  connectionSeq: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  ),
})
export type WebSocketPayload = typeof WebSocketPayload.Type

// =============================================================================
// WebSocketSignal
// =============================================================================

export const WebSocketSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('websocket'),
    payload: WebSocketPayload,
  }),
)
export type WebSocketSignal = typeof WebSocketSignal.Type

/**
 * HTTP Signal Schema
 *
 * Source: HTTP poll (REST API) or Server-Sent Events (SSE) streams
 * Covers: API responses, webhook payloads, SSE events
 *
 * @module tsingou-flow/schemas/http-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// HTTP Payload
// =============================================================================

export const HttpMethod = Schema.Literal('GET', 'POST', 'PUT', 'DELETE', 'PATCH')
export type HttpMethod = typeof HttpMethod.Type

export const HttpPayload = Schema.Struct({
  /** Request URL */
  url: Schema.String,

  /** HTTP method */
  method: HttpMethod,

  /** Response status code (for poll responses) */
  statusCode: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(100, 599)),
  ),

  /** Decoded response/event body */
  body: Schema.Unknown,

  /** Response headers */
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),

  /** SSE event type (for Server-Sent Events) */
  sseEventType: Schema.optional(Schema.String),

  /** SSE event ID (for reconnection) */
  sseEventId: Schema.optional(Schema.String),

  /** Content-Type of the response */
  contentType: Schema.optional(Schema.String),

  /** Response time in milliseconds */
  responseTimeMs: Schema.optional(Schema.Number),
})
export type HttpPayload = typeof HttpPayload.Type

// =============================================================================
// HttpSignal
// =============================================================================

export const HttpSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('http'),
    payload: HttpPayload,
  }),
)
export type HttpSignal = typeof HttpSignal.Type

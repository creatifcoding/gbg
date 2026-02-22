/**
 * NATS Signal Schema
 *
 * Source: NATS JetStream consumer
 * The primary transport signal — NATS is the universal fabric.
 *
 * @module tsingou-flow/schemas/nats-signal
 */

import { Schema } from 'effect'
import { BaseSignal } from './base-signal'

// =============================================================================
// NATS Payload
// =============================================================================

export const NatsPayload = Schema.Struct({
  /** NATS subject the message was published to */
  subject: Schema.String,

  /** Decoded message data (schema lookup via registry by subject pattern) */
  data: Schema.Unknown,

  /** NATS message headers */
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),

  /** JetStream sequence number (present for JetStream messages) */
  sequence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  ),

  /** JetStream stream name */
  stream: Schema.optional(Schema.String),

  /** JetStream consumer name */
  consumer: Schema.optional(Schema.String),

  /** NATS reply subject (for request-reply patterns) */
  replyTo: Schema.optional(Schema.String),

  /** Message timestamp from NATS server */
  serverTimestamp: Schema.optional(Schema.DateFromSelf),
})
export type NatsPayload = typeof NatsPayload.Type

// =============================================================================
// NatsSignal
// =============================================================================

export const NatsSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('nats'),
    payload: NatsPayload,
  }),
)
export type NatsSignal = typeof NatsSignal.Type

/**
 * Message — a single logical message read from a Durable Stream.
 *
 * # Why a separate type
 *
 * The wire layer (`Wire`) speaks the HTTP protocol: it returns assembled
 * response bodies as `Stream<Uint8Array>`. For raw streams the body stream's
 * chunks ARE the per-message bytes; for JSON streams the body is a wrapped
 * `[a,b,c,...]` array.
 *
 * The `Lnk` handle layer (Phase 2) needs MESSAGE granularity: a `Stream<Message>`
 * with offsets, payloads, and ordering metadata. `Message` is that bridge.
 *
 * # Offset semantics
 *
 * `offset` is the offset of THIS message within its stream, as assigned by
 * the server. Subsequent reads can resume by passing this offset back as
 * `?offset=`. For a batch read returning N messages, only the LAST message's
 * offset is reported by the server (`Stream-Next-Offset`). The Lnk layer
 * synthesizes per-message offsets only for the LAST message in a batch;
 * intermediate messages carry `Option.none` until a future spec extension
 * surfaces per-message offsets.
 *
 * # Payload
 *
 * `payload` is always raw bytes. Higher-level decoding (string, JSON) happens
 * at the consumer's discretion via the stream's `Content-Type`.
 *
 * @module @tmnl/lnk/services/lnks/Message
 */

import * as Schema from "effect-v4/Schema"

import type { Offset } from "../../contracts/Offset.js"

// ─── Message ────────────────────────────────────────────────────────────────

/**
 * One message read from a stream.
 *
 * Offsets are present only when known (the server reports the LAST offset
 * per batch; intermediate offsets are not surfaced by the wire spec).
 */
export interface Message {
  /**
   * Offset of this message in the stream (server-assigned).
   *
   * Only present for the LAST message in a batch — that's the only offset
   * the wire spec exposes (`Stream-Next-Offset`). Intermediate messages
   * carry `undefined`.
   */
  readonly offset?: Offset
  /** Raw payload bytes. Decode per the stream's `Content-Type`. */
  readonly payload: Uint8Array
}

/**
 * Schema for `Message` — used at trust boundaries (e.g. when reading a
 * persisted message log) and for serialization within the EventLog
 * integration (Phase 6).
 */
export const Message = Schema.Struct({
  offset: Schema.optional(Schema.String),
  payload: Schema.Uint8Array,
}).annotate({
  identifier: "Message",
  description: "A single message read from a Durable Stream.",
})

// ─── Constructors ───────────────────────────────────────────────────────────

/**
 * Construct a `Message` from raw bytes (no offset known).
 *
 * Used for intermediate messages within a batch where the server only
 * exposes the trailing offset.
 */
export const fromBytes = (payload: Uint8Array): Message => ({ payload })

/**
 * Construct a `Message` with both bytes and offset.
 *
 * Used for the LAST message in a batch (or for synthesized single-message
 * batches where we know the assigned offset).
 */
export const fromBytesWithOffset = (
  payload: Uint8Array,
  offset: Offset,
): Message => ({ offset, payload })

/**
 * Error hierarchy — Durable Streams contracts.
 *
 * All errors are `Schema.TaggedErrorClass` instances:
 *   - schema-validated (encoded for transport via Effect.unstable.rpc, etc.)
 *   - yieldable (`yield* new InvalidOffsetError({...})` in `Effect.gen`)
 *   - tagged-union members (discriminate on `_tag` for `Effect.catchTag`)
 *
 * The base discriminated union `DurableStreamError` lives at the bottom.
 *
 * Identifier convention: `@tmnl/lnk/<ErrorName>`. This identifier
 * is used as the tag's namespace in serialized form and for tracing.
 *
 * @module @tmnl/lnk/contracts/errors
 */

import * as Schema from "effect-v4/Schema"

// ─── Validation errors (Phase 0 contracts) ──────────────────────────────────

/**
 * Reasons an offset string can fail validation when constructed via
 * `Offset.parse`. (`trust` skips validation entirely.)
 */
export const InvalidOffsetReason = Schema.Literals([
  "empty",
  "sentinel-not-offset",
  "forbidden-characters",
])
export type InvalidOffsetReason = typeof InvalidOffsetReason.Type

/**
 * Raised when a string fails `Offset.parse` validation.
 *
 * Most clients never see this — they `Offset.trust(serverString)` at the wire
 * boundary and pass typed `Offset` values around. This error fires when code
 * defensively re-validates an offset and discovers a sentinel or empty string.
 */
export class InvalidOffsetError extends Schema.TaggedErrorClass<InvalidOffsetError>(
  "@tmnl/lnk/InvalidOffsetError",
)("InvalidOffsetError", {
  value: Schema.String,
  reason: InvalidOffsetReason,
}) {}

/**
 * Raised when a string fails `StreamId.parse` validation
 * (empty, too long, or contains forbidden characters).
 */
export class InvalidStreamIdError extends Schema.TaggedErrorClass<InvalidStreamIdError>(
  "@tmnl/lnk/InvalidStreamIdError",
)("InvalidStreamIdError", {
  value: Schema.String,
  reason: Schema.String,
}) {}

/**
 * Raised when a `Content-Type` header value is malformed
 * (missing `/`, empty, etc.).
 */
export class InvalidContentTypeError extends Schema.TaggedErrorClass<InvalidContentTypeError>(
  "@tmnl/lnk/InvalidContentTypeError",
)("InvalidContentTypeError", {
  value: Schema.String,
  reason: Schema.String,
}) {}

/**
 * Raised when a wire header is missing or has an unparseable value.
 *
 * `name` carries the canonical header name (e.g. `"Stream-Next-Offset"`),
 * `value` is the raw value if present (omitted for missing-header cases).
 */
export class InvalidHeaderError extends Schema.TaggedErrorClass<InvalidHeaderError>(
  "@tmnl/lnk/InvalidHeaderError",
)("InvalidHeaderError", {
  name: Schema.String,
  value: Schema.optional(Schema.String),
  reason: Schema.String,
}) {}

// ─── Producer errors (Phase 0 contracts; raised by Phase 3 producer) ────────

/**
 * Producer fencing — server has accepted writes from a higher epoch for the
 * same `Producer-Id`, so this producer is now stale. Per spec, this is a 403
 * response. Producers configured with `autoClaim` may retry with `epoch + 1`.
 */
export class StaleEpochError extends Schema.TaggedErrorClass<StaleEpochError>(
  "@tmnl/lnk/StaleEpochError",
)("StaleEpochError", {
  streamId: Schema.String,
  producerId: Schema.String,
  ourEpoch: Schema.Number,
  serverEpoch: Schema.Number,
}) {}

/**
 * Producer sequence number gap — server expected `expectedSeq` next but
 * received `receivedSeq`. Should not happen with correct `IdempotentProducer`
 * usage; surfaces only if a client is hand-rolling the protocol.
 */
export class SequenceGapError extends Schema.TaggedErrorClass<SequenceGapError>(
  "@tmnl/lnk/SequenceGapError",
)("SequenceGapError", {
  streamId: Schema.String,
  producerId: Schema.String,
  expectedSeq: Schema.Number,
  receivedSeq: Schema.Number,
}) {}

/**
 * Stream is closed — no further appends will be accepted. Returned in
 * response to a POST after the stream has been closed (`Stream-Closed: true`).
 *
 * `lastOffset` is the final offset before close, when known.
 */
export class StreamClosedError extends Schema.TaggedErrorClass<StreamClosedError>(
  "@tmnl/lnk/StreamClosedError",
)("StreamClosedError", {
  streamId: Schema.String,
  lastOffset: Schema.optional(Schema.String),
}) {}

/**
 * Requested stream does not exist on the server. Maps to HTTP `404 Not Found`.
 *
 * Returned by POST/GET/HEAD/DELETE against a stream that was never created
 * or was previously deleted.
 */
export class StreamNotFoundError extends Schema.TaggedErrorClass<StreamNotFoundError>(
  "@tmnl/lnk/StreamNotFoundError",
)("StreamNotFoundError", {
  streamId: Schema.String,
}) {}

/**
 * PUT was issued against an existing stream whose configuration
 * (content-type, etc.) doesn't match the request. Maps to HTTP `409 Conflict`.
 *
 * Per spec: idempotent re-creation requires identical configuration.
 */
export class StreamConfigMismatchError extends Schema.TaggedErrorClass<StreamConfigMismatchError>(
  "@tmnl/lnk/StreamConfigMismatchError",
)("StreamConfigMismatchError", {
  streamId: Schema.String,
  expectedContentType: Schema.String,
  receivedContentType: Schema.String,
}) {}

/**
 * The POSTed payload is malformed for the stream's content-type.
 * Maps to HTTP `400 Bad Request`.
 *
 * Examples (per spec):
 *   - JSON stream + invalid JSON body
 *   - JSON stream + empty array `[]` (must contain at least one message)
 */
export class InvalidPayloadError extends Schema.TaggedErrorClass<InvalidPayloadError>(
  "@tmnl/lnk/InvalidPayloadError",
)("InvalidPayloadError", {
  streamId: Schema.String,
  contentType: Schema.String,
  reason: Schema.String,
}) {}

/**
 * Requested offset has been dropped by retention. Maps to HTTP `410 Gone`.
 *
 * Clients should typically treat this as a fatal condition for the affected
 * read session and either restart from `"-1"` (if catch-up is acceptable) or
 * surface to the user.
 */
export class RetentionDroppedError extends Schema.TaggedErrorClass<RetentionDroppedError>(
  "@tmnl/lnk/RetentionDroppedError",
)("RetentionDroppedError", {
  streamId: Schema.String,
  requestedOffset: Schema.String,
  oldestAvailableOffset: Schema.optional(Schema.String),
}) {}

// ─── Wire / network errors (Phase 0 placeholder; Phase 1 fleshes out) ───────

/**
 * Wire-level failure — non-2xx HTTP response not otherwise classified, or
 * transport-level error (network down, DNS, TLS, etc.).
 *
 * Phase 1 will refine this with a richer hierarchy (e.g. `NetworkError`,
 * `ServerError`, `ClientError`). For now, a single bucket suffices for the
 * Phase 0 contract surface.
 */
export class FetchError extends Schema.TaggedErrorClass<FetchError>(
  "@tmnl/lnk/FetchError",
)("FetchError", {
  status: Schema.optional(Schema.Number),
  message: Schema.String,
  // Untyped cause is allowed via Schema.Defect (matches the pattern in
  // effect-v4 unstable/sql/SqlError).
  cause: Schema.optional(Schema.Defect),
}) {}

// ─── Discriminated union ────────────────────────────────────────────────────

/**
 * The base error type for the contracts surface.
 *
 * Phase 1 will widen this to include wire-layer errors. Phase 2/3 will add
 * stream-handle and producer errors. This union is the type a caller catches
 * when they're done with `Effect.catchTag` discrimination and just want to
 * surface an opaque "something Durable-Streams-related broke."
 */
export type DurableStreamError =
  | InvalidOffsetError
  | InvalidStreamIdError
  | InvalidContentTypeError
  | InvalidHeaderError
  | InvalidPayloadError
  | StaleEpochError
  | SequenceGapError
  | StreamClosedError
  | StreamNotFoundError
  | StreamConfigMismatchError
  | RetentionDroppedError
  | FetchError

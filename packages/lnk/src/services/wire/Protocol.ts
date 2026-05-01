/**
 * Protocol — the Durable Streams wire-protocol spec, expressed as an `RpcGroup`.
 *
 * This module is the **single source of truth** for:
 *   - Operation tags (`put`, `post`, `get`, `head`, `delete`)
 *   - Payload schemas per operation
 *   - Success schemas per operation
 *   - Error schemas per operation
 *
 * The `Wire` Context.Service shape (in `./Wire.ts`) is hand-curated to match
 * the operations defined here; a compile-time drift guard ensures the two
 * stay in sync.
 *
 * # Why RpcGroup, but not RpcClient?
 *
 * We use `RpcGroup` and `Rpc.make(...)` for type-level rigor: schemas drive
 * payload/success/error types, tags are discriminators, and the group is
 * a stable spec artifact that future transports (NATS-RPC bridge, Phase 5+)
 * can serve without re-encoding the protocol.
 *
 * We do **not** use `RpcClient.make()` at runtime, because:
 *   1. The Durable Streams wire format is HTTP-spec-mandated (specific verbs,
 *      headers, paths), not RpcMessage-shaped.
 *   2. `RpcClient.From<typeof Protocol>` produces a leaky type with `AsQueue` /
 *      `Discard` generic flags that hand-rolled implementations cannot satisfy
 *      without being `RpcClient.make()`'s actual output (see `spike/`).
 *
 * Implementations satisfy `WireShape` directly, using `typeof <Schema>.Type`
 * extractors over the schemas defined here for their input/output types.
 *
 * @module @tmnl/lnk/services/wire/Protocol
 */

import * as Schema from "effect-v4/Schema"
import * as Rpc from "effect-v4/unstable/rpc/Rpc"
import * as RpcGroup from "effect-v4/unstable/rpc/RpcGroup"

import { Offset, ReadPosition } from "../../contracts/Offset.js"
import { StreamId } from "../../contracts/StreamId.js"
import { ContentType } from "../../contracts/ContentType.js"
import { ProducerId, Epoch, Seq } from "../../contracts/Producer.js"
import {
  FetchError,
  InvalidOffsetError,
  RetentionDroppedError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamNotFoundError,
} from "../../contracts/errors.js"

// ─── PUT — create stream ────────────────────────────────────────────────────

/**
 * Input: create a new stream with content-type. Idempotent on identical config.
 *
 * Per spec, PUT may include an optional body which is atomically appended
 * after stream creation (`PUT` with body = create-and-append in one round
 * trip). The body is conveyed via the runtime-only `PutInput_PutBody` shape
 * (see `DurableStreamWire.ts`), since `Schema` doesn't model raw bytes inside
 * struct schemas.
 */
export const PutInput = Schema.Struct({
  streamId: StreamId,
  contentType: ContentType,
  /** Optional Stream-TTL header (seconds). */
  streamTtl: Schema.optional(Schema.Number),
  /** Optional Stream-Expires-At header. */
  streamExpiresAt: Schema.optional(Schema.String),
  /**
   * Optional `Stream-Closed: true` header on PUT.
   *
   * When `true` AND no body is supplied: creates an already-closed empty
   * stream. When `true` AND a body is supplied: creates the stream, appends
   * the body atomically, and closes — "create-final" in one round trip.
   */
  streamClosed: Schema.optional(Schema.Boolean),
})

/** Result: did this PUT actually create the stream, or did it already exist? */
export const PutResult = Schema.Struct({
  streamId: StreamId,
  contentType: ContentType,
  /** True if the PUT created a new stream; false if it was already present. */
  created: Schema.Boolean,
  /**
   * Offset of the last appended message if the PUT included a body; `None`
   * otherwise. Servers SHOULD include `Stream-Next-Offset` on PUT responses
   * even if the body was empty (so clients can use it as a starting point).
   */
  nextOffset: Schema.optional(Offset),
  /** Whether the stream is closed after this PUT. */
  closed: Schema.Boolean,
})

// ─── POST — append to stream ────────────────────────────────────────────────

/** Producer-idempotency triple, sent as `Producer-{Id,Epoch,Seq}` headers. */
export const ProducerHeaders = Schema.Struct({
  producerId: ProducerId,
  epoch: Epoch,
  seq: Seq,
})

/** Input: append payload bytes to a stream, optionally with producer fencing. */
export const PostInput = Schema.Struct({
  streamId: StreamId,
  /** Override the stream's content-type for this append (rare). */
  contentType: Schema.optional(ContentType),
  /** Producer idempotency fields. Optional — without them, no fencing/dedup. */
  producer: Schema.optional(ProducerHeaders),
  /** Set `Stream-Closed: true` on this POST to close the stream after append. */
  streamClosed: Schema.optional(Schema.Boolean),
})

/** Result: the offset assigned to this append, plus duplicate-detection flag. */
export const PostResult = Schema.Struct({
  /** Offset assigned to this append. For duplicates, this is the existing offset. */
  nextOffset: Offset,
  /** True if the server detected this seq as a duplicate (idempotent return). */
  duplicate: Schema.Boolean,
  /** Whether the stream is closed after this POST. */
  closed: Schema.Boolean,
})

// ─── GET — read from stream ─────────────────────────────────────────────────

/** Live mode flag — long-poll waits for data; SSE streams continuously. */
export const LiveMode = Schema.Literals(["long-poll", "sse"])

/**
 * Input: read messages starting at a position.
 *
 *   - `position`: where to start (an `Offset` or sentinel `"-1"` / `"now"`)
 *   - `limit`:    max bytes/messages (server-defined cap)
 *   - `live`:     optional live mode (long-poll or sse)
 *   - `timeout`:  long-poll timeout in ms (default per server)
 *   - `cursor`:   echoed `Stream-Cursor` for CDN request-collapsing in live mode
 */
export const GetInput = Schema.Struct({
  streamId: StreamId,
  position: ReadPosition,
  limit: Schema.optional(Schema.Number),
  live: Schema.optional(LiveMode),
  timeout: Schema.optional(Schema.Number),
  cursor: Schema.optional(Schema.String),
})

/**
 * Headers parsed from a GET response.
 *
 * The actual response body (`Stream<Uint8Array>`) is NOT part of this schema
 * because Streams aren't schema-able. The full `GetResult` (in
 * `./Wire.ts`) extends this struct with a `body` field carrying
 * the raw byte stream.
 */
export const GetHeaders = Schema.Struct({
  /** Next offset to read from (None on 204 long-poll timeout if no progress). */
  nextOffset: Schema.optional(Offset),
  /** True when response includes all data available at request time. */
  upToDate: Schema.Boolean,
  /** True when the server has signaled end-of-stream. */
  closed: Schema.Boolean,
  /** Opaque cursor for CDN collapsing in live mode. */
  cursor: Schema.optional(Schema.String),
})

// ─── HEAD — stream metadata ─────────────────────────────────────────────────

/** Input: query stream metadata without transferring body. */
export const HeadInput = Schema.Struct({
  streamId: StreamId,
})

/** Result: stream's content-type, current tail offset, closure state. */
export const HeadResult = Schema.Struct({
  contentType: Schema.optional(ContentType),
  /** Tail position — the offset at which the next append will land. */
  nextOffset: Schema.optional(Offset),
  closed: Schema.Boolean,
})

// ─── DELETE — remove stream ─────────────────────────────────────────────────

export const DeleteInput = Schema.Struct({
  streamId: StreamId,
})

export const DeleteResult = Schema.Struct({
  /** True if a stream was actually deleted; false if it didn't exist. */
  deleted: Schema.Boolean,
})

// ─── Error unions per operation ─────────────────────────────────────────────

/**
 * Errors visible from `put`. Idempotent re-creation with matching content-type
 * is NOT an error (returns `{ created: false }`). Conflicting content-type
 * surfaces as a server-side conflict; we route it through `FetchError` for
 * Phase 1 simplicity. (Phase 1.1 may introduce `StreamConfigConflictError`.)
 */
export const PutError = FetchError

export const PostError = Schema.Union([
  FetchError,
  StaleEpochError,
  SequenceGapError,
  StreamClosedError,
  StreamNotFoundError,
])

export const GetError = Schema.Union([
  FetchError,
  StreamNotFoundError,
  RetentionDroppedError,
  InvalidOffsetError,
])

export const HeadError = Schema.Union([FetchError, StreamNotFoundError])

export const DeleteError = FetchError

// ─── Rpc definitions ────────────────────────────────────────────────────────

/** PUT /streams/:id — create stream. Idempotent on matching config. */
export const PutRpc = Rpc.make("put", {
  payload: PutInput,
  success: PutResult,
  error: PutError,
})

/** POST /streams/:id — append payload bytes. Producer-headers optional. */
export const PostRpc = Rpc.make("post", {
  payload: PostInput,
  success: PostResult,
  error: PostError,
})

/**
 * GET /streams/:id?offset=…&live=… — read from a position.
 *
 * The Rpc spec carries only the headers (`GetHeaders`); the byte-stream body
 * is conveyed via `Wire`'s hand-curated shape, which extends
 * `GetHeaders` with a `body: Stream<Uint8Array>` field. Streams aren't
 * Schema-able, so the byte transport sits outside the Rpc spec by design.
 */
export const GetRpc = Rpc.make("get", {
  payload: GetInput,
  success: GetHeaders,
  error: GetError,
})

/** HEAD /streams/:id — metadata-only. */
export const HeadRpc = Rpc.make("head", {
  payload: HeadInput,
  success: HeadResult,
  error: HeadError,
})

/** DELETE /streams/:id — remove stream and all data. */
export const DeleteRpc = Rpc.make("delete", {
  payload: DeleteInput,
  success: DeleteResult,
  error: DeleteError,
})

// ─── The RpcGroup — one stable spec artifact ────────────────────────────────

/**
 * The Durable Streams wire spec.
 *
 * ```ts
 * import { Protocol } from "@tmnl/lnk/services/wire"
 *
 * // Used as a type-level spec by Wire's hand-curated shape
 * type Tags = RpcGroup.Rpcs<typeof Protocol>["_tag"]
 * //          ^? "put" | "post" | "get" | "head" | "delete"
 * ```
 *
 * Future-proofing: when an internal RPC transport (e.g. NATS-RPC for inter-
 * service comms) is desired, `RpcServer.layer(Protocol)` and
 * `RpcClient.make(Protocol)` are available. For the public HTTP wire,
 * implementations satisfy `Wire` directly; the wire format is the
 * spec-mandated HTTP, not RpcMessage.
 */
export class Protocol extends RpcGroup.make(PutRpc, PostRpc, GetRpc, HeadRpc, DeleteRpc) {}

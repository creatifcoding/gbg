/**
 * Lnk — yieldable handle to a single Durable Stream.
 *
 * # Why this layer exists
 *
 * The `Wire` service speaks the HTTP protocol: PUT/POST/GET/HEAD/DELETE
 * with raw `Stream<Uint8Array>` bodies. That's correct for transport, but
 * it's a bad user surface:
 *
 *   - Each `Wire.get` is a one-shot read. To follow a stream live, you'd
 *     hand-roll a polling loop, retry, fan-out, and offset bookkeeping.
 *   - Body chunks are HTTP-shaped (per-message for raw, JSON-wrapped for
 *     JSON streams), not per-message. Consumers want `Stream<Message>`.
 *   - You can't `yield*` a Wire to "get the latest message" inside an
 *     `Effect.gen` block.
 *
 * `Lnk` solves these:
 *
 *   - It's a yieldable handle (`Effect.YieldableClass`) — `yield* lnk` in
 *     an `Effect.gen` block returns the latest message (or `None`).
 *   - It owns a driver fiber that continuously polls the wire (long-poll
 *     mode) and pushes messages into a `PubSub`.
 *   - It exposes `subscribe()` for live `Stream<Message>` access (PubSub-
 *     backed; multiple consumers see the same stream).
 *   - `append`, `close`, `head` delegate to the wire with content-type
 *     framing already handled.
 *
 * # Lifecycle
 *
 * `Lnk.make(...)` is a `Scope`-bounded constructor. The driver fiber lives
 * for the duration of that scope; closing the scope interrupts the driver,
 * shuts down the PubSub, and releases all resources.
 *
 * For ref-counted multi-consumer use, see `Lnks` (Phase 2.1) which wraps
 * `RcMap<StreamId, Lnk>` for handle reuse.
 *
 * # Yieldable semantics
 *
 *   `yield* lnk` ≡ `Ref.get(latestRef)` → `Effect<Option<Message>>`
 *
 * The first yield always returns `Option.none()` (no message has been
 * received yet). Subsequent yields return `Option.some(latestMessage)` once
 * the driver has received its first batch.
 *
 * @module @tmnl/lnk/services/lnks/Lnk
 */

import * as Effect from "effect-v4/Effect"
import * as Option from "effect-v4/Option"
import * as PubSub from "effect-v4/PubSub"
import * as Ref from "effect-v4/Ref"
import * as Scope from "effect-v4/Scope"
import * as Stream from "effect-v4/Stream"

import { framingMode } from "../../contracts/ContentType.js"
import type { ContentType } from "../../contracts/ContentType.js"
import type {
  FetchError,
  InvalidPayloadError,
  RetentionDroppedError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../contracts/errors.js"
import type { Offset } from "../../contracts/Offset.js"
import type { Epoch, ProducerId, Seq } from "../../contracts/Producer.js"
import type { StreamId } from "../../contracts/StreamId.js"
import { Wire } from "../wire/Wire.js"
import { fromBytes, fromBytesWithOffset, type Message } from "./Message.js"

// ─── Options ────────────────────────────────────────────────────────────────

export interface LnkMakeOptions {
  /**
   * Where the driver should start reading from. Default: `"now"` (only new
   * messages from this point onwards). Pass `"-1"` to replay the whole
   * stream from the beginning, or a specific `Offset` to resume.
   */
  readonly fromOffset?: Offset | "-1" | "now"
  /**
   * Long-poll timeout per driver iteration (ms). Default: `5_000`. After
   * timeout the driver loops with the same offset.
   */
  readonly pollTimeoutMs?: number
  /**
   * Maximum messages buffered in the PubSub before backpressure. Default:
   * `unbounded` (memory-only bound).
   */
  readonly bufferSize?: number
  /**
   * If `true`, the driver auto-stops after observing `Stream-Closed: true`.
   * Default: `true`. Set to `false` for streams that may be reopened (rare).
   */
  readonly stopOnClosed?: boolean
}

export interface LnkAppendOptions {
  /** Optional producer-idempotency triple (Producer-Id/-Epoch/-Seq). */
  readonly producer?: {
    readonly producerId: ProducerId
    readonly epoch: Epoch
    readonly seq: Seq
  }
  /** Optional Stream-Seq lex-monotonic header value. */
  readonly streamSeq?: string
  /**
   * If `true`, this append also closes the stream (`Stream-Closed: true`).
   * For close-only with no body, use `Lnk#close()` instead.
   */
  readonly streamClosed?: boolean
}

// ─── Lnk class ──────────────────────────────────────────────────────────────

/**
 * Yieldable handle to a single Durable Stream.
 *
 * Use `Lnk.make(streamId, contentType)` (in a `Scope` context) to construct.
 * `yield* lnk` in an `Effect.gen` block returns the latest received message
 * as `Option<Message>` (None until the driver receives its first batch).
 */
export class Lnk extends Effect.YieldableClass<
  Option.Option<Message>,
  never,
  never
> {
  /** Stream identifier (immutable). */
  readonly streamId: StreamId

  /** Content-Type registered for this stream (immutable). */
  readonly contentType: ContentType

  // Internal-only refs and IO surfaces.
  /** @internal */
  readonly _wire: Wire["Service"]
  /** @internal */
  readonly _latestRef: Ref.Ref<Option.Option<Message>>
  /** @internal */
  readonly _pubsub: PubSub.PubSub<Message>

  private constructor(
    streamId: StreamId,
    contentType: ContentType,
    wire: Wire["Service"],
    latestRef: Ref.Ref<Option.Option<Message>>,
    pubsub: PubSub.PubSub<Message>,
  ) {
    super()
    this.streamId = streamId
    this.contentType = contentType
    this._wire = wire
    this._latestRef = latestRef
    this._pubsub = pubsub
  }

  /**
   * Yieldable: returns the latest received message (`None` until the driver
   * has observed its first batch).
   */
  asEffect(): Effect.Effect<Option.Option<Message>, never, never> {
    return Ref.get(this._latestRef)
  }

  /**
   * Live subscription to messages as they arrive. Returns a `Stream<Message>`
   * scoped to the caller's lifetime — unsubscribing happens on stream finish
   * or scope close.
   *
   * Multiple subscribers share the underlying `PubSub`; each subscriber sees
   * messages from the moment they subscribe forward (no historical replay).
   * For catch-up reads, use `Lnk#read(opts)` which performs a one-shot wire
   * `get` against the requested offset.
   */
  subscribe(): Stream.Stream<Message, never, Scope.Scope> {
    return Stream.fromPubSub(this._pubsub)
  }

  /**
   * One-shot read from a specific offset (catch-up semantics, no live mode).
   * Returns a `Stream<Message>` containing all messages from `fromOffset`
   * up to the current tail. Caller is responsible for `Effect.scoped`-bounding
   * the read so the underlying transport closes cleanly.
   */
  read(options?: {
    readonly fromOffset?: Offset | "-1" | "now"
    readonly limit?: number
  }): Effect.Effect<
    Stream.Stream<Message, never, never>,
    | FetchError
    | StreamNotFoundError
    | RetentionDroppedError,
    Scope.Scope
  > {
    const fromOffset = options?.fromOffset ?? "-1"
    return Effect.gen({ self: this }, function* () {
      const out = yield* this._wire.get({
        streamId: this.streamId,
        position: fromOffset,
        ...(options?.limit !== undefined ? { limit: options.limit } : {}),
      })
      // Wire body is per-message stream for raw mode; JSON-wrapped for JSON.
      // For Phase 2.0 we support raw mode directly (one chunk = one message).
      // JSON-mode is handled by buffering and parsing the array.
      const stream = decodeMessageStream(
        out.body,
        this.contentType as string,
        out.nextOffset,
      )
      return stream
    }).pipe(
      // InvalidOffsetError isn't surfaced to read users — translate to
      // FetchError for consistency. (This path shouldn't hit invalid offset
      // since we accept Offset | sentinel inputs and validate upstream.)
      Effect.catchTag("InvalidOffsetError", (e) => Effect.die(e)),
    )
  }

  /**
   * Append bytes to the stream. Returns the assigned next-offset and
   * duplicate flag (true if a producer-tracked retry hit dedup).
   */
  append(
    body: Uint8Array,
    options?: LnkAppendOptions,
  ): Effect.Effect<
    {
      readonly nextOffset: Offset
      readonly duplicate: boolean
      readonly closed: boolean
    },
    | FetchError
    | InvalidPayloadError
    | StaleEpochError
    | SequenceGapError
    | StreamClosedError
    | StreamNotFoundError
    | StreamConfigMismatchError,
    never
  > {
    return this._wire.post({
      streamId: this.streamId,
      contentType: this.contentType,
      body,
      ...(options?.producer !== undefined ? { producer: options.producer } : {}),
      ...(options?.streamSeq !== undefined ? { streamSeq: options.streamSeq } : {}),
      ...(options?.streamClosed === true ? { streamClosed: true } : {}),
    })
  }

  /**
   * Close the stream — emits a close-only POST (empty body, Stream-Closed:
   * true). Subsequent appends fail with `StreamClosedError` (HTTP 409).
   *
   * Idempotent: closing an already-closed stream succeeds with
   * `duplicate: true`. Producer-tracked closes use the same dedup as
   * regular appends.
   */
  close(
    options?: Pick<LnkAppendOptions, "producer">,
  ): Effect.Effect<
    {
      readonly nextOffset: Offset
      readonly duplicate: boolean
      readonly closed: boolean
    },
    | FetchError
    | InvalidPayloadError
    | StaleEpochError
    | SequenceGapError
    | StreamClosedError
    | StreamNotFoundError
    | StreamConfigMismatchError,
    never
  > {
    return this._wire.post({
      streamId: this.streamId,
      body: new Uint8Array(0),
      streamClosed: true,
      ...(options?.producer !== undefined ? { producer: options.producer } : {}),
    })
  }

  /** Metadata-only query — current tail offset, content-type, closed flag. */
  head(): Effect.Effect<
    {
      readonly contentType?: ContentType | undefined
      readonly nextOffset?: Offset | undefined
      readonly closed: boolean
      readonly ttl?: number | undefined
      readonly expiresAt?: string | undefined
    },
    FetchError | StreamNotFoundError,
    never
  > {
    return this._wire.head({ streamId: this.streamId })
  }

  // ── Static factory ────────────────────────────────────────────────────────

  /**
   * Build a `Lnk` handle, spawning a driver fiber that continuously polls
   * the wire for new messages. The fiber runs for the duration of the
   * caller's `Scope`; closing the scope stops it and shuts down the PubSub.
   *
   * The handle assumes the stream ALREADY EXISTS — call `Wire.put(...)`
   * (via the underlying `Wire` service) before `make` to ensure registration.
   */
  static readonly make = (
    streamId: StreamId,
    contentType: ContentType,
    options?: LnkMakeOptions,
  ): Effect.Effect<Lnk, FetchError, Wire | Scope.Scope> =>
    Effect.gen(function* () {
      const wire = yield* Wire
      const latestRef = yield* Ref.make<Option.Option<Message>>(Option.none())
      const pubsub =
        options?.bufferSize !== undefined
          ? yield* PubSub.bounded<Message>(options.bufferSize)
          : yield* PubSub.unbounded<Message>()

      const startFromOffset = options?.fromOffset ?? "now"
      const pollTimeoutMs = options?.pollTimeoutMs ?? 5_000
      const stopOnClosed = options?.stopOnClosed ?? true

      // Driver fiber: continuously polls wire.get with long-poll, splits
      // body into per-message chunks, publishes to pubsub + updates latestRef.
      const driver = driverLoop({
        wire,
        streamId,
        contentType,
        startFromOffset,
        pollTimeoutMs,
        stopOnClosed,
        pubsub,
        latestRef,
      })

      // Spawn driver into the scope. When scope closes, driver is interrupted
      // (and pubsub is shut down by the scope finalizer below).
      yield* Effect.forkScoped(driver)
      yield* Scope.addFinalizer(yield* Scope.Scope, PubSub.shutdown(pubsub))

      return new Lnk(streamId, contentType, wire, latestRef, pubsub)
    })
}

// ─── Driver-loop helpers (internal) ─────────────────────────────────────────

interface DriverConfig {
  readonly wire: Wire["Service"]
  readonly streamId: StreamId
  readonly contentType: ContentType
  readonly startFromOffset: Offset | "-1" | "now"
  readonly pollTimeoutMs: number
  readonly stopOnClosed: boolean
  readonly pubsub: PubSub.PubSub<Message>
  readonly latestRef: Ref.Ref<Option.Option<Message>>
}

/**
 * Per-batch polling loop that drives the PubSub + latestRef from wire.get
 * responses. Updates the cursor as offsets advance; auto-exits on
 * Stream-Closed when `stopOnClosed`.
 */
const driverLoop = (cfg: DriverConfig): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    let cursor: Offset | "-1" | "now" = cfg.startFromOffset
    while (true) {
      const result = yield* Effect.scoped(
        cfg.wire.get({
          streamId: cfg.streamId,
          position: cursor,
          live: "long-poll",
          timeout: cfg.pollTimeoutMs,
        }),
      ).pipe(
        // Driver MUST NOT crash on transport hiccups. Short-circuit the
        // typed errors into a sentinel; we'll loop and retry.
        Effect.catchCause(() => Effect.succeed(undefined)),
      )
      if (result === undefined) {
        // Transport error or interrupt — sleep briefly and retry.
        yield* Effect.sleep(`100 millis`)
        continue
      }
      // Decode the response body into messages and publish.
      const messageStream = decodeMessageStream(
        result.body,
        cfg.contentType as string,
        result.nextOffset,
      )
      yield* Stream.runForEach(messageStream, (msg) =>
        Effect.andThen(
          PubSub.publish(cfg.pubsub, msg),
          Ref.set(cfg.latestRef, Option.some(msg)),
        ),
      )
      // Advance cursor.
      if (result.nextOffset !== undefined) {
        cursor = result.nextOffset
      }
      // Exit on closed if configured.
      if (cfg.stopOnClosed && result.closed === true) return
    }
  })

// ─── Body decoding (per-message stream from wire body) ──────────────────────

const TEXT_DECODER_DECODER = new TextDecoder()
const TEXT_ENCODER_ENCODER = new TextEncoder()

/**
 * Decode a wire `body: Stream<Uint8Array>` into per-message `Stream<Message>`.
 *
 * The wire's body shape depends on the stream's content-type:
 *   - RAW mode: each chunk IS one message's bytes (preserved by Wire's
 *     `Stream.fromIterable(slice.map(m => m.bytes))` emission). We map each
 *     chunk → `Message`. The LAST message gets the offset; others carry
 *     `undefined`.
 *   - JSON mode: the body is a JSON array `[a,b,c,...]`. We buffer the
 *     entire body, parse, and emit each element as a separate `Message`
 *     (with `undefined` offsets except the last).
 */
const decodeMessageStream = (
  body: Stream.Stream<Uint8Array, unknown, never>,
  contentType: string,
  lastOffset: Offset | undefined,
): Stream.Stream<Message, never, never> => {
  const mode = framingMode(contentType)
  if (mode === "raw") {
    // Each chunk IS one message's bytes. Tag the last with the known offset.
    return Stream.suspend(() => {
      // We don't know which chunk is "last" without buffering. Buffer to
      // an array, then emit with offset on the last entry.
      return Stream.unwrap(
        // Buffer the body to know which chunk is last. On transport error
        // we emit an empty stream — callers monitor higher-level errors
        // (e.g. via Wire.get's typed error channel BEFORE entering the
        // body Stream).
        Stream.runCollect(body).pipe(
          Effect.map((iter) => {
            const arr = Array.from(iter)
            return Stream.fromIterable(
              arr.map((bytes, i) =>
                i === arr.length - 1 && lastOffset !== undefined
                  ? fromBytesWithOffset(bytes, lastOffset)
                  : fromBytes(bytes),
              ),
            )
          }),
          Effect.catchCause(() => Effect.succeed(Stream.empty)),
        ),
      ) as Stream.Stream<Message, never, never>
    })
  }
  // JSON mode: buffer + parse the whole array.
  return Stream.unwrap(
    Stream.runCollect(body).pipe(
      Effect.catchCause(() => Effect.succeed([] as Iterable<Uint8Array>)),
      Effect.map((iter) => {
        const total = Array.from(iter).reduce((n, c) => n + c.length, 0)
        if (total === 0) return Stream.empty as Stream.Stream<Message>
        const combined = new Uint8Array(total)
        let off = 0
        for (const c of iter) {
          combined.set(c, off)
          off += c.length
        }
        const text = TEXT_DECODER_DECODER.decode(combined)
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          // Malformed body — emit nothing. Driver-level decisions about
          // surfacing this failure live in the caller.
          return Stream.empty as Stream.Stream<Message>
        }
        if (!Array.isArray(parsed)) return Stream.empty as Stream.Stream<Message>
        return Stream.fromIterable(
          parsed.map((el, i) => {
            const bytes = TEXT_ENCODER_ENCODER.encode(JSON.stringify(el))
            return i === parsed.length - 1 && lastOffset !== undefined
              ? fromBytesWithOffset(bytes, lastOffset)
              : fromBytes(bytes)
          }),
        )
      }),
    ),
  ) as Stream.Stream<Message, never, never>
}

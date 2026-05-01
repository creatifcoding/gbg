/**
 * InMemoryInner — internal state store for `InMemoryWire`.
 *
 * Pattern: same as v1 holonet's `NatsInnerService` — wraps the raw state
 * primitives so that the *Wire impl above can focus on the wire-level
 * mapping (between Rpc op shapes and inner ops).
 *
 * # Responsibilities
 *
 *   - Per-message storage with lex-sortable opaque offsets (`<seq>_<bytes>`)
 *   - Producer-epoch fencing
 *   - Producer-seq dedup with **correct duplicate-offset return** (we track
 *     the last batch-end-offset per `(producerId, epoch)` so re-POSTing the
 *     same `(epoch, seq)` returns the offset originally produced)
 *   - Long-poll wait via polling (timeout returns empty body, NOT a leaky
 *     replay — see CONFORMANCE.md §5)
 *   - Idempotent PUT with content-type-mismatch detection
 *
 * # Content-type framing
 *
 * `InMemoryInner` is **content-type-agnostic at the storage layer**. It stores
 * each logical message as opaque bytes. The wire above (`InMemoryWire`)
 * handles content-type framing:
 *   - For `application/json` POSTs: parse, flatten one level if array, call
 *     `append({ messages })` with one Uint8Array per element.
 *   - For raw POSTs: call `append({ messages: [bytes] })` — single message.
 *   - For `application/json` GETs: read per-message bytes, wrap as JSON array.
 *   - For raw GETs: read per-message bytes, concatenate.
 *
 * Not exported from the package barrel: this is internal to the in-memory
 * wire and only consumed by `InMemoryWire`.
 *
 * @module @tmnl/lnk/services/wire/in-memory/InMemoryInner
 */

import * as Clock from "effect-v4/Clock"
import * as Context from "effect-v4/Context"
import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Ref from "effect-v4/Ref"
import * as Stream from "effect-v4/Stream"

import { trust as trustOffset, type Offset } from "../../../contracts/Offset.js"
import type { ContentType } from "../../../contracts/ContentType.js"
import type { Epoch, ProducerId, Seq } from "../../../contracts/Producer.js"
import type { StreamId } from "../../../contracts/StreamId.js"
import {
  InvalidPayloadError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"

// ─── Internal state types ───────────────────────────────────────────────────

interface ProducerHigh {
  readonly epoch: Epoch
  readonly lastSeq: Seq
  /** Offset of the LAST message in the most-recent accepted batch for (epoch, lastSeq). */
  readonly lastBatchEndOffset: Offset
}

interface InternalMessage {
  readonly offset: Offset
  /** Raw bytes of one logical message. For JSON, this is the JSON-encoded value. */
  readonly bytes: Uint8Array
}

interface InternalStream {
  readonly contentType: ContentType
  readonly createdAt: number
  readonly messages: ReadonlyArray<InternalMessage>
  readonly closed: boolean
  /**
   * Last accepted Stream-Seq value (lex-ordered string). Subsequent POSTs
   * carrying `Stream-Seq` must be lexicographically greater. `null` means
   * none accepted yet (any value is allowed).
   */
  readonly lastStreamSeq: string | null
  /** Cumulative byte offset of the next append. */
  readonly nextByteOffset: number
  /** Seq of the next message. */
  readonly nextSeq: number
  /** Highest-seen `(epoch, lastSeq, lastBatchEndOffset)` per producerId. */
  readonly producers: ReadonlyMap<string, ProducerHigh>
}

const emptyStream = (contentType: ContentType, now: number): InternalStream => ({
  contentType,
  createdAt: now,
  messages: [],
  closed: false,
  nextByteOffset: 0,
  nextSeq: 0,
  producers: new Map(),
  lastStreamSeq: null,
})

// ─── Offset generation — zero-padded lex-sortable ───────────────────────────

const PAD = 20
const padNum = (n: number): string => String(n).padStart(PAD, "0")

/** `<seq>_<byteOffset>` zero-padded to 20 digits each. Lex sort = chrono sort. */
const makeOffset = (seq: number, byteOffset: number): Offset =>
  trustOffset(`${padNum(seq)}_${padNum(byteOffset)}`)

// ─── Long-poll polling tick ─────────────────────────────────────────────────

const POLL_INTERVAL_MS = 25

// ─── Stream-Cursor generation ─────────────────────────────────────────────
//
// Per spec: cursor encodes an interval number (time / window). MUST never
// go backwards. If the client provides a cursor >= current interval, the
// server returns a strictly-greater cursor with random jitter (avoids CDN
// cache loops where every replica returns the same cursor on a tick boundary).
//
// Cursor format: zero-padded interval number as a string, lex-sortable.

const CURSOR_INTERVAL_MS = 1000
const CURSOR_PAD = 12

/** Compute the current cursor from a wall-clock ms timestamp. */
const currentCursor = (nowMs: number): string =>
  String(Math.floor(nowMs / CURSOR_INTERVAL_MS)).padStart(CURSOR_PAD, "0")

/**
 * Resolve the cursor to emit in a live-mode response, given the client's
 * echoed cursor (if any). Guarantees:
 *   - Never returns a value < `clientCursor` (monotonicity).
 *   - When `clientCursor >= current` interval, jitters by 1..5 to break loops.
 */
const resolveCursor = (
  nowMs: number,
  clientCursor: string | undefined,
): string => {
  const current = currentCursor(nowMs)
  if (clientCursor === undefined) return current
  if (clientCursor < current) return current
  const clientNum = Number(clientCursor)
  const jitter = 1 + Math.floor(Math.random() * 5)
  const bumped = Number.isFinite(clientNum)
    ? clientNum + jitter
    : Number(current) + jitter
  return String(bumped).padStart(CURSOR_PAD, "0")
}

// ─── Inputs/outputs ─────────────────────────────────────────────────────────

export interface CreateInput {
  readonly streamId: StreamId
  readonly contentType: ContentType
  /**
   * Optional `Stream-Closed: true`. When set on a NEW PUT, the stream is
   * created already-closed. When set on an idempotent re-PUT of an open
   * stream, the stream is closed transitionally (no error).
   */
  readonly streamClosed?: boolean
}

export interface CreateOutput {
  /** True if a new stream was created; false if it already existed (with matching config). */
  readonly created: boolean
  readonly contentType: ContentType
  /** Whether the stream is closed after this create call. */
  readonly closed: boolean
}

export interface AppendInput {
  readonly streamId: StreamId
  /**
   * One `Uint8Array` per logical message. The Wire layer is responsible for
   * having already split a JSON array (one element per message) or wrapped
   * raw bytes in a single-element array.
   *
   * MUST be non-empty (caller must reject empty-batch upstream).
   */
  readonly messages: ReadonlyArray<Uint8Array>
  readonly producer?: {
    readonly producerId: ProducerId
    readonly epoch: Epoch
    readonly seq: Seq
  }
  /**
   * Optional `Stream-Seq` header value. Lexicographic monotonic order is
   * enforced (`<= lastStreamSeq` → SequenceGapError). Independent of
   * producer-tracked dedup.
   */
  readonly streamSeq?: string
  readonly streamClosed?: boolean
}

export interface AppendOutput {
  /** Offset of the LAST message in this batch. */
  readonly nextOffset: Offset
  /**
   * True iff this batch was a producer-seq duplicate (already-seen
   * `(producerId, epoch, seq)`); the original batch's `nextOffset` is
   * returned for idempotent compatibility.
   *
   * Also `true` when an idempotent close (Stream-Closed: true with empty
   * body) is applied to an already-closed stream — second close is a no-op
   * and reuses the original tail offset.
   */
  readonly duplicate: boolean
  /** Whether the stream is closed after this append. */
  readonly closed: boolean
}

export interface ReadInput {
  readonly streamId: StreamId
  readonly fromOffset: Offset | "-1" | "now"
  /** Max number of MESSAGES (not bytes) to return. */
  readonly limit?: number
  readonly live?: "long-poll" | "sse"
  readonly timeoutMs?: number
  /** Echoed client cursor (from prior live response's `Stream-Cursor` header). */
  readonly clientCursor?: string
}

export interface ReadOutput {
  /**
   * Per-message body stream. Each chunk is **one message's bytes**.
   *
   * The wire layer above must format per-content-type:
   *   - JSON streams: assemble a JSON array on the way out
   *   - raw streams:  concatenate (which is the natural emission)
   *
   * On long-poll TIMEOUT (no data, deadline reached), this is `Stream.empty`
   * and `nextOffset` reflects the current tail (no progress).
   */
  readonly body: Stream.Stream<Uint8Array, never, never>
  readonly nextOffset: Option.Option<Offset>
  readonly upToDate: boolean
  readonly closed: boolean
  readonly cursor: Option.Option<string>
  /** True iff this read was a long-poll that hit its timeout with no new data. */
  readonly timedOut: boolean
}

export interface MetadataOutput {
  readonly contentType: Option.Option<ContentType>
  readonly nextOffset: Option.Option<Offset>
  readonly closed: boolean
}

// ─── Service shape ──────────────────────────────────────────────────────────

export interface InMemoryInnerShape {
  readonly create: (
    input: CreateInput,
  ) => Effect.Effect<CreateOutput, StreamConfigMismatchError>

  readonly append: (
    input: AppendInput,
  ) => Effect.Effect<
    AppendOutput,
    | StaleEpochError
    | SequenceGapError
    | StreamClosedError
    | StreamNotFoundError
    | InvalidPayloadError
  >

  readonly read: (input: ReadInput) => Effect.Effect<ReadOutput, StreamNotFoundError>

  readonly metadata: (
    input: { streamId: StreamId },
  ) => Effect.Effect<MetadataOutput, StreamNotFoundError>

  readonly delete: (input: { streamId: StreamId }) => Effect.Effect<{
    readonly deleted: boolean
  }>

  /** Test-only: snapshot the entire state. */
  readonly _snapshot: Effect.Effect<ReadonlyMap<string, InternalStream>>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const findStartIndex = (
  stream: InternalStream,
  fromOffset: Offset | "-1" | "now",
): number => {
  if (fromOffset === "-1") return 0
  if (fromOffset === "now") return stream.messages.length
  let lo = 0
  let hi = stream.messages.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const m = stream.messages[mid]!
    if (m.offset <= fromOffset) lo = mid + 1
    else hi = mid
  }
  return lo
}

// ─── Service implementation ─────────────────────────────────────────────────

const makeImpl = Effect.gen(function* () {
  const stateRef = yield* Ref.make(new Map<string, InternalStream>())

  // ── create ────────────────────────────────────────────────────────────────

  const create: InMemoryInnerShape["create"] = (input) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const state = yield* Ref.get(stateRef)
      const existing = state.get(input.streamId)
      if (existing) {
        // Idempotent: matching config → succeeds with `created: false`.
        // Mismatching content-type → 409 Conflict per spec.
        // Per spec: content-type comparison is case-insensitive.
        if (
          (existing.contentType as string).toLowerCase() !==
          (input.contentType as string).toLowerCase()
        ) {
          return yield* new StreamConfigMismatchError({
            streamId: input.streamId,
            expectedContentType: existing.contentType as string,
            receivedContentType: input.contentType as string,
          })
        }
        // Idempotent re-PUT with `Stream-Closed: true` on an open stream
        // transitions to closed (per spec).
        if (input.streamClosed === true && !existing.closed) {
          const next = new Map(state)
          next.set(input.streamId, { ...existing, closed: true })
          yield* Ref.set(stateRef, next)
          return {
            created: false,
            contentType: existing.contentType,
            closed: true,
          }
        }
        return {
          created: false,
          contentType: existing.contentType,
          closed: existing.closed,
        }
      }
      const initialClosed = input.streamClosed === true
      const next = new Map(state)
      next.set(input.streamId, {
        ...emptyStream(input.contentType, now),
        closed: initialClosed,
      })
      yield* Ref.set(stateRef, next)
      return {
        created: true,
        contentType: input.contentType,
        closed: initialClosed,
      }
    })

  // ── append ────────────────────────────────────────────────────────────────

  const append: InMemoryInnerShape["append"] = (input) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const stream = state.get(input.streamId)
      if (!stream) {
        return yield* new StreamNotFoundError({ streamId: input.streamId })
      }

      // ── Producer fencing + dedup (BEFORE closed-check) ──────────────────
      // Duplicate producer-seq POSTs always succeed idempotently — even if
      // the stream is now closed (per spec "close-with-different-body-dedup":
      // a retried close with same producer tuple wins on the original body).
      if (input.producer) {
        const pid = input.producer.producerId as string
        const high = stream.producers.get(pid)
        if (high) {
          if ((input.producer.epoch as number) < (high.epoch as number)) {
            return yield* new StaleEpochError({
              streamId: input.streamId,
              producerId: pid,
              ourEpoch: input.producer.epoch as number,
              serverEpoch: high.epoch as number,
            })
          }
          if ((input.producer.epoch as number) === (high.epoch as number)) {
            if ((input.producer.seq as number) <= (high.lastSeq as number)) {
              return {
                nextOffset: high.lastBatchEndOffset,
                duplicate: true,
                closed: stream.closed,
              }
            }
            if ((input.producer.seq as number) > (high.lastSeq as number) + 1) {
              return yield* new SequenceGapError({
                streamId: input.streamId,
                producerId: pid,
                expectedSeq: (high.lastSeq as number) + 1,
                receivedSeq: input.producer.seq as number,
              })
            }
          }
          // Higher epoch: accept (unfencing path)
        }
      }

      // ── Stream-Seq monotonic check (independent of Producer-Seq) ───────
      // Lex-ordered: each POST's streamSeq MUST be > lastStreamSeq.
      // Equal-or-less = duplicate or out-of-order = SequenceGapError.
      if (input.streamSeq !== undefined && input.streamSeq !== "") {
        if (
          stream.lastStreamSeq !== null &&
          input.streamSeq <= stream.lastStreamSeq
        ) {
          return yield* new SequenceGapError({
            streamId: input.streamId,
            producerId: "stream-seq",
            expectedSeq: 0,
            receivedSeq: 0,
          })
        }
      }

      // ── Empty-body branch (close-only / invalid-empty) ──────────────────
      if (input.messages.length === 0) {
        if (input.streamClosed === true) {
          // Idempotent close: closing a closed stream is a no-op (returns
          // existing tail + duplicate=true). Closing an open stream transitions.
          const tail =
            stream.messages[stream.messages.length - 1]?.offset ??
            makeOffset(0, 0)
          if (!stream.closed) {
            let newProducers: ReadonlyMap<string, ProducerHigh> =
              stream.producers
            if (input.producer) {
              const mut = new Map(stream.producers)
              mut.set(input.producer.producerId as string, {
                epoch: input.producer.epoch,
                lastSeq: input.producer.seq,
                lastBatchEndOffset: tail,
              })
              newProducers = mut
            }
            const next: InternalStream = {
              ...stream,
              closed: true,
              producers: newProducers,
            }
            const nextState = new Map(state)
            nextState.set(input.streamId, next)
            yield* Ref.set(stateRef, nextState)
            return { nextOffset: tail, duplicate: false, closed: true }
          }
          return { nextOffset: tail, duplicate: true, closed: true }
        }
        // Empty body without Stream-Closed: invalid (CONFORMANCE
        // "empty-post-without-stream-closed-400").
        return yield* new InvalidPayloadError({
          streamId: input.streamId,
          contentType: stream.contentType as string,
          reason: "empty-body-without-stream-closed",
        })
      }

      // ── Closed-stream guard (after dedup, after empty-branch) ───────────
      if (stream.closed) {
        const last = stream.messages[stream.messages.length - 1]?.offset
        return yield* new StreamClosedError({
          streamId: input.streamId,
          ...(last !== undefined ? { lastOffset: last } : {}),
        })
      }

      // ── Append the batch atomically ─────────────────────────────────────
      const newMessages: InternalMessage[] = []
      let seq = stream.nextSeq
      let byteOffset = stream.nextByteOffset
      for (const bytes of input.messages) {
        const offset = makeOffset(seq, byteOffset)
        newMessages.push({ offset, bytes })
        seq += 1
        byteOffset += bytes.length
      }
      const lastOffset = newMessages[newMessages.length - 1]!.offset

      // Update producer high-water-mark with the batch end.
      let newProducers: ReadonlyMap<string, ProducerHigh> = stream.producers
      if (input.producer) {
        const mut = new Map(stream.producers)
        mut.set(input.producer.producerId as string, {
          epoch: input.producer.epoch,
          lastSeq: input.producer.seq,
          lastBatchEndOffset: lastOffset,
        })
        newProducers = mut
      }

      const closedAfter = stream.closed || (input.streamClosed ?? false)
      const newLastStreamSeq =
        input.streamSeq !== undefined && input.streamSeq !== ""
          ? input.streamSeq
          : stream.lastStreamSeq
      const next: InternalStream = {
        ...stream,
        messages: [...stream.messages, ...newMessages],
        nextByteOffset: byteOffset,
        nextSeq: seq,
        closed: closedAfter,
        producers: newProducers,
        lastStreamSeq: newLastStreamSeq,
      }
      const nextState = new Map(state)
      nextState.set(input.streamId, next)
      yield* Ref.set(stateRef, nextState)
      return { nextOffset: lastOffset, duplicate: false, closed: closedAfter }
    })

  // ── read ──────────────────────────────────────────────────────────────────

  const readOnce = (
    input: ReadInput,
  ): Effect.Effect<ReadOutput, StreamNotFoundError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const stream = state.get(input.streamId)
      if (!stream) {
        return yield* new StreamNotFoundError({ streamId: input.streamId })
      }
      const limit = input.limit ?? Number.MAX_SAFE_INTEGER
      const start = findStartIndex(stream, input.fromOffset)
      const slice = stream.messages.slice(start, start + limit)
      const lastOffset =
        slice.length > 0
          ? slice[slice.length - 1]!.offset
          : stream.messages[stream.messages.length - 1]?.offset
      const upToDate = start + slice.length >= stream.messages.length
      // Body is per-message stream: each chunk = one message's raw bytes.
      // Wire layer formats per content-type.
      const body: Stream.Stream<Uint8Array, never, never> =
        slice.length === 0
          ? Stream.empty
          : Stream.fromIterable(slice.map((m) => m.bytes))
      // Cursor: emit only in live mode AND only when the stream is open.
      // Per spec, omitted from closed-stream responses.
      const isLive = input.live === "long-poll" || input.live === "sse"
      const cursor: Option.Option<string> =
        isLive && !stream.closed
          ? Option.some(
              resolveCursor(yield* Clock.currentTimeMillis, input.clientCursor),
            )
          : Option.none()
      return {
        body,
        nextOffset:
          lastOffset !== undefined ? Option.some(lastOffset) : Option.none(),
        upToDate,
        // Per spec: Stream-Closed: true is echoed whenever stream is closed,
        // regardless of caught-up state. Stream-Up-To-Date is the caught-up flag.
        closed: stream.closed,
        cursor,
        timedOut: false,
      }
    })

  const read: InMemoryInnerShape["read"] = (input) =>
    Effect.gen(function* () {
      // Long-poll: poll until new data, stream closes, or timeout.
      // On TIMEOUT we return Stream.empty for body (NOT a replay) so that
      // wire-level translation can render an HTTP 204-No-Content equivalent.
      if (input.live === "long-poll") {
        // First read: if we already have data past the requested offset,
        // return immediately.
        const initial = yield* readOnce(input)
        const initialState = yield* Ref.get(stateRef)
        const initialStream = initialState.get(input.streamId)!
        const initialStart = findStartIndex(initialStream, input.fromOffset)
        const initialSlice = initialStream.messages.slice(initialStart)
        if (initialSlice.length > 0 || initialStream.closed) return initial

        const timeoutMs = input.timeoutMs ?? 30_000
        const startTime = yield* Clock.currentTimeMillis
        while (true) {
          const elapsed = (yield* Clock.currentTimeMillis) - startTime
          if (elapsed >= timeoutMs) {
            // Timeout: empty body, current tail offset, fresh cursor (open
            // streams only).
            const tail =
              initialStream.messages[initialStream.messages.length - 1]?.offset
            const isLive = input.live === "long-poll" || input.live === "sse"
            const cursor: Option.Option<string> =
              isLive && !initialStream.closed
                ? Option.some(
                    resolveCursor(
                      yield* Clock.currentTimeMillis,
                      input.clientCursor,
                    ),
                  )
                : Option.none()
            return {
              body: Stream.empty,
              nextOffset:
                tail !== undefined ? Option.some(tail) : Option.none(),
              upToDate: true,
              closed: initialStream.closed,
              cursor,
              timedOut: true,
            } satisfies ReadOutput
          }
          yield* Effect.sleep(Duration.millis(POLL_INTERVAL_MS))
          const polledState = yield* Ref.get(stateRef)
          const polledStream = polledState.get(input.streamId)
          if (!polledStream) {
            return yield* new StreamNotFoundError({ streamId: input.streamId })
          }
          const start = findStartIndex(polledStream, input.fromOffset)
          if (start < polledStream.messages.length || polledStream.closed) {
            return yield* readOnce(input)
          }
        }
      }
      return yield* readOnce(input)
    })

  // ── metadata ──────────────────────────────────────────────────────────────

  const metadata: InMemoryInnerShape["metadata"] = ({ streamId }) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const stream = state.get(streamId)
      if (!stream) {
        return yield* new StreamNotFoundError({ streamId })
      }
      const tail = stream.messages[stream.messages.length - 1]?.offset
      return {
        contentType: Option.some(stream.contentType),
        nextOffset: tail !== undefined ? Option.some(tail) : Option.none(),
        closed: stream.closed,
      }
    })

  // ── delete ────────────────────────────────────────────────────────────────

  const del: InMemoryInnerShape["delete"] = ({ streamId }) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      if (!state.has(streamId)) return { deleted: false }
      const next = new Map(state)
      next.delete(streamId)
      yield* Ref.set(stateRef, next)
      return { deleted: true }
    })

  return {
    create,
    append,
    read,
    metadata,
    delete: del,
    _snapshot: Ref.get(stateRef),
  } satisfies InMemoryInnerShape
})

// ─── Service tag + layer ────────────────────────────────────────────────────

export class InMemoryInner extends Context.Service<
  InMemoryInner,
  InMemoryInnerShape
>()("@tmnl/lnk/services/wire/in-memory/InMemoryInner") {
  static readonly layer: Layer.Layer<InMemoryInner> = Layer.effect(
    InMemoryInner,
    makeImpl,
  )
}

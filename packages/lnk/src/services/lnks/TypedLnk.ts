/**
 * TypedLnk — schema-bound handle over a raw `Lnk`.
 *
 * Phase 2.5 of the lnk roadmap: typed end-to-end. Where `Lnk` exposes
 * raw `Uint8Array` bodies, `TypedLnk<A>` composes a `Lnk` with a
 * `Schema.Codec<A, ...>` so that:
 *
 *   - `append(value: A)` validates `value` against the schema and
 *     encodes to JSON bytes before POSTing.
 *   - `subscribe(): Stream<A, ...>` decodes incoming bytes against
 *     the schema and emits typed values.
 *   - `latest: Effect<Option<A>>` yields the most recent decoded
 *     value, or `None` if the driver hasn't received any yet.
 *
 * # Why composition (not inheritance)
 *
 * `TypedLnk<A>` HAS-A `Lnk`. It does not extend it. Reasons:
 *
 *   - The raw `Lnk` is `Effect`-shaped (see `Lnk.ts`) with carefully
 *     designed evict-on-scope-close semantics. Subclassing risks
 *     breaking those guarantees.
 *   - Schema-driven encoding is an orthogonal concern from the
 *     handle's lifecycle. Keeping them separate makes both testable
 *     in isolation.
 *   - Multiple typed views over the same raw `Lnk` are valid (e.g.
 *     one consumer sees `HeartRate`, another inspects an audit
 *     wrapper). Composition makes that trivial; inheritance doesn't.
 *
 * # Framing
 *
 * For now, `TypedLnk` assumes **JSON framing** (`application/json`
 * content-type on the underlying stream). The schema codec converts
 * each value to a JSON-shaped object, then to bytes via `TextEncoder`.
 *
 * Binary framings (CBOR, MessagePack, raw bytes) are a future option
 * via a `framing` parameter. Until then, the raw `Lnk` surface remains
 * available for callers that need raw bytes.
 *
 * @module @tmnl/lnk/services/lnks/TypedLnk
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import * as ContentType from "../../contracts/ContentType.js"
import type { Offset } from "../../contracts/Offset.js"
import type { StreamId } from "../../contracts/StreamId.js"
import type {
  FetchError,
  InvalidPayloadError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../contracts/errors.js"
import type { Lnk, LnkAppendOptions } from "./Lnk.js"

// ─── Configuration ──────────────────────────────────────────────────────────

/**
 * The canonical content-type for schema-driven streams under
 * JSON framing. Future framings (CBOR, MessagePack) would carry
 * their own content-type and corresponding codec.
 */
export const JSON_CONTENT_TYPE = ContentType.trust("application/json")

// ─── TypedLnk class ─────────────────────────────────────────────────────────

/**
 * A typed handle bound to a single schema.
 *
 * Construct via `withSchema(rawLnk, schema)` or via
 * `Lnks.connectTyped(streamId, schema)` (factory route, which shares
 * the ref-counted handle lifecycle with raw connections to the same id).
 */
export class TypedLnk<A> {
  constructor(
    /** The underlying raw handle. Owns the wire connection + lifecycle. */
    readonly raw: Lnk,
    /** Schema that decodes incoming bytes and validates outgoing values. */
    readonly schema: Schema.Schema<A>,
  ) {}

  /** Stream identifier (delegated). */
  get streamId(): StreamId {
    return this.raw.streamId
  }

  /**
   * Append a typed value to the stream.
   *
   * Pipeline: `value` → `Schema.encodeUnknown` (validate + encode to
   * the schema's JSON representation) → `JSON.stringify` → bytes →
   * underlying `Lnk.append`.
   *
   * On schema-validation failure, fails with `SchemaError` BEFORE
   * touching the wire — invalid values never leave the producer.
   */
  append(
    value: A,
    options?: LnkAppendOptions,
  ): Effect.Effect<
    {
      readonly nextOffset: Offset
      readonly duplicate: boolean
      readonly closed: boolean
    },
    | Schema.SchemaError
    | FetchError
    | InvalidPayloadError
    | StaleEpochError
    | SequenceGapError
    | StreamClosedError
    | StreamNotFoundError
    | StreamConfigMismatchError
  > {
    const self = this
    return Effect.gen(function* () {
      const encoded = yield* Schema.encodeUnknownEffect(self.schema)(value)
      const bytes = new TextEncoder().encode(JSON.stringify(encoded))
      return yield* self.raw.append(bytes, options)
    }) as Effect.Effect<
      {
        readonly nextOffset: Offset
        readonly duplicate: boolean
        readonly closed: boolean
      },
      | Schema.SchemaError
      | FetchError
      | InvalidPayloadError
      | StaleEpochError
      | SequenceGapError
      | StreamClosedError
      | StreamNotFoundError
      | StreamConfigMismatchError
    >
  }

  /**
   * Subscribe to the typed message stream. Each incoming raw message's
   * payload is decoded via the schema; decode failures emit a
   * `SchemaError` into the error channel (stream halts).
   *
   * Note: the underlying `raw.subscribe()` returns `Stream<Message>`
   * where `Message.payload` is `Uint8Array`. For JSON streams, the
   * wire layer already de-frames the JSON array into individual
   * message bytes; we decode each to a value.
   */
  subscribe(): Stream.Stream<A, Schema.SchemaError, never> {
    const self = this
    return Stream.mapEffect(self.raw.subscribe(), (message) =>
      decodeMessage(self.schema, message.payload),
    ) as Stream.Stream<A, Schema.SchemaError, never>
  }

  /**
   * Yield the latest decoded value (or `None` if no message has been
   * received yet on the underlying driver).
   *
   * Schema decode happens inline; a decode failure fails this Effect.
   */
  get latest(): Effect.Effect<Option.Option<A>, Schema.SchemaError> {
    const self = this
    return Effect.gen(function* () {
      const raw = yield* self.raw.asEffect()
      if (Option.isNone(raw)) return Option.none<A>()
      const value = yield* decodeMessage(self.schema, raw.value.payload)
      return Option.some(value)
    }) as Effect.Effect<Option.Option<A>, Schema.SchemaError>
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

const decodeMessage = <A>(
  schema: Schema.Schema<A>,
  payload: Uint8Array,
): Effect.Effect<A, Schema.SchemaError> =>
  Effect.gen(function* () {
    const json = JSON.parse(new TextDecoder().decode(payload))
    return yield* Schema.decodeUnknownEffect(schema)(json)
  }) as Effect.Effect<A, Schema.SchemaError>

// ─── Factories ──────────────────────────────────────────────────────────────

/**
 * Wrap a raw `Lnk` with a schema, producing a typed view.
 *
 * The two share underlying lifecycle: the raw `Lnk`'s scope owns the
 * wire connection. Multiple typed views over the same raw `Lnk` are
 * valid (and lightweight — no extra resources).
 *
 * @example
 * ```ts
 * const HeartRate = Schema.Struct({ bpm: Schema.Number, ... })
 * const raw = yield* lnks.connect(streamId, "application/json")
 * const typed = TypedLnk.withSchema(raw, HeartRate)
 * yield* typed.append({ bpm: 72, ... })  // typed + validated
 * ```
 */
export const withSchema = <A>(
  raw: Lnk,
  schema: Schema.Schema<A>,
): TypedLnk<A> => new TypedLnk(raw, schema)

/** Alias for `withSchema`. */
export const make = withSchema

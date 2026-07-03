/**
 * Offset — opaque, lex-sortable position marker in a Durable Stream.
 *
 * Per the Durable Streams spec
 * (https://github.com/durable-streams/durable-streams/blob/main/PROTOCOL.md):
 *
 *   "Every position in a stream is identified by an opaque,
 *    lexicographically sortable string token called an offset.
 *    Clients should never parse or construct offsets, only treat
 *    them as strings received from the server."
 *
 * Sentinels `"-1"` (beginning) and `"now"` (current tail) are NOT offsets;
 * they are *position references* a client may send when starting a read.
 * Servers MUST NOT generate these as actual offsets.
 *
 * # Validation duality
 *
 * Offsets cross our trust boundary in two ways:
 *
 *   - **Server → client** (hot path): we receive an offset string in a
 *     `Stream-Next-Offset` response header. The server is the source of
 *     truth on offset format. We `trust(s)` (zero-cost cast) — there is
 *     nothing to validate at runtime. Brands are purely type-level in v4
 *     (no runtime check beyond the underlying `Schema.String`), so this is
 *     genuinely free.
 *
 *   - **Untrusted input** (slow path): a value of unknown shape (e.g. user
 *     input, JSON.parse output, a query parameter) where we cannot assume
 *     it's a server-issued offset. Use `decode(value)` for the full
 *     `Schema.decodeUnknownEffect` pipeline (≈100-250ns/op). Or `parse(s)`
 *     for the additional defensive check that rejects sentinels.
 *
 * @module @tmnl/lnk/contracts/Offset
 */

import * as Effect from "effect/Effect"
import * as Order_ from "effect/Order"
import * as Schema from "effect/Schema"
import { InvalidOffsetError } from "./errors.js"

// ─── Brands ─────────────────────────────────────────────────────────────────

const TypeId = "~@tmnl/lnk/contracts/Offset" as const

/**
 * Opaque, lex-sortable string offset — branded `string`.
 *
 * Type-only nominal brand; no runtime validation beyond `Schema.String`.
 * Clients cannot construct one without going through `Offset.trust`
 * (server-trusted) or `Offset.parse`/`Offset.decode` (validated).
 */
export const Offset = Schema.String.pipe(
  Schema.brand("@tmnl/lnk/Offset"),
).annotate({
  identifier: "Offset",
  description:
    "Opaque, lex-sortable position marker. Clients MUST NOT parse the internal structure.",
})
export type Offset = typeof Offset.Type

/**
 * Position-reference sentinels. Sent by clients on initial reads.
 *
 *   `"-1"`  → beginning of stream (semantically equivalent to omitting offset)
 *   `"now"` → current tail position; skip historical data, only emit new messages
 *
 * Servers MUST NOT generate these as actual offsets in `Stream-Next-Offset`.
 */
export const OffsetSentinel = Schema.Literals(["-1", "now"]).annotate({
  identifier: "OffsetSentinel",
  description:
    "Position reference, not an offset. Sent by clients only; never returned by servers.",
})
export type OffsetSentinel = typeof OffsetSentinel.Type

/**
 * What a client may send as a starting position when reading a stream.
 * Either an `Offset` (received from a previous response) or a sentinel.
 */
export const ReadPosition = Schema.Union([Offset, OffsetSentinel]).annotate({
  identifier: "ReadPosition",
  description: "Starting position for a read: either an Offset or a sentinel.",
})
export type ReadPosition = typeof ReadPosition.Type

// ─── Sentinel constants ─────────────────────────────────────────────────────

/** Beginning-of-stream sentinel. Equivalent to omitting `?offset=`. */
export const beginning: OffsetSentinel = "-1"

/** Tail-of-stream sentinel. Skips historical data; only new messages will be emitted. */
export const now: OffsetSentinel = "now"

// ─── Predicates ─────────────────────────────────────────────────────────────

/** Type guard: is this string a sentinel value? */
export const isSentinel = (s: string): s is OffsetSentinel =>
  s === "-1" || s === "now"

// ─── Constructors ───────────────────────────────────────────────────────────

/**
 * **Hot path.** Trust an arbitrary string as an `Offset`. ZERO RUNTIME COST.
 *
 * Use this *only* at the wire boundary when receiving an offset from a
 * server response (e.g. `Stream-Next-Offset`). The server is the source of
 * truth on offset format; we simply echo strings back.
 *
 * Brands are purely type-level in Effect v4 — there is no runtime brand
 * check to skip. This is just a type-narrowing cast.
 *
 * Do NOT use `trust` on data of unknown provenance. Use `decode` or `parse`.
 */
export const trust = (s: string): Offset => s as Offset

/**
 * **Validation path.** Decode an `unknown` value as an `Offset`.
 *
 * Runs the full `Schema.decodeUnknownEffect` pipeline. Use at trust
 * boundaries: parsing JSON bodies, query parameters, untyped storage.
 *
 * Returns the canonical `SchemaError` for parse failures.
 */
export const decode = Schema.decodeUnknownEffect(Offset)

/**
 * Pattern characters explicitly forbidden in an offset URL parameter.
 *
 * Per spec, offsets are opaque, but practically:
 *   - whitespace, commas, semicolons would be ambiguous with URL encodings
 *     and HTTP header punctuation
 *   - control characters & nulls are invalid in URLs
 *
 * Servers MUST reject malformed values so clients can't smuggle injection
 * vectors via offset query params.
 */
const FORBIDDEN_OFFSET_CHARS = /[\s,;\u0000-\u001f]/

/**
 * **Validation path + defensive sentinel check.** Validate a string as a
 * real `Offset`, rejecting sentinels, empty strings, and malformed values.
 *
 * Use defensively when you want to *guarantee* you have a server-generated
 * offset and not a sentinel value. Most clients should use `trust` at the
 * wire boundary instead and never call `parse`.
 *
 * Fails with `InvalidOffsetError` on sentinel, empty, or malformed input.
 */
export const parse = Effect.fn("@tmnl/lnk/Offset.parse")(
  function* (s: string) {
    if (s.length === 0) {
      return yield* new InvalidOffsetError({
        value: s,
        reason: "empty" as const,
      })
    }
    if (isSentinel(s)) {
      return yield* new InvalidOffsetError({
        value: s,
        reason: "sentinel-not-offset" as const,
      })
    }
    if (FORBIDDEN_OFFSET_CHARS.test(s)) {
      return yield* new InvalidOffsetError({
        value: s,
        reason: "forbidden-characters" as const,
      })
    }
    return s as Offset
  },
)

/**
 * Validate a URL query-parameter value as a `ReadPosition` (offset OR
 * sentinel). Sentinels `"-1"` / `"now"` are accepted as-is. Empty strings
 * and malformed-character offsets are rejected.
 *
 * Use this at the HTTP boundary when decoding `?offset=...`.
 */
export const parsePositionParam = Effect.fn(
  "@tmnl/lnk/Offset.parsePositionParam",
)(function* (s: string) {
  if (s.length === 0) {
    return yield* new InvalidOffsetError({
      value: s,
      reason: "empty" as const,
    })
  }
  if (isSentinel(s)) return s as Offset | OffsetSentinel
  if (FORBIDDEN_OFFSET_CHARS.test(s)) {
    return yield* new InvalidOffsetError({
      value: s,
      reason: "forbidden-characters" as const,
    })
  }
  return s as Offset | OffsetSentinel
})

// ─── Order & Equivalence ────────────────────────────────────────────────────

/**
 * Lexicographic order on `Offset`.
 *
 * Per spec, offsets are guaranteed lex-sortable: string comparison matches
 * chronological order. This is the canonical comparator for client-side
 * offset bookkeeping (e.g. "have I caught up past offset X yet?").
 */
export const order: Order_.Order<Offset> = Order_.String as Order_.Order<Offset>

/** `a < b` lexicographically. Curried/dual form. */
export const isLessThan = Order_.isLessThan(order)
/** `a > b` lexicographically. Curried/dual form. */
export const isGreaterThan = Order_.isGreaterThan(order)
/** `a <= b` lexicographically. Curried/dual form. */
export const isLessThanOrEqualTo = Order_.isLessThanOrEqualTo(order)
/** `a >= b` lexicographically. Curried/dual form. */
export const isGreaterThanOrEqualTo = Order_.isGreaterThanOrEqualTo(order)

/** Strict equality on offsets (string identity). */
export const equals = (a: Offset, b: Offset): boolean => a === b

/** Pick the lex-greater of two offsets. */
export const max = Order_.max(order)
/** Pick the lex-lesser of two offsets. */
export const min = Order_.min(order)

// ─── Type-level metadata ────────────────────────────────────────────────────

export { TypeId }

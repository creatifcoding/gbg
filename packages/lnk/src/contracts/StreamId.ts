/**
 * StreamId — branded identifier for a Durable Stream.
 *
 * The Durable Streams spec deliberately does NOT prescribe a URL structure
 * for streams. They are URL-addressable and the server chooses the layout.
 *
 * For this client library we model `StreamId` as the *path component* a
 * caller passes to identify a stream, with conservative validation that
 * rejects characters which would require URL-encoding ambiguity and
 * unbounded lengths.
 *
 * # Validation duality
 *
 *   - `trust(s)`  — zero-cost cast (use only with server/test fixtures)
 *   - `decode(u)` — full `Schema.decodeUnknownEffect` validation
 *   - `parse(s)`  — pre-typed input + structural check (Effect.fn traced)
 *
 * @module @tmnl/lnk/contracts/StreamId
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"
import { InvalidStreamIdError } from "./errors.js"

const TypeId = "~@tmnl/lnk/contracts/StreamId" as const

/** Maximum length of a stream id. Defensive bound; servers may impose tighter limits. */
export const MAX_LENGTH = 1024

/**
 * Permissive pattern for stream id path components.
 *
 * Allows: alphanumeric, `-`, `_`, `.`, `/`, `:` (for namespaced ids like
 * `tenant:account/stream-name`).
 *
 * Rejects: whitespace, query-param chars (`?`, `#`, `&`, `=`), URL-encoded
 * sequences (`%`), and any control characters.
 */
export const PATTERN = /^[A-Za-z0-9_./:-]+$/

/**
 * Branded stream identifier.
 *
 * Schema-level: branded `Schema.String` with `isMaxLength` + `matches`
 * checks baked in via `.check(...)` — `decode()` runs all of them.
 */
export const StreamId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(MAX_LENGTH),
  Schema.isPattern(PATTERN),
).pipe(
  Schema.brand("@tmnl/lnk/StreamId"),
).annotate({
  identifier: "StreamId",
  description: "Branded stream identifier (path component).",
})
export type StreamId = typeof StreamId.Type

/**
 * **Hot path.** Trust a string as a `StreamId` (zero runtime cost).
 *
 * Use *only* at trusted boundaries — server-side context, test fixtures.
 * Untrusted input must go through `decode` or `parse`.
 */
export const trust = (s: string): StreamId => s as StreamId

/**
 * **Validation path.** Decode an `unknown` value as a `StreamId`. Runs
 * the full `Schema.decodeUnknownEffect` pipeline (length + pattern checks).
 */
export const decode = Schema.decodeUnknownEffect(StreamId)

/**
 * **Validation path (typed-input variant).** Validate a `string` as a
 * `StreamId`, with traced span and a domain-specific `InvalidStreamIdError`
 * (richer than `SchemaError` for surfacing in protocol responses).
 */
export const parse = Effect.fn("@tmnl/lnk/StreamId.parse")(
  function* (s: string) {
    if (s.length === 0) {
      return yield* new InvalidStreamIdError({ value: s, reason: "empty" })
    }
    if (s.length > MAX_LENGTH) {
      return yield* new InvalidStreamIdError({
        value: s,
        reason: `exceeds-max-length-${MAX_LENGTH}`,
      })
    }
    if (!PATTERN.test(s)) {
      return yield* new InvalidStreamIdError({
        value: s,
        reason: "contains-forbidden-characters",
      })
    }
    return s as StreamId
  },
)

/** Cheap type guard. Does NOT validate; structural shape only. */
export const isStreamIdLike = (u: unknown): u is StreamId =>
  typeof u === "string" && u.length > 0 && u.length <= MAX_LENGTH && PATTERN.test(u)

export { TypeId }

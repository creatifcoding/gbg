/**
 * Producer — idempotency-related brands for Durable Streams write-side.
 *
 * Per spec, exactly-once write semantics use the tuple
 *   (Producer-Id, Producer-Epoch, Producer-Seq)
 * The server tracks the highest seen `(producerId, epoch)` and dedupes
 * already-seen sequence numbers. Submitting from an *older* epoch when a
 * higher epoch has been observed yields a `StaleEpochError` (HTTP 403);
 * a producer with `autoClaim: true` retries by incrementing its epoch.
 *
 * # Validation duality
 *
 *   - `trust*(value)` — zero-cost cast for in-process counters and trusted inputs.
 *   - `decode*(unknown)` — full `Schema.decodeUnknownEffect` validation for wire/header inputs.
 *   - `parse*(string)` — typed-input validation via `Effect.fn`, fails with `InvalidHeaderError`.
 *
 * @module @tmnl/lnk/contracts/Producer
 */

import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { InvalidHeaderError } from "./errors.js"

// ─── ProducerId ─────────────────────────────────────────────────────────────

/** Maximum length of a producer id. Conservative bound for header transit. */
export const PRODUCER_ID_MAX_LENGTH = 256

/**
 * Permissive pattern for producer ids: alphanumerics + `-`, `_`, `.`, `:`.
 * Forbids whitespace and characters that would require percent-encoding in
 * an HTTP header value.
 */
export const PRODUCER_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/

/** Branded producer identifier. Stable across producer restarts. */
export const ProducerId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(PRODUCER_ID_MAX_LENGTH),
  Schema.isPattern(PRODUCER_ID_PATTERN),
).pipe(
  Schema.brand("@tmnl/lnk/ProducerId"),
).annotate({
  identifier: "ProducerId",
  description: "Stable, durable producer identifier.",
})
export type ProducerId = typeof ProducerId.Type

/** Hot path: trust a string as a `ProducerId` (zero cost). */
export const trustProducerId = (s: string): ProducerId => s as ProducerId

/** Validation path: decode an `unknown` as a `ProducerId`. */
export const decodeProducerId = Schema.decodeUnknownEffect(ProducerId)

/**
 * Validation path with domain error: validate a typed `string` as a `ProducerId`.
 *
 * Fails with `InvalidHeaderError` (since this most commonly fails when
 * parsing the `Producer-Id` wire header).
 */
export const parseProducerId = Effect.fn(
  "@tmnl/lnk/Producer.parseProducerId",
)(function* (s: string) {
  if (s.length === 0) {
    return yield* new InvalidHeaderError({
      name: "Producer-Id",
      value: s,
      reason: "empty",
    })
  }
  if (s.length > PRODUCER_ID_MAX_LENGTH) {
    return yield* new InvalidHeaderError({
      name: "Producer-Id",
      value: s,
      reason: `exceeds-max-length-${PRODUCER_ID_MAX_LENGTH}`,
    })
  }
  if (!PRODUCER_ID_PATTERN.test(s)) {
    return yield* new InvalidHeaderError({
      name: "Producer-Id",
      value: s,
      reason: "contains-forbidden-characters",
    })
  }
  return s as ProducerId
})

// ─── Epoch ──────────────────────────────────────────────────────────────────

/**
 * Producer epoch — non-negative integer. Incremented on producer
 * `restart()` to fence stale writers. Servers reject writes with epoch
 * lower than the highest seen for the `(streamId, producerId)` pair.
 */
export const Epoch = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(
  Schema.brand("@tmnl/lnk/Epoch"),
).annotate({
  identifier: "Epoch",
  description: "Non-negative integer epoch for producer fencing.",
})
export type Epoch = typeof Epoch.Type

/** Hot path: trust a number as an `Epoch`. */
export const trustEpoch = (n: number): Epoch => n as Epoch

/** Validation path: decode an `unknown` as an `Epoch`. */
export const decodeEpoch = Schema.decodeUnknownEffect(Epoch)

/** Initial epoch (0). */
export const epochZero: Epoch = 0 as Epoch

/** Increment to the next epoch. */
export const incrementEpoch = (e: Epoch): Epoch => ((e as number) + 1) as Epoch

// ─── Seq ────────────────────────────────────────────────────────────────────

/**
 * Producer sequence number — non-negative integer monotonically incremented
 * within a single `(producerId, epoch)`. Servers dedupe based on this.
 */
export const Seq = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
).pipe(
  Schema.brand("@tmnl/lnk/Seq"),
).annotate({
  identifier: "Seq",
  description:
    "Non-negative integer sequence number, monotonic within (producerId, epoch).",
})
export type Seq = typeof Seq.Type

/** Hot path: trust a number as a `Seq`. */
export const trustSeq = (n: number): Seq => n as Seq

/** Validation path: decode an `unknown` as a `Seq`. */
export const decodeSeq = Schema.decodeUnknownEffect(Seq)

/** Initial seq (0). */
export const seqZero: Seq = 0 as Seq

/** Increment to the next seq. */
export const incrementSeq = (s: Seq): Seq => ((s as number) + 1) as Seq

/**
 * @tmnl/lnk — Wire & type contracts (Phase 0).
 *
 * Pure schemas, brands, and parsers. No I/O. Zero runtime cost beyond
 * `Effect.fn` span instrumentation.
 *
 * These modules define the *contract surface* that the rest of the library
 * (wire layer, stream handles, producers, server adapters) builds on. They
 * are the source of truth for:
 *
 *   - Offset opacity & lex-sortable comparison
 *   - StreamId / ProducerId / Epoch / Seq brands
 *   - Content-Type framing-mode detection
 *   - Wire-header constants, parsers (`Effect.fn`), serializers
 *   - Error hierarchy (`Schema.TaggedErrorClass`)
 *
 * @module @tmnl/lnk/contracts
 */

export * as Offset from "./Offset.js"
export * as StreamId from "./StreamId.js"
export * as Producer from "./Producer.js"
export * as ContentType from "./ContentType.js"
export * as Headers from "./Headers.js"

// Errors are exported as concrete classes (so callers can `new` them and
// `Effect.catchTag("...")` on them), not under a namespace.
export {
  InvalidOffsetError,
  InvalidStreamIdError,
  InvalidContentTypeError,
  InvalidHeaderError,
  StaleEpochError,
  SequenceGapError,
  StreamClosedError,
  RetentionDroppedError,
  FetchError,
  type DurableStreamError,
  type InvalidOffsetReason,
} from "./errors.js"

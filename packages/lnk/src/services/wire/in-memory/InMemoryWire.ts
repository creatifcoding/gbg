/**
 * InMemoryWire — in-process implementation of `Wire`.
 *
 * Composes `InMemoryInner` (the per-message state store) into the public
 * wire shape. This layer is **content-type-aware**: it handles JSON framing
 * (array flattening on POST; JSON-array assembly on GET) before delegating
 * raw per-message storage to the inner.
 *
 * # Translation map (op → inner)
 *
 *   put    → InMemoryInner.create
 *   post   → split body per content-type → InMemoryInner.append({ messages })
 *   get    → InMemoryInner.read → assemble body per content-type
 *   head   → InMemoryInner.metadata
 *   delete → InMemoryInner.delete
 *
 * # Content-type framing
 *
 * Per spec (PROTOCOL.md):
 *   - `application/json` (and `application/<x>+json`) streams flatten array
 *     bodies one level on POST, and return JSON-array bodies on GET.
 *   - All other content types treat bodies as raw bytes (no boundary
 *     interpretation): single-message storage on POST, byte concatenation
 *     on GET.
 *
 * Framing errors (invalid JSON, empty array, non-array bodies on JSON
 * streams) surface as `InvalidPayloadError`.
 *
 * # Per CONFORMANCE.md §4 (JSON Framing) and §7.3 (Producer dedup correctness)
 *
 * @module @tmnl/lnk/services/wire/in-memory/InMemoryWire
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Stream from "effect-v4/Stream"

import { framingMode } from "../../../contracts/ContentType.js"
import {
  InvalidPayloadError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"
import { Wire } from "../Wire.js"
import { InMemoryInner } from "./InMemoryInner.js"

// ─── Body splitting / assembly helpers ──────────────────────────────────────

const TEXT_DECODER = new TextDecoder()
const TEXT_ENCODER = new TextEncoder()

/**
 * Split a POST body into per-message byte arrays based on stream's framing.
 *
 *   - JSON array `[a, b, c]`  → 3 elements, each a JSON-encoded value
 *   - JSON single object/value → 1 element, the JSON-encoded value
 *   - Raw bytes               → 1 element, the body as-is
 *
 * Fails with `InvalidPayloadError` for:
 *   - JSON stream + invalid JSON
 *   - JSON stream + empty array
 */
const splitPostBody = (
  streamId: string,
  contentType: string,
  body: Uint8Array,
): Effect.Effect<ReadonlyArray<Uint8Array>, InvalidPayloadError> => {
  const mode = framingMode(contentType)
  if (mode === "raw") {
    return Effect.succeed([body])
  }
  // JSON framing
  return Effect.gen(function* () {
    let parsed: unknown
    try {
      parsed = JSON.parse(TEXT_DECODER.decode(body))
    } catch (err) {
      return yield* new InvalidPayloadError({
        streamId,
        contentType,
        reason: `invalid-json: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return yield* new InvalidPayloadError({
          streamId,
          contentType,
          reason: "empty-json-array",
        })
      }
      // Flatten ONE level: each element re-encoded as a separate message.
      return parsed.map((el) => TEXT_ENCODER.encode(JSON.stringify(el)))
    }
    // Non-array JSON: store as a single message.
    return [TEXT_ENCODER.encode(JSON.stringify(parsed))]
  })
}

/**
 * Assemble per-message body chunks into a single GET-response byte stream.
 *
 *   - JSON: `[<msg1>,<msg2>,...]` — wrap with brackets, comma-separate
 *   - Raw:  concatenation (no separators)
 */
const assembleGetBody = (
  contentType: string,
  body: Stream.Stream<Uint8Array, never, never>,
): Stream.Stream<Uint8Array, never, never> => {
  const mode = framingMode(contentType)
  if (mode === "raw") return body
  // JSON: wrap as JSON array.
  // Strategy: emit `[`, then for each chunk emit it (or `,<chunk>` for
  // subsequent chunks), then emit `]`.
  const open = TEXT_ENCODER.encode("[")
  const close = TEXT_ENCODER.encode("]")
  const comma = TEXT_ENCODER.encode(",")
  // Use Stream.mapAccum to inject commas between chunks.
  const interleaved = Stream.flatMap(
    Stream.zipWithIndex(body),
    ([bytes, idx]) =>
      idx === 0
        ? Stream.succeed(bytes)
        : Stream.fromIterable([comma, bytes]),
  )
  return Stream.concat(
    Stream.concat(Stream.succeed(open), interleaved),
    Stream.succeed(close),
  )
}

// ─── Layer ──────────────────────────────────────────────────────────────────

export class InMemoryWire {
  /**
   * Self-contained Layer providing `Wire` backed by an
   * in-process state store.
   *
   * @example
   * ```ts
   * import { Effect, Layer } from "effect-v4"
   * import { Wire } from "@tmnl/lnk/services/wire"
   * import { InMemoryWire } from "@tmnl/lnk/services/wire/in-memory"
   *
   * const program = Effect.gen(function*() {
   *   const wire = yield* Wire
   *   yield* wire.put({ streamId: ..., contentType: ... })
   * })
   *
   * Effect.runPromise(program.pipe(Effect.provide(InMemoryWire.layer)))
   * ```
   */
  static readonly layer: Layer.Layer<Wire> = Layer.effect(
    Wire,
    Effect.gen(function* () {
      const inner = yield* InMemoryInner

      return Wire.of({
        // ── put ────────────────────────────────────────────────────────────
        put: (input) =>
          Effect.gen(function* () {
            const out = yield* inner.create({
              streamId: input.streamId,
              contentType: input.contentType,
            })
            return {
              streamId: input.streamId,
              contentType: out.contentType,
              created: out.created,
            }
            // NOTE: `StreamConfigMismatchError` from `inner.create` propagates;
            // currently it's bridged into the `put` error channel as a
            // FetchError-shaped failure for HttpWire-compat. Phase 1.1 will
            // wire StreamConfigMismatchError as a discriminated case.
          }).pipe(
            Effect.catchTag("StreamConfigMismatchError", (e) =>
              Effect.die(e),
            ),
          ),

        // ── post ───────────────────────────────────────────────────────────
        post: (input) =>
          Effect.gen(function* () {
            // Look up stream's content-type to decide framing.
            const meta = yield* inner.metadata({ streamId: input.streamId })
            if (Option.isNone(meta.contentType)) {
              // Stream exists but no content-type? Shouldn't happen with our
              // current Inner; but fall back to raw.
              const result = yield* inner.append({
                streamId: input.streamId,
                messages: [input.body],
                ...(input.producer !== undefined ? { producer: input.producer } : {}),
                ...(input.streamClosed !== undefined
                  ? { streamClosed: input.streamClosed }
                  : {}),
              })
              return result
            }
            const messages = yield* splitPostBody(
              input.streamId as string,
              meta.contentType.value as string,
              input.body,
            )
            const result = yield* inner.append({
              streamId: input.streamId,
              messages,
              ...(input.producer !== undefined ? { producer: input.producer } : {}),
              ...(input.streamClosed !== undefined
                ? { streamClosed: input.streamClosed }
                : {}),
            })
            return result
          }).pipe(
            // Promote InvalidPayloadError defects into the error channel via
            // FetchError-shaped failure for now (Phase 1.1 will surface it as
            // a discriminated case in the wire shape).
            Effect.catchTag("InvalidPayloadError", (e) => Effect.die(e)),
          ),

        // ── get ────────────────────────────────────────────────────────────
        get: (input) =>
          Effect.gen(function* () {
            const meta = yield* inner.metadata({ streamId: input.streamId })
            const out = yield* inner.read({
              streamId: input.streamId,
              fromOffset: input.position,
              ...(input.limit !== undefined ? { limit: input.limit } : {}),
              ...(input.live !== undefined ? { live: input.live } : {}),
              ...(input.timeout !== undefined ? { timeoutMs: input.timeout } : {}),
            })
            const ct = Option.getOrElse(
              meta.contentType,
              () => "application/octet-stream",
            )
            // On long-poll TIMEOUT (timedOut: true), body is intentionally
            // empty — pass through Stream.empty without JSON-array wrapping.
            const body = out.timedOut
              ? out.body
              : assembleGetBody(ct as string, out.body)
            return {
              body: body as Stream.Stream<Uint8Array, never, never>,
              ...(Option.isSome(out.nextOffset)
                ? { nextOffset: out.nextOffset.value }
                : {}),
              upToDate: out.upToDate,
              closed: out.closed,
              ...(Option.isSome(out.cursor) ? { cursor: out.cursor.value } : {}),
            }
          }),

        // ── head ───────────────────────────────────────────────────────────
        head: (input) =>
          Effect.gen(function* () {
            const out = yield* inner.metadata({ streamId: input.streamId })
            return {
              ...(Option.isSome(out.contentType)
                ? { contentType: out.contentType.value }
                : {}),
              ...(Option.isSome(out.nextOffset)
                ? { nextOffset: out.nextOffset.value }
                : {}),
              closed: out.closed,
            }
          }),

        // ── delete ─────────────────────────────────────────────────────────
        delete: (input) => inner.delete({ streamId: input.streamId }),
      })
    }),
  ).pipe(Layer.provide(InMemoryInner.layer))
}

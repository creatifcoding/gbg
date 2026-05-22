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
import { trust as trustOffset } from "../../../contracts/Offset.js"
import {
  InvalidPayloadError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"
import { Wire, type PutResultT } from "../Wire.js"
import { assembleGetBody, isEmptyArrayBytes, splitPostBody } from "../framing.js"
import { InMemoryInner } from "./InMemoryInner.js"

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
        // ── put ───────────────────────────────────────────────────────
        put: (input) =>
          Effect.gen(function* () {
            // Strategy:
            //   - body absent + streamClosed=true       → create-closed
            //   - body present + streamClosed=true       → create-open, then
            //                                              append-and-close
            //   - body present, no streamClosed          → create-open, then
            //                                              append
            //   - body absent, no streamClosed           → create-open
            const hasBody = input.body !== undefined && input.body.length > 0
            const out = yield* inner.create({
              streamId: input.streamId,
              contentType: input.contentType,
              ...(input.streamClosed === true && !hasBody
                ? { streamClosed: true }
                : {}),
              ...(input.streamTtl !== undefined ? { ttl: input.streamTtl } : {}),
              ...(input.streamExpiresAt !== undefined
                ? { expiresAt: input.streamExpiresAt }
                : {}),
              ...(input.schemaId !== undefined
                ? { schemaId: input.schemaId }
                : {}),
            })
            let nextOffset: PutResultT["nextOffset"]
            let closed = out.closed
            // Per spec: PUT with body `[]` on a JSON stream creates an empty
            // stream (not invalid). Skip the append in that case.
            const isEmptyJsonArray =
              hasBody &&
              framingMode(out.contentType as string) === "json" &&
              isEmptyArrayBytes(input.body!)
            if (hasBody && !isEmptyJsonArray) {
              const messages = yield* splitPostBody(
                input.streamId as string,
                out.contentType as string,
                input.body!,
              )
              const append = yield* inner.append({
                streamId: input.streamId,
                messages,
                ...(input.streamClosed === true ? { streamClosed: true } : {}),
              })
              nextOffset = append.nextOffset
              closed = append.closed
            } else {
              // Empty PUT (no body, JSON empty array, or close-only).
              // Per spec: response includes Stream-Next-Offset so clients
              // can resume reading. Use the tail (or canonical zero offset).
              const meta = yield* inner.metadata({ streamId: input.streamId })
              // For fresh empty streams (no tail offset), return a lex-less
              // sentinel that's strictly less than any real offset so a
              // subsequent GET ?offset=<this> returns all messages.
              // ASCII `-` (45) < `0` (48), and our real offsets always
              // start with a digit (zero-padded seq).
              nextOffset = Option.getOrElse(
                meta.nextOffset,
                () => trustOffset("-"),
              )
            }
            return {
              streamId: input.streamId,
              contentType: out.contentType,
              created: out.created,
              closed,
              ...(nextOffset !== undefined ? { nextOffset } : {}),
            }
          }).pipe(
            // The append path can fail with stream-state errors that don't
            // apply to PUT contractually. They CAN'T happen in a fresh PUT
            // (stream just got created and isn't closed, no producer yet),
            // so die-as-defect on them.
            Effect.catchTags({
              StreamClosedError: (e) => Effect.die(e),
              StaleEpochError: (e) => Effect.die(e),
              SequenceGapError: (e) => Effect.die(e),
              StreamNotFoundError: (e) => Effect.die(e),
              InvalidPayloadError: (e) => Effect.die(e),
            }),
          ),

        // ── post ──────────────────────────────────────────────────────
        post: (input) =>
          Effect.gen(function* () {
            const meta = yield* inner.metadata({ streamId: input.streamId })
            const streamCt =
              Option.getOrUndefined(meta.contentType) ??
              "application/octet-stream"
            // Per spec: if POST carries a Content-Type that differs from the
            // stream's registered content-type AND has a non-empty body,
            // fail with 409 mismatch.
            //
            // `application/octet-stream` is treated as "no preference" —
            // HTTP transports (e.g. effect-v4's bodyUint8Array) auto-apply
            // it as a default when the caller doesn't specify, so it
            // shouldn't be interpreted as a content-type assertion.
            const explicitClientCt =
              input.contentType !== undefined &&
              (input.contentType as string) !== "application/octet-stream"
                ? (input.contentType as string)
                : undefined
            if (
              explicitClientCt !== undefined &&
              input.body.length > 0 &&
              // Per spec: content-type comparison is case-insensitive.
              explicitClientCt.toLowerCase() !==
                (streamCt as string).toLowerCase()
            ) {
              return yield* new StreamConfigMismatchError({
                streamId: input.streamId as string,
                expectedContentType: streamCt as string,
                receivedContentType: explicitClientCt,
              })
            }
            // Empty body: pass `messages: []` to inner regardless of
            // content-type. Inner handles close-only-vs-invalid-empty.
            const messages =
              input.body.length === 0
                ? ([] as ReadonlyArray<Uint8Array>)
                : yield* splitPostBody(
                    input.streamId as string,
                    streamCt as string,
                    input.body,
                  )
            return yield* inner.append({
              streamId: input.streamId,
              messages,
              ...(input.producer !== undefined ? { producer: input.producer } : {}),
              ...(input.streamSeq !== undefined ? { streamSeq: input.streamSeq } : {}),
              ...(input.streamClosed !== undefined
                ? { streamClosed: input.streamClosed }
                : {}),
            })
          }),

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
              ...(input.cursor !== undefined
                ? { clientCursor: input.cursor }
                : {}),
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
              ...(Option.isSome(out.ttl) ? { ttl: out.ttl.value } : {}),
              ...(Option.isSome(out.expiresAt)
                ? { expiresAt: out.expiresAt.value }
                : {}),
              ...(Option.isSome(out.schemaId)
                ? { schemaId: out.schemaId.value }
                : {}),
            }
          }),

        // ── delete ─────────────────────────────────────────────────────────
        delete: (input) => inner.delete({ streamId: input.streamId }),
      })
    }),
  ).pipe(Layer.provide(InMemoryInner.layer))
}

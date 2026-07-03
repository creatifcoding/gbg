/**
 * Shared Durable Streams content-type framing helpers.
 *
 * These functions belong to LNK, not MSH. MSH stores/publishes opaque bytes;
 * LNK decides how JSON stream bodies split into logical messages and how
 * logical messages are assembled back into wire response bodies.
 */

import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"

import { framingMode } from "../../contracts/ContentType.js"
import { InvalidPayloadError } from "../../contracts/errors.js"

const TEXT_DECODER = new TextDecoder()
const TEXT_ENCODER = new TextEncoder()

/** Detect if a body is the JSON empty-array literal (with optional whitespace). */
export const isEmptyArrayBytes = (body: Uint8Array): boolean => {
  const decoded = TEXT_DECODER.decode(body).trim()
  return decoded === "[]"
}

/** Split a POST/PUT body into one byte array per logical Durable Stream message. */
export const splitPostBody = (
  streamId: string,
  contentType: string,
  body: Uint8Array,
): Effect.Effect<ReadonlyArray<Uint8Array>, InvalidPayloadError> => {
  const mode = framingMode(contentType)
  if (mode === "raw") return Effect.succeed([body])

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
      return parsed.map((el) => TEXT_ENCODER.encode(JSON.stringify(el)))
    }

    return [TEXT_ENCODER.encode(JSON.stringify(parsed))]
  })
}

/** Assemble one-byte-array-per-message into the Durable Streams response body. */
export const assembleGetBody = (
  contentType: string,
  body: Stream.Stream<Uint8Array, never, never>,
): Stream.Stream<Uint8Array, never, never> => {
  const mode = framingMode(contentType)
  if (mode === "raw") return body

  const open = TEXT_ENCODER.encode("[")
  const close = TEXT_ENCODER.encode("]")
  const comma = TEXT_ENCODER.encode(",")
  const interleaved = Stream.flatMap(
    Stream.zipWithIndex(body),
    ([bytes, idx]) =>
      idx === 0 ? Stream.succeed(bytes) : Stream.fromIterable([comma, bytes]),
  )
  return Stream.concat(
    Stream.concat(Stream.succeed(open), interleaved),
    Stream.succeed(close),
  )
}

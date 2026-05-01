/**
 * Sse — Durable Streams Server-Sent Events codec.
 *
 * Transport-agnostic encode/decode for the spec's SSE framing of `?live=sse`
 * GET responses. Used by:
 *   - The HTTP server adapter when emitting an SSE response body.
 *   - `HttpWire`'s SSE consumer (Phase 2 in the Lnk handle).
 *
 * # Spec
 *
 * SSE response body is `text/event-stream`. Two event types:
 *
 *   - `data:` events carry message payload(s).
 *       - For raw streams (Content-Type !== application/json): payload is
 *         base64-encoded bytes.
 *       - For JSON streams (Content-Type === application/json or
 *         application/<x>+json): payload is a JSON array of messages.
 *   - `control:` events carry control metadata as JSON:
 *       `{ streamNextOffset?, streamCursor?, upToDate?: true, streamClosed?: true }`
 *
 * One `control:` event MUST follow every `data:` event. Events are separated
 * by blank lines per RFC 6202 (Server-Sent Events) — `event: data\ndata: <payload>\n\n`.
 *
 * @module @tmnl/lnk/services/wire/Sse
 */

import type * as Stream from "effect-v4/Stream"

// ─── Event types ────────────────────────────────────────────────────────────

export interface ControlPayload {
  readonly streamNextOffset?: string
  readonly streamCursor?: string
  readonly upToDate?: true
  readonly streamClosed?: true
}

export type SseEvent =
  | { readonly _tag: "Data"; readonly payload: string }
  | { readonly _tag: "Control"; readonly payload: ControlPayload }

// ─── Encoding ───────────────────────────────────────────────────────────────

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

/**
 * Encode a single message batch as a `data:` event followed by a `control:`
 * event. Per spec: control event after every data event.
 *
 * `data` is the already-encoded payload string (caller decides framing):
 *   - JSON framing: pass JSON-array string
 *   - text/*    framing: pass raw text — newlines are split into multiple
 *                       `data:` fields within the same event (per RFC 6202)
 *   - binary    framing: pass base64-encoded string (caller pre-encoded)
 *
 * Returns the wire bytes (UTF-8) of `event: data\ndata: <p>\n\n` +
 * `event: control\ndata: <c>\n\n`.
 */
export const encodeDataAndControl = (
  data: string,
  control: ControlPayload,
): Uint8Array => {
  const lines: string[] = []
  lines.push("event: data")
  // SSE supports multi-line payloads via repeated `data:` lines. Newlines
  // (\n, \r\n, \r) inside the payload are split into separate `data:`
  // fields within the same event, which prevents CRLF/LF injection of
  // synthetic events into the response stream.
  for (const line of data.split(/\r\n|\n|\r/)) {
    lines.push(`data: ${line}`)
  }
  lines.push("") // blank line terminates the data event
  lines.push("event: control")
  lines.push(`data: ${JSON.stringify(control)}`)
  lines.push("")
  lines.push("")
  return TEXT_ENCODER.encode(lines.join("\n"))
}

/**
 * Determine SSE encoding mode from a content-type.
 *
 *   - JSON streams (application/json, application/<x>+json): "json"
 *   - text streams (text/*): "text" — emit raw text via multi-data lines
 *   - everything else (binary, application/octet-stream, image/*, etc.):
 *     "base64" — emit base64 + Stream-SSE-Data-Encoding header
 */
export type SseEncoding = "json" | "text" | "base64"
export const sseEncoding = (contentType: string): SseEncoding => {
  const mt = contentType.toLowerCase().split(";")[0]?.trim() ?? ""
  if (mt === "application/json") return "json"
  if (mt.startsWith("application/") && mt.endsWith("+json")) return "json"
  if (mt.startsWith("text/")) return "text"
  return "base64"
}

/** Encode a control-only event (e.g. heartbeat, end-of-stream signal). */
export const encodeControl = (control: ControlPayload): Uint8Array => {
  const text =
    `event: control\n` + `data: ${JSON.stringify(control)}\n` + `\n`
  return TEXT_ENCODER.encode(text)
}

/** Encode raw bytes as a base64 `data:` payload (for raw-framing streams). */
export const encodeRawDataPayload = (bytes: Uint8Array): string => {
  // Buffer is available in Node + Bun; use globalThis for cross-runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Buf = (globalThis as any).Buffer
  if (Buf && typeof Buf.from === "function") {
    return (Buf.from(bytes) as { toString: (enc: string) => string }).toString(
      "base64",
    )
  }
  // Browser fallback (btoa).
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).btoa(bin)
}

/**
 * Decode a base64 string back into raw bytes (inverse of `encodeRawDataPayload`).
 */
export const decodeRawDataPayload = (b64: string): Uint8Array => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Buf = (globalThis as any).Buffer
  if (Buf && typeof Buf.from === "function") {
    return new Uint8Array((Buf.from as (s: string, enc: string) => Uint8Array)(b64, "base64"))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bin: string = (globalThis as any).atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ─── Decoding ───────────────────────────────────────────────────────────────

/**
 * Parse an SSE byte stream into a stream of typed events. Boundary-tolerant:
 * accumulates partial chunks across emissions until a complete event is
 * available (events terminate at `\n\n`).
 *
 * Lazily imports `Stream` to avoid a hard dep cycle at module-init time
 * (this file is also used by the spec-server which doesn't need decode).
 */
export const decodeSseStream = (
  body: Stream.Stream<Uint8Array, never, never>,
): Stream.Stream<SseEvent, Error, never> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StreamMod = require("effect-v4/Stream") as typeof import("effect-v4/Stream")

  return StreamMod.suspend(() => {
    let buffer = ""
    return body.pipe(
      StreamMod.flatMap((chunk: Uint8Array) => {
        buffer += TEXT_DECODER.decode(chunk, { stream: true })
        const events: SseEvent[] = []
        let boundary: number
        // SSE separates events by blank line — i.e. `\n\n`.
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const parsed = parseEventBlock(rawEvent)
          if (parsed) events.push(parsed)
        }
        return StreamMod.fromIterable(events)
      }),
    )
  }) as Stream.Stream<SseEvent, Error, never>
}

const parseEventBlock = (raw: string): SseEvent | null => {
  if (raw.trim().length === 0) return null
  let eventType: string | undefined
  const dataLines: string[] = []
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart())
    }
    // ignore other fields (id:, retry:, comments)
  }
  const data = dataLines.join("\n")
  if (eventType === "data") {
    return { _tag: "Data", payload: data }
  }
  if (eventType === "control") {
    try {
      const payload = JSON.parse(data) as ControlPayload
      return { _tag: "Control", payload }
    } catch {
      return null
    }
  }
  return null
}

// ─── Content-Type helpers ───────────────────────────────────────────────────

/** Standard SSE content type for HTTP responses. */
export const SSE_CONTENT_TYPE = "text/event-stream" as const

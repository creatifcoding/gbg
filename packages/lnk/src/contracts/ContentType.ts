/**
 * ContentType — wire framing semantics for Durable Streams.
 *
 * Per spec, `Content-Type` is set when a stream is created and determines
 * how the server treats POST bodies and GET responses:
 *
 *   - `application/json`     → JSON framing. Each POST stores its payload
 *                              as a distinct message. Posting a JSON array
 *                              flattens it: each element becomes a separate
 *                              message. GETs return a JSON array.
 *
 *   - everything else        → raw bytes. The stream is a concatenation;
 *                              the server does not interpret message
 *                              boundaries.
 *
 * Note: schema validation (e.g. an additive `X-Schema-Id` extension) is
 * *orthogonal* to framing mode.
 *
 * @module @tmnl/lnk/contracts/ContentType
 */

import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { InvalidContentTypeError } from "./errors.js"

// ─── Brand ──────────────────────────────────────────────────────────────────

/**
 * Branded MIME content-type string.
 *
 * Carries the full `type/subtype; param=value; ...` form unchanged. Use
 * `parseContentType` for `string` validation, `decode` for unknowns, or
 * `trust` at trusted boundaries.
 */
export const ContentType = Schema.String.pipe(
  Schema.brand("@tmnl/lnk/ContentType"),
).annotate({
  identifier: "ContentType",
  description: "MIME Content-Type header value (with any params).",
})
export type ContentType = typeof ContentType.Type

/**
 * Wire framing mode — derived from a `Content-Type` per spec.
 *
 *   - `"json"` for `application/json` (and any `application/*+json` variant)
 *   - `"raw"` for anything else
 */
export const FramingMode = Schema.Literals(["json", "raw"])
export type FramingMode = typeof FramingMode.Type

// ─── Constructors ───────────────────────────────────────────────────────────

/** Hot path: trust a string as a `ContentType` (zero cost). */
export const trust = (s: string): ContentType => s as ContentType

/** Validation path: decode an `unknown` as a `ContentType`. */
export const decode = Schema.decodeUnknownEffect(ContentType)

/**
 * Validate a typed `string` as a Content-Type.
 *
 * Conservative check: must contain at least `type/subtype` and the type and
 * subtype must each be non-empty. Param syntax is permissive (any chars
 * after the first `;`).
 */
export const parseContentType = Effect.fn(
  "@tmnl/lnk/ContentType.parse",
)(function* (s: string) {
  const trimmed = s.trim()
  if (trimmed.length === 0) {
    return yield* new InvalidContentTypeError({
      value: s,
      reason: "empty",
    })
  }
  // Split off params at the first `;`
  const semiIdx = trimmed.indexOf(";")
  const mediaType = (semiIdx === -1 ? trimmed : trimmed.slice(0, semiIdx)).trim()
  const slashIdx = mediaType.indexOf("/")
  if (slashIdx <= 0 || slashIdx === mediaType.length - 1) {
    return yield* new InvalidContentTypeError({
      value: s,
      reason: "missing-type-or-subtype",
    })
  }
  return trimmed as ContentType
})

// ─── Framing detection ──────────────────────────────────────────────────────

/**
 * Lowercase the type/subtype portion of a content-type string for case-
 * insensitive comparison (params are left as-is).
 */
const mediaType = (ct: string): string => {
  const semiIdx = ct.indexOf(";")
  return (semiIdx === -1 ? ct : ct.slice(0, semiIdx)).trim().toLowerCase()
}

/**
 * Determine the framing mode for a content-type per spec.
 *
 *   - `application/json`              → `"json"`
 *   - `application/<...>+json` variants → `"json"`  (e.g. `application/ld+json`)
 *   - everything else                 → `"raw"`
 */
export const framingMode = (ct: ContentType | string): FramingMode => {
  const mt = mediaType(ct)
  if (mt === "application/json") return "json"
  if (mt.startsWith("application/") && mt.endsWith("+json")) return "json"
  return "raw"
}

/** True if the content-type uses JSON message-boundary framing. */
export const isJson = (ct: ContentType | string): boolean =>
  framingMode(ct) === "json"

/** True if the content-type uses raw-bytes framing (no message boundaries). */
export const isRaw = (ct: ContentType | string): boolean =>
  framingMode(ct) === "raw"

// ─── Common constants ───────────────────────────────────────────────────────

/** `application/json` — the canonical JSON-framing content type. */
export const APPLICATION_JSON: ContentType = "application/json" as ContentType

/** `application/octet-stream` — raw bytes, no framing. */
export const APPLICATION_OCTET_STREAM: ContentType =
  "application/octet-stream" as ContentType

/** `text/plain` — raw text, no framing. */
export const TEXT_PLAIN: ContentType = "text/plain" as ContentType

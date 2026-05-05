/**
 * Wire schemas — request/response shapes for the PCT HTTP surface.
 *
 * Every external request and response is described by an explicit
 * Schema so that:
 *   - Decoding fails fast at the boundary with structured errors
 *   - Routes are self-documenting (schema = OpenAPI source of truth)
 *   - Future codegen (TS client, Elixir/Python clients) reuses these
 *
 * @module @tmnl/pct/server/wire
 */

import * as Schema from "effect-v4/Schema"

// ─── /publish ──────────────────────────────────────────────────────────────

/**
 * POST /publish — register a single schema or procedure document.
 *
 * For Phase 3.5 we accept the simple "register schema" shape; full
 * procedure-document publish lands in 3.5.1.
 */
export const PublishSchemaRequest = Schema.Struct({
  /** Author-provided schema name (e.g. "orders/Order"). */
  name: Schema.String,
  /** Semver string (e.g. "1.0.0"). */
  version: Schema.String,
  /**
   * The schema document — a `SchemaRepresentation.Document` encoded
   * as JSON. Lossless round-trip back to an Effect `Schema.Top`.
   */
  schemaDocument: Schema.Unknown,
  /** Optional human description. */
  description: Schema.optional(Schema.String),
})

export const PublishSchemaResponse = Schema.Struct({
  schemaId: Schema.String,
  registeredAt: Schema.Number,
  /** The publishing node's nodeId (auto-stamped server-side). */
  originNodeId: Schema.String,
  /** Manifest revision after this write. */
  revision: Schema.Number,
})

// ─── /capabilities ─────────────────────────────────────────────────────────

/**
 * GET /capabilities — fetch the encoded `Manifest`.
 *
 * The body is whatever `Manifest.encode()` produces (`_tag`-tagged
 * struct with schemas + operations + peers). Schema for that lives in
 * `manifest/Manifest.ts`.
 */

// ─── /schemas/:schemaId ────────────────────────────────────────────────────

export const GetSchemaParams = Schema.Struct({
  /** Compound schema-id, URL-encoded — e.g. "orders%2FOrder%401.0.0". */
  schemaId: Schema.String,
})

export const GetSchemaResponse = Schema.Struct({
  schemaId: Schema.String,
  version: Schema.String,
  schemaDocument: Schema.Unknown,
  description: Schema.NullOr(Schema.String),
  registeredAt: Schema.Number,
  originNodeId: Schema.String,
  /** Present iff the schema has been deprecated. */
  deprecated: Schema.NullOr(
    Schema.Struct({
      successor: Schema.NullOr(Schema.String),
      reason: Schema.String,
      at: Schema.Number,
      originNodeId: Schema.String,
    }),
  ),
})

// ─── Error envelope ────────────────────────────────────────────────────────

/**
 * Generic JSON error body for all PCT routes. Per `PCT.md` §11.
 */
export const ErrorBody = Schema.Struct({
  error: Schema.Struct({
    code: Schema.String,
    message: Schema.String,
    /** Optional structured detail (e.g. SchemaError issues). */
    detail: Schema.optional(Schema.Unknown),
  }),
})

export type ErrorBody = typeof ErrorBody.Type

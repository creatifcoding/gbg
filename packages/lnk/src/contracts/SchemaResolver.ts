/**
 * SchemaResolver — abstract dependency for resolving a Schema by id.
 *
 * # Why this lives here
 *
 * `Lnks.connectTyped(streamId)` (Phase 2.5b, the 1-arg auto-fetch
 * overload) needs to look up a `Schema.Top` given a string schema-id
 * found in stream metadata. The canonical resolver is `@tmnl/pct`'s
 * `PactClient.fetchSchema(...)`, which talks to a remote PCT registry
 * and reconstructs schemas via `SchemaRepresentation.toSchema`.
 *
 * But making `@tmnl/lnk` depend on `@tmnl/pct` would create a cycle:
 * `@tmnl/pct` already depends on `@tmnl/lnk` for stream transport.
 *
 * Solution: lnk defines this abstract `Context.Service` interface.
 * pct (and any other source) provides an implementation Layer.
 * The dependency direction stays clean: pct -> lnk, never the reverse.
 *
 * # Cardinality and lifecycle
 *
 * One `SchemaResolver` per Lnks instance. Caching is the
 * implementation's concern (the canonical PactClient impl caches
 * indefinitely by schema-id; PCT semver guarantees published
 * `name@version` is immutable, so this is safe).
 *
 * @module @tmnl/lnk/contracts/SchemaResolver
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import type { FetchError } from "./errors.js"

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Resolver-specific "schema not found" error. Implementations of
 * `SchemaResolver` map their underlying not-found shape (e.g.
 * `PactClient.SchemaNotFound`) to this tagged class so that callers
 * can `catchTag("SchemaResolverNotFound", ...)` without coupling to
 * the implementation package.
 */
export class SchemaResolverNotFound extends Schema.TaggedErrorClass<SchemaResolverNotFound>(
  "@tmnl/lnk/SchemaResolverNotFound",
)("SchemaResolverNotFound", {
  schemaId: Schema.String,
}) {}

// ─── Service shape ──────────────────────────────────────────────────────────

export interface SchemaResolverShape {
  /**
   * Fetch a schema by its opaque id. Returns a reconstructed
   * `Schema.Top` ready for use (e.g. `Schema.decodeUnknownEffect`).
   *
   * The result type is `Schema.Top` (not parametric `Schema.Schema<A>`)
   * because the resolver doesn't know the type at compile time —
   * callers cast / assert when they use it.
   *
   * Implementations SHOULD cache results indefinitely under the
   * assumption that published schema versions are immutable.
   */
  readonly fetchSchema: (
    schemaId: string,
  ) => Effect.Effect<Schema.Top, SchemaResolverNotFound | FetchError>
}

// ─── Service tag ────────────────────────────────────────────────────────────

/**
 * The `SchemaResolver` service. Lnk's `Lnks.connectTyped(streamId)`
 * requires this in scope to resolve schemas from stream metadata.
 *
 * Canonical implementation (`@tmnl/pct/client`) wraps `PactClient.fetchSchema`.
 * Test implementations can use `SchemaResolver.fromMap(...)` or
 * `Layer.succeed(SchemaResolver, { fetchSchema: ... })`.
 */
export class SchemaResolver extends Context.Service<
  SchemaResolver,
  SchemaResolverShape
>()("@tmnl/lnk/contracts/SchemaResolver") {}

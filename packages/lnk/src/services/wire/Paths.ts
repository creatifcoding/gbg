/**
 * Paths — URL path templates for the Durable Streams wire.
 *
 * Per spec: "The protocol does not prescribe any particular URL structure
 * for streams." Different deployments use different layouts:
 *   - `/streams/<id>` (concise, our default)
 *   - `/v1/stream/<id>` (used by the upstream conformance suite)
 *   - `/<tenant>/streams/<id>` (multi-tenant deployments)
 *   - any other server-defined shape
 *
 * Both the client (`HttpInner`) and the server adapter must agree on the
 * format. This module is the single source of truth: a `PathResolver`
 * pair (build + parse) that both sides consume.
 *
 * @module @tmnl/lnk/services/wire/Paths
 */

// ─── PathResolver ───────────────────────────────────────────────────────────

export interface PathResolver {
  /** Build the request path for a streamId. */
  readonly streamPath: (streamId: string) => string
  /**
   * Extract a streamId from a request path. Returns `null` if the path
   * doesn't match this resolver's template.
   */
  readonly parseStreamPath: (path: string) => string | null
}

// ─── Built-in resolvers ─────────────────────────────────────────────────────

/**
 * Default: `/streams/<id>`. Used by our internal spec server and HttpWire
 * tests when no override is configured.
 */
export const defaultPaths: PathResolver = {
  streamPath: (streamId) => `/streams/${encodeURIComponent(streamId)}`,
  parseStreamPath: (path) => {
    const m = path.match(/^\/streams\/([^/?]+)$/)
    return m ? decodeURIComponent(m[1]!) : null
  },
}

/**
 * Upstream conformance suite convention: `/v1/stream/<id>` (singular,
 * `/v1/`-prefixed). Used when running `@durable-streams/server-conformance-tests`
 * against our spec server.
 */
export const v1Paths: PathResolver = {
  streamPath: (streamId) => `/v1/stream/${encodeURIComponent(streamId)}`,
  parseStreamPath: (path) => {
    const m = path.match(/^\/v1\/stream\/([^/?]+)$/)
    return m ? decodeURIComponent(m[1]!) : null
  },
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Build a `PathResolver` from a template string with `{id}` substitution.
 *
 * Examples:
 *   makePaths("/streams/{id}")        → defaultPaths-equivalent
 *   makePaths("/v1/stream/{id}")      → v1Paths-equivalent
 *   makePaths("/api/v2/lnks/{id}")    → custom deployment
 *
 * Constraints:
 *   - Template MUST contain exactly one `{id}` placeholder.
 *   - Template MUST start with `/`.
 *   - The `{id}` placeholder MUST be the LAST path segment (no trailing path).
 */
export const makePaths = (template: string): PathResolver => {
  if (!template.startsWith("/")) {
    throw new Error(`Path template must start with /: ${template}`)
  }
  const placeholder = "{id}"
  const placeholderIdx = template.indexOf(placeholder)
  if (placeholderIdx === -1) {
    throw new Error(`Path template must contain {id}: ${template}`)
  }
  if (template.indexOf(placeholder, placeholderIdx + 1) !== -1) {
    throw new Error(`Path template must contain {id} exactly once: ${template}`)
  }
  if (placeholderIdx + placeholder.length !== template.length) {
    throw new Error(`Path template must end with {id}: ${template}`)
  }
  const prefix = template.slice(0, placeholderIdx)
  // Build a regex: escape literal prefix, append capture for the id.
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const re = new RegExp(`^${escapedPrefix}([^/?]+)$`)
  return {
    streamPath: (streamId) => `${prefix}${encodeURIComponent(streamId)}`,
    parseStreamPath: (path) => {
      const m = path.match(re)
      return m ? decodeURIComponent(m[1]!) : null
    },
  }
}

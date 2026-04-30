/**
 * HTTP wire implementation (client-side).
 *
 * Provides `HttpWire.layer(config)` — a `Layer<Wire, never, HttpClient>` that
 * talks to a remote Durable-Streams-spec server over HTTP. Wraps `HttpInner`
 * for the low-level fetch + spec header parsing.
 *
 * Caller must additionally provide an `HttpClient`. The simplest is
 * `FetchHttpClient.layer` from `effect-v4/unstable/http/FetchHttpClient`,
 * which has no platform-specific requirements.
 *
 * @module @tmnl/lnk/services/wire/http
 */

export { HttpWire } from "./HttpWire.js"
export { HttpInner, HEADERS, type HttpInnerConfig } from "./HttpInner.js"

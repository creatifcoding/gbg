/**
 * Durable-Streams — multi-version barrel
 *
 * Two implementations live side-by-side:
 *   - `./v1`     — legacy Effect v3 + NATS-bridge prior (deprecated, not spec-faithful)
 *   - `./latest` — Effect v4, faithful to the canonical Durable Streams wire spec
 *                  (https://github.com/durable-streams/durable-streams)
 *
 * The default barrel re-exports v1 to preserve existing call-sites.
 * **All new code MUST import from `@/lib/holonet/durable-streams/latest`.**
 *
 * Migration plan and architectural rationale:
 *   `./latest/ARCHITECTURE.md`
 *
 * @module holonet/durable-streams
 */

// Default barrel — v1 (deprecated, kept for backwards-compat)
// NOTE: `latest` is intentionally NOT re-exported here. Import it explicitly
//       via `@/lib/holonet/durable-streams/latest` to make the version choice
//       visible at the call-site.
export * from './v1';

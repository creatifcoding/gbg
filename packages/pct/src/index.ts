/**
 * @tmnl/pct — Pact Protocol reference implementation
 *
 * Schema-first wire protocol with event-sourced federated registry.
 * Author procedures as values; publish to the registry; serve over HTTP.
 *
 * See `PCT.md` (in @tmnl/lnk for now) for the spec.
 *
 * Phase 3 status:
 *   - Phase 3.0 — Procedure value types ✅
 *   - Phase 3.1 — Procedure serialization (TODO)
 *   - Phase 3.2 — Pact.publish (TODO)
 *   - Phase 3.3 — PactServer (TODO)
 *   - Phase 3.4 — PactClient (TODO)
 *   - Phase 3.5 — Lnk auto-binding (TODO)
 *   - Phase 3.6 — pact CLI (TODO)
 *   - Phase 3.7 — Snapshots / compaction (TODO)
 *
 * @module @tmnl/pct
 */

export * as Contracts from "./contracts/index.js"
export * as Procedures from "./procedures/index.js"
export * as Registry from "./registry/index.js"
export * as Manifest from "./manifest/index.js"
export * as Publish from "./publish/index.js"
export * as Identity from "./identity/index.js"
export * as Notary from "./notary/index.js"
export * as Server from "./server/index.js"

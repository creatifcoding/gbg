/**
 * @tmnl/pct — Pact Protocol reference implementation
 *
 * Schema-first wire protocol with event-sourced federated registry.
 * Author procedures as values; publish to the registry; serve over HTTP.
 *
 * See `PCT.md` (currently housed with @tmnl/lnk) for the draft spec.
 *
 * Implemented status:
 *   - Procedure / ProcedureGroup authoring surface ✅
 *   - Procedure serialization to schema documents ✅
 *   - Publish + Notary write path for schemas and operations ✅
 *   - HTTP server routes for capabilities, schema fetch, schema publish,
 *     and operation/group publish ✅
 *   - PactClient with schema cache + publish helpers ✅
 *   - PactConfig env/file/default stack ✅
 *   - pact CLI: registry status, publish, serve ✅
 *   - Lnk typed auto-binding via SchemaResolver ✅
 *   - Flow B federation service: pull peer manifests and replay registry events ✅
 *   - Flow B+ PCT-native delta sync ✅
 *   - Flow C EventLogRemote server adapter + loopback replication spike ✅
 *
 * Active gaps:
 *   - Production RPC transport mounting for EventLogRemote on `pact serve`.
 *   - MSH-backed Lnk wire adapter remains behind the composition RFC.
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
export * as Config from "./config/index.js"
export * as Server from "./server/index.js"
export * as Client from "./client/index.js"
export * as Federation from "./federation/index.js"
export * as Frames from "./frames/index.js"
export * as Diagnostics from "./diagnostics/index.js"

/**
 * @tmnl/pct/federation — peer-sync surface for the PCT registry.
 *
 * Flow B starts with pull-based manifest polling; Flow B+ prefers
 * `/federation/delta/:fromRevision` when available and falls back to
 * manifests when needed. The Registry folder's precedence rule handles
 * deterministic convergence.
 *
 * @module @tmnl/pct/federation
 */

export {
  type FederationShape,
  type SyncResult,
  Federation,
} from "./Federation.js"

export {
  type FederationConfig,
  Default,
  layer,
} from "./Default.js"

export {
  type PeerSyncStatus,
  applyManifest,
  makeStatus,
} from "./Sync.js"

export { DeltaRoutes } from "./DeltaRoutes.js"
export { Routes } from "./Routes.js"
export * as EventLogRemote from "./eventlog-remote/index.js"
export * as Wire from "./wire.js"

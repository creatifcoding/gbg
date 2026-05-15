/**
 * @tmnl/pct/federation — peer-sync surface for the PCT registry.
 *
 * Phase 3.7 (Flow B). Pull-based polling: each node periodically
 * fetches `/capabilities` from each peer and replays the manifest
 * onto its local EventLog. The Registry folder's precedence rule
 * handles deterministic convergence.
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

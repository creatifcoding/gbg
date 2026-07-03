/**
 * Identity — the node's signature.
 *
 * Per `PCT.md` and the service ontology proposal: every event a node
 * emits carries this identity. `Pact.Identity` exposes the node's
 * addressing surface (`nodeId`, optional `nodeUrl`); the cryptographic
 * keypair lives in `EventLog.Identity` and is provided alongside by
 * the same layer so federation signing flows through unchanged.
 *
 * # NodeId derivation
 *
 * Default layers derive `nodeId` from the public key:
 *
 *   nodeId = `pct:` + base32(sha256(publicKey).slice(0, 8))
 *
 * This makes nodeId tamper-evident — peers can verify that an event
 * signed by X really originated from the node with `nodeId = derive(X)`.
 *
 * Layers:
 *   - `Identity.layerEphemeral`           — fresh random keypair + derived nodeId per process
 *   - `Identity.layerFromEventLogIdentity` — wrap an externally-provided EventLog.Identity
 *   - `Identity.layerPersistent`           — load stable node keys from disk
 *
 * @module @tmnl/pct/identity/Identity
 */

import * as Context from "effect/Context"
import type * as Option from "effect/Option"

import type { NodeId } from "../contracts/Brands.js"

// ─── Service shape ──────────────────────────────────────────────────────────

export interface IdentityShape {
  /** Stable identifier for this node, opaque on the wire. */
  readonly nodeId: NodeId
  /** Optional public URL where this node can be reached. */
  readonly nodeUrl: Option.Option<string>
}

// ─── Service tag ────────────────────────────────────────────────────────────

/**
 * The Pact node identity service. Provided alongside `EventLog.Identity`
 * by the default identity layers; cryptographic operations route through
 * EventLog's substrate.
 */
export class Identity extends Context.Service<Identity, IdentityShape>()(
  "@tmnl/pct/identity/Identity",
) {}

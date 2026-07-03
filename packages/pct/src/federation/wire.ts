/**
 * Federation admin wire schemas.
 *
 * Flow B admin endpoints expose the in-process peer set and explicit
 * one-shot sync trigger. These are PCT-native control-plane messages;
 * Flow B+ delta and Flow C EventLogRemote will add separate payloads.
 *
 * @module @tmnl/pct/federation/wire
 */

import * as Schema from "effect/Schema"

// ─── Shared peer status ────────────────────────────────────────────────────

export const PeerSyncStatus = Schema.Struct({
  url: Schema.String,
  lastPolledMs: Schema.Number,
  lastObservedRevision: Schema.Number,
  lastObservedNodeId: Schema.optional(Schema.String),
  errorCount: Schema.Number,
  lastError: Schema.optional(Schema.String),
})
export type PeerSyncStatus = typeof PeerSyncStatus.Type

export const PeerUrlRequest = Schema.Struct({
  url: Schema.String,
})
export type PeerUrlRequest = typeof PeerUrlRequest.Type

// ─── GET /federation/peers ─────────────────────────────────────────────────

export const FederationPeersResponse = Schema.Struct({
  peers: Schema.Array(PeerSyncStatus),
})
export type FederationPeersResponse = typeof FederationPeersResponse.Type

// ─── POST /federation/peer and DELETE /federation/peer ─────────────────────

export const FederationPeerRequest = PeerUrlRequest
export type FederationPeerRequest = PeerUrlRequest

export const FederationPeerResponse = Schema.Struct({
  peer: PeerSyncStatus,
  peers: Schema.Array(PeerSyncStatus),
})
export type FederationPeerResponse = typeof FederationPeerResponse.Type

export const FederationUnpeerRequest = PeerUrlRequest
export type FederationUnpeerRequest = PeerUrlRequest

export const FederationUnpeerResponse = Schema.Struct({
  url: Schema.String,
  peers: Schema.Array(PeerSyncStatus),
})
export type FederationUnpeerResponse = typeof FederationUnpeerResponse.Type

// ─── POST /federation/sync ─────────────────────────────────────────────────

export const FederationSyncRequest = PeerUrlRequest
export type FederationSyncRequest = PeerUrlRequest

export const FederationSyncResponse = Schema.Struct({
  url: Schema.String,
  peerNodeId: Schema.String,
  peerRevision: Schema.Number,
  writes: Schema.Number,
  peers: Schema.Array(PeerSyncStatus),
})
export type FederationSyncResponse = typeof FederationSyncResponse.Type

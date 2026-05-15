/**
 * Holonet - NATS Effect Services (v3 compatibility shim)
 *
 * The canonical v4 implementation is @tmnl/msh.
 * This module re-exports the v3 services for existing consumers.
 *
 * @module holonet
 * @deprecated Use @tmnl/msh for new code
 */

// =============================================================================
// Configuration
// =============================================================================

export * from './schemas/config';

// =============================================================================
// NATS Services
// =============================================================================

export * from './nats';

// =============================================================================
// Subject Architecture
// =============================================================================

export * from './subject';

// =============================================================================
// Utilities
// =============================================================================

export * from './utils/codec';
export * from './utils/stream';

export * from './integration';

// =============================================================================
// Namespace Export (Convenience)
// =============================================================================

import {
  NatsConnectionService,
  NatsConnectionServiceLive,
  NatsConnectionServiceCustom,
  NatsInnerService,
  NatsInnerServiceLive,
  NatsHubService,
  NatsHubServiceLive,
  NatsPubSubService,
  NatsPubSubServiceLive,
  NatsKVService,
  NatsKVServiceLive,
  NatsStreamService,
  NatsStreamServiceLive,
  NatsCodecService,
  NatsCodecServiceLive,
  NatsMicroService,
  NatsMicroServiceLive,
  NatsServiceDiscoveryService,
  NatsServiceDiscoveryServiceLive,
} from './nats';

/**
 * Holonet namespace for convenient service access.
 *
 * @deprecated Use `Msh` from `@tmnl/msh` for new code.
 */
export const Holonet = {
  Connection: NatsConnectionService,
  ConnectionLive: NatsConnectionServiceLive,
  ConnectionCustom: NatsConnectionServiceCustom,
  Inner: NatsInnerService,
  InnerLive: NatsInnerServiceLive,
  Hub: NatsHubService,
  HubLive: NatsHubServiceLive,
  PubSub: NatsPubSubService,
  PubSubLive: NatsPubSubServiceLive,
  KV: NatsKVService,
  KVLive: NatsKVServiceLive,
  Stream: NatsStreamService,
  StreamLive: NatsStreamServiceLive,
  Micro: NatsMicroService,
  MicroLive: NatsMicroServiceLive,
  MicroDiscovery: NatsServiceDiscoveryService,
  MicroDiscoveryLive: NatsServiceDiscoveryServiceLive,
  Codec: NatsCodecService,
  CodecLive: NatsCodecServiceLive,
} as const;

export type HolonetNamespace = typeof Holonet;

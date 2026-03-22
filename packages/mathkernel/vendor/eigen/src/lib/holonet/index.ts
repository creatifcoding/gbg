/**
 * Holonet - NATS Effect Services
 *
 * Clean, general-purpose Effect services wrapping NATS primitives with proper
 * error handling and Schema codecs.
 *
 * Services:
 * - NatsConnectionService: Scoped connection lifecycle with Effect.acquireRelease
 * - NatsInnerService: Low-level NATS operations (core pub/sub, KV, streams, consumers)
 * - NatsHubService: Connection sharing via RcMap-based hub architecture
 * - NatsPubSubService: High-level typed pub/sub with Schema codecs
 * - NatsCodecService: Stream-native, parallelizable codec with Schema transforms
 * - NatsKVService: High-level KV with Schema codecs
 * - NatsStreamService: High-level JetStream with Schema codecs
 * - NatsMicroService: Wrapper around NATS services.add/client APIs
 * - NatsServiceDiscoveryService: Stream-based service discovery APIs
 *
 * @module holonet
 */

// =============================================================================
// Configuration
// =============================================================================

export * from './schemas/config';

// =============================================================================
// NATS Services (from nats/ implementation)
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
// Phoenix Channel Client Library
// =============================================================================

export * from './phoenix';

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
import {
  HolonetDurableStreamsClient,
  HolonetDurableStreamsClientDefault,
  HolonetDurableStreamsClientCustom,
  HolonetDurableStreamsClientLive,
} from './integration';

/**
 * Holonet namespace for convenient service access.
 *
 * @example
 * ```typescript
 * import { Holonet } from '@/lib/holonet';
 *
 * Effect.gen(function* () {
 *   const pubsub = yield* Holonet.PubSub;
 *   yield* pubsub.publish('topic', MySchema, data);
 * }).pipe(Effect.provide(Holonet.PubSubLive));
 * ```
 */
export const Holonet = {
  // Connection
  Connection: NatsConnectionService,
  ConnectionLive: NatsConnectionServiceLive,
  ConnectionCustom: NatsConnectionServiceCustom,

  // Inner (Low-Level)
  Inner: NatsInnerService,
  InnerLive: NatsInnerServiceLive,

  // Hub
  Hub: NatsHubService,
  HubLive: NatsHubServiceLive,

  // PubSub
  PubSub: NatsPubSubService,
  PubSubLive: NatsPubSubServiceLive,

  // KV
  KV: NatsKVService,
  KVLive: NatsKVServiceLive,

  // Stream
  Stream: NatsStreamService,
  StreamLive: NatsStreamServiceLive,

  // Microservices
  Micro: NatsMicroService,
  MicroLive: NatsMicroServiceLive,
  MicroDiscovery: NatsServiceDiscoveryService,
  MicroDiscoveryLive: NatsServiceDiscoveryServiceLive,

  // Codec
  Codec: NatsCodecService,
  CodecLive: NatsCodecServiceLive,

  DurableStreams: HolonetDurableStreamsClient,
  DurableStreamsLive: HolonetDurableStreamsClientLive,
  DurableStreamsDefault: HolonetDurableStreamsClientDefault,
  DurableStreamsCustom: HolonetDurableStreamsClientCustom,
} as const;

export type HolonetNamespace = typeof Holonet;

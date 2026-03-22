/**
 * NATS Services - Effect-wrapped NATS primitives
 *
 * This module provides clean, general-purpose Effect services wrapping NATS:
 *
 * - NatsConnectionService: Scoped connection lifecycle
 * - NatsInnerService: Low-level NATS operations (core pub/sub, KV, streams, consumers)
 * - NatsHubService: Connection sharing via RcMap-based hub architecture
 * - NatsPubSubService: High-level typed pub/sub with Schema codecs
 * - NatsCodecService: Stream-native, parallelizable codec with Schema transforms
 * - NatsKVService: High-level KV with Schema codecs
 * - NatsMicroService: Wrapper around nc.services add/client APIs
 * - NatsServiceDiscoveryService: Stream-based PING/INFO/STATS discovery
 *
 * @module holonet/nats
 */

// =============================================================================
// Error Types
// =============================================================================

export * from './errors';

// =============================================================================
// Codec Service (Stream-Native)
// =============================================================================

export {
  NatsCodecService,
  NatsCodecServiceLive,
  NatsCodec,
  type NatsCodecServiceShape,
  type DecodeContext,
  type BatchOptions,
  type EncodedItem,
  type DecodedItem,
} from './codec';

// =============================================================================
// Connection Service
// =============================================================================

export {
  NatsConnectionService,
  NatsConnectionServiceLive,
  NatsConnectionServiceCustom,
  type NatsConnectionShape,
} from './connection';

// =============================================================================
// Inner Service (Low-Level)
// =============================================================================

export {
  NatsInnerService,
  NatsInnerServiceLive,
  type NatsInnerServiceShape,
} from './inner';

// =============================================================================
// Hub Service (Connection Sharing)
// =============================================================================

export {
  NatsHubService,
  NatsHubServiceLive,
  type NatsHubServiceShape,
  type TypedHubMessage,
  type SubjectHubConfig,
  type HubSubscribeOptions,
} from './hub';

// =============================================================================
// PubSub Service (High-Level)
// =============================================================================

export {
  NatsPubSubService,
  NatsPubSubServiceLive,
  type NatsPubSubServiceShape,
  type TypedMessage,
  type SubscribeOptions,
  type RequestOptions,
} from './pubsub';

// =============================================================================
// KV Service (High-Level)
// =============================================================================

export {
  NatsKVService,
  NatsKVServiceLive,
  type NatsKVServiceShape,
  type TypedKVEntry,
  type WatchOptions as KVWatchOptions,
} from './kv';

// =============================================================================
// Stream Service (High-Level JetStream)
// =============================================================================

export {
  NatsStreamService,
  NatsStreamServiceLive,
  type NatsStreamServiceShape,
  type TypedJsMessage,
  type PublishOptions as StreamPublishOptions,
  type SubscribeOptions as StreamSubscribeOptions,
  type FetchOptions,
} from './stream';

// =============================================================================
// Microservices API (nc.services)
// =============================================================================

export {
  NatsMicroService,
  NatsMicroServiceLive,
  type NatsMicroServiceShape,
} from './micro';

export {
  NatsServiceDiscoveryService,
  NatsServiceDiscoveryServiceLive,
  type NatsServiceDiscoveryServiceShape,
} from './micro-discovery';

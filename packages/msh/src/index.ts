/**
 * @tmnl/msh — NATS Effect services for TMNL (Effect v4)
 *
 * @module
 */

// Configuration
export * from './schemas';

// NATS Services
export * from './nats';

// Subject Architecture
export * from './subject';

// Utilities (namespaced to avoid collision with nats/codec)
export {
  fromCallback, fromAsyncIterable, fromEffectAsyncIterable,
  fromEffectAsyncIterableWithTransform,
} from './utils/stream';
export { validateSchema } from './utils/validation';
export { wrapNatsError } from './utils/errors';
export { MshDecodeError } from './schemas/errors';

// Integration
export * from './integration';

// Auth
export * from './auth';

// Tracing
export { MshSpan, type MshSpanName } from './tracing';

// =============================================================================
// Msh Namespace (convenience)
// =============================================================================

import {
  NatsConnectionService, NatsConnectionServiceLive,
  NatsInnerService, NatsInnerServiceLive,
  NatsCodecService, NatsCodecServiceLive, NatsCodec,
  NatsHubService, NatsHubServiceLive,
  NatsPubSubService, NatsPubSubServiceLive,
  NatsKVService, NatsKVServiceLive,
  NatsStreamService, NatsStreamServiceLive,
  NatsMicroService, NatsMicroServiceLive,
  NatsServiceDiscoveryService, NatsServiceDiscoveryServiceLive,
} from './nats';

/**
 * Msh namespace for convenient service access.
 *
 * @example
 * ```typescript
 * import { Msh } from '@tmnl/msh';
 *
 * Effect.gen(function* () {
 *   const pubsub = yield* Msh.PubSub;
 *   yield* pubsub.publish('topic', MySchema, data);
 * }).pipe(Effect.provide(Msh.PubSubLive));
 * ```
 */
export const Msh = {
  Connection: NatsConnectionService,
  ConnectionLive: NatsConnectionServiceLive,
  Inner: NatsInnerService,
  InnerLive: NatsInnerServiceLive,
  Codec: NatsCodecService,
  CodecLive: NatsCodecServiceLive,
  CodecStatic: NatsCodec,
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
} as const;

export type MshNamespace = typeof Msh;

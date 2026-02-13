/**
 * IIoT Realtime Deployment Layers
 *
 * Pre-composed Layer stacks for deployment:
 * - IIoTRealtimeDistributed — Full WebSocket + Holonet (NATS) integration
 * - IIoTAdapterDistributed — Sparkplug adapter with KV-backed state registry
 *
 * All deployments require NATS infrastructure. No local-only fallback.
 *
 * @module @gbg/tmnl/iiot/realtime/layers
 */

import { Layer, pipe } from 'effect'
import { NatsPubSubService } from '../../holonet/nats/pubsub'
import { NatsKVService } from '../../holonet/nats/kv'
import { IIoTRealtimeWsServer } from './websocket-server'
import { EventDistributionLive } from './event-distribution'
import { HolonetBridgeLayer } from './holonet-bridge'
import {
  SparkplugAdapterKVLive,
  type SparkplugAdapterConfig,
} from '../adapters/sparkplug-adapter'

// =============================================================================
// Distributed Deployment (with NATS)
// =============================================================================

/**
 * Full IIoT real-time stack — WebSocket server with Holonet integration.
 *
 * Provides:
 * - RPC server at /ws/iiot
 * - EventDistribution with dual-publish (local + NATS)
 * - Remote ingress daemons (NATS → local channels)
 *
 * Requires: NatsPubSubService (auto-resolves the full Holonet connection stack)
 */
export const IIoTRealtimeDistributed = pipe(
  IIoTRealtimeWsServer,
  Layer.provide(EventDistributionLive),
  Layer.provide(HolonetBridgeLayer),
  Layer.provide(NatsPubSubService.Default),
)

/**
 * IIoT Sparkplug adapter with KV-backed STATE registry.
 *
 * Persists host application ONLINE/OFFLINE state in NATS KV bucket `iiot-state`.
 * Requires NATS infrastructure for KV operations.
 *
 * @param config - SparkplugAdapterConfig
 */
export const IIoTAdapterDistributed = (config: SparkplugAdapterConfig) =>
  pipe(
    SparkplugAdapterKVLive(config),
    Layer.provide(NatsKVService.Default),
  )

/**
 * Shared NATS Test Infrastructure
 *
 * Provides a real NATS-backed HolonetBridge layer for all realtime tests.
 * Every test requiring EventDistribution uses this instead of a stub.
 *
 * Requires a running NATS server with WebSocket on port 9222.
 * Set NATS_SKIP_INTEGRATION=1 to skip tests when NATS is unavailable.
 *
 * @module
 */

import { Layer } from 'effect'
import { connect } from 'nats.ws'
import { HolonetBridgeLayer } from '../holonet-bridge'
import { NatsPubSubService } from '../../../holonet/nats/pubsub'
import { NatsHubService } from '../../../holonet/nats/hub'
import { NatsInnerService } from '../../../holonet/nats/inner'
import { NatsConnectionService } from '../../../holonet/nats/connection'
import { HolonetConfigTag } from '../../../holonet/schemas/config'

// =============================================================================
// Configuration
// =============================================================================

export const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222'
export const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1'

// =============================================================================
// Health Check
// =============================================================================

export async function checkNatsHealth(): Promise<boolean> {
  try {
    const nc = await connect({ servers: NATS_SERVERS })
    await nc.close()
    return true
  } catch {
    return false
  }
}

// =============================================================================
// Layer Composition
// =============================================================================

const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'realtime-test',
  debug: false,
})

const testConnectionLayer = NatsConnectionService.Default.pipe(
  Layer.provide(testConfigLayer),
)

const testInnerLayer = NatsInnerService.Default.pipe(
  Layer.provide(testConnectionLayer),
)

const testHubLayer = NatsHubService.Default.pipe(
  Layer.provide(testInnerLayer),
)

const testPubSubLayer = NatsPubSubService.Default.pipe(
  Layer.provide(Layer.merge(testInnerLayer, testHubLayer)),
)

/**
 * HolonetBridge backed by real NATS.
 *
 * Requires a running NATS server. Use checkNatsHealth() + SKIP_INTEGRATION
 * guard in each test file.
 */
export const HolonetBridgeTestLayer = HolonetBridgeLayer.pipe(
  Layer.provide(testPubSubLayer),
)

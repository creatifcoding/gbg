/**
 * HolonetBridge Stub — Test-only layer for EventDistribution without NATS
 *
 * Provides no-op outbound publishes and empty inbound streams.
 * Use this in tests that exercise local EventDistribution behavior
 * without requiring a running NATS infrastructure.
 *
 * @module @gbg/tmnl/iiot/realtime/holonet-bridge-stub
 */

import { Effect, Layer, Stream } from 'effect'
import { HolonetBridge, type HolonetBridgeShape } from './holonet-bridge'

// =============================================================================
// Stub Implementation
// =============================================================================

const stubShape: HolonetBridgeShape = {
  // Outbound: no-op (nothing to publish to)
  publishReading: () => Effect.void,
  publishAlarm: () => Effect.void,
  publishEquipment: () => Effect.void,
  publishInvalidation: () => Effect.void,

  // Inbound: empty streams (no remote events in test mode)
  remoteReadings: Effect.succeed(Stream.empty),
  remoteAlarms: Effect.succeed(Stream.empty),
  remoteEquipment: Effect.succeed(Stream.empty),
  remoteInvalidations: Effect.succeed(Stream.empty),
}

/**
 * Test-only HolonetBridge layer — no NATS required.
 *
 * All outbound publishes are no-ops.
 * All inbound remote streams are empty (never emit).
 */
export const HolonetBridgeStub: Layer.Layer<HolonetBridge> =
  Layer.succeed(HolonetBridge, HolonetBridge.of(stubShape))

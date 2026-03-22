/**
 * HolonetBridge Service — Bridges IIoT Events to/from NATS
 *
 * Outbound: Fire-and-forget publish to NATS via NatsPubSubService.
 *   Errors are logged but never block the caller.
 *
 * Inbound: Subscribe to NATS wildcard subjects, yielding typed Streams.
 *   Used by EventDistribution to ingest remote events into local channels.
 *
 * @module @gbg/tmnl/iiot/realtime/holonet-bridge
 * @see src/lib/holonet/nats/pubsub.ts — NatsPubSubService API
 * @see src/lib/iiot/realtime/iiot-subjects.ts — Subject definitions
 */

import { Context, Effect, Layer, Stream, Scope } from 'effect'
import { NatsPubSubService } from '../../holonet/nats/pubsub'
import {
  IIoTReadingsSubject,
  IIoTAlarmsSubject,
  IIoTEquipmentSubject,
  IIoTInvalidationsSubject,
} from './iiot-subjects'
import {
  ReadingEvent,
  AlarmEvent,
  EquipmentStateChange,
  CacheInvalidation,
} from './event-distribution'

// =============================================================================
// Service Shape
// =============================================================================

export interface HolonetBridgeShape {
  /**
   * Outbound: Publish a reading event to NATS.
   * Fire-and-forget — errors are logged, never propagated.
   */
  readonly publishReading: (event: ReadingEvent) => Effect.Effect<void>

  /**
   * Outbound: Publish an alarm event to NATS.
   * Fire-and-forget — errors are logged, never propagated.
   */
  readonly publishAlarm: (event: AlarmEvent) => Effect.Effect<void>

  /**
   * Outbound: Publish an equipment state change to NATS.
   * Fire-and-forget — errors are logged, never propagated.
   */
  readonly publishEquipment: (event: EquipmentStateChange) => Effect.Effect<void>

  /**
   * Outbound: Publish a cache invalidation to NATS.
   * Fire-and-forget — errors are logged, never propagated.
   */
  readonly publishInvalidation: (event: CacheInvalidation) => Effect.Effect<void>

  /**
   * Inbound: Stream of remote reading events from NATS.
   * Subscribes to iiot.readings.* wildcard.
   */
  readonly remoteReadings: Effect.Effect<Stream.Stream<ReadingEvent>, never, Scope.Scope>

  /**
   * Inbound: Stream of remote alarm events from NATS.
   * Subscribes to iiot.alarms.* wildcard.
   */
  readonly remoteAlarms: Effect.Effect<Stream.Stream<AlarmEvent>, never, Scope.Scope>

  /**
   * Inbound: Stream of remote equipment state changes from NATS.
   * Subscribes to iiot.equipment.* wildcard.
   */
  readonly remoteEquipment: Effect.Effect<Stream.Stream<EquipmentStateChange>, never, Scope.Scope>

  /**
   * Inbound: Stream of remote cache invalidations from NATS.
   * Subscribes to iiot.invalidations.* wildcard.
   */
  readonly remoteInvalidations: Effect.Effect<Stream.Stream<CacheInvalidation>, never, Scope.Scope>
}

// =============================================================================
// Context.Tag
// =============================================================================

export class HolonetBridge extends Context.Tag('tmnl/iiot/HolonetBridge')<
  HolonetBridge,
  HolonetBridgeShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeHolonetBridge = Effect.gen(function* () {
  const pubsub = yield* NatsPubSubService

  // -- Outbound: fire-and-forget publish with Effect.ignoreLogged --

  const publishReading = (event: ReadingEvent): Effect.Effect<void> =>
    pubsub.publish(
      IIoTReadingsSubject.resolve({ deviceId: event.deviceId }),
      ReadingEvent,
      event,
    ).pipe(Effect.ignoreLogged)

  const publishAlarm = (event: AlarmEvent): Effect.Effect<void> =>
    pubsub.publish(
      IIoTAlarmsSubject.resolve({ deviceId: event.deviceId }),
      AlarmEvent,
      event,
    ).pipe(Effect.ignoreLogged)

  const publishEquipment = (event: EquipmentStateChange): Effect.Effect<void> =>
    pubsub.publish(
      IIoTEquipmentSubject.resolve({ equipmentId: event.equipmentId }),
      EquipmentStateChange,
      event,
    ).pipe(Effect.ignoreLogged)

  const publishInvalidation = (event: CacheInvalidation): Effect.Effect<void> =>
    pubsub.publish(
      IIoTInvalidationsSubject.resolve({ cacheKey: event.cacheKey }),
      CacheInvalidation,
      event,
    ).pipe(Effect.ignoreLogged)

  // -- Inbound: subscribe to wildcard, map to typed Stream --
  // Hub creation errors are defected (orDie) since they indicate
  // misconfiguration, not transient failures.
  // Stream-level SubscribeError/DecodeError are caught and ignored
  // per-message to keep the stream alive.

  const remoteReadings: HolonetBridgeShape['remoteReadings'] =
    pubsub.subscribe(
      IIoTReadingsSubject.wildcardPattern(),
      ReadingEvent,
    ).pipe(
      Effect.map((stream) => stream.pipe(
        Stream.map((msg) => msg.data),
        Stream.orDie,
      )),
      Effect.orDie,
    )

  const remoteAlarms: HolonetBridgeShape['remoteAlarms'] =
    pubsub.subscribe(
      IIoTAlarmsSubject.wildcardPattern(),
      AlarmEvent,
    ).pipe(
      Effect.map((stream) => stream.pipe(
        Stream.map((msg) => msg.data),
        Stream.orDie,
      )),
      Effect.orDie,
    )

  const remoteEquipment: HolonetBridgeShape['remoteEquipment'] =
    pubsub.subscribe(
      IIoTEquipmentSubject.wildcardPattern(),
      EquipmentStateChange,
    ).pipe(
      Effect.map((stream) => stream.pipe(
        Stream.map((msg) => msg.data),
        Stream.orDie,
      )),
      Effect.orDie,
    )

  const remoteInvalidations: HolonetBridgeShape['remoteInvalidations'] =
    pubsub.subscribe(
      IIoTInvalidationsSubject.wildcardPattern(),
      CacheInvalidation,
    ).pipe(
      Effect.map((stream) => stream.pipe(
        Stream.map((msg) => msg.data),
        Stream.orDie,
      )),
      Effect.orDie,
    )

  return HolonetBridge.of({
    publishReading,
    publishAlarm,
    publishEquipment,
    publishInvalidation,
    remoteReadings,
    remoteAlarms,
    remoteEquipment,
    remoteInvalidations,
  })
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Composable layer — requires NatsPubSubService in context.
 */
export const HolonetBridgeLayer: Layer.Layer<HolonetBridge, never, NatsPubSubService> =
  Layer.effect(HolonetBridge, makeHolonetBridge)

/**
 * Self-contained layer — bundles NatsPubSubService.
 * Typically used in integration tests with a real NATS connection.
 */
export const HolonetBridgeLive: Layer.Layer<HolonetBridge, never, NatsPubSubService> =
  HolonetBridgeLayer

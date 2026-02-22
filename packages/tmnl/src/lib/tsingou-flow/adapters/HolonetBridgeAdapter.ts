/**
 * HolonetBridgeAdapter — generic Effect.Service for sidecar-bridged sources.
 *
 * Both FileWatch and Serial adapters (and OSC, and any future hardware source)
 * follow the same pattern:
 *
 *   1. A sidecar process runs outside the Tauri webview (Node/Bun/Rust)
 *   2. The sidecar reads the actual hardware/filesystem/network source
 *   3. The sidecar publishes signals to a NATS subject via Holonet
 *   4. This adapter subscribes to that subject via Holonet NatsPubSubService
 *   5. Incoming messages are Schema-decoded and pushed to the signal queue
 *
 * This is NOT a generic "do everything" adapter. It's the typed subscriber
 * half of the sidecar pattern. The sidecar is the real adapter.
 *
 * Effect primitives used:
 *   - Holonet NatsPubSubService.subscribe → Stream<TypedMessage<A>>
 *   - Schema.decodeUnknown for message validation (tagged error channel)
 *   - Effect.uninterruptibleMask for signal emission
 *   - Effect.addFinalizer for scoped cleanup
 *   - Atom.make for health/signal count (Atom-as-State)
 *
 * @see src/lib/holonet/nats/pubsub.ts — typed pub/sub with hub-based fan-out
 * @module tsingou-flow/adapters/HolonetBridgeAdapter
 */

import {
  Effect,
  Stream,
  Schema,
  Context,
  Layer,
  Fiber,
  pipe,
} from 'effect'
import { Atom } from '@effect-atom/atom'

// Holonet service
import { NatsPubSubService } from '../../holonet/nats/pubsub'

import {
  type SourceAdapterShape,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './types'
import type { BaseSignal } from '../schemas/base-signal'
import { SignalValidationError } from './errors'

// =============================================================================
// Configuration
// =============================================================================

export const HolonetBridgeConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),

  /** Signal kind tag for emitted signals (e.g., "file-watch", "serial", "osc") */
  kind: Schema.String.pipe(Schema.minLength(1)),

  /**
   * NATS subject(s) the sidecar publishes to.
   * Supports wildcards: "tsingou.signal.file-watch.>" or "tsingou.signal.serial.COM3"
   */
  subjects: Schema.Array(Schema.String.pipe(Schema.minLength(1))),

  /**
   * Optional Schema for validating sidecar payloads.
   * If provided, messages that fail decode are sent to error channel
   * (not silently dropped).
   */
  payloadSchema: Schema.optional(Schema.Unknown),

  /** Queue group for load-balanced consumption (optional) */
  queueGroup: Schema.optional(Schema.String),

  /** Number of recent messages to replay on connect (hub feature) */
  replay: Schema.optional(Schema.Number),
})
export type HolonetBridgeConfig = typeof HolonetBridgeConfig.Type

export class HolonetBridgeConfigTag extends Context.Tag('tsingou/adapter/HolonetBridgeConfig')<
  HolonetBridgeConfigTag,
  HolonetBridgeConfig
>() {}

// =============================================================================
// Service
// =============================================================================

export class HolonetBridgeAdapter extends Effect.Service<HolonetBridgeAdapter>()(
  'tsingou/adapter/HolonetBridge',
  {
    scoped: Effect.gen(function* () {
      const config = yield* HolonetBridgeConfigTag
      const pubsub = yield* NatsPubSubService
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, config.kind)

      let paused = false
      const fibers: Fiber.RuntimeFiber<void, unknown>[] = []

      for (const subject of config.subjects) {
        // Subscribe via Holonet — typed pub/sub with hub-based connection sharing
        const messageStream = yield* pubsub.subscribe(subject, Schema.Unknown, {
          queue: config.queueGroup,
          replay: config.replay,
        })

        const fiber = yield* pipe(
          messageStream,
          // Validate payload if schema provided
          Stream.mapEffect((msg) =>
            Effect.gen(function* () {
              let payload: unknown = msg.data

              // If a validation schema is configured, decode
              if (config.payloadSchema) {
                // payloadSchema is stored as Unknown — in practice the caller
                // provides a real Schema instance at the config layer
                const schema = config.payloadSchema as Schema.Schema<unknown, unknown>
                const decoded = Schema.decodeUnknownEither(schema)(payload)
                if (decoded._tag === 'Left') {
                  yield* new SignalValidationError({
                    adapterId: config.adapterId,
                    kind: config.kind,
                    message: `Sidecar payload validation failed on ${subject}`,
                    rawPayload: payload,
                  })
                  return null
                }
                payload = decoded.right
              }

              return { subject: msg.subject, payload, reply: msg.reply }
            }),
          ),
          // Filter out validation failures
          Stream.filter((msg): msg is NonNullable<typeof msg> => msg !== null),
          // Emit as signals — critical section
          Stream.mapEffect((msg) =>
            Effect.uninterruptibleMask((_restore) =>
              Effect.gen(function* () {
                if (paused) return

                const signal: BaseSignal = {
                  id: generateSignalId(config.kind) as any,
                  sourceId: config.sourceId as any,
                  timestamp: new Date(),
                  version: [0, 0] as [number, number],
                  kind: config.kind,
                  payload: {
                    subject: msg.subject,
                    data: msg.payload,
                  },
                }
                yield* internals.push(signal)
              }),
            ),
          ),
          // Catch validation errors — log and continue stream
          Stream.catchTag('SignalValidationError', (err) =>
            Stream.fromEffect(
              Effect.log(`[HolonetBridge:${config.adapterId}] ${err.message}`),
            ).pipe(Stream.drain),
          ),
          Stream.runDrain,
          Effect.fork,
        )
        fibers.push(fiber)
      }

      // ─── Lifecycle ────────────────────────────────────────────────────────
      internals.updateHealth({ status: 'connected' })
      yield* Effect.log(
        `[HolonetBridgeAdapter:${config.adapterId}] Subscribed to ${config.subjects.join(', ')} (kind: ${config.kind})`,
      )

      yield* Effect.addFinalizer(() =>
        Effect.uninterruptibleMask((_restore) =>
          Effect.gen(function* () {
            for (const fiber of fibers) {
              yield* Fiber.interrupt(fiber)
            }
            internals.updateHealth({ status: 'disconnected' })
            yield* Effect.log(`[HolonetBridgeAdapter:${config.adapterId}] Disconnected`)
          }),
        ),
      )

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: config.kind,
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        pause: Effect.sync(() => { paused = true }),
        resume: Effect.sync(() => { paused = false }),
      } satisfies SourceAdapterShape
    }),
    dependencies: [NatsPubSubService.Default],
  },
) {}

// =============================================================================
// Convenience Factories
// =============================================================================

/**
 * FileWatchSourceAdapter — subscribe to file watch events from sidecar.
 *
 * Sidecar runs @effect/platform FileSystem.watch, publishes WatchEvents
 * to NATS subject "tsingou.signal.file-watch.>".
 *
 * @see @effect/platform FileSystem.watch → Stream<WatchEvent>
 */
export const makeFileWatchBridgeConfig = (opts: {
  adapterId: string
  sourceId: string
  /** Watch paths the sidecar is monitoring — maps to NATS subjects */
  watchPaths: string[]
  queueGroup?: string
}): HolonetBridgeConfig => ({
  adapterId: opts.adapterId,
  sourceId: opts.sourceId,
  kind: 'file-watch',
  subjects: opts.watchPaths.map((p) =>
    `tsingou.signal.file-watch.${p.replace(/\//g, '.').replace(/^\./, '')}`,
  ),
  queueGroup: opts.queueGroup,
})

/**
 * SerialSourceAdapter — subscribe to serial data from sidecar.
 *
 * Sidecar runs tauri-plugin-serialplugin or Node.js serialport,
 * publishes to NATS subject "tsingou.signal.serial.<port>".
 *
 * @see tauri-plugin-serialplugin — Rust serialport crate, IPC to JS
 * @see s00d/tauri-plugin-serialplugin — Tauri v2 serial plugin (2.21.1)
 * @see Web Serial API — NOT viable on Linux (WebKitGTK doesn't support it)
 */
export const makeSerialBridgeConfig = (opts: {
  adapterId: string
  sourceId: string
  /** Serial port name (e.g., "COM3", "/dev/ttyUSB0") — maps to NATS subject */
  portName: string
  queueGroup?: string
}): HolonetBridgeConfig => ({
  adapterId: opts.adapterId,
  sourceId: opts.sourceId,
  kind: 'serial',
  subjects: [`tsingou.signal.serial.${opts.portName.replace(/\//g, '.')}`],
  queueGroup: opts.queueGroup,
})

/**
 * OscSourceAdapter — subscribe to OSC messages from sidecar.
 *
 * Sidecar runs osc.js UDP listener, publishes to NATS subject
 * "tsingou.signal.osc.>".
 */
export const makeOscBridgeConfig = (opts: {
  adapterId: string
  sourceId: string
  /** OSC address patterns to subscribe to */
  addressPatterns?: string[]
  queueGroup?: string
}): HolonetBridgeConfig => ({
  adapterId: opts.adapterId,
  sourceId: opts.sourceId,
  kind: 'osc',
  subjects: opts.addressPatterns?.length
    ? opts.addressPatterns.map((p) => `tsingou.signal.osc.${p.replace(/\//g, '.').replace(/^\./, '')}`)
    : ['tsingou.signal.osc.>'],
  queueGroup: opts.queueGroup,
})

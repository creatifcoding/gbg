/**
 * NatsSourceAdapter — Effect.Service backed by Holonet NatsPubSubService.
 *
 * The primary adapter. Subscribes to NATS subjects via Holonet's typed
 * pub/sub infrastructure. Schema decoding via Holonet NatsCodecService.
 * Connection sharing via NatsHubService (multiple adapters, one connection).
 *
 * Scoped lifecycle: subscribe on construct, drain on release.
 *
 * @see src/lib/holonet/nats/pubsub.ts — typed pub/sub with hub-based fan-out
 * @see src/lib/holonet/nats/stream.ts — JetStream durable consumers
 * @module tsingou-flow/adapters/NatsAdapter
 */

import { Effect, Stream, Schema, Context, Layer, Scope, Fiber } from 'effect'
import { Atom } from '@effect-atom/atom'

// Holonet services
import { NatsPubSubService } from '../../holonet/nats/pubsub'
import { NatsStreamService } from '../../holonet/nats/stream'

import {
  type SourceAdapterShape,
  type AdapterInternals,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './types'
import type { BaseSignal, SourceId } from '../schemas/base-signal'

// =============================================================================
// Configuration
// =============================================================================

export const NatsAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),

  /** Subject(s) to subscribe to (supports wildcards: *, >) */
  subjects: Schema.Array(Schema.String.pipe(Schema.minLength(1))),

  /** Use JetStream durable consumer instead of core NATS */
  jetstream: Schema.optional(Schema.Boolean),

  /** JetStream stream name (required if jetstream: true) */
  streamName: Schema.optional(Schema.String),

  /** Durable consumer name for resumable consumption */
  durableName: Schema.optional(Schema.String),

  /** Deliver policy for JetStream */
  deliverPolicy: Schema.optional(
    Schema.Literal('all', 'last', 'new', 'by_start_sequence', 'by_start_time', 'last_per_subject'),
  ),
})
export type NatsAdapterConfig = typeof NatsAdapterConfig.Type

export class NatsAdapterConfigTag extends Context.Tag('tsingou/adapter/NatsConfig')<
  NatsAdapterConfigTag,
  NatsAdapterConfig
>() {}

// =============================================================================
// Service
// =============================================================================

/**
 * NatsSourceAdapter Effect.Service.
 *
 * Scoped: acquires Holonet NATS subscriptions on construct,
 * interrupts consumer fibers on scope close.
 *
 * Requires: NatsPubSubService, NatsStreamService (optional), SignalQueueTag, NatsAdapterConfigTag
 */
export class NatsSourceAdapter extends Effect.Service<NatsSourceAdapter>()(
  'tsingou/adapter/Nats',
  {
    scoped: Effect.gen(function* () {
      const config = yield* NatsAdapterConfigTag
      const pubsub = yield* NatsPubSubService
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, 'nats')

      let paused = false
      const consumerFibers: Fiber.RuntimeFiber<void, unknown>[] = []

      // Raw NATS message schema (we decode payload ourselves)
      const RawPayload = Schema.Unknown

      for (const subject of config.subjects) {
        if (config.jetstream && config.streamName) {
          // JetStream durable consumer via Holonet NatsStreamService
          const streamSvc = yield* NatsStreamService

          const jsStream = yield* streamSvc.subscribe(
            config.streamName,
            RawPayload,
            {
              consumer: config.durableName,
              filterSubject: subject,
              deliverPolicy: config.deliverPolicy ?? 'new',
              ackPolicy: 'explicit',
            },
          )

          const fiber = yield* Effect.fork(
            Stream.runForEach(jsStream, (msg) =>
              Effect.gen(function* () {
                if (paused) return

                const signal: BaseSignal = {
                  id: generateSignalId('nats') as any,
                  sourceId: config.sourceId as any,
                  timestamp: msg.time,
                  version: [0, msg.seq] as [number, number],
                  kind: 'nats',
                  payload: {
                    subject: msg.subject,
                    data: msg.data,
                    sequence: msg.seq,
                  },
                }

                yield* internals.push(signal)
                yield* msg.ack()
              }),
            ),
          )
          consumerFibers.push(fiber)
        } else {
          // Core NATS pub/sub via Holonet NatsPubSubService
          const pubsubStream = yield* pubsub.subscribe(subject, RawPayload)

          const fiber = yield* Effect.fork(
            Stream.runForEach(pubsubStream, (msg) =>
              Effect.gen(function* () {
                if (paused) return

                const signal: BaseSignal = {
                  id: generateSignalId('nats') as any,
                  sourceId: config.sourceId as any,
                  timestamp: new Date(),
                  version: [0, 0] as [number, number],
                  kind: 'nats',
                  payload: {
                    subject: msg.subject,
                    data: msg.data,
                    replyTo: msg.reply,
                  },
                }

                yield* internals.push(signal)
              }),
            ),
          )
          consumerFibers.push(fiber)
        }
      }

      internals.updateHealth({ status: 'connected' })
      yield* Effect.log(
        `[NatsSourceAdapter] Subscribed to ${config.subjects.length} subject(s)` +
        (config.jetstream ? ` (JetStream: ${config.streamName})` : ' (core NATS)'),
      )

      // Cleanup on scope close: interrupt all consumer fibers
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          for (const fiber of consumerFibers) {
            yield* Fiber.interrupt(fiber)
          }
          internals.updateHealth({ status: 'disconnected' })
          yield* Effect.log(`[NatsSourceAdapter] Disconnected: ${config.adapterId}`)
        }),
      )

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: 'nats',
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        pause: Effect.sync(() => { paused = true }),
        resume: Effect.sync(() => { paused = false }),
      } satisfies SourceAdapterShape
    }),
    dependencies: [NatsPubSubService.Default, NatsStreamService.Default],
  },
) {}

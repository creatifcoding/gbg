/**
 * MidiSourceAdapter — Effect.Service STUB.
 *
 * Correct service shape. connect() logs. Swap for real implementation later.
 * Will use Holonet bridge pattern (sidecar reads MIDI, publishes to NATS).
 *
 * @module tsingou-flow/adapters/MidiAdapter
 */

import { Effect, Context, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'
import type { SourceAdapterShape } from './types'
import { makeAdapterInternals, SignalQueueTag } from './types'

export const MidiAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
})
export type MidiAdapterConfig = typeof MidiAdapterConfig.Type

export class MidiAdapterConfigTag extends Context.Tag('tsingou/adapter/MidiConfig')<
  MidiAdapterConfigTag,
  MidiAdapterConfig
>() {}

export class MidiSourceAdapter extends Effect.Service<MidiSourceAdapter>()(
  'tsingou/adapter/Midi',
  {
    scoped: Effect.gen(function* () {
      const config = yield* MidiAdapterConfigTag
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, 'midi')

      internals.updateHealth({ status: 'connected' })
      yield* Effect.log(
        `[MidiSourceAdapter:${config.adapterId}] STUB — no real MIDI connection. ` +
        `Use HolonetBridgeAdapter with kind:"midi" for sidecar-based MIDI.`,
      )

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => internals.updateHealth({ status: 'disconnected' })),
      )

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: 'midi',
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        pause: Effect.void,
        resume: Effect.void,
      } satisfies SourceAdapterShape
    }),
  },
) {}

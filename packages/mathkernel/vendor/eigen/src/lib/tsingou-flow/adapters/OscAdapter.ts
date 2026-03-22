/**
 * OscSourceAdapter — Effect.Service STUB.
 *
 * Correct service shape. connect() logs. Swap for real implementation later.
 * Will use Holonet bridge pattern (sidecar runs osc.js UDP, publishes to NATS).
 *
 * @module tsingou-flow/adapters/OscAdapter
 */

import { Effect, Context, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'
import type { SourceAdapterShape } from './types'
import { makeAdapterInternals, SignalQueueTag } from './types'

export const OscAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
})
export type OscAdapterConfig = typeof OscAdapterConfig.Type

export class OscAdapterConfigTag extends Context.Tag('tsingou/adapter/OscConfig')<
  OscAdapterConfigTag,
  OscAdapterConfig
>() {}

export class OscSourceAdapter extends Effect.Service<OscSourceAdapter>()(
  'tsingou/adapter/Osc',
  {
    scoped: Effect.gen(function* () {
      const config = yield* OscAdapterConfigTag
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, 'osc')

      internals.updateHealth({ status: 'connected' })
      yield* Effect.log(
        `[OscSourceAdapter:${config.adapterId}] STUB — no real OSC connection. ` +
        `Use HolonetBridgeAdapter with kind:"osc" for sidecar-based OSC.`,
      )

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => internals.updateHealth({ status: 'disconnected' })),
      )

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: 'osc',
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        pause: Effect.void,
        resume: Effect.void,
      } satisfies SourceAdapterShape
    }),
  },
) {}

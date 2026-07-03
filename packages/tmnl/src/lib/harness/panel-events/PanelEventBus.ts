import { Context, Effect, Layer, PubSub, Stream } from 'effect'
import type { PanelEvent } from '@/lib/genifer/harness/panel-events'

export interface PanelEventBusShape {
  readonly events: Stream.Stream<PanelEvent>
  readonly emit: (event: PanelEvent) => Effect.Effect<void>
}

export class PanelEventBus extends Context.Tag('tmnl/harness/PanelEventBus')<
  PanelEventBus,
  PanelEventBusShape
>() {}

export const PanelEventBusLive = Layer.effect(
  PanelEventBus,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<PanelEvent>()

    const events = Stream.fromPubSub(pubsub)
    const emit = (event: PanelEvent) => PubSub.publish(pubsub, event).pipe(Effect.asVoid)

    return PanelEventBus.of({ events, emit })
  }),
)

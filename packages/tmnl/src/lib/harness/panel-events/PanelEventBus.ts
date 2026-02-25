import { Context, Effect, Layer, Stream } from 'effect'
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
    type EmitFn = { single: (event: PanelEvent) => void }
    let globalEmit: EmitFn | null = null

    const events = Stream.asyncPush<PanelEvent>((emit) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          globalEmit = { single: emit.single }
          return globalEmit
        }),
        () => Effect.sync(() => {
          globalEmit = null
        }),
      ),
    )

    const emit = (event: PanelEvent) =>
      Effect.sync(() => {
        globalEmit?.single(event)
      })

    return PanelEventBus.of({ events, emit })
  }),
)

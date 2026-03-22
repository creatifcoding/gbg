import { describe, it, expect } from 'bun:test'
import { Effect, Fiber, Stream } from 'effect'
import { PanelEventBus, PanelEventBusLive } from '../panel-events/PanelEventBus'

describe('PanelEventBus', () => {
  it('emits events to subscribers', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const bus = yield* PanelEventBus

        const consumer = yield* Stream.runHead(
          Stream.take(bus.events, 1),
        ).pipe(Effect.fork)

        // ensure subscriber acquisition has run before emit
        yield* Effect.sleep('10 millis')

        yield* bus.emit({
          _tag: 'panel:spawned',
          surfaceId: 'surf-1',
          panelId: 'panel-1',
          mode: 'floating',
        } as any)

        const first = yield* Fiber.join(consumer)
        expect(first._tag).toBe('Some')
        if (first._tag === 'Some') {
          expect((first.value as any)._tag).toBe('panel:spawned')
          expect((first.value as any).surfaceId).toBe('surf-1')
        }
      }).pipe(
        Effect.provide(PanelEventBusLive),
      ),
    )
  })
})

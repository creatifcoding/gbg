import { describe, it, expect } from 'vitest'
import { Chunk, Effect, Option, Queue, Stream } from 'effect'
import {
  ChannelService,
  ChannelServiceLive,
} from '../../constructs/ChannelService'
import { ChannelBuilder } from '../../constructs/ChannelBuilder'
import type { InletId, OutletId } from '../../constructs/Channel'

describe('Channel runtime end-to-end', () => {
  it('processes full inlet -> junction chain -> outlet flow with observability signals', () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const channelId = yield* service.register(
        ChannelBuilder.create('e2e-channel-runtime')
          .inlet('raw')
          .junction('double', {
            kind: 'map',
            config: { map: (value: unknown) => Number(value) * 2 },
          })
          .junction('gteSix', {
            kind: 'filter',
            config: { predicate: (value: unknown) => Number(value) >= 6 },
          })
          .outlet('processed', { broadcast: true })
          .wire('raw', 'double')
          .wire('double', 'gteSix')
          .wire('gteSix', 'processed')
      )

      const inletId = `${channelId}:inlet:raw` as InletId
      const outletId = `${channelId}:outlet:processed` as OutletId

      const eventQueue = yield* service.subscribeEvents()
      yield* service.open(channelId)

      const outletQueue = yield* service.subscribeOutlet<number>(channelId, outletId)

      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3, 4, 5]))

      const collected = yield* Effect.forEach([0, 1, 2], () => Queue.take(outletQueue), {
        concurrency: 1,
      })
      expect(collected).toEqual([6, 8, 10])

      yield* Effect.sleep('20 millis')
      const events = yield* Queue.takeUpTo(eventQueue, 10)
      const eventTags = Chunk.toReadonlyArray(events).map((event) => event._tag)
      expect(eventTags).toContain('ChannelOpened')
      expect(eventTags).toContain('InletConnected')

      const metrics = yield* service.getMetrics(channelId)
      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBe(5)
        expect(metrics.value.messagesOut).toBe(3)
        expect(metrics.value.errors).toBe(0)
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(ChannelServiceLive),
      Effect.runPromise
    ))
})

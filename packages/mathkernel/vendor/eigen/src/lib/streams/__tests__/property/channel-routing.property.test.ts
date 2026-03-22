import { describe, it, expect } from 'vitest'
import { Effect, FastCheck as fc, Option, Queue, Stream } from 'effect'
import { ChannelService, ChannelServiceLive } from '../../constructs/ChannelService'
import { ChannelBuilder } from '../../constructs/ChannelBuilder'
import type { InletId, OutletId } from '../../constructs/Channel'

const runMapCase = (values: ReadonlyArray<number>, factor: number) =>
  Effect.gen(function* () {
    const service = yield* ChannelService

    const builder = ChannelBuilder.create(`prop-map-${Math.abs(factor)}-${values.length}`)
      .inlet('in')
      .junction('map1', {
        kind: 'map',
        config: {
          map: (value: unknown) => Number(value) * factor,
        },
      })
      .outlet('out', { broadcast: true })
      .wire('in', 'map1')
      .wire('map1', 'out')

    const channelId = yield* service.register(builder)
    yield* service.open(channelId)

    const inletId = `${channelId}:inlet:in` as InletId
    const outletId = `${channelId}:outlet:out` as OutletId

    const queue = yield* service.subscribeOutlet<number>(channelId, outletId)

    yield* service.connectStream(channelId, inletId, Stream.fromIterable(values))

    if (values.length === 0) {
      const maybe = yield* Queue.poll(queue)
      expect(Option.isNone(maybe)).toBe(true)
      return
    }

    const collected = yield* Effect.forEach(values, () => Queue.take(queue), {
      concurrency: 1,
    })

    expect(collected).toEqual(values.map((value) => value * factor))
  }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive), Effect.runPromise)

const runBroadcastCase = (values: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    const service = yield* ChannelService

    const builder = ChannelBuilder.create(`prop-broadcast-${values.length}`)
      .inlet('in')
      .junction('fanout', { kind: 'broadcast' })
      .outlet('outA', { broadcast: true })
      .outlet('outB', { broadcast: true })
      .wire('in', 'fanout')
      .wire('fanout', 'outA')
      .wire('fanout', 'outB')

    const channelId = yield* service.register(builder)
    yield* service.open(channelId)

    const inletId = `${channelId}:inlet:in` as InletId
    const outA = `${channelId}:outlet:outA` as OutletId
    const outB = `${channelId}:outlet:outB` as OutletId

    const queueA = yield* service.subscribeOutlet<number>(channelId, outA)
    const queueB = yield* service.subscribeOutlet<number>(channelId, outB)

    yield* service.connectStream(channelId, inletId, Stream.fromIterable(values))

    const outACollected = yield* Effect.forEach(values, () => Queue.take(queueA), {
      concurrency: 1,
    })
    const outBCollected = yield* Effect.forEach(values, () => Queue.take(queueB), {
      concurrency: 1,
    })

    expect(outACollected).toEqual(values)
    expect(outBCollected).toEqual(values)
  }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive), Effect.runPromise)

describe('Channel routing properties', () => {
  it(
    'map junction preserves cardinality and transform law',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: -500, max: 500 }), { maxLength: 8 }),
          fc.integer({ min: -10, max: 10 }).filter((n) => n !== 0),
          async (values, factor) => {
            await runMapCase(values, factor)
            return true
          }
        ),
        { numRuns: 8 }
      )
    },
    20000
  )

  it(
    'broadcast junction duplicates payload to each outlet',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: -1000, max: 1000 }), {
            minLength: 1,
            maxLength: 8,
          }),
          async (values) => {
            await runBroadcastCase(values)
            return true
          }
        ),
        { numRuns: 6 }
      )
    },
    20000
  )
})

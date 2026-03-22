import { describe, it, expect } from 'vitest'
import { Chunk, Effect, Option, Queue, Stream } from 'effect'
import {
  ChannelService,
  ChannelServiceLive,
} from '@/lib/streams/constructs/ChannelService'
import { ChannelBuilder } from '@/lib/streams/constructs/ChannelBuilder'
import type { InletId, OutletId } from '@/lib/streams/constructs/Channel'
import { FlightPositionEvent } from '../../schemas/flight-events'

const flightEvent = (params: {
  icao24: string
  onGround: boolean
  altitudeM: number
}) => ({
  _tag: 'FlightPositionEvent' as const,
  icao24: params.icao24,
  source: 'opensky' as const,
  position: [-122.4194, 37.7749, params.altitudeM] as const,
  heading: 180,
  speed: 240,
  verticalRate: 2,
  callsign: 'TMNL123',
  squawk: '1200',
  onGround: params.onGround,
  observedAt: '2026-02-01T10:00:00.000Z',
  category: 'A3',
  originCountry: 'US',
})

describe('GEOINT + Channel integration', () => {
  it('routes FlightPositionEvent payloads through typed inlet and airborne filter', () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const channelId = yield* service.register(
        ChannelBuilder.create('geoint-flight-channel')
          .inlet('flight', { schema: FlightPositionEvent })
          .junction('airborneOnly', {
            kind: 'filter',
            config: {
              predicate: (value: unknown) =>
                typeof value === 'object' &&
                value !== null &&
                'onGround' in value &&
                (value as { readonly onGround: boolean }).onGround === false,
            },
          })
          .outlet('airborne', { broadcast: true })
          .wire('flight', 'airborneOnly')
          .wire('airborneOnly', 'airborne')
      )

      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:flight` as InletId
      const outletId = `${channelId}:outlet:airborne` as OutletId
      const queue = yield* service.subscribeOutlet<FlightPositionEvent>(channelId, outletId)
      const eventQueue = yield* service.subscribeEvents()

      const payloads = [
        flightEvent({ icao24: 'a1b2c3', onGround: false, altitudeM: 10668 }),
        flightEvent({ icao24: 'deadbe', onGround: true, altitudeM: 0 }),
        flightEvent({ icao24: 'cafe12', onGround: false, altitudeM: 9144 }),
      ]

      yield* service.connectStream(channelId, inletId, Stream.fromIterable(payloads))

      yield* Effect.sleep('20 millis')
      const emitted = yield* Queue.takeUpTo(queue, 3)
      const emittedValues = Chunk.toReadonlyArray(emitted)

      expect(emittedValues.length).toBe(2)
      const emittedIcaos = emittedValues.map((event) => event.icao24)
      expect(emittedIcaos).toEqual(['a1b2c3', 'cafe12'])

      const metrics = yield* service.getMetrics(channelId)
      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBe(3)
        expect(metrics.value.messagesOut).toBe(2)
        expect(metrics.value.errors).toBe(0)
      }

      const events = yield* Queue.takeUpTo(eventQueue, 10)
      const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)
      expect(tags).not.toContain('ChannelFaulted')
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive), Effect.runPromise))
})

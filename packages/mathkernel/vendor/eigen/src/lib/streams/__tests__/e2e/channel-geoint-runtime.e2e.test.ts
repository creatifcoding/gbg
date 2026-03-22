import { describe, it, expect } from 'vitest'
import { Chunk, Effect, Option, Queue, Stream } from 'effect'
import {
  ChannelService,
  ChannelServiceLive,
} from '../../constructs/ChannelService'
import { ChannelBuilder } from '../../constructs/ChannelBuilder'
import type { InletId, OutletId } from '../../constructs/Channel'
import { FlightPositionEvent } from '@/lib/geoint/schemas/flight-events'

const flightEvent = (params: {
  icao24: string
  altitudeM: number
  onGround: boolean
}) => ({
  _tag: 'FlightPositionEvent' as const,
  icao24: params.icao24,
  source: 'opensky' as const,
  position: [-118.2437, 34.0522, params.altitudeM] as const,
  onGround: params.onGround,
  observedAt: '2026-02-09T08:00:00.000Z',
})

describe('Channel GEOINT runtime end-to-end', () => {
  it('processes FlightPositionEvent inlet through map/filter chain with metrics and events', () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const channelId = yield* service.register(
        ChannelBuilder.create('e2e-channel-geoint')
          .inlet('flight', { schema: FlightPositionEvent })
          .junction('toSummary', {
            kind: 'map',
            config: {
              map: (value: unknown) => {
                const v = value as {
                  readonly icao24: string
                  readonly position: readonly [number, number, number]
                  readonly onGround: boolean
                }
                return {
                  icao24: v.icao24,
                  altitudeKm: Number((v.position[2] / 1000).toFixed(1)),
                  onGround: v.onGround,
                }
              },
            },
          })
          .junction('airborneHigh', {
            kind: 'filter',
            config: {
              predicate: (value: unknown) => {
                const v = value as { readonly altitudeKm: number; readonly onGround: boolean }
                return v.onGround === false && v.altitudeKm >= 9
              },
            },
          })
          .outlet('tracks', { broadcast: true })
          .wire('flight', 'toSummary')
          .wire('toSummary', 'airborneHigh')
          .wire('airborneHigh', 'tracks')
      )

      const inletId = `${channelId}:inlet:flight` as InletId
      const outletId = `${channelId}:outlet:tracks` as OutletId

      const eventQueue = yield* service.subscribeEvents()
      yield* service.open(channelId)

      const outletQueue = yield* service.subscribeOutlet<{
        readonly icao24: string
        readonly altitudeKm: number
        readonly onGround: boolean
      }>(channelId, outletId)

      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([
          flightEvent({ icao24: 'abc123', altitudeM: 10668, onGround: false }),
          flightEvent({ icao24: 'def456', altitudeM: 3000, onGround: false }),
          flightEvent({ icao24: 'cafe12', altitudeM: 9144, onGround: false }),
        ])
      )

      const emitted = yield* Effect.forEach([0, 1], () => Queue.take(outletQueue), {
        concurrency: 1,
      })
      expect(emitted.map((e) => e.icao24)).toEqual(['abc123', 'cafe12'])

      yield* Effect.sleep('20 millis')
      const events = yield* Queue.takeUpTo(eventQueue, 12)
      const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)
      expect(tags).toContain('ChannelOpened')
      expect(tags).toContain('InletConnected')
      expect(tags).not.toContain('ChannelFaulted')

      const metrics = yield* service.getMetrics(channelId)
      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBe(3)
        expect(metrics.value.messagesOut).toBe(2)
        expect(metrics.value.errors).toBe(0)
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive), Effect.runPromise))
})

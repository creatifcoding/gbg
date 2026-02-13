import { describe, it, expect } from 'vitest'
import { Effect, Layer, Option, Queue, Ref, Schema, Stream } from 'effect'
import {
  ChannelService,
  ChannelServiceLive,
} from '@/lib/streams/constructs/ChannelService'
import { ChannelBuilder } from '@/lib/streams/constructs/ChannelBuilder'
import type { ChannelId, InletId, OutletId } from '@/lib/streams/constructs/Channel'
import { TrackId, TrackPosition, TrackPositionUpdate } from '../../schemas'
import {
  TrackStore,
  TrackStoreError,
  type TrackStore as TrackStoreShape,
} from '../../persistence/TrackStore'
import {
  replayTrackStoreToChannelInlet,
  startTrackStoreSinkFromOutlet,
} from '../../streaming/TrackStoreChannelBridge'

const makeTrackPosition = (lat: number, lon: number, altitude = 1000) =>
  new TrackPosition({
    lat,
    lon,
    timestamp: new Date('2026-02-01T10:00:00.000Z'),
    heading: 90,
    speed: 220,
    altitude,
  })

const makeTrackUpdate = (trackId: string, lat: number) =>
  new TrackPositionUpdate({
    trackId: trackId as TrackId,
    position: makeTrackPosition(lat, -122.4194),
    eventTimestamp: new Date('2026-02-01T10:00:01.000Z'),
  })

const makeChannel = (id: string) =>
  ChannelBuilder.create(id)
    .inlet('track', { schema: TrackPositionUpdate })
    .outlet('persisted', { broadcast: true })
    .wire('track', 'persisted')

describe('GEOINT TrackStore channel bridge', () => {
  it('persists outlet updates into TrackStore sink', () =>
    Effect.gen(function* () {
      const channel = yield* ChannelService
      const appendedRef = yield* Ref.make(
        [] as ReadonlyArray<{ trackId: string; position: TrackPosition }>,
      )

      const trackStoreLayer = Layer.succeed(TrackStore, {
        appendTrackUpdate: (trackId, position) =>
          Ref.update(appendedRef, (entries) => [
            ...entries,
            { trackId: trackId as string, position },
          ]),
        appendTrackUpdates: (updates) =>
          Ref.update(appendedRef, (entries) => [
            ...entries,
            ...updates.map((update) => ({
              trackId: update.trackId as string,
              position: update.position,
            })),
          ]),
        replayTrack: () => Effect.succeed([]),
        subscribeTrack: () => Effect.succeed(Stream.empty),
        deleteTrack: () => Effect.void,
        trackExists: () => Effect.succeed(true),
        listTracks: () => Effect.succeed([]),
      } satisfies TrackStoreShape)

      const channelId = yield* channel.register(makeChannel('geoint-track-sink'))
      yield* channel.open(channelId)

      const inletId = `${channelId}:inlet:track` as InletId
      const outletId = `${channelId}:outlet:persisted` as OutletId

      yield* startTrackStoreSinkFromOutlet({ channelId, outletId }).pipe(
        Effect.provide(trackStoreLayer),
      )

      const encodedUpdate = Schema.encodeSync(TrackPositionUpdate)(
        makeTrackUpdate('abc123', 37.7749),
      )
      yield* channel.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([encodedUpdate]),
      )
      yield* Effect.sleep('20 millis')

      const appended = yield* Ref.get(appendedRef)
      expect(appended.length).toBe(1)
      expect(appended[0]?.trackId).toBe('abc123')
      expect(appended[0]?.position.lat).toBeCloseTo(37.7749)
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive), Effect.runPromise))

  it('replays durable TrackStore history into channel inlet/source', () =>
    Effect.gen(function* () {
      const channel = yield* ChannelService

      const replayEvents = [
        {
          _tag: 'TrackUpdateEvent' as const,
          trackId: 'abc123',
          position: {
            lat: 37.7749,
            lon: -122.4194,
            timestamp: '2026-02-01T10:00:00.000Z',
            heading: 90,
            speed: 220,
            altitude: 10668,
          },
          eventTimestamp: '2026-02-01T10:00:01.000Z',
        },
      ]

      const trackStoreLayer = Layer.succeed(TrackStore, {
        appendTrackUpdate: () => Effect.void,
        appendTrackUpdates: () => Effect.void,
        replayTrack: () => Effect.succeed(replayEvents),
        subscribeTrack: () => Effect.succeed(Stream.empty),
        deleteTrack: () => Effect.void,
        trackExists: () => Effect.succeed(true),
        listTracks: () => Effect.succeed(['abc123' as TrackId]),
      } satisfies TrackStoreShape)

      const channelId = yield* channel.register(makeChannel('geoint-track-source'))
      yield* channel.open(channelId)

      const inletId = `${channelId}:inlet:track` as InletId
      const outletId = `${channelId}:outlet:persisted` as OutletId
      const queue = yield* channel.subscribeOutlet<TrackPositionUpdate>(channelId, outletId)

      const replayed = yield* replayTrackStoreToChannelInlet({
        channelId: channelId as ChannelId,
        inletId,
        trackId: 'abc123' as TrackId,
      }).pipe(Effect.provide(trackStoreLayer))

      expect(replayed).toBe(1)

      yield* Effect.sleep('20 millis')
      const maybeRouted = yield* Queue.poll(queue)
      expect(Option.isSome(maybeRouted)).toBe(true)
      if (Option.isSome(maybeRouted)) {
        expect(maybeRouted.value.trackId).toBe('abc123')
        expect(maybeRouted.value.position.altitude).toBe(10668)
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive), Effect.runPromise))
})

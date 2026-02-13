import { Effect, Queue, Schema, Scope, Stream } from 'effect'
import {
  ChannelId,
  InletId,
  OutletId,
  type ChannelServiceError,
  ChannelService,
} from '@/lib/streams/constructs'
import { TrackId, TrackPosition, TrackPositionUpdate } from '../schemas'
import {
  TrackStore,
  TrackStoreError,
} from '../persistence/TrackStore'

export const TrackStoreSinkConfig = Schema.Struct({
  channelId: ChannelId,
  outletId: OutletId,
})
export type TrackStoreSinkConfig = typeof TrackStoreSinkConfig.Type

export const TrackStoreSourceConfig = Schema.Struct({
  channelId: ChannelId,
  inletId: InletId,
  trackId: TrackId,
})
export type TrackStoreSourceConfig = typeof TrackStoreSourceConfig.Type

/**
 * Start a scoped sink that persists TrackPositionUpdate values from a channel outlet into TrackStore.
 */
export const startTrackStoreSinkFromOutlet = (
  config: TrackStoreSinkConfig,
): Effect.Effect<void, ChannelServiceError | TrackStoreError, ChannelService | TrackStore | Scope.Scope> =>
  Effect.gen(function* () {
    const channel = yield* ChannelService
    const store = yield* TrackStore

    const queue = yield* channel.subscribeOutlet<TrackPositionUpdate>(
      config.channelId,
      config.outletId,
      `trackstore-sink:${String(config.channelId)}`,
    )

    yield* Effect.forever(
      Queue.take(queue).pipe(
        Effect.flatMap((update) =>
          store.appendTrackUpdate(update.trackId, update.position),
        ),
      ),
    ).pipe(Effect.forkScoped, Effect.asVoid)
  })

/**
 * Replay a track's durable history into a channel inlet as TrackPositionUpdate events.
 */
export const replayTrackStoreToChannelInlet = (
  config: TrackStoreSourceConfig,
): Effect.Effect<number, ChannelServiceError | TrackStoreError, ChannelService | TrackStore> =>
  Effect.gen(function* () {
    const channel = yield* ChannelService
    const store = yield* TrackStore

    const persistedEvents = yield* store.replayTrack(config.trackId)

    const encodedUpdates = persistedEvents.map((event) =>
      Schema.encodeSync(TrackPositionUpdate)(
        new TrackPositionUpdate({
          trackId: event.trackId as TrackId,
          position: new TrackPosition({
            lat: event.position.lat,
            lon: event.position.lon,
            timestamp: new Date(event.position.timestamp),
            heading: event.position.heading,
            speed: event.position.speed,
            altitude: event.position.altitude,
          }),
          eventTimestamp: new Date(event.eventTimestamp),
        }),
      ),
    )

    yield* channel.connectStream(
      config.channelId,
      config.inletId,
      Stream.fromIterable(encodedUpdates),
      `trackstore:${config.trackId}:replay`,
    )

    return encodedUpdates.length
  })

/**
 * Stream a track's live updates from TrackStore into a channel inlet as TrackPositionUpdate events.
 */
export const streamTrackStoreToChannelInlet = (
  config: TrackStoreSourceConfig,
): Effect.Effect<void, ChannelServiceError | TrackStoreError, ChannelService | TrackStore | Scope.Scope> =>
  Effect.gen(function* () {
    const channel = yield* ChannelService
    const store = yield* TrackStore

    const source = yield* store.subscribeTrack(config.trackId)

    const encodedUpdates = source.pipe(
      Stream.map((event) =>
        Schema.encodeSync(TrackPositionUpdate)(
          new TrackPositionUpdate({
            trackId: event.trackId as TrackId,
            position: new TrackPosition({
              lat: event.position.lat,
              lon: event.position.lon,
              timestamp: new Date(event.position.timestamp),
              heading: event.position.heading,
              speed: event.position.speed,
              altitude: event.position.altitude,
            }),
            eventTimestamp: new Date(event.eventTimestamp),
          }),
        ),
      ),
    )

    yield* channel.connectStream(
      config.channelId,
      config.inletId,
      encodedUpdates,
      `trackstore:${config.trackId}:live`,
    )
  })

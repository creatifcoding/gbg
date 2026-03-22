/**
 * Phoenix Replay Coordinator Service
 *
 * Enforces replay acknowledgement gating before live dispatch.
 *
 * @module holonet/phoenix/services/PhoenixReplayCoordinator
 */

import { Atom, Registry } from '@effect-atom/atom';
import { Context, Effect, Layer } from 'effect';
import type { PhoenixEnvelope } from '../schemas/envelope';
import type { SessionSnapshot } from '../schemas/protocol';
import { PhoenixErrors } from '../schemas/errors';

export interface PhoenixReplayConfigShape {
  readonly maxLiveBuffer: number;
  readonly overflowPolicy: 'drop-oldest' | 'drop-newest' | 'fail-session';
}

export const PhoenixReplayConfig = Context.GenericTag<PhoenixReplayConfigShape>(
  'holonet/phoenix/PhoenixReplayConfig',
);

export const PhoenixReplayConfigDefault = Layer.succeed(PhoenixReplayConfig, {
  maxLiveBuffer: 512,
  overflowPolicy: 'drop-oldest',
} satisfies PhoenixReplayConfigShape);

export interface PhoenixReplayCoordinatorShape {
  readonly enterJoining: (
    topic: string,
    clientSessionId: string,
    lastSeenEventId: string | null,
  ) => Effect.Effect<void>;
  readonly markReplayRequired: (replaySessionId: string) => Effect.Effect<void>;
  readonly markAwaitingAck: () => Effect.Effect<void>;
  readonly markLive: () => Effect.Effect<void>;
  readonly markFailed: (reason?: string) => Effect.Effect<void>;
  readonly resetIdle: () => Effect.Effect<void>;
  readonly applyReplayBatch: (events: ReadonlyArray<PhoenixEnvelope>) => Effect.Effect<void>;
  readonly bufferLiveEvent: (
    event: PhoenixEnvelope,
  ) => Effect.Effect<void, PhoenixErrors.BufferOverflowError>;
  readonly ackSucceeded: (
    upToEventId: string,
  ) => Effect.Effect<ReadonlyArray<PhoenixEnvelope>>;
  readonly recordLastSeenEvent: (eventId: string) => Effect.Effect<void>;
  readonly canDispatchLive: Effect.Effect<boolean>;
  readonly snapshot: Effect.Effect<SessionSnapshot>;
}

export class PhoenixReplayCoordinator extends Effect.Service<PhoenixReplayCoordinator>()(
  'holonet/phoenix/PhoenixReplayCoordinator',
  {
    effect: Effect.gen(function* () {
      const config = yield* PhoenixReplayConfig;

      const snapshotAtom = Atom.make<SessionSnapshot>({
        state: 'idle',
        topic: null,
        client_session_id: 'unset',
        last_seen_event_id: null,
        replay_session_id: null,
        reconnect_attempt: 0,
        can_dispatch_live: false,
      });

      const bufferedLiveAtom = Atom.make<ReadonlyArray<PhoenixEnvelope>>([]);
      const registry = Registry.make();

      const updateSnapshot = (f: (current: SessionSnapshot) => SessionSnapshot): void => {
        const current = registry.get(snapshotAtom);
        registry.set(snapshotAtom, f(current));
      };

      const enterJoining: PhoenixReplayCoordinatorShape['enterJoining'] = (
        topic,
        clientSessionId,
        lastSeenEventId,
      ) =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            state: 'joining',
            topic,
            client_session_id: clientSessionId,
            last_seen_event_id: lastSeenEventId,
            replay_session_id: null,
            can_dispatch_live: false,
          }));
          registry.set(bufferedLiveAtom, []);
        });

      const markReplayRequired: PhoenixReplayCoordinatorShape['markReplayRequired'] = (
        replaySessionId,
      ) =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            state: 'replay_buffering_live',
            replay_session_id: replaySessionId,
            can_dispatch_live: false,
          }));
        });

      const markAwaitingAck: PhoenixReplayCoordinatorShape['markAwaitingAck'] = () =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            state: 'awaiting_ack',
            can_dispatch_live: false,
          }));
        });

      const markLive: PhoenixReplayCoordinatorShape['markLive'] = () =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            state: 'live',
            can_dispatch_live: true,
          }));
        });

      const markFailed: PhoenixReplayCoordinatorShape['markFailed'] = (_reason?: string) =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            state: 'failed',
            can_dispatch_live: false,
          }));
        });

      const resetIdle: PhoenixReplayCoordinatorShape['resetIdle'] = () =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            state: 'idle',
            replay_session_id: null,
            can_dispatch_live: false,
          }));
          registry.set(bufferedLiveAtom, []);
        });

      const applyReplayBatch: PhoenixReplayCoordinatorShape['applyReplayBatch'] = (events) =>
        Effect.sync(() => {
          if (events.length === 0) {
            return;
          }

          const last = events[events.length - 1];
          updateSnapshot((current) => ({
            ...current,
            last_seen_event_id: last.event_id,
          }));
        });

      const recordLastSeenEvent: PhoenixReplayCoordinatorShape['recordLastSeenEvent'] = (
        eventId,
      ) =>
        Effect.sync(() => {
          updateSnapshot((current) => ({
            ...current,
            last_seen_event_id: eventId,
          }));
        });

      const bufferLiveEvent: PhoenixReplayCoordinatorShape['bufferLiveEvent'] = (event) =>
        Effect.gen(function* () {
          const existing = registry.get(bufferedLiveAtom);

          if (existing.length < config.maxLiveBuffer) {
            registry.set(bufferedLiveAtom, [...existing, event]);
            return;
          }

          if (config.overflowPolicy === 'drop-oldest') {
            registry.set(bufferedLiveAtom, [...existing.slice(1), event]);
            return;
          }

          if (config.overflowPolicy === 'drop-newest') {
            return;
          }

          yield* markFailed('buffer_overflow');
          return yield* Effect.fail(
            new PhoenixErrors.BufferOverflowError({
              maxBuffer: config.maxLiveBuffer,
              policy: config.overflowPolicy,
            }),
          );
        });

      const ackSucceeded: PhoenixReplayCoordinatorShape['ackSucceeded'] = (upToEventId) =>
        Effect.sync(() => {
          const buffered = registry.get(bufferedLiveAtom);

          updateSnapshot((current) => ({
            ...current,
            state: 'live',
            can_dispatch_live: true,
            last_seen_event_id: upToEventId,
          }));

          registry.set(bufferedLiveAtom, []);
          return buffered;
        });

      const canDispatchLive: PhoenixReplayCoordinatorShape['canDispatchLive'] = Effect.sync(
        () => registry.get(snapshotAtom).can_dispatch_live,
      );

      const snapshot: PhoenixReplayCoordinatorShape['snapshot'] = Effect.sync(() =>
        registry.get(snapshotAtom),
      );

      return {
        enterJoining,
        markReplayRequired,
        markAwaitingAck,
        markLive,
        markFailed,
        resetIdle,
        applyReplayBatch,
        bufferLiveEvent,
        ackSucceeded,
        recordLastSeenEvent,
        canDispatchLive,
        snapshot,
      } satisfies PhoenixReplayCoordinatorShape;
    }),
    dependencies: [PhoenixReplayConfigDefault],
  },
) {}

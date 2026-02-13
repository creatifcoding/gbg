/**
 * Phoenix Channel Session Service
 *
 * @module holonet/phoenix/services/PhoenixChannelSession
 */

import { Atom, Registry } from '@effect-atom/atom';
import {
  Context,
  Effect,
  Layer,
  PubSub,
  Schedule,
  Schema,
  Stream,
} from 'effect';
import {
  type PhoenixEnvelope,
  PhoenixEnvelope as PhoenixEnvelopeSchema,
  type JoinReply,
  JoinReply as JoinReplySchema,
  type ReplayAckRequest,
  ReplayAckRequest as ReplayAckRequestSchema,
  type ReplayAckResponse,
  ReplayAckResponse as ReplayAckResponseSchema,
  type SessionSnapshot,
} from '../schemas';
import { PhoenixErrors } from '../schemas/errors';
import {
  PhoenixAuthTokenProvider,
  TmnlAuthTokenServiceMissingLayer,
} from './PhoenixAuthTokenProvider';
import { PhoenixReplayCoordinator } from './PhoenixReplayCoordinator';
import { PhoenixJsTransport } from '../transport/PhoenixJsTransport';

export interface PhoenixChannelSessionConfigShape {
  readonly url: string;
  readonly topic: string;
  readonly params?: Record<string, unknown>;
  readonly replayRequired: boolean;
  readonly clientSessionId: string;
  readonly joinTimeoutMs: number;
  readonly pushTimeoutMs: number;
  readonly autoReconnect: boolean;
  readonly reconnectIntervalMs: number;
  readonly maxReconnectAttempts: number;
}

export const PhoenixChannelSessionConfig = Context.GenericTag<PhoenixChannelSessionConfigShape>(
  'holonet/phoenix/PhoenixChannelSessionConfig',
);

const createClientSessionId = (): string =>
  `hpx-${Math.random().toString(36).slice(2, 10)}`;

export const PhoenixChannelSessionConfigDefault = Layer.succeed(
  PhoenixChannelSessionConfig,
  {
    url: 'ws://127.0.0.1:4000/socket/websocket?vsn=2.0.0',
    topic: 'ava:workspace:default',
    params: {},
    replayRequired: true,
    clientSessionId: createClientSessionId(),
    joinTimeoutMs: 5_000,
    pushTimeoutMs: 5_000,
    autoReconnect: true,
    reconnectIntervalMs: 750,
    maxReconnectAttempts: 5,
  } satisfies PhoenixChannelSessionConfigShape,
);

export interface PhoenixChannelSessionMetrics {
  readonly connectAttemptTotal: number;
  readonly connectSuccessTotal: number;
  readonly connectFailureTotal: number;
  readonly rejoinTotal: number;
  readonly replayRequiredTotal: number;
  readonly replayAckSuccessTotal: number;
  readonly replayAckFailureTotal: number;
  readonly liveEventBufferedTotal: number;
  readonly liveEventDispatchedTotal: number;
  readonly reconnectManualTotal: number;
}

export interface PhoenixChannelSessionShape {
  readonly connect: (
    overrides?: Partial<PhoenixChannelSessionConfigShape>,
  ) => Effect.Effect<void, PhoenixErrors.Error>;
  readonly disconnect: () => Effect.Effect<void, never>;
  readonly reconnectNow: () => Effect.Effect<void, PhoenixErrors.Error>;
  readonly publish: (event: PhoenixEnvelope) => Effect.Effect<void, PhoenixErrors.Error>;
  readonly ping: (payload?: Record<string, unknown>) => Effect.Effect<void, PhoenixErrors.Error>;
  readonly snapshot: Effect.Effect<SessionSnapshot>;
  readonly metrics: Effect.Effect<PhoenixChannelSessionMetrics>;
  readonly events: Stream.Stream<PhoenixEnvelope, never>;
}

export class PhoenixChannelSession extends Effect.Service<PhoenixChannelSession>()(
  'holonet/phoenix/PhoenixChannelSession',
  {
    scoped: Effect.gen(function* () {
      const baseConfig = yield* PhoenixChannelSessionConfig;
      const transport = yield* PhoenixJsTransport;
      const auth = yield* PhoenixAuthTokenProvider;
      const replay = yield* PhoenixReplayCoordinator;
      const eventsPubSub = yield* PubSub.unbounded<PhoenixEnvelope>();

      const configAtom = Atom.make<PhoenixChannelSessionConfigShape>(baseConfig);
      let activeConfig: PhoenixChannelSessionConfigShape = baseConfig;
      const reconnectAttemptAtom = Atom.make<number>(0);
      const autoReconnectAtom = Atom.make<boolean>(baseConfig.autoReconnect);
      const metricsAtom = Atom.make<PhoenixChannelSessionMetrics>({
        connectAttemptTotal: 0,
        connectSuccessTotal: 0,
        connectFailureTotal: 0,
        rejoinTotal: 0,
        replayRequiredTotal: 0,
        replayAckSuccessTotal: 0,
        replayAckFailureTotal: 0,
        liveEventBufferedTotal: 0,
        liveEventDispatchedTotal: 0,
        reconnectManualTotal: 0,
      });
      const registry = Registry.make();

      const incrementMetric = (key: keyof PhoenixChannelSessionMetrics, by = 1): void => {
        const current = registry.get(metricsAtom);
        registry.set(metricsAtom, {
          ...current,
          [key]: current[key] + by,
        });
      };

      const workspaceIdFromTopic = (topic: string): string | null => {
        const parts = topic.split(':');
        return parts.length >= 3 ? parts[2] : null;
      };

      const publishEnvelope = (envelope: PhoenixEnvelope): Effect.Effect<void> =>
        Effect.gen(function* () {
          yield* replay.recordLastSeenEvent(envelope.event_id);
          yield* PubSub.publish(eventsPubSub, envelope);
          yield* Effect.sync(() => {
            incrementMetric('liveEventDispatchedTotal');
          });

          const snapshot = yield* replay.snapshot;
          yield* Effect.logDebug('holonet.phoenix.live.event', {
            workspace_id: envelope.workspace_id,
            topic: snapshot.topic,
            client_session_id: snapshot.client_session_id,
            replay_session_id: snapshot.replay_session_id,
            last_seen_event_id: snapshot.last_seen_event_id,
            event_id: envelope.event_id,
            correlation_id: envelope.event_id,
          });
        }).pipe(Effect.asVoid);

      const handleIncomingEnvelope = (payload: unknown): Effect.Effect<void, PhoenixErrors.Error> =>
        Effect.gen(function* () {
          const envelope = yield* Schema.decodeUnknown(PhoenixEnvelopeSchema)(payload).pipe(
            Effect.mapError(
              (cause) =>
                new PhoenixErrors.TransportError({
                  message: 'Failed to decode inbound phoenix envelope',
                  code: 'replay_decode_failed',
                  cause,
                }),
            ),
          );

          const canDispatchLive = yield* replay.canDispatchLive;
          if (canDispatchLive) {
            yield* publishEnvelope(envelope);
            return;
          }

          yield* replay.bufferLiveEvent(envelope);
          yield* Effect.sync(() => {
            incrementMetric('liveEventBufferedTotal');
          });
        });

      const runReplayHandshake = (
        config: PhoenixChannelSessionConfigShape,
        joinReply: JoinReply,
      ): Effect.Effect<void, PhoenixErrors.Error> =>
        Effect.gen(function* () {
          if (joinReply.mode === 'live' || joinReply.requires_ack === false) {
            yield* replay.markLive();
            return;
          }

          yield* Effect.sync(() => {
            incrementMetric('replayRequiredTotal');
          });

          yield* replay.markReplayRequired(joinReply.replay_session_id);
          yield* replay
            .applyReplayBatch(joinReply.events)
            .pipe(Effect.withSpan('holonet.phoenix.replay.apply'));

          for (const replayEvent of joinReply.events) {
            yield* publishEnvelope(replayEvent);
          }

          yield* replay.markAwaitingAck();

          const upToEventId = joinReply.cursor.to ??
            (joinReply.events.length > 0
              ? joinReply.events[joinReply.events.length - 1].event_id
              : '');

          const ackRequest: ReplayAckRequest = {
            replay_session_id: joinReply.replay_session_id,
            up_to_event_id: upToEventId,
            client_session_id: config.clientSessionId,
          };

          const validatedAckRequest = yield* Schema.decodeUnknown(ReplayAckRequestSchema)(ackRequest).pipe(
            Effect.mapError(
              (cause) =>
                new PhoenixErrors.TransportError({
                  message: 'Replay ack request failed schema validation',
                  code: 'replay_apply_failed',
                  cause,
                }),
            ),
          );

          const ackRaw = yield* transport.push('replay_ack', validatedAckRequest, config.pushTimeoutMs);
          const ackResponse = yield* Schema.decodeUnknown(ReplayAckResponseSchema)(ackRaw).pipe(
            Effect.mapError(
              (cause) =>
                new PhoenixErrors.TransportError({
                  message: 'Replay ack response decode failed',
                  code: 'replay_decode_failed',
                  cause,
                }),
            ),
          );

          const ack = ackResponse as ReplayAckResponse;
          if (!ack.ok) {
            yield* Effect.sync(() => {
              incrementMetric('replayAckFailureTotal');
            });
            return yield* Effect.fail(
              new PhoenixErrors.ReplayAckRejectedError({
                message: ack.reason ?? 'Replay acknowledgement rejected',
                replaySessionId: joinReply.replay_session_id,
              }),
            );
          }

          yield* Effect.sync(() => {
            incrementMetric('replayAckSuccessTotal');
          });

          const bufferedLive = yield* replay.ackSucceeded(validatedAckRequest.up_to_event_id);
          for (const buffered of bufferedLive) {
            yield* publishEnvelope(buffered);
          }
        }).pipe(Effect.withSpan('holonet.phoenix.replay.ack'));

      const connectOnce = (config: PhoenixChannelSessionConfigShape): Effect.Effect<void, PhoenixErrors.Error> =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            incrementMetric('connectAttemptTotal');
          });

          const sessionSnapshot = yield* replay.snapshot;
          const token = yield* auth.getToken;

          yield* replay.enterJoining(
            config.topic,
            config.clientSessionId,
            sessionSnapshot.last_seen_event_id,
          );

          yield* transport.connect({
            url: config.url,
            topic: config.topic,
            authToken: token,
            params: {
              ...(config.params ?? {}),
              last_seen_event_id: sessionSnapshot.last_seen_event_id,
              client_session_id: config.clientSessionId,
              replay_required: config.replayRequired,
            },
            timeoutMs: config.joinTimeoutMs,
            onClosed: () => {
              if (!registry.get(autoReconnectAtom)) return;
              void Effect.runPromise(
                Effect.gen(function* () {
                  yield* replay.markFailed('transport_closed');
                }),
              );
            },
            onErrored: () => {
              if (!registry.get(autoReconnectAtom)) return;
              void Effect.runPromise(
                Effect.gen(function* () {
                  yield* replay.markFailed('transport_closed');
                }),
              );
            },
          });

          yield* transport.on('ava_event', (payload) => {
            void Effect.runPromise(
              handleIncomingEnvelope(payload).pipe(
                Effect.catchAll((error) => replay.markFailed(error._tag).pipe(Effect.asVoid)),
              ),
            );
          });

          const joinRaw = yield* transport
            .join(config.joinTimeoutMs)
            .pipe(Effect.withSpan('holonet.phoenix.join'));
          const joinReply = yield* Schema.decodeUnknown(JoinReplySchema)(joinRaw).pipe(
            Effect.mapError(
              (cause) =>
                new PhoenixErrors.JoinError({
                  message: 'Phoenix join reply failed schema validation',
                  cause,
                }),
            ),
          );

          yield* runReplayHandshake(config, joinReply);
          registry.set(reconnectAttemptAtom, 0);
          yield* Effect.sync(() => {
            incrementMetric('connectSuccessTotal');
          });
          const successSnapshot = yield* replay.snapshot;
          yield* Effect.logInfo('holonet.phoenix.connect.success', {
            workspace_id: workspaceIdFromTopic(config.topic),
            topic: config.topic,
            client_session_id: config.clientSessionId,
            replay_session_id: successSnapshot.replay_session_id,
            last_seen_event_id: successSnapshot.last_seen_event_id,
            event_id: null,
            correlation_id: successSnapshot.client_session_id,
          });
        }).pipe(Effect.withSpan('holonet.phoenix.connect'));

      const connect: PhoenixChannelSessionShape['connect'] = (overrides) =>
        Effect.gen(function* () {
          const config = {
            ...baseConfig,
            ...registry.get(configAtom),
            ...(overrides ?? {}),
          } satisfies PhoenixChannelSessionConfigShape;

          activeConfig = config;
          registry.set(configAtom, config);
          registry.set(autoReconnectAtom, config.autoReconnect);

          const retrySchedule = Schedule.exponential(`${config.reconnectIntervalMs} millis`).pipe(
            Schedule.jittered,
          );

          const run = config.autoReconnect
            ? connectOnce(config).pipe(
                config.maxReconnectAttempts > 0
                  ? Effect.retry({
                      schedule: retrySchedule,
                      times: config.maxReconnectAttempts,
                    })
                  : Effect.retry(retrySchedule),
                Effect.withSpan('holonet.phoenix.reconnect.auto'),
              )
            : connectOnce(config);

          yield* run.pipe(
            Effect.tapError((error) =>
              Effect.gen(function* () {
                yield* Effect.sync(() => {
                  registry.set(reconnectAttemptAtom, registry.get(reconnectAttemptAtom) + 1);
                  incrementMetric('connectFailureTotal');
                });
                const failureSnapshot = yield* replay.snapshot;
                yield* Effect.logWarning('holonet.phoenix.connect.failure', {
                  workspace_id: workspaceIdFromTopic(config.topic),
                  topic: config.topic,
                  client_session_id: config.clientSessionId,
                  replay_session_id: failureSnapshot.replay_session_id,
                  last_seen_event_id: failureSnapshot.last_seen_event_id,
                  event_id: null,
                  correlation_id: failureSnapshot.client_session_id,
                  error_tag: (error as { _tag?: unknown })._tag ?? 'unknown',
                });
              }),
            ),
          );
        });

      const disconnect: PhoenixChannelSessionShape['disconnect'] = () =>
        Effect.gen(function* () {
          registry.set(autoReconnectAtom, false);
          yield* transport
            .leave()
            .pipe(Effect.catchAll(() => Effect.succeed<void>(undefined)));
          yield* transport.disconnect();
          yield* replay.resetIdle();
        });

      const reconnectNow: PhoenixChannelSessionShape['reconnectNow'] = () =>
        Effect.gen(function* () {
          const config = activeConfig;
          registry.set(autoReconnectAtom, true);
          yield* Effect.sync(() => {
            incrementMetric('reconnectManualTotal');
            incrementMetric('rejoinTotal');
          });
          yield* disconnect();
          yield* connect({
            ...config,
            autoReconnect: true,
          });
        }).pipe(Effect.withSpan('holonet.phoenix.reconnect.manual'));

      const publish: PhoenixChannelSessionShape['publish'] = (event) =>
        Effect.gen(function* () {
          const validated = yield* Schema.decodeUnknown(PhoenixEnvelopeSchema)(event).pipe(
            Effect.mapError(
              (cause) =>
                new PhoenixErrors.TransportError({
                  message: 'Outbound envelope failed schema validation',
                  code: 'replay_apply_failed',
                  cause,
                }),
            ),
          );

          yield* transport.push('publish', { event: validated }, registry.get(configAtom).pushTimeoutMs);
        }).pipe(Effect.withSpan('holonet.phoenix.live.dispatch'));

      const ping: PhoenixChannelSessionShape['ping'] = (payload = {}) =>
        transport
          .push('ping', payload, registry.get(configAtom).pushTimeoutMs)
          .pipe(Effect.asVoid, Effect.withSpan('holonet.phoenix.ping'));

      const snapshot: PhoenixChannelSessionShape['snapshot'] = replay.snapshot;
      const metrics: PhoenixChannelSessionShape['metrics'] = Effect.sync(() => registry.get(metricsAtom));
      const events: PhoenixChannelSessionShape['events'] = Stream.fromPubSub(eventsPubSub);

      return {
        connect,
        disconnect,
        reconnectNow,
        publish,
        ping,
        snapshot,
        metrics,
        events,
      } satisfies PhoenixChannelSessionShape;
    }),
    dependencies: [
      PhoenixChannelSessionConfigDefault,
      TmnlAuthTokenServiceMissingLayer,
    ],
  },
) {}

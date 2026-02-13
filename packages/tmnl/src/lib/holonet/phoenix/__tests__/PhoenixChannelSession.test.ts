import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import type { PhoenixEnvelope } from '../schemas';
import { PhoenixErrors } from '../schemas/errors';
import { PhoenixJsTransport } from '../transport/PhoenixJsTransport';
import {
  PhoenixAuthTokenProvider,
  TmnlAuthTokenService,
} from '../services/PhoenixAuthTokenProvider';
import { PhoenixReplayCoordinator } from '../services/PhoenixReplayCoordinator';
import {
  PhoenixChannelSession,
  PhoenixChannelSessionConfig,
  type PhoenixChannelSessionConfigShape,
} from '../services/PhoenixChannelSession';
import {
  createPhoenixTransportHarness,
  harnessError,
} from './harness/PhoenixTransportHarness';

const mkEnvelope = (id: string): PhoenixEnvelope => ({
  event_id: id,
  schema_version: 1,
  event_type: 'ava.artifact.updated',
  workspace_id: 'ws-test',
  occurred_at: new Date().toISOString(),
  payload: {},
});

const baseConfig: PhoenixChannelSessionConfigShape = {
  url: 'ws://localhost:4000/socket/websocket?vsn=2.0.0',
  topic: 'ava:workspace:ws-test',
  params: {},
  replayRequired: true,
  clientSessionId: 'session-abc',
  joinTimeoutMs: 5_000,
  pushTimeoutMs: 5_000,
  autoReconnect: false,
  reconnectIntervalMs: 250,
  maxReconnectAttempts: 0,
};

const tmnlAuthStub = {
  getPhoenixAuthToken: Effect.succeed({
    token: 'token-abc',
    expiresAtMs: Date.now() + 60_000,
  }),
} as const;

const authStub = {
  getToken: Effect.succeed('token-abc'),
  clearCache: Effect.succeed<void>(undefined),
} as const;

describe('PhoenixChannelSession', () => {
  it('constructs with dependency-injected auth/transport/replay services', async () => {
    const harness = createPhoenixTransportHarness();

    const program = Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;

      return {
        hasConnect: typeof session.connect === 'function',
        hasDisconnect: typeof session.disconnect === 'function',
        hasReconnectNow: typeof session.reconnectNow === 'function',
        hasPublish: typeof session.publish === 'function',
        hasPing: typeof session.ping === 'function',
      };
    }).pipe(
      Effect.provide(PhoenixChannelSession.Default),
      Effect.provide(PhoenixReplayCoordinator.Default),
      Effect.provideService(PhoenixChannelSessionConfig, baseConfig),
      Effect.provideService(PhoenixJsTransport, harness.transport),
      Effect.provideService(PhoenixAuthTokenProvider, authStub),
      Effect.provideService(TmnlAuthTokenService, tmnlAuthStub),
    );

    const result = await Effect.runPromise(program);
    expect(result).toEqual({
      hasConnect: true,
      hasDisconnect: true,
      hasReconnectNow: true,
      hasPublish: true,
      hasPing: true,
    });
  });

  it('completes replay handshake on connect and dispatches live events after join', async () => {
    const harness = createPhoenixTransportHarness();

    harness.scriptJoin([
      {
        kind: 'ok',
        value: {
          mode: 'replay_required',
          replay_session_id: 'rpl-1',
          events: [] as ReadonlyArray<PhoenixEnvelope>,
          cursor: {
            from: null,
            to: null,
            count: 0,
            truncated: false,
          },
          requires_ack: true,
        },
      },
    ]);

    harness.scriptPush('replay_ack', [{ kind: 'ok', value: { ok: true } }]);

    const program = Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;

      yield* session.connect(baseConfig);
      yield* Effect.promise(() => harness.waitForHandler('ava_event'));
      harness.emit('ava_event', mkEnvelope('evt-live-after-connect'));

      return {
        connectCalls: harness.calls.connect.length,
        replayAckPushCalls: harness.calls.push.filter((call) => call.event === 'replay_ack').length,
        avaEventSubscriptions: harness.calls.on.filter((call) => call.event === 'ava_event').length,
      };
    }).pipe(
      Effect.provide(PhoenixChannelSession.Default),
      Effect.provide(PhoenixReplayCoordinator.Default),
      Effect.provideService(PhoenixChannelSessionConfig, baseConfig),
      Effect.provideService(PhoenixJsTransport, harness.transport),
      Effect.provideService(PhoenixAuthTokenProvider, authStub),
      Effect.provideService(TmnlAuthTokenService, tmnlAuthStub),
    );

    const result = await Effect.runPromise(program);

    expect(result.connectCalls).toBe(1);
    expect(result.replayAckPushCalls).toBe(1);
    expect(result.avaEventSubscriptions).toBe(1);
  });

  it('fails connect when replay_ack times out', async () => {
    const harness = createPhoenixTransportHarness();

    harness.scriptJoin([
      {
        kind: 'ok',
        value: {
          mode: 'replay_required',
          replay_session_id: 'rpl-2',
          events: [] as ReadonlyArray<PhoenixEnvelope>,
          cursor: {
            from: null,
            to: null,
            count: 0,
            truncated: false,
          },
          requires_ack: true,
        },
      },
    ]);

    harness.scriptPush('replay_ack', [
      harnessError(
        new PhoenixErrors.TransportError({
          message: 'replay ack timeout',
          code: 'replay_ack_timeout',
        }),
      ),
    ]);

    const program = Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;
      const exit = yield* Effect.exit(session.connect(baseConfig));

      return {
        exit,
        replayAckPushCalls: harness.calls.push.filter((call) => call.event === 'replay_ack').length,
      };
    }).pipe(
      Effect.provide(PhoenixChannelSession.Default),
      Effect.provide(PhoenixReplayCoordinator.Default),
      Effect.provideService(PhoenixChannelSessionConfig, baseConfig),
      Effect.provideService(PhoenixJsTransport, harness.transport),
      Effect.provideService(PhoenixAuthTokenProvider, authStub),
      Effect.provideService(TmnlAuthTokenService, tmnlAuthStub),
    );

    const result = await Effect.runPromise(program);

    expect(result.exit._tag).toBe('Failure');
    expect(result.replayAckPushCalls).toBe(1);
  });

  it('fails connect when join is rejected before replay handshake', async () => {
    const harness = createPhoenixTransportHarness();

    harness.scriptJoin([
      harnessError(
        new PhoenixErrors.TransportError({
          message: 'join rejected',
          code: 'join_rejected',
        }),
      ),
    ]);

    const program = Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;
      const exit = yield* Effect.exit(session.connect(baseConfig));

      return {
        exit,
        joinCalls: harness.calls.join,
        replayAckPushCalls: harness.calls.push.filter((call) => call.event === 'replay_ack').length,
      };
    }).pipe(
      Effect.provide(PhoenixChannelSession.Default),
      Effect.provide(PhoenixReplayCoordinator.Default),
      Effect.provideService(PhoenixChannelSessionConfig, baseConfig),
      Effect.provideService(PhoenixJsTransport, harness.transport),
      Effect.provideService(PhoenixAuthTokenProvider, authStub),
      Effect.provideService(TmnlAuthTokenService, tmnlAuthStub),
    );

    const result = await Effect.runPromise(program);

    expect(result.exit._tag).toBe('Failure');
    expect(result.joinCalls).toBe(1);
    expect(result.replayAckPushCalls).toBe(0);
  });

  it('reconnectNow carries forward last_seen cursor and performs replay ack on reconnect', async () => {
    const harness = createPhoenixTransportHarness();

    harness.scriptJoin([
      {
        kind: 'ok',
        value: {
          mode: 'replay_required',
          replay_session_id: 'rpl-initial',
          events: [mkEnvelope('evt-cursor-1')] as ReadonlyArray<PhoenixEnvelope>,
          cursor: {
            from: null,
            to: null,
            count: 1,
            truncated: false,
          },
          requires_ack: true,
        },
      },
      {
        kind: 'ok',
        value: {
          mode: 'replay_required',
          replay_session_id: 'rpl-reconnect',
          events: [] as ReadonlyArray<PhoenixEnvelope>,
          cursor: {
            from: 'evt-cursor-1',
            to: 'evt-cursor-1',
            count: 0,
            truncated: false,
          },
          requires_ack: true,
        },
      },
    ]);

    harness.scriptPush('replay_ack', [
      { kind: 'ok', value: { ok: true } },
      { kind: 'ok', value: { ok: true } },
    ]);

    const program = Effect.gen(function* () {
      const session = yield* PhoenixChannelSession;

      yield* session.connect(baseConfig);
      yield* session.reconnectNow();

      const metrics = yield* session.metrics;

      return {
        connectCalls: harness.calls.connect,
        replayAckPushCalls: harness.calls.push.filter((call) => call.event === 'replay_ack').length,
        metrics,
      };
    }).pipe(
      Effect.provide(PhoenixChannelSession.Default),
      Effect.provide(PhoenixReplayCoordinator.Default),
      Effect.provideService(PhoenixChannelSessionConfig, baseConfig),
      Effect.provideService(PhoenixJsTransport, harness.transport),
      Effect.provideService(PhoenixAuthTokenProvider, authStub),
      Effect.provideService(TmnlAuthTokenService, tmnlAuthStub),
    );

    const result = await Effect.runPromise(program);

    expect(result.connectCalls.length).toBe(2);
    expect(result.connectCalls[1]?.topic).toBe(baseConfig.topic);
    expect(result.connectCalls[1]?.params?.client_session_id).toBe(baseConfig.clientSessionId);
    expect(result.connectCalls[1]?.params?.last_seen_event_id).toBe('evt-cursor-1');
    expect(result.replayAckPushCalls).toBe(2);
    expect(result.metrics.rejoinTotal).toBe(1);
    expect(result.metrics.reconnectManualTotal).toBe(1);
  });
});

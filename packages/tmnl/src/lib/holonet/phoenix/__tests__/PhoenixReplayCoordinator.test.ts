import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import type { PhoenixEnvelope } from '../schemas';
import { PhoenixReplayCoordinator } from '../services/PhoenixReplayCoordinator';

const mkEnvelope = (id: string): PhoenixEnvelope => ({
  event_id: id,
  schema_version: 1,
  event_type: 'ava.artifact.updated',
  workspace_id: 'ws-test',
  occurred_at: new Date().toISOString(),
  payload: {},
});

describe('PhoenixReplayCoordinator', () => {
  it('buffers live events during replay and flushes after ack', async () => {
    const program = Effect.gen(function* () {
      const replay = yield* PhoenixReplayCoordinator;

      yield* replay.enterJoining('ava:workspace:ws-test', 'session-a', null);
      yield* replay.markReplayRequired('replay-1');
      yield* replay.markAwaitingAck();

      yield* replay.bufferLiveEvent(mkEnvelope('evt-1'));
      yield* replay.bufferLiveEvent(mkEnvelope('evt-2'));

      const canDispatchBefore = yield* replay.canDispatchLive;
      const flushed = yield* replay.ackSucceeded('evt-2');
      const canDispatchAfter = yield* replay.canDispatchLive;

      return {
        canDispatchBefore,
        canDispatchAfter,
        flushed,
      };
    }).pipe(Effect.provide(PhoenixReplayCoordinator.Default));

    const result = await Effect.runPromise(program);

    expect(result.canDispatchBefore).toBe(false);
    expect(result.canDispatchAfter).toBe(true);
    expect(result.flushed.map((event) => event.event_id)).toEqual(['evt-1', 'evt-2']);
  });

  it('applies drop-oldest behavior when live buffer exceeds cap', async () => {
    const program = Effect.gen(function* () {
      const replay = yield* PhoenixReplayCoordinator;
      yield* replay.enterJoining('ava:workspace:ws-test', 'session-a', null);
      yield* replay.markReplayRequired('replay-2');
      yield* replay.markAwaitingAck();

      for (let i = 0; i < 520; i++) {
        yield* replay.bufferLiveEvent(mkEnvelope(`evt-${i}`));
      }

      const flushed = yield* replay.ackSucceeded('evt-519');
      return flushed.map((event) => event.event_id);
    }).pipe(Effect.provide(PhoenixReplayCoordinator.Default));

    const result = await Effect.runPromise(program);
    expect(result.length).toBe(512);
    expect(result[0]).toBe('evt-8');
    expect(result[result.length - 1]).toBe('evt-519');
  });
});

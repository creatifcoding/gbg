/**
 * Hub/PubSub integration tests over the mock NATS transport.
 *
 * These validate the local fan-out behavior that the lower-level stream/KV tests
 * do not exercise.
 */

import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as Fiber from 'effect/Fiber';

import {
  NatsHubService,
  NatsInnerService,
  NatsPubSubService,
} from '../src/nats';
import {
  bytes,
  makeMockNatsFixture,
} from './support/mock-nats';

const TestEvent = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
});

const OtherEvent = Schema.Struct({
  name: Schema.String,
});

const RpcRequest = Schema.Struct({
  value: Schema.Number,
});

const RpcResponse = Schema.Struct({
  doubled: Schema.Number,
});

const makeInnerLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsInnerService.layerFromConnection.pipe(Layer.provide(fixture.layer));

const makeHubLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) => {
  const inner = makeInnerLayer(fixture);
  return NatsHubService.layerFromInner.pipe(Layer.provide(inner));
};

const makePubSubLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) => {
  const inner = makeInnerLayer(fixture);
  const hub = NatsHubService.layerFromInner.pipe(Layer.provide(inner));
  return NatsPubSubService.layerFromServices.pipe(
    Layer.provide(Layer.mergeAll(inner, hub)),
  );
};

describe('NatsHubService + NatsPubSubService integration', () => {
  it('shares one hub for duplicate subscriptions to the same pattern/schema', async () => {
    const fixture = makeMockNatsFixture();

    const activePatterns = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const hub = yield* NatsHubService;
          yield* hub.subscribe('events.>', TestEvent);
          yield* hub.subscribe('events.>', TestEvent);
          return yield* hub.activePatterns();
        }),
      ).pipe(Effect.provide(makeHubLayer(fixture))),
    );

    expect(activePatterns).toEqual(['events.>']);
  });

  it('delivers one wildcard subscriber message and forwards encoded payloads to core NATS', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const pubsub = yield* NatsPubSubService;
          const stream = yield* pubsub.subscribe('events.>', TestEvent);
          const fiber = yield* Effect.forkScoped(stream.pipe(Stream.take(1), Stream.runCollect));

          yield* pubsub.publish('events.created', TestEvent, { id: 'evt-1', value: 42 });

          const chunk = yield* Fiber.join(fiber).pipe(
            Effect.timeout(1000),
            Effect.orElseSucceed(() => []),
          );

          return Array.from(chunk);
        }),
      ).pipe(Effect.provide(makePubSubLayer(fixture))),
    );

    expect(result.map((msg) => msg.data)).toEqual([{ id: 'evt-1', value: 42 }]);
    expect(result.map((msg) => msg.subject)).toEqual(['events.created']);
    expect(fixture.state.coreMessages).toHaveLength(1);
    expect(fixture.state.coreMessages[0].subject).toBe('events.created');
  });

  it('does not duplicate local and core delivery for one publish', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const pubsub = yield* NatsPubSubService;
          const stream = yield* pubsub.subscribe('events.>', TestEvent);
          const received: Array<unknown> = [];
          const fiber = yield* stream.pipe(
            Stream.runForEach((msg) => Effect.sync(() => received.push(msg.data))),
            Effect.forkScoped,
          );

          yield* pubsub.publish('events.created', TestEvent, { id: 'evt-1', value: 42 });
          yield* Effect.sleep(50);
          yield* Fiber.interrupt(fiber);
          return received;
        }),
      ).pipe(Effect.provide(makePubSubLayer(fixture))),
    );

    expect(result).toEqual([{ id: 'evt-1', value: 42 }]);
    expect(fixture.state.coreMessages).toHaveLength(1);
  });

  it('isolates schemas for subscribers sharing the same subject pattern', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const pubsub = yield* NatsPubSubService;
          const wrongSchemaStream = yield* pubsub.subscribe('events.>', TestEvent);
          const rightSchemaStream = yield* pubsub.subscribe('events.>', OtherEvent);
          const wrong: Array<unknown> = [];
          const right: Array<unknown> = [];

          const wrongFiber = yield* wrongSchemaStream.pipe(
            Stream.runForEach((msg) => Effect.sync(() => wrong.push(msg.data))),
            Effect.ignore,
            Effect.forkScoped,
          );
          const rightFiber = yield* rightSchemaStream.pipe(
            Stream.runForEach((msg) => Effect.sync(() => right.push(msg.data))),
            Effect.ignore,
            Effect.forkScoped,
          );

          yield* pubsub.publish('events.created', OtherEvent, { name: 'schema-b' });
          yield* Effect.sleep(50);
          yield* Fiber.interrupt(wrongFiber);
          yield* Fiber.interrupt(rightFiber);
          return { wrong, right };
        }),
      ).pipe(Effect.provide(makePubSubLayer(fixture))),
    );

    expect(result.wrong).toEqual([]);
    expect(result.right).toEqual([{ name: 'schema-b' }]);
  });

  it('performs schema-encoded request/reply roundtrips', async () => {
    const fixture = makeMockNatsFixture();
    fixture.state.responders.set('rpc.double', (data) => {
      const decoded = JSON.parse(new TextDecoder().decode(data)) as { value: number };
      return {
        subject: 'rpc.double.reply',
        data: bytes(JSON.stringify({ doubled: decoded.value * 2 })),
        reply: '',
        respond: () => true,
        json: () => ({ doubled: decoded.value * 2 }),
        string: () => JSON.stringify({ doubled: decoded.value * 2 }),
      } as any;
    });

    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;
        return yield* pubsub.request('rpc.double', RpcRequest, RpcResponse, { value: 21 });
      }).pipe(Effect.provide(makePubSubLayer(fixture))),
    );

    expect(response).toEqual({ doubled: 42 });
  });

  it('fails request/reply when the response does not satisfy the response schema', async () => {
    const fixture = makeMockNatsFixture();
    fixture.state.responders.set('rpc.bad-response', () => ({
      subject: 'rpc.bad-response.reply',
      data: bytes(JSON.stringify({ doubled: 'not-a-number' })),
      reply: '',
      respond: () => true,
      json: () => ({ doubled: 'not-a-number' }),
      string: () => JSON.stringify({ doubled: 'not-a-number' }),
    } as any));

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;
        return yield* pubsub.request('rpc.bad-response', RpcRequest, RpcResponse, { value: 1 }).pipe(Effect.result);
      }).pipe(Effect.provide(makePubSubLayer(fixture))),
    );

    expect(result._tag).toBe('Failure');
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('Codec/Decode');
    }
  });
});

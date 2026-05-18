/**
 * Service tests against the in-memory mock NATS transport.
 *
 * These tests validate wrapper semantics deterministically. Live NATS tests are
 * tracked separately because mocks cannot prove server-side protocol acceptance.
 */

import { describe, expect, it } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Schema from 'effect-v4/Schema';
import * as Stream from 'effect-v4/Stream';

import {
  NatsInnerService,
  NatsKVService,
  NatsStreamService,
} from '../src/nats';
import { makeStreamProcessor } from '../src/integration/stream-processor';
import {
  bytes,
  collectAsyncIterable,
  makeMockNatsFixture,
} from './support/mock-nats';

const TestEvent = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
});

type TestEvent = typeof TestEvent.Type;

const makeInnerLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsInnerService.layerFromConnection.pipe(Layer.provide(fixture.layer));

const makeKvLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsKVService.layerFromInner.pipe(Layer.provide(makeInnerLayer(fixture)));

const makeStreamLayer = (fixture: ReturnType<typeof makeMockNatsFixture>) =>
  NatsStreamService.layerFromInner.pipe(Layer.provide(makeInnerLayer(fixture)));

describe('mock NATS transport', () => {
  it('supports inner core publish and request/reply', async () => {
    const fixture = makeMockNatsFixture();
    fixture.state.responders.set('rpc.echo', (data) => ({
      subject: 'rpc.echo.reply',
      data,
      reply: '',
      respond: () => true,
      json: () => JSON.parse(new TextDecoder().decode(data)),
      string: () => new TextDecoder().decode(data),
    } as any));

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const inner = yield* NatsInnerService;
        yield* inner.core.publish('events.test', bytes('hello'));
        const response = yield* inner.core.request('rpc.echo', bytes('{"ok":true}'));
        return response.string();
      }).pipe(Effect.provide(makeInnerLayer(fixture))),
    );

    expect(fixture.state.coreMessages).toHaveLength(1);
    expect(fixture.state.coreMessages[0].subject).toBe('events.test');
    expect(result).toBe('{"ok":true}');
  });

  it('supports inner JetStream stream and consumer management', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const inner = yield* NatsInnerService;
        const missing = yield* inner.streams.info('EVENTS');
        const added = yield* inner.streams.add({ name: 'EVENTS', subjects: ['events.>'] });
        const found = yield* inner.streams.find('events.created');
        yield* inner.jsPublish('events.created', bytes('{"id":"1","value":42}'));
        yield* inner.consumers.add('EVENTS', { durableName: 'worker' });
        const consumer = yield* inner.consumers.get('EVENTS', 'worker');
        const batch = yield* inner.consumers.fetch(consumer, { max_messages: 10 });
        const messages = yield* Effect.promise(() => collectAsyncIterable(batch as any));
        const consumers = yield* inner.consumers.list('EVENTS');
        const listed = yield* Effect.promise(() => collectAsyncIterable(consumers));
        return { missing, added, found, messages, listed };
      }).pipe(Effect.provide(makeInnerLayer(fixture))),
    );

    expect(result.missing).toBeNull();
    expect(result.added.config.name).toBe('EVENTS');
    expect(result.found).toBe('EVENTS');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].subject).toBe('events.created');
    expect(result.listed).toHaveLength(1);
  });

  it('supports high-level KV put/get/list/history', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const kv = yield* NatsKVService;
        const value: TestEvent = { id: 'a', value: 7 };
        const revision = yield* kv.put('events', 'a', TestEvent, value);
        const got = yield* kv.get('events', 'a', TestEvent);
        const keys = yield* kv.keys('events');
        const list = yield* kv.list('events', TestEvent);
        const history = yield* kv.history('events', 'a', TestEvent);
        return { revision, got, keys, list, history };
      }).pipe(Effect.provide(makeKvLayer(fixture))),
    );

    expect(result.revision).toBe(1);
    expect(result.got).toEqual({ id: 'a', value: 7 });
    expect(result.keys).toEqual(['a']);
    expect(result.list.map((entry) => entry.value)).toEqual([{ id: 'a', value: 7 }]);
    expect(result.history.map((entry) => entry.value)).toEqual([{ id: 'a', value: 7 }]);
  });

  it('supports high-level stream ensure/publish/fetch/next', async () => {
    const fixture = makeMockNatsFixture();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        yield* stream.ensureStream({ name: 'EVENTS', subjects: ['events.>'] });
        const ack = yield* stream.publish('events.created', TestEvent, { id: 'a', value: 1 });
        const consumer = yield* stream.getConsumer('EVENTS', 'worker', { durableName: 'worker' });
        const fetched = yield* stream.fetch(consumer, TestEvent, { max: 10 });
        yield* stream.publish('events.updated', TestEvent, { id: 'b', value: 2 });
        const next = yield* stream.next(consumer, TestEvent);
        const info = yield* stream.getStreamInfo('EVENTS');
        return { ack, fetched, next, info };
      }).pipe(Effect.provide(makeStreamLayer(fixture))),
    );

    expect(result.ack.stream).toBe('EVENTS');
    expect(result.ack.seq).toBe(1);
    expect(result.fetched.map((msg) => msg.data)).toEqual([{ id: 'a', value: 1 }]);
    expect(result.next?.data).toEqual({ id: 'b', value: 2 });
    expect((result.info as any)?.state?.last_seq).toBe(2);
  });

  it('supports MshStreamProcessor publish/read/info/delete lifecycle', async () => {
    const fixture = makeMockNatsFixture();
    const layers = Layer.mergeAll(makeInnerLayer(fixture), makeStreamLayer(fixture));

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const processor = yield* makeStreamProcessor({
          streamName: 'PROCESSOR_EVENTS',
          subject: 'processor.events.created',
          subjects: ['processor.events.>'],
          consumerName: 'processor-worker',
        }, TestEvent);

        const first = yield* processor.publish({ id: 'p1', value: 1 });
        const batch = yield* processor.publishBatch([
          { id: 'p2', value: 2 },
          { id: 'p3', value: 3 },
        ]);
        const sequence = yield* processor.getCurrentSequence;
        const info = yield* processor.getInfo;
        const read = yield* processor.read({ fromSequence: 1, limit: 10 });
        const deleted = yield* processor.delete;
        return { first, batch, sequence, info, read, deleted };
      }).pipe(Effect.provide(layers)),
    );

    expect(result.first.seq).toBe(1);
    expect(result.batch.map((ack) => ack.seq)).toEqual([2, 3]);
    expect(result.sequence).toBe(3);
    expect(result.info.messages).toBe(3);
    expect(result.read.items).toEqual([
      { id: 'p1', value: 1 },
      { id: 'p2', value: 2 },
      { id: 'p3', value: 3 },
    ]);
    expect(result.deleted).toBe(true);
  });
});

/**
 * In-memory NATS test transport.
 *
 * Provides NatsConnectionService directly so service tests exercise msh wrappers
 * without monkeypatching `nats.ws.connect` or requiring a real server.
 */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import type {
  Consumer,
  ConsumerConfig,
  ConsumerInfo,
  ConsumerMessages,
  JetStreamClient,
  JetStreamManager,
  JsMsg,
  KV,
  KvEntry,
  Msg,
  NatsConnection,
  ObjectInfo,
  ObjectStore,
  PubAck,
  StreamConfig,
  StreamInfo,
} from 'nats.ws';

import { NatsConnectionService, type NatsConnectionShape } from '../../src/nats/connection';
import { Connection } from '../../src/nats/errors';
import type { MshConfig } from '../../src/schemas/config';

export interface MockStreamRecord {
  readonly config: Partial<StreamConfig> & { name: string };
  readonly messages: Array<{ subject: string; data: Uint8Array; seq: number; time: Date }>;
  readonly consumers: Map<string, MockConsumerState>;
}

export interface MockConsumerState {
  readonly stream: string;
  readonly name?: string;
  cursor: number;
  readonly config: Partial<ConsumerConfig>;
}

export interface MockKvBucketState {
  revision: number;
  readonly entries: Map<string, MockKvEntry>;
}

export interface MockKvEntry {
  readonly key: string;
  readonly value: Uint8Array;
  readonly revision: number;
  readonly created: Date;
  readonly deleted?: boolean;
}

export interface MockObjectStoreState {
  readonly entries: Map<string, { data: Uint8Array; description?: string; created: Date }>;
}

interface MockCoreSubscription extends AsyncIterable<Msg> {
  readonly subject: string;
  readonly offer: (message: Msg) => void;
  readonly unsubscribe: () => void;
}

export interface MockNatsState {
  readonly coreMessages: Array<{ subject: string; data: Uint8Array; reply?: string }>;
  readonly coreSubscriptions: Set<MockCoreSubscription>;
  readonly streams: Map<string, MockStreamRecord>;
  readonly kvBuckets: Map<string, MockKvBucketState>;
  readonly objectStores: Map<string, MockObjectStoreState>;
  readonly responders: Map<string, (data: Uint8Array) => Msg | Promise<Msg>>;
}

export interface MockNatsOptions {
  readonly jetStreamManagerUnavailable?: boolean;
}

export interface MockNatsFixture {
  readonly state: MockNatsState;
  readonly shape: NatsConnectionShape;
  readonly layer: Layer.Layer<NatsConnectionService>;
}

const DEFAULT_CONFIG: MshConfig = {
  servers: 'mock://nats',
  name: 'tmnl-msh-test',
  reconnect: false,
  maxReconnectAttempts: 0,
  reconnectDelayMs: 0,
  debug: false,
};

const textEncoder = new TextEncoder();

const makeState = (): MockNatsState => ({
  coreMessages: [],
  coreSubscriptions: new Set(),
  streams: new Map(),
  kvBuckets: new Map(),
  objectStores: new Map(),
  responders: new Map(),
});

export const asyncIterableFrom = async function* <A>(values: Iterable<A>): AsyncIterable<A> {
  for (const value of values) yield value;
};

export const collectAsyncIterable = async <A>(iterable: AsyncIterable<A>): Promise<A[]> => {
  const out: A[] = [];
  for await (const item of iterable) out.push(item);
  return out;
};

const matchesSubject = (pattern: string, subject: string): boolean => {
  if (pattern === subject || pattern === '>') return true;
  const pp = pattern.split('.');
  const ss = subject.split('.');
  for (let i = 0; i < pp.length; i += 1) {
    const token = pp[i];
    if (token === '>') return true;
    if (ss[i] === undefined) return false;
    if (token !== '*' && token !== ss[i]) return false;
  }
  return pp.length === ss.length;
};

const streamSubjects = (stream: MockStreamRecord): readonly string[] =>
  (stream.config.subjects as readonly string[] | undefined) ?? [];

const findStreamForSubject = (state: MockNatsState, subject: string): MockStreamRecord | undefined =>
  Array.from(state.streams.values()).find((stream) =>
    streamSubjects(stream).some((pattern) => matchesSubject(pattern, subject)),
  );

const streamInfo = (stream: MockStreamRecord): StreamInfo => ({
  config: stream.config,
  state: {
    messages: stream.messages.length,
    bytes: stream.messages.reduce((acc, msg) => acc + msg.data.length, 0),
    first_seq: stream.messages[0]?.seq ?? 0,
    last_seq: stream.messages.at(-1)?.seq ?? 0,
    consumer_count: stream.consumers.size,
  },
} as unknown as StreamInfo);

const consumerInfo = (state: MockConsumerState): ConsumerInfo => ({
  stream_name: state.stream,
  name: state.name ?? 'ephemeral',
  config: state.config,
  delivered: { consumer_seq: state.cursor, stream_seq: state.cursor },
  ack_floor: { consumer_seq: 0, stream_seq: 0 },
  num_pending: 0,
} as unknown as ConsumerInfo);

const makeMsg = (subject: string, data: Uint8Array, reply = ''): Msg => ({
  subject,
  data,
  reply,
  headers: undefined,
  respond: () => true,
  json: () => JSON.parse(new TextDecoder().decode(data)),
  string: () => new TextDecoder().decode(data),
} as unknown as Msg);

const makeCoreSubscription = (state: MockNatsState, subject: string): MockCoreSubscription => {
  const pending: Msg[] = [];
  const waiters: Array<(result: IteratorResult<Msg>) => void> = [];
  let closed = false;

  const subscription: MockCoreSubscription = {
    subject,
    offer: (message) => {
      if (closed) return;
      const waiter = waiters.shift();
      if (waiter) waiter({ value: message, done: false });
      else pending.push(message);
    },
    unsubscribe: () => {
      if (closed) return;
      closed = true;
      state.coreSubscriptions.delete(subscription);
      while (waiters.length > 0) {
        waiters.shift()?.({ value: undefined as unknown as Msg, done: true });
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          const message = pending.shift();
          if (message !== undefined) return { value: message, done: false };
          if (closed) return { value: undefined as unknown as Msg, done: true };
          return new Promise<IteratorResult<Msg>>((resolve) => {
            waiters.push(resolve);
          });
        },
      };
    },
  };

  state.coreSubscriptions.add(subscription);
  return subscription;
};

const makeJsMsg = (msg: { subject: string; data: Uint8Array; seq: number; time: Date }): JsMsg => ({
  subject: msg.subject,
  data: msg.data,
  seq: msg.seq,
  info: { timestampNanos: BigInt(msg.time.getTime()) * 1_000_000n },
  ack: () => undefined,
  nak: () => undefined,
  working: () => undefined,
  term: () => undefined,
} as unknown as JsMsg);

const makeConsumerMessages = (messages: JsMsg[]): ConsumerMessages => ({
  [Symbol.asyncIterator]: () => asyncIterableFrom(messages)[Symbol.asyncIterator](),
  stop: () => undefined,
} as unknown as ConsumerMessages);

const initialConsumerCursor = (stream: MockStreamRecord, config: Partial<ConsumerConfig>): number => {
  switch (config.deliver_policy) {
    case 'new':
      return stream.messages.length;
    case 'last':
      return Math.max(stream.messages.length - 1, 0);
    case 'by_start_sequence':
      return stream.messages.findIndex((message) => message.seq >= (config.opt_start_seq ?? 1));
    case 'by_start_time': {
      const start = config.opt_start_time ? new Date(config.opt_start_time).getTime() : Number.NEGATIVE_INFINITY;
      return stream.messages.findIndex((message) => message.time.getTime() >= start);
    }
    default:
      return 0;
  }
};

const ensureStream = (state: MockNatsState, name: string): MockStreamRecord => {
  const stream = state.streams.get(name);
  if (!stream) throw new Error(`stream not found: ${name}`);
  return stream;
};

const makeConsumer = (state: MockNatsState, consumerState: MockConsumerState): Consumer => ({
  consume: () => {
    const stream = ensureStream(state, consumerState.stream);
    const messages = stream.messages.slice(consumerState.cursor).map(makeJsMsg);
    consumerState.cursor = stream.messages.length;
    return Promise.resolve(makeConsumerMessages(messages));
  },
  fetch: (opts?: { max_messages?: number }) => {
    const stream = ensureStream(state, consumerState.stream);
    const max = opts?.max_messages ?? stream.messages.length;
    const messages = stream.messages.slice(consumerState.cursor, consumerState.cursor + max).map(makeJsMsg);
    consumerState.cursor += messages.length;
    return Promise.resolve(makeConsumerMessages(messages));
  },
  next: () => {
    const stream = ensureStream(state, consumerState.stream);
    const message = stream.messages[consumerState.cursor];
    if (!message) return Promise.resolve(null);
    consumerState.cursor += 1;
    return Promise.resolve(makeJsMsg(message));
  },
} as unknown as Consumer);

const makeKvEntry = (entry: MockKvEntry): KvEntry => ({
  key: entry.key,
  value: entry.value,
  revision: entry.revision,
  created: entry.created,
  delta: 0,
  operation: entry.deleted ? 'DEL' : 'PUT',
} as unknown as KvEntry);

const makeKvBucket = (bucket: MockKvBucketState): KV => ({
  get: (key: string) => Promise.resolve(bucket.entries.get(key) ? makeKvEntry(bucket.entries.get(key)!) : null),
  put: (key: string, value: Uint8Array) => {
    bucket.revision += 1;
    bucket.entries.set(key, { key, value, revision: bucket.revision, created: new Date() });
    return Promise.resolve(bucket.revision);
  },
  create: (key: string, value: Uint8Array) => {
    if (bucket.entries.has(key)) return Promise.reject(new Error(`key exists: ${key}`));
    bucket.revision += 1;
    bucket.entries.set(key, { key, value, revision: bucket.revision, created: new Date() });
    return Promise.resolve(bucket.revision);
  },
  delete: (key: string) => {
    bucket.entries.delete(key);
    return Promise.resolve();
  },
  purge: (key: string) => {
    bucket.entries.delete(key);
    return Promise.resolve();
  },
  watch: () => Promise.resolve(asyncIterableFrom(Array.from(bucket.entries.values()).map(makeKvEntry))),
  keys: (filter?: string) => Promise.resolve(asyncIterableFrom(
    Array.from(bucket.entries.keys()).filter((key) => !filter || matchesSubject(filter, key)),
  )),
  history: ({ key }: { key: string }) => Promise.resolve(asyncIterableFrom(
    Array.from(bucket.entries.values()).filter((entry) => entry.key === key).map(makeKvEntry),
  )),
} as unknown as KV);

const toReadableStream = (data: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

const makeObjectStore = (store: MockObjectStoreState): ObjectStore => ({
  info: (name: string) => {
    const entry = store.entries.get(name);
    if (!entry) return Promise.reject(new Error(`object not found: ${name}`));
    return Promise.resolve({ name, size: entry.data.length, description: entry.description, mtime: entry.created } as unknown as ObjectInfo);
  },
  get: (name: string) => {
    const entry = store.entries.get(name);
    if (!entry) return Promise.resolve(null);
    return Promise.resolve({ data: toReadableStream(entry.data) });
  },
  putBlob: ({ name, description }: { name: string; description?: string }, data: Uint8Array) => {
    store.entries.set(name, { data, description, created: new Date() });
    return Promise.resolve({ name, size: data.length } as unknown as ObjectInfo);
  },
  delete: (name: string) => {
    store.entries.delete(name);
    return Promise.resolve();
  },
  list: () => Promise.resolve(asyncIterableFrom(
    Array.from(store.entries.entries()).map(([name, entry]) => ({ name, size: entry.data.length } as unknown as ObjectInfo)),
  )),
  watch: () => Promise.resolve(asyncIterableFrom([])),
} as unknown as ObjectStore);

const makeConnectionShape = (
  state: MockNatsState,
  config: MshConfig,
  options: MockNatsOptions = {},
): NatsConnectionShape => {
  const jsm: JetStreamManager = {
    consumers: {
      add: (streamName: string, config: Partial<ConsumerConfig>) => {
        const stream = ensureStream(state, streamName);
        const name = config.durable_name ?? `ephemeral-${stream.consumers.size + 1}`;
        const cursor = initialConsumerCursor(stream, config);
        const consumer: MockConsumerState = { stream: streamName, name, cursor: cursor < 0 ? stream.messages.length : cursor, config };
        stream.consumers.set(name, consumer);
        return Promise.resolve(consumerInfo(consumer));
      },
      info: (streamName: string, name: string) => {
        const stream = ensureStream(state, streamName);
        const consumer = stream.consumers.get(name);
        if (!consumer) return Promise.reject(new Error(`consumer not found: ${name}`));
        return Promise.resolve(consumerInfo(consumer));
      },
      delete: (streamName: string, name: string) => Promise.resolve(ensureStream(state, streamName).consumers.delete(name)),
      list: (streamName: string) => asyncIterableFrom(Array.from(ensureStream(state, streamName).consumers.values()).map(consumerInfo)),
    },
    streams: {
      add: (config: Partial<StreamConfig> & { name: string }) => {
        const record: MockStreamRecord = { config, messages: [], consumers: new Map() };
        state.streams.set(config.name, record);
        return Promise.resolve(streamInfo(record));
      },
      info: (name: string) => Promise.resolve(streamInfo(ensureStream(state, name))),
      update: (name: string, config: Partial<StreamConfig>) => {
        const stream = ensureStream(state, name);
        Object.assign(stream.config, config);
        return Promise.resolve(streamInfo(stream));
      },
      delete: (name: string) => Promise.resolve(state.streams.delete(name)),
      list: (subject?: string) => asyncIterableFrom(
        Array.from(state.streams.values())
          .filter((stream) => !subject || streamSubjects(stream).some((pattern) => matchesSubject(pattern, subject)))
          .map(streamInfo),
      ),
      purge: (name: string) => {
        const stream = ensureStream(state, name);
        const purged = stream.messages.length;
        stream.messages.splice(0, stream.messages.length);
        return Promise.resolve({ success: true, purged } as unknown as Awaited<ReturnType<JetStreamManager['streams']['purge']>>);
      },
      find: (subject: string) => {
        const stream = findStreamForSubject(state, subject);
        if (!stream) return Promise.reject(new Error(`stream not found for subject: ${subject}`));
        return Promise.resolve(stream.config.name);
      },
    },
  } as unknown as JetStreamManager;

  const js: JetStreamClient = {
    publish: (subject: string, data: Uint8Array): Promise<PubAck> => {
      const stream = findStreamForSubject(state, subject);
      if (!stream) return Promise.reject(new Error(`no stream for subject: ${subject}`));
      const seq = stream.messages.length + 1;
      stream.messages.push({ subject, data, seq, time: new Date() });
      return Promise.resolve({ stream: stream.config.name, seq, duplicate: false } as unknown as PubAck);
    },
    consumers: {
      get: (streamName: string, name?: string) => {
        const stream = ensureStream(state, streamName);
        if (name) {
          const consumer = stream.consumers.get(name);
          if (!consumer) return Promise.reject(new Error(`consumer not found: ${name}`));
          return Promise.resolve(makeConsumer(state, consumer));
        }
        const ephemeral: MockConsumerState = { stream: streamName, cursor: 0, config: {} };
        return Promise.resolve(makeConsumer(state, ephemeral));
      },
    },
    views: {
      kv: (name: string) => {
        let bucket = state.kvBuckets.get(name);
        if (!bucket) {
          bucket = { revision: 0, entries: new Map() };
          state.kvBuckets.set(name, bucket);
        }
        return Promise.resolve(makeKvBucket(bucket));
      },
      os: (name: string) => {
        let store = state.objectStores.get(name);
        if (!store) {
          store = { entries: new Map() };
          state.objectStores.set(name, store);
        }
        return Promise.resolve(makeObjectStore(store));
      },
    },
  } as unknown as JetStreamClient;

  const nc: NatsConnection = {
    publish: (subject: string, data: Uint8Array, opts?: { reply?: string }) => {
      const message = { subject, data, reply: opts?.reply };
      state.coreMessages.push(message);
      for (const subscription of state.coreSubscriptions) {
        if (matchesSubject(subscription.subject, subject)) {
          subscription.offer(makeMsg(subject, data, opts?.reply ?? ''));
        }
      }
    },
    subscribe: (subject: string) => makeCoreSubscription(state, subject),
    request: async (subject: string, data: Uint8Array) => {
      const responder = state.responders.get(subject);
      if (!responder) throw Object.assign(new Error('no responders'), { code: '503' });
      return responder(data);
    },
    flush: () => Promise.resolve(),
    drain: () => Promise.resolve(),
    close: () => Promise.resolve(),
    jetstream: () => js,
    jetstreamManager: () => options.jetStreamManagerUnavailable
      ? Promise.reject(new Error('mock JetStream manager unavailable'))
      : Promise.resolve(jsm),
  } as unknown as NatsConnection;

  const getJsm = () => Effect.tryPromise({
    try: () => nc.jetstreamManager(),
    catch: (err) => new Connection.JetStreamManagerError({
      message: `Failed to get JetStream manager: ${err}`,
      cause: err,
    }),
  });

  return { nc, js, jsm: options.jetStreamManagerUnavailable ? undefined : jsm, getJsm, config };
};

export const makeMockNatsFixture = (
  config: Partial<MshConfig> = {},
  options: MockNatsOptions = {},
): MockNatsFixture => {
  const state = makeState();
  const shape = makeConnectionShape(state, { ...DEFAULT_CONFIG, ...config }, options);
  return {
    state,
    shape,
    layer: Layer.succeed(NatsConnectionService)(NatsConnectionService.of(shape)),
  };
};

export const bytes = (text: string): Uint8Array => textEncoder.encode(text);

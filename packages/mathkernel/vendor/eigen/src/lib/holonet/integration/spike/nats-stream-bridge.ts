/**
 * NATS Consumer → Effect.Stream Bridge Spike
 *
 * Demonstrates bridging NATS JetStream consumers to Effect.Stream
 * with schema-aware decoding via StreamCodecService.
 *
 * Key patterns validated:
 * - Stream.mapEffect with schema lookup from headers
 * - Auto-ack after successful decode
 * - Graceful error handling for SchemaNotFoundError
 * - Concurrency options for parallel decoding
 *
 * @module holonet/integration/spike/nats-stream-bridge
 */

import { Effect, Stream, Data, Schema } from 'effect';
import type { JsMsg, ConsumerMessages } from 'nats.ws';

import {
  StreamCodecService,
  type JsMsgLike,
  CodecError,
  SchemaValidationError,
  MissingSchemaHeaderError,
  HEADER_SCHEMA_ID,
  extractSchemaId,
  hasSchemaHeaders,
} from '@/lib/holonet/durable-streams/services/StreamCodecService';
import { SchemaNotFoundError } from '@/lib/holonet/core/schema';
import { fromAsyncIterable } from '@/lib/holonet/utils/stream';

// =============================================================================
// Types
// =============================================================================

/**
 * Typed message from NATS with schema metadata
 */
export interface TypedNatsMessage<A = unknown> {
  /** The decoded data */
  readonly data: A;
  /** Schema ID from headers */
  readonly schemaId: string;
  /** Stream sequence number */
  readonly seq: number;
  /** Subject the message was published on */
  readonly subject: string;
  /** Timestamp */
  readonly time: Date;
  /** Acknowledge the message */
  readonly ack: () => void;
  /** Negative acknowledge (request redelivery) */
  readonly nak: (delay?: number) => void;
  /** Mark as being worked on */
  readonly working: () => void;
  /** Terminate redelivery */
  readonly term: (reason?: string) => void;
}

/**
 * Options for the schema-aware consumer bridge
 */
export interface SchemaConsumerBridgeOptions {
  /** Concurrency for decoding (default: 1) */
  readonly concurrency?: number;
  /** Whether to preserve message order (default: true) */
  readonly ordered?: boolean;
  /** Action on schema not found error */
  readonly onSchemaNotFound?: 'skip' | 'fail' | 'passthrough';
  /** Action on decode error */
  readonly onDecodeError?: 'skip' | 'fail' | 'nak';
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when consumer bridge fails
 */
export class ConsumerBridgeError extends Data.TaggedError('ConsumerBridgeError')<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Message was skipped due to missing/invalid schema
 */
export class MessageSkipped extends Data.TaggedError('MessageSkipped')<{
  readonly seq: number;
  readonly subject: string;
  readonly reason: 'no_schema_header' | 'schema_not_found' | 'decode_error';
  readonly schemaId?: string;
}> {}

// =============================================================================
// Core Bridge Functions
// =============================================================================

/**
 * Convert a JsMsg to JsMsgLike for StreamCodecService
 *
 * The actual nats.ws JsMsg has `headers.get(key)` which returns string.
 * Our JsMsgLike interface expects the same API.
 */
export const jsMessageToMsgLike = (msg: JsMsg): JsMsgLike => ({
  data: msg.data,
  headers: msg.headers
    ? {
        get: (key: string) => msg.headers!.get(key) ?? null,
      }
    : undefined,
});

/**
 * Create a typed message wrapper from JsMsg and decoded data
 */
export const createTypedMessage = <A>(
  msg: JsMsg,
  data: A,
  schemaId: string
): TypedNatsMessage<A> => ({
  data,
  schemaId,
  seq: msg.seq,
  subject: msg.subject,
  time: msg.info?.timestampNanos
    ? new Date(Number(msg.info.timestampNanos) / 1_000_000)
    : new Date(),
  ack: () => msg.ack(),
  nak: (delay) => msg.nak(delay),
  working: () => msg.working(),
  term: (reason) => msg.term(reason),
});

/**
 * Decode a JsMsg using schema from headers
 *
 * 1. Extract X-Schema-Id from headers
 * 2. Lookup schema in registry
 * 3. Decode message bytes
 * 4. Return typed message wrapper
 */
export const decodeJsMessage = <A = unknown>(
  msg: JsMsg
): Effect.Effect<
  TypedNatsMessage<A>,
  | CodecError
  | SchemaValidationError
  | SchemaNotFoundError
  | MissingSchemaHeaderError,
  StreamCodecService
> =>
  Effect.gen(function* () {
    const codec = yield* StreamCodecService;
    const msgLike = jsMessageToMsgLike(msg);

    // Decode using schema from headers
    const { data, schemaId } = yield* codec.decodeWithSchema<A>(msgLike);

    return createTypedMessage(msg, data, schemaId);
  });

/**
 * Decode a JsMsg using a known schema (bypass header lookup)
 */
export const decodeJsMessageWithKnownSchema = <A, I>(
  msg: JsMsg,
  schema: Schema.Schema<A, I>,
  schemaId: string
): Effect.Effect<
  TypedNatsMessage<A>,
  CodecError | SchemaValidationError,
  StreamCodecService
> =>
  Effect.gen(function* () {
    const codec = yield* StreamCodecService;
    const msgLike = jsMessageToMsgLike(msg);

    const data = yield* codec.decodeWithKnownSchema(msgLike, schema);

    return createTypedMessage(msg, data, schemaId);
  });

// =============================================================================
// Stream Bridge Functions
// =============================================================================

/**
 * Bridge an async iterator of JsMsg to Effect.Stream with schema decoding.
 *
 * This is the core pattern for bridging NATS consumers to Effect streams.
 */
export const fromConsumerMessages = <A = unknown>(
  messages: ConsumerMessages,
  options: SchemaConsumerBridgeOptions = {}
): Stream.Stream<
  TypedNatsMessage<A>,
  ConsumerBridgeError | CodecError | SchemaValidationError | SchemaNotFoundError | MissingSchemaHeaderError,
  StreamCodecService
> => {
  const {
    concurrency = 1,
    ordered = true,
    onSchemaNotFound = 'fail',
    onDecodeError = 'fail',
  } = options;

  // Convert async iterable to Effect.Stream
  const rawStream = fromAsyncIterable<JsMsg, ConsumerBridgeError>(
    messages,
    (err) =>
      new ConsumerBridgeError({
        reason: 'Consumer iteration error',
        cause: err,
      }),
    () => {
      messages.stop?.();
    }
  );

  // Map to typed messages with schema decoding
  return rawStream.pipe(
    Stream.mapEffect(
      (msg) =>
        Effect.gen(function* () {
          // Check if message has schema headers
          const msgLike = jsMessageToMsgLike(msg);
          if (!hasSchemaHeaders(msgLike)) {
            if (onSchemaNotFound === 'skip') {
              msg.ack(); // Ack and skip
              return null;
            }
            return yield* Effect.fail(
              new MissingSchemaHeaderError({
                headerName: HEADER_SCHEMA_ID,
                message: `Message seq=${msg.seq} missing ${HEADER_SCHEMA_ID} header`,
              })
            );
          }

          // Try to decode
          const result = yield* decodeJsMessage<A>(msg).pipe(
            Effect.either
          );

          if (result._tag === 'Left') {
            const error = result.left;

            // Handle schema not found
            if (error._tag === 'SchemaNotFoundError') {
              if (onSchemaNotFound === 'skip') {
                msg.ack();
                return null;
              }
              if (onSchemaNotFound === 'passthrough') {
                // Create a typed message with raw data
                const schemaId = extractSchemaId(msgLike) ?? 'unknown';
                const rawData = JSON.parse(new TextDecoder().decode(msg.data));
                return createTypedMessage(msg, rawData as A, schemaId);
              }
            }

            // Handle decode errors
            if (error._tag === 'CodecError' || error._tag === 'SchemaValidationError') {
              if (onDecodeError === 'skip') {
                msg.ack();
                return null;
              }
              if (onDecodeError === 'nak') {
                msg.nak();
                return null;
              }
            }

            return yield* Effect.fail(error);
          }

          // Auto-ack on successful decode
          msg.ack();
          return result.right;
        }),
      { concurrency, unordered: !ordered }
    ),
    // Filter out nulls (skipped messages)
    Stream.filter((msg): msg is TypedNatsMessage<A> => msg !== null)
  );
};

/**
 * Bridge with a known schema (faster - no header lookup)
 */
export const fromConsumerMessagesWithSchema = <A, I>(
  messages: ConsumerMessages,
  schema: Schema.Schema<A, I>,
  schemaId: string,
  options: { concurrency?: number; ordered?: boolean } = {}
): Stream.Stream<
  TypedNatsMessage<A>,
  ConsumerBridgeError | CodecError | SchemaValidationError,
  StreamCodecService
> => {
  const { concurrency = 1, ordered = true } = options;

  const rawStream = fromAsyncIterable<JsMsg, ConsumerBridgeError>(
    messages,
    (err) =>
      new ConsumerBridgeError({
        reason: 'Consumer iteration error',
        cause: err,
      }),
    () => {
      messages.stop?.();
    }
  );

  return rawStream.pipe(
    Stream.mapEffect(
      (msg) =>
        decodeJsMessageWithKnownSchema(msg, schema, schemaId).pipe(
          Effect.tap(() => Effect.sync(() => msg.ack()))
        ),
      { concurrency, unordered: !ordered }
    )
  );
};

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Mock JsMsg for testing
 */
export interface MockJsMsgOptions<A> {
  readonly data: A;
  readonly schemaId?: string;
  readonly seq?: number;
  readonly subject?: string;
}

const textEncoder = new TextEncoder();

/**
 * Create a mock JsMsg for testing
 */
export const createMockJsMsg = <A>(
  options: MockJsMsgOptions<A>
): JsMsg => {
  const { data, schemaId, seq = 1, subject = 'test.subject' } = options;

  const mockHeaders = schemaId
    ? {
        get: (key: string) => (key === HEADER_SCHEMA_ID ? schemaId : null),
        has: (key: string) => key === HEADER_SCHEMA_ID && !!schemaId,
        keys: () => (schemaId ? [HEADER_SCHEMA_ID] : []),
        values: () => [],
        set: () => {},
        append: () => {},
        delete: () => {},
        [Symbol.iterator]: () => [][Symbol.iterator](),
        size: () => (schemaId ? 1 : 0),
        equals: () => false,
        toString: () => '',
        encode: () => new Uint8Array(),
        findKeys: () => [],
        last: () => '',
        hasError: false,
        status: '',
        toRecord: () => ({}),
        code: 0,
        description: '',
      }
    : undefined;

  return {
    data: textEncoder.encode(JSON.stringify(data)),
    subject,
    seq,
    redelivered: false,
    sid: 0,
    headers: mockHeaders,
    info: {
      stream: 'test-stream',
      consumer: 'test-consumer',
      redeliveryCount: 0,
      redelivered: false,
      deliveryCount: 0,
      streamSequence: seq,
      deliverySequence: 1,
      timestampNanos: BigInt(Date.now()) * BigInt(1_000_000),
      pending: 0,
      domain: '',
    },
    ack: () => {},
    nak: () => {},
    working: () => {},
    term: () => {},
    next: () => {},
    ackAck: async () => true,
    json: <T>() => data as unknown as T,
    string: () => JSON.stringify(data),
  } as unknown as JsMsg;
};

/**
 * Create a mock ConsumerMessages async iterable for testing
 */
export const createMockConsumerMessages = (
  messages: JsMsg[]
): ConsumerMessages => {
  let stopped = false;

  return {
    [Symbol.asyncIterator]: async function* () {
      for (const msg of messages) {
        if (stopped) break;
        yield msg;
      }
    },
    stop: () => {
      stopped = true;
    },
    // Mock required ConsumerMessages properties
    status: async () => ({ type: 'mock' }),
    getProcessed: () => 0,
    getPending: () => 0,
    getReceived: () => messages.length,
    getConsumerSequence: () => 0,
    getNumPending: () => 0,
    getNumRedelivered: () => 0,
  } as unknown as ConsumerMessages;
};

/**
 * NATS Codec Service
 *
 * Stream-native, parallelizable codec service for NATS message encoding/decoding.
 *
 * @module @tmnl/msh/nats/codec
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as Chunk from 'effect/Chunk';
import * as Schema from 'effect/Schema';
import { pipe } from 'effect/Function';
import { Codec } from './errors';

// =============================================================================
// Type Definitions
// =============================================================================

export interface DecodeContext {
  readonly subject?: string;
  readonly seq?: number;
}

export interface BatchOptions {
  readonly concurrency?: number;
}

export interface EncodedItem<A> {
  readonly original: A;
  readonly bytes: Uint8Array;
}

export interface DecodedItem<A> {
  readonly original: Uint8Array;
  readonly value: A;
  readonly index: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsCodecServiceShape {
  readonly encodeJson: <S extends Schema.Top>(
    schema: S,
    data: S['Type'],
  ) => Effect.Effect<Uint8Array, Codec.EncodeError, S['EncodingServices']>;

  readonly decodeJson: <S extends Schema.Top>(
    schema: S,
    context?: DecodeContext,
  ) => (data: Uint8Array) => Effect.Effect<S['Type'], Codec.DecodeError, S['DecodingServices']>;

  readonly encodeJsonStream: <S extends Schema.Top>(
    schema: S,
    opts?: BatchOptions,
  ) => <E>(
    stream: Stream.Stream<S['Type'], E, S['EncodingServices']>,
  ) => Stream.Stream<EncodedItem<S['Type']>, E | Codec.EncodeError, S['EncodingServices']>;

  readonly decodeJsonStream: <S extends Schema.Top>(
    schema: S,
    context?: DecodeContext,
    opts?: BatchOptions,
  ) => <E>(
    stream: Stream.Stream<Uint8Array, E, S['DecodingServices']>,
  ) => Stream.Stream<S['Type'], E | Codec.DecodeError, S['DecodingServices']>;

  readonly encodeBatch: <S extends Schema.Top>(
    schema: S,
    items: Chunk.Chunk<S['Type']>,
    opts?: BatchOptions,
  ) => Effect.Effect<Chunk.Chunk<EncodedItem<S['Type']>>, Codec.EncodeError, S['EncodingServices']>;

  readonly decodeBatch: <S extends Schema.Top>(
    schema: S,
    items: Chunk.Chunk<Uint8Array>,
    context?: DecodeContext,
    opts?: BatchOptions,
  ) => Effect.Effect<Chunk.Chunk<DecodedItem<S['Type']>>, Codec.DecodeError, S['DecodingServices']>;
}

// =============================================================================
// Internal Codec Implementations
// =============================================================================

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const defaultConcurrency = 4;

const encodeJsonInternal = Effect.fnUntraced(
  function*<S extends Schema.Top>(schema: S, data: S['Type']) {
    const encoded = yield* Schema.encodeUnknownEffect(schema)(data).pipe(
      Effect.mapError(
        (err) => new Codec.EncodeError({ message: `Failed to encode value: ${err}`, cause: err }),
      ),
    );
    return textEncoder.encode(JSON.stringify(encoded));
  },
);

const decodeJsonInternal =
  <S extends Schema.Top>(schema: S, context?: DecodeContext) =>
  (data: Uint8Array): Effect.Effect<S['Type'], Codec.DecodeError, S['DecodingServices']> => {
    const contextStr = context?.subject
      ? ` on '${context.subject}'${context.seq !== undefined ? ` (seq: ${context.seq})` : ''}`
      : '';

    return Effect.fnUntraced(function*() {
      const json = yield* Effect.try({
        try: () => JSON.parse(textDecoder.decode(data)) as unknown,
        catch: (error) =>
          new Codec.DecodeError({
            message: `Failed to parse JSON${contextStr}: ${error}`,
            subject: context?.subject,
            cause: error,
          }),
      });
      return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
        Effect.mapError(
          (err) =>
            new Codec.DecodeError({
              message: `Schema validation failed${contextStr}: ${err}`,
              subject: context?.subject,
              cause: err,
            }),
        ),
      );
    })();
  };

const encodeBatchInternal = <S extends Schema.Top>(
  schema: S,
  items: Chunk.Chunk<S['Type']>,
  opts?: BatchOptions,
): Effect.Effect<Chunk.Chunk<EncodedItem<S['Type']>>, Codec.EncodeError, S['EncodingServices']> =>
  pipe(
    Stream.fromIterable(items),
    Stream.mapEffect(
      (item) =>
        pipe(
          encodeJsonInternal(schema, item),
          Effect.map((bytes): EncodedItem<S['Type']> => ({ original: item, bytes })),
        ),
      { concurrency: opts?.concurrency ?? defaultConcurrency },
    ),
    Stream.runCollect,
    Effect.map(Chunk.fromIterable),
  );

const decodeBatchInternal = <S extends Schema.Top>(
  schema: S,
  items: Chunk.Chunk<Uint8Array>,
  context?: DecodeContext,
  opts?: BatchOptions,
): Effect.Effect<Chunk.Chunk<DecodedItem<S['Type']>>, Codec.DecodeError, S['DecodingServices']> =>
  pipe(
    Stream.fromIterable(items),
    Stream.zipWithIndex,
    Stream.mapEffect(
      ([data, index]) =>
        pipe(
          decodeJsonInternal(schema, context)(data),
          Effect.map(
            (value): DecodedItem<S['Type']> => ({
              original: data,
              value,
              index,
            }),
          ),
        ),
      { concurrency: opts?.concurrency ?? defaultConcurrency },
    ),
    Stream.runCollect,
    Effect.map(Chunk.fromIterable),
  );

// =============================================================================
// Service Definition (v4 Context.Service)
// =============================================================================

export class NatsCodecService extends Context.Service<
  NatsCodecService,
  NatsCodecServiceShape
>()('@tmnl/msh/nats/Codec') {
  static readonly layer = Layer.succeed(NatsCodecService)({
    encodeJson: encodeJsonInternal,
    decodeJson: decodeJsonInternal,

    encodeJsonStream:
      (schema, opts) =>
      (stream) =>
        pipe(
          stream,
          Stream.mapEffect(
            (item: any) =>
              pipe(
                encodeJsonInternal(schema, item),
                Effect.map((bytes): EncodedItem<any> => ({ original: item, bytes })),
              ),
            { concurrency: opts?.concurrency ?? defaultConcurrency },
          ),
        ),

    decodeJsonStream:
      (schema, context, opts) =>
      (stream) =>
        pipe(
          stream,
          Stream.mapEffect(
            (data: Uint8Array) => decodeJsonInternal(schema, context)(data),
            { concurrency: opts?.concurrency ?? defaultConcurrency },
          ),
        ),

    encodeBatch: encodeBatchInternal,

    decodeBatch: decodeBatchInternal,
  });
}

// =============================================================================
// Static Codec (no service context needed)
// =============================================================================

export const NatsCodec = {
  encodeJson: encodeJsonInternal,
  decodeJson: decodeJsonInternal,
} as const;

export const NatsCodecServiceLive = NatsCodecService.layer;

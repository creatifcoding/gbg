/**
 * NATS Codec Service
 *
 * Stream-native, hyper-parallelizable codec service for NATS message encoding/decoding.
 * Uses Effect patterns: Stream, Chunk, Schema transforms for maximum performance.
 *
 * Features:
 * - Single-item encode/decode for simple use cases
 * - Stream transforms for pipeline integration
 * - Batch operations with configurable concurrency
 * - Schema-typed transformations with proper error handling
 *
 * Architecture:
 * - Schema.transform handles bidirectional Uint8Array ↔ JSON conversions
 * - Stream.mapEffect with concurrency for parallel batch processing
 * - Chunk-aware operations for optimal throughput
 *
 * @module holonet/nats/codec
 */

import { Effect, Stream, Chunk, Schema, pipe } from 'effect';
import type { ParseResult } from 'effect';
import { Codec } from './errors';

// =============================================================================
// Type Definitions
// =============================================================================

/** Context for decode operations - improves error messages */
export interface DecodeContext {
  /** Subject the message came from */
  readonly subject?: string;
  /** Sequence number (for JetStream) */
  readonly seq?: number;
}

/** Options for batch operations */
export interface BatchOptions {
  /** Concurrency level for parallel processing (default: 4) */
  readonly concurrency?: number;
}

/** Result of a batch encode operation */
export interface EncodedItem<A> {
  /** Original value */
  readonly original: A;
  /** Encoded bytes */
  readonly bytes: Uint8Array;
}

/** Result of a batch decode operation */
export interface DecodedItem<A> {
  /** Original bytes */
  readonly original: Uint8Array;
  /** Decoded value */
  readonly value: A;
  /** Index in the original batch */
  readonly index: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsCodecServiceShape {
  // ─── Single-Item Operations ──────────────────────────────────────────────────

  /**
   * Encode a single value to Uint8Array using Schema.
   *
   * @param schema - Schema for encoding
   * @param data - Value to encode
   * @returns Effect with encoded Uint8Array
   */
  readonly encodeJson: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    data: A
  ) => Effect.Effect<Uint8Array, Codec.EncodeError, R>;

  /**
   * Decode a single Uint8Array to typed value using Schema.
   *
   * @param schema - Schema for decoding
   * @param context - Optional context for error messages
   * @returns Function that takes bytes and returns Effect with decoded value
   */
  readonly decodeJson: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    context?: DecodeContext
  ) => (data: Uint8Array) => Effect.Effect<A, Codec.DecodeError, R>;

  // ─── Stream Transforms ───────────────────────────────────────────────────────

  /**
   * Create a Stream transform for encoding values to Uint8Array.
   *
   * @param schema - Schema for encoding
   * @param opts - Batch options (concurrency)
   * @returns Stream transformation function
   *
   * @example
   * ```typescript
   * const encoded = sourceStream.pipe(
   *   codec.encodeJsonStream(MySchema, { concurrency: 8 })
   * );
   * ```
   */
  readonly encodeJsonStream: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    opts?: BatchOptions
  ) => <E>(
    stream: Stream.Stream<A, E, R>
  ) => Stream.Stream<EncodedItem<A>, E | Codec.EncodeError, R>;

  /**
   * Create a Stream transform for decoding Uint8Array to typed values.
   *
   * @param schema - Schema for decoding
   * @param context - Optional context for error messages
   * @param opts - Batch options (concurrency)
   * @returns Stream transformation function
   *
   * @example
   * ```typescript
   * const decoded = bytesStream.pipe(
   *   codec.decodeJsonStream(MySchema, { subject: 'test' }, { concurrency: 8 })
   * );
   * ```
   */
  readonly decodeJsonStream: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    context?: DecodeContext,
    opts?: BatchOptions
  ) => <E>(
    stream: Stream.Stream<Uint8Array, E, R>
  ) => Stream.Stream<A, E | Codec.DecodeError, R>;

  // ─── Batch Operations ────────────────────────────────────────────────────────

  /**
   * Encode a batch of values in parallel.
   *
   * @param schema - Schema for encoding
   * @param items - Chunk of values to encode
   * @param opts - Batch options (concurrency)
   * @returns Effect with Chunk of encoded items
   */
  readonly encodeBatch: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    items: Chunk.Chunk<A>,
    opts?: BatchOptions
  ) => Effect.Effect<Chunk.Chunk<EncodedItem<A>>, Codec.EncodeError, R>;

  /**
   * Decode a batch of Uint8Arrays in parallel.
   *
   * @param schema - Schema for decoding
   * @param items - Chunk of bytes to decode
   * @param context - Optional context for error messages
   * @param opts - Batch options (concurrency)
   * @returns Effect with Chunk of decoded items
   */
  readonly decodeBatch: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    items: Chunk.Chunk<Uint8Array>,
    context?: DecodeContext,
    opts?: BatchOptions
  ) => Effect.Effect<Chunk.Chunk<DecodedItem<A>>, Codec.DecodeError, R>;
}

// =============================================================================
// Internal Codec Implementations
// =============================================================================

// Shared encoder/decoder instances (avoid creating per-call)
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Internal: Encode a value to JSON Uint8Array using Schema.
 * Uses Schema.encode to get the wire format, then JSON.stringify + TextEncoder.
 */
const encodeJsonInternal = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  data: A
): Effect.Effect<Uint8Array, Codec.EncodeError, R> =>
  pipe(
    Schema.encode(schema)(data),
    Effect.map((encoded) => {
      const json = JSON.stringify(encoded);
      return textEncoder.encode(json);
    }),
    Effect.mapError(
      (parseError: ParseResult.ParseError) =>
        new Codec.EncodeError({
          message: `Failed to encode value: ${parseError.message}`,
          cause: parseError,
        })
    )
  );

/**
 * Internal: Decode a Uint8Array to typed value using Schema.
 * Uses TextDecoder + JSON.parse, then Schema.decodeUnknown.
 */
const decodeJsonInternal =
  <A, I, R>(schema: Schema.Schema<A, I, R>, context?: DecodeContext) =>
  (data: Uint8Array): Effect.Effect<A, Codec.DecodeError, R> => {
    const contextStr = context?.subject
      ? ` on '${context.subject}'${context.seq !== undefined ? ` (seq: ${context.seq})` : ''}`
      : '';

    return pipe(
      // Step 1: Decode UTF-8 bytes to string, then parse JSON
      Effect.try({
        try: () => {
          const text = textDecoder.decode(data);
          return JSON.parse(text) as I;
        },
        catch: (error) =>
          new Codec.DecodeError({
            message: `Failed to parse JSON${contextStr}: ${error}`,
            subject: context?.subject,
            cause: error,
          }),
      }),
      // Step 2: Validate against schema
      Effect.flatMap((json) =>
        pipe(
          Schema.decodeUnknown(schema)(json),
          Effect.mapError(
            (parseError: ParseResult.ParseError) =>
              new Codec.DecodeError({
                message: `Schema validation failed${contextStr}: ${parseError.message}`,
                subject: context?.subject,
                cause: parseError,
              })
          )
        )
      )
    );
  };

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsCodecService extends Effect.Service<NatsCodecService>()(
  'holonet/nats/Codec',
  {
    effect: Effect.gen(function* () {
      const defaultConcurrency = 4;

      // ─────────────────────────────────────────────────────────────────────────
      // SINGLE-ITEM OPERATIONS
      // ─────────────────────────────────────────────────────────────────────────

      const encodeJson = <A, I, R>(
        schema: Schema.Schema<A, I, R>,
        data: A
      ): Effect.Effect<Uint8Array, Codec.EncodeError, R> =>
        encodeJsonInternal(schema, data);

      const decodeJson =
        <A, I, R>(schema: Schema.Schema<A, I, R>, context?: DecodeContext) =>
        (data: Uint8Array): Effect.Effect<A, Codec.DecodeError, R> =>
          decodeJsonInternal(schema, context)(data);

      // ─────────────────────────────────────────────────────────────────────────
      // STREAM TRANSFORMS
      // ─────────────────────────────────────────────────────────────────────────

      const encodeJsonStream =
        <A, I, R>(schema: Schema.Schema<A, I, R>, opts?: BatchOptions) =>
        <E>(
          stream: Stream.Stream<A, E, R>
        ): Stream.Stream<EncodedItem<A>, E | Codec.EncodeError, R> =>
          pipe(
            stream,
            Stream.mapEffect(
              (item) =>
                pipe(
                  encodeJsonInternal(schema, item),
                  Effect.map(
                    (bytes): EncodedItem<A> => ({
                      original: item,
                      bytes,
                    })
                  )
                ),
              { concurrency: opts?.concurrency ?? defaultConcurrency }
            )
          );

      const decodeJsonStream =
        <A, I, R>(
          schema: Schema.Schema<A, I, R>,
          context?: DecodeContext,
          opts?: BatchOptions
        ) =>
        <E>(
          stream: Stream.Stream<Uint8Array, E, R>
        ): Stream.Stream<A, E | Codec.DecodeError, R> =>
          pipe(
            stream,
            Stream.mapEffect((data) => decodeJsonInternal(schema, context)(data), {
              concurrency: opts?.concurrency ?? defaultConcurrency,
            })
          );

      // ─────────────────────────────────────────────────────────────────────────
      // BATCH OPERATIONS
      // ─────────────────────────────────────────────────────────────────────────

      const encodeBatch = <A, I, R>(
        schema: Schema.Schema<A, I, R>,
        items: Chunk.Chunk<A>,
        opts?: BatchOptions
      ): Effect.Effect<Chunk.Chunk<EncodedItem<A>>, Codec.EncodeError, R> =>
        pipe(
          Stream.fromChunk(items),
          encodeJsonStream(schema, opts),
          Stream.runCollect
        );

      const decodeBatch = <A, I, R>(
        schema: Schema.Schema<A, I, R>,
        items: Chunk.Chunk<Uint8Array>,
        context?: DecodeContext,
        opts?: BatchOptions
      ): Effect.Effect<Chunk.Chunk<DecodedItem<A>>, Codec.DecodeError, R> =>
        pipe(
          Stream.fromChunk(items),
          Stream.zipWithIndex,
          Stream.mapEffect(
            ([data, index]) =>
              pipe(
                decodeJsonInternal(schema, context)(data),
                Effect.map(
                  (value): DecodedItem<A> => ({
                    original: data,
                    value,
                    index,
                  })
                )
              ),
            { concurrency: opts?.concurrency ?? defaultConcurrency }
          ),
          Stream.runCollect
        );

      return {
        encodeJson,
        decodeJson,
        encodeJsonStream,
        decodeJsonStream,
        encodeBatch,
        decodeBatch,
      } satisfies NatsCodecServiceShape;
    }),
  }
) {}

// =============================================================================
// Legacy API Compatibility (Static Functions)
// =============================================================================

/**
 * Static codec functions for use without service context.
 * These are equivalent to the NatsCodecService methods but don't require
 * the service layer. Useful for simple use cases.
 *
 * @example
 * ```typescript
 * // Without service
 * const bytes = yield* NatsCodec.encodeJson(MySchema, data);
 * const value = yield* NatsCodec.decodeJson(MySchema, { subject })(bytes);
 *
 * // With service (preferred for batch/stream operations)
 * const codec = yield* NatsCodecService;
 * const decoded = yield* codec.decodeBatch(MySchema, chunk, ctx, { concurrency: 8 });
 * ```
 */
export const NatsCodec = {
  /**
   * Encode a value using a schema, then converts to JSON Uint8Array.
   */
  encodeJson: encodeJsonInternal,

  /**
   * Decode a Uint8Array as JSON, then validate against a schema.
   */
  decodeJson: decodeJsonInternal,
} as const;

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsCodecServiceLive = NatsCodecService.Default;

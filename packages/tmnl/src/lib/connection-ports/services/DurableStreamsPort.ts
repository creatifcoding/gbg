/**
 * DurableStreamsPort Effect.Service
 *
 * Effect service for Durable Streams HTTP-based replay and append.
 *
 * @module connection-ports/services/DurableStreamsPort
 */

import { Context, Effect, Layer, Stream, Schema, Ref } from 'effect';
import type { DurableStreamsConfig, StreamOffset } from '../schemas/connection';
import { PortStatus } from '../schemas/status';
import {
  DurableStreamsConnectionError,
  DurableStreamsReadError,
  DurableStreamsAppendError,
} from '../schemas/errors';

// =============================================================================
// Stream Metadata
// =============================================================================

/**
 * Metadata about a durable stream.
 */
export interface StreamMetadata {
  /** Stream URL */
  readonly url: string;

  /** First available offset */
  readonly firstOffset: string;

  /** Last available offset */
  readonly lastOffset: string;

  /** Total message count */
  readonly messageCount: number;

  /** Total bytes stored */
  readonly bytesStored: number;

  /** Stream creation time */
  readonly createdAt: Date;

  /** Last append time */
  readonly lastAppendAt: Date | null;
}

// =============================================================================
// Append Result
// =============================================================================

/**
 * Result of appending to a durable stream.
 */
export interface AppendResult {
  /** Offset of the appended message */
  readonly offset: string;

  /** Sequence number */
  readonly sequence: number;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * DurableStreamsPort service interface.
 * Provides HTTP-based durable stream operations.
 */
export interface DurableStreamsPortShape {
  /**
   * Get current port status.
   */
  readonly status: Effect.Effect<PortStatus>;

  /**
   * Read messages from a stream starting at offset.
   */
  readonly read: <A>(
    streamUrl: string,
    offset: string,
    schema: Schema.Schema<A>,
    limit?: number
  ) => Stream.Stream<{ offset: string; data: A }, DurableStreamsReadError>;

  /**
   * Append a message to a stream.
   */
  readonly append: <A>(
    streamUrl: string,
    value: A,
    schema: Schema.Schema<A>
  ) => Effect.Effect<AppendResult, DurableStreamsAppendError>;

  /**
   * Catch up from offset then tail live updates.
   * Combines historical replay with live following.
   */
  readonly catchUpAndTail: <A>(
    streamUrl: string,
    fromOffset: string,
    schema: Schema.Schema<A>
  ) => Stream.Stream<{ offset: string; data: A }, DurableStreamsReadError>;

  /**
   * Get stream metadata.
   */
  readonly metadata: (
    streamUrl: string
  ) => Effect.Effect<StreamMetadata, DurableStreamsConnectionError>;

  /**
   * Check if stream exists.
   */
  readonly exists: (
    streamUrl: string
  ) => Effect.Effect<boolean, DurableStreamsConnectionError>;

  /**
   * Create a new stream.
   */
  readonly create: (
    streamUrl: string
  ) => Effect.Effect<void, DurableStreamsAppendError>;

  /**
   * Connect to durable streams server.
   */
  readonly connect: Effect.Effect<void, DurableStreamsConnectionError>;

  /**
   * Disconnect from server.
   */
  readonly disconnect: Effect.Effect<void>;
}

// =============================================================================
// Context Tag
// =============================================================================

export class DurableStreamsPort extends Context.Tag('tmnl/ports/DurableStreamsPort')<
  DurableStreamsPort,
  DurableStreamsPortShape
>() {}

// =============================================================================
// Configuration Tag
// =============================================================================

export class DurableStreamsPortConfig extends Context.Tag('tmnl/ports/DurableStreamsPortConfig')<
  DurableStreamsPortConfig,
  DurableStreamsConfig
>() {}

// =============================================================================
// Mock Implementation
// =============================================================================

/**
 * Mock DurableStreamsPort implementation for development.
 * Simulates durable streams behavior without actual server.
 */
export const DurableStreamsPortMock = Layer.effect(
  DurableStreamsPort,
  Effect.gen(function* () {
    const statusRef = yield* Ref.make(PortStatus.Disconnected);

    // In-memory stream storage for mock
    const streams = new Map<string, { messages: Array<{ offset: string; data: unknown }>; nextSeq: number }>();

    const getOrCreateStream = (url: string) => {
      let stream = streams.get(url);
      if (!stream) {
        stream = { messages: [], nextSeq: 0 };
        streams.set(url, stream);
      }
      return stream;
    };

    return {
      status: Ref.get(statusRef),

      read: <A>(
        streamUrl: string,
        offset: string,
        schema: Schema.Schema<A>,
        limit = 100
      ) =>
        Stream.fromIterable(
          getOrCreateStream(streamUrl)
            .messages.filter((m) => m.offset >= offset)
            .slice(0, limit)
            .map((m) => ({ offset: m.offset, data: m.data as A }))
        ),

      append: <A>(streamUrl: string, value: A, schema: Schema.Schema<A>) =>
        Effect.gen(function* () {
          const stream = getOrCreateStream(streamUrl);
          const sequence = stream.nextSeq++;
          const offset = String(sequence).padStart(20, '0');

          const encoded = yield* Schema.encode(schema)(value);
          stream.messages.push({ offset, data: encoded });

          return { offset, sequence };
        }).pipe(
          Effect.mapError(
            (cause) =>
              new DurableStreamsAppendError({
                streamUrl,
                message: 'Failed to append message',
                cause,
              })
          ),
          Effect.withSpan('DurableStreamsPort.append.mock')
        ),

      catchUpAndTail: <A>(
        streamUrl: string,
        fromOffset: string,
        schema: Schema.Schema<A>
      ) =>
        Stream.fromIterable(
          getOrCreateStream(streamUrl)
            .messages.filter((m) => m.offset >= fromOffset)
            .map((m) => ({ offset: m.offset, data: m.data as A }))
        ),

      metadata: (streamUrl: string) =>
        Effect.gen(function* () {
          const stream = getOrCreateStream(streamUrl);
          const now = new Date();

          return {
            url: streamUrl,
            firstOffset: stream.messages[0]?.offset ?? '0',
            lastOffset: stream.messages[stream.messages.length - 1]?.offset ?? '0',
            messageCount: stream.messages.length,
            bytesStored: 0,
            createdAt: now,
            lastAppendAt: stream.messages.length > 0 ? now : null,
          } satisfies StreamMetadata;
        }).pipe(Effect.withSpan('DurableStreamsPort.metadata.mock')),

      exists: (streamUrl: string) =>
        Effect.succeed(streams.has(streamUrl)),

      create: (streamUrl: string) =>
        Effect.sync(() => {
          getOrCreateStream(streamUrl);
        }).pipe(Effect.withSpan('DurableStreamsPort.create.mock')),

      connect: Effect.gen(function* () {
        yield* Effect.sleep('100 millis');
        yield* Ref.set(statusRef, PortStatus.Disconnected.withState('connected'));
      }).pipe(Effect.withSpan('DurableStreamsPort.connect.mock')),

      disconnect: Effect.gen(function* () {
        yield* Ref.set(statusRef, PortStatus.Disconnected);
      }),
    } satisfies DurableStreamsPortShape;
  })
);

// =============================================================================
// Default Layer
// =============================================================================

/**
 * Default DurableStreamsPort layer.
 * Uses mock implementation until real server integration is available.
 */
export const DurableStreamsPortLive = DurableStreamsPortMock;

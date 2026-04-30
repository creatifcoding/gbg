/**
 * Durable-Streams Event Schemas
 *
 * Event definitions for observability and auditing.
 * Uses @effect/experimental EventLog for structured event emission.
 *
 * @module holonet/durable-streams/events/schemas
 */

import { EventGroup, EventLog } from '@effect/experimental';
import { Schema } from 'effect';

// =============================================================================
// Stream Events
// =============================================================================

export const StreamEvents = EventGroup.empty
  .add({
    tag: 'StreamCreated',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      schemaId: Schema.NullOr(Schema.String),
      contentType: Schema.String,
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamAppended',
    primaryKey: (p) => `${p.streamId}:${p.seq}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      seq: Schema.Number,
      schemaId: Schema.NullOr(Schema.String),
      byteSize: Schema.NullOr(Schema.Number),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamRead',
    primaryKey: (p) => `${p.streamId}:${p.offset}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      offset: Schema.Number,
      count: Schema.Number,
      clientId: Schema.NullOr(Schema.String),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'StreamDeleted',
    primaryKey: (p) => p.streamId,
    payload: Schema.Struct({
      streamId: Schema.String,
      messageCount: Schema.Number,
      timestamp: Schema.Number,
    }),
  });

// =============================================================================
// Live Stream Events
// =============================================================================

export const LiveStreamEvents = EventGroup.empty
  .add({
    tag: 'LongPollCompleted',
    primaryKey: (p) => `${p.streamId}:${p.offset}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      offset: Schema.Number,
      count: Schema.Number,
      waitTimeMs: Schema.Number,
      timedOut: Schema.Boolean,
      clientId: Schema.NullOr(Schema.String),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'SSEConnectionStarted',
    primaryKey: (p) => `${p.streamId}:${p.clientId ?? 'anon'}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      offset: Schema.Number,
      clientId: Schema.NullOr(Schema.String),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'SSEMessageSent',
    primaryKey: (p) => `${p.streamId}:${p.seq}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      seq: Schema.Number,
      eventType: Schema.Literal('data', 'heartbeat'),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'SSEConnectionEnded',
    primaryKey: (p) => `${p.streamId}:${p.clientId ?? 'anon'}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      messagesDelivered: Schema.Number,
      durationMs: Schema.Number,
      clientId: Schema.NullOr(Schema.String),
      reason: Schema.Literal('client_disconnect', 'error', 'stream_ended'),
      timestamp: Schema.Number,
    }),
  })
  .add({
    tag: 'SubscribeStarted',
    primaryKey: (p) => `${p.streamId}:${p.clientId ?? 'anon'}`,
    payload: Schema.Struct({
      streamId: Schema.String,
      offset: Schema.Number,
      bufferCapacity: Schema.Number,
      clientId: Schema.NullOr(Schema.String),
      timestamp: Schema.Number,
    }),
  });

// =============================================================================
// Error Events
// =============================================================================

export const ErrorEvents = EventGroup.empty.add({
  tag: 'StreamError',
  primaryKey: (p) => `${p.streamId}:${p.timestamp}`,
  payload: Schema.Struct({
    streamId: Schema.String,
    operation: Schema.Literal('create', 'append', 'read', 'delete', 'longPoll', 'sse', 'subscribe'),
    errorTag: Schema.String,
    errorMessage: Schema.String,
    timestamp: Schema.Number,
  }),
});

// =============================================================================
// Combined EventLog Schema
// =============================================================================

/**
 * Combined EventLog schema for all durable-streams events.
 */
export const DurableStreamsEventLogSchema = EventLog.schema(
  StreamEvents,
  LiveStreamEvents,
  ErrorEvents
);

// =============================================================================
// Payload Types
// =============================================================================

export type StreamCreatedPayload = {
  readonly streamId: string;
  readonly schemaId: string | null;
  readonly contentType: string;
  readonly timestamp: number;
};

export type StreamAppendedPayload = {
  readonly streamId: string;
  readonly seq: number;
  readonly schemaId: string | null;
  readonly byteSize: number | null;
  readonly timestamp: number;
};

export type StreamReadPayload = {
  readonly streamId: string;
  readonly offset: number;
  readonly count: number;
  readonly clientId: string | null;
  readonly timestamp: number;
};

export type StreamDeletedPayload = {
  readonly streamId: string;
  readonly messageCount: number;
  readonly timestamp: number;
};

export type LongPollCompletedPayload = {
  readonly streamId: string;
  readonly offset: number;
  readonly count: number;
  readonly waitTimeMs: number;
  readonly timedOut: boolean;
  readonly clientId: string | null;
  readonly timestamp: number;
};

export type SSEConnectionStartedPayload = {
  readonly streamId: string;
  readonly offset: number;
  readonly clientId: string | null;
  readonly timestamp: number;
};

export type SSEMessageSentPayload = {
  readonly streamId: string;
  readonly seq: number;
  readonly eventType: 'data' | 'heartbeat';
  readonly timestamp: number;
};

export type SSEConnectionEndedPayload = {
  readonly streamId: string;
  readonly messagesDelivered: number;
  readonly durationMs: number;
  readonly clientId: string | null;
  readonly reason: 'client_disconnect' | 'error' | 'stream_ended';
  readonly timestamp: number;
};

export type SubscribeStartedPayload = {
  readonly streamId: string;
  readonly offset: number;
  readonly bufferCapacity: number;
  readonly clientId: string | null;
  readonly timestamp: number;
};

export type StreamErrorPayload = {
  readonly streamId: string;
  readonly operation: 'create' | 'append' | 'read' | 'delete' | 'longPoll' | 'sse' | 'subscribe';
  readonly errorTag: string;
  readonly errorMessage: string;
  readonly timestamp: number;
};

// =============================================================================
// Reactivity Keys
// =============================================================================

/**
 * Reactivity keys for durable-streams events
 */
export const Keys = {
  streamCreated: 'durable-streams.stream.created',
  streamAppended: 'durable-streams.stream.appended',
  streamRead: 'durable-streams.stream.read',
  streamDeleted: 'durable-streams.stream.deleted',
  longPollCompleted: 'durable-streams.longpoll.completed',
  sseConnection: 'durable-streams.sse.connection',
  sseMessage: 'durable-streams.sse.message',
  subscribe: 'durable-streams.subscribe',
  error: 'durable-streams.error',
} as const;

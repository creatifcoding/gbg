/**
 * Port Status Schemas
 *
 * Effect Schema definitions for connection and stream status tracking.
 *
 * @module connection-ports/schemas/status
 */

import { Schema } from 'effect';
import type { StreamId } from './connection';

// =============================================================================
// Connection Status
// =============================================================================

/**
 * Connection state enumeration.
 */
export const ConnectionState = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'error'
);
export type ConnectionState = typeof ConnectionState.Type;

/**
 * Port-level status for NATS or Durable Streams.
 */
export class PortStatus extends Schema.TaggedClass<PortStatus>()('PortStatus', {
  /** Current connection state */
  state: ConnectionState,

  /** Connected since timestamp (null if not connected) */
  connectedSince: Schema.NullOr(Schema.DateFromSelf),

  /** Last error message (null if no error) */
  lastError: Schema.NullOr(Schema.String),

  /** Number of reconnection attempts */
  reconnectAttempts: Schema.Number,

  /** Latency in milliseconds (from last ping) */
  latencyMs: Schema.NullOr(Schema.Number),
}) {
  static readonly Disconnected = new PortStatus({
    state: 'disconnected',
    connectedSince: null,
    lastError: null,
    reconnectAttempts: 0,
    latencyMs: null,
  });

  isConnected(): boolean {
    return this.state === 'connected';
  }

  isHealthy(): boolean {
    return this.state === 'connected' && this.lastError === null;
  }

  withState(state: ConnectionState): PortStatus {
    return new PortStatus({
      ...this,
      state,
      connectedSince: state === 'connected' ? new Date() : this.connectedSince,
    });
  }

  withError(error: string): PortStatus {
    return new PortStatus({
      ...this,
      state: 'error',
      lastError: error,
    });
  }
}

// =============================================================================
// Stream Status
// =============================================================================

/**
 * Stream subscription state enumeration.
 */
export const StreamState = Schema.Literal(
  'idle',
  'subscribing',
  'active',
  'paused',
  'error',
  'closed'
);
export type StreamState = typeof StreamState.Type;

/**
 * Individual stream subscription status.
 */
export class StreamStatus extends Schema.TaggedClass<StreamStatus>()(
  'StreamStatus',
  {
    /** Stream identifier */
    streamId: Schema.String,

    /** Current stream state */
    state: StreamState,

    /** Total messages received */
    messagesReceived: Schema.Number,

    /** Bytes received */
    bytesReceived: Schema.Number,

    /** Last message timestamp */
    lastMessageAt: Schema.NullOr(Schema.DateFromSelf),

    /** Current offset (for durable streams) */
    currentOffset: Schema.NullOr(Schema.String),

    /** Last error message */
    lastError: Schema.NullOr(Schema.String),

    /** Subscription started timestamp */
    startedAt: Schema.NullOr(Schema.DateFromSelf),
  }
) {
  static empty(streamId: string): StreamStatus {
    return new StreamStatus({
      streamId,
      state: 'idle',
      messagesReceived: 0,
      bytesReceived: 0,
      lastMessageAt: null,
      currentOffset: null,
      lastError: null,
      startedAt: null,
    });
  }

  isActive(): boolean {
    return this.state === 'active';
  }

  withMessage(bytes: number, offset?: string): StreamStatus {
    return new StreamStatus({
      ...this,
      messagesReceived: this.messagesReceived + 1,
      bytesReceived: this.bytesReceived + bytes,
      lastMessageAt: new Date(),
      currentOffset: offset ?? this.currentOffset,
    });
  }

  withState(state: StreamState): StreamStatus {
    return new StreamStatus({
      ...this,
      state,
      startedAt: state === 'active' ? new Date() : this.startedAt,
    });
  }

  withError(error: string): StreamStatus {
    return new StreamStatus({
      ...this,
      state: 'error',
      lastError: error,
    });
  }
}

// =============================================================================
// Aggregate Status
// =============================================================================

/**
 * Combined status for all connection ports.
 */
export class ConnectionPortsStatus extends Schema.TaggedClass<ConnectionPortsStatus>()(
  'ConnectionPortsStatus',
  {
    /** NATS port status */
    nats: PortStatus,

    /** Durable Streams port status */
    durableStreams: PortStatus,

    /** Active stream subscriptions */
    streams: Schema.Record({ key: Schema.String, value: StreamStatus }),

    /** Last status update */
    updatedAt: Schema.DateFromSelf,
  }
) {
  static readonly Initial = new ConnectionPortsStatus({
    nats: PortStatus.Disconnected,
    durableStreams: PortStatus.Disconnected,
    streams: {},
    updatedAt: new Date(),
  });

  isFullyConnected(): boolean {
    return this.nats.isConnected() && this.durableStreams.isConnected();
  }

  activeStreamCount(): number {
    return Object.values(this.streams).filter((s) => s.isActive()).length;
  }
}

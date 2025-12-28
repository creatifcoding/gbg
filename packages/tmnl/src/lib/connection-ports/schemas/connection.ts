/**
 * Connection Configuration Schemas
 *
 * Effect Schema definitions for connection ports configuration.
 *
 * @module connection-ports/schemas/connection
 */

import { Schema } from 'effect';

// =============================================================================
// Branded Types
// =============================================================================

/**
 * Stream identifier with namespace prefix.
 * Example: "tmnl.ava.artifacts.map-view"
 */
export const StreamId = Schema.String.pipe(
  Schema.brand('StreamId'),
  Schema.pattern(/^[a-z0-9._-]+$/i)
);
export type StreamId = typeof StreamId.Type;

/**
 * NATS subject pattern for subscriptions.
 * Supports wildcards: * (single token), > (multi-token)
 */
export const NatsSubject = Schema.String.pipe(
  Schema.brand('NatsSubject'),
  Schema.minLength(1)
);
export type NatsSubject = typeof NatsSubject.Type;

/**
 * Durable Streams URL for HTTP-based replay.
 */
export const DurableStreamUrl = Schema.String.pipe(
  Schema.brand('DurableStreamUrl'),
  Schema.pattern(/^https?:\/\/.+$/)
);
export type DurableStreamUrl = typeof DurableStreamUrl.Type;

/**
 * Offset for durable stream positioning.
 * Format: numeric string or special value "latest", "earliest"
 */
export const StreamOffset = Schema.Union(
  Schema.String.pipe(Schema.pattern(/^\d+$/)),
  Schema.Literal('latest', 'earliest')
).pipe(Schema.brand('StreamOffset'));
export type StreamOffset = typeof StreamOffset.Type;

// =============================================================================
// NATS Configuration
// =============================================================================

/**
 * NATS connection configuration.
 */
export class NatsConfig extends Schema.TaggedClass<NatsConfig>()('NatsConfig', {
  /** NATS server URL(s) */
  servers: Schema.Array(Schema.String),

  /** Connection name for debugging */
  name: Schema.optional(Schema.String),

  /** Reconnect attempts (-1 for infinite) */
  maxReconnectAttempts: Schema.optional(Schema.Number),

  /** Reconnect delay in milliseconds */
  reconnectDelayMs: Schema.optional(Schema.Number),

  /** JWT authentication token */
  jwt: Schema.optional(Schema.String),

  /** NKey seed for authentication */
  nkeySeed: Schema.optional(Schema.String),
}) {
  static readonly Default = new NatsConfig({
    servers: ['nats://localhost:4222'],
    maxReconnectAttempts: -1,
    reconnectDelayMs: 1000,
  });
}

// =============================================================================
// Durable Streams Configuration
// =============================================================================

/**
 * Durable Streams server configuration.
 */
export class DurableStreamsConfig extends Schema.TaggedClass<DurableStreamsConfig>()(
  'DurableStreamsConfig',
  {
    /** Base URL for durable streams HTTP API */
    baseUrl: Schema.String,

    /** Request timeout in milliseconds */
    timeoutMs: Schema.optional(Schema.Number),

    /** Enable automatic retry on failure */
    retryEnabled: Schema.optional(Schema.Boolean),

    /** Maximum retry attempts */
    maxRetries: Schema.optional(Schema.Number),
  }
) {
  static readonly Default = new DurableStreamsConfig({
    baseUrl: 'http://localhost:8080',
    timeoutMs: 30000,
    retryEnabled: true,
    maxRetries: 3,
  });
}

// =============================================================================
// Combined Connection Configuration
// =============================================================================

/**
 * Complete connection ports configuration.
 */
export class ConnectionConfig extends Schema.TaggedClass<ConnectionConfig>()(
  'ConnectionConfig',
  {
    /** NATS configuration */
    nats: NatsConfig,

    /** Durable Streams configuration */
    durableStreams: DurableStreamsConfig,

    /** Enable debug logging */
    debug: Schema.optional(Schema.Boolean),

    /** Default replay behavior for new subscriptions */
    defaultReplay: Schema.optional(Schema.Boolean),
  }
) {
  static readonly Default = new ConnectionConfig({
    nats: NatsConfig.Default,
    durableStreams: DurableStreamsConfig.Default,
    debug: false,
    defaultReplay: false,
  });
}

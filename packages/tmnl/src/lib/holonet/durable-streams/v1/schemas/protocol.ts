/**
 * Durable-Streams Protocol Schemas
 *
 * HTTP API request/response schemas following the durable-streams protocol.
 * These schemas define the wire format for client-server communication.
 *
 * @module holonet/durable-streams/schemas/protocol
 */

import { Schema } from 'effect';

// =============================================================================
// Stream Configuration
// =============================================================================

/**
 * Stream creation configuration
 */
export const StreamConfig = Schema.Struct({
  /** Content-Type with optional schema parameter */
  contentType: Schema.String.pipe(
    Schema.annotations({
      description: 'MIME type with optional schema parameter',
      examples: ['application/json; schema=BlockEvent'],
    })
  ),
  /** Optional retention policy */
  retention: Schema.optional(
    Schema.Literal('limits', 'interest', 'workqueue').pipe(
      Schema.annotations({
        description: 'Message retention policy',
      })
    )
  ),
  /** Optional max age in milliseconds */
  maxAge: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum message age in milliseconds',
      })
    )
  ),
  /** Optional max messages */
  maxMessages: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.int(),
      Schema.annotations({
        description: 'Maximum number of messages to retain',
      })
    )
  ),
  /** Optional max bytes */
  maxBytes: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.int(),
      Schema.annotations({
        description: 'Maximum stream size in bytes',
      })
    )
  ),
});

export type StreamConfig = typeof StreamConfig.Type;

// =============================================================================
// Stream Metadata
// =============================================================================

/**
 * Stream metadata returned by HEAD request
 */
export const StreamMetadata = Schema.Struct({
  /** Stream identifier */
  id: Schema.String,
  /** Content-Type header value */
  contentType: Schema.String,
  /** Schema ID if declared */
  schemaId: Schema.optional(Schema.String),
  /** Stream creation timestamp */
  createdAt: Schema.Number,
  /** Last message timestamp */
  lastMessageAt: Schema.optional(Schema.Number),
  /** Current message count */
  messageCount: Schema.Number,
  /** First sequence number */
  firstSeq: Schema.Number,
  /** Last sequence number */
  lastSeq: Schema.Number,
  /** Total bytes stored */
  bytes: Schema.Number,
});

export type StreamMetadata = typeof StreamMetadata.Type;

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Read request parameters
 */
export const ReadParams = Schema.Struct({
  /** Starting offset (-1 for beginning, -2 for end) */
  offset: Schema.Union(
    Schema.Number.pipe(Schema.int()),
    Schema.Literal('-1', '-2')
  ).pipe(
    Schema.annotations({
      description: 'Starting offset. -1 = beginning, -2 = end (live only)',
    })
  ),
  /** Maximum messages to return */
  limit: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.int(),
      Schema.annotations({
        description: 'Maximum messages to return (default: 100)',
      })
    )
  ),
  /** Live mode: long-poll or sse */
  live: Schema.optional(
    Schema.Literal('long-poll', 'sse').pipe(
      Schema.annotations({
        description: 'Live streaming mode',
      })
    )
  ),
  /** Long-poll timeout in milliseconds */
  timeout: Schema.optional(
    Schema.Number.pipe(
      Schema.positive(),
      Schema.annotations({
        description: 'Long-poll timeout in milliseconds (default: 30000)',
      })
    )
  ),
});

export type ReadParams = typeof ReadParams.Type;

/**
 * Single message in read response
 */
export const StreamMessage = Schema.Struct({
  /** Sequence number */
  seq: Schema.Number.pipe(Schema.int()),
  /** Message data (decoded) */
  data: Schema.Unknown,
  /** Message timestamp */
  timestamp: Schema.Number,
  /** Schema ID if present */
  schemaId: Schema.optional(Schema.String),
});

export type StreamMessage = typeof StreamMessage.Type;

/**
 * Read response (batch mode)
 */
export const ReadResponse = Schema.Struct({
  /** Messages in this batch */
  items: Schema.Array(StreamMessage),
  /** Next offset for pagination */
  nextOffset: Schema.Number.pipe(Schema.int()),
  /** Whether stream is caught up */
  upToDate: Schema.Boolean,
});

export type ReadResponse = typeof ReadResponse.Type;

// =============================================================================
// Append Operations
// =============================================================================

/**
 * Append request body
 */
export const AppendRequest = Schema.Struct({
  /** Data to append (validated against stream schema) */
  data: Schema.Unknown,
});

export type AppendRequest = typeof AppendRequest.Type;

/**
 * Producer idempotency headers
 */
export const ProducerHeaders = Schema.Struct({
  /** Producer identifier for idempotency */
  producerId: Schema.optional(Schema.String),
  /** Producer sequence number */
  producerSeq: Schema.optional(Schema.Number.pipe(Schema.int())),
});

export type ProducerHeaders = typeof ProducerHeaders.Type;

/**
 * Append response (in headers)
 */
export const AppendResult = Schema.Struct({
  /** Assigned sequence number */
  seq: Schema.Number.pipe(Schema.int()),
  /** Stream name */
  stream: Schema.String,
  /** Whether this was a duplicate (idempotent) */
  duplicate: Schema.optional(Schema.Boolean),
});

export type AppendResult = typeof AppendResult.Type;

// =============================================================================
// SSE Events
// =============================================================================

/**
 * SSE event types
 */
export const SSEEventType = Schema.Literal('data', 'heartbeat', 'error', 'end');
export type SSEEventType = typeof SSEEventType.Type;

/**
 * SSE data event
 */
export const SSEDataEvent = Schema.Struct({
  _tag: Schema.Literal('data'),
  data: Schema.Unknown,
  seq: Schema.Number.pipe(Schema.int()),
  timestamp: Schema.optional(Schema.Number),
});

export type SSEDataEvent = typeof SSEDataEvent.Type;

/**
 * SSE heartbeat event
 */
export const SSEHeartbeatEvent = Schema.Struct({
  _tag: Schema.Literal('heartbeat'),
  timestamp: Schema.Number,
});

export type SSEHeartbeatEvent = typeof SSEHeartbeatEvent.Type;

/**
 * SSE error event
 */
export const SSEErrorEvent = Schema.Struct({
  _tag: Schema.Literal('error'),
  error: Schema.String,
  message: Schema.String,
  code: Schema.optional(Schema.String),
});

export type SSEErrorEvent = typeof SSEErrorEvent.Type;

/**
 * SSE end event (stream complete)
 */
export const SSEEndEvent = Schema.Struct({
  _tag: Schema.Literal('end'),
  lastSeq: Schema.Number.pipe(Schema.int()),
  reason: Schema.optional(Schema.String),
});

export type SSEEndEvent = typeof SSEEndEvent.Type;

/**
 * Union of all SSE event types
 */
export const SSEEvent = Schema.Union(SSEDataEvent, SSEHeartbeatEvent, SSEErrorEvent, SSEEndEvent);
export type SSEEvent = typeof SSEEvent.Type;

// =============================================================================
// Health Check
// =============================================================================

/**
 * Health check response
 */
export const HealthResponse = Schema.Struct({
  status: Schema.Literal('healthy', 'degraded', 'unhealthy'),
  nats: Schema.Struct({
    connected: Schema.Boolean,
    latency: Schema.optional(Schema.Number),
  }),
  uptime: Schema.Number,
  version: Schema.String,
});

export type HealthResponse = typeof HealthResponse.Type;

// =============================================================================
// Stream ID Validation
// =============================================================================

/**
 * Valid stream ID pattern (alphanumeric with hyphens and underscores)
 * Examples: 'my-stream', 'blocks_v2', 'geoint-events'
 */
export const StreamId = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
  Schema.brand('StreamId'),
  Schema.annotations({
    description: 'Stream identifier (alphanumeric, 1-64 chars, starts with letter)',
  })
);

export type StreamId = typeof StreamId.Type;

// =============================================================================
// Offset Validation
// =============================================================================

/**
 * Valid offset value (positive int, -1 for beginning, -2 for end)
 */
export const Offset = Schema.Union(
  Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  Schema.transform(
    Schema.Literal('-1'),
    Schema.Literal(-1),
    { decode: () => -1 as const, encode: () => '-1' as const }
  ),
  Schema.transform(
    Schema.Literal('-2'),
    Schema.Literal(-2),
    { decode: () => -2 as const, encode: () => '-2' as const }
  )
).pipe(
  Schema.annotations({
    description: 'Stream offset (-1 = beginning, -2 = end, >=0 = specific)',
  })
);

export type Offset = typeof Offset.Type;

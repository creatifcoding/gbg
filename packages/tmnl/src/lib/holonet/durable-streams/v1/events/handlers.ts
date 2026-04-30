/**
 * Durable-Streams Event Handlers
 *
 * Handlers for processing durable-streams events.
 * Currently provides logging for observability.
 *
 * @module holonet/durable-streams/events/handlers
 */

import { EventLog } from '@effect/experimental';
import { Effect } from 'effect';
import { StreamEvents, LiveStreamEvents, ErrorEvents } from './schemas';

// =============================================================================
// Stream Event Handlers
// =============================================================================

/**
 * Handlers for stream CRUD events.
 * Logs events for observability.
 */
export const StreamEventHandlersLive = EventLog.group(StreamEvents, (handlers) =>
  handlers
    .handle('StreamCreated', ({ payload }) =>
      Effect.logInfo(`[DS] Stream created: ${payload.streamId} (schema: ${payload.schemaId ?? 'none'})`)
    )
    .handle('StreamAppended', ({ payload }) =>
      Effect.logDebug(`[DS] Stream append: ${payload.streamId} seq=${payload.seq}`)
    )
    .handle('StreamRead', ({ payload }) =>
      Effect.logDebug(`[DS] Stream read: ${payload.streamId} offset=${payload.offset} count=${payload.count}`)
    )
    .handle('StreamDeleted', ({ payload }) =>
      Effect.logInfo(`[DS] Stream deleted: ${payload.streamId} (${payload.messageCount} messages)`)
    )
);

// =============================================================================
// Live Stream Event Handlers
// =============================================================================

/**
 * Handlers for live streaming events.
 * Logs events for observability.
 */
export const LiveStreamEventHandlersLive = EventLog.group(LiveStreamEvents, (handlers) =>
  handlers
    .handle('LongPollCompleted', ({ payload }) =>
      Effect.logDebug(
        `[DS] Long-poll: ${payload.streamId} offset=${payload.offset} count=${payload.count} ` +
          `wait=${payload.waitTimeMs}ms timedOut=${payload.timedOut}`
      )
    )
    .handle('SSEConnectionStarted', ({ payload }) =>
      Effect.logInfo(`[DS] SSE started: ${payload.streamId} offset=${payload.offset}`)
    )
    .handle('SSEMessageSent', ({ payload }) =>
      Effect.logDebug(`[DS] SSE message: ${payload.streamId} seq=${payload.seq} type=${payload.eventType}`)
    )
    .handle('SSEConnectionEnded', ({ payload }) =>
      Effect.logInfo(
        `[DS] SSE ended: ${payload.streamId} delivered=${payload.messagesDelivered} ` +
          `duration=${payload.durationMs}ms reason=${payload.reason}`
      )
    )
    .handle('SubscribeStarted', ({ payload }) =>
      Effect.logInfo(`[DS] Subscribe started: ${payload.streamId} offset=${payload.offset}`)
    )
);

// =============================================================================
// Error Event Handlers
// =============================================================================

/**
 * Handlers for error events.
 * Logs errors at warning level.
 */
export const ErrorEventHandlersLive = EventLog.group(ErrorEvents, (handlers) =>
  handlers.handle('StreamError', ({ payload }) =>
    Effect.logWarning(
      `[DS] Error: ${payload.operation} on ${payload.streamId} - ${payload.errorTag}: ${payload.errorMessage}`
    )
  )
);

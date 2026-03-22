/**
 * Durable-Streams EventLog Integration
 *
 * Event definitions for observability and auditing.
 * Uses @effect/experimental EventLog for structured event emission.
 *
 * @module holonet/durable-streams/events
 */

// ─── Schemas & Event Groups ──────────────────────────────────────────────────
export {
  StreamEvents,
  LiveStreamEvents,
  ErrorEvents,
  DurableStreamsEventLogSchema,
  Keys,
  type StreamCreatedPayload,
  type StreamAppendedPayload,
  type StreamReadPayload,
  type StreamDeletedPayload,
  type LongPollCompletedPayload,
  type SSEConnectionStartedPayload,
  type SSEMessageSentPayload,
  type SSEConnectionEndedPayload,
  type SubscribeStartedPayload,
  type StreamErrorPayload,
} from './schemas';

// ─── Event Handlers ──────────────────────────────────────────────────────────
export {
  StreamEventHandlersLive,
  LiveStreamEventHandlersLive,
  ErrorEventHandlersLive,
} from './handlers';

// ─── Layers ──────────────────────────────────────────────────────────────────
export { DurableStreamsEventLogLive } from './layer';

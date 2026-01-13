/**
 * Durable-Streams EventLog Layer
 *
 * Provides the full EventLog infrastructure for durable-streams.
 * Combines EventJournal, Reactivity, and event handlers.
 *
 * @module holonet/durable-streams/events/layer
 */

import { EventJournal, EventLog, Reactivity } from '@effect/experimental';
import { Layer } from 'effect';
import { DurableStreamsEventLogSchema } from './schemas';
import {
  StreamEventHandlersLive,
  LiveStreamEventHandlersLive,
  ErrorEventHandlersLive,
} from './handlers';

// =============================================================================
// Identity Layer
// =============================================================================

/**
 * Random identity for EventLog.
 * Each server instance gets a unique identity for event tracking.
 */
const IdentityLayer = Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom());

// =============================================================================
// EventLog Layer
// =============================================================================

/**
 * Core EventLog layer with schema.
 * Requires: EventJournal, Identity
 */
const EventLogSchemaLayer = EventLog.layer(DurableStreamsEventLogSchema);

/**
 * Full EventLog layer for durable-streams.
 *
 * Includes:
 * - Random identity for event tracking
 * - Memory-based EventJournal (can be swapped for persistent storage)
 * - Reactivity layer
 * - All event handlers for observability logging
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const writeEvent = yield* EventLog.makeClient(DurableStreamsEventLogSchema);
 *   yield* writeEvent('StreamCreated', { streamId: 'test', ... });
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(DurableStreamsEventLogLive)));
 * ```
 */
export const DurableStreamsEventLogLive = Layer.mergeAll(
  EventLogSchemaLayer,
  Reactivity.layer,
  StreamEventHandlersLive,
  LiveStreamEventHandlersLive,
  ErrorEventHandlersLive
).pipe(
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(IdentityLayer)
);

/**
 * Minimal EventLog layer without handlers.
 * Useful for testing when you don't want logging.
 */
export const DurableStreamsEventLogMinimal = Layer.mergeAll(
  EventLogSchemaLayer,
  Reactivity.layer
).pipe(
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(IdentityLayer)
);

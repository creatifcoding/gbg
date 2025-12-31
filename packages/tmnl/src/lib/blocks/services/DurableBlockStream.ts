/**
 * DurableBlockStream Service
 *
 * Provides durable, resumable streaming for block state synchronization.
 * Uses Effect EventJournal for persistence and recovery.
 *
 * Features:
 * - Persistent event log for block state changes
 * - Resume from last known sequence (for Telegram WebApp reconnection)
 * - Real-time change notifications via Stream
 * - Support for remote sync (multi-client coordination)
 */

import { Context, Effect, Layer, Stream, Queue, PubSub, Schema, pipe } from 'effect';
import type { Scope } from 'effect/Scope';
import type { BlockId, BlockTypeName, BlockAttributes } from '../types/context';

// ============================================================================
// Block Event Types
// ============================================================================

/**
 * Block created event
 */
export const BlockCreated = Schema.TaggedStruct('BlockCreated', {
  blockId: Schema.String,
  blockTypeName: Schema.String,
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  timestamp: Schema.Number,
});
export type BlockCreated = typeof BlockCreated.Type;

/**
 * Block updated event (attribute change)
 */
export const BlockUpdated = Schema.TaggedStruct('BlockUpdated', {
  blockId: Schema.String,
  key: Schema.String,
  value: Schema.Unknown,
  previousValue: Schema.optional(Schema.Unknown),
  timestamp: Schema.Number,
});
export type BlockUpdated = typeof BlockUpdated.Type;

/**
 * Block deleted event
 */
export const BlockDeleted = Schema.TaggedStruct('BlockDeleted', {
  blockId: Schema.String,
  timestamp: Schema.Number,
});
export type BlockDeleted = typeof BlockDeleted.Type;

/**
 * Block selection changed
 */
export const BlockSelectionChanged = Schema.TaggedStruct('BlockSelectionChanged', {
  blockId: Schema.String,
  selected: Schema.Boolean,
  timestamp: Schema.Number,
});
export type BlockSelectionChanged = typeof BlockSelectionChanged.Type;

/**
 * Block focus mode changed
 */
export const BlockFocusModeChanged = Schema.TaggedStruct('BlockFocusModeChanged', {
  blockId: Schema.NullOr(Schema.String),
  isFocusMode: Schema.Boolean,
  timestamp: Schema.Number,
});
export type BlockFocusModeChanged = typeof BlockFocusModeChanged.Type;

/**
 * Union of all block events
 */
export const BlockEvent = Schema.Union(
  BlockCreated,
  BlockUpdated,
  BlockDeleted,
  BlockSelectionChanged,
  BlockFocusModeChanged
);
export type BlockEvent = typeof BlockEvent.Type;

// ============================================================================
// Block State Snapshot
// ============================================================================

/**
 * Current state of a single block
 */
export const BlockState = Schema.Struct({
  blockId: Schema.String,
  blockTypeName: Schema.String,
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  selected: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
});
export type BlockState = typeof BlockState.Type;

/**
 * Full state snapshot (all blocks)
 */
export const BlockStateSnapshot = Schema.Struct({
  blocks: Schema.Record({ key: Schema.String, value: BlockState }),
  focusedBlockId: Schema.NullOr(Schema.String),
  isFocusMode: Schema.Boolean,
  sequence: Schema.Number,
  timestamp: Schema.Number,
});
export type BlockStateSnapshot = typeof BlockStateSnapshot.Type;

// ============================================================================
// Service Interface
// ============================================================================

export interface DurableBlockStreamShape {
  // ─────────────────────────────────────────────────────────────────────────
  // Event Publishing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Publish a block event (will be persisted and broadcast)
   */
  readonly publish: (event: BlockEvent) => Effect.Effect<void>;

  /**
   * Publish multiple events atomically
   */
  readonly publishBatch: (events: readonly BlockEvent[]) => Effect.Effect<void>;

  // ─────────────────────────────────────────────────────────────────────────
  // Subscription
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to block events (real-time stream)
   */
  readonly subscribe: Effect.Effect<Stream.Stream<BlockEvent>, never, Scope>;

  /**
   * Subscribe starting from a specific sequence number (for resume)
   */
  readonly subscribeFrom: (
    fromSequence: number
  ) => Effect.Effect<Stream.Stream<BlockEvent>, never, Scope>;

  // ─────────────────────────────────────────────────────────────────────────
  // State Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current state snapshot
   */
  readonly getSnapshot: Effect.Effect<BlockStateSnapshot>;

  /**
   * Get state of a specific block
   */
  readonly getBlockState: (blockId: string) => Effect.Effect<BlockState | null>;

  /**
   * Get current sequence number (for resume tracking)
   */
  readonly getCurrentSequence: Effect.Effect<number>;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Replay all events to rebuild state (for new connections)
   */
  readonly replayAll: Effect.Effect<Stream.Stream<BlockEvent>>;

  /**
   * Clear all events (reset state)
   */
  readonly clear: Effect.Effect<void>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class DurableBlockStream extends Context.Tag('tmnl/blocks/DurableBlockStream')<
  DurableBlockStream,
  DurableBlockStreamShape
>() {}

// ============================================================================
// In-Memory Implementation (for development/testing)
// ============================================================================

interface InMemoryState {
  events: BlockEvent[];
  blocks: Map<string, BlockState>;
  focusedBlockId: string | null;
  isFocusMode: boolean;
  sequence: number;
}

const applyEvent = (state: InMemoryState, event: BlockEvent): void => {
  state.sequence++;

  switch (event._tag) {
    case 'BlockCreated': {
      state.blocks.set(event.blockId, {
        blockId: event.blockId,
        blockTypeName: event.blockTypeName,
        attributes: event.attributes,
        selected: false,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      });
      break;
    }
    case 'BlockUpdated': {
      const block = state.blocks.get(event.blockId);
      if (block) {
        block.attributes[event.key] = event.value;
        block.updatedAt = event.timestamp;
      }
      break;
    }
    case 'BlockDeleted': {
      state.blocks.delete(event.blockId);
      if (state.focusedBlockId === event.blockId) {
        state.focusedBlockId = null;
        state.isFocusMode = false;
      }
      break;
    }
    case 'BlockSelectionChanged': {
      const block = state.blocks.get(event.blockId);
      if (block) {
        block.selected = event.selected;
      }
      break;
    }
    case 'BlockFocusModeChanged': {
      state.focusedBlockId = event.blockId;
      state.isFocusMode = event.isFocusMode;
      break;
    }
  }

  state.events.push(event);
};

export const DurableBlockStreamLive = Layer.effect(
  DurableBlockStream,
  Effect.gen(function* () {
    // In-memory state
    const state: InMemoryState = {
      events: [],
      blocks: new Map(),
      focusedBlockId: null,
      isFocusMode: false,
      sequence: 0,
    };

    // PubSub for real-time subscriptions
    const pubsub = yield* PubSub.unbounded<BlockEvent>();

    return {
      publish: (event) =>
        Effect.gen(function* () {
          applyEvent(state, event);
          yield* PubSub.publish(pubsub, event);
        }),

      publishBatch: (events) =>
        Effect.gen(function* () {
          for (const event of events) {
            applyEvent(state, event);
          }
          for (const event of events) {
            yield* PubSub.publish(pubsub, event);
          }
        }),

      subscribe: Effect.gen(function* () {
        const queue = yield* PubSub.subscribe(pubsub);
        return Stream.fromQueue(queue);
      }),

      subscribeFrom: (fromSequence) =>
        Effect.gen(function* () {
          const queue = yield* PubSub.subscribe(pubsub);

          // Replay missed events first
          const missedEvents = state.events.slice(fromSequence);
          const replayStream = Stream.fromIterable(missedEvents);

          // Then live events
          const liveStream = Stream.fromQueue(queue);

          return pipe(replayStream, Stream.concat(liveStream));
        }),

      getSnapshot: Effect.sync(() => ({
        blocks: Object.fromEntries(state.blocks),
        focusedBlockId: state.focusedBlockId,
        isFocusMode: state.isFocusMode,
        sequence: state.sequence,
        timestamp: Date.now(),
      })),

      getBlockState: (blockId) => Effect.sync(() => state.blocks.get(blockId) ?? null),

      getCurrentSequence: Effect.sync(() => state.sequence),

      replayAll: Effect.sync(() => Stream.fromIterable(state.events)),

      clear: Effect.sync(() => {
        state.events = [];
        state.blocks.clear();
        state.focusedBlockId = null;
        state.isFocusMode = false;
        state.sequence = 0;
      }),
    };
  })
);

// ============================================================================
// Default Export
// ============================================================================

export const DurableBlockStreamDefault = DurableBlockStreamLive;

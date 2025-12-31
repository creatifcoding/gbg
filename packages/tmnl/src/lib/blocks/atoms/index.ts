/**
 * Block System Atoms
 *
 * Reactive state for the decoupled block system.
 * Following Atom-as-State doctrine.
 */

import { Atom, Registry } from '@effect-atom/atom';
import { Layer } from 'effect';
import {
  DurableBlockStream,
  DurableBlockStreamLive,
  type BlockEvent,
  type BlockState,
  type BlockStateSnapshot,
} from '../services/DurableBlockStream';

// ============================================================================
// Registry
// ============================================================================

export const blockRegistry = Registry.make();

// ============================================================================
// Runtime Atom
// ============================================================================

export const blockRuntimeAtom = Atom.runtime(DurableBlockStreamLive);

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Current block state snapshot
 */
export const blockSnapshotAtom = Atom.make<BlockStateSnapshot>({
  blocks: {},
  focusedBlockId: null,
  isFocusMode: false,
  sequence: 0,
  timestamp: Date.now(),
});

/**
 * Current sequence number (for resume tracking)
 */
export const sequenceAtom = Atom.make((get) => get(blockSnapshotAtom).sequence);

/**
 * Focused block ID (if any)
 */
export const focusedBlockIdAtom = Atom.make((get) => get(blockSnapshotAtom).focusedBlockId);

/**
 * Whether focus mode is active
 */
export const isFocusModeAtom = Atom.make((get) => get(blockSnapshotAtom).isFocusMode);

/**
 * All blocks as a map
 */
export const blocksMapAtom = Atom.make((get) => get(blockSnapshotAtom).blocks);

/**
 * Block IDs list
 */
export const blockIdsAtom = Atom.make((get) => Object.keys(get(blocksMapAtom)));

/**
 * Get a specific block's state
 */
export const blockStateAtom = (blockId: string) =>
  Atom.make((get) => get(blocksMapAtom)[blockId] ?? null);

// ============================================================================
// Event Stream Atom
// ============================================================================

/**
 * Latest event (for debugging/logging)
 */
export const latestEventAtom = Atom.make<BlockEvent | null>(null);

// ============================================================================
// Connection State
// ============================================================================

/**
 * Stream connection state for remote sync
 */
export const connectionStateAtom = Atom.make<'disconnected' | 'connecting' | 'connected' | 'error'>(
  'disconnected'
);

/**
 * Last sync timestamp
 */
export const lastSyncAtom = Atom.make<number | null>(null);

// ============================================================================
// Operations
// ============================================================================

export const blockOps = {
  /**
   * Update snapshot from service
   */
  updateSnapshot: (snapshot: BlockStateSnapshot) => {
    blockRegistry.set(blockSnapshotAtom, snapshot);
    blockRegistry.set(lastSyncAtom, Date.now());
  },

  /**
   * Record an event (for debugging)
   */
  recordEvent: (event: BlockEvent) => {
    blockRegistry.set(latestEventAtom, event);
  },

  /**
   * Set connection state
   */
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => {
    blockRegistry.set(connectionStateAtom, state);
  },

  /**
   * Create a block
   */
  createBlock: blockRuntimeAtom.fn<{
    blockId: string;
    blockTypeName: string;
    attributes?: Record<string, unknown>;
  }>()((args, ctx) =>
    ctx.effect.gen(function* () {
      const stream = yield* DurableBlockStream;
      yield* stream.publish({
        _tag: 'BlockCreated',
        blockId: args.blockId,
        blockTypeName: args.blockTypeName,
        attributes: args.attributes ?? {},
        timestamp: Date.now(),
      });
      const snapshot = yield* stream.getSnapshot;
      ctx.set(blockSnapshotAtom, snapshot);
    })
  ),

  /**
   * Update a block attribute
   */
  updateBlock: blockRuntimeAtom.fn<{
    blockId: string;
    key: string;
    value: unknown;
  }>()((args, ctx) =>
    ctx.effect.gen(function* () {
      const stream = yield* DurableBlockStream;
      yield* stream.publish({
        _tag: 'BlockUpdated',
        blockId: args.blockId,
        key: args.key,
        value: args.value,
        timestamp: Date.now(),
      });
      const snapshot = yield* stream.getSnapshot;
      ctx.set(blockSnapshotAtom, snapshot);
    })
  ),

  /**
   * Delete a block
   */
  deleteBlock: blockRuntimeAtom.fn<{ blockId: string }>()((args, ctx) =>
    ctx.effect.gen(function* () {
      const stream = yield* DurableBlockStream;
      yield* stream.publish({
        _tag: 'BlockDeleted',
        blockId: args.blockId,
        timestamp: Date.now(),
      });
      const snapshot = yield* stream.getSnapshot;
      ctx.set(blockSnapshotAtom, snapshot);
    })
  ),

  /**
   * Set focus mode
   */
  setFocusMode: blockRuntimeAtom.fn<{ blockId: string | null; isFocusMode: boolean }>()(
    (args, ctx) =>
      ctx.effect.gen(function* () {
        const stream = yield* DurableBlockStream;
        yield* stream.publish({
          _tag: 'BlockFocusModeChanged',
          blockId: args.blockId,
          isFocusMode: args.isFocusMode,
          timestamp: Date.now(),
        });
        const snapshot = yield* stream.getSnapshot;
        ctx.set(blockSnapshotAtom, snapshot);
      })
  ),

  /**
   * Sync snapshot from service
   */
  syncSnapshot: blockRuntimeAtom.fn()((_, ctx) =>
    ctx.effect.gen(function* () {
      const stream = yield* DurableBlockStream;
      const snapshot = yield* stream.getSnapshot;
      ctx.set(blockSnapshotAtom, snapshot);
      ctx.set(lastSyncAtom, Date.now());
    })
  ),
};

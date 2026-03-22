/**
 * Block System Atoms
 *
 * Reactive state for the decoupled block system.
 * Following Atom-as-State doctrine.
 */

import { Atom, Registry } from '@effect-atom/atom';
import { Layer, pipe } from 'effect';
import {
  DurableBlockStream,
  DurableBlockStreamLive,
  DurableBlockStreamRemote,
  RemoteBlockStreamConfigTag,
  makeRemoteBlockStream,
  type BlockEvent,
  type BlockState,
  type BlockStateSnapshot,
  type RemoteBlockStreamConfig,
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

// ============================================================================
// Per-Chat State (Atom.family pattern)
// ============================================================================

/**
 * Per-chat block snapshot family.
 * Each chatId gets its own isolated state.
 *
 * @example
 * ```typescript
 * const chatSnapshot = blockSnapshotByChatAtom(12345);
 * const snapshot = blockRegistry.get(chatSnapshot);
 * ```
 */
export const blockSnapshotByChatAtom = Atom.family((chatId: number) =>
  Atom.make<BlockStateSnapshot>({
    blocks: {},
    focusedBlockId: null,
    isFocusMode: false,
    sequence: 0,
    timestamp: Date.now(),
  })
);

/**
 * Per-chat connection state family
 */
export const connectionStateByChatAtom = Atom.family((chatId: number) =>
  Atom.make<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
);

/**
 * Per-chat last sync timestamp family
 */
export const lastSyncByChatAtom = Atom.family((chatId: number) =>
  Atom.make<number | null>(null)
);

/**
 * Per-chat latest event family (for debugging)
 */
export const latestEventByChatAtom = Atom.family((chatId: number) =>
  Atom.make<BlockEvent | null>(null)
);

/**
 * Per-chat derived atoms
 */
export const chatBlockOps = (chatId: number) => {
  const snapshotAtom = blockSnapshotByChatAtom(chatId);
  const connectionAtom = connectionStateByChatAtom(chatId);
  const syncAtom = lastSyncByChatAtom(chatId);
  const eventAtom = latestEventByChatAtom(chatId);

  return {
    /** Get the snapshot atom for this chat */
    snapshotAtom,

    /** Get current snapshot value */
    getSnapshot: () => blockRegistry.get(snapshotAtom),

    /** Update snapshot */
    updateSnapshot: (snapshot: BlockStateSnapshot) => {
      blockRegistry.set(snapshotAtom, snapshot);
      blockRegistry.set(syncAtom, Date.now());
    },

    /** Record an event */
    recordEvent: (event: BlockEvent) => {
      blockRegistry.set(eventAtom, event);
    },

    /** Set connection state */
    setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'error') => {
      blockRegistry.set(connectionAtom, state);
    },

    /** Get blocks map */
    getBlocks: () => blockRegistry.get(snapshotAtom).blocks,

    /** Get block IDs */
    getBlockIds: () => Object.keys(blockRegistry.get(snapshotAtom).blocks),

    /** Get specific block state */
    getBlockState: (blockId: string) => blockRegistry.get(snapshotAtom).blocks[blockId] ?? null,

    /** Check if focus mode is active */
    isFocusMode: () => blockRegistry.get(snapshotAtom).isFocusMode,

    /** Get focused block ID */
    getFocusedBlockId: () => blockRegistry.get(snapshotAtom).focusedBlockId,

    /** Get current sequence */
    getSequence: () => blockRegistry.get(snapshotAtom).sequence,
  };
};

// ============================================================================
// Remote Runtime Factory
// ============================================================================

/**
 * Create a remote block runtime atom connected to a durable stream server.
 *
 * @example
 * ```typescript
 * const remoteRuntime = makeRemoteBlockRuntime({
 *   url: 'https://streams.example.com/v1/stream/blocks-room-123',
 * });
 *
 * // Use with remote operations
 * const remoteOps = makeRemoteBlockOps(remoteRuntime);
 * await remoteOps.createBlock({ blockId: 'b1', blockTypeName: 'text' });
 * ```
 */
export const makeRemoteBlockRuntime = (config: RemoteBlockStreamConfig) =>
  Atom.runtime(makeRemoteBlockStream(config));

/**
 * Create block operations bound to a remote runtime with per-chat state isolation.
 *
 * @param runtimeAtom - The Atom.runtime for the remote connection
 * @param chatId - The chat ID for per-chat state isolation
 */
export const makeRemoteBlockOps = (
  runtimeAtom: ReturnType<typeof makeRemoteBlockRuntime>,
  chatId: number
) => {
  // Get per-chat atoms
  const snapshotAtom = blockSnapshotByChatAtom(chatId);
  const syncAtom = lastSyncByChatAtom(chatId);

  return {
    /** Get the current snapshot for this chat */
    getSnapshot: () => blockRegistry.get(snapshotAtom),

    /** Get chat-scoped operations helper */
    chatOps: chatBlockOps(chatId),

    createBlock: runtimeAtom.fn<{
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
        ctx.set(snapshotAtom, snapshot);
      })
    ),

    updateBlock: runtimeAtom.fn<{
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
        ctx.set(snapshotAtom, snapshot);
      })
    ),

    deleteBlock: runtimeAtom.fn<{ blockId: string }>()((args, ctx) =>
      ctx.effect.gen(function* () {
        const stream = yield* DurableBlockStream;
        yield* stream.publish({
          _tag: 'BlockDeleted',
          blockId: args.blockId,
          timestamp: Date.now(),
        });
        const snapshot = yield* stream.getSnapshot;
        ctx.set(snapshotAtom, snapshot);
      })
    ),

    setFocusMode: runtimeAtom.fn<{ blockId: string | null; isFocusMode: boolean }>()(
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
          ctx.set(snapshotAtom, snapshot);
        })
    ),

    syncSnapshot: runtimeAtom.fn()((_, ctx) =>
      ctx.effect.gen(function* () {
        const stream = yield* DurableBlockStream;
        const snapshot = yield* stream.getSnapshot;
        ctx.set(snapshotAtom, snapshot);
        ctx.set(syncAtom, Date.now());
        return snapshot;
      })
    ),
  };
};

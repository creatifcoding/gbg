/**
 * BlockNameBadge Atoms — XState → effect-atom Bridge
 *
 * Per-block actor factory with snapshot bridge pattern.
 * Unlike minibuffer (singleton), each block has its own actor instance.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/atoms
 */

import { Atom } from '@effect-atom/atom';
import { createActor, type SnapshotFrom, type ActorRefFrom } from 'xstate';
import {
  blockNameMachine,
  type BlockNameMachineContext,
  type BlockNameMachineEvent,
  defaultBlockNameMachineContext,
} from './machines/blockNameMachine';
import type { BlockId } from '../shared';
import type { BadgeState } from './types';

// =============================================================================
// Types
// =============================================================================

export type BlockNameActor = ActorRefFrom<typeof blockNameMachine>;
export type BlockNameSnapshot = SnapshotFrom<typeof blockNameMachine>;

export interface BlockNameAtoms {
  /** Root snapshot atom — single subscription point */
  snapshotAtom: Atom.Atom<BlockNameSnapshot>;

  /** Current state: display | editing | submitting | success | error */
  stateAtom: Atom.Atom<BadgeState>;

  /** Full context object */
  contextAtom: Atom.Atom<BlockNameMachineContext>;

  /** Current input value (during editing) */
  inputValueAtom: Atom.Atom<string>;

  /** Error message (during error state) */
  errorAtom: Atom.Atom<string | null>;

  /** Current name from context */
  currentNameAtom: Atom.Atom<string | null>;

  /** Whether badge is editable (onRename defined) */
  isEditableAtom: Atom.Atom<boolean>;

  /** Whether we're in an error state */
  hasErrorAtom: Atom.Atom<boolean>;

  /** Operations to send events to actor */
  ops: BlockNameOps;

  /** Raw actor reference (for advanced use) */
  actor: BlockNameActor;
}

export interface BlockNameOps {
  /** Enter editing mode (double-click) */
  edit: () => void;

  /** Cancel editing, revert to display */
  cancel: () => void;

  /** Submit current input value */
  submit: () => void;

  /** Update input value during editing */
  inputChange: (value: string) => void;

  /** Signal successful rename */
  success: () => void;

  /** Signal rename error */
  error: (error: string) => void;

  /** Retry after error */
  retry: () => void;

  /** Sync name from external source */
  setName: (name: string | null) => void;

  /** Update onRename handler */
  setOnRename: (handler: ((name: string) => Promise<void>) | undefined) => void;
}

// =============================================================================
// Actor Cache (Per-Block Instances)
// =============================================================================

/**
 * Cache of actor instances keyed by BlockId.
 * Each block gets its own independent state machine.
 */
const actorCache = new Map<BlockId, BlockNameActor>();

/**
 * Cache of atom bundles keyed by BlockId.
 * Prevents recreating atoms for the same block.
 */
const atomsCache = new Map<BlockId, BlockNameAtoms>();

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Get or create an actor for a specific block.
 *
 * @param blockId - Unique block identifier
 * @param initialContext - Optional initial context override
 * @returns Actor reference
 */
export const getBlockNameActor = (
  blockId: BlockId,
  initialContext?: Partial<BlockNameMachineContext>
): BlockNameActor => {
  let actor = actorCache.get(blockId);

  // Check if cached actor exists AND is still running
  // (React strict mode / HMR can stop actors, leaving stale cache entries)
  if (actor) {
    const snapshot = actor.getSnapshot();
    if (snapshot.status === 'stopped') {
      // Actor was stopped, remove from cache and create new one
      actorCache.delete(blockId);
      atomsCache.delete(blockId);
      actor = undefined;
    }
  }

  if (!actor) {
    actor = createActor(blockNameMachine, {
      input: {
        blockId,
        ...defaultBlockNameMachineContext,
        ...initialContext,
      },
    });
    actor.start();
    actorCache.set(blockId, actor);
  }

  return actor;
};

/**
 * Create the atom bundle for a specific block.
 *
 * This is the main factory. Call this from your component to get
 * all the atoms and operations for a specific block.
 *
 * @example
 * ```tsx
 * const { stateAtom, inputValueAtom, ops } = createBlockNameAtoms(blockId);
 *
 * const state = useAtomValue(stateAtom);
 * const inputValue = useAtomValue(inputValueAtom);
 *
 * const handleDoubleClick = () => ops.edit();
 * ```
 */
export const createBlockNameAtoms = (
  blockId: BlockId,
  initialContext?: Partial<BlockNameMachineContext>
): BlockNameAtoms => {
  // Check cached bundle - but verify actor is still running
  // (React strict mode / HMR can stop actors, leaving stale cache entries)
  const cached = atomsCache.get(blockId);
  if (cached) {
    const snapshot = cached.actor.getSnapshot();
    if (snapshot.status !== 'stopped') {
      return cached; // Actor still running, safe to return
    }
    // Actor stopped - clear caches and recreate
    atomsCache.delete(blockId);
    actorCache.delete(blockId);
  }

  // Get or create actor
  const actor = getBlockNameActor(blockId, initialContext);

  // ─────────────────────────────────────────────────────────────
  // Bridge Atom (Single Subscription Point)
  // ─────────────────────────────────────────────────────────────

  const snapshotAtom: Atom.Atom<BlockNameSnapshot> = Atom.make((get) => {
    const subscription = actor.subscribe((snapshot) => {
      get.setSelf(snapshot);
    });
    get.addFinalizer(() => subscription.unsubscribe());
    return actor.getSnapshot();
  });

  // ─────────────────────────────────────────────────────────────
  // Selector Atoms (Derived, Memoized)
  // ─────────────────────────────────────────────────────────────

  const stateAtom = Atom.make(
    (get) => get(snapshotAtom).value as BadgeState
  );

  const contextAtom = Atom.make(
    (get) => get(snapshotAtom).context
  );

  const inputValueAtom = Atom.make(
    (get) => get(snapshotAtom).context.inputValue
  );

  const errorAtom = Atom.make(
    (get) => get(snapshotAtom).context.error
  );

  const currentNameAtom = Atom.make(
    (get) => get(snapshotAtom).context.currentName
  );

  const isEditableAtom = Atom.make(
    (get) => get(snapshotAtom).context.onRename !== undefined
  );

  const hasErrorAtom = Atom.make(
    (get) => get(snapshotAtom).context.error !== null
  );

  // ─────────────────────────────────────────────────────────────
  // Operations (Send Events to Actor)
  // ─────────────────────────────────────────────────────────────

  const ops: BlockNameOps = {
    edit: () => actor.send({ type: 'EDIT' }),

    cancel: () => actor.send({ type: 'CANCEL' }),

    submit: () => actor.send({ type: 'SUBMIT' }),

    inputChange: (value: string) =>
      actor.send({ type: 'INPUT_CHANGE', value }),

    success: () => actor.send({ type: 'SUCCESS' }),

    error: (error: string) => actor.send({ type: 'ERROR', error }),

    retry: () => actor.send({ type: 'RETRY' }),

    setName: (name: string | null) =>
      actor.send({ type: 'SET_NAME', name }),

    setOnRename: (handler: ((name: string) => Promise<void>) | undefined) =>
      actor.send({ type: 'SET_ON_RENAME', handler }),
  };

  // ─────────────────────────────────────────────────────────────
  // Bundle
  // ─────────────────────────────────────────────────────────────

  const bundle: BlockNameAtoms = {
    snapshotAtom,
    stateAtom,
    contextAtom,
    inputValueAtom,
    errorAtom,
    currentNameAtom,
    isEditableAtom,
    hasErrorAtom,
    ops,
    actor,
  };

  atomsCache.set(blockId, bundle);
  return bundle;
};

// =============================================================================
// Cleanup Utilities
// =============================================================================

/**
 * Dispose the actor for a specific block.
 * Call this when the block is unmounted/removed.
 */
export const disposeBlockNameActor = (blockId: BlockId): void => {
  const actor = actorCache.get(blockId);
  if (actor) {
    actor.stop();
    actorCache.delete(blockId);
  }
  atomsCache.delete(blockId);
};

/**
 * Clear all cached actors and atoms.
 * Useful for testing or complete cleanup.
 */
export const clearAllBlockNameActors = (): void => {
  actorCache.forEach((actor) => actor.stop());
  actorCache.clear();
  atomsCache.clear();
};

// =============================================================================
// Accessor Utilities
// =============================================================================

/**
 * Get current snapshot synchronously for a block.
 * Prefer using selector atoms for reactive updates.
 */
export const getBlockNameSnapshot = (blockId: BlockId): BlockNameSnapshot | null => {
  const actor = actorCache.get(blockId);
  return actor?.getSnapshot() ?? null;
};

/**
 * Check if an actor exists for a block.
 */
export const hasBlockNameActor = (blockId: BlockId): boolean => {
  return actorCache.has(blockId);
};

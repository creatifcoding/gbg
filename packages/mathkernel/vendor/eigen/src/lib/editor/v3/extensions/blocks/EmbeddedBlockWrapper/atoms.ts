/**
 * EmbeddedBlockWrapper Atoms
 *
 * Atoms-as-state for embedded block wrapper.
 * Uses Atom.family pattern for per-block isolation.
 *
 * NOTE: This module uses a module-scoped Registry for synchronous access
 * to atoms from event handlers. React components should use useAtomValue()
 * and useSetAtom() hooks instead of the registry directly.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/atoms
 */

import {
  Atom,
  Registry,
  useAtomSet,
  useAtomValue,
} from '@effect-atom/atom-react';
import { useMemo } from 'react';
import type { EmbeddedBlockState, FoldState, StreamStatus } from './types';

// =============================================================================
// Module-scoped Registry for synchronous access
// =============================================================================

/**
 * Module-scoped registry for synchronous atom access in event handlers.
 * React components should use useAtomValue()/useSetAtom() hooks instead.
 */
const registry = Registry.make();

// =============================================================================
// Focus Mode Atoms (Module-level)
// =============================================================================

/**
 * Currently focused block ID.
 * null means no block is in focus mode.
 */
export const focusedBlockIdAtom = Atom.make<string | null>(null);

/**
 * Whether any block is in focus mode.
 * Derived from focusedBlockIdAtom.
 */
export const isFocusModeAtom = Atom.make(
  (get) => get(focusedBlockIdAtom) !== null
);

/**
 * Timestamp when focus mode was entered.
 * Used for analytics and debugging.
 */
export const focusEnteredAtAtom = Atom.make<Date | null>(null);

// =============================================================================
// Focus Mode Actions
// =============================================================================

export const focusActions = {
  /**
   * Enter focus mode for a block.
   */
  enterFocus: (blockId: string) => {
    registry.set(focusedBlockIdAtom, blockId);
    registry.set(focusEnteredAtAtom, new Date());
  },

  /**
   * Exit focus mode.
   */
  exitFocus: () => {
    registry.set(focusedBlockIdAtom, null);
    registry.set(focusEnteredAtAtom, null);
  },

  /**
   * Toggle focus mode for a block.
   */
  toggleFocus: (blockId: string) => {
    const current = registry.get(focusedBlockIdAtom);
    if (current === blockId) {
      focusActions.exitFocus();
    } else {
      focusActions.enterFocus(blockId);
    }
  },

  /**
   * Check if a specific block is focused.
   */
  isFocused: (blockId: string): boolean => {
    return registry.get(focusedBlockIdAtom) === blockId;
  },
};

// =============================================================================
// State Persistence (In-Memory Cache for Focus Transitions)
// =============================================================================

/**
 * Saved block states for restoration after focus mode exits.
 * Keyed by blockId, stores EmbeddedBlockState snapshots.
 *
 * Note: This is an in-memory cache. For persistent storage across
 * page reloads, use BlockStateService with SQLite.
 */
export const savedBlockStatesAtom = Atom.make<Map<string, EmbeddedBlockState>>(
  new Map()
);

/**
 * Save a block's state to the cache.
 * Called before unmounting due to focus mode.
 */
export function saveBlockState(
  blockId: string,
  state: EmbeddedBlockState
): void {
  registry.update(savedBlockStatesAtom, (prev) => {
    const next = new Map(prev);
    next.set(blockId, { ...state });
    return next;
  });
}

/**
 * Restore and remove a block's state from the cache.
 * Called on mount to restore state after focus mode exits.
 * Returns undefined if no saved state exists.
 */
export function restoreBlockState(
  blockId: string
): EmbeddedBlockState | undefined {
  const savedStates = registry.get(savedBlockStatesAtom);
  const saved = savedStates.get(blockId);
  if (saved) {
    // Remove from cache after restoring
    registry.update(savedBlockStatesAtom, (prev) => {
      const next = new Map(prev);
      next.delete(blockId);
      return next;
    });
  }
  return saved;
}

/**
 * Check if a block has saved state.
 */
export function hasSavedBlockState(blockId: string): boolean {
  return registry.get(savedBlockStatesAtom).has(blockId);
}

// =============================================================================
// Default State
// =============================================================================

export const DEFAULT_EMBEDDED_BLOCK_STATE: EmbeddedBlockState = {
  foldState: 'expanded',
  settingsOpen: false,
  activeTab: 'general',
  isSelected: false,
  isHovered: false,
  streamStatus: 'idle',
  streamError: null,
};

// =============================================================================
// Atom Factory
// =============================================================================

export function createEmbeddedBlockAtoms(blockId: string) {
  // Core state atoms
  const foldStateAtom = Atom.make<FoldState>('expanded');
  const settingsOpenAtom = Atom.make(false);
  const activeTabAtom = Atom.make('general');
  const isSelectedAtom = Atom.make(false);
  const isHoveredAtom = Atom.make(false);

  // Custom height (null = use default from props)
  const customHeightAtom = Atom.make<number | null>(null);

  // Settings panel expanded to full block viewport
  const settingsExpandedAtom = Atom.make(false);

  // Stream state atoms
  const streamStatusAtom = Atom.make<StreamStatus>('idle');
  const streamErrorAtom = Atom.make<string | null>(null);

  // Derived: complete state snapshot
  const stateAtom = Atom.make(
    (get): EmbeddedBlockState => ({
      foldState: get(foldStateAtom),
      settingsOpen: get(settingsOpenAtom),
      activeTab: get(activeTabAtom),
      isSelected: get(isSelectedAtom),
      isHovered: get(isHoveredAtom),
      streamStatus: get(streamStatusAtom),
      streamError: get(streamErrorAtom),
    })
  );

  // Derived: should show controls (selected or hovered)
  const showControlsAtom = Atom.make(
    (get) => get(isSelectedAtom) || get(isHoveredAtom)
  );

  // Derived: content visible (not minimized)
  const contentVisibleAtom = Atom.make(
    (get) => get(foldStateAtom) !== 'minimized'
  );

  // Derived: content expanded (full height)
  const contentExpandedAtom = Atom.make(
    (get) => get(foldStateAtom) === 'expanded'
  );

  return {
    blockId,
    // Primitive atoms
    foldStateAtom,
    settingsOpenAtom,
    activeTabAtom,
    isSelectedAtom,
    isHoveredAtom,
    streamStatusAtom,
    streamErrorAtom,
    customHeightAtom,
    settingsExpandedAtom,
    // Derived atoms
    stateAtom,
    showControlsAtom,
    contentVisibleAtom,
    contentExpandedAtom,
  };
}

export type EmbeddedBlockAtoms = ReturnType<typeof createEmbeddedBlockAtoms>;

// =============================================================================
// Atom Registry
// =============================================================================

const atomRegistry = new Map<string, EmbeddedBlockAtoms>();

export function getEmbeddedBlockAtoms(blockId: string): EmbeddedBlockAtoms {
  let atoms = atomRegistry.get(blockId);
  if (!atoms) {
    atoms = createEmbeddedBlockAtoms(blockId);
    atomRegistry.set(blockId, atoms);
  }
  return atoms;
}

export function disposeEmbeddedBlockAtoms(blockId: string): void {
  atomRegistry.delete(blockId);
}

// =============================================================================
// Actions
// =============================================================================

export function createEmbeddedBlockActions(atoms: EmbeddedBlockAtoms) {
  return {
    toggleFold: () => {
      const current = registry.get(atoms.foldStateAtom);
      const next: FoldState = current === 'expanded' ? 'collapsed' : 'expanded';
      registry.set(atoms.foldStateAtom, next);
    },

    expand: () => {
      registry.set(atoms.foldStateAtom, 'expanded');
    },

    collapse: () => {
      registry.set(atoms.foldStateAtom, 'collapsed');
    },

    minimize: () => {
      registry.set(atoms.foldStateAtom, 'minimized');
    },

    toggleSettings: () => {
      registry.update(atoms.settingsOpenAtom, (prev) => !prev);
    },

    setActiveTab: (tabId: string) => {
      registry.set(atoms.activeTabAtom, tabId);
    },

    setSelected: (selected: boolean) => {
      registry.set(atoms.isSelectedAtom, selected);
    },

    setHovered: (hovered: boolean) => {
      registry.set(atoms.isHoveredAtom, hovered);
    },

    setStreamStatus: (status: StreamStatus) => {
      registry.set(atoms.streamStatusAtom, status);
    },

    setStreamError: (error: string | null) => {
      registry.set(atoms.streamErrorAtom, error);
    },
  };
}

export type EmbeddedBlockActions = ReturnType<
  typeof createEmbeddedBlockActions
>;

// =============================================================================
// React Hooks for Actions (FIXES REGISTRY ISOLATION BUG)
// =============================================================================

/**
 * Hook that returns actions using React's atom context.
 *
 * CRITICAL: This hook uses `useAtomSet` which writes to the same registry
 * that `useAtomValue` subscribes to. The old `createEmbeddedBlockActions`
 * used a module-scoped registry which was ISOLATED from React's context.
 *
 * @param atoms - The atoms for this block instance
 * @returns Actions that properly trigger React re-renders
 */
export function useEmbeddedBlockActions(atoms: EmbeddedBlockAtoms) {
  const setFoldState = useAtomSet(atoms.foldStateAtom);
  const setSettingsOpen = useAtomSet(atoms.settingsOpenAtom);
  const setActiveTab = useAtomSet(atoms.activeTabAtom);
  const setIsSelected = useAtomSet(atoms.isSelectedAtom);
  const setIsHovered = useAtomSet(atoms.isHoveredAtom);
  const setStreamStatus = useAtomSet(atoms.streamStatusAtom);
  const setStreamError = useAtomSet(atoms.streamErrorAtom);
  const setCustomHeightAtom = useAtomSet(atoms.customHeightAtom);
  const setSettingsExpanded = useAtomSet(atoms.settingsExpandedAtom);

  // Get current foldState for toggle logic
  const foldState = useAtomValue(atoms.foldStateAtom);

  return useMemo(
    () => ({
      toggleFold: () => {
        const next: FoldState =
          foldState === 'expanded' ? 'collapsed' : 'expanded';
        setFoldState(next);
      },

      expand: () => {
        setFoldState('expanded');
      },

      collapse: () => {
        setFoldState('collapsed');
      },

      minimize: () => {
        setFoldState('minimized');
      },

      toggleSettings: () => {
        setSettingsOpen((prev) => !prev);
      },

      setActiveTab: (tabId: string) => {
        setActiveTab(tabId);
      },

      setSelected: (selected: boolean) => {
        setIsSelected(selected);
      },

      setHovered: (hovered: boolean) => {
        setIsHovered(hovered);
      },

      setStreamStatus: (status: StreamStatus) => {
        setStreamStatus(status);
      },

      setStreamError: (error: string | null) => {
        setStreamError(error);
      },

      setCustomHeight: (height: number | null) => {
        setCustomHeightAtom(height);
      },

      resetCustomHeight: () => {
        setCustomHeightAtom(null);
      },

      toggleSettingsExpanded: () => {
        setSettingsExpanded((prev) => !prev);
      },

      setSettingsExpanded: (expanded: boolean) => {
        setSettingsExpanded(expanded);
      },
    }),
    [
      foldState,
      setFoldState,
      setSettingsOpen,
      setActiveTab,
      setIsSelected,
      setIsHovered,
      setStreamStatus,
      setStreamError,
      setCustomHeightAtom,
      setSettingsExpanded,
    ]
  );
}

/**
 * Hook for focus mode actions using React's atom context.
 */
export function useFocusActions() {
  const setFocusedBlockId = useAtomSet(focusedBlockIdAtom);
  const setFocusEnteredAt = useAtomSet(focusEnteredAtAtom);
  const focusedBlockId = useAtomValue(focusedBlockIdAtom);

  return useMemo(
    () => ({
      enterFocus: (blockId: string) => {
        setFocusedBlockId(blockId);
        setFocusEnteredAt(new Date());
      },

      exitFocus: () => {
        setFocusedBlockId(null);
        setFocusEnteredAt(null);
      },

      toggleFocus: (blockId: string) => {
        if (focusedBlockId === blockId) {
          setFocusedBlockId(null);
          setFocusEnteredAt(null);
        } else {
          setFocusedBlockId(blockId);
          setFocusEnteredAt(new Date());
        }
      },

      isFocused: (blockId: string): boolean => {
        return focusedBlockId === blockId;
      },
    }),
    [focusedBlockId, setFocusedBlockId, setFocusEnteredAt]
  );
}

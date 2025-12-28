/**
 * EmbeddedBlockWrapper Atoms
 *
 * Atoms-as-state for embedded block wrapper.
 * Uses Atom.family pattern for per-block isolation.
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import { Layer } from 'effect';
import type { EmbeddedBlockState, FoldState } from './types';
import { BlockStateService, BlockStatePersistenceLive } from './persistence';

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
export const isFocusModeAtom = Atom.make((get) => get(focusedBlockIdAtom) !== null);

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
    Atom.set(focusedBlockIdAtom, blockId);
    Atom.set(focusEnteredAtAtom, new Date());
  },

  /**
   * Exit focus mode.
   */
  exitFocus: () => {
    Atom.set(focusedBlockIdAtom, null);
    Atom.set(focusEnteredAtAtom, null);
  },

  /**
   * Toggle focus mode for a block.
   */
  toggleFocus: (blockId: string) => {
    const current = Atom.get(focusedBlockIdAtom);
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
    return Atom.get(focusedBlockIdAtom) === blockId;
  },
};

// =============================================================================
// Default State
// =============================================================================

export const DEFAULT_EMBEDDED_BLOCK_STATE: EmbeddedBlockState = {
  foldState: 'expanded',
  settingsOpen: false,
  activeTab: 'general',
  isSelected: false,
  isHovered: false,
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

  // Derived: complete state snapshot
  const stateAtom = Atom.make((get): EmbeddedBlockState => ({
    foldState: get(foldStateAtom),
    settingsOpen: get(settingsOpenAtom),
    activeTab: get(activeTabAtom),
    isSelected: get(isSelectedAtom),
    isHovered: get(isHoveredAtom),
  }));

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
      const current = Atom.get(atoms.foldStateAtom);
      const next: FoldState =
        current === 'expanded' ? 'collapsed' : 'expanded';
      Atom.set(atoms.foldStateAtom, next);
    },

    expand: () => {
      Atom.set(atoms.foldStateAtom, 'expanded');
    },

    collapse: () => {
      Atom.set(atoms.foldStateAtom, 'collapsed');
    },

    minimize: () => {
      Atom.set(atoms.foldStateAtom, 'minimized');
    },

    toggleSettings: () => {
      Atom.set(atoms.settingsOpenAtom, (prev) => !prev);
    },

    setActiveTab: (tabId: string) => {
      Atom.set(atoms.activeTabAtom, tabId);
    },

    setSelected: (selected: boolean) => {
      Atom.set(atoms.isSelectedAtom, selected);
    },

    setHovered: (hovered: boolean) => {
      Atom.set(atoms.isHoveredAtom, hovered);
    },
  };
}

export type EmbeddedBlockActions = ReturnType<typeof createEmbeddedBlockActions>;

/**
 * FoldablePanel Atoms
 *
 * Atoms-as-state for foldable panels.
 * Uses Atom.family pattern for per-panel isolation.
 *
 * Framework-agnostic: works with or without TipTap.
 *
 * @module foldable-panel/atoms
 */

import {
  Atom,
  Registry,
  useAtomSet,
  useAtomValue,
} from '@effect-atom/atom-react';
import { useMemo } from 'react';
import type { FoldablePanelState, FoldState, StreamStatus, FoldablePanelActions } from './types';

// =============================================================================
// Module-scoped Registry for synchronous access
// =============================================================================

/**
 * Module-scoped registry for synchronous atom access in event handlers.
 * React components should use useAtomValue()/useSetAtom() hooks instead.
 */
const registry = Registry.make();

// =============================================================================
// Default State
// =============================================================================

export const DEFAULT_FOLDABLE_PANEL_STATE: FoldablePanelState = {
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

export function createFoldablePanelAtoms(panelId: string) {
  // Core state atoms
  const foldStateAtom = Atom.make<FoldState>('expanded');
  const settingsOpenAtom = Atom.make(false);
  const activeTabAtom = Atom.make('general');
  const isSelectedAtom = Atom.make(false);
  const isHoveredAtom = Atom.make(false);

  // Custom height (null = use default from props)
  const customHeightAtom = Atom.make<number | null>(null);

  // Settings panel expanded to full panel viewport
  const settingsExpandedAtom = Atom.make(false);

  // Stream state atoms
  const streamStatusAtom = Atom.make<StreamStatus>('idle');
  const streamErrorAtom = Atom.make<string | null>(null);

  // Derived: complete state snapshot
  const stateAtom = Atom.make(
    (get): FoldablePanelState => ({
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
    panelId,
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

export type FoldablePanelAtoms = ReturnType<typeof createFoldablePanelAtoms>;

// =============================================================================
// Atom Registry
// =============================================================================

const atomRegistry = new Map<string, FoldablePanelAtoms>();

export function getFoldablePanelAtoms(panelId: string): FoldablePanelAtoms {
  let atoms = atomRegistry.get(panelId);
  if (!atoms) {
    atoms = createFoldablePanelAtoms(panelId);
    atomRegistry.set(panelId, atoms);
  }
  return atoms;
}

export function disposeFoldablePanelAtoms(panelId: string): void {
  atomRegistry.delete(panelId);
}

// =============================================================================
// Imperative Actions (for non-React contexts)
// =============================================================================

export function createFoldablePanelActions(atoms: FoldablePanelAtoms) {
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

    setCustomHeight: (height: number | null) => {
      registry.set(atoms.customHeightAtom, height);
    },

    resetCustomHeight: () => {
      registry.set(atoms.customHeightAtom, null);
    },

    toggleSettingsExpanded: () => {
      registry.update(atoms.settingsExpandedAtom, (prev) => !prev);
    },

    setSettingsExpanded: (expanded: boolean) => {
      registry.set(atoms.settingsExpandedAtom, expanded);
    },
  };
}

// =============================================================================
// React Hooks for Actions
// =============================================================================

/**
 * Hook that returns actions using React's atom context.
 *
 * CRITICAL: This hook uses `useAtomSet` which writes to the same registry
 * that `useAtomValue` subscribes to.
 *
 * @param atoms - The atoms for this panel instance
 * @returns Actions that properly trigger React re-renders
 */
export function useFoldablePanelActions(atoms: FoldablePanelAtoms): FoldablePanelActions {
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

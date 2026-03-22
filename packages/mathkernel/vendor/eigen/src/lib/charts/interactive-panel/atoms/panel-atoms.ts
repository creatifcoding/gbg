/**
 * InteractiveChartPanel Atoms
 *
 * Atoms-as-state for interactive chart panels.
 * Uses Atom factory pattern for per-panel isolation.
 *
 * @module charts/interactive-panel/atoms/panel-atoms
 */

import {
  Atom,
  Registry,
  useAtomSet,
  useAtomValue,
} from '@effect-atom/atom-react';
import { useMemo } from 'react';
import { Option } from 'effect';
import type { TabId } from '../schemas';
import type { FoldState, StreamStatus, PanelState } from '../schemas/panel-state';

// =============================================================================
// Module-scoped Registry for synchronous access
// =============================================================================

/**
 * Module-scoped registry for synchronous atom access in event handlers.
 * React components should use useAtomValue()/useSetAtom() hooks instead.
 */
const registry = Registry.make();

// =============================================================================
// Atom Factory
// =============================================================================

/**
 * Create atoms for an InteractiveChartPanel instance.
 *
 * @param panelId - Unique identifier for this panel
 * @param chartId - The chart ID this panel controls
 * @param initialTab - Initial active tab (defaults to 'style')
 */
export function createPanelAtoms(
  panelId: string,
  chartId: string,
  initialTab: TabId = 'style'
) {
  // Core state atoms
  const foldStateAtom = Atom.make<FoldState>('expanded');
  const settingsOpenAtom = Atom.make(false);
  const activeTabAtom = Atom.make<TabId>(initialTab);
  const isSelectedAtom = Atom.make(false);
  const isHoveredAtom = Atom.make(false);

  // Custom height (null = use default from props)
  const customHeightAtom = Atom.make<number | null>(null);

  // Settings panel expanded to full panel viewport
  const settingsExpandedAtom = Atom.make(false);

  // Stream state atoms (for AI-powered features)
  const streamStatusAtom = Atom.make<StreamStatus>('idle');
  const streamErrorAtom = Atom.make<string | null>(null);

  // Derived: complete state snapshot
  const stateAtom = Atom.make(
    (get): PanelState => ({
      foldState: get(foldStateAtom),
      settingsOpen: get(settingsOpenAtom),
      activeTab: get(activeTabAtom),
      isHovered: get(isHoveredAtom),
      isSelected: get(isSelectedAtom),
      customHeight: get(customHeightAtom) === null
        ? Option.none()
        : Option.some(get(customHeightAtom)!),
      settingsExpanded: get(settingsExpandedAtom),
      streamStatus: get(streamStatusAtom),
      streamError: get(streamErrorAtom),
      updatedAt: Date.now(),
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

  // Derived: is streaming active
  const isStreamingAtom = Atom.make(
    (get) => get(streamStatusAtom) === 'connecting' || get(streamStatusAtom) === 'connected'
  );

  return {
    panelId,
    chartId,
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
    isStreamingAtom,
  };
}

export type PanelAtoms = ReturnType<typeof createPanelAtoms>;

// =============================================================================
// Atom Registry
// =============================================================================

const atomRegistry = new Map<string, PanelAtoms>();

/**
 * Get or create atoms for a panel.
 *
 * @param panelId - Unique panel identifier
 * @param chartId - Chart ID (required for new panels)
 * @param initialTab - Initial active tab
 */
export function getPanelAtoms(
  panelId: string,
  chartId?: string,
  initialTab?: TabId
): PanelAtoms {
  let atoms = atomRegistry.get(panelId);
  if (!atoms) {
    if (!chartId) {
      throw new Error(`getPanelAtoms: chartId required for new panel "${panelId}"`);
    }
    atoms = createPanelAtoms(panelId, chartId, initialTab);
    atomRegistry.set(panelId, atoms);
  }
  return atoms;
}

/**
 * Dispose atoms for a panel (cleanup on unmount).
 */
export function disposePanelAtoms(panelId: string): void {
  atomRegistry.delete(panelId);
}

/**
 * Check if atoms exist for a panel.
 */
export function hasPanelAtoms(panelId: string): boolean {
  return atomRegistry.has(panelId);
}

// =============================================================================
// Actions Interface
// =============================================================================

export interface PanelActions {
  toggleFold: () => void;
  expand: () => void;
  collapse: () => void;
  minimize: () => void;
  toggleSettings: () => void;
  setActiveTab: (tabId: TabId) => void;
  setSelected: (selected: boolean) => void;
  setHovered: (hovered: boolean) => void;
  setStreamStatus: (status: StreamStatus) => void;
  setStreamError: (error: string | null) => void;
  setCustomHeight: (height: number | null) => void;
  resetCustomHeight: () => void;
  toggleSettingsExpanded: () => void;
  setSettingsExpanded: (expanded: boolean) => void;
}

// =============================================================================
// Imperative Actions (for non-React contexts)
// =============================================================================

/**
 * Create imperative actions using module-scoped registry.
 * Use these in event handlers outside React component tree.
 */
export function createPanelActions(atoms: PanelAtoms): PanelActions {
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

    setActiveTab: (tabId: TabId) => {
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
export function usePanelActions(atoms: PanelAtoms): PanelActions {
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

      setActiveTab: (tabId: TabId) => {
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

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook to get panel state snapshot.
 */
export function usePanelState(atoms: PanelAtoms): PanelState {
  return useAtomValue(atoms.stateAtom);
}

/**
 * Hook to get active tab.
 */
export function useActiveTab(atoms: PanelAtoms): TabId {
  return useAtomValue(atoms.activeTabAtom);
}

/**
 * Hook to check if controls should be visible.
 */
export function useShowControls(atoms: PanelAtoms): boolean {
  return useAtomValue(atoms.showControlsAtom);
}

/**
 * Hook to check if content is visible.
 */
export function useContentVisible(atoms: PanelAtoms): boolean {
  return useAtomValue(atoms.contentVisibleAtom);
}

/**
 * Hook to check if streaming is active.
 */
export function useIsStreaming(atoms: PanelAtoms): boolean {
  return useAtomValue(atoms.isStreamingAtom);
}

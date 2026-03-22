/**
 * InteractiveChartPanel Context
 *
 * React context provider for panel atoms and actions.
 * Enables compound components to access panel state without prop drilling.
 *
 * @module charts/interactive-panel/context/PanelContext
 */

import { createContext, useContext, useMemo, useEffect } from 'react';
import type { ChartCategory } from '../../registry/definitions';
import type { TabId } from '../schemas';
import {
  type PanelAtoms,
  type PanelActions,
  getPanelAtoms,
  disposePanelAtoms,
  usePanelActions,
} from '../atoms';

// =============================================================================
// Context Types
// =============================================================================

export interface PanelContextValue {
  /** Panel atoms for state access */
  readonly atoms: PanelAtoms;
  /** Panel actions for state mutations */
  readonly actions: PanelActions;
  /** Panel ID */
  readonly panelId: string;
  /** Chart ID this panel controls */
  readonly chartId: string;
  /** Chart category for tab filtering */
  readonly category: ChartCategory;
  /** Available tabs for this category */
  readonly availableTabs: readonly TabId[];
}

// =============================================================================
// Context
// =============================================================================

const PanelContext = createContext<PanelContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export interface PanelProviderProps {
  /** Unique panel identifier */
  panelId: string;
  /** Chart ID this panel controls */
  chartId: string;
  /** Chart category for tab filtering */
  category: ChartCategory;
  /** Available tabs for this category */
  availableTabs: readonly TabId[];
  /** Initial active tab */
  initialTab?: TabId;
  /** Children components */
  children: React.ReactNode;
}

/**
 * Provider component for InteractiveChartPanel context.
 *
 * Creates and manages panel atoms, providing them to compound components.
 * Automatically disposes atoms on unmount.
 *
 * @example
 * ```tsx
 * <PanelProvider
 *   panelId="chart-1-panel"
 *   chartId="chart-1"
 *   category="trend"
 *   availableTabs={['style', 'data', 'series']}
 * >
 *   <InteractiveChartPanel.Header />
 *   <InteractiveChartPanel.Content />
 * </PanelProvider>
 * ```
 */
export function PanelProvider({
  panelId,
  chartId,
  category,
  availableTabs,
  initialTab = 'style',
  children,
}: PanelProviderProps) {
  // Get or create atoms for this panel
  const atoms = useMemo(
    () => getPanelAtoms(panelId, chartId, initialTab),
    [panelId, chartId, initialTab]
  );

  // Create actions using React hooks
  const actions = usePanelActions(atoms);

  // Dispose atoms on unmount
  useEffect(() => {
    return () => {
      disposePanelAtoms(panelId);
    };
  }, [panelId]);

  // Memoize context value
  const value = useMemo<PanelContextValue>(
    () => ({
      atoms,
      actions,
      panelId,
      chartId,
      category,
      availableTabs,
    }),
    [atoms, actions, panelId, chartId, category, availableTabs]
  );

  return (
    <PanelContext.Provider value={value}>
      {children}
    </PanelContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access panel context.
 *
 * Must be used within a PanelProvider.
 *
 * @throws Error if used outside PanelProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { atoms, actions, chartId } = usePanelContext();
 *   const activeTab = useAtomValue(atoms.activeTabAtom);
 *   return <div onClick={() => actions.setActiveTab('data')}>{activeTab}</div>;
 * }
 * ```
 */
export function usePanelContext(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
}

/**
 * Hook to safely try to access panel context.
 * Returns null if not within a PanelProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const context = usePanelContextSafe();
 *   if (!context) return <div>No panel context</div>;
 *   return <div>{context.chartId}</div>;
 * }
 * ```
 */
export function usePanelContextSafe(): PanelContextValue | null {
  return useContext(PanelContext);
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook to get panel atoms from context.
 */
export function usePanelAtoms(): PanelAtoms {
  return usePanelContext().atoms;
}

/**
 * Hook to get panel actions from context.
 */
export function usePanelActionsFromContext(): PanelActions {
  return usePanelContext().actions;
}

/**
 * Hook to get chart ID from context.
 */
export function useChartId(): string {
  return usePanelContext().chartId;
}

/**
 * Hook to get chart category from context.
 */
export function useChartCategory(): ChartCategory {
  return usePanelContext().category;
}

/**
 * Hook to get available tabs from context.
 */
export function useAvailableTabs(): readonly TabId[] {
  return usePanelContext().availableTabs;
}

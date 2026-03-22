/**
 * ChartBlock Atoms
 *
 * Reactive state management for chart blocks using effect-atom.
 *
 * @module editor/v3/extensions/blocks/ChartBlock/atoms
 */

import { Atom, Registry } from '@effect-atom/atom-react';
import type { ChartType } from '@/lib/charts/schemas/base';
import {
  createChartLockAtoms,
  getChartLockAtoms,
  disposeChartLockAtoms,
  type ChartLockAtoms,
} from '@/lib/charts/locks';

// =============================================================================
// Types
// =============================================================================

export interface ChartBlockState {
  /** Chart type */
  chartType: ChartType;
  /** Chart configuration (all chart-specific props) */
  config: Record<string, unknown>;
  /** Inline data (optional) */
  data: unknown[];
  /** Path to external data source (optional) */
  dataPath: string | null;
  /** Whether chart is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

export interface ChartBlockAtoms {
  /** Main state atom */
  stateAtom: Atom.Writable<ChartBlockState, ChartBlockState>;
  /** Chart type (derived) */
  chartTypeAtom: Atom.Atom<ChartType>;
  /** Loading state (derived) */
  loadingAtom: Atom.Atom<boolean>;
  /** Error state (derived) */
  errorAtom: Atom.Atom<string | null>;
  /** Lock atoms */
  lockAtoms: ChartLockAtoms;
}

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_CHART_STATE: ChartBlockState = {
  chartType: 'Line',
  config: {},
  data: [],
  dataPath: null,
  loading: false,
  error: null,
};

// =============================================================================
// Registry
// =============================================================================

/**
 * Singleton registry for chart block atoms
 */
export const chartBlockRegistry = Registry.make();

// =============================================================================
// Atom Factory
// =============================================================================

/**
 * Cache for chart block atoms by ID
 */
const chartBlockAtomCache = new Map<string, ChartBlockAtoms>();

/**
 * Create atoms for a chart block
 *
 * @param blockId - Unique block identifier
 * @param initialState - Optional initial state override
 */
export const createChartBlockAtoms = (
  blockId: string,
  initialState?: Partial<ChartBlockState>
): ChartBlockAtoms => {
  // Return cached if exists
  const cached = chartBlockAtomCache.get(blockId);
  if (cached) return cached;

  // State atom
  const stateAtom = Atom.make<ChartBlockState>({
    ...DEFAULT_CHART_STATE,
    ...initialState,
  });

  // Derived atoms
  const chartTypeAtom = Atom.make<ChartType>((get) => get(stateAtom).chartType);
  const loadingAtom = Atom.make<boolean>((get) => get(stateAtom).loading);
  const errorAtom = Atom.make<string | null>((get) => get(stateAtom).error);

  // Lock atoms (reuse from charts/locks)
  const lockAtoms = createChartLockAtoms(blockId);

  const atoms: ChartBlockAtoms = {
    stateAtom,
    chartTypeAtom,
    loadingAtom,
    errorAtom,
    lockAtoms,
  };

  chartBlockAtomCache.set(blockId, atoms);
  return atoms;
};

/**
 * Get atoms for a chart block (creates if not exists)
 */
export const getChartBlockAtoms = (blockId: string): ChartBlockAtoms => {
  return createChartBlockAtoms(blockId);
};

/**
 * Dispose chart block atoms
 */
export const disposeChartBlockAtoms = (blockId: string): void => {
  chartBlockAtomCache.delete(blockId);
  disposeChartLockAtoms(blockId);
};

// =============================================================================
// Actions
// =============================================================================

/**
 * Create actions for a chart block
 */
export const createChartBlockActions = (blockId: string, registry = chartBlockRegistry) => {
  const atoms = getChartBlockAtoms(blockId);

  return {
    /**
     * Update chart type
     */
    setChartType: (chartType: ChartType): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, { ...current, chartType });
    },

    /**
     * Update chart config
     */
    setConfig: (config: Record<string, unknown>): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, { ...current, config });
    },

    /**
     * Merge into chart config
     */
    mergeConfig: (partial: Record<string, unknown>): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, {
        ...current,
        config: { ...current.config, ...partial },
      });
    },

    /**
     * Update data
     */
    setData: (data: unknown[]): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, { ...current, data });
    },

    /**
     * Update data path
     */
    setDataPath: (dataPath: string | null): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, { ...current, dataPath });
    },

    /**
     * Set loading state
     */
    setLoading: (loading: boolean): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, { ...current, loading });
    },

    /**
     * Set error state
     */
    setError: (error: string | null): void => {
      const current = registry.get(atoms.stateAtom);
      registry.set(atoms.stateAtom, { ...current, error });
    },

    /**
     * Get current state
     */
    getState: (): ChartBlockState => {
      return registry.get(atoms.stateAtom);
    },
  };
};

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook to get chart block actions
 */
export const useChartBlockActions = (blockId: string) => {
  return createChartBlockActions(blockId);
};

/**
 * Hook to get chart block atoms
 */
export const useChartBlockAtoms = (blockId: string): ChartBlockAtoms => {
  return getChartBlockAtoms(blockId);
};

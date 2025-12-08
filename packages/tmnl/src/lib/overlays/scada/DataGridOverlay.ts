/**
 * DataGrid Overlay
 *
 * Reactive overlay that binds to grid row data via ports.
 * Integrates with AG-Grid for tabular data display.
 *
 * Port convention: grid:{gridId}:rows, grid:{gridId}:selected
 *
 * @example
 * ```tsx
 * const { rows, selected, selectRows, refreshData } = useDataGrid({
 *   containerId,
 *   gridId: "alarms" as GridId,
 * })
 *
 * return (
 *   <AgGridReact
 *     rowData={rows}
 *     onSelectionChanged={(e) => selectRows(e.api.getSelectedRows())}
 *   />
 * )
 * ```
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { Overlay, createOverlay } from '../Overlay';
import type { OverlayId, ContainerId } from '../schemas';
import { type GridId, gridPort } from './types';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** Grid configuration for AG-Grid integration */
export interface GridConfig {
  /** Default column definitions */
  readonly defaultColDef?: {
    readonly sortable?: boolean;
    readonly filter?: boolean;
    readonly resizable?: boolean;
    readonly flex?: number;
  };
  /** Row selection mode */
  readonly rowSelection?: 'single' | 'multiple';
  /** Enable pagination */
  readonly pagination?: boolean;
  /** Page size */
  readonly paginationPageSize?: number;
  /** Row height */
  readonly rowHeight?: number;
  /** Header height */
  readonly headerHeight?: number;
}

/** DataGrid overlay configuration */
export interface DataGridOverlayConfig {
  /** Grid identifier */
  readonly gridId: GridId;
  /** Optional display name */
  readonly name?: string;
  /** Grid configuration */
  readonly config?: GridConfig;
  /** Initial row data */
  readonly initialData?: readonly unknown[];
}

// ─────────────────────────────────────────────────────────────
// Grid State
// ─────────────────────────────────────────────────────────────

/** Grid state published to port */
export interface GridState<T = unknown> {
  readonly gridId: GridId;
  readonly rows: readonly T[];
  readonly totalCount: number;
  readonly loading: boolean;
  readonly error?: string;
  readonly lastUpdated: number;
}

/** Selection state */
export interface GridSelection<T = unknown> {
  readonly gridId: GridId;
  readonly selectedRows: readonly T[];
  readonly selectedIds: readonly string[];
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a DataGrid overlay for a specific grid.
 *
 * @param config - Grid configuration
 * @returns Overlay instance
 */
export const createDataGridOverlay = (
  config: DataGridOverlayConfig
): Overlay => {
  const { gridId, name } = config;
  const overlayId = `grid:${gridId}` as OverlayId;
  const rowsPort = gridPort.rows(gridId);
  const selectedPort = gridPort.selected(gridId);
  const configPort = gridPort.config(gridId);

  return createOverlay({
    id: overlayId,
    name: name ?? `Grid: ${gridId}`,
    visualPriority: 5, // Mid-level priority

    // DataGrid is reactive — responds to port data
    handlers: {},

    ports: {
      subscriptions: [rowsPort, configPort],
      publications: [rowsPort, selectedPort],
    },

    onEnable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `[DataGrid] Enabled grid ${gridId} in ${containerId}`
        );
      }),

    onDisable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(
          `[DataGrid] Disabled grid ${gridId} in ${containerId}`
        );
      }),
  });
};

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo, useRef } from 'react';
import { useOverlay, usePort, usePublish } from '../hooks';
import type { UseOverlayResult } from '../hooks/useOverlay';

/** Result of useDataGrid hook */
export interface UseDataGridResult<T = unknown> {
  /** Current row data */
  readonly rows: readonly T[];
  /** Total count (may differ from rows.length for pagination) */
  readonly totalCount: number;
  /** Loading state */
  readonly loading: boolean;
  /** Error message if any */
  readonly error: string | undefined;
  /** Last update timestamp */
  readonly lastUpdated: number;
  /** Currently selected rows */
  readonly selectedRows: readonly T[];
  /** IDs of selected rows */
  readonly selectedIds: readonly string[];
  /** Update row data */
  readonly setRows: (rows: readonly T[]) => void;
  /** Update selection */
  readonly setSelection: (rows: readonly T[], ids?: readonly string[]) => void;
  /** Set loading state */
  readonly setLoading: (loading: boolean) => void;
  /** Set error state */
  readonly setError: (error: string | undefined) => void;
  /** Refresh grid (triggers loading state) */
  readonly refresh: () => void;
  /** Overlay control */
  readonly overlay: UseOverlayResult;
}

/** Options for useDataGrid hook */
export interface UseDataGridOptions<T = unknown> {
  /** Container ID */
  readonly containerId: ContainerId;
  /** Grid ID */
  readonly gridId: GridId;
  /** Optional display name */
  readonly name?: string;
  /** Initial row data */
  readonly initialData?: readonly T[];
  /** Auto-enable on mount (default: true) */
  readonly autoEnable?: boolean;
  /** ID extractor for selection tracking */
  readonly getRowId?: (row: T) => string;
}

/**
 * Hook for grid data management.
 *
 * @param options - Grid options
 * @returns Grid state and control functions
 */
export function useDataGrid<T = unknown>(
  options: UseDataGridOptions<T>
): UseDataGridResult<T> {
  const {
    containerId,
    gridId,
    name,
    initialData = [],
    autoEnable = true,
    getRowId = (row: any) => row.id ?? String(row),
  } = options;

  // Create overlay instance
  const overlayInstance = useMemo(
    () =>
      createDataGridOverlay({
        gridId,
        name,
        initialData,
      }),
    [gridId, name, initialData]
  );

  // Register overlay
  const overlay = useOverlay({
    containerId,
    overlay: overlayInstance,
    autoRegister: true,
    autoEnable,
  });

  // Subscribe to grid state
  const gridState = usePort<GridState<T>>({
    containerId,
    portId: gridPort.rows(gridId),
    initialValue: {
      gridId,
      rows: initialData,
      totalCount: initialData.length,
      loading: false,
      lastUpdated: Date.now(),
    },
  });

  // Subscribe to selection
  const selection = usePort<GridSelection<T>>({
    containerId,
    portId: gridPort.selected(gridId),
    initialValue: {
      gridId,
      selectedRows: [],
      selectedIds: [],
    },
  });

  // Publishers
  const publishState = usePublish<GridState<T>>(
    containerId,
    gridPort.rows(gridId)
  );
  const publishSelection = usePublish<GridSelection<T>>(
    containerId,
    gridPort.selected(gridId)
  );

  // Actions
  const setRows = useCallback(
    (rows: readonly T[]) => {
      publishState({
        gridId,
        rows,
        totalCount: rows.length,
        loading: false,
        lastUpdated: Date.now(),
      });
    },
    [gridId, publishState]
  );

  const setSelection = useCallback(
    (rows: readonly T[], ids?: readonly string[]) => {
      publishSelection({
        gridId,
        selectedRows: rows,
        selectedIds: ids ?? rows.map(getRowId),
      });
    },
    [gridId, getRowId, publishSelection]
  );

  // Use ref to access current value without causing re-renders
  const gridStateRef = useRef(gridState.value);
  gridStateRef.current = gridState.value;

  const setLoading = useCallback(
    (loading: boolean) => {
      const current = gridStateRef.current;
      if (!current) return;
      publishState({
        ...current,
        loading,
        lastUpdated: Date.now(),
      });
    },
    [publishState]  // gridStateRef is stable
  );

  const setError = useCallback(
    (error: string | undefined) => {
      const current = gridStateRef.current;
      if (!current) return;
      publishState({
        ...current,
        error,
        loading: false,
        lastUpdated: Date.now(),
      });
    },
    [publishState]  // gridStateRef is stable
  );

  const refresh = useCallback(() => {
    setLoading(true);
    // Consumer should handle actual refresh logic
  }, [setLoading]);

  // Extract values
  const state = gridState.value ?? {
    gridId,
    rows: initialData,
    totalCount: initialData.length,
    loading: false,
    lastUpdated: Date.now(),
  };

  const sel = selection.value ?? {
    gridId,
    selectedRows: [],
    selectedIds: [],
  };

  return {
    rows: state.rows,
    totalCount: state.totalCount,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    selectedRows: sel.selectedRows,
    selectedIds: sel.selectedIds,
    setRows,
    setSelection,
    setLoading,
    setError,
    refresh,
    overlay,
  };
}

// ─────────────────────────────────────────────────────────────
// Factory Helper (for testing)
// ─────────────────────────────────────────────────────────────

/**
 * Create initial grid state for testing.
 */
export const createGridState = <T>(
  gridId: GridId,
  rows: readonly T[],
  loading = false
): GridState<T> => ({
  gridId,
  rows,
  totalCount: rows.length,
  loading,
  lastUpdated: Schema,
});

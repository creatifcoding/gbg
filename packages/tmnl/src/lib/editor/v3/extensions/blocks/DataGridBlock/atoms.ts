/**
 * DataGridBlock Atoms
 *
 * Per-block reactive state management for DataGridBlock.
 * Uses effect-atom for state with dataplane integration.
 *
 * @module editor/v3/extensions/blocks/DataGridBlock/atoms
 */

import { Atom } from '@effect-atom/atom-react';
import type { ColDef } from 'ag-grid-community';

// =============================================================================
// Types
// =============================================================================

export interface DataGridRow {
  readonly id: string;
  readonly [key: string]: unknown;
}

export interface DataGridState {
  /** Row data for the grid */
  readonly rowData: readonly DataGridRow[];
  /** Column definitions */
  readonly columnDefs: readonly ColDef[];
  /** Whether grid is loading */
  readonly isLoading: boolean;
  /** Error message if any */
  readonly error: string | null;
  /** Row count from dataplane */
  readonly dataplaneRowCount: number;
}

export interface DataGridBlockAtoms {
  readonly rowDataAtom: typeof Atom.make<readonly DataGridRow[]>;
  readonly columnDefsAtom: typeof Atom.make<readonly ColDef[]>;
  readonly isLoadingAtom: typeof Atom.make<boolean>;
  readonly errorAtom: typeof Atom.make<string | null>;
  readonly dataplaneRowCountAtom: typeof Atom.make<number>;
}

// =============================================================================
// Default Column Defs
// =============================================================================

export const DEFAULT_COLUMN_DEFS: readonly ColDef[] = [
  { field: 'id', headerName: 'ID', width: 80, pinned: 'left' },
  { field: 'name', headerName: 'Name', flex: 1 },
  { field: 'value', headerName: 'Value', width: 120 },
  { field: 'status', headerName: 'Status', width: 100 },
];

// =============================================================================
// Demo Data
// =============================================================================

export const DEMO_ROW_DATA: readonly DataGridRow[] = [
  { id: '001', name: 'Temperature Sensor A', value: 23.5, status: 'online' },
  { id: '002', name: 'Pressure Sensor B', value: 101.3, status: 'online' },
  { id: '003', name: 'Flow Rate C', value: 45.2, status: 'warning' },
  { id: '004', name: 'Level Sensor D', value: 78.9, status: 'offline' },
  { id: '005', name: 'Humidity Sensor E', value: 65.0, status: 'online' },
];

// =============================================================================
// Atom Registry
// =============================================================================

const atomRegistry = new Map<string, DataGridBlockAtoms>();

/**
 * Create atoms for a DataGridBlock instance.
 * Returns existing atoms if already created for this blockId.
 */
export function createDataGridBlockAtoms(blockId: string): DataGridBlockAtoms {
  const existing = atomRegistry.get(blockId);
  if (existing) return existing;

  const atoms: DataGridBlockAtoms = {
    rowDataAtom: Atom.make<readonly DataGridRow[]>(DEMO_ROW_DATA),
    columnDefsAtom: Atom.make<readonly ColDef[]>(DEFAULT_COLUMN_DEFS),
    isLoadingAtom: Atom.make<boolean>(false),
    errorAtom: Atom.make<string | null>(null),
    dataplaneRowCountAtom: Atom.make<number>(0),
  };

  atomRegistry.set(blockId, atoms);
  return atoms;
}

/**
 * Get atoms for a DataGridBlock instance.
 * Creates if not exists.
 */
export function getDataGridBlockAtoms(blockId: string): DataGridBlockAtoms {
  return createDataGridBlockAtoms(blockId);
}

/**
 * Dispose atoms for a DataGridBlock instance.
 * Call on unmount to clean up.
 */
export function disposeDataGridBlockAtoms(blockId: string): void {
  atomRegistry.delete(blockId);
}

/**
 * Check if atoms exist for a block.
 */
export function hasDataGridBlockAtoms(blockId: string): boolean {
  return atomRegistry.has(blockId);
}

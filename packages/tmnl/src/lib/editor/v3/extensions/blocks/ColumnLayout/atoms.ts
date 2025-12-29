/**
 * ColumnLayout Atoms
 *
 * Per-block reactive state for column layout UI.
 * Uses effect-atom registry pattern for block-scoped state.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/atoms
 */

import { Atom } from '@effect-atom/atom-react';

import type { ColumnLayoutState } from './types';

// =============================================================================
// Default State
// =============================================================================

const DEFAULT_STATE: ColumnLayoutState = {
  widths: [0.5, 0.5],
  isDragging: false,
  activeHandle: null,
  isStacked: false,
};

// =============================================================================
// Atom Registry
// =============================================================================

/**
 * Atoms for a single ColumnLayout block.
 */
export interface ColumnLayoutAtoms {
  /** Main state atom */
  stateAtom: ReturnType<typeof Atom.make<ColumnLayoutState>>;
  /** Derived: current widths */
  widthsAtom: ReturnType<typeof Atom.make<readonly number[]>>;
  /** Derived: is dragging */
  isDraggingAtom: ReturnType<typeof Atom.make<boolean>>;
}

/**
 * Registry of atoms per block ID.
 */
const atomRegistry = new Map<string, ColumnLayoutAtoms>();

/**
 * Create atoms for a new ColumnLayout block.
 */
export function createColumnLayoutAtoms(
  blockId: string,
  initialState: ColumnLayoutState = DEFAULT_STATE
): ColumnLayoutAtoms {
  // Return existing if already created
  if (atomRegistry.has(blockId)) {
    return atomRegistry.get(blockId)!;
  }

  const stateAtom = Atom.make<ColumnLayoutState>(initialState);

  const widthsAtom = Atom.make((get) => get(stateAtom).widths);
  const isDraggingAtom = Atom.make((get) => get(stateAtom).isDragging);

  const atoms: ColumnLayoutAtoms = {
    stateAtom,
    widthsAtom,
    isDraggingAtom,
  };

  atomRegistry.set(blockId, atoms);
  return atoms;
}

/**
 * Get atoms for an existing ColumnLayout block.
 * Returns undefined if not found.
 */
export function getColumnLayoutAtoms(blockId: string): ColumnLayoutAtoms | undefined {
  return atomRegistry.get(blockId);
}

/**
 * Dispose atoms when block is removed.
 */
export function disposeColumnLayoutAtoms(blockId: string): void {
  atomRegistry.delete(blockId);
}

// =============================================================================
// State Updates
// =============================================================================

/**
 * Start a resize drag operation.
 */
export function startDrag(blockId: string, handleIndex: number): void {
  const atoms = atomRegistry.get(blockId);
  if (!atoms) return;

  Atom.set(atoms.stateAtom, (prev) => ({
    ...prev,
    isDragging: true,
    activeHandle: handleIndex,
  }));
}

/**
 * Update widths during drag.
 */
export function updateWidths(blockId: string, widths: readonly number[]): void {
  const atoms = atomRegistry.get(blockId);
  if (!atoms) return;

  Atom.set(atoms.stateAtom, (prev) => ({
    ...prev,
    widths,
  }));
}

/**
 * End a resize drag operation.
 */
export function endDrag(blockId: string): void {
  const atoms = atomRegistry.get(blockId);
  if (!atoms) return;

  Atom.set(atoms.stateAtom, (prev) => ({
    ...prev,
    isDragging: false,
    activeHandle: null,
  }));
}

/**
 * Update stacked state.
 */
export function setStacked(blockId: string, isStacked: boolean): void {
  const atoms = atomRegistry.get(blockId);
  if (!atoms) return;

  Atom.set(atoms.stateAtom, (prev) => ({
    ...prev,
    isStacked,
  }));
}

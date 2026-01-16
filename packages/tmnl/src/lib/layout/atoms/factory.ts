/**
 * @module layout/atoms/factory
 * @description Atom factory for layout instances - creates and disposes layout atoms
 */

import { Atom } from "@effect-atom/atom"
import { defaultResizeState, equalRatios, type ResizeState } from "../schemas"

/**
 * Atom set for a single layout instance
 */
export interface LayoutAtoms {
  /** Primary state atom containing all resize state (writable) */
  stateAtom: Atom.Writable<ResizeState>
  /** Derived: current cell ratios (read-only) */
  ratiosAtom: Atom.Atom<readonly number[]>
  /** Derived: whether currently dragging (read-only) */
  isDraggingAtom: Atom.Atom<boolean>
  /** Derived: active handle index (read-only, null if not dragging) */
  activeHandleAtom: Atom.Atom<number | null>
}

/**
 * Global registry for layout atoms
 * Keyed by instance ID to support multiple layouts
 */
const atomRegistry = new Map<string, LayoutAtoms>()

/**
 * Create atoms for a layout instance
 * Returns existing atoms if already created (idempotent)
 *
 * @param instanceId - Unique identifier for this layout instance
 * @param cellCount - Number of cells in the layout
 * @param initialRatios - Optional initial ratios (defaults to equal)
 */
export function createLayoutAtoms(
  instanceId: string,
  cellCount: number,
  initialRatios?: number[]
): LayoutAtoms {
  // Return existing if already created
  const existing = atomRegistry.get(instanceId)
  if (existing) return existing

  // Validate or default ratios
  const ratios =
    initialRatios && initialRatios.length === cellCount
      ? initialRatios
      : equalRatios(cellCount)

  // Create primary state atom
  const stateAtom = Atom.make<ResizeState>({
    ...defaultResizeState(cellCount),
    ratios,
  })

  // Derived atoms for convenient access
  const ratiosAtom = Atom.make((get) => get(stateAtom).ratios)
  const isDraggingAtom = Atom.make((get) => get(stateAtom).isDragging)
  const activeHandleAtom = Atom.make((get) => get(stateAtom).activeHandleIndex)

  const atoms: LayoutAtoms = {
    stateAtom,
    ratiosAtom,
    isDraggingAtom,
    activeHandleAtom,
  }

  atomRegistry.set(instanceId, atoms)
  return atoms
}

/**
 * Get atoms for an existing layout instance
 * Returns undefined if not found
 */
export function getLayoutAtoms(instanceId: string): LayoutAtoms | undefined {
  return atomRegistry.get(instanceId)
}

/**
 * Dispose atoms for a layout instance
 * Call when the layout component unmounts
 */
export function disposeLayoutAtoms(instanceId: string): boolean {
  return atomRegistry.delete(instanceId)
}

/**
 * Check if atoms exist for an instance
 */
export function hasLayoutAtoms(instanceId: string): boolean {
  return atomRegistry.has(instanceId)
}

/**
 * Get all registered instance IDs (for debugging)
 */
export function getRegisteredInstanceIds(): string[] {
  return Array.from(atomRegistry.keys())
}

/**
 * Clear all registered atoms (for testing)
 */
export function clearAllLayoutAtoms(): void {
  atomRegistry.clear()
}

/**
 * Update ratios for a layout instance
 * Used when cell count changes
 */
export function updateLayoutCellCount(
  instanceId: string,
  newCellCount: number,
  preserveRatios: boolean = false
): LayoutAtoms | undefined {
  const existing = atomRegistry.get(instanceId)
  if (!existing) return undefined

  // Dispose and recreate with new cell count
  // Optionally preserve ratios by redistributing
  const currentRatios = preserveRatios
    ? redistributeRatios(existing.stateAtom, newCellCount)
    : undefined

  disposeLayoutAtoms(instanceId)
  return createLayoutAtoms(instanceId, newCellCount, currentRatios)
}

/**
 * Helper: Redistribute ratios when cell count changes
 */
function redistributeRatios(
  _stateAtom: Atom.Writable<ResizeState>,
  newCount: number
): number[] {
  // This is a simplified redistribution
  // In practice, you might want more sophisticated logic
  // Could read current ratios from stateAtom and redistribute proportionally
  return equalRatios(newCount)
}

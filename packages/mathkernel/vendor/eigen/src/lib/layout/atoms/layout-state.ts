/**
 * @module layout/atoms/layout-state
 * @description Layout state operations for drag-to-resize
 */

import { Registry } from "@effect-atom/atom"
import {
  clampRatio,
  normalizeRatios,
  Position,
  type ResizeState,
} from "../schemas"
import { getLayoutAtoms } from "./factory"

/**
 * Start a drag operation on a resize handle
 *
 * @param registry - Atom registry for state mutations
 * @param instanceId - Layout instance ID
 * @param handleIndex - Index of the handle being dragged
 * @param startPosition - Starting mouse/touch position
 */
export function startDrag(
  registry: Registry.Registry,
  instanceId: string,
  handleIndex: number,
  startPosition: { x: number; y: number }
): boolean {
  const atoms = getLayoutAtoms(instanceId)
  if (!atoms) return false

  const currentState = registry.get(atoms.stateAtom)

  registry.set(atoms.stateAtom, {
    ...currentState,
    isDragging: true,
    activeHandleIndex: handleIndex,
    startPosition: new Position(startPosition),
    startRatios: [...currentState.ratios],
  })

  return true
}

/**
 * Update ratios during drag based on mouse movement
 *
 * @param registry - Atom registry for state mutations
 * @param instanceId - Layout instance ID
 * @param currentPosition - Current mouse/touch position
 * @param containerSize - Container size in pixels (width for horizontal, height for vertical)
 * @param direction - Resize direction ("horizontal" or "vertical")
 * @param minRatio - Minimum ratio for any cell
 */
export function updateDrag(
  registry: Registry.Registry,
  instanceId: string,
  currentPosition: { x: number; y: number },
  containerSize: number,
  direction: "horizontal" | "vertical",
  minRatio: number = 0.1
): boolean {
  const atoms = getLayoutAtoms(instanceId)
  if (!atoms) return false

  const state = registry.get(atoms.stateAtom)

  // Guard: must be dragging with valid start state
  if (
    !state.isDragging ||
    state.activeHandleIndex === null ||
    !state.startPosition ||
    !state.startRatios
  ) {
    return false
  }

  const { activeHandleIndex, startPosition, startRatios } = state

  // Calculate delta based on direction
  const delta =
    direction === "horizontal"
      ? currentPosition.x - startPosition.x
      : currentPosition.y - startPosition.y

  // Convert pixel delta to ratio delta
  const ratioDelta = delta / containerSize

  // Calculate new ratios
  const newRatios = calculateNewRatios(
    startRatios,
    activeHandleIndex,
    ratioDelta,
    minRatio
  )

  registry.set(atoms.stateAtom, {
    ...state,
    ratios: newRatios,
  })

  return true
}

/**
 * End a drag operation
 *
 * @param registry - Atom registry for state mutations
 * @param instanceId - Layout instance ID
 * @returns Final ratios after drag, or undefined if not dragging
 */
export function endDrag(
  registry: Registry.Registry,
  instanceId: string
): number[] | undefined {
  const atoms = getLayoutAtoms(instanceId)
  if (!atoms) return undefined

  const state = registry.get(atoms.stateAtom)
  if (!state.isDragging) return undefined

  const finalRatios = [...state.ratios]

  registry.set(atoms.stateAtom, {
    ...state,
    isDragging: false,
    activeHandleIndex: null,
    startPosition: null,
    startRatios: null,
  })

  return finalRatios
}

/**
 * Set ratios directly (for external control or persistence restore)
 *
 * @param registry - Atom registry for state mutations
 * @param instanceId - Layout instance ID
 * @param ratios - New ratios to set
 */
export function setRatios(
  registry: Registry.Registry,
  instanceId: string,
  ratios: number[]
): boolean {
  const atoms = getLayoutAtoms(instanceId)
  if (!atoms) return false

  const state = registry.get(atoms.stateAtom)
  const normalized = normalizeRatios(ratios)

  registry.set(atoms.stateAtom, {
    ...state,
    ratios: normalized,
  })

  return true
}

/**
 * Reset ratios to equal distribution
 *
 * @param registry - Atom registry for state mutations
 * @param instanceId - Layout instance ID
 */
export function resetRatios(
  registry: Registry.Registry,
  instanceId: string
): boolean {
  const atoms = getLayoutAtoms(instanceId)
  if (!atoms) return false

  const state = registry.get(atoms.stateAtom)
  const cellCount = state.ratios.length
  const equalRatios = Array(cellCount).fill(1 / cellCount)

  registry.set(atoms.stateAtom, {
    ...state,
    ratios: equalRatios,
  })

  return true
}

/**
 * Get current state (for reading without subscription)
 */
export function getState(
  registry: Registry.Registry,
  instanceId: string
): ResizeState | undefined {
  const atoms = getLayoutAtoms(instanceId)
  if (!atoms) return undefined
  return registry.get(atoms.stateAtom)
}

/**
 * Get current ratios (for reading without subscription)
 */
export function getRatios(
  registry: Registry.Registry,
  instanceId: string
): readonly number[] | undefined {
  const state = getState(registry, instanceId)
  return state?.ratios
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Calculate new ratios based on handle movement
 *
 * When handle N is moved, it adjusts the boundary between cell N and cell N+1.
 * The ratioDelta is added to cell N and subtracted from cell N+1.
 */
function calculateNewRatios(
  startRatios: readonly number[],
  handleIndex: number,
  ratioDelta: number,
  minRatio: number
): number[] {
  const newRatios = [...startRatios]
  const leftIndex = handleIndex
  const rightIndex = handleIndex + 1

  // Bounds check
  if (leftIndex < 0 || rightIndex >= newRatios.length) {
    return newRatios
  }

  // Calculate new values
  let newLeft = startRatios[leftIndex] + ratioDelta
  let newRight = startRatios[rightIndex] - ratioDelta

  // Clamp to minRatio
  const maxLeft = startRatios[leftIndex] + startRatios[rightIndex] - minRatio
  const maxRight = startRatios[leftIndex] + startRatios[rightIndex] - minRatio

  newLeft = clampRatio(newLeft, minRatio, maxLeft)
  newRight = clampRatio(newRight, minRatio, maxRight)

  // Ensure they still sum to original combined value
  const combined = startRatios[leftIndex] + startRatios[rightIndex]
  if (newLeft + newRight !== combined) {
    // Adjust to maintain sum
    const scale = combined / (newLeft + newRight)
    newLeft *= scale
    newRight *= scale
  }

  newRatios[leftIndex] = newLeft
  newRatios[rightIndex] = newRight

  return normalizeRatios(newRatios)
}

/**
 * Create a state updater function for use with Atom.update
 */
export function createStateUpdater(
  update: (state: ResizeState) => Partial<ResizeState>
): (state: ResizeState) => ResizeState {
  return (state) => ({
    ...state,
    ...update(state),
  }) as ResizeState
}

/**
 * @module layout/services/ResizeService
 * @description Service for calculating resize ratios
 */

import { Context, Effect, Layer } from "effect"
import {
  clampRatio,
  equalRatios,
  normalizeRatios,
  type ResizeResult,
} from "../schemas"

// =============================================================================
// Types
// =============================================================================

/**
 * Input for resize calculation
 */
export interface ResizeInput {
  /** Current mouse/touch position (x or y depending on direction) */
  currentPos: number
  /** Starting position when drag began */
  startPos: number
  /** Container size in pixels */
  containerSize: number
  /** Ratios at drag start */
  startRatios: readonly number[]
  /** Index of handle being dragged (0 = between cell 0 and 1) */
  handleIndex: number
  /** Minimum ratio for any cell */
  minRatio?: number
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ResizeService interface
 */
export class ResizeService extends Context.Tag("ResizeService")<
  ResizeService,
  {
    /**
     * Calculate new ratios based on resize input
     */
    readonly calculateResize: (input: ResizeInput) => Effect.Effect<ResizeResult>

    /**
     * Normalize ratios to sum to 1
     */
    readonly normalize: (ratios: readonly number[]) => Effect.Effect<readonly number[]>

    /**
     * Generate equal ratios for n cells
     */
    readonly equal: (n: number) => Effect.Effect<readonly number[]>

    /**
     * Clamp a ratio within min/max bounds
     */
    readonly clamp: (
      ratio: number,
      min?: number,
      max?: number
    ) => Effect.Effect<number>
  }
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Calculate new ratios based on handle movement
 */
function calculateNewRatios(input: ResizeInput): ResizeResult {
  const {
    currentPos,
    startPos,
    containerSize,
    startRatios,
    handleIndex,
    minRatio = 0.1,
  } = input

  // Calculate pixel delta
  const delta = currentPos - startPos

  // Convert to ratio delta
  const ratioDelta = delta / containerSize

  // Work with mutable copy
  const newRatios = [...startRatios]
  const leftIndex = handleIndex
  const rightIndex = handleIndex + 1

  // Bounds check
  if (leftIndex < 0 || rightIndex >= newRatios.length) {
    return { ratios: newRatios, applied: false }
  }

  // Calculate new values
  let newLeft = startRatios[leftIndex] + ratioDelta
  let newRight = startRatios[rightIndex] - ratioDelta

  // Calculate max allowed values
  const combined = startRatios[leftIndex] + startRatios[rightIndex]
  const maxRatio = combined - minRatio

  // Clamp values
  newLeft = clampRatio(newLeft, minRatio, maxRatio)
  newRight = clampRatio(newRight, minRatio, maxRatio)

  // Ensure they sum to the original combined value
  const sum = newLeft + newRight
  if (Math.abs(sum - combined) > 0.0001) {
    const scale = combined / sum
    newLeft *= scale
    newRight *= scale
  }

  newRatios[leftIndex] = newLeft
  newRatios[rightIndex] = newRight

  // Check if anything actually changed
  const applied =
    Math.abs(newRatios[leftIndex] - startRatios[leftIndex]) > 0.0001 ||
    Math.abs(newRatios[rightIndex] - startRatios[rightIndex]) > 0.0001

  return {
    ratios: normalizeRatios(newRatios),
    applied,
  }
}

/**
 * Live implementation of ResizeService
 */
export const ResizeServiceLive = Layer.succeed(ResizeService, {
  calculateResize: (input) => Effect.sync(() => calculateNewRatios(input)),

  normalize: (ratios) => Effect.sync(() => normalizeRatios([...ratios])),

  equal: (n) => Effect.sync(() => equalRatios(n)),

  clamp: (ratio, min, max) => Effect.sync(() => clampRatio(ratio, min, max)),
})

// =============================================================================
// Standalone Functions (for non-Effect usage)
// =============================================================================

/**
 * Calculate resize synchronously (no Effect)
 * For use in React event handlers
 */
export function calculateResizeSync(input: ResizeInput): ResizeResult {
  return calculateNewRatios(input)
}

/**
 * Convert pixel delta to ratio delta
 */
export function pixelToRatioDelta(
  pixelDelta: number,
  containerSize: number
): number {
  if (containerSize === 0) return 0
  return pixelDelta / containerSize
}

/**
 * Convert ratio to pixel position
 */
export function ratioToPixel(ratio: number, containerSize: number): number {
  return ratio * containerSize
}

/**
 * Get cumulative pixel positions for all handles
 * Handle N is positioned at the sum of ratios 0..N
 */
export function getHandlePositions(
  ratios: readonly number[],
  containerSize: number,
  gapSize: number = 0
): number[] {
  const positions: number[] = []
  let cumulative = 0
  const totalGaps = (ratios.length - 1) * gapSize
  const availableSize = containerSize - totalGaps

  for (let i = 0; i < ratios.length - 1; i++) {
    cumulative += ratios[i] * availableSize + gapSize
    positions.push(cumulative - gapSize / 2) // Center on gap
  }

  return positions
}

/**
 * Snap ratio to nearest grid value
 */
export function snapToGrid(ratio: number, gridSize: number = 0.05): number {
  return Math.round(ratio / gridSize) * gridSize
}

/**
 * Distribute extra space evenly among cells
 */
export function distributeSpace(
  ratios: readonly number[],
  extraSpace: number
): number[] {
  const perCell = extraSpace / ratios.length
  return ratios.map((r) => r + perCell)
}

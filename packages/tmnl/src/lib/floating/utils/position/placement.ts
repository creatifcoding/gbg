/**
 * Placement algorithms — cascade, findOpenSlot, stagger.
 *
 * @module floating/utils/position/placement
 */

import type { Position, Dimensions } from '../../types'
import { CASCADE_OFFSET, VIEWPORT_PADDING, OVERLAP_THRESHOLD, type Viewport, type PanelRect } from './types'
import { clampToViewport, rectsOverlap } from './constraints'

/**
 * Calculate the next cascade position given existing panel positions.
 */
export function cascadePosition(
  existing: ReadonlyArray<PanelRect>,
  dimensions: Dimensions,
  viewport: Viewport,
  offset: number = CASCADE_OFFSET,
): Position {
  const startX = viewport.x + VIEWPORT_PADDING
  const startY = viewport.y + VIEWPORT_PADDING
  const maxX = viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING
  const maxY = viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING

  if (existing.length === 0) {
    return { x: Math.min(startX, maxX), y: Math.min(startY, maxY) }
  }

  let wrapCount = 0
  for (let i = 0; i < existing.length + 5; i++) {
    const candidateX = startX + (i * offset) + (wrapCount * offset * 0.5)
    const candidateY = startY + (i * offset) + (wrapCount * offset * 0.5)

    if (candidateX > maxX || candidateY > maxY) {
      wrapCount++
      continue
    }

    const overlaps = existing.some(
      (p) =>
        Math.abs(p.x - candidateX) < OVERLAP_THRESHOLD &&
        Math.abs(p.y - candidateY) < OVERLAP_THRESHOLD
    )

    if (!overlaps) {
      return { x: candidateX, y: candidateY }
    }
  }

  const last = existing[existing.length - 1]
  return clampToViewport(
    { x: last.x + offset, y: last.y + offset },
    dimensions,
    viewport,
  )
}

/**
 * Scan viewport for the first rectangular gap that fits the given dimensions.
 */
export function findOpenSlot(
  existing: ReadonlyArray<PanelRect>,
  dimensions: Dimensions,
  viewport: Viewport,
  scanStep: number = 40,
): Position | null {
  const maxX = viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING
  const maxY = viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING

  for (let y = viewport.y + VIEWPORT_PADDING; y <= maxY; y += scanStep) {
    for (let x = viewport.x + VIEWPORT_PADDING; x <= maxX; x += scanStep) {
      const candidate: PanelRect = { x, y, width: dimensions.width, height: dimensions.height }
      const fits = !existing.some((p) => rectsOverlap(candidate, p))
      if (fits) return { x, y }
    }
  }

  return null
}

/**
 * Simple diagonal stagger: panel N is offset by N * step from origin.
 */
export function staggerOffset(
  index: number,
  step: number = CASCADE_OFFSET,
): Position {
  return { x: index * step, y: index * step }
}

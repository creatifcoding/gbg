/**
 * Bounds — pure logic for floating panel bounds (no React/JSX).
 *
 * Extracted from FloatingBoundsContext to avoid @vitejs/plugin-react
 * preamble detection failures when `effect` Schema is imported in .tsx files.
 *
 * @module
 */

import { Schema } from 'effect'
import { observable } from '@legendapp/state'

// =============================================================================
// Schema
// =============================================================================

export const Bounds = Schema.Struct({
  left: Schema.Number,
  top: Schema.Number,
  right: Schema.Number,
  bottom: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type Bounds = typeof Bounds.Type

// =============================================================================
// Global Bounds State (stx-adjacent)
// =============================================================================

export const boundsState = observable<Bounds | null>(null)

/**
 * Get current bounds (for use in drag/resize handlers).
 *
 * Priority:
 * 1. Explicit FloatingBoundsProvider (if mounted)
 * 2. AppShell workspace element (detected by data-shell-workspace attribute).
 *    With `contain: paint` on the workspace, position:fixed children are
 *    workspace-relative, so bounds are { 0, 0, width, height }.
 * 3. null (falls back to window dimensions at call site)
 */
export function getBounds(): Bounds | null {
  const explicit = boundsState.get()
  if (explicit) return explicit

  // Fallback: measure the AppShell workspace
  if (typeof document !== 'undefined') {
    const workspace = document.querySelector('[data-shell-workspace]')
    if (workspace) {
      const rect = workspace.getBoundingClientRect()
      return {
        left: 0,
        top: 0,
        right: rect.width,
        bottom: rect.height,
        width: rect.width,
        height: rect.height,
      }
    }
  }

  return null
}

/** Set bounds (called by provider on resize) */
export function setBounds(bounds: Bounds | null): void {
  boundsState.set(bounds)
}

// =============================================================================
// Clamping Utilities
// =============================================================================

/**
 * Clamp a position within bounds, accounting for panel dimensions.
 * Ensures the panel stays fully within the container.
 */
export function clampPosition(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  bounds: Bounds | null,
): { x: number; y: number } {
  if (!bounds) return position

  const minX = bounds.left
  const minY = bounds.top
  const maxX = bounds.right - dimensions.width
  const maxY = bounds.bottom - dimensions.height

  return {
    x: Math.max(minX, Math.min(position.x, maxX)),
    y: Math.max(minY, Math.min(position.y, maxY)),
  }
}

/**
 * Clamp dimensions within bounds, accounting for position.
 * Prevents panel from extending beyond container edges.
 */
export function clampDimensions(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  minDimensions: { width: number; height: number },
  bounds: Bounds | null,
): { width: number; height: number } {
  if (!bounds) return dimensions

  const maxWidth = bounds.right - position.x
  const maxHeight = bounds.bottom - position.y

  return {
    width: Math.max(minDimensions.width, Math.min(dimensions.width, maxWidth)),
    height: Math.max(minDimensions.height, Math.min(dimensions.height, maxHeight)),
  }
}

/**
 * Clamp both position and dimensions for resize operations.
 * Handles edge cases where resizing from top/left edges affects position.
 */
export function clampResize(
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  minDimensions: { width: number; height: number },
  bounds: Bounds | null,
): { position: { x: number; y: number }; dimensions: { width: number; height: number } } {
  if (!bounds) return { position, dimensions }

  let { x, y } = position
  let { width, height } = dimensions

  if (x < bounds.left) {
    const overflow = bounds.left - x
    x = bounds.left
    width = Math.max(minDimensions.width, width - overflow)
  }

  if (y < bounds.top) {
    const overflow = bounds.top - y
    y = bounds.top
    height = Math.max(minDimensions.height, height - overflow)
  }

  if (x + width > bounds.right) {
    width = Math.max(minDimensions.width, bounds.right - x)
  }

  if (y + height > bounds.bottom) {
    height = Math.max(minDimensions.height, bounds.bottom - y)
  }

  return {
    position: { x, y },
    dimensions: { width, height },
  }
}

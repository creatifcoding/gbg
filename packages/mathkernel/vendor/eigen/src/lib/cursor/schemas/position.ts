/**
 * Position Schemas for Cursor System
 *
 * Native positioning model using component's { x, y } schema.
 * Corner presets computed from bounds at runtime.
 */

import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// Core Position Types
// -----------------------------------------------------------------------------

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Position = typeof Position.Type

export const CornerPreset = Schema.Literal(
  'bottom-right',
  'bottom-left',
  'top-right',
  'top-left',
  'center'
)
export type CornerPreset = typeof CornerPreset.Type

export const Bounds = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
})
export type Bounds = typeof Bounds.Type

export const IslandSize = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
})
export type IslandSize = typeof IslandSize.Type

// -----------------------------------------------------------------------------
// Drag Constraints (from Dynamic Island component)
// -----------------------------------------------------------------------------

export const DragConstraints = Schema.Struct({
  left: Schema.optional(Schema.Number),
  right: Schema.optional(Schema.Number),
  top: Schema.optional(Schema.Number),
  bottom: Schema.optional(Schema.Number),
})
export type DragConstraints = typeof DragConstraints.Type

// -----------------------------------------------------------------------------
// Position Computation
// -----------------------------------------------------------------------------

const DEFAULT_PADDING = 16

/**
 * Compute absolute position from corner preset
 */
export const computeCornerPosition = (
  preset: CornerPreset,
  bounds: Bounds,
  islandSize: IslandSize,
  padding = DEFAULT_PADDING
): Position => {
  switch (preset) {
    case 'bottom-right':
      return {
        x: bounds.width - islandSize.width - padding,
        y: bounds.height - islandSize.height - padding,
      }
    case 'bottom-left':
      return {
        x: padding,
        y: bounds.height - islandSize.height - padding,
      }
    case 'top-right':
      return {
        x: bounds.width - islandSize.width - padding,
        y: padding,
      }
    case 'top-left':
      return {
        x: padding,
        y: padding,
      }
    case 'center':
      return {
        x: (bounds.width - islandSize.width) / 2,
        y: (bounds.height - islandSize.height) / 2,
      }
  }
}

/**
 * Compute drag constraints from bounds
 */
export const computeConstraints = (
  bounds: Bounds,
  islandSize: IslandSize,
  padding = DEFAULT_PADDING
): DragConstraints => ({
  left: padding,
  right: bounds.width - islandSize.width - padding,
  top: padding,
  bottom: bounds.height - islandSize.height - padding,
})

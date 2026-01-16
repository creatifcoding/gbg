/**
 * @module layout/schemas/resize
 * @description Resize state schemas for drag-to-resize functionality
 */

import { Schema } from "effect"

/**
 * Resize direction
 */
export const ResizeDirection = Schema.Literal("horizontal", "vertical")
export type ResizeDirection = typeof ResizeDirection.Type

/**
 * Position in 2D space
 */
export class Position extends Schema.Class<Position>("Position")({
  x: Schema.Number,
  y: Schema.Number,
}) {}

/**
 * Resize state during drag operations
 */
export class ResizeState extends Schema.Class<ResizeState>("ResizeState")({
  /** Current cell ratios (must sum to 1) */
  ratios: Schema.Array(Schema.Number),
  /** Whether currently dragging */
  isDragging: Schema.Boolean,
  /** Index of handle being dragged (0 = between cell 0 and 1) */
  activeHandleIndex: Schema.NullOr(Schema.Number),
  /** Starting position of drag */
  startPosition: Schema.NullOr(Position),
  /** Ratios at drag start (for delta calculation) */
  startRatios: Schema.NullOr(Schema.Array(Schema.Number)),
}) {}

/**
 * Default resize state factory
 */
export const defaultResizeState = (cellCount: number): ResizeState =>
  new ResizeState({
    ratios: equalRatios(cellCount),
    isDragging: false,
    activeHandleIndex: null,
    startPosition: null,
    startRatios: null,
  })

/**
 * Generate equal ratios for n cells
 */
export const equalRatios = (n: number): number[] =>
  n > 0 ? Array(n).fill(1 / n) : [1]

/**
 * Normalize ratios to sum to 1
 */
export const normalizeRatios = (ratios: number[]): number[] => {
  const sum = ratios.reduce((a, b) => a + b, 0)
  if (sum === 0) return equalRatios(ratios.length)
  return ratios.map((r) => r / sum)
}

/**
 * Clamp a ratio within min/max bounds
 */
export const clampRatio = (
  ratio: number,
  min: number = 0.05,
  max: number = 0.95
): number => Math.max(min, Math.min(max, ratio))

/**
 * Resize handle props for component
 */
export class ResizeHandleProps extends Schema.Class<ResizeHandleProps>(
  "ResizeHandleProps"
)({
  /** Resize direction */
  direction: ResizeDirection,
  /** Handle index (0 = between cell 0 and 1) */
  index: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  /** Current cell ratios */
  ratios: Schema.Array(Schema.Number),
  /** Container size in pixels (width for horizontal, height for vertical) */
  containerSize: Schema.Number.pipe(Schema.positive()),
  /** Minimum ratio for any cell */
  minRatio: Schema.optionalWith(Schema.Number, { default: () => 0.1 }),
  /** Optional CSS class */
  className: Schema.optional(Schema.String),
}) {}

/**
 * Result of a resize calculation
 */
export class ResizeResult extends Schema.Class<ResizeResult>("ResizeResult")({
  /** Updated ratios after resize */
  ratios: Schema.Array(Schema.Number),
  /** Whether the resize was applied (false if would violate constraints) */
  applied: Schema.Boolean,
}) {}

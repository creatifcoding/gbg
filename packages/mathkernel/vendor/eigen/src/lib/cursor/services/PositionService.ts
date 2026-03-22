/**
 * PositionService
 *
 * Stateless computation service for cursor positioning.
 * State is managed by atoms (Atom-as-State doctrine).
 * This service provides utilities for position calculations.
 */

import { Effect, Layer, Context } from 'effect'
import {
  type Position,
  type Bounds,
  type IslandSize,
  type CornerPreset,
  type DragConstraints,
  computeCornerPosition,
  computeConstraints,
} from '../schemas/position'

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

export interface PositionServiceShape {
  /** Compute position for a corner preset */
  readonly computeCornerPosition: (
    preset: CornerPreset,
    bounds: Bounds,
    islandSize: IslandSize,
    padding?: number
  ) => Position

  /** Compute drag constraints from bounds */
  readonly computeConstraints: (
    bounds: Bounds,
    islandSize: IslandSize,
    padding?: number
  ) => DragConstraints

  /** Set position (returns Effect for consistency, but is sync) */
  readonly setPosition: (pos: Position) => Effect.Effect<void>

  /** Set bounds (returns Effect for consistency, but is sync) */
  readonly setBounds: (bounds: Bounds) => Effect.Effect<void>

  /** Move to a corner preset (convenience method) */
  readonly moveToCorner: (
    preset: CornerPreset,
    bounds: Bounds,
    islandSize: IslandSize,
    padding?: number
  ) => Effect.Effect<Position>
}

// -----------------------------------------------------------------------------
// Service Tag
// -----------------------------------------------------------------------------

export class PositionService extends Context.Tag('tmnl/cursor/PositionService')<
  PositionService,
  PositionServiceShape
>() {}

// -----------------------------------------------------------------------------
// Default Implementation
// -----------------------------------------------------------------------------

const DEFAULT_PADDING = 16

const positionServiceImpl: PositionServiceShape = {
  computeCornerPosition: (
    preset: CornerPreset,
    bounds: Bounds,
    islandSize: IslandSize,
    padding = DEFAULT_PADDING
  ): Position => computeCornerPosition(preset, bounds, islandSize, padding),

  computeConstraints: (
    bounds: Bounds,
    islandSize: IslandSize,
    padding = DEFAULT_PADDING
  ): DragConstraints => computeConstraints(bounds, islandSize, padding),

  setPosition: (_pos: Position) =>
    // No-op - actual state update happens in atoms via ctx.set()
    Effect.void,

  setBounds: (_bounds: Bounds) =>
    // No-op - actual state update happens in atoms via ctx.set()
    Effect.void,

  moveToCorner: (
    preset: CornerPreset,
    bounds: Bounds,
    islandSize: IslandSize,
    padding = DEFAULT_PADDING
  ) =>
    Effect.sync(() => computeCornerPosition(preset, bounds, islandSize, padding)),
}

// -----------------------------------------------------------------------------
// Layer
// -----------------------------------------------------------------------------

export const PositionServiceLive = Layer.succeed(PositionService, positionServiceImpl)

export const PositionServiceDefault = PositionServiceLive

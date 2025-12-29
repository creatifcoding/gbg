/**
 * Cursor System Atoms
 *
 * effect-atom bindings for cursor state management.
 * Follows Atom-as-State doctrine: atoms are the primary state,
 * operations mutate atoms directly via ctx.set().
 */

import { Atom } from '@effect-atom/atom'
import * as Effect from 'effect/Effect'
import type { UIMessage } from 'ai'
import {
  type Position,
  type Bounds,
  type CornerPreset,
  type IslandSize,
  computeCornerPosition,
} from '../schemas/position'

// -----------------------------------------------------------------------------
// State Atoms (module-level, stable refs)
// -----------------------------------------------------------------------------

/** Chat messages from AI SDK */
export const messagesAtom = Atom.make<UIMessage[]>([])

/** Current AI status */
export const statusAtom = Atom.make<'idle' | 'streaming' | 'thinking'>('idle')

/** Current position in pixels */
export const positionAtom = Atom.make<Position>({ x: 0, y: 0 })

/** Content area bounds */
export const boundsAtom = Atom.make<Bounds>({ width: 0, height: 0 })

/** Current corner preset (for persistence) */
export const currentCornerAtom = Atom.make<CornerPreset>('bottom-right')

/** Island display state */
export const cursorStateAtom = Atom.make<'pill' | 'chat'>('pill')

/** Current size key for the island */
export const sizeKeyAtom = Atom.make<string>('minimal')

// -----------------------------------------------------------------------------
// Derived Atoms
// -----------------------------------------------------------------------------

/** Whether bounds have been measured */
export const hasBoundsAtom = Atom.make((get) => {
  const bounds = get(boundsAtom)
  return bounds.width > 0 && bounds.height > 0
})

// -----------------------------------------------------------------------------
// Runtime Atom (minimal - for future service integration)
// -----------------------------------------------------------------------------

import * as Layer from 'effect/Layer'
import { PositionServiceDefault } from '../services/PositionService'

export const cursorRuntimeAtom = Atom.runtime(PositionServiceDefault)

// -----------------------------------------------------------------------------
// Operation Atoms
// -----------------------------------------------------------------------------

const DEFAULT_PADDING = 16

export const cursorOps = {
  /**
   * Move cursor to a corner preset or direct coordinates
   */
  moveTo: cursorRuntimeAtom.fn<{ position: CornerPreset | Position; islandSize: IslandSize }>()(
    (args, ctx) =>
      Effect.sync(() => {
        if (typeof args.position === 'string') {
          // Corner preset - use pure function for computation
          const bounds = ctx.get(boundsAtom)
          const pos = computeCornerPosition(args.position, bounds, args.islandSize, DEFAULT_PADDING)
          ctx.set(positionAtom, pos)
          ctx.set(currentCornerAtom, args.position)
        } else {
          // Direct coordinates
          ctx.set(positionAtom, args.position)
        }
      })
  ),

  /**
   * Update content area bounds
   */
  updateBounds: cursorRuntimeAtom.fn<{ bounds: Bounds }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(boundsAtom, args.bounds)
    })
  ),

  /**
   * Initialize cursor to bottom-right corner
   */
  initializeToBottomRight: cursorRuntimeAtom.fn<{ islandSize: IslandSize }>()((args, ctx) =>
    Effect.sync(() => {
      const bounds = ctx.get(boundsAtom)
      const pos = computeCornerPosition('bottom-right', bounds, args.islandSize, DEFAULT_PADDING)
      ctx.set(positionAtom, pos)
      ctx.set(currentCornerAtom, 'bottom-right')
    })
  ),

  /**
   * Expand cursor to chat mode
   */
  expand: cursorRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(cursorStateAtom, 'chat')
      ctx.set(sizeKeyAtom, 'default')
    })
  ),

  /**
   * Collapse cursor to pill mode
   */
  collapse: cursorRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      ctx.set(cursorStateAtom, 'pill')
      ctx.set(sizeKeyAtom, 'minimal')
    })
  ),

  /**
   * Update position after drag
   */
  updatePosition: cursorRuntimeAtom.fn<{ position: Position }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(positionAtom, args.position)
    })
  ),
}

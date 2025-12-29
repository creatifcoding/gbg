/**
 * Cursor System Atoms
 *
 * effect-atom bindings for cursor state management.
 * Follows Atom-as-State doctrine: atoms are the primary state,
 * operations mutate atoms directly via ctx.set().
 *
 * Uses stx pattern for XState integration:
 * - snapshotAtom bridges XState → effect-atom
 * - Derived atoms read from snapshot
 * - Operations send events to actor
 */

import { Atom } from '@effect-atom/atom'
import * as Effect from 'effect/Effect'
import type { UIMessage } from 'ai'
import { createActor } from 'xstate'
import {
  type Position,
  type Bounds,
  type CornerPreset,
  type IslandSize,
  computeCornerPosition,
} from '../schemas/position'
import {
  cursorMachine,
  type CursorMachineSnapshot,
  type CursorMachineState,
  getCursorState,
  isCursorExpanded,
} from '../machines'

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
// XState Actor (stx pattern)
// -----------------------------------------------------------------------------

/**
 * Create and start the cursor actor.
 * This is a module-level singleton — do not recreate.
 */
const cursorActor = createActor(cursorMachine)
cursorActor.start()

/**
 * Bridge atom: XState snapshot → effect-atom
 * All derived state reads from this single atom.
 */
export const cursorSnapshotAtom = Atom.make<CursorMachineSnapshot>(
  cursorActor.getSnapshot()
)

// Subscribe actor to update bridge atom
cursorActor.subscribe((snapshot) => {
  Atom.set(cursorSnapshotAtom, snapshot)
})

// -----------------------------------------------------------------------------
// Derived Atoms (from XState snapshot)
// -----------------------------------------------------------------------------

/** Current machine state value */
export const machineStateAtom = Atom.make((get): CursorMachineState => {
  const snapshot = get(cursorSnapshotAtom)
  return getCursorState(snapshot)
})

/** Machine context */
export const machineContextAtom = Atom.make((get) => {
  const snapshot = get(cursorSnapshotAtom)
  return snapshot.context
})

/** Whether cursor is in expanded mode */
export const isExpandedAtom = Atom.make((get) => {
  const snapshot = get(cursorSnapshotAtom)
  return isCursorExpanded(snapshot)
})

/** Whether there are unread messages */
export const hasUnreadAtom = Atom.make((get) => {
  const context = get(machineContextAtom)
  return context.hasUnread
})

/** Can expand (is in pill state or collapsing) */
export const canExpandAtom = Atom.make((get) => {
  const snapshot = get(cursorSnapshotAtom)
  return snapshot.can({ type: 'EXPAND' })
})

/** Can collapse (is in chat or expanding) */
export const canCollapseAtom = Atom.make((get) => {
  const snapshot = get(cursorSnapshotAtom)
  return snapshot.can({ type: 'COLLAPSE' })
})

// -----------------------------------------------------------------------------
// Runtime Atom (minimal - for future service integration)
// -----------------------------------------------------------------------------

import * as Layer from 'effect/Layer'
import { PositionServiceDefault } from '../services/PositionService'

export const cursorRuntimeAtom = Atom.runtime(PositionServiceDefault)

// -----------------------------------------------------------------------------
// Actor Operations (send events to XState)
// -----------------------------------------------------------------------------

export const cursorActorOps = {
  /** Expand to chat mode */
  expand: () => cursorActor.send({ type: 'EXPAND' }),

  /** Collapse to pill mode */
  collapse: () => cursorActor.send({ type: 'COLLAPSE' }),

  /** Move to a corner (triggers repositioning state) */
  moveTo: (corner: CornerPreset) => cursorActor.send({ type: 'MOVE_TO', corner }),

  /** Signal reposition animation complete */
  repositionComplete: () => cursorActor.send({ type: 'REPOSITION_COMPLETE' }),

  /** Signal AI started thinking */
  aiThinking: () => cursorActor.send({ type: 'AI_THINKING' }),

  /** Signal AI started streaming (auto-expands from pill) */
  aiStreaming: () => cursorActor.send({ type: 'AI_STREAMING' }),

  /** Signal AI finished */
  aiIdle: () => cursorActor.send({ type: 'AI_IDLE' }),

  /** Signal new message received */
  messageReceived: () => cursorActor.send({ type: 'MESSAGE_RECEIVED' }),

  /** Signal messages have been read */
  messagesRead: () => cursorActor.send({ type: 'MESSAGES_READ' }),
}

// -----------------------------------------------------------------------------
// Operation Atoms
// -----------------------------------------------------------------------------

const DEFAULT_PADDING = 16

export const cursorOps = {
  /**
   * Move cursor to a corner preset or direct coordinates.
   * If corner preset, also triggers XState repositioning state.
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
          // Notify XState of repositioning
          cursorActorOps.moveTo(args.position)
        } else {
          // Direct coordinates (drag)
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
   * Expand cursor to chat mode via XState
   */
  expand: cursorRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      // Legacy atom updates for backwards compat
      ctx.set(cursorStateAtom, 'chat')
      ctx.set(sizeKeyAtom, 'default')
      // XState manages the transition
      cursorActorOps.expand()
    })
  ),

  /**
   * Collapse cursor to pill mode via XState
   */
  collapse: cursorRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.sync(() => {
      // Legacy atom updates for backwards compat
      ctx.set(cursorStateAtom, 'pill')
      ctx.set(sizeKeyAtom, 'minimal')
      // XState manages the transition
      cursorActorOps.collapse()
    })
  ),

  /**
   * Update position after drag (no XState event, just position atom)
   */
  updatePosition: cursorRuntimeAtom.fn<{ position: Position }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(positionAtom, args.position)
    })
  ),

  /**
   * Notify AI status change
   */
  setAiStatus: cursorRuntimeAtom.fn<{ status: 'idle' | 'thinking' | 'streaming' }>()((args, ctx) =>
    Effect.sync(() => {
      ctx.set(statusAtom, args.status)
      // Sync to XState
      if (args.status === 'thinking') {
        cursorActorOps.aiThinking()
      } else if (args.status === 'streaming') {
        cursorActorOps.aiStreaming()
      } else {
        cursorActorOps.aiIdle()
      }
    })
  ),
}

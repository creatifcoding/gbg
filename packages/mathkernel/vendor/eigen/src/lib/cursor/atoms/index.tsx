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

import { Atom, Registry } from '@effect-atom/atom'
import { RegistryProvider, RegistryContext } from '@effect-atom/atom-react'
import * as Effect from 'effect/Effect'
import type { UIMessage, FileUIPart } from 'ai'
import { createActor } from 'xstate'
import type { ReactNode } from 'react'
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
// Registry (CRITICAL: React must use CursorRegistryProvider)
// -----------------------------------------------------------------------------

/**
 * Cursor-scoped registry for effect-atom state.
 * React components reading cursor atoms must be wrapped in CursorRegistryProvider.
 */
export const cursorRegistry = Registry.make()

/**
 * Provider that injects cursorRegistry into React context.
 * Wrap components that use useAtomValue() with cursor atoms.
 *
 * @example
 * <CursorRegistryProvider>
 *   <CursorInner />
 * </CursorRegistryProvider>
 */
export function CursorRegistryProvider({ children }: { children: ReactNode }) {
  return (
    <RegistryContext.Provider value={cursorRegistry}>
      {children}
    </RegistryContext.Provider>
  )
}

// -----------------------------------------------------------------------------
// State Atoms (module-level, stable refs)
// -----------------------------------------------------------------------------

/** Chat messages from AI SDK */
export const messagesAtom = Atom.make<UIMessage[]>([])

/** Pending file attachments (for future Claude Code file API) */
export type CursorAttachment = FileUIPart & { id: string }
export const attachmentsAtom = Atom.make<CursorAttachment[]>([])

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

/** Custom size override (when user resizes manually) */
export const customSizeAtom = Atom.make<IslandSize | null>(null)

/** Whether currently resizing */
export const isResizingAtom = Atom.make<boolean>(false)

/** Minimum/maximum size constraints for resizing */
export const RESIZE_CONSTRAINTS = {
  minWidth: 120,
  minHeight: 40,
  maxWidth: 800,
  maxHeight: 700,
} as const

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

// Subscribe actor to update bridge atom (use registry, not global Atom.set)
cursorActor.subscribe((snapshot) => {
  cursorRegistry.set(cursorSnapshotAtom, snapshot)
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
// Operation Functions (direct registry mutations, no Effect runtime needed)
// -----------------------------------------------------------------------------

const DEFAULT_PADDING = 16

/**
 * Cursor operations that directly mutate cursorRegistry.
 * These are synchronous and don't require Effect services.
 * Use cursorRegistry.get/set for all atom access.
 */
export const cursorOps = {
  /**
   * Move cursor to a corner preset or direct coordinates.
   * If corner preset, also triggers XState repositioning state.
   */
  moveTo: (args: { position: CornerPreset | Position; islandSize: IslandSize }): void => {
    if (typeof args.position === 'string') {
      // Corner preset - use pure function for computation
      const bounds = cursorRegistry.get(boundsAtom)
      const pos = computeCornerPosition(args.position, bounds, args.islandSize, DEFAULT_PADDING)
      cursorRegistry.set(positionAtom, pos)
      cursorRegistry.set(currentCornerAtom, args.position)
      // Notify XState of repositioning
      cursorActorOps.moveTo(args.position)
    } else {
      // Direct coordinates (drag)
      cursorRegistry.set(positionAtom, args.position)
    }
  },

  /**
   * Update content area bounds
   */
  updateBounds: (args: { bounds: Bounds }): void => {
    cursorRegistry.set(boundsAtom, args.bounds)
  },

  /**
   * Initialize cursor to bottom-right corner
   */
  initializeToBottomRight: (args: { islandSize: IslandSize }): void => {
    const bounds = cursorRegistry.get(boundsAtom)
    const pos = computeCornerPosition('bottom-right', bounds, args.islandSize, DEFAULT_PADDING)
    cursorRegistry.set(positionAtom, pos)
    cursorRegistry.set(currentCornerAtom, 'bottom-right')
  },

  /**
   * Expand cursor to chat mode via XState
   */
  expand: (): void => {
    // Update atoms for React consumers
    cursorRegistry.set(cursorStateAtom, 'chat')
    cursorRegistry.set(sizeKeyAtom, 'default')
    // XState manages the transition
    cursorActorOps.expand()
  },

  /**
   * Collapse cursor to pill mode via XState
   */
  collapse: (): void => {
    // Update atoms for React consumers
    cursorRegistry.set(cursorStateAtom, 'pill')
    cursorRegistry.set(sizeKeyAtom, 'minimal')
    // XState manages the transition
    cursorActorOps.collapse()
  },

  /**
   * Update position after drag (no XState event, just position atom)
   */
  updatePosition: (args: { position: Position }): void => {
    cursorRegistry.set(positionAtom, args.position)
  },

  /**
   * Notify AI status change
   */
  setAiStatus: (args: { status: 'idle' | 'thinking' | 'streaming' }): void => {
    cursorRegistry.set(statusAtom, args.status)
    // Sync to XState
    if (args.status === 'thinking') {
      cursorActorOps.aiThinking()
    } else if (args.status === 'streaming') {
      cursorActorOps.aiStreaming()
    } else {
      cursorActorOps.aiIdle()
    }
  },

  // -------------------------------------------------------------------------
  // Attachment Operations (for future Claude Code file API)
  // -------------------------------------------------------------------------

  /**
   * Add file attachments
   */
  addAttachments: (files: CursorAttachment[]): void => {
    const current = cursorRegistry.get(attachmentsAtom)
    cursorRegistry.set(attachmentsAtom, [...current, ...files])
  },

  /**
   * Remove attachment by ID
   */
  removeAttachment: (id: string): void => {
    const current = cursorRegistry.get(attachmentsAtom)
    const found = current.find((f) => f.id === id)
    if (found?.url) {
      URL.revokeObjectURL(found.url)
    }
    cursorRegistry.set(
      attachmentsAtom,
      current.filter((f) => f.id !== id)
    )
  },

  /**
   * Clear all attachments
   */
  clearAttachments: (): void => {
    const current = cursorRegistry.get(attachmentsAtom)
    for (const f of current) {
      if (f.url) {
        URL.revokeObjectURL(f.url)
      }
    }
    cursorRegistry.set(attachmentsAtom, [])
  },

  // -------------------------------------------------------------------------
  // Resize Operations
  // -------------------------------------------------------------------------

  /**
   * Start resize operation
   */
  startResize: (): void => {
    cursorRegistry.set(isResizingAtom, true)
  },

  /**
   * Update size during resize (respects constraints)
   */
  updateSize: (args: { width: number; height: number }): void => {
    const constrainedSize: IslandSize = {
      width: Math.max(RESIZE_CONSTRAINTS.minWidth, Math.min(RESIZE_CONSTRAINTS.maxWidth, args.width)),
      height: Math.max(RESIZE_CONSTRAINTS.minHeight, Math.min(RESIZE_CONSTRAINTS.maxHeight, args.height)),
    }
    cursorRegistry.set(customSizeAtom, constrainedSize)
  },

  /**
   * End resize operation
   */
  endResize: (): void => {
    cursorRegistry.set(isResizingAtom, false)
  },

  /**
   * Clear custom size (reset to preset)
   */
  clearCustomSize: (): void => {
    cursorRegistry.set(customSizeAtom, null)
    cursorRegistry.set(isResizingAtom, false)
  },

  /**
   * Get effective island size (custom or from preset)
   */
  getEffectiveSize: (presetSize: IslandSize): IslandSize => {
    const customSize = cursorRegistry.get(customSizeAtom)
    return customSize ?? presetSize
  },
}

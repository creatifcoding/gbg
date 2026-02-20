/**
 * Surface Machine Bridge (stx pattern) — v2
 *
 * Syncs XState parallel-state snapshots into MorphChat atoms.
 * Emitted events from the machine propagate to React via actor.on().
 *
 * Pattern: same as morph-card/machines/island-stx.ts
 *
 * @module morphchat/machines/surface-stx
 */

import { Atom } from '@effect-atom/atom'
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate'
import {
  surfaceMachine,
  type SurfaceMachineEvent,
  type SurfaceMachineContext,
} from './surface-machine'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import type { ContentViewSpec } from '../schemas/content-view-spec'
import { morphChatRegistry } from '../atoms/registry'
import {
  type SurfaceId,
  activeSpecFamily,
  previousSpecFamily,
  isMorphingFamily,
} from '../atoms/surface-atoms'

// =============================================================================
// Actor Types
// =============================================================================

export type SurfaceActor = ActorRefFrom<typeof surfaceMachine>
export type SurfaceSnapshot = SnapshotFrom<typeof surfaceMachine>

// =============================================================================
// Additional Atom Families (parallel state regions)
// =============================================================================

/** Connection region state: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnecting' | 'error' */
export const connectionStateFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<string>('idle')
  morphChatRegistry.mount(atom)
  return atom
})

/** Streaming region state: 'idle' | 'active' | 'finalizing' */
export const streamingStateFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<string>('idle')
  morphChatRegistry.mount(atom)
  return atom
})

/** Presentation region state: 'ready' | 'morphing' | 'settling' */
export const presentationStateFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<string>('ready')
  morphChatRegistry.mount(atom)
  return atom
})

/** ContentViewSpec derived from active spec (machine-driven) */
export const contentViewFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<ContentViewSpec | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/** Streaming message ID (null when idle) */
export const streamingMessageIdFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/** Connection error message */
export const connectionErrorFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/** Whether auto-collapse should fire */
export const shouldAutoCollapseFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<boolean>(false)
  morphChatRegistry.mount(atom)
  return atom
})

// =============================================================================
// Actor Registry
// =============================================================================

const actorRegistry = new Map<SurfaceId, SurfaceActor>()

/**
 * Extract parallel state values from a snapshot.
 * XState v5 parallel state value is: { connection: 'connected', streaming: 'idle', presentation: 'ready' }
 */
function getParallelStates(snapshot: SurfaceSnapshot): {
  connection: string
  streaming: string
  presentation: string
} {
  const value = snapshot.value
  if (typeof value === 'string') {
    return { connection: 'idle', streaming: 'idle', presentation: 'ready' }
  }
  const v = value as Record<string, string>
  return {
    connection: v.connection ?? 'idle',
    streaming: v.streaming ?? 'idle',
    presentation: v.presentation ?? 'ready',
  }
}

/**
 * Sync a machine snapshot into surface atoms.
 */
function syncSnapshot(surfId: SurfaceId, snapshot: SurfaceSnapshot): void {
  const ctx = snapshot.context as SurfaceMachineContext
  const states = getParallelStates(snapshot)

  // ── Spec atoms ──────────────────────────────────────────
  morphChatRegistry.set(activeSpecFamily(surfId), ctx.activeSpec)
  morphChatRegistry.set(previousSpecFamily(surfId), ctx.previousSpec)
  morphChatRegistry.set(contentViewFamily(surfId), ctx.contentView)

  // ── Parallel region state atoms ─────────────────────────
  morphChatRegistry.set(connectionStateFamily(surfId), states.connection)
  morphChatRegistry.set(streamingStateFamily(surfId), states.streaming)
  morphChatRegistry.set(presentationStateFamily(surfId), states.presentation)
  morphChatRegistry.set(isMorphingFamily(surfId), states.presentation === 'morphing')

  // ── Streaming context ───────────────────────────────────
  morphChatRegistry.set(streamingMessageIdFamily(surfId), ctx.streamingMessageId)
  morphChatRegistry.set(shouldAutoCollapseFamily(surfId), ctx.shouldAutoCollapse)

  // ── Connection context ──────────────────────────────────
  morphChatRegistry.set(connectionErrorFamily(surfId), ctx.connectionError)
}

// =============================================================================
// Actor Lifecycle
// =============================================================================

/**
 * Get or create a surface machine actor.
 */
export function getOrCreateSurfaceActor(
  surfId: SurfaceId,
  initialSpec: ChatSurfaceSpec,
): SurfaceActor {
  let actor = actorRegistry.get(surfId)
  if (!actor) {
    actor = createActor(surfaceMachine, {
      input: { surfaceId: surfId, initialSpec },
    })
    actor.start()
    actorRegistry.set(surfId, actor)

    // Subscribe to sync atoms on every snapshot change
    actor.subscribe((snapshot) => {
      syncSnapshot(surfId, snapshot)
    })

    // Sync initial snapshot
    syncSnapshot(surfId, actor.getSnapshot())
  }
  return actor
}

/**
 * Get existing actor (does not create).
 */
export function getSurfaceActor(surfId: SurfaceId): SurfaceActor | undefined {
  return actorRegistry.get(surfId)
}

/**
 * Send an event to a surface's machine.
 */
export function sendSurfaceEvent(surfId: SurfaceId, event: SurfaceMachineEvent): void {
  const actor = actorRegistry.get(surfId)
  if (actor) actor.send(event)
}

/**
 * Dispose a surface actor — stop machine, remove from registry.
 */
export function disposeSurfaceActor(surfId: SurfaceId): void {
  const actor = actorRegistry.get(surfId)
  if (actor) {
    actor.stop()
    actorRegistry.delete(surfId)
  }
}

/**
 * Dispose all surface actors.
 */
export function disposeAllSurfaceActors(): void {
  for (const actor of actorRegistry.values()) {
    actor.stop()
  }
  actorRegistry.clear()
}

// =============================================================================
// Snapshot Atom (raw)
// =============================================================================

export const surfaceSnapshotFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<SurfaceSnapshot | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * State value atom — the full parallel state object.
 */
export const surfaceStateValueFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make((get) => {
    const snapshot = get(surfaceSnapshotFamily(surfId))
    if (!snapshot) return { connection: 'idle', streaming: 'idle', presentation: 'ready' }
    return getParallelStates(snapshot)
  })
  morphChatRegistry.mount(atom)
  return atom
})

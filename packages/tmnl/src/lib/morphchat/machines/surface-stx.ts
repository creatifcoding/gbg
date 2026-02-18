/**
 * Surface Machine Bridge (stx pattern)
 *
 * Wires XState machine snapshots into MorphChat atom state.
 * Pattern: same as morph-card/machines/island-stx.ts
 *
 * @module morphchat/machines/surface-stx
 */

import { Atom } from '@effect-atom/atom'
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate'
import { surfaceMachine, type SurfaceMachineEvent } from './surface-machine'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import {
  morphChatRegistry,
} from '../atoms/registry'
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
// Actor Registry
// =============================================================================

const actorRegistry = new Map<SurfaceId, SurfaceActor>()

/**
 * Sync a machine snapshot into the corresponding surface atoms.
 */
function syncSnapshot(surfId: SurfaceId, snapshot: SurfaceSnapshot): void {
  const ctx = snapshot.context
  const stateValue = snapshot.value as string

  // Sync active spec
  morphChatRegistry.set(activeSpecFamily(surfId), ctx.activeSpec)

  // Sync previous spec
  morphChatRegistry.set(previousSpecFamily(surfId), ctx.previousSpec)

  // Sync morphing state
  morphChatRegistry.set(isMorphingFamily(surfId), stateValue === 'morphing')
}

// =============================================================================
// Actor Lifecycle
// =============================================================================

/**
 * Get or create a surface machine actor.
 *
 * If an actor already exists for this surfaceId, returns it.
 * Otherwise creates a new one, starts it, and subscribes to sync atoms.
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
 * Dispose all surface actors. Call on app teardown.
 */
export function disposeAllSurfaceActors(): void {
  for (const actor of actorRegistry.values()) {
    actor.stop()
  }
  actorRegistry.clear()
}

// =============================================================================
// Atom Bridge (reactive snapshot access)
// =============================================================================

/**
 * Snapshot atom — the raw XState snapshot for a surface.
 */
export const surfaceSnapshotFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<SurfaceSnapshot | null>(null)
  morphChatRegistry.mount(atom)

  // Wire up: ensure actor exists and subscribe
  const actor = getOrCreateSurfaceActor(surfId, null as unknown as ChatSurfaceSpec)
  actor.subscribe((snapshot) => {
    morphChatRegistry.set(atom, snapshot)
  })
  morphChatRegistry.set(atom, actor.getSnapshot())

  return atom
})

/**
 * State value atom — just the machine state string (idle, active, morphing, error).
 */
export const surfaceStateValueFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make((get) => {
    const snapshot = get(surfaceSnapshotFamily(surfId))
    return (snapshot?.value ?? 'idle') as string
  })
  morphChatRegistry.mount(atom)
  return atom
})

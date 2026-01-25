/**
 * Island Machine Bridge (stx pattern)
 *
 * Wires XState machine snapshots into MorphCard atom state.
 */

import { Atom } from '@effect-atom/atom';
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import type { CardId } from '../schemas/card-state';
import { islandMachine, type IslandMachineContext, type IslandMachineEvent } from './islandMachine';
import { cardStateFamily, createCardStateService } from '../card-state';
import { morphCardRegistry } from '../atoms/registry';
import { Effect } from 'effect';

// =============================================================================
// Actor Registry
// =============================================================================

export type IslandActor = ActorRefFrom<typeof islandMachine>;
export type IslandSnapshot = SnapshotFrom<typeof islandMachine>;

const actorRegistry = new Map<CardId, IslandActor>();
const cardStateService = createCardStateService(morphCardRegistry);

function syncSnapshot(cardId: CardId, snapshot: IslandSnapshot): void {
  const ctx = snapshot.context as IslandMachineContext;
  const currentDrag = morphCardRegistry.get(cardStateFamily.drag(cardId));
  const nextDrag = {
    ...currentDrag,
    isDragging: false,
    isResizing: false,
    shiftKey: false,
  };
  Effect.runPromise(
    cardStateService.set(
      cardId,
      {
        sizeKey: ctx.sizeKey as any,
        previousSizeKey: ctx.previousSizeKey as any,
        basePosition: { x: 0, y: 0 },
        position: { x: 0, y: 0 },
        reticle: ctx.reticle,
        transition: ctx.activeTransition,
        complexity: ctx.complexity,
        bounds: {},
        drag: nextDrag,
      },
      { recordHistory: true, persist: true }
    )
  ).catch(() => {
    // noop - sync is best effort
  });
}

export function getOrCreateIslandActor(
  cardId: CardId,
  input?: Partial<IslandMachineContext>
): IslandActor {
  let actor = actorRegistry.get(cardId);
  if (!actor) {
    actor = createActor(islandMachine, { input });
    actor.start();
    actorRegistry.set(cardId, actor);
    actor.subscribe((snapshot) => {
      syncSnapshot(cardId, snapshot);
    });
    syncSnapshot(cardId, actor.getSnapshot());
  }
  return actor;
}

export function getIslandActor(cardId: CardId): IslandActor | undefined {
  return actorRegistry.get(cardId);
}

export function sendIslandEvent(cardId: CardId, event: IslandMachineEvent): void {
  const actor = actorRegistry.get(cardId);
  if (actor) actor.send(event);
}

export function disposeIslandActor(cardId: CardId): void {
  const actor = actorRegistry.get(cardId);
  if (actor) {
    actor.stop();
    actorRegistry.delete(cardId);
  }
}

export function disposeAllIslandActors(): void {
  for (const actor of actorRegistry.values()) {
    actor.stop();
  }
  actorRegistry.clear();
}

// =============================================================================
// Atom Bridge
// =============================================================================

export const islandSnapshotAtomFamily = Atom.family((cardId: CardId) => {
  const atom = Atom.make<IslandSnapshot | null>(null);
  morphCardRegistry.mount(atom);
  const actor = getOrCreateIslandActor(cardId);
  actor.subscribe((snapshot) => {
    morphCardRegistry.set(atom, snapshot);
  });
  morphCardRegistry.set(atom, actor.getSnapshot());
  return atom;
});

export const islandStateValueAtomFamily = Atom.family((cardId: CardId) => {
  const atom = Atom.make((get) => {
    const snapshot = get(islandSnapshotAtomFamily(cardId));
    return (snapshot?.value ?? 'idle') as string;
  });
  morphCardRegistry.mount(atom);
  return atom;
});

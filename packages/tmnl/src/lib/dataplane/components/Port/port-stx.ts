/**
 * @fileoverview Port State Machine (stx pattern)
 *
 * XState v5 state machine for port visual states, integrated with effect-atom.
 * Follows the stx hybrid pattern: XState + effect-atom.
 */

import { Atom } from '@effect-atom/atom-react';
import { setup, createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import type { PortId } from '../../schemas/link';
import type { PortTabId, PortDirection } from './types';

// =============================================================================
// Types
// =============================================================================

export type PortVisualState = 'collapsed' | 'hovered' | 'expanded' | 'linking';

export interface PortMachineContext {
  portId: PortId;
  activeTab: PortTabId;
  linkTarget: PortId | null;
  label?: string;
  direction?: PortDirection;
  dataType?: string;
}

export type PortMachineEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'START_LINKING'; target?: PortId }
  | { type: 'END_LINKING' }
  | { type: 'SELECT_TAB'; tabId: PortTabId };

// =============================================================================
// State Machine Definition
// =============================================================================

export const portMachine = setup({
  types: {
    context: {} as PortMachineContext,
    events: {} as PortMachineEvent,
  },
  actions: {
    setActiveTab: ({ context, event }) => {
      if (event.type === 'SELECT_TAB') {
        context.activeTab = event.tabId;
      }
    },
    setLinkTarget: ({ context, event }) => {
      if (event.type === 'START_LINKING') {
        context.linkTarget = event.target ?? null;
      }
    },
    clearLinkTarget: ({ context }) => {
      context.linkTarget = null;
    },
  },
}).createMachine({
  id: 'port',
  initial: 'collapsed',
  context: ({ input }: { input: Partial<PortMachineContext> & { portId: PortId } }) => ({
    portId: input.portId,
    activeTab: input.activeTab ?? 'info',
    linkTarget: input.linkTarget ?? null,
    label: input.label,
    direction: input.direction,
    dataType: input.dataType,
  }),
  states: {
    collapsed: {
      on: {
        HOVER: 'hovered',
        EXPAND: 'expanded',
        START_LINKING: { target: 'linking', actions: 'setLinkTarget' },
      },
    },
    hovered: {
      on: {
        UNHOVER: 'collapsed',
        EXPAND: 'expanded',
        START_LINKING: { target: 'linking', actions: 'setLinkTarget' },
      },
    },
    expanded: {
      on: {
        COLLAPSE: 'collapsed',
        HOVER: 'expanded',
        UNHOVER: 'expanded',
        START_LINKING: { target: 'linking', actions: 'setLinkTarget' },
        SELECT_TAB: { actions: 'setActiveTab' },
      },
    },
    linking: {
      on: {
        END_LINKING: { target: 'collapsed', actions: 'clearLinkTarget' },
      },
    },
  },
});

// =============================================================================
// Actor Types
// =============================================================================

export type PortActor = ActorRefFrom<typeof portMachine>;
export type PortSnapshot = SnapshotFrom<typeof portMachine>;

// =============================================================================
// Actor Registry (Manual management for control)
// =============================================================================

const actorRegistry = new Map<PortId, PortActor>();

/**
 * Get or create a port actor for the given portId
 */
export function getOrCreatePortActor(portId: PortId): PortActor {
  let actor = actorRegistry.get(portId);
  if (!actor) {
    actor = createActor(portMachine, {
      input: { portId },
    });
    actorRegistry.set(portId, actor);
  }
  return actor;
}

/**
 * Get an existing port actor (undefined if not exists)
 */
export function getPortActor(portId: PortId): PortActor | undefined {
  return actorRegistry.get(portId);
}

/**
 * Get current snapshot of a port actor
 */
export function getPortSnapshot(portId: PortId): PortSnapshot | undefined {
  const actor = actorRegistry.get(portId);
  return actor?.getSnapshot();
}

/**
 * Send an event to a port actor
 */
export function sendPortEvent(portId: PortId, event: PortMachineEvent): void {
  const actor = actorRegistry.get(portId);
  if (actor) {
    actor.send(event);
  }
}

/**
 * Dispose a single port actor
 */
export function disposePortActor(portId: PortId): void {
  const actor = actorRegistry.get(portId);
  if (actor) {
    actor.stop();
    actorRegistry.delete(portId);
  }
}

/**
 * Dispose all port actors (cleanup)
 */
export function disposeAllPortActors(): void {
  for (const actor of actorRegistry.values()) {
    actor.stop();
  }
  actorRegistry.clear();
}

// =============================================================================
// Atom Bridge (stx pattern)
// =============================================================================

/**
 * Per-port snapshot atom: XState → effect-atom bridge
 */
export const portSnapshotAtom = Atom.family((portId: PortId) => {
  const atom = Atom.make<PortSnapshot | null>(null);

  // Subscribe to actor updates
  const actor = getOrCreatePortActor(portId);
  actor.subscribe((snapshot) => {
    Atom.set(atom, snapshot);
  });

  // Initialize with current snapshot
  Atom.set(atom, actor.getSnapshot());

  return atom;
});

/**
 * Derived: Current state value
 */
export const portStateValueAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return (snapshot?.value ?? 'collapsed') as PortVisualState;
  })
);

/**
 * Derived: Can expand?
 */
export const portCanExpandAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.can({ type: 'EXPAND' }) ?? false;
  })
);

/**
 * Derived: Active tab from machine context
 */
export const portMachineActiveTabAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.context.activeTab ?? 'info';
  })
);

/**
 * Derived: Link target from machine context
 */
export const portLinkTargetAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.context.linkTarget ?? null;
  })
);

/**
 * Derived: Full machine context
 */
export const portMachineContextAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.context ?? null;
  })
);

// =============================================================================
// Operations (imperative API)
// =============================================================================

export const portOps = {
  hover: (portId: PortId) => {
    sendPortEvent(portId, { type: 'HOVER' });
  },

  unhover: (portId: PortId) => {
    sendPortEvent(portId, { type: 'UNHOVER' });
  },

  expand: (portId: PortId) => {
    sendPortEvent(portId, { type: 'EXPAND' });
  },

  collapse: (portId: PortId) => {
    sendPortEvent(portId, { type: 'COLLAPSE' });
  },

  startLinking: (portId: PortId, target?: PortId) => {
    sendPortEvent(portId, { type: 'START_LINKING', target });
  },

  endLinking: (portId: PortId) => {
    sendPortEvent(portId, { type: 'END_LINKING' });
  },

  selectTab: (portId: PortId, tabId: PortTabId) => {
    sendPortEvent(portId, { type: 'SELECT_TAB', tabId });
  },
};

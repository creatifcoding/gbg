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
import { panelRegistry } from '@/components/testbed/collaboration/v2/panel-stx';

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
  | { type: 'TOGGLE_ACTIONS' }
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
        TOGGLE_ACTIONS: 'hovered', // Click → show actions
        START_LINKING: { target: 'linking', actions: 'setLinkTarget' },
      },
    },
    hovered: {
      on: {
        UNHOVER: 'collapsed',
        EXPAND: 'expanded',
        TOGGLE_ACTIONS: 'collapsed', // Click → hide actions
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
    actor.start(); // CRITICAL: Must start the actor for it to process events!
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
    console.log(`[port-stx] Sending event ${event.type} to port ${portId}`);
    actor.send(event);
  } else {
    console.warn(`[port-stx] No actor found for port ${portId}`);
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
 *
 * CRITICAL: Uses panelRegistry.set() for external updates from XState.
 * Atom.set() returns an Effect - panelRegistry.set() mutates directly.
 *
 * The factory runs when the atom is first accessed for a given portId.
 * It sets up the XState actor subscription which updates the atom on state changes.
 */
export const portSnapshotAtom = Atom.family((portId: PortId) => {
  console.log(`[port-stx] Creating portSnapshotAtom for ${portId}`);
  const atom = Atom.make<PortSnapshot | null>(null);

  // Mount atom on shared registry for React visibility
  panelRegistry.mount(atom);

  // Get or create the actor (already started if exists)
  const actor = getOrCreatePortActor(portId);
  console.log(`[port-stx] Got actor for ${portId}, current state: ${actor.getSnapshot().value}`);

  // Subscribe to actor updates - use registry.set() for external mutations
  // XState immediately fires the callback with current snapshot on subscribe
  // NOTE: Subscription is intentionally never unsubscribed because the actor
  // lifecycle is managed by PortProvider's useEffect (disposePortActor)
  actor.subscribe((snapshot) => {
    console.log(`[port-stx] 🔥 Actor subscription callback for ${portId}, state: ${snapshot.value}`);
    panelRegistry.set(atom, snapshot);
  });

  // Initialize with current snapshot (redundant if subscribe fires immediately, but safe)
  const initialSnapshot = actor.getSnapshot();
  console.log(`[port-stx] Initial snapshot for ${portId}: ${initialSnapshot.value}`);
  panelRegistry.set(atom, initialSnapshot);

  return atom;
});

/**
 * Derived: Current state value
 *
 * CRITICAL: Derived atoms must also be mounted on the registry for React to see updates.
 */
export const portStateValueAtom = Atom.family((portId: PortId) => {
  console.log(`[port-stx] Creating portStateValueAtom for ${portId}`);
  const derived = Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    const value = (snapshot?.value ?? 'collapsed') as PortVisualState;
    console.log(`[port-stx] portStateValueAtom getter for ${portId}: ${value}`);
    return value;
  });
  // Mount derived atom on shared registry
  panelRegistry.mount(derived);
  return derived;
});

/**
 * Derived: Can expand?
 */
export const portCanExpandAtom = Atom.family((portId: PortId) => {
  const derived = Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.can({ type: 'EXPAND' }) ?? false;
  });
  panelRegistry.mount(derived);
  return derived;
});

/**
 * Derived: Active tab from machine context
 */
export const portMachineActiveTabAtom = Atom.family((portId: PortId) => {
  const derived = Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.context.activeTab ?? 'info';
  });
  panelRegistry.mount(derived);
  return derived;
});

/**
 * Derived: Link target from machine context
 */
export const portLinkTargetAtom = Atom.family((portId: PortId) => {
  const derived = Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.context.linkTarget ?? null;
  });
  panelRegistry.mount(derived);
  return derived;
});

/**
 * Derived: Full machine context
 */
export const portMachineContextAtom = Atom.family((portId: PortId) => {
  const derived = Atom.make((get) => {
    const snapshot = get(portSnapshotAtom(portId));
    return snapshot?.context ?? null;
  });
  panelRegistry.mount(derived);
  return derived;
});

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

  toggleActions: (portId: PortId) => {
    sendPortEvent(portId, { type: 'TOGGLE_ACTIONS' });
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

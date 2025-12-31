/**
 * @fileoverview Per-port state management via effect-atom
 *
 * Defines Atom.family atoms for port UI state (expansion, tabs, hover, linking).
 * Phase 2 will extend this with XState snapshot atoms.
 *
 * Pattern: Module-level atoms, NOT created in components.
 * Precedent: src/lib/cursor/components/DynamicIsland.tsx
 */

import { Atom } from '@effect-atom/atom-react';

// ============================================================================
// STATE SHAPE
// ============================================================================

/**
 * Per-port UI state
 *
 * - expanded: Panel expansion state
 * - activeTab: Which tab is visible ('info' | 'config')
 * - hovered: Mouse hover state
 * - linking: Currently in linking mode (drag-to-connect)
 */
export interface PortState {
  readonly expanded: boolean;
  readonly activeTab: 'info' | 'config';
  readonly hovered: boolean;
  readonly linking: boolean;
}

// ============================================================================
// PRIMARY STATE ATOM (FAMILY)
// ============================================================================

/**
 * Per-port state atom family
 *
 * Usage:
 *   const state = useAtomValue(portStateAtom(portId));
 *   Atom.set(portStateAtom(portId), { ...state, expanded: true });
 *
 * @param portId - Unique port identifier
 * @returns Atom<PortState> for that port
 */
export const portStateAtom = Atom.family((portId: string) =>
  Atom.make<PortState>({
    expanded: false,
    activeTab: 'info',
    hovered: false,
    linking: false,
  })
);

// ============================================================================
// XSTATE SNAPSHOT BRIDGE (PHASE 2)
// ============================================================================

/**
 * XState snapshot atom family
 *
 * Will be typed in port-stx.ts as Atom.make<StateFrom<typeof portMachine>>()
 * For now, placeholder to establish the pattern.
 *
 * @param portId - Unique port identifier
 * @returns Atom<unknown> (will be typed snapshot in Phase 2)
 */
export const portSnapshotAtom = Atom.family((portId: string) =>
  Atom.make<unknown>(null)
);

// ============================================================================
// DERIVED ATOMS (READ-ONLY SELECTORS)
// ============================================================================

/**
 * Derived: Port expansion state
 *
 * @param portId - Port identifier
 * @returns Atom<boolean> - true if port panel is expanded
 */
export const portExpandedAtom = (portId: string) =>
  Atom.make((get) => get(portStateAtom(portId)).expanded);

/**
 * Derived: Port hover state
 *
 * @param portId - Port identifier
 * @returns Atom<boolean> - true if port is hovered
 */
export const portHoveredAtom = (portId: string) =>
  Atom.make((get) => get(portStateAtom(portId)).hovered);

/**
 * Derived: Port linking state
 *
 * @param portId - Port identifier
 * @returns Atom<boolean> - true if port is in linking mode
 */
export const portLinkingAtom = (portId: string) =>
  Atom.make((get) => get(portStateAtom(portId)).linking);

/**
 * Derived: Port active tab
 *
 * @param portId - Port identifier
 * @returns Atom<'info' | 'config'> - Current active tab
 */
export const portActiveTabAtom = (portId: string) =>
  Atom.make((get) => get(portStateAtom(portId)).activeTab);

/**
 * @fileoverview Dataplane Atoms - Reactive state layer for dataplane
 *
 * Follows Atom-as-State doctrine:
 * - Atoms ARE the primary state (not Effect.Ref bridges)
 * - Service methods mutate atoms directly via ctx.set()
 * - React subscribes via useAtomValue()
 *
 * Pattern hierarchy:
 * 1. dataplaneRuntimeAtom - Effect runtime with service layer
 * 2. State atoms - linksAtom, portsAtom, planesAtom
 * 3. Operation atoms - dataplaneOps.* for mutations
 */

import { Atom } from '@effect-atom/atom-react';
import * as React from 'react';
import { Effect, Layer } from 'effect';

import { DataplaneService, DataplaneServiceLive } from '../services/DataplaneService';
import { overlayRegistry } from '@/lib/overlays/atoms';
import type {
  PortId,
  LinkId,
  PlaneId,
  LinkPort,
  Link,
  Plane,
  CreateLinkConfig,
  CreatePortConfig,
  CreatePlaneConfig,
} from '../schemas/link';

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Effect runtime for dataplane operations.
 * All dataplane atoms derive from this runtime.
 */
export const dataplaneRuntimeAtom = Atom.runtime(
  Layer.mergeAll(DataplaneServiceLive)
);

// =============================================================================
// Shared Registry Reference
// =============================================================================

/**
 * Dataplane shares the overlay registry singleton.
 * This prevents context shadowing issues when nested providers exist.
 *
 * CRITICAL: All atoms (sidebar, dataplane, overlays) MUST share the same
 * registry to prevent mutations in one registry being invisible to React
 * components reading from another registry via context.
 *
 * Pattern follows sidebar: import overlayRegistry, alias for domain clarity.
 */
export const dataplaneRegistry = overlayRegistry;

// Mount runtime and state atoms on the shared registry.
// This MUST happen at module load time so ctx.set() and useAtomValue() share state.
dataplaneRegistry.mount(dataplaneRuntimeAtom);

// =============================================================================
// State Atoms
// =============================================================================

/** All registered ports */
export const portsAtom = Atom.make<ReadonlyArray<LinkPort>>([]);

/** All created links */
export const linksAtom = Atom.make<ReadonlyArray<Link>>([]);

/** All planes (data buses) */
export const planesAtom = Atom.make<ReadonlyArray<Plane>>([]);

/** Current graph version (for d2ts) */
export const versionAtom = Atom.make<number>(0);

/** Graph initialization status */
export const graphInitializedAtom = Atom.make<boolean>(false);

// Mount state atoms to shared registry (MUST happen after atom definitions)
dataplaneRegistry.mount(portsAtom);
dataplaneRegistry.mount(linksAtom);
dataplaneRegistry.mount(planesAtom);
dataplaneRegistry.mount(versionAtom);
dataplaneRegistry.mount(graphInitializedAtom);

// =============================================================================
// Linking UI State
// =============================================================================

/** Port currently being linked FROM (null = no link in progress) */
export const pendingLinkSourceAtom = Atom.make<PortId | null>(null);

/** Indicates link creation mode is active */
export const isLinkingAtom = Atom.make((get) => get(pendingLinkSourceAtom) !== null);

/** Currently hovered port during linking (for visual feedback) */
export const hoveredPortAtom = Atom.make<PortId | null>(null);

/** Selected link for editing/deletion */
export const selectedLinkAtom = Atom.make<LinkId | null>(null);

// =============================================================================
// Port Visibility & Hover State
// =============================================================================

/** Currently hovered block ID - ports on this block become visible */
export const hoveredBlockIdAtom = Atom.make<string | null>(null);

/** Currently hovered link ID - for fade/highlight behavior */
export const hoveredLinkIdAtom = Atom.make<LinkId | null>(null);

/**
 * Force all ports visible (e.g., when Links tab is open)
 * When true, all ports and links are fully visible regardless of hover state
 */
export const forcePortsVisibleAtom = Atom.make<boolean>(false);

/**
 * Derive whether ports should be visible for a given block
 * True when: block is hovered OR links tab is open OR linking is in progress
 */
export const shouldShowPortsAtom = Atom.family((blockId: string) =>
  Atom.make((get) => {
    const forceVisible = get(forcePortsVisibleAtom);
    const hoveredBlockId = get(hoveredBlockIdAtom);
    const isLinking = get(isLinkingAtom);

    return forceVisible || hoveredBlockId === blockId || isLinking;
  })
);

/**
 * Derive link opacity based on hover/selection state
 * Returns opacity value: 1.0 = full, 0.15 = faded
 */
export const linkOpacityAtom = Atom.family((linkId: LinkId) =>
  Atom.make((get) => {
    const forceVisible = get(forcePortsVisibleAtom);
    const selectedLinkId = get(selectedLinkAtom);
    const hoveredLinkId = get(hoveredLinkIdAtom);
    const isLinking = get(isLinkingAtom);

    // Full visibility when:
    // - Force visible (Links tab open)
    // - This link is selected
    // - This link is hovered
    // - Linking in progress (show all possible targets)
    if (forceVisible || selectedLinkId === linkId || hoveredLinkId === linkId || isLinking) {
      return 1.0;
    }

    // Faded when nothing is selected/hovered
    if (selectedLinkId === null && hoveredLinkId === null) {
      return 0.15;
    }

    // Something else is selected/hovered - fade this link
    return 0.15;
  })
);

// =============================================================================
// Derived Atoms
// =============================================================================

/** Ports indexed by ID for O(1) lookup */
export const portsByIdAtom = Atom.make((get) => {
  const ports = get(portsAtom);
  return new Map(ports.map((p) => [p.id, p]));
});

/** Links indexed by ID for O(1) lookup */
export const linksByIdAtom = Atom.make((get) => {
  const links = get(linksAtom);
  return new Map(links.map((l) => [l.id, l]));
});

/** Planes indexed by ID for O(1) lookup */
export const planesByIdAtom = Atom.make((get) => {
  const planes = get(planesAtom);
  return new Map(planes.map((p) => [p.id, p]));
});

/** Count of active links */
export const linkCountAtom = Atom.make((get) => get(linksAtom).length);

/** Count of registered ports */
export const portCountAtom = Atom.make((get) => get(portsAtom).length);

/** Count of planes */
export const planeCountAtom = Atom.make((get) => get(planesAtom).length);

/** Links grouped by source port */
export const linksBySourceAtom = Atom.make((get) => {
  const links = get(linksAtom);
  const grouped = new Map<PortId, Link[]>();

  for (const link of links) {
    const existing = grouped.get(link.sourcePort) ?? [];
    grouped.set(link.sourcePort, [...existing, link]);
  }

  return grouped;
});

/** Links grouped by target port */
export const linksByTargetAtom = Atom.make((get) => {
  const links = get(linksAtom);
  const grouped = new Map<PortId, Link[]>();

  for (const link of links) {
    const existing = grouped.get(link.targetPort) ?? [];
    grouped.set(link.targetPort, [...existing, link]);
  }

  return grouped;
});

// =============================================================================
// Operation Atoms
// =============================================================================

/**
 * Dataplane operations - all mutations go through here.
 * Uses runtimeAtom.fn<T>()() pattern for Effect integration.
 */
export const dataplaneOps = {
  // ---------------------------------------------------------------------------
  // Graph Lifecycle
  // ---------------------------------------------------------------------------

  /** Initialize the d2ts graph */
  initGraph: dataplaneRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.initGraph();
      ctx.set(graphInitializedAtom, true);
    })
  ),

  // ---------------------------------------------------------------------------
  // Port Operations
  // ---------------------------------------------------------------------------

  /** Register a new port (idempotent - won't duplicate existing ports) */
  registerPort: dataplaneRuntimeAtom.fn<CreatePortConfig>()((config, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      const port = yield* service.registerPort(config);

      // Only add if not already present (service may return existing port)
      const currentPorts = ctx(portsAtom);
      if (!currentPorts.some((p) => p.id === port.id)) {
        ctx.set(portsAtom, [...currentPorts, port]);
      }

      return port;
    })
  ),

  /** Update a port's position (for auto-positioning based on linked block) */
  updatePortPosition: dataplaneRuntimeAtom.fn<{
    portId: PortId;
    position: 'left' | 'right' | 'top' | 'bottom';
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const { portId, position } = args;

      ctx.set(
        portsAtom,
        ctx(portsAtom).map((p) =>
          p.id === portId ? { ...p, position } : p
        )
      );
    })
  ),

  /**
   * Auto-position a port based on linked block locations.
   *
   * Uses calculateOptimalPosition to determine the best port position
   * based on where linked blocks are relative to this block.
   */
  autoPositionPort: dataplaneRuntimeAtom.fn<{
    portId: PortId;
    thisBlockPosition: { x: number; y: number; width: number; height: number };
    linkedBlockPosition: { x: number; y: number; width: number; height: number };
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const { portId, thisBlockPosition, linkedBlockPosition } = args;

      // Calculate optimal position
      const optimalPosition = calculateOptimalPosition(
        thisBlockPosition,
        linkedBlockPosition
      );

      // Update port position
      ctx.set(
        portsAtom,
        ctx(portsAtom).map((p) =>
          p.id === portId ? { ...p, position: optimalPosition } : p
        )
      );

      return optimalPosition;
    })
  ),

  /** Unregister a port */
  unregisterPort: dataplaneRuntimeAtom.fn<PortId>()((portId, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.unregisterPort(portId);

      ctx.set(portsAtom, ctx(portsAtom).filter((p) => p.id !== portId));

      // Also remove links connected to this port
      ctx.set(
        linksAtom,
        ctx(linksAtom).filter(
          (l) => l.sourcePort !== portId && l.targetPort !== portId
        )
      );
    })
  ),

  // ---------------------------------------------------------------------------
  // Link Operations
  // ---------------------------------------------------------------------------

  /** Create a new link between ports */
  createLink: dataplaneRuntimeAtom.fn<CreateLinkConfig>()((config, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      const link = yield* service.createLink(config);

      ctx.set(linksAtom, [...ctx(linksAtom), link]);

      return link;
    })
  ),

  /** Remove a link */
  removeLink: dataplaneRuntimeAtom.fn<LinkId>()((linkId, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.removeLink(linkId);

      ctx.set(linksAtom, ctx(linksAtom).filter((l) => l.id !== linkId));
    })
  ),

  // ---------------------------------------------------------------------------
  // Plane Operations
  // ---------------------------------------------------------------------------

  /** Create a new plane (data bus) */
  createPlane: dataplaneRuntimeAtom.fn<CreatePlaneConfig>()((config, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      const plane = yield* service.createPlane(config);

      ctx.set(planesAtom, [...ctx(planesAtom), plane]);

      return plane;
    })
  ),

  /** Remove a plane */
  removePlane: dataplaneRuntimeAtom.fn<PlaneId>()((planeId, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.removePlane(planeId);

      ctx.set(planesAtom, ctx(planesAtom).filter((p) => p.id !== planeId));
    })
  ),

  /** Add ports to a plane */
  addToPlane: dataplaneRuntimeAtom.fn<{
    planeId: PlaneId;
    portIds: ReadonlyArray<PortId>;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.addToPlane(args.planeId, args.portIds);

      // Update plane in atoms
      ctx.set(
        planesAtom,
        ctx(planesAtom).map((p) =>
          p.id === args.planeId
            ? new Plane({ ...p, portIds: [...p.portIds, ...args.portIds] })
            : p
        )
      );
    })
  ),

  /** Remove ports from a plane */
  removeFromPlane: dataplaneRuntimeAtom.fn<{
    planeId: PlaneId;
    portIds: ReadonlyArray<PortId>;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.removeFromPlane(args.planeId, args.portIds);

      const portIdSet = new Set(args.portIds);

      ctx.set(
        planesAtom,
        ctx(planesAtom).map((p) =>
          p.id === args.planeId
            ? new Plane({
                ...p,
                portIds: p.portIds.filter((id) => !portIdSet.has(id)),
              })
            : p
        )
      );
    })
  ),

  // ---------------------------------------------------------------------------
  // Data Flow Operations
  // ---------------------------------------------------------------------------

  /** Push data to a port */
  pushData: dataplaneRuntimeAtom.fn<{
    portId: PortId;
    data: ReadonlyArray<unknown>;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.pushData(args.portId, args.data);
      yield* service.runGraph();

      // Update version
      ctx.set(versionAtom, ctx(versionAtom) + 1);
    })
  ),

  /** Broadcast data to all ports in a plane */
  pushToPlane: dataplaneRuntimeAtom.fn<{
    planeId: PlaneId;
    data: ReadonlyArray<unknown>;
  }>()((args, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.pushToPlane(args.planeId, args.data);
      yield* service.runGraph();

      ctx.set(versionAtom, ctx(versionAtom) + 1);
    })
  ),

  /** Run the d2ts graph (process all pending data) */
  runGraph: dataplaneRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      yield* service.runGraph();

      ctx.set(versionAtom, ctx(versionAtom) + 1);
    })
  ),
};

// =============================================================================
// Auto-Positioning Helpers
// =============================================================================

interface BlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate optimal port position based on relative block positions.
 *
 * Strategy:
 * - If linked block is predominantly to the left → use 'right' (port faces the link)
 * - If linked block is predominantly to the right → use 'left' (port faces the link)
 * - If linked block is predominantly above → use 'bottom' (port faces the link)
 * - If linked block is predominantly below → use 'top' (port faces the link)
 *
 * Uses center-to-center vector with angle calculation.
 */
export function calculateOptimalPosition(
  thisBlock: BlockPosition,
  linkedBlock: BlockPosition
): 'left' | 'right' | 'top' | 'bottom' {
  const thisCenterX = thisBlock.x + thisBlock.width / 2;
  const thisCenterY = thisBlock.y + thisBlock.height / 2;
  const linkedCenterX = linkedBlock.x + linkedBlock.width / 2;
  const linkedCenterY = linkedBlock.y + linkedBlock.height / 2;

  const dx = linkedCenterX - thisCenterX;
  const dy = linkedCenterY - thisCenterY;

  // Calculate angle in degrees (0 = right, 90 = down, 180/-180 = left, -90 = up)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Determine quadrant
  if (angle >= -45 && angle < 45) {
    // Linked block is to the right → port on right side faces it
    return 'right';
  } else if (angle >= 45 && angle < 135) {
    // Linked block is below → port on bottom side faces it
    return 'bottom';
  } else if (angle >= 135 || angle < -135) {
    // Linked block is to the left → port on left side faces it
    return 'left';
  } else {
    // Linked block is above → port on top side faces it
    return 'top';
  }
}

// =============================================================================
// Selector Atoms (for specific lookups)
// =============================================================================

/** Get a specific port by ID (family pattern) */
export const portAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => get(portsByIdAtom).get(portId) ?? null)
);

/** Get a specific link by ID (family pattern) */
export const linkAtom = Atom.family((linkId: LinkId) =>
  Atom.make((get) => get(linksByIdAtom).get(linkId) ?? null)
);

/** Get a specific plane by ID (family pattern) */
export const planeAtom = Atom.family((planeId: PlaneId) =>
  Atom.make((get) => get(planesByIdAtom).get(planeId) ?? null)
);

/** Get links for a specific port (family pattern) */
export const linksForPortAtom = Atom.family((portId: PortId) =>
  Atom.make((get) => {
    const links = get(linksAtom);
    return links.filter(
      (l) => l.sourcePort === portId || l.targetPort === portId
    );
  })
);

/** Get ports in a specific plane (family pattern) */
export const portsInPlaneAtom = Atom.family((planeId: PlaneId) =>
  Atom.make((get) => {
    const plane = get(planesByIdAtom).get(planeId);
    if (!plane) return [];

    const portsById = get(portsByIdAtom);
    return plane.portIds
      .map((id) => portsById.get(id))
      .filter((p): p is LinkPort => p !== undefined);
  })
);

/** Get ports for a specific block (family pattern) */
export const portsForBlockAtom = Atom.family((blockId: string) =>
  Atom.make((get) => {
    const ports = get(portsAtom);
    return ports.filter((p) => p.blockId === blockId);
  })
);

// =============================================================================
// Registry Provider (DEPRECATED - No-op passthrough)
// =============================================================================

/**
 * @deprecated No longer needed since dataplane uses shared overlayRegistry.
 *
 * This is a passthrough for backwards compatibility. The shared registry is
 * already provided by OverlayRegistryProvider at the app root.
 *
 * Safe to remove from component trees - left as no-op to avoid breaking imports.
 */
export function DataplaneRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // No-op passthrough - shared registry already provided by OverlayRegistryProvider
  return children as React.ReactElement;
}

// =============================================================================
// Re-export Plane for atom updates
// =============================================================================

import { Plane } from '../schemas/link';

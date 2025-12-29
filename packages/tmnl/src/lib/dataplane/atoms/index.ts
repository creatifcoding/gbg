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
import { Effect, Layer } from 'effect';

import { DataplaneService, DataplaneServiceLive } from '../services/DataplaneService';
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

  /** Register a new port */
  registerPort: dataplaneRuntimeAtom.fn<CreatePortConfig>()((config, ctx) =>
    Effect.gen(function* () {
      const service = yield* DataplaneService;
      const port = yield* service.registerPort(config);

      ctx.set(portsAtom, [...ctx(portsAtom), port]);

      return port;
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

// =============================================================================
// Re-export Plane for atom updates
// =============================================================================

import { Plane } from '../schemas/link';

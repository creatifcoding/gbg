/**
 * @fileoverview DataplaneService - Effect.Service for d2ts graph management
 *
 * Core service managing:
 * - D2 differential dataflow graph lifecycle
 * - Port registration and input stream creation
 * - Link creation with pipeline wiring
 * - Plane (bus) management
 * - Data push and graph execution
 */

import { Effect, Ref, Context, Layer, pipe } from 'effect';
import { D2 } from '@electric-sql/d2ts';
import type { IStreamBuilder } from '@electric-sql/d2ts';
import { MultiSet } from '@electric-sql/d2ts';
import { nanoid } from 'nanoid';

import {
  type PortId,
  type LinkId,
  type PlaneId,
  type BlockId,
  LinkPort,
  Link,
  Plane,
  type CreateLinkConfig,
  type CreatePortConfig,
  type CreatePlaneConfig,
} from '../schemas/link';

// =============================================================================
// Types
// =============================================================================

/** State stored in Effect.Ref for the dataplane */
export interface DataplaneState {
  /** The d2ts graph instance */
  readonly graph: D2<number> | null;
  /** Map of port ID to d2ts input stream */
  readonly inputs: ReadonlyMap<PortId, IStreamBuilder<unknown>>;
  /** Map of port ID to LinkPort */
  readonly ports: ReadonlyMap<PortId, LinkPort>;
  /** Map of link ID to Link */
  readonly links: ReadonlyMap<LinkId, Link>;
  /** Map of plane ID to Plane */
  readonly planes: ReadonlyMap<PlaneId, Plane>;
  /** Current version counter for d2ts */
  readonly version: number;
}

/** Initial empty state */
const initialState: DataplaneState = {
  graph: null,
  inputs: new Map(),
  ports: new Map(),
  links: new Map(),
  planes: new Map(),
  version: 0,
};

// =============================================================================
// Service Interface
// =============================================================================

/** DataplaneService interface */
export interface DataplaneServiceShape {
  // Graph lifecycle
  readonly initGraph: () => Effect.Effect<D2<number>>;
  readonly getGraph: () => Effect.Effect<D2<number> | null>;

  // Port management
  readonly registerPort: (
    config: CreatePortConfig
  ) => Effect.Effect<LinkPort>;
  readonly unregisterPort: (portId: PortId) => Effect.Effect<void>;
  readonly getPort: (portId: PortId) => Effect.Effect<LinkPort | null>;
  readonly getAllPorts: () => Effect.Effect<ReadonlyArray<LinkPort>>;

  // Link management
  readonly createLink: (config: CreateLinkConfig) => Effect.Effect<Link>;
  readonly removeLink: (linkId: LinkId) => Effect.Effect<void>;
  readonly getLink: (linkId: LinkId) => Effect.Effect<Link | null>;
  readonly getAllLinks: () => Effect.Effect<ReadonlyArray<Link>>;
  readonly getLinksForPort: (
    portId: PortId
  ) => Effect.Effect<ReadonlyArray<Link>>;

  // Plane (bus) management
  readonly createPlane: (config: CreatePlaneConfig) => Effect.Effect<Plane>;
  readonly removePlane: (planeId: PlaneId) => Effect.Effect<void>;
  readonly addToPlane: (
    planeId: PlaneId,
    portIds: ReadonlyArray<PortId>
  ) => Effect.Effect<void>;
  readonly removeFromPlane: (
    planeId: PlaneId,
    portIds: ReadonlyArray<PortId>
  ) => Effect.Effect<void>;
  readonly getPlane: (planeId: PlaneId) => Effect.Effect<Plane | null>;
  readonly getAllPlanes: () => Effect.Effect<ReadonlyArray<Plane>>;

  // Data flow
  readonly pushData: <T>(
    portId: PortId,
    data: ReadonlyArray<T>
  ) => Effect.Effect<void>;
  readonly pushToPlane: <T>(
    planeId: PlaneId,
    data: ReadonlyArray<T>
  ) => Effect.Effect<void>;
  readonly runGraph: () => Effect.Effect<void>;

  // State access
  readonly getState: () => Effect.Effect<DataplaneState>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/** DataplaneService Effect.Service */
export class DataplaneService extends Effect.Service<DataplaneService>()(
  'tmnl/DataplaneService',
  {
    effect: Effect.gen(function* () {
      // Internal state ref
      const stateRef = yield* Ref.make<DataplaneState>(initialState);

      // Helper to generate IDs
      const generateId = <T extends string>(prefix: string): T =>
        `${prefix}-${nanoid(8)}` as T;

      // =========================================================================
      // Graph Lifecycle
      // =========================================================================

      const initGraph = () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          if (state.graph) {
            return state.graph;
          }

          const graph = new D2<number>({ initialFrontier: 0 });

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            graph,
            version: 1,
          }));

          return graph;
        });

      const getGraph = () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => s.graph)
        );

      // =========================================================================
      // Port Management
      // =========================================================================

      const registerPort = (config: CreatePortConfig) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);

          // Idempotency check: if port with same blockId + position exists, return it
          // This prevents duplicates from React Strict Mode double-mounts
          const existingPort = [...state.ports.values()].find(
            (p) =>
              p.blockId === config.blockId &&
              p.position === config.position &&
              p.direction === config.direction
          );
          if (existingPort) {
            return existingPort;
          }

          // Ensure graph is initialized
          const graph = state.graph ?? (yield* initGraph());

          // Generate port ID
          const portId = generateId<PortId>('port');

          // Create LinkPort instance
          const port = new LinkPort({
            id: portId,
            blockId: config.blockId as BlockId,
            direction: config.direction,
            dataType: config.dataType,
            position: config.position,
            label: config.label,
            parentBlockId: config.parentBlockId as BlockId | undefined,
          });

          // Create d2ts input stream for this port
          const input = graph.newInput<unknown>();

          // Update state
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            graph,
            ports: new Map([...s.ports, [portId, port]]),
            inputs: new Map([...s.inputs, [portId, input]]),
          }));

          return port;
        });

      const unregisterPort = (portId: PortId) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (s) => {
            const ports = new Map(s.ports);
            const inputs = new Map(s.inputs);
            ports.delete(portId);
            inputs.delete(portId);

            // Also remove any links connected to this port
            const links = new Map(
              [...s.links].filter(
                ([, link]) =>
                  link.sourcePort !== portId && link.targetPort !== portId
              )
            );

            return { ...s, ports, inputs, links };
          });
        });

      const getPort = (portId: PortId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => s.ports.get(portId) ?? null)
        );

      const getAllPorts = () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => Array.from(s.ports.values()))
        );

      // =========================================================================
      // Link Management
      // =========================================================================

      const createLink = (config: CreateLinkConfig) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);

          // Generate link ID
          const linkId = generateId<LinkId>('link');

          // Create Link instance
          const link = new Link({
            id: linkId,
            sourcePort: config.sourcePort,
            targetPort: config.targetPort,
            direction: config.direction,
            relationship: config.relationship,
            transform: config.transform,
            createdAt: new Date(),
          });

          // Get input streams for source and target
          const sourceInput = state.inputs.get(config.sourcePort);
          const targetInput = state.inputs.get(config.targetPort);

          if (sourceInput && targetInput) {
            // Wire up the pipeline based on relationship type
            // For now, simple pass-through; PipelineBuilder will handle complex cases
            yield* Effect.sync(() => {
              // Pipeline wiring will be implemented in PipelineBuilder service
              // This is a placeholder for the connection logic
            });
          }

          // Update state
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            links: new Map([...s.links, [linkId, link]]),
          }));

          return link;
        });

      const removeLink = (linkId: LinkId) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (s) => {
            const links = new Map(s.links);
            links.delete(linkId);
            return { ...s, links };
          });
        });

      const getLink = (linkId: LinkId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => s.links.get(linkId) ?? null)
        );

      const getAllLinks = () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => Array.from(s.links.values()))
        );

      const getLinksForPort = (portId: PortId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) =>
            Array.from(s.links.values()).filter(
              (link) =>
                link.sourcePort === portId || link.targetPort === portId
            )
          )
        );

      // =========================================================================
      // Plane (Bus) Management
      // =========================================================================

      const createPlane = (config: CreatePlaneConfig) =>
        Effect.gen(function* () {
          const planeId = generateId<PlaneId>('plane');

          const plane = new Plane({
            id: planeId,
            name: config.name,
            parentPlaneId: config.parentPlaneId ?? null,
            portIds: [],
            createdAt: new Date(),
          });

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            planes: new Map([...s.planes, [planeId, plane]]),
          }));

          return plane;
        });

      const removePlane = (planeId: PlaneId) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (s) => {
            const planes = new Map(s.planes);
            planes.delete(planeId);
            return { ...s, planes };
          });
        });

      const addToPlane = (planeId: PlaneId, portIds: ReadonlyArray<PortId>) =>
        Effect.gen(function* () {
          yield* Ref.update(stateRef, (s) => {
            const plane = s.planes.get(planeId);
            if (!plane) return s;

            const updatedPlane = new Plane({
              ...plane,
              portIds: [...plane.portIds, ...portIds],
            });

            return {
              ...s,
              planes: new Map([...s.planes, [planeId, updatedPlane]]),
            };
          });
        });

      const removeFromPlane = (
        planeId: PlaneId,
        portIds: ReadonlyArray<PortId>
      ) =>
        Effect.gen(function* () {
          const portIdSet = new Set(portIds);

          yield* Ref.update(stateRef, (s) => {
            const plane = s.planes.get(planeId);
            if (!plane) return s;

            const updatedPlane = new Plane({
              ...plane,
              portIds: plane.portIds.filter((id) => !portIdSet.has(id)),
            });

            return {
              ...s,
              planes: new Map([...s.planes, [planeId, updatedPlane]]),
            };
          });
        });

      const getPlane = (planeId: PlaneId) =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => s.planes.get(planeId) ?? null)
        );

      const getAllPlanes = () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((s) => Array.from(s.planes.values()))
        );

      // =========================================================================
      // Data Flow
      // =========================================================================

      const pushData = <T>(portId: PortId, data: ReadonlyArray<T>) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          const input = state.inputs.get(portId);

          if (!input) {
            return; // Port not found, silently ignore
          }

          const version = state.version;

          // Convert array to MultiSet (each item has multiplicity 1)
          const multiSet = new MultiSet<T>(data.map((item) => [item, 1]));

          // Send data to the input stream
          yield* Effect.sync(() => {
            input.sendData(version, multiSet as MultiSet<unknown>);
            input.sendFrontier(version + 1);
          });

          // Increment version
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            version: s.version + 1,
          }));
        });

      const pushToPlane = <T>(planeId: PlaneId, data: ReadonlyArray<T>) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);
          const plane = state.planes.get(planeId);

          if (!plane) {
            return; // Plane not found
          }

          // Broadcast to all ports in the plane
          for (const portId of plane.portIds) {
            yield* pushData(portId, data);
          }
        });

      const runGraph = () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef);

          if (state.graph) {
            yield* Effect.sync(() => {
              state.graph!.run();
            });
          }
        });

      // =========================================================================
      // State Access
      // =========================================================================

      const getState = () => Ref.get(stateRef);

      // Return service shape
      return {
        initGraph,
        getGraph,
        registerPort,
        unregisterPort,
        getPort,
        getAllPorts,
        createLink,
        removeLink,
        getLink,
        getAllLinks,
        getLinksForPort,
        createPlane,
        removePlane,
        addToPlane,
        removeFromPlane,
        getPlane,
        getAllPlanes,
        pushData,
        pushToPlane,
        runGraph,
        getState,
      } satisfies DataplaneServiceShape;
    }),
  }
) {}

// =============================================================================
// Layer
// =============================================================================

/** Default layer for DataplaneService */
export const DataplaneServiceLive = DataplaneService.Default;

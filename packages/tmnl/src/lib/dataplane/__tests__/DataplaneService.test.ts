/**
 * @fileoverview DataplaneService unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { DataplaneService } from '../services/DataplaneService';
import type { PortId, LinkId, PlaneId } from '../schemas/link';

describe('DataplaneService', () => {
  // Helper to run effects with the service
  const runWithService = <A, E>(effect: Effect.Effect<A, E, DataplaneService>) =>
    Effect.runPromise(effect.pipe(Effect.provide(DataplaneService.Default)));

  // ===========================================================================
  // Graph Lifecycle
  // ===========================================================================

  describe('initGraph', () => {
    it('creates D2 graph instance', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const graph = yield* service.initGraph();

          expect(graph).toBeDefined();
          expect(typeof graph.run).toBe('function');
        })
      );
    });

    it('returns existing graph on subsequent calls', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const graph1 = yield* service.initGraph();
          const graph2 = yield* service.initGraph();

          expect(graph1).toBe(graph2);
        })
      );
    });
  });

  describe('getGraph', () => {
    it('returns null before initialization', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const graph = yield* service.getGraph();

          expect(graph).toBeNull();
        })
      );
    });

    it('returns graph after initialization', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          yield* service.initGraph();
          const graph = yield* service.getGraph();

          expect(graph).not.toBeNull();
        })
      );
    });
  });

  // ===========================================================================
  // Port Management
  // ===========================================================================

  describe('registerPort', () => {
    it('creates port with generated ID', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const port = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          expect(port.id).toMatch(/^port-/);
          expect(port.blockId).toBe('block-1');
          expect(port.direction).toBe('in');
          expect(port.dataType).toBe('table');
          expect(port.position).toBe('left');
        })
      );
    });

    it('initializes graph if not already initialized', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          // Graph should be null initially
          const graphBefore = yield* service.getGraph();
          expect(graphBefore).toBeNull();

          // Register port should initialize graph
          yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const graphAfter = yield* service.getGraph();
          expect(graphAfter).not.toBeNull();
        })
      );
    });

    it('creates d2ts input stream for port', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const port = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const state = yield* service.getState();
          expect(state.inputs.has(port.id)).toBe(true);
        })
      );
    });

    it('handles optional label and parentBlockId', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const port = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'out',
            dataType: 'json',
            position: 'right',
            label: 'Output Port',
            parentBlockId: 'parent-block',
          });

          expect(port.label).toBe('Output Port');
          expect(port.parentBlockId).toBe('parent-block');
        })
      );
    });
  });

  describe('unregisterPort', () => {
    it('removes port from state', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const port = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          yield* service.unregisterPort(port.id);

          const retrievedPort = yield* service.getPort(port.id);
          expect(retrievedPort).toBeNull();
        })
      );
    });

    it('removes associated links when port is unregistered', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'out',
            dataType: 'table',
            position: 'right',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const link = yield* service.createLink({
            sourcePort: port1.id,
            targetPort: port2.id,
            direction: 'unidirectional',
            relationship: 'pipe',
          });

          // Unregister source port
          yield* service.unregisterPort(port1.id);

          // Link should be removed
          const retrievedLink = yield* service.getLink(link.id);
          expect(retrievedLink).toBeNull();
        })
      );
    });
  });

  describe('getPort', () => {
    it('returns port by ID', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const created = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const retrieved = yield* service.getPort(created.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved?.id).toBe(created.id);
        })
      );
    });

    it('returns null for non-existent port', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const port = yield* service.getPort('non-existent' as PortId);
          expect(port).toBeNull();
        })
      );
    });
  });

  describe('getAllPorts', () => {
    it('returns all registered ports', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          yield* service.registerPort({
            blockId: 'block-2',
            direction: 'out',
            dataType: 'json',
            position: 'right',
          });

          const ports = yield* service.getAllPorts();
          expect(ports).toHaveLength(2);
        })
      );
    });
  });

  // ===========================================================================
  // Link Management
  // ===========================================================================

  describe('createLink', () => {
    it('creates link with generated ID', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'out',
            dataType: 'table',
            position: 'right',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const link = yield* service.createLink({
            sourcePort: port1.id,
            targetPort: port2.id,
            direction: 'unidirectional',
            relationship: 'pipe',
          });

          expect(link.id).toMatch(/^link-/);
          expect(link.sourcePort).toBe(port1.id);
          expect(link.targetPort).toBe(port2.id);
          expect(link.direction).toBe('unidirectional');
          expect(link.relationship).toBe('pipe');
        })
      );
    });

    it('handles optional transform', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'out',
            dataType: 'table',
            position: 'right',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const link = yield* service.createLink({
            sourcePort: port1.id,
            targetPort: port2.id,
            direction: 'unidirectional',
            relationship: 'pipe',
            transform: '(row) => row.value > 10',
          });

          expect(link.transform).toBe('(row) => row.value > 10');
        })
      );
    });
  });

  describe('removeLink', () => {
    it('removes link from state', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'out',
            dataType: 'table',
            position: 'right',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const link = yield* service.createLink({
            sourcePort: port1.id,
            targetPort: port2.id,
            direction: 'unidirectional',
            relationship: 'pipe',
          });

          yield* service.removeLink(link.id);

          const retrieved = yield* service.getLink(link.id);
          expect(retrieved).toBeNull();
        })
      );
    });
  });

  describe('getLinksForPort', () => {
    it('returns links connected to port', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'out',
            dataType: 'table',
            position: 'right',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const port3 = yield* service.registerPort({
            blockId: 'block-3',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          yield* service.createLink({
            sourcePort: port1.id,
            targetPort: port2.id,
            direction: 'unidirectional',
            relationship: 'pipe',
          });

          yield* service.createLink({
            sourcePort: port1.id,
            targetPort: port3.id,
            direction: 'unidirectional',
            relationship: 'pipe',
          });

          const linksForPort1 = yield* service.getLinksForPort(port1.id);
          expect(linksForPort1).toHaveLength(2);

          const linksForPort2 = yield* service.getLinksForPort(port2.id);
          expect(linksForPort2).toHaveLength(1);
        })
      );
    });
  });

  // ===========================================================================
  // Plane Management
  // ===========================================================================

  describe('createPlane', () => {
    it('creates plane with generated ID', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;
          const plane = yield* service.createPlane({
            name: 'Main Bus',
          });

          expect(plane.id).toMatch(/^plane-/);
          expect(plane.name).toBe('Main Bus');
          expect(plane.parentPlaneId).toBeNull();
          expect(plane.portIds).toHaveLength(0);
        })
      );
    });

    it('supports nested planes', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const parent = yield* service.createPlane({
            name: 'Parent Bus',
          });

          const child = yield* service.createPlane({
            name: 'Child Bus',
            parentPlaneId: parent.id,
          });

          expect(child.parentPlaneId).toBe(parent.id);
          expect(child.isNested).toBe(true);
        })
      );
    });
  });

  describe('addToPlane', () => {
    it('adds ports to plane', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'inout',
            dataType: 'table',
            position: 'left',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'inout',
            dataType: 'table',
            position: 'left',
          });

          const plane = yield* service.createPlane({
            name: 'Bus',
          });

          yield* service.addToPlane(plane.id, [port1.id, port2.id]);

          const updated = yield* service.getPlane(plane.id);
          expect(updated?.portIds).toHaveLength(2);
          expect(updated?.portIds).toContain(port1.id);
          expect(updated?.portIds).toContain(port2.id);
        })
      );
    });
  });

  describe('removeFromPlane', () => {
    it('removes ports from plane', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'inout',
            dataType: 'table',
            position: 'left',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'inout',
            dataType: 'table',
            position: 'left',
          });

          const plane = yield* service.createPlane({
            name: 'Bus',
          });

          yield* service.addToPlane(plane.id, [port1.id, port2.id]);
          yield* service.removeFromPlane(plane.id, [port1.id]);

          const updated = yield* service.getPlane(plane.id);
          expect(updated?.portIds).toHaveLength(1);
          expect(updated?.portIds).not.toContain(port1.id);
          expect(updated?.portIds).toContain(port2.id);
        })
      );
    });
  });

  // ===========================================================================
  // Data Flow
  // ===========================================================================

  describe('pushData', () => {
    it('sends data to port input stream', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          // Push data should not throw
          yield* service.pushData(port.id, [
            { id: 1, value: 'a' },
            { id: 2, value: 'b' },
          ]);

          // Version should increment
          const state = yield* service.getState();
          expect(state.version).toBe(2); // 1 from registerPort init, +1 from pushData
        })
      );
    });

    it('silently ignores non-existent port', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          // Should not throw
          yield* service.pushData('non-existent' as PortId, [{ value: 1 }]);
        })
      );
    });
  });

  describe('pushToPlane', () => {
    it('broadcasts data to all ports in plane', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port1 = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'inout',
            dataType: 'table',
            position: 'left',
          });

          const port2 = yield* service.registerPort({
            blockId: 'block-2',
            direction: 'inout',
            dataType: 'table',
            position: 'left',
          });

          const plane = yield* service.createPlane({
            name: 'Bus',
          });

          yield* service.addToPlane(plane.id, [port1.id, port2.id]);

          // Push to plane should not throw
          yield* service.pushToPlane(plane.id, [{ value: 'broadcast' }]);

          // Version should increment twice (once per port)
          const state = yield* service.getState();
          expect(state.version).toBe(3); // 1 from init, +2 from pushToPlane (2 ports)
        })
      );
    });
  });

  describe('runGraph', () => {
    it('executes graph without error', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          yield* service.initGraph();

          // Should not throw
          yield* service.runGraph();
        })
      );
    });

    it('handles no graph gracefully', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          // Should not throw even without graph
          yield* service.runGraph();
        })
      );
    });
  });

  // ===========================================================================
  // State Access
  // ===========================================================================

  describe('getState', () => {
    it('returns current state', async () => {
      await runWithService(
        Effect.gen(function* () {
          const service = yield* DataplaneService;

          const port = yield* service.registerPort({
            blockId: 'block-1',
            direction: 'in',
            dataType: 'table',
            position: 'left',
          });

          const state = yield* service.getState();

          expect(state.ports.size).toBe(1);
          expect(state.ports.has(port.id)).toBe(true);
          expect(state.graph).not.toBeNull();
        })
      );
    });
  });
});

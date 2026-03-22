/**
 * @fileoverview Dataplane atoms tests
 *
 * Tests for effect-atom integration with DataplaneService.
 * Uses Registry.make() for isolated atom testing.
 *
 * Key pattern: Operation atoms are Writable atoms that need mounting.
 * - registry.mount(opAtom) - activate the operation atom
 * - registry.set(opAtom, arg) - triggers the Effect
 * - registry.get(opAtom) - returns Result<A, E>
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';

import {
  portsAtom,
  linksAtom,
  planesAtom,
  versionAtom,
  graphInitializedAtom,
  portsByIdAtom,
  linksByIdAtom,
  planesByIdAtom,
  linkCountAtom,
  portCountAtom,
  planeCountAtom,
  linksBySourceAtom,
  linksByTargetAtom,
  dataplaneOps,
  portAtom,
  linkAtom,
  planeAtom,
  linksForPortAtom,
  portsInPlaneAtom,
  dataplaneRuntimeAtom,
} from '../atoms';

import type { PortId, LinkId, PlaneId, BlockId } from '../schemas/link';

describe('Dataplane Atoms', () => {
  let registry: Registry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = Registry.make();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper: Initialize runtime AND mount all state atoms.
   *
   * CRITICAL: ctx.set() inside runtimeAtom.fn() operations only works
   * when the target atoms are mounted in the same registry. This mounts
   * all state atoms that operations will mutate.
   */
  async function initRuntime() {
    // Mount runtime atom
    registry.mount(dataplaneRuntimeAtom);

    // Mount ALL state atoms that operations will touch via ctx.set()
    registry.mount(graphInitializedAtom);
    registry.mount(portsAtom);
    registry.mount(linksAtom);
    registry.mount(planesAtom);
    registry.mount(versionAtom);

    await vi.advanceTimersByTimeAsync(0);

    const runtimeResult = registry.get(dataplaneRuntimeAtom);
    if (!Result.isSuccess(runtimeResult)) {
      throw new Error(`Runtime failed to initialize: ${runtimeResult._tag}`);
    }
  }

  // ===========================================================================
  // State Atoms
  // ===========================================================================

  describe('State Atoms', () => {
    it('portsAtom starts empty', () => {
      const ports = registry.get(portsAtom);
      expect(ports).toEqual([]);
    });

    it('linksAtom starts empty', () => {
      const links = registry.get(linksAtom);
      expect(links).toEqual([]);
    });

    it('planesAtom starts empty', () => {
      const planes = registry.get(planesAtom);
      expect(planes).toEqual([]);
    });

    it('versionAtom starts at 0', () => {
      const version = registry.get(versionAtom);
      expect(version).toBe(0);
    });

    it('graphInitializedAtom starts false', () => {
      const initialized = registry.get(graphInitializedAtom);
      expect(initialized).toBe(false);
    });
  });

  // ===========================================================================
  // Derived Atoms
  // ===========================================================================

  describe('Derived Atoms', () => {
    it('portsByIdAtom creates Map from portsAtom', () => {
      const portsById = registry.get(portsByIdAtom);
      expect(portsById).toBeInstanceOf(Map);
      expect(portsById.size).toBe(0);
    });

    it('linksByIdAtom creates Map from linksAtom', () => {
      const linksById = registry.get(linksByIdAtom);
      expect(linksById).toBeInstanceOf(Map);
      expect(linksById.size).toBe(0);
    });

    it('planesByIdAtom creates Map from planesAtom', () => {
      const planesById = registry.get(planesByIdAtom);
      expect(planesById).toBeInstanceOf(Map);
      expect(planesById.size).toBe(0);
    });

    it('count atoms reflect array lengths', () => {
      expect(registry.get(linkCountAtom)).toBe(0);
      expect(registry.get(portCountAtom)).toBe(0);
      expect(registry.get(planeCountAtom)).toBe(0);
    });

    it('linksBySourceAtom groups links by source port', () => {
      const bySource = registry.get(linksBySourceAtom);
      expect(bySource).toBeInstanceOf(Map);
      expect(bySource.size).toBe(0);
    });

    it('linksByTargetAtom groups links by target port', () => {
      const byTarget = registry.get(linksByTargetAtom);
      expect(byTarget).toBeInstanceOf(Map);
      expect(byTarget.size).toBe(0);
    });
  });

  // ===========================================================================
  // Family Atoms
  // ===========================================================================

  describe('Family Atoms', () => {
    it('portAtom returns null for non-existent port', () => {
      const atom = portAtom('port-nonexistent' as PortId);
      const port = registry.get(atom);
      expect(port).toBeNull();
    });

    it('linkAtom returns null for non-existent link', () => {
      const atom = linkAtom('link-nonexistent' as LinkId);
      const link = registry.get(atom);
      expect(link).toBeNull();
    });

    it('planeAtom returns null for non-existent plane', () => {
      const atom = planeAtom('plane-nonexistent' as PlaneId);
      const plane = registry.get(atom);
      expect(plane).toBeNull();
    });

    it('linksForPortAtom returns empty array for non-existent port', () => {
      const atom = linksForPortAtom('port-nonexistent' as PortId);
      const links = registry.get(atom);
      expect(links).toEqual([]);
    });

    it('portsInPlaneAtom returns empty array for non-existent plane', () => {
      const atom = portsInPlaneAtom('plane-nonexistent' as PlaneId);
      const ports = registry.get(atom);
      expect(ports).toEqual([]);
    });
  });

  // ===========================================================================
  // Operation Atoms (Integration)
  // ===========================================================================

  describe('Operation Atoms', () => {
    /**
     * Operation atom pattern:
     * 1. Mount the operation atom: registry.mount(opAtom)
     * 2. Trigger: registry.set(opAtom, arg)
     * 3. Wait for async completion
     * 4. Read result: registry.get(opAtom) returns Result<A, E>
     */

    it('dataplaneOps.initGraph sets graphInitializedAtom', async () => {
      await initRuntime();
      expect(registry.get(graphInitializedAtom)).toBe(false);

      // Mount and trigger the operation
      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);

      // Wait for async Effect to complete
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(graphInitializedAtom)).toBe(true);
    });

    it('dataplaneOps.registerPort adds port to portsAtom', async () => {
      await initRuntime();

      // Initialize graph first
      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      // Register a port
      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const ports = registry.get(portsAtom);
      expect(ports).toHaveLength(1);
      expect(ports[0].blockId).toBe('block-1');

      // Check Result from operation atom
      const result = registry.get(dataplaneOps.registerPort);
      expect(Result.isSuccess(result)).toBe(true);
    });

    it('dataplaneOps.unregisterPort removes port from portsAtom', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const ports = registry.get(portsAtom);
      expect(ports).toHaveLength(1);
      const portId = ports[0].id;

      registry.mount(dataplaneOps.unregisterPort);
      registry.set(dataplaneOps.unregisterPort, portId);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(portsAtom)).toHaveLength(0);
    });

    it('dataplaneOps.createLink adds link to linksAtom', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      // Create two ports
      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'out' as const,
        dataType: 'table' as const,
        position: 'right' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port1 = registry.get(portsAtom)[0];

      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-2' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port2 = registry.get(portsAtom)[1];

      // Create link
      registry.mount(dataplaneOps.createLink);
      registry.set(dataplaneOps.createLink, {
        sourcePort: port1.id,
        targetPort: port2.id,
        direction: 'unidirectional' as const,
        relationship: 'pipe' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(1);
      expect(links[0].sourcePort).toBe(port1.id);
      expect(links[0].targetPort).toBe(port2.id);
    });

    it('dataplaneOps.removeLink removes link from linksAtom', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'out' as const,
        dataType: 'table' as const,
        position: 'right' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port1 = registry.get(portsAtom)[0];

      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-2' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port2 = registry.get(portsAtom)[1];

      registry.mount(dataplaneOps.createLink);
      registry.set(dataplaneOps.createLink, {
        sourcePort: port1.id,
        targetPort: port2.id,
        direction: 'unidirectional' as const,
        relationship: 'pipe' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const linkId = registry.get(linksAtom)[0].id;

      registry.mount(dataplaneOps.removeLink);
      registry.set(dataplaneOps.removeLink, linkId);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(linksAtom)).toHaveLength(0);
    });

    it('dataplaneOps.createPlane adds plane to planesAtom', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.createPlane);
      registry.set(dataplaneOps.createPlane, {
        name: 'Main Bus',
      });
      await vi.advanceTimersByTimeAsync(0);

      const planes = registry.get(planesAtom);
      expect(planes).toHaveLength(1);
      expect(planes[0].name).toBe('Main Bus');
    });

    it('dataplaneOps.removePlane removes plane from planesAtom', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.createPlane);
      registry.set(dataplaneOps.createPlane, {
        name: 'Main Bus',
      });
      await vi.advanceTimersByTimeAsync(0);

      const planeId = registry.get(planesAtom)[0].id;

      registry.mount(dataplaneOps.removePlane);
      registry.set(dataplaneOps.removePlane, planeId);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(planesAtom)).toHaveLength(0);
    });

    it('dataplaneOps.addToPlane adds ports to plane', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'inout' as const,
        dataType: 'stream' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const portId = registry.get(portsAtom)[0].id;

      registry.mount(dataplaneOps.createPlane);
      registry.set(dataplaneOps.createPlane, {
        name: 'Data Bus',
      });
      await vi.advanceTimersByTimeAsync(0);
      const planeId = registry.get(planesAtom)[0].id;

      registry.mount(dataplaneOps.addToPlane);
      registry.set(dataplaneOps.addToPlane, {
        planeId,
        portIds: [portId],
      });
      await vi.advanceTimersByTimeAsync(0);

      const planes = registry.get(planesAtom);
      expect(planes[0].portIds).toContain(portId);
    });

    it('dataplaneOps.removeFromPlane removes ports from plane', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'inout' as const,
        dataType: 'stream' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const portId = registry.get(portsAtom)[0].id;

      registry.mount(dataplaneOps.createPlane);
      registry.set(dataplaneOps.createPlane, {
        name: 'Data Bus',
      });
      await vi.advanceTimersByTimeAsync(0);
      const planeId = registry.get(planesAtom)[0].id;

      registry.mount(dataplaneOps.addToPlane);
      registry.set(dataplaneOps.addToPlane, {
        planeId,
        portIds: [portId],
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(planesAtom)[0].portIds).toContain(portId);

      registry.mount(dataplaneOps.removeFromPlane);
      registry.set(dataplaneOps.removeFromPlane, {
        planeId,
        portIds: [portId],
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(planesAtom)[0].portIds).not.toContain(portId);
    });

    it('dataplaneOps.pushData increments version', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const portId = registry.get(portsAtom)[0].id;

      const versionBefore = registry.get(versionAtom);

      registry.mount(dataplaneOps.pushData);
      registry.set(dataplaneOps.pushData, {
        portId,
        data: [{ id: 1, value: 'test' }],
      });
      await vi.advanceTimersByTimeAsync(0);

      const versionAfter = registry.get(versionAtom);
      expect(versionAfter).toBeGreaterThan(versionBefore);
    });

    it('dataplaneOps.runGraph increments version', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      const versionBefore = registry.get(versionAtom);

      registry.mount(dataplaneOps.runGraph);
      registry.set(dataplaneOps.runGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      const versionAfter = registry.get(versionAtom);
      expect(versionAfter).toBeGreaterThan(versionBefore);
    });
  });

  // ===========================================================================
  // Derived Atom Reactivity
  // ===========================================================================

  describe('Derived Atom Reactivity', () => {
    it('portsByIdAtom updates when portsAtom changes', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(portsByIdAtom).size).toBe(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const portId = registry.get(portsAtom)[0].id;
      const portsById = registry.get(portsByIdAtom);
      expect(portsById.size).toBe(1);
      expect(portsById.get(portId)).toBeDefined();
    });

    it('portCountAtom updates when portsAtom changes', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(portCountAtom)).toBe(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(portCountAtom)).toBe(1);
    });

    it('linksBySourceAtom updates when linksAtom changes', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'out' as const,
        dataType: 'table' as const,
        position: 'right' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port1 = registry.get(portsAtom)[0];

      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-2' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port2 = registry.get(portsAtom)[1];

      registry.mount(dataplaneOps.createLink);
      registry.set(dataplaneOps.createLink, {
        sourcePort: port1.id,
        targetPort: port2.id,
        direction: 'unidirectional' as const,
        relationship: 'pipe' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const bySource = registry.get(linksBySourceAtom);
      expect(bySource.get(port1.id)).toHaveLength(1);
    });

    it('family atoms update when underlying state changes', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      const portId = registry.get(portsAtom)[0].id;

      // portAtom family should now find the port
      const portResult = registry.get(portAtom(portId));
      expect(portResult).not.toBeNull();
      expect(portResult?.id).toBe(portId);
    });
  });

  // ===========================================================================
  // Cascading Updates
  // ===========================================================================

  describe('Cascading Updates', () => {
    it('unregisterPort removes connected links', async () => {
      await initRuntime();

      registry.mount(dataplaneOps.initGraph);
      registry.set(dataplaneOps.initGraph, undefined);
      await vi.advanceTimersByTimeAsync(0);

      registry.mount(dataplaneOps.registerPort);
      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-1' as BlockId,
        direction: 'out' as const,
        dataType: 'table' as const,
        position: 'right' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port1 = registry.get(portsAtom)[0];

      registry.set(dataplaneOps.registerPort, {
        blockId: 'block-2' as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
      });
      await vi.advanceTimersByTimeAsync(0);
      const port2 = registry.get(portsAtom)[1];

      registry.mount(dataplaneOps.createLink);
      registry.set(dataplaneOps.createLink, {
        sourcePort: port1.id,
        targetPort: port2.id,
        direction: 'unidirectional' as const,
        relationship: 'pipe' as const,
      });
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(linksAtom)).toHaveLength(1);

      // Unregistering port1 should remove the link
      registry.mount(dataplaneOps.unregisterPort);
      registry.set(dataplaneOps.unregisterPort, port1.id);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(linksAtom)).toHaveLength(0);
    });
  });
});

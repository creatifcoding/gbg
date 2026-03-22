/**
 * @fileoverview Dataplane Hooks Tests
 *
 * Tests for useDataplane and usePortData hooks.
 * Uses vitest + @testing-library/react for hook testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { Registry, RegistryProvider, useAtomValue } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';

import { useDataplane, usePortData, useHasIncoming, useHasOutgoing } from '../hooks';
import {
  dataplaneRuntimeAtom,
  graphInitializedAtom,
  portsAtom,
  linksAtom,
  planesAtom,
  versionAtom,
  portsByIdAtom,
  linksByIdAtom,
  planesByIdAtom,
  linksBySourceAtom,
  linksByTargetAtom,
  dataplaneOps,
} from '../atoms';
import type { PortId, BlockId } from '../schemas/link';

describe('Dataplane Hooks', () => {
  let registry: Registry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = Registry.make();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper to initialize the dataplane runtime.
   * Mounts runtime, all state atoms, derived atoms, AND all operation atoms.
   *
   * CRITICAL: Operation atoms must be mounted for useAtomSet() to work.
   * Derived atoms are needed for family atom lookups.
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

    // Mount derived atoms for family atom lookups
    registry.mount(portsByIdAtom);
    registry.mount(linksByIdAtom);
    registry.mount(planesByIdAtom);
    registry.mount(linksBySourceAtom);
    registry.mount(linksByTargetAtom);

    // Mount ALL operation atoms so useAtomSet() has them available
    registry.mount(dataplaneOps.initGraph);
    registry.mount(dataplaneOps.registerPort);
    registry.mount(dataplaneOps.unregisterPort);
    registry.mount(dataplaneOps.createLink);
    registry.mount(dataplaneOps.removeLink);
    registry.mount(dataplaneOps.createPlane);
    registry.mount(dataplaneOps.removePlane);
    registry.mount(dataplaneOps.addToPlane);
    registry.mount(dataplaneOps.removeFromPlane);
    registry.mount(dataplaneOps.pushData);
    registry.mount(dataplaneOps.runGraph);

    await vi.advanceTimersByTimeAsync(0);

    const runtimeResult = registry.get(dataplaneRuntimeAtom);
    if (!Result.isSuccess(runtimeResult)) {
      throw new Error(`Runtime failed to initialize`);
    }
  }

  /**
   * Helper to create a wrapper with RegistryProvider.
   */
  function createWrapper() {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        RegistryProvider,
        { value: registry },
        children
      );
    };
  }

  // ===========================================================================
  // useDataplane Tests
  // ===========================================================================

  describe('useDataplane', () => {
    it('returns initial state correctly', async () => {
      await initRuntime();

      const { result } = renderHook(() => useDataplane(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.ports).toEqual([]);
      expect(result.current.links).toEqual([]);
    });

    it('initGraph sets isInitialized to true', async () => {
      await initRuntime();

      const { result } = renderHook(() => useDataplane(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.isInitialized).toBe(true);
    });

    it('registerPort adds port to ports array', async () => {
      await initRuntime();

      const { result } = renderHook(() => useDataplane(), {
        wrapper: createWrapper(),
      });

      // Initialize graph first
      await act(async () => {
        await result.current.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      let port: any = null;
      await act(async () => {
        port = await result.current.registerPort({
          blockId: 'block-1' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(port).not.toBeNull();
      expect(result.current.ports).toHaveLength(1);
      expect(result.current.ports[0].blockId).toBe('block-1');
    });

    it('registerPort returns cleanup function pattern', async () => {
      await initRuntime();

      const { result } = renderHook(() => useDataplane(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      let portId: PortId | null = null;
      await act(async () => {
        const port = await result.current.registerPort({
          blockId: 'block-1' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        portId = port?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.ports).toHaveLength(1);

      // Unregister (simulating cleanup)
      await act(async () => {
        if (portId) await result.current.unregisterPort(portId);
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.ports).toHaveLength(0);
    });

    it('pushData triggers graph run and increments version', async () => {
      await initRuntime();

      // Combined hook pattern - track version and dataplane in same tree
      const { result } = renderHook(
        () => ({
          dataplane: useDataplane(),
          version: useAtomValue(versionAtom),
        }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.dataplane.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      let portId: PortId | null = null;
      await act(async () => {
        const port = await result.current.dataplane.registerPort({
          blockId: 'block-1' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        portId = port?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      const versionBefore = result.current.version;

      await act(async () => {
        if (portId) {
          await result.current.dataplane.pushData(portId, [{ id: 1, value: 'test' }]);
        }
        await vi.advanceTimersByTimeAsync(0);
      });

      const versionAfter = result.current.version;
      expect(versionAfter).toBeGreaterThan(versionBefore);
    });
  });

  // ===========================================================================
  // usePortData Tests
  // ===========================================================================

  describe('usePortData', () => {
    it('returns null port for non-existent portId', async () => {
      await initRuntime();

      const { result } = renderHook(
        () => usePortData('non-existent-port' as PortId),
        { wrapper: createWrapper() }
      );

      expect(result.current.port).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.links).toEqual([]);
    });

    it('returns port data after registration', async () => {
      await initRuntime();

      // Use combined hook pattern with rerender to ensure same component tree
      const { result, rerender } = renderHook(
        ({ portId }: { portId: PortId | null }) => ({
          dataplane: useDataplane(),
          portData: usePortData((portId ?? 'placeholder') as PortId),
        }),
        {
          wrapper: createWrapper(),
          initialProps: { portId: null as PortId | null },
        }
      );

      await act(async () => {
        await result.current.dataplane.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      let portId: PortId | null = null;
      await act(async () => {
        const port = await result.current.dataplane.registerPort({
          blockId: 'block-1' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        portId = port?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(portId).not.toBeNull();

      // Rerender with the actual portId to trigger usePortData with correct ID
      // Then flush timers to propagate atom subscriptions
      await act(async () => {
        rerender({ portId });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Direct assertions after timer flush - no waitFor needed
      expect(result.current.portData.port).not.toBeNull();
      expect(result.current.portData.port?.blockId).toBe('block-1');
      expect(result.current.portData.isInput).toBe(true);
      expect(result.current.portData.isOutput).toBe(false);
    });

    it('updates isConnected when link is created', async () => {
      await initRuntime();

      // Combined hook pattern - keep everything in same component tree
      const { result, rerender } = renderHook(
        ({ portId }: { portId: PortId | null }) => ({
          dataplane: useDataplane(),
          portData: usePortData((portId ?? 'placeholder') as PortId),
        }),
        {
          wrapper: createWrapper(),
          initialProps: { portId: null as PortId | null },
        }
      );

      // Initialize
      await act(async () => {
        await result.current.dataplane.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      // Register two ports
      let port1Id: PortId | null = null;
      let port2Id: PortId | null = null;

      await act(async () => {
        const port1 = await result.current.dataplane.registerPort({
          blockId: 'block-1' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
        });
        port1Id = port1?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        const port2 = await result.current.dataplane.registerPort({
          blockId: 'block-2' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        port2Id = port2?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      if (!port1Id || !port2Id) {
        throw new Error('Ports not created');
      }

      // Rerender with port1Id to observe its connection state
      await act(async () => {
        rerender({ portId: port1Id });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Initially not connected
      expect(result.current.portData.isConnected).toBe(false);

      // Create link
      await act(async () => {
        await result.current.dataplane.createLink({
          sourcePort: port1Id!,
          targetPort: port2Id!,
          direction: 'unidirectional',
          relationship: 'pipe',
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Check that links are updated in dataplane
      expect(result.current.dataplane.links).toHaveLength(1);

      // portData should see the connection via derived state
      expect(result.current.portData.isConnected).toBe(true);
      expect(result.current.portData.links).toHaveLength(1);
    });

    it('handles missing port gracefully', async () => {
      await initRuntime();

      const { result } = renderHook(
        () => usePortData('missing-port-id' as PortId),
        { wrapper: createWrapper() }
      );

      // Should not throw, just return defaults
      expect(result.current.port).toBeNull();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isInput).toBe(false);
      expect(result.current.isOutput).toBe(false);
      expect(result.current.data).toEqual([]);
    });
  });

  // ===========================================================================
  // useHasIncoming / useHasOutgoing Tests
  // ===========================================================================

  describe('useHasIncoming / useHasOutgoing', () => {
    it('useHasIncoming returns true when port has incoming link', async () => {
      await initRuntime();

      // Combined hook pattern with both port IDs
      const { result, rerender } = renderHook(
        ({ sourceId, targetId }: { sourceId: PortId | null; targetId: PortId | null }) => ({
          dataplane: useDataplane(),
          sourceHasIncoming: useHasIncoming((sourceId ?? 'placeholder') as PortId),
          targetHasIncoming: useHasIncoming((targetId ?? 'placeholder') as PortId),
        }),
        {
          wrapper: createWrapper(),
          initialProps: { sourceId: null as PortId | null, targetId: null as PortId | null },
        }
      );

      await act(async () => {
        await result.current.dataplane.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      let sourcePortId: PortId | null = null;
      let targetPortId: PortId | null = null;

      await act(async () => {
        const sourcePort = await result.current.dataplane.registerPort({
          blockId: 'source' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
        });
        sourcePortId = sourcePort?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        const targetPort = await result.current.dataplane.registerPort({
          blockId: 'target' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        targetPortId = targetPort?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      if (!sourcePortId || !targetPortId) {
        throw new Error('Ports not created');
      }

      await act(async () => {
        await result.current.dataplane.createLink({
          sourcePort: sourcePortId!,
          targetPort: targetPortId!,
          direction: 'unidirectional',
          relationship: 'pipe',
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Verify link was created
      expect(result.current.dataplane.links).toHaveLength(1);

      // Rerender with actual port IDs to observe their incoming state
      await act(async () => {
        rerender({ sourceId: sourcePortId, targetId: targetPortId });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Target has incoming link (source -> target)
      expect(result.current.targetHasIncoming).toBe(true);

      // Source should NOT have incoming
      expect(result.current.sourceHasIncoming).toBe(false);
    });

    it('useHasOutgoing returns true when port has outgoing link', async () => {
      await initRuntime();

      // Combined hook pattern with both port IDs
      const { result, rerender } = renderHook(
        ({ sourceId, targetId }: { sourceId: PortId | null; targetId: PortId | null }) => ({
          dataplane: useDataplane(),
          sourceHasOutgoing: useHasOutgoing((sourceId ?? 'placeholder') as PortId),
          targetHasOutgoing: useHasOutgoing((targetId ?? 'placeholder') as PortId),
        }),
        {
          wrapper: createWrapper(),
          initialProps: { sourceId: null as PortId | null, targetId: null as PortId | null },
        }
      );

      await act(async () => {
        await result.current.dataplane.initGraph();
        await vi.advanceTimersByTimeAsync(0);
      });

      let sourcePortId: PortId | null = null;
      let targetPortId: PortId | null = null;

      await act(async () => {
        const sourcePort = await result.current.dataplane.registerPort({
          blockId: 'source' as BlockId,
          direction: 'out',
          dataType: 'table',
          position: 'right',
        });
        sourcePortId = sourcePort?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        const targetPort = await result.current.dataplane.registerPort({
          blockId: 'target' as BlockId,
          direction: 'in',
          dataType: 'table',
          position: 'left',
        });
        targetPortId = targetPort?.id ?? null;
        await vi.advanceTimersByTimeAsync(0);
      });

      if (!sourcePortId || !targetPortId) {
        throw new Error('Ports not created');
      }

      await act(async () => {
        await result.current.dataplane.createLink({
          sourcePort: sourcePortId!,
          targetPort: targetPortId!,
          direction: 'unidirectional',
          relationship: 'pipe',
        });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Verify link was created
      expect(result.current.dataplane.links).toHaveLength(1);

      // Rerender with actual port IDs to observe their outgoing state
      await act(async () => {
        rerender({ sourceId: sourcePortId, targetId: targetPortId });
        await vi.advanceTimersByTimeAsync(0);
      });

      // Source has outgoing link (source -> target)
      expect(result.current.sourceHasOutgoing).toBe(true);

      // Target should NOT have outgoing
      expect(result.current.targetHasOutgoing).toBe(false);
    });
  });
});

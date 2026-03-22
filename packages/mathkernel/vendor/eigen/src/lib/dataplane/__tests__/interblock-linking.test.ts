/**
 * @fileoverview Interblock Linking Smoke Tests
 *
 * Validates block-to-block port linking scenarios — the core use case
 * for DataplaneVisualizer. Tests cover:
 *
 * H1: Two blocks can link via matching ports (out → in)
 * H2: Link direction is respected (unidirectional vs bidirectional)
 * H3: Chain linking works (A → B → C)
 * H4: Multiple links from single output port (fan-out)
 * H5: Multiple links to single input port (fan-in)
 * H6: Port unregistration cascades to remove links
 * H7: linksForPortAtom correctly aggregates incoming/outgoing
 *
 * @module dataplane/__tests__/interblock-linking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Registry } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';

import {
  portsAtom,
  linksAtom,
  graphInitializedAtom,
  dataplaneOps,
  linksForPortAtom,
  linksBySourceAtom,
  linksByTargetAtom,
  dataplaneRuntimeAtom,
  versionAtom,
} from '../atoms';

import type { BlockId, PortId, LinkId } from '../schemas/link';

describe('Interblock Linking Smoke Tests', () => {
  let registry: Registry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = Registry.make();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Test Fixtures
  // ===========================================================================

  interface BlockFixture {
    id: BlockId;
    inPort?: PortId;
    outPort?: PortId;
    biPort?: PortId;
  }

  /**
   * Initialize runtime and mount all required atoms.
   */
  async function initRuntime() {
    registry.mount(dataplaneRuntimeAtom);
    registry.mount(graphInitializedAtom);
    registry.mount(portsAtom);
    registry.mount(linksAtom);
    registry.mount(versionAtom);
    await vi.advanceTimersByTimeAsync(0);

    const runtimeResult = registry.get(dataplaneRuntimeAtom);
    if (!Result.isSuccess(runtimeResult)) {
      throw new Error(`Runtime failed: ${runtimeResult._tag}`);
    }

    registry.mount(dataplaneOps.initGraph);
    registry.set(dataplaneOps.initGraph, undefined);
    await vi.advanceTimersByTimeAsync(0);
  }

  /**
   * Create a block with specified ports.
   */
  async function createBlock(
    blockId: string,
    options: { in?: boolean; out?: boolean; bidir?: boolean } = {}
  ): Promise<BlockFixture> {
    const fixture: BlockFixture = { id: blockId as BlockId };

    registry.mount(dataplaneOps.registerPort);

    if (options.in) {
      registry.set(dataplaneOps.registerPort, {
        blockId: blockId as BlockId,
        direction: 'in' as const,
        dataType: 'table' as const,
        position: 'left' as const,
        label: `${blockId}-in`,
      });
      await vi.advanceTimersByTimeAsync(0);
      const ports = registry.get(portsAtom);
      fixture.inPort = ports[ports.length - 1].id;
    }

    if (options.out) {
      registry.set(dataplaneOps.registerPort, {
        blockId: blockId as BlockId,
        direction: 'out' as const,
        dataType: 'table' as const,
        position: 'right' as const,
        label: `${blockId}-out`,
      });
      await vi.advanceTimersByTimeAsync(0);
      const ports = registry.get(portsAtom);
      fixture.outPort = ports[ports.length - 1].id;
    }

    if (options.bidir) {
      registry.set(dataplaneOps.registerPort, {
        blockId: blockId as BlockId,
        direction: 'inout' as const,
        dataType: 'stream' as const,
        position: 'bottom' as const,
        label: `${blockId}-bi`,
      });
      await vi.advanceTimersByTimeAsync(0);
      const ports = registry.get(portsAtom);
      fixture.biPort = ports[ports.length - 1].id;
    }

    return fixture;
  }

  /**
   * Create a link between ports.
   */
  async function linkPorts(
    sourcePort: PortId,
    targetPort: PortId,
    options: { bidirectional?: boolean } = {}
  ): Promise<LinkId> {
    registry.mount(dataplaneOps.createLink);
    registry.set(dataplaneOps.createLink, {
      sourcePort,
      targetPort,
      direction: options.bidirectional ? 'bidirectional' : 'unidirectional',
      relationship: 'pipe' as const,
    });
    await vi.advanceTimersByTimeAsync(0);

    const links = registry.get(linksAtom);
    return links[links.length - 1].id;
  }

  // ===========================================================================
  // H1: Basic Block-to-Block Linking
  // ===========================================================================

  describe('H1: Two blocks can link via matching ports', () => {
    it('creates link from BlockA.out → BlockB.in', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(1);
      expect(links[0].sourcePort).toBe(blockA.outPort);
      expect(links[0].targetPort).toBe(blockB.inPort);
    });

    it('link appears in linksForPortAtom for both source and target', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);

      const linksFromA = registry.get(linksForPortAtom(blockA.outPort!));
      const linksToB = registry.get(linksForPortAtom(blockB.inPort!));

      expect(linksFromA).toHaveLength(1);
      expect(linksToB).toHaveLength(1);
      expect(linksFromA[0].id).toBe(linksToB[0].id);
    });

    it('link direction matches requested direction', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);

      const links = registry.get(linksAtom);
      expect(links[0].direction).toBe('unidirectional');
    });
  });

  // ===========================================================================
  // H2: Bidirectional Links
  // ===========================================================================

  describe('H2: Bidirectional links work correctly', () => {
    it('creates bidirectional link between inout ports', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { bidir: true });
      const blockB = await createBlock('block-b', { bidir: true });

      await linkPorts(blockA.biPort!, blockB.biPort!, { bidirectional: true });

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(1);
      expect(links[0].direction).toBe('bidirectional');
    });

    it('bidirectional link appears in both directions', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { bidir: true });
      const blockB = await createBlock('block-b', { bidir: true });

      await linkPorts(blockA.biPort!, blockB.biPort!, { bidirectional: true });

      const bySource = registry.get(linksBySourceAtom);
      const byTarget = registry.get(linksByTargetAtom);

      expect(bySource.get(blockA.biPort!)?.length).toBe(1);
      expect(byTarget.get(blockB.biPort!)?.length).toBe(1);
    });
  });

  // ===========================================================================
  // H3: Chain Linking (A → B → C)
  // ===========================================================================

  describe('H3: Chain linking works (A → B → C)', () => {
    it('creates chain of 3 blocks', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true, out: true });
      const blockC = await createBlock('block-c', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);
      await linkPorts(blockB.outPort!, blockC.inPort!);

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(2);

      // Verify chain: A.out → B.in, B.out → C.in
      expect(links.some((l) => l.sourcePort === blockA.outPort && l.targetPort === blockB.inPort)).toBe(true);
      expect(links.some((l) => l.sourcePort === blockB.outPort && l.targetPort === blockC.inPort)).toBe(true);
    });

    it('middle block sees links on both in and out ports', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true, out: true });
      const blockC = await createBlock('block-c', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);
      await linkPorts(blockB.outPort!, blockC.inPort!);

      const linksToB = registry.get(linksForPortAtom(blockB.inPort!));
      const linksFromB = registry.get(linksForPortAtom(blockB.outPort!));

      expect(linksToB).toHaveLength(1);
      expect(linksFromB).toHaveLength(1);
    });
  });

  // ===========================================================================
  // H4: Fan-Out (One Output → Multiple Inputs)
  // ===========================================================================

  describe('H4: Fan-out works (1 out → N in)', () => {
    it('single output port links to multiple input ports', async () => {
      await initRuntime();

      const source = await createBlock('source', { out: true });
      const sink1 = await createBlock('sink-1', { in: true });
      const sink2 = await createBlock('sink-2', { in: true });
      const sink3 = await createBlock('sink-3', { in: true });

      await linkPorts(source.outPort!, sink1.inPort!);
      await linkPorts(source.outPort!, sink2.inPort!);
      await linkPorts(source.outPort!, sink3.inPort!);

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(3);

      const linksFromSource = registry.get(linksForPortAtom(source.outPort!));
      expect(linksFromSource).toHaveLength(3);
    });

    it('each sink sees exactly one link', async () => {
      await initRuntime();

      const source = await createBlock('source', { out: true });
      const sink1 = await createBlock('sink-1', { in: true });
      const sink2 = await createBlock('sink-2', { in: true });

      await linkPorts(source.outPort!, sink1.inPort!);
      await linkPorts(source.outPort!, sink2.inPort!);

      expect(registry.get(linksForPortAtom(sink1.inPort!))).toHaveLength(1);
      expect(registry.get(linksForPortAtom(sink2.inPort!))).toHaveLength(1);
    });
  });

  // ===========================================================================
  // H5: Fan-In (Multiple Outputs → One Input)
  // ===========================================================================

  describe('H5: Fan-in works (N out → 1 in)', () => {
    it('multiple output ports link to single input port', async () => {
      await initRuntime();

      const source1 = await createBlock('source-1', { out: true });
      const source2 = await createBlock('source-2', { out: true });
      const sink = await createBlock('sink', { in: true });

      await linkPorts(source1.outPort!, sink.inPort!);
      await linkPorts(source2.outPort!, sink.inPort!);

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(2);

      const linksToSink = registry.get(linksForPortAtom(sink.inPort!));
      expect(linksToSink).toHaveLength(2);
    });
  });

  // ===========================================================================
  // H6: Port Unregistration Cascades
  // ===========================================================================

  describe('H6: Port unregistration removes connected links', () => {
    it('removing source port removes outgoing links', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);
      expect(registry.get(linksAtom)).toHaveLength(1);

      registry.mount(dataplaneOps.unregisterPort);
      registry.set(dataplaneOps.unregisterPort, blockA.outPort!);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(linksAtom)).toHaveLength(0);
    });

    it('removing target port removes incoming links', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);
      expect(registry.get(linksAtom)).toHaveLength(1);

      registry.mount(dataplaneOps.unregisterPort);
      registry.set(dataplaneOps.unregisterPort, blockB.inPort!);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(linksAtom)).toHaveLength(0);
    });

    it('removing middle block breaks chain', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true, out: true });
      const blockC = await createBlock('block-c', { in: true });

      await linkPorts(blockA.outPort!, blockB.inPort!);
      await linkPorts(blockB.outPort!, blockC.inPort!);
      expect(registry.get(linksAtom)).toHaveLength(2);

      // Remove blockB's input port (breaks A→B)
      registry.mount(dataplaneOps.unregisterPort);
      registry.set(dataplaneOps.unregisterPort, blockB.inPort!);
      await vi.advanceTimersByTimeAsync(0);

      expect(registry.get(linksAtom)).toHaveLength(1);
      expect(registry.get(linksAtom)[0].sourcePort).toBe(blockB.outPort);
    });
  });

  // ===========================================================================
  // H7: linksForPortAtom Aggregation
  // ===========================================================================

  describe('H7: linksForPortAtom correctly aggregates', () => {
    it('aggregates incoming and outgoing links for bidirectional port', async () => {
      await initRuntime();

      // Center block with bidir port
      const center = await createBlock('center', { bidir: true });
      const left = await createBlock('left', { out: true });
      const right = await createBlock('right', { in: true });

      // left.out → center.bi
      await linkPorts(left.outPort!, center.biPort!);
      // center.bi → right.in
      await linkPorts(center.biPort!, right.inPort!);

      const centerLinks = registry.get(linksForPortAtom(center.biPort!));
      expect(centerLinks).toHaveLength(2);
    });

    it('returns empty array for unconnected port', async () => {
      await initRuntime();

      const block = await createBlock('lonely', { in: true, out: true });

      expect(registry.get(linksForPortAtom(block.inPort!))).toHaveLength(0);
      expect(registry.get(linksForPortAtom(block.outPort!))).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('link creation increments version', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });

      const versionBefore = registry.get(versionAtom);
      await linkPorts(blockA.outPort!, blockB.inPort!);
      const versionAfter = registry.get(versionAtom);

      expect(versionAfter).toBeGreaterThan(versionBefore);
    });

    it('link removal increments version', async () => {
      await initRuntime();

      const blockA = await createBlock('block-a', { out: true });
      const blockB = await createBlock('block-b', { in: true });
      const linkId = await linkPorts(blockA.outPort!, blockB.inPort!);

      const versionBefore = registry.get(versionAtom);

      registry.mount(dataplaneOps.removeLink);
      registry.set(dataplaneOps.removeLink, linkId);
      await vi.advanceTimersByTimeAsync(0);

      const versionAfter = registry.get(versionAtom);
      expect(versionAfter).toBeGreaterThan(versionBefore);
    });

    it('self-linking (same block) works', async () => {
      await initRuntime();

      const block = await createBlock('loopback', { in: true, out: true });

      await linkPorts(block.outPort!, block.inPort!);

      const links = registry.get(linksAtom);
      expect(links).toHaveLength(1);
      expect(links[0].sourcePort).toBe(block.outPort);
      expect(links[0].targetPort).toBe(block.inPort);
    });
  });
});

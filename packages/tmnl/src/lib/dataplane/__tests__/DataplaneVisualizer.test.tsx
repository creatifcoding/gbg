/**
 * @fileoverview DataplaneVisualizer Component Tests
 *
 * Tests for the React Flow-based dataplane visualization.
 * Uses vitest + @testing-library/react with Registry-based atom isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Registry, RegistryProvider } from '@effect-atom/atom-react';
import { ReactFlowProvider } from '@xyflow/react';
import * as Result from '@effect-atom/atom/Result';

import { DataplaneVisualizer, type DataplaneVisualizerProps } from '../components/DataplaneVisualizer';
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
import type { PortId, BlockId, LinkPort, Link } from '../schemas/link';

// =============================================================================
// Mock React Flow (partial - keep providers real)
// =============================================================================

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    ReactFlow: ({ nodes, edges, children, onConnect, ...props }: any) => (
      <div data-testid="react-flow" data-nodes={JSON.stringify(nodes)} data-edges={JSON.stringify(edges)}>
        <div data-testid="react-flow-nodes">
          {nodes?.map((node: any) => (
            <div key={node.id} data-testid={`node-${node.id}`} data-node={JSON.stringify(node)}>
              {node.data?.port?.label ?? node.id}
            </div>
          ))}
        </div>
        <div data-testid="react-flow-edges">
          {edges?.map((edge: any) => (
            <div key={edge.id} data-testid={`edge-${edge.id}`} data-edge={JSON.stringify(edge)}>
              {edge.id}
            </div>
          ))}
        </div>
        {children}
        <button
          data-testid="simulate-connect"
          onClick={() => onConnect?.({ source: 'port-1', target: 'port-2' })}
        >
          Connect
        </button>
      </div>
    ),
    Background: () => <div data-testid="react-flow-background" />,
    Controls: () => <div data-testid="react-flow-controls" />,
    MiniMap: () => <div data-testid="react-flow-minimap" />,
    useNodesState: (initialNodes: any[]) => {
      const [nodes, setNodes] = React.useState(initialNodes);
      React.useEffect(() => setNodes(initialNodes), [initialNodes]);
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (initialEdges: any[]) => {
      const [edges, setEdges] = React.useState(initialEdges);
      React.useEffect(() => setEdges(initialEdges), [initialEdges]);
      return [edges, setEdges, vi.fn()];
    },
    addEdge: vi.fn(),
    BackgroundVariant: { Dots: 'dots' },
  };
});

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock LinkPort for testing.
 */
function createMockPort(overrides: Partial<LinkPort> = {}): LinkPort {
  const id = overrides.id ?? (`port-${Math.random().toString(36).slice(2)}` as PortId);
  return {
    _tag: 'LinkPort',
    id,
    blockId: 'block-1' as BlockId,
    direction: 'in',
    dataType: 'table',
    position: 'left',
    createdAt: new Date(),
    ...overrides,
  } as LinkPort;
}

/**
 * Create a mock Link for testing.
 */
function createMockLink(overrides: Partial<Link> = {}): Link {
  return {
    _tag: 'Link',
    id: `link-${Math.random().toString(36).slice(2)}`,
    sourcePort: 'port-1' as PortId,
    targetPort: 'port-2' as PortId,
    direction: 'unidirectional',
    relationship: 'pipe',
    createdAt: new Date(),
    ...overrides,
  } as Link;
}

describe('DataplaneVisualizer', () => {
  let registry: Registry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = Registry.make();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Initialize runtime with all required atoms.
   */
  async function initRuntime() {
    registry.mount(dataplaneRuntimeAtom);
    registry.mount(graphInitializedAtom);
    registry.mount(portsAtom);
    registry.mount(linksAtom);
    registry.mount(planesAtom);
    registry.mount(versionAtom);
    registry.mount(portsByIdAtom);
    registry.mount(linksByIdAtom);
    registry.mount(planesByIdAtom);
    registry.mount(linksBySourceAtom);
    registry.mount(linksByTargetAtom);
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
      throw new Error('Runtime failed to initialize');
    }
  }

  /**
   * Create wrapper with both RegistryProvider and ReactFlowProvider.
   */
  function createWrapper() {
    return function TestWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        RegistryProvider,
        { value: registry },
        React.createElement(ReactFlowProvider, null, children)
      );
    };
  }

  /**
   * Render visualizer with wrapper.
   */
  function renderVisualizer(props: Partial<DataplaneVisualizerProps> = {}) {
    const defaultProps: DataplaneVisualizerProps = {
      scope: 'document',
      ...props,
    };

    return render(<DataplaneVisualizer {...defaultProps} />, {
      wrapper: createWrapper(),
    });
  }

  // ===========================================================================
  // Empty State Tests
  // ===========================================================================

  describe('empty state', () => {
    it('shows empty state when no ports registered', async () => {
      await initRuntime();

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('No ports registered')).toBeInTheDocument();
    });

    it('displays helpful hint in empty state', async () => {
      await initRuntime();

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText(/Ports appear when blocks/)).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Port Rendering Tests
  // ===========================================================================

  describe('port rendering', () => {
    it('renders nodes from portsAtom', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId, label: 'Input' });
      const port2 = createMockPort({ id: 'port-2' as PortId, label: 'Output', direction: 'out' });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const nodesData = JSON.parse(reactFlow.getAttribute('data-nodes') ?? '[]');

      expect(nodesData).toHaveLength(2);
      expect(nodesData[0].id).toBe('port-1');
      expect(nodesData[1].id).toBe('port-2');
    });

    it('converts ports to React Flow nodes with correct type', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const nodesData = JSON.parse(reactFlow.getAttribute('data-nodes') ?? '[]');

      expect(nodesData[0].type).toBe('linkPort');
    });

    it('passes port data to node', async () => {
      await initRuntime();

      const port = createMockPort({
        id: 'port-1' as PortId,
        label: 'TestPort',
        direction: 'in',
        dataType: 'table',
      });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const nodesData = JSON.parse(reactFlow.getAttribute('data-nodes') ?? '[]');

      expect(nodesData[0].data.port.label).toBe('TestPort');
      expect(nodesData[0].data.port.direction).toBe('in');
    });
  });

  // ===========================================================================
  // Link Rendering Tests
  // ===========================================================================

  describe('link rendering', () => {
    it('renders edges from linksAtom', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId });
      const port2 = createMockPort({ id: 'port-2' as PortId, direction: 'out' });
      const link = createMockLink({
        id: 'link-1' as any,
        sourcePort: 'port-1' as PortId,
        targetPort: 'port-2' as PortId,
      });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        registry.set(linksAtom, [link]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const edgesData = JSON.parse(reactFlow.getAttribute('data-edges') ?? '[]');

      expect(edgesData).toHaveLength(1);
      expect(edgesData[0].source).toBe('port-1');
      expect(edgesData[0].target).toBe('port-2');
    });

    it('sets bidirectional type for bidirectional links', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId });
      const port2 = createMockPort({ id: 'port-2' as PortId });
      const link = createMockLink({
        id: 'link-1' as any,
        direction: 'bidirectional',
      });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        registry.set(linksAtom, [link]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const edgesData = JSON.parse(reactFlow.getAttribute('data-edges') ?? '[]');

      expect(edgesData[0].type).toBe('bidirectional');
    });

    it('sets animated prop on edges', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId });
      const port2 = createMockPort({ id: 'port-2' as PortId });
      const link = createMockLink({ id: 'link-1' as any });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        registry.set(linksAtom, [link]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const edgesData = JSON.parse(reactFlow.getAttribute('data-edges') ?? '[]');

      expect(edgesData[0].animated).toBe(true);
    });
  });

  // ===========================================================================
  // Scope Filtering Tests
  // ===========================================================================

  describe('scope filtering', () => {
    it('scope="document" shows all ports and links', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId, blockId: 'block-a' as BlockId });
      const port2 = createMockPort({ id: 'port-2' as PortId, blockId: 'block-b' as BlockId });
      const link = createMockLink({ id: 'link-1' as any });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        registry.set(linksAtom, [link]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer({ scope: 'document' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const nodesData = JSON.parse(reactFlow.getAttribute('data-nodes') ?? '[]');

      expect(nodesData).toHaveLength(2);
    });

    it('scope="block" filters to specified block', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId, blockId: 'target-block' as BlockId });
      const port2 = createMockPort({ id: 'port-2' as PortId, blockId: 'other-block' as BlockId });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer({ scope: 'block', blockId: 'target-block' as BlockId });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const nodesData = JSON.parse(reactFlow.getAttribute('data-nodes') ?? '[]');

      expect(nodesData).toHaveLength(1);
      expect(nodesData[0].id).toBe('port-1');
    });

    it('scope="block" includes child blocks', async () => {
      await initRuntime();

      const parentPort = createMockPort({ id: 'port-1' as PortId, blockId: 'parent' as BlockId });
      const childPort = createMockPort({ id: 'port-2' as PortId, blockId: 'parent:child' as BlockId });
      const unrelatedPort = createMockPort({ id: 'port-3' as PortId, blockId: 'unrelated' as BlockId });

      await act(async () => {
        registry.set(portsAtom, [parentPort, childPort, unrelatedPort]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer({ scope: 'block', blockId: 'parent' as BlockId });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const reactFlow = screen.getByTestId('react-flow');
      const nodesData = JSON.parse(reactFlow.getAttribute('data-nodes') ?? '[]');

      expect(nodesData).toHaveLength(2);
      expect(nodesData.map((n: any) => n.id)).toContain('port-1');
      expect(nodesData.map((n: any) => n.id)).toContain('port-2');
    });

    it('scope="block" without blockId shows empty', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer({ scope: 'block' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Should show empty state
      expect(screen.getByText('No ports registered')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Mode Tests
  // ===========================================================================

  describe('display modes', () => {
    it('mode="inline" uses relative positioning', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      const { container } = renderVisualizer({ mode: 'inline' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).not.toHaveStyle({ position: 'fixed' });
    });

    it('mode="fullscreen" applies fixed positioning', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      const { container } = renderVisualizer({ mode: 'fullscreen' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ position: 'fixed' });
    });

    it('mode="fullscreen" shows close button', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer({ mode: 'fullscreen' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const closeButton = screen.getByTitle('Close');
      expect(closeButton).toBeInTheDocument();
    });

    it('mode toggle button calls onModeChange', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      const onModeChange = vi.fn();
      renderVisualizer({ mode: 'inline', onModeChange });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const expandButton = screen.getByTitle('Expand to fullscreen');
      fireEvent.click(expandButton);

      expect(onModeChange).toHaveBeenCalledWith('fullscreen');
    });

    it('fullscreen minimap is rendered', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer({ mode: 'fullscreen' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByTestId('react-flow-minimap')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Stats Badge Tests
  // ===========================================================================

  describe('stats display', () => {
    it('displays port count', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId });
      const port2 = createMockPort({ id: 'port-2' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('2 ports')).toBeInTheDocument();
    });

    it('displays link count', async () => {
      await initRuntime();

      const port1 = createMockPort({ id: 'port-1' as PortId });
      const port2 = createMockPort({ id: 'port-2' as PortId });
      const link = createMockLink();

      await act(async () => {
        registry.set(portsAtom, [port1, port2]);
        registry.set(linksAtom, [link]);
        await vi.advanceTimersByTimeAsync(0);
      });

      renderVisualizer();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('1 links')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Inline Height Tests
  // ===========================================================================

  describe('inline height', () => {
    it('applies numeric inlineHeight', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      const { container } = renderVisualizer({ mode: 'inline', inlineHeight: 400 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ height: '400px' });
    });

    it('applies string inlineHeight', async () => {
      await initRuntime();

      const port = createMockPort({ id: 'port-1' as PortId });

      await act(async () => {
        registry.set(portsAtom, [port]);
        await vi.advanceTimersByTimeAsync(0);
      });

      const { container } = renderVisualizer({ mode: 'inline', inlineHeight: '50vh' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveStyle({ height: '50vh' });
    });
  });
});

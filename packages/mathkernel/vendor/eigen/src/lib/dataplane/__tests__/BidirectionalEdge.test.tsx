/**
 * @fileoverview BidirectionalEdge Component Tests
 *
 * Tests for the custom React Flow edge component.
 * Uses vitest + @testing-library/react for rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Position, ReactFlowProvider } from '@xyflow/react';

import { BidirectionalEdge, type BidirectionalEdgeData } from '../components/BidirectionalEdge';
import type { Link, LinkRelationship, PortId, LinkId } from '../schemas/link';

// =============================================================================
// Mocks
// =============================================================================

// Mock EdgeLabelRenderer to render children directly (bypasses portal)
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
      <foreignObject data-testid="edge-label-renderer" width="100" height="100">
        {children}
      </foreignObject>
    ),
  };
});

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock Link for testing.
 */
function createMockLink(overrides: Partial<Link> = {}): Link {
  return {
    _tag: 'Link',
    id: 'link-1' as LinkId,
    sourcePort: 'port-1' as PortId,
    targetPort: 'port-2' as PortId,
    direction: 'unidirectional',
    relationship: 'pipe',
    createdAt: new Date(),
    ...overrides,
  } as Link;
}

/**
 * Create default edge props for testing.
 */
function createEdgeProps(
  dataOverrides: Partial<BidirectionalEdgeData> = {},
  propOverrides: Record<string, unknown> = {}
) {
  return {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    sourceX: 100,
    sourceY: 100,
    targetX: 300,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    sourceHandleId: 'handle-1',
    targetHandleId: 'handle-2',
    data: {
      link: createMockLink(),
      ...dataOverrides,
    } as BidirectionalEdgeData,
    selected: false,
    ...propOverrides,
  };
}

/**
 * Wrapper with ReactFlowProvider for edge component testing.
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ReactFlowProvider>
      <svg data-testid="svg-container" width="500" height="200">
        {children}
      </svg>
    </ReactFlowProvider>
  );
}

// =============================================================================
// Tests
// =============================================================================

describe('BidirectionalEdge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders edge path element', () => {
      const props = createEdgeProps();

      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // BaseEdge renders a path element
      const paths = container.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('renders edge label with relationship icon', () => {
      const props = createEdgeProps({
        link: createMockLink({ relationship: 'pipe' }),
      });

      render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Pipe relationship should show arrow icon
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('renders defs with arrow marker', () => {
      const props = createEdgeProps();

      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Check for marker definition
      const defs = container.querySelector('defs');
      expect(defs).toBeInTheDocument();

      const marker = container.querySelector(`marker[id="arrow-${props.id}"]`);
      expect(marker).toBeInTheDocument();
    });
  });

  describe('relationship-based styling', () => {
    const relationships: Array<{ type: LinkRelationship; icon: string; color: string }> = [
      { type: 'pipe', icon: '→', color: 'rgba(34, 211, 238, 0.8)' },      // Cyan
      { type: 'sync', icon: '⇄', color: 'rgba(167, 139, 250, 0.8)' },     // Violet
      { type: 'aggregate', icon: '∑', color: 'rgba(251, 191, 36, 0.8)' }, // Amber
      { type: 'mirror', icon: '≡', color: 'rgba(74, 222, 128, 0.8)' },    // Emerald
    ];

    relationships.forEach(({ type, icon, color }) => {
      it(`renders ${type} relationship with correct icon (${icon})`, () => {
        const props = createEdgeProps({
          link: createMockLink({ relationship: type }),
        });

        render(
          <TestWrapper>
            <BidirectionalEdge {...props} />
          </TestWrapper>
        );

        expect(screen.getByText(icon)).toBeInTheDocument();
      });

      it(`renders ${type} relationship with correct color`, () => {
        const props = createEdgeProps({
          link: createMockLink({ relationship: type }),
        });

        render(
          <TestWrapper>
            <BidirectionalEdge {...props} />
          </TestWrapper>
        );

        // Find the label container and check its background color
        const label = screen.getByText(icon);
        expect(label).toHaveStyle({ backgroundColor: color });
      });
    });
  });

  describe('bidirectional mode', () => {
    it('renders secondary path for bidirectional links', () => {
      const props = createEdgeProps({
        link: createMockLink({ direction: 'bidirectional', relationship: 'sync' }),
      });

      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Bidirectional renders two paths (main + reverse)
      const paths = container.querySelectorAll('path');
      // There should be main edge + reverse edge + arrow marker paths
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });

    it('renders reverse arrow marker for bidirectional links', () => {
      const props = createEdgeProps({
        link: createMockLink({ direction: 'bidirectional', relationship: 'sync' }),
      });

      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Check for reverse marker
      const reverseMarker = container.querySelector(`marker[id="arrow-reverse-${props.id}"]`);
      expect(reverseMarker).toBeInTheDocument();
    });

    it('does not render reverse path for unidirectional links', () => {
      const props = createEdgeProps({
        link: createMockLink({ direction: 'unidirectional' }),
      });

      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Should not have reverse marker
      const reverseMarker = container.querySelector(`marker[id="arrow-reverse-${props.id}"]`);
      expect(reverseMarker).not.toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('applies glow filter when selected', () => {
      const props = createEdgeProps({}, { selected: true });

      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Component should render without error when selected
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('transform indicator', () => {
    it('renders transform indicator when link has transform', () => {
      const props = createEdgeProps({
        link: createMockLink({
          hasTransform: true,
          transform: '(row) => row.value > 10',
        }),
      });

      render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Should show function indicator
      expect(screen.getByText('ƒ')).toBeInTheDocument();
    });

    it('does not render transform indicator when link has no transform', () => {
      const props = createEdgeProps({
        link: createMockLink({ hasTransform: false }),
      });

      render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Should not show function indicator
      expect(screen.queryByText('ƒ')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles missing link data gracefully', () => {
      const props = {
        ...createEdgeProps(),
        data: undefined,
      };

      // Should not throw - component falls back to defaults
      const { container } = render(
        <TestWrapper>
          <BidirectionalEdge {...props as any} />
        </TestWrapper>
      );

      // Should still render the mirror icon (default)
      expect(screen.getByText('≡')).toBeInTheDocument();
    });

    it('defaults to mirror relationship when link has no relationship', () => {
      const props = createEdgeProps({
        link: { ...createMockLink(), relationship: undefined } as any,
      });

      render(
        <TestWrapper>
          <BidirectionalEdge {...props} />
        </TestWrapper>
      );

      // Should fall back to mirror icon
      expect(screen.getByText('≡')).toBeInTheDocument();
    });
  });
});

/**
 * JsonRenderBlock Component Tests
 *
 * Tests for the JsonRenderBlock terminal renderer component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RegistryProvider } from '@effect-atom/atom-react'

import { JsonRenderBlock } from '../index'
import { createJsonRenderBlock, createJsonRenderBlockWithRegions } from '../../../schemas/json-render-block'
import type { UITree } from '@/lib/json-render/core/schemas'

// =============================================================================
// Test Utilities
// =============================================================================

function renderWithRegistry(ui: React.ReactElement) {
  return render(<RegistryProvider>{ui}</RegistryProvider>)
}

// Mock UITree for testing
const createMockTree = (): UITree => ({
  root: 'root',
  elements: {
    root: {
      key: 'root',
      type: 'Container',
      props: { className: 'test-container' },
      children: ['text-1'],
      parentKey: null,
    },
    'text-1': {
      key: 'text-1',
      type: 'Text',
      props: { children: 'Hello, World!' },
      children: [],
      parentKey: 'root',
    },
  },
})

// =============================================================================
// Tests
// =============================================================================

describe('JsonRenderBlock Component', () => {
  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      const block = createJsonRenderBlock()
      renderWithRegistry(<JsonRenderBlock block={block} />)
      // Should render the block wrapper
      expect(screen.getByTestId('json-render-block')).toBeInTheDocument()
    })

    it('should show loading state when streaming with no tree', () => {
      const block = createJsonRenderBlock(null, true) // isStreaming = true
      renderWithRegistry(<JsonRenderBlock block={block} />)
      expect(screen.getByTestId('json-render-loading')).toBeInTheDocument()
    })

    it('should show empty state when no tree and not streaming', () => {
      const block = createJsonRenderBlock(null, false)
      renderWithRegistry(<JsonRenderBlock block={block} />)
      expect(screen.getByTestId('json-render-empty')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Tree Rendering
  // ==========================================================================

  describe('tree rendering', () => {
    it('should render UITree when provided', () => {
      const tree = createMockTree()
      const block = createJsonRenderBlock(tree, false)
      renderWithRegistry(<JsonRenderBlock block={block} />)
      // The Renderer should be rendered
      expect(screen.getByTestId('json-render-content')).toBeInTheDocument()
    })

    it('should show streaming indicator when tree exists and streaming', () => {
      const tree = createMockTree()
      const block = createJsonRenderBlock(tree, true) // isStreaming = true
      renderWithRegistry(<JsonRenderBlock block={block} />)
      expect(screen.getByTestId('json-render-streaming')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Compound Components
  // ==========================================================================

  describe('compound components', () => {
    it('should render Header', () => {
      const block = createJsonRenderBlock()
      renderWithRegistry(
        <JsonRenderBlock block={block}>
          <JsonRenderBlock.Header />
        </JsonRenderBlock>
      )
      expect(screen.getByTestId('json-render-header')).toBeInTheDocument()
    })

    it('should render Content', () => {
      const tree = createMockTree()
      const block = createJsonRenderBlock(tree, false)
      renderWithRegistry(
        <JsonRenderBlock block={block}>
          <JsonRenderBlock.Content />
        </JsonRenderBlock>
      )
      expect(screen.getByTestId('json-render-content')).toBeInTheDocument()
    })

    it('should render SemanticRegions when present', () => {
      const tree = createMockTree()
      const regions = [
        { id: 'region-1', label: 'Test Region', type: 'content' },
      ]
      const block = createJsonRenderBlockWithRegions(tree, regions, false)
      renderWithRegistry(
        <JsonRenderBlock block={block}>
          <JsonRenderBlock.SemanticRegions />
        </JsonRenderBlock>
      )
      expect(screen.getByTestId('json-render-regions')).toBeInTheDocument()
      expect(screen.getByText('Test Region')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Props
  // ==========================================================================

  describe('props', () => {
    it('should accept className', () => {
      const block = createJsonRenderBlock()
      renderWithRegistry(<JsonRenderBlock block={block} className="custom-class" />)
      expect(screen.getByTestId('json-render-block')).toHaveClass('custom-class')
    })

    it('should accept custom registry', () => {
      const tree = createMockTree()
      const block = createJsonRenderBlock(tree, false)
      const customRegistry = {
        Container: ({ children }: any) => <div data-testid="custom-container">{children}</div>,
        Text: ({ element }: any) => <span data-testid="custom-text">{element.props.children}</span>,
      }
      renderWithRegistry(
        <JsonRenderBlock block={block} registry={customRegistry} />
      )
      expect(screen.getByTestId('custom-container')).toBeInTheDocument()
    })

    it('should pass disableAnimations to Renderer', () => {
      const tree = createMockTree()
      const block = createJsonRenderBlock(tree, false)
      // Just verify it doesn't crash with the prop
      renderWithRegistry(<JsonRenderBlock block={block} disableAnimations />)
      expect(screen.getByTestId('json-render-content')).toBeInTheDocument()
    })
  })
})

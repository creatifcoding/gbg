/**
 * GeniferBlock Component Tests
 *
 * Tests for the GeniferBlock terminal renderer component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RegistryProvider } from '@effect-atom/atom-react'

import { GeniferBlock } from '../index'
import { createGeniferBlock, createGeniferBlockWithRegions } from '../../../schemas/genifer-block'
import type { UITree } from '@/lib/genifer/core/schemas'

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

describe('GeniferBlock Component', () => {
  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      const block = createGeniferBlock()
      renderWithRegistry(<GeniferBlock block={block} />)
      // Should render the block wrapper
      expect(screen.getByTestId('genifer-block')).toBeInTheDocument()
    })

    it('should show loading state when streaming with no tree', () => {
      const block = createGeniferBlock(null, true) // isStreaming = true
      renderWithRegistry(<GeniferBlock block={block} />)
      expect(screen.getByTestId('genifer-loading')).toBeInTheDocument()
    })

    it('should show empty state when no tree and not streaming', () => {
      const block = createGeniferBlock(null, false)
      renderWithRegistry(<GeniferBlock block={block} />)
      expect(screen.getByTestId('genifer-empty')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Tree Rendering
  // ==========================================================================

  describe('tree rendering', () => {
    it('should render UITree when provided', () => {
      const tree = createMockTree()
      const block = createGeniferBlock(tree, false)
      renderWithRegistry(<GeniferBlock block={block} />)
      // The Renderer should be rendered
      expect(screen.getByTestId('genifer-content')).toBeInTheDocument()
    })

    it('should show streaming indicator when tree exists and streaming', () => {
      const tree = createMockTree()
      const block = createGeniferBlock(tree, true) // isStreaming = true
      renderWithRegistry(<GeniferBlock block={block} />)
      expect(screen.getByTestId('genifer-streaming')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Compound Components
  // ==========================================================================

  describe('compound components', () => {
    it('should render Header', () => {
      const block = createGeniferBlock()
      renderWithRegistry(
        <GeniferBlock block={block}>
          <GeniferBlock.Header />
        </GeniferBlock>
      )
      expect(screen.getByTestId('genifer-header')).toBeInTheDocument()
    })

    it('should render Content', () => {
      const tree = createMockTree()
      const block = createGeniferBlock(tree, false)
      renderWithRegistry(
        <GeniferBlock block={block}>
          <GeniferBlock.Content />
        </GeniferBlock>
      )
      expect(screen.getByTestId('genifer-content')).toBeInTheDocument()
    })

    it('should render SemanticRegions when present', () => {
      const tree = createMockTree()
      const regions = [
        { id: 'region-1', label: 'Test Region', type: 'content' },
      ]
      const block = createGeniferBlockWithRegions(tree, regions, false)
      renderWithRegistry(
        <GeniferBlock block={block}>
          <GeniferBlock.SemanticRegions />
        </GeniferBlock>
      )
      expect(screen.getByTestId('genifer-regions')).toBeInTheDocument()
      expect(screen.getByText('Test Region')).toBeInTheDocument()
    })
  })

  // ==========================================================================
  // Props
  // ==========================================================================

  describe('props', () => {
    it('should accept className', () => {
      const block = createGeniferBlock()
      renderWithRegistry(<GeniferBlock block={block} className="custom-class" />)
      expect(screen.getByTestId('genifer-block')).toHaveClass('custom-class')
    })

    it('should accept custom registry', () => {
      const tree = createMockTree()
      const block = createGeniferBlock(tree, false)
      const customRegistry = {
        Container: ({ children }: any) => <div data-testid="custom-container">{children}</div>,
        Text: ({ element }: any) => <span data-testid="custom-text">{element.props.children}</span>,
      }
      renderWithRegistry(
        <GeniferBlock block={block} registry={customRegistry} />
      )
      expect(screen.getByTestId('custom-container')).toBeInTheDocument()
    })

    it('should pass disableAnimations to Renderer', () => {
      const tree = createMockTree()
      const block = createGeniferBlock(tree, false)
      // Just verify it doesn't crash with the prop
      renderWithRegistry(<GeniferBlock block={block} disableAnimations />)
      expect(screen.getByTestId('genifer-content')).toBeInTheDocument()
    })
  })
})

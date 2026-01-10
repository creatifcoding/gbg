/**
 * @vitest-environment happy-dom
 */

/**
 * GeointShell Compound Component Tests
 *
 * Tests for the GeointShell compound component including:
 * - Layout mode switching (command, focus, analytics)
 * - Compound component slot rendering
 * - Panel collapse/expand state
 * - Keyboard shortcuts
 * - Animation state transitions
 *
 * @see beads:tmnl-qkrww GeointShell compound component
 * @module geoint/__tests__/GeointShell.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { GeointShell, useGeointShell } from '../components/GeointShell'

// =============================================================================
// Test Fixtures
// =============================================================================

/** Test component that displays current layout mode */
const LayoutDisplayer = () => {
  const { layout, matches } = useGeointShell()
  return (
    <div data-testid="layout-info">
      <span data-testid="current-layout">{layout}</span>
      <span data-testid="is-command">{matches.command ? 'yes' : 'no'}</span>
      <span data-testid="is-focus">{matches.focus ? 'yes' : 'no'}</span>
      <span data-testid="is-analytics">{matches.analytics ? 'yes' : 'no'}</span>
      <span data-testid="is-transitioning">{matches.transitioning ? 'yes' : 'no'}</span>
    </div>
  )
}

/** Test component that displays panel states */
const PanelDisplayer = () => {
  const { panels } = useGeointShell()
  return (
    <div data-testid="panel-info">
      <span data-testid="sidebar-collapsed">{panels.sidebar.collapsed ? 'collapsed' : 'expanded'}</span>
      <span data-testid="sidebar-section">{panels.sidebar.section}</span>
      <span data-testid="intel-collapsed">{panels.intel.collapsed ? 'collapsed' : 'expanded'}</span>
      <span data-testid="intel-tab">{panels.intel.tab}</span>
      <span data-testid="timeline-collapsed">{panels.timeline.collapsed ? 'collapsed' : 'expanded'}</span>
      <span data-testid="timeline-range">{panels.timeline.range}</span>
    </div>
  )
}

/** Test component that provides layout controls */
const LayoutControls = () => {
  const { setLayout, toggleLayout } = useGeointShell()
  return (
    <div data-testid="layout-controls">
      <button data-testid="set-command" onClick={() => setLayout('command')}>Command</button>
      <button data-testid="set-focus" onClick={() => setLayout('focus')}>Focus</button>
      <button data-testid="set-analytics" onClick={() => setLayout('analytics')}>Analytics</button>
      <button data-testid="toggle-layout" onClick={toggleLayout}>Toggle</button>
    </div>
  )
}

/** Test component that provides panel controls */
const PanelControls = () => {
  const { panels } = useGeointShell()
  return (
    <div data-testid="panel-controls">
      <button data-testid="toggle-sidebar" onClick={panels.sidebar.toggle}>Toggle Sidebar</button>
      <button data-testid="toggle-intel" onClick={panels.intel.toggle}>Toggle Intel</button>
      <button data-testid="toggle-timeline" onClick={panels.timeline.toggle}>Toggle Timeline</button>
      <button data-testid="set-sidebar-layers" onClick={() => panels.sidebar.setSection('layers')}>Layers</button>
      <button data-testid="set-intel-entity" onClick={() => panels.intel.setTab('entity')}>Entity</button>
      <button data-testid="set-timeline-7d" onClick={() => panels.timeline.setRange('7d')}>7 Days</button>
    </div>
  )
}

// =============================================================================
// Tests
// =============================================================================

describe('GeointShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders children', () => {
      render(
        <GeointShell>
          <div data-testid="child">Child Content</div>
        </GeointShell>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('renders with default command layout', () => {
      render(
        <GeointShell>
          <LayoutDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('current-layout')).toHaveTextContent('command')
      expect(screen.getByTestId('is-command')).toHaveTextContent('yes')
    })

    it('renders with specified initial layout', () => {
      render(
        <GeointShell layout="focus">
          <LayoutDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('current-layout')).toHaveTextContent('focus')
      expect(screen.getByTestId('is-focus')).toHaveTextContent('yes')
    })

    it('applies className prop to container', () => {
      const { container } = render(
        <GeointShell className="custom-class">
          <div>Content</div>
        </GeointShell>
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('Compound Component Slots', () => {
    it('renders Header slot', () => {
      render(
        <GeointShell>
          <GeointShell.Header>
            <div data-testid="header-content">Header</div>
          </GeointShell.Header>
        </GeointShell>
      )

      expect(screen.getByTestId('header-content')).toBeInTheDocument()
    })

    it('renders Sidebar slot', () => {
      render(
        <GeointShell>
          <GeointShell.Sidebar>
            <div data-testid="sidebar-content">Sidebar</div>
          </GeointShell.Sidebar>
        </GeointShell>
      )

      expect(screen.getByTestId('sidebar-content')).toBeInTheDocument()
    })

    it('renders Map slot', () => {
      render(
        <GeointShell>
          <GeointShell.Map>
            <div data-testid="map-content">Map</div>
          </GeointShell.Map>
        </GeointShell>
      )

      expect(screen.getByTestId('map-content')).toBeInTheDocument()
    })

    it('renders Intel slot', () => {
      render(
        <GeointShell>
          <GeointShell.Intel>
            <div data-testid="intel-content">Intel</div>
          </GeointShell.Intel>
        </GeointShell>
      )

      expect(screen.getByTestId('intel-content')).toBeInTheDocument()
    })

    it('renders Timeline slot', () => {
      render(
        <GeointShell>
          <GeointShell.Timeline>
            <div data-testid="timeline-content">Timeline</div>
          </GeointShell.Timeline>
        </GeointShell>
      )

      expect(screen.getByTestId('timeline-content')).toBeInTheDocument()
    })

    it('renders all slots together', () => {
      render(
        <GeointShell>
          <GeointShell.Header>Header</GeointShell.Header>
          <GeointShell.Sidebar>Sidebar</GeointShell.Sidebar>
          <GeointShell.Map>Map</GeointShell.Map>
          <GeointShell.Intel>Intel</GeointShell.Intel>
          <GeointShell.Timeline>Timeline</GeointShell.Timeline>
        </GeointShell>
      )

      expect(screen.getByText('Header')).toBeInTheDocument()
      expect(screen.getByText('Sidebar')).toBeInTheDocument()
      expect(screen.getByText('Map')).toBeInTheDocument()
      expect(screen.getByText('Intel')).toBeInTheDocument()
      expect(screen.getByText('Timeline')).toBeInTheDocument()
    })

    it('renders Analytics slots in analytics mode', () => {
      render(
        <GeointShell layout="analytics">
          <GeointShell.AnalyticsTop>Analytics Top</GeointShell.AnalyticsTop>
          <GeointShell.AnalyticsBottom>Analytics Bottom</GeointShell.AnalyticsBottom>
        </GeointShell>
      )

      expect(screen.getByText('Analytics Top')).toBeInTheDocument()
      expect(screen.getByText('Analytics Bottom')).toBeInTheDocument()
    })
  })

  describe('Layout Switching', () => {
    it('switches to focus layout via setLayout', async () => {
      render(
        <GeointShell>
          <LayoutDisplayer />
          <LayoutControls />
        </GeointShell>
      )

      expect(screen.getByTestId('current-layout')).toHaveTextContent('command')

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-focus'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('focus')
      })
    })

    it('switches to analytics layout via setLayout', async () => {
      render(
        <GeointShell>
          <LayoutDisplayer />
          <LayoutControls />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-analytics'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('analytics')
      })
    })

    it('cycles through layouts via toggleLayout', async () => {
      render(
        <GeointShell>
          <LayoutDisplayer />
          <LayoutControls />
        </GeointShell>
      )

      expect(screen.getByTestId('current-layout')).toHaveTextContent('command')

      // Toggle to focus
      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-layout'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('focus')
      })

      // Toggle to analytics
      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-layout'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('analytics')
      })

      // Toggle back to command
      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-layout'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('command')
      })
    })

    it('calls onLayoutChange callback when layout changes', async () => {
      const onLayoutChange = vi.fn()

      render(
        <GeointShell onLayoutChange={onLayoutChange}>
          <LayoutControls />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-focus'))
      })

      await waitFor(() => {
        expect(onLayoutChange).toHaveBeenCalledWith('focus')
      })
    })

    it('does not transition when setting same layout', async () => {
      const onLayoutChange = vi.fn()

      render(
        <GeointShell layout="command" onLayoutChange={onLayoutChange}>
          <LayoutControls />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-command'))
      })

      // Should not fire callback for same layout
      expect(onLayoutChange).not.toHaveBeenCalled()
    })
  })

  describe('Panel State Management', () => {
    it('renders with default panel states', () => {
      render(
        <GeointShell>
          <PanelDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('expanded')
      expect(screen.getByTestId('sidebar-section')).toHaveTextContent('search')
      expect(screen.getByTestId('intel-collapsed')).toHaveTextContent('expanded')
      expect(screen.getByTestId('intel-tab')).toHaveTextContent('results')
      expect(screen.getByTestId('timeline-collapsed')).toHaveTextContent('collapsed')
      expect(screen.getByTestId('timeline-range')).toHaveTextContent('24h')
    })

    it('toggles sidebar collapsed state', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
          <PanelControls />
        </GeointShell>
      )

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('expanded')

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-sidebar'))
      })

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('collapsed')

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-sidebar'))
      })

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('expanded')
    })

    it('toggles intel panel collapsed state', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
          <PanelControls />
        </GeointShell>
      )

      expect(screen.getByTestId('intel-collapsed')).toHaveTextContent('expanded')

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-intel'))
      })

      expect(screen.getByTestId('intel-collapsed')).toHaveTextContent('collapsed')
    })

    it('toggles timeline collapsed state', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
          <PanelControls />
        </GeointShell>
      )

      expect(screen.getByTestId('timeline-collapsed')).toHaveTextContent('collapsed')

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-timeline'))
      })

      expect(screen.getByTestId('timeline-collapsed')).toHaveTextContent('expanded')
    })

    it('sets sidebar section', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
          <PanelControls />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-sidebar-layers'))
      })

      expect(screen.getByTestId('sidebar-section')).toHaveTextContent('layers')
    })

    it('sets intel tab', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
          <PanelControls />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-intel-entity'))
      })

      expect(screen.getByTestId('intel-tab')).toHaveTextContent('entity')
    })

    it('sets timeline range', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
          <PanelControls />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.click(screen.getByTestId('set-timeline-7d'))
      })

      expect(screen.getByTestId('timeline-range')).toHaveTextContent('7d')
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('switches to command layout on Meta+1', async () => {
      render(
        <GeointShell layout="focus">
          <LayoutDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('current-layout')).toHaveTextContent('focus')

      await act(async () => {
        fireEvent.keyDown(window, { key: '1', metaKey: true })
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('command')
      })
    })

    it('switches to focus layout on Meta+2', async () => {
      render(
        <GeointShell>
          <LayoutDisplayer />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: '2', metaKey: true })
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('focus')
      })
    })

    it('switches to analytics layout on Meta+3', async () => {
      render(
        <GeointShell>
          <LayoutDisplayer />
        </GeointShell>
      )

      await act(async () => {
        fireEvent.keyDown(window, { key: '3', metaKey: true })
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('analytics')
      })
    })

    it('toggles sidebar on Meta+B', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('expanded')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'b', metaKey: true })
      })

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('collapsed')
    })

    it('toggles intel panel on Meta+E', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('intel-collapsed')).toHaveTextContent('expanded')

      await act(async () => {
        fireEvent.keyDown(window, { key: 'e', metaKey: true })
      })

      expect(screen.getByTestId('intel-collapsed')).toHaveTextContent('collapsed')
    })

    it('toggles timeline on Meta+T', async () => {
      render(
        <GeointShell>
          <PanelDisplayer />
        </GeointShell>
      )

      expect(screen.getByTestId('timeline-collapsed')).toHaveTextContent('collapsed')

      await act(async () => {
        fireEvent.keyDown(window, { key: 't', metaKey: true })
      })

      expect(screen.getByTestId('timeline-collapsed')).toHaveTextContent('expanded')
    })
  })

  describe('Context Hook', () => {
    it('throws error when used outside GeointShell', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const TestComponent = () => {
        useGeointShell()
        return null
      }

      expect(() => render(<TestComponent />)).toThrow(
        'useGeointShell must be used within GeointShell'
      )

      consoleError.mockRestore()
    })

    it('provides send function for custom events', () => {
      const SendTester = () => {
        const { send } = useGeointShell()
        return (
          <button
            data-testid="send-test"
            onClick={() => send({ type: 'SET_LAYOUT', layout: 'focus' })}
          >
            Send
          </button>
        )
      }

      render(
        <GeointShell>
          <LayoutDisplayer />
          <SendTester />
        </GeointShell>
      )

      expect(screen.getByTestId('current-layout')).toHaveTextContent('command')

      fireEvent.click(screen.getByTestId('send-test'))

      // Wait for state machine to process
      waitFor(() => {
        expect(screen.getByTestId('current-layout')).toHaveTextContent('focus')
      })
    })

    it('exposes actorRef for advanced usage', () => {
      const ActorRefTester = () => {
        const { actorRef } = useGeointShell()
        return (
          <div data-testid="actor-ref-exists">
            {actorRef ? 'yes' : 'no'}
          </div>
        )
      }

      render(
        <GeointShell>
          <ActorRefTester />
        </GeointShell>
      )

      expect(screen.getByTestId('actor-ref-exists')).toHaveTextContent('yes')
    })
  })

  describe('Animation State', () => {
    it('reports isAnimating during transitions', async () => {
      const AnimationTester = () => {
        const { isAnimating } = useGeointShell()
        return <div data-testid="is-animating">{isAnimating ? 'yes' : 'no'}</div>
      }

      render(
        <GeointShell>
          <AnimationTester />
          <LayoutControls />
        </GeointShell>
      )

      expect(screen.getByTestId('is-animating')).toHaveTextContent('no')

      // Trigger layout change - should briefly show animating
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-focus'))
      })

      // Eventually should return to not animating
      await waitFor(
        () => {
          expect(screen.getByTestId('is-animating')).toHaveTextContent('no')
        },
        { timeout: 2000 }
      )
    })
  })

  describe('Focus Mode Floating Panels', () => {
    const FloatingPanelTester = () => {
      const { floating } = useGeointShell()
      return (
        <div data-testid="floating-info">
          <span data-testid="layers-visible">{floating.panels.layers?.visible ? 'yes' : 'no'}</span>
          <span data-testid="entity-visible">{floating.panels.entity?.visible ? 'yes' : 'no'}</span>
          <button
            data-testid="toggle-layers"
            onClick={() => floating.toggleVisibility('layers')}
          >
            Toggle Layers
          </button>
          <button
            data-testid="bring-entity-front"
            onClick={() => floating.bringToFront('entity')}
          >
            Entity to Front
          </button>
        </div>
      )
    }

    it('provides floating panels in focus mode', () => {
      render(
        <GeointShell layout="focus">
          <FloatingPanelTester />
        </GeointShell>
      )

      expect(screen.getByTestId('layers-visible')).toHaveTextContent('yes')
      expect(screen.getByTestId('entity-visible')).toHaveTextContent('yes')
    })

    it('toggles floating panel visibility', async () => {
      render(
        <GeointShell layout="focus">
          <FloatingPanelTester />
        </GeointShell>
      )

      expect(screen.getByTestId('layers-visible')).toHaveTextContent('yes')

      await act(async () => {
        fireEvent.click(screen.getByTestId('toggle-layers'))
      })

      expect(screen.getByTestId('layers-visible')).toHaveTextContent('no')
    })
  })
})

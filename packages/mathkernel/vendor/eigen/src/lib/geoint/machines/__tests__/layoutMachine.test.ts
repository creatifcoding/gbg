/**
 * Layout Machine Tests
 *
 * Tests for the GEOINT layout state machine including:
 * - Layout state transitions (command, focus, analytics)
 * - Panel collapse/expand actions
 * - Floating panel management (Focus mode)
 * - Keyboard shortcut handling
 * - Animation phase coordination
 * - Layout persistence
 *
 * @see beads:tmnl-qkrww GeointShell compound component
 * @module geoint/machines/__tests__/layoutMachine.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createActor, type AnyActorRef } from 'xstate'
import {
  layoutMachine,
  type LayoutContext,
  type LayoutEvent,
  type AnimationPhase,
} from '../layoutMachine'

// =============================================================================
// Test Helpers
// =============================================================================

/** Create and start an actor for testing */
function createTestActor() {
  const actor = createActor(layoutMachine)
  actor.start()
  return actor
}

/** Wait for state to settle (for async transitions) */
async function waitForState(actor: AnyActorRef, expectedState: string, timeout = 1000) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for state: ${expectedState}`))
    }, timeout)

    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.value === expectedState) {
        clearTimeout(timeoutId)
        subscription.unsubscribe()
        resolve()
      }
    })

    // Check current state
    if (actor.getSnapshot().value === expectedState) {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
      resolve()
    }
  })
}

// =============================================================================
// Mock localStorage
// =============================================================================

const createMockLocalStorage = () => {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key])
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

let originalLocalStorage: Storage | undefined

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockLocalStorage(),
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  if (originalLocalStorage !== undefined) {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    })
  }
})

// =============================================================================
// Tests
// =============================================================================

describe('layoutMachine', () => {
  describe('Initial State', () => {
    it('starts in command state', () => {
      const actor = createTestActor()
      expect(actor.getSnapshot().value).toBe('command')
      actor.stop()
    })

    it('has correct initial context', () => {
      const actor = createTestActor()
      const { context } = actor.getSnapshot()

      expect(context.currentLayout).toBe('command')
      expect(context.previousLayout).toBeNull()
      expect(context.animationPhase).toBe('idle')
      expect(context.isAnimating).toBe(false)
      actor.stop()
    })

    it('initializes with default panel states', () => {
      const actor = createTestActor()
      const { context } = actor.getSnapshot()

      expect(context.panels.sidebar.collapsed).toBe(false)
      expect(context.panels.sidebar.section).toBe('search')
      expect(context.panels.intel.collapsed).toBe(false)
      expect(context.panels.intel.tab).toBe('results')
      expect(context.panels.timeline.collapsed).toBe(true)
      expect(context.panels.timeline.range).toBe('24h')
      actor.stop()
    })

    it('initializes with floating panels', () => {
      const actor = createTestActor()
      const { context } = actor.getSnapshot()

      expect(context.floatingPanels.layers).toBeDefined()
      expect(context.floatingPanels.entity).toBeDefined()
      expect(context.floatingPanels.timeline).toBeDefined()
      expect(context.floatingPanels.search).toBeDefined()
      actor.stop()
    })
  })

  describe('Layout Transitions', () => {
    it('transitions from command to focus via SET_LAYOUT', async () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })

      // Should enter transitioning state first
      expect(actor.getSnapshot().value).toBe('transitioning')
      expect(actor.getSnapshot().context.currentLayout).toBe('focus')
      expect(actor.getSnapshot().context.isAnimating).toBe(true)

      // Complete animation
      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().value).toBe('focus')
      expect(actor.getSnapshot().context.isAnimating).toBe(false)
      actor.stop()
    })

    it('transitions from command to analytics via SET_LAYOUT', async () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'analytics' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().value).toBe('analytics')
      actor.stop()
    })

    it('transitions from focus to command', async () => {
      const actor = createTestActor()

      // First go to focus
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      // Then back to command
      actor.send({ type: 'SET_LAYOUT', layout: 'command' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().value).toBe('command')
      actor.stop()
    })

    it('ignores SET_LAYOUT to same layout', () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'command' })

      // Should NOT transition
      expect(actor.getSnapshot().value).toBe('command')
      expect(actor.getSnapshot().context.isAnimating).toBe(false)
      actor.stop()
    })

    it('cycles through layouts via TOGGLE_LAYOUT', async () => {
      const actor = createTestActor()

      // command -> focus
      actor.send({ type: 'TOGGLE_LAYOUT' })
      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('focus')

      // focus -> analytics
      actor.send({ type: 'TOGGLE_LAYOUT' })
      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('analytics')

      // analytics -> command
      actor.send({ type: 'TOGGLE_LAYOUT' })
      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('command')

      actor.stop()
    })

    it('tracks previousLayout during transition', () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })

      expect(actor.getSnapshot().context.previousLayout).toBe('command')
      expect(actor.getSnapshot().context.currentLayout).toBe('focus')

      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().context.previousLayout).toBeNull()
      actor.stop()
    })

    it('auto-completes transition after 500ms timeout', async () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      expect(actor.getSnapshot().value).toBe('transitioning')

      // Wait for the auto-complete timeout (500ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 600))

      expect(actor.getSnapshot().value).toBe('focus')
      expect(actor.getSnapshot().context.isAnimating).toBe(false)

      actor.stop()
    })
  })

  describe('Animation Phase Coordination', () => {
    it('sets animation phase via ANIMATION_PHASE event', () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      expect(actor.getSnapshot().context.animationPhase).toBe('exit_panels')

      actor.send({ type: 'ANIMATION_PHASE', phase: 'transition_layout' })
      expect(actor.getSnapshot().context.animationPhase).toBe('transition_layout')

      actor.send({ type: 'ANIMATION_PHASE', phase: 'enter_panels' })
      expect(actor.getSnapshot().context.animationPhase).toBe('enter_panels')

      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(actor.getSnapshot().context.animationPhase).toBe('idle')

      actor.stop()
    })

    it('resets animation state on ANIMATION_COMPLETE', () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      expect(actor.getSnapshot().context.isAnimating).toBe(true)

      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().context.isAnimating).toBe(false)
      expect(actor.getSnapshot().context.animationPhase).toBe('idle')
      expect(actor.getSnapshot().context.previousLayout).toBeNull()
      actor.stop()
    })
  })

  describe('Sidebar Actions (Command Mode)', () => {
    it('toggles sidebar collapsed state', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(false)

      actor.send({ type: 'TOGGLE_SIDEBAR' })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(true)

      actor.send({ type: 'TOGGLE_SIDEBAR' })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(false)

      actor.stop()
    })

    it('expands sidebar via EXPAND_SIDEBAR', () => {
      const actor = createTestActor()

      // First collapse it
      actor.send({ type: 'COLLAPSE_SIDEBAR' })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(true)

      // Then expand
      actor.send({ type: 'EXPAND_SIDEBAR' })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(false)

      actor.stop()
    })

    it('sets sidebar section and expands', () => {
      const actor = createTestActor()

      // First collapse
      actor.send({ type: 'COLLAPSE_SIDEBAR' })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(true)

      // Set section should expand
      actor.send({ type: 'SET_SIDEBAR_SECTION', section: 'layers' })

      expect(actor.getSnapshot().context.panels.sidebar.section).toBe('layers')
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(false)

      actor.stop()
    })
  })

  describe('Intel Panel Actions (Command Mode)', () => {
    it('toggles intel panel collapsed state', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(false)

      actor.send({ type: 'TOGGLE_INTEL' })
      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(true)

      actor.send({ type: 'TOGGLE_INTEL' })
      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(false)

      actor.stop()
    })

    it('sets intel tab and expands', () => {
      const actor = createTestActor()

      // First collapse
      actor.send({ type: 'COLLAPSE_INTEL' })
      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(true)

      // Set tab should expand
      actor.send({ type: 'SET_INTEL_TAB', tab: 'entity' })

      expect(actor.getSnapshot().context.panels.intel.tab).toBe('entity')
      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(false)

      actor.stop()
    })
  })

  describe('Timeline Actions', () => {
    it('toggles timeline collapsed state', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.timeline.collapsed).toBe(true)

      actor.send({ type: 'TOGGLE_TIMELINE' })
      expect(actor.getSnapshot().context.panels.timeline.collapsed).toBe(false)

      actor.send({ type: 'TOGGLE_TIMELINE' })
      expect(actor.getSnapshot().context.panels.timeline.collapsed).toBe(true)

      actor.stop()
    })

    it('sets timeline range', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.timeline.range).toBe('24h')

      actor.send({ type: 'SET_TIMELINE_RANGE', range: '7d' })
      expect(actor.getSnapshot().context.panels.timeline.range).toBe('7d')

      actor.send({ type: 'SET_TIMELINE_RANGE', range: '2h' })
      expect(actor.getSnapshot().context.panels.timeline.range).toBe('2h')

      actor.stop()
    })
  })

  describe('Floating Panel Actions (Focus Mode)', () => {
    it('moves floating panel', () => {
      const actor = createTestActor()

      // Go to focus mode
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      const originalPosition = actor.getSnapshot().context.floatingPanels.layers.position

      actor.send({ type: 'MOVE_PANEL', id: 'layers', position: { x: 100, y: 200 } })

      const newPosition = actor.getSnapshot().context.floatingPanels.layers.position
      expect(newPosition).toEqual({ x: 100, y: 200 })
      expect(newPosition).not.toEqual(originalPosition)

      actor.stop()
    })

    it('resizes floating panel', () => {
      const actor = createTestActor()

      // Go to focus mode
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      actor.send({ type: 'RESIZE_PANEL', id: 'entity', size: { width: 500 } })

      const newSize = actor.getSnapshot().context.floatingPanels.entity.size
      expect(newSize.width).toBe(500)
      // Height should remain unchanged
      expect(newSize.height).toBe(400)

      actor.stop()
    })

    it('toggles floating panel visibility', () => {
      const actor = createTestActor()

      // Go to focus mode
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().context.floatingPanels.layers.visible).toBe(true)

      actor.send({ type: 'TOGGLE_PANEL_VISIBILITY', id: 'layers' })
      expect(actor.getSnapshot().context.floatingPanels.layers.visible).toBe(false)

      actor.send({ type: 'TOGGLE_PANEL_VISIBILITY', id: 'layers' })
      expect(actor.getSnapshot().context.floatingPanels.layers.visible).toBe(true)

      actor.stop()
    })

    it('toggles floating panel minimize', () => {
      const actor = createTestActor()

      // Go to focus mode
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(actor.getSnapshot().context.floatingPanels.entity.minimized).toBe(false)

      actor.send({ type: 'TOGGLE_PANEL_MINIMIZE', id: 'entity' })
      expect(actor.getSnapshot().context.floatingPanels.entity.minimized).toBe(true)

      actor.send({ type: 'TOGGLE_PANEL_MINIMIZE', id: 'entity' })
      expect(actor.getSnapshot().context.floatingPanels.entity.minimized).toBe(false)

      actor.stop()
    })

    it('brings floating panel to front', () => {
      const actor = createTestActor()

      // Go to focus mode
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      const originalZIndex = actor.getSnapshot().context.floatingPanels.layers.zIndex
      const originalMaxZ = actor.getSnapshot().context.maxZIndex

      actor.send({ type: 'BRING_PANEL_TO_FRONT', id: 'layers' })

      const newZIndex = actor.getSnapshot().context.floatingPanels.layers.zIndex
      const newMaxZ = actor.getSnapshot().context.maxZIndex

      expect(newZIndex).toBeGreaterThan(originalZIndex)
      expect(newMaxZ).toBeGreaterThan(originalMaxZ)
      expect(newZIndex).toBe(newMaxZ)

      actor.stop()
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('switches to command on Meta+1', () => {
      const actor = createTestActor()

      // Go to focus first
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: '1', modifiers: { meta: true } })

      expect(actor.getSnapshot().context.currentLayout).toBe('command')
      actor.stop()
    })

    it('switches to focus on Meta+2', () => {
      const actor = createTestActor()

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: '2', modifiers: { meta: true } })

      expect(actor.getSnapshot().context.currentLayout).toBe('focus')
      actor.stop()
    })

    it('switches to analytics on Meta+3', () => {
      const actor = createTestActor()

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: '3', modifiers: { meta: true } })

      expect(actor.getSnapshot().context.currentLayout).toBe('analytics')
      actor.stop()
    })

    it('toggles sidebar on Meta+B', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(false)

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: 'b', modifiers: { meta: true } })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(true)

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: 'b', modifiers: { meta: true } })
      expect(actor.getSnapshot().context.panels.sidebar.collapsed).toBe(false)

      actor.stop()
    })

    it('toggles intel on Meta+E', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(false)

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: 'e', modifiers: { meta: true } })
      expect(actor.getSnapshot().context.panels.intel.collapsed).toBe(true)

      actor.stop()
    })

    it('toggles timeline on Meta+T', () => {
      const actor = createTestActor()

      expect(actor.getSnapshot().context.panels.timeline.collapsed).toBe(true)

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: 't', modifiers: { meta: true } })
      expect(actor.getSnapshot().context.panels.timeline.collapsed).toBe(false)

      actor.stop()
    })

    it('ignores keyboard shortcuts without meta modifier', () => {
      const actor = createTestActor()

      actor.send({ type: 'KEYBOARD_SHORTCUT', key: '2', modifiers: {} })

      // Should NOT change layout
      expect(actor.getSnapshot().context.currentLayout).toBe('command')
      actor.stop()
    })
  })

  describe('Layout Persistence', () => {
    it('persists layout to localStorage on entry', () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      expect(localStorage.getItem('geoint-layout')).toBe('focus')
      actor.stop()
    })

    it('persists each layout change', () => {
      const actor = createTestActor()

      // Initial command state entry
      expect(localStorage.getItem('geoint-layout')).toBe('command')

      // Transition to focus
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(localStorage.getItem('geoint-layout')).toBe('focus')

      // Transition to analytics
      actor.send({ type: 'SET_LAYOUT', layout: 'analytics' })
      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(localStorage.getItem('geoint-layout')).toBe('analytics')

      actor.stop()
    })
  })

  describe('Mode-Specific Event Handling', () => {
    it('command mode handles panel events', () => {
      const actor = createTestActor()

      // All panel events should work in command mode
      actor.send({ type: 'TOGGLE_SIDEBAR' })
      actor.send({ type: 'TOGGLE_INTEL' })
      actor.send({ type: 'TOGGLE_TIMELINE' })

      const { panels } = actor.getSnapshot().context
      expect(panels.sidebar.collapsed).toBe(true)
      expect(panels.intel.collapsed).toBe(true)
      expect(panels.timeline.collapsed).toBe(false)

      actor.stop()
    })

    it('focus mode handles floating panel events', () => {
      const actor = createTestActor()

      // Go to focus mode
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      // Floating panel events should work
      actor.send({ type: 'MOVE_PANEL', id: 'layers', position: { x: 50, y: 50 } })
      actor.send({ type: 'TOGGLE_PANEL_VISIBILITY', id: 'entity' })

      const { floatingPanels } = actor.getSnapshot().context
      expect(floatingPanels.layers.position).toEqual({ x: 50, y: 50 })
      expect(floatingPanels.entity.visible).toBe(false)

      actor.stop()
    })

    it('analytics mode handles limited panel events', () => {
      const actor = createTestActor()

      // Go to analytics mode
      actor.send({ type: 'SET_LAYOUT', layout: 'analytics' })
      actor.send({ type: 'ANIMATION_COMPLETE' })

      // Basic toggles should work
      actor.send({ type: 'TOGGLE_SIDEBAR' })
      actor.send({ type: 'TOGGLE_TIMELINE' })

      const { panels } = actor.getSnapshot().context
      expect(panels.sidebar.collapsed).toBe(true)
      expect(panels.timeline.collapsed).toBe(false)

      actor.stop()
    })
  })

  describe('Transitioning State Behavior', () => {
    it('blocks layout events during transition', () => {
      const actor = createTestActor()

      // Start transition
      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      expect(actor.getSnapshot().value).toBe('transitioning')

      // Try to send another layout event (should be ignored)
      actor.send({ type: 'SET_LAYOUT', layout: 'analytics' })

      // Should still be transitioning to focus, not analytics
      expect(actor.getSnapshot().context.currentLayout).toBe('focus')

      actor.send({ type: 'ANIMATION_COMPLETE' })
      expect(actor.getSnapshot().value).toBe('focus')

      actor.stop()
    })

    it('allows animation phase updates during transition', () => {
      const actor = createTestActor()

      actor.send({ type: 'SET_LAYOUT', layout: 'focus' })
      expect(actor.getSnapshot().value).toBe('transitioning')

      // Animation phase events should work
      actor.send({ type: 'ANIMATION_PHASE', phase: 'transition_layout' })
      expect(actor.getSnapshot().context.animationPhase).toBe('transition_layout')

      actor.send({ type: 'ANIMATION_PHASE', phase: 'enter_panels' })
      expect(actor.getSnapshot().context.animationPhase).toBe('enter_panels')

      actor.stop()
    })
  })
})

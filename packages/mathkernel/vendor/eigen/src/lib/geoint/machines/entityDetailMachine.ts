/**
 * EntityDetailCard XState Machine
 *
 * Orchestrates tab navigation, content loading, and animations
 * for the EntityDetailCard component.
 *
 * Features:
 * - Tab state management with history tracking
 * - Content loading states per tab
 * - Animation choreography integration
 * - Keyboard navigation support
 *
 * @module geoint/machines/entityDetailMachine
 */

import { setup, assign, fromPromise, emit } from 'xstate'
import type { DetailTab } from '../components/EntityDetailCard'

// =============================================================================
// TYPES
// =============================================================================

export interface EntityDetailContext {
  /** Current active tab */
  activeTab: DetailTab
  /** Previous tabs for back navigation */
  tabHistory: DetailTab[]
  /** Is content loading for current tab */
  isLoading: boolean
  /** Expanded mode */
  isExpanded: boolean
  /** Content cache per tab */
  contentCache: Partial<Record<DetailTab, unknown>>
  /** Animation phase */
  animationPhase: 'idle' | 'exit' | 'enter'
  /** Entity ID being viewed */
  entityId: string | null
}

export type EntityDetailEvent =
  | { type: 'TAB_CHANGE'; tab: DetailTab }
  | { type: 'TAB_BACK' }
  | { type: 'CONTENT_LOADED'; tab: DetailTab; data: unknown }
  | { type: 'TOGGLE_EXPAND' }
  | { type: 'CLOSE' }
  | { type: 'SET_ENTITY'; entityId: string }
  | { type: 'KEYBOARD'; key: 'ArrowLeft' | 'ArrowRight' | '1' | '2' | '3' | '4' }
  | { type: 'ANIMATION_COMPLETE' }

export type EntityDetailEmittedEvent =
  | { type: 'onTabChange'; tab: DetailTab; previousTab: DetailTab }
  | { type: 'onClose' }
  | { type: 'onExpand'; isExpanded: boolean }
  | { type: 'onAnimationStart'; phase: 'exit' | 'enter' }
  | { type: 'onAnimationComplete' }

// =============================================================================
// TAB ORDER
// =============================================================================

const TAB_ORDER: DetailTab[] = ['overview', 'history', 'relations', 'raw']

function getTabIndex(tab: DetailTab): number {
  return TAB_ORDER.indexOf(tab)
}

function getTabByIndex(index: number): DetailTab {
  const normalized = Math.max(0, Math.min(index, TAB_ORDER.length - 1))
  return TAB_ORDER[normalized]
}

function getNextTab(current: DetailTab): DetailTab {
  const index = getTabIndex(current)
  return getTabByIndex(index + 1)
}

function getPrevTab(current: DetailTab): DetailTab {
  const index = getTabIndex(current)
  return getTabByIndex(index - 1)
}

function keyToTab(key: '1' | '2' | '3' | '4'): DetailTab {
  const index = parseInt(key, 10) - 1
  return TAB_ORDER[index]
}

// =============================================================================
// ACTORS
// =============================================================================

/**
 * Mock content loader - in real implementation this would fetch tab-specific data
 */
const loadTabContent = fromPromise<unknown, { tab: DetailTab; entityId: string | null }>(
  async ({ input }) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300))

    // Return mock data based on tab
    switch (input.tab) {
      case 'overview':
        return { type: 'overview', loaded: true }
      case 'history':
        return { type: 'history', events: [] }
      case 'relations':
        return { type: 'relations', links: [] }
      case 'raw':
        return { type: 'raw', json: {} }
    }
  }
)

// =============================================================================
// MACHINE
// =============================================================================

export interface EntityDetailInput {
  initialTab?: DetailTab
  entityId?: string | null
}

export const entityDetailMachine = setup({
  types: {
    context: {} as EntityDetailContext,
    events: {} as EntityDetailEvent,
    emitted: {} as EntityDetailEmittedEvent,
    input: {} as EntityDetailInput,
  },
  actions: {
    setTab: assign(({ context, event }) => {
      if (event.type !== 'TAB_CHANGE') return context
      return {
        tabHistory: [...context.tabHistory, context.activeTab],
        activeTab: event.tab,
        animationPhase: 'exit' as const,
      }
    }),

    goBackTab: assign(({ context }) => {
      if (context.tabHistory.length === 0) return context
      const history = [...context.tabHistory]
      const previousTab = history.pop()!
      return {
        tabHistory: history,
        activeTab: previousTab,
        animationPhase: 'exit' as const,
      }
    }),

    handleKeyboard: assign(({ context, event }) => {
      if (event.type !== 'KEYBOARD') return context

      let newTab: DetailTab = context.activeTab

      switch (event.key) {
        case 'ArrowLeft':
          newTab = getPrevTab(context.activeTab)
          break
        case 'ArrowRight':
          newTab = getNextTab(context.activeTab)
          break
        case '1':
        case '2':
        case '3':
        case '4':
          newTab = keyToTab(event.key)
          break
      }

      if (newTab === context.activeTab) return context

      return {
        tabHistory: [...context.tabHistory, context.activeTab],
        activeTab: newTab,
        animationPhase: 'exit' as const,
      }
    }),

    toggleExpanded: assign(({ context }) => ({
      isExpanded: !context.isExpanded,
    })),

    setEntityId: assign(({ event }) => {
      if (event.type !== 'SET_ENTITY') return {}
      return {
        entityId: event.entityId,
        contentCache: {}, // Clear cache when entity changes
      }
    }),

    cacheContent: assign(({ context, event }) => {
      if (event.type !== 'CONTENT_LOADED') return context
      return {
        contentCache: {
          ...context.contentCache,
          [event.tab]: event.data,
        },
      }
    }),

    setLoading: assign({ isLoading: true }),
    clearLoading: assign({ isLoading: false }),

    startExitAnimation: assign({ animationPhase: 'exit' as const }),
    startEnterAnimation: assign({ animationPhase: 'enter' as const }),
    clearAnimation: assign({ animationPhase: 'idle' as const }),

    emitTabChange: emit(({ context, event }) => {
      const previousTab = context.tabHistory[context.tabHistory.length - 1] ?? 'overview'
      return {
        type: 'onTabChange' as const,
        tab: event.type === 'TAB_CHANGE' ? event.tab : context.activeTab,
        previousTab,
      }
    }),

    emitClose: emit({ type: 'onClose' as const }),

    emitExpand: emit(({ context }) => ({
      type: 'onExpand' as const,
      isExpanded: !context.isExpanded, // Will toggle
    })),

    emitAnimationStart: emit(({ context }) => ({
      type: 'onAnimationStart' as const,
      phase: context.animationPhase as 'exit' | 'enter',
    })),

    emitAnimationComplete: emit({ type: 'onAnimationComplete' as const }),
  },
  guards: {
    hasTabHistory: ({ context }) => context.tabHistory.length > 0,
    isTabCached: ({ context, event }) => {
      if (event.type !== 'TAB_CHANGE') return false
      return context.contentCache[event.tab] !== undefined
    },
    isDifferentTab: ({ context, event }) => {
      if (event.type !== 'TAB_CHANGE') return false
      return context.activeTab !== event.tab
    },
  },
  actors: {
    loadTabContent,
  },
}).createMachine({
  id: 'entityDetail',
  initial: 'idle',
  context: ({ input }) => ({
    activeTab: input?.initialTab ?? 'overview',
    tabHistory: [],
    isLoading: false,
    isExpanded: false,
    contentCache: {},
    animationPhase: 'idle',
    entityId: input?.entityId ?? null,
  }),
  states: {
    idle: {
      on: {
        TAB_CHANGE: {
          guard: 'isDifferentTab',
          target: 'animating',
          actions: ['setTab', 'emitTabChange'],
        },
        TAB_BACK: {
          guard: 'hasTabHistory',
          target: 'animating',
          actions: ['goBackTab'],
        },
        TOGGLE_EXPAND: {
          actions: ['emitExpand', 'toggleExpanded'],
        },
        CLOSE: {
          actions: 'emitClose',
        },
        SET_ENTITY: {
          actions: 'setEntityId',
        },
        KEYBOARD: {
          target: 'animating',
          actions: ['handleKeyboard'],
        },
      },
    },

    animating: {
      initial: 'exit',
      states: {
        exit: {
          entry: ['startExitAnimation', 'emitAnimationStart'],
          after: {
            150: 'enter', // Exit animation duration
          },
        },
        enter: {
          entry: ['startEnterAnimation', 'emitAnimationStart'],
          after: {
            200: 'complete', // Enter animation duration
          },
        },
        complete: {
          entry: ['clearAnimation', 'emitAnimationComplete'],
          type: 'final',
        },
      },
      onDone: 'loading',
    },

    loading: {
      entry: 'setLoading',
      invoke: {
        src: 'loadTabContent',
        input: ({ context }) => ({
          tab: context.activeTab,
          entityId: context.entityId,
        }),
        onDone: {
          target: 'idle',
          actions: [
            'clearLoading',
            ({ event, context }) => assign({ contentCache: { ...context.contentCache, [context.activeTab]: event.output } }),
          ],
        },
        onError: {
          target: 'idle',
          actions: 'clearLoading',
        },
      },
      on: {
        // Allow tab changes while loading (cancels current load)
        TAB_CHANGE: {
          guard: 'isDifferentTab',
          target: 'animating',
          actions: ['setTab', 'emitTabChange'],
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export { TAB_ORDER, getTabIndex, getTabByIndex, getNextTab, getPrevTab }

/**
 * Split Compare XState Machine
 *
 * State machine for split-screen temporal comparison:
 * - Dual viewport synchronization
 * - Time point selection for each pane
 * - Difference highlighting
 * - Swipe comparison mode
 * - Animation transitions
 *
 * @module geoint/machines/splitCompareMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type CompareMode = 'side-by-side' | 'swipe' | 'overlay' | 'flicker'

export type SyncMode = 'locked' | 'unlocked'

export type PaneId = 'left' | 'right'

export interface TimePoint {
  timestamp: Date
  label?: string
}

export interface ViewportSync {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

export interface DifferenceHighlight {
  entityId: string
  changeType: 'added' | 'removed' | 'moved' | 'modified'
  leftPosition?: [number, number]
  rightPosition?: [number, number]
}

export interface PaneState {
  id: PaneId
  timePoint: TimePoint
  viewport: ViewportSync
  entityCount: number
  isLoading: boolean
}

export interface SplitCompareContext {
  /** Current compare mode */
  mode: CompareMode
  /** Left pane state */
  leftPane: PaneState
  /** Right pane state */
  rightPane: PaneState
  /** Viewport sync mode */
  syncMode: SyncMode
  /** Swipe position (0-1) for swipe mode */
  swipePosition: number
  /** Overlay opacity for overlay mode */
  overlayOpacity: number
  /** Flicker speed in ms for flicker mode */
  flickerSpeed: number
  /** Currently visible pane in flicker mode */
  flickerPane: PaneId
  /** Highlighted differences */
  differences: DifferenceHighlight[]
  /** Show difference indicators */
  showDifferences: boolean
  /** Active pane for interaction */
  activePane: PaneId
  /** Animation phase */
  animationPhase: 'idle' | 'transitioning' | 'swiping' | 'flickering'
  /** Available time points for selection */
  availableTimePoints: TimePoint[]
  /** Is computing differences */
  isComputingDifferences: boolean
}

export type SplitCompareEvent =
  // Mode selection
  | { type: 'SET_MODE'; mode: CompareMode }

  // Time point selection
  | { type: 'SET_LEFT_TIME'; timePoint: TimePoint }
  | { type: 'SET_RIGHT_TIME'; timePoint: TimePoint }
  | { type: 'SWAP_TIME_POINTS' }
  | { type: 'SET_AVAILABLE_TIME_POINTS'; timePoints: TimePoint[] }

  // Viewport sync
  | { type: 'SET_SYNC_MODE'; mode: SyncMode }
  | { type: 'SYNC_TO_LEFT' }
  | { type: 'SYNC_TO_RIGHT' }
  | { type: 'UPDATE_VIEWPORT'; pane: PaneId; viewport: ViewportSync }

  // Swipe mode
  | { type: 'SET_SWIPE_POSITION'; position: number }
  | { type: 'SWIPE_LEFT' }
  | { type: 'SWIPE_RIGHT' }
  | { type: 'SWIPE_CENTER' }

  // Overlay mode
  | { type: 'SET_OVERLAY_OPACITY'; opacity: number }

  // Flicker mode
  | { type: 'SET_FLICKER_SPEED'; speed: number }
  | { type: 'TOGGLE_FLICKER' }
  | { type: 'FLICKER_TICK' }
  | { type: 'START_FLICKER' }
  | { type: 'STOP_FLICKER' }

  // Differences
  | { type: 'COMPUTE_DIFFERENCES' }
  | { type: 'DIFFERENCES_COMPUTED'; differences: DifferenceHighlight[] }
  | { type: 'TOGGLE_DIFFERENCES' }
  | { type: 'CLEAR_DIFFERENCES' }

  // Pane interaction
  | { type: 'SET_ACTIVE_PANE'; pane: PaneId }
  | { type: 'SET_PANE_LOADING'; pane: PaneId; loading: boolean }
  | { type: 'SET_PANE_ENTITY_COUNT'; pane: PaneId; count: number }

  // Animation
  | { type: 'ANIMATION_COMPLETE' }

export type SplitCompareEmittedEvent =
  | { type: 'onModeChange'; mode: CompareMode }
  | { type: 'onTimeChange'; pane: PaneId; timePoint: TimePoint }
  | { type: 'onViewportChange'; pane: PaneId; viewport: ViewportSync }
  | { type: 'onSwipeChange'; position: number }
  | { type: 'onDifferencesComputed'; differences: DifferenceHighlight[] }

export interface SplitCompareInput {
  initialMode?: CompareMode
  initialLeftTime?: TimePoint
  initialRightTime?: TimePoint
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const COMPARE_MODES: CompareMode[] = ['side-by-side', 'swipe', 'overlay', 'flicker']

export const FLICKER_SPEEDS = [500, 1000, 2000, 3000]

const DEFAULT_VIEWPORT: ViewportSync = {
  center: [0, 0],
  zoom: 10,
  bearing: 0,
  pitch: 0,
}

// =============================================================================
// HELPERS
// =============================================================================

function createPaneState(id: PaneId, timePoint: TimePoint): PaneState {
  return {
    id,
    timePoint,
    viewport: DEFAULT_VIEWPORT,
    entityCount: 0,
    isLoading: false,
  }
}

// =============================================================================
// MACHINE
// =============================================================================

export const splitCompareMachine = setup({
  types: {
    context: {} as SplitCompareContext,
    events: {} as SplitCompareEvent,
    emitted: {} as SplitCompareEmittedEvent,
    input: {} as SplitCompareInput,
  },
  delays: {
    flickerTick: ({ context }) => context.flickerSpeed,
  },
  actions: {
    // Mode
    setMode: assign(({ event }) => {
      if (event.type !== 'SET_MODE') return {}
      return { mode: event.mode, animationPhase: 'transitioning' as const }
    }),

    // Time points
    setLeftTime: assign(({ context, event }) => {
      if (event.type !== 'SET_LEFT_TIME') return {}
      return {
        leftPane: { ...context.leftPane, timePoint: event.timePoint },
      }
    }),

    setRightTime: assign(({ context, event }) => {
      if (event.type !== 'SET_RIGHT_TIME') return {}
      return {
        rightPane: { ...context.rightPane, timePoint: event.timePoint },
      }
    }),

    swapTimePoints: assign(({ context }) => ({
      leftPane: { ...context.leftPane, timePoint: context.rightPane.timePoint },
      rightPane: { ...context.rightPane, timePoint: context.leftPane.timePoint },
      animationPhase: 'transitioning' as const,
    })),

    setAvailableTimePoints: assign(({ event }) => {
      if (event.type !== 'SET_AVAILABLE_TIME_POINTS') return {}
      return { availableTimePoints: event.timePoints }
    }),

    // Viewport sync
    setSyncMode: assign(({ event }) => {
      if (event.type !== 'SET_SYNC_MODE') return {}
      return { syncMode: event.mode }
    }),

    syncToLeft: assign(({ context }) => ({
      rightPane: { ...context.rightPane, viewport: context.leftPane.viewport },
    })),

    syncToRight: assign(({ context }) => ({
      leftPane: { ...context.leftPane, viewport: context.rightPane.viewport },
    })),

    updateViewport: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_VIEWPORT') return {}
      const { pane, viewport } = event

      if (pane === 'left') {
        const newState: Partial<SplitCompareContext> = {
          leftPane: { ...context.leftPane, viewport },
        }
        // Sync right pane if locked
        if (context.syncMode === 'locked') {
          newState.rightPane = { ...context.rightPane, viewport }
        }
        return newState
      } else {
        const newState: Partial<SplitCompareContext> = {
          rightPane: { ...context.rightPane, viewport },
        }
        // Sync left pane if locked
        if (context.syncMode === 'locked') {
          newState.leftPane = { ...context.leftPane, viewport }
        }
        return newState
      }
    }),

    // Swipe
    setSwipePosition: assign(({ event }) => {
      if (event.type !== 'SET_SWIPE_POSITION') return {}
      return {
        swipePosition: Math.max(0, Math.min(1, event.position)),
        animationPhase: 'swiping' as const,
      }
    }),

    swipeLeft: assign({ swipePosition: 0.25 }),

    swipeRight: assign({ swipePosition: 0.75 }),

    swipeCenter: assign({ swipePosition: 0.5 }),

    // Overlay
    setOverlayOpacity: assign(({ event }) => {
      if (event.type !== 'SET_OVERLAY_OPACITY') return {}
      return { overlayOpacity: Math.max(0, Math.min(1, event.opacity)) }
    }),

    // Flicker
    setFlickerSpeed: assign(({ event }) => {
      if (event.type !== 'SET_FLICKER_SPEED') return {}
      return { flickerSpeed: event.speed }
    }),

    toggleFlickerPane: assign(({ context }) => ({
      flickerPane: context.flickerPane === 'left' ? ('right' as PaneId) : ('left' as PaneId),
    })),

    startFlickering: assign({ animationPhase: 'flickering' as const }),

    stopFlickering: assign({ animationPhase: 'idle' as const }),

    // Differences
    startComputingDifferences: assign({ isComputingDifferences: true }),

    setDifferences: assign(({ event }) => {
      if (event.type !== 'DIFFERENCES_COMPUTED') return {}
      return { differences: event.differences, isComputingDifferences: false }
    }),

    toggleDifferences: assign(({ context }) => ({
      showDifferences: !context.showDifferences,
    })),

    clearDifferences: assign({ differences: [], showDifferences: false }),

    // Pane state
    setActivePane: assign(({ event }) => {
      if (event.type !== 'SET_ACTIVE_PANE') return {}
      return { activePane: event.pane }
    }),

    setPaneLoading: assign(({ context, event }) => {
      if (event.type !== 'SET_PANE_LOADING') return {}
      const paneKey = event.pane === 'left' ? 'leftPane' : 'rightPane'
      return {
        [paneKey]: { ...context[paneKey], isLoading: event.loading },
      }
    }),

    setPaneEntityCount: assign(({ context, event }) => {
      if (event.type !== 'SET_PANE_ENTITY_COUNT') return {}
      const paneKey = event.pane === 'left' ? 'leftPane' : 'rightPane'
      return {
        [paneKey]: { ...context[paneKey], entityCount: event.count },
      }
    }),

    // Animation
    finishAnimation: assign({ animationPhase: 'idle' as const }),

    // Emit events
    emitModeChange: emit(({ context }) => ({
      type: 'onModeChange' as const,
      mode: context.mode,
    })),

    emitLeftTimeChange: emit(({ context }) => ({
      type: 'onTimeChange' as const,
      pane: 'left' as PaneId,
      timePoint: context.leftPane.timePoint,
    })),

    emitRightTimeChange: emit(({ context }) => ({
      type: 'onTimeChange' as const,
      pane: 'right' as PaneId,
      timePoint: context.rightPane.timePoint,
    })),

    emitSwipeChange: emit(({ context }) => ({
      type: 'onSwipeChange' as const,
      position: context.swipePosition,
    })),

    emitDifferencesComputed: emit(({ context }) => ({
      type: 'onDifferencesComputed' as const,
      differences: context.differences,
    })),
  },
}).createMachine({
  id: 'splitCompare',
  initial: 'idle',
  context: ({ input }) => {
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    return {
      mode: input.initialMode ?? 'side-by-side',
      leftPane: createPaneState('left', input.initialLeftTime ?? { timestamp: hourAgo, label: '1 hour ago' }),
      rightPane: createPaneState('right', input.initialRightTime ?? { timestamp: now, label: 'Now' }),
      syncMode: 'locked',
      swipePosition: 0.5,
      overlayOpacity: 0.5,
      flickerSpeed: 1000,
      flickerPane: 'left',
      differences: [],
      showDifferences: false,
      activePane: 'left',
      animationPhase: 'idle',
      availableTimePoints: [],
      isComputingDifferences: false,
    }
  },
  states: {
    idle: {
      on: {
        // Mode
        SET_MODE: { actions: ['setMode', 'emitModeChange'] },

        // Time points
        SET_LEFT_TIME: { actions: ['setLeftTime', 'emitLeftTimeChange'] },
        SET_RIGHT_TIME: { actions: ['setRightTime', 'emitRightTimeChange'] },
        SWAP_TIME_POINTS: { actions: ['swapTimePoints'] },
        SET_AVAILABLE_TIME_POINTS: { actions: ['setAvailableTimePoints'] },

        // Viewport sync
        SET_SYNC_MODE: { actions: ['setSyncMode'] },
        SYNC_TO_LEFT: { actions: ['syncToLeft'] },
        SYNC_TO_RIGHT: { actions: ['syncToRight'] },
        UPDATE_VIEWPORT: { actions: ['updateViewport'] },

        // Swipe mode
        SET_SWIPE_POSITION: { actions: ['setSwipePosition', 'emitSwipeChange'] },
        SWIPE_LEFT: { actions: ['swipeLeft', 'emitSwipeChange'] },
        SWIPE_RIGHT: { actions: ['swipeRight', 'emitSwipeChange'] },
        SWIPE_CENTER: { actions: ['swipeCenter', 'emitSwipeChange'] },

        // Overlay mode
        SET_OVERLAY_OPACITY: { actions: ['setOverlayOpacity'] },

        // Flicker mode
        SET_FLICKER_SPEED: { actions: ['setFlickerSpeed'] },
        START_FLICKER: { target: 'flickering', actions: ['startFlickering'] },

        // Differences
        COMPUTE_DIFFERENCES: { target: 'computingDifferences', actions: ['startComputingDifferences'] },
        TOGGLE_DIFFERENCES: { actions: ['toggleDifferences'] },
        CLEAR_DIFFERENCES: { actions: ['clearDifferences'] },

        // Pane state
        SET_ACTIVE_PANE: { actions: ['setActivePane'] },
        SET_PANE_LOADING: { actions: ['setPaneLoading'] },
        SET_PANE_ENTITY_COUNT: { actions: ['setPaneEntityCount'] },

        // Animation
        ANIMATION_COMPLETE: { actions: ['finishAnimation'] },
      },
    },
    flickering: {
      after: {
        flickerTick: {
          target: 'flickering',
          actions: ['toggleFlickerPane'],
          reenter: true,
        },
      },
      on: {
        STOP_FLICKER: { target: 'idle', actions: ['stopFlickering'] },
        SET_FLICKER_SPEED: { actions: ['setFlickerSpeed'] },
        SET_MODE: { target: 'idle', actions: ['setMode', 'stopFlickering', 'emitModeChange'] },
      },
    },
    computingDifferences: {
      on: {
        DIFFERENCES_COMPUTED: {
          target: 'idle',
          actions: ['setDifferences', 'emitDifferencesComputed'],
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type SplitCompareMachine = typeof splitCompareMachine
export type SplitCompareSnapshot = ReturnType<typeof splitCompareMachine.getInitialSnapshot>

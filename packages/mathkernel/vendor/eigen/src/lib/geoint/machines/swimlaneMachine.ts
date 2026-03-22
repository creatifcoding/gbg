/**
 * Swimlane Timeline XState Machine
 *
 * State machine for swimlane timeline orchestration:
 * - Lane visibility and ordering
 * - Playback controls
 * - Selection and hover states
 * - Zoom and pan
 * - Event focusing
 *
 * @module geoint/machines/swimlaneMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type PlaybackState = 'stopped' | 'playing' | 'paused'

export type ZoomLevel = '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | 'custom'

export interface TimeRange {
  start: Date
  end: Date
}

export interface SwimlaneLane {
  id: string
  entityId: string
  label: string
  color: string
  visible: boolean
  collapsed: boolean
  order: number
}

export interface SwimlaneEvent {
  id: string
  laneId: string
  timestamp: Date
  type: 'start' | 'end' | 'waypoint' | 'anomaly' | 'update'
  label?: string
  data?: Record<string, unknown>
}

export interface SwimlaneContext {
  /** All lanes */
  lanes: SwimlaneLane[]
  /** All events */
  events: SwimlaneEvent[]
  /** Visible time range */
  timeRange: TimeRange
  /** Current playhead position */
  playhead: Date
  /** Playback state */
  playbackState: PlaybackState
  /** Playback speed multiplier */
  playbackSpeed: number
  /** Zoom level */
  zoomLevel: ZoomLevel
  /** Selected lane ID */
  selectedLaneId: string | null
  /** Hovered lane ID */
  hoveredLaneId: string | null
  /** Selected event ID */
  selectedEventId: string | null
  /** Hovered event ID */
  hoveredEventId: string | null
  /** Follow mode (playhead follows selected entity) */
  followMode: boolean
  /** Animation phase */
  animationPhase: 'idle' | 'zooming' | 'panning' | 'seeking'
}

export type SwimlaneEvent_Machine =
  // Lane management
  | { type: 'ADD_LANE'; lane: SwimlaneLane }
  | { type: 'REMOVE_LANE'; laneId: string }
  | { type: 'TOGGLE_LANE'; laneId: string }
  | { type: 'COLLAPSE_LANE'; laneId: string }
  | { type: 'EXPAND_LANE'; laneId: string }
  | { type: 'REORDER_LANES'; laneIds: string[] }
  | { type: 'SET_LANES'; lanes: SwimlaneLane[] }

  // Event management
  | { type: 'ADD_EVENTS'; events: SwimlaneEvent[] }
  | { type: 'CLEAR_EVENTS' }
  | { type: 'SET_EVENTS'; events: SwimlaneEvent[] }

  // Playback
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'SEEK'; timestamp: Date }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'TICK' }

  // Time range
  | { type: 'SET_TIME_RANGE'; range: TimeRange }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'SET_ZOOM'; level: ZoomLevel }
  | { type: 'PAN_LEFT' }
  | { type: 'PAN_RIGHT' }
  | { type: 'FIT_TO_DATA' }

  // Selection
  | { type: 'SELECT_LANE'; laneId: string }
  | { type: 'DESELECT_LANE' }
  | { type: 'HOVER_LANE'; laneId: string }
  | { type: 'UNHOVER_LANE' }
  | { type: 'SELECT_EVENT'; eventId: string }
  | { type: 'DESELECT_EVENT' }
  | { type: 'HOVER_EVENT'; eventId: string }
  | { type: 'UNHOVER_EVENT' }

  // Follow mode
  | { type: 'TOGGLE_FOLLOW' }

  // Animation
  | { type: 'ANIMATION_COMPLETE' }

export type SwimlaneEmittedEvent =
  | { type: 'onLaneSelect'; laneId: string | null }
  | { type: 'onEventSelect'; eventId: string | null; event: SwimlaneEvent | null }
  | { type: 'onPlayheadChange'; playhead: Date }
  | { type: 'onTimeRangeChange'; range: TimeRange }
  | { type: 'onPlaybackStateChange'; state: PlaybackState }

export interface SwimlaneInput {
  initialTimeRange?: TimeRange
  initialSpeed?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ZOOM_LEVELS: ZoomLevel[] = ['1h', '6h', '12h', '24h', '7d', '30d']

const ZOOM_DURATIONS: Record<ZoomLevel, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  custom: 0,
}

const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8, 16]

const STEP_DURATION = 60 * 1000 // 1 minute

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultTimeRange(): TimeRange {
  const now = new Date()
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return { start, end: now }
}

function zoomTimeRange(range: TimeRange, factor: number): TimeRange {
  const center = (range.start.getTime() + range.end.getTime()) / 2
  const halfDuration = (range.end.getTime() - range.start.getTime()) / 2 / factor
  return {
    start: new Date(center - halfDuration),
    end: new Date(center + halfDuration),
  }
}

function panTimeRange(range: TimeRange, direction: 'left' | 'right'): TimeRange {
  const duration = range.end.getTime() - range.start.getTime()
  const panAmount = duration * 0.25 * (direction === 'left' ? -1 : 1)
  return {
    start: new Date(range.start.getTime() + panAmount),
    end: new Date(range.end.getTime() + panAmount),
  }
}

function getZoomLevelFromDuration(duration: number): ZoomLevel {
  for (const level of ZOOM_LEVELS) {
    if (duration <= ZOOM_DURATIONS[level] * 1.5) {
      return level
    }
  }
  return 'custom'
}

// =============================================================================
// MACHINE
// =============================================================================

export const swimlaneMachine = setup({
  types: {
    context: {} as SwimlaneContext,
    events: {} as SwimlaneEvent_Machine,
    emitted: {} as SwimlaneEmittedEvent,
    input: {} as SwimlaneInput,
  },
  delays: {
    playbackTick: ({ context }) => 1000 / context.playbackSpeed,
  },
  actions: {
    // Lane management
    addLane: assign(({ context, event }) => {
      if (event.type !== 'ADD_LANE') return {}
      return {
        lanes: [...context.lanes, { ...event.lane, order: context.lanes.length }],
      }
    }),

    removeLane: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_LANE') return {}
      return {
        lanes: context.lanes.filter((l) => l.id !== event.laneId),
        selectedLaneId: context.selectedLaneId === event.laneId ? null : context.selectedLaneId,
      }
    }),

    toggleLane: assign(({ context, event }) => {
      if (event.type !== 'TOGGLE_LANE') return {}
      return {
        lanes: context.lanes.map((l) =>
          l.id === event.laneId ? { ...l, visible: !l.visible } : l
        ),
      }
    }),

    collapseLane: assign(({ context, event }) => {
      if (event.type !== 'COLLAPSE_LANE') return {}
      return {
        lanes: context.lanes.map((l) =>
          l.id === event.laneId ? { ...l, collapsed: true } : l
        ),
      }
    }),

    expandLane: assign(({ context, event }) => {
      if (event.type !== 'EXPAND_LANE') return {}
      return {
        lanes: context.lanes.map((l) =>
          l.id === event.laneId ? { ...l, collapsed: false } : l
        ),
      }
    }),

    reorderLanes: assign(({ context, event }) => {
      if (event.type !== 'REORDER_LANES') return {}
      const orderMap = new Map(event.laneIds.map((id, i) => [id, i]))
      return {
        lanes: context.lanes
          .map((l) => ({ ...l, order: orderMap.get(l.id) ?? l.order }))
          .sort((a, b) => a.order - b.order),
      }
    }),

    setLanes: assign(({ event }) => {
      if (event.type !== 'SET_LANES') return {}
      return { lanes: event.lanes }
    }),

    // Event management
    addEvents: assign(({ context, event }) => {
      if (event.type !== 'ADD_EVENTS') return {}
      return { events: [...context.events, ...event.events] }
    }),

    clearEvents: assign({ events: [] }),

    setEvents: assign(({ event }) => {
      if (event.type !== 'SET_EVENTS') return {}
      return { events: event.events }
    }),

    // Playback
    setPlaying: assign({ playbackState: 'playing' as const }),
    setPaused: assign({ playbackState: 'paused' as const }),
    setStopped: assign({ playbackState: 'stopped' as const }),

    seek: assign(({ event }) => {
      if (event.type !== 'SEEK') return {}
      return { playhead: event.timestamp }
    }),

    setSpeed: assign(({ event }) => {
      if (event.type !== 'SET_SPEED') return {}
      const speed = PLAYBACK_SPEEDS.includes(event.speed) ? event.speed : 1
      return { playbackSpeed: speed }
    }),

    stepForward: assign(({ context }) => ({
      playhead: new Date(context.playhead.getTime() + STEP_DURATION),
    })),

    stepBackward: assign(({ context }) => ({
      playhead: new Date(context.playhead.getTime() - STEP_DURATION),
    })),

    tick: assign(({ context }) => {
      const newTime = context.playhead.getTime() + (1000 * context.playbackSpeed)
      const clamped = Math.min(newTime, context.timeRange.end.getTime())
      return { playhead: new Date(clamped) }
    }),

    // Time range
    setTimeRange: assign(({ event }) => {
      if (event.type !== 'SET_TIME_RANGE') return {}
      const duration = event.range.end.getTime() - event.range.start.getTime()
      return {
        timeRange: event.range,
        zoomLevel: getZoomLevelFromDuration(duration),
      }
    }),

    zoomIn: assign(({ context }) => {
      const newRange = zoomTimeRange(context.timeRange, 2)
      const duration = newRange.end.getTime() - newRange.start.getTime()
      return {
        timeRange: newRange,
        zoomLevel: getZoomLevelFromDuration(duration),
        animationPhase: 'zooming' as const,
      }
    }),

    zoomOut: assign(({ context }) => {
      const newRange = zoomTimeRange(context.timeRange, 0.5)
      const duration = newRange.end.getTime() - newRange.start.getTime()
      return {
        timeRange: newRange,
        zoomLevel: getZoomLevelFromDuration(duration),
        animationPhase: 'zooming' as const,
      }
    }),

    setZoom: assign(({ context, event }) => {
      if (event.type !== 'SET_ZOOM') return {}
      const center = (context.timeRange.start.getTime() + context.timeRange.end.getTime()) / 2
      const halfDuration = ZOOM_DURATIONS[event.level] / 2
      return {
        timeRange: {
          start: new Date(center - halfDuration),
          end: new Date(center + halfDuration),
        },
        zoomLevel: event.level,
        animationPhase: 'zooming' as const,
      }
    }),

    panLeft: assign(({ context }) => ({
      timeRange: panTimeRange(context.timeRange, 'left'),
      animationPhase: 'panning' as const,
    })),

    panRight: assign(({ context }) => ({
      timeRange: panTimeRange(context.timeRange, 'right'),
      animationPhase: 'panning' as const,
    })),

    fitToData: assign(({ context }) => {
      if (context.events.length === 0) return {}
      const timestamps = context.events.map((e) => e.timestamp.getTime())
      const min = Math.min(...timestamps)
      const max = Math.max(...timestamps)
      const padding = (max - min) * 0.1 || 60 * 60 * 1000
      const newRange = {
        start: new Date(min - padding),
        end: new Date(max + padding),
      }
      const duration = newRange.end.getTime() - newRange.start.getTime()
      return {
        timeRange: newRange,
        zoomLevel: getZoomLevelFromDuration(duration),
      }
    }),

    // Selection
    selectLane: assign(({ event }) => {
      if (event.type !== 'SELECT_LANE') return {}
      return { selectedLaneId: event.laneId }
    }),

    deselectLane: assign({ selectedLaneId: null }),

    hoverLane: assign(({ event }) => {
      if (event.type !== 'HOVER_LANE') return {}
      return { hoveredLaneId: event.laneId }
    }),

    unhoverLane: assign({ hoveredLaneId: null }),

    selectEvent: assign(({ event }) => {
      if (event.type !== 'SELECT_EVENT') return {}
      return { selectedEventId: event.eventId }
    }),

    deselectEvent: assign({ selectedEventId: null }),

    hoverEvent: assign(({ event }) => {
      if (event.type !== 'HOVER_EVENT') return {}
      return { hoveredEventId: event.eventId }
    }),

    unhoverEvent: assign({ hoveredEventId: null }),

    // Follow mode
    toggleFollow: assign(({ context }) => ({ followMode: !context.followMode })),

    // Animation
    clearAnimationPhase: assign({ animationPhase: 'idle' as const }),

    // Emitters
    emitLaneSelect: emit(({ context }) => ({
      type: 'onLaneSelect' as const,
      laneId: context.selectedLaneId,
    })),

    emitEventSelect: emit(({ context }) => {
      const event = context.events.find((e) => e.id === context.selectedEventId) ?? null
      return {
        type: 'onEventSelect' as const,
        eventId: context.selectedEventId,
        event,
      }
    }),

    emitPlayheadChange: emit(({ context }) => ({
      type: 'onPlayheadChange' as const,
      playhead: context.playhead,
    })),

    emitTimeRangeChange: emit(({ context }) => ({
      type: 'onTimeRangeChange' as const,
      range: context.timeRange,
    })),

    emitPlaybackStateChange: emit(({ context }) => ({
      type: 'onPlaybackStateChange' as const,
      state: context.playbackState,
    })),
  },
  guards: {
    isPlaying: ({ context }) => context.playbackState === 'playing',
    isPaused: ({ context }) => context.playbackState === 'paused',
    isStopped: ({ context }) => context.playbackState === 'stopped',
    hasReachedEnd: ({ context }) => context.playhead >= context.timeRange.end,
    hasEvents: ({ context }) => context.events.length > 0,
  },
}).createMachine({
  id: 'swimlane',
  initial: 'idle',
  context: ({ input }) => ({
    lanes: [],
    events: [],
    timeRange: input?.initialTimeRange ?? getDefaultTimeRange(),
    playhead: input?.initialTimeRange?.start ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    playbackState: 'stopped',
    playbackSpeed: input?.initialSpeed ?? 1,
    zoomLevel: '24h',
    selectedLaneId: null,
    hoveredLaneId: null,
    selectedEventId: null,
    hoveredEventId: null,
    followMode: false,
    animationPhase: 'idle',
  }),
  states: {
    idle: {
      on: {
        PLAY: {
          target: 'playing',
          actions: ['setPlaying', 'emitPlaybackStateChange'],
        },
      },
    },
    playing: {
      after: {
        playbackTick: [
          {
            guard: 'hasReachedEnd',
            target: 'idle',
            actions: ['setStopped', 'emitPlaybackStateChange'],
          },
          {
            target: 'playing',
            actions: ['tick', 'emitPlayheadChange'],
            reenter: true,
          },
        ],
      },
      on: {
        PAUSE: {
          target: 'paused',
          actions: ['setPaused', 'emitPlaybackStateChange'],
        },
        STOP: {
          target: 'idle',
          actions: ['setStopped', 'emitPlaybackStateChange'],
        },
      },
    },
    paused: {
      on: {
        PLAY: {
          target: 'playing',
          actions: ['setPlaying', 'emitPlaybackStateChange'],
        },
        STOP: {
          target: 'idle',
          actions: ['setStopped', 'emitPlaybackStateChange'],
        },
      },
    },
  },
  on: {
    // Lane management (global)
    ADD_LANE: { actions: 'addLane' },
    REMOVE_LANE: { actions: 'removeLane' },
    TOGGLE_LANE: { actions: 'toggleLane' },
    COLLAPSE_LANE: { actions: 'collapseLane' },
    EXPAND_LANE: { actions: 'expandLane' },
    REORDER_LANES: { actions: 'reorderLanes' },
    SET_LANES: { actions: 'setLanes' },

    // Event management
    ADD_EVENTS: { actions: 'addEvents' },
    CLEAR_EVENTS: { actions: 'clearEvents' },
    SET_EVENTS: { actions: 'setEvents' },

    // Seeking
    SEEK: { actions: ['seek', 'emitPlayheadChange'] },
    STEP_FORWARD: { actions: ['stepForward', 'emitPlayheadChange'] },
    STEP_BACKWARD: { actions: ['stepBackward', 'emitPlayheadChange'] },
    SET_SPEED: { actions: 'setSpeed' },

    // Time range
    SET_TIME_RANGE: { actions: ['setTimeRange', 'emitTimeRangeChange'] },
    ZOOM_IN: { actions: ['zoomIn', 'emitTimeRangeChange'] },
    ZOOM_OUT: { actions: ['zoomOut', 'emitTimeRangeChange'] },
    SET_ZOOM: { actions: ['setZoom', 'emitTimeRangeChange'] },
    PAN_LEFT: { actions: ['panLeft', 'emitTimeRangeChange'] },
    PAN_RIGHT: { actions: ['panRight', 'emitTimeRangeChange'] },
    FIT_TO_DATA: { actions: ['fitToData', 'emitTimeRangeChange'] },

    // Selection
    SELECT_LANE: { actions: ['selectLane', 'emitLaneSelect'] },
    DESELECT_LANE: { actions: ['deselectLane', 'emitLaneSelect'] },
    HOVER_LANE: { actions: 'hoverLane' },
    UNHOVER_LANE: { actions: 'unhoverLane' },
    SELECT_EVENT: { actions: ['selectEvent', 'emitEventSelect'] },
    DESELECT_EVENT: { actions: ['deselectEvent', 'emitEventSelect'] },
    HOVER_EVENT: { actions: 'hoverEvent' },
    UNHOVER_EVENT: { actions: 'unhoverEvent' },

    // Follow mode
    TOGGLE_FOLLOW: { actions: 'toggleFollow' },

    // Animation
    ANIMATION_COMPLETE: { actions: 'clearAnimationPhase' },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type SwimlaneMachine = typeof swimlaneMachine
export type SwimlaneSnapshot = ReturnType<typeof swimlaneMachine.getInitialSnapshot>
export { ZOOM_LEVELS, ZOOM_DURATIONS, PLAYBACK_SPEEDS }

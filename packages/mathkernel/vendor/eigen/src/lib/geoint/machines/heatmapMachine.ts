/**
 * Heatmap XState Machine
 *
 * State machine for temporal heatmap analysis:
 * - Activity density visualization
 * - Temporal resolution control
 * - Hotspot detection
 * - Pattern analysis
 * - Anomaly highlighting
 *
 * @module geoint/machines/heatmapMachine
 */

import { setup, assign, emit } from 'xstate'

// =============================================================================
// TYPES
// =============================================================================

export type TemporalResolution = '1min' | '5min' | '15min' | '1hour' | '6hour' | '1day'

export type ColorScheme = 'thermal' | 'viridis' | 'plasma' | 'inferno' | 'magma' | 'cividis'

export type AnalysisMode = 'density' | 'velocity' | 'clustering' | 'anomaly'

export type HotspotSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface HeatmapCell {
  x: number
  y: number
  value: number
  normalizedValue: number // 0-1
  entityCount: number
  timestamp: Date
  isHotspot: boolean
  isAnomaly: boolean
}

export interface Hotspot {
  id: string
  center: [number, number]
  radius: number
  severity: HotspotSeverity
  peakValue: number
  entityCount: number
  startTime: Date
  endTime?: Date
  isActive: boolean
}

export interface TemporalPattern {
  id: string
  name: string
  type: 'recurring' | 'trend' | 'spike' | 'decline'
  confidence: number
  startTime: Date
  endTime: Date
  affectedCells: Array<{ x: number; y: number }>
  description: string
}

export interface HeatmapBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

export interface TimeRange {
  start: Date
  end: Date
}

export interface HeatmapContext {
  /** Current heatmap data grid */
  cells: HeatmapCell[][]
  /** Grid dimensions */
  gridWidth: number
  gridHeight: number
  /** Geographic bounds */
  bounds: HeatmapBounds
  /** Time range for analysis */
  timeRange: TimeRange
  /** Current temporal position (playhead) */
  currentTime: Date
  /** Temporal resolution */
  resolution: TemporalResolution
  /** Analysis mode */
  analysisMode: AnalysisMode
  /** Color scheme */
  colorScheme: ColorScheme
  /** Opacity (0-1) */
  opacity: number
  /** Detected hotspots */
  hotspots: Hotspot[]
  /** Detected patterns */
  patterns: TemporalPattern[]
  /** Selected hotspot */
  selectedHotspotId: string | null
  /** Selected pattern */
  selectedPatternId: string | null
  /** Is playing temporal animation */
  isPlaying: boolean
  /** Playback speed multiplier */
  playbackSpeed: number
  /** Show hotspot markers */
  showHotspots: boolean
  /** Show anomaly highlights */
  showAnomalies: boolean
  /** Show pattern overlays */
  showPatterns: boolean
  /** Hotspot threshold (0-1) */
  hotspotThreshold: number
  /** Anomaly threshold (standard deviations) */
  anomalyThreshold: number
  /** Is computing heatmap */
  isComputing: boolean
  /** Computation progress (0-100) */
  computeProgress: number
  /** Value range for current data */
  valueRange: { min: number; max: number }
  /** Active cell for hover/details */
  activeCellPosition: { x: number; y: number } | null
}

export type HeatmapEvent =
  // Time control
  | { type: 'SET_TIME_RANGE'; range: TimeRange }
  | { type: 'SET_CURRENT_TIME'; time: Date }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_PLAYBACK_SPEED'; speed: number }
  | { type: 'TICK' }

  // Resolution and mode
  | { type: 'SET_RESOLUTION'; resolution: TemporalResolution }
  | { type: 'SET_ANALYSIS_MODE'; mode: AnalysisMode }

  // Visual settings
  | { type: 'SET_COLOR_SCHEME'; scheme: ColorScheme }
  | { type: 'SET_OPACITY'; opacity: number }
  | { type: 'TOGGLE_HOTSPOTS' }
  | { type: 'TOGGLE_ANOMALIES' }
  | { type: 'TOGGLE_PATTERNS' }

  // Thresholds
  | { type: 'SET_HOTSPOT_THRESHOLD'; threshold: number }
  | { type: 'SET_ANOMALY_THRESHOLD'; threshold: number }

  // Computation
  | { type: 'COMPUTE_HEATMAP' }
  | { type: 'COMPUTE_PROGRESS'; progress: number }
  | { type: 'HEATMAP_COMPUTED'; cells: HeatmapCell[][]; valueRange: { min: number; max: number } }
  | { type: 'DETECT_HOTSPOTS' }
  | { type: 'HOTSPOTS_DETECTED'; hotspots: Hotspot[] }
  | { type: 'ANALYZE_PATTERNS' }
  | { type: 'PATTERNS_ANALYZED'; patterns: TemporalPattern[] }

  // Selection
  | { type: 'SELECT_HOTSPOT'; id: string | null }
  | { type: 'SELECT_PATTERN'; id: string | null }
  | { type: 'SET_ACTIVE_CELL'; position: { x: number; y: number } | null }

  // Bounds
  | { type: 'SET_BOUNDS'; bounds: HeatmapBounds }
  | { type: 'SET_GRID_SIZE'; width: number; height: number }

export type HeatmapEmittedEvent =
  | { type: 'onHeatmapComputed'; cellCount: number }
  | { type: 'onHotspotsDetected'; count: number }
  | { type: 'onPatternsAnalyzed'; count: number }
  | { type: 'onHotspotSelected'; hotspot: Hotspot | null }
  | { type: 'onTimeChanged'; time: Date }

export interface HeatmapInput {
  initialBounds?: HeatmapBounds
  initialTimeRange?: TimeRange
  initialResolution?: TemporalResolution
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const RESOLUTION_DURATIONS: Record<TemporalResolution, number> = {
  '1min': 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '1hour': 60 * 60 * 1000,
  '6hour': 6 * 60 * 60 * 1000,
  '1day': 24 * 60 * 60 * 1000,
}

export const COLOR_SCHEMES: Record<ColorScheme, string[]> = {
  thermal: ['#000033', '#0000ff', '#00ffff', '#ffff00', '#ff0000', '#ffffff'],
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  plasma: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'],
  inferno: ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'],
  magma: ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'],
  cividis: ['#00204d', '#355f8d', '#7d8c8e', '#d1c74c', '#ffe945'],
}

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10]

// =============================================================================
// HELPERS
// =============================================================================

function getResolutionStep(resolution: TemporalResolution): number {
  return RESOLUTION_DURATIONS[resolution]
}

// =============================================================================
// MACHINE
// =============================================================================

export const heatmapMachine = setup({
  types: {
    context: {} as HeatmapContext,
    events: {} as HeatmapEvent,
    emitted: {} as HeatmapEmittedEvent,
    input: {} as HeatmapInput,
  },
  delays: {
    playbackTick: ({ context }) => {
      const baseInterval = getResolutionStep(context.resolution)
      return Math.max(100, baseInterval / (context.playbackSpeed * 1000))
    },
  },
  actions: {
    // Time control
    setTimeRange: assign(({ event }) => {
      if (event.type !== 'SET_TIME_RANGE') return {}
      return {
        timeRange: event.range,
        currentTime: event.range.start
      }
    }),

    setCurrentTime: assign(({ event }) => {
      if (event.type !== 'SET_CURRENT_TIME') return {}
      return { currentTime: event.time }
    }),

    stepForward: assign(({ context }) => {
      const step = getResolutionStep(context.resolution)
      const newTime = new Date(context.currentTime.getTime() + step)
      if (newTime > context.timeRange.end) {
        return { currentTime: context.timeRange.start }
      }
      return { currentTime: newTime }
    }),

    stepBackward: assign(({ context }) => {
      const step = getResolutionStep(context.resolution)
      const newTime = new Date(context.currentTime.getTime() - step)
      if (newTime < context.timeRange.start) {
        return { currentTime: context.timeRange.end }
      }
      return { currentTime: newTime }
    }),

    setPlaybackSpeed: assign(({ event }) => {
      if (event.type !== 'SET_PLAYBACK_SPEED') return {}
      return { playbackSpeed: event.speed }
    }),

    startPlaying: assign({ isPlaying: true }),

    stopPlaying: assign({ isPlaying: false }),

    // Resolution and mode
    setResolution: assign(({ event }) => {
      if (event.type !== 'SET_RESOLUTION') return {}
      return { resolution: event.resolution }
    }),

    setAnalysisMode: assign(({ event }) => {
      if (event.type !== 'SET_ANALYSIS_MODE') return {}
      return { analysisMode: event.mode }
    }),

    // Visual settings
    setColorScheme: assign(({ event }) => {
      if (event.type !== 'SET_COLOR_SCHEME') return {}
      return { colorScheme: event.scheme }
    }),

    setOpacity: assign(({ event }) => {
      if (event.type !== 'SET_OPACITY') return {}
      return { opacity: Math.max(0, Math.min(1, event.opacity)) }
    }),

    toggleHotspots: assign(({ context }) => ({
      showHotspots: !context.showHotspots
    })),

    toggleAnomalies: assign(({ context }) => ({
      showAnomalies: !context.showAnomalies
    })),

    togglePatterns: assign(({ context }) => ({
      showPatterns: !context.showPatterns
    })),

    // Thresholds
    setHotspotThreshold: assign(({ event }) => {
      if (event.type !== 'SET_HOTSPOT_THRESHOLD') return {}
      return { hotspotThreshold: Math.max(0, Math.min(1, event.threshold)) }
    }),

    setAnomalyThreshold: assign(({ event }) => {
      if (event.type !== 'SET_ANOMALY_THRESHOLD') return {}
      return { anomalyThreshold: Math.max(1, event.threshold) }
    }),

    // Computation
    startComputing: assign({ isComputing: true, computeProgress: 0 }),

    updateProgress: assign(({ event }) => {
      if (event.type !== 'COMPUTE_PROGRESS') return {}
      return { computeProgress: event.progress }
    }),

    setHeatmapData: assign(({ event }) => {
      if (event.type !== 'HEATMAP_COMPUTED') return {}
      return {
        cells: event.cells,
        valueRange: event.valueRange,
        isComputing: false,
        computeProgress: 100
      }
    }),

    setHotspots: assign(({ event }) => {
      if (event.type !== 'HOTSPOTS_DETECTED') return {}
      return { hotspots: event.hotspots }
    }),

    setPatterns: assign(({ event }) => {
      if (event.type !== 'PATTERNS_ANALYZED') return {}
      return { patterns: event.patterns }
    }),

    // Selection
    selectHotspot: assign(({ event }) => {
      if (event.type !== 'SELECT_HOTSPOT') return {}
      return { selectedHotspotId: event.id }
    }),

    selectPattern: assign(({ event }) => {
      if (event.type !== 'SELECT_PATTERN') return {}
      return { selectedPatternId: event.id }
    }),

    setActiveCell: assign(({ event }) => {
      if (event.type !== 'SET_ACTIVE_CELL') return {}
      return { activeCellPosition: event.position }
    }),

    // Bounds
    setBounds: assign(({ event }) => {
      if (event.type !== 'SET_BOUNDS') return {}
      return { bounds: event.bounds }
    }),

    setGridSize: assign(({ event }) => {
      if (event.type !== 'SET_GRID_SIZE') return {}
      return { gridWidth: event.width, gridHeight: event.height }
    }),

    // Emitted events
    emitHeatmapComputed: emit(({ context }) => ({
      type: 'onHeatmapComputed' as const,
      cellCount: context.cells.flat().length
    })),

    emitHotspotsDetected: emit(({ context }) => ({
      type: 'onHotspotsDetected' as const,
      count: context.hotspots.length
    })),

    emitPatternsAnalyzed: emit(({ context }) => ({
      type: 'onPatternsAnalyzed' as const,
      count: context.patterns.length
    })),

    emitTimeChanged: emit(({ context }) => ({
      type: 'onTimeChanged' as const,
      time: context.currentTime
    })),
  },
}).createMachine({
  id: 'heatmap',
  initial: 'idle',
  context: ({ input }) => {
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    return {
      cells: [],
      gridWidth: 50,
      gridHeight: 50,
      bounds: input.initialBounds ?? {
        minLng: -180,
        maxLng: 180,
        minLat: -90,
        maxLat: 90,
      },
      timeRange: input.initialTimeRange ?? {
        start: hourAgo,
        end: now,
      },
      currentTime: input.initialTimeRange?.start ?? hourAgo,
      resolution: input.initialResolution ?? '5min',
      analysisMode: 'density',
      colorScheme: 'thermal',
      opacity: 0.7,
      hotspots: [],
      patterns: [],
      selectedHotspotId: null,
      selectedPatternId: null,
      isPlaying: false,
      playbackSpeed: 1,
      showHotspots: true,
      showAnomalies: true,
      showPatterns: false,
      hotspotThreshold: 0.7,
      anomalyThreshold: 2.5,
      isComputing: false,
      computeProgress: 0,
      valueRange: { min: 0, max: 100 },
      activeCellPosition: null,
    }
  },
  states: {
    idle: {
      on: {
        // Time control
        SET_TIME_RANGE: { actions: ['setTimeRange'] },
        SET_CURRENT_TIME: { actions: ['setCurrentTime', 'emitTimeChanged'] },
        STEP_FORWARD: { actions: ['stepForward', 'emitTimeChanged'] },
        STEP_BACKWARD: { actions: ['stepBackward', 'emitTimeChanged'] },
        PLAY: { target: 'playing', actions: ['startPlaying'] },
        SET_PLAYBACK_SPEED: { actions: ['setPlaybackSpeed'] },

        // Resolution and mode
        SET_RESOLUTION: { actions: ['setResolution'] },
        SET_ANALYSIS_MODE: { actions: ['setAnalysisMode'] },

        // Visual settings
        SET_COLOR_SCHEME: { actions: ['setColorScheme'] },
        SET_OPACITY: { actions: ['setOpacity'] },
        TOGGLE_HOTSPOTS: { actions: ['toggleHotspots'] },
        TOGGLE_ANOMALIES: { actions: ['toggleAnomalies'] },
        TOGGLE_PATTERNS: { actions: ['togglePatterns'] },

        // Thresholds
        SET_HOTSPOT_THRESHOLD: { actions: ['setHotspotThreshold'] },
        SET_ANOMALY_THRESHOLD: { actions: ['setAnomalyThreshold'] },

        // Computation
        COMPUTE_HEATMAP: { target: 'computing', actions: ['startComputing'] },
        DETECT_HOTSPOTS: { target: 'detectingHotspots' },
        ANALYZE_PATTERNS: { target: 'analyzingPatterns' },

        // Selection
        SELECT_HOTSPOT: { actions: ['selectHotspot'] },
        SELECT_PATTERN: { actions: ['selectPattern'] },
        SET_ACTIVE_CELL: { actions: ['setActiveCell'] },

        // Bounds
        SET_BOUNDS: { actions: ['setBounds'] },
        SET_GRID_SIZE: { actions: ['setGridSize'] },
      },
    },
    playing: {
      after: {
        playbackTick: {
          target: 'playing',
          actions: ['stepForward', 'emitTimeChanged'],
          reenter: true,
        },
      },
      on: {
        PAUSE: { target: 'idle', actions: ['stopPlaying'] },
        SET_PLAYBACK_SPEED: { actions: ['setPlaybackSpeed'] },
        SET_CURRENT_TIME: { target: 'idle', actions: ['setCurrentTime', 'stopPlaying', 'emitTimeChanged'] },
      },
    },
    computing: {
      on: {
        COMPUTE_PROGRESS: { actions: ['updateProgress'] },
        HEATMAP_COMPUTED: {
          target: 'idle',
          actions: ['setHeatmapData', 'emitHeatmapComputed']
        },
      },
    },
    detectingHotspots: {
      on: {
        HOTSPOTS_DETECTED: {
          target: 'idle',
          actions: ['setHotspots', 'emitHotspotsDetected']
        },
      },
    },
    analyzingPatterns: {
      on: {
        PATTERNS_ANALYZED: {
          target: 'idle',
          actions: ['setPatterns', 'emitPatternsAnalyzed']
        },
      },
    },
  },
})

// =============================================================================
// EXPORTS
// =============================================================================

export type HeatmapMachine = typeof heatmapMachine
export type HeatmapSnapshot = ReturnType<typeof heatmapMachine.getInitialSnapshot>

/**
 * Temporal Heatmap Component
 *
 * Activity density visualization over time:
 * - Grid-based heatmap with configurable resolution
 * - Temporal playback controls
 * - Hotspot detection and highlighting
 * - Pattern analysis overlays
 * - Multiple color schemes
 *
 * ASCII Layout:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ ┌─ HEADER ───────────────────────────────────────────────────────────────┐ │
 * │ │ Temporal Heatmap │ Mode: Density │ Resolution: 5min │ [Compute]        │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * │ ┌─ CONTROLS ─────────────────────────────────────────────────────────────┐ │
 * │ │ [▶] ═════════○═════════════════════════════ 12:00 - 13:00 [1x] [5min] │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * │ ┌─ HEATMAP CANVAS ───────────────────────────────────────────────────────┐ │
 * │ │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │   ░░░░░░░▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │   ░░░░░▒▒▓▓▓▒▒░░░░░░░░░░░░░░░░░░░░░░░▒▒▓▓▒▒░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │   ░░░░▒▓▓██▓▓▒░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │   ░░░░▒▒▓▓▓▒▒░░░░░░░░░░░░░░░░░░░░░░░░▒▒▓▒▒░░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │   ░░░░░░▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒░░░░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │ │
 * │ │                    [Hotspot Markers: ◉]                                │ │
 * │ └────────────────────────────────────────────────────────────────────────┘ │
 * │ ┌─ LEGEND ─────────────────────────────────────┐┌─ STATS ────────────────┐ │
 * │ │ Low ░░░░▒▒▒▒▓▓▓▓████ High                   ││ Peak: 847 entities     │ │
 * │ │ 0   ──────────────────── 1000               ││ Hotspots: 3 active     │ │
 * │ └─────────────────────────────────────────────┘└─────────────────────────┘ │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * @module geoint/components/TemporalHeatmap
 */

import * as React from 'react'
import { createContext, useContext, useMemo, useCallback } from 'react'
import { useMachine } from '@xstate/react'
import { cn } from '@/lib/utils'
import {
  heatmapMachine,
  COLOR_SCHEMES,
  PLAYBACK_SPEEDS,
  RESOLUTION_DURATIONS,
  type HeatmapContext as HeatmapState,
  type HeatmapEvent,
  type TemporalResolution,
  type ColorScheme,
  type AnalysisMode,
  type HeatmapCell,
  type Hotspot,
  type TemporalPattern,
  type HeatmapInput,
} from '../machines/heatmapMachine'

// =============================================================================
// CONTEXT
// =============================================================================

interface TemporalHeatmapContextValue {
  state: HeatmapState
  send: (event: HeatmapEvent) => void
  // Computed values
  selectedHotspot: Hotspot | null
  selectedPattern: TemporalPattern | null
  activeCell: HeatmapCell | null
  currentTimeFormatted: string
  progressPercent: number
  getColorForValue: (value: number) => string
}

const TemporalHeatmapContext = createContext<TemporalHeatmapContextValue | null>(null)

function useTemporalHeatmap() {
  const context = useContext(TemporalHeatmapContext)
  if (!context) {
    throw new Error('useTemporalHeatmap must be used within TemporalHeatmap.Root')
  }
  return context
}

// =============================================================================
// HELPERS
// =============================================================================

function interpolateColor(colors: string[], t: number): string {
  const n = colors.length - 1
  const i = Math.min(Math.floor(t * n), n - 1)
  const f = (t * n) - i

  const c1 = colors[i]
  const c2 = colors[i + 1]

  // Parse hex colors
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)

  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)

  // Interpolate
  const r = Math.round(r1 + (r2 - r1) * f)
  const g = Math.round(g1 + (g2 - g1) * f)
  const b = Math.round(b1 + (b2 - b1) * f)

  return `rgb(${r}, ${g}, ${b})`
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

interface RootProps {
  children: React.ReactNode
  input?: HeatmapInput
  className?: string
}

function Root({ children, input = {}, className }: RootProps) {
  const [snapshot, send] = useMachine(heatmapMachine, { input })
  const state = snapshot.context

  const selectedHotspot = useMemo(() =>
    state.hotspots.find(h => h.id === state.selectedHotspotId) ?? null,
    [state.hotspots, state.selectedHotspotId]
  )

  const selectedPattern = useMemo(() =>
    state.patterns.find(p => p.id === state.selectedPatternId) ?? null,
    [state.patterns, state.selectedPatternId]
  )

  const activeCell = useMemo(() => {
    if (!state.activeCellPosition || state.cells.length === 0) return null
    const { x, y } = state.activeCellPosition
    return state.cells[y]?.[x] ?? null
  }, [state.activeCellPosition, state.cells])

  const currentTimeFormatted = useMemo(() =>
    state.currentTime.toLocaleTimeString(),
    [state.currentTime]
  )

  const progressPercent = useMemo(() => {
    const total = state.timeRange.end.getTime() - state.timeRange.start.getTime()
    const current = state.currentTime.getTime() - state.timeRange.start.getTime()
    return (current / total) * 100
  }, [state.timeRange, state.currentTime])

  const getColorForValue = useCallback((normalizedValue: number) => {
    const colors = COLOR_SCHEMES[state.colorScheme]
    return interpolateColor(colors, Math.max(0, Math.min(1, normalizedValue)))
  }, [state.colorScheme])

  const contextValue: TemporalHeatmapContextValue = {
    state,
    send,
    selectedHotspot,
    selectedPattern,
    activeCell,
    currentTimeFormatted,
    progressPercent,
    getColorForValue,
  }

  return (
    <TemporalHeatmapContext.Provider value={contextValue}>
      <div className={cn('flex flex-col h-full bg-surface-0', className)}>
        {children}
      </div>
    </TemporalHeatmapContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

interface HeaderProps {
  className?: string
}

function Header({ className }: HeaderProps) {
  const { state, send } = useTemporalHeatmap()

  const modeLabels: Record<AnalysisMode, string> = {
    density: 'Density',
    velocity: 'Velocity',
    clustering: 'Clustering',
    anomaly: 'Anomaly'
  }

  return (
    <header className={cn(
      'flex items-center justify-between px-4 py-3',
      'border-b border-white/10 bg-surface-1/50 backdrop-blur-sm',
      className
    )}>
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-medium text-white">Temporal Heatmap</h1>

        {/* Mode Badge */}
        <span className="px-2 py-0.5 text-xs font-medium bg-accent-cyan/20 text-accent-cyan rounded">
          {modeLabels[state.analysisMode]}
        </span>

        {/* Resolution */}
        <span className="text-xs text-white/40">
          Resolution: {state.resolution}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Progress */}
        {state.isComputing && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-cyan transition-all"
                style={{ width: `${state.computeProgress}%` }}
              />
            </div>
            <span className="text-xs text-white/40">{state.computeProgress}%</span>
          </div>
        )}

        {/* Compute button */}
        <button
          onClick={() => send({ type: 'COMPUTE_HEATMAP' })}
          disabled={state.isComputing}
          className={cn(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            state.isComputing
              ? 'bg-white/5 text-white/40 cursor-not-allowed'
              : 'bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30'
          )}
        >
          {state.isComputing ? 'Computing...' : 'Compute'}
        </button>
      </div>
    </header>
  )
}

// =============================================================================
// PLAYBACK CONTROLS COMPONENT
// =============================================================================

interface PlaybackControlsProps {
  className?: string
}

function PlaybackControls({ className }: PlaybackControlsProps) {
  const { state, send, progressPercent, currentTimeFormatted } = useTemporalHeatmap()

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value)
    const total = state.timeRange.end.getTime() - state.timeRange.start.getTime()
    const newTime = new Date(state.timeRange.start.getTime() + (total * percent / 100))
    send({ type: 'SET_CURRENT_TIME', time: newTime })
  }

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-3 border-b border-white/10 bg-surface-1/30',
      className
    )}>
      {/* Play/Pause */}
      <button
        onClick={() => send({ type: state.isPlaying ? 'PAUSE' : 'PLAY' })}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 transition-colors"
      >
        {state.isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <rect x="5" y="4" width="3" height="12" rx="1" />
            <rect x="12" y="4" width="3" height="12" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.5 4.5l10 5.5-10 5.5V4.5z" />
          </svg>
        )}
      </button>

      {/* Step controls */}
      <button
        onClick={() => send({ type: 'STEP_BACKWARD' })}
        className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4h2v12H4V4zm10 6l-6 4V6l6 4z" />
        </svg>
      </button>

      <button
        onClick={() => send({ type: 'STEP_FORWARD' })}
        className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M14 4h2v12h-2V4zM6 10l6-4v8l-6-4z" />
        </svg>
      </button>

      {/* Timeline slider */}
      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs text-white/40 font-mono w-16">
          {state.timeRange.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={progressPercent}
          onChange={handleSliderChange}
          className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-cyan"
        />
        <span className="text-xs text-white/40 font-mono w-16 text-right">
          {state.timeRange.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Current time */}
      <div className="px-3 py-1 bg-white/5 rounded text-xs font-mono text-white">
        {currentTimeFormatted}
      </div>

      {/* Speed selector */}
      <select
        value={state.playbackSpeed}
        onChange={(e) => send({ type: 'SET_PLAYBACK_SPEED', speed: parseFloat(e.target.value) })}
        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
      >
        {PLAYBACK_SPEEDS.map(speed => (
          <option key={speed} value={speed}>{speed}x</option>
        ))}
      </select>

      {/* Resolution selector */}
      <select
        value={state.resolution}
        onChange={(e) => send({ type: 'SET_RESOLUTION', resolution: e.target.value as TemporalResolution })}
        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
      >
        {Object.keys(RESOLUTION_DURATIONS).map(res => (
          <option key={res} value={res}>{res}</option>
        ))}
      </select>
    </div>
  )
}

// =============================================================================
// HEATMAP CANVAS COMPONENT
// =============================================================================

interface CanvasProps {
  className?: string
}

function Canvas({ className }: CanvasProps) {
  const { state, send, getColorForValue } = useTemporalHeatmap()

  const handleCellHover = useCallback((x: number, y: number) => {
    send({ type: 'SET_ACTIVE_CELL', position: { x, y } })
  }, [send])

  const handleMouseLeave = useCallback(() => {
    send({ type: 'SET_ACTIVE_CELL', position: null })
  }, [send])

  // If no data, show placeholder
  if (state.cells.length === 0) {
    return (
      <div className={cn(
        'flex-1 flex items-center justify-center bg-surface-0',
        className
      )}>
        <div className="text-center">
          <div className="text-4xl mb-3">🌡️</div>
          <div className="text-sm text-white/40">No heatmap data</div>
          <div className="text-xs text-white/20 mt-1">Click "Compute" to generate</div>
        </div>
      </div>
    )
  }

  const cellWidth = 100 / state.gridWidth
  const cellHeight = 100 / state.gridHeight

  return (
    <div
      className={cn('flex-1 relative bg-surface-0 overflow-hidden', className)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Heatmap grid */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: state.opacity }}>
        {state.cells.map((row, y) =>
          row.map((cell, x) => (
            <rect
              key={`${x}-${y}`}
              x={`${x * cellWidth}%`}
              y={`${y * cellHeight}%`}
              width={`${cellWidth}%`}
              height={`${cellHeight}%`}
              fill={getColorForValue(cell.normalizedValue)}
              onMouseEnter={() => handleCellHover(x, y)}
              className="cursor-pointer transition-opacity hover:opacity-80"
            />
          ))
        )}
      </svg>

      {/* Hotspot markers */}
      {state.showHotspots && state.hotspots.map(hotspot => {
        // Convert center position to percentage
        const x = ((hotspot.center[0] - state.bounds.minLng) /
          (state.bounds.maxLng - state.bounds.minLng)) * 100
        const y = ((state.bounds.maxLat - hotspot.center[1]) /
          (state.bounds.maxLat - state.bounds.minLat)) * 100
        const isSelected = hotspot.id === state.selectedHotspotId

        const severityColors = {
          critical: '#ef4444',
          high: '#f59e0b',
          medium: '#3b82f6',
          low: '#22c55e'
        }

        return (
          <div
            key={hotspot.id}
            className={cn(
              'absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2',
              'rounded-full border-2 flex items-center justify-center',
              'cursor-pointer transition-all',
              isSelected ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
            )}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              borderColor: severityColors[hotspot.severity],
              backgroundColor: `${severityColors[hotspot.severity]}40`
            }}
            onClick={() => send({ type: 'SELECT_HOTSPOT', id: hotspot.id })}
          >
            <span className="text-xs font-bold text-white">
              {hotspot.entityCount}
            </span>
          </div>
        )
      })}

      {/* Active cell tooltip */}
      {state.activeCellPosition && (
        <div
          className="absolute pointer-events-none bg-black/80 rounded px-2 py-1 text-xs text-white"
          style={{
            left: `${(state.activeCellPosition.x / state.gridWidth) * 100 + 2}%`,
            top: `${(state.activeCellPosition.y / state.gridHeight) * 100 + 2}%`,
          }}
        >
          <div>Value: {state.cells[state.activeCellPosition.y]?.[state.activeCellPosition.x]?.value ?? 'N/A'}</div>
          <div>Entities: {state.cells[state.activeCellPosition.y]?.[state.activeCellPosition.x]?.entityCount ?? 0}</div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// COLOR SCHEME SELECTOR COMPONENT
// =============================================================================

interface ColorSchemeSelectorProps {
  className?: string
}

function ColorSchemeSelector({ className }: ColorSchemeSelectorProps) {
  const { state, send } = useTemporalHeatmap()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-white/40">Color:</span>
      {(Object.keys(COLOR_SCHEMES) as ColorScheme[]).map(scheme => (
        <button
          key={scheme}
          onClick={() => send({ type: 'SET_COLOR_SCHEME', scheme })}
          className={cn(
            'w-6 h-6 rounded overflow-hidden border transition-all',
            state.colorScheme === scheme
              ? 'border-white scale-110'
              : 'border-transparent opacity-60 hover:opacity-100'
          )}
        >
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(to right, ${COLOR_SCHEMES[scheme].join(', ')})`
            }}
          />
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// LEGEND COMPONENT
// =============================================================================

interface LegendProps {
  className?: string
}

function Legend({ className }: LegendProps) {
  const { state } = useTemporalHeatmap()

  return (
    <div className={cn(
      'flex items-center gap-4 px-4 py-2 border-t border-white/10 bg-surface-1/30',
      className
    )}>
      <span className="text-xs text-white/40">Low</span>
      <div
        className="flex-1 h-3 rounded"
        style={{
          background: `linear-gradient(to right, ${COLOR_SCHEMES[state.colorScheme].join(', ')})`
        }}
      />
      <span className="text-xs text-white/40">High</span>

      <div className="border-l border-white/10 pl-4 ml-4 flex items-center gap-4 text-xs">
        <span className="text-white/40">
          Range: {state.valueRange.min} - {state.valueRange.max}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// STATS PANEL COMPONENT
// =============================================================================

interface StatsPanelProps {
  className?: string
}

function StatsPanel({ className }: StatsPanelProps) {
  const { state, selectedHotspot } = useTemporalHeatmap()

  const peakValue = useMemo(() => {
    if (state.cells.length === 0) return 0
    return Math.max(...state.cells.flat().map(c => c.value))
  }, [state.cells])

  const totalEntities = useMemo(() => {
    if (state.cells.length === 0) return 0
    return state.cells.flat().reduce((sum, c) => sum + c.entityCount, 0)
  }, [state.cells])

  return (
    <div className={cn(
      'absolute top-4 right-4 w-56',
      'bg-surface-1/80 border border-white/10 rounded-lg p-3 backdrop-blur-sm',
      className
    )}>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        Statistics
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-white/60">Peak Value</span>
          <span className="text-white font-mono">{peakValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Total Entities</span>
          <span className="text-white font-mono">{totalEntities}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Active Hotspots</span>
          <span className="text-accent-cyan font-mono">
            {state.hotspots.filter(h => h.isActive).length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Detected Patterns</span>
          <span className="text-white font-mono">{state.patterns.length}</span>
        </div>
      </div>

      {/* Selected hotspot details */}
      {selectedHotspot && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
            Selected Hotspot
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-white/60">Severity</span>
              <span className={cn(
                'capitalize',
                selectedHotspot.severity === 'critical' ? 'text-red-400' :
                selectedHotspot.severity === 'high' ? 'text-amber-400' :
                selectedHotspot.severity === 'medium' ? 'text-blue-400' :
                'text-green-400'
              )}>
                {selectedHotspot.severity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Entities</span>
              <span className="text-white font-mono">{selectedHotspot.entityCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Peak</span>
              <span className="text-white font-mono">{selectedHotspot.peakValue}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SETTINGS PANEL COMPONENT
// =============================================================================

interface SettingsPanelProps {
  className?: string
}

function SettingsPanel({ className }: SettingsPanelProps) {
  const { state, send } = useTemporalHeatmap()

  return (
    <div className={cn(
      'absolute bottom-4 left-4 w-56',
      'bg-surface-1/80 border border-white/10 rounded-lg p-3 backdrop-blur-sm',
      className
    )}>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-3">
        Settings
      </div>

      <div className="space-y-3">
        {/* Opacity */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/60">Opacity</span>
            <span className="text-white/40">{Math.round(state.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={state.opacity * 100}
            onChange={(e) => send({ type: 'SET_OPACITY', opacity: parseFloat(e.target.value) / 100 })}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-cyan"
          />
        </div>

        {/* Hotspot threshold */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/60">Hotspot Threshold</span>
            <span className="text-white/40">{Math.round(state.hotspotThreshold * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={state.hotspotThreshold * 100}
            onChange={(e) => send({ type: 'SET_HOTSPOT_THRESHOLD', threshold: parseFloat(e.target.value) / 100 })}
            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent-cyan"
          />
        </div>

        {/* Toggle buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => send({ type: 'TOGGLE_HOTSPOTS' })}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              state.showHotspots
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-white/5 text-white/40'
            )}
          >
            Hotspots
          </button>
          <button
            onClick={() => send({ type: 'TOGGLE_ANOMALIES' })}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              state.showAnomalies
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-white/5 text-white/40'
            )}
          >
            Anomalies
          </button>
          <button
            onClick={() => send({ type: 'TOGGLE_PATTERNS' })}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              state.showPatterns
                ? 'bg-accent-cyan/20 text-accent-cyan'
                : 'bg-white/5 text-white/40'
            )}
          >
            Patterns
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MODE SELECTOR COMPONENT
// =============================================================================

interface ModeSelectorProps {
  className?: string
}

function ModeSelector({ className }: ModeSelectorProps) {
  const { state, send } = useTemporalHeatmap()

  const modes: Array<{ id: AnalysisMode; label: string; icon: string }> = [
    { id: 'density', label: 'Density', icon: '🌡️' },
    { id: 'velocity', label: 'Velocity', icon: '🚀' },
    { id: 'clustering', label: 'Clustering', icon: '🔲' },
    { id: 'anomaly', label: 'Anomaly', icon: '⚠️' },
  ]

  return (
    <div className={cn('flex gap-2', className)}>
      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => send({ type: 'SET_ANALYSIS_MODE', mode: mode.id })}
          className={cn(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            'flex items-center gap-1.5',
            state.analysisMode === mode.id
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'bg-white/5 text-white/40 hover:text-white/60'
          )}
        >
          <span>{mode.icon}</span>
          {mode.label}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const TemporalHeatmap = Object.assign(Root, {
  Header,
  PlaybackControls,
  Canvas,
  ColorSchemeSelector,
  Legend,
  StatsPanel,
  SettingsPanel,
  ModeSelector,
})

export { useTemporalHeatmap }

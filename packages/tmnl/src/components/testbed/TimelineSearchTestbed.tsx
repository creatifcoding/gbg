/**
 * Timeline + Search Integration Testbed
 *
 * Demonstrates the complete flow:
 * Search Results → Timeline Playback → Window-based Filtering → Reactive UI
 *
 * Key patterns demonstrated:
 * - XState v5 machine (timelinePlaybackMachine) for playback state
 * - Derived atoms (timelineFilteredResultsAtom) for reactive filtering
 * - Window-based temporal filtering (±windowMs around playhead)
 * - Effect atom mutations (setTimelinePlayhead, setTimelineEnabled)
 *
 * Route: /testbed/timeline-search
 *
 * @module
 */

import { useEffect, useMemo, useCallback } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Atom, Registry } from '@effect-atom/atom'
import { useMachine } from '@xstate/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Clock,
  Plane,
  MapPin,
  CloudSun,
  Filter,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { TestbedHeader, SectionLabel } from './shared'

// Import the timeline machine
import {
  timelinePlaybackMachine,
  type TimelineSpeed,
  type LoopMode,
} from '@/lib/geoint/machines/timelineMachine'

// Import schema types
import {
  SearchResultItem,
  SearchResultFlight,
  SearchResultPoi,
  SearchResultWeather,
  SearchResultId,
  Icao24,
  PoiId,
} from '@/lib/geoint/schemas'

// ============================================================================
// Local Registry and Atoms
// ============================================================================

const testbedRegistry = Registry.make()

/** All search results (unfiltered) */
const allResultsAtom = Atom.make<readonly SearchResultItem[]>([])

/** Timeline enabled state */
const timelineEnabledAtom = Atom.make<boolean>(false)

/** Timeline playhead (Date) */
const playheadAtom = Atom.make<Date>(new Date())

/** Timeline range */
const rangeAtom = Atom.make<{ start: Date; end: Date }>({
  start: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
  end: new Date(),
})

/** Window size in ms (entities within ±window of playhead are visible) */
const windowMsAtom = Atom.make<number>(5 * 60 * 1000) // 5 minutes

/** Derived: Filtered results based on timeline state */
const filteredResultsAtom = Atom.make((get): readonly SearchResultItem[] => {
  const results = get(allResultsAtom)
  const enabled = get(timelineEnabledAtom)
  const playhead = get(playheadAtom)
  const windowMs = get(windowMsAtom)

  if (!enabled) return results

  const playheadTime = playhead.getTime()
  const windowStart = playheadTime - windowMs
  const windowEnd = playheadTime + windowMs

  return results.filter((r) => {
    const timestamp = r.retrievedAt.getTime()
    return timestamp >= windowStart && timestamp <= windowEnd
  })
})

// ============================================================================
// Mock Data Generator (with distributed timestamps)
// ============================================================================

const generateMockResults = (count: number, rangeMs: number): SearchResultItem[] => {
  const results: SearchResultItem[] = []
  const now = Date.now()
  const types = ['flight', 'poi', 'weather'] as const

  for (let i = 0; i < count; i++) {
    const type = types[i % 3]
    // Distribute timestamps across the range
    const timestamp = new Date(now - Math.random() * rangeMs)

    if (type === 'flight') {
      const icao24 = (0xa00000 + i).toString(16).padStart(6, '0')
      results.push(
        SearchResultFlight.make({
          id: SearchResultId.make(`flight-${i}`),
          source: 'opensky',
          score: 0.8 + Math.random() * 0.2,
          retrievedAt: timestamp,
          icao24: Icao24.make(icao24),
          callsign: `UAL${100 + i}`,
          position: [
            -122.4 + (Math.random() - 0.5) * 0.5,
            37.7 + (Math.random() - 0.5) * 0.5,
            10000 + Math.random() * 30000,
          ],
          velocity: 200 + Math.random() * 100,
          heading: Math.random() * 360,
          verticalRate: (Math.random() - 0.5) * 20,
          onGround: false,
          category: 'medium',
          originCountry: 'United States',
          lastContact: timestamp,
        })
      )
    } else if (type === 'poi') {
      results.push(
        SearchResultPoi.make({
          id: SearchResultId.make(`poi-${i}`),
          source: 'osm',
          score: 0.7 + Math.random() * 0.3,
          retrievedAt: timestamp,
          poiId: PoiId.make(`osm-${1000000 + i}`),
          name: `Location ${i}`,
          position: [
            -122.4 + (Math.random() - 0.5) * 0.5,
            37.7 + (Math.random() - 0.5) * 0.5,
          ],
          category: 'amenity',
          tags: { amenity: 'yes' },
        })
      )
    } else {
      results.push(
        SearchResultWeather.make({
          id: SearchResultId.make(`weather-${i}`),
          source: 'weather',
          score: 0.9,
          retrievedAt: timestamp,
          position: [
            -122.4 + (Math.random() - 0.5) * 0.5,
            37.7 + (Math.random() - 0.5) * 0.5,
          ],
          locationName: `Weather Station ${i}`,
          temperature: 15 + Math.random() * 20,
          feelsLike: 14 + Math.random() * 20,
          humidity: 40 + Math.random() * 40,
          weatherCode: 0,
          weatherDescription: 'Clear sky',
          forecastTime: timestamp,
        })
      )
    }
  }

  return results.sort((a, b) => a.retrievedAt.getTime() - b.retrievedAt.getTime())
}

// ============================================================================
// Result Timeline Visualization
// ============================================================================

interface TimelineVisualizationProps {
  results: readonly SearchResultItem[]
  filteredResults: readonly SearchResultItem[]
  playhead: Date
  range: { start: Date; end: Date }
  windowMs: number
  enabled: boolean
}

function TimelineVisualization({
  results,
  filteredResults,
  playhead,
  range,
  windowMs,
  enabled,
}: TimelineVisualizationProps) {
  const rangeMs = range.end.getTime() - range.start.getTime()
  const filteredIds = new Set(filteredResults.map((r) => r.id))

  const getPosition = (date: Date) => {
    const t = date.getTime()
    return ((t - range.start.getTime()) / rangeMs) * 100
  }

  const playheadPos = getPosition(playhead)
  const windowStartPos = getPosition(new Date(playhead.getTime() - windowMs))
  const windowEndPos = getPosition(new Date(playhead.getTime() + windowMs))

  const getTypeColor = (result: SearchResultItem) => {
    if ('icao24' in result) return '#06b6d4' // cyan for flights
    if ('poiId' in result) return '#22c55e' // green for POI
    return '#eab308' // yellow for weather
  }

  return (
    <div className="relative h-24 bg-black/50 border border-neutral-800 rounded-lg overflow-hidden">
      {/* Range labels */}
      <div className="absolute top-1 left-2 text-xs text-neutral-500 font-mono">
        {range.start.toLocaleTimeString()}
      </div>
      <div className="absolute top-1 right-2 text-xs text-neutral-500 font-mono">
        {range.end.toLocaleTimeString()}
      </div>

      {/* Window highlight */}
      {enabled && (
        <div
          className="absolute top-6 bottom-2 bg-cyan-500/20 border-l border-r border-cyan-500/50"
          style={{
            left: `${Math.max(0, windowStartPos)}%`,
            width: `${Math.min(100, windowEndPos) - Math.max(0, windowStartPos)}%`,
          }}
        />
      )}

      {/* Result dots */}
      <div className="absolute top-8 left-0 right-0 h-8">
        {results.map((result) => {
          const pos = getPosition(result.retrievedAt)
          const isFiltered = filteredIds.has(result.id)
          return (
            <motion.div
              key={result.id}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${pos}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: getTypeColor(result),
                opacity: enabled ? (isFiltered ? 1 : 0.2) : 0.8,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: isFiltered || !enabled ? 1 : 0.5 }}
              transition={{ duration: 0.2 }}
            />
          )
        })}
      </div>

      {/* Playhead line */}
      {enabled && (
        <motion.div
          className="absolute top-4 bottom-0 w-0.5 bg-cyan-400"
          style={{ left: `${playheadPos}%` }}
          animate={{ left: `${playheadPos}%` }}
          transition={{ duration: 0.05 }}
        />
      )}

      {/* Playhead time label */}
      {enabled && (
        <div
          className="absolute bottom-1 text-xs text-cyan-400 font-mono whitespace-nowrap"
          style={{
            left: `${playheadPos}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {playhead.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Speed Control
// ============================================================================

const SPEED_OPTIONS: TimelineSpeed[] = [0.25, 0.5, 1, 2, 4, 8, 16]

function SpeedControl({
  speed,
  onSpeedChange,
}: {
  speed: TimelineSpeed
  onSpeedChange: (speed: TimelineSpeed) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">Speed:</span>
      <div className="flex gap-1">
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              speed === s
                ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Loop Mode Control
// ============================================================================

function LoopModeControl({
  mode,
  onModeChange,
}: {
  mode: LoopMode
  onModeChange: (mode: LoopMode) => void
}) {
  const modes: LoopMode[] = ['none', 'loop', 'bounce']

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">Loop:</span>
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
              mode === m
                ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Playback Controls
// ============================================================================

interface PlaybackControlsProps {
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onStepForward: () => void
  onStepBackward: () => void
  onJumpStart: () => void
  onJumpEnd: () => void
}

function PlaybackControls({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onStepForward,
  onStepBackward,
  onJumpStart,
  onJumpEnd,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onJumpStart}
        className="p-2 rounded bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        title="Jump to Start"
      >
        <SkipBack className="w-4 h-4" />
      </button>
      <button
        onClick={onStepBackward}
        className="p-2 rounded bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        title="Step Backward"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {isPlaying ? (
        <button
          onClick={onPause}
          className="p-3 rounded-full bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40 transition-colors"
          title="Pause"
        >
          <Pause className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={onPlay}
          className="p-3 rounded-full bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40 transition-colors"
          title="Play"
        >
          <Play className="w-5 h-5" />
        </button>
      )}
      <button
        onClick={onStop}
        className="p-2 rounded bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        title="Stop"
      >
        <Square className="w-4 h-4" />
      </button>
      <button
        onClick={onStepForward}
        className="p-2 rounded bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        title="Step Forward"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={onJumpEnd}
        className="p-2 rounded bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        title="Jump to End"
      >
        <SkipForward className="w-4 h-4" />
      </button>
    </div>
  )
}

// ============================================================================
// Stats Display
// ============================================================================

function StatsDisplay({
  totalResults,
  filteredCount,
  enabled,
}: {
  totalResults: number
  filteredCount: number
  enabled: boolean
}) {
  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-neutral-500" />
        <span className="text-neutral-400">Total:</span>
        <span className="text-white font-mono">{totalResults}</span>
      </div>
      {enabled && (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-500" />
          <span className="text-neutral-400">Visible:</span>
          <span className="text-cyan-400 font-mono">{filteredCount}</span>
        </div>
      )}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <Plane className="w-3 h-3 text-cyan-400" />
          <span className="text-neutral-500">Flights</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-green-400" />
          <span className="text-neutral-500">POIs</span>
        </div>
        <div className="flex items-center gap-1">
          <CloudSun className="w-3 h-3 text-yellow-400" />
          <span className="text-neutral-500">Weather</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Result Cards
// ============================================================================

function ResultCard({ result }: { result: SearchResultItem }) {
  const TypeIcon = useMemo(() => {
    if ('icao24' in result) return Plane
    if ('poiId' in result) return MapPin
    return CloudSun
  }, [result])

  const typeColor = useMemo(() => {
    if ('icao24' in result) return 'text-cyan-400'
    if ('poiId' in result) return 'text-green-400'
    return 'text-yellow-400'
  }, [result])

  const label = useMemo(() => {
    if ('callsign' in result) return result.callsign || result.icao24
    if ('name' in result) return result.name
    if ('locationName' in result) return result.locationName
    return result.id
  }, [result])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-black/80 border border-neutral-800 rounded p-2"
    >
      <div className="flex items-center gap-2">
        <TypeIcon className={`w-3 h-3 ${typeColor}`} />
        <span className="text-xs text-white truncate flex-1">{label}</span>
        <span className="text-xs text-neutral-500 font-mono">
          {result.retrievedAt.toLocaleTimeString()}
        </span>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Main Component (inner)
// ============================================================================

function TimelineSearchTestbedInner() {
  // XState machine for timeline playback
  const [state, send] = useMachine(timelinePlaybackMachine, {
    input: {
      initialPlayhead: Date.now() - 30 * 60 * 1000, // 30 min ago
      initialRange: {
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date(),
      },
      initialSpeed: 1,
      initialLoopMode: 'none',
    },
  })

  // Atom subscriptions
  const allResults = useAtomValue(allResultsAtom)
  const filteredResults = useAtomValue(filteredResultsAtom)
  const timelineEnabled = useAtomValue(timelineEnabledAtom)
  const playhead = useAtomValue(playheadAtom)
  const range = useAtomValue(rangeAtom)
  const windowMs = useAtomValue(windowMsAtom)

  // Sync XState playhead to atom
  useEffect(() => {
    testbedRegistry.set(playheadAtom, new Date(state.context.playhead))
  }, [state.context.playhead])

  // Generate mock data on mount
  useEffect(() => {
    const rangeMs = 60 * 60 * 1000 // 1 hour range
    const results = generateMockResults(50, rangeMs)
    testbedRegistry.set(allResultsAtom, results)

    // Set range based on results
    if (results.length > 0) {
      const timestamps = results.map((r) => r.retrievedAt.getTime())
      const minTime = Math.min(...timestamps)
      const maxTime = Math.max(...timestamps)
      testbedRegistry.set(rangeAtom, {
        start: new Date(minTime - 5 * 60 * 1000),
        end: new Date(maxTime + 5 * 60 * 1000),
      })

      // Sync to machine
      send({
        type: 'SET_RANGE',
        start: minTime - 5 * 60 * 1000,
        end: maxTime + 5 * 60 * 1000,
      })
    }
  }, [send])

  // Playback controls
  const handlePlay = useCallback(() => send({ type: 'PLAY' }), [send])
  const handlePause = useCallback(() => send({ type: 'PAUSE' }), [send])
  const handleStop = useCallback(() => send({ type: 'STOP' }), [send])
  const handleStepForward = useCallback(() => send({ type: 'STEP_FORWARD' }), [send])
  const handleStepBackward = useCallback(() => send({ type: 'STEP_BACKWARD' }), [send])
  const handleJumpStart = useCallback(() => send({ type: 'JUMP_START' }), [send])
  const handleJumpEnd = useCallback(() => send({ type: 'JUMP_END' }), [send])
  const handleSpeedChange = useCallback(
    (speed: TimelineSpeed) => send({ type: 'SET_SPEED', speed }),
    [send]
  )
  const handleLoopModeChange = useCallback(
    (mode: LoopMode) => send({ type: 'SET_LOOP_MODE', mode }),
    [send]
  )

  // Toggle timeline filtering
  const handleToggleTimeline = useCallback(() => {
    testbedRegistry.set(timelineEnabledAtom, !timelineEnabled)
  }, [timelineEnabled])

  // Window size control
  const handleWindowChange = useCallback((ms: number) => {
    testbedRegistry.set(windowMsAtom, ms)
  }, [])

  const isPlaying = state.matches('playing')

  return (
    <div className="min-h-screen bg-black text-white">
      <TestbedHeader
        title="Timeline + Search"
        subtitle="XState Machine → Atom Filtering → Reactive Results"
        backLink="/"
      />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Timeline Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleTimeline}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                timelineEnabled
                  ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              <Clock className="w-4 h-4" />
              Timeline Filter: {timelineEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Window Size */}
            {timelineEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Window:</span>
                {[1, 5, 10, 15].map((min) => (
                  <button
                    key={min}
                    onClick={() => handleWindowChange(min * 60 * 1000)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      windowMs === min * 60 * 1000
                        ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}
                  >
                    ±{min}m
                  </button>
                ))}
              </div>
            )}
          </div>

          <StatsDisplay
            totalResults={allResults.length}
            filteredCount={filteredResults.length}
            enabled={timelineEnabled}
          />
        </div>

        {/* Timeline Visualization */}
        <div className="bg-black/50 border border-neutral-800 rounded-lg p-4">
          <SectionLabel>Timeline Visualization</SectionLabel>
          <TimelineVisualization
            results={allResults}
            filteredResults={filteredResults}
            playhead={playhead}
            range={range}
            windowMs={windowMs}
            enabled={timelineEnabled}
          />
        </div>

        {/* Playback Controls */}
        {timelineEnabled && (
          <div className="bg-black/50 border border-neutral-800 rounded-lg p-4 space-y-4">
            <SectionLabel>Playback Controls</SectionLabel>

            <div className="flex items-center justify-between">
              <PlaybackControls
                isPlaying={isPlaying}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                onStepForward={handleStepForward}
                onStepBackward={handleStepBackward}
                onJumpStart={handleJumpStart}
                onJumpEnd={handleJumpEnd}
              />

              <div className="flex items-center gap-6">
                <SpeedControl speed={state.context.speed} onSpeedChange={handleSpeedChange} />
                <LoopModeControl mode={state.context.loopMode} onModeChange={handleLoopModeChange} />
              </div>
            </div>

            {/* Machine State Display */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-purple-400" />
                <span className="text-neutral-500">XState:</span>
                <span className="text-purple-400 font-mono">
                  {typeof state.value === 'string' ? state.value : JSON.stringify(state.value)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-neutral-500">Playhead:</span>
                <span className="text-cyan-400 font-mono">
                  {new Date(state.context.playhead).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-neutral-500">Speed:</span>
                <span className="text-yellow-400 font-mono">{state.context.speed}x</span>
              </div>
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="bg-black/50 border border-neutral-800 rounded-lg p-4">
          <SectionLabel>
            {timelineEnabled ? 'Filtered Results' : 'All Results'} ({filteredResults.length})
          </SectionLabel>

          <div className="mt-4 grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {filteredResults.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </AnimatePresence>
          </div>

          {filteredResults.length === 0 && (
            <div className="text-center text-neutral-500 py-8">
              No results in current time window
            </div>
          )}
        </div>

        {/* Architecture Diagram */}
        <div className="bg-black/50 border border-neutral-800 rounded-lg p-4">
          <SectionLabel>Data Flow Architecture</SectionLabel>
          <div className="mt-4 font-mono text-sm space-y-2">
            <div className="text-cyan-400">searchResults (allResultsAtom)</div>
            <div className="text-neutral-600 ml-4">↓</div>
            <div className="text-purple-400 ml-4">timelinePlaybackMachine (XState v5)</div>
            <div className="text-neutral-600 ml-8">├─ PLAY/PAUSE/STOP events</div>
            <div className="text-neutral-600 ml-8">├─ TICK → playhead advancement</div>
            <div className="text-neutral-600 ml-8">└─ emit('onPlayheadChange')</div>
            <div className="text-neutral-600 ml-4">↓</div>
            <div className="text-yellow-400 ml-4">playheadAtom (via Effect callback)</div>
            <div className="text-neutral-600 ml-4">↓</div>
            <div className="text-green-400 ml-4">filteredResultsAtom (derived)</div>
            <div className="text-neutral-600 ml-8">
              └─ Filter: timestamp ∈ [playhead - windowMs, playhead + windowMs]
            </div>
            <div className="text-neutral-600 ml-4">↓</div>
            <div className="text-white ml-4">React UI (useAtomValue → reactive updates)</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Exported Component (wrapped with RegistryContext.Provider)
// ============================================================================

export function TimelineSearchTestbed() {
  return (
    <RegistryContext.Provider value={testbedRegistry}>
      <TimelineSearchTestbedInner />
    </RegistryContext.Provider>
  )
}

export default TimelineSearchTestbed

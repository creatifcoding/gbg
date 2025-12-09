/**
 * Streams Playground
 *
 * Main page component for `/playground/streams` route.
 * Demonstrates Stream-Atom primitives with live visualizations.
 *
 * @module
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Effect } from 'effect'
import { RegistryContext, useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import { PlaygroundLayout } from './PlaygroundLayout'
import {
  MetricsPanel,
  EventLogPanel,
  StreamsDocPanel,
  ThroughputPanel,
  LatencyPanel,
  TopologyPanel,
  CircuitBreakerPanel,
  HypothesisPanel,
  RawEventsPanel,
} from './panels'
import {
  resetMetrics,
  playgroundRegistry,
  feedModeAtom,
  EmissionEngine,
  throughputTimeseriesAtom,
  latencyDistributionAtom,
  rawLatencyTimeseriesAtom,
  rawEventsAtom,
  metricsStateAtom,
  scenarioConfigAtom,
  initTiming,
  isHighResolution,
  type FeedMode,
  type EmissionEngineAtoms,
  type UnifiedScenarioConfig,
} from '@/lib/streams/playground'
import { ScenarioConfigPanel } from './ScenarioConfigPanel'

// =============================================================================
// TYPES
// =============================================================================

type PlaygroundStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

// =============================================================================
// HEADER
// =============================================================================

interface PlaygroundHeaderProps {
  status: PlaygroundStatus
  elapsedMs: number
  onStart: () => void
  onPause: () => void
  onReset: () => void
  /** High-resolution timing mode (Tauri μs vs browser ~ms) */
  isHighRes: boolean
}

/**
 * Format milliseconds as MM:SS.mmm LCD display
 */
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  const millis = ms % 1000
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

function PlaygroundHeader({
  status,
  elapsedMs,
  onStart,
  onPause,
  onReset,
  isHighRes,
}: PlaygroundHeaderProps) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="text-neutral-500 hover:text-cyan-400 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          ←
        </Link>
        <h1
          className="font-mono font-bold text-neutral-100"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          Streams Playground
        </h1>

        {/* LCD Stopwatch */}
        <div
          className={`tmnl-type-lcd px-3 py-1 bg-neutral-950 border border-neutral-800 rounded ${
            status === 'running'
              ? 'text-cyan-400 text-glow-cyan'
              : status === 'paused'
                ? 'text-amber-400 text-glow-amber'
                : 'text-neutral-600'
          }`}
        >
          {formatElapsed(elapsedMs)}
        </div>

        <span
          className="px-2 py-0.5 bg-cyan-900/50 text-cyan-400 rounded font-mono uppercase"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          EXPERIMENTAL
        </span>

        {/* Timing Mode Indicator */}
        <span
          className={`px-2 py-0.5 rounded font-mono uppercase ${
            isHighRes
              ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-700'
              : 'bg-neutral-800/50 text-neutral-500 border border-neutral-700'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title={isHighRes ? 'Tauri detected (sync timing ~100μs)' : 'Browser mode (sync timing ~100μs)'}
        >
          {isHighRes ? 'TAURI' : 'BROWSER'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onStart}
            disabled={status === 'running'}
            className={`px-3 py-1.5 font-mono uppercase tracking-wider rounded border transition-colors ${
              status === 'running'
                ? 'bg-neutral-800/50 text-neutral-600 border-neutral-700 cursor-not-allowed'
                : 'bg-cyan-900/50 text-cyan-400 border-cyan-700 hover:bg-cyan-800/50'
            }`}
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            ▶ Start
          </button>
          <button
            onClick={onPause}
            disabled={status !== 'running'}
            className={`px-3 py-1.5 font-mono uppercase tracking-wider rounded border transition-colors ${
              status !== 'running'
                ? 'bg-neutral-800/50 text-neutral-600 border-neutral-700 cursor-not-allowed'
                : 'bg-amber-900/50 text-amber-400 border-amber-700 hover:bg-amber-800/50'
            }`}
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            ⏸ Pause
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 font-mono uppercase tracking-wider rounded border bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700 transition-colors"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            ↺ Reset
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'running'
                ? 'bg-green-400 animate-pulse'
                : status === 'paused'
                  ? 'bg-amber-400'
                  : status === 'error'
                    ? 'bg-red-400'
                    : 'bg-neutral-600'
            }`}
          />
          <span
            className="font-mono uppercase text-neutral-400"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN VISUALIZATION
// =============================================================================

type VisualizationTab = 'throughput' | 'latency' | 'circuit' | 'topology' | 'raw'

interface MainVisualizationProps {
  status: PlaygroundStatus
}

function MainVisualization({ status }: MainVisualizationProps) {
  const [activeTab, setActiveTab] = useState<VisualizationTab>('throughput')
  const feedMode = useAtomValue(feedModeAtom)
  const setFeedMode = useAtomSet(feedModeAtom)

  const tabs: { id: VisualizationTab; label: string }[] = [
    { id: 'throughput', label: 'Throughput' },
    { id: 'latency', label: 'Latency' },
    { id: 'circuit', label: 'Circuit' },
    { id: 'topology', label: 'Topology' },
    { id: 'raw', label: 'Raw Events' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Tab navigation + Feed mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 font-mono uppercase tracking-wider rounded border transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-900/50 text-cyan-400 border-cyan-700'
                  : 'bg-neutral-800/50 text-neutral-500 border-neutral-700 hover:text-neutral-300'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feed mode toggle - only show for throughput/latency tabs */}
        {(activeTab === 'throughput' || activeTab === 'latency') && (
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-neutral-500 uppercase"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Feed:
            </span>
            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
              <button
                onClick={() => setFeedMode('downsampled')}
                className={`px-2 py-1 font-mono uppercase transition-colors ${
                  feedMode === 'downsampled'
                    ? 'bg-cyan-900/50 text-cyan-400'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                1/s
              </button>
              <button
                onClick={() => setFeedMode('raw')}
                className={`px-2 py-1 font-mono uppercase transition-colors ${
                  feedMode === 'raw'
                    ? 'bg-amber-900/50 text-amber-400'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Raw
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visualization content - all panels mounted, CSS visibility for persistence */}
      <div className="flex-1 overflow-auto relative">
        {/* Idle state overlay */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 z-10">
            <div className="text-center">
              <div
                className="font-mono text-neutral-600 mb-2"
                style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
              >
                ▶
              </div>
              <span
                className="font-mono text-neutral-500"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                Press Start to begin scenario
              </span>
            </div>
          </div>
        )}

        {/* All panels always mounted - visibility controlled by CSS */}
        <div className={activeTab === 'throughput' ? 'block' : 'hidden'}>
          <ThroughputPanel width={700} height={280} />
        </div>
        <div className={activeTab === 'latency' ? 'block' : 'hidden'}>
          <LatencyPanel width={700} height={280} />
        </div>
        <div className={activeTab === 'circuit' ? 'block' : 'hidden'}>
          <CircuitBreakerPanel />
        </div>
        <div className={activeTab === 'topology' ? 'block' : 'hidden'}>
          <TopologyPanel width={700} height={350} />
        </div>
        <div className={activeTab === 'raw' ? 'block' : 'hidden'}>
          <RawEventsPanel maxHeight={350} />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// STREAMS PLAYGROUND
// =============================================================================

/**
 * Main Streams Playground page component.
 *
 * Orchestrates:
 * - Scenario selection and execution
 * - Live metrics display
 * - Event log visualization
 * - D3 charts (Phase 3)
 */
export function StreamsPlayground() {
  const [status, setStatus] = useState<PlaygroundStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [events, setEvents] = useState<Array<{
    id: string
    timestamp: number
    tag: string
    payload: unknown
  }>>([])
  const [isHighRes, setIsHighRes] = useState(false)

  const startedAtRef = useRef<number | null>(null)
  const stopwatchRef = useRef<number | null>(null)

  // Initialize timing on mount - detect Tauri high-res vs browser fallback
  useEffect(() => {
    initTiming().then(() => {
      setIsHighRes(isHighResolution())
    })
  }, [])

  // Stopwatch tick effect
  useEffect(() => {
    if (status === 'running' && startedAtRef.current !== null) {
      const tick = () => {
        if (startedAtRef.current !== null) {
          setElapsedMs(Date.now() - startedAtRef.current)
        }
        stopwatchRef.current = requestAnimationFrame(tick)
      }
      stopwatchRef.current = requestAnimationFrame(tick)

      return () => {
        if (stopwatchRef.current !== null) {
          cancelAnimationFrame(stopwatchRef.current)
        }
      }
    }
  }, [status])

  // EmissionEngine ref - persists across renders
  const engineRef = useRef<EmissionEngine | null>(null)
  const durationTimeoutRef = useRef<number | null>(null)

  // Atom dependencies for EmissionEngine - declared once
  const engineAtoms: EmissionEngineAtoms = {
    throughputTimeseries: throughputTimeseriesAtom,
    latencyDistribution: latencyDistributionAtom,
    rawLatencyTimeseries: rawLatencyTimeseriesAtom,
    rawEvents: rawEventsAtom,
    metricsState: metricsStateAtom,
  }

  const handleStart = useCallback(() => {
    // Read unified config from atom
    const unifiedConfig = playgroundRegistry.get(scenarioConfigAtom)
    const durationMs = unifiedConfig.durationSec * 1000

    // Create or reconfigure engine with payload generation
    if (!engineRef.current) {
      engineRef.current = new EmissionEngine(
        {
          eventsPerSecond: unifiedConfig.eventsPerSecond,
          payloadProfile: unifiedConfig.payloadProfile,
          payloadTier: unifiedConfig.payloadTier,
          generatePayloads: true,
        },
        engineAtoms,
        playgroundRegistry
      )
    } else {
      engineRef.current.updateConfig({
        eventsPerSecond: unifiedConfig.eventsPerSecond,
        payloadProfile: unifiedConfig.payloadProfile,
        payloadTier: unifiedConfig.payloadTier,
        generatePayloads: true,
      })
    }

    // Initialize timing
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    setStatus('running')

    // Start the engine (Effect program)
    Effect.runPromise(engineRef.current.start()).catch((err) => {
      console.error('[StreamsPlayground] EmissionEngine start failed:', err)
      setStatus('error')
    })

    // Auto-stop after config duration (0 = indefinite)
    if (durationMs > 0) {
      durationTimeoutRef.current = window.setTimeout(() => {
        if (engineRef.current) {
          Effect.runPromise(engineRef.current.stop()).then(() => {
            setStatus('completed')
          })
        }
      }, durationMs)
    }
  }, [])

  const handlePause = useCallback(() => {
    setStatus('paused')
    if (engineRef.current) {
      Effect.runPromise(engineRef.current.stop())
    }
    if (durationTimeoutRef.current !== null) {
      clearTimeout(durationTimeoutRef.current)
      durationTimeoutRef.current = null
    }
  }, [])

  const handleReset = useCallback(() => {
    setStatus('idle')
    setElapsedMs(0)
    startedAtRef.current = null
    setEvents([])

    if (engineRef.current) {
      Effect.runPromise(
        Effect.all([engineRef.current.stop(), engineRef.current.reset()])
      )
    }

    if (durationTimeoutRef.current !== null) {
      clearTimeout(durationTimeoutRef.current)
      durationTimeoutRef.current = null
    }

    if (stopwatchRef.current !== null) {
      cancelAnimationFrame(stopwatchRef.current)
      stopwatchRef.current = null
    }

    resetMetrics()
  }, [])

  // Runtime config changes propagate to running engine
  const handleConfigChange = useCallback((config: UnifiedScenarioConfig) => {
    if (engineRef.current && status === 'running') {
      engineRef.current.updateConfig({
        eventsPerSecond: config.eventsPerSecond,
        payloadProfile: config.payloadProfile,
        payloadTier: config.payloadTier,
      })
    }
  }, [status])

  return (
    <RegistryContext.Provider value={playgroundRegistry}>
      <PlaygroundLayout
        header={
          <PlaygroundHeader
            status={status}
            elapsedMs={elapsedMs}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            isHighRes={isHighRes}
          />
        }
        main={<MainVisualization status={status} />}
        metrics={
          <div className="space-y-4">
            <ScenarioConfigPanel
              isRunning={status === 'running'}
              onConfigChange={handleConfigChange}
            />
            <MetricsPanel />
          </div>
        }
        docs={<StreamsDocPanel />}
        eventLog={<EventLogPanel events={events} maxEvents={100} />}
        hypotheses={<HypothesisPanel />}
      />
    </RegistryContext.Provider>
  )
}

export default StreamsPlayground

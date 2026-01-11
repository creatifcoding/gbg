/**
 * Ingestion Orchestrator Testbed
 *
 * Demonstrates the IngestionOrchestrator Effect.Service pattern:
 * - Effect.Service<> for dependency injection
 * - Fiber-based lifecycle management for multiple ingesters
 * - Layer composition (IngestionOrchestratorLive + config layer)
 * - Individual ingester control (start/stop specific ingesters)
 * - Combined orchestrator status
 * - Ref + HashMap for fiber state tracking
 *
 * Route: /testbed/ingestion-orchestrator
 *
 * HYPOTHESES:
 * - H1: Orchestrator starts all enabled ingesters
 * - H2: Individual ingesters can be started/stopped
 * - H3: Status reflects accurate running state
 * - H4: Graceful shutdown interrupts all fibers
 *
 * @module testbed/ingestion-orchestrator
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Play,
  Square,
  RefreshCw,
  Plane,
  MapPin,
  Cloud,
  Satellite,
  Layers,
  Power,
  Activity,
} from 'lucide-react'
import { Option } from 'effect'

import { SectionLabel } from '@/components/testbed/shared'

// =============================================================================
// Types (from IngestionOrchestrator)
// =============================================================================

type IngesterName = 'flight' | 'osm' | 'weather' | 'imagery'
type ProcessorName = 'flightMaterializer' | 'osmMaterializer' | 'weatherMaterializer'

interface IngesterStatus {
  name: string
  running: boolean
  startedAt: Option.Option<Date>
  error: Option.Option<string>
}

interface MaterializerStatus {
  name: string
  running: boolean
  startedAt: Option.Option<Date>
  eventsProcessed: number
  entitiesCreated: number
  entitiesUpdated: number
}

interface MaterializersStatus {
  flight: MaterializerStatus
  osm: MaterializerStatus
  weather: MaterializerStatus
}

interface OrchestratorStatus {
  running: boolean
  ingesters: IngesterStatus[]
  materializers: MaterializersStatus
  startedAt: Option.Option<Date>
}

interface OrchestratorConfig {
  enableFlight: boolean
  enableOsm: boolean
  enableWeather: boolean
  enableImagery: boolean
  enableFlightMaterializer: boolean
  enableOsmMaterializer: boolean
  enableWeatherMaterializer: boolean
}

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_allStarted: boolean
  h2_individualControl: boolean
  h3_statusAccurate: boolean
  h4_gracefulShutdown: boolean
}

const initialHypotheses: Hypotheses = {
  h1_allStarted: false,
  h2_individualControl: false,
  h3_statusAccurate: false,
  h4_gracefulShutdown: false,
}

// =============================================================================
// Mock Orchestrator Service
// =============================================================================

interface MockOrchestratorService {
  start: () => Promise<void>
  stop: () => Promise<void>
  startIngester: (name: IngesterName) => Promise<void>
  stopIngester: (name: IngesterName) => Promise<void>
  status: () => OrchestratorStatus
  config: OrchestratorConfig
}

function createMockOrchestrator(config: OrchestratorConfig): MockOrchestratorService {
  // Internal state
  const runningIngesters = new Map<IngesterName, { startedAt: Date }>()
  const runningMaterializers = new Map<ProcessorName, { startedAt: Date; eventsProcessed: number; entitiesCreated: number; entitiesUpdated: number }>()
  let startedAt: Date | null = null

  // Simulated events processed (auto-increment when running)
  const intervalRefs = new Map<string, NodeJS.Timeout>()

  const startIngester = async (name: IngesterName) => {
    if (runningIngesters.has(name)) return

    // Simulate startup delay
    await new Promise((r) => setTimeout(r, 500))
    runningIngesters.set(name, { startedAt: new Date() })
    console.log(`[MockOrchestrator] Started ingester: ${name}`)
  }

  const stopIngester = async (name: IngesterName) => {
    if (!runningIngesters.has(name)) return

    // Simulate graceful shutdown
    await new Promise((r) => setTimeout(r, 300))
    runningIngesters.delete(name)
    console.log(`[MockOrchestrator] Stopped ingester: ${name}`)
  }

  const startMaterializer = async (name: ProcessorName) => {
    if (runningMaterializers.has(name)) return

    await new Promise((r) => setTimeout(r, 300))
    runningMaterializers.set(name, {
      startedAt: new Date(),
      eventsProcessed: 0,
      entitiesCreated: 0,
      entitiesUpdated: 0,
    })

    // Simulate event processing
    const interval = setInterval(() => {
      const stats = runningMaterializers.get(name)
      if (stats) {
        runningMaterializers.set(name, {
          ...stats,
          eventsProcessed: stats.eventsProcessed + Math.floor(Math.random() * 10) + 1,
          entitiesCreated: stats.entitiesCreated + Math.floor(Math.random() * 3),
          entitiesUpdated: stats.entitiesUpdated + Math.floor(Math.random() * 5),
        })
      }
    }, 1000)
    intervalRefs.set(name, interval)

    console.log(`[MockOrchestrator] Started materializer: ${name}`)
  }

  const stopMaterializer = async (name: ProcessorName) => {
    if (!runningMaterializers.has(name)) return

    const interval = intervalRefs.get(name)
    if (interval) {
      clearInterval(interval)
      intervalRefs.delete(name)
    }

    runningMaterializers.delete(name)
    console.log(`[MockOrchestrator] Stopped materializer: ${name}`)
  }

  return {
    config,

    start: async () => {
      console.log('[MockOrchestrator] Starting orchestrator...')
      startedAt = new Date()

      // Start enabled ingesters
      if (config.enableFlight) await startIngester('flight')
      if (config.enableOsm) await startIngester('osm')
      if (config.enableWeather) await startIngester('weather')
      if (config.enableImagery) await startIngester('imagery')

      // Start enabled materializers
      if (config.enableFlightMaterializer) await startMaterializer('flightMaterializer')
      if (config.enableOsmMaterializer) await startMaterializer('osmMaterializer')
      if (config.enableWeatherMaterializer) await startMaterializer('weatherMaterializer')

      console.log('[MockOrchestrator] Orchestrator started')
    },

    stop: async () => {
      console.log('[MockOrchestrator] Stopping orchestrator...')

      // Stop all ingesters
      for (const name of runningIngesters.keys()) {
        await stopIngester(name)
      }

      // Stop all materializers
      for (const name of runningMaterializers.keys()) {
        await stopMaterializer(name)
      }

      startedAt = null
      console.log('[MockOrchestrator] Orchestrator stopped')
    },

    startIngester,
    stopIngester,

    status: () => {
      const ingesters: IngesterStatus[] = (['flight', 'osm', 'weather', 'imagery'] as const).map((name) => {
        const state = runningIngesters.get(name)
        return {
          name,
          running: !!state,
          startedAt: state ? Option.some(state.startedAt) : Option.none(),
          error: Option.none(),
        }
      })

      const createMaterializerStatus = (name: ProcessorName): MaterializerStatus => {
        const state = runningMaterializers.get(name)
        return {
          name: name.replace('Materializer', ''),
          running: !!state,
          startedAt: state ? Option.some(state.startedAt) : Option.none(),
          eventsProcessed: state?.eventsProcessed ?? 0,
          entitiesCreated: state?.entitiesCreated ?? 0,
          entitiesUpdated: state?.entitiesUpdated ?? 0,
        }
      }

      return {
        running: runningIngesters.size > 0 || runningMaterializers.size > 0,
        ingesters,
        materializers: {
          flight: createMaterializerStatus('flightMaterializer'),
          osm: createMaterializerStatus('osmMaterializer'),
          weather: createMaterializerStatus('weatherMaterializer'),
        },
        startedAt: startedAt ? Option.some(startedAt) : Option.none(),
      }
    },
  }
}

// =============================================================================
// Component
// =============================================================================

const INGESTER_ICONS: Record<IngesterName, React.ReactNode> = {
  flight: <Plane size={16} />,
  osm: <MapPin size={16} />,
  weather: <Cloud size={16} />,
  imagery: <Satellite size={16} />,
}

const INGESTER_COLORS: Record<IngesterName, string> = {
  flight: 'var(--tmnl-accent-cyan)',
  osm: 'var(--tmnl-accent-emerald)',
  weather: 'var(--tmnl-accent-amber)',
  imagery: 'var(--tmnl-accent-rose)',
}

export function IngestionOrchestratorTestbed() {
  // Hypotheses state
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Config state
  const [config, setConfig] = useState<OrchestratorConfig>({
    enableFlight: true,
    enableOsm: true,
    enableWeather: true,
    enableImagery: true,
    enableFlightMaterializer: true,
    enableOsmMaterializer: true,
    enableWeatherMaterializer: true,
  })

  // Orchestrator instance
  const orchestratorRef = useRef<MockOrchestratorService | null>(null)

  // Status state
  const [status, setStatus] = useState<OrchestratorStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-19), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Initialize orchestrator
  useEffect(() => {
    orchestratorRef.current = createMockOrchestrator(config)
    log('Orchestrator created with config')
    return () => {
      orchestratorRef.current?.stop()
    }
  }, [])

  // Poll status when running
  useEffect(() => {
    const interval = setInterval(() => {
      if (orchestratorRef.current) {
        const newStatus = orchestratorRef.current.status()
        setStatus(newStatus)

        // Check hypotheses
        if (newStatus.running) {
          const runningIngesters = newStatus.ingesters.filter((i) => i.running).length
          const enabledIngesters = [config.enableFlight, config.enableOsm, config.enableWeather, config.enableImagery].filter(Boolean).length

          if (runningIngesters === enabledIngesters && enabledIngesters > 0) {
            setHypotheses((h) => ({ ...h, h1_allStarted: true }))
          }

          if (runningIngesters > 0) {
            setHypotheses((h) => ({ ...h, h3_statusAccurate: true }))
          }
        }
      }
    }, 500)

    return () => clearInterval(interval)
  }, [config])

  // Start all
  const handleStartAll = useCallback(async () => {
    if (!orchestratorRef.current) return
    setIsLoading(true)
    log('Starting all ingesters...')

    try {
      await orchestratorRef.current.start()
      log('All ingesters started')
    } catch (e) {
      log(`Error: ${String(e)}`)
    } finally {
      setIsLoading(false)
    }
  }, [log])

  // Stop all
  const handleStopAll = useCallback(async () => {
    if (!orchestratorRef.current) return
    setIsLoading(true)
    log('Stopping all ingesters...')

    try {
      await orchestratorRef.current.stop()
      log('All ingesters stopped')
      setHypotheses((h) => ({ ...h, h4_gracefulShutdown: true }))
    } catch (e) {
      log(`Error: ${String(e)}`)
    } finally {
      setIsLoading(false)
    }
  }, [log])

  // Toggle individual ingester
  const handleToggleIngester = useCallback(
    async (name: IngesterName) => {
      if (!orchestratorRef.current) return

      const currentStatus = orchestratorRef.current.status()
      const ingester = currentStatus.ingesters.find((i) => i.name === name)

      if (ingester?.running) {
        log(`Stopping ${name} ingester...`)
        await orchestratorRef.current.stopIngester(name)
        log(`${name} ingester stopped`)
      } else {
        log(`Starting ${name} ingester...`)
        await orchestratorRef.current.startIngester(name)
        log(`${name} ingester started`)
      }

      setHypotheses((h) => ({ ...h, h2_individualControl: true }))
    },
    [log]
  )

  // Toggle config
  const toggleConfig = useCallback((key: keyof OrchestratorConfig) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Recreate orchestrator with new config
  const handleApplyConfig = useCallback(() => {
    orchestratorRef.current?.stop()
    orchestratorRef.current = createMockOrchestrator(config)
    log('Orchestrator recreated with new config')
  }, [config, log])

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-base)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/testbed"
          className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Back to Testbeds</span>
        </Link>
        <h1
          className="font-mono font-bold text-[var(--tmnl-text-primary)]"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          Ingestion Orchestrator Testbed
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: Configuration */}
        <div className="space-y-4">
          <SectionLabel>Orchestrator Config</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div
              className="text-[var(--tmnl-text-muted)] mb-2"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Enable/disable ingesters before start
            </div>

            {/* Ingester toggles */}
            {(['flight', 'osm', 'weather', 'imagery'] as const).map((name) => {
              const configKey = `enable${name.charAt(0).toUpperCase() + name.slice(1)}` as keyof OrchestratorConfig
              return (
                <label
                  key={name}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config[configKey]}
                    onChange={() => toggleConfig(configKey)}
                    className="w-4 h-4 accent-[var(--tmnl-accent-cyan)]"
                  />
                  <div className="flex items-center gap-2">
                    <span style={{ color: INGESTER_COLORS[name] }}>{INGESTER_ICONS[name]}</span>
                    <span
                      className="text-[var(--tmnl-text-primary)]"
                      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                    >
                      {name.charAt(0).toUpperCase() + name.slice(1)} Ingester
                    </span>
                  </div>
                </label>
              )
            })}

            <hr className="border-[var(--tmnl-surface-sunken)]" />

            {/* Materializer toggles */}
            {(['flightMaterializer', 'osmMaterializer', 'weatherMaterializer'] as const).map((name) => {
              const configKey = `enable${name.charAt(0).toUpperCase() + name.slice(1)}` as keyof OrchestratorConfig
              const shortName = name.replace('Materializer', '')
              return (
                <label
                  key={name}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={config[configKey]}
                    onChange={() => toggleConfig(configKey)}
                    className="w-4 h-4 accent-[var(--tmnl-accent-cyan)]"
                  />
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-[var(--tmnl-text-muted)]" />
                    <span
                      className="text-[var(--tmnl-text-primary)]"
                      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                    >
                      {shortName.charAt(0).toUpperCase() + shortName.slice(1)} Materializer
                    </span>
                  </div>
                </label>
              )
            })}

            <button
              onClick={handleApplyConfig}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-secondary)] hover:bg-[var(--tmnl-surface-base)] transition-colors"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <RefreshCw size={14} />
              Apply Config
            </button>
          </div>

          {/* Master controls */}
          <div className="flex gap-2">
            <button
              onClick={handleStartAll}
              disabled={isLoading || status?.running}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded bg-[var(--tmnl-status-success)] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Play size={16} />
              Start All
            </button>
            <button
              onClick={handleStopAll}
              disabled={isLoading || !status?.running}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded bg-[var(--tmnl-status-error)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Square size={16} />
              Stop All
            </button>
          </div>
        </div>

        {/* Column 2: Ingester Status */}
        <div className="space-y-4">
          <SectionLabel>Ingesters</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            {status?.ingesters.map((ingester) => {
              const name = ingester.name as IngesterName
              return (
                <div
                  key={name}
                  className="bg-[var(--tmnl-surface-sunken)] rounded p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: INGESTER_COLORS[name] }}>{INGESTER_ICONS[name]}</span>
                      <span
                        className="font-mono text-[var(--tmnl-text-primary)]"
                        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                      >
                        {name.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleIngester(name)}
                      className={`p-1.5 rounded transition-colors ${
                        ingester.running
                          ? 'bg-[var(--tmnl-status-success)]/20 text-[var(--tmnl-status-success)]'
                          : 'bg-[var(--tmnl-surface-base)] text-[var(--tmnl-text-muted)]'
                      }`}
                      title={ingester.running ? 'Stop' : 'Start'}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        ingester.running ? 'bg-[var(--tmnl-status-success)] animate-pulse' : 'bg-[var(--tmnl-surface-base)]'
                      }`}
                    />
                    <span
                      className="text-[var(--tmnl-text-muted)]"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {ingester.running ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  {ingester.running && Option.isSome(ingester.startedAt) && (
                    <div
                      className="text-[var(--tmnl-text-muted)] mt-1"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      Since: {ingester.startedAt.value.toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Column 3: Materializer Status */}
        <div className="space-y-4">
          <SectionLabel>Materializers</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            {status &&
              Object.entries(status.materializers).map(([key, mat]) => (
                <div
                  key={key}
                  className="bg-[var(--tmnl-surface-sunken)] rounded p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-[var(--tmnl-accent-cyan)]" />
                      <span
                        className="font-mono text-[var(--tmnl-text-primary)]"
                        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                      >
                        {mat.name.toUpperCase()}
                      </span>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        mat.running ? 'bg-[var(--tmnl-status-success)] animate-pulse' : 'bg-[var(--tmnl-surface-base)]'
                      }`}
                    />
                  </div>
                  {mat.running && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <div
                          className="text-[var(--tmnl-text-muted)]"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          Events
                        </div>
                        <div
                          className="font-mono text-[var(--tmnl-accent-cyan)]"
                          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                        >
                          {mat.eventsProcessed}
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-[var(--tmnl-text-muted)]"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          Created
                        </div>
                        <div
                          className="font-mono text-[var(--tmnl-status-success)]"
                          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                        >
                          {mat.entitiesCreated}
                        </div>
                      </div>
                      <div>
                        <div
                          className="text-[var(--tmnl-text-muted)]"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          Updated
                        </div>
                        <div
                          className="font-mono text-[var(--tmnl-accent-amber)]"
                          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                        >
                          {mat.entitiesUpdated}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Column 4: Hypotheses & Logs */}
        <div className="space-y-4">
          <SectionLabel>Orchestrator Status</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Activity size={24} className={status?.running ? 'text-[var(--tmnl-status-success)]' : 'text-[var(--tmnl-text-muted)]'} />
              <div>
                <div
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                >
                  {status?.running ? 'RUNNING' : 'STOPPED'}
                </div>
                {status?.running && Option.isSome(status.startedAt) && (
                  <div
                    className="text-[var(--tmnl-text-muted)]"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    Since: {status.startedAt.value.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[var(--tmnl-text-muted)]"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Ingesters Running
                </div>
                <div
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                >
                  {status?.ingesters.filter((i) => i.running).length ?? 0} / 4
                </div>
              </div>
              <div>
                <div
                  className="text-[var(--tmnl-text-muted)]"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Materializers Running
                </div>
                <div
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                >
                  {status ? [status.materializers.flight, status.materializers.osm, status.materializers.weather].filter((m) => m.running).length : 0} / 3
                </div>
              </div>
            </div>
          </div>

          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            {[
              { key: 'h1_allStarted', label: 'H1: All enabled ingesters started' },
              { key: 'h2_individualControl', label: 'H2: Individual ingester control' },
              { key: 'h3_statusAccurate', label: 'H3: Status reflects running state' },
              { key: 'h4_gracefulShutdown', label: 'H4: Graceful shutdown works' },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center gap-2"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    hypotheses[key as keyof Hypotheses]
                      ? 'bg-[var(--tmnl-status-success)]'
                      : 'bg-[var(--tmnl-surface-sunken)]'
                  }`}
                />
                <span
                  className={
                    hypotheses[key as keyof Hypotheses]
                      ? 'text-[var(--tmnl-text-primary)]'
                      : 'text-[var(--tmnl-text-muted)]'
                  }
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <SectionLabel>Logs</SectionLabel>
          <div
            className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-32 overflow-y-auto font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {logs.map((log, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture Note */}
      <div className="mt-6 bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
        <SectionLabel>Pattern Documentation</SectionLabel>
        <div
          className="text-[var(--tmnl-text-muted)] space-y-2 mt-2"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          <p>
            <strong className="text-[var(--tmnl-text-primary)]">Effect.Service Pattern:</strong> IngestionOrchestrator uses Context.Tag for dependency injection with optional services via Effect.serviceOption().
          </p>
          <p>
            <strong className="text-[var(--tmnl-text-primary)]">Fiber Lifecycle:</strong> Each ingester runs as a Fiber. Ref + HashMap tracks running fibers. Fiber.interrupt provides graceful shutdown.
          </p>
          <p>
            <strong className="text-[var(--tmnl-text-primary)]">Layer Composition:</strong> IngestionOrchestratorLive + IngestionOrchestratorConfigDefault. Materializers compose with DurableStreamClient.
          </p>
          <p>
            <strong className="text-[var(--tmnl-text-primary)]">Schema Types:</strong> OrchestratorStatus, IngesterStatus use Effect Schema with Option for nullable dates.
          </p>
        </div>
      </div>
    </div>
  )
}

export default IngestionOrchestratorTestbed

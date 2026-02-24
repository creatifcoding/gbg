/**
 * Ingestion Testbed - Full Vertical Slice via Cluster RPC
 *
 * Demonstrates the complete data flow:
 * Browser → IngestionClient (AtomRpc) → IngestionRpcServer → Cluster →
 * External APIs → PostgreSQL → DurableStreams → Materializer → Electric → UI
 *
 * AtomRpc Pattern:
 * - Mutations via registry.set(mutationAtom, payload) → triggers RPC
 * - Results via useAtomValue(mutationAtom) → Result.Result<A, E>
 * - Result states: Initial | Waiting | Success | Failure
 *
 * Route: /testbed/ingestion
 *
 * @module testbed/ingestion
 */

import { useState, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Plane,
  MapPin,
  Cloud,
  Satellite,
  Play,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
  Loader,
} from 'lucide-react'
import { Atom, Registry } from '@effect-atom/atom'
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react'
import * as Result from '@effect-atom/atom/Result'

import { SectionLabel } from '@/components/testbed/shared'
import {
  IngestionClient,
  type FlightIngestionResult,
  type RegionIngestionResult,
  type PoiIngestionResult,
  type WeatherIngestionResult,
  type WeatherPointResult,
  type ImageryIngestionResult,
  type OrchestratorStatus,
} from '@/lib/geoint/clients/IngestionClient'

// =============================================================================
// Types
// =============================================================================

type IngestionOperationType = 'flightByIcao' | 'flightsByRegion' | 'poi' | 'weatherGrid' | 'weatherPoint' | 'imagery'

interface OperationResult {
  type: IngestionOperationType
  success: boolean
  data?: unknown
  error?: string
  latencyMs: number
  timestamp: Date
}

// =============================================================================
// Registry & Atoms
// =============================================================================

/**
 * Testbed-specific registry for AtomRpc mutations.
 * Each mutation atom holds the latest Result for that operation.
 */
const ingestionTestbedRegistry = Registry.make()

/**
 * AtomRpc mutations - trigger via registry.set(atom, payload)
 * Read via useAtomValue(atom) → Result.Result<Success, Error>
 */
const flightByIcaoMutation = IngestionClient.mutation('ingestFlightByIcao')
const flightsByRegionMutation = IngestionClient.mutation('ingestFlightsByRegion')
const poiByRegionMutation = IngestionClient.mutation('ingestPoiByRegion')
const weatherByGridMutation = IngestionClient.mutation('ingestWeatherByGrid')
const weatherByPointMutation = IngestionClient.mutation('ingestWeatherByPoint')
const imageryByRegionMutation = IngestionClient.mutation('ingestImageryByRegion')
const startIngestionMutation = IngestionClient.mutation('startIngestion')
const stopIngestionMutation = IngestionClient.mutation('stopIngestion')
const getStatusMutation = IngestionClient.mutation('getIngestionStatus')

/**
 * Local state atom for operation history (not tied to RPC results)
 */
const operationHistoryAtom = Atom.make<readonly OperationResult[]>([])

/**
 * Local state atom for logs
 */
const logsAtom = Atom.make<readonly string[]>([])

// =============================================================================
// Constants
// =============================================================================

// San Francisco area bounds for testing
const DEFAULT_BOUNDS: readonly [number, number, number, number] = [-122.5, 37.7, -122.3, 37.9]

const OPERATION_ICONS: Record<IngestionOperationType, React.ReactNode> = {
  flightByIcao: <Plane size={16} />,
  flightsByRegion: <Plane size={16} />,
  poi: <MapPin size={16} />,
  weatherGrid: <Cloud size={16} />,
  weatherPoint: <Cloud size={16} />,
  imagery: <Satellite size={16} />,
}

const OPERATION_COLORS: Record<IngestionOperationType, string> = {
  flightByIcao: 'var(--tmnl-accent-cyan)',
  flightsByRegion: 'var(--tmnl-accent-cyan)',
  poi: 'var(--tmnl-accent-emerald)',
  weatherGrid: 'var(--tmnl-accent-amber)',
  weatherPoint: 'var(--tmnl-accent-amber)',
  imagery: 'var(--tmnl-accent-rose)',
}

// =============================================================================
// Helper: Add log entry
// =============================================================================

function addLog(msg: string) {
  const logs = ingestionTestbedRegistry.get(logsAtom)
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`
  ingestionTestbedRegistry.set(logsAtom, [...logs.slice(-29), entry])
}

// =============================================================================
// Helper: Add operation result to history
// =============================================================================

function addOperationResult(result: OperationResult) {
  const history = ingestionTestbedRegistry.get(operationHistoryAtom)
  ingestionTestbedRegistry.set(operationHistoryAtom, [result, ...history.slice(0, 9)])
}

// =============================================================================
// Result Display Components
// =============================================================================

function FlightResultCard({ result }: { result: FlightIngestionResult }) {
  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[var(--tmnl-accent-cyan)]">{result.icao24.toUpperCase()}</span>
        <span className="text-[var(--tmnl-text-muted)] text-xs">{result.source}</span>
      </div>
      {result.callsign && (
        <div className="text-[var(--tmnl-text-secondary)] text-xs">Callsign: {result.callsign}</div>
      )}
      {result.position && (
        <div className="text-[var(--tmnl-text-muted)] text-xs font-mono">
          {result.position[1].toFixed(4)}°, {result.position[0].toFixed(4)}° @ {Math.round(result.position[2])}m
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-[var(--tmnl-text-muted)]">
        <span>+{result.positionsIngested} positions</span>
        <span>+{result.streamEventsPublished} events</span>
        <span className="text-[var(--tmnl-status-success)]">{result.latencyMs}ms</span>
      </div>
    </div>
  )
}

function RegionResultCard({ result }: { result: RegionIngestionResult }) {
  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[var(--tmnl-text-primary)]">{result.region}</span>
        <span className="text-[var(--tmnl-text-muted)] text-xs">{result.source}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--tmnl-text-muted)]">
        <span>{result.flightsIngested} flights</span>
        <span>+{result.positionsIngested} positions</span>
        <span>+{result.streamEventsPublished} events</span>
        <span className="text-[var(--tmnl-status-success)]">{result.latencyMs}ms</span>
      </div>
    </div>
  )
}

function PoiResultCard({ result }: { result: PoiIngestionResult }) {
  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[var(--tmnl-text-primary)]">{result.region}</span>
        <span className="text-[var(--tmnl-text-muted)] text-xs">{result.source}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--tmnl-text-muted)]">
        <span>{result.poisIngested} POIs</span>
        <span>+{result.streamEventsPublished} events</span>
        <span className="text-[var(--tmnl-status-success)]">{result.latencyMs}ms</span>
      </div>
    </div>
  )
}

function WeatherGridResultCard({ result }: { result: WeatherIngestionResult }) {
  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[var(--tmnl-text-primary)]">{result.grid}</span>
        <span className="text-[var(--tmnl-text-muted)] text-xs">{result.source}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[var(--tmnl-text-muted)]">
        <span>{result.pointsQueried} points</span>
        <span>{result.observationsIngested} observations</span>
        <span className="text-[var(--tmnl-status-success)]">{result.latencyMs}ms</span>
      </div>
    </div>
  )
}

function WeatherPointResultCard({ result }: { result: WeatherPointResult }) {
  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[var(--tmnl-text-primary)]">{result.locationId}</span>
        <span className="text-[var(--tmnl-text-muted)] text-xs">
          {result.latitude.toFixed(2)}°, {result.longitude.toFixed(2)}°
        </span>
      </div>
      {result.temperature !== undefined && (
        <div className="text-[var(--tmnl-accent-amber)] text-sm">{result.temperature.toFixed(1)}°C</div>
      )}
      {result.weatherDesc && (
        <div className="text-[var(--tmnl-text-secondary)] text-xs">{result.weatherDesc}</div>
      )}
      <div className="text-xs text-[var(--tmnl-status-success)]">{result.latencyMs}ms</div>
    </div>
  )
}

function ImageryResultCards({ results }: { results: readonly ImageryIngestionResult[] }) {
  return (
    <div className="space-y-2">
      {results.map((result, i) => (
        <div key={i} className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[var(--tmnl-text-primary)]">{result.region}</span>
            <span className="text-[var(--tmnl-text-muted)] text-xs">{result.provider}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--tmnl-text-muted)]">
            <span>{result.itemsIngested} items</span>
            <span>+{result.streamEventsPublished} events</span>
            <span className="text-[var(--tmnl-status-success)]">{result.latencyMs}ms</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Result Status Component
// =============================================================================

function ResultStatus<A, E>({
  result,
  operationType,
  onSuccess,
}: {
  result: Result.Result<A, E>
  operationType: IngestionOperationType
  onSuccess?: (data: A) => void
}) {
  // Handle Result states
  if (Result.isInitial(result)) {
    return (
      <div className="text-[var(--tmnl-text-muted)] text-xs flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--tmnl-surface-base)]" />
        Ready
      </div>
    )
  }

  if (Result.isWaiting(result)) {
    return (
      <div className="text-[var(--tmnl-accent-cyan)] text-xs flex items-center gap-2">
        <Loader size={12} className="animate-spin" />
        In Progress...
      </div>
    )
  }

  if (Result.isSuccess(result)) {
    return (
      <div className="text-[var(--tmnl-status-success)] text-xs flex items-center gap-2">
        <CheckCircle size={12} />
        Success
      </div>
    )
  }

  if (Result.isFailure(result)) {
    return (
      <div className="text-[var(--tmnl-status-error)] text-xs flex items-center gap-2">
        <XCircle size={12} />
        Failed
      </div>
    )
  }

  return null
}

// =============================================================================
// Inner Testbed Component (uses atoms via useAtomValue)
// =============================================================================

function IngestionTestbedInner() {
  // Form state
  const [icao24Input, setIcao24Input] = useState('a00001')
  const [regionNameInput, setRegionNameInput] = useState('SF Bay Area')
  const [latInput, setLatInput] = useState('37.7749')
  const [lonInput, setLonInput] = useState('-122.4194')

  // Subscribe to mutation result atoms
  const flightByIcaoResult = useAtomValue(flightByIcaoMutation)
  const flightsByRegionResult = useAtomValue(flightsByRegionMutation)
  const poiResult = useAtomValue(poiByRegionMutation)
  const weatherGridResult = useAtomValue(weatherByGridMutation)
  const weatherPointResult = useAtomValue(weatherByPointMutation)
  const imageryResult = useAtomValue(imageryByRegionMutation)
  const statusResult = useAtomValue(getStatusMutation)
  const startResult = useAtomValue(startIngestionMutation)
  const stopResult = useAtomValue(stopIngestionMutation)

  // Subscribe to local state atoms
  const operationHistory = useAtomValue(operationHistoryAtom)
  const logs = useAtomValue(logsAtom)

  // Derive loading states from Result.isWaiting
  const isLoading = useMemo(() => ({
    flightByIcao: Result.isWaiting(flightByIcaoResult),
    flightsByRegion: Result.isWaiting(flightsByRegionResult),
    poi: Result.isWaiting(poiResult),
    weatherGrid: Result.isWaiting(weatherGridResult),
    weatherPoint: Result.isWaiting(weatherPointResult),
    imagery: Result.isWaiting(imageryResult),
    orchestrator: Result.isWaiting(statusResult) || Result.isWaiting(startResult) || Result.isWaiting(stopResult),
  }), [
    flightByIcaoResult,
    flightsByRegionResult,
    poiResult,
    weatherGridResult,
    weatherPointResult,
    imageryResult,
    statusResult,
    startResult,
    stopResult,
  ])

  // Derive orchestrator status from getStatus result
  const orchestratorStatus = useMemo((): OrchestratorStatus | null => {
    // Try statusResult first
    if (Result.isSuccess(statusResult)) {
      return statusResult.value
    }
    // Then startResult
    if (Result.isSuccess(startResult)) {
      return startResult.value
    }
    // Then stopResult
    if (Result.isSuccess(stopResult)) {
      return stopResult.value
    }
    return null
  }, [statusResult, startResult, stopResult])

  // ==========================================================================
  // Ingestion Operations (via registry.set)
  // ==========================================================================

  const handleIngestFlightByIcao = useCallback(() => {
    const icao24 = icao24Input.toLowerCase().trim()
    if (!/^[0-9a-f]{6}$/.test(icao24)) {
      addLog(`Invalid ICAO24: ${icao24} (must be 6 hex characters)`)
      return
    }

    addLog(`Ingesting flight ${icao24.toUpperCase()}...`)
    // Trigger mutation via registry.set(atom, { payload: ... })
    ingestionTestbedRegistry.set(flightByIcaoMutation, { payload: { icao24, source: 'adsb-lol' as const } })
  }, [icao24Input])

  const handleIngestFlightsByRegion = useCallback(() => {
    addLog(`Ingesting flights in ${regionNameInput}...`)
    ingestionTestbedRegistry.set(flightsByRegionMutation, {
      payload: {
        regionName: regionNameInput,
        bounds: DEFAULT_BOUNDS as [number, number, number, number],
        source: 'opensky' as const,
        radiusNm: 150,
      },
    })
  }, [regionNameInput])

  const handleIngestPoi = useCallback(() => {
    addLog(`Ingesting POIs in ${regionNameInput}...`)
    ingestionTestbedRegistry.set(poiByRegionMutation, {
      payload: {
        regionName: regionNameInput,
        bounds: DEFAULT_BOUNDS as [number, number, number, number],
        amenities: ['restaurant', 'cafe', 'hospital'],
        ttlDays: 7,
      },
    })
  }, [regionNameInput])

  const handleIngestWeatherGrid = useCallback(() => {
    addLog(`Ingesting weather grid for ${regionNameInput}...`)
    ingestionTestbedRegistry.set(weatherByGridMutation, {
      payload: {
        gridName: regionNameInput,
        bounds: DEFAULT_BOUNDS as [number, number, number, number],
        resolution: 0.25,
        ttlMinutes: 60,
      },
    })
  }, [regionNameInput])

  const handleIngestWeatherPoint = useCallback(() => {
    const lat = parseFloat(latInput)
    const lon = parseFloat(lonInput)
    if (isNaN(lat) || isNaN(lon)) {
      addLog('Invalid coordinates')
      return
    }

    addLog(`Ingesting weather at ${lat.toFixed(2)}°, ${lon.toFixed(2)}°...`)
    ingestionTestbedRegistry.set(weatherByPointMutation, {
      payload: {
        latitude: lat,
        longitude: lon,
        ttlMinutes: 60,
      },
    })
  }, [latInput, lonInput])

  const handleIngestImagery = useCallback(() => {
    addLog(`Ingesting imagery for ${regionNameInput}...`)
    ingestionTestbedRegistry.set(imageryByRegionMutation, {
      payload: {
        regionName: regionNameInput,
        bounds: DEFAULT_BOUNDS as [number, number, number, number],
        providers: ['planet', 'sentinel'] as Array<'planet' | 'sentinel'>,
        maxCloudCover: 30,
        lookbackDays: 3,
      },
    })
  }, [regionNameInput])

  // ==========================================================================
  // Orchestrator Control
  // ==========================================================================

  const handleRefreshStatus = useCallback(() => {
    addLog('Refreshing orchestrator status...')
    ingestionTestbedRegistry.set(getStatusMutation, { payload: {} })
  }, [])

  const handleStartAll = useCallback(() => {
    addLog('Starting all ingesters...')
    ingestionTestbedRegistry.set(startIngestionMutation, { payload: {} })
  }, [])

  const handleStopAll = useCallback(() => {
    addLog('Stopping all ingesters...')
    ingestionTestbedRegistry.set(stopIngestionMutation, { payload: {} })
  }, [])

  // ==========================================================================
  // Render
  // ==========================================================================

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
        <h1 className="font-mono font-bold text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}>
          Ingestion Testbed
        </h1>
        <span className="text-[var(--tmnl-text-muted)] text-xs">
          AtomRpc Pattern: registry.set() + useAtomValue() → Result
        </span>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: On-Demand Operations */}
        <div className="space-y-4">
          <SectionLabel>On-Demand Ingestion</SectionLabel>

          {/* Flight by ICAO24 */}
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: OPERATION_COLORS.flightByIcao }}>
                {OPERATION_ICONS.flightByIcao}
                <span className="font-mono text-sm">Flight by ICAO24</span>
              </div>
              <ResultStatus result={flightByIcaoResult} operationType="flightByIcao" />
            </div>
            <input
              type="text"
              value={icao24Input}
              onChange={(e) => setIcao24Input(e.target.value)}
              placeholder="e.g., a00001"
              className="w-full px-3 py-2 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-base)] text-[var(--tmnl-text-primary)] font-mono text-sm"
            />
            <button
              onClick={handleIngestFlightByIcao}
              disabled={isLoading.flightByIcao}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-accent-cyan)]/20 text-[var(--tmnl-accent-cyan)] hover:bg-[var(--tmnl-accent-cyan)]/30 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {isLoading.flightByIcao ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Ingest Flight
            </button>
            {/* Show result */}
            {Result.isSuccess(flightByIcaoResult) && (
              <FlightResultCard result={flightByIcaoResult.value} />
            )}
            {Result.isFailure(flightByIcaoResult) && (
              <div className="bg-[var(--tmnl-status-error)]/10 border border-[var(--tmnl-status-error)]/30 rounded p-2 text-[var(--tmnl-status-error)] text-xs">
                {String(flightByIcaoResult.cause)}
              </div>
            )}
          </div>

          {/* Flights by Region */}
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: OPERATION_COLORS.flightsByRegion }}>
                {OPERATION_ICONS.flightsByRegion}
                <span className="font-mono text-sm">Flights by Region</span>
              </div>
              <ResultStatus result={flightsByRegionResult} operationType="flightsByRegion" />
            </div>
            <input
              type="text"
              value={regionNameInput}
              onChange={(e) => setRegionNameInput(e.target.value)}
              placeholder="Region name"
              className="w-full px-3 py-2 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-base)] text-[var(--tmnl-text-primary)] font-mono text-sm"
            />
            <button
              onClick={handleIngestFlightsByRegion}
              disabled={isLoading.flightsByRegion}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-accent-cyan)]/20 text-[var(--tmnl-accent-cyan)] hover:bg-[var(--tmnl-accent-cyan)]/30 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {isLoading.flightsByRegion ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Ingest Region
            </button>
            {Result.isSuccess(flightsByRegionResult) && (
              <RegionResultCard result={flightsByRegionResult.value} />
            )}
            {Result.isFailure(flightsByRegionResult) && (
              <div className="bg-[var(--tmnl-status-error)]/10 border border-[var(--tmnl-status-error)]/30 rounded p-2 text-[var(--tmnl-status-error)] text-xs">
                {String(flightsByRegionResult.cause)}
              </div>
            )}
          </div>

          {/* POI */}
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: OPERATION_COLORS.poi }}>
                {OPERATION_ICONS.poi}
                <span className="font-mono text-sm">POI by Region</span>
              </div>
              <ResultStatus result={poiResult} operationType="poi" />
            </div>
            <button
              onClick={handleIngestPoi}
              disabled={isLoading.poi}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-accent-emerald)]/20 text-[var(--tmnl-accent-emerald)] hover:bg-[var(--tmnl-accent-emerald)]/30 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {isLoading.poi ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Ingest POIs
            </button>
            {Result.isSuccess(poiResult) && (
              <PoiResultCard result={poiResult.value} />
            )}
            {Result.isFailure(poiResult) && (
              <div className="bg-[var(--tmnl-status-error)]/10 border border-[var(--tmnl-status-error)]/30 rounded p-2 text-[var(--tmnl-status-error)] text-xs">
                {String(poiResult.cause)}
              </div>
            )}
          </div>

          {/* Weather Grid */}
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: OPERATION_COLORS.weatherGrid }}>
                {OPERATION_ICONS.weatherGrid}
                <span className="font-mono text-sm">Weather Grid</span>
              </div>
              <ResultStatus result={weatherGridResult} operationType="weatherGrid" />
            </div>
            <button
              onClick={handleIngestWeatherGrid}
              disabled={isLoading.weatherGrid}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)] hover:bg-[var(--tmnl-accent-amber)]/30 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {isLoading.weatherGrid ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Ingest Grid
            </button>
            {Result.isSuccess(weatherGridResult) && (
              <WeatherGridResultCard result={weatherGridResult.value} />
            )}
            {Result.isFailure(weatherGridResult) && (
              <div className="bg-[var(--tmnl-status-error)]/10 border border-[var(--tmnl-status-error)]/30 rounded p-2 text-[var(--tmnl-status-error)] text-xs">
                {String(weatherGridResult.cause)}
              </div>
            )}
          </div>

          {/* Weather Point */}
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: OPERATION_COLORS.weatherPoint }}>
                {OPERATION_ICONS.weatherPoint}
                <span className="font-mono text-sm">Weather Point</span>
              </div>
              <ResultStatus result={weatherPointResult} operationType="weatherPoint" />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="Lat"
                className="flex-1 px-2 py-1 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-base)] text-[var(--tmnl-text-primary)] font-mono text-xs"
              />
              <input
                type="text"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                placeholder="Lon"
                className="flex-1 px-2 py-1 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-base)] text-[var(--tmnl-text-primary)] font-mono text-xs"
              />
            </div>
            <button
              onClick={handleIngestWeatherPoint}
              disabled={isLoading.weatherPoint}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)] hover:bg-[var(--tmnl-accent-amber)]/30 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {isLoading.weatherPoint ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Ingest Point
            </button>
            {Result.isSuccess(weatherPointResult) && (
              <WeatherPointResultCard result={weatherPointResult.value} />
            )}
            {Result.isFailure(weatherPointResult) && (
              <div className="bg-[var(--tmnl-status-error)]/10 border border-[var(--tmnl-status-error)]/30 rounded p-2 text-[var(--tmnl-status-error)] text-xs">
                {String(weatherPointResult.cause)}
              </div>
            )}
          </div>

          {/* Imagery */}
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2" style={{ color: OPERATION_COLORS.imagery }}>
                {OPERATION_ICONS.imagery}
                <span className="font-mono text-sm">Imagery by Region</span>
              </div>
              <ResultStatus result={imageryResult} operationType="imagery" />
            </div>
            <button
              onClick={handleIngestImagery}
              disabled={isLoading.imagery}
              className="w-full flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-accent-rose)]/20 text-[var(--tmnl-accent-rose)] hover:bg-[var(--tmnl-accent-rose)]/30 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {isLoading.imagery ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Ingest Imagery
            </button>
            {Result.isSuccess(imageryResult) && (
              <ImageryResultCards results={imageryResult.value} />
            )}
            {Result.isFailure(imageryResult) && (
              <div className="bg-[var(--tmnl-status-error)]/10 border border-[var(--tmnl-status-error)]/30 rounded p-2 text-[var(--tmnl-status-error)] text-xs">
                {String(imageryResult.cause)}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: AtomRpc Pattern Demo */}
        <div className="space-y-4">
          <SectionLabel>AtomRpc Pattern</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-4">
            <div className="text-[var(--tmnl-text-secondary)] text-sm font-semibold">How it works:</div>
            <div className="space-y-3 text-xs">
              <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 font-mono">
                <div className="text-[var(--tmnl-accent-cyan)] mb-1">// 1. Define mutation atom</div>
                <div className="text-[var(--tmnl-text-muted)]">const mutation = IngestionClient.mutation('ingestFlightByIcao')</div>
              </div>
              <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 font-mono">
                <div className="text-[var(--tmnl-accent-emerald)] mb-1">// 2. Trigger via registry.set()</div>
                <div className="text-[var(--tmnl-text-muted)]">registry.set(mutation, {'{ icao24, source }'})</div>
              </div>
              <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 font-mono">
                <div className="text-[var(--tmnl-accent-amber)] mb-1">// 3. Subscribe via useAtomValue()</div>
                <div className="text-[var(--tmnl-text-muted)]">const result = useAtomValue(mutation)</div>
                <div className="text-[var(--tmnl-text-muted)]">// result: Result.Result{'<A, E>'}</div>
              </div>
              <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 font-mono">
                <div className="text-[var(--tmnl-accent-rose)] mb-1">// 4. Handle Result states</div>
                <div className="text-[var(--tmnl-text-muted)]">Result.isWaiting(result) {'→'} Loading</div>
                <div className="text-[var(--tmnl-text-muted)]">Result.isSuccess(result) {'→'} result.value</div>
                <div className="text-[var(--tmnl-text-muted)]">Result.isFailure(result) {'→'} result.cause</div>
              </div>
            </div>
          </div>

          <SectionLabel>Result State Legend</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-[var(--tmnl-surface-base)]" />
              <span className="text-[var(--tmnl-text-muted)]">Initial - Never executed</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Loader size={12} className="text-[var(--tmnl-accent-cyan)]" />
              <span className="text-[var(--tmnl-accent-cyan)]">Waiting - In progress</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <CheckCircle size={12} className="text-[var(--tmnl-status-success)]" />
              <span className="text-[var(--tmnl-status-success)]">Success - Completed</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <XCircle size={12} className="text-[var(--tmnl-status-error)]" />
              <span className="text-[var(--tmnl-status-error)]">Failure - Error</span>
            </div>
          </div>
        </div>

        {/* Column 3: Orchestrator Status */}
        <div className="space-y-4">
          <SectionLabel>Orchestrator</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-4">
            {/* Controls */}
            <div className="flex gap-2">
              <button
                onClick={handleStartAll}
                disabled={isLoading.orchestrator || orchestratorStatus?.running}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-status-success)]/20 text-[var(--tmnl-status-success)] hover:bg-[var(--tmnl-status-success)]/30 disabled:opacity-50"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                <Play size={14} />
                Start All
              </button>
              <button
                onClick={handleStopAll}
                disabled={isLoading.orchestrator || !orchestratorStatus?.running}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)] hover:bg-[var(--tmnl-status-error)]/30 disabled:opacity-50"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                <Square size={14} />
                Stop All
              </button>
              <button
                onClick={handleRefreshStatus}
                disabled={isLoading.orchestrator}
                className="p-2 rounded bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-muted)] hover:bg-[var(--tmnl-surface-base)]"
              >
                <RefreshCw size={14} className={isLoading.orchestrator ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Status */}
            {orchestratorStatus ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Activity size={20} className={orchestratorStatus.running ? 'text-[var(--tmnl-status-success)]' : 'text-[var(--tmnl-text-muted)]'} />
                  <div>
                    <div className="font-mono text-[var(--tmnl-text-primary)]">
                      {orchestratorStatus.running ? 'RUNNING' : 'STOPPED'}
                    </div>
                    <div className="text-[var(--tmnl-text-muted)] text-xs">
                      {orchestratorStatus.totalRecordsIngested} total records
                    </div>
                  </div>
                </div>

                {/* Ingesters */}
                <div className="space-y-2">
                  {orchestratorStatus.ingesters.map((ingester) => (
                    <div key={ingester.name} className="bg-[var(--tmnl-surface-sunken)] rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--tmnl-text-primary)] text-sm capitalize">{ingester.name}</span>
                        <div className={`w-2 h-2 rounded-full ${ingester.running ? 'bg-[var(--tmnl-status-success)] animate-pulse' : 'bg-[var(--tmnl-surface-base)]'}`} />
                      </div>
                      <div className="text-[var(--tmnl-text-muted)] text-xs mt-1">
                        {ingester.recordsIngested} records • {ingester.errorCount} errors
                      </div>
                      {ingester.lastError && (
                        <div className="text-[var(--tmnl-status-error)] text-xs mt-1 truncate">
                          {ingester.lastError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[var(--tmnl-text-muted)] text-center py-4 text-sm">
                Click refresh to get orchestrator status
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Logs & Architecture */}
        <div className="space-y-4">
          <SectionLabel>Logs</SectionLabel>
          <div
            className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-48 overflow-y-auto font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {logs.length === 0 ? (
              <div className="text-[var(--tmnl-text-muted)]">Waiting for operations...</div>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="text-[var(--tmnl-text-muted)]">
                  {entry}
                </div>
              ))
            )}
          </div>

          <SectionLabel>Architecture</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <div className="text-[var(--tmnl-text-muted)] space-y-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              <div className="text-[var(--tmnl-text-secondary)] font-semibold mb-2">Data Flow:</div>
              <div className="font-mono">Browser</div>
              <div className="pl-2 text-[var(--tmnl-accent-cyan)]">↓ registry.set(mutation, payload)</div>
              <div className="font-mono">AtomRpc Layer</div>
              <div className="pl-2 text-[var(--tmnl-accent-cyan)]">↓ WebSocket RPC</div>
              <div className="font-mono">IngestionRpcServer</div>
              <div className="pl-2 text-[var(--tmnl-accent-emerald)]">↓ Cluster Client</div>
              <div className="font-mono">Effect Cluster</div>
              <div className="pl-2 text-[var(--tmnl-accent-amber)]">↓ Entity Handlers</div>
              <div className="font-mono">External APIs → PostgreSQL</div>
              <div className="pl-2 text-[var(--tmnl-accent-rose)]">↓ DurableStreams</div>
              <div className="font-mono">Materializer → Electric → UI</div>
            </div>
          </div>

          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4">
            <div className="text-[var(--tmnl-text-muted)] text-xs space-y-1">
              <div><strong className="text-[var(--tmnl-text-secondary)]">AtomRpc:</strong> Reactive RPC with atom-backed results</div>
              <div><strong className="text-[var(--tmnl-text-secondary)]">Result:</strong> Initial | Waiting | Success | Failure</div>
              <div><strong className="text-[var(--tmnl-text-secondary)]">Pattern:</strong> registry.set() triggers, useAtomValue() subscribes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component (wraps with RegistryProvider)
// =============================================================================

export function IngestionTestbed() {
  return (
    <RegistryContext.Provider value={ingestionTestbedRegistry}>
      <IngestionTestbedInner />
    </RegistryContext.Provider>
  )
}

export default IngestionTestbed

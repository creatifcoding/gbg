/**
 * Electric Sync Testbed
 *
 * Demonstrates the ElectricSQL shape sync patterns from ecs/electric:
 * - useEntities() and typed variants (useFlightEntities, usePoiEntities, etc.)
 * - useSpatialTraits(), useKineticTraits(), useIdentifiableTraits()
 * - useFlightEntitiesWithTraits() - composite hook with trait joins
 * - createEntityStream() for Effect service contexts
 * - parseEntityRow() for JSONB hydration
 *
 * Route: /testbed/electric-sync
 *
 * HYPOTHESES:
 * - H1: Shape subscriptions receive real-time updates
 * - H2: Trait joins match entities correctly by entity_id
 * - H3: JSONB fields parse correctly (provenance, metadata, external_ids)
 * - H4: Type-filtered hooks return correct entity types
 *
 * NOTE: Requires Electric server running at VITE_ELECTRIC_URL (default: localhost:3000)
 * Falls back to mock data if Electric is unavailable.
 *
 * @module testbed/electric-sync
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  RefreshCw,
  Plane,
  MapPin,
  Cloud,
  Database,
  Activity,
  Zap,
  Layers,
  AlertCircle,
} from 'lucide-react'
import { SectionLabel } from '@/components/testbed/shared'

// Import Electric hooks (these may fail if Electric not running)
import {
  ELECTRIC_URL,
  SHAPE_ENDPOINT,
  type ParsedEntity,
  type FlightEntityWithTraits,
  useEntities,
  useFlightEntities,
  usePoiEntities,
  useWeatherEntities,
  useSpatialTraits,
  useKineticTraits,
  useIdentifiableTraits,
  useFlightEntitiesWithTraits,
} from '@/lib/ecs/electric'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_realTimeUpdates: boolean
  h2_traitJoins: boolean
  h3_jsonbParsing: boolean
  h4_typeFiltering: boolean
}

const initialHypotheses: Hypotheses = {
  h1_realTimeUpdates: false,
  h2_traitJoins: false,
  h3_jsonbParsing: false,
  h4_typeFiltering: false,
}

// =============================================================================
// Connection Status
// =============================================================================

type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'mock'

// =============================================================================
// Entity Type Icons
// =============================================================================

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  flight: <Plane size={14} />,
  poi: <MapPin size={14} />,
  weather: <Cloud size={14} />,
  track: <Activity size={14} />,
  imagery: <Layers size={14} />,
}

const ENTITY_COLORS: Record<string, string> = {
  flight: 'var(--tmnl-accent-cyan)',
  poi: 'var(--tmnl-accent-emerald)',
  weather: 'var(--tmnl-accent-amber)',
  track: 'var(--tmnl-accent-rose)',
  imagery: 'var(--tmnl-status-info)',
}

// =============================================================================
// Entity Row Display
// =============================================================================

interface EntityDisplayProps {
  entity: ParsedEntity
  spatial?: { position: string }
  kinetic?: { heading: number; speed: number }
  identifiable?: { callsign: string | null; external_ids: string }
}

function EntityDisplay({ entity, spatial, kinetic, identifiable }: EntityDisplayProps) {
  const entityType = entity['entity_type'] as string
  const entityId = entity['entity_id'] as string
  const isStale = entity['is_stale'] as boolean
  const confidence = entity['confidence'] as number
  const revision = entity['revision'] as number

  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: ENTITY_COLORS[entityType] || 'var(--tmnl-text-muted)' }}>
            {ENTITY_ICONS[entityType] || <Database size={14} />}
          </span>
          <span
            className="font-mono text-[var(--tmnl-text-primary)]"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {entityId.slice(0, 20)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[var(--tmnl-text-muted)]"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {entityType.toUpperCase()}
          </span>
          {!isStale && (
            <div className="w-2 h-2 rounded-full bg-[var(--tmnl-status-success)]" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <div>
          <span className="text-[var(--tmnl-text-tertiary)]">Confidence:</span>{' '}
          {(confidence * 100).toFixed(0)}%
        </div>
        <div>
          <span className="text-[var(--tmnl-text-tertiary)]">Revision:</span> {revision}
        </div>
      </div>

      {/* Traits */}
      {spatial && (
        <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <span className="text-[var(--tmnl-accent-cyan)]">Spatial:</span> {spatial.position.slice(0, 40)}...
        </div>
      )}
      {kinetic && (
        <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <span className="text-[var(--tmnl-accent-amber)]">Kinetic:</span> {kinetic.heading.toFixed(0)}° @ {kinetic.speed.toFixed(0)} kts
        </div>
      )}
      {identifiable?.callsign && (
        <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <span className="text-[var(--tmnl-accent-emerald)]">Callsign:</span> {identifiable.callsign}
        </div>
      )}

      {/* Metadata preview */}
      {Object.keys(entity.metadata).length > 0 && (
        <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          <span className="text-[var(--tmnl-text-tertiary)]">Metadata:</span>{' '}
          {JSON.stringify(entity.metadata).slice(0, 50)}...
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Flight With Traits Display
// =============================================================================

function FlightWithTraitsDisplay({ flight }: { flight: FlightEntityWithTraits }) {
  return (
    <div className="bg-[var(--tmnl-surface-sunken)] rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane size={14} className="text-[var(--tmnl-accent-cyan)]" />
          <span
            className="font-mono text-[var(--tmnl-text-primary)]"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {flight.icao24 || flight.entityId.slice(0, 12)}
          </span>
          {flight.callsign && (
            <span
              className="text-[var(--tmnl-accent-amber)]"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              ({flight.callsign})
            </span>
          )}
        </div>
        <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {(flight.confidence * 100).toFixed(0)}% conf
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Position
          </div>
          <div className="font-mono text-[var(--tmnl-accent-cyan)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {flight.position[1].toFixed(3)}, {flight.position[0].toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Altitude
          </div>
          <div className="font-mono text-[var(--tmnl-text-primary)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {Math.round(flight.position[2])}m
          </div>
        </div>
        <div>
          <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Heading
          </div>
          <div className="font-mono text-[var(--tmnl-accent-amber)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {flight.heading.toFixed(0)}°
          </div>
        </div>
      </div>

      <div className="flex justify-between text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        <span>Speed: {flight.speed.toFixed(0)} kts</span>
        <span>V/S: {flight.verticalRate.toFixed(0)} fpm</span>
        <span>Updated: {flight.updatedAt.toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function ElectricSyncTestbed() {
  // Hypotheses state
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')

  // Selected entity type filter
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-14), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Check Electric connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${ELECTRIC_URL}/v1/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok) {
          setConnectionStatus('connected')
          log(`Connected to Electric at ${ELECTRIC_URL}`)
        } else {
          setConnectionStatus('disconnected')
          log(`Electric returned status ${response.status}`)
        }
      } catch (e) {
        setConnectionStatus('disconnected')
        log(`Electric not available at ${ELECTRIC_URL}`)
      }
    }
    checkConnection()
  }, [log])

  // Use Electric hooks (these will show loading/error states if Electric not running)
  const allEntities = useEntities()
  const flightEntities = useFlightEntities()
  const poiEntities = usePoiEntities()
  const weatherEntities = useWeatherEntities()
  const spatialTraits = useSpatialTraits()
  const kineticTraits = useKineticTraits()
  const identifiableTraits = useIdentifiableTraits()
  const flightsWithTraits = useFlightEntitiesWithTraits()

  // Track previous counts for real-time update detection
  const [prevEntityCount, setPrevEntityCount] = useState(0)

  useEffect(() => {
    if (allEntities.data.length !== prevEntityCount && prevEntityCount > 0) {
      log(`Entity count changed: ${prevEntityCount} → ${allEntities.data.length}`)
      setHypotheses((h) => ({ ...h, h1_realTimeUpdates: true }))
    }
    setPrevEntityCount(allEntities.data.length)
  }, [allEntities.data.length, prevEntityCount, log])

  // Check H2: Trait joins
  useEffect(() => {
    if (flightsWithTraits.data.length > 0) {
      const withPosition = flightsWithTraits.data.filter(
        (f) => f.position[0] !== 0 || f.position[1] !== 0
      )
      if (withPosition.length > 0) {
        setHypotheses((h) => ({ ...h, h2_traitJoins: true }))
        log(`H2: ${withPosition.length} flights with valid position traits`)
      }
    }
  }, [flightsWithTraits.data, log])

  // Check H3: JSONB parsing
  useEffect(() => {
    const withMetadata = allEntities.data.filter(
      (e) => Object.keys(e.metadata).length > 0 || Object.keys(e.provenance).length > 0
    )
    if (withMetadata.length > 0) {
      setHypotheses((h) => ({ ...h, h3_jsonbParsing: true }))
      log(`H3: ${withMetadata.length} entities with parsed JSONB fields`)
    }
  }, [allEntities.data, log])

  // Check H4: Type filtering
  useEffect(() => {
    if (
      flightEntities.data.length > 0 ||
      poiEntities.data.length > 0 ||
      weatherEntities.data.length > 0
    ) {
      const flightsAllFlight = flightEntities.data.every((e) => e['entity_type'] === 'flight')
      const poisAllPoi = poiEntities.data.every((e) => e['entity_type'] === 'poi')
      const weatherAllWeather = weatherEntities.data.every((e) => e['entity_type'] === 'weather')

      if (flightsAllFlight && poisAllPoi && weatherAllWeather) {
        setHypotheses((h) => ({ ...h, h4_typeFiltering: true }))
      }
    }
  }, [flightEntities.data, poiEntities.data, weatherEntities.data])

  // Filtered entities based on selected type
  const displayedEntities = useMemo(() => {
    if (!selectedType) return allEntities.data
    return allEntities.data.filter((e) => e['entity_type'] === selectedType)
  }, [allEntities.data, selectedType])

  // Get traits for an entity
  const getTraitsForEntity = useCallback(
    (entityId: string) => {
      return {
        spatial: spatialTraits.data?.find((s) => s.entity_id === entityId),
        kinetic: kineticTraits.data?.find((k) => k.entity_id === entityId),
        identifiable: identifiableTraits.data?.find((i) => i.entity_id === entityId),
      }
    },
    [spatialTraits.data, kineticTraits.data, identifiableTraits.data]
  )

  // Entity type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const entity of allEntities.data) {
      const type = entity['entity_type'] as string
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }, [allEntities.data])

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
          Electric Sync Testbed
        </h1>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-[var(--tmnl-status-success)]/20 text-[var(--tmnl-status-success)]'
              : connectionStatus === 'checking'
              ? 'bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)]'
              : 'bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)]'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <Zap size={12} />
          {connectionStatus === 'connected' ? 'Electric Connected' : connectionStatus === 'checking' ? 'Checking...' : 'Electric Offline'}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Column 1: Connection & Stats */}
        <div className="space-y-4">
          <SectionLabel>Connection Info</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div>
              <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Electric URL
              </div>
              <div className="font-mono text-[var(--tmnl-text-primary)] truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                {ELECTRIC_URL}
              </div>
            </div>
            <div>
              <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Shape Endpoint
              </div>
              <div className="font-mono text-[var(--tmnl-text-primary)] truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                {SHAPE_ENDPOINT}
              </div>
            </div>
          </div>

          <SectionLabel>Shape Stats</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Total Entities
              </span>
              <span className="font-mono text-[var(--tmnl-accent-cyan)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {allEntities.data.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Spatial Traits
              </span>
              <span className="font-mono text-[var(--tmnl-accent-cyan)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {spatialTraits.data?.length ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Kinetic Traits
              </span>
              <span className="font-mono text-[var(--tmnl-accent-amber)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {kineticTraits.data?.length ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Identifiable
              </span>
              <span className="font-mono text-[var(--tmnl-accent-emerald)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {identifiableTraits.data?.length ?? 0}
              </span>
            </div>
            <hr className="border-[var(--tmnl-surface-sunken)]" />
            <div className="flex justify-between">
              <span className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Flights w/ Traits
              </span>
              <span className="font-mono text-[var(--tmnl-status-success)]" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {flightsWithTraits.data.length}
              </span>
            </div>
          </div>

          {/* Type filter */}
          <SectionLabel>Filter by Type</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            <button
              onClick={() => setSelectedType(null)}
              className={`w-full text-left p-2 rounded transition-colors ${
                selectedType === null
                  ? 'bg-[var(--tmnl-accent-cyan)]/20 text-[var(--tmnl-accent-cyan)]'
                  : 'bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-muted)] hover:bg-[var(--tmnl-surface-base)]'
              }`}
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              All Types ({allEntities.data.length})
            </button>
            {Object.entries(typeCounts).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`w-full text-left p-2 rounded flex items-center gap-2 transition-colors ${
                  selectedType === type
                    ? 'bg-[var(--tmnl-accent-cyan)]/20 text-[var(--tmnl-accent-cyan)]'
                    : 'bg-[var(--tmnl-surface-sunken)] text-[var(--tmnl-text-muted)] hover:bg-[var(--tmnl-surface-base)]'
                }`}
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                <span style={{ color: ENTITY_COLORS[type] }}>{ENTITY_ICONS[type]}</span>
                {type} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Column 2-3: Entity List / Flights with Traits */}
        <div className="col-span-2 space-y-4">
          {/* Flights with Traits section */}
          <SectionLabel>Flights with Joined Traits ({flightsWithTraits.data.length})</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 max-h-[300px] overflow-y-auto">
            {flightsWithTraits.isLoading ? (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                Loading flights...
              </div>
            ) : flightsWithTraits.error ? (
              <div className="text-center text-[var(--tmnl-status-error)] py-8">
                <AlertCircle size={20} className="mx-auto mb-2" />
                Error loading flights
              </div>
            ) : flightsWithTraits.data.length === 0 ? (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                No flight entities with traits. Start the ingestion pipeline to see data.
              </div>
            ) : (
              <div className="space-y-2">
                {flightsWithTraits.data.slice(0, 10).map((flight) => (
                  <FlightWithTraitsDisplay key={flight.dbId} flight={flight} />
                ))}
                {flightsWithTraits.data.length > 10 && (
                  <div className="text-center text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    ... and {flightsWithTraits.data.length - 10} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Raw Entities section */}
          <SectionLabel>Raw Entities ({displayedEntities.length})</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 max-h-[300px] overflow-y-auto">
            {allEntities.isLoading ? (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8">
                <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                Loading entities...
              </div>
            ) : allEntities.error ? (
              <div className="text-center text-[var(--tmnl-status-error)] py-8">
                <AlertCircle size={20} className="mx-auto mb-2" />
                Error: {String(allEntities.error)}
              </div>
            ) : displayedEntities.length === 0 ? (
              <div className="text-center text-[var(--tmnl-text-muted)] py-8" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                No entities found. Electric may not be connected or tables are empty.
              </div>
            ) : (
              <div className="space-y-2">
                {displayedEntities.slice(0, 10).map((entity) => {
                  const entityId = entity['id'] as string
                  const traits = getTraitsForEntity(entityId)
                  return (
                    <EntityDisplay
                      key={entityId}
                      entity={entity}
                      spatial={traits.spatial as any}
                      kinetic={traits.kinetic as any}
                      identifiable={traits.identifiable as any}
                    />
                  )
                })}
                {displayedEntities.length > 10 && (
                  <div className="text-center text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    ... and {displayedEntities.length - 10} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Hypotheses & Logs */}
        <div className="space-y-4">
          <SectionLabel>Hypotheses</SectionLabel>
          <div className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 space-y-2">
            {[
              { key: 'h1_realTimeUpdates', label: 'H1: Real-time updates received' },
              { key: 'h2_traitJoins', label: 'H2: Trait joins work correctly' },
              { key: 'h3_jsonbParsing', label: 'H3: JSONB fields parsed' },
              { key: 'h4_typeFiltering', label: 'H4: Type filtering correct' },
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
            className="bg-[var(--tmnl-surface-sunken)] rounded-lg p-3 h-48 overflow-y-auto font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {logs.map((log, i) => (
              <div key={i} className="text-[var(--tmnl-text-muted)]">
                {log}
              </div>
            ))}
          </div>

          <SectionLabel>Pattern Notes</SectionLabel>
          <div
            className="bg-[var(--tmnl-surface-raised)] rounded-lg p-4 text-[var(--tmnl-text-muted)] space-y-2"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">useShape:</strong> Electric hook for shape subscriptions. Params define table and where clause.
            </p>
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">parseEntityRow:</strong> Hydrates JSONB fields (provenance, metadata) from string to object.
            </p>
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">Trait Joins:</strong> useFlightEntitiesWithTraits joins entities with spatial/kinetic/identifiable by entity_id.
            </p>
            <p>
              <strong className="text-[var(--tmnl-text-primary)]">Type Filtering:</strong> entityShapeParams builds WHERE clause for entity_type filtering.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ElectricSyncTestbed

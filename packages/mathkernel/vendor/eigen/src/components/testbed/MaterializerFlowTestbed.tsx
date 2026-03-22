/**
 * Materializer Flow Testbed - Ingestion → DurableStream → Materializer → Electric
 *
 * Demonstrates the complete data flow from external APIs to React hooks:
 * 1. FlightIngester polls OpenSky/ADSB.lol APIs
 * 2. Transactional write: Postgres + DurableStream in same transaction
 * 3. FlightEntityMaterializer subscribes to DurableStream
 * 4. Materializer upserts ECS entities with spatial/kinetic/identifiable traits
 * 5. Electric syncs entity tables to browser
 * 6. useFlightEntitiesWithTraits() joins entities with traits for UI
 *
 * Key patterns shown:
 * - Transactional Outbox Pattern (DB write + stream publish atomically)
 * - Stream subscription with offset tracking for reconnection
 * - Trait-based ECS with PostGIS spatial data
 * - Electric Shape hooks for real-time sync
 *
 * Route: /testbed/materializer-flow
 *
 * @module testbed/MaterializerFlowTestbed
 */

import { useEffect } from 'react'
import { useAtomValue, RegistryContext } from '@effect-atom/atom-react'
import { Atom, Registry } from '@effect-atom/atom'
import {
  Database,
  Radio,
  Plane,
  MapPin,
  RefreshCw,
  Play,
  Pause,
  Zap,
  ArrowRight,
  Activity,
  Layers,
} from 'lucide-react'

// =============================================================================
// TESTBED REGISTRY
// =============================================================================

const testbedRegistry = Registry.make()

// =============================================================================
// MOCK DATA FLOW STATE
// =============================================================================

/** Simulated ingester status */
interface IngesterStatus {
  readonly name: string
  readonly running: boolean
  readonly eventsIngested: number
  readonly lastPollAt: Date | null
  readonly errorCount: number
}

const ingesterStatusAtom = Atom.make<IngesterStatus>({
  name: 'flight',
  running: false,
  eventsIngested: 0,
  lastPollAt: null,
  errorCount: 0,
})

/** Simulated DurableStream status */
interface StreamStatus {
  readonly connected: boolean
  readonly offset: string
  readonly eventsPublished: number
  readonly subscribers: number
}

const streamStatusAtom = Atom.make<StreamStatus>({
  connected: false,
  offset: '0',
  eventsPublished: 0,
  subscribers: 0,
})

/** Simulated Materializer status */
interface MaterializerStatus {
  readonly running: boolean
  readonly eventsProcessed: number
  readonly entitiesCreated: number
  readonly entitiesUpdated: number
  readonly lastEventAt: Date | null
  readonly currentOffset: string
}

const materializerStatusAtom = Atom.make<MaterializerStatus>({
  running: false,
  eventsProcessed: 0,
  entitiesCreated: 0,
  entitiesUpdated: 0,
  lastEventAt: null,
  currentOffset: '0',
})

/** Simulated Electric sync status */
interface ElectricStatus {
  readonly connected: boolean
  readonly entitiesCount: number
  readonly spatialTraitsCount: number
  readonly kineticTraitsCount: number
  readonly lastSyncAt: Date | null
}

const electricStatusAtom = Atom.make<ElectricStatus>({
  connected: false,
  entitiesCount: 0,
  spatialTraitsCount: 0,
  kineticTraitsCount: 0,
  lastSyncAt: null,
})

/** Simulated flight entities (what useFlightEntitiesWithTraits would return) */
interface FlightEntity {
  readonly entityId: string
  readonly icao24: string
  readonly callsign: string | null
  readonly position: [number, number, number]
  readonly heading: number
  readonly speed: number
  readonly verticalRate: number
  readonly updatedAt: Date
}

const flightEntitiesAtom = Atom.make<readonly FlightEntity[]>([])

/** Event log for visualization */
interface FlowEvent {
  readonly id: string
  readonly stage: 'ingester' | 'postgres' | 'stream' | 'materializer' | 'electric' | 'react'
  readonly message: string
  readonly timestamp: Date
}

const flowEventsAtom = Atom.make<readonly FlowEvent[]>([])

// =============================================================================
// SIMULATION CONTROLS
// =============================================================================

let ingesterInterval: ReturnType<typeof setInterval> | null = null

function addFlowEvent(stage: FlowEvent['stage'], message: string) {
  const events = testbedRegistry.get(flowEventsAtom)
  const newEvent: FlowEvent = {
    id: `event-${Date.now()}-${Math.random()}`,
    stage,
    message,
    timestamp: new Date(),
  }
  testbedRegistry.set(flowEventsAtom, [newEvent, ...events.slice(0, 19)])
}

function generateMockFlight(): FlightEntity {
  const icao24 = Math.random().toString(36).substring(2, 8).toUpperCase()
  return {
    entityId: `flight-${icao24}`,
    icao24,
    callsign: `UAL${Math.floor(Math.random() * 9999)}`,
    position: [
      -122.5 + Math.random() * 0.4,
      37.6 + Math.random() * 0.4,
      5000 + Math.random() * 35000,
    ],
    heading: Math.random() * 360,
    speed: 150 + Math.random() * 400,
    verticalRate: (Math.random() - 0.5) * 30,
    updatedAt: new Date(),
  }
}

function startIngester() {
  if (ingesterInterval) return

  testbedRegistry.set(ingesterStatusAtom, {
    ...testbedRegistry.get(ingesterStatusAtom),
    running: true,
  })

  addFlowEvent('ingester', 'FlightIngester started - polling OpenSky API')

  ingesterInterval = setInterval(() => {
    const status = testbedRegistry.get(ingesterStatusAtom)
    const streamStatus = testbedRegistry.get(streamStatusAtom)
    const batchSize = 1 + Math.floor(Math.random() * 3)

    // Simulate API poll
    addFlowEvent('ingester', `Polled ${batchSize} positions from OpenSky`)

    // Update ingester stats
    testbedRegistry.set(ingesterStatusAtom, {
      ...status,
      eventsIngested: status.eventsIngested + batchSize,
      lastPollAt: new Date(),
    })

    // Simulate transactional write (Postgres + Stream)
    setTimeout(() => {
      addFlowEvent('postgres', `Inserted ${batchSize} rows into raw.flight_positions`)

      // Publish to stream
      setTimeout(() => {
        const newOffset = String(parseInt(streamStatus.offset) + batchSize)
        testbedRegistry.set(streamStatusAtom, {
          ...streamStatus,
          connected: true,
          offset: newOffset,
          eventsPublished: streamStatus.eventsPublished + batchSize,
          subscribers: testbedRegistry.get(materializerStatusAtom).running ? 1 : 0,
        })
        addFlowEvent('stream', `Published ${batchSize} FlightPositionEvents (offset: ${newOffset})`)

        // Trigger materializer if running
        if (testbedRegistry.get(materializerStatusAtom).running) {
          processMaterializerBatch(batchSize)
        }
      }, 100)
    }, 50)
  }, 3000)
}

function stopIngester() {
  if (ingesterInterval) {
    clearInterval(ingesterInterval)
    ingesterInterval = null
  }

  testbedRegistry.set(ingesterStatusAtom, {
    ...testbedRegistry.get(ingesterStatusAtom),
    running: false,
  })

  addFlowEvent('ingester', 'FlightIngester stopped')
}

function processMaterializerBatch(count: number) {
  const matStatus = testbedRegistry.get(materializerStatusAtom)
  const streamStatus = testbedRegistry.get(streamStatusAtom)
  const currentEntities = testbedRegistry.get(flightEntitiesAtom)

  addFlowEvent('materializer', `Processing batch of ${count} events`)

  // Simulate entity upserts
  const newEntities: FlightEntity[] = []
  let created = 0
  let updated = 0

  for (let i = 0; i < count; i++) {
    if (Math.random() > 0.3 && currentEntities.length > 0) {
      // Update existing entity
      updated++
    } else {
      // Create new entity
      newEntities.push(generateMockFlight())
      created++
    }
  }

  testbedRegistry.set(materializerStatusAtom, {
    ...matStatus,
    eventsProcessed: matStatus.eventsProcessed + count,
    entitiesCreated: matStatus.entitiesCreated + created,
    entitiesUpdated: matStatus.entitiesUpdated + updated,
    lastEventAt: new Date(),
    currentOffset: streamStatus.offset,
  })

  addFlowEvent('materializer', `Created ${created}, updated ${updated} entities`)

  // Update flight entities
  testbedRegistry.set(flightEntitiesAtom, [...currentEntities, ...newEntities].slice(-50))

  // Simulate Electric sync
  setTimeout(() => {
    const allEntities = testbedRegistry.get(flightEntitiesAtom)
    testbedRegistry.set(electricStatusAtom, {
      connected: true,
      entitiesCount: allEntities.length,
      spatialTraitsCount: allEntities.length,
      kineticTraitsCount: allEntities.length,
      lastSyncAt: new Date(),
    })
    addFlowEvent('electric', `Synced ${allEntities.length} entities to browser`)

    // React update
    addFlowEvent('react', `useFlightEntitiesWithTraits() → ${allEntities.length} flights`)
  }, 200)
}

function startMaterializer() {
  testbedRegistry.set(materializerStatusAtom, {
    ...testbedRegistry.get(materializerStatusAtom),
    running: true,
  })

  testbedRegistry.set(streamStatusAtom, {
    ...testbedRegistry.get(streamStatusAtom),
    subscribers: 1,
  })

  addFlowEvent('materializer', 'FlightEntityMaterializer started - subscribing to /flights stream')
}

function stopMaterializer() {
  testbedRegistry.set(materializerStatusAtom, {
    ...testbedRegistry.get(materializerStatusAtom),
    running: false,
  })

  testbedRegistry.set(streamStatusAtom, {
    ...testbedRegistry.get(streamStatusAtom),
    subscribers: 0,
  })

  addFlowEvent('materializer', 'FlightEntityMaterializer stopped')
}

function resetAll() {
  stopIngester()
  stopMaterializer()

  testbedRegistry.set(ingesterStatusAtom, {
    name: 'flight',
    running: false,
    eventsIngested: 0,
    lastPollAt: null,
    errorCount: 0,
  })

  testbedRegistry.set(streamStatusAtom, {
    connected: false,
    offset: '0',
    eventsPublished: 0,
    subscribers: 0,
  })

  testbedRegistry.set(materializerStatusAtom, {
    running: false,
    eventsProcessed: 0,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    lastEventAt: null,
    currentOffset: '0',
  })

  testbedRegistry.set(electricStatusAtom, {
    connected: false,
    entitiesCount: 0,
    spatialTraitsCount: 0,
    kineticTraitsCount: 0,
    lastSyncAt: null,
  })

  testbedRegistry.set(flightEntitiesAtom, [])
  testbedRegistry.set(flowEventsAtom, [])

  addFlowEvent('react', 'System reset')
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--tmnl-surface-0, #0a0a0a)',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    fontFamily: 'var(--tmnl-font-mono, monospace)',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--tmnl-border, #333)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    padding: '2px 8px',
    backgroundColor: 'var(--tmnl-accent-emerald, #10b981)',
    color: 'black',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  flowContainer: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '12px',
    padding: '24px',
    overflowX: 'auto' as const,
  },
  stageCard: {
    flex: '1',
    minWidth: '180px',
    backgroundColor: 'var(--tmnl-surface-1, #111)',
    border: '1px solid var(--tmnl-border, #333)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  stageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--tmnl-text-secondary, #888)',
  },
  statValue: {
    fontWeight: 600,
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    fontFamily: 'var(--tmnl-font-mono, monospace)',
  },
  arrow: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--tmnl-text-secondary, #555)',
  },
  button: {
    padding: '8px 14px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
  },
  primaryButton: {
    backgroundColor: 'var(--tmnl-accent-emerald, #10b981)',
    color: 'black',
  },
  secondaryButton: {
    backgroundColor: 'var(--tmnl-surface-2, #222)',
    color: 'var(--tmnl-text-primary, #e0e0e0)',
    border: '1px solid var(--tmnl-border, #444)',
  },
  dangerButton: {
    backgroundColor: 'var(--tmnl-accent-red, #ef4444)',
    color: 'white',
  },
  eventsPanel: {
    margin: '0 24px 24px',
    backgroundColor: 'var(--tmnl-surface-1, #111)',
    border: '1px solid var(--tmnl-border, #333)',
    borderRadius: '8px',
    padding: '16px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  eventItem: {
    padding: '6px 10px',
    borderRadius: '4px',
    marginBottom: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  entitiesPanel: {
    margin: '0 24px 24px',
    backgroundColor: 'var(--tmnl-surface-1, #111)',
    border: '1px solid var(--tmnl-border, #333)',
    borderRadius: '8px',
    padding: '16px',
  },
} as const

// =============================================================================
// COMPONENTS
// =============================================================================

const stageColors: Record<FlowEvent['stage'], string> = {
  ingester: '#f59e0b',
  postgres: '#06b6d4',
  stream: '#a855f7',
  materializer: '#22c55e',
  electric: '#3b82f6',
  react: '#ec4899',
}

function IngesterStage() {
  const status = useAtomValue(ingesterStatusAtom)

  return (
    <div style={styles.stageCard}>
      <div style={styles.stageHeader}>
        <Plane style={{ width: 16, height: 16, color: '#f59e0b' }} />
        <span>INGESTER</span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            backgroundColor: status.running ? '#22c55e20' : '#66666620',
            color: status.running ? '#22c55e' : '#666',
          }}
        >
          {status.running ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>
      <div style={styles.statRow}>
        <span>Events Ingested</span>
        <span style={styles.statValue}>{status.eventsIngested}</span>
      </div>
      <div style={styles.statRow}>
        <span>Last Poll</span>
        <span style={styles.statValue}>
          {status.lastPollAt ? status.lastPollAt.toLocaleTimeString() : '-'}
        </span>
      </div>
      <button
        style={{
          ...styles.button,
          ...(status.running ? styles.dangerButton : styles.primaryButton),
          marginTop: 'auto',
        }}
        onClick={status.running ? stopIngester : startIngester}
      >
        {status.running ? <Pause style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
        {status.running ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}

function PostgresStage() {
  const ingesterStatus = useAtomValue(ingesterStatusAtom)

  return (
    <div style={styles.stageCard}>
      <div style={styles.stageHeader}>
        <Database style={{ width: 16, height: 16, color: '#06b6d4' }} />
        <span>POSTGRES</span>
      </div>
      <div style={styles.statRow}>
        <span>raw.flight_positions</span>
        <span style={styles.statValue}>{ingesterStatus.eventsIngested}</span>
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
        Transactional write ensures consistency with DurableStream
      </div>
    </div>
  )
}

function StreamStage() {
  const status = useAtomValue(streamStatusAtom)

  return (
    <div style={styles.stageCard}>
      <div style={styles.stageHeader}>
        <Radio style={{ width: 16, height: 16, color: '#a855f7' }} />
        <span>DURABLE STREAM</span>
      </div>
      <div style={styles.statRow}>
        <span>Events Published</span>
        <span style={styles.statValue}>{status.eventsPublished}</span>
      </div>
      <div style={styles.statRow}>
        <span>Current Offset</span>
        <span style={styles.statValue}>{status.offset}</span>
      </div>
      <div style={styles.statRow}>
        <span>Subscribers</span>
        <span style={styles.statValue}>{status.subscribers}</span>
      </div>
    </div>
  )
}

function MaterializerStage() {
  const status = useAtomValue(materializerStatusAtom)

  return (
    <div style={styles.stageCard}>
      <div style={styles.stageHeader}>
        <Layers style={{ width: 16, height: 16, color: '#22c55e' }} />
        <span>MATERIALIZER</span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            backgroundColor: status.running ? '#22c55e20' : '#66666620',
            color: status.running ? '#22c55e' : '#666',
          }}
        >
          {status.running ? 'RUNNING' : 'STOPPED'}
        </span>
      </div>
      <div style={styles.statRow}>
        <span>Events Processed</span>
        <span style={styles.statValue}>{status.eventsProcessed}</span>
      </div>
      <div style={styles.statRow}>
        <span>Entities Created</span>
        <span style={{ ...styles.statValue, color: '#22c55e' }}>{status.entitiesCreated}</span>
      </div>
      <div style={styles.statRow}>
        <span>Entities Updated</span>
        <span style={{ ...styles.statValue, color: '#f59e0b' }}>{status.entitiesUpdated}</span>
      </div>
      <div style={styles.statRow}>
        <span>Offset</span>
        <span style={styles.statValue}>{status.currentOffset}</span>
      </div>
      <button
        style={{
          ...styles.button,
          ...(status.running ? styles.dangerButton : styles.primaryButton),
          marginTop: 'auto',
        }}
        onClick={status.running ? stopMaterializer : startMaterializer}
      >
        {status.running ? <Pause style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
        {status.running ? 'Stop' : 'Start'}
      </button>
    </div>
  )
}

function ElectricStage() {
  const status = useAtomValue(electricStatusAtom)

  return (
    <div style={styles.stageCard}>
      <div style={styles.stageHeader}>
        <Zap style={{ width: 16, height: 16, color: '#3b82f6' }} />
        <span>ELECTRIC</span>
        <span
          style={{
            marginLeft: 'auto',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            backgroundColor: status.connected ? '#3b82f620' : '#66666620',
            color: status.connected ? '#3b82f6' : '#666',
          }}
        >
          {status.connected ? 'SYNCED' : 'WAITING'}
        </span>
      </div>
      <div style={styles.statRow}>
        <span>entity.entities</span>
        <span style={styles.statValue}>{status.entitiesCount}</span>
      </div>
      <div style={styles.statRow}>
        <span>entity.spatial</span>
        <span style={styles.statValue}>{status.spatialTraitsCount}</span>
      </div>
      <div style={styles.statRow}>
        <span>entity.kinetic</span>
        <span style={styles.statValue}>{status.kineticTraitsCount}</span>
      </div>
    </div>
  )
}

function ReactStage() {
  const entities = useAtomValue(flightEntitiesAtom)

  return (
    <div style={styles.stageCard}>
      <div style={styles.stageHeader}>
        <Activity style={{ width: 16, height: 16, color: '#ec4899' }} />
        <span>REACT HOOK</span>
      </div>
      <div style={styles.statRow}>
        <span>useFlightEntitiesWithTraits()</span>
        <span style={{ ...styles.statValue, color: '#ec4899' }}>{entities.length}</span>
      </div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
        Joined entity + spatial + kinetic + identifiable traits
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <div style={styles.arrow}>
      <ArrowRight style={{ width: 20, height: 20 }} />
    </div>
  )
}

function EventLog() {
  const events = useAtomValue(flowEventsAtom)

  return (
    <div style={styles.eventsPanel}>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity style={{ width: 16, height: 16, color: '#888' }} />
        Event Log
      </div>
      {events.length === 0 ? (
        <div style={{ color: '#666', fontSize: '12px' }}>No events yet. Start the ingester to see the flow.</div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            style={{
              ...styles.eventItem,
              backgroundColor: `${stageColors[event.stage]}10`,
            }}
          >
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: stageColors[event.stage],
                color: 'black',
                fontSize: '10px',
                fontWeight: 600,
                minWidth: '80px',
                textAlign: 'center',
              }}
            >
              {event.stage.toUpperCase()}
            </span>
            <span style={{ flex: 1, color: '#e0e0e0' }}>{event.message}</span>
            <span style={{ color: '#666', fontSize: '11px' }}>{event.timestamp.toLocaleTimeString()}</span>
          </div>
        ))
      )}
    </div>
  )
}

function EntitiesPreview() {
  const entities = useAtomValue(flightEntitiesAtom)

  return (
    <div style={styles.entitiesPanel}>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MapPin style={{ width: 16, height: 16, color: '#22c55e' }} />
        Flight Entities ({entities.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
        {entities.slice(0, 12).map((entity) => (
          <div
            key={entity.entityId}
            style={{
              padding: '10px',
              backgroundColor: 'var(--tmnl-surface-2, #1a1a1a)',
              borderRadius: '6px',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{entity.callsign || entity.icao24}</span>
              <span style={{ color: '#666' }}>{Math.round(entity.position[2])}m</span>
            </div>
            <div style={{ color: '#888' }}>
              {entity.position[1].toFixed(3)}°, {entity.position[0].toFixed(3)}°
            </div>
            <div style={{ color: '#666' }}>
              {Math.round(entity.speed)} m/s • {Math.round(entity.heading)}°
            </div>
          </div>
        ))}
      </div>
      {entities.length > 12 && (
        <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
          ... and {entities.length - 12} more
        </div>
      )}
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MaterializerFlowTestbed() {
  useEffect(() => {
    return () => {
      stopIngester()
      stopMaterializer()
    }
  }, [])

  return (
    <RegistryContext.Provider value={testbedRegistry}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.title}>
            <Layers style={{ width: 20, height: 20, color: '#22c55e' }} />
            Materializer Flow Testbed
            <span style={styles.badge}>NEW</span>
          </div>
          <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={resetAll}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            Reset
          </button>
        </header>

        {/* Data Flow Pipeline */}
        <div style={styles.flowContainer}>
          <IngesterStage />
          <FlowArrow />
          <PostgresStage />
          <FlowArrow />
          <StreamStage />
          <FlowArrow />
          <MaterializerStage />
          <FlowArrow />
          <ElectricStage />
          <FlowArrow />
          <ReactStage />
        </div>

        {/* Event Log */}
        <EventLog />

        {/* Entities Preview */}
        <EntitiesPreview />

        {/* Architecture explanation */}
        <div
          style={{
            margin: '0 24px 24px',
            padding: '16px',
            backgroundColor: 'var(--tmnl-surface-1, #111)',
            border: '1px solid var(--tmnl-border, #333)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#888',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#e0e0e0' }}>
            Transactional Outbox Pattern
          </div>
          <div style={{ lineHeight: 1.6 }}>
            <strong style={{ color: '#f59e0b' }}>FlightIngester</strong> polls external APIs (OpenSky,
            ADSB.lol)
            <br />
            <strong style={{ color: '#06b6d4' }}>Transactional Write</strong> - Postgres INSERT +
            DurableStream publish in same transaction
            <br />
            <strong style={{ color: '#a855f7' }}>DurableStream</strong> - Append-only log with offset
            tracking for reconnection
            <br />
            <strong style={{ color: '#22c55e' }}>FlightEntityMaterializer</strong> - Subscribes to
            stream, upserts ECS entity tables
            <br />
            <strong style={{ color: '#3b82f6' }}>Electric</strong> - Real-time Postgres → Browser sync
            via HTTP Shape API
            <br />
            <strong style={{ color: '#ec4899' }}>useFlightEntitiesWithTraits()</strong> - Joins
            entity.entities + spatial + kinetic + identifiable
          </div>
        </div>
      </div>
    </RegistryContext.Provider>
  )
}

export default MaterializerFlowTestbed

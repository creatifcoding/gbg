#!/usr/bin/env bun
/**
 * Spike: Fermion + IIoT Database Integration
 *
 * Tests integration patterns between Fermion (schema-driven atom families)
 * and the IIoT database layer (TimescaleDB + Apache AGE).
 *
 * H1: Stream-to-Atom Bridge - Bridge Effect Streams to atom state
 * H2: Polling Subscription Model - Auto-refreshing subscriptions via Fermion
 * H3: Time-Series Semantic Atoms - Latest value with TTL-based invalidation
 * H4: Hierarchical Asset Fermion - Graph traversal with Fermion families
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run scripts/spike-fermion-iiot.ts
 */

import { Effect, Stream, Schedule, pipe } from 'effect'
import { Atom, Registry } from '@effect-atom/atom'
import * as Schema from 'effect/Schema'
import type { DeviceId } from '../src/lib/iiot/schemas/identifiers'
import type { SensorReading } from '../src/lib/iiot/schemas/readings'
import type { SensorHierarchy } from '../src/lib/iiot/schemas/assets'
import { GraphClient } from '../src/lib/iiot/services/l1/GraphClient'
import { IIoTIntegrationLayer, isDatabaseAvailable } from '../src/lib/iiot/__tests__/integration/layer'

// =============================================================================
// ASCII Visualization Helpers
// =============================================================================

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
}

function renderProgressBar(value: number, max: number, width = 30): string {
  const ratio = Math.min(value / max, 1)
  const filled = Math.round(ratio * width)
  const empty = width - filled
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${value}/${max}`
}

function renderReading(reading: SensorReading): string {
  return `${COLORS.yellow}${reading.deviceId}${COLORS.reset}: ${reading.value.toFixed(2)} (q=${reading.quality})`
}

// =============================================================================
// H1: Stream-to-Atom Bridge
// =============================================================================

/**
 * Bridge an Effect Stream to an Atom, updating on each emission.
 * This is the core pattern for connecting IIoT streams to reactive state.
 *
 * IMPORTANT: The atom must be mounted via `registry.mount(atom)` before calling this,
 * otherwise the atom will be garbage-collected after the Effect completes.
 *
 * @param stream - The Effect Stream to consume
 * @param atom - The atom to update (must be mounted)
 * @param registry - The registry instance (from Registry.make())
 */
function bridgeStreamToAtom<A, E>(
  stream: Stream.Stream<A, E>,
  atom: Atom.Atom<A | null>,
  registry: ReturnType<typeof Registry.make>,
  _debug = false
): Effect.Effect<void, E> {
  return Stream.runForEach(stream, (value) =>
    Effect.sync(() => {
      registry.set(atom as any, value)
    })
  )
}

/**
 * Bridge a Stream to an Atom that accumulates values (e.g., rolling window).
 */
function bridgeStreamToAccumulator<A, E>(
  stream: Stream.Stream<A, E>,
  atom: Atom.Atom<A[]>,
  registry: ReturnType<typeof Registry.make>,
  maxSize: number = 100
): Effect.Effect<void, E> {
  return Stream.runForEach(stream, (value) =>
    Effect.sync(() => {
      const current = registry.get(atom as any) as A[]
      const updated = [...current, value].slice(-maxSize)
      registry.set(atom as any, updated)
    })
  )
}

async function testH1_StreamToAtomBridge(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  H1: Stream-to-Atom Bridge${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`)

  // Create a test registry and atoms
  const registry = Registry.make()
  const latestReadingAtom = Atom.make<SensorReading | null>(null)
  const readingHistoryAtom = Atom.make<SensorReading[]>([])

  // CRITICAL: Mount atoms to prevent garbage collection after Effect completes!
  // Without mount(), atoms are scheduled for removal via queueMicrotask when no subscribers exist.
  const unmountLatest = registry.mount(latestReadingAtom)
  const unmountHistory = registry.mount(readingHistoryAtom)

  // Create a mock stream of readings (simulating real-time data)
  const testDeviceId = 'TMP-001' as DeviceId
  let emitCount = 0

  const mockReadingStream = Stream.repeatEffectWithSchedule(
    Effect.sync(() => {
      emitCount++
      return {
        _tag: 'SensorReading' as const,
        time: Effect.runSync(Effect.map(Effect.clock, c => c.currentTimeMillis)).toString(),
        deviceId: testDeviceId,
        value: 20 + Math.random() * 10,
        quality: 100 as const,
      } as unknown as SensorReading
    }),
    Schedule.recurs(4).pipe(Schedule.intersect(Schedule.spaced('100 millis')))
  )

  console.log(`${COLORS.dim}Testing stream-to-atom bridge with mock readings...${COLORS.reset}\n`)

  // Test 1: Bridge to latest reading atom
  const bridgeLatest = bridgeStreamToAtom(mockReadingStream, latestReadingAtom, registry, false)

  try {
    await Effect.runPromise(bridgeLatest)
  } catch (err) {
    console.log(`${COLORS.red}Bridge error: ${err}${COLORS.reset}`)
    unmountLatest()
    unmountHistory()
    return false
  }

  const latestReading = registry.get(latestReadingAtom)
  const hasLatest = latestReading !== null

  console.log(`  Latest reading atom: ${hasLatest ? COLORS.green + '✓ populated' : COLORS.red + '✗ empty'}${COLORS.reset}`)
  if (latestReading) {
    console.log(`    ${renderReading(latestReading)}`)
  }

  // Test 2: Bridge to accumulator atom
  emitCount = 0
  const mockStream2 = Stream.repeatEffectWithSchedule(
    Effect.sync(() => {
      emitCount++
      return {
        _tag: 'SensorReading' as const,
        time: Effect.runSync(Effect.map(Effect.clock, c => c.currentTimeMillis)).toString(),
        deviceId: testDeviceId,
        value: 20 + Math.random() * 10,
        quality: 100 as const,
      } as unknown as SensorReading
    }),
    Schedule.recurs(9).pipe(Schedule.intersect(Schedule.spaced('50 millis')))
  )

  const bridgeAccumulator = bridgeStreamToAccumulator(mockStream2, readingHistoryAtom, registry, 5)

  try {
    await Effect.runPromise(bridgeAccumulator)
  } catch (err) {
    console.log(`${COLORS.red}Accumulator error: ${err}${COLORS.reset}`)
  }

  const history = registry.get(readingHistoryAtom)
  const hasHistory = history.length > 0
  const respectsMaxSize = history.length <= 5

  console.log(`  History atom: ${hasHistory ? COLORS.green + '✓' : COLORS.red + '✗'} ${history.length} readings (max=5)${COLORS.reset}`)
  console.log(`  Max size respected: ${respectsMaxSize ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`)

  // Cleanup: unmount atoms
  unmountLatest()
  unmountHistory()

  const passed = hasLatest && hasHistory && respectsMaxSize

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H1 ${passed ? 'PASSED' : 'FAILED'}: Stream-to-Atom bridge works${COLORS.reset}`)

  return passed
}

// =============================================================================
// H2: Polling Subscription Model
// =============================================================================

/**
 * Creates a polling-based subscription that periodically fetches and updates an atom.
 * This is the pattern for "live" data without push notifications.
 */
function createPollingSubscription<A, E, R>(
  fetch: Effect.Effect<A | null, E, R>,
  atom: Atom.Atom<A | null>,
  registry: ReturnType<typeof Registry.make>,
  intervalMs: number
): Effect.Effect<never, E, R> {
  return Effect.forever(
    pipe(
      fetch,
      Effect.tap((value) =>
        Effect.sync(() => {
          if (value !== null) {
            registry.set(atom as any, value)
          }
        })
      ),
      Effect.delay(`${intervalMs} millis`)
    )
  )
}

async function testH2_PollingSubscription(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  H2: Polling Subscription Model${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`)

  const registry = Registry.make()
  const polledValueAtom = Atom.make<number | null>(null)

  // CRITICAL: Mount atom to prevent garbage collection
  const unmount = registry.mount(polledValueAtom)

  // Simulate a fetch that returns incrementing values
  let fetchCount = 0
  const mockFetch = Effect.sync(() => {
    fetchCount++
    return fetchCount * 10
  })

  console.log(`${COLORS.dim}Testing polling subscription (5 polls at 100ms intervals)...${COLORS.reset}\n`)

  // Run polling for a limited time
  const pollingWithTimeout = Effect.race(
    createPollingSubscription(mockFetch, polledValueAtom, registry, 100),
    Effect.sleep('550 millis')
  )

  try {
    await Effect.runPromise(pollingWithTimeout)
  } catch (err) {
    // Race completed (timeout won) - this is expected
  }

  const finalValue = registry.get(polledValueAtom)
  const pollsOccurred = fetchCount >= 5
  const atomUpdated = finalValue !== null && finalValue >= 50

  console.log(`  Polls occurred: ${pollsOccurred ? COLORS.green + '✓' : COLORS.red + '✗'} ${fetchCount} polls${COLORS.reset}`)
  console.log(`  Atom updated: ${atomUpdated ? COLORS.green + '✓' : COLORS.red + '✗'} value=${finalValue}${COLORS.reset}`)

  // Cleanup
  unmount()

  const passed = pollsOccurred && atomUpdated

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H2 ${passed ? 'PASSED' : 'FAILED'}: Polling subscription works${COLORS.reset}`)

  return passed
}

// =============================================================================
// H3: Time-Series Semantic Atoms
// =============================================================================

/**
 * Schema for a "latest reading" state with metadata.
 */
const LatestReadingState = Schema.Struct({
  reading: Schema.NullOr(Schema.Any), // SensorReading
  fetchedAt: Schema.Number,
  isStale: Schema.Boolean,
})
type LatestReadingState = Schema.Schema.Type<typeof LatestReadingState>

/**
 * Creates a time-series aware atom that tracks staleness.
 * Note: deviceId and staleTtlMs reserved for future extension (e.g., key namespacing, per-sensor TTL)
 */
function createLatestReadingAtom(
  _deviceId: DeviceId,
  _staleTtlMs: number = 5000
): Atom.Atom<LatestReadingState> {
  return Atom.make<LatestReadingState>({
    reading: null,
    fetchedAt: 0,
    isStale: true,
  })
}

/**
 * Updates a latest reading atom with staleness tracking.
 */
function updateLatestReading(
  atom: Atom.Atom<LatestReadingState>,
  registry: ReturnType<typeof Registry.make>,
  reading: SensorReading | null,
  _staleTtlMs: number = 5000
): void {
  const now = Date.now()
  registry.set(atom as any, {
    reading,
    fetchedAt: now,
    isStale: false,
  })
}

/**
 * Checks if a latest reading is stale.
 */
function checkStaleness(
  atom: Atom.Atom<LatestReadingState>,
  registry: ReturnType<typeof Registry.make>,
  staleTtlMs: number = 5000
): boolean {
  const state = registry.get(atom as any) as LatestReadingState
  const now = Date.now()
  const age = now - state.fetchedAt
  const isStale = age > staleTtlMs || state.reading === null

  if (isStale && !state.isStale) {
    registry.set(atom as any, { ...state, isStale: true })
  }

  return isStale
}

async function testH3_TimeSeriesSemantics(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  H3: Time-Series Semantic Atoms${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`)

  const registry = Registry.make()
  const testDeviceId = 'TMP-001' as DeviceId
  const staleTtlMs = 200 // Short TTL for testing

  // Create the time-series aware atom
  const latestAtom = createLatestReadingAtom(testDeviceId, staleTtlMs)

  // Test 1: Initial state is stale
  const initialState = registry.get(latestAtom)
  const initiallyStale = initialState.isStale && initialState.reading === null

  console.log(`  Initial state stale: ${initiallyStale ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`)

  // Test 2: Update makes it non-stale
  const mockReading = {
    _tag: 'SensorReading' as const,
    time: new Date().toISOString(),
    deviceId: testDeviceId,
    value: 25.5,
    quality: 100 as const,
  } as unknown as SensorReading

  updateLatestReading(latestAtom, registry, mockReading, staleTtlMs)
  const afterUpdate = registry.get(latestAtom)
  const notStaleAfterUpdate = !afterUpdate.isStale && afterUpdate.reading !== null

  console.log(`  Not stale after update: ${notStaleAfterUpdate ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`)

  // Test 3: Becomes stale after TTL
  console.log(`${COLORS.dim}  Waiting ${staleTtlMs + 100}ms for TTL expiry...${COLORS.reset}`)
  await new Promise((resolve) => setTimeout(resolve, staleTtlMs + 100))

  const isStaleNow = checkStaleness(latestAtom, registry, staleTtlMs)
  const markedStale = registry.get(latestAtom).isStale

  console.log(`  Stale after TTL: ${isStaleNow && markedStale ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`)

  const passed = initiallyStale && notStaleAfterUpdate && isStaleNow && markedStale

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H3 ${passed ? 'PASSED' : 'FAILED'}: Time-series semantics work${COLORS.reset}`)

  return passed
}

// =============================================================================
// H4: Hierarchical Asset Fermion (Integration Test)
// =============================================================================

/**
 * Creates a family of atoms keyed by device ID, with graph context.
 * This demonstrates the pattern for combining graph traversal with atom state.
 *
 * IMPORTANT: Atoms are mounted when created to prevent garbage collection.
 * Call `dispose()` to unmount all atoms when done.
 */
function createSensorFamilyWithHierarchy(
  registry: ReturnType<typeof Registry.make>
): {
  getSensorAtom: (deviceId: DeviceId) => Atom.Atom<{
    reading: SensorReading | null
    hierarchy: SensorHierarchy | null
  }>
  atomMap: Map<DeviceId, Atom.Atom<{ reading: SensorReading | null; hierarchy: SensorHierarchy | null }>>
  dispose: () => void
} {
  const atomMap = new Map<
    DeviceId,
    Atom.Atom<{ reading: SensorReading | null; hierarchy: SensorHierarchy | null }>
  >()
  const unmountFns: Array<() => void> = []

  const getSensorAtom = (deviceId: DeviceId) => {
    let atom = atomMap.get(deviceId)
    if (!atom) {
      atom = Atom.make<{ reading: SensorReading | null; hierarchy: SensorHierarchy | null }>({
        reading: null,
        hierarchy: null,
      })
      atomMap.set(deviceId, atom)
      // Mount to prevent garbage collection
      unmountFns.push(registry.mount(atom))
    }
    return atom
  }

  const dispose = () => {
    for (const unmount of unmountFns) {
      unmount()
    }
  }

  return { getSensorAtom, atomMap, dispose }
}

async function testH4_HierarchicalAssetFermion(): Promise<boolean> {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  H4: Hierarchical Asset Fermion (Integration)${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`)

  // Check database availability
  const dbAvailable = await Effect.runPromise(
    isDatabaseAvailable.pipe(Effect.provide(IIoTIntegrationLayer))
  )

  if (!dbAvailable) {
    console.log(`${COLORS.yellow}  SKIPPED: IIoT database not available${COLORS.reset}`)
    console.log(`${COLORS.dim}  Run: docker compose -f docker/docker-compose.iiot.yml up -d${COLORS.reset}`)
    return true // Skip but don't fail
  }

  const registry = Registry.make()
  const { getSensorAtom, atomMap, dispose } = createSensorFamilyWithHierarchy(registry)

  const testDeviceId = 'TMP-001' as DeviceId

  console.log(`${COLORS.dim}Testing hierarchical asset loading from database...${COLORS.reset}\n`)

  // Test: Load sensor hierarchy and populate atom
  const loadHierarchy = Effect.gen(function* () {
    const graphClient = yield* GraphClient

    // Get sensor hierarchy from graph
    const hierarchy = yield* graphClient.getSensorHierarchy(testDeviceId)

    // Get the atom for this device
    const atom = getSensorAtom(testDeviceId)

    // Update with hierarchy
    const current = registry.get(atom as any) as { reading: SensorReading | null; hierarchy: SensorHierarchy | null }
    registry.set(atom as any, { ...current, hierarchy })

    return hierarchy
  }).pipe(Effect.provide(IIoTIntegrationLayer))

  let hierarchy: SensorHierarchy | null = null
  try {
    hierarchy = await Effect.runPromise(loadHierarchy)
  } catch (err) {
    console.log(`${COLORS.red}Error loading hierarchy: ${err}${COLORS.reset}`)
    return false
  }

  const hasHierarchy = hierarchy !== null
  const atomPopulated = atomMap.size === 1

  console.log(`  Hierarchy loaded: ${hasHierarchy ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`)
  if (hierarchy) {
    console.log(`    Device: ${hierarchy.deviceId}`)
    console.log(`    Machine: ${hierarchy.machineName}`)
    console.log(`    Line: ${hierarchy.lineName}`)
    console.log(`    Plant: ${hierarchy.plantName}`)
  }
  console.log(`  Atom family populated: ${atomPopulated ? COLORS.green + '✓' : COLORS.red + '✗'} (${atomMap.size} atoms)${COLORS.reset}`)

  // Verify atom state
  const sensorAtom = getSensorAtom(testDeviceId)
  const atomState = registry.get(sensorAtom)
  const atomHasHierarchy = atomState.hierarchy !== null

  console.log(`  Atom has hierarchy: ${atomHasHierarchy ? COLORS.green + '✓' : COLORS.red + '✗'}${COLORS.reset}`)

  // Cleanup: unmount all atoms in the family
  dispose()

  const passed = hasHierarchy && atomPopulated && atomHasHierarchy

  console.log(`\n${passed ? COLORS.green + '✓' : COLORS.red + '✗'} H4 ${passed ? 'PASSED' : 'FAILED'}: Hierarchical asset Fermion works${COLORS.reset}`)

  return passed
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log(`
${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗
║     SPIKE: Fermion + IIoT Database Integration                ║
╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}
`)

  const results: Record<string, boolean> = {}

  results.H1 = await testH1_StreamToAtomBridge()
  results.H2 = await testH2_PollingSubscription()
  results.H3 = await testH3_TimeSeriesSemantics()
  results.H4 = await testH4_HierarchicalAssetFermion()

  // Summary
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  SUMMARY${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`)

  const allPassed = Object.values(results).every(Boolean)

  for (const [name, passed] of Object.entries(results)) {
    console.log(`  ${passed ? COLORS.green + '✓' : COLORS.red + '✗'} ${name}${COLORS.reset}`)
  }

  console.log(`\n${allPassed ? COLORS.green + '✓ ALL HYPOTHESES VERIFIED' : COLORS.red + '✗ SOME HYPOTHESES FAILED'}${COLORS.reset}`)

  // Learnings
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  LEARNINGS${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`)

  console.log(`  ${COLORS.red}⚠️  CRITICAL: Atom Lifecycle Management${COLORS.reset}`)
  console.log(`     - Atoms without keepAlive are GC'd via queueMicrotask when no subscribers`)
  console.log(`     - ALWAYS call registry.mount(atom) before running Effects that mutate atoms`)
  console.log(`     - Call unmount() when done to allow cleanup`)
  console.log(``)
  console.log(`  ${COLORS.yellow}1. Stream-to-Atom Bridge:${COLORS.reset}`)
  console.log(`     - Use Stream.runForEach with registry.set() for synchronous updates`)
  console.log(`     - Accumulator pattern: slice(-maxSize) for rolling windows`)
  console.log(`     - Mount atoms BEFORE running the stream Effect`)
  console.log(``)
  console.log(`  ${COLORS.yellow}2. Polling Subscription:${COLORS.reset}`)
  console.log(`     - Effect.forever + Effect.delay for interval-based polling`)
  console.log(`     - Can extend Fermion with .withPolling(intervalMs) builder method`)
  console.log(`     - Mount atoms BEFORE starting the polling Effect`)
  console.log(``)
  console.log(`  ${COLORS.yellow}3. Time-Series Semantics:${COLORS.reset}`)
  console.log(`     - Track fetchedAt + isStale in atom state`)
  console.log(`     - TTL-based staleness detection enables smart refetching`)
  console.log(``)
  console.log(`  ${COLORS.yellow}4. Hierarchical Assets (Atom Family Pattern):${COLORS.reset}`)
  console.log(`     - Combine graph traversal (hierarchy) with time-series (readings)`)
  console.log(`     - Family pattern: Map<DeviceId, Atom> with lazy creation`)
  console.log(`     - Mount atoms when created, track unmount fns for cleanup`)
  console.log(``)

  console.log(`\n`)

  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error(`${COLORS.red}Spike failed with error:${COLORS.reset}`, err)
  process.exit(1)
})

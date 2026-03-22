/**
 * EmissionEngine - High-performance event emission with Effect Stream consumption
 *
 * Architecture:
 * - HOT PATH: rAF loop with TypedArrays, zero allocations, zero Effect overhead
 * - COLD PATH: Queue bridge to Effect Stream (1 batch/sec)
 * - SAMPLING: Reservoir sampling for statistically unbiased latency distribution
 * - REAL LATENCY: Measures actual emission execution time (microseconds)
 *
 * Target: 10,000 events/sec with ~100μs per-event budget
 *
 * @module
 */

import { Effect, Queue, Stream, Fiber } from 'effect'
import { Atom, Registry } from '@effect-atom/atom-react'
import type { RawEvent, TimeseriesPoint } from './atoms'
import { initTiming, nowMicrosSync, isHighResolution } from './timing'
import type { PayloadGenerator, PayloadProfile, PayloadTier } from './scenarios/types'
import { getGenerator } from './scenarios/generators'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Reservoir size for latency sampling (statistical accuracy vs memory) */
const RESERVOIR_SIZE = 1000

/** Max raw events to keep for AG-Grid display - AG-Grid virtualizes, so we can go big */
const MAX_RAW_EVENTS = 10_000

/** Max throughput timeseries points (60 seconds of history) */
const MAX_THROUGHPUT_POINTS = 60

/** Max latency distribution samples */
const MAX_LATENCY_SAMPLES = 1000

/** Max raw latency timeseries points */
const MAX_RAW_LATENCY_POINTS = 600

// =============================================================================
// TYPES
// =============================================================================

/** Batch of metrics emitted once per second */
export interface EmissionBatch {
  readonly timestamp: number
  readonly secondBoundary: number
  readonly throughputCount: number
  readonly latencyReservoir: Float64Array
  readonly latencySampleCount: number
  readonly latencyMin: number
  readonly latencyMax: number
  readonly latencySum: number
  readonly rawEvents: readonly RawEvent[]
  /** Total bytes generated this second (from payload sizes) */
  readonly bytesThisSecond: number
}

/** Enriched batch with computed statistics */
export interface EnrichedBatch extends EmissionBatch {
  readonly latencyStats: {
    readonly min: number
    readonly max: number
    readonly avg: number
    readonly p50: number
    readonly p95: number
    readonly p99: number
  }
}

/** Engine configuration */
export interface EmissionEngineConfig {
  /** Target events per second */
  readonly eventsPerSecond: number
  /** Payload profile (senml, opcua, prometheus) */
  readonly payloadProfile?: PayloadProfile
  /** Payload size tier */
  readonly payloadTier?: PayloadTier
  /** Whether to generate payloads (can be disabled for pure throughput tests) */
  readonly generatePayloads?: boolean
}

/**
 * Atom dependencies - the engine MUST update all of these.
 * Declared at class level, enforced by flushToAtoms implementation.
 */
export interface EmissionEngineAtoms {
  /** Downsampled throughput (1 point/sec) */
  readonly throughputTimeseries: Atom.Atom<readonly TimeseriesPoint[]>
  /** Latency distribution values (for histogram) */
  readonly latencyDistribution: Atom.Atom<readonly number[]>
  /** Raw latency with timestamps (for timeseries) */
  readonly rawLatencyTimeseries: Atom.Atom<readonly TimeseriesPoint[]>
  /** Raw events (for AG-Grid) */
  readonly rawEvents: Atom.Atom<readonly RawEvent[]>
  /** Metrics state (source of truth for derived atoms) */
  readonly metricsState: Atom.Atom<MetricsState>
}

/** Metrics state shape (matches atoms/index.ts) */
interface MetricsState {
  scenarioId: string | null
  scenarioName: string | null
  startedAt: number | null
  totalEvents: number
  eventsThisSecond: number
  lastSecondTimestamp: number
  peakEventsPerSecond: number
  throughputSamples: number[]
  // Note: latencySamples removed - latencyAtom derives from latencyDistributionAtom
  circuitState: 'closed' | 'open' | 'half-open'
  failureCount: number
  successCount: number
  lastStateChange: number
  backpressureStrategy: string | null
  bufferFill: number
  droppedCount: number
  isBackpressureEngaged: boolean
}

// =============================================================================
// EMISSION ENGINE
// =============================================================================

export class EmissionEngine {
  // --- Atom dependencies (injected, must all be updated) ---
  private readonly atoms: EmissionEngineAtoms
  private readonly registry: Registry

  // --- Effect resources ---
  private queue: Queue.Queue<EmissionBatch> | null = null
  private fiber: Fiber.Fiber<void, never> | null = null

  // --- rAF state ---
  private rafId: number | null = null
  private running = false
  private lastFrameTime = 0
  private fractionalEvents = 0
  private cachedSecondBoundary = 0

  // --- Configuration ---
  private eventsPerSecond: number
  private payloadGenerator: PayloadGenerator | null = null
  private payloadTier: PayloadTier = 'small'
  private generatePayloads: boolean = false

  // --- Hot path state (TypedArrays, primitives only) ---
  private latencyReservoir = new Float64Array(RESERVOIR_SIZE)
  private latencySampleCount = 0
  private latencySum = 0
  private latencyMinValue = Infinity
  private latencyMaxValue = -Infinity
  private throughputCount = 0
  private totalEvents = 0
  private bytesThisSecond = 0

  // --- Raw events ring buffer ---
  private rawEventBuffer: RawEvent[] = []
  private eventIdCounter = 0

  constructor(
    config: EmissionEngineConfig,
    atoms: EmissionEngineAtoms,
    registry: Registry
  ) {
    this.eventsPerSecond = config.eventsPerSecond
    this.atoms = atoms
    this.registry = registry

    // Initialize payload generation
    if (config.generatePayloads !== false && config.payloadProfile) {
      this.payloadGenerator = getGenerator(config.payloadProfile)
      this.payloadTier = config.payloadTier ?? 'small'
      this.generatePayloads = true
    }
  }

  // ===========================================================================
  // PUBLIC API (Effect)
  // ===========================================================================

  /** Start the engine - creates queue, starts stream fiber, starts rAF */
  start(): Effect.Effect<void> {
    const self = this
    return Effect.gen(function* () {
      if (self.running) {
        yield* Effect.logWarning('EmissionEngine already running')
        return
      }

      // Initialize high-resolution timing (Tauri IPC or browser fallback)
      yield* Effect.promise(() => initTiming())

      // Create the queue bridge
      self.queue = yield* Queue.sliding<EmissionBatch>(60)

      // Start the consumer fiber (daemon so it outlives parent scope)
      const consumerStream = self.createConsumerStream(self.queue)
      const drainEffect = Stream.runDrain(consumerStream)
      self.fiber = yield* Effect.forkDaemon(drainEffect)

      // Initialize timing state
      self.cachedSecondBoundary = Math.floor(Date.now() / 1000) * 1000
      self.lastFrameTime = 0
      self.fractionalEvents = 0

      // Start rAF loop
      self.running = true
      self.rafId = requestAnimationFrame(self.tick)

      yield* Effect.logInfo('EmissionEngine started', {
        eventsPerSecond: self.eventsPerSecond,
        highResolutionTiming: isHighResolution(),
        generatePayloads: self.generatePayloads,
        payloadProfile: self.payloadGenerator?.id ?? 'none',
        payloadTier: self.payloadTier,
      })
    })
  }

  /** Stop the engine - interrupt fiber, cancel rAF */
  stop(): Effect.Effect<void> {
    const self = this
    return Effect.gen(function* () {
      self.running = false

      if (self.rafId !== null) {
        cancelAnimationFrame(self.rafId)
        self.rafId = null
      }

      if (self.fiber !== null) {
        yield* Fiber.interrupt(self.fiber)
        self.fiber = null
      }

      if (self.queue !== null) {
        yield* Queue.shutdown(self.queue)
        self.queue = null
      }

      yield* Effect.logInfo('EmissionEngine stopped')
    })
  }

  /** Reset all counters and state */
  reset(): Effect.Effect<void> {
    const self = this
    return Effect.sync(() => {
      self.resetAllState()
    })
  }

  /** Update configuration while running */
  updateConfig(config: Partial<EmissionEngineConfig>): void {
    if (config.eventsPerSecond !== undefined) {
      this.eventsPerSecond = config.eventsPerSecond
    }
    if (config.payloadProfile !== undefined) {
      this.payloadGenerator = getGenerator(config.payloadProfile)
      this.generatePayloads = true
    }
    if (config.payloadTier !== undefined) {
      this.payloadTier = config.payloadTier
    }
    if (config.generatePayloads !== undefined) {
      this.generatePayloads = config.generatePayloads
      if (!config.generatePayloads) {
        this.payloadGenerator = null
      }
    }
  }

  // ===========================================================================
  // RAF LOOP (HOT PATH)
  // ===========================================================================

  private tick = (currentTime: DOMHighResTimeStamp): void => {
    if (!this.running) return

    // Calculate delta time with first-frame handling
    const deltaMs = this.lastFrameTime === 0 ? 16.67 : currentTime - this.lastFrameTime
    this.lastFrameTime = currentTime

    // Calculate events to emit this frame (with fractional accumulation)
    const exactEvents = (deltaMs / 1000) * this.eventsPerSecond + this.fractionalEvents
    const wholeEvents = Math.floor(exactEvents)
    this.fractionalEvents = exactEvents - wholeEvents

    // === SYNCHRONOUS TIMING: Must complete before flush check ===
    // Uses performance.now() * 1000 (sync) for hot path - can't block rAF with async
    if (wholeEvents > 0) {
      this.measureAndEmitSync(wholeEvents)
    }

    // Check second boundary for flush
    const now = Date.now()
    const secondBoundary = Math.floor(now / 1000) * 1000

    if (secondBoundary > this.cachedSecondBoundary) {
      this.flushBatch(secondBoundary)
      this.cachedSecondBoundary = secondBoundary
    }

    // Continue loop
    this.rafId = requestAnimationFrame(this.tick)
  }

  /**
   * Measure and emit events with synchronous timing.
   *
   * Uses performance.now() * 1000 for microsecond timing.
   * MUST be synchronous - can't block rAF loop with async/await.
   *
   * Note: Browser's performance.now() has ~100μs resolution due to Spectre
   * mitigations. For true μs precision in cold paths, use Tauri IPC separately.
   */
  private measureAndEmitSync(wholeEvents: number): void {
    // Get start timestamp (μs) - synchronous
    const frameStartUs = nowMicrosSync()

    // Emit all events for this frame
    for (let i = 0; i < wholeEvents; i++) {
      this.emitEventCore()
    }

    // Get end timestamp (μs) - synchronous
    const frameEndUs = nowMicrosSync()

    // Calculate latency in microseconds, then convert to ms for storage
    const totalFrameUs = frameEndUs - frameStartUs
    const perEventUs = totalFrameUs / wholeEvents
    const perEventMs = perEventUs / 1000

    // Backfill latency into the events we just created
    // (they're at the front of rawEventBuffer, in reverse order)
    for (let i = 0; i < Math.min(wholeEvents, this.rawEventBuffer.length); i++) {
      const event = this.rawEventBuffer[i]!
      event.latencyMs = perEventMs
    }

    // Reservoir sample the per-event latency (once per frame, weighted by event count)
    for (let i = 0; i < wholeEvents; i++) {
      this.reservoirSample(perEventMs)
    }

    // Running stats
    this.latencySum += perEventMs * wholeEvents
    this.latencyMinValue = Math.min(this.latencyMinValue, perEventMs)
    this.latencyMaxValue = Math.max(this.latencyMaxValue, perEventMs)
  }

  /** Emit a single event - core logic without timing */
  private emitEventCore(): void {
    this.throughputCount++
    this.totalEvents++

    // Generate payload if configured
    let payload: unknown
    let payloadSizeBytes: number | undefined

    if (this.generatePayloads && this.payloadGenerator) {
      payload = this.payloadGenerator.generate(this.payloadTier, this.eventIdCounter)
      // Fast JSON size estimation - actual stringification would be too slow
      // on hot path. We use the generator's estimate instead.
      payloadSizeBytes = this.payloadGenerator.estimateSizeBytes(this.payloadTier)
      this.bytesThisSecond += payloadSizeBytes
    }

    const event: RawEvent = {
      id: `evt-${++this.eventIdCounter}`,
      timestamp: Date.now(),
      type: 'emission',
      latencyMs: 0, // Will be backfilled after batch timing
      payload,
      payloadSizeBytes,
    }

    // Ring buffer: keep newest at front
    this.rawEventBuffer.unshift(event)
    if (this.rawEventBuffer.length > MAX_RAW_EVENTS) {
      this.rawEventBuffer.pop()
    }
  }

  /** Reservoir sampling - O(1) per event, statistically unbiased */
  private reservoirSample(value: number): void {
    if (this.latencySampleCount < RESERVOIR_SIZE) {
      this.latencyReservoir[this.latencySampleCount] = value
    } else {
      const j = Math.floor(Math.random() * (this.latencySampleCount + 1))
      if (j < RESERVOIR_SIZE) {
        this.latencyReservoir[j] = value
      }
    }
    this.latencySampleCount++
  }

  /** Flush batch to queue (cold path - once per second) */
  private flushBatch(secondBoundary: number): void {
    if (!this.queue) return

    const batch: EmissionBatch = {
      timestamp: Date.now(),
      secondBoundary,
      throughputCount: this.throughputCount,
      latencyReservoir: new Float64Array(this.latencyReservoir.subarray(
        0,
        Math.min(this.latencySampleCount, RESERVOIR_SIZE)
      )),
      latencySampleCount: this.latencySampleCount,
      latencyMin: this.latencyMinValue === Infinity ? 0 : this.latencyMinValue,
      latencyMax: this.latencyMaxValue === -Infinity ? 0 : this.latencyMaxValue,
      latencySum: this.latencySum,
      rawEvents: [...this.rawEventBuffer],
      bytesThisSecond: this.bytesThisSecond,
    }

    Queue.unsafeOffer(this.queue, batch)

    // Reset per-second counters
    this.throughputCount = 0
    this.latencySum = 0
    this.latencyMinValue = Infinity
    this.latencyMaxValue = -Infinity
    this.bytesThisSecond = 0
  }

  /** Reset all state */
  private resetAllState(): void {
    this.latencyReservoir.fill(0)
    this.latencySampleCount = 0
    this.latencySum = 0
    this.latencyMinValue = Infinity
    this.latencyMaxValue = -Infinity
    this.throughputCount = 0
    this.totalEvents = 0
    this.bytesThisSecond = 0
    this.rawEventBuffer = []
    this.eventIdCounter = 0
    this.fractionalEvents = 0
    this.cachedSecondBoundary = Math.floor(Date.now() / 1000) * 1000
  }

  // ===========================================================================
  // EFFECT STREAM CONSUMER (COLD PATH)
  // ===========================================================================

  private createConsumerStream(queue: Queue.Queue<EmissionBatch>) {
    return Stream.fromQueue(queue).pipe(
      // Enrich with computed statistics
      Stream.map((batch): EnrichedBatch => ({
        ...batch,
        latencyStats: this.computeLatencyStats(batch),
      })),

      // Add observability span
      Stream.tap((batch) =>
        Effect.withSpan('playground/process-batch', {
          attributes: {
            throughput: batch.throughputCount,
            latencySamples: batch.latencySampleCount,
            p99: batch.latencyStats.p99,
          },
        })(Effect.void)
      ),

      // Flush to atoms
      Stream.tap((batch) =>
        Effect.sync(() => this.flushToAtoms(batch))
      )
    )
  }

  /** Compute percentiles from reservoir sample */
  private computeLatencyStats(batch: EmissionBatch): EnrichedBatch['latencyStats'] {
    const { latencyReservoir, latencySampleCount, latencyMin, latencyMax, latencySum } = batch

    if (latencySampleCount === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 }
    }

    const sorted = Array.from(latencyReservoir).sort((a, b) => a - b)
    const len = Math.min(latencySampleCount, RESERVOIR_SIZE)

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * len) - 1
      return sorted[Math.max(0, Math.min(index, len - 1))] ?? 0
    }

    return {
      min: latencyMin,
      max: latencyMax,
      avg: latencySum / latencySampleCount,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    }
  }

  /**
   * Flush enriched batch to ALL declared atoms.
   *
   * INVARIANT: Every atom in this.atoms MUST be updated here.
   * The type system enforces this via EmissionEngineAtoms interface.
   */
  private flushToAtoms(batch: EnrichedBatch): void {
    const { throughputCount, rawEvents, secondBoundary } = batch

    // === 1. throughputTimeseries ===
    const throughputTs = this.registry.get(this.atoms.throughputTimeseries)
    this.registry.set(this.atoms.throughputTimeseries, [
      ...throughputTs.slice(-(MAX_THROUGHPUT_POINTS - 1)),
      { timestamp: secondBoundary, value: throughputCount },
    ])

    // === 2. latencyDistribution ===
    const latencySamples = Array.from(
      batch.latencyReservoir.subarray(0, Math.min(batch.latencySampleCount, RESERVOIR_SIZE))
    )
    const currentLatencyDist = this.registry.get(this.atoms.latencyDistribution)
    this.registry.set(this.atoms.latencyDistribution, [
      ...currentLatencyDist.slice(-(MAX_LATENCY_SAMPLES - latencySamples.length)),
      ...latencySamples,
    ].slice(-MAX_LATENCY_SAMPLES))

    // === 3. rawLatencyTimeseries ===
    const latencyTimeseries: TimeseriesPoint[] = rawEvents
      .filter((e): e is RawEvent & { latencyMs: number } => e.latencyMs !== undefined)
      .slice(0, 100)
      .map(e => ({ timestamp: e.timestamp, value: e.latencyMs }))
    const currentRawLatency = this.registry.get(this.atoms.rawLatencyTimeseries)
    this.registry.set(this.atoms.rawLatencyTimeseries, [
      ...currentRawLatency.slice(-(MAX_RAW_LATENCY_POINTS - latencyTimeseries.length)),
      ...latencyTimeseries,
    ].slice(-MAX_RAW_LATENCY_POINTS))

    // === 4. rawEvents ===
    this.registry.set(this.atoms.rawEvents, rawEvents)

    // === 5. metricsState ===
    // Note: latencySamples removed - latencyAtom derives from latencyDistributionAtom now
    const currentState = this.registry.get(this.atoms.metricsState)
    this.registry.set(this.atoms.metricsState, {
      ...currentState,
      totalEvents: currentState.totalEvents + throughputCount,
      eventsThisSecond: throughputCount,
      lastSecondTimestamp: secondBoundary,
      peakEventsPerSecond: Math.max(currentState.peakEventsPerSecond, throughputCount),
      throughputSamples: [...currentState.throughputSamples.slice(-59), throughputCount],
    })
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/** Create EmissionEngine with atom dependencies */
export const makeEmissionEngine = (
  config: EmissionEngineConfig,
  atoms: EmissionEngineAtoms,
  registry: Registry
) =>
  Effect.gen(function* () {
    const engine = new EmissionEngine(config, atoms, registry)

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* engine.stop()
        yield* Effect.logDebug('EmissionEngine finalized')
      })
    )

    return engine
  })

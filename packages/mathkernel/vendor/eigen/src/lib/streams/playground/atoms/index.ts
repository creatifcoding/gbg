/**
 * Streams Playground Atoms
 *
 * ARCHITECTURE: Atom-as-State Pattern
 *
 * Atoms ARE the state. No Effect.Ref inside services.
 * Mutations update atoms directly. React subscribes directly.
 *
 * CRITICAL: effect-atom API clarification:
 * - `Atom.get(atom)` returns Effect<A, never, AtomRegistry> — NOT a value!
 * - `Atom.set(atom, value)` returns Effect<void, never, AtomRegistry> — NOT void!
 * - For synchronous access, use Registry instance: `registry.get(atom)`, `registry.set(atom, value)`
 *
 * @module
 */

import { Atom, Registry } from '@effect-atom/atom-react';
import {
  type PlaygroundMetrics,
  type ThroughputMetrics,
  type LatencyMetrics,
  type CircuitBreakerMetrics,
  type BackpressureMetrics,
  type TimeseriesPoint,
  type CircuitState,
  type BackpressureStrategy,
  ThroughputMetrics as ThroughputMetricsClass,
  LatencyMetrics as LatencyMetricsClass,
  CircuitBreakerMetrics as CircuitBreakerMetricsClass,
  BackpressureMetrics as BackpressureMetricsClass,
  PlaygroundMetrics as PlaygroundMetricsClass,
  defaultLatencyMetrics,
} from '../types';
import {
  type UnifiedScenarioConfig,
  type PayloadProfile,
  type PayloadTier,
  defaultScenarioConfig,
} from '../scenarios/types';

// ============================================================================
// SHARED REGISTRY
// ============================================================================

/**
 * Shared registry for playground atoms.
 *
 * This registry is used for:
 * 1. Synchronous mutations via `playgroundRegistry.get()` / `playgroundRegistry.set()`
 * 2. Can be provided to React via RegistryProvider (optional - default context works too)
 *
 * The default React context creates its own registry, but for mutations to be visible
 * to React components, we need to use the SAME registry instance.
 */
export const playgroundRegistry = Registry.make();

// ============================================================================
// STATE ATOM (The Source of Truth)
// ============================================================================

interface MetricsState {
  scenarioId: string | null;
  scenarioName: string | null;
  startedAt: number | null;
  totalEvents: number;
  eventsThisSecond: number;
  lastSecondTimestamp: number;
  peakEventsPerSecond: number;
  throughputSamples: number[];
  // NOTE: latencySamples REMOVED - latencyAtom derives from latencyDistributionAtom
  circuitState: CircuitState;
  failureCount: number;
  successCount: number;
  lastStateChange: number;
  backpressureStrategy: BackpressureStrategy | null;
  bufferFill: number;
  droppedCount: number;
  isBackpressureEngaged: boolean;
}

const initialState = (): MetricsState => ({
  scenarioId: null,
  scenarioName: null,
  startedAt: null,
  totalEvents: 0,
  eventsThisSecond: 0,
  lastSecondTimestamp: Date.now(),
  peakEventsPerSecond: 0,
  throughputSamples: [],
  circuitState: 'closed',
  failureCount: 0,
  successCount: 0,
  lastStateChange: Date.now(),
  backpressureStrategy: null,
  bufferFill: 0,
  droppedCount: 0,
  isBackpressureEngaged: false,
});

export const metricsStateAtom = Atom.keepAlive(
  Atom.make<MetricsState>(initialState())
);

// ============================================================================
// DERIVED ATOMS
// ============================================================================

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
};

export const throughputAtom = Atom.make((get): ThroughputMetrics => {
  const s = get(metricsStateAtom);
  const avg =
    s.throughputSamples.length > 0
      ? s.throughputSamples.reduce((a, b) => a + b, 0) /
        s.throughputSamples.length
      : 0;

  // Use the last COMPLETED second's count, not the in-progress eventsThisSecond
  // This prevents sawtooth cycling (1→33→1→33)
  const lastCompletedSecondCount =
    s.throughputSamples.length > 0
      ? s.throughputSamples[s.throughputSamples.length - 1]!
      : s.eventsThisSecond; // Fallback to live count during first second

  return new ThroughputMetricsClass({
    eventsPerSecond: lastCompletedSecondCount,
    totalEvents: s.totalEvents,
    peakEventsPerSecond: s.peakEventsPerSecond,
    avgEventsPerSecond: avg,
    timestamp: Date.now(),
  });
});

/**
 * Latency metrics - DERIVES FROM latencyDistributionAtom (single source of truth)
 *
 * Both the histogram and stats badges read from the same atom.
 * This ensures consistency: if the histogram shows data, stats show the same data.
 */
export const latencyAtom = Atom.make((get): LatencyMetrics => {
  const samples = get(latencyDistributionAtom);
  if (samples.length === 0) return defaultLatencyMetrics();

  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return new LatencyMetricsClass({
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
    avgMs: sum / sorted.length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    sampleCount: sorted.length,
    timestamp: Date.now(),
  });
});

export const circuitBreakerAtom = Atom.make(
  (get): CircuitBreakerMetrics | null => {
    const s = get(metricsStateAtom);
    if (s.circuitState === 'closed' && s.failureCount === 0) return null;

    return new CircuitBreakerMetricsClass({
      state: s.circuitState,
      failureCount: s.failureCount,
      successCount: s.successCount,
      lastStateChange: s.lastStateChange,
    });
  }
);

export const backpressureAtom = Atom.make((get): BackpressureMetrics | null => {
  const s = get(metricsStateAtom);
  if (!s.backpressureStrategy) return null;

  return new BackpressureMetricsClass({
    strategy: s.backpressureStrategy,
    bufferFill: s.bufferFill,
    droppedCount: s.droppedCount,
    isEngaged: s.isBackpressureEngaged,
    timestamp: Date.now(),
  });
});

export const metricsAtom = Atom.make((get): PlaygroundMetrics => {
  const throughput = get(throughputAtom);
  const latency = get(latencyAtom);
  const circuitBreaker = get(circuitBreakerAtom);
  const backpressure = get(backpressureAtom);
  const s = get(metricsStateAtom);

  return new PlaygroundMetricsClass({
    throughput,
    latency,
    circuitBreaker: circuitBreaker ?? undefined,
    backpressure: backpressure ?? undefined,
    runtimeMs: s.startedAt ? Date.now() - s.startedAt : 0,
  });
});

// ============================================================================
// UI STATE ATOMS
// ============================================================================

export type FeedMode = 'downsampled' | 'raw';

/** Feed mode toggle: downsampled (1/s aggregated) vs raw (every event) */
export const feedModeAtom = Atom.keepAlive(Atom.make<FeedMode>('downsampled'));

// ============================================================================
// TIMESERIES ATOMS (Dual Feed Architecture)
// ============================================================================

/**
 * DUAL FEED ARCHITECTURE:
 *
 * Each metric has TWO feeds:
 * 1. RAW feed - every emission captured (high frequency, for debugging)
 * 2. DOWNSAMPLED feed - aggregated per second (for charts)
 *
 * This allows:
 * - Charts to render efficiently with downsampled data
 * - Debug panels to inspect raw stream with full fidelity
 * - AG-Grid to display raw events for inspection
 */

// --- THROUGHPUT ---
/** Downsampled: 1 point per second (for D3 line chart) */
export const throughputTimeseriesAtom = Atom.keepAlive(
  Atom.make<readonly TimeseriesPoint[]>([])
);
/** Raw: Every emission as a point (for debug/inspection) */
export const rawThroughputAtom = Atom.keepAlive(
  Atom.make<readonly TimeseriesPoint[]>([])
);

// --- LATENCY ---
/** Downsampled: Just values for histogram binning */
export const latencyDistributionAtom = Atom.keepAlive(
  Atom.make<readonly number[]>([])
);
/** Raw: Every latency sample with timestamp (for debug/inspection) */
export const rawLatencyTimeseriesAtom = Atom.keepAlive(
  Atom.make<readonly TimeseriesPoint[]>([])
);

// --- RAW EVENTS (for AG-Grid) ---
export interface RawEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'emission' | 'circuitChange' | 'backpressure' | 'dropped';
  readonly latencyMs?: number;
  /** Generated payload data (SenML, OPC-UA, Prometheus) */
  readonly payload?: unknown;
  /** Payload size in bytes (for bandwidth metrics) */
  readonly payloadSizeBytes?: number;
  readonly cbState?: CircuitState;
  readonly failureCount?: number;
  readonly strategy?: BackpressureStrategy;
  readonly bufferFill?: number;
  readonly droppedCount?: number;
}

/** Circular buffer of raw events for AG-Grid display (keepAlive to persist during unmount cycles) */
export const rawEventsAtom = Atom.keepAlive(Atom.make<readonly RawEvent[]>([]));

// --- SCENARIO CONFIGURATION ---
/** Unified scenario configuration atom (for UI controls) */
export const scenarioConfigAtom = Atom.keepAlive(
  Atom.make<UnifiedScenarioConfig>(defaultScenarioConfig())
);

// --- BANDWIDTH METRICS ---
interface BandwidthMetrics {
  /** Total bytes generated this second */
  bytesThisSecond: number;
  /** Peak bytes per second */
  peakBytesPerSecond: number;
  /** Average bytes per second */
  avgBytesPerSecond: number;
  /** Total bytes generated */
  totalBytes: number;
}

const initialBandwidth = (): BandwidthMetrics => ({
  bytesThisSecond: 0,
  peakBytesPerSecond: 0,
  avgBytesPerSecond: 0,
  totalBytes: 0,
});

/** Bandwidth metrics atom (tracks payload throughput) */
export const bandwidthAtom = Atom.keepAlive(
  Atom.make<BandwidthMetrics>(initialBandwidth())
);

// Max points to retain
const MAX_THROUGHPUT_POINTS = 60; // Downsampled (1/sec for 60s)
const MAX_RAW_THROUGHPUT = 600; // Raw (10/sec for 60s)
const MAX_LATENCY_SAMPLES = 500; // Downsampled histogram
const MAX_RAW_LATENCY = 600; // Raw with timestamps
const MAX_RAW_EVENTS = 10_000; // AG-Grid circular buffer - virtualization handles the rendering

// ============================================================================
// MUTATIONS (Direct atom updates via Registry)
// ============================================================================

let eventIdCounter = 0;

// In-memory buffers for raw feeds (flushed on second boundary)
let rawThroughputBuffer: TimeseriesPoint[] = [];
let rawLatencyBuffer: TimeseriesPoint[] = [];
let rawEventsBuffer: RawEvent[] = [];
let latencyDistBuffer: number[] = [];

// In-memory counters (ZERO atom reads/writes until second boundary)
let pendingTotalEvents = 0;
let pendingEventsThisSecond = 0;

// Cached timestamp - eliminates atom read on hot path
let cachedLastSecondTimestamp = 0;

// In-memory buffer for bandwidth tracking
let pendingBandwidthBytes = 0;

/**
 * Record an emission event with latency and optional payload.
 *
 * PERFORMANCE: ZERO atom operations on hot path.
 * Only array.push() and counter increments until second boundary.
 */
export function recordEmission(
  latencyMs: number,
  payload?: unknown,
  payloadSizeBytes?: number
): void {
  const now = Date.now();
  const secondBoundary = Math.floor(now / 1000) * 1000;

  // === HOT PATH: Pure memory ops, ZERO atom reads ===
  pendingTotalEvents++;
  pendingEventsThisSecond++;
  if (payloadSizeBytes) {
    pendingBandwidthBytes += payloadSizeBytes;
  }
  rawThroughputBuffer.push({ timestamp: now, value: 1 });
  rawLatencyBuffer.push({ timestamp: now, value: latencyMs });
  rawEventsBuffer.push({
    id: `evt-${++eventIdCounter}`,
    timestamp: now,
    type: 'emission',
    latencyMs,
    payload,
    payloadSizeBytes,
  });
  latencyDistBuffer.push(latencyMs);

  // === COLD PATH: Flush on second boundary (uses cached timestamp) ===
  if (secondBoundary > cachedLastSecondTimestamp) {
    // NOW we read from atom (once per second)
    const s = playgroundRegistry.get(metricsStateAtom);
    // Flush raw throughput buffer
    const rawTp = playgroundRegistry.get(rawThroughputAtom);
    playgroundRegistry.set(rawThroughputAtom, [
      ...rawTp.slice(-(MAX_RAW_THROUGHPUT - rawThroughputBuffer.length)),
      ...rawThroughputBuffer,
    ]);
    rawThroughputBuffer = [];

    // Flush raw latency buffer
    const rawLat = playgroundRegistry.get(rawLatencyTimeseriesAtom);
    playgroundRegistry.set(rawLatencyTimeseriesAtom, [
      ...rawLat.slice(-(MAX_RAW_LATENCY - rawLatencyBuffer.length)),
      ...rawLatencyBuffer,
    ]);
    rawLatencyBuffer = [];

    // Flush raw events buffer (prepend for newest-first)
    const rawEvents = playgroundRegistry.get(rawEventsAtom);
    playgroundRegistry.set(
      rawEventsAtom,
      [...rawEventsBuffer.reverse(), ...rawEvents].slice(0, MAX_RAW_EVENTS)
    );
    rawEventsBuffer = [];

    // Flush latency distribution buffer
    const latencyDist = playgroundRegistry.get(latencyDistributionAtom);
    playgroundRegistry.set(latencyDistributionAtom, [
      ...latencyDist.slice(-(MAX_LATENCY_SAMPLES - latencyDistBuffer.length)),
      ...latencyDistBuffer,
    ]);
    latencyDistBuffer = [];

    // Downsampled throughput timeseries
    const completedSecondCount =
      s.eventsThisSecond + pendingEventsThisSecond - 1; // -1 for current event
    const throughputTs = playgroundRegistry.get(throughputTimeseriesAtom);
    playgroundRegistry.set(throughputTimeseriesAtom, [
      ...throughputTs.slice(-(MAX_THROUGHPUT_POINTS - 1)),
      { timestamp: secondBoundary, value: completedSecondCount },
    ]);

    // Update metrics state (SINGLE atom write per second)
    // NOTE: latencySamples removed - latencyAtom derives from latencyDistributionAtom
    playgroundRegistry.set(metricsStateAtom, {
      ...s,
      totalEvents: s.totalEvents + pendingTotalEvents,
      eventsThisSecond: 1, // Reset for new second (current event counts)
      lastSecondTimestamp: secondBoundary,
      peakEventsPerSecond: Math.max(
        s.peakEventsPerSecond,
        completedSecondCount
      ),
      throughputSamples: [
        ...s.throughputSamples.slice(-59),
        completedSecondCount,
      ],
    });

    // Update bandwidth metrics
    const bw = playgroundRegistry.get(bandwidthAtom);
    const newTotalBytes = bw.totalBytes + pendingBandwidthBytes;
    const sampleCount = s.throughputSamples.length + 1;
    playgroundRegistry.set(bandwidthAtom, {
      bytesThisSecond: pendingBandwidthBytes,
      peakBytesPerSecond: Math.max(bw.peakBytesPerSecond, pendingBandwidthBytes),
      avgBytesPerSecond: newTotalBytes / sampleCount,
      totalBytes: newTotalBytes,
    });

    // Update cached timestamp + reset pending counters
    cachedLastSecondTimestamp = secondBoundary;
    pendingTotalEvents = 0;
    pendingEventsThisSecond = 1; // Current event already in new second
    pendingBandwidthBytes = 0;
  }
  // NO ELSE BRANCH - zero atom ops mid-second!
}

export function startScenario(id: string, name: string): void {
  playgroundRegistry.set(metricsStateAtom, {
    ...initialState(),
    scenarioId: id,
    scenarioName: name,
    startedAt: Date.now(),
  });
}

export function resetMetrics(): void {
  eventIdCounter = 0;
  // Clear in-memory buffers
  rawThroughputBuffer = [];
  rawLatencyBuffer = [];
  rawEventsBuffer = [];
  latencyDistBuffer = [];
  // Clear pending counters + cached timestamp
  pendingTotalEvents = 0;
  pendingEventsThisSecond = 0;
  cachedLastSecondTimestamp = 0;
  pendingBandwidthBytes = 0;
  // Reset atoms
  playgroundRegistry.set(metricsStateAtom, initialState());
  // Downsampled feeds
  playgroundRegistry.set(throughputTimeseriesAtom, []);
  playgroundRegistry.set(latencyDistributionAtom, []);
  // Raw feeds
  playgroundRegistry.set(rawThroughputAtom, []);
  playgroundRegistry.set(rawLatencyTimeseriesAtom, []);
  playgroundRegistry.set(rawEventsAtom, []);
  // Bandwidth
  playgroundRegistry.set(bandwidthAtom, initialBandwidth());
}

export function recordBackpressure(
  strategy: BackpressureStrategy,
  bufferFill: number,
  isEngaged: boolean
): void {
  const s = playgroundRegistry.get(metricsStateAtom);
  const now = Date.now();
  playgroundRegistry.set(metricsStateAtom, {
    ...s,
    backpressureStrategy: strategy,
    bufferFill,
    isBackpressureEngaged: isEngaged,
  });

  // Push to raw events
  const rawEvents = playgroundRegistry.get(rawEventsAtom);
  const newEvent: RawEvent = {
    id: `bp-${++eventIdCounter}`,
    timestamp: now,
    type: 'backpressure',
    strategy,
    bufferFill,
  };
  playgroundRegistry.set(rawEventsAtom, [
    newEvent,
    ...rawEvents.slice(0, MAX_RAW_EVENTS - 1),
  ]);
}

export function recordDropped(count: number): void {
  const s = playgroundRegistry.get(metricsStateAtom);
  const now = Date.now();
  playgroundRegistry.set(metricsStateAtom, {
    ...s,
    droppedCount: s.droppedCount + count,
  });

  // Push to raw events
  const rawEvents = playgroundRegistry.get(rawEventsAtom);
  const newEvent: RawEvent = {
    id: `drop-${++eventIdCounter}`,
    timestamp: now,
    type: 'dropped',
    droppedCount: count,
  };
  playgroundRegistry.set(rawEventsAtom, [
    newEvent,
    ...rawEvents.slice(0, MAX_RAW_EVENTS - 1),
  ]);
}

export function recordCircuitStateChange(
  to: CircuitState,
  failureCount: number
): void {
  const s = playgroundRegistry.get(metricsStateAtom);
  const now = Date.now();
  playgroundRegistry.set(metricsStateAtom, {
    ...s,
    circuitState: to,
    failureCount,
    lastStateChange: now,
  });

  // Push to raw events
  const rawEvents = playgroundRegistry.get(rawEventsAtom);
  const newEvent: RawEvent = {
    id: `cb-${++eventIdCounter}`,
    timestamp: now,
    type: 'circuitChange',
    cbState: to,
    failureCount,
  };
  playgroundRegistry.set(rawEventsAtom, [
    newEvent,
    ...rawEvents.slice(0, MAX_RAW_EVENTS - 1),
  ]);
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type {
  PlaygroundMetrics,
  ThroughputMetrics,
  LatencyMetrics,
  CircuitBreakerMetrics,
  BackpressureMetrics,
};

export type { UnifiedScenarioConfig, PayloadProfile, PayloadTier };

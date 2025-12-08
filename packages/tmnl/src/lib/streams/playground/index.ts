/**
 * Streams Playground
 *
 * ARCHITECTURE: Atom-as-State Pattern
 *
 * Atoms ARE the state. Mutations update atoms directly. React subscribes directly.
 *
 * ```
 * recordEmission(latencyMs)
 *       │
 *       ▼
 * ┌─────────────────────────────────┐
 * │   metricsStateAtom (source)     │
 * │   throughputAtom (derived)      │ ◄── React subscribes via useAtomValue
 * │   latencyAtom (derived)         │
 * │   metricsAtom (derived)         │
 * └─────────────────────────────────┘
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   metricsAtom,
 *   throughputAtom,
 *   recordEmission,
 *   resetMetrics,
 * } from "@/lib/streams/playground"
 *
 * // In React component
 * const metrics = useAtomValue(metricsAtom)
 * const throughput = useAtomValue(throughputAtom)
 *
 * // Record an emission (direct atom mutation)
 * recordEmission(5) // 5ms latency
 * ```
 *
 * @module
 */

// ============================================================================
// TYPES
// ============================================================================

export {
  // Identifiers
  ScenarioId,
  SourceId,
  // Enums
  ScenarioCategory,
  ScenarioStatus,
  CircuitState,
  BackpressureStrategy,
  // Schema classes
  ScenarioConfig,
  ThroughputMetrics,
  LatencyMetrics,
  CircuitBreakerMetrics,
  BackpressureMetrics,
  PlaygroundMetrics,
  PlaygroundState,
  TimeseriesPoint,
  TimeseriesBuffer,
  // Defaults
  defaultThroughputMetrics,
  defaultLatencyMetrics,
  defaultPlaygroundMetrics,
  defaultPlaygroundState,
} from "./types"

export type {
  ScenarioId as ScenarioIdType,
  SourceId as SourceIdType,
  ScenarioCategory as ScenarioCategoryType,
  ScenarioStatus as ScenarioStatusType,
  CircuitState as CircuitStateType,
  BackpressureStrategy as BackpressureStrategyType,
} from "./types"

// ============================================================================
// EVENTS (for logging/observability, not state management)
// ============================================================================

export {
  ScenarioEvents,
  DataFlowEvents,
  BackpressureEvents,
  CircuitBreakerEvents,
  MetricsEvents,
  StreamsPlaygroundEvents,
} from "./events"

export type {
  ScenarioEventTag,
  DataFlowEventTag,
  BackpressureEventTag,
  CircuitBreakerEventTag,
  MetricsEventTag,
  PlaygroundEventTag,
} from "./events"

// ============================================================================
// ATOMS (Primary State)
// ============================================================================

export {
  // Registry (CRITICAL: React must use this via RegistryProvider for mutations to work)
  playgroundRegistry,
  // State atom
  metricsStateAtom,
  // Derived atoms
  metricsAtom,
  throughputAtom,
  latencyAtom,
  circuitBreakerAtom,
  backpressureAtom,
  // UI state atoms
  feedModeAtom,
  // Scenario configuration atom (UNIFIED)
  scenarioConfigAtom,
  // Bandwidth metrics atom
  bandwidthAtom,
  // Timeseries atoms (DOWNSAMPLED - for charts)
  throughputTimeseriesAtom,
  latencyDistributionAtom,
  // Raw feeds (HIGH FREQUENCY - for inspection/debug)
  rawThroughputAtom,
  rawLatencyTimeseriesAtom,
  rawEventsAtom,
  // Mutations
  recordEmission,
  startScenario,
  resetMetrics,
  recordBackpressure,
  recordDropped,
  recordCircuitStateChange,
} from "./atoms"

export type { RawEvent, FeedMode, UnifiedScenarioConfig, PayloadProfile, PayloadTier } from "./atoms"

// ============================================================================
// EMISSION ENGINE (High-performance rAF + Effect Stream)
// ============================================================================

export { EmissionEngine, makeEmissionEngine } from "./EmissionEngine"
export type { EmissionBatch, EnrichedBatch, EmissionEngineConfig, EmissionEngineAtoms } from "./EmissionEngine"

// ============================================================================
// HIGH-RESOLUTION TIMING (Tauri IPC / browser fallback)
// ============================================================================

export {
  initTiming,
  nowMicros,
  nowMicrosSync,
  isHighResolution,
  isInitialized,
  isTauri,
} from "./timing"

// ============================================================================
// UNIFIED SCENARIOS (Configurable stress tests)
// ============================================================================

export {
  // Types
  PayloadProfile,
  PayloadTier,
  PAYLOAD_SIZE_TARGETS,
  BurstConfig,
  UnifiedScenarioConfig,
  defaultScenarioConfig,
  // Presets
  SCENARIO_PRESETS,
  PAYLOAD_PROFILE_META,
  PAYLOAD_TIER_META,
  // Generators
  GENERATORS,
  getGenerator,
  getAvailableProfiles,
  senmlGenerator,
  opcuaGenerator,
  prometheusGenerator,
} from "./scenarios"

export type {
  PayloadGenerator,
  ScenarioPresetKey,
  SenMLRecord,
  OpcUaNetworkMessage,
  PrometheusPayload,
} from "./scenarios"

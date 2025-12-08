/**
 * Streams Playground Scenarios
 *
 * Unified configurable scenario system with realistic IIoT payloads.
 *
 * @module
 */

import * as Effect from 'effect/Effect'
import * as Stream from 'effect/Stream'
import * as Duration from 'effect/Duration'
import * as Schedule from 'effect/Schedule'
import { Schema } from 'effect'

// =============================================================================
// UNIFIED SCENARIO SYSTEM (NEW)
// =============================================================================

export {
  // Literal schemas
  PayloadProfile,
  PayloadTier,
  // Constants
  PAYLOAD_SIZE_TARGETS,
  // Config schema
  BurstConfig,
  UnifiedScenarioConfig,
  defaultScenarioConfig,
  // Presets
  SCENARIO_PRESETS,
  // Metadata
  PAYLOAD_PROFILE_META,
  PAYLOAD_TIER_META,
} from './types'

export type {
  PayloadProfile as PayloadProfileType,
  PayloadTier as PayloadTierType,
  PayloadGenerator,
  ScenarioPresetKey,
} from './types'

// Generators
export {
  GENERATORS,
  getGenerator,
  getAvailableProfiles,
  senmlGenerator,
  opcuaGenerator,
  prometheusGenerator,
} from './generators'

export type {
  SenMLRecord,
  OpcUaNetworkMessage,
  OpcUaDataSetMessage,
  OpcUaField,
  PrometheusPayload,
  PrometheusMetric,
} from './generators'

// =============================================================================
// LEGACY TYPES (Backward Compatibility)
// =============================================================================

export const ScenarioCategory = Schema.Literal(
  'throughput',
  'backpressure',
  'circuit',
  'topology',
  'mixed'
)
export type ScenarioCategory = typeof ScenarioCategory.Type

export const ScenarioId = Schema.String.pipe(Schema.brand('ScenarioId'))
export type ScenarioId = typeof ScenarioId.Type

/** @deprecated Use UnifiedScenarioConfig instead */
export interface ScenarioConfig {
  readonly id: ScenarioId
  readonly name: string
  readonly category: ScenarioCategory
  readonly description: string
  readonly durationMs: number
  readonly params: Record<string, number | string | boolean>
}

export interface ScenarioResult {
  readonly scenarioId: ScenarioId
  readonly totalEvents: number
  readonly durationMs: number
  readonly avgLatencyMs: number
  readonly peakEventsPerSecond: number
  readonly errors: number
}

// =============================================================================
// SCENARIO DEFINITIONS
// =============================================================================

export const SCENARIOS: readonly ScenarioConfig[] = [
  {
    id: '01-basic-throughput' as ScenarioId,
    name: '01. Basic Throughput',
    category: 'throughput',
    description: 'Sustained 1k events/sec for 30s. Baseline measurement.',
    durationMs: 30_000,
    params: {
      eventsPerSecond: 1000,
      latencyBaseMs: 1,
      latencyJitterMs: 2,
    },
  },
  {
    id: '02-sustained-load' as ScenarioId,
    name: '02. Sustained Load',
    category: 'throughput',
    description: '5k events/sec for 60s. Stress test sustained throughput.',
    durationMs: 60_000,
    params: {
      eventsPerSecond: 5000,
      latencyBaseMs: 0.5,
      latencyJitterMs: 1,
    },
  },
  {
    id: '03-burst-traffic' as ScenarioId,
    name: '03. Burst Traffic',
    category: 'throughput',
    description: '10k burst (1s) → 100/s (5s) → repeat. Tests burst handling.',
    durationMs: 30_000,
    params: {
      burstEventsPerSecond: 10000,
      baselineEventsPerSecond: 100,
      burstDurationMs: 1000,
      cooldownDurationMs: 5000,
    },
  },
  {
    id: '04-backpressure-block' as ScenarioId,
    name: '04. Backpressure Block',
    category: 'backpressure',
    description: 'Fast producer, slow consumer. Block strategy (producer waits).',
    durationMs: 30_000,
    params: {
      producerEventsPerSecond: 1000,
      consumerEventsPerSecond: 100,
      bufferSize: 50,
      strategy: 'block',
    },
  },
  {
    id: '05-backpressure-drop' as ScenarioId,
    name: '05. Backpressure Drop',
    category: 'backpressure',
    description: 'Fast producer, slow consumer. Drop strategy comparison.',
    durationMs: 30_000,
    params: {
      producerEventsPerSecond: 1000,
      consumerEventsPerSecond: 100,
      bufferSize: 50,
      strategy: 'drop-oldest',
    },
  },
  {
    id: '06-circuit-trip' as ScenarioId,
    name: '06. Circuit Breaker Trip',
    category: 'circuit',
    description: 'Inject 50% failures until circuit opens (trips at 5 failures).',
    durationMs: 30_000,
    params: {
      eventsPerSecond: 100,
      failureRate: 0.5,
      failureThreshold: 5,
      resetTimeoutMs: 5000,
    },
  },
  {
    id: '07-circuit-recovery' as ScenarioId,
    name: '07. Circuit Breaker Recovery',
    category: 'circuit',
    description: 'Trip circuit, then observe half-open → closed recovery.',
    durationMs: 30_000,
    params: {
      eventsPerSecond: 100,
      initialFailureRate: 1.0,
      failureDurationMs: 5000,
      recoveryFailureRate: 0,
      failureThreshold: 3,
      resetTimeoutMs: 3000,
    },
  },
  {
    id: '08-topology-fanout' as ScenarioId,
    name: '08. Topology Fanout',
    category: 'topology',
    description: '1 inlet → 8 outlets. Measure fanout latency distribution.',
    durationMs: 30_000,
    params: {
      inletEventsPerSecond: 1000,
      outletCount: 8,
      processingDelayMs: 0.5,
    },
  },
  {
    id: '09-topology-merge' as ScenarioId,
    name: '09. Topology Merge',
    category: 'topology',
    description: '4 inlets → 1 outlet. Measure merge ordering and overhead.',
    durationMs: 30_000,
    params: {
      inletCount: 4,
      eventsPerInletPerSecond: 250,
      mergeStrategy: 'interleave',
    },
  },
  {
    id: '10-chaos-monkey' as ScenarioId,
    name: '10. Chaos Monkey',
    category: 'mixed',
    description: 'Random: rate spikes, failures, backpressure, topology changes.',
    durationMs: 60_000,
    params: {
      baseEventsPerSecond: 500,
      spikeChance: 0.1,
      failureChance: 0.05,
      backpressureChance: 0.05,
      topologyChangeChance: 0.02,
    },
  },
] as const

// =============================================================================
// SCENARIO LOOKUP
// =============================================================================

export function getScenario(id: ScenarioId): ScenarioConfig | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export function getScenariosByCategory(
  category: ScenarioCategory
): readonly ScenarioConfig[] {
  return SCENARIOS.filter((s) => s.category === category)
}

// =============================================================================
// SCENARIO STREAM GENERATORS
// =============================================================================

/**
 * Generate a basic throughput stream.
 */
export function basicThroughputStream(
  eventsPerSecond: number,
  latencyBaseMs: number,
  latencyJitterMs: number
): Stream.Stream<{ value: number; latencyMs: number }> {
  const intervalMs = 1000 / eventsPerSecond
  let counter = 0

  return Stream.repeatEffectWithSchedule(
    Effect.sync(() => {
      counter++
      const latency = latencyBaseMs + Math.random() * latencyJitterMs
      return { value: counter, latencyMs: latency }
    }),
    Schedule.spaced(Duration.millis(intervalMs))
  )
}

/**
 * Generate a burst traffic stream.
 */
export function burstTrafficStream(
  burstEventsPerSecond: number,
  baselineEventsPerSecond: number,
  burstDurationMs: number,
  cooldownDurationMs: number
): Stream.Stream<{ value: number; isBurst: boolean }> {
  let counter = 0
  let isBurst = true
  let phaseStartTime = Date.now()

  return Stream.repeatEffect(
    Effect.sync(() => {
      const now = Date.now()
      const phaseElapsed = now - phaseStartTime

      // Toggle phases
      if (isBurst && phaseElapsed >= burstDurationMs) {
        isBurst = false
        phaseStartTime = now
      } else if (!isBurst && phaseElapsed >= cooldownDurationMs) {
        isBurst = true
        phaseStartTime = now
      }

      counter++
      return { value: counter, isBurst }
    })
  ).pipe(
    Stream.schedule(
      Schedule.spaced(
        Duration.millis(1000 / (isBurst ? burstEventsPerSecond : baselineEventsPerSecond))
      )
    )
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ScenarioConfig as ScenarioConfigType }

/**
 * Streams Playground Test Suite
 *
 * Tests for Stream-Atom primitives, scenarios, and components.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Stream from 'effect/Stream'

// =============================================================================
// SCENARIO TESTS
// =============================================================================

describe('Scenarios', () => {
  describe('ScenarioConfig', () => {
    it('should have 10 scenarios defined', async () => {
      const { SCENARIOS } = await import('../playground/scenarios')
      expect(SCENARIOS).toHaveLength(10)
    })

    it('should have unique IDs', async () => {
      const { SCENARIOS } = await import('../playground/scenarios')
      const ids = SCENARIOS.map((s) => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should cover all categories', async () => {
      const { SCENARIOS } = await import('../playground/scenarios')
      const categories = new Set(SCENARIOS.map((s) => s.category))

      expect(categories.has('throughput')).toBe(true)
      expect(categories.has('backpressure')).toBe(true)
      expect(categories.has('circuit')).toBe(true)
      expect(categories.has('topology')).toBe(true)
      expect(categories.has('mixed')).toBe(true)
    })

    it('should have valid duration for all scenarios', async () => {
      const { SCENARIOS } = await import('../playground/scenarios')

      SCENARIOS.forEach((scenario) => {
        expect(scenario.durationMs).toBeGreaterThan(0)
        expect(scenario.durationMs).toBeLessThanOrEqual(60000) // Max 60s
      })
    })

    it('should have required params for each scenario', async () => {
      const { SCENARIOS } = await import('../playground/scenarios')

      SCENARIOS.forEach((scenario) => {
        expect(scenario.params).toBeDefined()
        expect(typeof scenario.params).toBe('object')
      })
    })
  })

  describe('getScenario', () => {
    it('should return scenario by ID', async () => {
      const { getScenario, ScenarioId } = await import('../playground/scenarios')
      const scenario = getScenario('01-basic-throughput' as typeof ScenarioId.Type)

      expect(scenario).toBeDefined()
      expect(scenario?.name).toBe('01. Basic Throughput')
      expect(scenario?.category).toBe('throughput')
    })

    it('should return undefined for unknown ID', async () => {
      const { getScenario, ScenarioId } = await import('../playground/scenarios')
      const scenario = getScenario('unknown-scenario' as typeof ScenarioId.Type)

      expect(scenario).toBeUndefined()
    })
  })

  describe('getScenariosByCategory', () => {
    it('should filter throughput scenarios', async () => {
      const { getScenariosByCategory } = await import('../playground/scenarios')

      const throughputScenarios = getScenariosByCategory('throughput')
      expect(throughputScenarios.length).toBe(3) // Basic, Sustained, Burst
      expect(throughputScenarios.every((s) => s.category === 'throughput')).toBe(true)
    })

    it('should filter circuit scenarios', async () => {
      const { getScenariosByCategory } = await import('../playground/scenarios')

      const circuitScenarios = getScenariosByCategory('circuit')
      expect(circuitScenarios.length).toBe(2) // Trip, Recovery
      expect(circuitScenarios.every((s) => s.category === 'circuit')).toBe(true)
    })

    it('should filter backpressure scenarios', async () => {
      const { getScenariosByCategory } = await import('../playground/scenarios')

      const backpressureScenarios = getScenariosByCategory('backpressure')
      expect(backpressureScenarios.length).toBe(2) // Block, Drop
      expect(backpressureScenarios.every((s) => s.category === 'backpressure')).toBe(true)
    })

    it('should filter topology scenarios', async () => {
      const { getScenariosByCategory } = await import('../playground/scenarios')

      const topologyScenarios = getScenariosByCategory('topology')
      expect(topologyScenarios.length).toBe(2) // Fanout, Merge
      expect(topologyScenarios.every((s) => s.category === 'topology')).toBe(true)
    })

    it('should filter mixed scenarios', async () => {
      const { getScenariosByCategory } = await import('../playground/scenarios')

      const mixedScenarios = getScenariosByCategory('mixed')
      expect(mixedScenarios.length).toBe(1) // Chaos Monkey
      expect(mixedScenarios.every((s) => s.category === 'mixed')).toBe(true)
    })
  })
})

// =============================================================================
// STREAM GENERATOR TESTS
// =============================================================================

describe('Stream Generators', () => {
  describe('basicThroughputStream', () => {
    it('should generate events with incrementing values', async () => {
      const { basicThroughputStream } = await import('../playground/scenarios')

      const stream = basicThroughputStream(1000, 1, 0.5)

      // Take 5 events and verify structure
      const program = Effect.gen(function* () {
        const events = yield* Stream.take(stream, 5).pipe(Stream.runCollect)
        return Array.from(events)
      })

      const events = await Effect.runPromise(program)

      expect(events).toHaveLength(5)
      events.forEach((event, i) => {
        expect(event.value).toBe(i + 1)
      })
    })

    it('should include latency in each event', async () => {
      const { basicThroughputStream } = await import('../playground/scenarios')

      const stream = basicThroughputStream(1000, 1, 0.5)

      const program = Effect.gen(function* () {
        const events = yield* Stream.take(stream, 3).pipe(Stream.runCollect)
        return Array.from(events)
      })

      const events = await Effect.runPromise(program)

      events.forEach((event) => {
        expect(typeof event.latencyMs).toBe('number')
        expect(event.latencyMs).toBeGreaterThan(0)
      })
    })

    it('should add jitter to latency', async () => {
      const { basicThroughputStream } = await import('../playground/scenarios')

      const stream = basicThroughputStream(1000, 1, 5) // Large jitter

      const program = Effect.gen(function* () {
        const events = yield* Stream.take(stream, 10).pipe(Stream.runCollect)
        return Array.from(events)
      })

      const events = await Effect.runPromise(program)

      // With jitter, not all latencies should be identical
      const latencies = events.map((e) => e.latencyMs)
      const uniqueLatencies = new Set(latencies.map((l) => Math.round(l * 10)))

      expect(uniqueLatencies.size).toBeGreaterThan(1)
    })

    it('should respect latency base and jitter bounds', async () => {
      const { basicThroughputStream } = await import('../playground/scenarios')
      const baseMs = 5
      const jitterMs = 2

      const stream = basicThroughputStream(1000, baseMs, jitterMs)

      const program = Effect.gen(function* () {
        const events = yield* Stream.take(stream, 20).pipe(Stream.runCollect)
        return Array.from(events)
      })

      const events = await Effect.runPromise(program)

      events.forEach((event) => {
        expect(event.latencyMs).toBeGreaterThanOrEqual(baseMs)
        expect(event.latencyMs).toBeLessThanOrEqual(baseMs + jitterMs)
      })
    })
  })
})

// =============================================================================
// COMPONENT EXPORT TESTS
// =============================================================================

describe('Component Exports', () => {
  describe('ParticleFlow', () => {
    it('should export ParticleFlow component', async () => {
      const { ParticleFlow } = await import('@/components/playground/streams/viz')
      expect(ParticleFlow).toBeDefined()
      expect(typeof ParticleFlow).toBe('object') // React.memo returns object
    })

    it('should export ParticleFlowEdge component', async () => {
      const { ParticleFlowEdge } = await import('@/components/playground/streams/viz')
      expect(ParticleFlowEdge).toBeDefined()
    })

    it('should export ParticleFlowBezier component', async () => {
      const { ParticleFlowBezier } = await import('@/components/playground/streams/viz')
      expect(ParticleFlowBezier).toBeDefined()
    })
  })

  describe('HypothesisPanel', () => {
    it('should export HypothesisPanel component', async () => {
      const { HypothesisPanel } = await import('@/components/playground/streams/panels')
      expect(HypothesisPanel).toBeDefined()
      expect(typeof HypothesisPanel).toBe('function')
    })
  })

  describe('D3 Visualizations', () => {
    it('should export D3LineChart', async () => {
      const { D3LineChart } = await import('@/components/playground/streams/viz')
      expect(D3LineChart).toBeDefined()
    })

    it('should export D3Histogram', async () => {
      const { D3Histogram } = await import('@/components/playground/streams/viz')
      expect(D3Histogram).toBeDefined()
    })

    it('should export D3Gauge', async () => {
      const { D3Gauge } = await import('@/components/playground/streams/viz')
      expect(D3Gauge).toBeDefined()
    })

    it('should export D3TopologyGraph', async () => {
      const { D3TopologyGraph } = await import('@/components/playground/streams/viz')
      expect(D3TopologyGraph).toBeDefined()
    })

    it('should export PortNode', async () => {
      const { PortNode } = await import('@/components/playground/streams/viz')
      expect(PortNode).toBeDefined()
    })
  })

  describe('Panels', () => {
    it('should export MetricsPanel', async () => {
      const { MetricsPanel } = await import('@/components/playground/streams/panels')
      expect(MetricsPanel).toBeDefined()
    })

    it('should export EventLogPanel', async () => {
      const { EventLogPanel } = await import('@/components/playground/streams/panels')
      expect(EventLogPanel).toBeDefined()
    })

    it('should export StreamsDocPanel', async () => {
      const { StreamsDocPanel } = await import('@/components/playground/streams/panels')
      expect(StreamsDocPanel).toBeDefined()
    })

    it('should export ThroughputPanel', async () => {
      const { ThroughputPanel } = await import('@/components/playground/streams/panels')
      expect(ThroughputPanel).toBeDefined()
    })

    it('should export LatencyPanel', async () => {
      const { LatencyPanel } = await import('@/components/playground/streams/panels')
      expect(LatencyPanel).toBeDefined()
    })

    it('should export TopologyPanel', async () => {
      const { TopologyPanel } = await import('@/components/playground/streams/panels')
      expect(TopologyPanel).toBeDefined()
    })

    it('should export CircuitBreakerPanel', async () => {
      const { CircuitBreakerPanel } = await import('@/components/playground/streams/panels')
      expect(CircuitBreakerPanel).toBeDefined()
    })
  })

  describe('Layout', () => {
    it('should export PlaygroundLayout', async () => {
      const { PlaygroundLayout } = await import('@/components/playground/streams')
      expect(PlaygroundLayout).toBeDefined()
    })

    it('should export StreamsPlayground', async () => {
      const { StreamsPlayground } = await import('@/components/playground/streams')
      expect(StreamsPlayground).toBeDefined()
    })
  })
})

// =============================================================================
// SCENARIO PARAM VALIDATION TESTS
// =============================================================================

describe('Scenario Parameters', () => {
  it('throughput scenarios should have eventsPerSecond', async () => {
    const { getScenariosByCategory } = await import('../playground/scenarios')
    const scenarios = getScenariosByCategory('throughput')

    scenarios.forEach((scenario) => {
      const hasEventsPerSecond =
        'eventsPerSecond' in scenario.params ||
        'burstEventsPerSecond' in scenario.params

      expect(hasEventsPerSecond).toBe(true)
    })
  })

  it('backpressure scenarios should have buffer config', async () => {
    const { getScenariosByCategory } = await import('../playground/scenarios')
    const scenarios = getScenariosByCategory('backpressure')

    scenarios.forEach((scenario) => {
      expect('bufferSize' in scenario.params).toBe(true)
      expect('strategy' in scenario.params).toBe(true)
    })
  })

  it('circuit scenarios should have threshold config', async () => {
    const { getScenariosByCategory } = await import('../playground/scenarios')
    const scenarios = getScenariosByCategory('circuit')

    scenarios.forEach((scenario) => {
      expect('failureThreshold' in scenario.params).toBe(true)
      expect('resetTimeoutMs' in scenario.params).toBe(true)
    })
  })

  it('topology scenarios should have inlet/outlet config', async () => {
    const { getScenariosByCategory } = await import('../playground/scenarios')
    const scenarios = getScenariosByCategory('topology')

    scenarios.forEach((scenario) => {
      const hasTopologyConfig =
        'outletCount' in scenario.params ||
        'inletCount' in scenario.params

      expect(hasTopologyConfig).toBe(true)
    })
  })

  it('chaos scenario should have all chaos parameters', async () => {
    const { getScenario, ScenarioId } = await import('../playground/scenarios')
    const chaos = getScenario('10-chaos-monkey' as typeof ScenarioId.Type)

    expect(chaos).toBeDefined()
    expect(chaos?.params.spikeChance).toBeDefined()
    expect(chaos?.params.failureChance).toBeDefined()
    expect(chaos?.params.backpressureChance).toBeDefined()
    expect(chaos?.params.topologyChangeChance).toBeDefined()
  })
})

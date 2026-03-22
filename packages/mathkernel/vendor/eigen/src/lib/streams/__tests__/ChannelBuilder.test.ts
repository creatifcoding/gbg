/**
 * ChannelBuilder — Vitest Spec
 *
 * Validates the fluent API for constructing Channel topologies.
 */

import { describe, it, expect } from "@effect/vitest"
import { Effect, Either } from "effect"
import {
  ChannelBuilder,
  ChannelBuilderError,
} from "../constructs/ChannelBuilder"
import type {
  ChannelId,
  InletId,
  OutletId,
} from "../constructs/Channel"

// ============================================================================
// BASIC CONSTRUCTION
// ============================================================================

describe("ChannelBuilder", () => {
  describe("create()", () => {
    it("creates a builder with given id", () => {
      const builder = ChannelBuilder.create("my-channel")
      const inspection = builder.inspect()

      expect(inspection.id).toBe("my-channel")
    })

    it("defaults name to id", () => {
      const builder = ChannelBuilder.create("test")
      const inspection = builder.inspect()

      // create() defaults name to the id
      expect(inspection.name).toBe("test")
    })
  })

  describe("name() and description()", () => {
    it("sets channel name", () => {
      const builder = ChannelBuilder.create("ch-1").name("Sensor Hub")
      const inspection = builder.inspect()

      expect(inspection.name).toBe("Sensor Hub")
    })

    it("sets channel description (via buildConfig)", () => {
      const builder = ChannelBuilder.create("ch-1").description("Aggregates sensor data")
      // description is not exposed via inspect(), use buildConfig()
      const config = builder.buildConfig()

      expect(config.description).toBe("Aggregates sensor data")
    })

    it("chains name and description", () => {
      const builder = ChannelBuilder.create("ch-1")
        .name("Hub")
        .description("Desc")

      const inspection = builder.inspect()
      const config = builder.buildConfig()

      expect(inspection.name).toBe("Hub")
      expect(config.description).toBe("Desc")
    })
  })
})

// ============================================================================
// TOPOLOGY CONFIGURATION
// ============================================================================

describe("ChannelBuilder Topology", () => {
  describe("inlet()", () => {
    it("adds an inlet with localId", () => {
      const builder = ChannelBuilder.create("ch-1").inlet("temperature")
      const inspection = builder.inspect()

      expect(inspection.inletCount).toBe(1)
    })

    it("adds multiple inlets", () => {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("temperature")
        .inlet("pressure")
        .inlet("humidity")

      const inspection = builder.inspect()

      expect(inspection.inletCount).toBe(3)
    })

    it("accepts optional config", () => {
      const builder = ChannelBuilder.create("ch-1").inlet("temp", {
        name: "Temperature Inlet",
      })

      const inspection = builder.inspect()
      expect(inspection.inletCount).toBe(1)
    })
  })

  describe("outlet()", () => {
    it("adds an outlet with localId", () => {
      const builder = ChannelBuilder.create("ch-1").outlet("combined")
      const inspection = builder.inspect()

      expect(inspection.outletCount).toBe(1)
    })

    it("adds multiple outlets", () => {
      const builder = ChannelBuilder.create("ch-1")
        .outlet("primary")
        .outlet("secondary")

      const inspection = builder.inspect()

      expect(inspection.outletCount).toBe(2)
    })

    it("accepts broadcast and maxLag config", () => {
      const builder = ChannelBuilder.create("ch-1").outlet("out", {
        name: "Output",
        broadcast: true,
        maxLag: 64,
      })

      const inspection = builder.inspect()
      expect(inspection.outletCount).toBe(1)
    })
  })

  describe("junction()", () => {
    it("adds a merge junction", () => {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("a")
        .inlet("b")
        .outlet("out")
        .junction("merger", {
          kind: "merge",
          inputs: ["a", "b"],
          output: "out",
        })

      const inspection = builder.inspect()
      expect(inspection.junctionCount).toBe(1)
    })

    it("adds a broadcast junction", () => {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("in")
        .outlet("out1")
        .outlet("out2")
        .junction("broadcaster", {
          kind: "broadcast",
          name: "Broadcaster",
        })

      const inspection = builder.inspect()
      expect(inspection.junctionCount).toBe(1)
    })

    it("adds a filter junction", () => {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("in")
        .outlet("out")
        .junction("filter", {
          kind: "filter",
          inputs: ["in"],
          output: "out",
        })

      const inspection = builder.inspect()
      expect(inspection.junctionCount).toBe(1)
    })
  })

  describe("wire()", () => {
    it("wires inlet to outlet", () => {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("in")
        .outlet("out")
        .wire("in", "out")

      const inspection = builder.inspect()
      expect(inspection.wireCount).toBe(1)
    })

    it("wires multiple connections", () => {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("temp")
        .inlet("press")
        .outlet("combined")
        .wire("temp", "combined")
        .wire("press", "combined")

      const inspection = builder.inspect()
      expect(inspection.wireCount).toBe(2)
    })
  })
})

// ============================================================================
// PROTOCOL CONFIGURATION
// ============================================================================

describe("ChannelBuilder Protocol", () => {
  describe("timeout()", () => {
    it("configures timeout with string duration", () => {
      const builder = ChannelBuilder.create("ch-1").timeout("5 seconds", "warn")
      const inspection = builder.inspect()

      expect(inspection.hasTimeout).toBe(true)
    })

    it("supports different timeout behaviors", () => {
      const warnBuilder = ChannelBuilder.create("ch-1").timeout("5 seconds", "warn")
      const failBuilder = ChannelBuilder.create("ch-2").timeout("5 seconds", "fail")
      const skipBuilder = ChannelBuilder.create("ch-3").timeout("5 seconds", "skip")

      expect(warnBuilder.inspect().hasTimeout).toBe(true)
      expect(failBuilder.inspect().hasTimeout).toBe(true)
      expect(skipBuilder.inspect().hasTimeout).toBe(true)
    })
  })

  describe("backpressure()", () => {
    it("configures backpressure with drop-oldest strategy", () => {
      const builder = ChannelBuilder.create("ch-1").backpressure("drop-oldest", 100)
      const inspection = builder.inspect()

      expect(inspection.hasBackpressure).toBe(true)
    })

    it("configures backpressure with drop-newest strategy", () => {
      const builder = ChannelBuilder.create("ch-1").backpressure("drop-newest", 50)
      const inspection = builder.inspect()

      expect(inspection.hasBackpressure).toBe(true)
    })

    it("configures backpressure with block strategy", () => {
      const builder = ChannelBuilder.create("ch-1").backpressure("block", 200)
      const inspection = builder.inspect()

      expect(inspection.hasBackpressure).toBe(true)
    })
  })

  describe("circuitBreaker()", () => {
    it("configures circuit breaker", () => {
      const builder = ChannelBuilder.create("ch-1").circuitBreaker(5, "30 seconds")
      const inspection = builder.inspect()

      expect(inspection.hasCircuitBreaker).toBe(true)
    })
  })

  describe("retry()", () => {
    it("configures retry with fixed backoff", () => {
      // retry(times, backoff, initialDelay, maxDelay?)
      const builder = ChannelBuilder.create("ch-1").retry(3, "fixed", "1 second")
      const inspection = builder.inspect()

      expect(inspection.hasRetry).toBe(true)
    })

    it("configures retry with exponential backoff", () => {
      // retry(times, backoff, initialDelay, maxDelay?)
      const builder = ChannelBuilder.create("ch-1").retry(5, "exponential", "500 millis")
      const inspection = builder.inspect()

      expect(inspection.hasRetry).toBe(true)
    })

    it("configures retry with fibonacci backoff", () => {
      const builder = ChannelBuilder.create("ch-1").retry(3, "fibonacci", "100 millis", "10 seconds")
      const inspection = builder.inspect()

      expect(inspection.hasRetry).toBe(true)
    })
  })

  describe("combined protocol configuration", () => {
    it("supports multiple protocol options", () => {
      const builder = ChannelBuilder.create("ch-1")
        .timeout("10 seconds", "fail")
        .backpressure("drop-oldest", 100)
        .circuitBreaker(3, "1 minute")
        .retry(5, "exponential", "2 seconds")

      const inspection = builder.inspect()

      expect(inspection.hasTimeout).toBe(true)
      expect(inspection.hasBackpressure).toBe(true)
      expect(inspection.hasCircuitBreaker).toBe(true)
      expect(inspection.hasRetry).toBe(true)
    })
  })
})

// ============================================================================
// BUILD
// ============================================================================

describe("ChannelBuilder.build()", () => {
  it.effect("builds minimal channel state", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("minimal-channel")
        .name("Minimal")
        .inlet("in")
        .outlet("out")
        .wire("in", "out")

      const state = yield* builder.build()

      expect(state._tag).toBe("ChannelState")
      expect(state.id).toBe("minimal-channel")
      expect(state.name).toBe("Minimal")
      expect(state.status).toBe("idle")
      expect(state.topology._tag).toBe("ChannelTopology")
      expect(state.protocol._tag).toBe("ChannelProtocol")
      expect(state.metrics._tag).toBe("ChannelMetrics")
    })
  )

  it.effect("builds channel with topology", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("sensor-hub")
        .name("Sensor Hub")
        .inlet("temperature", { name: "Temperature Input" })
        .inlet("pressure", { name: "Pressure Input" })
        .outlet("combined", { name: "Combined Output", broadcast: true, maxLag: 32 })
        .wire("temperature", "combined")
        .wire("pressure", "combined")

      const state = yield* builder.build()

      expect(state.topology.inlets).toHaveLength(2)
      expect(state.topology.outlets).toHaveLength(1)
      expect(state.topology.wires).toHaveLength(2)

      // Verify inlet IDs include channel prefix
      expect(state.topology.inlets[0].id).toBe("sensor-hub:inlet:temperature")
      expect(state.topology.inlets[1].id).toBe("sensor-hub:inlet:pressure")
      expect(state.topology.outlets[0].id).toBe("sensor-hub:outlet:combined")
    })
  )

  it.effect("builds channel with protocol config", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("protected-channel")
        .inlet("in")
        .outlet("out")
        .wire("in", "out")
        .timeout("5 seconds", "warn")
        .backpressure("drop-oldest", 100)
        .circuitBreaker(5, "30 seconds")

      const state = yield* builder.build()

      expect(state.protocol.timeout).toBeDefined()
      expect(state.protocol.timeout?.duration).toBe("5 seconds")
      expect(state.protocol.timeout?.behavior).toBe("warn")

      expect(state.protocol.backpressure).toBeDefined()
      expect(state.protocol.backpressure?.strategy).toBe("drop-oldest")
      expect(state.protocol.backpressure?.capacity).toBe(100)

      expect(state.protocol.circuitBreaker).toBeDefined()
      expect(state.protocol.circuitBreaker?.threshold).toBe(5)
    })
  )

  it.effect("builds channel with junction", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("junction-channel")
        .inlet("a")
        .inlet("b")
        .outlet("out")
        .junction("merger", {
          kind: "merge",
          name: "Merger",
        })
        .wire("a", "merger")
        .wire("b", "merger")
        .wire("merger", "out")

      const state = yield* builder.build()

      expect(state.topology.junctions).toHaveLength(1)
      expect(state.topology.junctions[0].kind).toBe("merge")
    })
  )

  it.effect("initializes metrics to zero", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("ch-1")
        .inlet("in")
        .outlet("out")
        .wire("in", "out")

      const state = yield* builder.build()

      expect(state.metrics.messagesIn).toBe(0)
      expect(state.metrics.messagesOut).toBe(0)
      expect(state.metrics.errors).toBe(0)
    })
  )

  it.effect("sets createdAt timestamp", () =>
    Effect.gen(function* () {
      const before = Date.now()
      const builder = ChannelBuilder.create("ch-1")
        .inlet("in")
        .outlet("out")
        .wire("in", "out")

      const state = yield* builder.build()
      const after = Date.now()

      expect(state.createdAt).toBeGreaterThanOrEqual(before)
      expect(state.createdAt).toBeLessThanOrEqual(after)
    })
  )
})

// ============================================================================
// INSPECT
// ============================================================================

describe("ChannelBuilder.inspect()", () => {
  it("returns full builder inspection", () => {
    const builder = ChannelBuilder.create("inspection-test")
      .name("Test Channel")
      .description("A test channel")
      .inlet("in1")
      .inlet("in2")
      .outlet("out1")
      .wire("in1", "out1")
      .timeout("5 seconds", "warn")
      .backpressure("drop-oldest", 50)

    const inspection = builder.inspect()

    // inspect() does not expose description - use buildConfig() for that
    expect(inspection).toEqual({
      id: "inspection-test",
      name: "Test Channel",
      inletCount: 2,
      outletCount: 1,
      junctionCount: 0,
      wireCount: 1,
      hasTimeout: true,
      hasBackpressure: true,
      hasCircuitBreaker: false,
      hasRetry: false,
    })
  })
})

// ============================================================================
// FLUENT CHAINING
// ============================================================================

describe("ChannelBuilder Fluent Chaining", () => {
  it("chains all methods in single expression", () => {
    const builder = ChannelBuilder.create("fluent-test")
      .name("Fluent Channel")
      .description("Testing fluent API")
      .inlet("temp", { name: "Temperature" })
      .inlet("press", { name: "Pressure" })
      .outlet("combined", { name: "Combined", broadcast: true, maxLag: 64 })
      .wire("temp", "combined")
      .wire("press", "combined")
      .timeout("10 seconds", "fail")
      .backpressure("block", 200)
      .circuitBreaker(3, "1 minute")
      .retry(5, "exponential", "500 millis")

    const inspection = builder.inspect()

    expect(inspection.name).toBe("Fluent Channel")
    expect(inspection.inletCount).toBe(2)
    expect(inspection.outletCount).toBe(1)
    expect(inspection.wireCount).toBe(2)
    expect(inspection.hasTimeout).toBe(true)
    expect(inspection.hasBackpressure).toBe(true)
    expect(inspection.hasCircuitBreaker).toBe(true)
    expect(inspection.hasRetry).toBe(true)
  })

  it("builder is immutable (returns new instance)", () => {
    const builder1 = ChannelBuilder.create("ch-1")
    const builder2 = builder1.name("Named")
    const builder3 = builder2.inlet("in")

    // create() defaults name to id, not undefined
    expect(builder1.inspect().name).toBe("ch-1")
    expect(builder2.inspect().name).toBe("Named")
    expect(builder2.inspect().inletCount).toBe(0)
    expect(builder3.inspect().inletCount).toBe(1)
  })
})

// ============================================================================
// REAL-WORLD SCENARIOS
// ============================================================================

describe("ChannelBuilder Real-World Scenarios", () => {
  it.effect("sensor hub topology", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("sensor-hub")
        .name("Environmental Sensor Hub")
        .description("Aggregates multiple environmental sensors")
        .inlet("temperature", { name: "Temperature Sensor" })
        .inlet("humidity", { name: "Humidity Sensor" })
        .inlet("pressure", { name: "Barometric Pressure" })
        .outlet("dashboard", { name: "Dashboard Feed", broadcast: true, maxLag: 32 })
        .outlet("alerts", { name: "Alert Stream", broadcast: false, maxLag: 16 })
        .wire("temperature", "dashboard")
        .wire("humidity", "dashboard")
        .wire("pressure", "dashboard")
        .wire("temperature", "alerts")
        .timeout("30 seconds", "warn")
        .backpressure("drop-oldest", 100)

      const state = yield* builder.build()

      expect(state.name).toBe("Environmental Sensor Hub")
      expect(state.topology.inlets).toHaveLength(3)
      expect(state.topology.outlets).toHaveLength(2)
      expect(state.topology.wires).toHaveLength(4)
      expect(state.protocol.timeout?.duration).toBe("30 seconds")
    })
  )

  it.effect("message router topology", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("message-router")
        .name("Message Router")
        .inlet("api", { name: "API Messages" })
        .inlet("websocket", { name: "WebSocket Messages" })
        .inlet("queue", { name: "Queue Messages" })
        .outlet("processed", { name: "Processed Output", broadcast: true, maxLag: 256 })
        .junction("merge-all", {
          kind: "merge",
          name: "Merge All",
        })
        .wire("api", "merge-all")
        .wire("websocket", "merge-all")
        .wire("queue", "merge-all")
        .wire("merge-all", "processed")
        .circuitBreaker(10, "1 minute")
        .retry(3, "exponential", "1 second")

      const state = yield* builder.build()

      expect(state.topology.inlets).toHaveLength(3)
      expect(state.topology.junctions).toHaveLength(1)
      expect(state.topology.junctions[0].kind).toBe("merge")
      expect(state.protocol.circuitBreaker?.threshold).toBe(10)
    })
  )

  it.effect("event sourcing channel", () =>
    Effect.gen(function* () {
      const builder = ChannelBuilder.create("event-store")
        .name("Event Store Channel")
        .description("Persistent event sourcing pipeline")
        .inlet("commands", { name: "Command Input" })
        .outlet("events", { name: "Event Output", broadcast: true, maxLag: 1024 })
        .outlet("snapshots", { name: "Snapshot Output", broadcast: false, maxLag: 8 })
        .wire("commands", "events")
        .timeout("60 seconds", "fail")
        .backpressure("block", 10000)

      const state = yield* builder.build()

      expect(state.topology.inlets).toHaveLength(1)
      expect(state.topology.outlets).toHaveLength(2)
      expect(state.protocol.backpressure?.capacity).toBe(10000)
    })
  )
})

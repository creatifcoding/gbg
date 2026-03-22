/**
 * Channel Schemas — Vitest Spec
 *
 * Validates TaggedClass schemas for Channel topology components.
 * These tests ensure proper construction and type discrimination.
 */

import { describe, it, expect } from "@effect/vitest"
import {
  // Identity types
  ChannelId,
  InletId,
  OutletId,
  JunctionId,
  WireId,
  CorrelationId,

  // Topology components
  Inlet,
  Outlet,
  Junction,
  Wire,

  // Protocol configuration
  BackpressureConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  RetryConfig,
  ChannelProtocol,

  // State
  ChannelTopology,
  ChannelMetrics,
  ChannelState,

  // Commands
  OpenChannel,
  CloseChannel,
  ConnectInlet,
  DisconnectInlet,

  // Events
  ChannelOpened,
  ChannelClosed,
  ChannelFaulted,
  InletConnected,
  InletDisconnected,
} from "../constructs/Channel"

// ============================================================================
// IDENTITY TYPES
// ============================================================================

describe("Channel Identity Types", () => {
  it("ChannelId is a branded string", () => {
    const id = "my-channel" as ChannelId
    expect(typeof id).toBe("string")
  })

  it("InletId is a branded string", () => {
    const id = "my-inlet" as InletId
    expect(typeof id).toBe("string")
  })

  it("OutletId is a branded string", () => {
    const id = "my-outlet" as OutletId
    expect(typeof id).toBe("string")
  })

  it("JunctionId is a branded string", () => {
    const id = "my-junction" as JunctionId
    expect(typeof id).toBe("string")
  })

  it("WireId is a branded string", () => {
    const id = "my-wire" as WireId
    expect(typeof id).toBe("string")
  })

  it("CorrelationId is a branded string", () => {
    const id = "my-correlation" as CorrelationId
    expect(typeof id).toBe("string")
  })
})

// ============================================================================
// TOPOLOGY COMPONENTS (TaggedClass)
// ============================================================================

describe("Inlet TaggedClass", () => {
  it("constructs with required fields", () => {
    const inlet = new Inlet({
      id: "inlet-1" as InletId,
      name: "Temperature Input",
      channelId: "ch-1" as ChannelId,
      connected: false,
    })

    expect(inlet._tag).toBe("Inlet")
    expect(inlet.id).toBe("inlet-1")
    expect(inlet.name).toBe("Temperature Input")
    expect(inlet.channelId).toBe("ch-1")
    expect(inlet.connected).toBe(false)
    expect(inlet.sourceId).toBeUndefined()
  })

  it("constructs with optional sourceId when connected", () => {
    const inlet = new Inlet({
      id: "inlet-2" as InletId,
      name: "Pressure Input",
      channelId: "ch-1" as ChannelId,
      connected: true,
      sourceId: "sensor-feed-1",
    })

    expect(inlet.connected).toBe(true)
    expect(inlet.sourceId).toBe("sensor-feed-1")
  })

  it("can be spread and reconstructed", () => {
    const original = new Inlet({
      id: "inlet-1" as InletId,
      name: "Test",
      channelId: "ch-1" as ChannelId,
      connected: false,
    })

    const updated = new Inlet({
      ...original,
      connected: true,
      sourceId: "new-source",
    })

    expect(updated._tag).toBe("Inlet")
    expect(updated.id).toBe("inlet-1")
    expect(updated.connected).toBe(true)
    expect(updated.sourceId).toBe("new-source")
  })
})

describe("Outlet TaggedClass", () => {
  it("constructs with required fields", () => {
    const outlet = new Outlet({
      id: "outlet-1" as OutletId,
      name: "Combined Output",
      channelId: "ch-1" as ChannelId,
      broadcast: true,
      maxLag: 64,
      subscriberCount: 0,
    })

    expect(outlet._tag).toBe("Outlet")
    expect(outlet.id).toBe("outlet-1")
    expect(outlet.name).toBe("Combined Output")
    expect(outlet.channelId).toBe("ch-1")
    expect(outlet.broadcast).toBe(true)
    expect(outlet.maxLag).toBe(64)
    expect(outlet.subscriberCount).toBe(0)
  })

  it("tracks subscriber count", () => {
    const outlet = new Outlet({
      id: "outlet-1" as OutletId,
      name: "Test",
      channelId: "ch-1" as ChannelId,
      broadcast: true,
      maxLag: 32,
      subscriberCount: 0,
    })

    const updated = new Outlet({
      ...outlet,
      subscriberCount: outlet.subscriberCount + 1,
    })

    expect(updated.subscriberCount).toBe(1)
  })
})

describe("Junction TaggedClass", () => {
  it("constructs merge junction", () => {
    const junction = new Junction({
      id: "junction-1" as JunctionId,
      name: "Merger",
      channelId: "ch-1" as ChannelId,
      kind: "merge",
    })

    expect(junction._tag).toBe("Junction")
    expect(junction.kind).toBe("merge")
    expect(junction.name).toBe("Merger")
  })

  it("constructs filter junction", () => {
    const junction = new Junction({
      id: "junction-2" as JunctionId,
      name: "Filter",
      channelId: "ch-1" as ChannelId,
      kind: "filter",
    })

    expect(junction.kind).toBe("filter")
  })

  it("constructs map junction", () => {
    const junction = new Junction({
      id: "junction-3" as JunctionId,
      name: "Mapper",
      channelId: "ch-1" as ChannelId,
      kind: "map",
    })

    expect(junction.kind).toBe("map")
  })

  it("constructs broadcast junction", () => {
    const junction = new Junction({
      id: "junction-4" as JunctionId,
      name: "Broadcaster",
      channelId: "ch-1" as ChannelId,
      kind: "broadcast",
    })

    expect(junction.kind).toBe("broadcast")
  })
})

describe("Wire TaggedClass", () => {
  it("constructs with from/to endpoints", () => {
    const wire = new Wire({
      id: "wire-1" as WireId,
      channelId: "ch-1" as ChannelId,
      from: "inlet-1" as InletId,
      to: "outlet-1" as OutletId,
      active: true,
    })

    expect(wire._tag).toBe("Wire")
    expect(wire.id).toBe("wire-1")
    expect(wire.channelId).toBe("ch-1")
    expect(wire.from).toBe("inlet-1")
    expect(wire.to).toBe("outlet-1")
    expect(wire.active).toBe(true)
  })

  it("can be deactivated", () => {
    const wire = new Wire({
      id: "wire-1" as WireId,
      channelId: "ch-1" as ChannelId,
      from: "inlet-1" as InletId,
      to: "outlet-1" as OutletId,
      active: true,
    })

    const deactivated = new Wire({ ...wire, active: false })
    expect(deactivated.active).toBe(false)
  })
})

// ============================================================================
// PROTOCOL CONFIGURATION
// ============================================================================

describe("Protocol Configuration", () => {
  it("BackpressureConfig constructs correctly", () => {
    const config = new BackpressureConfig({
      strategy: "drop-oldest",
      capacity: 100,
    })

    expect(config._tag).toBe("BackpressureConfig")
    expect(config.strategy).toBe("drop-oldest")
    expect(config.capacity).toBe(100)
  })

  it("CircuitBreakerConfig constructs correctly", () => {
    const config = new CircuitBreakerConfig({
      threshold: 5,
      resetAfter: "30 seconds",
      state: "closed",
      failureCount: 0,
    })

    expect(config._tag).toBe("CircuitBreakerConfig")
    expect(config.threshold).toBe(5)
    expect(config.resetAfter).toBe("30 seconds")
    expect(config.state).toBe("closed")
    expect(config.failureCount).toBe(0)
  })

  it("TimeoutConfig constructs correctly", () => {
    const config = new TimeoutConfig({
      duration: "5 seconds",
      behavior: "warn",
    })

    expect(config._tag).toBe("TimeoutConfig")
    expect(config.duration).toBe("5 seconds")
    expect(config.behavior).toBe("warn")
  })

  it("RetryConfig constructs correctly", () => {
    const config = new RetryConfig({
      times: 3,
      backoff: "exponential",
      initialDelay: "1 second",
    })

    expect(config._tag).toBe("RetryConfig")
    expect(config.times).toBe(3)
    expect(config.backoff).toBe("exponential")
    expect(config.initialDelay).toBe("1 second")
  })

  it("ChannelProtocol combines all configs", () => {
    const protocol = new ChannelProtocol({
      timeout: new TimeoutConfig({
        duration: "5 seconds",
        behavior: "fail",
      }),
      backpressure: new BackpressureConfig({
        strategy: "block",
        capacity: 50,
      }),
    })

    expect(protocol._tag).toBe("ChannelProtocol")
    expect(protocol.timeout?.duration).toBe("5 seconds")
    expect(protocol.backpressure?.strategy).toBe("block")
    expect(protocol.circuitBreaker).toBeUndefined()
    expect(protocol.retry).toBeUndefined()
  })
})

// ============================================================================
// CHANNEL TOPOLOGY & STATE
// ============================================================================

describe("ChannelTopology TaggedClass", () => {
  it("constructs with empty arrays", () => {
    const topology = new ChannelTopology({
      inlets: [],
      outlets: [],
      junctions: [],
      wires: [],
    })

    expect(topology._tag).toBe("ChannelTopology")
    expect(topology.inlets).toEqual([])
    expect(topology.outlets).toEqual([])
    expect(topology.junctions).toEqual([])
    expect(topology.wires).toEqual([])
  })

  it("constructs with populated arrays", () => {
    const inlet = new Inlet({
      id: "inlet-1" as InletId,
      name: "Input",
      channelId: "ch-1" as ChannelId,
      connected: false,
    })
    const outlet = new Outlet({
      id: "outlet-1" as OutletId,
      name: "Output",
      channelId: "ch-1" as ChannelId,
      broadcast: true,
      maxLag: 32,
      subscriberCount: 0,
    })
    const wire = new Wire({
      id: "wire-1" as WireId,
      channelId: "ch-1" as ChannelId,
      from: "inlet-1" as InletId,
      to: "outlet-1" as OutletId,
      active: true,
    })

    const topology = new ChannelTopology({
      inlets: [inlet],
      outlets: [outlet],
      junctions: [],
      wires: [wire],
    })

    expect(topology.inlets).toHaveLength(1)
    expect(topology.outlets).toHaveLength(1)
    expect(topology.wires).toHaveLength(1)
    expect(topology.inlets[0].name).toBe("Input")
  })

  it("preserves nested TaggedClass instances", () => {
    const inlet = new Inlet({
      id: "inlet-1" as InletId,
      name: "Test",
      channelId: "ch-1" as ChannelId,
      connected: false,
    })

    const topology = new ChannelTopology({
      inlets: [inlet],
      outlets: [],
      junctions: [],
      wires: [],
    })

    expect(topology.inlets[0]._tag).toBe("Inlet")
  })
})

describe("ChannelMetrics TaggedClass", () => {
  it("constructs with zeroed metrics", () => {
    const metrics = new ChannelMetrics({
      messagesIn: 0,
      messagesOut: 0,
      bytesIn: 0,
      bytesOut: 0,
      errors: 0,
      latencyMs: 0,
      uptime: 0,
    })

    expect(metrics._tag).toBe("ChannelMetrics")
    expect(metrics.messagesIn).toBe(0)
    expect(metrics.messagesOut).toBe(0)
    expect(metrics.bytesIn).toBe(0)
    expect(metrics.bytesOut).toBe(0)
    expect(metrics.errors).toBe(0)
    expect(metrics.latencyMs).toBe(0)
    expect(metrics.uptime).toBe(0)
  })

  it("can be updated immutably", () => {
    const metrics = new ChannelMetrics({
      messagesIn: 10,
      messagesOut: 5,
      bytesIn: 1024,
      bytesOut: 512,
      errors: 1,
      latencyMs: 50,
      uptime: 60000,
    })

    const updated = new ChannelMetrics({
      ...metrics,
      messagesIn: metrics.messagesIn + 1,
    })

    expect(metrics.messagesIn).toBe(10) // Original unchanged
    expect(updated.messagesIn).toBe(11)
  })
})

describe("ChannelState TaggedClass", () => {
  it("constructs minimal channel state", () => {
    const state = new ChannelState({
      id: "test-channel" as ChannelId,
      name: "Test Channel",
      status: "idle",
      topology: new ChannelTopology({
        inlets: [],
        outlets: [],
        junctions: [],
        wires: [],
      }),
      protocol: new ChannelProtocol({}),
      metrics: new ChannelMetrics({
        messagesIn: 0,
        messagesOut: 0,
        bytesIn: 0,
        bytesOut: 0,
        errors: 0,
        latencyMs: 0,
        uptime: 0,
      }),
      createdAt: Date.now(),
    })

    expect(state._tag).toBe("ChannelState")
    expect(state.id).toBe("test-channel")
    expect(state.name).toBe("Test Channel")
    expect(state.status).toBe("idle")
  })

  it("nested topology must be reconstructed on update", () => {
    const inlet = new Inlet({
      id: "inlet-1" as InletId,
      name: "Input",
      channelId: "ch-1" as ChannelId,
      connected: false,
    })

    const state = new ChannelState({
      id: "ch-1" as ChannelId,
      name: "Test",
      status: "open",
      topology: new ChannelTopology({
        inlets: [inlet],
        outlets: [],
        junctions: [],
        wires: [],
      }),
      protocol: new ChannelProtocol({}),
      metrics: new ChannelMetrics({
        messagesIn: 0,
        messagesOut: 0,
        bytesIn: 0,
        bytesOut: 0,
        errors: 0,
        latencyMs: 0,
        uptime: 0,
      }),
      createdAt: Date.now(),
    })

    // This is the correct pattern - wrap topology in new ChannelTopology()
    const updatedInlets = state.topology.inlets.map((i) =>
      i.id === ("inlet-1" as InletId)
        ? new Inlet({ ...i, connected: true })
        : i
    )

    const updated = new ChannelState({
      ...state,
      topology: new ChannelTopology({
        ...state.topology,
        inlets: updatedInlets,
      }),
    })

    expect(updated.topology._tag).toBe("ChannelTopology")
    expect(updated.topology.inlets[0].connected).toBe(true)
  })
})

// ============================================================================
// COMMANDS (TaggedClass)
// ============================================================================

describe("Channel Commands", () => {
  it("OpenChannel command", () => {
    const cmd = new OpenChannel({
      id: "ch-1" as ChannelId,
    })

    expect(cmd._tag).toBe("OpenChannel")
    expect(cmd.id).toBe("ch-1")
  })

  it("CloseChannel command with reason", () => {
    const cmd = new CloseChannel({
      id: "ch-1" as ChannelId,
      reason: "User requested shutdown",
    })

    expect(cmd._tag).toBe("CloseChannel")
    expect(cmd.id).toBe("ch-1")
    expect(cmd.reason).toBe("User requested shutdown")
  })

  it("ConnectInlet command", () => {
    const cmd = new ConnectInlet({
      channelId: "ch-1" as ChannelId,
      inletId: "inlet-1" as InletId,
      sourceId: "feed-1",
    })

    expect(cmd._tag).toBe("ConnectInlet")
    expect(cmd.channelId).toBe("ch-1")
    expect(cmd.inletId).toBe("inlet-1")
    expect(cmd.sourceId).toBe("feed-1")
  })

  it("DisconnectInlet command", () => {
    const cmd = new DisconnectInlet({
      channelId: "ch-1" as ChannelId,
      inletId: "inlet-1" as InletId,
    })

    expect(cmd._tag).toBe("DisconnectInlet")
  })
})

// ============================================================================
// EVENTS (TaggedClass)
// ============================================================================

describe("Channel Events", () => {
  it("ChannelOpened event", () => {
    const event = new ChannelOpened({
      channelId: "ch-1" as ChannelId,
      timestamp: Date.now(),
    })

    expect(event._tag).toBe("ChannelOpened")
    expect(event.channelId).toBe("ch-1")
    expect(typeof event.timestamp).toBe("number")
  })

  it("ChannelClosed event with reason", () => {
    const event = new ChannelClosed({
      channelId: "ch-1" as ChannelId,
      reason: "Shutdown requested",
      timestamp: Date.now(),
    })

    expect(event._tag).toBe("ChannelClosed")
    expect(event.reason).toBe("Shutdown requested")
  })

  it("ChannelFaulted event with error", () => {
    const event = new ChannelFaulted({
      channelId: "ch-1" as ChannelId,
      error: "Connection timeout",
      timestamp: Date.now(),
    })

    expect(event._tag).toBe("ChannelFaulted")
    expect(event.error).toBe("Connection timeout")
  })

  it("InletConnected event", () => {
    const event = new InletConnected({
      channelId: "ch-1" as ChannelId,
      inletId: "inlet-1" as InletId,
      sourceId: "sensor-feed",
      timestamp: Date.now(),
    })

    expect(event._tag).toBe("InletConnected")
    expect(event.inletId).toBe("inlet-1")
    expect(event.sourceId).toBe("sensor-feed")
  })

  it("InletDisconnected event", () => {
    const event = new InletDisconnected({
      channelId: "ch-1" as ChannelId,
      inletId: "inlet-1" as InletId,
      timestamp: Date.now(),
    })

    expect(event._tag).toBe("InletDisconnected")
  })
})

// ============================================================================
// PATTERN MATCHING (discriminated unions)
// ============================================================================

describe("Pattern Matching on _tag", () => {
  it("switch on ChannelCommand._tag", () => {
    const commands = [
      new OpenChannel({ id: "ch-1" as ChannelId }),
      new CloseChannel({ id: "ch-1" as ChannelId }),
    ]

    const results = commands.map((cmd) => {
      switch (cmd._tag) {
        case "OpenChannel":
          return `Opening ${cmd.id}`
        case "CloseChannel":
          return `Closing ${cmd.id}`
        default:
          return "unknown"
      }
    })

    expect(results).toEqual(["Opening ch-1", "Closing ch-1"])
  })

  it("switch on ChannelEvent._tag", () => {
    const events = [
      new ChannelOpened({ channelId: "ch-1" as ChannelId, timestamp: 1 }),
      new ChannelClosed({ channelId: "ch-1" as ChannelId, timestamp: 2 }),
      new ChannelFaulted({ channelId: "ch-1" as ChannelId, error: "boom", timestamp: 3 }),
    ]

    const results = events.map((e) => {
      switch (e._tag) {
        case "ChannelOpened":
          return "opened"
        case "ChannelClosed":
          return "closed"
        case "ChannelFaulted":
          return `faulted: ${e.error}`
        default:
          return "other"
      }
    })

    expect(results).toEqual(["opened", "closed", "faulted: boom"])
  })
})

/**
 * Challenge 7: Channel Demo
 *
 * Demonstrates the Channel construct — a topological multiplexing protocol
 * that enables multi-input, multi-output streaming with resilience patterns.
 *
 * This challenge shows:
 *   Part 1: Building a Channel topology with ChannelBuilder
 *   Part 2: Connecting Feeds to Channel Inlets
 *   Part 3: Subscribing to Channel Outlets
 *   Part 4: Protocol configuration (timeout, backpressure)
 *
 * Run: bun run src/lib/streams/challenges/playground.ts 7
 */

import { Effect, Console, Stream, Duration, Random, pipe, Option } from "effect"
import { Feed } from "../constructs/Feed"
import {
  ChannelBuilder,
  ChannelService,
  ChannelServiceLive,
  type ChannelId,
  type InletId,
  type OutletId,
} from "../constructs"

// ============================================================================
// PART 1: Building a Channel Topology
// ============================================================================

/**
 * Create a sensor hub channel that:
 * - Accepts temperature and pressure readings via separate inlets
 * - Merges them and outputs to a combined outlet
 * - Configures timeout and backpressure protection
 */
const createSensorHub = () =>
  ChannelBuilder.create("sensor-hub")
    .name("Sensor Hub")
    .description("Aggregates multiple sensor streams into a unified output")
    // Topology: 2 inlets → 1 outlet (direct wiring for now)
    .inlet("temperature", { name: "Temperature Inlet" })
    .inlet("pressure", { name: "Pressure Inlet" })
    .outlet("combined", { name: "Combined Output", broadcast: true, maxLag: 32 })
    // Wire both inlets to the combined outlet
    .wire("temperature", "combined")
    .wire("pressure", "combined")
    // Protocol: protection patterns
    .timeout("5 seconds", "warn")
    .backpressure("drop-oldest", 100)

// ============================================================================
// PART 2: Creating Sensor Feeds
// ============================================================================

interface TemperatureReading {
  readonly _tag: "Temperature"
  readonly celsius: number
  readonly timestamp: number
}

interface PressureReading {
  readonly _tag: "Pressure"
  readonly hPa: number
  readonly timestamp: number
}

type SensorReading = TemperatureReading | PressureReading

const temperatureFeed = Feed.make<TemperatureReading>({
  id: "temp-sensor",
  name: "Temperature Sensor",
  interval: "800 millis",
  producer: Effect.gen(function* () {
    const celsius = yield* Random.nextIntBetween(18, 28)
    return {
      _tag: "Temperature" as const,
      celsius,
      timestamp: Date.now(),
    }
  }),
  onConnect: Console.log("[TempSensor] Connected"),
  onDisconnect: Console.log("[TempSensor] Disconnected"),
})

const pressureFeed = Feed.make<PressureReading>({
  id: "press-sensor",
  name: "Pressure Sensor",
  interval: "1200 millis",
  producer: Effect.gen(function* () {
    const hPa = yield* Random.nextIntBetween(1000, 1030)
    return {
      _tag: "Pressure" as const,
      hPa,
      timestamp: Date.now(),
    }
  }),
  onConnect: Console.log("[PressSensor] Connected"),
  onDisconnect: Console.log("[PressSensor] Disconnected"),
})

// ============================================================================
// PART 3: Main Demo Program
// ============================================================================

export const main = Effect.gen(function* () {
  yield* Console.log("╔════════════════════════════════════════════════════════╗")
  yield* Console.log("║         Challenge 7: Channel Demo                      ║")
  yield* Console.log("╚════════════════════════════════════════════════════════╝")
  yield* Console.log("")

  // Get the ChannelService
  const service = yield* ChannelService

  // ── Part 1: Build and register the channel ────────────────────────────────

  yield* Console.log("▸ Part 1: Building sensor hub channel...")

  const builder = createSensorHub()
  const inspection = builder.inspect()

  yield* Console.log(`  Channel: ${inspection.name}`)
  yield* Console.log(`  Inlets: ${inspection.inletCount}`)
  yield* Console.log(`  Outlets: ${inspection.outletCount}`)
  yield* Console.log(`  Timeout configured: ${inspection.hasTimeout}`)
  yield* Console.log(`  Backpressure configured: ${inspection.hasBackpressure}`)

  const channelId = yield* service.register(builder)
  yield* Console.log(`  ✓ Registered channel: ${channelId}`)
  yield* Console.log("")

  // ── Part 2: Open the channel ──────────────────────────────────────────────

  yield* Console.log("▸ Part 2: Opening channel...")
  yield* service.open(channelId)

  const state = yield* service.getState(channelId)
  if (Option.isSome(state)) {
    yield* Console.log(`  Status: ${state.value.status}`)
    yield* Console.log(`  Created: ${new Date(state.value.createdAt).toISOString()}`)
  }
  yield* Console.log("")

  // ── Part 3: Connect feeds to inlets ───────────────────────────────────────

  yield* Console.log("▸ Part 3: Connecting feeds to inlets...")

  // Get inlet IDs from the channel state
  const tempInletId = `${channelId}:inlet:temperature` as InletId
  const pressInletId = `${channelId}:inlet:pressure` as InletId
  const combinedOutletId = `${channelId}:outlet:combined` as OutletId

  // Start the feeds first
  yield* temperatureFeed.start()
  yield* pressureFeed.start()

  // Connect feeds to channel inlets
  yield* service.connectFeed(channelId, tempInletId, temperatureFeed)
  yield* service.connectFeed(channelId, pressInletId, pressureFeed)

  yield* Console.log("  ✓ Connected temperature feed to inlet")
  yield* Console.log("  ✓ Connected pressure feed to inlet")
  yield* Console.log("")

  // ── Part 4: Subscribe to outlet and observe events ────────────────────────

  yield* Console.log("▸ Part 4: Subscribing to combined outlet...")
  yield* Console.log("  (Running for 8 seconds, observing merged sensor data)")
  yield* Console.log("")

  // Subscribe to events
  const eventQueue = yield* service.subscribeEvents()

  // Fork event observer
  const eventFiber = yield* pipe(
    Stream.fromQueue(eventQueue),
    Stream.tap((event) =>
      Console.log(`  [Event] ${event._tag}`)
    ),
    Stream.runDrain,
    Effect.fork
  )

  // Get outlet stream and observe
  const outletStream = yield* service.getOutletStream(channelId, combinedOutletId)

  let count = 0
  yield* pipe(
    outletStream as Stream.Stream<SensorReading, unknown, unknown>,
    Stream.tap((reading) =>
      Effect.gen(function* () {
        count++
        if (reading._tag === "Temperature") {
          yield* Console.log(`  [${count}] 🌡️  Temperature: ${reading.celsius}°C`)
        } else {
          yield* Console.log(`  [${count}] 📊 Pressure: ${reading.hPa} hPa`)
        }
      })
    ),
    Stream.takeUntil(() => count >= 12),
    Stream.runDrain,
    Effect.timeout("8 seconds"),
    Effect.ignore
  )

  yield* Console.log("")

  // ── Part 5: Check metrics and cleanup ─────────────────────────────────────

  yield* Console.log("▸ Part 5: Checking metrics and cleanup...")

  const metrics = yield* service.getMetrics(channelId)
  if (Option.isSome(metrics)) {
    yield* Console.log(`  Messages in: ${metrics.value.messagesIn}`)
    yield* Console.log(`  Messages out: ${metrics.value.messagesOut}`)
    yield* Console.log(`  Errors: ${metrics.value.errors}`)
  }

  // Stop feeds
  yield* temperatureFeed.stop()
  yield* pressureFeed.stop()

  // Close channel
  yield* service.close(channelId, "Demo complete")

  yield* Console.log("  ✓ Feeds stopped")
  yield* Console.log("  ✓ Channel closed")
  yield* Console.log("")
  yield* Console.log("═══════════════════════════════════════════════════════════")
  yield* Console.log("Challenge 7 complete!")
})

// ============================================================================
// RUNNER
// ============================================================================

export const run = () =>
  pipe(
    main,
    Effect.scoped,
    Effect.provide(ChannelServiceLive),
    Effect.runPromise
  )

// Allow direct execution
if (import.meta.main) {
  run()
}

/**
 * Challenge 4: FeedsManager Demo
 *
 * Demonstrates the FeedsManager — orchestrating multiple heterogeneous feeds
 * with type-safe branded IDs and PubSub command channel.
 */

import { Effect, Console, Random, Duration, Schema, Scope, PubSub, Stream, pipe } from "effect"
import { Feed, makeFeed } from "../constructs/Feed"
import {
  FeedsManager,
  FeedsManagerLive,
  FeedId,
  registerFeed,
  getFeed,
  sendCommand,
  FeedCommand,
} from "../constructs/FeedsManager"

// ============================================================================
// FEED DEFINITIONS (heterogeneous types)
// ============================================================================

// Type 1: Temperature readings
class TemperatureReading extends Schema.TaggedClass<TemperatureReading>()(
  "TemperatureReading",
  {
    sensorId: Schema.String,
    celsius: Schema.Number,
    timestamp: Schema.Number,
  }
) {}

const temperatureFeed = Feed.make({
  id: "temp-sensor",
  name: "Temperature Sensor",
  schema: TemperatureReading,
  interval: "300 millis",
  producer: Effect.gen(function* () {
    const celsius = yield* Random.nextIntBetween(18, 28)
    return new TemperatureReading({
      sensorId: "temp-sensor",
      celsius,
      timestamp: Date.now(),
    })
  }),
  onConnect: Console.log("  [Temp] 🌡️  Connected"),
  onDisconnect: Console.log("  [Temp] 🌡️  Disconnected"),
})

// Type 2: Pressure readings
class PressureReading extends Schema.TaggedClass<PressureReading>()(
  "PressureReading",
  {
    sensorId: Schema.String,
    hectopascals: Schema.Number,
    timestamp: Schema.Number,
  }
) {}

const pressureFeed = Feed.make({
  id: "pressure-sensor",
  name: "Pressure Sensor",
  schema: PressureReading,
  interval: "400 millis",
  producer: Effect.gen(function* () {
    const hPa = yield* Random.nextIntBetween(1000, 1030)
    return new PressureReading({
      sensorId: "pressure-sensor",
      hectopascals: hPa,
      timestamp: Date.now(),
    })
  }),
  onConnect: Console.log("  [Press] 📊 Connected"),
  onDisconnect: Console.log("  [Press] 📊 Disconnected"),
})

// Type 3: Simple counter (different shape entirely)
let counterValue = 0
const counterFeed = makeFeed(
  "counter",
  Effect.sync(() => ({ count: ++counterValue, timestamp: Date.now() })),
  {
    name: "Counter",
    interval: "200 millis",
    onConnect: Console.log("  [Count] 🔢 Connected"),
    onDisconnect: Console.log("  [Count] 🔢 Disconnected"),
  }
)

// ============================================================================
// DEMO
// ============================================================================

const demo = Effect.gen(function* () {
  yield* Console.log("═".repeat(60))
  yield* Console.log("  FeedsManager Demo")
  yield* Console.log("═".repeat(60))

  const manager = yield* FeedsManager

  // ── Register feeds with tags ──────────────────────────────────────────────
  yield* Console.log("\n[Demo] Registering feeds...")

  const tempId: FeedId<TemperatureReading> = yield* manager.register(temperatureFeed, {
    tags: ["sensor", "environmental"],
  })
  const pressId: FeedId<PressureReading> = yield* manager.register(pressureFeed, {
    tags: ["sensor", "environmental"],
  })
  const countId = yield* manager.register(counterFeed, {
    tags: ["diagnostic"],
  })

  yield* Console.log(`  Registered: ${tempId}, ${pressId}, ${countId}`)

  // ── List all feeds ────────────────────────────────────────────────────────
  const allIds = yield* manager.listIds()
  yield* Console.log(`\n[Demo] All registered feeds: ${allIds.join(", ")}`)

  // ── Get feeds by tag ──────────────────────────────────────────────────────
  const sensorFeeds = yield* manager.getByTag("sensor")
  yield* Console.log(`[Demo] Feeds tagged 'sensor': ${sensorFeeds.length}`)

  // ── Type-safe retrieval ───────────────────────────────────────────────────
  yield* Console.log("\n[Demo] Type-safe feed retrieval...")
  const maybeTempFeed = yield* manager.get(tempId)
  if (maybeTempFeed._tag === "Some") {
    yield* Console.log(`  Got typed feed: ${maybeTempFeed.value.name}`)
  }

  // ── Start all feeds ───────────────────────────────────────────────────────
  yield* Console.log("\n[Demo] Starting all feeds via startAll()...")
  yield* manager.startAll()

  // ── Subscribe to manager events ───────────────────────────────────────────
  yield* Console.log("\n[Demo] Subscribing to manager events...")
  const eventQueue = yield* manager.subscribeEvents()

  // Fork event listener
  const eventListener = yield* pipe(
    Stream.fromQueue(eventQueue),
    Stream.tap((event) => Console.log(`  [Event] ${event._tag}: ${JSON.stringify(event)}`)),
    Stream.take(6), // Listen for 6 events
    Stream.runDrain,
    Effect.fork
  )

  // ── Let feeds run ─────────────────────────────────────────────────────────
  yield* Console.log("\n[Demo] Letting feeds run for 1.5 seconds...")
  yield* Effect.sleep(Duration.millis(1500))

  // ── Send commands via PubSub ──────────────────────────────────────────────
  yield* Console.log("\n[Demo] Sending StopFeed command via PubSub...")
  yield* PubSub.publish(manager.commands, { _tag: "StopFeed", id: "counter" } as FeedCommand)

  yield* Effect.sleep(Duration.millis(300))

  // ── Get statuses ──────────────────────────────────────────────────────────
  yield* Console.log("\n[Demo] Feed statuses:")
  const statuses = yield* manager.getStatuses()
  for (const [id, status] of statuses) {
    yield* Console.log(`  ${id}: ${status}`)
  }

  // ── Stop all ──────────────────────────────────────────────────────────────
  yield* Console.log("\n[Demo] Stopping all feeds...")
  yield* manager.stopAll()

  yield* Effect.sleep(Duration.millis(200))

  // Final statuses
  yield* Console.log("\n[Demo] Final statuses:")
  const finalStatuses = yield* manager.getStatuses()
  for (const [id, status] of finalStatuses) {
    yield* Console.log(`  ${id}: ${status}`)
  }

  yield* Console.log("\n[Demo] Done!")
})

// ============================================================================
// RUNNER
// ============================================================================

export const runManagerDemo = pipe(
  demo,
  Effect.scoped,
  Effect.provide(FeedsManagerLive),
  Effect.runPromise
)

export const runChallenge4 = () => runManagerDemo

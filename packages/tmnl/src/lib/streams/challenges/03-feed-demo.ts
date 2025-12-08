/**
 * Challenge 3: Feed Class Demo
 *
 * Demonstrates the Feed abstraction — a supervised, interruptible stream source.
 */

import { Effect, Console, Random, Duration, Schema } from "effect"
import { Feed, makeFeed } from "../constructs/Feed"

// ============================================================================
// EXAMPLE: Temperature Sensor Feed
// ============================================================================

class TemperatureReading extends Schema.TaggedClass<TemperatureReading>()(
  "TemperatureReading",
  {
    sensorId: Schema.String,
    celsius: Schema.Number,
    timestamp: Schema.Number,
  }
) {}

const temperatureSensor = Feed.make({
  id: "temp-sensor-01",
  name: "Temperature Sensor",
  schema: TemperatureReading,
  interval: "500 millis",
  producer: Effect.gen(function* () {
    const celsius = yield* Random.nextIntBetween(18, 28)
    return new TemperatureReading({
      sensorId: "temp-sensor-01",
      celsius,
      timestamp: Date.now(),
    })
  }),
  onConnect: Console.log("[Sensor] Connected to temperature sensor"),
  onDisconnect: Console.log("[Sensor] Disconnected from temperature sensor"),
})

// ============================================================================
// EXAMPLE: Simple Counter Feed (using makeFeed shorthand)
// ============================================================================

let counter = 0
const counterFeed = makeFeed(
  "counter",
  Effect.sync(() => ++counter),
  {
    name: "Simple Counter",
    interval: "200 millis",
    onConnect: Console.log("[Counter] Started"),
    onDisconnect: Console.log("[Counter] Stopped"),
  }
)

// ============================================================================
// DEMO RUNNER
// ============================================================================

export const runFeedDemo = Effect.gen(function* () {
  yield* Console.log("═".repeat(60))
  yield* Console.log("  Feed Class Demo")
  yield* Console.log("═".repeat(60))

  // Check initial status
  const initialStatus = yield* temperatureSensor.status
  yield* Console.log(`\n[Demo] Initial status: ${initialStatus}`)

  // Run the temperature sensor for 2 seconds
  yield* Console.log("\n[Demo] Running temperature sensor for 2 seconds...")

  yield* temperatureSensor.run(
    (reading) =>
      Console.log(
        `  📡 ${reading.sensorId}: ${reading.celsius}°C @ ${new Date(reading.timestamp).toISOString()}`
      ),
    { duration: "2 seconds" }
  )

  // Check status after
  const finalStatus = yield* temperatureSensor.status
  yield* Console.log(`\n[Demo] Final status: ${finalStatus}`)

  // Get full state
  const state = yield* temperatureSensor.state
  yield* Console.log(`[Demo] Total events emitted: ${state.eventCount}`)

  yield* Console.log("\n" + "═".repeat(60))
  yield* Console.log("  Signal-based Control Demo")
  yield* Console.log("═".repeat(60))

  // Demonstrate signal-based control
  yield* Console.log("\n[Demo] Sending Start signal to counter feed...")
  yield* counterFeed.signal({ _tag: "Start" })

  yield* Effect.sleep(Duration.millis(800))

  yield* Console.log("\n[Demo] Sending Stop signal...")
  yield* counterFeed.signal({ _tag: "Stop" })

  const counterState = yield* counterFeed.state
  yield* Console.log(`[Demo] Counter final count: ${counterState.eventCount}`)

  yield* Console.log("\n[Demo] Done!")
})

// ============================================================================
// PLAYGROUND INTEGRATION
// ============================================================================

export const runChallenge3 = () => Effect.runPromise(runFeedDemo)

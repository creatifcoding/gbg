/**
 * Challenge 6: Multi-Source Merge
 *
 * Scenario: Three sensors emit at different rates.
 * Goal:
 *   1. Merge all three into a unified stream of tagged events
 *   2. Partition by sensor type
 *   3. Race against a timeout — warn if any sensor goes silent
 *
 * Hints:
 *   - Stream.merge / Stream.mergeAll
 *   - Stream.partition / Stream.partitionEither
 *   - Either.left / Either.right for tagging
 *   - Stream.timeout / Stream.timeoutFail
 */

import { Effect, Stream, Console, Duration, Random, Either, Scope, Fiber } from "effect"
import { Schema } from "effect"

// ============================================================================
// DOMAIN TYPES
// ============================================================================

// Define your sensor reading schemas here
// Use Schema.TaggedStruct for discriminated unions

const TemperatureReading = Schema.TaggedStruct("Temperature", {
  celsius: Schema.Number,
  timestamp: Schema.Number,
})
type TemperatureReading = typeof TemperatureReading.Type

const PressureReading = Schema.TaggedStruct("Pressure", {
  hPa: Schema.Number,
  timestamp: Schema.Number,
})
type PressureReading = typeof PressureReading.Type

const HumidityReading = Schema.TaggedStruct("Humidity", {
  percent: Schema.Number,
  timestamp: Schema.Number,
})
type HumidityReading = typeof HumidityReading.Type

// Union of all sensor readings
const SensorReading = Schema.Union(TemperatureReading, PressureReading, HumidityReading)
type SensorReading = typeof SensorReading.Type

// ============================================================================
// SIMULATED SENSORS
// ============================================================================

// Temperature sensor: emits every 300ms
const temperatureSensor: Stream.Stream<TemperatureReading> = Stream.repeatEffect(
  Effect.gen(function* () {
    const jitter = yield* Random.nextIntBetween(-50, 50)
    yield* Effect.sleep(Duration.millis(300 + jitter))
    const celsius = 20 + Math.random() * 10 // 20-30°C
    return { _tag: "Temperature" as const, celsius, timestamp: Date.now() }
  })
)

// Pressure sensor: emits every 500ms
const pressureSensor: Stream.Stream<PressureReading> = Stream.repeatEffect(
  Effect.gen(function* () {
    const jitter = yield* Random.nextIntBetween(-100, 100)
    yield* Effect.sleep(Duration.millis(500 + jitter))
    const hPa = 1000 + Math.random() * 30 // 1000-1030 hPa
    return { _tag: "Pressure" as const, hPa, timestamp: Date.now() }
  })
)

// Humidity sensor: emits every 700ms
const humiditySensor: Stream.Stream<HumidityReading> = Stream.repeatEffect(
  Effect.gen(function* () {
    const jitter = yield* Random.nextIntBetween(-150, 150)
    yield* Effect.sleep(Duration.millis(700 + jitter))
    const percent = 40 + Math.random() * 40 // 40-80%
    return { _tag: "Humidity" as const, percent, timestamp: Date.now() }
  })
)

// ============================================================================
// YOUR CHALLENGE
// ============================================================================

/**
 * Part 1: Merge all sensors into a unified stream
 *
 * Expected behavior:
 * - Interleaved emissions from all three sensors
 * - Each reading tagged with _tag discriminator
 *
 * Pattern: Stream.mergeAll takes a concurrency option and returns a function
 * that accepts an Iterable of streams. All streams run concurrently,
 * emissions are interleaved in arrival order.
 */
export const mergedSensors: Stream.Stream<SensorReading> = Stream.mergeAll(
  [temperatureSensor, pressureSensor, humiditySensor],
  { concurrency: "unbounded" }
)

/**
 * Part 2: Partition the merged stream by sensor type
 *
 * Create a function that splits the stream into three separate streams,
 * one for each sensor type.
 *
 * Pattern: Stream.broadcast(n, maximumLag) creates n downstream streams.
 * Returns a Stream<[Stream<A>, Stream<A>, ...]> which you flatMap to consume.
 * maximumLag controls backpressure — how far the source can advance before
 * slowing to match the slowest consumer.
 *
 * Note: broadcast requires Scope because it uses a PubSub hub internally.
 */
export const partitionBySensorType = (
  stream: Stream.Stream<SensorReading>
): Effect.Effect<
  {
    temperature: Stream.Stream<TemperatureReading>
    pressure: Stream.Stream<PressureReading>
    humidity: Stream.Stream<HumidityReading>
  },
  never,
  Scope.Scope
> =>
  // broadcast(n, maxLag) returns Effect<[Stream, Stream, ...]> requiring Scope
  stream.pipe(
    Stream.broadcast(3, 16),
    Stream.runHead, // Get the tuple of 3 streams
    Effect.map((opt) => {
      const [s1, s2, s3] = opt._tag === "Some" ? opt.value : [Stream.empty, Stream.empty, Stream.empty]
      return {
        temperature: s1.pipe(
          Stream.filter((r): r is TemperatureReading => r._tag === "Temperature")
        ),
        pressure: s2.pipe(
          Stream.filter((r): r is PressureReading => r._tag === "Pressure")
        ),
        humidity: s3.pipe(
          Stream.filter((r): r is HumidityReading => r._tag === "Humidity")
        ),
      }
    })
  )

/**
 * Part 3: Add timeout detection
 *
 * Create a wrapper that monitors a sensor stream and emits a warning
 * event if no reading arrives within 2 seconds.
 *
 * Pattern: Stream.timeoutFail fails the stream on timeout. We catch that
 * failure with Stream.catchAll and emit a warning, then recurse to
 * continue monitoring. Each successful reading resets the timeout.
 *
 * Either convention: Left = success (readings), Right = error (warnings)
 * This matches Effect's Either.left for the "happy path".
 */
export const withTimeoutWarning = <A>(
  stream: Stream.Stream<A>,
  sensorName: string
): Stream.Stream<Either.Either<string, A>> => {
  // Wrap each element in Either.right (success), timeout produces Either.left (warning)
  // Stream.timeoutFail signature: (onTimeout, duration) — NOT an options object!
  const monitored: Stream.Stream<Either.Either<string, A>> = stream.pipe(
    Stream.map(Either.right),
    Stream.timeoutFail(() => new Error(`${sensorName} timeout`), "2 seconds"),
    Stream.catchAll((error) =>
      // Emit warning, then continue monitoring
      Stream.make(Either.left(`⚠️ Warning: ${error.message}`)).pipe(
        Stream.concat(monitored) // Recurse to keep monitoring
      )
    )
  )

  return monitored
}

// ============================================================================
// DEMO RUNNER
// ============================================================================

export const runChallenge6 = Effect.gen(function* () {
  yield* Console.log("═".repeat(60))
  yield* Console.log("  Challenge 6: Multi-Source Merge")
  yield* Console.log("═".repeat(60))

  // Part 1: Show merged stream
  yield* Console.log("\n[Part 1] Merged sensor stream (8 readings):")
  yield* mergedSensors.pipe(
    Stream.take(8),
    Stream.tap((reading) => {
      switch (reading._tag) {
        case "Temperature":
          return Console.log(`  🌡️  ${reading.celsius.toFixed(1)}°C`)
        case "Pressure":
          return Console.log(`  🔵 ${reading.hPa.toFixed(1)} hPa`)
        case "Humidity":
          return Console.log(`  💧 ${reading.percent.toFixed(1)}%`)
      }
    }),
    Stream.runDrain
  )

  // Part 2: Show partitioned streams
  yield* Console.log("\n[Part 2] Partitioned by type (3 each):")
  yield* Effect.scoped(
    Effect.gen(function* () {
      const { temperature, pressure, humidity } = yield* partitionBySensorType(mergedSensors)

      // Run all three in parallel, take 3 from each
      yield* Effect.all([
        temperature.pipe(
          Stream.take(3),
          Stream.tap((r) => Console.log(`  🌡️  Temp: ${r.celsius.toFixed(1)}°C`)),
          Stream.runDrain
        ),
        pressure.pipe(
          Stream.take(3),
          Stream.tap((r) => Console.log(`  🔵 Press: ${r.hPa.toFixed(1)} hPa`)),
          Stream.runDrain
        ),
        humidity.pipe(
          Stream.take(3),
          Stream.tap((r) => Console.log(`  💧 Humid: ${r.percent.toFixed(1)}%`)),
          Stream.runDrain
        ),
      ], { concurrency: "unbounded" })
    })
  )

  // Part 3: Show timeout warnings with a slow sensor
  yield* Console.log("\n[Part 3] Timeout warnings (slow sensor simulation):")

  // Create a "flaky" sensor that sometimes delays 3+ seconds
  const flakySensor: Stream.Stream<TemperatureReading> = Stream.repeatEffect(
    Effect.gen(function* () {
      // 30% chance of a 3-second delay (triggers timeout)
      const isFlaky = (yield* Random.nextIntBetween(0, 10)) < 3
      const delayMs = isFlaky ? 3000 : 500
      return yield* Effect.delay(
        Effect.succeed({ _tag: "Temperature" as const, celsius: 22, timestamp: Date.now() }),
        Duration.millis(delayMs)
      )
    })
  )

  yield* withTimeoutWarning(flakySensor, "FlakySensor").pipe(
    Stream.take(6),
    Stream.tap((either) =>
      Either.match(either, {
        onLeft: (warning) => Console.log(`  ${warning}`),
        onRight: (reading) => Console.log(`  ✓ Reading: ${reading.celsius}°C`),
      })
    ),
    Stream.runDrain
  )

  yield* Console.log("\n[Challenge 6] Complete!")
})


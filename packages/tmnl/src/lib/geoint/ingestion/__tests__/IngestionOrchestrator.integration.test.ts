/**
 * IngestionOrchestrator Integration Tests
 *
 * Tests the IngestionOrchestrator service with mock ingesters.
 * Validates lifecycle management, individual control, and status reporting.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 bunx vitest run src/lib/geoint/ingestion/__tests__/IngestionOrchestrator.integration.test.ts
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Fiber, Ref, Option, Duration } from 'effect'
import {
  IngestionOrchestratorTag,
  IngestionOrchestratorLive,
  IngestionOrchestratorConfigTag,
  type OrchestratorConfig,
} from '../IngestionOrchestrator'
import { FlightIngesterTag, type FlightIngester } from '../FlightIngester'
import { OsmIngesterTag, type OsmIngester } from '../OsmIngester'
import { WeatherIngesterTag, type WeatherIngester } from '../WeatherIngester'
import { ImageryIngesterTag, type ImageryIngester } from '../ImageryIngester'

// =============================================================================
// Test Configuration
// =============================================================================

const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Mock Ingester Factory
// =============================================================================

/**
 * Create a mock ingester that tracks start/stop calls
 */
interface MockIngesterState {
  startCount: number
  stopCount: number
  isRunning: boolean
}

const createMockFlightIngester = (stateRef: Ref.Ref<MockIngesterState>) =>
  Layer.effect(
    FlightIngesterTag,
    Effect.gen(function* () {
      return FlightIngesterTag.of({
        ingestOpenSky: () =>
          Effect.succeed({
            source: 'opensky',
            region: 'mock',
            recordsIngested: 0,
            latencyMs: 10,
            timestamp: new Date(),
          }),
        ingestAdsbLol: () =>
          Effect.succeed({
            source: 'adsb_lol',
            region: 'mock',
            recordsIngested: 0,
            latencyMs: 10,
            timestamp: new Date(),
          }),
        start: () =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              startCount: s.startCount + 1,
              isRunning: true,
            }))
            // Create a fiber that runs indefinitely until interrupted
            const fiber = yield* Effect.fork(
              Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Ref.update(stateRef, (s) => ({ ...s, isRunning: false }))
                )
              )
            )
            return fiber as Fiber.RuntimeFiber<void, Error>
          }),
        stop: (fiber: Fiber.RuntimeFiber<void, Error>) =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              stopCount: s.stopCount + 1,
              isRunning: false,
            }))
            yield* Fiber.interrupt(fiber)
          }),
        config: {
          regions: [],
          openSkyIntervalMs: 60000,
          adsbLolIntervalMs: 60000,
          adsbLolRadiusNm: 100,
          logIngestion: false,
        },
      } as unknown as FlightIngester)
    })
  )

const createMockOsmIngester = (stateRef: Ref.Ref<MockIngesterState>) =>
  Layer.effect(
    OsmIngesterTag,
    Effect.gen(function* () {
      return OsmIngesterTag.of({
        ingestRegion: () =>
          Effect.succeed({
            source: 'osm',
            region: 'mock',
            recordsIngested: 0,
            latencyMs: 10,
            timestamp: new Date(),
          }),
        start: () =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              startCount: s.startCount + 1,
              isRunning: true,
            }))
            const fiber = yield* Effect.fork(
              Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Ref.update(stateRef, (s) => ({ ...s, isRunning: false }))
                )
              )
            )
            return fiber as Fiber.RuntimeFiber<void, Error>
          }),
        stop: (fiber: Fiber.RuntimeFiber<void, Error>) =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              stopCount: s.stopCount + 1,
              isRunning: false,
            }))
            yield* Fiber.interrupt(fiber)
          }),
        config: {
          regions: [],
          intervalMs: 300000,
          logIngestion: false,
        },
      } as unknown as OsmIngester)
    })
  )

const createMockWeatherIngester = (stateRef: Ref.Ref<MockIngesterState>) =>
  Layer.effect(
    WeatherIngesterTag,
    Effect.gen(function* () {
      return WeatherIngesterTag.of({
        ingestGrid: () =>
          Effect.succeed({
            source: 'weather',
            region: 'mock',
            recordsIngested: 0,
            latencyMs: 10,
            timestamp: new Date(),
          }),
        start: () =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              startCount: s.startCount + 1,
              isRunning: true,
            }))
            const fiber = yield* Effect.fork(
              Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Ref.update(stateRef, (s) => ({ ...s, isRunning: false }))
                )
              )
            )
            return fiber as Fiber.RuntimeFiber<void, Error>
          }),
        stop: (fiber: Fiber.RuntimeFiber<void, Error>) =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              stopCount: s.stopCount + 1,
              isRunning: false,
            }))
            yield* Fiber.interrupt(fiber)
          }),
        config: {
          grid: { name: 'mock', bounds: [0, 0, 0, 0], resolution: 1 },
          intervalMs: 3600000,
          logIngestion: false,
        },
      } as unknown as WeatherIngester)
    })
  )

const createMockImageryIngester = (stateRef: Ref.Ref<MockIngesterState>) =>
  Layer.effect(
    ImageryIngesterTag,
    Effect.gen(function* () {
      return ImageryIngesterTag.of({
        ingestRegion: () =>
          Effect.succeed({
            source: 'imagery',
            region: 'mock',
            recordsIngested: 0,
            latencyMs: 10,
            timestamp: new Date(),
          }),
        start: () =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              startCount: s.startCount + 1,
              isRunning: true,
            }))
            const fiber = yield* Effect.fork(
              Effect.never.pipe(
                Effect.onInterrupt(() =>
                  Ref.update(stateRef, (s) => ({ ...s, isRunning: false }))
                )
              )
            )
            return fiber as Fiber.RuntimeFiber<void, Error>
          }),
        stop: (fiber: Fiber.RuntimeFiber<void, Error>) =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              stopCount: s.stopCount + 1,
              isRunning: false,
            }))
            yield* Fiber.interrupt(fiber)
          }),
        config: {
          regions: [],
          intervalMs: 86400000,
          logIngestion: false,
        },
      } as unknown as ImageryIngester)
    })
  )

// =============================================================================
// Test Helpers
// =============================================================================

const initialMockState: MockIngesterState = {
  startCount: 0,
  stopCount: 0,
  isRunning: false,
}

/**
 * Create test layer with all mock ingesters and state refs
 */
const createTestContext = () =>
  Effect.gen(function* () {
    const flightState = yield* Ref.make<MockIngesterState>(initialMockState)
    const osmState = yield* Ref.make<MockIngesterState>(initialMockState)
    const weatherState = yield* Ref.make<MockIngesterState>(initialMockState)
    const imageryState = yield* Ref.make<MockIngesterState>(initialMockState)

    const configLayer = Layer.succeed(IngestionOrchestratorConfigTag, {
      enableFlight: true,
      enableOsm: true,
      enableWeather: true,
      enableImagery: true,
    } satisfies OrchestratorConfig)

    const testLayer = IngestionOrchestratorLive.pipe(
      Layer.provide(configLayer),
      Layer.provideMerge(createMockFlightIngester(flightState)),
      Layer.provideMerge(createMockOsmIngester(osmState)),
      Layer.provideMerge(createMockWeatherIngester(weatherState)),
      Layer.provideMerge(createMockImageryIngester(imageryState))
    )

    return {
      layer: testLayer,
      flightState,
      osmState,
      weatherState,
      imageryState,
    }
  })

// =============================================================================
// Integration Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('IngestionOrchestrator Integration', () => {
  describe('Lifecycle Management', () => {
    it('starts all enabled ingesters', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start all ingesters
        yield* orchestrator.start()

        // Check all started
        const flightState = yield* Ref.get(ctx.flightState)
        const osmState = yield* Ref.get(ctx.osmState)
        const weatherState = yield* Ref.get(ctx.weatherState)
        const imageryState = yield* Ref.get(ctx.imageryState)

        expect(flightState.startCount).toBe(1)
        expect(osmState.startCount).toBe(1)
        expect(weatherState.startCount).toBe(1)
        expect(imageryState.startCount).toBe(1)

        expect(flightState.isRunning).toBe(true)
        expect(osmState.isRunning).toBe(true)
        expect(weatherState.isRunning).toBe(true)
        expect(imageryState.isRunning).toBe(true)

        // Cleanup
        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('stops all running ingesters', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start and then stop
        yield* orchestrator.start()
        yield* orchestrator.stop()

        // Check all stopped
        const flightState = yield* Ref.get(ctx.flightState)
        const osmState = yield* Ref.get(ctx.osmState)
        const weatherState = yield* Ref.get(ctx.weatherState)
        const imageryState = yield* Ref.get(ctx.imageryState)

        expect(flightState.stopCount).toBe(1)
        expect(osmState.stopCount).toBe(1)
        expect(weatherState.stopCount).toBe(1)
        expect(imageryState.stopCount).toBe(1)

        expect(flightState.isRunning).toBe(false)
        expect(osmState.isRunning).toBe(false)
        expect(weatherState.isRunning).toBe(false)
        expect(imageryState.isRunning).toBe(false)
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('does not start already running ingesters', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start twice
        yield* orchestrator.start()
        yield* orchestrator.start()

        // Should only start once
        const flightState = yield* Ref.get(ctx.flightState)
        expect(flightState.startCount).toBe(1)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('handles stop when nothing is running', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Stop without starting - should not error
        yield* orchestrator.stop()

        const flightState = yield* Ref.get(ctx.flightState)
        expect(flightState.stopCount).toBe(0)
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })
  })

  describe('Individual Ingester Control', () => {
    it('starts a specific ingester', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start only flight ingester
        yield* orchestrator.startIngester('flight')

        const flightState = yield* Ref.get(ctx.flightState)
        const osmState = yield* Ref.get(ctx.osmState)

        expect(flightState.startCount).toBe(1)
        expect(flightState.isRunning).toBe(true)
        expect(osmState.startCount).toBe(0)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('stops a specific ingester', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start all, then stop only OSM
        yield* orchestrator.start()
        yield* orchestrator.stopIngester('osm')

        const flightState = yield* Ref.get(ctx.flightState)
        const osmState = yield* Ref.get(ctx.osmState)

        expect(flightState.isRunning).toBe(true)
        expect(osmState.isRunning).toBe(false)
        expect(osmState.stopCount).toBe(1)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('can restart a stopped ingester', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start, stop, start again
        yield* orchestrator.startIngester('weather')
        yield* orchestrator.stopIngester('weather')
        yield* orchestrator.startIngester('weather')

        const weatherState = yield* Ref.get(ctx.weatherState)
        expect(weatherState.startCount).toBe(2)
        expect(weatherState.stopCount).toBe(1)
        expect(weatherState.isRunning).toBe(true)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })
  })

  describe('Status Reporting', () => {
    it('reports idle status initially', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        const status = yield* orchestrator.status()

        expect(status.running).toBe(false)
        expect(Option.isNone(status.startedAt)).toBe(true)
        expect(status.ingesters.length).toBe(4)
        expect(status.ingesters.every((i) => !i.running)).toBe(true)
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('reports running status after start', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        yield* orchestrator.start()
        const status = yield* orchestrator.status()

        expect(status.running).toBe(true)
        expect(Option.isSome(status.startedAt)).toBe(true)
        expect(status.ingesters.filter((i) => i.running).length).toBe(4)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('reports partial status correctly', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        // Start only some ingesters
        yield* orchestrator.startIngester('flight')
        yield* orchestrator.startIngester('osm')

        const status = yield* orchestrator.status()

        expect(status.running).toBe(true)
        expect(status.ingesters.filter((i) => i.running).length).toBe(2)

        const flightStatus = status.ingesters.find((i) => i.name === 'flight')
        const osmStatus = status.ingesters.find((i) => i.name === 'osm')
        const weatherStatus = status.ingesters.find((i) => i.name === 'weather')

        expect(flightStatus?.running).toBe(true)
        expect(osmStatus?.running).toBe(true)
        expect(weatherStatus?.running).toBe(false)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })
  })

  describe('Configuration', () => {
    it('respects enableFlight=false', async () => {
      const program = Effect.gen(function* () {
        const flightState = yield* Ref.make<MockIngesterState>(initialMockState)
        const osmState = yield* Ref.make<MockIngesterState>(initialMockState)
        const weatherState = yield* Ref.make<MockIngesterState>(initialMockState)
        const imageryState = yield* Ref.make<MockIngesterState>(initialMockState)

        const configLayer = Layer.succeed(IngestionOrchestratorConfigTag, {
          enableFlight: false, // Disabled
          enableOsm: true,
          enableWeather: true,
          enableImagery: true,
        } satisfies OrchestratorConfig)

        const testLayer = IngestionOrchestratorLive.pipe(
          Layer.provide(configLayer),
          Layer.provideMerge(createMockFlightIngester(flightState)),
          Layer.provideMerge(createMockOsmIngester(osmState)),
          Layer.provideMerge(createMockWeatherIngester(weatherState)),
          Layer.provideMerge(createMockImageryIngester(imageryState))
        )

        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(testLayer)
        )

        yield* orchestrator.start()

        const fs = yield* Ref.get(flightState)
        const os = yield* Ref.get(osmState)

        // Flight should not start
        expect(fs.startCount).toBe(0)
        expect(fs.isRunning).toBe(false)

        // Others should start
        expect(os.startCount).toBe(1)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('exposes config through service', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        expect(orchestrator.config.enableFlight).toBe(true)
        expect(orchestrator.config.enableOsm).toBe(true)
        expect(orchestrator.config.enableWeather).toBe(true)
        expect(orchestrator.config.enableImagery).toBe(true)
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })
  })

  describe('Graceful Shutdown', () => {
    it('stops all ingesters on shutdown', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        yield* orchestrator.start()

        // Simulate graceful shutdown
        yield* orchestrator.stop()

        // All should be stopped
        const flightState = yield* Ref.get(ctx.flightState)
        const osmState = yield* Ref.get(ctx.osmState)
        const weatherState = yield* Ref.get(ctx.weatherState)
        const imageryState = yield* Ref.get(ctx.imageryState)

        expect(flightState.isRunning).toBe(false)
        expect(osmState.isRunning).toBe(false)
        expect(weatherState.isRunning).toBe(false)
        expect(imageryState.isRunning).toBe(false)
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })

    it('stop is idempotent', async () => {
      const program = Effect.gen(function* () {
        const ctx = yield* createTestContext()
        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(ctx.layer)
        )

        yield* orchestrator.start()
        yield* orchestrator.stop()
        yield* orchestrator.stop() // Second stop should not error

        const flightState = yield* Ref.get(ctx.flightState)
        expect(flightState.stopCount).toBe(1) // Should only stop once
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })
  })

  describe('Missing Ingesters', () => {
    it('handles missing ingester gracefully', async () => {
      const program = Effect.gen(function* () {
        const osmState = yield* Ref.make<MockIngesterState>(initialMockState)

        const configLayer = Layer.succeed(IngestionOrchestratorConfigTag, {
          enableFlight: true, // Enabled but not provided
          enableOsm: true,
          enableWeather: false,
          enableImagery: false,
        } satisfies OrchestratorConfig)

        // Only provide OSM ingester
        const testLayer = IngestionOrchestratorLive.pipe(
          Layer.provide(configLayer),
          Layer.provideMerge(createMockOsmIngester(osmState))
        )

        const orchestrator = yield* IngestionOrchestratorTag.pipe(
          Effect.provide(testLayer)
        )

        // Should not throw even though flight ingester is missing
        yield* orchestrator.start()

        const os = yield* Ref.get(osmState)
        expect(os.startCount).toBe(1)

        const status = yield* orchestrator.status()
        // Only OSM should be running
        expect(status.ingesters.filter((i) => i.running).length).toBe(1)

        yield* orchestrator.stop()
      })

      await Effect.runPromise(program.pipe(Effect.timeout(Duration.seconds(5))))
    })
  })
})

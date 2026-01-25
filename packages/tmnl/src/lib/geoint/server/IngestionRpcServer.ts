/**
 * IngestionRpcServer - RPC Server handlers for on-demand flight ingestion
 *
 * Provides server-side handlers for IngestionClient RPCs:
 * - On-demand flight ingestion by ICAO24 or region
 * - Background ingestion orchestrator control
 *
 * Completes the vertical slice:
 * Browser → AtomRpc → Handler → External API → PostgreSQL → DurableStreams → Electric → Atoms → UI
 *
 * @see beads:tmnl-vertical-slice ECS Vertical Slice Integration
 * @module
 */

import { Effect, Layer, Option, pipe } from 'effect'
import * as RpcServer from '@effect/rpc/RpcServer'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { FetchHttpClient } from '@effect/platform'
import { PgClient } from '@effect/sql-pg'

import {
  IngestionRpcs,
  IngestionError,
  FlightNotFoundError,
  type FlightIngestionResult,
  type RegionIngestionResult,
  type PoiIngestionResult,
  type WeatherIngestionResult,
  type WeatherPointResult,
  type ImageryIngestionResult,
  type IngesterStatus,
  type OrchestratorStatus,
  type IngesterName,
} from '../clients/IngestionClient'
import {
  AdsbLolClientService,
  OpenSkyClientService,
  ExternalApiClientsLive,
} from '../api/ExternalApiClient'
import {
  openSkyToFlightPosition,
  adsbLolToFlightPosition,
} from '../ingestion/FlightIngester'
import {
  FlightRepositoryTag,
  type FlightPositionInput,
} from '../persistence/postgis/FlightRepository'
import { FlightStreamHandle } from '../services/FlightStreamHandle'
import { FlightPositionEvent, type FlightSource } from '../schemas/flight-events'
import {
  IngestionOrchestratorTag,
  IngestionPipelineLive,
} from '../ingestion'
import { OsmIngesterTag, type OsmIngestionRegion } from '../ingestion/OsmIngester'
import { WeatherIngesterTag, type WeatherIngestionGrid, generateLocationId } from '../ingestion/WeatherIngester'
import { ImageryIngesterTag, type ImageryIngestionRegion } from '../ingestion/ImageryIngester'
import { parseIngestionError } from '../schemas/ingestion'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert FlightPositionInput to FlightPositionEvent for stream publishing.
 */
const toFlightEvent = (input: FlightPositionInput): FlightPositionEvent => {
  const source: FlightSource = input.source === 'adsb_lol' ? 'adsb_lol' : 'opensky'

  return new FlightPositionEvent({
    icao24: input.icao24.toLowerCase(),
    source,
    position: [
      input.longitude,
      input.latitude,
      Option.getOrElse(input.altitudeM, () => 0),
    ],
    heading: Option.getOrUndefined(input.headingDeg),
    speed: Option.getOrUndefined(input.velocityMps),
    verticalRate: Option.getOrUndefined(input.verticalRate),
    callsign: Option.getOrUndefined(input.callsign),
    squawk: Option.getOrUndefined(input.squawk),
    onGround: Option.getOrElse(input.onGround, () => false),
    observedAt: input.time,
    category: Option.getOrUndefined(input.category),
    originCountry: Option.getOrUndefined(input.originCountry),
  })
}

/**
 * Create "not configured" orchestrator status
 */
const notConfiguredStatus = (): OrchestratorStatus => ({
  running: false,
  ingesters: [],
  startedAt: undefined,
  totalRecordsIngested: 0,
})

/**
 * Create "not found" ingester status
 */
const ingesterNotFoundStatus = (name: string): IngesterStatus => ({
  name,
  running: false,
  lastPollAt: undefined,
  recordsIngested: 0,
  errorCount: 0,
  lastError: `Ingester '${name}' not found`,
})

/**
 * Map internal IngesterStatus to RPC response format
 */
const mapIngesterStatus = (status: {
  readonly name: string
  readonly running: boolean
  readonly startedAt: Option.Option<Date>
  readonly error: Option.Option<string>
}): IngesterStatus => ({
  name: status.name,
  running: status.running,
  lastPollAt: Option.getOrUndefined(status.startedAt),
  recordsIngested: 0, // Would need to track this
  errorCount: Option.isSome(status.error) ? 1 : 0,
  lastError: Option.getOrUndefined(status.error),
})

/**
 * Map internal OrchestratorStatus to RPC response format
 */
const mapOrchestratorStatus = (status: {
  readonly running: boolean
  readonly ingesters: ReadonlyArray<{
    readonly name: string
    readonly running: boolean
    readonly startedAt: Option.Option<Date>
    readonly error: Option.Option<string>
  }>
  readonly startedAt: Option.Option<Date>
}): OrchestratorStatus => ({
  running: status.running,
  ingesters: status.ingesters.map(mapIngesterStatus),
  startedAt: Option.getOrUndefined(status.startedAt),
  totalRecordsIngested: 0, // Would need to aggregate from all ingesters
})

// =============================================================================
// Handlers Implementation
// =============================================================================

/**
 * IngestionRpc handlers layer
 *
 * Implements all IngestionClient RPC operations:
 * - On-demand flight ingestion with real API calls
 * - Orchestrator control for background ingesters
 */
const IngestionRpcHandlers = Effect.gen(function* () {
  // Dependencies - External APIs
  const adsbLolClient = yield* Effect.serviceOption(AdsbLolClientService)
  const openSkyClient = yield* Effect.serviceOption(OpenSkyClientService)

  // Dependencies - Persistence
  const flightRepoOption = yield* Effect.serviceOption(FlightRepositoryTag)
  const flightStreamOption = yield* Effect.serviceOption(FlightStreamHandle)
  const sqlOption = yield* Effect.serviceOption(PgClient.PgClient)

  // Dependencies - Orchestrator
  const orchestratorOption = yield* Effect.serviceOption(IngestionOrchestratorTag)

  // Dependencies - Individual Ingesters (for on-demand operations)
  const osmIngesterOption = yield* Effect.serviceOption(OsmIngesterTag)
  const weatherIngesterOption = yield* Effect.serviceOption(WeatherIngesterTag)
  const imageryIngesterOption = yield* Effect.serviceOption(ImageryIngesterTag)

  /**
   * Transactional ingest: Write to DB + Publish to Stream atomically.
   */
  const transactionalIngest = (
    positions: FlightPositionInput[],
    source: FlightSource
  ): Effect.Effect<number, never> => {
    if (positions.length === 0) {
      return Effect.succeed(0)
    }

    // If no repo available, just return 0
    if (Option.isNone(flightRepoOption)) {
      return Effect.logWarning('[IngestionRpc] FlightRepository not available').pipe(
        Effect.as(0)
      )
    }

    const flightRepo = flightRepoOption.value

    // If no stream handle, just insert to DB
    if (Option.isNone(flightStreamOption) || Option.isNone(sqlOption)) {
      return flightRepo.insertPositions(positions).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`[IngestionRpc] ${source} insert failed: ${error.message}`).pipe(
            Effect.as(0)
          )
        )
      )
    }

    const sql = sqlOption.value
    const streamHandle = flightStreamOption.value
    const events = positions.map(toFlightEvent)

    // TRANSACTIONAL: Write to Postgres + Publish to Stream in same transaction
    return sql.withTransaction(
      Effect.gen(function* () {
        // 1. Insert into raw.flight_positions
        const insertedCount = yield* flightRepo.insertPositions(positions)

        // 2. Publish to DurableStream (within same transaction)
        yield* streamHandle.appendBatch(events)

        yield* Effect.logDebug(
          `[IngestionRpc] Transactional commit: ${insertedCount} positions + ${events.length} events`
        )

        return insertedCount
      })
    ).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`[IngestionRpc] ${source} transactional ingest failed: ${String(error)}`).pipe(
          Effect.as(0)
        )
      )
    )
  }

  return {
    // =========================================================================
    // On-Demand Ingestion
    // =========================================================================

    ingestFlightByIcao: (request: { icao24: string; source: 'opensky' | 'adsb_lol' }) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const { icao24, source } = request

        yield* Effect.logInfo(`[IngestionRpc] Ingesting flight ${icao24} from ${source}`)

        // Try ADSB.lol first (faster, single-flight API)
        if (source === 'adsb_lol') {
          if (Option.isNone(adsbLolClient)) {
            return yield* Effect.fail(
              new IngestionError({
                operation: 'ingestFlightByIcao',
                source: 'adsb_lol',
                message: 'ADSB.lol client not available',
              })
            )
          }

          const client = adsbLolClient.value
          const response = yield* client.getByIcao(icao24).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new IngestionError({
                  operation: 'ingestFlightByIcao',
                  source: 'adsb_lol',
                  message: `API error: ${error.message}`,
                  cause: error,
                })
              )
            )
          )

          // Check if aircraft was found
          if (response.aircraft.length === 0) {
            return yield* Effect.fail(
              new FlightNotFoundError({
                icao24,
                source: 'adsb_lol',
                message: `No aircraft found with ICAO24 ${icao24}`,
              })
            )
          }

          const aircraft = response.aircraft[0]

          // Transform to position input
          const positionInput = adsbLolToFlightPosition(aircraft, aircraft)
          if (!positionInput) {
            return yield* Effect.fail(
              new FlightNotFoundError({
                icao24,
                source: 'adsb_lol',
                message: `Aircraft ${icao24} has no valid position data`,
              })
            )
          }

          // Persist and publish
          const positions = [positionInput]
          const insertedCount = yield* transactionalIngest(positions, 'adsb_lol')

          const result: FlightIngestionResult = {
            icao24,
            source: 'adsb_lol',
            positionsIngested: insertedCount,
            streamEventsPublished: insertedCount > 0 ? 1 : 0,
            latencyMs: Date.now() - startTime,
            position: [
              positionInput.longitude,
              positionInput.latitude,
              Option.getOrElse(positionInput.altitudeM, () => 0),
            ],
            callsign: Option.getOrUndefined(positionInput.callsign),
            heading: Option.getOrUndefined(positionInput.headingDeg),
            speed: Option.getOrUndefined(positionInput.velocityMps),
          }

          yield* Effect.logInfo(
            `[IngestionRpc] Ingested ${icao24}: ${insertedCount} positions in ${result.latencyMs}ms`
          )

          return result
        }

        // OpenSky fallback
        if (Option.isNone(openSkyClient)) {
          return yield* Effect.fail(
            new IngestionError({
              operation: 'ingestFlightByIcao',
              source: 'opensky',
              message: 'OpenSky client not available',
            })
          )
        }

        const client = openSkyClient.value
        const response = yield* client.getStates({ icao24: [icao24] }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new IngestionError({
                operation: 'ingestFlightByIcao',
                source: 'opensky',
                message: `API error: ${error.message}`,
                cause: error,
              })
            )
          )
        )

        // Check if aircraft was found
        if (!response.states || response.states.length === 0) {
          return yield* Effect.fail(
            new FlightNotFoundError({
              icao24,
              source: 'opensky',
              message: `No aircraft found with ICAO24 ${icao24}`,
            })
          )
        }

        const state = response.states[0]

        // Transform to position input
        const positionInput = openSkyToFlightPosition(state, state)
        if (!positionInput) {
          return yield* Effect.fail(
            new FlightNotFoundError({
              icao24,
              source: 'opensky',
              message: `Aircraft ${icao24} has no valid position data`,
            })
          )
        }

        // Persist and publish
        const positions = [positionInput]
        const insertedCount = yield* transactionalIngest(positions, 'opensky')

        const result: FlightIngestionResult = {
          icao24,
          source: 'opensky',
          positionsIngested: insertedCount,
          streamEventsPublished: insertedCount > 0 ? 1 : 0,
          latencyMs: Date.now() - startTime,
          position: [
            positionInput.longitude,
            positionInput.latitude,
            Option.getOrElse(positionInput.altitudeM, () => 0),
          ],
          callsign: Option.getOrUndefined(positionInput.callsign),
          heading: Option.getOrUndefined(positionInput.headingDeg),
          speed: Option.getOrUndefined(positionInput.velocityMps),
        }

        yield* Effect.logInfo(
          `[IngestionRpc] Ingested ${icao24}: ${insertedCount} positions in ${result.latencyMs}ms`
        )

        return result
      }),

    ingestFlightsByRegion: (request: {
      readonly regionName: string
      readonly bounds: readonly [number, number, number, number]
      readonly source: 'opensky' | 'adsb_lol'
      readonly radiusNm: number
    }) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const { regionName, bounds, source, radiusNm } = request

        yield* Effect.logInfo(`[IngestionRpc] Ingesting region ${regionName} from ${source}`)

        if (source === 'adsb_lol') {
          if (Option.isNone(adsbLolClient)) {
            return yield* Effect.fail(
              new IngestionError({
                operation: 'ingestFlightsByRegion',
                source: 'adsb_lol',
                message: 'ADSB.lol client not available',
              })
            )
          }

          const client = adsbLolClient.value
          const [minLon, minLat, maxLon, maxLat] = bounds

          // Calculate center point
          const centerLat = (minLat + maxLat) / 2
          const centerLon = (minLon + maxLon) / 2

          const response = yield* client.getByPoint({
            lat: centerLat,
            lon: centerLon,
            radiusNm: Math.min(radiusNm, 250),
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new IngestionError({
                  operation: 'ingestFlightsByRegion',
                  source: 'adsb_lol',
                  message: `API error: ${error.message}`,
                  cause: error,
                })
              )
            )
          )

          // Transform to positions
          const positions: FlightPositionInput[] = []
          for (const aircraft of response.aircraft) {
            const position = adsbLolToFlightPosition(aircraft, aircraft)
            if (position) {
              positions.push(position)
            }
          }

          // Persist and publish
          const insertedCount = yield* transactionalIngest(positions, 'adsb_lol')

          const result: RegionIngestionResult = {
            region: regionName,
            source: 'adsb_lol',
            flightsIngested: positions.length,
            positionsIngested: insertedCount,
            streamEventsPublished: insertedCount,
            latencyMs: Date.now() - startTime,
          }

          yield* Effect.logInfo(
            `[IngestionRpc] Ingested ${regionName}: ${positions.length} flights, ${insertedCount} positions in ${result.latencyMs}ms`
          )

          return result
        }

        // OpenSky
        if (Option.isNone(openSkyClient)) {
          return yield* Effect.fail(
            new IngestionError({
              operation: 'ingestFlightsByRegion',
              source: 'opensky',
              message: 'OpenSky client not available',
            })
          )
        }

        const client = openSkyClient.value
        const response = yield* client.getStates({ bounds }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new IngestionError({
                operation: 'ingestFlightsByRegion',
                source: 'opensky',
                message: `API error: ${error.message}`,
                cause: error,
              })
            )
          )
        )

        // Transform to positions
        const positions: FlightPositionInput[] = []
        if (response.states) {
          for (const state of response.states) {
            const position = openSkyToFlightPosition(state, state)
            if (position) {
              positions.push(position)
            }
          }
        }

        // Persist and publish
        const insertedCount = yield* transactionalIngest(positions, 'opensky')

        const result: RegionIngestionResult = {
          region: regionName,
          source: 'opensky',
          flightsIngested: positions.length,
          positionsIngested: insertedCount,
          streamEventsPublished: insertedCount,
          latencyMs: Date.now() - startTime,
        }

        yield* Effect.logInfo(
          `[IngestionRpc] Ingested ${regionName}: ${positions.length} flights, ${insertedCount} positions in ${result.latencyMs}ms`
        )

        return result
      }),

    // =========================================================================
    // POI, Weather, and Imagery Ingestion
    // =========================================================================

    ingestPoiByRegion: (request: {
      readonly regionName: string
      readonly bounds: readonly [number, number, number, number]
      readonly amenities: readonly string[]
      readonly ttlDays: number
    }) =>
      Effect.gen(function* () {
        const { regionName, bounds, amenities, ttlDays } = request

        yield* Effect.logInfo(`[IngestionRpc] Ingesting POIs in ${regionName}`)

        if (Option.isNone(osmIngesterOption)) {
          return yield* Effect.fail(
            new IngestionError({
              operation: 'ingestPoiByRegion',
              message: 'OSM Ingester not available',
            })
          )
        }

        const osmIngester = osmIngesterOption.value

        const region: OsmIngestionRegion = {
          name: regionName,
          bounds: bounds as [number, number, number, number],
          amenities: [...amenities],
          ttlDays,
          tags: {},
        }

        const ingestionResult = yield* osmIngester.ingestRegion(region).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new IngestionError({
                operation: 'ingestPoiByRegion',
                message: `OSM ingestion failed: ${String(error)}`,
                cause: error,
              })
            )
          )
        )

        const result: PoiIngestionResult = {
          region: regionName,
          source: 'overpass' as const,
          poisIngested: ingestionResult.recordsIngested,
          streamEventsPublished: 0, // Would need to track in ingester
          latencyMs: ingestionResult.latencyMs,
        }

        yield* Effect.logInfo(
          `[IngestionRpc] POI ingestion for ${regionName} completed in ${result.latencyMs}ms`
        )

        return result
      }),

    ingestWeatherByGrid: (request: {
      readonly gridName: string
      readonly bounds: readonly [number, number, number, number]
      readonly resolution: number
      readonly ttlMinutes: number
    }) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const { gridName, bounds, resolution, ttlMinutes } = request

        yield* Effect.logInfo(`[IngestionRpc] Ingesting weather grid ${gridName}`)

        if (Option.isNone(weatherIngesterOption)) {
          return yield* Effect.fail(
            new IngestionError({
              operation: 'ingestWeatherByGrid',
              message: 'Weather Ingester not available',
            })
          )
        }

        const weatherIngester = weatherIngesterOption.value

        const grid: WeatherIngestionGrid = {
          name: gridName,
          bounds: bounds as [number, number, number, number],
          resolution,
          ttlMinutes,
        }

        yield* weatherIngester.ingestGrid(grid).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new IngestionError({
                operation: 'ingestWeatherByGrid',
                message: `Weather grid ingestion failed: ${String(error)}`,
                cause: error,
              })
            )
          )
        )

        const result: WeatherIngestionResult = {
          grid: gridName,
          source: 'openmeteo' as const,
          observationsIngested: 0,
          pointsQueried: 0,
          streamEventsPublished: 0,
          latencyMs: Date.now() - startTime,
        }

        yield* Effect.logInfo(
          `[IngestionRpc] Weather grid ${gridName} ingestion completed in ${result.latencyMs}ms`
        )

        return result
      }),

    ingestWeatherByPoint: (request: {
      readonly latitude: number
      readonly longitude: number
      readonly ttlMinutes: number
    }) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const { latitude, longitude, ttlMinutes } = request

        yield* Effect.logInfo(`[IngestionRpc] Ingesting weather for point ${latitude},${longitude}`)

        if (Option.isNone(weatherIngesterOption)) {
          return yield* Effect.fail(
            new IngestionError({
              operation: 'ingestWeatherByPoint',
              message: 'Weather Ingester not available',
            })
          )
        }

        const weatherIngester = weatherIngesterOption.value
        const locationId = generateLocationId(latitude, longitude)

        yield* weatherIngester.ingestPoint(latitude, longitude, ttlMinutes).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new IngestionError({
                operation: 'ingestWeatherByPoint',
                message: `Weather point ingestion failed: ${String(error)}`,
                cause: error,
              })
            )
          )
        )

        // Return result with point info
        const result: WeatherPointResult = {
          locationId,
          latitude,
          longitude,
          observedAt: new Date(),
          latencyMs: Date.now() - startTime,
        }

        yield* Effect.logInfo(
          `[IngestionRpc] Weather point ${locationId} ingestion completed in ${result.latencyMs}ms`
        )

        return result
      }),

    ingestImageryByRegion: (request: {
      readonly regionName: string
      readonly bounds: readonly [number, number, number, number]
      readonly providers: readonly ('planet' | 'sentinel')[]
      readonly maxCloudCover: number
      readonly lookbackDays: number
    }) =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const { regionName, bounds, providers, maxCloudCover, lookbackDays } = request

        yield* Effect.logInfo(`[IngestionRpc] Ingesting imagery for ${regionName}`)

        if (Option.isNone(imageryIngesterOption)) {
          return yield* Effect.fail(
            new IngestionError({
              operation: 'ingestImageryByRegion',
              message: 'Imagery Ingester not available',
            })
          )
        }

        const imageryIngester = imageryIngesterOption.value

        const region: ImageryIngestionRegion = {
          name: regionName,
          bounds: bounds as [number, number, number, number],
          providers: [...providers],
          maxCloudCover,
          ttlDays: lookbackDays,
        }

        yield* imageryIngester.ingestRegion(region).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new IngestionError({
                operation: 'ingestImageryByRegion',
                message: `Imagery ingestion failed: ${String(error)}`,
                cause: error,
              })
            )
          )
        )

        const results: ImageryIngestionResult[] = providers.map((provider) => ({
          region: regionName,
          provider,
          itemsIngested: 0,
          streamEventsPublished: 0,
          latencyMs: Date.now() - startTime,
        }))

        yield* Effect.logInfo(
          `[IngestionRpc] Imagery ingestion for ${regionName} completed in ${Date.now() - startTime}ms`
        )

        return results
      }),

    // =========================================================================
    // Orchestrator Control
    // =========================================================================

    startIngestion: (_request: {}) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning('[IngestionRpc] Orchestrator not configured')
          return notConfiguredStatus()
        }

        const orchestrator = orchestratorOption.value
        yield* orchestrator.start().pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[IngestionRpc] ${ingestionError.userMessage}`)
          })
        )
        const status = yield* orchestrator.status()
        return mapOrchestratorStatus(status)
      }),

    stopIngestion: (_request: {}) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning('[IngestionRpc] Orchestrator not configured')
          return notConfiguredStatus()
        }

        const orchestrator = orchestratorOption.value
        yield* orchestrator.stop().pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[IngestionRpc] ${ingestionError.userMessage}`)
          })
        )
        const status = yield* orchestrator.status()
        return mapOrchestratorStatus(status)
      }),

    getIngestionStatus: (_request: {}) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          return notConfiguredStatus()
        }

        const status = yield* orchestratorOption.value.status()
        return mapOrchestratorStatus(status)
      }),

    startIngester: (request: { name: IngesterName }) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning(
            `[IngestionRpc] Orchestrator not configured, cannot start ${request.name}`
          )
          return ingesterNotFoundStatus(request.name)
        }

        const orchestrator = orchestratorOption.value

        // Map from our IngesterName to internal name
        const internalName = request.name === 'flights' ? 'flight' : request.name
        yield* orchestrator.startIngester(internalName as 'flight' | 'osm' | 'weather' | 'imagery').pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[IngestionRpc] ${ingestionError.userMessage}`)
          })
        )
        const status = yield* orchestrator.status()
        const ingesterStatus = status.ingesters.find((i) => i.name === internalName)

        return ingesterStatus ? mapIngesterStatus(ingesterStatus) : ingesterNotFoundStatus(request.name)
      }),

    stopIngester: (request: { name: IngesterName }) =>
      Effect.gen(function* () {
        if (Option.isNone(orchestratorOption)) {
          yield* Effect.logWarning(
            `[IngestionRpc] Orchestrator not configured, cannot stop ${request.name}`
          )
          return ingesterNotFoundStatus(request.name)
        }

        const orchestrator = orchestratorOption.value

        // Map from our IngesterName to internal name
        const internalName = request.name === 'flights' ? 'flight' : request.name
        yield* orchestrator.stopIngester(internalName as 'flight' | 'osm' | 'weather' | 'imagery').pipe(
          Effect.catchAll((e) => {
            const ingestionError = parseIngestionError(e)
            return Effect.logError(`[IngestionRpc] ${ingestionError.userMessage}`)
          })
        )
        const status = yield* orchestrator.status()
        const ingesterStatus = status.ingesters.find((i) => i.name === internalName)

        // For stop, return stopped status if not found (already stopped)
        return ingesterStatus
          ? mapIngesterStatus(ingesterStatus)
          : {
              name: request.name,
              running: false,
              lastPollAt: undefined,
              recordsIngested: 0,
              errorCount: 0,
              lastError: undefined,
            }
      }),
  }
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Ingestion RPC handlers layer
 */
export const IngestionRpcHandlersLayer = IngestionRpcs.toLayer(IngestionRpcHandlers)

/**
 * Ingestion RPC Server layer (WebSocket-based)
 *
 * Serves IngestionRpcs over WebSocket at /geoint/ingestion
 *
 * **Requires:**
 * - AdsbLolClientService (optional)
 * - OpenSkyClientService (optional)
 * - FlightRepositoryTag (optional for persistence)
 * - FlightStreamHandle (optional for DurableStreams)
 * - PgClient.PgClient (optional for transactions)
 * - IngestionOrchestratorTag (optional for orchestrator control)
 */
export const IngestionRpcServerLayer = pipe(
  RpcServer.layer(IngestionRpcs),
  Layer.provide(IngestionRpcHandlersLayer),
  Layer.provideMerge(RpcServer.layerProtocolWebsocketRouter({ path: '/geoint/ingestion' })),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(ExternalApiClientsLive.pipe(Layer.provide(FetchHttpClient.layer))),
)

/**
 * Ingestion RPC Server with full ingestion pipeline
 *
 * Includes:
 * - FlightRepository for persistence
 * - FlightStreamHandle for DurableStreams
 * - IngestionOrchestrator for background ingesters
 *
 * **Requires:**
 * - PgClient.PgClient (PostgreSQL connection)
 */
export const IngestionRpcServerWithPipelineLayer = pipe(
  IngestionRpcServerLayer,
  Layer.provide(IngestionPipelineLive),
)

// =============================================================================
// Re-exports
// =============================================================================

export {
  IngestionRpcs,
  IngestionError,
  FlightNotFoundError,
  type FlightIngestionResult,
  type RegionIngestionResult,
  type IngesterStatus,
  type OrchestratorStatus,
  type IngesterName,
} from '../clients/IngestionClient'

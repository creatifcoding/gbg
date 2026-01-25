/**
 * Ingestion Entity Handlers - Effect Cluster Behavior Implementation
 *
 * Implements the handlers for IngestionEntity RPCs:
 * - Flight ingestion (by ICAO24, by region)
 * - POI ingestion (by region)
 * - Weather ingestion (by grid, by point)
 * - Imagery ingestion (by region)
 *
 * Architecture:
 * - Uses transactional outbox pattern: Postgres + DurableStream in same transaction
 * - Delegates to existing ingesters for actual data fetching
 * - Publishes events to DurableStreams for downstream materializers
 *
 * @see beads:tmnl-vertical-slice ECS Vertical Slice Integration
 * @module
 */

import { Effect, Option, pipe } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  IngestionEntity,
  IngestionEntityError,
  FlightNotFoundError,
  type FlightIngestionResult,
  type RegionIngestionResult,
  type PoiIngestionResult,
  type WeatherIngestionResult,
  type WeatherPointResult,
  type ImageryIngestionResult,
} from './IngestionEntity'
import {
  OpenSkyClientService,
  AdsbLolClientService,
  OverpassClientService,
  OpenMeteoClientService,
  PlanetLabsClientService,
  SentinelHubClientService,
  type OverpassClient,
  type OpenMeteoClient,
  type PlanetLabsClient,
  type SentinelHubClient,
} from '../api/ExternalApiClient'
import {
  FlightRepositoryTag,
  PoiRepositoryTag,
  type FlightPositionInput,
} from '../persistence'
import { FlightStreamHandle } from '../services/FlightStreamHandle'
import { OsmStreamHandle } from '../services/OsmStreamHandle'
import { FlightPositionEvent } from '../schemas/flight-events'
import { PoiPositionEvent, type PoiSource } from '../schemas/poi-events'

// =============================================================================
// Helper: Convert Option to Effect with custom error
// =============================================================================

const optionToEffect = <A, E>(
  option: Option.Option<A>,
  onNone: () => E
): Effect.Effect<A, E> =>
  Option.match(option, {
    onNone: () => Effect.fail(onNone()),
    onSome: (a) => Effect.succeed(a),
  })

// =============================================================================
// Handler Implementation
// =============================================================================

/**
 * Ingestion Entity Handlers
 *
 * Single handler object implementing all IngestionEntity RPCs.
 * Uses envelope.payload pattern for accessing request data.
 */
export const IngestionEntityHandlers = IngestionEntity.toLayer(
  Effect.gen(function* () {
    // External API clients (all optional for graceful degradation)
    const openskyOption = yield* Effect.serviceOption(OpenSkyClientService)
    const adsbLolOption = yield* Effect.serviceOption(AdsbLolClientService)
    const overpassOption = yield* Effect.serviceOption(OverpassClientService)
    const openMeteoOption = yield* Effect.serviceOption(OpenMeteoClientService)
    const planetOption = yield* Effect.serviceOption(PlanetLabsClientService)
    const sentinelOption = yield* Effect.serviceOption(SentinelHubClientService)

    // Repositories for persistence
    const flightRepoOption = yield* Effect.serviceOption(FlightRepositoryTag)
    const poiRepoOption = yield* Effect.serviceOption(PoiRepositoryTag)

    // DurableStream handles for transactional outbox
    const flightStreamOption = yield* Effect.serviceOption(FlightStreamHandle)
    const osmStreamOption = yield* Effect.serviceOption(OsmStreamHandle)

    // PostgreSQL client for transactions
    const sqlOption = yield* Effect.serviceOption(PgClient.PgClient)

    // ─────────────────────────────────────────────────────────────────────────
    // IngestFlightByIcao Handler
    // ─────────────────────────────────────────────────────────────────────────
    const IngestFlightByIcao = (envelope: {
      payload: { icao24: string; source: 'opensky' | 'adsb_lol' }
    }) =>
      Effect.gen(function* () {
        const { icao24, source } = envelope.payload
        const startTime = Date.now()

        // Fetch flight data based on source - using if/else in Effect.gen for type narrowing
        const response: { position?: [number, number, number]; callsign?: string; heading?: number; speed?: number } =
          yield* Effect.if(source === 'adsb_lol', {
            onTrue: () =>
              pipe(
                optionToEffect(adsbLolOption, () =>
                  new IngestionEntityError({
                    operation: 'IngestFlightByIcao',
                    source,
                    message: 'ADSB.lol client not available',
                  })
                ),
                Effect.flatMap((client) => client.getByIcao(icao24)),
                Effect.mapError((error) =>
                  new IngestionEntityError({ operation: 'IngestFlightByIcao', source, message: String(error) })
                ),
                Effect.map((resp) => {
                  const ac = resp.aircraft?.find((a) => a.lat !== undefined && a.lon !== undefined)
                  return ac
                    ? {
                        position: [ac.lon!, ac.lat!, ac.altitudeFt ?? 0] as [number, number, number],
                        callsign: ac.flight?.trim(),
                        heading: ac.trackDeg,
                        speed: ac.groundSpeedKts,
                      }
                    : {}
                })
              ),
            onFalse: () =>
              pipe(
                optionToEffect(openskyOption, () =>
                  new IngestionEntityError({
                    operation: 'IngestFlightByIcao',
                    source,
                    message: 'OpenSky client not available',
                  })
                ),
                Effect.flatMap((client) => client.getStates({ icao24: [icao24] })),
                Effect.mapError((error) =>
                  new IngestionEntityError({ operation: 'IngestFlightByIcao', source, message: String(error) })
                ),
                Effect.map((resp) => {
                  const state = resp.states?.[0]
                  if (!state) return {}
                  if (state.longitude === null || state.latitude === null) return {}
                  return {
                    position: [state.longitude, state.latitude, state.baroAltitude ?? state.geoAltitude ?? 0] as [number, number, number],
                    callsign: state.callsign?.trim(),
                    heading: state.trueTrack ?? undefined,
                    speed: state.velocity ?? undefined,
                  }
                })
              ),
          })

        const { position, callsign, heading, speed } = response

        if (!position) {
          return yield* Effect.fail(
            new FlightNotFoundError({
              icao24,
              source,
              message: `No position data found for ICAO24 ${icao24}`,
            })
          )
        }

        // Create event for DurableStream
        const event = new FlightPositionEvent({
          icao24,
          source,
          position,
          callsign,
          heading,
          speed,
          onGround: false,
          observedAt: new Date(),
        })

        // Create FlightPositionInput for repository
        const flightInput: FlightPositionInput = {
          _tag: 'FlightPositionInput',
          icao24,
          source,
          raw: event,
          longitude: position[0],
          latitude: position[1],
          time: new Date(),
          altitudeM: Option.fromNullable(position[2]),
          headingDeg: Option.fromNullable(heading),
          velocityMps: Option.fromNullable(speed),
          verticalRate: Option.none(),
          onGround: Option.some(false),
          callsign: Option.fromNullable(callsign),
          squawk: Option.none(),
          category: Option.none(),
          originCountry: Option.none(),
        }

        // TRANSACTIONAL OUTBOX: Persist + Publish atomically
        const transactionResult = yield* pipe(
          Effect.all({
            sql: optionToEffect(sqlOption, () => new Error('SQL not available')),
            flightStream: optionToEffect(flightStreamOption, () => new Error('FlightStream not available')),
            flightRepo: optionToEffect(flightRepoOption, () => new Error('FlightRepo not available')),
          }),
          Effect.flatMap(({ sql, flightStream, flightRepo }) =>
            sql.withTransaction(
              Effect.gen(function* () {
                yield* flightRepo.insertPositions([flightInput])
                yield* flightStream.appendBatch([event])
                yield* Effect.logDebug(
                  `[IngestionEntity] Transactional commit: 1 position + 1 event for ${icao24}`
                )
                return { positionsIngested: 1, streamEventsPublished: 1 }
              })
            )
          ),
          Effect.catchAll(() => Effect.succeed({ positionsIngested: 0, streamEventsPublished: 0 }))
        )

        return {
          icao24,
          source,
          positionsIngested: transactionResult.positionsIngested,
          streamEventsPublished: transactionResult.streamEventsPublished,
          latencyMs: Date.now() - startTime,
          position,
          callsign,
          heading,
          speed,
        } satisfies FlightIngestionResult
      })

    // ─────────────────────────────────────────────────────────────────────────
    // IngestFlightsByRegion Handler
    // ─────────────────────────────────────────────────────────────────────────
    const IngestFlightsByRegion = (envelope: {
      payload: {
        regionName: string
        bounds: readonly [number, number, number, number]
        source: 'opensky' | 'adsb_lol'
        radiusNm: number
      }
    }) =>
      Effect.gen(function* () {
        const { regionName, bounds, source, radiusNm } = envelope.payload
        const startTime = Date.now()

        // Fetch flights based on source - separate branches for type safety
        type FlightData = { icao24: string; lon: number; lat: number; alt?: number; callsign?: string; heading?: number; speed?: number; onGround?: boolean }
        const flights: FlightData[] = yield* Effect.if(source === 'adsb_lol', {
          onTrue: () =>
            pipe(
              optionToEffect(adsbLolOption, () =>
                new IngestionEntityError({
                  operation: 'IngestFlightsByRegion',
                  source,
                  message: 'ADSB.lol client not available',
                })
              ),
              Effect.flatMap((client) =>
                client.getByPoint({
                  lat: (bounds[1] + bounds[3]) / 2,
                  lon: (bounds[0] + bounds[2]) / 2,
                  radiusNm,
                })
              ),
              Effect.mapError((error) =>
                new IngestionEntityError({ operation: 'IngestFlightsByRegion', source, message: String(error) })
              ),
              Effect.map((resp): FlightData[] =>
                (resp.aircraft ?? [])
                  .filter((ac) => ac.hex && ac.lat != null && ac.lon != null)
                  .map((ac) => ({
                    icao24: ac.hex.toLowerCase(),
                    lon: ac.lon!,
                    lat: ac.lat!,
                    alt: ac.altitudeFt ?? undefined,
                    callsign: ac.flight?.trim(),
                    heading: ac.trackDeg ?? undefined,
                    speed: ac.groundSpeedKts ?? undefined,
                    onGround: ac.onGround ?? false,
                  }))
              )
            ),
          onFalse: () =>
            pipe(
              optionToEffect(openskyOption, () =>
                new IngestionEntityError({
                  operation: 'IngestFlightsByRegion',
                  source,
                  message: 'OpenSky client not available',
                })
              ),
              Effect.flatMap((client) =>
                client.getStates({ bounds: bounds as [number, number, number, number] })
              ),
              Effect.mapError((error) =>
                new IngestionEntityError({ operation: 'IngestFlightsByRegion', source, message: String(error) })
              ),
              Effect.map((resp): FlightData[] =>
                (resp.states ?? [])
                  .filter((s) => s.icao24 && s.longitude != null && s.latitude != null)
                  .map((s) => ({
                    icao24: s.icao24.toLowerCase(),
                    lon: s.longitude!,
                    lat: s.latitude!,
                    alt: s.baroAltitude ?? s.geoAltitude ?? undefined,
                    callsign: s.callsign?.trim(),
                    heading: s.trueTrack ?? undefined,
                    speed: s.velocity ?? undefined,
                    onGround: s.onGround ?? false,
                  }))
              )
            ),
        })

        const now = new Date()
        const events = flights.map(
          (f) =>
            new FlightPositionEvent({
              icao24: f.icao24,
              source,
              position: [f.lon, f.lat, f.alt ?? 0],
              callsign: f.callsign,
              heading: f.heading,
              speed: f.speed,
              onGround: f.onGround ?? false,
              observedAt: now,
            })
        )

        const inputs: FlightPositionInput[] = flights.map((f) => ({
          _tag: 'FlightPositionInput',
          icao24: f.icao24,
          source,
          raw: f,
          longitude: f.lon,
          latitude: f.lat,
          time: now,
          altitudeM: Option.fromNullable(f.alt),
          headingDeg: Option.fromNullable(f.heading),
          velocityMps: Option.fromNullable(f.speed),
          verticalRate: Option.none(),
          onGround: Option.fromNullable(f.onGround),
          callsign: Option.fromNullable(f.callsign),
          squawk: Option.none(),
          category: Option.none(),
          originCountry: Option.none(),
        }))

        // TRANSACTIONAL OUTBOX
        const transactionResult = yield* pipe(
          Effect.all({
            sql: optionToEffect(sqlOption, () => new Error('SQL not available')),
            flightStream: optionToEffect(flightStreamOption, () => new Error('FlightStream not available')),
            flightRepo: optionToEffect(flightRepoOption, () => new Error('FlightRepo not available')),
          }),
          Effect.flatMap(({ sql, flightStream, flightRepo }) =>
            inputs.length > 0
              ? sql.withTransaction(
                  Effect.gen(function* () {
                    const count = yield* flightRepo.insertPositions(inputs)
                    yield* flightStream.appendBatch(events)
                    yield* Effect.logDebug(
                      `[IngestionEntity] Transactional commit: ${count} positions + ${events.length} events for ${regionName}`
                    )
                    return { positionsIngested: count, streamEventsPublished: events.length }
                  })
                )
              : Effect.succeed({ positionsIngested: 0, streamEventsPublished: 0 })
          ),
          Effect.catchAll(() => Effect.succeed({ positionsIngested: 0, streamEventsPublished: 0 }))
        )

        return {
          region: regionName,
          source,
          flightsIngested: flights.length,
          positionsIngested: transactionResult.positionsIngested,
          streamEventsPublished: transactionResult.streamEventsPublished,
          latencyMs: Date.now() - startTime,
        } satisfies RegionIngestionResult
      })

    // ─────────────────────────────────────────────────────────────────────────
    // IngestPoiByRegion Handler
    // ─────────────────────────────────────────────────────────────────────────
    const IngestPoiByRegion = (envelope: {
      payload: {
        regionName: string
        bounds: readonly [number, number, number, number]
        amenities: readonly string[]
        ttlDays: number
      }
    }) => {
      const { regionName, bounds, amenities, ttlDays } = envelope.payload
      const startTime = Date.now()

      return pipe(
        optionToEffect(overpassOption, () =>
          new IngestionEntityError({
            operation: 'IngestPoiByRegion',
            message: 'Overpass client not available',
          })
        ),
        Effect.flatMap((overpass: OverpassClient) => {
          const query = overpass.buildQuery({
            bounds: bounds as [number, number, number, number],
            amenities: amenities as string[],
          })
          return overpass.query(query, { timeout: 60000 })
        }),
        Effect.mapError((error) =>
          new IngestionEntityError({
            operation: 'IngestPoiByRegion',
            message: String(error),
          })
        ),
        Effect.flatMap((response) => {
          const events: PoiPositionEvent[] = []

          for (const element of response.elements) {
            let lon: number | undefined
            let lat: number | undefined

            if (element.lat !== undefined && element.lon !== undefined) {
              lon = element.lon
              lat = element.lat
            } else if (element.center) {
              lon = element.center.lon
              lat = element.center.lat
            }

            if (lon !== undefined && lat !== undefined) {
              events.push(
                new PoiPositionEvent({
                  osmId: BigInt(element.id),
                  osmType: element.type as 'node' | 'way' | 'relation',
                  source: 'overpass' as PoiSource,
                  position: [lon, lat],
                  name: element.tags?.['name'],
                  category: element.tags?.['amenity'] ? 'amenity' : undefined,
                  tags: element.tags,
                  queryBbox: bounds as [number, number, number, number],
                  ingestedAt: new Date(),
                })
              )
            }
          }

          // TRANSACTIONAL OUTBOX
          const transactionalWrite = pipe(
            Effect.all({
              sql: optionToEffect(sqlOption, () => new Error('SQL not available')),
              osmStream: optionToEffect(osmStreamOption, () => new Error('OsmStream not available')),
              poiRepo: optionToEffect(poiRepoOption, () => new Error('PoiRepo not available')),
            }),
            Effect.flatMap(({ sql, osmStream, poiRepo }) =>
              events.length > 0
                ? sql.withTransaction(
                    Effect.gen(function* () {
                      yield* poiRepo.upsertPois(
                        events.map((e) => ({
                          _tag: 'PoiInput' as const,
                          osmId: e.osmId,
                          osmType: e.osmType,
                          raw: e,
                          geometry: { type: 'Point' as const, coordinates: e.position },
                          centroidLon: Option.some(e.position[0]),
                          centroidLat: Option.some(e.position[1]),
                          tags: e.tags ?? {},
                          queryBbox: Option.fromNullable(e.queryBbox),
                          ttlDays: Option.some(ttlDays),
                        }))
                      )
                      yield* osmStream.appendBatch(events)
                      yield* Effect.logDebug(
                        `[IngestionEntity] Transactional commit: ${events.length} POIs for ${regionName}`
                      )
                      return { poisIngested: events.length, streamEventsPublished: events.length }
                    })
                  )
                : Effect.succeed({ poisIngested: 0, streamEventsPublished: 0 })
            ),
            Effect.catchAll(() => Effect.succeed({ poisIngested: 0, streamEventsPublished: 0 }))
          )

          return pipe(
            transactionalWrite,
            Effect.map(({ poisIngested, streamEventsPublished }): PoiIngestionResult => ({
              region: regionName,
              source: 'overpass',
              poisIngested,
              streamEventsPublished,
              latencyMs: Date.now() - startTime,
            }))
          )
        })
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IngestWeatherByGrid Handler
    // ─────────────────────────────────────────────────────────────────────────
    const IngestWeatherByGrid = (envelope: {
      payload: {
        gridName: string
        bounds: readonly [number, number, number, number]
        resolution: number
        ttlMinutes: number
      }
    }) => {
      const { gridName, bounds, resolution } = envelope.payload
      const startTime = Date.now()

      // Generate grid points
      const points: Array<{ latitude: number; longitude: number }> = []
      for (let lat = bounds[1]; lat <= bounds[3]; lat += resolution) {
        for (let lon = bounds[0]; lon <= bounds[2]; lon += resolution) {
          points.push({ latitude: lat, longitude: lon })
        }
      }

      return pipe(
        optionToEffect(openMeteoOption, () =>
          new IngestionEntityError({
            operation: 'IngestWeatherByGrid',
            message: 'Open-Meteo client not available',
          })
        ),
        Effect.flatMap((openMeteo: OpenMeteoClient) =>
          pipe(
            Effect.forEach(points, (point) =>
              pipe(
                openMeteo.getForecast(point),
                Effect.map(() => 1),
                Effect.catchAll(() => Effect.succeed(0))
              )
            ),
            Effect.map((results) => results.reduce((a, b) => a + b, 0))
          )
        ),
        Effect.map((observationsIngested): WeatherIngestionResult => ({
          grid: gridName,
          source: 'openmeteo',
          observationsIngested,
          pointsQueried: points.length,
          streamEventsPublished: 0,
          latencyMs: Date.now() - startTime,
        }))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IngestWeatherByPoint Handler
    // ─────────────────────────────────────────────────────────────────────────
    const IngestWeatherByPoint = (envelope: {
      payload: {
        latitude: number
        longitude: number
        ttlMinutes: number
      }
    }) => {
      const { latitude, longitude } = envelope.payload
      const startTime = Date.now()

      return pipe(
        optionToEffect(openMeteoOption, () =>
          new IngestionEntityError({
            operation: 'IngestWeatherByPoint',
            message: 'Open-Meteo client not available',
          })
        ),
        Effect.flatMap((openMeteo: OpenMeteoClient) =>
          openMeteo.getForecast({ latitude, longitude })
        ),
        Effect.mapError((error) =>
          new IngestionEntityError({
            operation: 'IngestWeatherByPoint',
            message: String(error),
          })
        ),
        Effect.map((weather): WeatherPointResult => ({
          locationId: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
          latitude,
          longitude,
          temperature: weather.current?.temperature,
          feelsLike: weather.current?.feelsLike,
          humidity: weather.current?.humidity,
          weatherDesc: undefined,
          windSpeed: weather.current?.windSpeed,
          observedAt: new Date(),
          latencyMs: Date.now() - startTime,
        }))
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IngestImageryByRegion Handler
    // ─────────────────────────────────────────────────────────────────────────
    const IngestImageryByRegion = (envelope: {
      payload: {
        regionName: string
        bounds: readonly [number, number, number, number]
        providers: readonly ('planet' | 'sentinel')[]
        maxCloudCover: number
        lookbackDays: number
      }
    }) => {
      const { regionName, bounds, providers, maxCloudCover, lookbackDays } = envelope.payload
      const startTime = Date.now()

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - lookbackDays)

      // Convert bounds [minLon, minLat, maxLon, maxLat] to GeoJSON Polygon
      const [minLon, minLat, maxLon, maxLat] = bounds
      const geometry = {
        type: 'Polygon' as const,
        coordinates: [[
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ]],
      }

      const planetSearch = providers.includes('planet')
        ? pipe(
            optionToEffect(planetOption, () => new Error('Planet not available')),
            Effect.flatMap((planet: PlanetLabsClient) =>
              planet.quickSearch({
                geometry,
                itemTypes: ['PSScene'],
                acquiredGte: startDate.toISOString(),
                acquiredLte: endDate.toISOString(),
                maxCloudCover: maxCloudCover / 100, // Planet uses 0-1 scale
              })
            ),
            Effect.map((response): ImageryIngestionResult => ({
              region: regionName,
              provider: 'planet',
              itemsIngested: response.items.length,
              streamEventsPublished: 0,
              latencyMs: Date.now() - startTime,
            })),
            Effect.catchAll(() => Effect.succeed(null as ImageryIngestionResult | null))
          )
        : Effect.succeed(null as ImageryIngestionResult | null)

      const sentinelSearch = providers.includes('sentinel')
        ? pipe(
            optionToEffect(sentinelOption, () => new Error('Sentinel not available')),
            Effect.flatMap((sentinel: SentinelHubClient) =>
              sentinel.search({
                collections: ['sentinel-2-l2a'],
                bbox: bounds as [number, number, number, number],
                datetimeGte: startDate.toISOString(),
                datetimeLte: endDate.toISOString(),
                maxCloudCover,
              })
            ),
            Effect.map((response): ImageryIngestionResult => ({
              region: regionName,
              provider: 'sentinel',
              itemsIngested: response.items.length,
              streamEventsPublished: 0,
              latencyMs: Date.now() - startTime,
            })),
            Effect.catchAll(() => Effect.succeed(null as ImageryIngestionResult | null))
          )
        : Effect.succeed(null as ImageryIngestionResult | null)

      return pipe(
        Effect.all([planetSearch, sentinelSearch]),
        Effect.map(([planet, sentinel]) =>
          [planet, sentinel].filter((r): r is ImageryIngestionResult => r !== null)
        )
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Return all handlers
    // ─────────────────────────────────────────────────────────────────────────
    return {
      IngestFlightByIcao,
      IngestFlightsByRegion,
      IngestPoiByRegion,
      IngestWeatherByGrid,
      IngestWeatherByPoint,
      IngestImageryByRegion,
    }
  })
)

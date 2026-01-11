/**
 * FlightIngester - Continuous flight data ingestion service
 *
 * Polls OpenSky Network and ADSB.lol APIs on configurable intervals,
 * transforms responses to FlightPositionInput, and inserts into raw.flight_positions.
 *
 * Features:
 * - Configurable ingestion regions (bounding boxes)
 * - Independent polling intervals per source (respects rate limits)
 * - Graceful error handling (logs failures, continues ingestion)
 * - Ingestion metrics logging to raw.ingestion_log
 *
 * Rate limits:
 * - OpenSky: 10 req/min (poll every 6 seconds per region)
 * - ADSB.lol: 60 req/min (poll every 1 second per region)
 *
 * @see beads:tmnl-x7bof FlightIngester service
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schedule,
  Duration,
  Option,
  Schema,
  Fiber,
  pipe,
} from 'effect';
import { PgClient } from '@effect/sql-pg';
import { OpenSkyStateVector, AdsbLolAircraft } from '../schemas';
import {
  OpenSkyClientService,
  AdsbLolClientService,
  type ExternalApiError,
  type RateLimitError,
  type TimeoutError,
} from '../api/ExternalApiClient';
import {
  FlightRepositoryTag,
  type FlightPositionInput,
  type FlightSource,
} from '../persistence/postgis/FlightRepository';
import { FlightStreamHandle } from '../services/FlightStreamHandle';
import { FlightPositionEvent, type FlightSource as EventFlightSource } from '../schemas/flight-events';

// =============================================================================
// Schemas
// =============================================================================

/**
 * Ingestion configuration */
/** TODO: Turn all Schema.Structs into proper TaggedStructs. Ensure that they are
 */
export const IngestionRegion = Schema.TaggedStruct(
  '@tmnl/geoint/schemas/IngestionRegion',
  {
    /** Region name for logging */
    name: Schema.String,
    /** Bounding box [minLon, minLat, maxLon, maxLat] */
    bounds: Schema.Tuple(
      Schema.Number,
      Schema.Number,
      Schema.Number,
      Schema.Number
    ),
    /** Enable OpenSky polling for this region */
    openSky: Schema.optionalWith(Schema.Boolean, { default: () => true }),
    /** Enable ADSB.lol polling for this region */
    adsbLol: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  }
);
export type IngestionRegion = typeof IngestionRegion.Type;

/**
 * FlightIngester configuration
 */
export const FlightIngesterConfig = Schema.Struct({
  /** Regions to poll */
  regions: Schema.Array(IngestionRegion),
  /** OpenSky polling interval in milliseconds (default: 6000 = 6s for 10 req/min) */
  openSkyIntervalMs: Schema.optionalWith(Schema.Number, {
    default: () => 6000,
  }),
  /** ADSB.lol polling interval in milliseconds (default: 1000 = 1s for 60 req/min) */
  adsbLolIntervalMs: Schema.optionalWith(Schema.Number, {
    default: () => 1000,
  }),
  /** ADSB.lol search radius in nautical miles (max 250) */
  adsbLolRadiusNm: Schema.optionalWith(Schema.Number, { default: () => 150 }),
  /** Enable ingestion logging to raw.ingestion_log */
  logIngestion: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});
export type FlightIngesterConfig = typeof FlightIngesterConfig.Type;

/**
 * Default ingestion regions
 */
export const DEFAULT_INGESTION_REGIONS: readonly IngestionRegion[] = [
  {
    name: 'continental-us',
    bounds: [-125, 24, -66, 50],
    openSky: true,
    adsbLol: true,
  },
  {
    name: 'europe',
    bounds: [-10, 35, 40, 60],
    openSky: true,
    adsbLol: true,
  },
];

/**
 * Default FlightIngester configuration
 */
export const DEFAULT_FLIGHT_INGESTER_CONFIG: FlightIngesterConfig = {
  regions: [...DEFAULT_INGESTION_REGIONS],
  openSkyIntervalMs: 6000,
  adsbLolIntervalMs: 1000,
  adsbLolRadiusNm: 150,
  logIngestion: true,
};

// =============================================================================
// Transformers
// =============================================================================

/**
 * Transform OpenSkyStateVector to FlightPositionInput
 */
export const openSkyToFlightPosition = (
  state: OpenSkyStateVector,
  raw: unknown
): FlightPositionInput | null => {
  // Skip states without valid position
  if (state.longitude === null || state.latitude === null) {
    return null;
  }

  return {
    _tag: 'FlightPositionInput',
    time: new Date(state.lastContact * 1000),
    icao24: state.icao24.toLowerCase(),
    source: 'opensky' as FlightSource,
    raw,
    longitude: state.longitude,
    latitude: state.latitude,
    altitudeM:
      state.baroAltitude !== null
        ? Option.some(state.baroAltitude)
        : state.geoAltitude !== null
        ? Option.some(state.geoAltitude)
        : Option.none(),
    headingDeg:
      state.trueTrack !== null ? Option.some(state.trueTrack) : Option.none(),
    velocityMps:
      state.velocity !== null ? Option.some(state.velocity) : Option.none(),
    verticalRate:
      state.verticalRate !== null
        ? Option.some(state.verticalRate)
        : Option.none(),
    onGround: Option.some(state.onGround),
    callsign:
      state.callsign !== null
        ? Option.some(state.callsign.trim())
        : Option.none(),
    squawk: state.squawk !== null ? Option.some(state.squawk) : Option.none(),
    category:
      state.category !== undefined
        ? Option.some(String(state.category))
        : Option.none(),
    originCountry: Option.some(state.originCountry),
  };
};

/**
 * Transform AdsbLolAircraft to FlightPositionInput
 */
export const adsbLolToFlightPosition = (
  aircraft: AdsbLolAircraft,
  raw: unknown
): FlightPositionInput | null => {
  // Skip aircraft without valid position
  if (aircraft.lat === undefined || aircraft.lon === undefined) {
    return null;
  }

  // Normalize ICAO24 - strip ~ prefix used for MLAT-derived positions
  let icao24 = aircraft.hex.toLowerCase();
  if (icao24.startsWith('~')) {
    icao24 = icao24.slice(1);
  }

  // Validate EICAO24E format (must be exactly 6 hex characters)
  if (!/^[0-9a-f]{6}$/.test(icao24)) {
    return null;
  }

  // Convert altitude from feet to meters
  const altitudeM =
    aircraft.altitudeFt !== undefined
      ? aircraft.altitudeFt * 0.3048
      : undefined;

  // Convert ground speed from knots to m/s
  const velocityMps =
    aircraft.groundSpeedKts !== undefined
      ? aircraft.groundSpeedKts * 0.514444
      : undefined;

  // Convert vertical rate from fpm to m/s
  const verticalRateMs =
    aircraft.verticalRateFpm !== undefined
      ? aircraft.verticalRateFpm * 0.00508
      : undefined;

  // Calculate time from seenSec offset
  const time = new Date(Date.now() - (aircraft.seenSec ?? 0) * 1000);

  return {
    _tag: 'FlightPositionInput',
    time,
    icao24,
    source: 'adsb_lol' as FlightSource,
    raw,
    longitude: aircraft.lon,
    latitude: aircraft.lat,
    // TODO: Utilize Option.fromNullable
    altitudeM: altitudeM !== undefined ? Option.some(altitudeM) : Option.none(),
    headingDeg:
      aircraft.trackDeg !== undefined
        ? Option.some(aircraft.trackDeg)
        : Option.none(),
    velocityMps:
      velocityMps !== undefined ? Option.some(velocityMps) : Option.none(),
    verticalRate:
      verticalRateMs !== undefined
        ? Option.some(verticalRateMs)
        : Option.none(),
    onGround:
      aircraft.onGround !== undefined
        ? Option.some(aircraft.onGround)
        : Option.none(),
    callsign:
      aircraft.flight !== undefined
        ? Option.some(aircraft.flight.trim())
        : Option.none(),
    squawk:
      aircraft.squawk !== undefined
        ? Option.some(aircraft.squawk)
        : Option.none(),
    category:
      aircraft.category !== undefined
        ? Option.some(aircraft.category)
        : Option.none(),
    originCountry: Option.none(), // ADSB.lol doesn't provide origin country
  };
};

// =============================================================================
// Error Types
// =============================================================================

/**
 * FlightIngester error
 */
export class FlightIngesterError extends Schema.TaggedError<FlightIngesterError>()(
  'FlightIngesterError',
  {
    source: Schema.Literal('opensky', 'adsb_lol', 'internal'),
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Ingestion Result
// =============================================================================

/**
 * Result of a single ingestion operation
 */
export interface IngestionResult {
  readonly source: FlightSource;
  readonly region: string;
  readonly recordsIngested: number;
  readonly latencyMs: number;
  readonly error?: string;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * FlightIngester service interface
 */
export interface FlightIngester {
  /**
   * Ingest OpenSky data for a specific region
   */
  readonly ingestOpenSky: (
    region: IngestionRegion
  ) => Effect.Effect<IngestionResult, FlightIngesterError>;

  /**
   * Ingest ADSB.lol data for a specific region
   */
  readonly ingestAdsbLol: (
    region: IngestionRegion,
    radiusNm: number
  ) => Effect.Effect<IngestionResult, FlightIngesterError>;

  /**
   * Start continuous ingestion for all configured regions
   * Returns fiber handles for the polling loops
   */
  readonly start: () => Effect.Effect<
    {
      readonly openSkyFiber: Fiber.RuntimeFiber<void, FlightIngesterError>;
      readonly adsbLolFiber: Fiber.RuntimeFiber<void, FlightIngesterError>;
    },
    FlightIngesterError
  >;

  /**
   * Stop all ingestion fibers
   */
  readonly stop: (fibers: {
    readonly openSkyFiber: Fiber.RuntimeFiber<void, FlightIngesterError>;
    readonly adsbLolFiber: Fiber.RuntimeFiber<void, FlightIngesterError>;
  }) => Effect.Effect<void, never>;

  /**
   * Get the current configuration
   */
  readonly config: FlightIngesterConfig;
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * FlightIngester service tag
 */
export class FlightIngesterTag extends Context.Tag('geoint/FlightIngester')<
  FlightIngesterTag,
  FlightIngester
>() {}

/**
 * FlightIngester config tag
 */
export class FlightIngesterConfigTag extends Context.Tag(
  'geoint/FlightIngesterConfig'
)<FlightIngesterConfigTag, FlightIngesterConfig>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create FlightIngester service
 */
export const makeFlightIngester = Effect.gen(function* () {
  const config = yield* FlightIngesterConfigTag;
  const flightRepo = yield* FlightRepositoryTag;
  const openSkyClient = yield* Effect.serviceOption(OpenSkyClientService);
  const adsbLolClient = yield* Effect.serviceOption(AdsbLolClientService);
  const flightStream = yield* Effect.serviceOption(FlightStreamHandle);
  const sql = yield* PgClient.PgClient;

  /**
   * Transform FlightPositionInput to FlightPositionEvent for stream publishing.
   * Converts Option<T> fields to T | undefined for the event schema.
   */
  const toFlightEvent = (input: FlightPositionInput): FlightPositionEvent => {
    // Map FlightSource to EventFlightSource
    const source: EventFlightSource = input.source === 'adsb_lol' ? 'adsb_lol' : 'opensky';

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
    });
  };

  /**
   * Transactional ingest: Write to DB + Publish to Stream atomically.
   * If stream is not available, falls back to DB-only insert.
   */
  const transactionalIngest = (
    positions: FlightPositionInput[],
    source: FlightSource,
    region: string
  ): Effect.Effect<number, never> => {
    if (positions.length === 0) {
      return Effect.succeed(0);
    }

    // If no stream handle, just insert to DB
    if (Option.isNone(flightStream)) {
      return flightRepo.insertPositions(positions).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`${source} insert failed: ${error.message}`).pipe(
            Effect.as(0)
          )
        )
      );
    }

    const streamHandle = flightStream.value;
    const events = positions.map(toFlightEvent);

    // TRANSACTIONAL: Write to Postgres + Publish to Stream in same transaction
    return sql.withTransaction(
      Effect.gen(function* () {
        // 1. Insert into raw.flight_positions
        const insertedCount = yield* flightRepo.insertPositions(positions);

        // 2. Publish to DurableStream (within same transaction)
        yield* streamHandle.appendBatch(events);

        yield* Effect.logDebug(
          `[FlightIngester] Transactional commit: ${insertedCount} positions + ${events.length} events for ${region}`
        );

        return insertedCount;
      })
    ).pipe(
      Effect.catchAll((error) =>
        Effect.logWarning(`${source} transactional ingest failed: ${String(error)}`).pipe(
          Effect.as(0)
        )
      )
    );
  };

  /**
   * Log ingestion result to raw.ingestion_log
   */
  const logIngestion = (
    result: IngestionResult
  ): Effect.Effect<void, never> => {
    if (!config.logIngestion) return Effect.void;

    return pipe(
      sql`
        INSERT INTO raw.ingestion_log (time, source, operation, records_ingested, latency_ms, error)
        VALUES (
          NOW(),
          ${result.source},
          ${'ingest:' + result.region},
          ${result.recordsIngested},
          ${result.latencyMs},
          ${result.error ?? null}
        )
      `,
      Effect.asVoid,
      Effect.catchAll(() => Effect.void) // Don't fail ingestion if logging fails
    );
  };

  /**
   * Ingest OpenSky data for a region
   */
  const ingestOpenSky: FlightIngester['ingestOpenSky'] = (region) =>
    Effect.gen(function* () {
      const startTime = Date.now();

      if (Option.isNone(openSkyClient)) {
        return {
          source: 'opensky' as FlightSource,
          region: region.name,
          recordsIngested: 0,
          latencyMs: Date.now() - startTime,
          error: 'OpenSky client not available',
        };
      }

      const client = openSkyClient.value;
      const bounds: readonly [number, number, number, number] = region.bounds;

      // Fetch states from OpenSky
      const fetchResult = yield* client.getStates({ bounds }).pipe(
        Effect.map((response) => ({ _tag: 'success' as const, response })),
        Effect.catchAll(
          (error: ExternalApiError | RateLimitError | TimeoutError) =>
            Effect.succeed({ _tag: 'error' as const, message: error.message })
        )
      );

      // Check for error in fetch
      if (fetchResult._tag === 'error') {
        const result: IngestionResult = {
          source: 'opensky',
          region: region.name,
          recordsIngested: 0,
          latencyMs: Date.now() - startTime,
          error: fetchResult.message,
        };
        yield* logIngestion(result);
        return result;
      }

      const response = fetchResult.response;

      // Transform and insert positions
      const positions: FlightPositionInput[] = [];
      if (response.states) {
        for (const state of response.states) {
          const position = openSkyToFlightPosition(state, state);
          if (position !== null) {
            positions.push(position);
          }
        }
      }

      // TRANSACTIONAL: Insert into database + Publish to stream
      const insertedCount = yield* transactionalIngest(positions, 'opensky', region.name);

      const result: IngestionResult = {
        source: 'opensky',
        region: region.name,
        recordsIngested: insertedCount,
        latencyMs: Date.now() - startTime,
      };

      yield* logIngestion(result);
      yield* Effect.logDebug(
        `OpenSky ${region.name}: ${insertedCount} positions ingested`
      );

      return result;
    });

  /**
   * Ingest ADSB.lol data for a region
   */
  const ingestAdsbLol: FlightIngester['ingestAdsbLol'] = (region, radiusNm) =>
    Effect.gen(function* () {
      const startTime = Date.now();

      if (Option.isNone(adsbLolClient)) {
        return {
          source: 'adsb_lol' as FlightSource,
          region: region.name,
          recordsIngested: 0,
          latencyMs: Date.now() - startTime,
          error: 'ADSB.lol client not available',
        };
      }

      const client = adsbLolClient.value;
      const [minLon, minLat, maxLon, maxLat] = region.bounds;

      // Calculate center point of bounding box
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;

      // Fetch aircraft from ADSB.lol
      const fetchResult = yield* client
        .getByPoint({
          lat: centerLat,
          lon: centerLon,
          radiusNm: Math.min(radiusNm, 250), // Max 250nm
        })
        .pipe(
          Effect.map((response) => ({ _tag: 'success' as const, response })),
          Effect.catchAll(
            (error: ExternalApiError | RateLimitError | TimeoutError) =>
              Effect.succeed({ _tag: 'error' as const, message: error.message })
          )
        );

      // Check for error in fetch
      if (fetchResult._tag === 'error') {
        const result: IngestionResult = {
          source: 'adsb_lol',
          region: region.name,
          recordsIngested: 0,
          latencyMs: Date.now() - startTime,
          error: fetchResult.message,
        };
        yield* logIngestion(result);
        return result;
      }

      const response = fetchResult.response;

      // Transform and insert positions
      const positions: FlightPositionInput[] = [];
      for (const aircraft of response.aircraft) {
        const position = adsbLolToFlightPosition(aircraft, aircraft);
        if (position !== null) {
          positions.push(position);
        }
      }

      // TRANSACTIONAL: Insert into database + Publish to stream
      const insertedCount = yield* transactionalIngest(positions, 'adsb_lol', region.name);

      const result: IngestionResult = {
        source: 'adsb_lol',
        region: region.name,
        recordsIngested: insertedCount,
        latencyMs: Date.now() - startTime,
      };

      yield* logIngestion(result);
      yield* Effect.logDebug(
        `ADSB.lol ${region.name}: ${insertedCount} positions ingested`
      );

      return result;
    });

  /**
   * Start continuous ingestion
   */
  const start: FlightIngester['start'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Starting flight ingestion service');
      yield* Effect.logInfo(
        `Regions: ${config.regions.map((r) => r.name).join(', ')}`
      );

      // Filter regions by source availability
      const openSkyRegions = config.regions.filter((r) => r.openSky);
      const adsbLolRegions = config.regions.filter((r) => r.adsbLol);

      // Create OpenSky polling loop
      const openSkyLoop = pipe(
        Effect.forEach(
          openSkyRegions,
          (region) =>
            ingestOpenSky(region).pipe(
              Effect.catchAll((error) => {
                return Effect.logWarning(
                  `OpenSky ingestion error: ${error.message}`
                );
              })
            ),
          { concurrency: 1 } // Sequential to respect rate limits
        ),
        Effect.repeat(
          Schedule.spaced(Duration.millis(config.openSkyIntervalMs))
        ),
        Effect.asVoid
      );

      // Create ADSB.lol polling loop
      const adsbLolLoop = pipe(
        Effect.forEach(
          adsbLolRegions,
          (region) =>
            ingestAdsbLol(region, config.adsbLolRadiusNm).pipe(
              Effect.catchAll((error) => {
                return Effect.logWarning(
                  `ADSB.lol ingestion error: ${error.message}`
                );
              })
            ),
          { concurrency: 2 } // Allow some parallelism with higher rate limit
        ),
        Effect.repeat(
          Schedule.spaced(Duration.millis(config.adsbLolIntervalMs))
        ),
        Effect.asVoid
      );

      // Fork both loops
      const openSkyFiber = yield* Effect.fork(openSkyLoop);
      const adsbLolFiber = yield* Effect.fork(adsbLolLoop);

      yield* Effect.logInfo('Flight ingestion started');

      return { openSkyFiber, adsbLolFiber };
    });

  /**
   * Stop ingestion fibers
   */
  const stop: FlightIngester['stop'] = (fibers) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Stopping flight ingestion service');
      yield* Fiber.interrupt(fibers.openSkyFiber);
      yield* Fiber.interrupt(fibers.adsbLolFiber);
      yield* Effect.logInfo('Flight ingestion stopped');
    });

  return {
    ingestOpenSky,
    ingestAdsbLol,
    start,
    stop,
    config,
  } satisfies FlightIngester;
});

// =============================================================================
// Layers
// =============================================================================

/**
 * Default FlightIngester config layer
 */
export const FlightIngesterConfigDefault = Layer.succeed(
  FlightIngesterConfigTag,
  DEFAULT_FLIGHT_INGESTER_CONFIG
);

/**
 * FlightIngester service layer
 *
 * Requires:
 * - FlightIngesterConfigTag
 * - FlightRepositoryTag
 * - PgClient.PgClient
 * - OpenSkyClientService (optional)
 * - AdsbLolClientService (optional)
 */
export const FlightIngesterLive = Layer.effect(
  FlightIngesterTag,
  makeFlightIngester
);

/**
 * FlightIngester with default config
 *
 * Requires:
 * - FlightRepositoryTag
 * - PgClient.PgClient
 * - OpenSkyClientService (optional)
 * - AdsbLolClientService (optional)
 */
export const FlightIngesterDefault = FlightIngesterLive.pipe(
  Layer.provide(FlightIngesterConfigDefault)
);

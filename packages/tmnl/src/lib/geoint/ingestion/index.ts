// =============================================================================
// GEOINT Ingestion - Barrel Export
// =============================================================================

// FlightIngester - Continuous flight data ingestion from OpenSky and ADSB.lol
export {
  // Schemas
  IngestionRegion,
  FlightIngesterConfig,
  // Defaults
  DEFAULT_INGESTION_REGIONS,
  DEFAULT_FLIGHT_INGESTER_CONFIG,
  // Transformers
  openSkyToFlightPosition,
  adsbLolToFlightPosition,
  // Error
  FlightIngesterError,
  // Types
  type IngestionResult,
  type FlightIngester,
  // Tags
  FlightIngesterTag,
  FlightIngesterConfigTag,
  // Factory
  makeFlightIngester,
  // Layers
  FlightIngesterConfigDefault,
  FlightIngesterLive,
  FlightIngesterDefault,
} from './FlightIngester'

// OsmIngester - POI data ingestion from OpenStreetMap via Overpass API
export {
  // Schemas
  OsmIngestionRegion,
  OsmIngesterConfig,
  // Defaults
  DEFAULT_OSM_INGESTION_REGIONS,
  DEFAULT_OSM_INGESTER_CONFIG,
  // Transformers
  overpassElementToPoiInput,
  // Error
  OsmIngesterError,
  // Types
  type OsmIngestionResult,
  type OsmIngester,
  // Tags
  OsmIngesterTag,
  OsmIngesterConfigTag,
  // Factory
  makeOsmIngester,
  // Layers
  OsmIngesterConfigDefault,
  OsmIngesterLive,
  OsmIngesterDefault,
} from './OsmIngester'

// WeatherIngester - Weather data ingestion from Open-Meteo API
export {
  // Schemas
  WeatherIngestionGrid,
  WeatherIngesterConfig,
  // Defaults
  DEFAULT_WEATHER_INGESTION_GRID,
  DEFAULT_WEATHER_INGESTER_CONFIG,
  // Utilities
  WMO_WEATHER_CODES,
  wmoCodeToDescription,
  generateLocationId,
  generateGridPoints,
  type GridPoint,
  // Temperature utilities
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  // Transformers
  weatherForecastToObservationInput,
  weatherForecastToHourlyInputs,
  // Error
  WeatherIngesterError,
  // Types
  type WeatherIngestionResult,
  type WeatherIngester,
  // Tags
  WeatherIngesterTag,
  WeatherIngesterConfigTag,
  // Factory
  makeWeatherIngester,
  // Layers
  WeatherIngesterConfigDefault,
  WeatherIngesterLive,
  WeatherIngesterDefault,
} from './WeatherIngester'

// ImageryIngester - Satellite imagery metadata ingestion from Planet Labs and Sentinel Hub
export {
  // Schemas
  ImageryProviderType,
  ImageryIngestionRegion,
  ImageryIngesterConfig,
  // Defaults
  DEFAULT_IMAGERY_INGESTION_REGIONS,
  DEFAULT_IMAGERY_INGESTER_CONFIG,
  // Utilities
  convertPlanetCloudCover,
  convertSentinelCloudCover,
  computeBboxFromPolygon,
  computeCentroidFromBbox,
  // Transformers
  planetItemToImageryInput,
  sentinelItemToImageryInput,
  // Error
  ImageryIngesterError,
  // Types
  type ImageryIngestionResult,
  type ImageryIngester,
  // Tags
  ImageryIngesterTag,
  ImageryIngesterConfigTag,
  // Factory
  makeImageryIngester,
  // Layers
  ImageryIngesterConfigDefault,
  ImageryIngesterLive,
  ImageryIngesterDefault,
} from './ImageryIngester'

// IngestionOrchestrator - Coordinates all ingesters
export {
  // Schemas
  IngesterStatus,
  OrchestratorStatus,
  OrchestratorConfig,
  // Defaults
  DEFAULT_ORCHESTRATOR_CONFIG,
  // Error
  IngestionOrchestratorError,
  // Types
  type IngesterName,
  type IngestionOrchestrator,
  // Tags
  IngestionOrchestratorTag,
  IngestionOrchestratorConfigTag,
  // Factory
  makeIngestionOrchestrator,
  // Layers
  IngestionOrchestratorConfigDefault,
  IngestionOrchestratorLive,
  IngestionOrchestratorDefault,
} from './IngestionOrchestrator'

// =============================================================================
// Production Layers
// =============================================================================

import { Layer } from 'effect'
import { FlightIngesterLive, FlightIngesterConfigDefault } from './FlightIngester'
import { OsmIngesterLive, OsmIngesterConfigDefault } from './OsmIngester'
import { WeatherIngesterLive, WeatherIngesterConfigDefault } from './WeatherIngester'
import { ImageryIngesterLive, ImageryIngesterConfigDefault } from './ImageryIngester'
import { IngestionOrchestratorLive, IngestionOrchestratorConfigDefault } from './IngestionOrchestrator'
import { ExternalApiClientsLive } from '../api/ExternalApiClient'
import { FlightRepositoryLive } from '../persistence/postgis/FlightRepository'
import { PoiRepositoryLive } from '../persistence/postgis/PoiRepository'
import { WeatherRepositoryLive } from '../persistence/postgis/WeatherRepository'
import { ImageryRepositoryLive } from '../persistence/postgis/ImageryRepository'

/**
 * All ingester layers combined with default configurations.
 *
 * Requires:
 * - PgClient.PgClient (database connection)
 * - API clients from ExternalApiClientsLive (includes CircuitBreakersLive)
 *
 * @example
 * ```typescript
 * import { Layer, Redacted } from 'effect'
 * import { PgClient } from '@effect/sql-pg'
 * import { FetchHttpClient } from '@effect/platform'
 * import { AllIngestersLive, ExternalApiClientsLive } from '@tmnl/geoint'
 *
 * const PgClientLive = PgClient.layer({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'tmnl',
 *   username: 'tmnl',
 *   password: Redacted.make('tmnl_dev_password'),
 * })
 *
 * const ProductionLayer = AllIngestersLive.pipe(
 *   Layer.provide(ExternalApiClientsLive),
 *   Layer.provide(FetchHttpClient.layer),
 *   Layer.provide(PgClientLive)
 * )
 * ```
 */
export const AllIngestersLive = Layer.mergeAll(
  FlightIngesterLive.pipe(Layer.provide(FlightIngesterConfigDefault)),
  OsmIngesterLive.pipe(Layer.provide(OsmIngesterConfigDefault)),
  WeatherIngesterLive.pipe(Layer.provide(WeatherIngesterConfigDefault)),
  ImageryIngesterLive.pipe(Layer.provide(ImageryIngesterConfigDefault)),
)

/**
 * All repository layers combined.
 *
 * Requires:
 * - PgClient.PgClient (database connection)
 */
export const AllRepositoriesLive = Layer.mergeAll(
  FlightRepositoryLive,
  PoiRepositoryLive,
  WeatherRepositoryLive,
  ImageryRepositoryLive,
)

/**
 * Complete ingestion pipeline with orchestrator.
 *
 * Includes:
 * - All 4 ingesters (Flight, OSM, Weather, Imagery)
 * - Ingestion orchestrator
 * - All repositories
 *
 * Requires:
 * - PgClient.PgClient (database connection)
 * - HttpClient.HttpClient (for API calls)
 *
 * The ExternalApiClientsLive layer is included, which provides:
 * - CircuitBreakersLive for API resilience
 * - All 6 API clients (OpenSky, Overpass, ADSB.lol, Planet, Sentinel, Open-Meteo)
 *
 * @example
 * ```typescript
 * import { Layer, Redacted } from 'effect'
 * import { PgClient } from '@effect/sql-pg'
 * import { FetchHttpClient } from '@effect/platform'
 * import { IngestionPipelineLive } from '@tmnl/geoint/ingestion'
 *
 * const PgClientLive = PgClient.layer({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'tmnl',
 *   username: 'tmnl',
 *   password: Redacted.make('tmnl_dev_password'),
 * })
 *
 * const program = Effect.gen(function* () {
 *   const orchestrator = yield* IngestionOrchestratorTag
 *   yield* orchestrator.start()
 *   // ...
 * })
 *
 * const runnable = program.pipe(
 *   Effect.provide(IngestionPipelineLive),
 *   Effect.provide(FetchHttpClient.layer),
 *   Effect.provide(PgClientLive)
 * )
 * ```
 */
export const IngestionPipelineLive = Layer.mergeAll(
  AllIngestersLive,
  IngestionOrchestratorLive.pipe(Layer.provide(IngestionOrchestratorConfigDefault)),
  AllRepositoriesLive,
).pipe(
  Layer.provideMerge(ExternalApiClientsLive)
)

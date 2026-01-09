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

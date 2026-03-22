# GEOINT Ingestion Architecture

## Overview

The ingestion layer provides continuous polling of external data sources, transforming API responses into canonical domain types, and persisting to PostgreSQL/TimescaleDB storage. Each ingester is designed as an Effect service with dependency injection for testability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INGESTION LAYER (Continuous Polling - Independent of User Searches)            │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Flight       │  │ OSM          │  │ Weather      │  │ Imagery      │         │
│  │ Ingester     │  │ Ingester     │  │ Ingester     │  │ Ingester     │         │
│  │              │  │              │  │              │  │              │         │
│  │ • OpenSky    │  │ • Overpass   │  │ • Open-Meteo │  │ • Planet     │         │
│  │ • ADSB.lol   │  │   (20/min)   │  │   (60/min)   │  │ • Sentinel   │         │
│  │ (10+60/min)  │  │              │  │              │  │   (30/min)   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                 │                  │
│         └────────────┬────┴─────────────────┴────┬────────────┘                  │
│                      ▼                           ▼                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  TRANSFORMER LAYER                                                        │   │
│  │                                                                           │   │
│  │  openSkyToFlightPosition()    overpassElementToPoiInput()                │   │
│  │  adsbLolToFlightPosition()    openMeteoToWeatherObs()                    │   │
│  │                               planetToImageryItem()                       │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                      │                                                           │
│                      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  REPOSITORY LAYER (Effect Services)                                       │   │
│  │                                                                           │   │
│  │  FlightRepository         PoiRepository          WeatherRepository        │   │
│  │  .insertPositions()       .upsertPois()          .insertObservations()    │   │
│  │  .findInBbox()            .findPois()            .findNearby()            │   │
│  │  .getTrack()              .findNearby()          .getForecast()           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                      │                                                           │
│                      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL/TimescaleDB                                                   │   │
│  │                                                                           │   │
│  │  raw.flight_positions (hypertable)   raw.osm_elements (cache w/ TTL)     │   │
│  │  raw.weather_observations            raw.imagery_items                    │   │
│  │  raw.ingestion_log                                                        │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Ingester Pattern

Each ingester follows a consistent pattern:

### 1. Configuration Schema

```typescript
export const XxxIngesterConfig = Schema.Struct({
  regions: Schema.Array(XxxIngestionRegion),
  intervalMs: Schema.optionalWith(Schema.Number, { default: () => 300000 }),
  queryTimeoutMs: Schema.optionalWith(Schema.Number, { default: () => 60000 }),
  logIngestion: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
```

### 2. Service Interface

```typescript
export interface XxxIngester {
  readonly ingestRegion: (region: Region) => Effect.Effect<IngestionResult, XxxIngesterError>
  readonly start: () => Effect.Effect<Fiber.RuntimeFiber<void, Error>, Error>
  readonly stop: (fiber: Fiber.RuntimeFiber<void, Error>) => Effect.Effect<void, never>
  readonly config: XxxIngesterConfig
}
```

### 3. Transformer Function

```typescript
export const apiResponseToInput = (
  apiData: ApiResponse,
  raw: unknown,
  context: Context
): DomainInput | null => {
  // Transform API types to domain types
  // Return null if data is invalid/incomplete
}
```

### 4. Service Tags & Layers

```typescript
export class XxxIngesterTag extends Context.Tag('geoint/XxxIngester')<
  XxxIngesterTag,
  XxxIngester
>() {}

export const XxxIngesterLive = Layer.effect(XxxIngesterTag, makeXxxIngester)
export const XxxIngesterDefault = XxxIngesterLive.pipe(
  Layer.provide(XxxIngesterConfigDefault)
)
```

## Ingesters

### FlightIngester

Polls flight position data from:
- **OpenSky Network** (10 req/min) - ADS-B aggregator
- **ADSB.lol** (60 req/min) - Real-time ADS-B

**Key transformations:**
- Feet to meters: `altitude * 0.3048`
- Knots to m/s: `velocity * 0.514444`
- FPM to m/s: `verticalRate * 0.00508`

**Location:** `FlightIngester.ts`

### OsmIngester

Polls POI data from OpenStreetMap via Overpass API (~20 req/min).

**Features:**
- Configurable amenity/tag filters
- TTL-based caching (default 7 days)
- Bounding box queries per region

**Key transformations:**
- Extract centroid from node (lat/lon) or way/relation (center)
- Preserve OSM tags as JSONB

**Location:** `OsmIngester.ts`

### WeatherIngester ✅

Polls weather observations from Open-Meteo API (60 req/min).

**Data sources:**
- Current conditions (temperature, humidity, wind, pressure, weather code)
- Hourly forecasts (configurable, up to 24 hours)

**Key features:**
- Grid-based ingestion (configurable bounding boxes with resolution)
- WMO weather code to description mapping
- Stable location ID generation for deduplication
- Temperature unit conversion utilities (C↔F)
- Bounded concurrency (5 concurrent requests per grid)

**Key transformations:**
- `weatherForecastToObservationInput()` - Current weather → WeatherObservationInput
- `weatherForecastToHourlyInputs()` - Hourly data → WeatherObservationInput[]
- `generateGridPoints()` - Grid config → lat/lon point array
- `generateLocationId()` - Coordinates → stable location hash

**Location:** `WeatherIngester.ts`

### ImageryIngester ✅

Polls satellite imagery metadata from:
- **Planet Labs** (30 req/min) - Commercial high-res, OAuth2 authenticated
- **Sentinel Hub** (30 req/min) - Copernicus/ESA, OAuth2 authenticated

**Key features:**
- Multi-provider ingestion (Planet + Sentinel in parallel)
- Configurable lookback days (default 3 days)
- Cloud cover filtering per region
- Bounding box and centroid extraction from geometry
- Provider-normalized cloud cover (Planet decimal → percentage)

**Key transformations:**
- `planetItemToImageryInput()` - Planet API response → ImageryItemInput
- `sentinelItemToImageryInput()` - Sentinel STAC response → ImageryItemInput
- `computeBboxFromPolygon()` - GeoJSON polygon → [minLon, minLat, maxLon, maxLat]
- `computeCentroidFromBbox()` - Bounding box → { lat, lon } centroid
- `convertPlanetCloudCover()` - Decimal (0-1) → percentage (0-100)

**Location:** `ImageryIngester.ts`

## Future: Effect Cluster/RPC Refactor

The ingestion layer is planned to migrate to Effect Cluster for distributed execution:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  EFFECT CLUSTER                                                                  │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Sharding Manager                                                         │   │
│  │                                                                           │   │
│  │  Shard 1: FlightIngester (OpenSky regions 1-3)                           │   │
│  │  Shard 2: FlightIngester (ADSB.lol regions 1-5)                          │   │
│  │  Shard 3: OsmIngester (regions 1-4)                                       │   │
│  │  Shard 4: WeatherIngester (grid cells 1-100)                             │   │
│  │  Shard 5: ImageryIngester (Planet scenes)                                │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  RPC Layer                                                                │   │
│  │                                                                           │   │
│  │  @Rpc.streamWith('FlightIngester.streamPositions')                       │   │
│  │  @Rpc.method('OsmIngester.ingestRegion')                                 │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  Entity Layer                                                             │   │
│  │                                                                           │   │
│  │  @Entity.method('IngestionEntity.status')                                │   │
│  │  @Entity.method('IngestionEntity.configure')                             │   │
│  │  @Entity.method('IngestionEntity.pause')                                 │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Benefits of Cluster/RPC:

1. **Horizontal scaling** - Distribute ingestion across nodes
2. **Fault tolerance** - Automatic failover and rebalancing
3. **Rate limit distribution** - Each shard manages its own rate limits
4. **Backpressure** - Built-in flow control
5. **Observability** - Tracing spans propagate across shards

### Migration Path:

1. ✅ Current: Effect services with fiber-based polling
2. 🔄 Next: Add `@Rpc.method` decorators to service methods
3. 📋 Planned: Define sharding strategy per data source
4. 📋 Planned: Deploy with Effect Cluster pods

## Testing Strategy

### Unit Tests

Test transformer functions with various input shapes:
- Valid data with all fields
- Missing optional fields (uses defaults)
- Invalid/incomplete data (returns null)
- Boundary conditions (zero coords, large IDs)

### Integration Tests

Test full ingestion pipeline with mock API clients:
- Region ingestion with mock responses
- Error handling and recovery
- Continuous polling lifecycle
- Database interaction via mock repositories

Run integration tests with:
```bash
RUN_INTEGRATION_TESTS=1 bun test src/lib/geoint/ingestion/__tests__/
```

## Rate Limiting

| Source | Rate Limit | Strategy |
|--------|------------|----------|
| OpenSky | 10/min | Sequential per region |
| ADSB.lol | 60/min | Concurrent (2 workers) |
| Overpass | ~20/min | Sequential, conservative |
| Open-Meteo | 60/min | Concurrent by grid cell |
| Planet Labs | 30/min | Concurrent with OAuth2 |
| Sentinel Hub | 30/min | Concurrent with OAuth2 |

## Retention Policies

| Data Type | Raw Retention | Aggregate Retention |
|-----------|---------------|---------------------|
| Flight positions | 30 days | 1 year |
| OSM POIs | 7 day TTL | N/A (cache) |
| Weather obs | 3 days | 30 days |
| Imagery meta | 90 days | 1 year |

## File Structure

```
src/lib/geoint/ingestion/
├── index.ts                    # Barrel export
├── FlightIngester.ts           # OpenSky + ADSB.lol ✅
├── OsmIngester.ts              # Overpass API ✅
├── WeatherIngester.ts          # Open-Meteo ✅
├── ImageryIngester.ts          # Planet/Sentinel ✅
├── IngestionOrchestrator.ts    # Coordinates all ingesters (planned)
├── INGESTION_ARCHITECTURE.md   # This document
└── __tests__/
    ├── FlightIngester.test.ts
    ├── FlightIngester.integration.test.ts
    ├── OsmIngester.test.ts
    ├── OsmIngester.integration.test.ts
    ├── WeatherIngester.test.ts
    └── ImageryIngester.test.ts          # (planned)
```

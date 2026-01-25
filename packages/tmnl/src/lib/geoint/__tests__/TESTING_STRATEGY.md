# GEOINT Testing Strategy

## Overview

Systematic testing plan for the GEOINT system covering API clients, services, and UI integration.

---

## Test Layers

### Layer 1: API Client Unit Tests

**Files**: `ExternalApiClient.test.ts`

| Client | Mock Strategy | Test Cases |
|--------|--------------|------------|
| OpenSkyClient | Mock HttpClient | getStates with bounds, ICAO filter, rate limiting |
| OverpassClient | Mock HttpClient | query execution, buildQuery, rate limiting |
| AdsbLolClient | Mock HttpClient | getByPoint, getByIcao, category mapping |
| PlanetLabsClient | Mock HttpClient | quickSearch, pagination, auth header |
| SentinelHubClient | Mock HttpClient | OAuth2 flow, token caching, search |
| OpenMeteoClient | Mock HttpClient | getForecast, geocode, combined operation |

**Pattern**:
```typescript
import { it } from '@effect/vitest'

it.effect('OpenSkyClient.getStates returns flights within bounds', () =>
  Effect.gen(function* () {
    const client = yield* OpenSkyClientService
    const response = yield* client.getStates({
      bounds: [-122.5, 37.5, -122.0, 38.0]
    })
    expect(response.states).toBeDefined()
  }).pipe(
    Effect.provide(OpenSkyClientLive),
    Effect.provide(MockHttpClientLayer)
  )
)
```

### Layer 2: Result Transformer Tests

**Files**: `transformers.test.ts`

| Transformer | Input | Output | Edge Cases |
|-------------|-------|--------|------------|
| openSkyToSearchResult | OpenSkyStateVector | SearchResultFlight | null position, missing callsign |
| overpassToSearchResult | OverpassElement | SearchResultPoi | way vs node, center extraction |
| adsbLolToSearchResult | AdsbLolAircraft | SearchResultFlight | unit conversion, category mapping |
| planetItemToSearchResult | PlanetItem | SearchResultFeature | geometry extraction |
| sentinelItemToSearchResult | SentinelItem | SearchResultFeature | centroid calculation |
| weatherForecastToSearchResult | WeatherForecast | SearchResultWeather | WMO code mapping |

### Layer 3: SearchService Tests

**Files**: `SearchService.test.ts`

| Test Case | Description | Assertions |
|-----------|-------------|------------|
| search updates atoms | Execute search, verify atom state | status, results, history |
| searchInBounds generates query | Convenience method | correct GeoFilterBounds |
| cancelActiveSearch resets state | Cancel mid-search | status → idle |
| clearResults empties all atoms | Full reset | all atoms default |
| error handling updates searchErrorAtom | Failed search | error captured |

**Pattern**:
```typescript
it.effect('SearchService.search updates atoms correctly', () =>
  Effect.gen(function* () {
    const service = yield* SearchServiceTag
    const query = new SearchQuery({
      id: 'test-query' as SearchId,
      geoFilter: new GeoFilterBounds({ bounds: [-122, 37, -121, 38] }),
      sources: ['osm', 'opensky'],
      limitPerSource: 10,
    })

    const response = yield* service.search(query)

    expect(service.registry.get(searchStatusAtom)).toBe('completed')
    expect(service.registry.get(resultsCountAtom)).toBeGreaterThan(0)
  }).pipe(Effect.provide(SearchServiceTest))
)
```

### Layer 4: Integration Tests (Real APIs)

**Files**: `integration/*.test.ts`

**Prerequisites**:
- Network access
- Rate limit awareness (run sequentially)
- Timeout handling (60s for slow APIs)

| API | Test | Skip Condition |
|-----|------|----------------|
| OpenSky | Real bounds query | CI without network |
| Overpass | POI query | CI without network |
| ADSB.lol | Point query | CI without network |
| Open-Meteo | Weather forecast | CI without network |
| Planet Labs | Skip without API key | No PLANET_API_KEY |
| Sentinel Hub | Skip without credentials | No SENTINEL_CLIENT_ID |

**Pattern**:
```typescript
describe.skipIf(!process.env.RUN_INTEGRATION_TESTS)('OpenSky Integration', () => {
  it.effect('fetches real flight data', () =>
    Effect.gen(function* () {
      const client = yield* OpenSkyClientService
      const response = yield* client.getStates({
        bounds: [-122.5, 37.5, -122.0, 38.0]
      })
      // Flights may or may not be present
      expect(response.time).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(OpenSkyClientLive),
      Effect.provide(HttpClient.layer),
      Effect.timeout(Duration.seconds(30))
    )
  )
})
```

### Layer 5: Dashboard Integration Tests

**Files**: `GeointDashboard.test.tsx`

| Test Case | Setup | Actions | Assertions |
|-----------|-------|---------|------------|
| Search panel executes search | Render dashboard | Enter query, click search | Results appear |
| Result selection updates entity panel | Render + search | Click result | Entity details shown |
| Layout switching | Render | Press ⌘1/2/3 | Layout changes |
| Radial dial on Ctrl+Click | Render + select entity | Ctrl+click map | Dial appears |
| Layer toggles | Render | Toggle layer | Map updates |

---

## Test Fixtures

### Mock HTTP Responses

Location: `__fixtures__/`

```
__fixtures__/
├── opensky/
│   ├── states-san-francisco.json
│   ├── states-empty.json
│   └── error-rate-limit.json
├── overpass/
│   ├── pois-amenity-restaurant.json
│   ├── pois-empty.json
│   └── error-timeout.json
├── adsblol/
│   ├── point-query.json
│   ├── military.json
│   └── empty.json
├── openmeteo/
│   ├── forecast-current.json
│   ├── geocoding-san-francisco.json
│   └── error-404.json
└── README.md
```

### Mock HttpClient Layer

```typescript
const MockHttpClientLayer = Layer.succeed(HttpClient.HttpClient, {
  execute: (request) => {
    const url = request.url
    if (url.includes('opensky-network.org')) {
      return Effect.succeed(mockOpenSkyResponse())
    }
    if (url.includes('overpass-api.de')) {
      return Effect.succeed(mockOverpassResponse())
    }
    // ... other APIs
    return Effect.fail(new Error(`Unmocked URL: ${url}`))
  }
})
```

---

## Running Tests

### Unit Tests
```bash
bun run test src/lib/geoint/__tests__/
```

### Integration Tests
```bash
RUN_INTEGRATION_TESTS=1 bun run test src/lib/geoint/__tests__/integration/
```

### With Coverage
```bash
bun run test:coverage src/lib/geoint/
```

---

## CI Configuration

```yaml
# Vitest config for geoint tests
test:
  include:
    - 'src/lib/geoint/**/*.test.ts'
  exclude:
    - 'src/lib/geoint/__tests__/integration/**'
  coverage:
    branches: 80
    functions: 80
    lines: 80
    statements: 80

test:integration:
  include:
    - 'src/lib/geoint/__tests__/integration/**/*.test.ts'
  timeout: 60000
  env:
    RUN_INTEGRATION_TESTS: '1'
```

---

## Test Priority Order

1. **Critical Path**: Result transformers (data integrity)
2. **High**: SearchService atom state management
3. **Medium**: API client rate limiting & error handling
4. **Low**: UI component integration

---

## Verification Checklist

- [ ] All API clients have mock layer tests
- [ ] All transformers have edge case coverage
- [ ] SearchService state transitions verified
- [ ] Rate limiter token bucket tested
- [ ] Error types (ExternalApiError, RateLimitError, TimeoutError) handled
- [ ] Integration tests run successfully with real APIs
- [ ] Dashboard shows results from real search

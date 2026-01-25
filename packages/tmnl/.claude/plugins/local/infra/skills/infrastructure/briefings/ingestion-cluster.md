# Ingestion Cluster Service

## Purpose

Data ingestion RPC service built with Effect Cluster. Handles entity ingestion from external APIs (flights, weather, OSM, imagery) and persists to Postgres.

## Configuration

| Property | Value |
|----------|-------|
| Image | Custom build from `docker/ingestion-cluster/` |
| Port | 8102 |
| Volume | None (stateless) |
| Health | TCP port check |

## Dependencies

- **postgres** - Entity persistence
- **search-cluster-coordinator** - Entity updates

## Dependents

- Frontend ingestion controls
- Scheduled ingestion jobs

## Architecture

```
┌─────────────────────────────────────────────────────┐
│               Ingestion Cluster                      │
│                                                     │
│  ┌──────────────────┐     ┌────────────────────┐   │
│  │  WebSocket RPC   │────▶│  IngestionEntity   │   │
│  │     (8102)       │     │    Handlers        │   │
│  └──────────────────┘     └────────┬───────────┘   │
│                                    │               │
│                                    ▼               │
│  ┌──────────────────┐     ┌────────────────────┐   │
│  │   Flight API     │     │   PostGIS Client   │   │
│  │   Weather API    │────▶│   Entity Storage   │   │
│  │   OSM API        │     └────────────────────┘   │
│  │   Imagery API    │                              │
│  └──────────────────┘                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Dockerfile

Located at `docker/ingestion-cluster/Dockerfile`:

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --ignore-scripts
COPY scripts/ingestion-server.ts ./
CMD ["bun", "run", "ingestion-server.ts"]
```

## Commands

```bash
# View logs
docker compose logs -f ingestion-cluster

# Check health
curl http://localhost:8102/health

# Trigger ingestion via WebSocket
wscat -c ws://localhost:8102 -x '{"_tag":"Ingest","source":"flights","bbox":[-122,37,-121,38]}'
```

## WebSocket RPC API

Connect to `ws://localhost:8102` for RPC calls.

### Request Messages

```typescript
// Ingest entities for a bounding box
{
  "_tag": "Ingest",
  "source": "flights" | "weather" | "osm" | "imagery",
  "bbox": [minLon, minLat, maxLon, maxLat]
}

// Get ingestion status
{
  "_tag": "Status"
}

// Cancel ongoing ingestion
{
  "_tag": "Cancel",
  "jobId": "uuid"
}
```

### Response Messages

```typescript
// Progress update
{
  "_tag": "Progress",
  "jobId": "uuid",
  "processed": 100,
  "total": 500
}

// Completion
{
  "_tag": "Complete",
  "jobId": "uuid",
  "entityCount": 500
}

// Error
{
  "_tag": "Error",
  "message": "API rate limited"
}
```

## Environment Variables

```yaml
CLUSTER_PORT: 8102
POSTGRES_URL: postgresql://tmnl:tmnl@postgres:5432/tmnl
OPENSKY_USERNAME: (optional)
OPENSKY_PASSWORD: (optional)
OPENWEATHER_API_KEY: (optional)
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "nc", "-z", "localhost", "8102"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Data Sources

| Source | API | Rate Limits |
|--------|-----|-------------|
| Flights | OpenSky Network | 100 req/day (anonymous) |
| Weather | OpenWeatherMap | 60 req/min |
| OSM | Overpass API | 10,000 req/day |
| Imagery | Sentinel Hub | Varies |

## Common Issues

### API rate limited

Check rate limit status:
```bash
docker compose logs ingestion-cluster | grep -i "rate"
```

Solutions:
- Add API credentials for higher limits
- Implement request caching
- Use smaller bounding boxes

### Entities not appearing

1. Check Postgres connection:
   ```bash
   docker compose logs ingestion-cluster | grep -i "postgres"
   ```

2. Verify entity was persisted:
   ```bash
   docker compose exec postgres psql -U tmnl -c "SELECT COUNT(*) FROM entities WHERE source='flights';"
   ```

### WebSocket connection refused

1. Check service is running:
   ```bash
   docker compose ps ingestion-cluster
   ```

2. Check port is exposed:
   ```bash
   docker compose port ingestion-cluster 8102
   ```

## Build

Rebuild after code changes:

```bash
/infra:rebuild ingestion-cluster --no-cache
```

## Testing Locally

```typescript
// From frontend or Node.js
const ws = new WebSocket('ws://localhost:8102')
ws.onopen = () => {
  ws.send(JSON.stringify({
    _tag: 'Ingest',
    source: 'flights',
    bbox: [-122.5, 37.5, -122.0, 38.0]
  }))
}
ws.onmessage = (e) => console.log(JSON.parse(e.data))
```

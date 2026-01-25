# Search Cluster Services

## Purpose

Effect Cluster nodes for distributed search. Provides coordinator and data source nodes for scalable GEOINT entity search.

## Services

| Service | Port | Role |
|---------|------|------|
| `search-cluster-coordinator` | 8100 | Cluster coordinator |
| `search-cluster-sources` | 8101 | Data source nodes |

## Configuration

| Property | Value |
|----------|-------|
| Image | Custom build from `docker/search-cluster/` |
| Volumes | None (stateless) |
| Health | TCP port check |

## Dependencies

- **postgres** - Entity storage
- **electric** - Real-time sync (optional)

## Dependents

- Frontend search UI
- `ingestion-cluster` - Sends new entities

## Architecture

```
┌─────────────────────────────────────────────┐
│              Effect Cluster                  │
│                                             │
│  ┌─────────────────────┐                    │
│  │     Coordinator     │◀── Search queries  │
│  │      (8100)        │                     │
│  └─────────┬───────────┘                    │
│            │                                │
│            ▼                                │
│  ┌─────────────────────┐                    │
│  │   Source Nodes      │◀── Electric sync  │
│  │      (8101)        │                     │
│  └─────────────────────┘                    │
│                                             │
└─────────────────────────────────────────────┘
```

## Dockerfile

Located at `docker/search-cluster/Dockerfile`:

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --ignore-scripts
COPY scripts/search-cluster-server.ts ./
CMD ["bun", "run", "search-cluster-server.ts"]
```

## Commands

```bash
# View coordinator logs
docker compose logs -f search-cluster-coordinator

# View source logs
docker compose logs -f search-cluster-sources

# Check cluster health
curl http://localhost:8100/health

# Search entities
curl "http://localhost:8100/search?q=flight&bbox=-122,37,-121,38"
```

## API Endpoints (Coordinator)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/search` | GET | Search entities |
| `/cluster/status` | GET | Cluster node status |

## Environment Variables

Coordinator:
```yaml
CLUSTER_ROLE: coordinator
CLUSTER_PORT: 8100
POSTGRES_URL: postgresql://tmnl:tmnl@postgres:5432/tmnl
```

Sources:
```yaml
CLUSTER_ROLE: sources
CLUSTER_PORT: 8101
COORDINATOR_URL: http://search-cluster-coordinator:8100
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "nc", "-z", "localhost", "8100"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Common Issues

### Coordinator not finding sources

1. Check sources are running:
   ```bash
   docker compose ps search-cluster-sources
   ```

2. Check network connectivity:
   ```bash
   docker compose exec search-cluster-coordinator ping search-cluster-sources
   ```

### Search returns no results

1. Check data exists in Postgres:
   ```bash
   docker compose exec postgres psql -U tmnl -c "SELECT COUNT(*) FROM entities;"
   ```

2. Check Electric sync (if enabled):
   ```bash
   docker compose logs electric | tail -20
   ```

### High latency

- Check Postgres query performance
- Add indexes for search fields
- Scale source nodes horizontally

## Scaling

To add more source nodes, update docker-compose.yml:

```yaml
search-cluster-sources:
  deploy:
    replicas: 3
```

## Build

Rebuild after code changes:

```bash
/infra:rebuild search-cluster-coordinator
/infra:rebuild search-cluster-sources
```

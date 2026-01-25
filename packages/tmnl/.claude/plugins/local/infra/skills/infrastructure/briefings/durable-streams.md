# Durable Streams Service

## Purpose

Persistent event streaming service built with Effect. Provides durable message streams with WebSocket API for real-time subscriptions.

## Configuration

| Property | Value |
|----------|-------|
| Image | Custom build from `docker/durable-streams/` |
| Port | 3030 |
| Volume | `durable-streams-data` |
| Health | HTTP /health |

## Dependencies

- **None** (independent service)

## Dependents

- All services can emit/subscribe to events
- Used for inter-service communication
- Powers EventLog for audit trails

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/streams` | GET | List streams |
| `/streams/:name` | POST | Publish event |
| `/ws` | WebSocket | Real-time subscriptions |

## Dockerfile

Located at `docker/durable-streams/Dockerfile`:

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --ignore-scripts
COPY scripts/durable-streams-server.ts ./
CMD ["bun", "run", "durable-streams-server.ts"]
```

## Commands

```bash
# View logs
docker compose logs -f durable-streams

# Health check
curl http://localhost:3030/health

# List streams
curl http://localhost:3030/streams

# Publish event
curl -X POST http://localhost:3030/streams/test \
  -H "Content-Type: application/json" \
  -d '{"type": "test", "data": {}}'
```

## WebSocket API

Connect to `ws://localhost:3030/ws` for real-time subscriptions.

```typescript
const ws = new WebSocket('ws://localhost:3030/ws')
ws.send(JSON.stringify({
  type: 'subscribe',
  stream: 'events'
}))
ws.onmessage = (e) => console.log(JSON.parse(e.data))
```

## Environment Variables

```yaml
PORT: 3030
DATA_DIR: /data
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3030/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Common Issues

### Service won't start

Check build logs:

```bash
docker compose logs durable-streams
```

Common causes:
- Missing TypeScript dependencies
- Port already in use

### WebSocket connection drops

Check for network issues or client timeout settings.

### Data persistence

Data stored in `durable-streams-data` volume. To reset:

```bash
docker compose down
docker volume rm docker_durable-streams-data
docker compose up -d durable-streams
```

## Build

To rebuild after code changes:

```bash
/infra:rebuild durable-streams
```

Or with clean cache:

```bash
/infra:rebuild durable-streams --no-cache
```

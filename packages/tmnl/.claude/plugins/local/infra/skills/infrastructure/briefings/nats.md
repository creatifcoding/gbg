# NATS Service

## Purpose

Lightweight, high-performance message broker for real-time pub/sub messaging between services.

## Configuration

| Property | Value |
|----------|-------|
| Image | `nats:latest` |
| Port | 4222 (clients), 8222 (monitoring) |
| Volume | `nats-data` (JetStream) |
| Health | HTTP monitoring |

## Dependencies

- **None** (independent service)

## Dependents

- All services can publish/subscribe
- Powers real-time notifications
- Event bus for microservices

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 4222 | TCP | Client connections |
| 6222 | TCP | Cluster routing |
| 8222 | HTTP | Monitoring API |

## Commands

```bash
# View logs
docker compose logs -f nats

# Check server status
curl http://localhost:8222/varz

# Check connections
curl http://localhost:8222/connz

# Check subscriptions
curl http://localhost:8222/subsz

# Publish test message (using nats CLI)
docker compose exec nats nats pub test "hello world"

# Subscribe to topic
docker compose exec nats nats sub test
```

## Monitoring Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/varz` | Server statistics |
| `/connz` | Connection info |
| `/subsz` | Subscription info |
| `/routez` | Cluster routes |
| `/jsz` | JetStream info |

## Configuration File

Located at `docker/nats/nats.conf`:

```hcl
# Server settings
port: 4222
http_port: 8222

# JetStream for persistence
jetstream {
  store_dir: /data
  max_mem: 1G
  max_file: 10G
}

# Logging
debug: false
trace: false
logtime: true
```

## Environment Variables

```yaml
# None required for basic setup
# Authentication can be added via config
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://localhost:8222/healthz"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## JetStream

NATS JetStream provides:
- Message persistence
- At-least-once delivery
- Stream replay
- Consumer groups

### Creating a Stream

```bash
docker compose exec nats nats stream add EVENTS \
  --subjects="events.>" \
  --retention=limits \
  --max-msgs=-1 \
  --max-bytes=1GB \
  --max-age=7d
```

### Creating a Consumer

```bash
docker compose exec nats nats consumer add EVENTS processor \
  --ack=explicit \
  --deliver=all \
  --replay=instant
```

## Client Usage

### TypeScript (nats.ws)

```typescript
import { connect } from 'nats.ws'

const nc = await connect({ servers: 'ws://localhost:8222' })

// Publish
nc.publish('events.user.login', JSON.stringify({ userId: '123' }))

// Subscribe
const sub = nc.subscribe('events.>')
for await (const msg of sub) {
  console.log(msg.subject, msg.data)
}
```

### Request/Reply

```typescript
// Server
const sub = nc.subscribe('api.users')
for await (const msg of sub) {
  msg.respond(JSON.stringify({ name: 'John' }))
}

// Client
const response = await nc.request('api.users', '{}', { timeout: 1000 })
```

## Common Issues

### Connection refused

1. Check NATS is running:
   ```bash
   docker compose ps nats
   ```

2. Check port is exposed:
   ```bash
   docker compose port nats 4222
   ```

### Messages not persisting

Ensure JetStream is enabled and stream is created:
```bash
curl http://localhost:8222/jsz
docker compose exec nats nats stream ls
```

### High memory usage

Check JetStream storage:
```bash
curl http://localhost:8222/jsz | jq '.memory, .storage'
```

Consider:
- Lower `max_mem` in config
- Add message TTL
- Purge old streams

## WebSocket Access

For browser clients, NATS supports WebSocket on port 8222:

```typescript
const nc = await connect({
  servers: 'ws://localhost:8222',
  // For production, use wss://
})
```

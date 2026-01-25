# Electric Service

## Purpose

Real-time data synchronization layer. Syncs Postgres tables to clients via HTTP streaming, enabling offline-first applications with automatic conflict resolution.

## Configuration

| Property | Value |
|----------|-------|
| Image | `electricsql/electric:latest` |
| Port | 3000 |
| Volume | None (stateless) |
| Health | HTTP /health |

## Dependencies

- **postgres** - Requires logical replication enabled

## Dependents

- `search-cluster-*` - Syncs entity data
- Frontend clients - Real-time updates

## How It Works

1. Electric connects to Postgres via logical replication
2. Clients request "shapes" (filtered table subsets)
3. Electric streams changes in real-time
4. Clients maintain local SQLite cache

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/v1/shape` | GET | Request shape subscription |

## Shape Requests

```typescript
// Request shape for entities table
const response = await fetch(
  'http://localhost:3000/v1/shape?table=entities&where=type=flight'
)

// Stream changes
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // Process change
}
```

## Commands

```bash
# View logs
docker compose logs -f electric

# Health check
curl http://localhost:3000/health

# Check connection to postgres
docker compose logs electric | grep -i "connected"
```

## Environment Variables

```yaml
DATABASE_URL: postgresql://tmnl:tmnl@postgres:5432/tmnl
ELECTRIC_WRITE_TO_PG_MODE: logical_replication
PG_PROXY_PORT: 65432
```

## Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Postgres Requirements

Electric requires these Postgres settings:

```sql
-- In postgresql.conf
wal_level = logical
max_replication_slots = 10
max_wal_senders = 10
```

These are set automatically in the docker-compose postgres service.

## Common Issues

### Electric can't connect to Postgres

1. Check Postgres is healthy:
   ```bash
   docker compose ps postgres
   ```

2. Check replication slot exists:
   ```bash
   docker compose exec postgres psql -U tmnl -c "SELECT * FROM pg_replication_slots;"
   ```

3. Verify DATABASE_URL is correct in compose file

### Shape sync slow

- Check Postgres query performance
- Consider adding indexes on filtered columns
- Use more specific `where` clauses

### Memory usage high

Electric caches shape data. For large tables:
- Use more selective shapes
- Increase container memory limits

## Integration with Frontend

```typescript
import { ShapeStream } from '@electric-sql/client'

const stream = new ShapeStream({
  url: 'http://localhost:3000/v1/shape',
  params: {
    table: 'entities',
    where: 'type = flight'
  }
})

stream.subscribe(({ rows, headers }) => {
  // Handle updates
})
```

## Restart Procedure

Electric is stateless, safe to restart anytime:

```bash
docker compose restart electric
```

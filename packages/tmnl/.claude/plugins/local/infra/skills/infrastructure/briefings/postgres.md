# PostgreSQL Service

## Purpose

Primary data store with PostGIS spatial extensions and TimescaleDB for time-series data.

## Configuration

| Property | Value |
|----------|-------|
| Image | `timescale/timescaledb-ha:pg16-ts2.17` |
| Port | 5432 |
| Volume | `postgres-data` |
| Health | `pg_isready` (30s interval) |
| User | `tmnl` |
| Database | `tmnl` |

## Dependencies

- **None** (foundational service)

## Dependents

- `electric` - logical replication
- `search-cluster-*` - SQL storage
- `ingestion-cluster` - persistence

## Init Scripts

Located in `docker/postgres/init/`:

1. `00-electric-setup.sql` - Logical replication config
2. `01-extensions.sql` - PostGIS, TimescaleDB, pgvector
3. `02-geoint-schema.sql` - Entity tables for GEOINT

## Extensions

| Extension | Purpose |
|-----------|---------|
| PostGIS | Spatial data types and functions |
| TimescaleDB | Time-series hypertables |
| pgvector | Vector embeddings for RAG |
| pg_trgm | Fuzzy text search |

## Commands

```bash
# Connect to database
docker compose exec postgres psql -U tmnl

# Check replication slots (required for Electric)
docker compose exec postgres psql -U tmnl -c "SELECT * FROM pg_replication_slots;"

# View extensions
docker compose exec postgres psql -U tmnl -c "SELECT extname FROM pg_extension;"

# Check init logs
docker compose logs postgres | grep -i init

# Backup database
docker compose exec postgres pg_dump -U tmnl tmnl > backup.sql
```

## Environment Variables

```yaml
POSTGRES_USER: tmnl
POSTGRES_PASSWORD: tmnl
POSTGRES_DB: tmnl
```

## Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U tmnl"]
  interval: 30s
  timeout: 10s
  retries: 5
```

## Common Issues

### Replication slot stuck

Electric requires a logical replication slot. If stuck:

```bash
# Check slot status
docker compose exec postgres psql -U tmnl -c "SELECT slot_name, active FROM pg_replication_slots;"

# Drop and recreate if needed
docker compose exec postgres psql -U tmnl -c "SELECT pg_drop_replication_slot('electric_slot');"
```

### Init script failed

Check logs for SQL errors:

```bash
docker compose logs postgres 2>&1 | grep -A5 "ERROR"
```

### Disk space

Check volume usage:

```bash
docker system df -v | grep postgres
```

## Performance Tuning

For development, defaults are fine. For production:

```sql
-- Check current settings
SHOW shared_buffers;
SHOW work_mem;
SHOW effective_cache_size;
```

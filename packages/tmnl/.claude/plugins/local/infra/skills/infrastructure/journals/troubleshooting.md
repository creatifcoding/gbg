# Troubleshooting Journal

Common issues and solutions for TMNL infrastructure.

---

## Container Won't Start

### Symptoms
- `docker compose up` fails
- Container exits immediately
- Status shows "Exited (1)"

### Diagnosis

```bash
# Check exit reason
docker compose logs <service>

# Check container state
docker inspect $(docker compose ps -q <service>) | jq '.[0].State'
```

### Common Causes

1. **Port conflict**
   ```bash
   # Check what's using the port
   lsof -i :5432  # Replace with actual port

   # Kill conflicting process or change port in compose
   ```

2. **Missing environment variable**
   ```bash
   docker compose config  # Validate compose file
   ```

3. **Volume permission issue**
   ```bash
   # Check volume
   docker volume inspect docker_<volume-name>

   # Reset volume (DATA LOSS!)
   docker compose down -v
   docker compose up -d
   ```

4. **Image build failed**
   ```bash
   docker compose build --no-cache <service>
   ```

---

## Network Connectivity Issues

### Symptoms
- Service can't reach another service
- "Connection refused" errors
- DNS resolution failures

### Diagnosis

```bash
# Check network
docker network ls
docker network inspect docker_default

# Test connectivity from inside container
docker compose exec <service> ping <other-service>
docker compose exec <service> nc -zv <other-service> <port>
```

### Solutions

1. **Services not on same network**
   - Check `networks` in docker-compose.yml
   - All services should share a network

2. **Service not ready yet**
   - Add `depends_on` with `condition: service_healthy`
   - Add retry logic in client code

3. **Firewall blocking**
   ```bash
   # Check iptables (Linux)
   sudo iptables -L -n | grep DOCKER
   ```

---

## Postgres Issues

### Replication Slot Stuck

Electric requires logical replication. If stuck:

```bash
# Check slot status
docker compose exec postgres psql -U tmnl -c "
  SELECT slot_name, active, restart_lsn
  FROM pg_replication_slots;
"

# If inactive and blocking WAL
docker compose exec postgres psql -U tmnl -c "
  SELECT pg_drop_replication_slot('electric_slot');
"

# Restart Electric to recreate slot
docker compose restart electric
```

### Init Scripts Not Running

Init scripts only run on first volume creation:

```bash
# Force reinit (DATA LOSS!)
docker compose down -v
docker compose up -d postgres

# Or run manually
docker compose exec postgres psql -U tmnl -f /docker-entrypoint-initdb.d/01-extensions.sql
```

### Connection Pool Exhausted

```bash
# Check connections
docker compose exec postgres psql -U tmnl -c "
  SELECT count(*), state FROM pg_stat_activity GROUP BY state;
"

# Kill idle connections
docker compose exec postgres psql -U tmnl -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle' AND query_start < now() - interval '10 minutes';
"
```

---

## Electric Issues

### Shape Sync Slow

1. Check Postgres query performance:
   ```bash
   docker compose exec postgres psql -U tmnl -c "
     EXPLAIN ANALYZE SELECT * FROM entities WHERE type='flight';
   "
   ```

2. Add index if missing:
   ```bash
   docker compose exec postgres psql -U tmnl -c "
     CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
   "
   ```

3. Use more selective shape where clause

### Electric Can't Connect

```bash
# Check Electric logs
docker compose logs electric | grep -i error

# Verify Postgres settings
docker compose exec postgres psql -U tmnl -c "SHOW wal_level;"
# Should be 'logical'

# Check DATABASE_URL
docker compose config | grep DATABASE_URL
```

---

## Search Cluster Issues

### Coordinator Not Finding Sources

```bash
# Check sources are running
docker compose ps search-cluster-sources

# Check coordinator logs
docker compose logs search-cluster-coordinator | grep -i "connect\|source"

# Test network
docker compose exec search-cluster-coordinator ping search-cluster-sources
```

### Search Returns No Results

1. Check entities exist:
   ```bash
   docker compose exec postgres psql -U tmnl -c "SELECT COUNT(*) FROM entities;"
   ```

2. Check search index:
   ```bash
   docker compose logs search-cluster-sources | grep -i "index\|sync"
   ```

---

## Memory Issues

### Container OOM Killed

```bash
# Check memory usage
docker stats --no-stream

# Check OOM events
dmesg | grep -i oom

# Increase memory limits in compose
services:
  myservice:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Host Running Low

```bash
# Check Docker disk usage
docker system df

# Clean up
docker system prune -a --volumes  # ⚠️ Removes all unused data!

# Safer cleanup
docker image prune -a  # Remove unused images
docker container prune  # Remove stopped containers
```

---

## Quick Reference

| Problem | First Command |
|---------|---------------|
| Service won't start | `docker compose logs <service>` |
| Network issue | `docker compose exec <from> ping <to>` |
| Port conflict | `lsof -i :<port>` |
| Postgres issue | `docker compose exec postgres psql -U tmnl` |
| Reset everything | `docker compose down -v && docker compose up -d` |
| Check health | `/infra:status` |

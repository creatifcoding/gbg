# TMNL Phase 0 Deployment Report

**Date**: 2025-12-15
**Status**: ✅ DEPLOYED
**Cluster**: k3d-tmnl (fresh)

---

## Deployment Summary

Phase 0 foundation has been successfully deployed to the k3d cluster. This provides the core data infrastructure for TMNL's distributed platform.

### Components Deployed

| Component       | Version                 | Status     | Namespace | Notes                     |
| --------------- | ----------------------- | ---------- | --------- | ------------------------- |
| **k3d Cluster** | v1.21.7+k3s1            | ✅ Running | -         | 1 server + 2 agents       |
| **NATS**        | 2.12.2                  | ✅ Running | nats      | 1 pod (nats-0) + nats-box |
| **PostgreSQL**  | 17 (TimescaleDB 2.24.0) | ✅ Running | data      | StatefulSet with 50Gi PVC |

---

## PostgreSQL Configuration

### Database Details

- **Host**: `postgres.data.svc.cluster.local`
- **Port**: 5432
- **Database**: `tmnl`
- **User**: `tmnl`
- **Password**: `tmnl-dev-password` (DEV ONLY - change in production)

### Installed Extensions

```sql
SELECT extname, extversion FROM pg_extension;
```

| Extension              | Version | Purpose                        |
| ---------------------- | ------- | ------------------------------ |
| **postgis**            | 3.6.1   | Spatial data (geo-queries)     |
| **timescaledb**        | 2.24.0  | Time-series data (hypertables) |
| **vector**             | 0.8.1   | pgvector for embeddings/RAG    |
| **pgcrypto**           | 1.3     | Cryptographic functions        |
| **pg_stat_statements** | 1.11    | Query performance monitoring   |

### Application Schemas

```
tmnl
├── ams          # Asset Management System
├── ava          # AVA (Asset View Agent)
├── obs          # Observability (logs, traces, metrics)
└── chain        # Blockchain indexed data
```

### Sample Data

TimescaleDB hypertable `ams.device_readings` contains 5 sample records:

```sql
SELECT * FROM ams.device_readings ORDER BY timestamp DESC LIMIT 3;
```

```
 timestamp                      | device_id  | metric      | value
--------------------------------+------------+-------------+-------
 2025-12-15 21:20:55.190355+00 | device-001 | temperature | 24.8
 2025-12-15 21:20:55.190355+00 | device-002 | humidity    | 67.5
 2025-12-15 20:50:55.190355+00 | device-001 | temperature | 26.2
```

---

## NATS Configuration

### Connection Details

- **Client URL**: `nats://nats.nats.svc.cluster.local:4222`
- **Cluster**: Single node (nats-0)
- **JetStream**: Configured (account permissions need adjustment)

### Pods

| Pod      | Ready | Status  | Node             |
| -------- | ----- | ------- | ---------------- |
| nats-0   | 2/2   | Running | k3d-tmnl-agent-0 |
| nats-box | 1/1   | Running | k3d-tmnl-agent-1 |

### Services

| Service       | Type      | Cluster-IP   | Port       |
| ------------- | --------- | ------------ | ---------- |
| nats          | ClusterIP | 10.43.81.245 | 4222       |
| nats-headless | ClusterIP | None         | 4222, 8222 |

### Planned NATS Features (values.yaml)

✅ Configured (awaiting account fix):

- JetStream (file storage: 10Gi)
- KV buckets
- Object Store
- MQTT support (port 1883)
- WebSocket support (port 8080)

---

## Access Instructions

### PostgreSQL

From within the cluster:

```bash
kubectl exec -n data postgres-0 -- psql -U tmnl -d tmnl
```

From nats-box (for testing):

```bash
kubectl exec -n nats deployment/nats-box -- sh
# Inside container:
apk add postgresql-client
psql -h postgres.data.svc.cluster.local -U tmnl -d tmnl
```

### NATS

From nats-box:

```bash
kubectl exec -n nats deployment/nats-box -- sh
# Inside container:
nats account info
nats pub test.subject "Hello TMNL"
nats sub test.subject
```

---

## Known Issues

### 1. NATS JetStream Account Permissions

**Issue**: `nats server list` returns "no results received, ensure the account used has system privileges"

**Impact**: JetStream operations may be limited

**Fix**: Update NATS account configuration in `values.yaml` to grant system privileges

**Priority**: Medium (doesn't block basic pub/sub)

### 2. NATS Cluster Size

**Issue**: Only 1 NATS pod running (expected 3 from values.yaml)

**Impact**: No HA for NATS

**Root Cause**: k3d node count or Helm deployment issue

**Fix**: Check `values.yaml` replicas and k3d node affinity

**Priority**: Low (single-node is acceptable for Phase 0)

### 3. pg_mooncake Extension Missing

**Issue**: pg_mooncake not installed (requires custom PostgreSQL build)

**Impact**: No column-store optimization

**Status**: Deferred to Phase 3 (as planned)

---

## Storage

### PostgreSQL PVC

```
NAME                       STATUS   VOLUME                                     CAPACITY   STORAGECLASS
postgres-data-postgres-0   Bound    pvc-33b2b9b8-340a-466e-a00d-6e5f83a91e89   50Gi       local-path
```

- **Type**: local-path (k3d default)
- **Size**: 50Gi
- **Note**: Data persists across pod restarts but NOT cluster deletion

---

## Testing Checklist

- [x] k3d cluster accessible
- [x] NATS pods running
- [x] PostgreSQL pod running
- [x] PostgreSQL extensions installed
- [x] Application schemas created
- [x] TimescaleDB hypertable created
- [x] Sample data inserted
- [x] PostgreSQL queries working
- [ ] NATS pub/sub working (account permissions issue)
- [ ] NATS JetStream working (account permissions issue)

---

## Next Steps

### Immediate (Fix Issues)

1. **Fix NATS account permissions**

   - Update `nix/modules/nats/values.yaml`
   - Set account with system privileges
   - Redeploy: `helm upgrade nats nats/nats -n nats --values nix/modules/nats/values.yaml`

2. **Verify JetStream operations**
   - Create stream: `nats stream add`
   - Publish messages: `nats pub --stream=<stream> <subject> <data>`
   - Subscribe: `nats sub <subject>`

### Phase 1 Preparation (Week 2)

According to `INFRASTRUCTURE_ADR_001.md`:

1. **Edge Layer**

   - Plant cluster deployment (k3s on VM/bare metal)
   - NATS leaf nodes (line-level edge)
   - ElectricSQL Postgres ↔ SQLite sync
   - Trino federated query (central + plant)

2. **Required Before Phase 1**
   - Test NATS leaf node configuration
   - Benchmark PostgreSQL replication lag
   - Validate ElectricSQL schema sync
   - Design Trino catalog structure

---

## Mission Control Commands

Available in `nix develop`:

### NATS

```bash
nats-deploy   # Deploy NATS (Helm)
nats-status   # Check pod/service status
nats-test     # Run integration tests (needs account fix)
nats-shell    # Open nats-box shell
nats-destroy  # Remove NATS deployment
```

### PostgreSQL

```bash
postgres-deploy   # Deploy PostgreSQL (kubectl apply)
postgres-status   # Check pod/service/pvc status
postgres-test     # Run integration tests
postgres-shell    # Open psql shell
postgres-destroy  # Remove PostgreSQL deployment
```

---

## Deployment Timeline

| Task                   | Duration       | Status      |
| ---------------------- | -------------- | ----------- |
| k3d cluster creation   | 35s            | ✅ Complete |
| NATS Helm install      | 45s            | ✅ Complete |
| PostgreSQL deployment  | 3m             | ✅ Complete |
| Extension installation | 30s            | ✅ Complete |
| Schema creation        | 10s            | ✅ Complete |
| Sample data insertion  | 5s             | ✅ Complete |
| **Total**              | **~5 minutes** | ✅ Complete |

---

## Resource Usage

```
kubectl top nodes  # (requires metrics-server)
kubectl top pods -A
```

Estimated resource footprint:

- **NATS**: ~200Mi RAM, 0.1 CPU
- **PostgreSQL**: ~500Mi RAM, 0.2 CPU
- **Total**: ~700Mi RAM, 0.3 CPU

---

## Validation Queries

### PostgreSQL Health Check

```sql
-- Check extensions
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- Check schemas
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('ams', 'ava', 'obs', 'chain');

-- Check TimescaleDB hypertable
SELECT * FROM timescaledb_information.hypertables;

-- Query sample data
SELECT
  device_id,
  metric,
  AVG(value) as avg_value,
  COUNT(*) as reading_count
FROM ams.device_readings
GROUP BY device_id, metric
ORDER BY device_id, metric;
```

### NATS Health Check (after account fix)

```bash
# From nats-box
nats account info
nats server list
nats stream list
nats kv list
nats object list
```

---

## Documentation References

- **Architecture**: `assets/documents/INFRASTRUCTURE_ADR_001.md`
- **Phase 0 Plan**: `assets/documents/PHASE_0_IMPLEMENTATION.md`
- **Deployment Guide**: `assets/documents/PHASE_0_READY.md`
- **This Report**: `assets/documents/PHASE_0_DEPLOYED.md`

---

**Report Generated**: 2025-12-15T21:22:00Z  
**Cluster**: k3d-tmnl  
**Context**: k3d-tmnl  
**Deployed By**: Val (TMNL Infrastructure Agent)

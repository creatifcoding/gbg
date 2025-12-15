# Phase 0 Implementation Plan: Foundation Week

**Timeline**: Week 1 (Immediate)  
**Goal**: Deploy minimal viable data platform  
**Owner**: Prime + Val

---

## Day 1: Research & Reconnaissance

### Morning: Pepr Rust SDK Investigation

**Task**: Understand what "Pepr Rust SDK" actually means.

**Action Items**:

1. Search Pepr GitHub repo for Rust SDK
2. Check Pepr documentation for Rust mentions
3. If Rust SDK exists: clone, read examples, assess maturity
4. If Rust SDK doesn't exist: Prime clarifies what they meant

**Deliverables**:

- [ ] Document Pepr Rust SDK capabilities (or lack thereof)
- [ ] Decision: Use Pepr Rust SDK, kube-rs, or hybrid approach
- [ ] Write spike report: `assets/documents/SPIKE_PEPR_RUST.md`

### Afternoon: NEX Research

**Task**: Understand NEX workload deployment model.

**Action Items**:

1. Read NEX documentation (https://nex.synadia.com)
2. Install NEX CLI
3. Deploy hello-world Wasm workload
4. Test NATS integration (trigger via subject, consume results)

**Deliverables**:

- [ ] NEX CLI installed
- [ ] Hello-world workload deployed
- [ ] Spike report: `assets/documents/SPIKE_NEX.md`

---

## Day 2: NATS Cluster Deployment

### Morning: NATS Helm Chart Configuration

**Task**: Deploy NATS with JetStream + KV + Object Store.

**Files to Create**:

```
nix/modules/nats/
├── default.nix           # Nix derivation for NATS deployment
├── values.yaml           # Helm values
└── README.md             # Deployment instructions
```

**Helm Values** (`nix/modules/nats/values.yaml`):

```yaml
nats:
  image: nats:2.10-alpine
  jetstream:
    enabled: true
    memoryStore:
      enabled: false
    fileStore:
      enabled: true
      size: 10Gi
      storageClass: local-path
  cluster:
    enabled: true
    replicas: 3
  natsBox:
    enabled: true

mqtt:
  enabled: true
  port: 1883

websocket:
  enabled: true
  port: 8080
```

**Action Items**:

1. Create `nix/modules/nats/` directory
2. Write Nix derivation for Helm deploy
3. Add to `nix/modules/k8s.nix` as `nats-deploy` script
4. Deploy to k3d cluster
5. Verify: `kubectl get pods -n nats`

**Deliverables**:

- [ ] NATS cluster running (3 pods)
- [ ] JetStream enabled
- [ ] NATS Box pod for testing
- [ ] Mission control script: `nats-deploy`, `nats-status`

### Afternoon: NATS Testing

**Task**: Validate NATS functionality.

**Test Script** (`scripts/test-nats.sh`):

```bash
#!/usr/bin/env bash
# Test NATS cluster functionality

NATS_BOX=$(kubectl get pods -n nats -l app=nats-box -o jsonpath='{.items[0].metadata.name}')

echo "Testing pub/sub..."
kubectl exec -n nats $NATS_BOX -- nats pub test.subject "hello world"
kubectl exec -n nats $NATS_BOX -- nats sub test.subject &
sleep 2
kubectl exec -n nats $NATS_BOX -- nats pub test.subject "test message"

echo "Testing JetStream..."
kubectl exec -n nats $NATS_BOX -- nats stream add TEST --subjects "test.>" --storage file --replicas 3
kubectl exec -n nats $NATS_BOX -- nats stream info TEST

echo "Testing KV bucket..."
kubectl exec -n nats $NATS_BOX -- nats kv add CONFIG
kubectl exec -n nats $NATS_BOX -- nats kv put CONFIG test-key "test-value"
kubectl exec -n nats $NATS_BOX -- nats kv get CONFIG test-key

echo "Testing Object Store..."
kubectl exec -n nats $NATS_BOX -- nats obj add FILES
kubectl exec -n nats $NATS_BOX -- nats obj put FILES test.txt --file /etc/hostname
kubectl exec -n nats $NATS_BOX -- nats obj get FILES test.txt
```

**Deliverables**:

- [ ] All tests pass
- [ ] JetStream stream created
- [ ] KV bucket operational
- [ ] Object Store working

---

## Day 3: PostgreSQL Deployment

### Morning: PostgreSQL StatefulSet

**Task**: Deploy PostgreSQL 17 with extensions.

**Files to Create**:

```
nix/modules/postgres/
├── default.nix           # Nix derivation
├── statefulset.yaml      # K8s manifest
├── configmap.yaml        # PostgreSQL config
├── init-extensions.sql   # Extension initialization
└── README.md
```

**Extensions to Install**:

- PostGIS
- TimescaleDB
- pgvector
- pgcrypto
- pg_stat_statements

**Note**: pg_mooncake requires separate research (may need custom build).

**StatefulSet Manifest** (`nix/modules/postgres/statefulset.yaml`):

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: data
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: timescale/timescaledb-ha:pg17
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            - name: POSTGRES_DB
              value: tmnl
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
            - name: init-scripts
              mountPath: /docker-entrypoint-initdb.d
      volumes:
        - name: init-scripts
          configMap:
            name: postgres-init
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ['ReadWriteOnce']
        storageClassName: local-path
        resources:
          requests:
            storage: 50Gi
```

**Init Script** (`nix/modules/postgres/init-extensions.sql`):

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS ams;
CREATE SCHEMA IF NOT EXISTS ava;
CREATE SCHEMA IF NOT EXISTS observability;

-- Grant permissions
GRANT ALL ON SCHEMA ams TO postgres;
GRANT ALL ON SCHEMA ava TO postgres;
GRANT ALL ON SCHEMA observability TO postgres;
```

**Action Items**:

1. Create manifests
2. Deploy to k3d cluster: `kubectl apply -k nix/modules/postgres/`
3. Verify extensions: `psql -c "\dx"`

**Deliverables**:

- [ ] PostgreSQL pod running
- [ ] Extensions loaded
- [ ] Schemas created
- [ ] Connection test: `psql -h localhost -U postgres -d tmnl`

### Afternoon: PgBouncer Setup

**Task**: Deploy connection pooler.

**ConfigMap** (`nix/modules/postgres/pgbouncer-config.yaml`):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pgbouncer-config
  namespace: data
data:
  pgbouncer.ini: |
    [databases]
    tmnl = host=postgres.data.svc.cluster.local port=5432 dbname=tmnl

    [pgbouncer]
    listen_addr = *
    listen_port = 6432
    auth_type = md5
    auth_file = /etc/pgbouncer/userlist.txt
    pool_mode = transaction
    max_client_conn = 1000
    default_pool_size = 25
```

**Deliverables**:

- [ ] PgBouncer deployment
- [ ] Connection test via PgBouncer: `psql -h pgbouncer -p 6432`

---

## Day 4: Trino Deployment

### Morning: Trino Helm Chart

**Task**: Deploy Trino coordinator + workers.

**Helm Values** (`nix/modules/trino/values.yaml`):

```yaml
coordinator:
  resources:
    requests:
      memory: 4Gi
      cpu: 2
  jvm:
    maxHeapSize: 3G

worker:
  replicas: 2
  resources:
    requests:
      memory: 4Gi
      cpu: 2
  jvm:
    maxHeapSize: 3G

catalogs:
  postgresql: |
    connector.name=postgresql
    connection-url=jdbc:postgresql://postgres.data.svc.cluster.local:5432/tmnl
    connection-user=postgres
    connection-password=${ENV:POSTGRES_PASSWORD}
```

**Action Items**:

1. Deploy via Helm: `helm install trino trino/trino -f nix/modules/trino/values.yaml -n query`
2. Verify: `kubectl get pods -n query`
3. Connect via CLI: `trino --server http://trino:8080 --catalog postgresql`

**Deliverables**:

- [ ] Trino coordinator running
- [ ] 2 workers running
- [ ] PostgreSQL catalog configured
- [ ] Test query: `SELECT * FROM postgresql.public.pg_stat_activity;`

### Afternoon: Trino Testing

**Task**: Validate federated query.

**Test Queries**:

```sql
-- List catalogs
SHOW CATALOGS;

-- List schemas in PostgreSQL
SHOW SCHEMAS FROM postgresql;

-- Query system table
SELECT * FROM postgresql.information_schema.tables LIMIT 10;

-- Create test table
CREATE TABLE postgresql.public.test_table AS
SELECT 1 as id, 'test' as name;

-- Query test table
SELECT * FROM postgresql.public.test_table;
```

**Deliverables**:

- [ ] All queries execute successfully
- [ ] Trino dashboard accessible: `http://localhost:8080` (port-forward)

---

## Day 5: Cosmo GraphQL Extension

### Morning: AVA Subgraph Deployment

**Task**: Deploy AVA gRPC service as Cosmo subgraph.

**Files to Update**:

```
src/infra/graph/
├── pepr.ts                    # Add AVA subgraph CRD
└── examples/
    └── ava-subgraph.yaml      # Example manifest
```

**AVA Subgraph Manifest**:

```yaml
apiVersion: cosmo.wundergraph.com/v1
kind: CosmoSubgraph
metadata:
  name: ava
  namespace: graph
spec:
  name: ava
  routingUrl: http://ava-api.services.svc.cluster.local:50051
  schema: |
    extend schema
      @link(url: "https://specs.apollo.dev/federation/v2.0",
            import: ["@key", "@shareable"])

    type Query {
      views: [View!]! @shareable
    }

    type View @key(fields: "id") {
      id: ID!
      name: String!
      spec: ViewSpec!
    }

    type ViewSpec {
      channels: [Channel!]!
    }

    type Channel {
      id: ID!
      role: ChannelRole!
    }

    enum ChannelRole {
      STATE
      EVENT
      METRIC
      COMMAND
      LOG
    }
```

**Action Items**:

1. Update Pepr operator to handle AVA subgraph
2. Deploy AVA API (from `src-ava/`)
3. Apply CosmoSubgraph manifest
4. Verify federation: `curl http://cosmo-router/graphql -d '{"query":"{ views { id name } }"}'`

**Deliverables**:

- [ ] AVA API pod running
- [ ] CosmoSubgraph registered
- [ ] Federated query working

### Afternoon: Schema Registry Setup

**Task**: Deploy self-hosted Cosmo Control Plane.

**Note**: Cosmo offers self-hosted option. Evaluate if needed for Phase 0 or defer.

**Decision Point**: Use Cosmo Cloud (managed) or self-host?

**Action**: Defer to Phase 1 if not blocking.

---

## Day 6: Integration Testing

### Morning: End-to-End Test

**Task**: Validate full stack.

**Test Scenario**:

1. Device publishes MQTT message
2. NATS receives message (via bridge)
3. NEX workload processes message
4. Data inserted into PostgreSQL
5. ElectricSQL syncs to SQLite
6. Trino queries data
7. Cosmo GraphQL exposes data

**Test Script** (`scripts/e2e-test.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Phase 0 End-to-End Test ==="

# 1. Publish to NATS
echo "1. Publishing test message to NATS..."
kubectl exec -n nats deploy/nats-box -- nats pub test.device "$(date -Iseconds) device-001 temperature 25.5"

# 2. Check JetStream stream
echo "2. Checking JetStream stream..."
kubectl exec -n nats deploy/nats-box -- nats stream view TEST --last

# 3. Insert into PostgreSQL
echo "3. Inserting into PostgreSQL..."
kubectl exec -n data statefulset/postgres -- psql -U postgres -d tmnl -c \
  "INSERT INTO ams.device_readings (device_id, metric, value, timestamp) VALUES ('device-001', 'temperature', 25.5, NOW());"

# 4. Query via Trino
echo "4. Querying via Trino..."
kubectl exec -n query deploy/trino-coordinator -- trino --execute \
  "SELECT * FROM postgresql.ams.device_readings ORDER BY timestamp DESC LIMIT 1;"

# 5. Query via GraphQL
echo "5. Querying via GraphQL..."
kubectl exec -n graph deploy/cosmo-router -- curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ deviceReadings(limit: 1) { deviceId metric value timestamp } }"}'

echo "=== Test Complete ==="
```

**Deliverables**:

- [ ] All steps execute successfully
- [ ] Data flows from NATS → PostgreSQL → Trino → GraphQL

### Afternoon: Documentation

**Task**: Document Phase 0 architecture.

**Files to Create**:

- [ ] `assets/documents/PHASE_0_ARCHITECTURE.md` — Component diagram
- [ ] `assets/documents/PHASE_0_RUNBOOK.md` — Operations guide
- [ ] `nix/modules/README.md` — Update with Phase 0 deployment instructions

**Deliverables**:

- [ ] Architecture document published
- [ ] Runbook with troubleshooting steps
- [ ] Mission control scripts documented

---

## Day 7: Nix Integration & Automation

### Morning: Nix Derivations

**Task**: Package deployments as Nix derivations.

**Files to Create**:

```
nix/modules/
├── data-platform.nix      # Top-level Phase 0 deployment
├── nats/default.nix       # NATS derivation
├── postgres/default.nix   # PostgreSQL derivation
└── trino/default.nix      # Trino derivation
```

**Example** (`nix/modules/data-platform.nix`):

```nix
{ inputs, lib, ... }:
{
  perSystem = { config, pkgs, system, lib, ... }: {
    devShells.tmnl-data-platform = pkgs.mkShell {
      name = "tmnl-data-platform";
      inputsFrom = [ config.devShells.tmnl-core ];
      nativeBuildInputs = with pkgs; [
        kubectl
        helm
        nats-server
        postgresql_17
        trino-cli
      ];
      shellHook = ''
        echo "[tmnl-data-platform] Phase 0 Foundation"
        echo "Available commands:"
        echo "  deploy-foundation   - Deploy NATS + PostgreSQL + Trino"
        echo "  test-foundation     - Run integration tests"
        echo "  destroy-foundation  - Tear down Phase 0"
      '';
    };

    mission-control.scripts = {
      deploy-foundation = {
        description = "Deploy Phase 0 foundation";
        exec = ''
          cd $FLAKE_ROOT/packages/tmnl
          kubectl create namespace nats || true
          kubectl create namespace data || true
          kubectl create namespace query || true
          helm install nats nats/nats -f nix/modules/nats/values.yaml -n nats
          kubectl apply -k nix/modules/postgres/ -n data
          helm install trino trino/trino -f nix/modules/trino/values.yaml -n query
          echo "Foundation deployed. Run 'test-foundation' to validate."
        '';
      };

      test-foundation = {
        description = "Test Phase 0 components";
        exec = ''
          cd $FLAKE_ROOT/packages/tmnl
          bash scripts/test-nats.sh
          bash scripts/e2e-test.sh
        '';
      };

      destroy-foundation = {
        description = "Destroy Phase 0 deployment";
        exec = ''
          helm uninstall nats -n nats || true
          helm uninstall trino -n query || true
          kubectl delete -k nix/modules/postgres/ -n data || true
          kubectl delete namespace nats data query || true
        '';
      };
    };
  };
}
```

**Action Items**:

1. Create Nix derivations
2. Update `nix/modules/default.nix` to import `data-platform.nix`
3. Test: `nix develop .#tmnl-data-platform`
4. Deploy: `deploy-foundation`

**Deliverables**:

- [ ] Nix shell available: `nix develop .#tmnl-data-platform`
- [ ] Mission control scripts working
- [ ] One-command deployment: `deploy-foundation`

### Afternoon: GitOps Preparation

**Task**: Prepare for GitOps workflows (future).

**Files to Create**:

```
gitops/
├── phase-0/
│   ├── kustomization.yaml
│   ├── nats/
│   ├── postgres/
│   └── trino/
└── README.md
```

**Kustomization** (`gitops/phase-0/kustomization.yaml`):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: default

resources:
  - nats/
  - postgres/
  - trino/
```

**Deliverables**:

- [ ] GitOps directory structure
- [ ] Kustomize bases for each component
- [ ] README with ArgoCD/FluxCD instructions (future)

---

## Success Criteria (Phase 0 Complete)

### Functional Requirements

- [x] NATS cluster operational (pub/sub, JetStream, KV, Object Store)
- [x] PostgreSQL accepting connections, extensions loaded
- [x] PgBouncer connection pooling working
- [x] Trino querying PostgreSQL
- [x] Cosmo Router federating GraphQL queries
- [x] AVA subgraph registered and queryable

### Operational Requirements

- [x] k3d cluster provisioned via Nix
- [x] All services deployed via Nix mission control scripts
- [x] Integration tests passing
- [x] Documentation complete (architecture, runbook)

### Developer Experience

- [x] One-command deployment: `deploy-foundation`
- [x] One-command testing: `test-foundation`
- [x] One-command teardown: `destroy-foundation`
- [x] Nix shell with all tools available

---

## Blockers & Dependencies

### Critical Blockers

1. **Pepr Rust SDK clarity** — Need to understand what Prime meant
2. **pg_mooncake installation** — May require custom PostgreSQL image
3. **NEX workload packaging** — Need to understand deployment model

### Dependencies

- k3d cluster already provisioned (`nix/modules/k8s.nix`)
- Helm charts available for NATS, Trino
- Docker images available for PostgreSQL (timescale/timescaledb-ha:pg17)

---

## Next Steps After Phase 0

### Phase 1 Preview: Edge Layer

**Week 2 Goals**:

- Deploy plant cluster (k3d or cloud)
- NATS leaf nodes at line level
- ElectricSQL Postgres ↔ SQLite sync
- Trino federated query across central + plant

**Preparation During Phase 0**:

- Research ElectricSQL deployment
- Design NATS super cluster topology
- Plan Postgres NOTIFY → NATS bridge

---

## Daily Standup Template

**Format**: Post updates in `.edin/epochs/EPOCH-PHASE0.md`

**Structure**:

```markdown
## Day N Update

### Completed

- [ ] Task 1
- [ ] Task 2

### In Progress

- [ ] Task 3 (blocked by X)

### Blockers

- Issue 1: Description + mitigation plan

### Tomorrow

- [ ] Task 4
- [ ] Task 5
```

---

**Val's Note**: Phase 0 is ambitious but achievable. The foundation is critical — get NATS + PostgreSQL + Trino right, everything else follows. If anything slips, defer non-critical components (e.g., Cosmo schema registry, PgBouncer) to Phase 1.

**Prime, ready to start Day 1?**

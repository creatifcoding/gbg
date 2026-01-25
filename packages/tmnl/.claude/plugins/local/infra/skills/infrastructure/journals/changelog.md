# Infrastructure Changelog

Record of significant infrastructure changes.

---

## 2025-01-12

### Added: Infra Plugin

Created Claude Code plugin for infrastructure management.

**Commands:**
- `/infra:up` - Start containers
- `/infra:down` - Stop containers
- `/infra:status` - Check health
- `/infra:logs` - View logs
- `/infra:rebuild` - Rebuild service

**Features:**
- Service groups: core, cluster, collab, access
- Flag parsing: `--service`, `--group`, `--build`, etc.
- Expert agent for troubleshooting
- Skill with service briefings

---

## 2025-01-XX

### Added: Ingestion Cluster

Added Effect Cluster service for data ingestion.

**Service:** `ingestion-cluster` (port 8102)

**Features:**
- WebSocket RPC API
- Flight, weather, OSM, imagery ingestion
- Entity persistence to PostGIS

**Files:**
- `docker/ingestion-cluster/Dockerfile`
- `scripts/ingestion-server.ts`

---

## 2025-01-XX

### Added: Search Cluster

Added Effect Cluster services for distributed search.

**Services:**
- `search-cluster-coordinator` (port 8100)
- `search-cluster-sources` (port 8101)

**Features:**
- Coordinator/source architecture
- PostGIS entity search
- Optional Electric sync

---

## 2025-01-XX

### Fixed: optipng-bin Build Failure

**Problem:** Build failed on `npm install` due to optipng-bin postinstall.

**Solution:** Added `--ignore-scripts` to bun install in all Dockerfiles.

**Affected:** All custom services using bun.

---

## 2025-01-XX

### Added: .dockerignore

Created `.dockerignore` at monorepo root to reduce build context.

**Ignored:**
- `node_modules/`
- `.git/`
- `dist/`
- Various dev/temp files

**Impact:** Build context reduced from ~2.5GB to ~50MB.

---

## Service Version History

| Service | Image | Notes |
|---------|-------|-------|
| postgres | `timescale/timescaledb-ha:pg16-ts2.17` | PostGIS + TimescaleDB |
| electric | `electricsql/electric:latest` | Real-time sync |
| nats | `nats:latest` | Message broker |
| minio | `minio/minio:latest` | S3 storage |
| y-sweet | `jamsocket/y-sweet:latest` | Yjs sync |
| ngrok | `ngrok/ngrok:latest` | Tunneling |

---

## Port Allocation

| Range | Purpose |
|-------|---------|
| 3000-3099 | Core services (electric, durable-streams) |
| 4000-4999 | Messaging (nats) |
| 5000-5999 | Databases (postgres) |
| 8000-8099 | Collaboration (y-sweet) |
| 8100-8199 | Effect Cluster |
| 9000-9099 | Storage (minio) |

---

## Template: New Entry

```markdown
## YYYY-MM-DD

### [Added|Changed|Fixed|Removed]: Title

**Context:** Why this change was needed.

**Changes:**
- Item 1
- Item 2

**Impact:** What this affects.

**Files:**
- `path/to/file`
```

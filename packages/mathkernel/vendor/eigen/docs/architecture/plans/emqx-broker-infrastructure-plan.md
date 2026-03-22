# Feature Plan: EMQX MQTT Broker Infrastructure

Created: 2026-02-07
Updated: 2026-02-07 (Prime decisions applied)
Author: architect-agent (Val)
Scope: Phase 5 — Stream Processing & Ingestion Pipeline (Epic 19)
Dependencies: docker-compose.iiot.yml, nix/modules/, IngestionAdapter interface

---

## Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **EMQX version** | **5.8** (latest) | Best Sparkplug B support, MQTT 5.0 features |
| **Deployment** | **Docker Compose only** | No k8s for now; stay in Docker world |
| **EMQX→NATS bridge** | **YES — separate epic** | Forward select MQTT topics to NATS JetStream; will be a Layer 2 service in its own epic |
| **Auth backend (prod)** | **PostgreSQL + JWT** | PostgreSQL auth plugin for device credentials, JWT for service-to-service |

---

## Overview

EMQX is a purpose-built MQTT 5.0 broker that serves as the industrial device communication layer for the IIoT ingestion pipeline. It handles MQTT connections from Sparkplug B edge nodes, raw MQTT sensors, and OPC-UA PubSub (MQTT transport). EMQX **coexists** with NATS — NATS remains the internal backbone (JetStream KV, event streaming, cluster coordination) while EMQX owns the MQTT protocol boundary.

This plan covers: Docker Compose service, Nix module, EMQX configuration, topic ACLs, TLS, health check integration, testing infrastructure, and the bridge to the existing `IngestionAdapter` interface.

**Multi-Group Sparkplug B**: The system supports multiple `group_id` values (enterprises) simultaneously. The SparkplugAdapter subscribes to `spBv1.0/+/DDATA/#` (wildcard on group) to ingest telemetry from all groups. TopicRouter resolves per-group routes.

**STATE Message Handling**: The Sparkplug B STATE topic (`STATE/{scada_host_id}`) is used by Primary Applications to declare liveness. EMQX must support retained messages on STATE topics so that edge nodes can detect primary host availability on connect. STATE handling will be part of the SparkplugAdapter implementation.

---

## Requirements

- [ ] EMQX 5.8 running in Docker Compose (local dev)
- [ ] MQTT 3.1.1 and 5.0 protocol support
- [ ] Multi-group Sparkplug B topic namespace (`spBv1.0/+/+/#` — wildcard on group_id)
- [ ] STATE message handling (`STATE/{scada_host_id}` with retained flag)
- [ ] ISA-95 topic hierarchy for UNS (Unified Namespace)
- [ ] Authentication: anonymous for dev, PostgreSQL + JWT for production
- [ ] Topic-based ACLs (per-device publish/subscribe permissions)
- [ ] TLS (self-signed for dev, CA-signed for prod)
- [ ] Dashboard (EMQX built-in) on port 18083
- [ ] Prometheus metrics endpoint
- [ ] Health check endpoint compatible with `IngestionHealth` schema
- [ ] Nix module with mission-control scripts
- [ ] MQTT test tooling (mosquitto_pub/sub)
- [ ] Future: EMQX→NATS JetStream bridge (separate epic, L2 service)

---

## Design

### Architecture

```
Industrial Devices / Edge Nodes (multiple groups/enterprises)
│
├── Sparkplug B Edge Nodes ──┐    group_id = "acme", "contoso", "fabrikam"
│   (DDATA/DBIRTH/DDEATH)    │    (multi-group support)
│                            │
├── Raw MQTT Sensors ────────┼──▶ EMQX Broker (port 1883/8883)
│   (JSON payloads)          │       │
│                            │       ├── Dashboard (port 18083)
├── OPC-UA PubSub ───────────┘       ├── Prometheus (/api/v5/prometheus/stats)
│   (MQTT transport)                 ├── Health (/api/v5/status)
│                                    │
│   STATE/{scada_host_id} ──────────▶│  (retained, Primary Application liveness)
│                                    │
│                                    ▼
│                            SparkplugAdapter / MqttAdapter
│                            (mqtt.js client connects to EMQX)
│                            Subscribes: spBv1.0/+/DDATA/#  (all groups)
│                                        spBv1.0/+/DBIRTH/# (device registration)
│                                        STATE/#             (host awareness)
│                                    │
│                                    ▼
│                            IngestionAdapter.subscribe()
│                            → Stream<IngestedReading>
│                                    │
│                                    ▼
│                            IngestionService pipeline
│                            (TopicRouter → BatchProcessor → AlarmDetector)
│                                    │
│                                    ▼
│                            TimescaleDB + EventLog
│
│
│   ┌─────────────────────────────────────────────────┐
│   │  FUTURE EPIC: EMQX → NATS Bridge (L2 Service)  │
│   │                                                  │
│   │  EMQX ──(select topics)──▶ NATS JetStream       │
│   │  - Telemetry summaries → JetStream streams      │
│   │  - Alarm events → NATS subjects                 │
│   │  - Device birth/death → NATS KV                 │
│   │                                                  │
│   │  Implementation: Effect L2 service with          │
│   │  mqtt.js subscriber → NATS publisher             │
│   └─────────────────────────────────────────────────┘
│
│
NATS (unchanged) ────────── Internal backbone
│                           JetStream KV, event streams
│                           cluster coordination, WebSocket
```

### NATS-EMQX Coexistence Strategy

| Concern | NATS | EMQX |
|---------|------|------|
| **Role** | Internal message bus | External MQTT broker |
| **Protocol** | NATS protocol + WebSocket | MQTT 3.1.1/5.0 |
| **Clients** | Application services, browser | Industrial devices, edge nodes |
| **Persistence** | JetStream (file store) | Session persistence, retained messages |
| **Use cases** | KV store, event streaming, cluster | Device telemetry, Sparkplug B, alarms |
| **Ports** | 4222 (TCP), 9222 (WS), 8222 (mon) | 1883 (MQTT), 8883 (MQTTS), 18083 (dash) |
| **Bridge** | Receives from EMQX bridge (future) | Source of truth for MQTT data |

**Decision: COEXIST.** NATS's MQTT support is a bridge, not a native implementation. It lacks:
- MQTT session persistence (clean/persistent sessions)
- Retained messages (critical for Sparkplug B NBIRTH/DBIRTH and STATE)
- Will messages (critical for Sparkplug B NDEATH/DDEATH)
- MQTT 5.0 features (topic aliases, flow control, user properties)
- Sparkplug B awareness (STATE topic monitoring)

EMQX is purpose-built for these requirements. The existing NATS `mqtt.enabled: true` in the Helm values can be disabled once EMQX is deployed.

**EMQX→NATS Bridge**: Confirmed as a future epic. An Effect Layer 2 service will subscribe to select EMQX topics and forward relevant data to NATS JetStream streams. This decouples the MQTT boundary from internal consumers.

### Data Flow

1. Device publishes MQTT message to EMQX (e.g., `spBv1.0/acme/DDATA/site-a/motor-01`)
2. EMQX authenticates, applies ACL, routes to subscriber
3. SparkplugAdapter (mqtt.js client) subscribes to `spBv1.0/+/DDATA/#` (all groups)
4. Adapter decodes Sparkplug B protobuf → emits `IngestedReading` via `Stream.asyncPush`
5. Pipeline routes, batches, checks thresholds, persists to TimescaleDB
6. (Future) Bridge service forwards select data to NATS JetStream

### Multi-Group Sparkplug B

The system must handle multiple Sparkplug B groups (enterprises) simultaneously:

```
spBv1.0/acme/DDATA/plant-a.area-1.line-1/motor-01        # Enterprise: acme
spBv1.0/contoso/DDATA/plant-b.area-2.line-3/pump-07      # Enterprise: contoso
spBv1.0/fabrikam/DDATA/site-x.zone-1.cell-2/sensor-12    # Enterprise: fabrikam
```

The SparkplugAdapter subscribes with `spBv1.0/+/DDATA/#` where `+` is the wildcard for group_id. The TopicRouter resolves routes per-group using glob patterns:

```typescript
// Routes for multiple groups
const routes: TopicRoute[] = [
  { topicPattern: 'spBv1.0/acme/DDATA/*', deviceId: 'acme-device-*' },
  { topicPattern: 'spBv1.0/contoso/DDATA/*', deviceId: 'contoso-device-*' },
]
```

### STATE Message Handling

The Sparkplug B STATE topic is used by Primary Applications (SCADA hosts) to declare their online/offline status:

```
STATE/scada-primary → ONLINE  (retained, QoS 1)
STATE/scada-primary → OFFLINE (will message, retained)
```

Edge nodes subscribe to `STATE/#` to detect when the primary application goes offline. When STATE=OFFLINE, edge nodes re-publish NBIRTH/DBIRTH to re-register with the new primary.

**EMQX requirements for STATE**:
- Retained messages must be enabled (confirmed in emqx.conf)
- Will messages must be supported (native MQTT feature)
- STATE topic must be in ACL rules (documented)

The SparkplugAdapter will also subscribe to `STATE/#` and emit state-change events through the pipeline.

---

## Dependencies

| Dependency | Type | Reason |
|------------|------|--------|
| Docker Compose | Infrastructure | Container orchestration for local dev |
| EMQX 5.8 | External (Docker image) | MQTT broker (`emqx/emqx:5.8`) |
| NATS (existing) | Internal | Remains unchanged as internal bus |
| mosquitto-clients | Dev tool (Nix) | MQTT testing (mosquitto_pub/sub) |
| IngestionAdapter | Internal interface | Adapter connects to EMQX via mqtt.js |
| TimescaleDB (existing) | Internal | Persistence target |
| PostgreSQL (existing) | Internal | Auth backend for production (future) |

---

## Implementation Phases

### Phase 1: Docker Compose Service

**Files to create:**
- `docker/emqx/emqx.conf` — EMQX configuration file
- `docker/emqx/acl.conf` — ACL rules

**Add to `docker/docker-compose.iiot.yml`:**

```yaml
  # ===========================================================================
  # EMQX - MQTT 5.0 Broker for IIoT Device Communication
  # ===========================================================================
  emqx:
    image: emqx/emqx:5.8
    container_name: tmnl_emqx
    ports:
      - '1883:1883'    # MQTT TCP
      - '8883:8883'    # MQTT TLS
      - '8083:8083'    # MQTT WebSocket
      - '8084:8084'    # MQTT WebSocket TLS
      - '18083:18083'  # EMQX Dashboard
    volumes:
      - emqx-data:/opt/emqx/data
      - emqx-log:/opt/emqx/log
      - ./emqx/emqx.conf:/opt/emqx/etc/emqx.conf:ro
      - ./emqx/acl.conf:/opt/emqx/etc/acl.conf:ro
    environment:
      # Node name
      EMQX_NODE_NAME: 'emqx@emqx'
      # Dashboard admin credentials (dev only)
      EMQX_DASHBOARD__DEFAULT_USERNAME: 'admin'
      EMQX_DASHBOARD__DEFAULT_PASSWORD: 'tmnl_dev_2026'
      # Allow anonymous connections in dev (NEVER in production)
      EMQX_ALLOW_ANONYMOUS: 'true'
      # Prometheus metrics
      EMQX_PROMETHEUS__PUSH_GATEWAY__ENABLE: 'false'
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'emqx', 'ctl', 'status']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - iiot

# Add to existing volumes:
  emqx-data:
    driver: local
  emqx-log:
    driver: local
```

**Acceptance:**
- [ ] `docker compose -f docker/docker-compose.iiot.yml up -d` starts EMQX
- [ ] Dashboard accessible at http://localhost:18083
- [ ] MQTT connections accepted on port 1883
- [ ] Health check passes (`emqx ctl status`)

**Estimated effort:** Small

---

### Phase 2: EMQX Configuration

**File to create:** `docker/emqx/emqx.conf`

```hocon
## =============================================================================
## EMQX Configuration for TMNL IIoT
## Version: 5.8
## =============================================================================

## Listeners
listeners.tcp.default {
  bind = "0.0.0.0:1883"
  max_connections = 10000
  ## Sparkplug B payloads can be large (protobuf with many metrics)
  max_packet_size = "1MB"
}

listeners.ssl.default {
  bind = "0.0.0.0:8883"
  max_connections = 10000
  max_packet_size = "1MB"
  ssl_options {
    certfile = "/opt/emqx/etc/certs/cert.pem"
    keyfile = "/opt/emqx/etc/certs/key.pem"
    cacertfile = "/opt/emqx/etc/certs/ca.pem"
    verify = verify_none  ## verify_peer for production
  }
}

listeners.ws.default {
  bind = "0.0.0.0:8083"
  max_connections = 5000
}

listeners.wss.default {
  bind = "0.0.0.0:8084"
  max_connections = 5000
  ssl_options {
    certfile = "/opt/emqx/etc/certs/cert.pem"
    keyfile = "/opt/emqx/etc/certs/key.pem"
  }
}

## MQTT Protocol Settings
mqtt {
  ## Allow MQTT 5.0 features
  max_topic_levels = 10
  max_qos_allowed = 2
  max_topic_alias = 65535
  retain_available = true  ## Critical for Sparkplug B BIRTH + STATE messages
  wildcard_subscription = true
  shared_subscription = true

  ## Session persistence
  max_inflight = 32
  max_awaiting_rel = 100
  await_rel_timeout = "300s"

  ## Keep alive
  keepalive_multiplier = 1.5
  server_keepalive = 0  ## Use client's keep-alive
}

## Session Persistence
session {
  ## Session expiry for persistent sessions
  max_sessions = 100000
  message_queue_max = 1000
}

## Retained Messages (Sparkplug B BIRTH + STATE messages)
retainer {
  enable = true
  backend {
    type = built_in_database
    storage_type = disc  ## Persist across restarts
    max_retained_messages = 100000
  }
}

## Dashboard
dashboard {
  listeners.http {
    bind = "0.0.0.0:18083"
  }
}

## Prometheus Metrics
prometheus {
  enable = true
  ## Available at GET /api/v5/prometheus/stats
}

## Authentication (dev: anonymous allowed via env var)
## Production: PostgreSQL backend + JWT
## authentication = [
##   {
##     mechanism = password_based
##     backend = postgresql
##     server = "postgres:5432"
##     database = "tmnl"
##     username = "emqx_auth"
##     password = "${EMQX_PG_AUTH_PASSWORD}"
##     query = "SELECT password_hash FROM mqtt_users WHERE username = ${username}"
##     password_hash_algorithm {
##       name = bcrypt
##     }
##   },
##   {
##     mechanism = jwt
##     use_jwks = true
##     endpoint = "http://auth-service/.well-known/jwks.json"
##     verify_claims {
##       aud = "emqx"
##     }
##   }
## ]

## Logging
log.console {
  enable = true
  level = info
  formatter = text
}
```

**File to create:** `docker/emqx/acl.conf`

```hocon
## =============================================================================
## EMQX ACL Rules for IIoT Unified Namespace
## =============================================================================
##
## Sparkplug B Namespace (multi-group):
##   spBv1.0/{group_id}/NBIRTH/{edge_node_id}
##   spBv1.0/{group_id}/NDEATH/{edge_node_id}
##   spBv1.0/{group_id}/DBIRTH/{edge_node_id}/{device_id}
##   spBv1.0/{group_id}/DDEATH/{edge_node_id}/{device_id}
##   spBv1.0/{group_id}/DDATA/{edge_node_id}/{device_id}
##   spBv1.0/{group_id}/DCMD/{edge_node_id}/{device_id}
##   STATE/{scada_host_id}  (Primary Application state)
##
## Dev environment: allow all. Production restricts per-device.

## Allow all clients to publish/subscribe in dev
{allow, all}.

## Production ACL (PostgreSQL-backed, separate epic):
## - Edge nodes: publish own DDATA/DBIRTH/DDEATH, subscribe own DCMD/NCMD
## - Ingestion service: subscribe all DDATA/DBIRTH/DDEATH/NBIRTH/NDEATH
## - SCADA host: pubsub STATE, subscribe all spBv1.0
## - Bridge service: subscribe all spBv1.0, publish to bridge topics
```

**Acceptance:**
- [ ] EMQX starts with custom config
- [ ] MQTT 5.0 features enabled (retained, will messages)
- [ ] ACL rules loaded (permissive for dev)
- [ ] Prometheus metrics at `/api/v5/prometheus/stats`
- [ ] PostgreSQL + JWT auth config documented (commented out for dev)

**Estimated effort:** Small

---

### Phase 3: TLS Setup

**Files to create:**
- `docker/emqx/certs/generate-dev-certs.sh` — Self-signed cert generator
- `docker/emqx/certs/.gitignore` — Exclude generated certs

```bash
#!/usr/bin/env bash
# Generate self-signed TLS certificates for EMQX dev environment
# Usage: ./generate-dev-certs.sh [output-dir]

set -euo pipefail

OUT_DIR="${1:-$(dirname "$0")}"
DAYS=365
CN="tmnl-emqx-dev"

echo "[TLS] Generating self-signed certificates for EMQX dev..."
echo "  Output: $OUT_DIR"

# Generate CA key and certificate
openssl req -new -x509 -days "$DAYS" \
  -subj "/CN=TMNL-IIoT-Dev-CA" \
  -keyout "$OUT_DIR/ca.key" \
  -out "$OUT_DIR/ca.pem" \
  -nodes 2>/dev/null

# Generate server key
openssl genrsa -out "$OUT_DIR/key.pem" 2048 2>/dev/null

# Generate server CSR
openssl req -new \
  -subj "/CN=$CN" \
  -key "$OUT_DIR/key.pem" \
  -out "$OUT_DIR/server.csr" 2>/dev/null

# Sign server cert with CA
openssl x509 -req -days "$DAYS" \
  -in "$OUT_DIR/server.csr" \
  -CA "$OUT_DIR/ca.pem" \
  -CAkey "$OUT_DIR/ca.key" \
  -CAcreateserial \
  -out "$OUT_DIR/cert.pem" 2>/dev/null

# Clean up CSR
rm -f "$OUT_DIR/server.csr" "$OUT_DIR/ca.srl"

echo "[TLS] Certificates generated:"
echo "  CA:   $OUT_DIR/ca.pem"
echo "  Cert: $OUT_DIR/cert.pem"
echo "  Key:  $OUT_DIR/key.pem"
echo ""
echo "[TLS] For production, replace with CA-signed certificates."
```

**Acceptance:**
- [ ] `./generate-dev-certs.sh` creates ca.pem, cert.pem, key.pem
- [ ] EMQX accepts TLS connections on port 8883
- [ ] Certs NOT committed to git (`.gitignore` in place)

**Estimated effort:** Small

---

### Phase 4: Nix Module

**File to create:** `nix/modules/emqx/default.nix`

Follows the exact pattern of `nix/modules/nats/default.nix` — mission-control scripts for lifecycle management.

```nix
{ inputs, lib, ... }:
{
  perSystem = { config, pkgs, system, lib, ... }: {
    mission-control.scripts = {
      emqx-up = {
        description = "Start EMQX MQTT broker (docker compose)";
        category = "EMQX";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"

          echo "[EMQX] Starting MQTT broker..."
          docker compose -f docker/docker-compose.iiot.yml up -d emqx

          echo ""
          echo "[EMQX] Waiting for broker to be ready..."
          for i in $(seq 1 30); do
            if docker exec tmnl_emqx emqx ctl status 2>/dev/null | grep -q "is started"; then
              echo "[EMQX] Broker is ready!"
              echo ""
              echo "  MQTT:      mqtt://localhost:1883"
              echo "  MQTTS:     mqtts://localhost:8883"
              echo "  WebSocket: ws://localhost:8083/mqtt"
              echo "  Dashboard: http://localhost:18083 (admin / tmnl_dev_2026)"
              echo "  Metrics:   http://localhost:18083/api/v5/prometheus/stats"
              exit 0
            fi
            sleep 1
          done

          echo "[EMQX] Warning: broker may still be starting..."
        '';
      };

      emqx-down = {
        description = "Stop EMQX MQTT broker";
        category = "EMQX";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"
          echo "[EMQX] Stopping broker..."
          docker compose -f docker/docker-compose.iiot.yml stop emqx
          echo "[EMQX] Stopped"
        '';
      };

      emqx-status = {
        description = "Check EMQX broker status";
        category = "EMQX";
        exec = ''
          echo "[EMQX] Broker Status:"
          docker exec tmnl_emqx emqx ctl status 2>/dev/null || echo "  (not running)"
          echo ""
          echo "[EMQX] Connected Clients:"
          docker exec tmnl_emqx emqx ctl clients list 2>/dev/null | head -20 || echo "  (none)"
          echo ""
          echo "[EMQX] Topics:"
          docker exec tmnl_emqx emqx ctl topics list 2>/dev/null | head -20 || echo "  (none)"
          echo ""
          echo "[EMQX] Retained Messages:"
          docker exec tmnl_emqx emqx ctl retainer list 2>/dev/null | head -10 || echo "  (none)"
          echo ""
          echo "[EMQX] Metrics (summary):"
          docker exec tmnl_emqx emqx ctl metrics 2>/dev/null | grep -E "messages\.(received|sent|publish)" || echo "  (unavailable)"
        '';
      };

      emqx-shell = {
        description = "Open EMQX remote console";
        category = "EMQX";
        exec = ''
          docker exec -it tmnl_emqx emqx remote_console
        '';
      };

      emqx-test-pub = {
        description = "Publish test MQTT message to EMQX";
        category = "EMQX";
        exec = ''
          TOPIC="''${1:-spBv1.0/acme/DDATA/site-a/motor-01}"
          MESSAGE="''${2:-{\"value\": 42.5, \"timestamp\": \"$(date -Iseconds)\"}}"

          echo "[EMQX] Publishing to: $TOPIC"
          echo "  Payload: $MESSAGE"

          mosquitto_pub \
            -h localhost \
            -p 1883 \
            -t "$TOPIC" \
            -m "$MESSAGE" \
            -q 1

          echo "[EMQX] Published!"
        '';
      };

      emqx-test-sub = {
        description = "Subscribe to MQTT topics on EMQX";
        category = "EMQX";
        exec = ''
          TOPIC="''${1:-spBv1.0/+/DDATA/#}"

          echo "[EMQX] Subscribing to: $TOPIC"
          echo "  Press Ctrl+C to stop"
          echo ""

          mosquitto_sub \
            -h localhost \
            -p 1883 \
            -t "$TOPIC" \
            -q 1 \
            -v
        '';
      };

      emqx-test-sparkplug = {
        description = "Run Sparkplug B test scenario (multi-group NBIRTH + DDATA + STATE)";
        category = "EMQX";
        exec = ''
          echo "[EMQX] Sparkplug B Multi-Group Test Scenario"
          echo "============================================="

          # Group 1: acme
          GROUP1="acme"
          EDGE1="plant-a.area-1.line-1"
          DEV1="motor-01"

          # Group 2: contoso
          GROUP2="contoso"
          EDGE2="plant-b.area-2.line-3"
          DEV2="pump-07"

          # STATE - Primary Application declares ONLINE
          echo "[1/7] Publishing STATE/scada-primary = ONLINE (retained)..."
          mosquitto_pub -h localhost -p 1883 -q 1 -r \
            -t "STATE/scada-primary" \
            -m "ONLINE"

          # Group 1: NBIRTH
          echo "[2/7] Publishing NBIRTH for $GROUP1/$EDGE1..."
          mosquitto_pub -h localhost -p 1883 -q 1 -r \
            -t "spBv1.0/$GROUP1/NBIRTH/$EDGE1" \
            -m "{\"timestamp\":$(date +%s%3N),\"metrics\":[{\"name\":\"Node Control/Reboot\",\"type\":\"Boolean\",\"value\":false}]}"

          # Group 1: DBIRTH
          echo "[3/7] Publishing DBIRTH for $GROUP1/$EDGE1/$DEV1..."
          mosquitto_pub -h localhost -p 1883 -q 1 -r \
            -t "spBv1.0/$GROUP1/DBIRTH/$EDGE1/$DEV1" \
            -m "{\"timestamp\":$(date +%s%3N),\"metrics\":[{\"name\":\"temperature\",\"type\":\"Double\",\"value\":25.0},{\"name\":\"vibration\",\"type\":\"Double\",\"value\":0.5}]}"

          # Group 1: DDATA
          echo "[4/7] Publishing DDATA for $GROUP1/$EDGE1/$DEV1..."
          mosquitto_pub -h localhost -p 1883 -q 1 \
            -t "spBv1.0/$GROUP1/DDATA/$EDGE1/$DEV1" \
            -m "{\"timestamp\":$(date +%s%3N),\"metrics\":[{\"name\":\"temperature\",\"type\":\"Double\",\"value\":42.7},{\"name\":\"vibration\",\"type\":\"Double\",\"value\":1.2}]}"

          # Group 2: NBIRTH
          echo "[5/7] Publishing NBIRTH for $GROUP2/$EDGE2..."
          mosquitto_pub -h localhost -p 1883 -q 1 -r \
            -t "spBv1.0/$GROUP2/NBIRTH/$EDGE2" \
            -m "{\"timestamp\":$(date +%s%3N),\"metrics\":[{\"name\":\"Node Control/Reboot\",\"type\":\"Boolean\",\"value\":false}]}"

          # Group 2: DBIRTH
          echo "[6/7] Publishing DBIRTH for $GROUP2/$EDGE2/$DEV2..."
          mosquitto_pub -h localhost -p 1883 -q 1 -r \
            -t "spBv1.0/$GROUP2/DBIRTH/$EDGE2/$DEV2" \
            -m "{\"timestamp\":$(date +%s%3N),\"metrics\":[{\"name\":\"flow_rate\",\"type\":\"Double\",\"value\":15.0},{\"name\":\"pressure\",\"type\":\"Double\",\"value\":3.2}]}"

          # Group 2: DDATA
          echo "[7/7] Publishing DDATA for $GROUP2/$EDGE2/$DEV2..."
          mosquitto_pub -h localhost -p 1883 -q 1 \
            -t "spBv1.0/$GROUP2/DDATA/$EDGE2/$DEV2" \
            -m "{\"timestamp\":$(date +%s%3N),\"metrics\":[{\"name\":\"flow_rate\",\"type\":\"Double\",\"value\":17.3},{\"name\":\"pressure\",\"type\":\"Double\",\"value\":3.5}]}"

          echo ""
          echo "[EMQX] Multi-group Sparkplug B test complete!"
          echo "  Subscribe all: emqx-test-sub 'spBv1.0/#'"
          echo "  Subscribe acme only: emqx-test-sub 'spBv1.0/acme/DDATA/#'"
          echo "  Subscribe STATE: emqx-test-sub 'STATE/#'"
        '';
      };

      emqx-gen-certs = {
        description = "Generate self-signed TLS certificates for EMQX dev";
        category = "EMQX";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"
          bash docker/emqx/certs/generate-dev-certs.sh docker/emqx/certs
        '';
      };

      emqx-destroy = {
        description = "Destroy EMQX broker and volumes";
        category = "EMQX";
        exec = ''
          cd "$FLAKE_ROOT/packages/tmnl"
          echo "[EMQX] Destroying broker..."
          docker compose -f docker/docker-compose.iiot.yml rm -sf emqx
          docker volume rm -f tmnl_emqx-data tmnl_emqx-log 2>/dev/null || true
          echo "[EMQX] Destroyed"
        '';
      };
    };
  };
}
```

**Required: Add to `nix/default.nix` imports:**

```nix
./modules/emqx/default.nix  # EMQX MQTT broker
```

**Required: Add to `nix/modules/core.nix` nativeBuildInputs:**

```nix
mosquitto  # MQTT CLI tools (mosquitto_pub/sub) for EMQX testing
```

**Acceptance:**
- [ ] `emqx-up` starts the broker, shows connection details
- [ ] `emqx-status` shows broker health, connected clients, topics, retained messages
- [ ] `emqx-test-pub` / `emqx-test-sub` work end-to-end
- [ ] `emqx-test-sparkplug` publishes multi-group NBIRTH + DBIRTH + DDATA + STATE
- [ ] `emqx-gen-certs` generates TLS certificates
- [ ] `emqx-destroy` tears down the broker

**Estimated effort:** Medium

---

### Phase 5: Health Check Integration

The existing `IngestionHealth` schema maps directly to adapter-level health.

**EMQX Health Endpoints:**
- `emqx ctl status` (CLI) → returns "is started" or error
- `GET /api/v5/status` (HTTP) → returns node status
- `GET /api/v5/monitor/current` → connection stats, message rates

**Mapping to IngestionHealth:**

```typescript
// IngestionHealth schema (already defined in ingestion.ts)
{
  protocol: 'sparkplug',           // or 'mqtt'
  connected: true,                 // mqtt.js client.connected
  lastMessageAt: DateTime,         // tracked by SparkplugAdapter
  messagesPerSecond: 42.5,         // tracked by SparkplugAdapter (sliding window)
  errorCount: 0,                   // adapter-level error counter
}
```

The health check lives in the **adapter** (SparkplugAdapter), not in EMQX directly. The adapter tracks:
- `connected`: mqtt.js client's `connected` property
- `lastMessageAt`: timestamp of last received message (updated in the `message` handler)
- `messagesPerSecond`: computed via a sliding window counter
- `errorCount`: incremented on decode errors, connection drops

The EMQX broker's own health is monitored via the dashboard and Prometheus. The adapter doesn't need to query EMQX's HTTP API — it knows its own connection state.

**Acceptance:**
- [ ] SparkplugAdapter.healthCheck returns accurate IngestionHealth
- [ ] Dashboard shows real-time metrics at http://localhost:18083
- [ ] Prometheus endpoint available for external monitoring

**Estimated effort:** Small (integrated into SparkplugAdapter implementation)

---

### Phase 6: MQTT Topic Namespace Design

The Unified Namespace (UNS) maps ISA-95 hierarchy to MQTT topics:

```
## Raw MQTT (JSON payloads)
{enterprise}/{site}/{area}/{line}/{machine}/{sensor}
Example: acme/plant-a/area-1/line-1/motor-01/temperature

## Sparkplug B (protobuf payloads) — multi-group
spBv1.0/{group_id}/{message_type}/{edge_node_id}/{device_id}

Message Types:
  NBIRTH  - Edge node birth (metrics catalog)
  NDEATH  - Edge node death (will message)
  DBIRTH  - Device birth (device metrics catalog)
  DDEATH  - Device death (will message)
  DDATA   - Device data (telemetry — most frequent)
  DCMD    - Device command (downstream control)
  NCMD    - Node command (downstream control to edge node)
  STATE   - SCADA host state (Primary Application)

ISA-95 Mapping:
  group_id     = enterprise  (e.g., "acme", "contoso", "fabrikam")
  edge_node_id = site.area.line  (e.g., "plant-a.area-1.line-1")
  device_id    = machine.sensor  (e.g., "motor-01")

Multi-group examples:
  spBv1.0/acme/DDATA/plant-a.area-1.line-1/motor-01
  spBv1.0/contoso/DDATA/plant-b.area-2.line-3/pump-07
  spBv1.0/fabrikam/DDATA/site-x.zone-1.cell-2/sensor-12

STATE examples:
  STATE/scada-primary → "ONLINE" (retained)
  STATE/scada-backup  → "ONLINE" (retained)
```

**Topic ACL Rules (Production — PostgreSQL-backed):**

| Client | Publish | Subscribe |
|--------|---------|-----------|
| Edge Node `X` | `spBv1.0/+/NBIRTH/X`, `spBv1.0/+/NDEATH/X`, `spBv1.0/+/DDATA/X/#`, `spBv1.0/+/DBIRTH/X/#`, `spBv1.0/+/DDEATH/X/#` | `spBv1.0/+/NCMD/X`, `spBv1.0/+/DCMD/X/#`, `STATE/#` |
| Ingestion Service | — | `spBv1.0/+/DDATA/#`, `spBv1.0/+/DBIRTH/#`, `spBv1.0/+/DDEATH/#`, `spBv1.0/+/NBIRTH/#`, `spBv1.0/+/NDEATH/#`, `STATE/#` |
| SCADA Host | `STATE/{host_id}` | `spBv1.0/#`, `STATE/#` |
| Bridge Service | — | `spBv1.0/#`, `STATE/#` |
| Operator (manual) | `spBv1.0/+/DCMD/#` (commands) | `spBv1.0/#` (read all) |

**Acceptance:**
- [ ] Topic hierarchy documented with multi-group examples
- [ ] ACL rules defined for each client role
- [ ] STATE topic handling documented
- [ ] TopicRouter patterns match multi-group Sparkplug B namespace

**Estimated effort:** Small (documentation + ACL config)

---

### Phase 7: Testing Infrastructure

**MQTT Testing Toolchain (via Nix):**

| Tool | Package | Use |
|------|---------|-----|
| mosquitto_pub | `pkgs.mosquitto` | CLI publish |
| mosquitto_sub | `pkgs.mosquitto` | CLI subscribe |
| emqx ctl | Docker exec | Broker management |

**Test Scenarios:**

1. **Connectivity Test**: `mosquitto_pub -h localhost -p 1883 -t test -m hello`
2. **Multi-Group Sparkplug B Lifecycle**: NBIRTH → DBIRTH → DDATA for 2+ groups
3. **STATE Message Test**: Publish STATE/scada-primary = ONLINE (retained), verify on reconnect
4. **Retained Message Test**: Publish DBIRTH with `-r`, disconnect, reconnect, verify receipt
5. **Will Message Test**: Connect with will topic (NDEATH), force-disconnect, verify will published
6. **QoS Test**: Publish QoS 0/1/2, verify delivery guarantees
7. **ACL Test** (production config): Verify unauthorized publish/subscribe rejected

**Acceptance:**
- [ ] All test scenarios pass
- [ ] mosquitto_pub/sub available in Nix shell
- [ ] Multi-group Sparkplug B lifecycle test documented
- [ ] STATE message persistence verified

**Estimated effort:** Small

---

## Future Epic: EMQX → NATS Bridge (L2 Service)

**Status**: Deferred to separate epic in WBS

An Effect Layer 2 service that subscribes to select EMQX MQTT topics and forwards data to NATS JetStream. This enables internal consumers to access IIoT data via NATS without connecting directly to EMQX.

**Scope (when implemented):**
- mqtt.js client subscribing to EMQX
- NATS JetStream publisher
- Topic mapping rules (MQTT topic → NATS subject)
- Selective forwarding (not all topics — configurable)
- Effect service with health check
- Possible data:
  - Telemetry summaries → JetStream streams
  - Alarm events → NATS subjects
  - Device birth/death → NATS KV (device registry)

**NOT in this plan.** Tracked separately.

---

## Production Auth Architecture (Future)

**Status**: Documented for planning; dev uses anonymous auth.

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Edge Node    │────▶│ EMQX Auth       │────▶│ PostgreSQL   │
│ (username/   │     │ (password_based) │     │ mqtt_users   │
│  password)   │     └─────────────────┘     │ table        │
└──────────────┘                             └──────────────┘

┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Service      │────▶│ EMQX Auth       │────▶│ JWKS         │
│ (JWT token)  │     │ (jwt mechanism)  │     │ endpoint     │
└──────────────┘     └─────────────────┘     └──────────────┘
```

**PostgreSQL table** (to be created in future auth epic):
```sql
CREATE TABLE mqtt_users (
  username VARCHAR(256) PRIMARY KEY,
  password_hash VARCHAR(256) NOT NULL,  -- bcrypt
  is_superuser BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**NOT in this plan.** Auth backend is a separate concern.

---

## File Summary

### Files to Create

| File | Purpose |
|------|---------|
| `docker/emqx/emqx.conf` | EMQX broker configuration (HOCON format) |
| `docker/emqx/acl.conf` | ACL rules for topic permissions |
| `docker/emqx/certs/generate-dev-certs.sh` | Self-signed TLS cert generator |
| `docker/emqx/certs/.gitignore` | Exclude generated certs from git |
| `nix/modules/emqx/default.nix` | Nix module with mission-control scripts |

### Files to Modify

| File | Change |
|------|--------|
| `docker/docker-compose.iiot.yml` | Add EMQX service, volumes |
| `nix/default.nix` | Add `./modules/emqx/default.nix` import |
| `nix/modules/core.nix` | Add `mosquitto` to nativeBuildInputs |

### Files NOT Modified

| File | Reason |
|------|--------|
| `docker/docker-compose.yml` | Main stack unchanged (NATS stays) |
| `nix/modules/nats/` | NATS module unchanged |
| `src/lib/iiot/adapters/ingestion.ts` | Interface already protocol-agnostic |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| EMQX container large (~200MB) | Longer initial pull | Pre-pull in CI |
| Port conflicts with NATS | Medium | No overlap (verified: EMQX 1883/8883/18083 vs NATS 4222/8222/9222) |
| TLS cert management in prod | High | Document rotation procedure, use automation |
| EMQX 5.8 config changes | Medium | Pin to `emqx/emqx:5.8`, document upgrade path |
| Performance under high message rate | Low | EMQX handles 100M+ msgs/sec; IIoT workload is <10K msgs/sec |
| Multi-group topic explosion | Low | Wildcard subscriptions handle N groups efficiently |

---

## Success Criteria

1. EMQX 5.8 broker starts via `docker compose` and accepts MQTT connections
2. Multi-group Sparkplug B topics supported (NBIRTH/DBIRTH/DDATA/DDEATH/NDEATH across N groups)
3. STATE message handling works (retained, will messages)
4. Retained messages persist across broker restarts
5. Will messages fire on unexpected disconnects
6. Dashboard accessible for monitoring at http://localhost:18083
7. Prometheus metrics available for alerting
8. TLS available (optional for dev)
9. mosquitto_pub/sub testing works from Nix shell
10. No interference with existing NATS infrastructure
11. IngestionAdapter.healthCheck maps cleanly to adapter-level health
12. PostgreSQL + JWT auth architecture documented for production

---

## Appendix: EMQX Docker Image Details

**Image**: `emqx/emqx:5.8`
**Size**: ~200MB
**Base**: Alpine Linux
**Ports**: 1883 (MQTT), 8883 (MQTTS), 8083 (WS), 8084 (WSS), 18083 (Dashboard)
**Data**: `/opt/emqx/data` (persistent state, Mnesia database)
**Logs**: `/opt/emqx/log`
**Config**: `/opt/emqx/etc/emqx.conf` (HOCON format)
**CLI**: `emqx ctl` (broker management), `emqx` (node management)

**Key EMQX 5.8 Features for IIoT:**
- Native MQTT 5.0 with all features (topic alias, flow control, user properties)
- Built-in retained message database (disc-backed)
- Session persistence (survive client reconnects)
- Will message support (Sparkplug B DEATH semantics)
- Rule engine (optional: transform/route messages internally)
- Built-in Prometheus metrics exporter
- Dashboard with real-time monitoring
- Hot configuration reload (no restart needed)
- Mnesia database for internal state (no external DB required)
- PostgreSQL authentication backend
- JWT authentication mechanism

## Appendix: Port Allocation

| Service | TCP | TLS | WebSocket | WS-TLS | Dashboard | Prometheus |
|---------|-----|-----|-----------|--------|-----------|------------|
| **EMQX** | 1883 | 8883 | 8083 | 8084 | 18083 | 18083/api/v5/prometheus/stats |
| **NATS** | 4222 | — | 9222 | — | — | 8222 |
| **PostgreSQL** | 5432 | — | — | — | — | — |
| **IIoT DB** | 5433 | — | — | — | — | — |

No port conflicts.

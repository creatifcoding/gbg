---
id: S2-S3
title: "Edge → Transport Integration — MQTT-NATS Bridge & Batching"
commitHash: "6656064"
status: draft
date: "2026-01-02"
tier: pair-adjacent
stages:
  - S2
  - S3
---

# ADR-S2-S3: Edge → Transport Integration

**ID**: S2-S3
**Commit Hash**: 6656064
**Status**: draft
**Date**: 2026-01-02
**Tier**: pair-adjacent

## Context

### Stages Covered
- S2 (Edge) — Rust gateway with SQLite buffering, dead-band filtering
- S3 (Transport) — NATS JetStream with WebSocket support

### Problem

Edge gateways (S2) aggregate sensor data from heterogeneous field protocols (MQTT, Modbus, OPC-UA) into SenML-formatted messages. These messages must reliably reach the cloud transport broker (S3/NATS JetStream) despite:

1. **Bandwidth constraints** — Cellular/satellite links with limited throughput (10-100 Kbps)
2. **Network intermittency** — Offline periods ranging from seconds to hours
3. **Message volume** — 256 sensors × 1-10Hz = 2560 msgs/sec peak
4. **Protocol mismatch** — Edge devices favor lightweight MQTT; cloud infrastructure uses NATS
5. **QoS requirements** — Sensor data requires at-least-once delivery with deduplication

**Core question**: How does aggregated edge data efficiently bridge from MQTT to NATS while maintaining reliability, minimizing bandwidth, and preserving message ordering?

### Constraints

- **Edge publishes MQTT** — Lightweight protocol suitable for constrained environments
- **Transport consumes NATS** — JetStream provides persistence and scalability for cloud ingestion
- **Bidirectional bridge required** — MQTT→NATS for telemetry, NATS→MQTT for control commands
- **Subject mapping must scale** — Support hierarchical routing, wildcard filtering
- **Store-and-forward semantics** — SQLite buffering on edge for offline resilience
- **Exactly-once semantics preferred** — Deduplication via sequence numbers and idempotency keys

### Assumptions

- Edge device runs Rust adapter (`src-ava/ava-adapters/`)
- Edge has persistent storage (SQLite WAL) for 24hr buffer
- NATS JetStream is deployed at cloud endpoint (Docker Compose in dev)
- Network latency S2→S3 is variable (10ms local, 500ms cellular)
- Control commands (NATS→MQTT) are low-frequency (<1/minute)

## Decision

### Summary

Implement a **stateless MQTT-NATS bridge** on the edge gateway (S2) that translates MQTT topics to NATS subjects with deterministic mapping rules. Messages are batched by time window (50ms) or count threshold (100 msgs), compressed (gzip), and published to JetStream with sequence tracking for exactly-once delivery. Store-and-forward via SQLite ensures zero data loss during network outages, with exponential backoff reconnection and deduplication on replay.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| **MQTT Client** (rumqttc) | 0.24+ | Edge MQTT pub/sub | (to be added in Cargo.toml) |
| **NATS Client** (async-nats) | 0.33+ | Bridge to JetStream | `src-ava/ava-adapters/Cargo.toml` |
| **SQLite WAL** | 3.45+ | Offline buffer & sequence tracking | `src-ava/ava-adapters/src/edge/buffer.rs` |
| **flate2** (gzip) | 1.0+ | Batch payload compression | (to be added) |
| **Tokio** | 1.35+ | Async runtime for dual clients | Already present |
| **SenML (RFC 8428)** | — | Message payload format | `src/lib/streams/playground/scenarios/generators/senml.ts` |

### Patterns

#### 1. MQTT-NATS Subject Mapping

**Deterministic transformation** with hierarchical structure:

```rust
// MQTT topic pattern (edge-local naming)
mqtt/sensors/{zone}/{sensor_id}/{measurement}
mqtt/sensors/plant-a/th-001/temperature

// NATS subject pattern (cloud-global namespace)
sensors.{zone}.{sensor_id}.{measurement}
sensors.plant-a.th-001.temperature
```

**Mapping Rules**:
- Replace `/` with `.` (MQTT hierarchy → NATS hierarchy)
- Strip `mqtt/` prefix (protocol marker)
- Validate sensor_id format (alphanumeric + hyphens only)
- Reject wildcards in MQTT topics (only concrete sensors publish)

**Reverse Mapping** (NATS→MQTT for control commands):
```rust
// NATS control command
control.{zone}.{sensor_id}.{command}
control.plant-a.th-001.calibrate

// MQTT command topic (edge subscribes)
mqtt/control/plant-a/th-001/calibrate
```

#### 2. Batching Strategy

**Hybrid trigger** — flush batch when EITHER condition met:

```rust
const BATCH_MAX_SIZE: usize = 100;      // messages
const BATCH_MAX_AGE_MS: u64 = 50;       // milliseconds
const BATCH_MAX_BYTES: usize = 256_000; // ~256KB (before compression)

struct BatchAccumulator {
    messages: Vec<SenMLPack>,
    sequence_start: u64,
    oldest_timestamp: Instant,
    total_bytes: usize,
}

impl BatchAccumulator {
    fn should_flush(&self) -> bool {
        self.messages.len() >= BATCH_MAX_SIZE
            || self.oldest_timestamp.elapsed() >= Duration::from_millis(BATCH_MAX_AGE_MS)
            || self.total_bytes >= BATCH_MAX_BYTES
    }
}
```

**Batch Envelope** (Effect Schema on receiver):
```typescript
class EdgeBatch extends Schema.TaggedClass<EdgeBatch>()(
  'EdgeBatch',
  {
    edgeId: Schema.String,              // Source edge device identifier
    batch: Schema.Array(SenMLPack),     // SenML messages (1-100)
    seq: Schema.Number,                 // Monotonic sequence number (edge-local)
    timestamp: Schema.DateFromSelf,     // Batch creation timestamp
    compressed: Schema.Boolean,         // Gzip compression applied
    checksum: Schema.optional(Schema.String), // SHA256 for integrity
  }
) {}
```

**Compression**:
- Apply gzip if batch >10KB uncompressed
- Typical compression ratio: 5:1 for JSON SenML
- Trade CPU (edge) for bandwidth (cellular link)

#### 3. Store-and-Forward Architecture

**SQLite Ring Buffer** (FIFO with 1GB limit):

```sql
CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY,           -- Monotonic sequence (autoincrement)
    subject TEXT NOT NULL,             -- NATS subject (post-mapping)
    payload BLOB NOT NULL,             -- Serialized EdgeBatch (compressed)
    timestamp_ms INTEGER NOT NULL,     -- Creation time (monotonic clock)
    retry_count INTEGER DEFAULT 0,     -- Retry attempts (max 3)
    ack_received INTEGER DEFAULT 0,    -- 0=pending, 1=acked by JetStream
    INDEX idx_pending (ack_received, seq) -- Query unacked messages
);

-- Eviction policy: delete oldest when total size > 1GB
CREATE TRIGGER IF NOT EXISTS evict_old_messages
AFTER INSERT ON outbox
BEGIN
    DELETE FROM outbox WHERE seq IN (
        SELECT seq FROM outbox ORDER BY seq ASC LIMIT 100
    ) AND (SELECT SUM(length(payload)) FROM outbox) > 1073741824; -- 1GB
END;
```

**Write Flow**:
1. MQTT message arrives → convert to SenMLPack
2. Add to batch accumulator
3. On flush → INSERT INTO outbox (ack_received=0)
4. Async worker polls `SELECT * FROM outbox WHERE ack_received=0 ORDER BY seq`
5. Publish to NATS JetStream
6. On ACK → UPDATE outbox SET ack_received=1
7. Periodic cleanup: DELETE FROM outbox WHERE ack_received=1 AND timestamp_ms < now() - 3600000 (1hr retention)

**Replay on Reconnect**:
```rust
async fn replay_pending_messages(db: &SqlitePool, nats: &NatsClient) -> Result<()> {
    let pending = sqlx::query!("SELECT seq, subject, payload FROM outbox WHERE ack_received=0 ORDER BY seq")
        .fetch_all(db)
        .await?;

    for record in pending {
        // Exponential backoff per message (avoid thundering herd)
        let delay = Duration::from_millis(100 * 2_u64.pow(record.retry_count.min(5)));
        tokio::time::sleep(delay).await;

        match nats.publish(&record.subject, record.payload.into()).await {
            Ok(ack) => {
                sqlx::query!("UPDATE outbox SET ack_received=1 WHERE seq=?", record.seq)
                    .execute(db)
                    .await?;
            }
            Err(e) => {
                sqlx::query!("UPDATE outbox SET retry_count=retry_count+1 WHERE seq=?", record.seq)
                    .execute(db)
                    .await?;
                tracing::warn!("Replay failed for seq={}: {}", record.seq, e);
            }
        }
    }
    Ok(())
}
```

#### 4. QoS Mapping & Acknowledgments

**MQTT QoS → NATS JetStream Semantics**:

| MQTT QoS | Semantics | NATS Mapping | Use Case |
|----------|-----------|--------------|----------|
| QoS 0 | At-most-once (fire-and-forget) | Core NATS publish (no ACK) | Heartbeats, debug logs |
| QoS 1 | At-least-once (ACK required) | JetStream publish + ACK | Sensor telemetry (default) |
| QoS 2 | Exactly-once (4-way handshake) | JetStream + deduplication | Critical alarms (rare) |

**Default**: MQTT QoS 1 → JetStream at-least-once with sequence-based deduplication.

**Deduplication Strategy**:
```rust
// Edge assigns monotonic sequence per sensor
let msg_id = format!("{}-{}-{}", edge_id, sensor_id, seq);

// Publish to JetStream with idempotency header
nats.publish_with_headers(
    subject,
    Headers::from_iter([("Nats-Msg-Id", msg_id.as_str())]),
    payload,
).await?;
```

JetStream automatically deduplicates within configurable window (default: 2 minutes).

**ACK Flow**:
1. Edge publishes EdgeBatch to NATS subject
2. JetStream persists to stream, returns `PubAck { stream, seq }`
3. Edge receives ACK, marks `ack_received=1` in SQLite
4. If no ACK within 5s → retry (exponential backoff, max 3 attempts)
5. After 3 failures → alert, keep in SQLite for manual review

### Interfaces

#### EdgeToTransport (S2→S3)

**Wire Format** (NATS message payload):
```json
{
  "_tag": "EdgeBatch",
  "edgeId": "edge-gateway-001",
  "batch": [
    {
      "bn": "urn:dev:ow:plant-a:th-001:",
      "bt": 1735833600,
      "bu": "Cel",
      "n": "temperature",
      "v": 23.5,
      "t": 0
    },
    {
      "n": "temperature",
      "v": 23.6,
      "t": 1
    }
  ],
  "seq": 142857,
  "timestamp": "2026-01-02T14:30:00Z",
  "compressed": true,
  "checksum": "sha256:a1b2c3..."
}
```

**NATS Subject**: `sensors.plant-a.th-001.temperature`

**Headers**:
```
Nats-Msg-Id: edge-gateway-001-th-001-142857
Content-Encoding: gzip
Content-Type: application/json
```

#### TransportAck (S3→S2)

**JetStream PubAck**:
```rust
struct PubAck {
    stream: String,     // "SENSOR_ZONE_plant-a"
    seq: u64,           // JetStream sequence (global stream offset)
    duplicate: bool,    // true if deduplication detected
}
```

**Error Codes**:
- `503 Service Unavailable` → JetStream offline (trigger store-and-forward)
- `400 Bad Request` → Malformed subject/payload (alert, discard)
- `413 Payload Too Large` → Batch exceeds max size (split and retry)

#### ControlCommand (S3→S2)

**NATS Control Message**:
```typescript
class ControlCommand extends Schema.TaggedClass<ControlCommand>()(
  'ControlCommand',
  {
    targetSensor: Schema.String,        // "th-001"
    command: Schema.Literal('calibrate', 'reset', 'update_threshold'),
    params: Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    }),
    timestamp: Schema.DateFromSelf,
    ttl: Schema.Number,                 // Seconds until command expires
  }
) {}
```

**Bridge Subscription** (edge subscribes to):
```rust
let control_sub = nats.subscribe("control.plant-a.>").await?;
while let Some(msg) = control_sub.next().await {
    let cmd: ControlCommand = serde_json::from_slice(&msg.payload)?;

    // Forward to local MQTT broker
    let mqtt_topic = format!("mqtt/control/{}/{}", cmd.targetSensor, cmd.command);
    mqtt_client.publish(mqtt_topic, QoS::AtLeastOnce, false, msg.payload).await?;
}
```

## Rationale

### Alternatives Considered

1. **HTTP/REST Bridge with Polling**
   - **Pros**: Simple architecture, no dual client complexity
   - **Cons**: Inefficient (polling overhead), no push notifications, requires explicit retry logic
   - **Rejected**: Poor latency and resource usage for real-time telemetry

2. **Native NATS on Edge (no MQTT)**
   - **Pros**: Eliminates protocol translation, direct JetStream publish
   - **Cons**: NATS client heavier than MQTT (memory footprint), ecosystem lock-in
   - **Rejected**: Many field devices only support MQTT; Modbus/OPC-UA adapters produce MQTT internally

3. **Centralized Bridge (separate service)**
   - **Pros**: Decouples edge from NATS, reusable across multiple edge devices
   - **Cons**: Additional network hop (latency), single point of failure, no offline resilience
   - **Rejected**: Violates edge-first philosophy; network partition breaks entire pipeline

4. **Per-Message Publishing (no batching)**
   - **Pros**: Simpler logic, lower latency per message
   - **Cons**: 10x higher network overhead (TCP handshakes, ACK round-trips), bandwidth exhaustion
   - **Rejected**: Incompatible with cellular/satellite links (high cost per packet)

5. **MessagePack Instead of Gzip**
   - **Pros**: Binary encoding reduces size without compression overhead
   - **Cons**: Requires schema evolution tooling, less human-readable for debugging
   - **Rejected**: Gzip provides better compression ratio (5:1 vs 2:1) with standard tooling

### Tradeoffs

| Gain | Cost |
|------|------|
| **Bandwidth efficiency** (batching + gzip) | Increased latency (50ms batch window) |
| **Zero data loss** (SQLite store-and-forward) | 5-10ms write latency + disk I/O overhead |
| **Exactly-once semantics** (sequence tracking) | State management complexity (SQLite sequence table) |
| **Protocol flexibility** (MQTT for edge, NATS for cloud) | Dual client maintenance, mapping logic |
| **Offline resilience** (24hr buffer) | 1GB disk space + periodic cleanup logic |
| **Control commands** (bidirectional bridge) | Security risk (NATS→MQTT path must be authenticated) |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Sequence gap** (SQLite corruption during crash) | Low | High | WAL mode + `PRAGMA synchronous=NORMAL`. Verify integrity on startup. |
| **Duplicate messages** (ACK lost in flight) | Medium | Low | JetStream deduplication window (2min). Ingestion layer (S4) must be idempotent. |
| **Subject explosion** (malformed sensor IDs) | Low | Medium | Validate sensor_id format at MQTT subscribe time. Reject invalid characters. |
| **Compression CPU overhead** (edge device throttling) | Medium | Low | Disable gzip if CPU usage >80% (fallback to uncompressed). Monitor via sysinfo crate. |
| **Thundering herd** (100+ edges reconnect simultaneously) | Medium | Medium | Jittered exponential backoff (random 0-5s initial delay). NATS connection pool limits. |
| **Control command replay attacks** | Medium | High | Add HMAC signature to ControlCommand. Verify timestamp TTL. Maintain nonce registry. |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `src-ava/ava-adapters/src/edge/bridge.rs` | create | MQTT-NATS bridge implementation |
| `src-ava/ava-adapters/src/edge/batching.rs` | create | Batch accumulator with flush triggers |
| `src-ava/ava-adapters/src/edge/buffer.rs` | modify | Add outbox table, replay logic |
| `src-ava/ava-adapters/src/edge/mapping.rs` | create | Subject mapping rules (MQTT↔NATS) |
| `src-ava/ava-adapters/src/edge/sequence.rs` | create | Monotonic sequence generator (SQLite-backed) |
| `src/lib/nats/schemas/edge-batch.ts` | create | Effect Schema for EdgeBatch, ControlCommand |
| `docker/nats/streams/SENSOR_ZONE_*.json` | create | JetStream stream definitions per zone |

### Dependencies

**Cargo.toml additions**:
```toml
[dependencies]
async-nats = "0.33"         # NATS client (JetStream support)
rumqttc = "0.24"            # MQTT client
flate2 = "1.0"              # Gzip compression
sha2 = "0.10"               # SHA256 checksums
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio"] }
tokio = { version = "1.35", features = ["full"] }
tracing = "0.1"
```

**TypeScript (Effect Schema)**:
```json
{
  "@effect/schema": "latest",  // Already present
  "effect": "latest"            // Already present
}
```

### Migrations

**SQLite Migration** (`migrations/002_outbox_table.sql`):
```sql
-- Outbox table for store-and-forward
CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    payload BLOB NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    retry_count INTEGER DEFAULT 0,
    ack_received INTEGER DEFAULT 0
);

CREATE INDEX idx_pending ON outbox (ack_received, seq);
CREATE INDEX idx_cleanup ON outbox (ack_received, timestamp_ms);

-- Sequence tracking per sensor (for deduplication)
CREATE TABLE IF NOT EXISTS sensor_sequences (
    sensor_id TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);
```

### Test Strategy

**Unit Tests** (Rust + tokio-test):
1. **Subject Mapping**:
   - `mqtt/sensors/plant-a/th-001/temperature` → `sensors.plant-a.th-001.temperature`
   - Reject invalid sensor IDs (e.g., `sensor/../admin`)
   - Reverse mapping for control commands

2. **Batch Accumulator**:
   - Flush on count (100 messages)
   - Flush on time (50ms elapsed)
   - Flush on size (256KB)
   - Gzip compression ratio validation

3. **Sequence Generation**:
   - Monotonic across restarts (SQLite-backed)
   - No gaps after crash (WAL recovery)

**Integration Tests** (testcontainers):
1. **MQTT→NATS Flow**:
   - Start Mosquitto + NATS containers
   - Publish 100 MQTT messages
   - Subscribe to NATS subject
   - Assert: All messages received, batched correctly

2. **Store-and-Forward**:
   - Publish 500 messages
   - Stop NATS container (simulate network outage)
   - Verify SQLite outbox has 500 pending
   - Restart NATS
   - Assert: All messages replayed, ack_received=1

3. **Deduplication**:
   - Publish same message ID twice
   - Assert: JetStream only stores one copy

4. **Control Commands**:
   - Publish ControlCommand to NATS `control.plant-a.th-001.calibrate`
   - Subscribe to MQTT `mqtt/control/plant-a/th-001/calibrate`
   - Assert: Message forwarded correctly

**Load Tests** (criterion.rs):
- 2560 msgs/sec (256 sensors × 10Hz) sustained for 1 hour
- Measure: batch flush frequency, SQLite write latency, NATS publish throughput
- Target: <50ms P95 end-to-end latency (MQTT arrive → NATS ACK)

## Metadata

### Related ADRs
- **ADR-S2** (Edge Layer) — Defines SQLite buffer architecture, dead-band filtering
- **ADR-S3** (Transport Layer) — Defines NATS JetStream streams, subject hierarchy
- **ADR-S3-S4** (Transport-Ingestion) — Defines ingestion consumer groups, ACK handling
- **ADR-S4** (Ingestion Layer) — Deduplication logic, EdgeBatch deserialization

### Open Questions
1. **Subject versioning** — Should we include schema version in subject? (e.g., `sensors.v2.plant-a.th-001.temperature`)
2. **Compression threshold** — Is 10KB the optimal switch point for gzip? Benchmark on ARM64.
3. **Control command security** — HMAC secret distribution mechanism? Rotate how often?
4. **Multi-zone edge** — Should edge gateways support multiple facility zones? (Currently 1:1 mapping)
5. **Batch size tuning** — Does 100 msgs @ 50ms optimize for latency or throughput? A/B test.

### References

1. **RFC 8428** — Sensor Measurement Lists (SenML)
   https://datatracker.ietf.org/doc/html/rfc8428

2. **NATS JetStream Documentation**
   https://docs.nats.io/nats-concepts/jetstream

3. **MQTT v5 Specification**
   https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html

4. **SQLite Write-Ahead Logging**
   https://www.sqlite.org/wal.html

5. **TMNL NatsKVService Implementation**
   `/src/lib/nats/NatsKVService.ts` (lines 1-483)

6. **TMNL NATS Bridge Reference**
   `src-ava/ava-adapters/src/nats/bridge.rs` (batch publish pattern)

7. **TMNL SenML Generator**
   `/src/lib/streams/playground/scenarios/generators/senml.ts`

### Glossary

- **Bridge**: Protocol translator between MQTT (edge) and NATS (cloud)
- **Batching**: Accumulating multiple messages before network transmission
- **Store-and-Forward**: Buffering messages locally when network unavailable
- **QoS**: Quality of Service (delivery guarantees in messaging protocols)
- **JetStream**: NATS persistence layer for durable message storage
- **SenML**: Sensor Measurement Lists, IETF standard for IoT telemetry
- **PubAck**: Publish Acknowledgment from JetStream confirming message persistence
- **Deduplication**: Preventing duplicate message processing via idempotency keys

---

**Author**: Val (TMNL Architectural Conscience)
**Reviewed**: Pending
**Approved**: Pending

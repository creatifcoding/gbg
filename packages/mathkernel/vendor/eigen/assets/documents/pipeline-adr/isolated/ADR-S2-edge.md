---
id: "S2"
title: "Edge Layer — Gateway Aggregation & Buffering"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S2"]
---

# ADR-S2: Edge Layer

## Context

### Stages Covered
- S2 (Edge)

### Problem

Industrial sensor networks generate high-frequency telemetry (1Hz-100Hz) from heterogeneous protocols (MQTT, Modbus RTU/TCP, OPC-UA) that must be aggregated, normalized, and bridged to the cloud transport layer. The edge gateway must operate reliably in bandwidth-constrained, intermittently-connected environments while minimizing data loss and transmission overhead.

**Key challenges**:
- Protocol translation from field buses to unified message format
- Local buffering during network outages (offline-first operation)
- Intelligent data reduction to minimize bandwidth consumption
- Zero-allocation processing for resource-constrained edge hardware
- Atomic batch commits to prevent partial data loss

### Constraints

- **Hard**:
  - Must support MQTT (v3.1.1, v5), Modbus RTU/TCP, OPC-UA DA
  - Must handle network outages up to 24 hours without data loss
  - Must operate on ARM64 (Raspberry Pi 4+) with 2GB RAM minimum
  - Must preserve SenML format for S3 transport layer compatibility
  - Must implement dead-band filtering per OPC-UA Part 8 Section 5.6.4
  - Must batch NATS publish operations (ref: `batch.rs` semaphore pattern)

- **Soft**:
  - Prefer SQLite for persistent buffering over in-memory ring buffers
  - Prefer zero-copy message passing where possible
  - Prefer async/await over thread pools for I/O concurrency

### Assumptions

- Sensor data arrives in time-ordered windows (clock skew <1s acceptable)
- NATS JetStream is the primary transport protocol (S3 consumes from it)
- Edge devices have persistent storage (SD card, eMMC, or SSD)
- Dead-band thresholds are statically configured per sensor type (not adaptive)
- Maximum sensor count per edge gateway: 256 (fits in u8 indexing)

## Decision

### Summary

The Edge Layer is a Rust-based protocol gateway implementing store-and-forward semantics with dead-band filtering. It bridges field protocols (MQTT/Modbus/OPC-UA) to NATS JetStream via SQLite-backed buffering and batch publishing, ensuring zero data loss during network partitions.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| **Rust** | 1.75+ | Edge runtime (zero-cost abstractions, memory safety) | `src-ava/ava-adapters/` |
| **NATS JetStream** | 2.10+ | Message broker to S3 transport | `src-ava/ava-adapters/src/nats/bridge.rs` |
| **SQLite** | 3.45+ | Persistent ring buffer for offline storage | `src-ava/ava-adapters/src/sqlite.rs` |
| **Tokio** | 1.35+ | Async runtime for I/O multiplexing | `Cargo.toml` (workspace) |
| **SenML (RFC 8428)** | - | Sensor payload format (JSON/CBOR) | `src/lib/streams/playground/scenarios/generators/senml.ts` |
| **rumqttc** | 0.24+ | MQTT client library | (to be added) |
| **tokio-modbus** | 0.13+ | Modbus RTU/TCP client | (to be added) |
| **opcua** | 0.12+ | OPC-UA client library | (to be added) |

### Patterns

- **Store-and-Forward**: SQLite-backed ring buffer (FIFO eviction at 1GB limit) with atomic batch commits. Write-ahead logging (WAL mode) ensures durability.

- **Dead-Band Filtering**: Per-sensor O(1) state machine (ref: `SENSOR_DELTA_COMPRESSION_STRATEGIES.md`). Transmit only when `|current - last_transmitted| > threshold`. Zero allocation, primitive state only.

- **Batch Publishing**: Accumulate messages until flush condition (100 msgs OR 50ms timer), publish via semaphore-controlled worker pool (ref: `batch.rs` lines 265-340). Backpressure via bounded MPSC channel.

- **Protocol Abstraction**: Trait-based adapter pattern:
  ```rust
  trait ProtocolAdapter {
      async fn poll(&mut self) -> Result<SensorReading>;
      fn into_senml(&self, reading: SensorReading) -> SenMLPack;
  }
  ```

- **Offline Detection**: Heartbeat mechanism with exponential backoff. After 3 failed NATS publish attempts, enter "offline mode" and buffer to SQLite exclusively.

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| **S1→S2** | MQTT v5, Modbus TCP, OPC-UA | Heterogeneous (adapter-specific) |
| **S2→S3** | NATS JetStream subjects | SenML JSON ([RFC 8428](https://datatracker.ietf.org/doc/html/rfc8428)) |
| **S2 Persistence** | SQLite WAL | `CREATE TABLE buffer (id INTEGER PRIMARY KEY, timestamp_ms INTEGER, sensor_id TEXT, payload BLOB)` |

**NATS Subject Hierarchy** (consumed by S3):
```
sensors.{facility_id}.{sensor_type}.{sensor_id}
sensors.plant-a.temperature.th-001
sensors.plant-a.pressure.pr-042
```

**SenML Pack Example**:
```json
[
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
]
```

## Rationale

### Alternatives Considered

1. **In-Memory Ring Buffer (e.g., VecDeque)**
   **Why rejected**: Data loss on edge device crash/power failure. Industrial environments require durability guarantees.

2. **RocksDB / LevelDB**
   **Why rejected**: Overkill for append-only workload. SQLite's WAL mode provides sufficient write throughput (10k inserts/sec) with simpler operational model.

3. **Edge-Side Aggregation (Time-Windowed Averages)**
   **Why rejected**: Destroys signal fidelity. Dead-band filtering preserves original samples while reducing transmission overhead (10:1 to 100:1 compression).

4. **Direct MQTT→NATS Bridge (No Protocol Abstraction)**
   **Why rejected**: Cannot support Modbus/OPC-UA. Trait-based adapters allow heterogeneous protocol support with shared buffering/filtering logic.

5. **Adaptive Dead-Band (Variance-Based)**
   **Why rejected**: Adds complexity (EMA/variance tracking) with marginal benefit. Static thresholds are sufficient for Phase 1, configurable per sensor type.

### Tradeoffs

| Gain | Cost |
|------|------|
| **Zero data loss** (SQLite persistence) | 5-10ms write latency per batch (acceptable for 1Hz sensors) |
| **Bandwidth reduction** (dead-band filtering) | Loss of timing precision (events arrive "on change" not "on schedule") |
| **Protocol flexibility** (trait adapters) | Boilerplate for each new protocol (MQTT/Modbus/OPC-UA) |
| **Offline resilience** (24hr buffer) | 1GB disk space per edge device (trivial on modern hardware) |
| **Memory safety** (Rust) | Steeper learning curve vs Python/Node.js |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **SQLite corruption** (power loss mid-write) | Low | High | WAL mode + `PRAGMA synchronous=NORMAL`. Verify with `PRAGMA integrity_check` on startup. |
| **Clock drift** (edge device NTP unavailable) | Medium | Medium | Fallback to monotonic timestamps. S3 layer reorders by server receipt time. |
| **Dead-band misconfiguration** (threshold too high) | High | Low | Per-sensor-type defaults in config. Validation: alert if >90% samples filtered. |
| **NATS reconnection storm** (100+ edge devices simultaneous reconnect) | Medium | Medium | Exponential backoff (2^n seconds, max 60s). Jittered reconnect delay. |
| **Protocol adapter panics** (unsafe Modbus/OPC-UA FFI) | Low | High | Spawn adapters in isolated tasks. Restart on panic. Telemetry to S8 observability. |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `src-ava/ava-adapters/src/edge/mod.rs` | create | Main edge gateway orchestrator |
| `src-ava/ava-adapters/src/edge/adapters/mqtt.rs` | create | MQTT v5 protocol adapter (rumqttc) |
| `src-ava/ava-adapters/src/edge/adapters/modbus.rs` | create | Modbus RTU/TCP adapter (tokio-modbus) |
| `src-ava/ava-adapters/src/edge/adapters/opcua.rs` | create | OPC-UA DA adapter (opcua crate) |
| `src-ava/ava-adapters/src/edge/filter.rs` | create | Dead-band filter implementation |
| `src-ava/ava-adapters/src/edge/buffer.rs` | create | SQLite ring buffer (WAL mode) |
| `src-ava/ava-adapters/src/edge/config.rs` | create | Edge gateway configuration schema |
| `src-ava/ava-adapters/src/nats/bridge.rs` | modify | Add edge-specific routing logic (lines 543-553) |
| `src-ava/ava-adapters/src/nats/batch.rs` | reference | Reuse batch publisher (lines 183-426) |

### Dependencies

**Cargo.toml additions**:
```toml
[dependencies]
rumqttc = "0.24"           # MQTT client
tokio-modbus = "0.13"      # Modbus RTU/TCP
opcua = "0.12"             # OPC-UA client
rusqlite = "0.31"          # SQLite bindings
serde_cbor = "0.11"        # CBOR encoding for SenML (optional)
tracing-subscriber = "0.3" # Structured logging
```

### Test Strategy

**Unit Tests**:
- Dead-band filter: Verify threshold logic with sine wave input (amplitude sweeps)
- SQLite buffer: Verify FIFO eviction at 1GB limit, WAL recovery after simulated crash
- SenML serialization: Round-trip JSON/CBOR encoding

**Integration Tests**:
- MQTT→NATS pipeline: Mosquitto broker → edge gateway → NATS testcontainer
- Offline mode: Kill NATS, buffer 1000 messages, restart NATS, verify replay
- Protocol adapters: Mock Modbus server → edge gateway → verify SenML output

**Stress Tests**:
- Throughput: 256 sensors × 10Hz = 2560 msgs/sec sustained for 1 hour
- Offline buffer: 24hr outage = 221M messages (verify <1GB disk usage with dead-band)
- Reconnection: 100 edge devices simultaneous reconnect to NATS (verify no thundering herd)

**Edge Deployment**:
- Raspberry Pi 4 (2GB RAM, ARM64) with real sensors (DHT22 temperature/humidity via MQTT)
- Verify dead-band filtering reduces MQTT→NATS traffic by 10:1
- Verify <100MB RSS memory usage under sustained load

## Metadata

### Related ADRs
- **ADR-S1-S2** (Physical-Edge integration): Defines MQTT topic structure for S1→S2
- **ADR-S2-S3** (Edge-Transport integration): NATS subject hierarchy consumed by S3
- **ADR-S8** (Offline-first synergy): Observability hooks for edge health metrics
- **ADR-S3** (Transport layer): NATS JetStream configuration (stream limits, retention)

### References

1. **RFC 8428** — Sensor Measurement Lists (SenML)
   https://datatracker.ietf.org/doc/html/rfc8428

2. **OPC UA Part 8** — Data Access, Section 5.6.4 (Dead-Band Filter)
   https://reference.opcfoundation.org/

3. **NATS JetStream Documentation**
   https://docs.nats.io/nats-concepts/jetstream

4. **SQLite Write-Ahead Logging**
   https://www.sqlite.org/wal.html

5. **TMNL Sensor Delta Compression Strategies** (internal)
   `assets/documents/SENSOR_DELTA_COMPRESSION_STRATEGIES.md`

6. **TMNL NATS Bridge Implementation** (reference impl)
   `src-ava/ava-adapters/src/nats/bridge.rs` (lines 1-1145)

### Glossary

- **Dead-Band**: Amplitude threshold below which sensor changes are not transmitted
- **SenML**: Sensor Measurement Lists, IETF standard for IoT telemetry encoding
- **Store-and-Forward**: Pattern where messages are buffered locally and transmitted when connectivity is restored
- **WAL**: Write-Ahead Logging, SQLite durability mechanism for atomic commits
- **JetStream**: NATS persistence layer for message durability and replay

---

**Author**: Val (TMNL Architectural Conscience)
**Reviewed**: Pending
**Approved**: Pending

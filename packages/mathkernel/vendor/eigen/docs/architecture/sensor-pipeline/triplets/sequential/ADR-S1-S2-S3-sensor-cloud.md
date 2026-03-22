---
id: S1-S2-S3
title: "Physical → Edge → Transport — Sensor-to-Cloud Ingestion Pipeline"
commitHash: "6656064"
status: draft
date: 2026-01-02
tier: triplet-sequential
stages:
  - S1-physical-layer
  - S2-edge-gateway
  - S3-transport-broker
dependencies:
  - ADR-S1-physical-layer
  - ADR-S2-edge-gateway
  - ADR-S3-transport-broker
interfaces:
  - S1→S2: SenML+CBOR over UART/MQTT
  - S2→S3: MQTT-NATS bridge with subject mapping
  - S3→S4: JetStream KV/Stream
---

# ADR S1-S2-S3: Physical → Edge → Transport — Sensor-to-Cloud Ingestion Pipeline

## Context

The TMNL architecture requires a reliable, observable pipeline for ingesting raw sensor data from physical hardware (ESP32 devices) through edge processing (Rust gateway) into cloud-durable transport (NATS JetStream). This triplet represents the foundational data flow for the entire distributed system.

### Problem Statement

How does raw sensor data flow from constrained embedded devices to cloud infrastructure with:
- **Reliability**: No data loss under normal network conditions
- **Resilience**: Graceful degradation when network partitions occur
- **Observability**: End-to-end correlation and latency tracking
- **Efficiency**: Minimal overhead on resource-constrained devices

### Architectural Constraints

1. **S1 (Physical Layer)** — ESP32-S3/H2 microcontrollers
   - 512KB RAM, 4MB Flash
   - WiFi 802.11n or Thread wireless
   - FreeRTOS task scheduling
   - No filesystem, limited persistence

2. **S2 (Edge Gateway)** — Rust application on Linux SBC
   - SQLite for local persistence
   - Tokio async runtime
   - Multi-protocol bridge (UART, MQTT, NATS)
   - Offline-first operation required

3. **S3 (Transport Broker)** — NATS JetStream cluster
   - Distributed consensus via Raft
   - At-least-once delivery semantics
   - Stream replay and consumer groups
   - Subject-based routing

### Data Flow Requirements

```
┌─────────────────┐
│  ESP32 Sensor   │  S1: 100 Hz sampling, 4KB ring buffer
│  (BMP280/IMU)   │      SenML+CBOR encoding
└────────┬────────┘
         │ UART 115200 / MQTT QoS 1
         ▼
┌─────────────────┐
│  Edge Gateway   │  S2: Protocol translation, SQLite buffering
│  (Rust)         │      Subject mapping, correlation injection
└────────┬────────┘
         │ MQTT→NATS bridge
         ▼
┌─────────────────┐
│  NATS JetStream │  S3: Persistent streams, replay, consumer groups
│  Cluster        │      Dead letter queues, retention policies
└─────────────────┘
```

## Decision

We implement a three-stage ingestion pipeline with cascading buffers, protocol translation at each boundary, and end-to-end observability via correlation IDs.

### 1. Data Flow Architecture

#### S1: Physical Layer Encoding

**ESP32 Firmware Strategy**:
```c
// Sensor task (FreeRTOS)
void sensor_task(void *pvParameters) {
    SenMLPack pack;
    RingBuffer *buf = ring_buffer_create(4096); // 4KB ring

    while (1) {
        SensorReading reading = bmp280_read();

        // SenML record with correlation ID
        SenMLRecord record = {
            .bn = "urn:dev:mac:ESP32-ABC123:",
            .n = "temperature",
            .u = "Cel",
            .v = reading.temperature,
            .t = esp_timer_get_time() / 1000.0,
            .correlation_id = generate_correlation_id()
        };

        // CBOR encode (compact binary)
        uint8_t cbor_buf[256];
        size_t cbor_len = senml_encode_cbor(&record, cbor_buf);

        // Push to ring buffer (drop oldest on overflow)
        if (!ring_buffer_push(buf, cbor_buf, cbor_len)) {
            overflow_counter++;
            ESP_LOGW(TAG, "Buffer overflow, dropped packet");
        }

        vTaskDelay(pdMS_TO_TICKS(10)); // 100 Hz
    }
}

// UART/MQTT transmission task
void tx_task(void *pvParameters) {
    while (1) {
        if (wifi_connected && mqtt_connected) {
            // Drain ring buffer via MQTT
            drain_to_mqtt(buf, "sensors/esp32/raw");
        } else {
            // Fallback to UART (wired gateway)
            drain_to_uart(buf, UART_NUM_1);
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
```

**Key Design Points**:
- **SenML+CBOR**: Industry-standard sensor encoding (RFC 8428), ~40% smaller than JSON
- **Ring Buffer**: Fixed 4KB allocation, drop-oldest eviction policy
- **Correlation ID**: 64-bit timestamp + 32-bit random, encoded in SenML base fields
- **Dual Transport**: MQTT (preferred) falls back to UART if WiFi unavailable

#### S2: Edge Gateway Protocol Translation

**Rust Gateway Bridge**:
```rust
use tokio::sync::mpsc;
use rumqttc::{AsyncClient, MqttOptions, QoS};
use sqlx::SqlitePool;

#[derive(Debug, Clone)]
struct SensorPacket {
    correlation_id: String,
    device_id: String,
    senml_payload: Vec<u8>,
    ingress_timestamp: i64,
}

async fn mqtt_ingress_loop(
    mqtt_client: AsyncClient,
    buffer_tx: mpsc::Sender<SensorPacket>,
) -> Result<()> {
    let mut eventloop = mqtt_client.eventloop();

    while let Ok(notification) = eventloop.poll().await {
        if let rumqttc::Event::Incoming(Packet::Publish(p)) = notification {
            // Parse SenML+CBOR
            let records = senml::decode_cbor(&p.payload)?;

            for record in records {
                let packet = SensorPacket {
                    correlation_id: record.correlation_id()
                        .unwrap_or_else(|| generate_id()),
                    device_id: extract_device_id(&record.bn),
                    senml_payload: p.payload.clone(),
                    ingress_timestamp: chrono::Utc::now().timestamp_millis(),
                };

                // Enqueue for NATS bridge (non-blocking)
                if buffer_tx.try_send(packet.clone()).is_err() {
                    // Overflow: persist to SQLite
                    offline_buffer_insert(&pool, packet).await?;
                }
            }
        }
    }
}

async fn nats_egress_loop(
    nats_client: async_nats::Client,
    mut buffer_rx: mpsc::Receiver<SensorPacket>,
    pool: SqlitePool,
) -> Result<()> {
    while let Some(packet) = buffer_rx.recv().await {
        // Subject translation: sensors/esp32/raw → tmnl.sensors.esp32.ABC123.raw
        let subject = format!(
            "tmnl.sensors.{}.{}.raw",
            packet.device_id.split('-').next().unwrap_or("unknown"),
            packet.device_id
        );

        // NATS message with headers
        let msg = async_nats::Message {
            subject: subject.into(),
            payload: packet.senml_payload.into(),
            headers: Some({
                let mut h = async_nats::HeaderMap::new();
                h.insert("correlation-id", packet.correlation_id.as_str());
                h.insert("edge-timestamp", packet.ingress_timestamp.to_string().as_str());
                h.insert("source-stage", "S2");
                h
            }),
            ..Default::default()
        };

        match nats_client.publish_with_headers(
            msg.subject,
            msg.headers.unwrap(),
            msg.payload
        ).await {
            Ok(_) => {
                tracing::info!(
                    correlation_id = %packet.correlation_id,
                    subject = %subject,
                    "Published to NATS"
                );
            }
            Err(e) => {
                // Network failure: buffer to SQLite
                tracing::warn!(
                    correlation_id = %packet.correlation_id,
                    error = %e,
                    "NATS publish failed, buffering offline"
                );
                offline_buffer_insert(&pool, packet).await?;
            }
        }
    }
}

// SQLite WAL for offline buffering
async fn offline_buffer_insert(pool: &SqlitePool, packet: SensorPacket) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO offline_buffer (correlation_id, device_id, payload, ingress_ts)
        VALUES (?, ?, ?, ?)
        "#,
        packet.correlation_id,
        packet.device_id,
        packet.senml_payload,
        packet.ingress_timestamp
    )
    .execute(pool)
    .await?;
    Ok(())
}

// Replay buffered messages when NATS reconnects
async fn replay_offline_buffer(pool: &SqlitePool, nats: &async_nats::Client) -> Result<usize> {
    let rows = sqlx::query!(
        "SELECT * FROM offline_buffer ORDER BY ingress_ts ASC LIMIT 1000"
    )
    .fetch_all(pool)
    .await?;

    let mut replayed = 0;
    for row in rows {
        let subject = format!("tmnl.sensors.{}.raw", row.device_id);
        if nats.publish(subject, row.payload.into()).await.is_ok() {
            sqlx::query!("DELETE FROM offline_buffer WHERE id = ?", row.id)
                .execute(pool)
                .await?;
            replayed += 1;
        }
    }

    Ok(replayed)
}
```

**Key Design Points**:
- **Async Buffering**: Tokio MPSC channel (bounded) → SQLite overflow
- **Subject Translation**: MQTT flat topics → NATS hierarchical subjects
- **Correlation Injection**: Generates ID if S1 didn't provide one
- **Offline Resilience**: SQLite WAL persists during NATS outage, replays on reconnect
- **Header Propagation**: Correlation ID, timestamps, stage markers in NATS headers

#### S3: Transport Layer Persistence

**NATS JetStream Configuration**:
```bash
# Stream for raw sensor ingestion
nats stream add SENSOR_RAW \
  --subjects "tmnl.sensors.>" \
  --retention limits \
  --max-age 7d \
  --max-bytes 10GB \
  --storage file \
  --replicas 3 \
  --discard old

# Consumer with dead letter queue
nats consumer add SENSOR_RAW processing \
  --filter "tmnl.sensors.>" \
  --deliver all \
  --ack explicit \
  --max-deliver 5 \
  --max-ack-pending 100 \
  --backoff 1s,5s,30s \
  --dead-letter-queue "tmnl.sensors.dlq"

# DLQ stream for failed messages
nats stream add SENSOR_DLQ \
  --subjects "tmnl.sensors.dlq" \
  --retention limits \
  --max-age 30d \
  --storage file
```

**Consumer Pattern (S4 subscribers)**:
```rust
use async_nats::jetstream;

async fn consume_sensor_stream(js: jetstream::Context) -> Result<()> {
    let consumer = js.get_consumer_from_stream("SENSOR_RAW", "processing").await?;

    let mut messages = consumer.messages().await?;

    while let Some(msg) = messages.next().await {
        let msg = msg?;

        // Extract correlation ID from headers
        let correlation_id = msg.headers
            .as_ref()
            .and_then(|h| h.get("correlation-id"))
            .map(|v| v.as_str())
            .unwrap_or("unknown");

        // Decode SenML payload
        match senml::decode_cbor(&msg.payload) {
            Ok(records) => {
                for record in records {
                    process_sensor_record(record, correlation_id).await?;
                }

                // Explicit ACK (at-least-once delivery)
                msg.ack().await?;

                tracing::debug!(
                    correlation_id,
                    subject = %msg.subject,
                    "Processed and ACKed"
                );
            }
            Err(e) => {
                tracing::error!(
                    correlation_id,
                    error = %e,
                    "Failed to decode SenML, will retry"
                );

                // NAK with backoff (will retry per consumer config)
                msg.ack_with(jetstream::AckKind::Nak(Some(Duration::from_secs(5)))).await?;
            }
        }
    }

    Ok(())
}
```

### 2. Protocol Stack Summary

| Stage | Ingress Protocol | Egress Protocol | Encoding | QoS |
|-------|------------------|-----------------|----------|-----|
| **S1** | Sensor I²C/SPI | UART/MQTT | SenML+CBOR | Best-effort (ring buffer) |
| **S2** | UART 115200 / MQTT QoS 1 | NATS Core | SenML+CBOR in NATS payload | QoS 1 → At-least-once |
| **S3** | NATS Core | JetStream | Same (passthrough) | Persistent, replicated |

### 3. Buffering Cascade

#### Three-Tier Buffer Strategy

1. **S1 Ring Buffer (4KB)**
   - **Purpose**: Smooth 100 Hz sampling bursts
   - **Eviction**: Drop oldest on overflow
   - **Metrics**: `overflow_counter` incremented, logged to S2

2. **S2 SQLite WAL**
   - **Purpose**: Offline resilience during NATS outage
   - **Schema**:
     ```sql
     CREATE TABLE offline_buffer (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         correlation_id TEXT NOT NULL,
         device_id TEXT NOT NULL,
         payload BLOB NOT NULL,
         ingress_ts INTEGER NOT NULL,
         retry_count INTEGER DEFAULT 0
     );
     CREATE INDEX idx_ingress_ts ON offline_buffer(ingress_ts);
     ```
   - **Replay**: On NATS reconnect, drain oldest-first up to 1000 msgs/batch
   - **Limits**: Max 100K rows (~50MB), prune oldest if exceeded

3. **S3 JetStream Persistence**
   - **Purpose**: Durable replay for S4+ consumers
   - **Retention**: 7 days / 10GB (whichever first)
   - **Replication**: 3x for HA
   - **Consumer Catch-Up**: JetStream replay from last ACK'd sequence

### 4. Error Recovery Chain

#### S1 → S2 Link Failure

**Scenario**: WiFi disconnected, MQTT unavailable

**Recovery**:
1. ESP32 switches to UART fallback (wired to gateway)
2. Ring buffer continues at 100 Hz (4KB capacity = ~40 samples)
3. Overflow counter increments if drain rate < 100 Hz
4. On WiFi restore, MQTT preferred (no buffered replay at S1)

**Data Loss Window**: Up to 40 samples during transition

#### S2 → S3 Link Failure

**Scenario**: NATS cluster unreachable (network partition)

**Recovery**:
1. Edge gateway NATS publish fails (connection timeout)
2. Packet buffered to SQLite WAL
3. In-memory MPSC channel continues draining S1 input
4. On NATS reconnect:
   ```rust
   loop {
       match nats_client.connection_state() {
           ConnectionState::Connected => {
               let replayed = replay_offline_buffer(&pool, &nats).await?;
               tracing::info!(replayed, "Replayed buffered messages");
               break;
           }
           _ => tokio::time::sleep(Duration::from_secs(5)).await,
       }
   }
   ```

**Data Loss Window**: None (SQLite persists until space exhausted)

#### S3 Consumer Failure

**Scenario**: S4 processing service crashes mid-message

**Recovery**:
1. JetStream consumer config: `--max-deliver 5 --backoff 1s,5s,30s`
2. Message redelivered with exponential backoff
3. After 5 attempts, routed to DLQ: `tmnl.sensors.dlq`
4. Alerting triggered on DLQ depth > 10

**Data Loss Window**: None (messages persist in DLQ for manual review)

### 5. Observability Strategy

#### Correlation ID Flow

```
[S1] Generate: timestamp_ms + random_u32 → "1704153600000-a3f2c8b1"
       ↓ (SenML base field or record-level)
[S2] Extract or inject → NATS header "correlation-id: 1704153600000-a3f2c8b1"
       Add "edge-timestamp: 1704153650123"
       ↓
[S3] JetStream persists headers with message
       ↓
[S4+] Extract from msg.headers, propagate to logs/traces
```

#### Per-Stage Metrics

**S1 (ESP32)**:
```c
// Prometheus exposition via HTTP endpoint (if WiFi available)
METRIC(sensor_samples_total, counter, "Total samples read");
METRIC(buffer_overflows_total, counter, "Ring buffer overflows");
METRIC(mqtt_publish_errors_total, counter, "MQTT publish failures");
METRIC(uart_tx_bytes_total, counter, "UART bytes transmitted");
```

**S2 (Edge Gateway)**:
```rust
// metrics-rs with Prometheus exporter
metrics::counter!("mqtt_messages_received_total", "stage" => "S2").increment(1);
metrics::counter!("nats_messages_published_total", "stage" => "S2").increment(1);
metrics::gauge!("offline_buffer_size", "stage" => "S2").set(buffer_size as f64);
metrics::histogram!("e2e_latency_ms", "stage" => "S1-S2")
    .record(ingress_ts - sensor_ts);
```

**S3 (NATS JetStream)**:
```bash
# Native NATS metrics
nats stream info SENSOR_RAW
# Output: messages: 1.2M, bytes: 450MB, consumers: 3

nats consumer info SENSOR_RAW processing
# Output: ack_pending: 12, redelivered: 3, num_pending: 450
```

#### Distributed Tracing

**OpenTelemetry Spans**:
```rust
use tracing_opentelemetry::OpenTelemetrySpanExt;

let span = tracing::info_span!(
    "sensor_ingestion",
    correlation_id = %packet.correlation_id,
    stage = "S2",
    device_id = %packet.device_id
);

span.set_parent(extract_trace_context(&mqtt_headers));

async {
    // ... NATS publish ...
    span.record("nats_subject", &subject);
    span.record("payload_size", payload.len());
}.instrument(span).await;
```

**Trace Propagation**:
- S1→S2: SenML `bt` (base time) + custom field for trace ID
- S2→S3: NATS headers (`traceparent`, `tracestate`)
- S3→S4: JetStream consumer extracts headers, continues span

## Consequences

### Positive

1. **End-to-End Reliability**
   - S2 SQLite buffer eliminates data loss during NATS outages
   - S3 JetStream replication provides HA
   - Consumer retry + DLQ ensures no silent failures

2. **Observable Data Flow**
   - Correlation IDs enable request tracing across all stages
   - Per-stage metrics expose bottlenecks (buffer depth, latency)
   - Distributed traces visualize critical path (S1→S2→S3→S4)

3. **Protocol Flexibility**
   - S1 supports UART (wired) and MQTT (wireless) simultaneously
   - S2 bridges disparate protocols without S1/S3 coupling
   - S3 subject hierarchy enables selective subscription (e.g., `tmnl.sensors.esp32.*`)

4. **Offline Resilience**
   - Edge gateway operates independently during cloud outages
   - SQLite WAL survives gateway restarts (crash recovery)
   - JetStream replay enables late-joining consumers

### Negative

1. **Complexity Overhead**
   - Three buffer tiers increase debugging surface area
   - Protocol translation requires mapping logic maintenance
   - SQLite contention possible under high ingestion rates

2. **Latency Budget**
   - S1→S2: ~10ms (MQTT round-trip on LAN)
   - S2→S3: ~50ms (NATS publish + JetStream ACK)
   - S3→S4: Variable (depends on consumer processing)
   - **Total P99**: ~200ms (sensor read → S4 processing start)

3. **Operational Burden**
   - SQLite buffer requires disk space monitoring
   - JetStream retention policies need tuning (data volume vs. cost)
   - DLQ requires manual triage (automated handling TBD)

4. **Edge Device Constraints**
   - 4KB ring buffer limits burst absorption (40 samples @ 100 Hz)
   - ESP32 cannot persist data across power loss
   - UART fallback requires physical wiring (not viable for all deployments)

### Mitigations

1. **Buffer Monitoring Alarms**
   ```yaml
   # Prometheus alerting rules
   - alert: EdgeBufferBacklog
     expr: offline_buffer_size > 10000
     for: 5m
     annotations:
       summary: "Edge gateway {{$labels.instance}} has {{$value}} buffered messages"
   ```

2. **Adaptive Sampling**
   ```c
   // S1: Reduce sampling rate if buffer pressure high
   if (ring_buffer_usage() > 0.8) {
       sampling_interval_ms = 20; // 50 Hz instead of 100 Hz
   }
   ```

3. **DLQ Automation**
   ```rust
   // S4: Automated DLQ replay with human approval
   async fn dlq_replay_approved(js: &jetstream::Context) -> Result<()> {
       let dlq_consumer = js.get_consumer_from_stream("SENSOR_DLQ", "manual_review").await?;

       if human_approved() {
           dlq_consumer.reprocess_to_stream("SENSOR_RAW").await?;
       }
   }
   ```

## Interface Contracts

### S1→S2: SenML+CBOR Message Format

**Wire Format**:
```json
// JSON representation (actual wire format is CBOR)
[
  {
    "bn": "urn:dev:mac:ESP32-ABC123:",
    "bt": 1704153600.0,
    "bu": "Cel",
    "ver": 1,
    "n": "temperature",
    "v": 22.5,
    "t": 0.0
  },
  {
    "n": "humidity",
    "u": "%RH",
    "v": 45.2,
    "t": 0.01
  }
]
```

**CBOR Encoding**: RFC 8949, deterministic encoding for reproducibility

**Transport**: MQTT topic `sensors/esp32/{device_id}/raw` or UART frame `[0xFF 0xAA <len_u16> <cbor_payload> <crc16>]`

### S2→S3: NATS Message with Headers

**Subject**: `tmnl.sensors.{device_type}.{device_id}.raw`

**Headers**:
```
correlation-id: 1704153600000-a3f2c8b1
edge-timestamp: 1704153650123
source-stage: S2
device-type: esp32
device-id: ESP32-ABC123
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

**Payload**: Raw SenML+CBOR bytes (passthrough from S1)

### S3→S4: JetStream Consumer Delivery

**Consumer Config**:
- Ack Policy: Explicit
- Max Deliver: 5
- Ack Wait: 30s
- Backoff: [1s, 5s, 30s]

**Message ACK Variants**:
```rust
msg.ack().await?;                          // Success
msg.ack_with(AckKind::Nak(None)).await?;   // Retry immediately
msg.ack_with(AckKind::Term).await?;        // Poison pill, move to DLQ
```

## Testing Strategy

### Integration Test: S1→S2→S3 Round-Trip

```rust
#[tokio::test]
async fn test_sensor_to_jetstream_flow() {
    // Setup: Mock ESP32 → Real MQTT → Real Gateway → Real NATS (testcontainer)
    let nats = testcontainers::clients::Cli::default()
        .run(testcontainers::images::nats::Nats::default());

    let nats_url = format!("nats://localhost:{}", nats.get_host_port_ipv4(4222));
    let js = async_nats::connect(&nats_url).await?.jetstream();

    // Create stream
    js.create_stream(jetstream::stream::Config {
        name: "SENSOR_RAW".to_string(),
        subjects: vec!["tmnl.sensors.>".to_string()],
        ..Default::default()
    }).await?;

    // Start edge gateway in background
    let gateway = EdgeGateway::new(mqtt_opts, nats_url).await?;
    tokio::spawn(gateway.run());

    // Publish mock sensor data via MQTT
    let mut mqtt = rumqttc::AsyncClient::new(mqtt_opts, 10);
    let senml = senml::SenMLPack::new()
        .add_record(senml::Record::new("temperature").value(22.5));
    let cbor = senml.to_cbor()?;

    mqtt.publish("sensors/esp32/TEST-001/raw", QoS::AtLeastOnce, false, cbor).await?;

    // Consume from JetStream
    let consumer = js.create_consumer_on_stream(
        jetstream::consumer::pull::Config {
            durable_name: Some("test_consumer".to_string()),
            ..Default::default()
        },
        "SENSOR_RAW"
    ).await?;

    let mut messages = consumer.messages().await?;
    let msg = tokio::time::timeout(Duration::from_secs(5), messages.next())
        .await?
        .unwrap()?;

    // Assertions
    assert_eq!(msg.subject, "tmnl.sensors.esp32.TEST-001.raw");
    assert_eq!(msg.headers.get("source-stage").unwrap(), "S2");

    let decoded = senml::from_cbor(&msg.payload)?;
    assert_eq!(decoded[0].value, Some(22.5));
}
```

### Failure Scenarios

1. **S2 Offline Buffer Overflow**
   ```rust
   #[tokio::test]
   async fn test_sqlite_buffer_overflow() {
       // Fill SQLite to limit, verify oldest rows pruned
   }
   ```

2. **NATS Partition During Publish**
   ```rust
   #[tokio::test]
   async fn test_nats_reconnect_replay() {
       // Kill NATS mid-stream, verify SQLite buffering, reconnect, verify replay
   }
   ```

3. **Consumer Max Redeliveries**
   ```rust
   #[tokio::test]
   async fn test_consumer_dlq_routing() {
       // NAK message 5 times, verify DLQ delivery
   }
   ```

## Related ADRs

- **ADR-S1-physical-layer**: ESP32 firmware architecture, sensor drivers
- **ADR-S2-edge-gateway**: Rust gateway design, protocol bridges
- **ADR-S3-transport-broker**: NATS JetStream topology, stream configs
- **ADR-S4-S5-S6**: Downstream processing (ingestion → storage → analytics)

## Implementation Notes

### Phase 1: Minimal Viable Pipeline (Current)

- S1: MQTT-only (no UART), no overflow counter
- S2: In-memory buffer only (no SQLite), no replay
- S3: Single-node NATS (no replication)

### Phase 2: Production Hardening (Next)

- S2: SQLite WAL with automatic replay
- S3: 3-node JetStream cluster with Raft
- Observability: Correlation IDs, distributed tracing

### Phase 3: Advanced Features

- S1: Adaptive sampling based on buffer pressure
- S2: Multi-gateway HA with leader election
- S3: Geo-distributed NATS superclusters with leaf nodes

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-02 | Val | Initial draft based on S1/S2/S3 individual ADRs |

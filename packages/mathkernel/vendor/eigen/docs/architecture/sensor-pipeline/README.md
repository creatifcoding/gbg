# Sensor Data Pipeline ADR Collection

> **Canonical Source**: `assets/documents/pipeline-adr/`
> **Consolidated**: 2026-02-09
> **Status**: Draft (26 documents)

Complete architecture of a sensor data pipeline from physical sampling to React DOM updates. The pipeline spans 9 stages with decisions captured at three granularity levels.

---

## Pipeline Stages

```
S1 Physical -> S2 Edge -> S3 Transport -> S4 Ingestion -> S5 Storage
                                                               |
S9 React <- S8 State <- S7 Filtering <- S6 Client <-----------+
```

| ID | Stage | Description | Technologies |
|----|-------|-------------|--------------|
| S1 | **Physical** | Sensor, ADC, firmware, encoding | ESP32, SenML |
| S2 | **Edge** | Gateway, aggregation, buffering | Rust adapter |
| S3 | **Transport** | Broker, pub/sub, QoS | NATS JetStream |
| S4 | **Ingestion** | Validation, transformation, routing | Effect.Service |
| S5 | **Storage** | KV store, TSDB, event log | NATS KV, SQLite |
| S6 | **Client Transport** | WebSocket, SSE, reconnection | nats.ws, SSEAdapter |
| S7 | **Filtering** | Dead-band, decimation, backpressure | OPC UA pattern |
| S8 | **State** | Atoms, derived state, Result | effect-atom, Registry |
| S9 | **React** | Subscription, render, DOM | useAtomValue, memo |

---

## Document Index

### Tier 1: Isolated Stage ADRs (9)

| File | Stage |
|------|-------|
| [ADR-S1-physical.md](isolated/ADR-S1-physical.md) | Physical |
| [ADR-S2-edge.md](isolated/ADR-S2-edge.md) | Edge |
| [ADR-S3-transport.md](isolated/ADR-S3-transport.md) | Transport |
| [ADR-S4-ingestion.md](isolated/ADR-S4-ingestion.md) | Ingestion |
| [ADR-S5-storage.md](isolated/ADR-S5-storage.md) | Storage |
| [ADR-S6-client-transport.md](isolated/ADR-S6-client-transport.md) | Client Transport |
| [ADR-S7-filtering.md](isolated/ADR-S7-filtering.md) | Filtering |
| [ADR-S8-state.md](isolated/ADR-S8-state.md) | State |
| [ADR-S9-react.md](isolated/ADR-S9-react.md) | React |

### Tier 2: Adjacent Pair ADRs (7)

| File | Stages |
|------|--------|
| [ADR-S2-S3-edge-transport.md](pairs/adjacent/ADR-S2-S3-edge-transport.md) | S2 -> S3 |
| [ADR-S3-S4-transport-ingestion.md](pairs/adjacent/ADR-S3-S4-transport-ingestion.md) | S3 -> S4 |
| [ADR-S4-S5-ingestion-storage.md](pairs/adjacent/ADR-S4-S5-ingestion-storage.md) | S4 -> S5 |
| [ADR-S5-S6-storage-client.md](pairs/adjacent/ADR-S5-S6-storage-client.md) | S5 -> S6 |
| [ADR-S6-S7-client-filtering.md](pairs/adjacent/ADR-S6-S7-client-filtering.md) | S6 -> S7 |
| [ADR-S7-S8-filtering-state.md](pairs/adjacent/ADR-S7-S8-filtering-state.md) | S7 -> S8 |
| [ADR-S8-S9-state-react.md](pairs/adjacent/ADR-S8-S9-state-react.md) | S8 -> S9 |

### Tier 3: Synergy Pair ADRs (4)

| File | Stages | Focus |
|------|--------|-------|
| [ADR-S1-S9-e2e-latency.md](pairs/synergy/ADR-S1-S9-e2e-latency.md) | S1 <-> S9 | Latency budget allocation |
| [ADR-S2-S8-offline-first.md](pairs/synergy/ADR-S2-S8-offline-first.md) | S2 <-> S8 | Offline resilience |
| [ADR-S3-S7-filter-placement.md](pairs/synergy/ADR-S3-S7-filter-placement.md) | S3 <-> S7 | Server vs client filtering |
| [ADR-S4-S6-schema-contract.md](pairs/synergy/ADR-S4-S6-schema-contract.md) | S4 <-> S6 | Schema versioning |

### Tier 4: Sequential Triplet ADRs (3)

| File | Stages | Focus |
|------|--------|-------|
| [ADR-S1-S2-S3-sensor-cloud.md](triplets/sequential/ADR-S1-S2-S3-sensor-cloud.md) | S1->S2->S3 | Physical ingestion |
| [ADR-S4-S5-S6-backend-plane.md](triplets/sequential/ADR-S4-S5-S6-backend-plane.md) | S4->S5->S6 | Server data flow |
| [ADR-S7-S8-S9-frontend-flow.md](triplets/sequential/ADR-S7-S8-S9-frontend-flow.md) | S7->S8->S9 | Client data flow |

### Tier 5: Cross-Cutting Triplet ADRs (2)

| File | Stages | Focus |
|------|--------|-------|
| [ADR-S1-S5-S9-observability.md](triplets/crosscut/ADR-S1-S5-S9-observability.md) | S1<->S5<->S9 | E2E tracing |
| [ADR-S3-S6-S8-error-handling.md](triplets/crosscut/ADR-S3-S6-S8-error-handling.md) | S3<->S6<->S8 | Error propagation |

---

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Firmware | ESP32, FreeRTOS, SenML, CBOR |
| Edge | Rust, Tokio, SQLite WAL, MQTT |
| Transport | NATS JetStream, WebSocket |
| Backend | Effect-TS, Schema, Stream |
| Storage | SQLite, NATS KV |
| Frontend | React, effect-atom, AG-Grid |

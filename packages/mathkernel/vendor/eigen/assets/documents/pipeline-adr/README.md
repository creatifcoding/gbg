# Sensor Data Pipeline ADR Collection

**Commit Hash**: `6656064`
**Date**: 2026-01-02
**Status**: Draft (26 documents)

---

## Overview

This collection documents the architecture of a complete sensor data pipeline, from physical sensor sampling to React DOM updates. The pipeline spans 9 stages with decisions captured at three granularity levels:

1. **Isolated Stage Documents** (9) — Each stage designed independently
2. **Pairwise Integration Documents** (12) — Adjacent + synergy integration patterns
3. **Triplet Integration Documents** (5) — Three-stage coordination patterns

---

## Pipeline Stages

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│   S1    │──▶│   S2    │──▶│   S3    │──▶│   S4    │──▶│   S5    │
│Physical │   │  Edge   │   │Transport│   │Ingestion│   │ Storage │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
                                                              │
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │
│   S9    │◀──│   S8    │◀──│   S7    │◀──│   S6    │◀────────┘
│  React  │   │  State  │   │Filtering│   │ Client  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
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

| ID | Document | Status | Words |
|----|----------|--------|-------|
| S1 | [Physical Stage](isolated/ADR-S1-physical.md) | Draft | ~500 |
| S2 | [Edge Stage](isolated/ADR-S2-edge.md) | Draft | ~500 |
| S3 | [Transport Stage](isolated/ADR-S3-transport.md) | Draft | ~500 |
| S4 | [Ingestion Stage](isolated/ADR-S4-ingestion.md) | Draft | ~500 |
| S5 | [Storage Stage](isolated/ADR-S5-storage.md) | Draft | ~500 |
| S6 | [Client Transport Stage](isolated/ADR-S6-client-transport.md) | Draft | ~500 |
| S7 | [Filtering Stage](isolated/ADR-S7-filtering.md) | Draft | ~500 |
| S8 | [State Stage](isolated/ADR-S8-state.md) | Draft | ~500 |
| S9 | [React Stage](isolated/ADR-S9-react.md) | Draft | ~500 |

### Tier 2: Adjacent Pair ADRs (8)

| ID | Document | Stages | Status | Words |
|----|----------|--------|--------|-------|
| S1-S2 | [Physical → Edge](pairs/adjacent/ADR-S1-S2-physical-edge.md) | S1 → S2 | Draft | ~1000 |
| S2-S3 | [Edge → Transport](pairs/adjacent/ADR-S2-S3-edge-transport.md) | S2 → S3 | Draft | ~1000 |
| S3-S4 | [Transport → Ingestion](pairs/adjacent/ADR-S3-S4-transport-ingestion.md) | S3 → S4 | Draft | ~1000 |
| S4-S5 | [Ingestion → Storage](pairs/adjacent/ADR-S4-S5-ingestion-storage.md) | S4 → S5 | Draft | ~1000 |
| S5-S6 | [Storage → Client](pairs/adjacent/ADR-S5-S6-storage-client.md) | S5 → S6 | Draft | ~1000 |
| S6-S7 | [Client → Filtering](pairs/adjacent/ADR-S6-S7-client-filtering.md) | S6 → S7 | Draft | ~1000 |
| S7-S8 | [Filtering → State](pairs/adjacent/ADR-S7-S8-filtering-state.md) | S7 → S8 | Draft | ~1000 |
| S8-S9 | [State → React](pairs/adjacent/ADR-S8-S9-state-react.md) | S8 → S9 | Draft | ~1000 |

### Tier 3: Synergy Pair ADRs (4)

| ID | Document | Stages | Focus | Status | Words |
|----|----------|--------|-------|--------|-------|
| S1-S9 | [E2E Latency](pairs/synergy/ADR-S1-S9-e2e-latency.md) | S1 ↔ S9 | Latency budget allocation | Draft | ~1000 |
| S2-S8 | [Offline-First](pairs/synergy/ADR-S2-S8-offline-first.md) | S2 ↔ S8 | Offline resilience | Draft | ~1000 |
| S3-S7 | [Filter Placement](pairs/synergy/ADR-S3-S7-filter-placement.md) | S3 ↔ S7 | Server vs client filtering | Draft | ~1000 |
| S4-S6 | [Schema Contract](pairs/synergy/ADR-S4-S6-schema-contract.md) | S4 ↔ S6 | Schema versioning | Draft | ~1000 |

### Tier 4: Sequential Triplet ADRs (3)

| ID | Document | Stages | Focus | Status | Words |
|----|----------|--------|-------|--------|-------|
| S1-S2-S3 | [Sensor-to-Cloud](triplets/sequential/ADR-S1-S2-S3-sensor-cloud.md) | S1 → S2 → S3 | Physical ingestion | Draft | ~2000 |
| S4-S5-S6 | [Backend Plane](triplets/sequential/ADR-S4-S5-S6-backend-plane.md) | S4 → S5 → S6 | Server data flow | Draft | ~2000 |
| S7-S8-S9 | [Frontend Flow](triplets/sequential/ADR-S7-S8-S9-frontend-flow.md) | S7 → S8 → S9 | Client data flow | Draft | ~2000 |

### Tier 5: Cross-Cutting Triplet ADRs (2)

| ID | Document | Stages | Focus | Status | Words |
|----|----------|--------|-------|--------|-------|
| S1-S5-S9 | [Observability](triplets/crosscut/ADR-S1-S5-S9-observability.md) | S1 ↔ S5 ↔ S9 | E2E tracing | Draft | ~2000 |
| S3-S6-S8 | [Error Handling](triplets/crosscut/ADR-S3-S6-S8-error-handling.md) | S3 ↔ S6 ↔ S8 | Error propagation | Draft | ~2000 |

---

## Status Summary

| Tier | Documents | Draft | Review | Accepted | Total Words |
|------|-----------|-------|--------|----------|-------------|
| Isolated | 9 | 9 | 0 | 0 | ~4,500 |
| Adjacent | 8 | 8 | 0 | 0 | ~8,000 |
| Synergy | 4 | 4 | 0 | 0 | ~4,000 |
| Sequential | 3 | 3 | 0 | 0 | ~6,000 |
| Cross-cut | 2 | 2 | 0 | 0 | ~4,000 |
| **Total** | **26** | **26** | **0** | **0** | **~26,500** |

---

## Document Schema

All documents follow the uniform schema defined in [`schema.ts`](schema.ts):

```typescript
interface PipelineADR {
  id: string              // e.g., "S3" or "S2-S3" or "S7-S8-S9"
  title: string
  commitHash: string      // "6656064"
  status: ADRStatus       // 'draft' | 'review' | 'accepted' | 'superseded'
  date: string            // ISO 8601

  context: ADRContext
  decision: ADRDecision
  rationale: ADRRationale
  implementation: ADRImplementation
  metadata: ADRMetadata
}
```

---

## Review Application

A React testbed is available for reviewing these ADRs interactively:

**Route**: `/testbed/pipeline-adr`
**File**: `src/components/testbed/PipelineADRTestbed.tsx`

Features:
- Filter by tier and status
- Status workflow (Draft → Review → Accepted)
- Inline commenting with path-based annotations
- JSON export for digest generation

---

## Cross-Reference Matrix

```
        S1   S2   S3   S4   S5   S6   S7   S8   S9
   S1    ●   ──▶  │    │    ↕    │    │    │    ↕
   S2   ◀──   ●  ──▶   │    │    │    │    ↕    │
   S3    │   ◀──   ●  ──▶   │    │    ↕    │    │
   S4    │    │   ◀──   ●  ──▶   ↕    │    │    │
   S5    ↕    │    │   ◀──   ●  ──▶   │    │    ↕
   S6    │    │    │    ↕   ◀──   ●  ──▶   │    │
   S7    │    │    ↕    │    │   ◀──   ●  ──▶   │
   S8    │    ↕    │    │    │    │   ◀──   ●  ──▶
   S9    ↕    │    │    │    ↕    │    │   ◀──   ●

Legend:
  ●   = Isolated ADR
  ──▶ = Adjacent pair (data flow)
  ↕   = Synergy pair (cross-cutting)
```

---

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Firmware** | ESP32, FreeRTOS, SenML, CBOR |
| **Edge** | Rust, Tokio, SQLite WAL, MQTT |
| **Transport** | NATS JetStream, WebSocket |
| **Backend** | Effect-TS, Schema, Stream |
| **Storage** | SQLite, NATS KV |
| **Frontend** | React, effect-atom, AG-Grid |

---

## Usage

### Reviewing Documents

1. Navigate to `/testbed/pipeline-adr` in the TMNL app
2. Filter by tier (Isolated/Adjacent/Synergy/Sequential/Cross-cut)
3. Select a document to view details
4. Change status and add comments
5. Export JSON digest when review is complete

### Generating JSON Digest

```typescript
// In PipelineADRTestbed, click "Export JSON" to download:
// pipeline-adr-digest-2026-01-02.json
```

### Programmatic Access

```typescript
import { ADR_MANIFEST } from '@/../assets/documents/pipeline-adr/schema'

// Get all ADRs
const allADRs = ADR_MANIFEST

// Filter by tier
const isolatedADRs = ADR_MANIFEST.filter(a => a.tier === 'isolated')

// Get stages for an ADR
const stages = ADR_MANIFEST.find(a => a.id === 'S3-S4')?.stages
```

---

*Generated during TMNL Pipeline Architecture Design exercise*

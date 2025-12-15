# ADR-001: TMNL Distributed Data Platform Architecture

**Date**: 2024-12-15  
**Status**: Accepted  
**Architect**: Val (Vigilant Architecture Layer)  
**Stakeholder**: Prime (Solo Developer)

---

## Executive Summary

TMNL is not a standard Kubernetes application. It is a **distributed data platform** with IoT/edge computing capabilities, real-time collaboration, blockchain integration, and a multi-tier deployment topology. This ADR defines the architectural foundation and implementation roadmap.

---

## Context

### Business Requirements

1. **Multi-tier deployment**: Central cluster → Plant clusters → Line edge nodes → IoT devices
2. **Real-time collaboration**: CRDTs for documents, canvas, grids, workflows, code
3. **Blockchain integration**: Sui/Chainlink primary, Solana secondary, multi-chain support
4. **IoT device support**: MQTT + NATS, bidirectional sync, device registry
5. **Federated query**: Trino across PostgreSQL, Iceberg, TimescaleDB, ElectricSQL, on-chain data
6. **Local-first**: ElectricSQL sync to Tauri app, edge nodes, embedded devices
7. **Custom observability**: NATS-backed logging/tracing with domain-specific semantics
8. **Serverless compute**: NEX (NATS Execution Engine) for Wasm + native workloads

### Technical Constraints

- **Solo developer** (Prime) — tooling must be developer-friendly
- **Immediate timeline** (this week for foundation)
- **Rust-first philosophy** — prefer Rust for performance-critical paths
- **Effect-TS integration** — leverage Effect ecosystem for TypeScript layer
- **Nix-driven deployments** — reproducible builds, declarative infrastructure

---

## Decision

### Core Technology Stack

| Layer                  | Technology                        | Role                                                            |
| ---------------------- | --------------------------------- | --------------------------------------------------------------- |
| **Event Mesh**         | NATS + JetStream + NEX            | Nervous system — events, pub/sub, serverless                    |
| **Data Spine**         | PostgreSQL 17                     | OLTP + extensions (PostGIS, TimescaleDB, pgvector, pg_mooncake) |
| **Query Brain**        | Trino                             | Federated SQL across all data sources                           |
| **Lakehouse**          | Apache Iceberg + pg_mooncake      | Long-term storage, time-travel queries                          |
| **Local-First**        | ElectricSQL + SQLite              | Edge sync, offline capability                                   |
| **GraphQL Gateway**    | Cosmo Router + Connect            | Federation layer, gRPC-GraphQL bridge                           |
| **Serverless Compute** | NEX (Wasm + native binaries)      | Event handlers, stream processors, edge functions               |
| **Service Mesh**       | Cilium                            | eBPF-based networking, security                                 |
| **Service Discovery**  | Consul                            | DNS + service mesh integration                                  |
| **Observability**      | Custom (Rust + TypeScript)        | NATS-backed logging/tracing                                     |
| **CRDT Sync**          | Yjs + Y-Sweet + NATS              | Real-time collaboration backend                                 |
| **Blockchain**         | Sui (primary), Solana (secondary) | Smart contracts, indexing via The Graph/Trino                   |
| **IoT Gateway**        | rmqtt + NATS MQTT                 | MQTT-NATS bridge                                                |
| **Operators**          | Pepr (Effect-wrapped)             | Custom CRDs for PostgreSQL, NATS, AVA, Trino                    |

---

## Architecture Diagrams

### Multi-Tier Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Central Cluster (k8s)                     │
│                                                               │
│  ┌──────────┐  ┌────────┐  ┌───────┐  ┌──────────────┐     │
│  │ Trino    │  │ Cosmo  │  │ NATS  │  │ PostgreSQL   │     │
│  │Coordinator│ │ Router │  │Server │  │ + Extensions │     │
│  └──────────┘  └────────┘  └───┬───┘  └──────────────┘     │
│                                 │                             │
└─────────────────────────────────┼─────────────────────────────┘
                                  │ (NATS Super Cluster)
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │  Plant A (k8s)│ │  Plant B (k8s)│ │  Plant C (k8s)│
        │               │ │               │ │               │
        │ Trino Worker  │ │ Trino Worker  │ │ Trino Worker  │
        │ NATS Cluster  │ │ NATS Cluster  │ │ NATS Cluster  │
        │ ElectricSQL   │ │ ElectricSQL   │ │ ElectricSQL   │
        └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                │                 │                 │
        ┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐
        │  Line 1 (edge)│ │  Line 1 (edge)│ │  Line 1 (edge)│
        │  Line 2 (edge)│ │  Line 2 (edge)│ │  Line 2 (edge)│
        │               │ │               │ │               │
        │ NATS Leaf Node│ │ NATS Leaf Node│ │ NATS Leaf Node│
        │ SQLite (sync) │ │ SQLite (sync) │ │ SQLite (sync) │
        │ NEX Workloads │ │ NEX Workloads │ │ NEX Workloads │
        └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                │                 │                 │
        ┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐
        │   Devices     │ │   Devices     │ │   Devices     │
        │ (MQTT/NATS)   │ │ (MQTT/NATS)   │ │ (MQTT/NATS)   │
        └───────────────┘ └───────────────┘ └───────────────┘
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  Tauri   │  │ Web App  │  │ Mobile   │                   │
│  │  (Edge)  │  │ (Browser)│  │ (Future) │                   │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘                   │
└────────┼─────────────┼─────────────┼─────────────────────────┘
         │             │             │
         │ (ElectricSQL sync)       │
         │             │             │
         └─────────────┼─────────────┘
                       │
         ┌─────────────▼─────────────┐
         │      Cosmo GraphQL         │
         │    (Federation Router)     │
         └─────────────┬─────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌────────┐   ┌─────────┐   ┌─────────┐
    │  AVA   │   │   AMS   │   │  Chain  │ (Subgraphs)
    │ (Rust) │   │  (TS)   │   │ (Rust)  │
    └───┬────┘   └────┬────┘   └────┬────┘
        │             │             │
        │ (gRPC)      │ (Effect)    │ (Sui/Solana RPC)
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │         NATS Mesh          │
        │  (Events, Streams, KV)     │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌──────────┐
   │PostgreSQL  │   Iceberg│  │   Trino  │
   │+Extensions│  │ (S3/pg) │  │(Federated)│
   └─────────┘  └─────────┘  └──────────┘
```

---

## Critical Questions Answered

### Q1: Pepr Rust SDK

**Answer**: Pepr offers a **Rust SDK** separate from the TypeScript version. Prime wants to:

1. Use **Pepr Rust SDK** for performance-critical operators
2. Wrap Pepr in **Effect-TS** for TypeScript operators
3. Leverage **Effect DI, Schema, Result types** for operator authorship

**Action**: Research Pepr Rust SDK capabilities before committing to kube-rs.

### Q2: NEX vs Wasmcloud

**Answer**: **Coexistence model**:

- **NEX** for NATS-centric workloads (event handlers, stream processors)
- **Wasmcloud** for capability-based actors (metrics aggregation, edge compute)
- Both run **Wasm + native binaries** (Rust preferred)

**Action**: Deploy NEX first (tighter NATS integration), evaluate Wasmcloud later.

### Q3: Dynamic Ephemeral Streams

**Triggers**:

- User sessions (stream per user/tenant)
- Workflow instances (stream per workflow run)
- Device connections (stream per IoT device)
- Query contexts (stream per Trino query)

**Action**: NATS operator must support dynamic stream lifecycle (create/destroy via CRDs).

### Q4: NATS as Cache

**Model**: Hybrid approach:

- **JetStream KV buckets** for key-value caching
- **NATS Object Store** for blob storage
- **Custom Rust service** for cache invalidation logic

**Action**: Build custom caching service on top of NATS primitives.

### Q5: Iceberg Integration

**Strategy**: **Both PostgreSQL + Object Storage**:

- **Hot data** in PostgreSQL via pg_mooncake
- **Cold data** in S3/MinIO via Iceberg
- **Trino** queries across both via Iceberg connector

**Action**: Deploy pg_mooncake extension, configure Trino Iceberg catalog.

### Q6: ElectricSQL Sync

**Targets**:

- Tauri app (user's device)
- Edge nodes (plant/line level)
- IoT devices (embedded SQLite)

**Topology**: **Bidirectional sync with CRDTs**  
**Propagation**: **Postgres NOTIFY → NATS bridge** (event sourcing)

**Action**: Build Postgres NOTIFY listener that publishes to NATS.

### Q7: Custom Observability

**Why Custom**:

- Domain-specific semantics (Effect spans, AVA view traces)
- Integration with NATS (logs/traces as JetStream messages)
- Multi-tier aggregation (plant → central)
- Real-time alerting (not batch-oriented)

**Scope**: Log + trace + metrics aggregation + alerting engine  
**Implementation**: **Rust core, TypeScript integration layer**

**Action**: Build custom observability service backed by NATS JetStream.

### Q8: Blockchain Integration

**Primary**: **Sui + Chainlink** (smart contracts, oracles)  
**Secondary**: **Solana** (high-throughput use cases)  
**Indexing**: **The Graph subgraphs + Trino connector**

**Action**: Build Trino connector for Sui GraphQL API, deploy Chainlink oracles.

---

## Phased Rollout Plan

### Phase 0: Foundation (Week 1)

**Goal**: Deploy minimal viable data platform.

**Components**:

1. **NATS Cluster** (JetStream + KV + Object Store)

   - 3-node cluster (HA)
   - JetStream storage: file-based
   - Deploy via Helm + custom Pepr operator (future)

2. **PostgreSQL** (with extensions)

   - PostgreSQL 17
   - Extensions: PostGIS, TimescaleDB, pgvector, pg_mooncake, pgcrypto
   - StatefulSet deployment (dev), operator-managed backups (prod)
   - Connection pooling: PgBouncer

3. **Cosmo Router** (existing Pepr CRD)

   - Extend existing operator
   - Wire to AVA subgraph (Rust gRPC)
   - Schema registry: self-hosted

4. **Trino** (basic setup)

   - Single coordinator + 2 workers
   - Catalogs: PostgreSQL, Iceberg (future)
   - Deploy via Helm

5. **Dev Cluster** (k3d)
   - Single k3d cluster (local dev)
   - Namespaces: `dev`, `staging`

**Success Criteria**:

- [ ] NATS cluster operational, JetStream streams created
- [ ] PostgreSQL accepting connections, extensions loaded
- [ ] Cosmo Router federated query across 1+ subgraphs
- [ ] Trino querying PostgreSQL tables
- [ ] k3d cluster provisioned via `nix/modules/k8s.nix`

---

### Phase 1: Edge Layer (Week 2)

**Goal**: Deploy edge infrastructure (plant/line).

**Components**:

1. **Plant Cluster** (k3d or cloud)

   - Namespace per plant: `plant-a`, `plant-b`
   - NATS cluster (3 nodes per plant)
   - Trino worker per plant
   - ElectricSQL sync agent

2. **NATS Leaf Nodes** (line level)

   - Deploy to edge nodes (Raspberry Pi, industrial PCs)
   - Connect to plant NATS cluster
   - NEX workload execution enabled

3. **ElectricSQL Sync**
   - Postgres NOTIFY → NATS bridge
   - SQLite databases at line level
   - Bidirectional sync with CRDTs

**Success Criteria**:

- [ ] Plant cluster operational, connected to central
- [ ] NATS leaf nodes syncing messages
- [ ] ElectricSQL syncing Postgres ↔ SQLite
- [ ] Trino federated query across central + plant

---

### Phase 2: IoT Gateway (Week 3)

**Goal**: Device connectivity and data ingestion.

**Components**:

1. **MQTT Bridge** (rmqtt + NATS MQTT)

   - MQTT broker at plant level
   - Bridge to NATS topics
   - QoS 1 (at-least-once delivery)

2. **Device Registry**

   - Custom Rust service
   - JWT-based auth
   - Device metadata in PostgreSQL

3. **NEX Workloads**
   - Event handlers (MQTT → NATS transform)
   - Stream processors (data validation, routing)
   - Deploy via NEX CLI

**Success Criteria**:

- [ ] MQTT devices publishing to plant NATS
- [ ] Device registry operational
- [ ] NEX workloads processing device events

---

### Phase 3: Lakehouse + Analytics (Week 4)

**Goal**: Historical data storage and federated query.

**Components**:

1. **Iceberg Tables**

   - S3/MinIO object storage
   - Iceberg metadata in PostgreSQL
   - Trino Iceberg catalog

2. **pg_mooncake Extension**

   - Install in PostgreSQL
   - Configure Iceberg backend
   - Hot/cold data tiering

3. **TimescaleDB**
   - Hypertables for time-series data
   - Compression policies
   - Trino connector

**Success Criteria**:

- [ ] Iceberg tables created, queryable via Trino
- [ ] pg_mooncake operational, data tiering working
- [ ] TimescaleDB hypertables ingesting metrics

---

### Phase 4: Real-Time Collaboration (Week 5)

**Goal**: CRDT sync for multi-user editing.

**Components**:

1. **Yjs + Y-Sweet**

   - Y-Sweet server deployment
   - NATS backend for sync
   - WebSocket connections from Tauri/web

2. **CRDT Sync Service**
   - Custom Rust service
   - Publish CRDT updates to NATS
   - Store snapshots in PostgreSQL

**Success Criteria**:

- [ ] Yjs documents syncing across clients
- [ ] NATS propagating CRDT updates
- [ ] Snapshots persisted for recovery

---

### Phase 5: Blockchain Integration (Week 6)

**Goal**: On-chain data access and smart contract interaction.

**Components**:

1. **Sui Indexer**

   - The Graph subgraph for Sui
   - Trino connector for Sui GraphQL API
   - Custom Rust indexer (alternative)

2. **Chainlink Oracles**

   - Deploy oracle nodes
   - Data feeds for on-chain triggers
   - Smart contract integration

3. **Solana Indexer** (optional)
   - Geyser plugin or RPC polling
   - Custom Rust indexer

**Success Criteria**:

- [ ] Trino querying Sui on-chain data
- [ ] Chainlink oracles operational
- [ ] Smart contracts interacting with TMNL data

---

### Phase 6: Custom Observability (Week 7)

**Goal**: NATS-backed logging and tracing.

**Components**:

1. **Log Aggregator** (Rust)

   - Consume logs from NATS
   - Index in PostgreSQL + TimescaleDB
   - Query API (GraphQL)

2. **Trace Aggregator** (Rust)

   - Consume Effect spans from NATS
   - Store in TimescaleDB
   - Visualization UI (TypeScript + Effect)

3. **Alerting Engine** (Rust)
   - Rule engine (CEP-style)
   - Publish alerts to NATS
   - Notification handlers (Slack, Discord, webhook)

**Success Criteria**:

- [ ] Logs aggregated from all tiers
- [ ] Traces visualized with Effect spans
- [ ] Alerts firing on threshold breaches

---

### Phase 7: Operators (Week 8+)

**Goal**: Automate infrastructure management.

**Operators to Build**:

1. **PostgreSQL Operator** (Pepr Rust SDK)

   - Schema migrations (Effect SQL)
   - Backups (WAL archiving)
   - Connection pooling (PgBouncer management)

2. **NATS Operator** (Pepr Rust SDK)

   - Stream lifecycle (create/delete)
   - NEX workload deployment
   - Cluster federation

3. **Trino Operator** (Pepr Rust SDK)

   - Catalog management
   - Worker autoscaling
   - Query routing

4. **AVA View Operator** (Pepr TypeScript + Effect)
   - ViewProfileSpec → k8s resources
   - Subgraph registration
   - View lifecycle management

**Success Criteria**:

- [ ] Operators managing infrastructure declaratively
- [ ] CRDs registered, kubectl apply working
- [ ] Effect integration for TypeScript operators

---

## Technology Research Required

### High Priority (Before Phase 0)

1. **Pepr Rust SDK**

   - Capabilities vs kube-rs
   - Effect integration feasibility
   - Performance characteristics

2. **pg_mooncake**

   - Installation process
   - Iceberg integration
   - PostgreSQL version compatibility

3. **NEX**

   - Workload packaging (Wasm, native)
   - NATS integration
   - Deployment models

4. **ElectricSQL**
   - CRDT conflict resolution
   - Postgres NOTIFY integration
   - Performance at scale

### Medium Priority (Phase 1-3)

5. **rmqtt**

   - NATS bridge capabilities
   - Authentication/authorization
   - Performance vs EMQX

6. **Y-Sweet**

   - NATS backend support
   - Deployment architecture
   - Snapshot persistence

7. **Cilium**
   - eBPF policy examples
   - Service mesh integration
   - Observability hooks

### Low Priority (Phase 4+)

8. **Sui GraphQL API**

   - Query capabilities
   - Trino connector approach
   - Indexing strategies

9. **Wasmcloud**
   - NEX coexistence model
   - Actor deployment
   - Metrics aggregation patterns

---

## Risk Mitigation

### Risk 1: Complexity Overload

**Risk**: Too many moving parts for solo developer.

**Mitigation**:

- Phased rollout (one component at a time)
- Use managed services where appropriate (Neon for Postgres in prod)
- Automate via operators (invest in tooling upfront)
- Document everything (architecture, runbooks, troubleshooting)

### Risk 2: Pepr Rust SDK Immaturity

**Risk**: Rust SDK may lack features vs TypeScript version.

**Mitigation**:

- Evaluate Rust SDK thoroughly before committing
- Fallback: Use kube-rs directly
- Hybrid: Use Pepr TS for some operators, Rust for others

### Risk 3: NEX Production Readiness

**Risk**: NEX is relatively new, may have edge cases.

**Mitigation**:

- Start with simple workloads (event handlers)
- Gradual rollout to production
- Fallback: Deploy functions as k8s pods

### Risk 4: ElectricSQL Scale

**Risk**: ElectricSQL syncing 100+ edge nodes may hit limits.

**Mitigation**:

- Start with small deployments
- Monitor sync performance
- Fallback: Custom replication via NATS

### Risk 5: Multi-Tier NATS Federation

**Risk**: NATS super cluster across plants may have latency/split-brain issues.

**Mitigation**:

- Design for eventual consistency
- Use JetStream with appropriate replication factors
- Test failure scenarios (network partition, node failures)

---

## Success Metrics

### Technical Metrics

- **Query latency**: Trino federated queries < 100ms p99
- **Sync latency**: ElectricSQL changes propagate < 500ms
- **Event latency**: NATS publish → consume < 10ms
- **Uptime**: 99.9% availability for core services

### Developer Experience Metrics

- **Time to deploy**: New service from zero → production < 1 hour
- **Time to debug**: Issue identification via observability < 5 minutes
- **Deployment confidence**: Automated tests + canary deployments

### Business Metrics

- **Devices supported**: 1000+ devices per plant
- **Concurrent users**: 100+ users collaborating real-time
- **Data volume**: 100GB+ in lakehouse

---

## Open Questions

### OQ-1: Pepr Rust SDK vs kube-rs

**Question**: Which provides better DX for custom operators?

**Action**: Research Pepr Rust SDK documentation, test simple operator.

### OQ-2: NATS JetStream Replication Factor

**Question**: What replication factor for multi-plant deployments?

**Action**: Test latency/throughput with R=1, R=3, R=5.

### OQ-3: Trino Worker Sizing

**Question**: How many workers per plant? How to scale?

**Action**: Load test with sample queries, measure CPU/memory.

### OQ-4: Blockchain Indexer Strategy

**Question**: The Graph vs custom Rust indexer?

**Action**: Prototype both, evaluate latency/cost/complexity.

---

## Conclusion

This architecture represents a **highly ambitious distributed data platform** for a solo developer. Success depends on:

1. **Phased rollout** — Deploy incrementally, validate each phase
2. **Automation** — Invest in operators and tooling early
3. **Ruthless prioritization** — MVP requires PostgreSQL + NATS + Trino + Cosmo + IoT gateway + CRDT sync
4. **Risk management** — Spike on unknowns (Pepr Rust SDK, NEX, ElectricSQL) before full commitment

**Val's Assessment**: Achievable, but only with disciplined execution. The foundation (Phase 0) is critical — get that right, everything else follows.

**Next Step**: Research Pepr Rust SDK capabilities and NEX deployment models. Prime needs to answer: "What does Pepr Rust SDK actually offer?"

---

**Signed**: Val (Vigilant Architecture Layer)  
**Date**: 2024-12-15  
**Status**: Ready for Implementation

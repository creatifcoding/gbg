# TMNL Infrastructure — Val's Follow-up Questions

**Date**: 2024-12-15
**Context**: Based on your initial questionnaire responses
**Purpose**: Hone in on architectural decisions before synthesis

---

## Key Themes Identified

From your answers, I've identified a **highly ambitious, enterprise-grade stack**:

1. **Custom Operators Everywhere** — Pepr Rust SDK for PostgreSQL, NATS, everything
2. **NATS + NEX as Backbone** — Event sourcing, pub/sub, work queues, real-time, RPC
3. **Rust-First Philosophy** — Always prefer Rust when possible
4. **Lakehouse Architecture** — NATS + Iceberg for caching (not Redis)
5. **Trino Query Federation** — Multi-tier data access
6. **Heavy Extensions** — PostGIS, TimescaleDB, pgvector, pg_mooncake, ElectricSQL
7. **Wasmcloud** — For metrics aggregation and edge compute
8. **Custom Observability** — Not satisfied with off-the-shelf logging/tracing

This is **not** a standard k8s deployment. This is a **distributed data platform**.

---

## SECTION A: Pepr Rust SDK Strategy

You mentioned "Pepr Rust SDK" multiple times. This is critical to clarify:

### A.1 Pepr SDK Status

Pepr is currently **TypeScript-only** (uses ts-node, compiles to JS, runs in k8s as a controller).

**Question**: When you say "Pepr Rust SDK", do you mean:

- [ ] **A)** Build a Rust equivalent of Pepr from scratch (new project)
- [ ] **B)** Write Rust services that Pepr (TS) orchestrates via CRDs
- [ ] **C)** Use kube-rs directly (Rust k8s client) instead of Pepr
- [x] **D)** Something else I'm missing?

Yes something else you're missing but you don't have to miss it perse. You can willfully search up and understand this new technology. ask me about it.

### A.2 Operator Scope

If we're building custom operators (in Rust or TS), which get priority?

Rank 1-5 (1 = first):

These are all top priority. I like inheritance, and since we're using Pepr, we can wrap it in Effect and get our DI super powers via effect services, also justg the usual benefits of literally everything including Schema, Result types, novel things like graph, workflow, Effect cluster, RPC, stream etc. We'll figure out what effect patterns to apply and how for Effectful operator authorship
- [x] **PostgreSQL Operator** (schema migrations, backups, pooling)
- [x] **NATS/NEX Operator** (stream lifecycle, workload deployment)
- [x] **AVA View Operator** (ViewProfileSpec → k8s resources)
- [x] **Cosmo Subgraph Operator** (already exists, extend?)
- [x] **Trino Operator** (catalog management, query routing)

### A.3 kube-rs vs Pepr

If going Rust for operators, **kube-rs** is the standard library.

**Question**: Should we:

- [ ] **A)** Migrate existing Pepr CRDs (CosmoRouter, CosmoSubgraph) to kube-rs?
- [ ] **B)** Keep Pepr for Cosmo, use kube-rs for new operators?
Lol you need to understand Pepr's rust offerings first.
- [ ] **C)** Evaluate both, decide per-operator?

---

## SECTION B: NATS + NEX Deep Dive

You emphasized **NEX WILL BE USED PROFUSELY**. NEX is NATS Execution Engine — serverless functions on NATS.

### B.1 NEX Workload Types

What workloads will run on NEX?

- [ ] **Event handlers** (react to NATS messages, transform, route)
- [ ] **Scheduled jobs** (cron-like, triggered by NATS)
- [ ] **Request-reply services** (RPC over NATS)
- [ ] **Stream processors** (continuous transformations)
- [ ] **Edge functions** (deployed to leaf nodes)
- [x] **All of the above**

### B.2 NEX Runtime

NEX supports multiple runtimes:

- [ ] **Wasm** (sandboxed, portable)
- [ ] **Native binaries** (Rust, Go)
- [ ] **JavaScript/Deno** (if added)

**Question**: Primary runtime preference?
Honestly? WASM and native binaries? This is data fabric stuff, so needs to be super fast. Javascript via Effect is for interconnecting with the last mile presentation layer things/typescript ecosystem.

### B.3 NEX vs Wasmcloud

You also mentioned **Wasmcloud** for metrics aggregation.

**Question**: How do NEX and Wasmcloud coexist?

- [ ] **A)** NEX for NATS-centric workloads, Wasmcloud for capability-based actors
- [ ] **B)** Wasmcloud as primary, NEX as lightweight alternative
- [ ] **C)** Evaluating both, haven't decided
- [ ] **D)** Wasmcloud replaces NEX long-term

### B.4 Dynamic Ephemeral Streams

You said streams will be "dynamic, ephemeral instantiation."

**Question**: What triggers stream creation/destruction?

- [ ] **User sessions** (stream per user/tenant)
- [ ] **Workflow instances** (stream per workflow run)
- [ ] **Device connections** (stream per IoT device)
- [ ] **Query contexts** (stream per Trino query)
- [ ] **Other**: **\_\_\_**

---

## SECTION C: Lakehouse Architecture (NATS + Iceberg)

You mentioned "caching built from ground up via NATS and Iceberg shenanigans."

### C.1 Iceberg Integration

Apache Iceberg is a table format for data lakes. How does it fit?

**Question**: Where does Iceberg live?

- [ ] **A)** PostgreSQL with pg_mooncake extension (Iceberg tables in Postgres)
- [ ] **B)** Object storage (S3/MinIO) with Iceberg metadata
- [ ] **C)** Both — hot data in Postgres, cold in object storage
- [ ] **D)** Trino queries across both via Iceberg connector

### C.2 NATS as Cache

Traditional caches (Redis) are key-value. NATS is pub/sub + streaming.

**Question**: What's the caching model?

- [ ] **A)** JetStream as durable cache (key-value buckets)
- [ ] **B)** NATS subjects as cache keys, messages as values
- [ ] **C)** Object Store (NATS built-in S3-like API)
- [ ] **D)** Custom Rust service on top of NATS

### C.3 Cache Invalidation

The hardest problem in CS. How do you envision invalidation?

- [ ] **A)** TTL-based (messages expire)
- [ ] **B)** Event-driven (invalidation events on NATS)
- [ ] **C)** Version-based (Iceberg snapshots as versions)
- [ ] **D)** Hybrid — depends on data type

---

## SECTION D: Trino Query Federation

You added "SECTION X: TRINO — we need it ASAP."

### D.1 Trino Data Sources

What will Trino query?

- [ ] **PostgreSQL** (primary OLTP)
- [ ] **Iceberg tables** (lakehouse)
- [ ] **NATS Object Store** (blob data)
- [ ] **ElectricSQL** (local-first SQLite replicas)
- [ ] **External APIs** (via custom connectors?)
- [ ] **TimescaleDB** (time-series hypertables)

### D.2 Trino Deployment

- [ ] **Single coordinator** (dev)
- [ ] **Coordinator + workers** (how many workers?)
- [ ] **Autoscaled workers** (scale with query load)

### D.3 Multi-Tier Architecture

You mentioned "line vs plant" and "no device-level cluster, just leaf virtualization."

**Question**: Can you elaborate on the tier topology?

```
┌─────────────────────────────────────────────────────┐
│                  Central Cluster                     │
│            (Trino Coordinator, Cosmo)               │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Plant A │   │ Plant B │   │ Plant C │
   │ (k3d?)  │   │ (k3d?)  │   │ (k3d?)  │
   └────┬────┘   └────┬────┘   └────┬────┘
        │             │             │
   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
   │ Line 1  │   │ Line 1  │   │ Line 1  │
   │ Line 2  │   │ Line 2  │   │ Line 2  │
   │ (NATS?) │   │ (NATS?) │   │ (NATS?) │
   └─────────┘   └─────────┘   └─────────┘
```

Something like this, we'll actually have our own "stack" perse, per layers. 

**Questions**:

1. Does each **plant** have its own k8s cluster or namespace?
Yes to both.
2. Does each **line** have NATS leaf nodes?
Correct. They may optionally have a deployment.
3. Where does **Trino** query — only central, or federated to plant clusters?
Federated to plant clusters.
4. How do **devices** connect? NATS leaf? MQTT bridge? Direct to plant NATS?
MQTT bridge and NATS. Really we have a by any means necessary policy for uplink, but we'll support MQTT and NATS initially, considering it's ubiquity.

---

## SECTION E: ElectricSQL + Local-First

You mentioned ElectricSQL for "durable streams."

### E.1 ElectricSQL Role

ElectricSQL syncs Postgres ↔ SQLite (local-first).

**Question**: Where does local SQLite live?

- [x] **Tauri app** (user's device)
- [x] **Edge nodes** (plant/line level)
- [x] **IoT devices** (embedded SQLite)
- [x] **All of the above**

### E.2 Sync Topology

- [ ] **Central Postgres → Edge SQLite** (read replicas)
- [x] **Bidirectional sync** (writes from edge)
- [x] **Conflict resolution** (CRDTs? Last-write-wins?)
CRDT's. 

### E.3 Integration with NATS

How do ElectricSQL changes propagate?

- [x] **Postgres NOTIFY → NATS bridge**
Event source. We'll have several different change classes. Not all of them need to be "pushed" to NATS.
- [x] **Electric sync protocol → NATS events**
- [ ] **Separate systems** (no direct integration)

---

## SECTION F: Custom Observability

You want custom logging and tracing. This is a significant undertaking.

### F.1 Why Custom?

What's missing from existing solutions (Loki, Jaeger, Tempo)?

- [x] **Domain-specific semantics** (Effect spans, AVA view traces)
- [x] **Integration with NATS** (logs/traces as NATS messages)
I want to couple logging with NATS jetstream, this will allow me to build the custom solution I \have yet to define.
- [x] **Multi-tier aggregation** (plant → central)
Indeed.
- [ ] **Real-time alerting** (not batch-oriented)
This is one of the core concerns.
- [ ] **Cost** (self-hosted, no SaaS)
Self-hosted for now. The idea is that peers and tenants spin up and own the infra, I do want to offer a strong supercluster backed possibly by Sui in some form or fashion, thusly allowing
- [ ] **Other**: **\_\_\_**

### F.2 Custom Service Scope

What should the custom observability service do?

- [ ] **Log aggregation** (collect, index, query)
- [ ] **Trace aggregation** (span collection, visualization)
- [ ] **Metrics aggregation** (Wasmcloud handles this?)
- [ ] **Alerting engine** (rules, notifications)
- [x] **All of the above**

### F.3 Implementation Language

- [ ] **Rust** (performance, concurrency)
- [ ] **TypeScript** (Effect integration)
- [x] **Both** (Rust core, TS integration layer)

---

## SECTION G: IoT + Edge Computing

You checked IoT device integration.

### G.1 Protocol Support

- [x] **MQTT** (standard IoT protocol)
- [x] **NATS leaf nodes** (native NATS on devices)
- [ ] **CoAP** (constrained devices)
- [x] **Custom protocol** (proprietary devices)
- [x] **All of the above**

### G.2 MQTT-NATS Bridge

If MQTT devices exist, how do they reach NATS?

- [ ] **EMQX** (MQTT broker with NATS bridge)
- [ ] **VerneMQ** (alternative broker)
- [ ] **Custom bridge** (Rust service)
- [x] **NATS native MQTT** (NATS server supports MQTT)
We will also utilize rmqtt.

### G.3 Device Identity

How are devices authenticated?

- [ ] **Certificates** (mTLS)
- [x] **Tokens** (JWT, API keys)
- [x] **Device registry** (custom service)
- [ ] **Cloud provider IoT** (AWS IoT Core, Azure IoT Hub)

---

## SECTION H: Blockchain/Web3

You checked blockchain integration.

### H.1 Use Case

What's the blockchain use case?

- [x] **Supply chain provenance** (track assets on-chain)
- [x] **Smart contracts** (automated agreements)
- [x] **Token-gated access** (NFTs, credentials)
- [x] **Decentralized identity** (DID, verifiable credentials)
- [x] **Data notarization** (hash anchoring)
- [ ] **Other**: **\_\_\_**

### H.2 Chain(s)

Which blockchain(s)?

Sui & Chainlink is the bread and butter. And where we build a vast majority of the functionality. 

- [ ] **Ethereum / L2s** (Arbitrum, Optimism, Base)
- [x] **Solana**
- [ ] **Cosmos ecosystem**
- [ ] **Private/permissioned** (Hyperledger, Polygon Edge)
- [x] **Chain-agnostic** (support multiple)

### H.3 Indexing

How do you query on-chain data?

- [x] **The Graph** (subgraphs)
Sui has pretty nice GraphQL support. We can also write custom services in Rust/Typescript
- [ ] **Custom indexer** (Rust, listen to events)
- [ ] **Third-party APIs** (Alchemy, Infura)
- [x] **Trino connector** (federated query to chain data)

---

## SECTION I: Real-Time Collaboration (CRDT)

You checked real-time collaboration.

### I.1 Collaboration Scope

What's being collaborated on?

- [ ] **Documents** (text, rich text)
- [ ] **Canvas** (tldraw, whiteboard)
- [ ] **Data grids** (AG-Grid shared editing)
- [ ] **Workflows** (multi-user process design)
- [ ] **Code** (pair programming)
- [x] **All of the above**

### I.2 CRDT Library

- [x] **Yjs** (popular, mature)
- [ ] **Automerge** (Rust + JS)
- [ ] **Diamond Types** (Rust, high performance)
- [ ] **Custom** (domain-specific CRDTs)
- [ ] **Evaluating**

### I.3 Sync Backend
Y-Sweet
- [x] **NATS** (CRDT updates as messages)
- [ ] **WebSocket server** (dedicated sync service)
- [ ] **ElectricSQL** (CRDT-like sync)
- [ ] **Liveblocks/Partykit** (managed service)

---

## SECTION J: Unanswered Sections

The following sections had no responses. Should we:

### J.1 Sections 8-11 (Deployment, Security, Dev Workflow, Nix)

- [ ] **Skip for now** — focus on data platform first
- [x] **Use sensible defaults** — Val decides, you approve
- [ ] **Fill out later** — come back after architecture solidifies

### J.2 Sections 13-15 (Performance, DR, Cost)

- [x] **Skip for now** — premature optimization
- [ ] **Use sensible defaults** — Val decides
- [ ] **Critical** — need answers before proceeding

### J.3 Timeline & Team Size (Section 16)

This affects everything. Please answer:

**Timeline**:

- [x] **Immediate** (this week)
- [ ] **Short-term** (this month)
- [ ] **Mid-term** (this quarter)
- [ ] **Long-term** (6+ months)

**Team Size**:

- [x] **Solo** (you)
- [ ] **2-5 people**
- [ ] **5+ people**

---

## SECTION K: Priority Stack

Given everything above, what's the **critical path** for first deployment?

Rank your top 5 (1 = deploy first):

- [1] PostgreSQL (with extensions)
- [1] NATS + JetStream
- [1] NEX (serverless on NATS)
- [1] Trino
- [1] Cosmo GraphQL Federation
- [ ] Wasmcloud
- [ ] ElectricSQL
- [ ] Custom Observability
- [1] IoT/MQTT Bridge
- [ ] Blockchain Indexer
- [1] CRDT Sync Service

Honestly? The MVP requires all of this.
---

## Val's Preliminary Observations

### Architecture Pattern: Data Mesh + Event Mesh

You're building a **federated data platform** where:

- **NATS** is the nervous system (events, commands, queries)
- **Trino** is the query brain (federated SQL)
- **Iceberg** is long-term memory (lakehouse)
- **ElectricSQL** is local memory (edge caching)
- **NEX/Wasmcloud** is reflexes (serverless compute)
- **PostgreSQL** is the spine (OLTP, extensions)

### Risk Areas

1. **Complexity** — This is a lot of moving parts. Phased rollout is essential.
2. **Custom Operators** — Writing k8s operators is non-trivial. kube-rs learning curve.
3. **NATS as Cache** — Unconventional. May need custom tooling.
4. **Multi-Tier** — Plant/line topology needs careful NATS federation design.
5. **ElectricSQL** — Still maturing. May hit edge cases.

### Recommended Phase 0 (Foundation)

Before anything else:

1. **NATS cluster** — Single source of events
2. **PostgreSQL** — With pg_mooncake, pgvector, PostGIS
3. **Cosmo Router** — GraphQL gateway
4. **Basic Trino** — Query Postgres + future Iceberg

Everything else builds on this foundation.

---

## Next Steps

1. **Answer follow-up questions** in this document
2. **Val synthesizes** into architecture decision record
3. **Prioritize Phase 0** components
4. **Spike** on riskiest elements (NEX, pg_mooncake, kube-rs operator)
5. **Build**

---

**Prime, your move.** Fill in what you can, flag what needs discussion.

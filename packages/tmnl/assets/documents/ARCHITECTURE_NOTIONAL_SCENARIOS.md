# Architecture Exploration via Notional Examples

**Date**: 2025-12-15  
**Author**: Baby Val (Infrastructure Specialist)  
**Purpose**: Stress-test Phase 0 infrastructure through concrete scenarios to reveal design decisions

---

## Scenario 1: Asset Lifecycle Event Storm

### The Situation

You're tracking **10,000 assets** across a facility. Every 5 seconds, each asset reports:

- Location (GPS coordinates)
- Status (operational, maintenance, failed)
- Sensor readings (temperature, vibration, pressure)

**That's 2,000 events/second flowing into the system.**

### Questions

**Q1.1: Event Ingestion Architecture**

How should these events flow through the system?

```
Option A: Direct to PostgreSQL
Device → MQTT → PostgreSQL INSERT
├─ Pro: Simple, relational guarantees
└─ Con: PostgreSQL write bottleneck, 2000 writes/sec

Option B: NATS → PostgreSQL (async)
Device → MQTT → NATS → Stream Processor → PostgreSQL
├─ Pro: NATS buffers spikes, backpressure handling
└─ Con: Additional latency, eventual consistency

Option C: NATS → PostgreSQL + Iceberg (hot/cold)
Device → MQTT → NATS → Hot (Postgres) + Cold (Iceberg)
├─ Pro: Recent data fast, historical data cheap
└─ Con: Complex tiering logic, dual storage

Option D: Something else entirely
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q1.2: Query Pattern**

When a user opens the Asset Dashboard, they want to see:

- Latest status of all 10,000 assets
- Assets in "failed" state (top priority)
- Timeline of status changes for last 24 hours

```
Option A: Query PostgreSQL directly
SELECT * FROM ams.assets WHERE status = 'failed'
├─ Pro: Simple, ACID guarantees
└─ Con: Full table scan on 10k rows + joins

Option B: Materialized view in PostgreSQL
CREATE MATERIALIZED VIEW ams.failed_assets AS ...
REFRESH MATERIALIZED VIEW CONCURRENTLY ...
├─ Pro: Fast reads, precomputed
└─ Con: Refresh lag, storage overhead

Option C: NATS KV bucket (cache)
Asset updates → NATS stream → KV bucket (latest state)
Query KV for current state, Postgres for history
├─ Pro: Sub-millisecond reads, event-sourced
└─ Con: Dual state, consistency concerns

Option D: Trino federated query
Trino → PostgreSQL (hot) + Iceberg (cold)
├─ Pro: Unified query interface
└─ Con: Query latency, Trino overhead
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q1.3: Real-time Dashboard Updates**

Assets are changing state constantly. The dashboard needs live updates.

```
Option A: Polling (client polls every 5s)
Client → GraphQL query every 5s
├─ Pro: Simple, stateless
└─ Con: Wasteful, max 5s latency

Option B: GraphQL Subscriptions
Client ←→ GraphQL subscription over WebSocket
├─ Pro: Real-time, only changed data
└─ Con: Connection management, scaling

Option C: NATS WebSocket (direct)
Client ←→ NATS over WebSocket → events
├─ Pro: No GraphQL overhead, native NATS
└─ Con: Client knows NATS topology, security

Option D: SSE (Server-Sent Events)
Client ← SSE stream ← NATS consumer
├─ Pro: One-way, simple, HTTP/2 friendly
└─ Con: One-directional only
```

**Your preference?** (A/B/C/D)  
**Why?**

---

## Scenario 2: AVA View Reconciliation at Scale

### The Situation

AVA (Asset View Agent) compiles **ViewProfileSpecs** into DataFusion queries. A single view might:

- Join 5 data sources (PostgreSQL, NATS KV, Iceberg, blockchain, external API)
- Filter 100k rows down to 50
- Apply aggregations (AVG, SUM, GROUP BY)
- Refresh every 10 seconds

**You have 100 active views across 50 users.**

### Questions

**Q2.1: View Compilation Strategy**

```
Option A: Compile on every view mount
User opens dashboard → compile ViewProfileSpec → execute
├─ Pro: Always fresh, no caching complexity
└─ Con: Compilation overhead, CPU waste

Option B: Cache compiled plans (in-memory)
First mount → compile + cache, subsequent → use cache
├─ Pro: Faster, reduced compilation
└─ Con: Stale after schema changes, invalidation needed

Option C: Pre-compile common views (build-time)
CI/CD → compile view specs → deploy as static artifacts
├─ Pro: Zero runtime compilation
└─ Con: Inflexible, no dynamic views

Option D: JIT + persistent cache
Compile → cache in PostgreSQL → load on startup
├─ Pro: Survives restarts, shared across pods
└─ Con: Cache invalidation complexity
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q2.2: View Result Caching**

100 users viewing the same "Fleet Status" view shouldn't run 100 identical queries.

```
Option A: Application-level cache (in-process)
ViewManager → LRU cache → TTL 10s
├─ Pro: Simple, fast
└─ Con: Doesn't scale across pods

Option B: NATS KV bucket (distributed cache)
ViewManager → NATS KV (TTL 10s)
├─ Pro: Shared across pods, pub/sub invalidation
└─ Con: Serialization overhead, network hop

Option C: PostgreSQL materialized view
CREATE MATERIALIZED VIEW FOR EACH AVA VIEW
├─ Pro: Persistent, queryable via Trino
└─ Con: Refresh complexity, schema bloat

Option D: No caching (always fresh)
Every request → fresh query
├─ Pro: Always accurate
└─ Con: Expensive, doesn't scale
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q2.3: Cross-Source Joins**

AVA needs to join:

- `ams.assets` (PostgreSQL)
- `latest_readings` (NATS KV bucket)
- `maintenance_history` (Iceberg lakehouse)
- `asset_metadata` (Sui blockchain via RPC)

```
Option A: DataFusion handles it
DataFusion → custom TableProvider for each source
├─ Pro: Unified SQL, powerful optimizer
└─ Con: Custom connectors for NATS/blockchain

Option B: Trino handles it
Trino → PostgreSQL + Iceberg + custom NATS connector
├─ Pro: Mature connectors, distributed execution
└─ Con: Trino overhead, latency

Option C: Manual orchestration
Fetch from each source → merge in Rust
├─ Pro: Full control, optimized
└─ Con: Manual join logic, no optimizer

Option D: Pre-aggregate into PostgreSQL
ETL pipeline → materialize joined data in Postgres
├─ Pro: Fast queries, single source
└─ Con: Staleness, ETL complexity
```

**Your preference?** (A/B/C/D)  
**Why?**

---

## Scenario 3: Blockchain Data Sync

### The Situation

You have smart contracts on **Sui blockchain** tracking asset ownership. When ownership changes:

1. On-chain event emitted
2. TMNL needs to update `chain.asset_ownership` table
3. Trigger AVA view refresh for affected assets

**100 ownership changes/day, but need to handle spikes (1000/hour during auctions).**

### Questions

**Q3.1: Event Indexing Architecture**

```
Option A: Direct RPC polling
Cron job → Sui RPC → poll for events → insert Postgres
├─ Pro: Simple, no dependencies
└─ Con: Polling lag, RPC rate limits

Option B: The Graph subgraph
Deploy subgraph → indexes events → GraphQL API → TMNL
├─ Pro: Mature, reliable, handles reorgs
└─ Con: Hosted service cost, latency

Option C: Custom indexer (Rust)
WebSocket → Sui node → stream events → NATS → Postgres
├─ Pro: Real-time, full control, NATS integration
└─ Con: Custom code, handle reorgs manually

Option D: Chainlink oracle
Smart contract → Chainlink → HTTP callback → TMNL
├─ Pro: Decentralized, reliable
└─ Con: Oracle cost, callback complexity
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q3.2: On-Chain Data Availability**

Some asset metadata lives on-chain (IPFS CIDs, ownership proofs). Do we:

```
Option A: Store on-chain data in PostgreSQL
Indexer → fetch from chain → insert Postgres
├─ Pro: Fast queries, no chain dependency
└─ Con: Duplication, staleness risk

Option B: Query on-demand via RPC
User query → Trino → Sui RPC connector → fetch live
├─ Pro: Always fresh, no storage
└─ Con: RPC latency, rate limits

Option C: Hybrid (cache in NATS KV)
First query → RPC → cache in NATS KV (TTL 1h)
├─ Pro: Fast + eventually fresh
└─ Con: Cache invalidation on reorg

Option D: Decentralized storage (IPFS)
Store in IPFS → pin on local node → PostgreSQL just stores CID
├─ Pro: Immutable, verifiable
└─ Con: IPFS complexity, availability
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q3.3: Multi-Chain Support**

You said Sui primary, Solana secondary. Do we:

```
Option A: Separate indexers per chain
sui-indexer → chain.sui_events
solana-indexer → chain.solana_events
├─ Pro: Isolated, independent
└─ Con: Code duplication, no unified view

Option B: Unified indexer (Rust trait abstraction)
trait ChainIndexer { ... }
impl ChainIndexer for SuiIndexer { ... }
impl ChainIndexer for SolanaIndexer { ... }
├─ Pro: Shared logic, DRY
└─ Con: Lowest-common-denominator API

Option C: Trino connector per chain
Trino → sui_catalog, solana_catalog
Federated query across chains
├─ Pro: SQL joins across chains
└─ Con: Trino complexity, latency

Option D: Event normalization layer
Chain events → normalized format → single schema
├─ Pro: Unified downstream, simple queries
└─ Con: Lost chain-specific data, mapping complexity
```

**Your preference?** (A/B/C/D)  
**Why?**

---

## Scenario 4: User Authentication & Multi-Tenancy

### The Situation

TMNL is used by **3 organizations** (tenants), each with **10-50 users**. Each tenant has isolated data (assets, views, settings).

### Questions

**Q4.1: Tenant Isolation Model**

```
Option A: Database-per-tenant
CREATE DATABASE tenant_a; CREATE DATABASE tenant_b;
├─ Pro: Hard isolation, independent scaling
└─ Con: Schema migration hell, connection pool explosion

Option B: Schema-per-tenant
CREATE SCHEMA tenant_a; CREATE SCHEMA tenant_b;
├─ Pro: Easier migrations, shared connection pool
└─ Con: Row-level security complexity

Option C: Row-level security (RLS)
Single schema, WHERE tenant_id = $1 on every query
├─ Pro: Simple schema, flexible
└─ Con: Query complexity, accidental leaks

Option D: Namespace-per-tenant (k8s)
Deploy separate TMNL stack per tenant
├─ Pro: Perfect isolation, no shared fate
└─ Con: Resource waste, operational overhead
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q4.2: Authentication**

```
Option A: JWT (self-signed)
TMNL issues JWT → validates on each request
├─ Pro: Stateless, simple
└─ Con: No revocation, rotation complexity

Option B: Session-based (Redis/NATS KV)
Login → session ID → store in NATS KV
├─ Pro: Revocable, server-controlled
└─ Con: Stateful, NATS dependency

Option C: OAuth2/OIDC (external provider)
Auth0, Keycloak, Cognito
├─ Pro: Mature, MFA, SSO
└─ Con: External dependency, cost

Option D: Blockchain wallet auth
Sign message with wallet → verify on-chain identity
├─ Pro: Decentralized, no passwords
└─ Con: UX complexity, wallet dependency
```

**Your preference?** (A/B/C/D)  
**Why?**

---

## Scenario 5: Schema Evolution

### The Situation

You deploy TMNL v1.0 with schema version 1. Six months later, v1.5 needs:

- New column: `ams.assets.location_history` (JSONB array)
- Renamed column: `status` → `operational_state`
- New table: `ams.asset_relationships` (many-to-many)

**You have 50 existing assets in production.**

### Questions

**Q5.1: Migration Strategy**

```
Option A: Direct ALTER TABLE (downtime)
Stop app → ALTER TABLE → start app
├─ Pro: Simple, guaranteed consistency
└─ Con: Downtime (unacceptable?)

Option B: Blue-green deployment
Deploy v1.5 schema in new database → migrate data → switch
├─ Pro: Zero downtime
└─ Con: Dual-write period, cutover risk

Option C: Expand-contract pattern
1. Expand: Add new column (nullable)
2. Dual-write: Write to both old + new
3. Backfill: Migrate old data
4. Contract: Drop old column
├─ Pro: Zero downtime, gradual
└─ Con: Complex, multi-step

Option D: Schema versioning (multi-version)
Support v1 + v1.5 schemas simultaneously
├─ Pro: Gradual rollout, rollback safe
└─ Con: Code complexity, version sprawl
```

**Your preference?** (A/B/C/D)  
**Why?**

---

**Q5.2: Effect Schema Integration**

AVA uses Effect Schema extensively. Do migrations:

```
Option A: Generate migrations from Effect Schemas
Schema.make(Asset, { ... }) → detect changes → SQL migration
├─ Pro: Single source of truth, DRY
└─ Con: Codegen complexity, custom tooling

Option B: Manual SQL + manual schema updates
Write SQL migration, update Effect Schema separately
├─ Pro: Full control, standard tools
└─ Con: Drift risk, duplication

Option C: Schema-first (Postgres DDL is truth)
Introspect PostgreSQL → generate Effect Schemas
├─ Pro: Database is canonical
└─ Con: Loses Effect Schema features (brands, transforms)

Option D: Runtime validation only
No schema sync, just validate at query time
├─ Pro: Flexible, decoupled
└─ Con: Runtime errors, no compile-time safety
```

**Your preference?** (A/B/C/D)  
**Why?**

---

## Summary: 5 Scenarios, 15 Questions

| Scenario                 | Questions        | Focus Area                                    |
| ------------------------ | ---------------- | --------------------------------------------- |
| **S1: Event Storm**      | Q1.1, Q1.2, Q1.3 | Ingestion, query patterns, real-time updates  |
| **S2: AVA at Scale**     | Q2.1, Q2.2, Q2.3 | View compilation, caching, cross-source joins |
| **S3: Blockchain Sync**  | Q3.1, Q3.2, Q3.3 | Event indexing, on-chain data, multi-chain    |
| **S4: Multi-Tenancy**    | Q4.1, Q4.2       | Tenant isolation, authentication              |
| **S5: Schema Evolution** | Q5.1, Q5.2       | Migrations, Effect Schema integration         |

---

## How to Use This Document

1. **Answer questions** that interest you (any/all, in any order)
2. **Provide reasoning** for your choices
3. **Baby Val will**:
   - Refine architecture based on answers
   - Generate concrete implementation plans
   - Update ADR-001 with design decisions
   - Create Phase 1+ implementation roadmaps

---

**Status**: Awaiting Prime's answers  
**Next**: Architecture refinement based on responses

# Research: Sui Blockchain + Effect-TS Integration for Manufacturing Commons

```
Document:     research-sui-effect-integration.md
Status:       DRAFT
Author:       Val (effect-specialist)
Created:      2026-02-09
Purpose:      Evaluate Sui blockchain integration with the TMNL manufacturing commons
              architecture, focusing on Effect-TS service composition, on-chain/off-chain
              boundaries, and the ISA-95 entity model mapping.
Sources:      Sui docs (docs.sui.io), Mysten SDK docs (sdk.mystenlabs.com),
              DeepWiki (MystenLabs/sui), Sui blog, academic papers
```

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Sui TypeScript SDK Analysis](#2-sui-typescript-sdk-analysis)
3. [Move Object Model and ISA-95 Mapping](#3-move-object-model-and-isa-95-mapping)
4. [Transaction Patterns and Effect-TS Composition](#4-transaction-patterns-and-effect-ts-composition)
5. [On-Chain vs Off-Chain Boundary Design](#5-on-chain-vs-off-chain-boundary-design)
6. [Consensus and Latency Analysis](#6-consensus-and-latency-analysis)
7. [Identity: zkLogin vs NATS JWT](#7-identity-zklogin-vs-nats-jwt)
8. [Existing Sui Supply Chain Patterns](#8-existing-sui-supply-chain-patterns)
9. [Proposed Integration Architecture](#9-proposed-integration-architecture)
10. [Risk Assessment and Open Questions](#10-risk-assessment-and-open-questions)

---

## 1. Executive Summary

Sui is a high-performance Layer 1 blockchain built on an **object-centric data model** powered
by the Move language. Its architecture offers three properties that align with the manufacturing
commons vision:

1. **Object-as-entity**: Every on-chain asset is a unique object with ownership semantics,
   mirroring our ISA-95 entity model where each Machine, Sensor, and Organization is a
   distinct entity with lifecycle state.

2. **Sub-second finality**: Mysticeti consensus achieves ~390ms consensus latency (shared
   objects) and <500ms fast-path finality (owned objects). This is fast enough for marketplace
   settlement and compliance anchoring, though NOT fast enough for real-time telemetry
   (which stays in NATS).

3. **zkLogin for onboarding**: Zero-knowledge OAuth authentication eliminates wallet friction.
   Earl (the solo machinist from RFC-001) can join the manufacturing commons with a Google
   login, no seed phrase management required.

**Key architectural decision**: Sui serves as the **trust and settlement layer** alongside
NATS as the **real-time event layer**. They are complementary, not competitive:

| Concern | Layer | Rationale |
|---------|-------|-----------|
| Real-time telemetry (1-10 Hz) | NATS JetStream | Sub-ms latency, no gas cost |
| Entity state transitions | NATS + EventDistribution | In-process fiber-to-fiber |
| Organization identity | Sui (zkLogin + objects) | Decentralized, self-sovereign |
| Trust scores / reputation | Sui (on-chain objects) | Transparent, auditable |
| Marketplace settlements | Sui (PTBs) | Atomic, programmable |
| Compliance certificates | Sui (immutable objects) | Tamper-proof audit trail |
| ISA-95 hierarchy config | Sui (dynamic fields) | Verifiable asset registry |

---

## 2. Sui TypeScript SDK Analysis

### 2.1 SDK Architecture

The `@mysten/sui` package (npm) provides modular sub-packages:

| Module | Purpose |
|--------|---------|
| `@mysten/sui/client` | RPC client for queries and transaction submission |
| `@mysten/sui/transactions` | `Transaction` builder class for PTBs |
| `@mysten/sui/bcs` | Binary Canonical Serialization for Sui types |
| `@mysten/sui/keypairs/*` | Ed25519, Secp256k1, Secp256r1 key management |
| `@mysten/sui/verify` | Transaction and message signature verification |
| `@mysten/sui/cryptography` | Core crypto types |
| `@mysten/sui/multisig` | Multi-signature transaction support |
| `@mysten/sui/faucet` | Test token requests |
| `@mysten/sui/zklogin` | Zero-knowledge login helpers |

### 2.2 Async Patterns

The SDK is fully async/await-based:

```typescript
// All network operations return Promises
const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });
const tx = new Transaction();
tx.moveCall({ target: '0x2::coin::transfer', arguments: [...] });
const result = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
```

**Key observation**: Every SDK operation that touches the network returns a `Promise`. This
maps directly to `Effect.tryPromise()` for wrapping in Effect services.

### 2.3 Effect-TS Service Wrapping

The SDK's async nature makes it a natural fit for Effect service wrapping. No Sui-specific
Effect integration exists in the ecosystem (confirmed via search), so we would author our own:

```typescript
// Proposed: SuiClient as Effect Service
import { Effect, Layer, Context } from 'effect'
import { SuiClient } from '@mysten/sui/client'

class SuiService extends Context.Tag('SuiService')<
  SuiService,
  {
    readonly client: SuiClient
    readonly executeTransaction: (
      tx: Transaction,
      signer: Keypair
    ) => Effect.Effect<SuiTransactionBlockResponse, SuiError>
    readonly getObject: (
      objectId: string
    ) => Effect.Effect<SuiObjectResponse, SuiError>
    readonly getDynamicFields: (
      parentId: string
    ) => Effect.Effect<DynamicFieldPage, SuiError>
  }
>() {}

// Live implementation wrapping Promise-based SDK
const SuiServiceLive = Layer.succeed(SuiService, {
  client: new SuiClient({ url: getNetworkUrl() }),
  executeTransaction: (tx, signer) =>
    Effect.tryPromise({
      try: () => client.signAndExecuteTransaction({ signer, transaction: tx }),
      catch: (e) => new SuiError({ cause: e }),
    }),
  getObject: (objectId) =>
    Effect.tryPromise({
      try: () => client.getObject({ id: objectId, options: { showContent: true } }),
      catch: (e) => new SuiError({ cause: e }),
    }),
  getDynamicFields: (parentId) =>
    Effect.tryPromise({
      try: () => client.getDynamicFields({ parentId }),
      catch: (e) => new SuiError({ cause: e }),
    }),
})
```

**Composability**: This service slots into the existing `EntityStack` Layer composition.
The `SuiService` would be consumed by a `SuiSettlementAdapter` or `SuiIdentityAdapter`
that sits alongside the NATS transport layer.

### 2.4 Rate Limiting Consideration

Public Sui endpoints enforce ~100 requests per 30 seconds. Production deployments need
dedicated node services. The Effect service layer should include:
- `Effect.retry` with exponential backoff for transient failures
- `Effect.rateLimit` or semaphore for concurrent request limiting
- Connection pooling via `Layer.memoize` (singleton client per process)

---

## 3. Move Object Model and ISA-95 Mapping

### 3.1 Sui Object Ownership Types

| Type | Creation | Consensus | Gas | Use Case |
|------|----------|-----------|-----|----------|
| **Owned** | `transfer::transfer(obj, addr)` | Fast path (no consensus) | Lower | Organization-private assets |
| **Shared** | `transfer::share_object(obj)` | Consensus required | Higher | Marketplace listings, shared registries |
| **Immutable** | `transfer::freeze_object(obj)` | No consensus (read-only) | Lowest | Compliance certs, audit records |
| **Wrapped** | Nested in parent struct | Follows parent | N/A | Child objects in hierarchy |
| **Dynamic Field** | `dynamic_field::add()` | Follows parent | On access | Extensible metadata, child collections |
| **Dynamic Object Field** | `dynamic_object_field::add()` | Follows parent | On access | Child objects visible to explorers |

### 3.2 ISA-95 Entity to Sui Object Mapping

The ISA-95 hierarchy maps naturally to Sui's object model using dynamic object fields for
parent-child relationships:

```
Sui Object Model                         ISA-95 Hierarchy
====================                     ===================
Organization (Shared Object)             Enterprise
  |-- dynamic_object_field: Site[]       Site
       |-- dynamic_object_field: Area[]  Area
            |-- ...                      Plant > Line > WorkCell
                 |-- Machine (Owned)     Machine (owned by org address)
                      |-- dynamic_field: Device[]    Device
                           |-- dynamic_field: Sensor[]  Sensor
```

**Critical design choice**: The `Organization` object MUST be a **shared object** because
multiple parties interact with it (the organization itself, marketplace contracts, reputation
system). Individual `Machine` objects can be **owned objects** for fast-path operations
when only the organization is mutating them.

### 3.3 Proposed Move Structs

```move
module manufacturing_commons::organization {
    use sui::object::{Self, UID};
    use sui::dynamic_object_field as ofield;

    /// Organization identity on the manufacturing commons.
    /// Shared object: accessible by marketplace, reputation, and compliance modules.
    struct Organization has key {
        id: UID,
        name: vector<u8>,
        /// zkLogin-derived address of the organization admin
        admin: address,
        /// Disclosure policy: what data leaves the org boundary
        disclosure_level: u8,  // 0=minimal, 1=aggregated, 2=detailed
        /// Reputation score (updated by reputation module)
        trust_score: u64,
        /// Number of registered equipment assets
        equipment_count: u64,
        /// Capacity status: aggregated from equipment states
        capacity_status: u8,  // 0=offline, 1=available, 2=busy, 3=full
    }

    /// Equipment asset registered to an organization.
    /// Added as dynamic object field of Organization.
    struct Equipment has key, store {
        id: UID,
        /// ISA-95 type: machine, device, sensor, line, workcell
        asset_type: u8,
        /// Human-readable name
        name: vector<u8>,
        /// Capability tags (e.g., "cnc_milling", "3axis", "aluminum")
        capabilities: vector<vector<u8>>,
        /// Last known status (synced from off-chain)
        last_status: u8,  // 0=offline, 1=idle, 2=running, 3=faulted
        /// Timestamp of last status update
        last_updated_ms: u64,
    }

    /// Compliance certificate — immutable once issued.
    struct ComplianceCert has key, store {
        id: UID,
        org_id: address,
        cert_type: vector<u8>,  // "ISO_9001", "AS9100", "ITAR"
        issuer: address,
        issued_at_ms: u64,
        expires_at_ms: u64,
        /// Hash of the off-chain certificate document (stored in Walrus/IPFS)
        document_hash: vector<u8>,
    }
}
```

### 3.4 Dynamic Fields for Telescoping Hierarchy

The telescoping hierarchy from RFC-001 Section 1.5 maps to dynamic object fields:

**Earl's Machine Works** (2 levels):
```
Organization [shared]
  └─ ofield "equip:CNC-1" → Equipment { asset_type: MACHINE }
       └─ dfield "sensor:spindle-temp" → SensorMeta { ... }
```

**Boeing Atlanta Supplier** (8 levels):
```
Organization [shared]
  └─ ofield "site:ATL" → Site { ... }
       └─ ofield "area:wing-fab" → Area { ... }
            └─ ofield "plant:bldg-7" → Plant { ... }
                 └─ ofield "line:assembly-1" → Line { ... }
                      └─ ofield "workcell:wc-42" → WorkCell { ... }
                           └─ ofield "equip:press-1" → Equipment { ... }
                                └─ dfield "sensor:pressure-42" → SensorMeta { ... }
```

**Key property**: The on-chain hierarchy mirrors the off-chain NATS topic hierarchy.
`Organization.id` maps to `NATS account`. Dynamic field names map to `NATS subject tokens`.
This enables on-chain verification of off-chain topic routing claims.

### 3.5 Gas Implications

Dynamic fields only incur gas when accessed. An Organization with 1,000 Equipment entries
pays gas only for the specific Equipment objects touched in a transaction. This makes the
object model cost-effective for large hierarchies — critical for the manufacturing commons
where organizations range from 1 machine (Earl) to 10,000+ (Boeing supplier).

---

## 4. Transaction Patterns and Effect-TS Composition

### 4.1 Programmable Transaction Blocks (PTBs)

PTBs are Sui's atomic transaction primitive. A single PTB can execute up to **1,024
commands** in sequence, with results from earlier commands feeding into later ones.

**Core PTB commands:**

| Command | Purpose | Manufacturing Use |
|---------|---------|-------------------|
| `moveCall` | Execute Move function | Register equipment, update status, settle |
| `splitCoins` | Divide coins | Split payment for multi-party settlement |
| `mergeCoins` | Combine coins | Consolidate marketplace earnings |
| `transferObjects` | Move ownership | Transfer equipment registration, certs |
| `makeMoveVec` | Build object vector | Batch operations on equipment list |
| `publish` | Deploy package | Deploy org-specific compliance modules |

### 4.2 PTB Construction with Effect.gen()

The `Transaction` builder is inherently imperative — you call methods that mutate internal
state. This maps cleanly to `Effect.gen()`:

```typescript
// Effect-wrapped PTB construction
const registerEquipment = (
  orgId: string,
  equipment: EquipmentRegistration
) => Effect.gen(function* () {
  const sui = yield* SuiService
  const signer = yield* SignerService

  const tx = new Transaction()

  // Step 1: Call Move function to create Equipment object
  const [equipObj] = tx.moveCall({
    target: `${PACKAGE_ID}::organization::register_equipment`,
    arguments: [
      tx.object(orgId),                           // Organization shared object
      tx.pure.string(equipment.name),             // Equipment name
      tx.pure.u8(equipment.assetType),            // ISA-95 type
      tx.pure.vector('string', equipment.capabilities),
    ],
  })

  // Step 2: Transfer Equipment as dynamic object field (handled inside Move)
  // The Move function internally calls ofield::add()

  // Step 3: Execute
  const result = yield* sui.executeTransaction(tx, yield* signer.getKeypair())

  return result
})
```

### 4.3 Multi-Step Marketplace Settlement PTB

A marketplace job completion involves multiple atomic steps in a single PTB:

```typescript
const settleMarketplaceJob = (params: {
  jobId: string
  buyerOrg: string
  sellerOrg: string
  paymentCoinId: string
  amount: bigint
  platformFeeRate: number // basis points
}) => Effect.gen(function* () {
  const sui = yield* SuiService
  const signer = yield* SignerService

  const tx = new Transaction()

  // 1. Split payment coin: platform fee + seller payment
  const platformFee = (params.amount * BigInt(params.platformFeeRate)) / 10000n
  const sellerAmount = params.amount - platformFee
  const [feeCoin, sellerCoin] = tx.splitCoins(
    tx.object(params.paymentCoinId),
    [tx.pure.u64(platformFee), tx.pure.u64(sellerAmount)]
  )

  // 2. Update job status to COMPLETED
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::complete_job`,
    arguments: [
      tx.object(params.jobId),
      tx.object(params.buyerOrg),
      tx.object(params.sellerOrg),
    ],
  })

  // 3. Transfer seller payment
  tx.transferObjects([sellerCoin], tx.pure.address(params.sellerOrg))

  // 4. Transfer platform fee to treasury
  tx.transferObjects([feeCoin], tx.pure.address(PLATFORM_TREASURY))

  // 5. Update seller reputation (job completed successfully)
  tx.moveCall({
    target: `${PACKAGE_ID}::reputation::record_completion`,
    arguments: [tx.object(params.sellerOrg)],
  })

  // All 5 steps execute atomically
  const result = yield* sui.executeTransaction(tx, yield* signer.getKeypair())
  return result
})
```

### 4.4 PTB Composition Pattern

PTBs compose naturally because `Transaction` is a mutable builder. Multiple Effect functions
can contribute commands to the same `Transaction` instance:

```typescript
// Compose PTB steps from independent Effect functions
const buildComplexTransaction = Effect.gen(function* () {
  const tx = new Transaction()

  // Each function adds commands to the same tx
  yield* addEquipmentRegistration(tx, equipData)
  yield* addComplianceCert(tx, certData)
  yield* addReputationUpdate(tx, reputationData)

  // Single atomic execution
  return yield* executeTransaction(tx)
})
```

This pattern is analogous to how our `EntityHandlersLayer` composes multiple handler
registrations into a single `Layer.mergeAll`.

---

## 5. On-Chain vs Off-Chain Boundary Design

### 5.1 The Boundary Principle

**On-chain**: Data that requires trustless verification, cross-organization consensus,
or permanent audit trail. Cost: gas per transaction.

**Off-chain (NATS)**: Data that requires real-time delivery, high frequency, or stays
within organizational boundaries. Cost: infrastructure only.

### 5.2 Detailed Boundary Mapping

#### ON-CHAIN (Sui)

| Data | Sui Object Type | Update Frequency | Rationale |
|------|----------------|------------------|-----------|
| Organization identity | Shared object | Rare (config changes) | Self-sovereign identity, no central authority |
| Equipment registry | Dynamic object fields | On add/remove | Verifiable asset inventory for marketplace |
| Capability declarations | Equipment metadata | On capability change | Marketplace matching requires trustless data |
| Trust/reputation scores | Organization field | Per completed job | Cross-org trust requires consensus |
| Marketplace job listings | Shared objects | Per listing/bid | Multi-party access, atomic settlement |
| Job settlements (payments) | PTBs with coin splits | Per job completion | Trustless payment with atomic multi-step |
| Compliance certificates | Immutable objects | On issuance/renewal | Tamper-proof, auditable by any party |
| Disclosure policies | Organization field | On policy change | Enforceable data sharing rules |
| Network governance votes | Shared objects | Per proposal/vote | Transparent governance (Ostrom principle 3) |

#### OFF-CHAIN (NATS JetStream + EventDistribution)

| Data | Transport | Frequency | Rationale |
|------|-----------|-----------|-----------|
| Sensor readings (DDATA) | NATS subject per sensor | 1-10 Hz | Too frequent for blockchain, no cross-org need |
| Entity state transitions | EventDistribution channels | Event-driven | In-process latency requirement (<100ms) |
| Alarm lifecycle events | NATS + alarm channel | Event-driven | Time-critical, org-internal |
| Equipment state changes | NATS + equipment channel | Event-driven | Real-time propagation via U-1 cascade |
| Cache invalidations | NATS + invalidation channel | Event-driven | UI reactivity, no permanence needed |
| WebSocket subscriptions | RPC streaming | Per subscriber | Client-specific, ephemeral |
| OEE calculations | Computed in-process | Per reading batch | Derived data, not source-of-truth |
| Sparkplug-B ingestion | MQTT -> NATS bridge | Per MQTT message | Edge protocol, org-internal |

#### HYBRID (Off-chain primary, on-chain anchoring)

| Data | Primary Layer | Anchor Layer | Pattern |
|------|--------------|-------------|---------|
| Equipment status summary | NATS (real-time) | Sui (periodic) | Off-chain computes, anchors hourly aggregate |
| OEE metrics | In-process | Sui (daily) | Daily OEE snapshot as immutable object |
| Alarm history digest | EventDistribution | Sui (on resolution) | Alarm resolution hash anchored for compliance |
| Capacity availability | NATS (real-time signal) | Sui (on change) | Binary available/busy synced to Sui on transition |

### 5.3 Event Anchoring Pattern

For compliance and audit, off-chain events can be periodically anchored on-chain:

```typescript
// Anchor a batch of alarm events as a Merkle root on Sui
const anchorAlarmBatch = (
  orgId: string,
  alarmEvents: ReadonlyArray<AlarmEvent>,
  period: { start: number; end: number }
) => Effect.gen(function* () {
  const sui = yield* SuiService
  const signer = yield* SignerService

  // Compute Merkle root of alarm events off-chain
  const merkleRoot = computeMerkleRoot(
    alarmEvents.map(e => hashAlarmEvent(e))
  )

  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::audit::anchor_event_batch`,
    arguments: [
      tx.object(orgId),
      tx.pure.vector('u8', merkleRoot),
      tx.pure.u64(period.start),
      tx.pure.u64(period.end),
      tx.pure.u64(alarmEvents.length),
    ],
  })

  return yield* sui.executeTransaction(tx, yield* signer.getKeypair())
})
```

This gives compliance auditors a tamper-proof anchor point without putting every alarm
event on-chain (which would be prohibitively expensive and unnecessary).

### 5.4 Capacity Status Sync Pattern

The manufacturing commons "entity state as market signal" concept (RFC-001 Section 1.4)
requires syncing aggregated capacity status from NATS to Sui:

```
Off-chain event flow:
  Machine RUNNING->IDLE → EventDistribution → U-1 propagation → Organization aggregate

On-chain sync trigger:
  Organization aggregate changes (e.g., "fully loaded" → "capacity available")
  → SuiSyncAdapter publishes PTB updating Organization.capacity_status
  → Marketplace contracts can now see updated availability
```

This is a **state change trigger**, not a periodic sync. The on-chain update only fires
when the aggregated capacity status actually changes, keeping gas costs proportional to
meaningful state transitions.

---

## 6. Consensus and Latency Analysis

### 6.1 Mysticeti Protocol

Sui replaced Narwhal/Bullshark with Mysticeti (mainnet August 2024), then upgraded to
Mysticeti v2 (November 2025). Key properties:

- **DAG-based**: Multiple validators propose blocks in parallel
- **3-round commitment**: Matches theoretical BFT minimum
- **Quorum**: >2/3 validator voting power
- **Validation + consensus simultaneous** (v2): Eliminated redundant validation phase

### 6.2 Latency Characteristics

| Transaction Type | Path | Consensus Latency | E2E Client Latency | Notes |
|-----------------|------|-------------------|--------------------|----- |
| Owned objects only | **Fast path** | Bypassed | <500ms | Certificate formation only, no ordering |
| Shared objects | **Consensus path** | ~390ms (P50) | <1s (P50) | Full Mysticeti ordering |
| Immutable reads | **No transaction** | N/A | ~100ms | Direct RPC query |

### 6.3 Comparison with NATS JetStream

| Metric | Sui (Consensus) | Sui (Fast Path) | NATS JetStream | Winner for |
|--------|-----------------|-----------------|----------------|------------|
| Latency (P50) | ~390ms | <500ms | <5ms | NATS: real-time events |
| Latency (P99) | ~1s | <1s | <20ms | NATS: tail latency |
| Throughput | 200K-300K TPS | Higher | >1M msg/s | NATS: raw throughput |
| Finality | Immediate on inclusion | Certificate-based | Ack on persist | Sui: settlement finality |
| Cost per op | Gas (~$0.001-0.01) | Gas (lower) | Infrastructure only | NATS: high-frequency ops |
| Trust model | Byzantine fault tolerant | Byzantine fault tolerant | Single-operator | Sui: cross-org trust |
| Ordering | Global (shared) / None (owned) | None | Per-stream FIFO | Depends on use case |

### 6.4 Latency Budget for Manufacturing Commons

```
Sensor → NATS:          ~1ms   (local network)
NATS → Entity handler:  ~1ms   (in-process)
Entity → State machine: ~1ms   (in-process)
State → EventDist:      ~1ms   (fiber-to-fiber)
EventDist → WebSocket:  ~5ms   (network)
────────────────────────────────
Total real-time path:    ~10ms  ← NATS handles this

Capacity change → Sui TX:  ~50ms  (construct PTB)
Sui TX → Finality:         ~500ms (fast path, owned obj)
────────────────────────────────
Total settlement path:     ~550ms ← Sui handles this
```

The two paths operate at completely different timescales and serve different purposes.
There is no tension between them.

---

## 7. Identity: zkLogin vs NATS JWT

### 7.1 zkLogin Overview

zkLogin enables Sui transactions using OAuth credentials (Google, Facebook, Apple, etc.)
without wallet setup. The flow:

1. User authenticates with OAuth provider (e.g., Google)
2. Ephemeral keypair generated client-side (session-scoped)
3. OAuth JWT + salt → zero-knowledge proof via proving service
4. Transaction signed with ephemeral key + ZK proof
5. Sui validators verify proof against cached provider JWKs
6. **No persistent private key needed**

### 7.2 zkLogin for Manufacturing Onboarding (Earl's Path)

RFC-001 Requirement R-N5: "A $50 edge device, a QR code scan, and 15 minutes of setup
MUST be sufficient to join the network."

zkLogin enables this:

```
1. Earl scans QR code on edge device           → Opens web app
2. Earl clicks "Sign in with Google"            → OAuth flow
3. App generates ephemeral keypair              → Stored in session
4. ZK proof generated (2-3 min, cached)         → One-time per session
5. App creates Organization object on Sui       → Earl's identity on-chain
6. App provisions NATS account (JWT signed by org key) → Edge device connects
7. Edge device starts publishing sensor data    → NATS flow active

Total wall-clock: ~5 minutes (well within 15-minute requirement)
```

### 7.3 Dual Identity Architecture

| Layer | Identity System | Credential | Scope |
|-------|----------------|------------|-------|
| **Sui** (trust layer) | zkLogin address | OAuth JWT + ZK proof | Cross-org, on-chain |
| **NATS** (event layer) | Account JWT | NATS NKey + JWT | Org-internal, real-time |

The bridge between them:

```
zkLogin address → derives Organization.id on Sui
Organization.id → maps to NATS account name
NATS account → issues JWTs for org's edge devices
```

**Key property**: The zkLogin address is deterministic for a given (provider, app, user)
tuple. This means Earl's Google login always resolves to the same Sui address, which
always maps to the same NATS account. No central registry needed.

### 7.4 Privacy Guarantees

| Property | zkLogin | NATS JWT |
|----------|---------|----------|
| Identity linkage | OAuth sub hidden via ZKP | Account name visible to broker |
| Cross-org visibility | Only Sui address visible | Only org aggregate visible |
| Revocation | Ephemeral key expires at epoch | JWT TTL + account revocation |
| Recovery | OAuth password reset | Re-provision from Sui identity |

### 7.5 Multi-Sig for Organization Governance

Sui's native multisig + zkLogin enables organization governance:

```
Organization admin: 2-of-3 multisig
  - Signer 1: Owner's Google zkLogin
  - Signer 2: Co-owner's Facebook zkLogin
  - Signer 3: Cold storage Ed25519 key (recovery)
```

This maps to Ostrom's governance principles — collective-choice arrangements
(Principle 3) implemented as on-chain multi-sig policies.

---

## 8. Existing Sui Supply Chain Patterns

### 8.1 Ecosystem Assessment

As of February 2026, Sui's ecosystem is dominated by DeFi, gaming, and NFT projects.
Supply chain and manufacturing-specific dApps are **scarce to nonexistent** on Sui.

**What exists:**
- Asset tokenization framework (official Sui example) — fractionalization, kiosk-based
  trading, transfer policies
- Generic supply chain blog posts — no production implementations found
- Enterprise asset management guides — tokenization-focused, not IoT/IIoT

**What does NOT exist:**
- Manufacturing-specific Move modules
- IIoT data anchoring patterns
- Equipment registry smart contracts
- Capacity marketplace contracts
- ISA-95 hierarchy on-chain representations

### 8.2 Relevant Patterns from Sui Ecosystem

**Asset Tokenization (Official Example)**:
- `AssetCap<T>` + `TokenizedAsset<T>` pattern for fractionalizable assets
- Transfer policies via kiosk system for marketplace rules
- Applicable to: equipment capability tokens, capacity tokens

**Dynamic Fields for Collections**:
- `Table<K, V>` and `Bag` for typed/untyped collections
- Entry counting prevents orphaned dynamic fields on parent deletion
- Applicable to: equipment registry, sensor catalog per machine

**Object Capabilities**:
- Move's linear type system prevents accidental duplication of resources
- `store` ability gates transferability
- Applicable to: compliance certificates (non-duplicable), organization admin caps

### 8.3 Gap Analysis

The manufacturing commons would be the **first production IIoT/manufacturing use case
on Sui**. This is both an opportunity (no competition, potential for Sui Foundation
grants) and a risk (no battle-tested patterns to follow).

The closest analog is Sui's enterprise asset management documentation, which covers
tokenization but not real-time operational data, equipment hierarchy, or marketplace
settlement.

---

## 9. Proposed Integration Architecture

### 9.1 System Topology

```
                          ┌──────────────────────┐
                          │   Sui Blockchain      │
                          │   (Trust Layer)       │
                          │                       │
                          │  Organization objects │
                          │  Equipment registry   │
                          │  Marketplace contracts│
                          │  Compliance certs     │
                          │  Reputation scores    │
                          └──────────┬───────────┘
                                     │
                              PTB execution
                              (async, ~500ms)
                                     │
┌────────────────┐          ┌────────▼───────────┐          ┌────────────────┐
│  Edge Device   │  MQTT/   │   TMNL Platform    │  WS/RPC  │   Browser/     │
│  ($50 sensor)  │──Spark──▶│   (Effect-TS)      │◀────────▶│   Dashboard    │
│                │  plug-B  │                     │          │                │
│  Sensor data   │          │  ┌───────────────┐ │          │  Real-time     │
│  1-10 Hz       │          │  │ NATS JetStream│ │          │  telemetry     │
│                │          │  │ (Event Layer) │ │          │  OEE metrics   │
└────────────────┘          │  └───────────────┘ │          │  Alarm status  │
                            │                     │          │                │
                            │  ┌───────────────┐ │          │  Marketplace   │
                            │  │ Entity System │ │          │  (reads Sui)   │
                            │  │ @effect/cluster│ │          │                │
                            │  └───────────────┘ │          └────────────────┘
                            │                     │
                            │  ┌───────────────┐ │
                            │  │ SuiService    │ │
                            │  │ (Effect Layer)│ │
                            │  └───────────────┘ │
                            └─────────────────────┘
```

### 9.2 Effect Layer Composition

```typescript
// New layers for Sui integration
const SuiIntegrationLayer = Layer.mergeAll(
  SuiServiceLive,         // RPC client + transaction execution
  SuiIdentityLive,        // zkLogin + address derivation
  SuiSettlementLive,      // Marketplace PTB construction
  SuiComplianceLive,      // Certificate anchoring
  SuiSyncAdapterLive,     // Capacity status sync trigger
)

// Full platform layer
const PlatformLayer = Layer.mergeAll(
  EntityHandlersLayer,     // ISA-95 entities (existing)
  EventDistributionLayer,  // NATS channels (existing)
  SparkplugPipelineLayer,  // Edge ingestion (existing)
  WebSocketServerLayer,    // Client subscriptions (existing)
  SuiIntegrationLayer,     // Blockchain trust layer (NEW)
)
```

### 9.3 Tier Deployment

| Tier | Sui Integration | Notes |
|------|----------------|-------|
| **T1** ($50 edge) | None | Ingestion only, no blockchain awareness |
| **T2** ($500 edge) | SuiServiceLive (read-only) | Can verify on-chain identity, read equipment registry |
| **T3** (cloud) | Full SuiIntegrationLayer | Read + write, marketplace settlement, compliance |

This preserves the tier-invariance property from the microservices research — the
EntityHandlersLayer is identical across tiers, only the Sui layer varies.

### 9.4 Data Flow: Equipment Registration

```
1. Earl signs in via zkLogin (Google)
2. App calls `registerOrganization` PTB → Organization shared object created
3. NATS account provisioned (derived from Organization.id)
4. Edge device connects via NATS (JWT from org account)
5. NBIRTH message → TopicRouter auto-registers equipment
6. App calls `registerEquipment` PTB → Equipment object added as dynamic field
7. Equipment now visible both on-chain (marketplace) and off-chain (real-time)
```

### 9.5 Data Flow: Marketplace Job Settlement

```
1. Buyer finds available capacity via Sui marketplace query
2. Buyer creates Job listing PTB (shared object)
3. Seller (Earl) accepts Job → PTB updates job status
4. Work performed (tracked off-chain via NATS entity state)
5. Buyer confirms completion → settleMarketplaceJob PTB executes:
   a. Job status → COMPLETED
   b. Payment coin split (seller + platform fee)
   c. Seller reputation updated
   d. All atomic in single PTB
6. Event anchored: job completion hash written to audit trail
```

---

## 10. Risk Assessment and Open Questions

### 10.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Sui network instability | LOW | HIGH | Degrade gracefully: NATS layer operates independently |
| Gas cost spikes | MEDIUM | MEDIUM | Batch anchoring, minimize on-chain writes |
| zkLogin provider outage | LOW | MEDIUM | Multi-provider support (Google + Facebook + Apple) |
| Move language learning curve | HIGH | MEDIUM | Team has no Move experience; start with simple modules |
| Regulatory uncertainty (crypto) | MEDIUM | HIGH | On-chain layer is optional; platform works without it |
| No existing manufacturing patterns | HIGH | LOW | First-mover advantage; simple starting contracts |

### 10.2 Open Questions

**Q1: Should equipment status sync be push or pull?**
- Push: SuiSyncAdapter fires PTB on every capacity_status change
- Pull: Marketplace contracts query a status oracle on demand
- Recommendation: Push for availability (binary signal), pull for detailed status

**Q2: What is the minimum viable on-chain footprint?**
- Phase 1: Organization identity + equipment registry only
- Phase 2: Add marketplace settlement
- Phase 3: Add compliance anchoring + reputation
- This allows incremental adoption without front-loading blockchain complexity

**Q3: How do we handle Sui upgrades and Move package versioning?**
- Move packages are immutable once published; upgrades create new versions
- Need upgrade capability management (who holds the UpgradeCap?)
- Multi-sig UpgradeCap aligned with organization governance model

**Q4: What about organizations that refuse blockchain?**
- The NATS layer must work independently — blockchain is additive, not required
- Organizations can participate in real-time telemetry without any Sui interaction
- Marketplace and cross-org features require Sui for trustless operation

**Q5: Cost model for Earl (solo machinist)?**
- Organization creation: ~$0.01 (one-time)
- Equipment registration: ~$0.005 per asset (one-time)
- Daily capacity sync: ~$0.01 (assuming 10 status changes/day)
- Monthly Sui cost for Earl: <$1
- This is well within the "manufacturing commons" accessibility target

**Q6: Walrus for off-chain document storage?**
- Compliance certificates reference off-chain documents (PDFs, images)
- Walrus (Sui's decentralized storage) or IPFS for document blobs
- On-chain object stores only the document hash
- Research Walrus integration separately

### 10.3 Implementation Phasing

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| **Phase A** | SuiService Effect layer + basic Organization/Equipment Move modules | 2-3 sprints |
| **Phase B** | zkLogin integration + NATS account provisioning bridge | 1-2 sprints |
| **Phase C** | Marketplace settlement PTBs + reputation module | 2-3 sprints |
| **Phase D** | Compliance anchoring + audit trail | 1-2 sprints |
| **Phase E** | Capacity status sync adapter + event anchoring | 1-2 sprints |

Total: 7-12 sprints, with Phase A-B delivering the minimum viable on-chain footprint.

---

## References

### Sui Documentation
- [Sui TypeScript SDK Quick Start](https://sdk.mystenlabs.com/sui)
- [Programmable Transaction Basics](https://sdk.mystenlabs.com/typescript/transaction-building/basics)
- [PTB Concepts](https://docs.sui.io/concepts/transactions/prog-txn-blocks)
- [Object Model](https://docs.sui.io/guides/developer/objects/object-model)
- [Dynamic Fields](https://docs.sui.io/concepts/dynamic-fields)
- [Consensus (Mysticeti)](https://docs.sui.io/concepts/sui-architecture/consensus)
- [zkLogin](https://docs.sui.io/concepts/cryptography/zklogin)
- [Asset Tokenization Guide](https://docs.sui.io/guides/developer/nft/asset-tokenization)
- [Sui Research Papers](https://docs.sui.io/concepts/research-papers)

### Sui Blog & Announcements
- [2025 Stack Developments](https://blog.sui.io/2025-sui-stack-developments/)
- [Mysticeti Feature Page](https://www.sui.io/mysticeti)
- [Mysticeti v2 Upgrade (Nov 2025)](https://crypto.news/sui-launches-mysticeti-v2-consensus-upgrade-2025/)
- [zkLogin Deep Dive](https://blog.sui.io/zklogin-deep-dive/)
- [Dynamic Fields Migration Guide](https://blog.sui.io/dynamic-fields-migration-guide/)

### Academic Papers
- Mysticeti: Reaching the Latency Limits with Uncertified DAGs ([arXiv:2310.14821](https://arxiv.org/pdf/2310.14821))
- Stingray: Fast Concurrent Transactions Without Consensus ([arXiv:2501.06531](https://www.arxiv.org/pdf/2501.06531))

### Ecosystem
- [MystenLabs/sui (GitHub)](https://github.com/MystenLabs/sui)
- [awesome-sui (GitHub)](https://github.com/sui-foundation/awesome-sui)
- [Sui Cookbook](https://suicookbook.com/programmable-transaction-blocks.html)
- [Sui by Examples](https://www.suibyexamples.com/ts-advanced)

### Object Ownership Analysis
- [Object Ownership in Sui Move](https://sui.peera.ai/articles/3-0x69e980ba502498b15fce2237559c45e9cc4d3b09b58300072678235b7519aaf1/object-ownership-in-sui-move-owned-shared-and-immutable-objects)
- [Sui Object-Centric Model Deep Dive (Bitmorpho)](https://bitmorpho.com/en/article/sui-blockchains-paradigm-shift-object-centric-model-and-move-language-deep-dive)
- [Gas Cost Optimization Patterns](https://bitmorpho.com/en/article/mastering-sui-gas-costs-object-ownership-and-move-optimization-patterns)

### TMNL Codebase References
- `src/lib/iiot/entity/EntityStack.ts` — Layer composition model
- `src/lib/iiot/adapters/ingestion-service.ts:297-322` — SparkplugPipelineLayer
- `src/lib/iiot/realtime/event-distribution.ts` — EventDistribution channels
- `src/lib/iiot/realtime/reactivity-bridge.ts` — ReactivityBridge fiber pattern
- `src/lib/iiot/schemas/identifiers.ts:28-38` — Branded ISA-95 identifiers
- `docs/specifications/rfc-001-assembled.md` — RFC-001 full specification

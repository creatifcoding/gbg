# Research: Sui Blockchain Integration for Metropolitan-Scale Manufacturing Commons

```
Document:     research-sui-blockchain-integration.md
Status:       COMPREHENSIVE RESEARCH
Author:       Val (sui-researcher)
Created:      2026-02-09
Purpose:      Unified research on Sui blockchain as trust/settlement/compliance layer
              for the TMNL 200K-organization manufacturing commons platform
Sources:      Sui docs (docs.sui.io), Mysten SDK docs (sdk.mystenlabs.com),
              DeepWiki (MystenLabs/sui), Sui blog, academic papers (arXiv),
              Existing research files (research-sui-effect-integration.md,
              research-sui-compliance-anchoring.md, research-sui-identity-auth.md,
              research-sui-marketplace-settlement.md)
Consolidates: 4 prior research documents into unified reference
```

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Sui Architecture Fundamentals](#2-sui-architecture-fundamentals)
3. [Sui TypeScript SDK + Effect-TS Integration](#3-sui-typescript-sdk--effect-ts-integration)
4. [Manufacturing Commons Use Cases on Sui](#4-manufacturing-commons-use-cases-on-sui)
5. [Hybrid Architecture: NATS + Sui](#5-hybrid-architecture-nats--sui)
6. [Sui Object Model for ISA-95](#6-sui-object-model-for-isa-95)
7. [Comparison with Alternatives](#7-comparison-with-alternatives)
8. [Cost Analysis](#8-cost-analysis)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Risk Assessment](#10-risk-assessment)
11. [Recommendations](#11-recommendations)
12. [References](#12-references)

---

## 1. Executive Summary

Sui is a high-performance Layer 1 blockchain built on an **object-centric data model** powered
by the Move language. It serves as the **trust and settlement layer** for the TMNL manufacturing
commons, complementing NATS JetStream (the real-time event layer). The two systems are not
competitive -- they operate at different timescales for different purposes.

### Why Sui for Manufacturing Commons

| Property | Sui Capability | Manufacturing Need |
|----------|---------------|-------------------|
| Object-centric model | Every asset is a unique object with ownership | ISA-95 entities need distinct identity with lifecycle |
| Sub-second finality | ~390ms consensus (Mysticeti v2) | Marketplace settlement needs fast confirmation |
| zkLogin | OAuth-based blockchain auth (Google, Apple) | Earl needs to join with a Google login, no seed phrases |
| Programmable Transaction Blocks | Up to 1,024 atomic operations | Multi-step marketplace settlement in one transaction |
| Dynamic fields | Extensible object metadata | Telescoping ISA-95 hierarchy (2 to 8 levels) |
| Sponsored transactions | Third party pays gas fees | Platform subsidizes small machine shops |
| Walrus storage | Decentralized off-chain storage | Compliance document storage |

### Hot-Path vs Cold-Path Architecture

```
HOT PATH (NATS JetStream)           COLD PATH (Sui Blockchain)
========================           =========================
Sensor readings (1-10 Hz)          Organization identity
Entity state transitions           Equipment registry
Alarm lifecycle events             Marketplace settlement
Equipment state changes            Compliance anchoring
Cache invalidations                Reputation scores
WebSocket subscriptions            Governance votes
OEE calculations                   Capacity tokens
Sparkplug-B ingestion              Audit trail proofs

Latency: <10ms end-to-end          Latency: ~500ms finality
Cost: infrastructure only           Cost: ~$0.003 per transaction
Trust: single-operator              Trust: Byzantine fault tolerant
```

---

## 2. Sui Architecture Fundamentals

### 2.1 Object-Centric Model

Unlike account-based blockchains (Ethereum), Sui uses an **object-centric** model where every
on-chain asset is an object with a unique ID, version, and ownership semantics.

**Object Ownership Types:**

| Type | Consensus | Gas Cost | Use Case in Manufacturing |
|------|-----------|----------|--------------------------|
| **Owned** | Fast path (none) | Lower | Org-private equipment, internal records |
| **Shared** | Required (~390ms) | Higher | Marketplace listings, shared registries |
| **Immutable** | None (read-only) | Lowest | Compliance certificates, audit anchors |
| **Wrapped** | Follows parent | N/A | Child objects in ISA-95 hierarchy |
| **Dynamic Field** | Follows parent | On access | Extensible metadata, sensor catalogs |
| **Dynamic Object Field** | Follows parent | On access | Child objects visible to explorers |

**Key property for manufacturing:** Because assets are distinct objects, if two organizations
are transacting on assets that don't overlap, the network processes those transactions in
parallel. This is critical for a 200K-organization network where most operations are
organization-local.

### 2.2 Move Language

Move is Sui's smart contract language, designed around **resource safety**:

- **Linear types**: Objects cannot be duplicated or discarded -- they must be explicitly
  transferred, consumed, or stored. This prevents double-spending of capacity tokens
  or compliance certificates.
- **Abilities system**: Types declare capabilities (`key`, `store`, `copy`, `drop`) that
  control what operations are permitted. A compliance certificate with only `key` (no
  `store`) cannot be transferred -- it's soulbound.
- **Module initializers**: `init()` runs once on package publish, creating singleton
  admin capabilities.

```move
module manufacturing_commons::organization {
    use sui::object::{Self, UID};
    use sui::dynamic_object_field as ofield;
    use sui::transfer;
    use sui::tx_context::TxContext;

    /// Organization identity on the manufacturing commons.
    /// Shared object: accessible by marketplace, reputation, and compliance modules.
    struct Organization has key {
        id: UID,
        name: vector<u8>,
        admin: address,              // zkLogin-derived address
        disclosure_level: u8,        // 0=minimal, 1=aggregated, 2=detailed
        trust_score: u64,            // Updated by reputation module
        equipment_count: u64,
        capacity_status: u8,         // 0=offline, 1=available, 2=busy, 3=full
    }

    /// Equipment asset registered to an organization.
    struct Equipment has key, store {
        id: UID,
        asset_type: u8,              // ISA-95 type: machine, device, sensor, etc.
        name: vector<u8>,
        capabilities: vector<vector<u8>>,  // ["cnc_milling", "3axis", "aluminum"]
        last_status: u8,             // 0=offline, 1=idle, 2=running, 3=faulted
        last_updated_ms: u64,
    }

    /// Admin capability for organization management.
    struct OrgAdminCap has key {
        id: UID,
        org_id: address,
    }

    /// Create a new organization (called via zkLogin).
    public entry fun create_organization(
        name: vector<u8>,
        disclosure_level: u8,
        ctx: &mut TxContext,
    ) {
        let org = Organization {
            id: object::new(ctx),
            name,
            admin: tx_context::sender(ctx),
            disclosure_level,
            trust_score: 0,
            equipment_count: 0,
            capacity_status: 0,
        };
        let admin_cap = OrgAdminCap {
            id: object::new(ctx),
            org_id: object::uid_to_address(&org.id),
        };
        transfer::share_object(org);           // Shared: marketplace can read
        transfer::transfer(admin_cap, tx_context::sender(ctx));  // Owned: only admin
    }

    /// Register equipment as dynamic object field.
    public entry fun register_equipment(
        org: &mut Organization,
        _cap: &OrgAdminCap,
        asset_type: u8,
        name: vector<u8>,
        capabilities: vector<vector<u8>>,
        ctx: &mut TxContext,
    ) {
        let equip = Equipment {
            id: object::new(ctx),
            asset_type,
            name,
            capabilities,
            last_status: 0,
            last_updated_ms: 0,
        };
        org.equipment_count = org.equipment_count + 1;
        ofield::add(&mut org.id, name, equip);
    }
}
```

### 2.3 Mysticeti Consensus

Sui uses the **Mysticeti** DAG-based consensus protocol (mainnet since August 2024,
v2 since November 2025).

**Performance characteristics:**

| Metric | Value | Source |
|--------|-------|--------|
| Consensus latency (P50) | ~67ms (v2) | [Mysticeti v2 blog](https://blog.sui.io/mysticeti-v2-sui-consensus/) |
| Consensus latency (P95) | ~90ms (v2) | Mysticeti v2 blog |
| Consensus latency (P99) | ~114ms (v2) | Mysticeti v2 blog |
| E2E finality (shared objects) | <1s (P50) | [Sui docs](https://docs.sui.io/concepts/sui-architecture/consensus) |
| E2E finality (owned objects) | <500ms | Fast path (no consensus) |
| Sustained throughput | 200,000+ TPS | [Sui Mysticeti page](https://www.sui.io/mysticeti) |
| Checkpoint frequency | ~4 per second | Sui docs |

**Mysticeti v2 improvements** (November 2025):
- Integrates transaction validation directly into consensus
- Removes redundant validation phase
- 20% improvement at P95, 27% at P99

**Comparison with prior protocol:**
- Narwhal/Bullshark (pre-August 2024): ~2-3s consensus
- Mysticeti v1: ~390ms consensus
- Mysticeti v2: ~67ms P50, ~114ms P99

### 2.4 Programmable Transaction Blocks (PTBs)

PTBs allow up to **1,024 operations** in a single atomic transaction. Results from
earlier commands can be used as inputs to later commands.

```
PTB for Marketplace Settlement:
  cmd[0]: splitCoins(paymentCoin, [platformFee, sellerAmount])
  cmd[1]: moveCall(marketplace::complete_job, [jobId, buyerOrg, sellerOrg])
  cmd[2]: transferObjects([sellerCoin], sellerAddress)
  cmd[3]: transferObjects([feeCoin], treasuryAddress)
  cmd[4]: moveCall(reputation::record_completion, [sellerOrg])

All 5 commands execute atomically. Either all succeed or none do.
```

### 2.5 Gas Economics and Sponsorship

**Fee structure:**
```
Gas fee = ComputationUnits x ComputationPrice + StorageUnits x StoragePrice
```

| Component | Cost | Notes |
|-----------|------|-------|
| Storage price | 76 MIST per unit | ~$0.000000076 per unit at $1/SUI |
| Storage rebate | 99% on deletion | Recoverable for mutable objects |
| Typical transaction | ~0.003 SUI | ~$0.003 at current prices |
| Reference gas price | ~1,000 MIST | Set by validators per epoch |

**Sponsored Transactions** enable the platform to pay gas on behalf of users:

```
Three sponsorship flows:
1. User-proposed: User builds tx -> Sponsor signs gas -> Both submit
2. Sponsor-proposed: Sponsor builds tx -> User reviews and signs
3. Wildcard: Sponsor pre-funds gasless wallets for any valid tx within budget
```

This is critical for Earl (the solo machinist). The platform operates a **gas station**
that sponsors all transactions for organizations below a usage threshold, removing
blockchain friction entirely.

**Third-party gas stations:**
- [Shinami Gas Station](https://docs.shinami.com/product-overviews/sui/gas-station): Production-ready API
- Custom: Self-hosted using Sui SDK's sponsored transaction flow

### 2.6 Walrus Decentralized Storage

[Walrus](https://www.walrus.xyz/) (launched March 2025, $140M raised) provides decentralized
storage for the Sui ecosystem:

- **2D erasure coding** ("RedStuff"): 4-5x replication with 2/3 fault tolerance
- **Programmable**: Storage managed by smart contracts
- **Capacity**: 300TB+ stored within 8 months of launch
- **Use case**: Compliance documents, work order attachments, machine drawings

On-chain objects store only hashes; Walrus stores the actual documents.

---

## 3. Sui TypeScript SDK + Effect-TS Integration

### 3.1 SDK Architecture

The `@mysten/sui` package (npm) provides modular sub-packages:

```
@mysten/sui/client        - SuiClient for RPC queries and tx submission
@mysten/sui/transactions  - Transaction builder class for PTBs
@mysten/sui/keypairs/*    - Ed25519, Secp256k1, Secp256r1 key management
@mysten/sui/cryptography  - Core crypto types
@mysten/sui/multisig      - Multi-signature transaction support
@mysten/sui/bcs           - Binary Canonical Serialization
@mysten/sui/verify        - Transaction and message signature verification
@mysten/sui/faucet        - Test token requests
@mysten/sui/zklogin       - Zero-knowledge login helpers
@mysten/sui/utils         - Formatting and parsing utilities
```

**Rate limiting**: Public endpoints support ~100 requests per 30 seconds. Production
deployments need dedicated nodes via infrastructure providers.

### 3.2 TypeScript Transaction Building

```typescript
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });
const tx = new Transaction();

// Split gas coin into two coins
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100)]);

// Transfer to recipient
tx.transferObjects([coin], tx.pure.address('0xRecipient'));

// Move function call
tx.moveCall({
  target: `${PACKAGE_ID}::organization::register_equipment`,
  arguments: [
    tx.object(orgObjectId),           // Shared object reference
    tx.pure.u8(1),                    // asset_type
    tx.pure.string('CNC-Mill-1'),     // name
    tx.pure.vector('string', ['cnc_milling', '3axis']),  // capabilities
  ],
});

// Execute
const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});
```

### 3.3 Effect-TS Service Wrapping

Every SDK operation returns a Promise, mapping directly to `Effect.tryPromise()`:

```typescript
import { Effect, Layer, Context, Schema } from 'effect'
import { SuiClient } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'

// Error type
class SuiError extends Schema.TaggedError<SuiError>()('SuiError', {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}

// Service definition
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
    readonly queryEvents: (
      filter: SuiEventFilter
    ) => Effect.Effect<PaginatedEvents, SuiError>
  }
>() {}

// Live implementation
const makeSuiService = (url: string) => {
  const client = new SuiClient({ url })

  return SuiService.of({
    client,
    executeTransaction: (tx, signer) =>
      Effect.tryPromise({
        try: () => client.signAndExecuteTransaction({
          signer,
          transaction: tx,
          options: { showObjectChanges: true, showBalanceChanges: true },
        }),
        catch: (e) => new SuiError({
          cause: e,
          message: `Transaction execution failed: ${e}`,
        }),
      }),
    getObject: (objectId) =>
      Effect.tryPromise({
        try: () => client.getObject({
          id: objectId,
          options: { showContent: true, showOwner: true },
        }),
        catch: (e) => new SuiError({ cause: e, message: `getObject failed: ${e}` }),
      }),
    getDynamicFields: (parentId) =>
      Effect.tryPromise({
        try: () => client.getDynamicFields({ parentId }),
        catch: (e) => new SuiError({ cause: e, message: `getDynamicFields failed: ${e}` }),
      }),
    queryEvents: (filter) =>
      Effect.tryPromise({
        try: () => client.queryEvents({ query: filter }),
        catch: (e) => new SuiError({ cause: e, message: `queryEvents failed: ${e}` }),
      }),
  })
}

const SuiServiceLive = Layer.succeed(
  SuiService,
  makeSuiService('https://fullnode.mainnet.sui.io:443')
)
```

### 3.4 Effect Layer Composition

The SuiService slots into the existing EntityStack Layer composition:

```typescript
// New layers for Sui integration
const SuiIntegrationLayer = Layer.mergeAll(
  SuiServiceLive,           // RPC client + transaction execution
  SuiIdentityLive,          // zkLogin + address derivation
  SuiSettlementLive,        // Marketplace PTB construction
  SuiComplianceLive,        // Certificate anchoring
  SuiSyncAdapterLive,       // Capacity status sync trigger
)

// Full platform layer
const PlatformLayer = Layer.mergeAll(
  EntityHandlersLayer,       // ISA-95 entities (existing)
  EventDistributionLayer,    // NATS channels (existing)
  SparkplugPipelineLayer,    // Edge ingestion (existing)
  WebSocketServerLayer,      // Client subscriptions (existing)
  SuiIntegrationLayer,       // Blockchain trust layer (NEW)
)
```

### 3.5 Production Considerations

```typescript
// Rate limiting with Effect.rateLimit
const rateLimitedSui = SuiService.pipe(
  Effect.rateLimit(50, '30 seconds'),  // 50 req per 30s (below 100 limit)
)

// Retry with exponential backoff
const resilientTransaction = (tx: Transaction, signer: Keypair) =>
  Effect.gen(function* () {
    const sui = yield* SuiService
    return yield* sui.executeTransaction(tx, signer).pipe(
      Effect.retry({
        times: 3,
        schedule: Schedule.exponential('500 millis'),
      }),
    )
  })

// Connection pooling via Layer.memoize (singleton client per process)
const SuiServiceMemoized = Layer.memoize(SuiServiceLive)
```

### 3.6 Event Subscription

Sui's WebSocket event subscription is deprecated. Current approaches:

1. **Polling via queryEvents** (recommended):
   ```typescript
   const pollEvents = (packageId: string) =>
     Stream.asyncScoped<SuiEvent, SuiError>((emit) =>
       Effect.gen(function* () {
         const sui = yield* SuiService
         let cursor: string | null = null
         yield* Effect.forever(
           Effect.gen(function* () {
             const page = yield* sui.queryEvents({
               MoveEventModule: { package: packageId, module: 'organization' },
             })
             for (const event of page.data) {
               yield* emit.single(event)
             }
             cursor = page.nextCursor
             yield* Effect.sleep('5 seconds')
           })
         )
       })
     )
   ```

2. **Custom indexer** for high-volume event processing
3. **gRPC streaming API** (Mysten, expected GA 2026)

---

## 4. Manufacturing Commons Use Cases on Sui

### 4.1 Organization Identity (zkLogin)

[zkLogin](https://docs.sui.io/concepts/cryptography/zklogin) enables blockchain
transactions using OAuth credentials without wallet setup.

**How it works:**
```
1. User authenticates with OAuth provider (Google, Apple, Facebook)
2. Ephemeral keypair generated client-side (session-scoped)
3. OAuth JWT + salt -> zero-knowledge proof via proving service
4. Transaction signed with ephemeral key + ZK proof
5. Sui validators verify proof against cached provider JWKs
6. No persistent private key needed
```

**Earl's Onboarding Path (RFC-001 R-N5 compliance):**
```
1. Earl scans QR code on $50 edge device    -> Opens web app
2. Earl clicks "Sign in with Google"         -> OAuth flow
3. App generates ephemeral keypair           -> Stored in session
4. ZK proof generated (2-3 min, cached)      -> One-time per session
5. App creates Organization object on Sui    -> Earl's identity on-chain
6. App provisions NATS account (JWT signed)  -> Edge device connects
7. Edge device starts publishing sensor data -> NATS flow active

Total wall-clock: ~5 minutes (within 15-minute requirement)
```

**Security properties:**
- Two-factor: requires BOTH OAuth credential AND salt
- Ephemeral keys expire at epoch boundary
- Deterministic: same (provider, app, user) -> same Sui address
- No persistent private key to lose or manage

**Multi-sig governance:**
```
Organization admin: 2-of-3 multisig
  Signer 1: Owner's Google zkLogin
  Signer 2: Co-owner's Facebook zkLogin
  Signer 3: Cold storage Ed25519 key (recovery)
```

### 4.2 Capability NFTs

Machine capabilities as transferable/verifiable tokens:

```move
module manufacturing_commons::capability {
    use sui::object::{Self, UID};

    /// Machine capability token - proves specific manufacturing ability.
    /// Transferable (has store) so it can be listed on marketplace.
    struct CapabilityToken has key, store {
        id: UID,
        org_id: address,
        equipment_id: address,
        capability_type: vector<u8>,    // "cnc_milling_5axis"
        material_types: vector<vector<u8>>,  // ["aluminum", "titanium"]
        tolerance_class: u8,            // ISO IT grade
        certified_by: address,          // Third-party certifier address
        certified_at_ms: u64,
        expires_at_ms: u64,
    }
}
```

Marketplace queries filter by capability type, material types, and tolerance class
to match buyer needs with seller capabilities.

### 4.3 Reputation Score

On-chain reputation as a transparent, auditable metric:

```move
module manufacturing_commons::reputation {
    struct ReputationRecord has key {
        id: UID,
        org_id: address,
        total_jobs_completed: u64,
        total_jobs_disputed: u64,
        on_time_delivery_rate: u64,    // basis points (9500 = 95.00%)
        quality_score: u64,            // basis points
        response_time_avg_ms: u64,     // average response to new jobs
        last_updated_ms: u64,
    }

    /// Called atomically within settlement PTB
    public entry fun record_completion(
        record: &mut ReputationRecord,
        was_on_time: bool,
        quality_rating: u64,           // 0-10000 basis points
        clock: &Clock,
        _ctx: &mut TxContext,
    ) {
        record.total_jobs_completed = record.total_jobs_completed + 1;
        // Update rolling averages...
        record.last_updated_ms = sui::clock::timestamp_ms(clock);
    }
}
```

### 4.4 Work Order Settlement (Escrow)

Atomic marketplace settlement using PTBs:

```typescript
const settleMarketplaceJob = (params: {
  jobId: string
  buyerOrg: string
  sellerOrg: string
  paymentCoinId: string
  amount: bigint
  platformFeeRate: number  // basis points
}) => Effect.gen(function* () {
  const sui = yield* SuiService
  const signer = yield* SignerService

  const tx = new Transaction()

  // 1. Split payment: platform fee + seller payment
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

  // 5. Update seller reputation
  tx.moveCall({
    target: `${PACKAGE_ID}::reputation::record_completion`,
    arguments: [tx.object(params.sellerOrg)],
  })

  // All 5 steps execute atomically
  return yield* sui.executeTransaction(tx, yield* signer.getKeypair())
})
```

### 4.5 Compliance Anchoring

Batch Merkle roots of JetStream events anchored on-chain for tamper-proof audit:

```move
module compliance_anchor::anchor {
    use sui::object::{Self, UID};
    use sui::event;
    use sui::clock::Clock;

    /// Immutable anchor -- frozen after creation, permanent audit record.
    public struct EventBatchAnchor has key, store {
        id: UID,
        org_id: vector<u8>,
        stream_type: vector<u8>,         // "entity-events", "alarm-events"
        batch_start_seq: u64,            // JetStream starting sequence
        batch_end_seq: u64,              // JetStream ending sequence
        merkle_root: vector<u8>,         // 32-byte SHA-256 Merkle root
        event_count: u64,
        anchor_timestamp_ms: u64,
        origin_timestamp_range: vector<u64>,  // [earliest, latest]
    }

    public struct AnchorCreated has copy, drop {
        org_id: vector<u8>,
        stream_type: vector<u8>,
        batch_end_seq: u64,
        merkle_root: vector<u8>,
        anchor_timestamp_ms: u64,
    }

    public entry fun create_anchor(
        org_id: vector<u8>,
        stream_type: vector<u8>,
        batch_start_seq: u64,
        batch_end_seq: u64,
        merkle_root: vector<u8>,
        event_count: u64,
        origin_timestamp_range: vector<u64>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let ts = sui::clock::timestamp_ms(clock);
        let anchor = EventBatchAnchor {
            id: object::new(ctx),
            org_id,
            stream_type,
            batch_start_seq,
            batch_end_seq,
            merkle_root,
            event_count,
            anchor_timestamp_ms: ts,
            origin_timestamp_range,
        };

        event::emit(AnchorCreated {
            org_id: anchor.org_id,
            stream_type: anchor.stream_type,
            batch_end_seq: anchor.batch_end_seq,
            merkle_root: anchor.merkle_root,
            anchor_timestamp_ms: ts,
        });

        // Freeze: permanently immutable, irrevocable
        sui::transfer::freeze_object(anchor);
    }
}
```

**Anchoring tiers:**

| Tier | Orgs | Frequency | Rationale |
|------|------|-----------|-----------|
| T1 Critical (FDA/ITAR) | 2,000 | Hourly | Regulatory mandate |
| T2 Standard (ISO 9001) | 18,000 | Every 6 hours | Cost/audit balance |
| T3 Basic | 80,000 | Daily | Minimum viable compliance |
| T4 Minimal | 100,000 | Weekly | Low-regulation shops |

### 4.6 Capacity Tokens

Tokenized machine-hours as tradeable assets:

```move
module manufacturing_commons::capacity {
    use sui::coin::{Self, TreasuryCap};

    /// Capacity token represents 1 machine-hour of specific capability.
    /// Fungible within same capability class.
    struct CAPACITY has drop {}

    /// Mint capacity tokens when machine registers availability.
    public entry fun mint_capacity(
        treasury: &mut TreasuryCap<CAPACITY>,
        machine_hours: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let token = coin::mint(treasury, machine_hours, ctx);
        transfer::public_transfer(token, recipient);
    }
}
```

---

## 5. Hybrid Architecture: NATS + Sui

### 5.1 System Topology

```
                          +----------------------+
                          |   Sui Blockchain      |
                          |   (Trust Layer)       |
                          |                       |
                          |  Organization objects |
                          |  Equipment registry   |
                          |  Marketplace contracts|
                          |  Compliance certs     |
                          |  Reputation scores    |
                          +----------+-----------+
                                     |
                              PTB execution
                              (async, ~500ms)
                                     |
+----------------+          +--------v-----------+          +----------------+
|  Edge Device   |  MQTT/   |   TMNL Platform    |  WS/RPC  |   Browser/     |
|  ($50 sensor)  |--Spark-->|   (Effect-TS)      |<-------->|   Dashboard    |
|                |  plug-B  |                     |          |                |
|  Sensor data   |          |  +---------------+ |          |  Real-time     |
|  1-10 Hz       |          |  | NATS JetStream| |          |  telemetry     |
|                |          |  | (Event Layer) | |          |  OEE metrics   |
+----------------+          |  +---------------+ |          |  Alarm status  |
                            |                     |          |                |
                            |  +---------------+ |          |  Marketplace   |
                            |  | Entity System | |          |  (reads Sui)   |
                            |  | @effect/cluster| |          |                |
                            |  +---------------+ |          +----------------+
                            |                     |
                            |  +---------------+ |          +----------------+
                            |  | SuiService    | |          |   Walrus       |
                            |  | (Effect Layer)| |--------->|   (Documents)  |
                            |  +---------------+ |          +----------------+
                            +---------------------+
```

### 5.2 What Goes On-Chain vs Off-Chain

#### ON-CHAIN (Sui)

| Data | Object Type | Update Frequency | Rationale |
|------|------------|------------------|-----------|
| Organization identity | Shared object | Rare (config) | Self-sovereign, no central authority |
| Equipment registry | Dynamic object fields | On add/remove | Verifiable asset inventory |
| Capability declarations | Equipment metadata | On change | Trustless marketplace matching |
| Trust/reputation scores | Organization field | Per completed job | Cross-org consensus |
| Marketplace job listings | Shared objects | Per listing/bid | Multi-party, atomic settlement |
| Job settlements | PTBs with coin splits | Per completion | Trustless payment |
| Compliance certificates | Immutable objects | On issuance | Tamper-proof audit trail |
| Disclosure policies | Organization field | On policy change | Enforceable data sharing |
| Governance votes | Shared objects | Per proposal/vote | Transparent (Ostrom P3) |

#### OFF-CHAIN (NATS JetStream)

| Data | Transport | Frequency | Rationale |
|------|-----------|-----------|-----------|
| Sensor readings | NATS subject/sensor | 1-10 Hz | Too frequent, no cross-org need |
| Entity state transitions | EventDistribution | Event-driven | <100ms latency requirement |
| Alarm lifecycle | NATS + alarm channel | Event-driven | Time-critical, org-internal |
| Equipment state changes | NATS + equip channel | Event-driven | Real-time U-1 cascade |
| Cache invalidations | NATS + invalidation | Event-driven | UI reactivity, ephemeral |
| WebSocket subscriptions | RPC streaming | Per subscriber | Client-specific |
| OEE calculations | In-process | Per reading batch | Derived data |
| Sparkplug-B ingestion | MQTT -> NATS bridge | Per MQTT message | Edge protocol |

#### HYBRID (Off-chain primary, on-chain anchoring)

| Data | Primary Layer | Anchor Layer | Pattern |
|------|--------------|-------------|---------|
| Equipment status | NATS (real-time) | Sui (periodic) | Hourly aggregate anchor |
| OEE metrics | In-process | Sui (daily) | Daily snapshot as immutable object |
| Alarm history | EventDistribution | Sui (on resolution) | Resolution hash for compliance |
| Capacity availability | NATS (real-time) | Sui (on change) | Binary signal on transition |

### 5.3 Latency Budget

```
REAL-TIME PATH (NATS):
  Sensor -> NATS:          ~1ms   (local network)
  NATS -> Entity handler:  ~1ms   (in-process)
  Entity -> State machine: ~1ms   (in-process)
  State -> EventDist:      ~1ms   (fiber-to-fiber)
  EventDist -> WebSocket:  ~5ms   (network)
  ----------------------------------------
  Total:                    ~10ms

SETTLEMENT PATH (Sui):
  Capacity change -> PTB:  ~50ms  (construct)
  PTB -> Finality:         ~500ms (fast path, owned obj)
  ----------------------------------------
  Total:                    ~550ms

COMPLIANCE PATH (Sui):
  Batch timer fires:       periodic
  Merkle computation:      ~100ms (1000 events)
  PTB -> Finality:         ~500ms
  ----------------------------------------
  Total:                    ~600ms (non-blocking, async)
```

### 5.4 Identity Bridge: Sui Wallet -> NATS JWT

```
zkLogin address  ->  derives Organization.id on Sui
Organization.id  ->  maps to NATS account name
NATS account     ->  issues JWTs for org's edge devices

Key property: Deterministic mapping. Same (provider, app, user) tuple
always resolves to the same Sui address, which maps to the same
NATS account. No central registry needed.
```

### 5.5 Event Anchoring Flow

```typescript
// Periodic compliance anchoring (Effect pipeline)
const anchorBatch = (orgId: string, streamType: string) =>
  Effect.gen(function* () {
    const jetstream = yield* JetStreamService
    const anchor = yield* SuiAnchorService

    // 1. Get last anchored sequence
    const lastAnchor = yield* anchor.getLatestAnchor({ orgId, streamType })
    const startSeq = Option.match(lastAnchor, {
      onNone: () => 1,
      onSome: (a) => a.batchEndSeq + 1,
    })

    // 2. Fetch events since last anchor
    const events = yield* jetstream.fetchRange({
      stream: `${orgId}.${streamType}`,
      startSeq,
      endSeq: startSeq + BATCH_SIZE - 1,
    })

    if (events.length === 0) return Option.none()

    // 3. Compute Merkle root off-chain
    const merkleRoot = computeMerkleRoot(
      events.map(e => hashEvent(e))
    )

    // 4. Anchor on Sui
    const tx = new Transaction()
    tx.moveCall({
      target: `${PACKAGE_ID}::anchor::create_anchor`,
      arguments: [
        tx.pure.vector('u8', Buffer.from(orgId)),
        tx.pure.vector('u8', Buffer.from(streamType)),
        tx.pure.u64(startSeq),
        tx.pure.u64(startSeq + events.length - 1),
        tx.pure.vector('u8', merkleRoot),
        tx.pure.u64(events.length),
        tx.pure.vector('u64', [events[0].timestamp, events[events.length-1].timestamp]),
        tx.object.clock(),
      ],
    })

    const result = yield* sui.executeTransaction(tx, yield* signer.getKeypair())
    return Option.some(result)
  })
```

---

## 6. Sui Object Model for ISA-95

### 6.1 Hierarchy Mapping

The ISA-95 equipment hierarchy maps naturally to Sui's dynamic object fields:

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

### 6.2 Telescoping Hierarchy Examples

**Earl's Machine Works** (2 levels):
```
Organization [shared]
  +-- ofield "equip:CNC-1" -> Equipment { asset_type: MACHINE }
       +-- dfield "sensor:spindle-temp" -> SensorMeta { ... }
```

**Boeing Atlanta Supplier** (8 levels):
```
Organization [shared]
  +-- ofield "site:ATL" -> Site { ... }
       +-- ofield "area:wing-fab" -> Area { ... }
            +-- ofield "plant:bldg-7" -> Plant { ... }
                 +-- ofield "line:assembly-1" -> Line { ... }
                      +-- ofield "workcell:wc-42" -> WorkCell { ... }
                           +-- ofield "equip:press-1" -> Equipment { ... }
                                +-- dfield "sensor:pressure-42" -> SensorMeta { ... }
```

### 6.3 Gas Implications

Dynamic fields only incur gas when accessed. An Organization with 1,000 Equipment entries
pays gas only for the specific Equipment objects touched in a transaction. This makes the
model cost-effective for hierarchies ranging from 1 machine (Earl) to 10,000+ (Boeing).

### 6.4 On-Chain / NATS Topic Mirroring

```
On-chain hierarchy          NATS topic hierarchy
==================          ====================
Organization.id      <-->   NATS account
  ofield "site:ATL"  <-->   spBv1.0.org.ATL
    ofield "line:1"  <-->   spBv1.0.org.ATL.line-1
      Equipment.id   <-->   spBv1.0.org.ATL.line-1.DDATA.equip-1
```

The on-chain hierarchy mirrors the off-chain NATS topic hierarchy, enabling
on-chain verification of off-chain topic routing claims.

---

## 7. Comparison with Alternatives

### 7.1 Blockchain Comparison

| Metric | Sui | Solana | Ethereum L1 | Ethereum L2 (Optimism/Base) |
|--------|-----|--------|------------|----------------------------|
| **Consensus** | Mysticeti v2 (DAG BFT) | PoH + Tower BFT (Alpenglow 2026) | Casper FFG + LMD-GHOST | Optimistic/ZK rollup |
| **Finality** | <1s (owned: <500ms) | ~400ms (12.8s full, 100ms Alpenglow) | 12-15s | Depends on rollup type |
| **Throughput** | 200K+ TPS | ~65K TPS (400K testnet) | 15-30 TPS | 2,000-4,000 TPS |
| **Tx Cost** | ~$0.003 | ~$0.001 | ~$2-20 | ~$0.01-0.10 |
| **Data Model** | Object-centric (Move) | Account-based (Solana VM) | Account-based (EVM) | Account-based (EVM) |
| **Smart Contracts** | Move (resource-safe) | Rust (BPF) | Solidity/Vyper | Solidity/Vyper |
| **Identity** | zkLogin (OAuth -> blockchain) | None native | None native | None native |
| **Sponsored Tx** | Native support | Limited (fee relayer) | ERC-4337 (complex) | ERC-4337 |
| **Storage** | Walrus (native, $140M funded) | Arweave/IPFS (external) | IPFS/Filecoin (external) | IPFS (external) |
| **Object Ownership** | Native (owned/shared/immutable) | No native concept | No native concept | No native concept |

### 7.2 Why Sui Over Alternatives

**vs Solana:**
- Sui's object model maps directly to ISA-95 entities (1:1)
- Solana's account model requires manual mapping (less natural)
- Sui has zkLogin for frictionless onboarding; Solana does not
- Sui's sponsored transactions are simpler than Solana's fee relayers
- Solana has larger ecosystem but no manufacturing focus

**vs Ethereum L2s:**
- Sui provides L1-grade finality (no challenge periods)
- L2 rollups inherit sequencer trust assumptions
- Sui's Move language prevents asset duplication (linear types)
- L2 costs are competitive but require bridge trust

**vs Ethereum L1:**
- Cost: $0.003 vs $2-20 per transaction (600x cheaper)
- Throughput: 200K vs 30 TPS
- Finality: <1s vs 12-15s
- Not viable for manufacturing-scale operations

### 7.3 Sui-Specific Advantages for Manufacturing

1. **Object = Entity**: Natural mapping eliminates impedance mismatch
2. **zkLogin**: Earl joins with Google, not MetaMask
3. **PTBs**: Multi-step settlement in one atomic transaction
4. **Dynamic fields**: Telescoping hierarchy without fixed schema
5. **Move safety**: Cannot duplicate compliance certificates
6. **Walrus**: Native document storage for compliance
7. **Sponsored tx**: Platform subsidizes small shops

### 7.4 Risks Unique to Sui

1. **Smaller ecosystem** than Solana/Ethereum (less tooling, fewer auditors)
2. **Move learning curve** (team has no Move experience)
3. **No manufacturing precedent** (we'd be first production IIoT use case)
4. **Token volatility** affects gas costs (mitigated by validator gas pricing)
5. **Centralization concerns** (Mysten Labs influence on validator set)

---

## 8. Cost Analysis

### 8.1 Per-Transaction Costs (at $1/SUI)

| Transaction Type | Data Size | MIST Cost | USD Cost |
|-----------------|-----------|-----------|----------|
| Immutable anchor (256 bytes) | 256 B | ~2,950,000 | ~$0.003 |
| Immutable anchor (512 bytes) | 512 B | ~4,900,000 | ~$0.005 |
| Equipment registration | ~1 KB | ~8,000,000 | ~$0.008 |
| Marketplace settlement PTB | ~2 KB | ~15,000,000 | ~$0.015 |
| PTB batch (10 anchors) | ~2.5 KB | ~20,500,000 | ~$0.020 |

### 8.2 Monthly Cost Model (200K Organizations)

**Tiered Anchoring (Recommended):**

| Tier | Orgs | Freq | Daily Anchors | Daily Txs | Daily Cost |
|------|------|------|--------------|-----------|------------|
| T1 Critical (FDA/ITAR) | 2,000 | Hourly | 192,000 | 19,200 | $384 |
| T2 Standard (ISO) | 18,000 | 6-hourly | 288,000 | 28,800 | $576 |
| T3 Basic | 80,000 | Daily | 320,000 | 32,000 | $640 |
| T4 Minimal | 100,000 | Weekly | 56,000 | 5,600 | $112 |
| **Total** | **200,000** | | **856,000** | **85,600** | **$1,712** |

```
Monthly anchoring cost:     ~$51,360
Per-org average:            $0.26/month
Per T1 org (FDA):           $5.76/month
Per T4 org (minimal):       $0.016/month
```

**+ Event-triggered anchoring:**
```
SIL 3-4 alarm anchors:     ~5,000/day x $0.003 = $15/day
Settlement anchors:         ~10,000/day x $0.002 = $20/day
Safety incident anchors:    ~100/day x $0.003 = $0.30/day

Total daily:               ~$1,747
Monthly total:             ~$52,410
```

### 8.3 Earl's Monthly Cost (Solo Machinist)

| Operation | Frequency | Unit Cost | Monthly Cost |
|-----------|-----------|-----------|-------------|
| Organization creation | One-time | $0.01 | $0 (amortized) |
| Equipment registration | One-time (1 machine) | $0.008 | $0 (amortized) |
| Capacity status sync | ~10/day | $0.003 | $0.90 |
| Compliance anchoring (T3) | Daily | $0.003 | $0.09 |
| Marketplace settlement | ~2/month | $0.015 | $0.03 |
| **Total** | | | **~$1.02/month** |

Well within the manufacturing commons accessibility target. Platform-sponsored
transactions could bring this to $0 for Earl.

### 8.4 SUI Price Sensitivity

| SUI Price | Monthly Cost | Per-Org/Month |
|-----------|-------------|---------------|
| $0.50 | ~$26K | $0.13 |
| $1.00 | ~$52K | $0.26 |
| $2.00 | ~$104K | $0.52 |
| $5.00 | ~$260K | $1.30 |
| $10.00 | ~$520K | $2.60 |

**Mitigation**: Sui's reference gas price is set by the validator committee per
epoch. If SUI price increases significantly, validators can lower the gas price
to maintain reasonable costs.

### 8.5 Comparison with Alternatives

| Approach | Monthly (200K orgs) | Per-Org/Month | Audit Independence |
|----------|-------------------|---------------|-------------------|
| JetStream only (current) | $0 | $0 | None (trust platform) |
| **Sui anchoring** | **~$52K** | **$0.26** | **Full cryptographic** |
| Traditional HSM timestamping | ~$200K+ | $1.00+ | Moderate (trust TSA) |
| Ethereum L1 anchoring | ~$500K+ | $2.50+ | Full but expensive |
| Ethereum L2 (Optimism/Base) | ~$30K | $0.15 | Moderate (trust sequencer) |

---

## 9. Implementation Roadmap

### 9.1 Phase A: Foundation (2-3 sprints)

| Item | Description |
|------|------------|
| Move modules | Organization, Equipment, OrgAdminCap structs |
| SuiService | Effect Layer wrapping @mysten/sui SDK |
| SignerService | Key management, multi-sig support |
| Devnet deployment | Move package publish + integration tests |

### 9.2 Phase B: Identity (1-2 sprints)

| Item | Description |
|------|------------|
| zkLogin integration | OAuth flow -> Sui address derivation |
| NATS account bridge | Sui Organization.id -> NATS account provisioning |
| Edge onboarding | QR code -> zkLogin -> equipment registration |

### 9.3 Phase C: Marketplace (2-3 sprints)

| Item | Description |
|------|------------|
| Marketplace Move module | Job, Bid, Escrow structs + settlement logic |
| Settlement PTBs | Atomic multi-step settlement construction |
| Reputation module | On-chain scoring, rolling averages |
| Capability tokens | Equipment capability NFTs for marketplace matching |

### 9.4 Phase D: Compliance (1-2 sprints)

| Item | Description |
|------|------------|
| Compliance anchor module | EventBatchAnchor + Merkle root storage |
| AnchorScheduler | Tiered periodic anchoring (T1-T4) |
| Verification RPC | Auditor verification endpoint |
| Merkle proof library | Off-chain proof generation + verification |

### 9.5 Phase E: Capacity Sync (1-2 sprints)

| Item | Description |
|------|------------|
| SuiSyncAdapter | Entity state change -> Sui capacity_status update |
| Capacity tokens | Fungible machine-hour tokens |
| Gas station | Sponsored transaction service for small orgs |

**Total: 7-12 sprints**, with Phase A-B delivering minimum viable on-chain footprint.

### 9.6 Tier Deployment

| Tier | Sui Integration | Notes |
|------|----------------|-------|
| T1 ($50 edge) | None | Ingestion only, no blockchain awareness |
| T2 ($500 edge) | SuiServiceLive (read-only) | Verify identity, read equipment registry |
| T3 (cloud) | Full SuiIntegrationLayer | Read + write, settlement, compliance |

---

## 10. Risk Assessment

### 10.1 Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Sui network instability | LOW | HIGH | NATS layer operates independently; graceful degradation |
| Gas cost spikes (SUI >$10) | MEDIUM | MEDIUM | Reduce frequency; validator gas price adjustment |
| zkLogin provider outage | LOW | MEDIUM | Multi-provider (Google + Facebook + Apple) |
| Move language learning curve | HIGH | MEDIUM | Start with simple modules; hire Move audit |
| Regulatory crypto uncertainty | MEDIUM | HIGH | On-chain layer is optional; works without it |
| No manufacturing precedent | HIGH | LOW | First-mover; potential Sui Foundation grant |
| Sui validator centralization | MEDIUM | MEDIUM | Multi-chain anchor option as backup |
| Walrus immaturity | MEDIUM | LOW | IPFS fallback for document storage |

### 10.2 What Sui Does NOT Replace

- JetStream event sourcing (primary audit trail)
- NATS account isolation (primary tenant boundary)
- JetStream deny_delete/deny_purge (primary tamper resistance)
- NATS JWT authentication (daily operations)
- Effect-TS service layer (all business logic)

**Sui is a complementary verification layer, not a replacement.**

### 10.3 Open Questions

| # | Question | Recommendation |
|---|----------|---------------|
| Q1 | Equipment status sync: push or pull? | Push for binary availability, pull for detail |
| Q2 | Minimum viable on-chain footprint? | Phase A: identity + registry only |
| Q3 | Move package versioning strategy? | Multi-sig UpgradeCap aligned with org governance |
| Q4 | Organizations that refuse blockchain? | NATS layer works independently; Sui is additive |
| Q5 | Walrus vs IPFS for documents? | Walrus preferred (native ecosystem); IPFS fallback |
| Q6 | Regulatory acceptance of blockchain proof? | Need regulatory affairs consultation |
| Q7 | Cross-chain portability of anchors? | Structure data for potential migration |

---

## 11. Recommendations

### 11.1 Primary Recommendation: Adopt Sui as Trust Layer

Sui's object-centric model provides a natural mapping to ISA-95 entities, zkLogin
solves the onboarding problem, and PTBs enable atomic multi-step settlement. The
cost model is sustainable at metropolitan scale ($0.26/org/month average).

### 11.2 Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Blockchain | Sui L1 | Object model, zkLogin, PTBs, Move safety |
| Identity | zkLogin + NATS JWT bridge | OAuth onboarding, no seed phrases |
| Settlement | PTB-based atomic escrow | Multi-step atomic, trustless |
| Compliance | Batch Merkle roots on frozen objects | Cost-efficient, event-level verification |
| Documents | Walrus (IPFS fallback) | Native ecosystem, programmable |
| Gas strategy | Platform-sponsored for small orgs | Removes friction for Earl |
| Signing | Multi-sig (2-of-3) for compliance ops | No single operator can create false anchors |
| Deployment | Incremental (Phase A-E) | Blockchain is additive, not required |

### 11.3 Critical Path

```
Phase A (Foundation)  ->  Phase B (Identity)  ->  Phase C (Marketplace)
       |                       |                        |
       v                       v                        v
  SuiService Layer      zkLogin + NATS bridge    Settlement + Reputation
                                                        |
                                                        v
                                              Phase D (Compliance)
                                                        |
                                                        v
                                              Phase E (Capacity Sync)
```

Phase A + B are prerequisites. C, D, E can be parallelized after B.

---

## 12. References

### Sui Documentation
- [Sui Architecture](https://docs.sui.io/concepts/architecture)
- [Object Model](https://docs.sui.io/guides/developer/objects/object-model)
- [Dynamic Fields](https://docs.sui.io/concepts/dynamic-fields)
- [Programmable Transaction Blocks](https://docs.sui.io/concepts/transactions/prog-txn-blocks)
- [PTB Building Guide](https://docs.sui.io/guides/developer/sui-101/building-ptb)
- [Consensus (Mysticeti)](https://docs.sui.io/concepts/sui-architecture/consensus)
- [zkLogin](https://docs.sui.io/concepts/cryptography/zklogin)
- [zkLogin Integration Guide](https://docs.sui.io/guides/developer/cryptography/zklogin-integration)
- [Sponsored Transactions](https://docs.sui.io/concepts/transactions/sponsored-transactions)
- [Gas Fees](https://docs.sui.io/concepts/tokenomics/gas-in-sui)
- [Gas Pricing](https://docs.sui.io/concepts/tokenomics/gas-pricing)
- [Tokenomics](https://docs.sui.io/concepts/tokenomics)
- [Asset Tokenization](https://docs.sui.io/guides/developer/nft/asset-tokenization)
- [NFT Creation](https://docs.sui.io/guides/developer/nft)
- [Trustless Swap Example](https://docs.sui.io/guides/developer/app-examples/trustless-swap)
- [Using Events](https://docs.sui.io/guides/developer/sui-101/using-events)
- [Move Concepts](https://docs.sui.io/concepts/sui-move-concepts)
- [Capability Pattern](https://move-book.com/programmability/capability/)
- [Regulated Currency](https://docs.sui.io/guides/developer/coin/regulated)
- [Research Papers](https://docs.sui.io/concepts/research-papers)

### Sui SDK
- [TypeScript SDK Quick Start](https://sdk.mystenlabs.com/sui)
- [Transaction Building Basics](https://sdk.mystenlabs.com/typescript/transaction-building/basics)
- [SuiClient API](https://sdk.mystenlabs.com/typedoc/classes/_mysten_sui.client.SuiClient.html)
- [@mysten/sui (npm)](https://www.npmjs.com/package/@mysten/sui)

### Sui Blog & Announcements
- [Mysticeti Feature Page](https://www.sui.io/mysticeti)
- [Mysticeti v2 Upgrade](https://blog.sui.io/mysticeti-v2-sui-consensus/)
- [2025 Stack Developments](https://blog.sui.io/2025-sui-stack-developments/)
- [zkLogin Deep Dive](https://blog.sui.io/zklogin-deep-dive/)
- [Sponsored Transactions Explained](https://blog.sui.io/sponsored-transactions-explained/)
- [Storage Fees Explained](https://blog.sui.io/storage-fees-explained/)
- [Dynamic Fields Migration](https://blog.sui.io/dynamic-fields-migration-guide/)
- [All About Objects](https://blog.sui.io/all-about-objects/)
- [NFT Standards](https://blog.sui.io/nft-standards-royalties/)

### Academic Papers
- Mysticeti: Reaching the Latency Limits with Uncertified DAGs ([arXiv:2310.14821](https://arxiv.org/pdf/2310.14821))
- zkLogin: Privacy-Preserving Blockchain Authentication ([arXiv:2401.11735](https://arxiv.org/abs/2401.11735))
- Sui Tokenomics Whitepaper ([docs.sui.io/paper/tokenomics.pdf](https://docs.sui.io/paper/tokenomics.pdf))

### Ecosystem & Tutorials
- [MystenLabs/sui (GitHub)](https://github.com/MystenLabs/sui)
- [Sui Escrow Example](https://github.com/MystenLabs/sui/blob/main/examples/trading/contracts/escrow/sources/lock.move)
- [Sui Cookbook](https://suicookbook.com/programmable-transaction-blocks.html)
- [Sui by Examples](https://www.suibyexamples.com/prod-packages)
- [Move Book](https://move-book.com/programmability/capability/)
- [Sui Move Intro Course](https://intro.sui-book.com/unit-two/lessons/6_capability_design_pattern.html)
- [Walrus Protocol](https://www.walrus.xyz/)
- [Shinami Gas Station](https://docs.shinami.com/product-overviews/sui/gas-station)

### Comparison Sources
- [Sui vs Solana (Ledger)](https://www.ledger.com/academy/topics/blockchain/sui-vs-solana)
- [Sui vs Ethereum vs Solana](https://xbtfx.io/article/sui-vs-ethereum-vs-solana)
- [Solana vs Sui (Helius)](https://www.helius.dev/blog/solana-vs-sui-transaction-lifecycle)
- [Grayscale: Why Sui Stands Out](https://research.grayscale.com/reports/why-sui-stands-out)

### Related TMNL Research Documents
- `research-sui-effect-integration.md` — SDK analysis, Effect service wrapping, PTB patterns
- `research-sui-compliance-anchoring.md` — Merkle tree anchoring, FDA/ISA compliance, cost models
- `research-sui-identity-auth.md` — zkLogin, DID, NATS JWT bridge, multi-sig governance
- `research-sui-marketplace-settlement.md` — Escrow patterns, PTB settlement, reputation

### TMNL Codebase References
- `src/lib/iiot/entity/EntityStack.ts` — Layer composition model
- `src/lib/iiot/adapters/ingestion-service.ts:297-322` — SparkplugPipelineLayer
- `src/lib/iiot/realtime/event-distribution.ts` — EventDistribution channels
- `src/lib/iiot/realtime/reactivity-bridge.ts` — ReactivityBridge fiber pattern
- `src/lib/iiot/schemas/identifiers.ts:28-38` — Branded ISA-95 identifiers
- `docs/specifications/rfc-001-assembled.md` — RFC-001 full specification

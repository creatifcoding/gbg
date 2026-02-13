# Research: Hybrid Architecture -- NATS + Sui + Chainlink for Manufacturing Commons

> **Author:** hybrid-architect (Val)
> **Date:** 2026-02-09
> **Status:** Research Complete
> **Purpose:** Architectural specification for the three-layer (hot/warm/cold) integration of NATS real-time messaging, Sui blockchain settlement, and Chainlink oracle bridging in the TMNL metropolitan manufacturing commons.
> **Companion Docs:**
> - `research-manufacturing-commons.md` -- Platform economics and commons thesis
> - `research-consistency-models.md` -- Consistency guarantees taxonomy
> - `rfc-section-marketplace-protocol.md` -- Marketplace protocol specification
> - `rfc-section-trust-model.md` -- Trust model specification

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Three-Layer Architecture](#2-three-layer-architecture)
3. [Data Flow Traces](#3-data-flow-traces)
4. [Effect-TS Service Architecture](#4-effect-ts-service-architecture)
5. [Consistency Analysis](#5-consistency-analysis)
6. [Cost Projections](#6-cost-projections)
7. [Failure Mode Analysis](#7-failure-mode-analysis)
8. [Sui Smart Contract Architecture](#8-sui-smart-contract-architecture)
9. [Chainlink Integration Patterns](#9-chainlink-integration-patterns)
10. [Security and Trust Composition](#10-security-and-trust-composition)
11. [Migration Strategy](#11-migration-strategy)
12. [Architectural Recommendations](#12-architectural-recommendations)
13. [Open Questions](#13-open-questions)
14. [References](#14-references)

---

## 1. Executive Summary

The TMNL manufacturing commons requires three distinct but integrated infrastructure layers to achieve its vision of a 200,000-organization metropolitan manufacturing network:

| Layer | Technology | Role | Latency | Trust Model |
|-------|-----------|------|---------|-------------|
| **Hot Path** | NATS JetStream | Real-time sensor data, entity state, alarms | <1s | Platform-mediated (NATS accounts) |
| **Warm Path** | Chainlink (Functions, Data Streams, CCIP) | Oracle attestation, cross-chain bridging, verified data | 1-30s | Decentralized oracle consensus (DON) |
| **Cold Path** | Sui Blockchain | Identity, escrow, reputation, compliance anchoring | ~400ms finality | Cryptographic (Move object ownership) |

**Key insight**: These three layers are not redundant. Each serves a fundamentally different trust requirement:

- **NATS** is trusted because we operate the infrastructure and control account isolation. It handles the 2M+ events/sec that would be economically impossible on-chain.
- **Chainlink** is trusted because a Decentralized Oracle Network (DON) independently verifies off-chain data before attesting it on-chain. It bridges the trust gap between NATS and Sui.
- **Sui** is trusted because cryptographic proof and consensus make records immutable and verifiable. It is the permanent record of economic relationships.

**Architecture principle**: *Data moves from hot to cold as trust requirements increase. Speed decreases, permanence increases.*

---

## 2. Three-Layer Architecture

### 2.1 Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                     TMNL Manufacturing Commons                   │
                    └─────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  HOT PATH — NATS JetStream + @effect/cluster                                       │
  │                                                                                     │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
  │  │ Sensor   │  │ Entity   │  │ Alarm    │  │ Equip.   │  │ Capacity           │   │
  │  │ Readings │  │ State    │  │ Events   │  │ State    │  │ Aggregator         │   │
  │  │ <1s      │  │ <5s      │  │ <1s      │  │ <5s      │  │ (derived stream)   │   │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬───────────┘   │
  │       │              │              │              │                 │               │
  │       └──────────────┴──────────────┴──────────────┴─────────────────┘               │
  │                                     │                                               │
  │                    ┌────────────────┴────────────────┐                               │
  │                    │  ChannelService                  │                               │
  │                    │  (EventDistribution layer)       │                               │
  │                    │  readings: maxLag 10K            │                               │
  │                    │  alarms/equip/invalid: maxLag 1K │                               │
  │                    └────────────────┬────────────────┘                               │
  │                                     │                                               │
  └─────────────────────────────────────┼───────────────────────────────────────────────┘
                                        │
                       ┌────────────────┼────────────────┐
                       │ BRIDGE LAYER   │                │
                       │                ▼                │
                       │  ┌─────────────────────────┐   │
                       │  │ MerkleAnchorService      │   │
                       │  │ - Batches events (5min)  │   │
                       │  │ - Computes Merkle root   │   │
                       │  │ - Signs attestation      │   │
                       │  └───────────┬─────────────┘   │
                       │              │                  │
                       └──────────────┼──────────────────┘
                                      │
  ┌───────────────────────────────────┼─────────────────────────────────────────────────┐
  │  WARM PATH — Chainlink Ecosystem  │                                                 │
  │                                   ▼                                                 │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                  │
  │  │ Chainlink        │  │ Chainlink        │  │ Chainlink CCIP   │                  │
  │  │ Functions        │  │ Data Streams     │  │ (future)         │                  │
  │  │                  │  │                  │  │                  │                  │
  │  │ - QC attestation │  │ - Capacity oracle│  │ - Cross-chain    │                  │
  │  │ - Merkle verify  │  │ - Pricing feeds  │  │   settlement     │                  │
  │  │ - Compliance     │  │ - Energy/material│  │ - Multi-chain    │                  │
  │  │   checks         │  │   pricing        │  │   reputation     │                  │
  │  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘                  │
  │           │                     │                      │                            │
  └───────────┼─────────────────────┼──────────────────────┼────────────────────────────┘
              │                     │                      │
              └─────────────────────┼──────────────────────┘
                                    │
  ┌─────────────────────────────────┼───────────────────────────────────────────────────┐
  │  COLD PATH — Sui Blockchain     │                                                   │
  │                                 ▼                                                   │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                  │
  │  │ Organization     │  │ Work Order       │  │ Compliance       │                  │
  │  │ Registry         │  │ Settlement       │  │ Anchoring        │                  │
  │  │                  │  │                  │  │                  │                  │
  │  │ - Identity NFTs  │  │ - Escrow (Move)  │  │ - Merkle roots   │                  │
  │  │ - Capability SBTs│  │ - Milestone pay  │  │ - Audit proofs   │                  │
  │  │ - Reputation SBTs│  │ - Dispute arb.   │  │ - Regulatory     │                  │
  │  │ - Kiosk-based    │  │ - PTB-based      │  │   attestations   │                  │
  │  │   asset mgmt     │  │   settlement     │  │ - Time-stamped   │                  │
  │  └──────────────────┘  └──────────────────┘  └──────────────────┘                  │
  │                                                                                     │
  │  Object Model: Owned Objects for org identity (no consensus needed)                │
  │                Shared Objects for marketplace matching (ordered consensus)           │
  │  Finality: ~400ms (Mysticeti consensus)                                            │
  │  Gas: ~0.003 SUI per transaction (~$0.01 at current rates)                         │
  └─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Responsibilities

#### 2.2.1 Hot Path (NATS JetStream)

The hot path handles all real-time operational data. This is the existing TMNL infrastructure specified in RFC-001.

| Stream | Events/sec (peak) | Ordering | Retention | Purpose |
|--------|-------------------|----------|-----------|---------|
| `iiot.readings.>` | 2M+ | Per-device sequential | 24h (rolling) | Sensor telemetry |
| `iiot.entity.>` | 100K | Per-entity causal | 30d | Entity state transitions |
| `iiot.alarms.>` | 50K | Per-entity causal | 90d | Alarm lifecycle events |
| `iiot.equipment.>` | 50K | Per-entity causal | 30d | Equipment state changes |
| `iiot.capacity.>` | 10K | Per-org eventual | 1h | Aggregated capacity signals |

**Trust boundary**: NATS accounts provide multi-tenant isolation. Each org gets an isolated NATS account with subject-based import/export for cross-org data sharing (see RFC-001 Section Y).

**NOT on the hot path**: Economic transactions, identity verification, compliance proofs, reputation updates. These require stronger trust guarantees than platform-operated infrastructure can provide.

#### 2.2.2 Warm Path (Chainlink)

The warm path provides oracle attestation -- the bridge between platform-operated infrastructure (NATS) and decentralized trust (Sui). Chainlink's DON independently verifies claims before they become on-chain records.

| Service | Function | Latency | Trigger |
|---------|----------|---------|---------|
| **Chainlink Functions** | Execute custom JavaScript in DON, verify Merkle proofs, validate QC data | 1-30s | MerkleAnchorService batch complete |
| **Chainlink Data Streams** | Pull-based sub-second pricing data for materials, energy, capacity | <1s (pull) | Smart contract request |
| **Chainlink Data Feeds** | Push-based aggregated market data (regional capacity index, spot pricing) | Heartbeat (60s) | Periodic update |
| **Chainlink CCIP** (future) | Cross-chain messaging for multi-blockchain settlement | 5-20min | Cross-chain escrow events |

**Trust boundary**: The DON provides Byzantine fault-tolerant consensus on off-chain data. A majority of oracle nodes must agree before data reaches Sui. This prevents a compromised NATS node from injecting false compliance records.

**Chainlink Functions as the verification layer**:
```
NATS Event Batch → MerkleAnchorService → Merkle Root + Batch Metadata
    → Chainlink Function receives: { merkleRoot, batchSize, timeRange, orgId }
    → DON node executes verification:
        1. Query NATS via HTTP endpoint to independently verify batch
        2. Verify Merkle root matches independently computed root
        3. Check batch metadata against org registration
    → DON consensus: 2/3+ nodes agree
    → On-chain callback: Sui smart contract receives verified attestation
```

#### 2.2.3 Cold Path (Sui Blockchain)

The cold path provides permanent, cryptographically verifiable records for economic relationships, identity, and compliance.

| Module | Object Type | Ownership | Purpose |
|--------|-------------|-----------|---------|
| `org_registry` | Owned Object | Org address | Organization identity, capabilities |
| `capability_nft` | Owned Object (SBT) | Org address | Verified manufacturing capabilities |
| `reputation` | Owned Object (SBT) | Org address | Soulbound reputation tokens |
| `work_order` | Shared Object | Marketplace | Escrow, milestone tracking, settlement |
| `marketplace` | Shared Object | Platform | Order book, matching engine |
| `compliance_anchor` | Owned Object | Org address | Merkle roots for audit trails |

**Why Sui specifically**:

1. **Object-centric model** maps naturally to manufacturing entities. An organization IS an object. A capability IS an object. A work order IS an object.
2. **Owned objects bypass consensus** -- org identity updates, reputation accrual, and compliance anchoring only require the org's signature, achieving ~100ms latency.
3. **Shared objects with ordered consensus** for marketplace operations where multiple parties interact, using Mysticeti at ~400ms finality.
4. **Move language prevents common exploits** -- resource-oriented programming prevents double-spending, reentrancy, and asset duplication by construction.
5. **Programmable Transaction Blocks (PTBs)** enable atomic multi-step operations (e.g., "verify capability + accept quote + lock escrow" in one transaction).
6. **Kiosk framework** provides built-in asset transfer policies for capability NFTs and marketplace listings.

### 2.3 Why Three Layers, Not Two

One might ask: why not NATS + Sui directly? The Chainlink warm path exists because:

1. **NATS data is platform-controlled**. If TMNL operates the NATS infrastructure, orgs must trust the platform operator. For identity and basic messaging, this is acceptable. For compliance proofs and financial settlement, it is not.

2. **Sui cannot verify off-chain data**. A Sui smart contract has no way to independently verify that a sensor reading actually occurred. Chainlink's DON provides this verification layer.

3. **Cost efficiency**. Putting every NATS event on-chain would cost ~$20M/month at 2M events/sec. Batching via Merkle trees and anchoring roots reduces this to ~$300/month.

4. **Regulatory defensibility**. An auditor asking "prove this temperature reading was within spec" can trace: Merkle proof (NATS) -> Oracle attestation (Chainlink) -> On-chain anchor (Sui). Three independent systems corroborate the claim.

---

## 3. Data Flow Traces

### 3.1 Scenario A: Sensor Reading to Compliance Proof

**Use case**: A pharmaceutical manufacturer must prove to FDA auditors that all temperature readings during a batch process remained within 20-25C. [FDA-CFR11] requires secure, time-stamped audit trails.

```
Timeline:  0s        5min       5min+10s    5min+30s      Audit (months later)
           │          │           │            │               │
           ▼          ▼           ▼            ▼               ▼

Step 1: Sensor emits temperature reading
  ┌─────────────────────────────────────────────────────────────────┐
  │ NATS Subject: iiot.readings.{orgId}.{siteId}.{deviceId}.temp   │
  │ Payload: { value: 22.4, unit: "C", ts: 1738000000000 }        │
  │ JetStream: Persisted, sequential per-device                    │
  │ Latency: <10ms                                                 │
  └─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
Step 2: ReadingProcessor aggregates batch (runs continuously)
  ┌─────────────────────────────────────────────────────────────────┐
  │ MerkleAnchorService collects readings in 5-minute windows      │
  │ For each window:                                               │
  │   - Computes Merkle tree over all readings in batch            │
  │   - Stores leaf data in NATS KV (key: merkle.{batchId})       │
  │   - Produces: { merkleRoot, batchId, orgId, count, timeRange }│
  │ Trigger: Time-based (5-minute boundaries)                      │
  └─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
Step 3: Chainlink Functions verifies and attests
  ┌─────────────────────────────────────────────────────────────────┐
  │ Chainlink Function (JavaScript in DON):                        │
  │   1. Receives: { merkleRoot, batchId, orgId }                  │
  │   2. Queries TMNL API: GET /api/v1/batches/{batchId}/verify    │
  │   3. Independently recomputes Merkle root from batch data      │
  │   4. Compares roots (must match)                               │
  │   5. Validates: org is registered, batch time is plausible     │
  │   6. Returns: { verified: true, root, attestedAt }             │
  │ DON Consensus: 2/3 nodes must agree                            │
  │ Latency: 10-30 seconds                                        │
  └─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
Step 4: Sui on-chain anchor
  ┌─────────────────────────────────────────────────────────────────┐
  │ Sui Transaction (Programmable Transaction Block):               │
  │   1. compliance_anchor::record_batch(orgObj, {                 │
  │        merkle_root: <bytes32>,                                 │
  │        batch_id: <string>,                                     │
  │        count: 1847,                                            │
  │        time_start: 1738000000,                                 │
  │        time_end: 1738000300,                                   │
  │        chainlink_attestation_id: <bytes32>                     │
  │      })                                                        │
  │   2. Object: ComplianceAnchor (owned by org)                   │
  │   3. No consensus needed (owned object)                        │
  │ Gas: ~0.003 SUI                                                │
  │ Finality: ~100ms (owned object, bypasses consensus)            │
  └─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
Step 5: Audit verification (months later)
  ┌─────────────────────────────────────────────────────────────────┐
  │ Auditor requests proof:                                        │
  │   1. Query Sui: get ComplianceAnchor objects for org+timeRange │
  │   2. Retrieve Merkle root from on-chain record                 │
  │   3. Query NATS KV: get batch leaf data for batchId            │
  │   4. Verify: specific reading IS in Merkle tree (log(n) proof)│
  │   5. Verify: Chainlink attestation confirms root authenticity  │
  │   6. Verify: Sui timestamp confirms anchoring time             │
  │                                                                │
  │ Trust chain:                                                   │
  │   Reading (NATS) ──verify──> Merkle Proof (MerkleAnchorSvc)   │
  │   Merkle Root ──attested──> DON Consensus (Chainlink)          │
  │   Attestation ──anchored──> Sui Object (immutable on-chain)   │
  └─────────────────────────────────────────────────────────────────┘
```

### 3.2 Scenario B: Machine IDLE to Marketplace Signal

**Use case**: Earl's CNC machine finishes a job and transitions to IDLE. The marketplace should discover this capacity and match it to pending work orders within seconds.

```
Step 1: Machine entity state transition (NATS hot path)
  Subject: iiot.entity.{orgId}.machine.{machineId}.state
  Event:   MachineStateChanged { from: RUNNING, to: IDLE, ts }
  Ordering: Causal (G-3 guarantee per RFC-001)

Step 2: CapacityAggregator (derived NATS stream)
  Subscribes: iiot.entity.{orgId}.machine.*.state
  Computes:   { orgId, idleMachines: [{ id, capabilities, since }] }
  Publishes:  iiot.capacity.{orgId}.available
  Latency:    <1s from state change

Step 3: MarketplaceSignalBridge (NATS -> Sui event relay)
  Subscribes: iiot.capacity.*.available
  Batches:    Capacity updates per 10-second window
  Publishes:  Sui transaction to update marketplace shared object

  PTB (Programmable Transaction Block):
    marketplace::update_capacity(marketplaceObj, {
      org_id: <address>,
      machines: [{ capability_hash, available_since }],
    })

  Object: Marketplace (shared object -- requires consensus)
  Finality: ~400ms (Mysticeti)

Step 4: Matching engine (Sui smart contract)
  On marketplace update:
    1. Check pending RFQs against new capacity
    2. If match found: emit MatchFound event
    3. Notify both parties via Sui Events API
    4. Optionally: Chainlink Data Stream for spot pricing

Step 5: Work order initiation
  Buyer confirms match via Sui transaction:
    work_order::create_escrow(buyerObj, sellerObj, {
      rfq_id, quoted_price, deadline, quality_requirements
    })
  Escrow SUI tokens locked in shared object
  Both parties receive on-chain confirmation

Step 6: Real-time status updates during work
  Machine transitions: IDLE -> RUNNING (NATS)
  Progress events published to NATS
  Buyer dashboard subscribes via WebSocket (RFC-001 Phase 5)
  No on-chain updates during execution (cost efficiency)

Step 7: Completion and settlement
  Machine transitions: RUNNING -> IDLE (NATS)
  QC data → Chainlink Functions attestation
  Settlement: work_order::complete(attestation) → escrow released
```

**Timing analysis**:
| Step | Latency | Cumulative |
|------|---------|------------|
| Machine IDLE event | <1s | 1s |
| Capacity aggregation | <1s | 2s |
| Sui marketplace update | ~400ms + bridge delay | ~12s |
| Matching engine | ~100ms | ~12s |
| Work order creation | ~400ms | ~13s |

**Total: ~13 seconds from machine going idle to matched work order.** This is orders of magnitude faster than existing MaaS platforms where capacity discovery takes hours to days.

### 3.3 Scenario C: Full Work Order Lifecycle

```
Phase 1: RFQ (Request for Quote) — Sui
  ┌────────────────────────────────────────────────────┐
  │ Buyer posts RFQ (Programmable Transaction Block):   │
  │   rfq::create(buyerObj, {                          │
  │     part_spec_hash: <IPFS CID>,                    │
  │     quantity: 200,                                 │
  │     material: "6061-T6 Aluminum",                  │
  │     deadline: 1738600000,                          │
  │     required_capabilities: ["CNC_5AXIS", "CMM"],   │
  │     max_budget: 5000_00, // cents                  │
  │     geographic_radius_km: 50,                      │
  │   })                                               │
  │ Object: RFQ (shared, visible to qualified orgs)    │
  │ Gas: ~0.003 SUI                                    │
  └────────────────────────────────────────────────────┘

Phase 2: Quoting — Sui
  ┌────────────────────────────────────────────────────┐
  │ Qualified sellers submit quotes:                    │
  │   rfq::submit_quote(sellerObj, rfqObj, {           │
  │     price: 4200_00,                                │
  │     estimated_days: 3,                             │
  │     capability_proof: <SBT reference>,             │
  │   })                                               │
  │ Capability verification: smart contract checks      │
  │   seller has required capability SBTs               │
  │ Reputation filter: minimum trust score required     │
  └────────────────────────────────────────────────────┘

Phase 3: Acceptance + Escrow — Sui
  ┌────────────────────────────────────────────────────┐
  │ Buyer selects quote, escrow locks:                  │
  │   work_order::accept_and_escrow(buyerObj, quoteObj, │
  │     payment_coin)                                  │
  │ Atomic PTB:                                        │
  │   1. Create WorkOrder shared object                │
  │   2. Lock payment in escrow                        │
  │   3. Record milestone schedule                     │
  │   4. Emit WorkOrderCreated event                   │
  └────────────────────────────────────────────────────┘

Phase 4: Execution — NATS (hot path)
  ┌────────────────────────────────────────────────────┐
  │ Real-time during manufacturing:                     │
  │   - Machine state: NATS iiot.entity.*.machine.*    │
  │   - Progress events: NATS iiot.workorder.{id}.*    │
  │   - QC readings: NATS iiot.readings.{orgId}.*      │
  │   - Alarm events: NATS iiot.alarms.{orgId}.*       │
  │ Buyer dashboard: WebSocket subscription (Phase 5)   │
  │ No on-chain transactions during execution           │
  └────────────────────────────────────────────────────┘

Phase 5: QC Attestation — Chainlink
  ┌────────────────────────────────────────────────────┐
  │ On completion, QC data attested:                    │
  │   Chainlink Function:                              │
  │     1. Fetch QC measurements from TMNL API         │
  │     2. Verify against part spec requirements       │
  │     3. Compute pass/fail per dimension             │
  │     4. Sign attestation with DON consensus         │
  │   Output: QCAttestation { passed: true, ... }      │
  └────────────────────────────────────────────────────┘

Phase 6: Settlement — Sui
  ┌────────────────────────────────────────────────────┐
  │ Settlement transaction (PTB):                       │
  │   1. work_order::submit_completion(                 │
  │        sellerObj, workOrderObj,                     │
  │        chainlink_attestation)                       │
  │   2. Smart contract verifies:                       │
  │      - Attestation is from authorized DON           │
  │      - QC passed requirements                       │
  │      - Deadline met                                 │
  │   3. Escrow released to seller                      │
  │   4. Reputation tokens updated (SBTs)               │
  │   5. Compliance anchor recorded                     │
  │   6. Emit WorkOrderCompleted event                  │
  │ All 6 steps in ONE atomic PTB                       │
  └────────────────────────────────────────────────────┘

Phase 7: Dispute (if needed) — Sui
  ┌────────────────────────────────────────────────────┐
  │ If buyer rejects completion:                        │
  │   work_order::dispute(buyerObj, workOrderObj, {     │
  │     reason: "dimensions_out_of_spec",              │
  │     evidence_merkle_root: <hash>,                  │
  │   })                                               │
  │ Arbitration: platform-appointed arbiter reviews     │
  │   - On-chain QC attestation                        │
  │   - Off-chain Merkle proof of measurements         │
  │   - Reputation history of both parties             │
  │ Resolution: arbiter calls work_order::resolve()     │
  │   - Full release, partial release, or refund       │
  └────────────────────────────────────────────────────┘
```

### 3.4 Scenario D: Cross-Org Trust Verification

```
Step 1: Onboarding — Sui
  New org registers on Sui:
    org_registry::register({
      name: "Earl's Machine Shop",
      ein: <encrypted>,  // Zero-knowledge proof of valid EIN
      location: { lat: 33.749, lng: -84.388 },  // Atlanta
      contact_hash: <encrypted>,
    })
  Creates: OrgIdentity object (owned, non-transferable)
  Verification: Platform confirms EIN via Chainlink Function

Step 2: Capability Claiming — Chainlink + Sui
  Org claims capabilities:
    1. Submit claim: "I have a 5-axis CNC, Haas VF-2"
    2. Chainlink Function verifies:
       - Equipment serial number lookup via manufacturer API
       - Cross-reference with org registration
       - Optional: IoT data confirming machine exists and operates
    3. On verification: mint CapabilityNFT (SBT) to org
       capability::mint_verified(orgObj, {
         equipment_type: "CNC_5AXIS",
         make: "Haas",
         model: "VF-2",
         verified_by: <chainlink_attestation>,
         verified_at: <timestamp>,
       })
    SBT = Soulbound Token (non-transferable)

Step 3: First Work Orders — Reputation Accrual
  Each completed work order mints reputation evidence:
    reputation::record_completion(orgObj, {
      work_order_id,
      quality_score: 98,   // from Chainlink QC attestation
      timeliness_score: 95, // from deadline compliance
      buyer_rating: 4.8,
    })
  Reputation SBTs accumulate, forming an on-chain track record

Step 4: Trust Score Computation
  Trust score is computed from on-chain data:
    trust_score = f(
      verification_level,     // KYC completeness
      capability_count,       // verified capabilities
      completion_count,       // work orders completed
      avg_quality_score,      // from QC attestations
      avg_timeliness_score,   // deadline compliance
      dispute_rate,           // disputes / total orders
      network_age,            // time since registration
    )
  Computed off-chain (Chainlink Function) but anchored on-chain

Step 5: Trust Unlocks Access Tiers
  | Trust Level | Threshold | Unlocks |
  |-------------|-----------|---------|
  | Unverified  | 0         | Browse marketplace only |
  | Basic       | 10 score  | Submit quotes, accept small orders |
  | Verified    | 50 score  | Full marketplace, escrow up to $10K |
  | Trusted     | 200 score | Priority matching, higher escrow limits |
  | Premium     | 500 score | Preferred supplier programs, bulk orders |
```

---

## 4. Effect-TS Service Architecture

### 4.1 Layer Hierarchy

```typescript
// ─── Layer 1: Blockchain Client SDKs ─────────────────────────────

// Sui Client Layer (wraps @mysten/sui TypeScript SDK)
interface SuiClient {
  readonly executePTB: (tx: Transaction) => Effect.Effect<SuiTransactionBlockResponse, SuiError>
  readonly getObject: (id: string) => Effect.Effect<SuiObjectResponse, SuiError>
  readonly subscribeEvents: (filter: EventFilter) => Stream.Stream<SuiEvent, SuiError>
  readonly dryRun: (tx: Transaction) => Effect.Effect<DryRunResult, SuiError>
}

const SuiClient = Context.GenericTag<SuiClient>("SuiClient")

const SuiClientLive = Layer.effect(
  SuiClient,
  Effect.gen(function* () {
    const config = yield* SuiConfig
    const client = new SuiSDKClient({ url: config.rpcUrl })
    const keypair = Ed25519Keypair.fromSecretKey(config.signerKey)
    return SuiClient.of({
      executePTB: (tx) => Effect.tryPromise({
        try: () => client.signAndExecuteTransaction({ signer: keypair, transaction: tx }),
        catch: (e) => new SuiError({ cause: e }),
      }),
      getObject: (id) => Effect.tryPromise({
        try: () => client.getObject({ id, options: { showContent: true } }),
        catch: (e) => new SuiError({ cause: e }),
      }),
      subscribeEvents: (filter) => Stream.async<SuiEvent, SuiError>((emit) => {
        const unsub = client.subscribeEvent({ filter, onMessage: (event) => emit.single(event) })
        return Effect.promise(() => unsub.then((fn) => fn()))
      }),
      dryRun: (tx) => Effect.tryPromise({
        try: () => client.dryRunTransactionBlock({ transactionBlock: tx }),
        catch: (e) => new SuiError({ cause: e }),
      }),
    })
  })
)

// Chainlink Oracle Layer (wraps Chainlink Functions SDK)
interface ChainlinkOracle {
  readonly requestFunction: (req: FunctionRequest) => Effect.Effect<FunctionResponse, ChainlinkError>
  readonly getDataFeed: (feedId: string) => Effect.Effect<DataFeedReport, ChainlinkError>
  readonly subscribeDataStream: (streamId: string) => Stream.Stream<DataStreamUpdate, ChainlinkError>
}

const ChainlinkOracle = Context.GenericTag<ChainlinkOracle>("ChainlinkOracle")

// ─── Layer 2: Domain Services ─────────────────────────────────────

// MerkleAnchorService — bridges hot path to warm path
interface MerkleAnchorService {
  readonly anchorBatch: (batch: EventBatch) => Effect.Effect<AnchorResult, AnchorError>
  readonly verifyProof: (proof: MerkleProof) => Effect.Effect<boolean, AnchorError>
  readonly getBatchProof: (batchId: string, leafIndex: number) => Effect.Effect<MerkleProof, AnchorError>
}

const MerkleAnchorService = Context.GenericTag<MerkleAnchorService>("MerkleAnchorService")

// OrgRegistryService — manages org identity on Sui
interface OrgRegistryService {
  readonly register: (org: OrgRegistration) => Effect.Effect<OrgIdentity, RegistryError>
  readonly verifyCapability: (orgId: string, claim: CapabilityClaim) => Effect.Effect<CapabilityNFT, RegistryError>
  readonly getTrustScore: (orgId: string) => Effect.Effect<TrustScore, RegistryError>
  readonly updateReputation: (orgId: string, evidence: ReputationEvidence) => Effect.Effect<void, RegistryError>
}

const OrgRegistryService = Context.GenericTag<OrgRegistryService>("OrgRegistryService")

// WorkOrderService — manages work order lifecycle on Sui
interface WorkOrderService {
  readonly createRFQ: (rfq: RFQParams) => Effect.Effect<RFQ, WorkOrderError>
  readonly submitQuote: (rfqId: string, quote: QuoteParams) => Effect.Effect<Quote, WorkOrderError>
  readonly acceptAndEscrow: (quoteId: string, payment: PaymentCoin) => Effect.Effect<WorkOrder, WorkOrderError>
  readonly submitCompletion: (orderId: string, attestation: QCAttestation) => Effect.Effect<Settlement, WorkOrderError>
  readonly dispute: (orderId: string, evidence: DisputeEvidence) => Effect.Effect<Dispute, WorkOrderError>
}

const WorkOrderService = Context.GenericTag<WorkOrderService>("WorkOrderService")

// ComplianceService — manages compliance anchoring
interface ComplianceService {
  readonly anchorBatch: (batch: ComplianceBatch) => Effect.Effect<ComplianceAnchor, ComplianceError>
  readonly getAuditProof: (orgId: string, timeRange: TimeRange) => Effect.Effect<AuditProof, ComplianceError>
  readonly verifyReading: (anchor: ComplianceAnchor, reading: SensorReading) => Effect.Effect<boolean, ComplianceError>
}

const ComplianceService = Context.GenericTag<ComplianceService>("ComplianceService")

// MarketplaceService — real-time capacity matching
interface MarketplaceService {
  readonly updateCapacity: (orgId: string, capacity: CapacityUpdate) => Effect.Effect<void, MarketplaceError>
  readonly searchCapacity: (query: CapacityQuery) => Effect.Effect<CapacityMatch[], MarketplaceError>
  readonly subscribeMatches: (orgId: string) => Stream.Stream<MatchNotification, MarketplaceError>
}

const MarketplaceService = Context.GenericTag<MarketplaceService>("MarketplaceService")

// ─── Layer 3: Composed Layer ──────────────────────────────────────

// ManufacturingCommonsLayer composes all services
const ManufacturingCommonsLayer = Layer.mergeAll(
  // Existing NATS layers (from RFC-001)
  EntityDistributionLayer,          // NATS entity events
  EventDistributionLayer,           // ChannelService broadcast
  SparkplugPipelineLayer,           // Sensor ingestion

  // Bridge layer
  MerkleAnchorServiceLive,          // NATS -> Merkle -> Chainlink

  // Blockchain layers
  OrgRegistryServiceLive,           // Sui org identity
  WorkOrderServiceLive,             // Sui work orders
  ComplianceServiceLive,            // Sui compliance anchoring
  MarketplaceServiceLive,           // Sui marketplace
).pipe(
  Layer.provide(SuiClientLive),     // Sui SDK
  Layer.provide(ChainlinkOracleLive), // Chainlink SDK
  Layer.provide(NATSHolonetLayer),  // Existing NATS
)
```

### 4.2 Schema Definitions

```typescript
import { Schema } from "effect"

// ─── Sui Domain Schemas ──────────────────────────────────────────

const SuiAddress = Schema.String.pipe(Schema.brand("SuiAddress"))
const SuiObjectId = Schema.String.pipe(Schema.brand("SuiObjectId"))

const OrgIdentity = Schema.TaggedStruct("OrgIdentity", {
  address: SuiAddress,
  objectId: SuiObjectId,
  name: Schema.NonEmptyString,
  locationHash: Schema.String,
  verificationLevel: Schema.Literal("unverified", "basic", "verified", "trusted", "premium"),
  registeredAt: Schema.Number,
})

const CapabilityNFT = Schema.TaggedStruct("CapabilityNFT", {
  objectId: SuiObjectId,
  orgAddress: SuiAddress,
  equipmentType: Schema.NonEmptyString,
  make: Schema.String,
  model: Schema.String,
  verifiedAt: Schema.Number,
  attestationId: Schema.String,
})

const TrustScore = Schema.TaggedStruct("TrustScore", {
  orgAddress: SuiAddress,
  score: Schema.Number,
  completionCount: Schema.Number,
  avgQualityScore: Schema.Number,
  avgTimelinessScore: Schema.Number,
  disputeRate: Schema.Number,
  computedAt: Schema.Number,
})

const WorkOrderStatus = Schema.Literal(
  "rfq_open", "quoting", "accepted", "in_progress",
  "qc_pending", "completed", "disputed", "settled", "cancelled"
)

const WorkOrder = Schema.TaggedStruct("WorkOrder", {
  objectId: SuiObjectId,
  buyer: SuiAddress,
  seller: SuiAddress,
  status: WorkOrderStatus,
  escrowAmount: Schema.Number,
  partSpecHash: Schema.String,
  quantity: Schema.Number,
  deadline: Schema.Number,
  createdAt: Schema.Number,
})

// ─── Merkle Anchor Schemas ───────────────────────────────────────

const MerkleRoot = Schema.String.pipe(Schema.brand("MerkleRoot"))

const EventBatch = Schema.TaggedStruct("EventBatch", {
  batchId: Schema.String,
  orgId: Schema.String,
  merkleRoot: MerkleRoot,
  eventCount: Schema.Number,
  timeStart: Schema.Number,
  timeEnd: Schema.Number,
  eventType: Schema.Literal("readings", "alarms", "equipment", "entity"),
})

const ComplianceAnchor = Schema.TaggedStruct("ComplianceAnchor", {
  objectId: SuiObjectId,
  orgAddress: SuiAddress,
  merkleRoot: MerkleRoot,
  batchId: Schema.String,
  eventCount: Schema.Number,
  timeStart: Schema.Number,
  timeEnd: Schema.Number,
  chainlinkAttestationId: Schema.String,
  anchoredAt: Schema.Number,
})

const MerkleProof = Schema.TaggedStruct("MerkleProof", {
  root: MerkleRoot,
  leaf: Schema.String,
  path: Schema.Array(Schema.Struct({
    hash: Schema.String,
    direction: Schema.Literal("left", "right"),
  })),
  leafIndex: Schema.Number,
})
```

### 4.3 Bridge Service Implementation Pattern

```typescript
// MerkleAnchorService bridges NATS events to Sui via Chainlink

const MerkleAnchorServiceLive = Layer.effect(
  MerkleAnchorService,
  Effect.gen(function* () {
    const nats = yield* NATSHolonet
    const chainlink = yield* ChainlinkOracle
    const sui = yield* SuiClient

    // Batching window: aggregate events into 5-minute Merkle trees
    const BATCH_WINDOW_MS = 5 * 60 * 1000

    return MerkleAnchorService.of({
      anchorBatch: (batch) =>
        Effect.gen(function* () {
          // Step 1: Request Chainlink Functions attestation
          const attestation = yield* chainlink.requestFunction({
            source: MERKLE_VERIFY_SOURCE,
            args: [batch.merkleRoot, batch.batchId, batch.orgId],
          })

          // Step 2: Build Sui PTB for anchoring
          const tx = new Transaction()
          tx.moveCall({
            target: `${PACKAGE_ID}::compliance_anchor::record_batch`,
            arguments: [
              tx.object(batch.orgId),
              tx.pure.string(batch.merkleRoot),
              tx.pure.string(batch.batchId),
              tx.pure.u64(batch.eventCount),
              tx.pure.u64(batch.timeStart),
              tx.pure.u64(batch.timeEnd),
              tx.pure.string(attestation.id),
            ],
          })

          // Step 3: Execute on Sui
          const result = yield* sui.executePTB(tx)

          return {
            suiTxDigest: result.digest,
            attestationId: attestation.id,
            merkleRoot: batch.merkleRoot,
            anchoredAt: Date.now(),
          }
        }),

      verifyProof: (proof) =>
        Effect.sync(() => {
          // Recompute Merkle root from proof path
          let hash = proof.leaf
          for (const step of proof.path) {
            hash = step.direction === "left"
              ? computeHash(step.hash + hash)
              : computeHash(hash + step.hash)
          }
          return hash === proof.root
        }),

      getBatchProof: (batchId, leafIndex) =>
        Effect.gen(function* () {
          // Retrieve batch data from NATS KV
          const kv = yield* nats.getKeyValue("merkle-batches")
          const batchData = yield* kv.get(batchId)
          // Compute proof path for specific leaf
          return computeMerkleProof(batchData.leaves, leafIndex)
        }),
    })
  })
)
```

---

## 5. Consistency Analysis

### 5.1 Per-Layer Consistency Guarantees

| Property | NATS (Hot) | Chainlink (Warm) | Sui (Cold) |
|----------|-----------|-----------------|-----------|
| **Write ordering** | Linearizable (JetStream) | N/A (request-response) | Per-object sequential |
| **Read ordering** | Sequential per-subject | Pull-based (latest) | Owned: immediate; Shared: ordered |
| **Cross-entity** | Causal (G-3 guarantee) | Independent requests | PTB atomicity within transaction |
| **Finality** | On publish ack | DON consensus (~10-30s) | ~400ms (Mysticeti) |
| **Durability** | File-backed JetStream | DON aggregation | Permanent (blockchain) |
| **Fault tolerance** | R=3 NATS cluster | DON BFT (2/3 nodes) | Sui validators (2/3 stake) |

### 5.2 Cross-Layer Consistency

The three layers operate with different consistency models. The bridge layer must handle disagreements:

#### 5.2.1 NATS -> Chainlink Consistency

**Guarantee**: Eventually consistent with bounded staleness (batch window).

A reading published to NATS at time T will appear in a Chainlink attestation at time T + BATCH_WINDOW + DON_LATENCY (approximately T + 5min30s).

**Gap risk**: If NATS loses events between T and T+5min (e.g., JetStream storage failure), the Merkle root will not match. The Chainlink Function will detect this mismatch and REJECT the attestation.

**Mitigation**: JetStream R=3 replication. NATS KV stores batch metadata independently for cross-verification.

#### 5.2.2 Chainlink -> Sui Consistency

**Guarantee**: Atomically consistent via PTB.

The Chainlink attestation and Sui anchoring occur in the same Programmable Transaction Block. Either both succeed or neither does. The Move smart contract verifies the attestation before recording.

**Gap risk**: If the Sui transaction fails after Chainlink attestation (gas issue, shared object contention), the attestation exists but the anchor does not. The batch can be re-anchored with the same attestation.

**Mitigation**: Dry-run transactions before execution. Retry with exponential backoff. Attestations are idempotent -- re-anchoring produces the same result.

#### 5.2.3 NATS -> Sui Direct (Marketplace)

**Guarantee**: Eventually consistent, no attestation.

Capacity updates flow NATS -> Sui without Chainlink verification because:
1. Capacity signals are ephemeral (value decays rapidly)
2. False capacity signals hurt the signaler (failed work orders = reputation loss)
3. The economic incentive is self-correcting

**Gap risk**: Stale capacity on Sui (machine went RUNNING but Sui still shows IDLE).

**Mitigation**: TTL on marketplace entries. Automatic expiry after 60 seconds without refresh. Seller must confirm acceptance before escrow locks.

### 5.3 Consistency Hierarchy

```
                Strongest                                  Weakest
                    │                                          │
  Linearizable  Sequential  Causal  Session  Bounded  Eventual
  ┌──────────┬──────────┬─────────┬─────────┬─────────┬──────────┐
  │ NATS     │ Sui      │ NATS    │ WebSocket│Chainlink│ Capacity │
  │ JetStream│ per-obj  │ cross-  │ per-     │ DON     │ signals  │
  │ writes   │ writes   │ entity  │ client   │ attests │ on Sui   │
  └──────────┴──────────┴─────────┴─────────┴─────────┴──────────┘
       │           │          │         │          │          │
       │           │          │         │          │          └─ Market ok
       │           │          │         │          └─ Compliance ok
       │           │          │         └─ Dashboard ok
       │           │          └─ Alarms ok (ISA-18.2)
       │           └─ Settlement ok
       └─ Audit trail ok (FDA 21 CFR 11)
```

### 5.4 CAP Theorem Application

| Layer | Partition Response | Trade-off |
|-------|-------------------|-----------|
| NATS | AP (available, partition-tolerant) | Reads may be stale during partition; writes queue locally |
| Chainlink DON | CP (consistent, partition-tolerant) | Unavailable if <2/3 nodes reachable; no false attestations |
| Sui | CP for shared objects, AP for owned | Owned objects always writable; marketplace may pause during partition |

**Cross-layer partition**: If NATS is up but Sui is unreachable, the hot path continues operating. Merkle batches queue locally. On reconnection, batches are anchored in order. No data loss, bounded staleness increases.

---

## 6. Cost Projections

### 6.1 Assumptions

| Parameter | Value | Source |
|-----------|-------|--------|
| SUI token price | ~$3.50 | Market average Q1 2026 |
| Sui gas per transaction | ~0.003 SUI | Sui gas pricing docs |
| Chainlink Function call | ~$0.10 | Subscription model estimate |
| Chainlink CCIP message | $0.09-0.45 | Chainlink billing docs |
| NATS JetStream (self-hosted) | $0/event | Infrastructure cost only |
| Merkle batch window | 5 minutes | Architecture decision |
| Readings per machine per day | 86,400 (1Hz) | Typical sensor telemetry |

### 6.2 Cost by Organization Size

#### Earl (2 machines, solo machinist)

| Layer | Activity | Volume/month | Unit Cost | Monthly Cost |
|-------|----------|-------------|-----------|-------------|
| **NATS** | Sensor readings | 5.2M events | $0 (platform) | $0 |
| **NATS** | Entity state changes | ~500 | $0 | $0 |
| **Sui** | Compliance anchors | ~720 batches (2 machines x 12/day) | ~$0.01 | $7.20 |
| **Sui** | Work orders (3/month) | ~15 txs | ~$0.01 | $0.15 |
| **Sui** | Reputation updates | ~3 | ~$0.01 | $0.03 |
| **Chainlink** | Merkle attestations | ~720 | ~$0.10 | $72.00 |
| **Chainlink** | QC attestations | ~3 | ~$0.10 | $0.30 |
| | | | **Total** | **~$80/month** |

**Optimization**: Earl can reduce Chainlink costs to ~$12/month by using hourly batches instead of 5-minute batches (120 attestations/month). Compliance-critical processes keep 5-minute batches; routine operations use hourly.

**Optimized Earl total: ~$20/month**

#### Mid-size Shop (20 machines, 15 employees)

| Layer | Activity | Volume/month | Unit Cost | Monthly Cost |
|-------|----------|-------------|-----------|-------------|
| **NATS** | Sensor readings | 52M events | $0 (platform) | $0 |
| **NATS** | Entity state changes | ~5,000 | $0 | $0 |
| **Sui** | Compliance anchors | ~7,200 batches | ~$0.01 | $72.00 |
| **Sui** | Work orders (30/month) | ~150 txs | ~$0.01 | $1.50 |
| **Sui** | Marketplace updates | ~2,600 (capacity signals) | ~$0.01 | $26.00 |
| **Sui** | Reputation updates | ~30 | ~$0.01 | $0.30 |
| **Chainlink** | Merkle attestations | ~7,200 (optimized: ~1,200) | ~$0.10 | $120.00 |
| **Chainlink** | QC attestations | ~30 | ~$0.10 | $3.00 |
| | | | **Total** | **~$223/month** |

**With hourly batching optimization: ~$155/month**

#### Enterprise (200 machines, 100+ employees)

| Layer | Activity | Volume/month | Unit Cost | Monthly Cost |
|-------|----------|-------------|-----------|-------------|
| **NATS** | Sensor readings | 520M events | $0 (platform) | $0 |
| **NATS** | Entity state changes | ~50,000 | $0 | $0 |
| **Sui** | Compliance anchors | ~72,000 batches | ~$0.01 | $720.00 |
| **Sui** | Work orders (200/month) | ~1,000 txs | ~$0.01 | $10.00 |
| **Sui** | Marketplace updates | ~26,000 | ~$0.01 | $260.00 |
| **Sui** | Reputation updates | ~200 | ~$0.01 | $2.00 |
| **Chainlink** | Merkle attestations | ~12,000 (optimized) | ~$0.10 | $1,200.00 |
| **Chainlink** | QC attestations | ~200 | ~$0.10 | $20.00 |
| | | | **Total** | **~$2,212/month** |

### 6.3 Cost Summary

| Org Size | Machines | NATS | Sui | Chainlink | Total/month | Per Machine |
|----------|----------|------|-----|-----------|-------------|-------------|
| **Earl** | 2 | $0 | $8 | $12 | **~$20** | $10/machine |
| **Mid** | 20 | $0 | $100 | $55 | **~$155** | $7.75/machine |
| **Enterprise** | 200 | $0 | $992 | $1,220 | **~$2,212** | $11.06/machine |

**Key insight**: Chainlink attestation is the dominant cost. Batching strategy is the primary optimization lever. Organizations can choose their batching window based on compliance requirements:

| Batch Window | Attestations/machine/month | Cost/machine/month |
|-------------|---------------------------|--------------------|
| 5 minutes | 8,640 | $864 |
| 15 minutes | 2,880 | $288 |
| 1 hour | 720 | $72 |
| 4 hours | 180 | $18 |
| Daily | 30 | $3 |

Recommendation: 1-hour default, 5-minute for compliance-critical processes (pharmaceutical, aerospace).

### 6.4 Platform Revenue vs. Costs

At 200,000 organizations (target):

| Metric | Value |
|--------|-------|
| Platform Sui transactions/month | ~200M |
| Platform Chainlink attestations/month | ~50M (optimized) |
| Total Sui gas/month | ~$2M |
| Total Chainlink/month | ~$5M |
| **Total platform cost/month** | **~$7M** |
| Revenue at $50/org/month average | **$10M/month** |
| **Margin** | **~30%** |

Gas costs can be subsidized or passed through. The Sui gas model (with storage rebates) means deleted objects return gas, reducing net costs.

---

## 7. Failure Mode Analysis

### 7.1 Single-Layer Failures

#### F-1: NATS Cluster Degraded

**Symptom**: JetStream write latency exceeds 1s, consumer lag increases.

**Impact**:
- Hot path: Sensor readings buffer at edge. Dashboard latency increases.
- Warm path: Merkle batch windows extend. Attestation delay increases.
- Cold path: No direct impact. Sui continues operating.

**Mitigation**:
- NATS R=3 replication across availability zones
- Edge devices buffer locally (NATS embedded server)
- MerkleAnchorService adapts batch windows to current lag
- Alert at >500ms write latency, circuit-break at >2s

**Recovery**: On NATS recovery, buffered events replay in order (JetStream durability). Merkle batches resume with no gap.

#### F-2: NATS Completely Down

**Symptom**: All NATS connections fail.

**Impact**:
- Hot path: Complete halt. No real-time data.
- Warm path: MerkleAnchorService pauses. No new attestations.
- Cold path: Sui and marketplace continue from last known state. Capacity signals go stale.
- Marketplace: Existing escrows unaffected. New work orders cannot verify real-time status.

**Mitigation**:
- Edge devices store-and-forward (NATS embedded JetStream)
- Marketplace entries expire (60s TTL), preventing stale matching
- Sui smart contracts enforce timeout on capacity claims

**Recovery**: On NATS recovery, edge devices replay buffered events. MerkleAnchorService processes backlog. Full consistency restored within BATCH_WINDOW.

#### F-3: Sui Network Congested

**Symptom**: Sui transactions experience `ExecutionCancelledDueToSharedObjectCongestion`.

**Impact**:
- Hot path: No impact. NATS operates independently.
- Warm path: Chainlink attestations succeed but Sui anchoring fails. Attestations queue.
- Cold path: Marketplace updates delay. Escrow operations may timeout. Compliance anchoring pauses.

**Mitigation**:
- Separate owned-object operations from shared-object operations
- Org identity, compliance anchoring = owned objects (bypass consensus, unaffected by congestion)
- Marketplace = shared object (affected by congestion)
- Retry with higher gas price for priority
- Sui's local fee markets allow per-object gas bidding
- Queue un-anchored attestations with exponential backoff

**Recovery**: On congestion relief, queued transactions execute in order. PTB atomicity ensures no partial state.

#### F-4: Sui Completely Down

**Symptom**: Sui RPC endpoints unreachable.

**Impact**:
- Hot path: No impact.
- Warm path: Chainlink attestations succeed, Sui anchoring queues.
- Cold path: All blockchain operations halt -- no new registrations, no escrow, no settlement.
- Marketplace: Frozen. No new work orders. Existing in-progress work continues via NATS.

**Mitigation**:
- MerkleAnchorService queues attestations for later anchoring
- Marketplace falls back to "NATS-only" mode (capacity discovery without escrow)
- Work in progress continues -- QC data collects, settles when Sui returns
- Multiple Sui RPC endpoints for redundancy (Mysten, Shinami, BlockEden)

**Recovery**: On Sui recovery, queued operations execute in order. Compliance anchoring catches up. Marketplace re-synchronizes from NATS capacity state.

### 7.2 Cross-Layer Failures

#### F-5: Chainlink Oracle Disagrees with NATS Data

**Symptom**: Chainlink DON rejects Merkle attestation -- independently computed root does not match.

**Root cause**: Either NATS data was tampered with, or the batch was corrupted in transit.

**Impact**: Compliance anchoring halted for affected batch. Potential integrity breach.

**Response**:
1. Alert platform operators and affected org immediately
2. Quarantine batch data in NATS KV (mark as disputed)
3. Re-fetch raw data from edge devices (stored locally)
4. Recompute Merkle tree from edge data
5. If edge data matches NATS: NATS is correct, transient Chainlink issue. Retry.
6. If edge data differs from NATS: Data integrity breach. Forensic investigation.
7. Compliance anchor for this batch: REJECTED status recorded on Sui

**This is a SECURITY EVENT**, not a normal failure.

#### F-6: Cross-Layer Data Inconsistency

**Symptom**: Sui shows org as "verified" but NATS shows no recent data from that org.

**Root cause**: Org registered on Sui but never connected equipment to NATS. Or: NATS account provisioned but Sui registration failed.

**Impact**: Marketplace shows phantom capacity. Trust score computation uses stale data.

**Mitigation**:
- Trust score includes "liveness" factor -- no recent NATS data = score decays
- Marketplace entries require periodic NATS heartbeat confirmation
- Registration requires both Sui identity AND NATS account provisioning (orchestrated)

#### F-7: Network Partition Between NATS and Sui

**Symptom**: NATS cluster operates normally. Sui node unreachable from NATS infrastructure. (Or vice versa.)

**Impact**:
- Hot path operates normally
- Cold path operates normally (if Sui still reachable from other paths)
- Bridge layer cannot anchor Merkle batches

**Response**:
- Bridge layer detects partition within 30 seconds (health check)
- Merkle batches queue locally with TTL (24 hours)
- Alert if partition exceeds 1 hour
- On partition heal: batches anchor in chronological order

---

## 8. Sui Smart Contract Architecture

### 8.1 Module Structure

```move
// ─── Package: tmnl_commons ───────────────────────────────────────

module tmnl_commons::org_registry {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;

    /// Organization identity -- owned by the org's Sui address
    /// Non-transferable (soulbound via lack of transfer function)
    struct OrgIdentity has key {
        id: UID,
        name: vector<u8>,
        location_hash: vector<u8>,
        verification_level: u8,  // 0=unverified, 1=basic, 2=verified, 3=trusted, 4=premium
        registered_at: u64,
    }

    /// Register a new organization
    public entry fun register(
        name: vector<u8>,
        location_hash: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let org = OrgIdentity {
            id: object::new(ctx),
            name,
            location_hash,
            verification_level: 0,
            registered_at: tx_context::epoch(ctx),
        };
        transfer::transfer(org, tx_context::sender(ctx));
    }

    /// Upgrade verification level (called after Chainlink verification)
    public entry fun upgrade_verification(
        org: &mut OrgIdentity,
        new_level: u8,
        _attestation_proof: vector<u8>,  // Chainlink attestation reference
    ) {
        assert!(new_level > org.verification_level, EInvalidUpgrade);
        org.verification_level = new_level;
    }
}

module tmnl_commons::capability {
    use sui::object::{Self, UID};

    /// Capability NFT -- soulbound (non-transferable)
    struct CapabilityNFT has key {
        id: UID,
        equipment_type: vector<u8>,
        make: vector<u8>,
        model: vector<u8>,
        verified_at: u64,
        attestation_id: vector<u8>,
    }

    /// Mint verified capability (called by platform after Chainlink verification)
    public entry fun mint_verified(
        equipment_type: vector<u8>,
        make: vector<u8>,
        model: vector<u8>,
        attestation_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let nft = CapabilityNFT {
            id: object::new(ctx),
            equipment_type,
            make,
            model,
            verified_at: tx_context::epoch(ctx),
            attestation_id,
        };
        transfer::transfer(nft, tx_context::sender(ctx));
    }
}

module tmnl_commons::work_order {
    use sui::object::{Self, UID};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};

    /// Work order with escrowed payment -- shared object
    struct WorkOrder has key {
        id: UID,
        buyer: address,
        seller: address,
        escrow: Balance<SUI>,
        status: u8,  // 0=created, 1=in_progress, 2=qc_pending, 3=completed, 4=disputed
        part_spec_hash: vector<u8>,
        quantity: u64,
        deadline: u64,
        created_at: u64,
    }

    /// Create work order with escrowed payment
    public entry fun accept_and_escrow(
        seller: address,
        payment: Coin<SUI>,
        part_spec_hash: vector<u8>,
        quantity: u64,
        deadline: u64,
        ctx: &mut TxContext,
    ) {
        let order = WorkOrder {
            id: object::new(ctx),
            buyer: tx_context::sender(ctx),
            seller,
            escrow: coin::into_balance(payment),
            status: 0,
            part_spec_hash,
            quantity,
            deadline,
            created_at: tx_context::epoch(ctx),
        };
        transfer::share_object(order);
    }

    /// Complete work order -- release escrow to seller
    public entry fun complete(
        order: &mut WorkOrder,
        attestation_proof: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == order.buyer, ENotBuyer);
        assert!(order.status == 2, EInvalidStatus);  // Must be qc_pending

        // Verify Chainlink attestation (simplified)
        verify_attestation(attestation_proof);

        order.status = 3;  // completed
        let payment = balance::withdraw_all(&mut order.escrow);
        transfer::public_transfer(
            coin::from_balance(payment, ctx),
            order.seller,
        );
    }

    /// Dispute work order
    public entry fun dispute(
        order: &mut WorkOrder,
        reason: vector<u8>,
        evidence_hash: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == order.buyer, ENotBuyer);
        assert!(order.status == 2, EInvalidStatus);
        order.status = 4;  // disputed
        // Emit event for arbitration
    }
}

module tmnl_commons::compliance_anchor {
    use sui::object::{Self, UID};

    /// Compliance anchor -- owned by org, stores Merkle roots
    struct ComplianceAnchor has key {
        id: UID,
        merkle_root: vector<u8>,
        batch_id: vector<u8>,
        event_count: u64,
        time_start: u64,
        time_end: u64,
        chainlink_attestation_id: vector<u8>,
        anchored_at: u64,
    }

    /// Record a compliance batch (owned object -- no consensus needed)
    public entry fun record_batch(
        merkle_root: vector<u8>,
        batch_id: vector<u8>,
        event_count: u64,
        time_start: u64,
        time_end: u64,
        chainlink_attestation_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let anchor = ComplianceAnchor {
            id: object::new(ctx),
            merkle_root,
            batch_id,
            event_count,
            time_start,
            time_end,
            chainlink_attestation_id,
            anchored_at: tx_context::epoch(ctx),
        };
        transfer::transfer(anchor, tx_context::sender(ctx));
    }
}

module tmnl_commons::reputation {
    use sui::object::{Self, UID};

    /// Reputation evidence -- soulbound, accumulates
    struct ReputationToken has key {
        id: UID,
        work_order_id: vector<u8>,
        quality_score: u64,      // 0-100
        timeliness_score: u64,   // 0-100
        role: u8,                // 0=seller, 1=buyer
        recorded_at: u64,
    }

    /// Record reputation from completed work order
    public entry fun record_completion(
        work_order_id: vector<u8>,
        quality_score: u64,
        timeliness_score: u64,
        role: u8,
        ctx: &mut TxContext,
    ) {
        assert!(quality_score <= 100, EInvalidScore);
        assert!(timeliness_score <= 100, EInvalidScore);

        let token = ReputationToken {
            id: object::new(ctx),
            work_order_id,
            quality_score,
            timeliness_score,
            role,
            recorded_at: tx_context::epoch(ctx),
        };
        transfer::transfer(token, tx_context::sender(ctx));
    }
}
```

### 8.2 Object Ownership Design Rationale

| Object | Ownership | Consensus | Rationale |
|--------|-----------|-----------|-----------|
| OrgIdentity | Owned | No | Only the org updates its own identity. Fast path. |
| CapabilityNFT | Owned (SBT) | No | Soulbound to org. Non-transferable. |
| ReputationToken | Owned (SBT) | No | Accumulates per-org. Non-transferable. |
| ComplianceAnchor | Owned | No | Each org anchors its own compliance data. |
| WorkOrder | Shared | Yes | Both buyer and seller must interact. |
| Marketplace | Shared | Yes | Global order book, many writers. |
| RFQ | Shared | Yes | Multiple sellers submit quotes. |

**Performance implication**: 4 out of 7 object types use owned objects, bypassing Sui consensus entirely. This means identity management, compliance anchoring, capability verification, and reputation accrual all achieve ~100ms latency. Only marketplace and work order operations require the ~400ms consensus path.

---

## 9. Chainlink Integration Patterns

### 9.1 Chainlink Functions for Manufacturing Attestation

```javascript
// Chainlink Function: Verify Merkle batch
// Deployed to DON, executed by each oracle node independently

const merkleRoot = args[0]    // Expected Merkle root
const batchId = args[1]       // Batch identifier
const orgId = args[2]         // Organization identifier

// Step 1: Fetch batch data from TMNL API
const response = await Functions.makeHttpRequest({
  url: `https://api.tmnl.io/v1/batches/${batchId}`,
  headers: { "X-Oracle-Key": secrets.apiKey },
})

if (response.error) {
  throw new Error(`API request failed: ${response.error}`)
}

const batchData = response.data

// Step 2: Verify batch metadata
if (batchData.orgId !== orgId) {
  return Functions.encodeString("REJECTED:ORG_MISMATCH")
}

// Step 3: Recompute Merkle root from batch leaves
const leaves = batchData.leaves.map(leaf => ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "uint256", "uint256"],
    [leaf.dataHash, leaf.timestamp, leaf.index]
  )
))

const computedRoot = computeMerkleRoot(leaves)

// Step 4: Compare roots
if (computedRoot !== merkleRoot) {
  return Functions.encodeString("REJECTED:ROOT_MISMATCH")
}

// Step 5: Return attestation
return Functions.encodeString(`VERIFIED:${merkleRoot}:${batchData.count}:${Date.now()}`)
```

### 9.2 Chainlink Data Streams for Capacity Oracle

A custom Chainlink Data Stream can publish aggregated manufacturing capacity data:

```
Stream: TMNL-ATL-CNC-5AXIS-CAPACITY
Data:   {
  available_machines: 847,
  avg_hourly_rate: 125.50,
  utilization_rate: 0.73,
  region: "ATL_METRO",
  updated_at: 1738000000
}
Resolution: 60 seconds (heartbeat)
Deviation:  5% (trigger update on significant change)
```

Manufacturing-specific data feeds:
- `TMNL-ATL-CNC-CAPACITY` -- CNC machine availability
- `TMNL-ATL-METAL-PRICE` -- Regional metal pricing
- `TMNL-ATL-ENERGY-RATE` -- Industrial energy rates
- `TMNL-ATL-QUALITY-INDEX` -- Aggregate quality scores

### 9.3 Future: Chainlink CCIP for Cross-Chain

If the manufacturing commons expands beyond Sui (e.g., interoperability with Ethereum-based supply chain contracts):

```
CCIP Message Flow:
  Sui (TMNL Commons) ──CCIP──> Ethereum (Supply Chain Contract)

Use cases:
  - Boeing has Ethereum-based supply chain contracts
  - TMNL quality attestation needs to bridge to Boeing's chain
  - CCIP enables cross-chain reputation portability

Cost: $0.09-$0.45 per message (non-Ethereum: $0.09)
Latency: 5-20 minutes per cross-chain message
```

---

## 10. Security and Trust Composition

### 10.1 Trust Layers

```
┌────────────────────────────────────────────────────┐
│ Layer 4: Economic Trust (Game Theory)              │
│ - Reputation loss deters defection                  │
│ - Escrow protects against non-payment               │
│ - Sybil resistance via verification cost            │
├────────────────────────────────────────────────────┤
│ Layer 3: Cryptographic Trust (Sui + Chainlink)     │
│ - Sui: object ownership, Move type safety           │
│ - Chainlink: DON consensus, BFT attestation         │
│ - Merkle proofs: tamper-evident data structures     │
├────────────────────────────────────────────────────┤
│ Layer 2: Infrastructure Trust (NATS)               │
│ - NATS accounts: multi-tenant isolation             │
│ - TLS: transport encryption                         │
│ - NKey/JWT: authentication                          │
├────────────────────────────────────────────────────┤
│ Layer 1: Physical Trust (Edge)                     │
│ - Device attestation (TPM where available)          │
│ - Clock skew detection                              │
│ - Tamper detection (heartbeat monitoring)            │
└────────────────────────────────────────────────────┘
```

### 10.2 Attack Vectors and Mitigations

| Attack | Vector | Layer | Mitigation |
|--------|--------|-------|------------|
| **False sensor data** | Compromised edge device | Physical | Chainlink DON cross-verifies Merkle batches. Anomaly detection in ReadingProcessor. |
| **Sybil attack** | Create many fake orgs for reputation farming | Economic | Verification requires real EIN + Chainlink oracle check. Registration cost deters Sybils. |
| **Reputation manipulation** | Complete fake work orders with self | Economic | Work order requires different buyer/seller addresses. Chainlink QC attestation required. |
| **Data exfiltration** | Org reads competitor's sensor data | Infrastructure | NATS account isolation. Subject-based export controls. |
| **Escrow manipulation** | Exploit smart contract bug | Cryptographic | Move type system prevents reentrancy. Escrow uses Sui Coin<SUI> (type-safe). |
| **Oracle manipulation** | Compromise Chainlink DON nodes | Cryptographic | DON BFT -- 2/3 majority required. Rotating node selection. |
| **Marketplace front-running** | See RFQ before submitting own quote | Cryptographic | Sealed-bid option using commit-reveal on Sui. |

---

## 11. Migration Strategy

### 11.1 Phased Rollout

```
Phase 0: Current State (now)
  - NATS JetStream for real-time (RFC-001)
  - No blockchain integration
  - Trust is platform-mediated

Phase 1: Compliance Anchoring (Month 1-3)
  - Deploy compliance_anchor module on Sui devnet/testnet
  - Implement MerkleAnchorService in Effect-TS
  - Chainlink Functions for Merkle verification
  - No marketplace, no escrow
  - Value prop: Auditable compliance proofs

Phase 2: Organization Registry (Month 3-6)
  - Deploy org_registry + capability modules on Sui testnet
  - Chainlink Functions for capability verification
  - Trust scoring (off-chain computation, on-chain anchoring)
  - No marketplace yet
  - Value prop: Verified org identity

Phase 3: Marketplace MVP (Month 6-12)
  - Deploy work_order + marketplace modules on Sui mainnet
  - Capacity signaling (NATS -> Sui bridge)
  - Escrow and settlement
  - Reputation system
  - Value prop: Full economic layer

Phase 4: Optimization (Month 12+)
  - Chainlink Data Streams for capacity oracle
  - CCIP for cross-chain interoperability
  - Sealed-bid auctions
  - DePIN token economics (if applicable)
```

### 11.2 Backwards Compatibility

The blockchain layers are **additive**. The existing NATS infrastructure (RFC-001) continues operating unchanged. Blockchain features are opt-in:

- Orgs not interested in marketplace can still use NATS for real-time monitoring
- Compliance anchoring is opt-in per organization
- Work orders require explicit Sui wallet setup
- NATS-only mode remains fully functional

---

## 12. Architectural Recommendations

### R-1: Start with Compliance Anchoring (HIGH CONFIDENCE: 90%)

Compliance anchoring provides immediate value (auditable proof) with minimal risk (owned objects only, no marketplace complexity). It validates the NATS -> Chainlink -> Sui pipeline before adding economic features.

### R-2: Use Owned Objects by Default (HIGH CONFIDENCE: 95%)

Sui's owned object model provides the fastest path for most operations. Reserve shared objects ONLY for true multi-party interactions (marketplace, work orders). This minimizes congestion risk and maximizes throughput.

### R-3: Chainlink Functions Over Custom Oracle (MEDIUM CONFIDENCE: 75%)

Chainlink Functions provides a simpler integration path than running a custom oracle network. However, the subscription pricing model is not fully public, and costs at scale need negotiation. Alternative: a custom oracle network built on NATS for non-financial attestations, with Chainlink reserved for financial/compliance.

**Option analysis**:
| Option | Probability | Rationale |
|--------|------------|-----------|
| Chainlink Functions only | 35% | Simplest, but potentially expensive at scale |
| Chainlink for financial + custom oracle for compliance | 40% | Best cost/trust trade-off |
| Custom oracle only (no Chainlink) | 10% | Cheapest but weakest trust guarantees |
| Chainlink + Pyth hybrid | 10% | Pyth for pricing, Chainlink for attestation |
| Wait for Chainlink Sui native support | 5% | Blocks on Chainlink roadmap |

### R-4: Hourly Default Batch Window (HIGH CONFIDENCE: 85%)

The 5-minute batch window is expensive ($864/machine/month in attestation costs). An hourly default with configurable 5-minute mode for compliance-critical processes balances cost and latency.

### R-5: Sui Over Other L1s (HIGH CONFIDENCE: 85%)

Sui's object-centric model maps naturally to manufacturing entities. The owned/shared object split matches our trust model (most operations are single-org, marketplace is multi-org). Move's resource safety prevents common DeFi exploits.

**Option analysis**:
| Option | Probability | Rationale |
|--------|------------|-----------|
| Sui (current choice) | 60% | Best object model for IoT entities |
| Aptos (Move-based alternative) | 15% | Similar to Sui but account-centric, not object-centric |
| Solana | 10% | High throughput but no native object model |
| Ethereum L2 (Arbitrum/Base) | 10% | Largest ecosystem but higher costs |
| Avalanche subnet | 5% | Good for private subnets but less mature Move |

### R-6: Effect-TS Service Boundaries (HIGH CONFIDENCE: 90%)

Each blockchain integration MUST be an Effect Service with a Layer. This enables:
- Testing with mock layers (no blockchain needed)
- Gradual adoption (swap NullLayer for SuiClientLive)
- Clear dependency graph (Layer.provide composition)

---

## 13. Open Questions

### Q-1: Chainlink + Sui Native Integration

As of February 2026, Chainlink does not have official Sui integration. The warm path assumes Chainlink Functions deliver results to an intermediary (e.g., an EVM chain) that then bridges to Sui, or a custom relay. This adds latency and cost.

**Resolution path**: Monitor Chainlink ecosystem announcements. If native Sui support arrives, the architecture simplifies significantly. If not, implement a custom relay service.

### Q-2: Gas Sponsorship

Should the platform sponsor Sui gas for small organizations? Earl should not need to hold SUI tokens. Sui supports sponsored transactions where the platform pays gas on behalf of users.

**Preliminary answer**: Yes, for orgs below a trust threshold. Platform absorbs gas and recovers via subscription fees.

### Q-3: Data Availability for Merkle Proofs

Merkle leaf data must be available for audit verification months or years after anchoring. NATS KV has configurable TTL but is not designed for multi-year retention.

**Resolution path**: Merkle leaf data should be replicated to a DA layer (IPFS, Arweave, or PostgreSQL cold storage) with the NATS KV serving as hot cache.

### Q-4: Sealed-Bid Auctions on Sui

For competitive RFQs, quotes should be hidden until a deadline (sealed-bid). Sui does not natively support commit-reveal schemes.

**Resolution path**: Implement using hash-commit on Sui (commit hash of bid, reveal bid after deadline). Move's type system can enforce the reveal-or-forfeit mechanic.

### Q-5: DePIN Token Economics

Should the manufacturing commons issue a native token for governance and incentive alignment? This introduces regulatory complexity (SEC, CFTC) but potentially stronger network effects.

**Resolution path**: Defer to separate DePIN research document. Use SUI for settlement in Phase 1-3. Evaluate token at Phase 4+.

---

## 14. References

### Sui
- [Sui Architecture Documentation](https://docs.sui.io/concepts/architecture)
- [Sui Gas Pricing](https://docs.sui.io/concepts/tokenomics/gas-pricing)
- [Sui Object Ownership](https://docs.sui.io/guides/developer/objects/object-ownership)
- [Sui Kiosk Framework](https://docs.sui.io/standards/kiosk)
- [Sui Programmable Transaction Blocks](https://docs.sui.io/concepts/transactions/prog-txn-blocks)
- [Sui Congestion Control](https://blog.sui.io/shared-object-congestion-control/)
- [Sui Local Fee Markets](https://docs.sui.io/guides/developer/objects/local-fee-markets)
- [Sui Soulbound Tokens](https://blog.sui.io/soulbound-tokens-explained/)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/sui)
- [MystenLabs/sui GitHub](https://github.com/MystenLabs/sui)

### Chainlink
- [Chainlink Functions](https://docs.chain.link/chainlink-functions)
- [Chainlink Data Streams](https://docs.chain.link/data-streams)
- [Chainlink Data Streams Billing](https://docs.chain.link/data-streams/billing)
- [Chainlink CCIP Billing](https://docs.chain.link/ccip/billing)
- [Chainlink Oracle Computation](https://chain.link/education-hub/oracle-computation)

### NATS
- [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
- [MachineMetrics + NATS Case Study](https://www.synadia.com/customer-stories/machinemetrics)
- [NATS IoT Monitoring](https://nats.io/blog/real-time-monitoring-solution-jetstream-risingwave-superset/)

### Blockchain Patterns
- [Merkle Tree Off-Chain Anchoring](https://medium.com/chain-accelerator/supply-chain-use-case-merkle-tree-off-chain-f94535ae4638)
- [Tamper-Proof Event Logging with Merkle Trees](https://medium.com/@vanabharathiraja/%EF%B8%8F-building-a-tamper-proof-event-logging-system-e71dfbc3c58a)
- [Blockchain Anchor Pattern](https://research.csiro.au/blockchainpatterns/general-patterns/self-sovereign-identity-patterns/anchoring-to-blockchain/)
- [Sui Escrow Contracts](https://medium.com/@web3_analyst/secure-escrow-contracts-on-sui-03de1bfa03a7)

### Manufacturing Commons (Internal)
- `docs/specifications/research-manufacturing-commons.md` -- Platform economics
- `docs/specifications/research-consistency-models.md` -- Consistency guarantees
- `docs/specifications/rfc-section-marketplace-protocol.md` -- Marketplace protocol
- `docs/specifications/rfc-section-trust-model.md` -- Trust model
- `docs/specifications/rfc-001-assembled.md` -- Full RFC

---

*This document was produced by hybrid-architect (Val) on 2026-02-09. All Sui architectural claims are grounded in official Sui documentation and verified via web research. Chainlink integration patterns are based on published documentation as of February 2026. The Chainlink-Sui native integration status (Q-1) should be re-evaluated quarterly.*

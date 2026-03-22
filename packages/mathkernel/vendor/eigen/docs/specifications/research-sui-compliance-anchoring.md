# Research: Sui Blockchain for Compliance Audit Trail & Event Anchoring

**Author**: temporal-analyst (Val)
**Date**: 2026-02-09
**Status**: RESEARCH — Not yet normative

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Sui Architecture Overview](#2-sui-architecture-overview)
3. [Event Anchoring Design](#3-event-anchoring-design)
4. [FDA 21 CFR Part 11 Compliance](#4-fda-21-cfr-part-11-compliance)
5. [ISA-18.2 Alarm Compliance](#5-isa-182-alarm-compliance)
6. [Immutable Work Order History](#6-immutable-work-order-history)
7. [Data Integrity Proofs](#7-data-integrity-proofs)
8. [Sui Object Versioning vs Entity Sequence Numbers](#8-sui-object-versioning-vs-entity-sequence-numbers)
9. [Cost Analysis](#9-cost-analysis)
10. [Integration Architecture](#10-integration-architecture)
11. [Risk Analysis](#11-risk-analysis)
12. [Recommendations](#12-recommendations)
13. [References](#13-references)

---

## 1. Executive Summary

The TMNL metropolitan manufacturing platform already provides strong audit trail
guarantees via JetStream event sourcing with `deny_delete: true` and `deny_purge: true`
(ISO-41, ISO-42 in `rfc-section-tenant-isolation.md`). However, these guarantees are
**platform-internal** — a regulator must trust that the platform operator has not
tampered with the JetStream configuration or underlying storage.

Sui blockchain anchoring adds an **external, cryptographically verifiable** layer of
trust. By periodically anchoring Merkle roots of JetStream event batches to Sui,
we create immutable proof points that:

1. Events existed at a specific point in time (temporal proof)
2. Events have not been modified since anchoring (integrity proof)
3. The proof is verifiable by third parties without platform access (independence)
4. Cryptographic signatures satisfy electronic signature requirements (FDA 21 CFR Part 11)

**Key finding**: At current Sui pricing (~$0.003 per anchor transaction at $0.98/SUI),
anchoring compliance data for 200K organizations costs approximately **$600-$6,000/month**
depending on anchoring frequency, which is economically viable for a metropolitan
manufacturing network.

---

## 2. Sui Architecture Overview

### 2.1 Object Model

Sui uses an **object-centric** model (not account-based like Ethereum). Every on-chain
asset is an object with:

- **ObjectId**: Unique 32-byte identifier (immutable for the object's lifetime)
- **Version**: Monotonically increasing sequence number, incremented on every mutation
- **Digest**: 32-byte hash of object contents at each version

The `(ObjectId, Version)` pair uniquely identifies a specific state of an object.
Only the latest version can be used in subsequent transactions. Historical versions
are permanently recorded on-chain.

**Relevance**: Sui's built-in object versioning is semantically similar to our entity
event sequence numbers. Each version change is an immutable historical record.

### 2.2 Transaction Model

Sui transactions are structured as **Programmable Transaction Blocks (PTBs)** —
up to 1,024 operations in a single atomic transaction. This enables batching
multiple anchor writes into one transaction.

**Finality times**:
- Owned objects: < 500ms (no consensus required)
- Shared objects: 2-3 seconds (consensus ordering)

**Checkpoint system**: Sui creates ~4 checkpoints per second. Each checkpoint includes:
- Transaction digests and effects
- BLS aggregate signature from 2/3+ validator committee
- Content digest (32-byte hash)
- Epoch and sequence number
- Timestamp

Checkpoints are **immutable, non-forkable proof points** — they cannot be rolled back
or reorganized.

### 2.3 Cryptographic Signatures

Sui supports:
- **Ed25519** — high-performance, used in our NATS JWT auth
- **Secp256k1** — Bitcoin/Ethereum compatible
- **Secp256r1 (P-256)** — NIST standard, hardware security module compatible
- **Multi-sig** — weighted threshold signatures (e.g., 2-of-3 operator keys)
- **ZkLogin** — zero-knowledge proof based authentication
- **Passkey** — WebAuthn/FIDO2 compatible

Transaction authentication uses Blake2b hash of intent message + transaction data.

### 2.4 Events

Move smart contracts emit events via `sui::event::emit()`. Events are:
- Indexed and queryable via RPC (`queryEvents`) and GraphQL
- Permanently stored as part of checkpoint data
- Maximum 256KB per event, 64MB total per transaction

**Authenticated events** (`event::emit_authenticated()`) provide cryptographic
verifiability — light clients can verify events without trusting an intermediary.
This is directly relevant for regulatory audit scenarios.

### 2.5 Cost Structure

| Component | Unit | Cost |
|-----------|------|------|
| Computation | per bucket | 1,000 - 5,000,000 units |
| Reference gas price | per unit | ~1,000 MIST (epoch-dependent) |
| Storage | per byte | 100 storage units |
| Storage price | per unit | 76 MIST |
| Storage rebate | on deletion | 99% refund |
| Minimum gas budget | per tx | 2,000 MIST |

1 SUI = 1,000,000,000 MIST (10^9)

**Typical anchor transaction cost** (storing 256 bytes):
- Computation: 1,000 units * 1,000 MIST = 1,000,000 MIST
- Storage: 25,600 units * 76 MIST = 1,945,600 MIST
- Total: ~2,945,600 MIST = ~0.00295 SUI = ~$0.0029 at $0.98/SUI

---

## 3. Event Anchoring Design

### 3.1 Anchoring Model

The anchoring model uses **batch Merkle roots** — not individual event anchoring.
Individual event anchoring would be cost-prohibitive (millions of events/day) and
unnecessary. Instead, we anchor the Merkle root of event batches at configurable
intervals.

```
JetStream Event Stream (per-org)
│
├── Events [seq 1..1000]  ──► Merkle Root A ──► Sui Transaction T1
├── Events [seq 1001..2000] ──► Merkle Root B ──► Sui Transaction T2
├── Events [seq 2001..3000] ──► Merkle Root C ──► Sui Transaction T3
└── ...

On-Chain Anchor Object (per-org):
{
  orgId: "earl-machine-shop",
  streamName: "entity-events",
  batchStart: 2001,
  batchEnd: 3000,
  merkleRoot: "0x7a3f...",
  anchorTimestamp: 1739145600000,
  jetStreamSequence: 3000
}
```

### 3.2 Anchoring Frequency

| Tier | Frequency | Org Profile | Rationale |
|------|-----------|-------------|-----------|
| T1: Critical | Every 1 hour | FDA-regulated, ITAR, medical | Regulatory requires frequent proof points |
| T2: Standard | Every 6 hours | ISO 9001, general manufacturing | Balance cost vs audit granularity |
| T3: Basic | Every 24 hours | Small shops, non-regulated | Minimum viable compliance |
| T4: Event-triggered | On specific events | Cross-org settlements, safety incidents | Immediate anchoring for high-value events |

### 3.3 Anchoring Granularity

Anchoring is **per-org, per-stream-type**:

```
Per Organization:
├── entity-events stream    → Anchor every T hours
├── alarm-events stream     → Anchor every T hours (or on critical alarm)
├── work-order-events stream → Anchor on state transitions
└── signature-events stream → Anchor every T hours (FDA orgs only)
```

Cross-org transactions get **dual anchoring**: both parties anchor independently,
plus the `manufacturing-commons` anchors the transaction metadata.

### 3.4 Anchor Data Structure (Move Module)

```move
module compliance_anchor::anchor {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::event;
    use sui::clock::Clock;

    /// Immutable anchor object — created once, never mutated
    public struct EventBatchAnchor has key, store {
        id: UID,
        org_id: vector<u8>,           // Organization identifier
        stream_type: vector<u8>,      // "entity-events", "alarm-events", etc.
        batch_start_seq: u64,         // JetStream starting sequence
        batch_end_seq: u64,           // JetStream ending sequence
        merkle_root: vector<u8>,      // 32-byte SHA-256 Merkle root
        event_count: u64,             // Number of events in batch
        anchor_timestamp_ms: u64,     // Clock timestamp at anchoring
        origin_timestamp_range: vector<u64>, // [earliest, latest] originTimestamp
    }

    /// Event emitted for indexing
    public struct AnchorCreated has copy, drop {
        org_id: vector<u8>,
        stream_type: vector<u8>,
        batch_end_seq: u64,
        merkle_root: vector<u8>,
        anchor_timestamp_ms: u64,
    }

    /// Create an immutable anchor (object becomes frozen after creation)
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

        // Freeze the object — makes it permanently immutable
        sui::transfer::freeze_object(anchor);
    }
}
```

Key design choice: **`freeze_object`** makes the anchor permanently immutable.
Unlike mutable objects, frozen objects cannot be transferred, modified, or deleted.
They also do not receive storage rebates (since they can never be deleted), which
is correct for compliance — we WANT permanent, irrevocable storage.

### 3.5 Merkle Tree Construction

```
                    Merkle Root
                   /            \
              H(01)              H(23)
             /    \             /    \
         H(E0)  H(E1)      H(E2)  H(E3)
           |      |          |      |
         Event  Event      Event  Event
         seq=1  seq=2      seq=3  seq=4
```

Each leaf is `SHA-256(eventId || originTimestamp || entityType || entityId || payloadHash)`.

Merkle proofs enable verification of individual events without revealing the
entire batch — critical for cross-org audits where one party needs to prove
a specific event existed without revealing all events.

---

## 4. FDA 21 CFR Part 11 Compliance

### 4.1 Regulatory Requirements Mapping

FDA 21 CFR Part 11 [FDA-CFR11] defines requirements for electronic records and
electronic signatures. The regulation is **technology-agnostic** — it does not
mandate specific technologies but requires demonstrated capabilities.

| 21 CFR Part 11 Requirement | Current Platform (JetStream) | With Sui Anchoring |
|---|---|---|
| **11.10(a)** Validation | JetStream config validated at deploy | Anchor validates event integrity externally |
| **11.10(b)** Accurate copies | Event replay from JetStream | Merkle proof verifies copy matches on-chain root |
| **11.10(c)** Record protection | `deny_delete`, `deny_purge` | Frozen Sui objects are platform-independent proof |
| **11.10(d)** Authority checks | NATS account + JWT | Sui multi-sig requires operator key threshold |
| **11.10(e)** Audit trail | EventLog append-only | On-chain anchor timestamps are independently verifiable |
| **11.10(k)** System documentation | Architecture docs | Smart contract source is public and verifiable |
| **11.50** Signature manifestation | Operator JWT claims | Ed25519 signature in Sui transaction |
| **11.70** Signature/record linking | EventLog `electronicSignature` field | Merkle leaf includes signature hash |

### 4.2 Electronic Signature Mapping

Sui's Ed25519 transaction signatures satisfy 21 CFR Part 11 Section 11.50 requirements:

1. **Printed name of signer**: Sui address derivable from Ed25519 public key,
   mapped to operator identity in platform registry
2. **Date and time of signing**: Sui checkpoint timestamp (independently verified
   by validator committee BLS signatures)
3. **Meaning of signature**: Encoded in the transaction's intent message — e.g.,
   "anchor batch 1001-2000 of entity-events for org earl-machine-shop"

### 4.3 Tamper Detection

Without Sui anchoring:
- Auditor must trust the platform operator's JetStream configuration
- A sophisticated attacker with operator-level access COULD modify stored events
  and rebuild JetStream metadata to hide the tampering

With Sui anchoring:
- Tampering with events changes the Merkle root
- The on-chain anchor preserves the original Merkle root
- Discrepancy is detectable: `computeMerkleRoot(currentEvents) != onChainRoot`
- The attacker would need to compromise BOTH the platform AND the Sui validator
  committee (2/3+ of validators) — economically infeasible

### 4.4 Compliance Workflow

```
1. Batch timer fires (e.g., every 1 hour for FDA orgs)
2. Read events [lastAnchoredSeq+1 .. currentSeq] from JetStream
3. Compute Merkle tree over event batch
4. Create Sui transaction:
   a. Sign with operator multi-sig (2-of-3)
   b. Call compliance_anchor::create_anchor()
   c. Object is frozen (permanently immutable)
5. Record anchor ObjectId and Sui transaction digest in local index
6. Auditor verification:
   a. Retrieve anchor object from Sui by ObjectId
   b. Retrieve event batch from JetStream by sequence range
   c. Recompute Merkle root from events
   d. Compare: computed root == on-chain merkleRoot
   e. If match → events are verified unmodified since anchoring
```

---

## 5. ISA-18.2 Alarm Compliance

### 5.1 Alarm Lifecycle Anchoring

ISA-18.2 [ISA-18.2] requires that alarm lifecycle events (triggered, acknowledged,
cleared, shelved, suppressed) be recorded with provable ordering and timing.
Our platform already guarantees this via G-1 (per-entity sequential ordering)
and JetStream per-subject ordering (ISO-48).

Sui anchoring adds:

1. **Independent timing proof**: Alarm acknowledgment time is anchored to Sui
   checkpoint timestamp, verified by the validator committee — not just the
   platform's clock.

2. **Audit independence**: An auditor can verify alarm response times by
   comparing the `originTimestamp` in the alarm event (when the alarm was
   triggered) against the Sui anchor timestamp (when the batch was anchored).
   The Merkle proof for the specific alarm event proves it was part of the
   anchored batch.

3. **Highly Managed Alarms**: ISA-18.2 requires access control with audit trail
   for Highly Managed Alarms. Sui anchoring provides an external audit trail
   that the platform operator cannot retroactively modify.

### 5.2 Alarm-Specific Anchoring Strategy

For critical alarm events (Safety Integrity Level 2+), immediate anchoring
is warranted:

| Alarm Category | Anchoring Strategy | Rationale |
|---|---|---|
| SIL 3-4 (Safety Critical) | Immediate (per-event) | Liability, investigation |
| SIL 1-2 (High Priority) | Hourly batch | ISA-18.2 audit compliance |
| General alarms | 6-hour batch | Standard compliance |
| Nuisance alarms | 24-hour batch | Cost optimization |

Immediate anchoring for SIL 3-4 alarms costs ~$0.003 per event, which is
negligible compared to the liability exposure of a safety incident.

### 5.3 Response Time Verification

```
Alarm Event Timeline:
  t0: Sensor reading exceeds threshold (originTimestamp)
  t1: AlarmTriggered event written to JetStream
  t2: Operator acknowledges alarm (AlarmAcknowledged event)
  t3: Sui anchor batch includes both events

Auditor Verification:
  1. Fetch anchor from Sui → get merkleRoot and anchorTimestamp
  2. Fetch AlarmTriggered and AlarmAcknowledged from JetStream
  3. Verify Merkle proof for both events
  4. Response time = AlarmAcknowledged.originTimestamp - AlarmTriggered.originTimestamp
  5. Anchoring proves events existed BEFORE anchor timestamp
  6. G-1 proves events are in correct order (JetStream sequence)
```

---

## 6. Immutable Work Order History

### 6.1 Cross-Org Work Order Audit Trail

Work orders are the primary cross-org transaction type. The current architecture
(ISO-43) maintains independent copies in each party's JetStream domain plus
metadata in `manufacturing-commons`.

Sui anchoring adds a **third, neutral proof point**:

```
Work Order WO-12345 Audit Trail:
  ├── Earl's JetStream: full event history (private)
  ├── PM's JetStream: full event history (private)
  ├── manufacturing-commons: metadata only (semi-public)
  └── Sui blockchain: Merkle roots from BOTH parties + commons (public)
```

### 6.2 Settlement Anchoring

Each work order state transition that involves cross-org agreement gets anchored:

| State Transition | Anchoring | Parties |
|---|---|---|
| WorkOrderPosted | Earl anchors | Requester only |
| BidSubmitted | PM anchors | Bidder only |
| BidAccepted | Both anchor + commons | Bilateral agreement |
| WorkStarted | PM anchors | Executor confirms |
| QualityCheckPassed | Both anchor | Bilateral verification |
| WorkOrderCompleted | Both anchor + commons | Settlement proof |
| DisputeRaised | Raising party anchors | Dispute evidence |

### 6.3 Dispute Resolution Evidence

In a dispute, Sui anchors provide:

1. **Temporal ordering**: Which events came first, verified by checkpoint timestamps
2. **Content integrity**: Neither party has modified their event history post-anchoring
3. **Non-repudiation**: The anchoring party's Ed25519 signature proves they
   committed to that event history at that time
4. **Selective disclosure**: Merkle proofs allow proving specific events
   without revealing the entire history

### 6.4 Settlement Object (Move)

```move
/// Cross-org settlement anchor — references both parties' anchors
public struct SettlementAnchor has key, store {
    id: UID,
    work_order_id: vector<u8>,
    requester_anchor_id: address,   // ObjectId of requester's EventBatchAnchor
    executor_anchor_id: address,    // ObjectId of executor's EventBatchAnchor
    commons_anchor_id: address,     // ObjectId of commons' metadata anchor
    settlement_state: vector<u8>,   // "completed", "disputed", etc.
    settlement_timestamp_ms: u64,
}
```

---

## 7. Data Integrity Proofs

### 7.1 Merkle Proof Verification

A Merkle proof for a specific event within an anchored batch consists of:
- The event's leaf hash
- The sibling hashes along the path from leaf to root
- The root (verified against on-chain anchor)

Proof size: `O(log2(N))` hashes, where N is the batch size. For a batch of
1,000 events, the proof is ~10 hashes (320 bytes).

### 7.2 Verification Without Platform Access

A key benefit: third-party auditors can verify event integrity WITHOUT requiring
access to the platform's infrastructure:

```
Auditor receives:
  1. Event data (exported from org's JetStream)
  2. Merkle proof for the event
  3. Sui anchor ObjectId

Auditor verifies:
  1. Fetch anchor from Sui (public, permissionless)
  2. Compute leaf hash from event data
  3. Walk Merkle proof from leaf to root
  4. Compare computed root with on-chain merkleRoot
  5. If match → event data is authentic and unmodified
```

This enables **zero-trust auditing** — the auditor does not need to trust the
platform operator, the organization, or any intermediary.

### 7.3 Batch Integrity vs Individual Event Integrity

| Approach | Proves | Cost | Granularity |
|---|---|---|---|
| Batch Merkle root | Entire batch unmodified | 1 tx per batch | Batch-level |
| Merkle proof for event | Specific event unmodified | 0 (proof is off-chain) | Event-level |
| Individual event anchor | Each event independently | 1 tx per event | Event-level |

Recommended: **Batch Merkle root on-chain + Merkle proofs off-chain**. This gives
event-level verification at batch-level cost.

### 7.4 Tamper Detection Scenarios

| Scenario | Detection |
|---|---|
| Event modified after anchoring | Merkle root mismatch |
| Event deleted from JetStream | Batch recomputation has missing leaf |
| Event inserted into history | Sequence gap or Merkle mismatch |
| Timestamp modified | Leaf hash includes originTimestamp → mismatch |
| Operator replaces entire stream | All Merkle roots mismatch from that point |

---

## 8. Sui Object Versioning vs Entity Sequence Numbers

### 8.1 Semantic Comparison

| Property | TMNL Entity Sequences | Sui Object Versions |
|---|---|---|
| Scope | Per-entity, per-stream | Per-object (global) |
| Monotonicity | Strictly increasing | Strictly increasing |
| Gap-free | Yes (JetStream guarantee) | Yes (each mutation increments by 1) |
| Historical access | JetStream replay | Sui historical queries |
| Immutability | `deny_delete` config | Inherent (all versions permanent) |
| Cross-org visibility | No (per-account) | Yes (public blockchain) |

### 8.2 Can Sui Object Versions Serve as Cross-Org Sequence Anchors?

**Partially, with caveats.**

If we model each organization's compliance state as a Sui object, its version
number becomes a cross-org sequence anchor:

```move
public struct OrgComplianceState has key, store {
    id: UID,
    org_id: vector<u8>,
    latest_anchored_seq: u64,       // JetStream sequence
    latest_merkle_root: vector<u8>, // Current batch root
    total_events_anchored: u64,     // Running count
    last_anchor_timestamp_ms: u64,
}
```

Each anchor operation mutates this object, incrementing its Sui version.
The Sui version becomes a **cross-org-visible sequence number** for compliance
state transitions.

**However**, this approach uses a mutable shared object, which:
1. Requires consensus ordering (2-3s finality instead of <500ms)
2. Creates contention if multiple anchors happen concurrently for the same org
3. Loses the storage rebate benefit (we never delete compliance objects)

**Recommendation**: Use **immutable anchor objects** (Section 3.4) as the primary
mechanism, plus a mutable `OrgComplianceState` singleton as an index/pointer to
the latest anchor. The singleton's Sui version number serves as the cross-org
sequence anchor.

### 8.3 Cross-Org Sequence Verification

With the singleton approach:

```
Org A's OrgComplianceState (Sui version 47):
  latest_anchored_seq: 47000
  latest_merkle_root: 0xabc...

Org B can verify:
  1. Read Org A's OrgComplianceState from Sui (public)
  2. See that Org A has anchored up to JetStream seq 47000
  3. The Sui version (47) confirms 47 anchoring operations
  4. Fetch the referenced immutable anchor object for details
```

This gives Org B **visibility into Org A's compliance posture** without
accessing Org A's actual data.

---

## 9. Cost Analysis

### 9.1 Per-Transaction Costs

Based on Sui's current fee structure (February 2026, SUI ~$0.98):

| Transaction Type | Data Size | MIST Cost | SUI Cost | USD Cost |
|---|---|---|---|---|
| Immutable anchor (256 bytes) | 256 B | ~2,950,000 | ~0.00295 | ~$0.0029 |
| Immutable anchor (512 bytes) | 512 B | ~4,900,000 | ~0.0049 | ~$0.0048 |
| Singleton update (256 bytes) | 256 B | ~2,950,000 | ~0.00295 | ~$0.0029 |
| PTB batch (10 anchors, 2.5KB) | 2,560 B | ~20,500,000 | ~0.0205 | ~$0.020 |
| Settlement anchor (128 bytes) | 128 B | ~1,975,000 | ~0.00198 | ~$0.0019 |

### 9.2 Anchoring Strategy Cost Models

**Assumptions**:
- 200,000 organizations
- 4 stream types per org (entity-events, alarm-events, work-order-events, signature-events)
- PTB batching: 10 anchors per transaction

#### Model A: Uniform Daily Anchoring (T3 for all)

```
Anchors per day: 200,000 orgs × 4 streams = 800,000
Transactions per day: 800,000 / 10 (PTB batch) = 80,000
Cost per day: 80,000 × $0.020 = $1,600
Cost per month: ~$48,000
Cost per org per month: $0.24
```

#### Model B: Tiered Anchoring (Recommended)

| Tier | Orgs | Frequency | Daily Anchors | Daily Txs | Daily Cost |
|---|---|---|---|---|---|
| T1 Critical (FDA/ITAR) | 2,000 | Hourly (24/day) | 192,000 | 19,200 | $384 |
| T2 Standard (ISO) | 18,000 | Every 6 hours (4/day) | 288,000 | 28,800 | $576 |
| T3 Basic | 80,000 | Daily (1/day) | 320,000 | 32,000 | $640 |
| T4 Minimal | 100,000 | Weekly (0.14/day) | 56,000 | 5,600 | $112 |
| **Total** | **200,000** | | **856,000** | **85,600** | **$1,712** |

```
Monthly cost: ~$51,360
Cost per org per month (avg): $0.26
Cost per T1 org per month: $5.76
Cost per T4 org per month: $0.016
```

#### Model C: Event-Triggered + Periodic (Hybrid)

Add immediate anchoring for critical events:

```
Periodic base (Model B): $1,712/day
+ SIL 3-4 alarm anchors: ~5,000/day × $0.003 = $15/day
+ Settlement anchors: ~10,000/day × $0.002 = $20/day
+ Safety incident anchors: ~100/day × $0.003 = $0.30/day

Total daily: ~$1,747
Monthly: ~$52,410
```

### 9.3 Cost Comparison

| Approach | Monthly Cost | Per-Org/Month | Audit Independence |
|---|---|---|---|
| JetStream only (current) | $0 | $0 | None (trust platform) |
| Sui anchoring (Model B) | ~$51K | $0.26 avg | Full cryptographic |
| Traditional HSM timestamping | ~$200K+ | $1.00+ | Moderate (trust TSA) |
| Ethereum L1 anchoring | ~$500K+ | $2.50+ | Full but expensive |
| Ethereum L2 (Optimism/Base) | ~$30K | $0.15 | Moderate (trust sequencer) |

Sui anchoring is **cost-competitive with L2 rollups** while providing
**L1-grade finality** (no challenge periods, no sequencer trust assumptions).

### 9.4 SUI Token Price Sensitivity

| SUI Price | Model B Monthly | Per-Org/Month |
|---|---|---|
| $0.50 | ~$26K | $0.13 |
| $1.00 | ~$52K | $0.26 |
| $2.00 | ~$104K | $0.52 |
| $5.00 | ~$260K | $1.30 |
| $10.00 | ~$520K | $2.60 |

At $5.00/SUI, costs remain manageable. At $10.00/SUI, the platform should
consider reducing anchoring frequency or negotiating validator gas price
reduction through staking participation.

**Mitigation**: Sui's gas price is denominated in MIST, not USD. The reference
gas price is set by validator committee each epoch. If SUI price increases
significantly, validators can lower the reference gas price to maintain
reasonable transaction costs.

---

## 10. Integration Architecture

### 10.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Per-Organization                         │
│                                                             │
│  JetStream ──► AnchorScheduler ──► MerkleBuilder           │
│  (events)      (timer/trigger)     (tree construction)      │
│                                          │                  │
│                                    ┌─────▼──────┐          │
│                                    │ AnchorIndex │          │
│                                    │ (local DB)  │          │
│                                    └─────────────┘          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                     ┌─────▼──────┐
                     │ SuiAnchor  │
                     │  Service   │  ← @effect/cluster singleton
                     │ (batches   │    per region
                     │  PTBs)     │
                     └─────┬──────┘
                           │
                     ┌─────▼──────┐
                     │    Sui     │
                     │ Blockchain │
                     └────────────┘
```

### 10.2 Effect-TS Service Design

```typescript
// Anchor service tag
class SuiAnchorService extends Context.Tag("SuiAnchorService")<
  SuiAnchorService,
  {
    readonly anchorBatch: (params: {
      orgId: string
      streamType: string
      batchStartSeq: number
      batchEndSeq: number
      events: ReadonlyArray<JetStreamEvent>
    }) => Effect.Effect<AnchorResult, AnchorError>

    readonly verifyAnchor: (params: {
      anchorObjectId: string
      events: ReadonlyArray<JetStreamEvent>
    }) => Effect.Effect<VerificationResult, VerificationError>

    readonly getLatestAnchor: (params: {
      orgId: string
      streamType: string
    }) => Effect.Effect<Option.Option<AnchorRecord>, AnchorError>
  }
>() {}

// Anchor result schema
const AnchorResult = Schema.Struct({
  anchorObjectId: Schema.String,
  transactionDigest: Schema.String,
  merkleRoot: Schema.String,
  suiCheckpointSequence: Schema.Number,
  anchorTimestamp: Schema.Number,
  batchStartSeq: Schema.Number,
  batchEndSeq: Schema.Number,
  eventCount: Schema.Number,
})
```

### 10.3 Anchoring Flow (Effect Pipeline)

```typescript
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

    // 3. Create anchor
    const result = yield* anchor.anchorBatch({
      orgId,
      streamType,
      batchStartSeq: startSeq,
      batchEndSeq: startSeq + events.length - 1,
      events,
    })

    return Option.some(result)
  })
```

### 10.4 Verification Endpoint (RPC)

```typescript
// New RPC for auditor verification
const VerifyComplianceAnchor = Rpc.make("Compliance.VerifyAnchor", {
  request: Schema.Struct({
    anchorObjectId: Schema.String,
    eventSequences: Schema.optional(Schema.Array(Schema.Number)),
  }),
  response: Schema.Struct({
    verified: Schema.Boolean,
    anchorTimestamp: Schema.Number,
    merkleRoot: Schema.String,
    eventProofs: Schema.optional(Schema.Array(MerkleProofSchema)),
    discrepancies: Schema.optional(Schema.Array(Schema.String)),
  }),
})
```

---

## 11. Risk Analysis

### 11.1 Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Sui network downgrade/shutdown | HIGH | LOW | Multi-chain anchoring option; anchors are self-contained data |
| SUI price spike (>$10) | MEDIUM | MEDIUM | Reduce frequency; validator gas price adjustment |
| Sui consensus delay | LOW | LOW | Anchoring is async; platform operates normally without anchors |
| Key compromise (anchor signer) | HIGH | LOW | Multi-sig (2-of-3); HSM for signing keys |
| Merkle computation overhead | LOW | LOW | Batch processing; SHA-256 is CPU-efficient |
| Regulatory rejection of blockchain proof | MEDIUM | MEDIUM | Blockchain is supplementary, not replacement for JetStream audit |
| Sui object storage growth | LOW | MEDIUM | Frozen objects; no state bloat from mutations |

### 11.2 Failure Modes

| Failure | Impact | Recovery |
|---|---|---|
| Sui RPC unavailable | Anchoring delayed | Queue anchors locally; retry with exponential backoff |
| Transaction rejected (insufficient gas) | Anchoring fails | Alert operator; auto-top-up from gas station |
| Merkle computation error | Wrong root anchored | Idempotent re-anchor with correct root; old anchor remains as history |
| Clock skew (platform vs Sui) | Timestamp discrepancy | Use Sui checkpoint timestamp as authoritative; document skew |

### 11.3 What Sui Anchoring Does NOT Replace

- JetStream event sourcing (still the primary audit trail)
- NATS account isolation (still the primary tenant boundary)
- JetStream `deny_delete`/`deny_purge` (still the primary tamper resistance)
- Platform authentication (NATS JWT, not Sui wallets, for daily operations)

Sui anchoring is a **complementary verification layer**, not a replacement for
existing infrastructure.

---

## 12. Recommendations

### 12.1 Implementation Priority

| Phase | Scope | Timeline Estimate |
|---|---|---|
| Phase 1 | Move module deployment + single-org anchoring | Sprint 1-2 |
| Phase 2 | PTB batching + tiered scheduling | Sprint 3 |
| Phase 3 | Cross-org settlement anchoring | Sprint 4-5 |
| Phase 4 | Auditor verification RPC + dashboard | Sprint 5-6 |
| Phase 5 | Multi-chain option (Sui + backup chain) | Future |

### 12.2 Architecture Decisions

1. **Immutable anchor objects** (not mutable state): Use `freeze_object` for
   permanent, irrevocable compliance records.

2. **Batch Merkle roots** (not individual events): Cost-efficient at scale,
   with Merkle proofs for event-level verification.

3. **PTB batching**: Bundle 10+ anchors per transaction to reduce per-anchor cost.

4. **Tiered frequency**: FDA/ITAR orgs get hourly anchoring; basic orgs get daily/weekly.

5. **Authenticated events**: Use Sui's `emit_authenticated()` for light-client
   verifiable anchor creation events.

6. **Multi-sig signing**: 2-of-3 operator keys for anchor creation. No single
   operator can create fraudulent anchors.

7. **Sui as supplementary**: JetStream remains the primary audit trail. Sui
   provides independent verification, not replacement.

### 12.3 Open Questions

1. **Regulatory acceptance**: Has any FDA-regulated manufacturer used blockchain
   anchoring for 21 CFR Part 11 compliance? Need regulatory affairs consultation.

2. **Cross-chain portability**: Should anchor data be structured for potential
   migration to other chains (Aptos, Solana, Ethereum L2)?

3. **Auditor tooling**: What tools do manufacturing auditors currently use?
   How do we integrate Merkle proof verification into their workflow?

4. **Gas station model**: Should the platform operate a gas station (pre-funded
   SUI accounts) or should each org manage their own Sui wallet?

5. **Privacy of anchor metadata**: Org IDs in anchor objects are public on Sui.
   Should we use hashed/encrypted org identifiers instead?

---

## 13. References

### Standards & Regulations

- [FDA-CFR11] U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."
  https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11
- [ISA-18.2] ANSI/ISA-18.2-2016. "Management of Alarm Systems for the Process Industries."
  https://www.isa.org/products/ansi-isa-18-2-2016-management-of-alarm-systems-for
- [ISA-95] ANSI/ISA-95. "Enterprise-Control System Integration."

### Sui Technical Documentation

- Sui Gas Fees: https://docs.sui.io/concepts/tokenomics/gas-in-sui
- Sui Gas Pricing: https://docs.sui.io/concepts/tokenomics/gas-pricing
- Sui Object Model: https://docs.sui.io/concepts/object-model
- Sui Checkpoints: https://docs.sui.io/concepts/sui-architecture/consensus
- Sui Multi-sig: https://docs.sui.io/guides/developer/cryptography/multisig

### Market Data

- SUI price (2026-02-09): ~$0.98 USD
  - CoinMarketCap: https://coinmarketcap.com/currencies/sui/
  - CoinGecko: https://www.coingecko.com/en/coins/sui

### RFC Cross-References

- `rfc-section-tenant-isolation.md` — ISO-41 through ISO-49 (audit trail isolation)
- `rfc-section-security-architecture.md` — S.4, S.8 (auth, audit)
- `rfc-section-trust-model.md` — T.5 (reputation), T.7 (data sharing)
- `rfc-section-two-domain-consistency.md` — G-1 through G-8 (ordering guarantees)
- `rfc-section-marketplace-protocol.md` — M.6 (state transitions), M.11 (codebase grounding)
- `rfc-section-failure-modes.md` — FM.3 (audit trail recovery)

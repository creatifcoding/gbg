# RFC-001 Section 21.10: On-Chain Isolation (Sixth Isolation Layer)

```
Section:       On-Chain Isolation
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-12
Amendment:     5 (of 7 proposed by research-rfc-sui-chainlink-audit.md)
Extends:       rfc-section-tenant-isolation.md (TI.3 Five-Layer Model)
Companion:     rfc-section-onchain-identity.md (Section 20.12)
               rfc-section-security-architecture.md (S.4, S.6)
               rfc-section-settlement-layer.md (Section 18.11)
Research Base: docs/specifications/research-sui-compliance-anchoring.md
               docs/specifications/research-rfc-sui-chainlink-audit.md
               docs/specifications/research-hybrid-architecture.md
               docs/specifications/research-sui-ownership-model.md
Integration:   S-6, L-4, L-5 (audit integration point IDs)
Bibliography:  docs/specifications/bibliography.md
```

> This section specifies the sixth isolation layer for the TMNL manufacturing
> commons: **on-chain state isolation**. The existing five-layer isolation model
> (NATS account, JetStream domain, compute shard, data-at-rest encryption,
> cross-org sharing controls) MUST be extended to blockchain state when Sui
> settlement and identity objects are introduced.
>
> Without on-chain isolation, the carefully constructed NATS isolation can be
> circumvented. A malicious organization could query the Sui blockchain to
> discover relationships, transaction volumes, or operational patterns of
> competitors. This section defines normative controls that prevent such leakage.
>
> **Design principle**: On-chain state MUST NOT reveal information that the
> five-layer NATS isolation model would prevent from being visible. The
> blockchain augments isolation; it MUST NOT undermine it.

---

## Table of Contents

1. [Scope](#2110-1-scope)
2. [Conventions](#2110-2-conventions)
3. [Threat Surface](#2110-3-threat-surface)
4. [ISO-42: Bilateral Scoping of Shared Objects](#2110-4-iso-42-bilateral-scoping-of-shared-objects)
5. [ISO-43: State Query Isolation](#2110-5-iso-43-state-query-isolation)
6. [ISO-44: Data Classification Enforcement](#2110-6-iso-44-data-classification-enforcement)
7. [ISO-45: Cross-Chain Message Isolation](#2110-7-iso-45-cross-chain-message-isolation)
8. [ISO-46: Audit Trail Anchoring Isolation](#2110-8-iso-46-audit-trail-anchoring-isolation)
9. [ISO-47: Object Ownership Tree Isolation](#2110-9-iso-47-object-ownership-tree-isolation)
10. [ISO-48: Temporal Privacy](#2110-10-iso-48-temporal-privacy)
11. [Move Access Control Patterns](#2110-11-move-access-control-patterns)
12. [Effect-TS Integration](#2110-12-effect-ts-integration)
13. [Verification and Testing](#2110-13-verification-and-testing)
14. [Six-Layer Isolation Summary](#2110-14-six-layer-isolation-summary)
15. [References](#2110-15-references)

---

## 21.10.1 Scope

This section covers:

- Extension of the five-layer isolation model to include blockchain state
- Access control for Sui shared objects scoped to bilateral agreements
- Query isolation preventing unauthorized state discovery
- Data classification enforcement in Move smart contracts
- Cross-chain message lane isolation via CCIP configuration
- Audit trail Merkle root anchoring with per-organization scoping
- Object ownership tree privacy for ISA-95 asset hierarchies
- Temporal privacy to prevent transaction timing analysis

This section does NOT cover:

- NATS messaging isolation (see TI.4 in rfc-section-tenant-isolation.md)
- JetStream domain isolation (see TI.5)
- Compute isolation via @effect/cluster (see TI.6)
- Blockchain threat model (see Section 19.3.5 in rfc-section-blockchain-threats.md)
- Identity object lifecycle (see Section 20.12 in rfc-section-onchain-identity.md)

---

## 21.10.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in `[RFC2119]` and `[RFC8174]`.

| Term | Definition |
|------|-----------|
| **Bilateral scope** | An on-chain object that is accessible only to the two parties named in a trust channel |
| **Shared object** | A Sui object requiring consensus for mutation, accessible to any transaction |
| **Object-owned** | A Sui object controlled by another Sui object (parent owns child) |
| **SuiBridgeService** | The Effect-TS service mediating between NATS and Sui (Section 22.X) |
| **Trust channel** | A bilateral agreement object between two organizations (Section 20.12.5) |
| **K-anonymity** | A privacy measure ensuring any individual's data is indistinguishable from at least k-1 others |

---

## 21.10.3 Threat Surface

### 21.10.3.1 On-Chain Information Leakage Vectors

The introduction of blockchain state creates new information leakage channels
that do not exist in the pure NATS architecture:

| Vector | Description | Severity |
|--------|-------------|----------|
| V-1: Object enumeration | Any Sui Full Node can enumerate all objects of a given type | HIGH |
| V-2: Transaction graph analysis | Transaction history reveals which organizations interact | HIGH |
| V-3: Balance observation | Token balances reveal organizational economic activity | MEDIUM |
| V-4: Timing correlation | Transaction timestamps correlate with operational events | MEDIUM |
| V-5: Dynamic field traversal | Querying an object's dynamic fields reveals child objects | HIGH |
| V-6: Event log mining | Sui events emitted by smart contracts are publicly visible | HIGH |
| V-7: PTB composition analysis | Multi-step PTBs reveal relationship between operations | MEDIUM |
| V-8: Gas payment tracing | Gas sponsor addresses link otherwise independent transactions | LOW |

### 21.10.3.2 Isolation Invariant

> **INV-CHAIN-1**: For any two organizations A and B that do NOT share a
> bilateral trust channel `[20.12.5]`, it MUST NOT be possible for A to
> determine from on-chain state alone:
>
> 1. That B exists as a participant in the commons
> 2. What capabilities or capacity B has registered
> 3. What work orders B has participated in
> 4. What reputation score B holds
> 5. What other organizations B has trust channels with

This invariant is aspirational at the Move contract level — Sui's transparency
means any validator can read all state. The compensating controls below reduce
practical information leakage to acceptable levels.

---

## 21.10.4 ISO-42: Bilateral Scoping of Shared Objects

### 21.10.4.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-42-1 | Escrow objects `[18.11.1]` MUST name exactly two parties (buyer + seller) and one arbiter. No other address SHALL be authorized to mutate escrow state. | MUST |
| ISO-42-2 | Trust channel objects `[20.12.5]` MUST be accessible only to the two organizations that created the channel. | MUST |
| ISO-42-3 | Cross-org sharing agreement objects MUST enforce bilateral scope via Move `assert!` checks on `tx_context::sender()`. | MUST |
| ISO-42-4 | Objects created within a bilateral context SHOULD use object-owned storage (child of trust channel) rather than shared objects where possible. | SHOULD |
| ISO-42-5 | Shared objects that require more than two parties (e.g., multi-hop escrow) MUST explicitly enumerate all authorized addresses in the object state. | MUST |

### 21.10.4.2 Move Pattern: Bilateral Access Guard

```move
module tmnl::bilateral_guard {
    use sui::tx_context::TxContext;

    /// Error: Caller is not an authorized party
    const E_NOT_AUTHORIZED: u64 = 1;

    /// Verifies the transaction sender is one of the named parties.
    /// MUST be called at the entry point of every bilateral operation.
    public fun assert_is_party(
        party_a: address,
        party_b: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            sender == party_a || sender == party_b,
            E_NOT_AUTHORIZED
        );
    }

    /// Extended guard for escrow (buyer, seller, arbiter).
    public fun assert_is_escrow_party(
        buyer: address,
        seller: address,
        arbiter: address,
        ctx: &TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            sender == buyer || sender == seller || sender == arbiter,
            E_NOT_AUTHORIZED
        );
    }
}
```

### 21.10.4.3 Object-Owned vs Shared Object Decision Matrix

| Scenario | Object Type | Rationale |
|----------|-------------|-----------|
| Single-org asset (machine, sensor) | Address-owned | Fastest path, no consensus needed |
| Bilateral agreement (trust channel) | Shared object with bilateral guard | Both parties must mutate |
| Escrow | Shared object with trilateral guard | Buyer, seller, arbiter must act |
| Organization identity | Shared object | Must be readable for trust verification |
| Reputation SBT | Address-owned (soulbound) | Only owner publishes; others read via events |
| Capacity lease | Address-owned (transferable) | Tradeable between organizations |
| iNFT (machine digital twin) | Address-owned with dynamic fields | Single org controls, accumulates intelligence |
| Multi-hop work order | Shared object with N-party guard | All participants in chain must interact |

---

## 21.10.5 ISO-43: State Query Isolation

### 21.10.5.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-43-1 | The SuiBridgeService MUST be the sole intermediary for application-layer queries of Sui state. Direct Full Node queries from client applications are NOT RECOMMENDED. | SHOULD |
| ISO-43-2 | SuiBridgeService MUST filter query results to return only objects the requesting organization is authorized to see. | MUST |
| ISO-43-3 | Object type registration MUST NOT use globally enumerable patterns. Object types SHOULD be indistinguishable from generic types where possible. | SHOULD |
| ISO-43-4 | Organization-owned objects MUST NOT be discoverable via `getOwnedObjects` queries by unauthorized parties. | MUST |
| ISO-43-5 | Implementations SHOULD use Sui's `Display` standard to control what metadata is publicly visible. | SHOULD |

### 21.10.5.2 Compensating Controls

Sui's object store is inherently transparent — any Full Node operator can
enumerate all objects. Isolation at the query layer is therefore a
**compensating control**, not a cryptographic guarantee:

```
┌──────────────────────────────────────────────────┐
│  Application Layer                                │
│                                                    │
│  ┌─────────────┐     ┌─────────────────────────┐ │
│  │ Organization │     │ Organization B           │ │
│  │ A's UI       │     │ (unauthorized)           │ │
│  └──────┬──────┘     └──────────┬──────────────┘ │
│         │                       │                  │
│         ▼                       ▼                  │
│  ┌─────────────────────────────────────────────┐  │
│  │           SuiBridgeService                   │  │
│  │  ┌─────────────────────────────────────┐    │  │
│  │  │  Authorization Filter               │    │  │
│  │  │  - Check org → trust channel ACL    │    │  │
│  │  │  - Filter objects by bilateral scope│    │  │
│  │  │  - Redact fields by classification  │    │  │
│  │  └─────────────────────────────────────┘    │  │
│  └──────────────────┬──────────────────────────┘  │
│                     │                              │
├─────────────────────┼──────────────────────────────┤
│  Sui Full Node      │                              │
│  (transparent)      ▼                              │
│  ┌─────────────────────────────────────────────┐  │
│  │  Global Object Store                         │  │
│  │  (all objects visible to node operators)     │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Implication**: Isolation is enforced at the application layer, not the
blockchain layer. The threat model `[19.3.5]` MUST acknowledge that a
determined attacker operating a Sui Full Node can observe all on-chain state.
The mitigation is to minimize sensitive information stored on-chain (see
ISO-44) and rely on aggregation/anonymization (see ISO-48).

### 21.10.5.3 Effect-TS Query Filtering

```typescript
import { Context, Effect, Layer, Schema } from 'effect'

// Query filter applied by SuiBridgeService
const SuiQueryFilter = Schema.TaggedStruct('SuiQueryFilter', {
  requestingOrgId: Schema.String.pipe(Schema.brand('OrganizationId')),
  objectType: Schema.Literal(
    'escrow', 'trust_channel', 'reputation', 'capability',
    'capacity_lease', 'work_order', 'audit_anchor'
  ),
  scope: Schema.Union(
    Schema.TaggedStruct('OwnedOnly', {}),
    Schema.TaggedStruct('BilateralWith', {
      counterpartyId: Schema.String.pipe(Schema.brand('OrganizationId'))
    }),
    Schema.TaggedStruct('PublicAggregates', {})
  ),
})

// Authorization check: does requesting org have access to this object?
const authorizeQuery = (
  filter: Schema.Schema.Type<typeof SuiQueryFilter>,
  object: SuiObject
): Effect.Effect<boolean, never, TrustChannelService> =>
  Effect.gen(function* () {
    const trustService = yield* TrustChannelService

    // Owned objects: only owner can query
    if (object.owner === filter.requestingOrgId) return true

    // Bilateral objects: check trust channel exists
    if (object.parties) {
      const hasChannel = yield* trustService.hasTrustChannel(
        filter.requestingOrgId,
        object.counterparty
      )
      return hasChannel
    }

    // Public aggregates: always allowed (K-anonymous)
    if (filter.scope._tag === 'PublicAggregates') return true

    return false
  })
```

---

## 21.10.6 ISO-44: Data Classification Enforcement

### 21.10.6.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-44-1 | Data classification levels C-0 through C-5 (as defined in Trust Model 20.10) MUST be enforced in Move smart contracts for on-chain data. | MUST |
| ISO-44-2 | Data classified C-3 (Regulated) or above MUST NOT be stored on-chain in plaintext. Only hashes, Merkle roots, or encrypted blobs are permitted. | MUST |
| ISO-44-3 | Sharing agreement Move modules MUST reference the data classification level and enforce appropriate access controls. | MUST |
| ISO-44-4 | Classification violations SHOULD create on-chain evidence objects for dispute resolution. | SHOULD |
| ISO-44-5 | Move modules MUST validate classification constraints at compile time where possible (via phantom type parameters). | SHOULD |

### 21.10.6.2 Classification-to-Chain Mapping

| Level | Name | On-Chain Storage | Access Control |
|-------|------|-----------------|----------------|
| C-0 | Public | Plaintext permitted | None required |
| C-1 | Internal | Plaintext permitted | Organization-owned object |
| C-2 | Confidential | Plaintext permitted | Bilateral-scoped shared object |
| C-3 | Regulated | Hash/Merkle root ONLY | Bilateral + classification guard |
| C-4 | Restricted | Hash/Merkle root ONLY | Bilateral + multi-sig + audit log |
| C-5 | Top Secret | MUST NOT appear on-chain | N/A — off-chain only |

### 21.10.6.3 Move Pattern: Classification Guard

```move
module tmnl::classification {
    /// Classification levels (C-0 through C-5)
    const C_PUBLIC: u8 = 0;
    const C_INTERNAL: u8 = 1;
    const C_CONFIDENTIAL: u8 = 2;
    const C_REGULATED: u8 = 3;
    const C_RESTRICTED: u8 = 4;
    const C_TOP_SECRET: u8 = 5;

    /// Error: Attempting to store regulated data in plaintext
    const E_PLAINTEXT_VIOLATION: u64 = 100;
    /// Error: C-5 data must not appear on-chain
    const E_TOP_SECRET_VIOLATION: u64 = 101;
    /// Error: Classification level insufficient for operation
    const E_INSUFFICIENT_CLASSIFICATION: u64 = 102;

    /// Validate that data can be stored on-chain at the given classification.
    /// For C-3 and above, `is_hashed` MUST be true.
    /// For C-5, this function always aborts — no on-chain storage permitted.
    public fun validate_storage(
        classification: u8,
        is_hashed: bool
    ) {
        assert!(classification != C_TOP_SECRET, E_TOP_SECRET_VIOLATION);
        if (classification >= C_REGULATED) {
            assert!(is_hashed, E_PLAINTEXT_VIOLATION);
        };
    }

    /// Classification-aware sharing guard.
    /// Verifies the sharing agreement permits this classification level.
    public fun assert_sharing_permitted(
        data_classification: u8,
        agreement_max_classification: u8
    ) {
        assert!(
            data_classification <= agreement_max_classification,
            E_INSUFFICIENT_CLASSIFICATION
        );
    }
}
```

---

## 21.10.7 ISO-45: Cross-Chain Message Isolation

### 21.10.7.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-45-1 | Cross-chain messages (via Chainlink CCIP or Wormhole bridge) MUST be scoped to bilateral agreements. No broadcast messaging across organizations. | MUST |
| ISO-45-2 | Lane establishment MUST require an on-chain trust channel between the communicating organizations. | MUST |
| ISO-45-3 | Cross-chain message payloads MUST be encrypted end-to-end between the source and destination organizations. | MUST |
| ISO-45-4 | Bridge relayers MUST NOT be able to read message content (zero-knowledge of payload). | MUST |
| ISO-45-5 | CCIP lane configuration SHOULD be stored as a dynamic field of the bilateral trust channel object. | SHOULD |

### 21.10.7.2 Lane Architecture

```
Organization A                                    Organization B
┌──────────────┐                                  ┌──────────────┐
│ NATS Account │                                  │ NATS Account │
│ (isolated)   │                                  │ (isolated)   │
└──────┬───────┘                                  └──────┬───────┘
       │                                                  │
       ▼                                                  ▼
┌──────────────┐    ┌──────────────────────┐    ┌──────────────┐
│ SuiBridge    │───▶│ Trust Channel (Sui)  │◀───│ SuiBridge    │
│ Service A    │    │  - lane_config       │    │ Service B    │
└──────┬───────┘    │  - encryption_keys   │    └──────┬───────┘
       │            │  - message_counter   │           │
       │            └──────────────────────┘           │
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│  CCIP / Wormhole Bridge                                      │
│  - Encrypted payload (E2E)                                   │
│  - Relayer cannot read content                               │
│  - Lane scoped to bilateral trust channel                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 21.10.8 ISO-46: Audit Trail Anchoring Isolation

### 21.10.8.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-46-1 | Each organization MUST anchor its own EventLog Merkle roots independently. Cross-org batch anchoring is NOT RECOMMENDED. | MUST |
| ISO-46-2 | Merkle root anchoring objects MUST be address-owned by the anchoring organization. | MUST |
| ISO-46-3 | Cross-org audit verification MUST use a shared Merkle root with bilateral scope — the auditor and the audited organization. | MUST |
| ISO-46-4 | Audit anchoring intervals MUST be tiered by ISA-95 level to prevent timing analysis. | SHOULD |
| ISO-46-5 | Anchoring timestamps SHOULD include random jitter (±10% of interval) to prevent correlation. | SHOULD |

### 21.10.8.2 Tiered Anchoring Schedule

| ISA-95 Level | Anchoring Interval | Rationale |
|-------------|-------------------|-----------|
| L0–L1 (Safety/Sensor) | Hourly | Regulatory: ISA-18.2 alarm records, FDA Part 11 |
| L2 (Control) | 6-hourly | Equipment state transition audit trail |
| L3 (Operations) | Daily | Work order lifecycle, production records |
| L4 (Enterprise) | Weekly | Business-level aggregates, KPIs |
| Cross-org events | Per bilateral agreement | Shared audit anchoring per trust channel |

### 21.10.8.3 Move Pattern: Audit Anchor

```move
module tmnl::audit_anchor {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::clock::{Self, Clock};
    use sui::event;

    /// An immutable audit anchor recording a Merkle root of EventLog entries.
    struct AuditAnchor has key, store {
        id: UID,
        /// Organization that created this anchor
        org_id: vector<u8>,
        /// ISA-95 level being anchored
        isa_level: u8,
        /// Merkle root of the EventLog batch
        merkle_root: vector<u8>,
        /// Number of events in this batch
        event_count: u64,
        /// Timestamp range: start
        period_start_ms: u64,
        /// Timestamp range: end
        period_end_ms: u64,
        /// Anchor creation timestamp
        anchored_at_ms: u64,
    }

    /// Event emitted on anchoring (for SuiBridgeService sync)
    struct AuditAnchored has copy, drop {
        org_id: vector<u8>,
        isa_level: u8,
        merkle_root: vector<u8>,
        event_count: u64,
    }

    /// Create and freeze an audit anchor (immutable once created)
    public fun anchor(
        org_id: vector<u8>,
        isa_level: u8,
        merkle_root: vector<u8>,
        event_count: u64,
        period_start_ms: u64,
        period_end_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): AuditAnchor {
        let anchor = AuditAnchor {
            id: object::new(ctx),
            org_id,
            isa_level,
            merkle_root,
            event_count,
            period_start_ms,
            period_end_ms,
            anchored_at_ms: clock::timestamp_ms(clock),
        };

        event::emit(AuditAnchored {
            org_id: anchor.org_id,
            isa_level: anchor.isa_level,
            merkle_root: anchor.merkle_root,
            event_count: anchor.event_count,
        });

        anchor
    }
}
```

---

## 21.10.9 ISO-47: Object Ownership Tree Isolation

### 21.10.9.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-47-1 | ISA-95 asset hierarchies (Organization → Plant → Line → Machine → Sensor) stored as object ownership trees MUST be address-owned by the controlling organization. | MUST |
| ISO-47-2 | Dynamic object fields used for parent-child relationships MUST NOT be queryable by unauthorized organizations via Full Node APIs. | SHOULD |
| ISO-47-3 | When a machine or asset participates in a cross-org marketplace listing, only the specific capability/capacity fields SHALL be exposed via Kiosk, not the full ownership tree. | MUST |
| ISO-47-4 | iNFT dynamic fields accumulating operational intelligence MUST use the parent object's access control. Intelligence data SHALL NOT be independently queryable. | MUST |
| ISO-47-5 | Transfer of owned objects between organizations (e.g., machine sale) MUST transfer the complete subtree atomically. | MUST |

### 21.10.9.2 Isolation Architecture for ISA-95 Trees

```
Organization A (address-owned)
│
├── Plant_ATL_001 (dynamic object field)
│   ├── Line_CNC_01 (dynamic object field)
│   │   ├── Machine_Haas_VF2 [iNFT] (dynamic object field)
│   │   │   ├── intelligence: { hours: 12400, jobs: 890 } (dynamic field)
│   │   │   ├── quality: { defect_rate: 0.002 } (dynamic field)
│   │   │   └── maintenance: [ ... records ] (dynamic field)
│   │   └── Sensor_Vibration_01 (dynamic object field)
│   └── Line_LATHE_01 (dynamic object field)
│       └── ...
│
└── Plant_ATL_002 (dynamic object field)
    └── ...

VISIBILITY:
  ✓ Organization A: Full tree visible (owner)
  ✓ Organization B (with trust channel): Only marketplace-listed capabilities
  ✗ Organization C (no trust channel): Cannot see tree exists
  ✗ Full Node operator: Can see objects but cannot attribute to A without
    additional correlation (compensating control: address rotation)
```

### 21.10.9.3 Marketplace Exposure Pattern

When listing capacity on the marketplace, the organization creates a **Kiosk
listing** that exposes only the capability and availability — not the internal
asset hierarchy:

```move
module tmnl::marketplace_listing {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    /// A marketplace-visible capability listing.
    /// This object contains NO reference to the internal ISA-95 tree.
    /// The link to the actual machine is maintained off-chain in NATS.
    struct CapabilityListing has key, store {
        id: UID,
        /// Hashed organization ID (not the raw Sui address)
        org_hash: vector<u8>,
        /// Machine capability (e.g., "CNC 5-axis, aluminum, ±0.001")
        capability_description: vector<u8>,
        /// Available hours this period
        available_hours: u64,
        /// Price per hour (in MIST)
        price_per_hour_mist: u64,
        /// Certifications (ISO 9001, AS9100, etc.)
        certifications: vector<vector<u8>>,
        /// Listing expiration
        expires_at_ms: u64,
    }
}
```

---

## 21.10.10 ISO-48: Temporal Privacy

### 21.10.10.1 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| ISO-48-1 | Audit anchoring transactions SHOULD include random jitter (±10% of configured interval) to prevent timing correlation with operational events. | SHOULD |
| ISO-48-2 | Settlement transactions SHOULD NOT be submitted immediately on NATS event receipt. A configurable delay buffer (30-300 seconds) SHOULD be applied. | SHOULD |
| ISO-48-3 | Gas payment for on-chain transactions SHOULD use a pooled sponsor address, not individual organization wallets, to prevent balance correlation. | SHOULD |
| ISO-48-4 | Batch transaction submission SHOULD aggregate operations from multiple organizations into shared PTBs where bilateral isolation permits. | MAY |

### 21.10.10.2 Jitter Implementation

```typescript
import { Effect, Schedule, Duration, Random } from 'effect'

const anchorWithJitter = (
  baseInterval: Duration.Duration,
  jitterPercent: number // 0.0 to 1.0
): Schedule.Schedule<number> =>
  Schedule.spaced(baseInterval).pipe(
    Schedule.addDelay(() =>
      Effect.gen(function* () {
        const jitter = yield* Random.nextRange(
          -jitterPercent * Duration.toMillis(baseInterval),
          jitterPercent * Duration.toMillis(baseInterval)
        )
        return Duration.millis(jitter)
      })
    )
  )

// Usage: anchor L0-L1 events hourly with ±10% jitter
const l0l1Schedule = anchorWithJitter(Duration.hours(1), 0.1)
// Actual interval: 54-66 minutes (randomly distributed)
```

---

## 21.10.11 Move Access Control Patterns

### 21.10.11.1 Capability-Based Access Control

All TMNL Move modules MUST use the capability pattern for administrative
operations. Capabilities are non-transferable objects that authorize specific
actions:

```move
module tmnl::access {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    /// Admin capability — created once via One-Time Witness
    struct AdminCap has key, store {
        id: UID,
    }

    /// Organization operator capability — scoped to one org
    struct OrgOperatorCap has key {
        id: UID,
        org_id: vector<u8>,
    }

    /// Auditor capability — can verify anchors for specific org
    struct AuditorCap has key {
        id: UID,
        org_id: vector<u8>,
        valid_until_ms: u64,
    }

    /// Verify operator is authorized for this organization
    public fun assert_org_operator(
        cap: &OrgOperatorCap,
        expected_org_id: &vector<u8>
    ) {
        assert!(
            &cap.org_id == expected_org_id,
            1 // E_WRONG_ORGANIZATION
        );
    }
}
```

### 21.10.11.2 Entry Function Checklist

Every Move entry function in the TMNL package MUST perform these checks:

| # | Check | Example |
|---|-------|---------|
| 1 | Sender authorization | `bilateral_guard::assert_is_party(a, b, ctx)` |
| 2 | State precondition | `assert!(escrow.state == FUNDED, E_INVALID_STATE)` |
| 3 | Classification guard | `classification::validate_storage(level, is_hashed)` |
| 4 | Temporal guard (if applicable) | `assert!(clock::timestamp_ms(clock) < deadline, E_EXPIRED)` |
| 5 | Capability verification (if admin) | `access::assert_org_operator(cap, &org_id)` |

---

## 21.10.12 Effect-TS Integration

### 21.10.12.1 IsolationService

The SuiBridgeService `[Section 22.X]` MUST integrate an IsolationService that
enforces all ISO-42 through ISO-48 requirements at the application layer:

```typescript
import { Context, Effect, Layer, Schema } from 'effect'

class IsolationService extends Context.Tag('IsolationService')<
  IsolationService,
  {
    /** Verify organization can access a specific Sui object */
    readonly authorizeObjectAccess: (
      orgId: OrganizationId,
      objectId: SuiObjectId,
      accessType: 'read' | 'write'
    ) => Effect.Effect<boolean, IsolationError>

    /** Filter a set of objects to only those visible to requesting org */
    readonly filterByBilateralScope: (
      orgId: OrganizationId,
      objects: ReadonlyArray<SuiObject>
    ) => Effect.Effect<ReadonlyArray<SuiObject>, IsolationError>

    /** Validate data classification before on-chain submission */
    readonly validateClassification: (
      classification: DataClassification,
      isHashed: boolean
    ) => Effect.Effect<void, ClassificationViolation>

    /** Apply temporal jitter to a scheduled operation */
    readonly applyJitter: (
      baseInterval: Duration,
      jitterPercent: number
    ) => Effect.Effect<Duration, never>
  }
>() {}

// Error types
const IsolationError = Schema.TaggedStruct('IsolationError', {
  code: Schema.Literal(
    'UNAUTHORIZED_ACCESS',
    'NO_TRUST_CHANNEL',
    'CLASSIFICATION_VIOLATION',
    'QUERY_SCOPE_EXCEEDED'
  ),
  orgId: Schema.String,
  objectId: Schema.String,
  message: Schema.String,
})

const ClassificationViolation = Schema.TaggedStruct('ClassificationViolation', {
  dataClassification: Schema.Number,
  isHashed: Schema.Boolean,
  message: Schema.String,
})

type DataClassification = 0 | 1 | 2 | 3 | 4 | 5
```

---

## 21.10.13 Verification and Testing

### 21.10.13.1 Isolation Test Requirements

| ID | Test | Level |
|----|------|-------|
| IT-1 | Attempt to call bilateral entry function from unauthorized address — MUST revert | MUST |
| IT-2 | Attempt to store C-3+ data as plaintext — MUST revert | MUST |
| IT-3 | Attempt to store C-5 data on-chain — MUST revert | MUST |
| IT-4 | Verify SuiBridgeService filters objects by bilateral scope | MUST |
| IT-5 | Verify audit anchoring jitter produces non-deterministic intervals | SHOULD |
| IT-6 | Verify marketplace listing contains no ISA-95 tree references | MUST |
| IT-7 | Verify cross-chain messages are encrypted end-to-end | MUST |
| IT-8 | Verify object ownership transfer moves complete subtree | MUST |

### 21.10.13.2 Move Test Example

```move
#[test_only]
module tmnl::isolation_tests {
    use tmnl::bilateral_guard;
    use sui::test_scenario;

    #[test]
    #[expected_failure(abort_code = 1)] // E_NOT_AUTHORIZED
    fun test_unauthorized_access() {
        let mut scenario = test_scenario::begin(@0xA);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            // Party A and Party B are authorized; sender is @0xC (unauthorized)
            bilateral_guard::assert_is_party(@0xA, @0xB, ctx);
        };
        // Switch to unauthorized sender
        test_scenario::next_tx(&mut scenario, @0xC);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            bilateral_guard::assert_is_party(@0xA, @0xB, ctx);
            // MUST abort with E_NOT_AUTHORIZED
        };
        test_scenario::end(scenario);
    }
}
```

---

## 21.10.14 Six-Layer Isolation Summary

With the introduction of the blockchain settlement layer, the TMNL isolation
model extends from five layers to six:

| Layer | Technology | Isolation Mechanism | ISO Controls |
|-------|-----------|---------------------|-------------|
| 1. Messaging Namespace | NATS Accounts | Per-org account with JWT auth | TI.4 |
| 2. Event Persistence | JetStream Domains | Per-org stream domains | TI.5 |
| 3. Compute | @effect/cluster Shards | Entity affinity, resource limits | TI.6 |
| 4. Data at Rest | Encryption | Per-org encryption keys | TI.7 |
| 5. Cross-Org Sharing | Bilateral Agreements | Consent-based, schema-redacted | TI.8 |
| **6. On-Chain State** | **Sui Move** | **Bilateral guards, classification, query filtering** | **ISO-42 through ISO-48** |

**Invariant**: Each layer is independently enforceable. A breach at one layer
MUST NOT compromise isolation at another. The six-layer model provides
defense-in-depth: even if on-chain state is observable by a Full Node operator,
the application-layer controls (SuiBridgeService + IsolationService) prevent
unauthorized information flow to end users.

---

## 21.10.15 References

### Standards

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
  BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
  BCP 14, RFC 8174, May 2017.

### Sui Blockchain

- Sui Object Model: https://docs.sui.io/concepts/object-model
- Sui Object Ownership: https://docs.sui.io/concepts/object-ownership
- Sui Dynamic Fields: https://docs.sui.io/concepts/dynamic-fields
- Sui Shared Objects: https://docs.sui.io/concepts/object-ownership/shared
- Move Book — Capability Pattern: https://move-book.com/programmability/capability/

### RFC-001 Cross-References

- `rfc-section-tenant-isolation.md` — TI.3 (Five-Layer Model), TI.4-TI.8
- `rfc-section-onchain-identity.md` — Section 20.12 (Identity Objects)
- `rfc-section-settlement-layer.md` — Section 18.11 (Escrow, Settlement)
- `rfc-section-blockchain-threats.md` — Section 19.3.5 (Threat Model)
- `rfc-section-oracle-integration.md` — Section 18.12 (Oracle Architecture)
- `rfc-section-bridge-service.md` — Section 22.X (SuiBridgeService)
- `research-sui-compliance-anchoring.md` — Merkle root anchoring patterns
- `research-sui-ownership-model.md` — ISA-95 object ownership trees
- `research-rfc-sui-chainlink-audit.md` — Integration points S-6, L-4, L-5

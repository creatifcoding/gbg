# Research: Sui Blockchain for Manufacturing Marketplace Settlement

```
Document:    research-sui-marketplace-settlement.md
Status:      DRAFT
Author:      Val (marketplace-writer)
Created:     2026-02-09
Purpose:     Evaluate Sui blockchain as trustless settlement layer for
             the TMNL manufacturing commons marketplace (RFC Section M)
Sources:     DeepWiki (MystenLabs/sui), Exa web search, Sui documentation,
             Seal whitepaper coverage (Jan 2026), OVERTAKE marketplace,
             sui-foundation/sui-move-intro-course
```

---

## 1. Executive Summary

The current marketplace protocol (RFC Section M) relies on a **platform-mediated
escrow ledger** -- event-sourced, auditable, but centralized. The platform
operator controls escrow release, dispute resolution, and reputation scoring.
This creates a trust bottleneck: organizations must trust the platform to
faithfully execute settlement.

Sui blockchain offers a credible path to **trustless settlement** through:

1. **Programmable Transaction Blocks (PTBs)** -- atomic multi-step settlements
2. **Object-centric model** -- capabilities and certifications as on-chain objects
3. **Seal framework** -- programmable encryption for private work order details
4. **Sub-second finality** -- 0.5s for owned objects, suitable for manufacturing SLAs
5. **200K+ TPS** -- throughput sufficient for metropolitan-scale marketplace

This document evaluates each dimension and proposes a hybrid architecture where
**operational events flow through NATS** (real-time, high-throughput) while
**financial settlement and trust anchoring occur on Sui** (trustless, auditable,
permanent).

---

## 2. Sui Architecture Primer (Manufacturing Context)

### 2.1 Object Model

Sui's fundamental unit is the **object**, not the account balance. Every asset --
coins, NFTs, capabilities, certifications -- is a distinct object with a unique ID.
This maps naturally to manufacturing entities:

| Manufacturing Concept | Sui Object Type | Ownership |
|-----------------------|-----------------|-----------|
| Organization identity | `OrgIdentity` (shared) | Organization address |
| Capability attestation | `CapabilityNFT` (soulbound) | Organization address |
| Work order escrow | `EscrowVault` (shared) | Smart contract |
| Reputation score | `TrustScore` (shared) | Organization address |
| Settlement receipt | `SettlementReceipt` (owned) | Recipient address |

### 2.2 Consensus Model

Sui uses **Mysticeti**, a DAG-based Byzantine fault-tolerant consensus protocol:

| Property | Value | Manufacturing Implication |
|----------|-------|--------------------------|
| Owned object finality | < 0.5 seconds | Settlement receipts confirmed instantly |
| Shared object finality | 2-3 seconds | Escrow state changes within SLA bounds |
| Throughput | 200,000+ TPS sustained | 200K-org network easily served |
| Commit rounds | 3 (theoretical minimum) | Minimal latency overhead |

**Key insight**: Owned objects bypass consensus entirely. Settlement receipts,
once created, are owned objects -- the recipient gets sub-second confirmation
that funds were released.

### 2.3 Gas Economics

Sui's fee model combines computation and storage:

- **Computation**: 1,000 - 5,000,000 units per transaction bucket
- **Storage**: 100 units per byte, with 99% refundable on deletion
- **Reference gas price**: Set per epoch by validators

For marketplace settlement, a typical escrow-fund-release PTB would fall in the
low computation bucket (~1,000-5,000 units). At current SUI prices, this means
sub-cent transaction costs -- negligible compared to the $100+ minimum order
threshold defined in M.7.2.

---

## 3. Escrow on Sui: Move Smart Contracts

### 3.1 PTB-Based Atomic Settlement

Programmable Transaction Blocks (PTBs) enable **atomic multi-step settlements**
in a single transaction. Up to 1,024 commands can be composed, with outputs from
one command flowing as inputs to the next. If any step fails, the entire
transaction reverts.

**Manufacturing escrow PTB** (happy path):

```
PTB: WorkOrderSettlement
  1. verify_qc_passed(work_order_id)           -- Check QC attestation exists
  2. verify_receiver_confirmed(work_order_id)   -- Check receiver confirmation
  3. calculate_fee(escrow_amount, fee_tier)      -- Compute network fee
  4. split_coins(escrow_vault, [fulfiller_amount, fee_amount])
  5. transfer_objects([fulfiller_payment], fulfiller_address)
  6. transfer_objects([fee_payment], network_treasury)
  7. emit_settlement_event(work_order_id, amounts)
  8. update_reputation(fulfiller_id, +2)         -- G-10 score increment
  9. update_reputation(requester_id, +1)         -- Requester reliability
```

All 9 steps execute atomically. The fulfiller receives payment, the network
collects its fee, and both reputation scores update -- or nothing happens at all.
No partial settlements. No race conditions.

### 3.2 Escrow Vault Design (Move)

```move
module tmnl::marketplace_escrow {
    use sui::object::{Self, UID};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};

    /// Escrow vault for a marketplace work order.
    /// Shared object -- both parties and the contract can interact.
    struct EscrowVault has key {
        id: UID,
        work_order_id: vector<u8>,
        requester: address,
        fulfiller: address,
        amount: Balance<SUI>,
        funded_at: u64,
        status: u8,            // 0=Created, 1=Funded, 2=Released, 3=Frozen, 4=Refunded
        deadline: u64,         // Unix timestamp -- auto-refund if exceeded
    }

    /// AdminCap for platform operations (dispute resolution)
    struct PlatformCap has key {
        id: UID,
    }

    /// Fund escrow -- requester deposits SUI
    public entry fun fund_escrow(
        vault: &mut EscrowVault,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(vault.status == 0, 0); // Must be Created
        assert!(tx_context::sender(ctx) == vault.requester, 1);
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut vault.amount, payment_balance);
        vault.funded_at = clock::timestamp_ms(clock);
        vault.status = 1; // Funded
    }

    /// Release escrow -- triggered after QC pass + receiver confirmation
    public entry fun release_escrow(
        vault: &mut EscrowVault,
        qc_attestation: &QCAttestation,      // Proof of QC pass
        receiver_confirm: &ReceiverConfirm,   // Proof of delivery acceptance
        fee_bps: u64,                          // Fee in basis points
        ctx: &mut TxContext
    ) {
        assert!(vault.status == 1, 0); // Must be Funded
        assert!(qc_attestation.work_order_id == vault.work_order_id, 2);
        assert!(receiver_confirm.work_order_id == vault.work_order_id, 3);

        let total = balance::value(&vault.amount);
        let fee = total * fee_bps / 10000;
        let fulfiller_amount = total - fee;

        // Split and transfer
        let fulfiller_coin = coin::take(&mut vault.amount, fulfiller_amount, ctx);
        transfer::public_transfer(fulfiller_coin, vault.fulfiller);

        let fee_coin = coin::take(&mut vault.amount, fee, ctx);
        transfer::public_transfer(fee_coin, @network_treasury);

        vault.status = 2; // Released
    }

    /// Freeze escrow -- platform or either party during dispute
    public entry fun freeze_escrow(
        _cap: &PlatformCap,
        vault: &mut EscrowVault,
    ) {
        assert!(vault.status == 1, 0);
        vault.status = 3; // Frozen
    }

    /// Auto-refund if deadline exceeded (permissionless)
    public entry fun deadline_refund(
        vault: &mut EscrowVault,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(vault.status == 1 || vault.status == 3, 0);
        assert!(clock::timestamp_ms(clock) > vault.deadline, 4);

        let refund = coin::take(
            &mut vault.amount,
            balance::value(&vault.amount),
            ctx
        );
        transfer::public_transfer(refund, vault.requester);
        vault.status = 4; // Refunded
    }
}
```

### 3.3 USDC Settlement Option

While the example uses native SUI, production deployment would likely use
**USDC on Sui** for price stability. Sui supports USDC natively via the Wormhole
bridge. The Move contract generalizes to `Coin<USDC>` with identical logic.

**Recommendation**: Support both SUI and USDC. Small transactions ($100-$500)
in SUI for simplicity. Larger transactions ($500+) in USDC for price stability.

---

## 4. Capability NFTs: On-Chain Attestations

### 4.1 Soulbound Capability Model

Manufacturing capabilities (AS9100 certified, 5-axis CNC, titanium machining)
map to **soulbound NFTs** on Sui -- objects with `key` ability but without
`store`, making them non-transferable.

```move
module tmnl::capability_attestation {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;

    /// Soulbound capability attestation.
    /// Cannot be transferred (no 'store' ability).
    struct CapabilityNFT has key {
        id: UID,
        org_id: vector<u8>,           // TMNL organization ID
        capability: vector<u8>,        // e.g., "5-axis-cnc"
        standard: vector<u8>,         // e.g., "AS9100-Rev-D"
        auditor: address,             // Address of certifying auditor
        issued_at: u64,               // Timestamp
        expires_at: u64,              // Annual renewal required
        evidence_hash: vector<u8>,    // IPFS/Walrus hash of audit report
    }

    /// Only authorized auditors can mint capability NFTs.
    struct AuditorCap has key {
        id: UID,
        auditor_name: vector<u8>,
        authorized_standards: vector<vector<u8>>,
    }

    /// Mint a capability attestation (auditor only)
    public entry fun mint_capability(
        auditor_cap: &AuditorCap,
        org_address: address,
        org_id: vector<u8>,
        capability: vector<u8>,
        standard: vector<u8>,
        expires_at: u64,
        evidence_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify sender holds the AuditorCap
        assert!(tx_context::sender(ctx) == /* auditor address check */, 0);

        let nft = CapabilityNFT {
            id: object::new(ctx),
            org_id,
            capability,
            standard,
            auditor: tx_context::sender(ctx),
            issued_at: 0, // Would use Clock
            expires_at,
            evidence_hash,
        };

        // Transfer to org -- soulbound, cannot be re-transferred
        transfer::transfer(nft, org_address);
    }
}
```

### 4.2 Verification Without Platform Trust

Current marketplace protocol (M.4.4) defines four verification levels. On Sui,
verification becomes **trustless**:

| Current Model (M.4.4) | Sui Model | Trust Improvement |
|------------------------|-----------|-------------------|
| Self-declared (0.3x) | Self-declared (no on-chain proof) | Same -- no trust gain |
| Peer-attested (0.6x) | On-chain transaction attestation | Verifiable: anyone can check |
| Third-party audited (1.0x) | Soulbound NFT from auditor | Cryptographically verifiable |
| Platform-verified (1.0x) | Platform-minted NFT | Transparent, auditable |

**Buyers can verify capabilities directly on-chain** without trusting the
platform's database. An AS9100 certification is either a valid soulbound NFT
owned by the organization, or it isn't. No API call needed. No platform
intermediary.

### 4.3 Expiration and Renewal

Capability NFTs include an `expires_at` field. The marketplace search contract
checks expiration before ranking results. Expired capabilities are flagged but
not deleted (audit trail). Renewal requires a new `mint_capability` call from
the auditor, creating a fresh NFT with an updated expiration.

---

## 5. Reputation as On-Chain State

### 5.1 G-10 Trust Score as Sui Object

The G-10 Trust Score (M.8.1) currently lives in NATS KV as a CRDT counter. On
Sui, it becomes a **shared object** with transparent, verifiable state:

```move
module tmnl::reputation {
    use sui::object::{Self, UID};

    /// G-10 Trust Score -- shared object, updated by verified transactions
    struct TrustScore has key {
        id: UID,
        org_id: vector<u8>,
        score: u64,                    // 0-100, scaled by 100 for precision
        successful_completions: u64,
        disputes_lost: u64,
        sla_breaches: u64,
        verification_bonus: u64,
        tenure_months: u64,
        last_updated: u64,
    }

    /// Update score after successful marketplace completion
    public entry fun record_completion(
        trust: &mut TrustScore,
        settlement_receipt: &SettlementReceipt,
        /* ... */
    ) {
        assert!(settlement_receipt.org_id == trust.org_id, 0);
        trust.successful_completions = trust.successful_completions + 1;
        recompute_score(trust);
    }

    /// Score computation matches M.8.1 formula
    fun recompute_score(trust: &mut TrustScore) {
        let base: u64 = 3000; // 30.00 scaled
        let completions = trust.successful_completions * 200;
        let disputes = trust.disputes_lost * 500;
        let breaches = trust.sla_breaches * 300;
        let verification = trust.verification_bonus;
        let tenure = if (trust.tenure_months / 6 > 10) { 1000 } else { (trust.tenure_months / 6) * 100 };

        let raw = base + completions + verification + tenure;
        let penalties = disputes + breaches;
        let final_score = if (raw > penalties) { raw - penalties } else { 0 };
        trust.score = if (final_score > 10000) { 10000 } else { final_score };
    }
}
```

### 5.2 Advantages Over Platform-Controlled Reputation

| Dimension | Platform-Mediated (Current M.8) | On-Chain (Sui) |
|-----------|--------------------------------|----------------|
| Transparency | Platform publishes scores; must trust accuracy | Anyone can verify score computation on-chain |
| Manipulation | Platform operator could inflate/deflate scores | Score changes require verified settlement receipts |
| Portability | Locked to TMNL platform | Organization owns their TrustScore object |
| Audit trail | Event-sourced in NATS (platform-controlled) | Immutable transaction history on Sui |
| Sybil resistance | Platform-enforced tiers (M.8.3) | On-chain tier thresholds, soulbound capabilities |

### 5.3 Peer Validation as On-Chain Transactions

After each successful marketplace completion, both parties can submit
**peer validation transactions**:

1. `RecordCompletion` -- automatic, triggered by settlement PTB
2. `SubmitRating` -- optional, requester rates fulfiller quality (1-5)
3. `AttestCapability` -- optional, requester confirms fulfiller capability

Each is a Sui transaction with an immutable record. Ratings aggregate into the
G-10 score via the `recompute_score` function.

---

## 6. Work Order Lifecycle: What Goes On-Chain?

### 6.1 Hybrid On-Chain / Off-Chain Model

Not every state transition needs to be on-chain. The decision criterion is:
**does this transition involve value transfer or trust commitment?**

| State Transition | On-Chain? | Rationale |
|------------------|-----------|-----------|
| `RfqPosted` | No | High volume, no financial commitment. NATS only. |
| `QuoteSubmitted` | No | Discovery phase. NATS + optional hash anchor. |
| `QuoteAccepted` | **Yes** | Binding commitment. Creates EscrowVault. |
| `EscrowFunded` | **Yes** | Value locked. Coin transferred to vault. |
| `WorkStarted` | No | Operational. NATS event. |
| `QcCompleted` | **Yes** (attestation) | QCAttestation object created on-chain. |
| `Shipped` | No | Logistics. NATS event. Optional hash anchor. |
| `ReceiverConfirmed` | **Yes** | ReceiverConfirm object triggers settlement. |
| `Settled` | **Yes** | PTB executes atomic settlement. |
| `Disputed` | **Yes** | Escrow frozen on-chain. |
| `DisputeResolved` | **Yes** | Arbitration allocation executed on-chain. |

**Result**: 7 of 11 transitions go on-chain. The high-frequency discovery phase
(RFQ, quotes, work progress) stays in NATS for speed. Financial and trust
commitments anchor to Sui for verifiability.

### 6.2 Hash Anchoring for Off-Chain Events

For off-chain transitions (RFQ, quotes, work progress), the platform MAY
publish **hash anchors** to Sui at regular intervals:

```
AnchorEvent {
    batch_hash: SHA-256(event_1 || event_2 || ... || event_n)
    event_count: u64
    time_range: (start_ts, end_ts)
    nats_stream: "commons.marketplace.*"
}
```

This creates a tamper-evident link between the NATS event stream and the Sui
ledger without putting every event on-chain. If a dispute arises about the
discovery phase, the hash anchor proves the NATS events haven't been modified.

---

## 7. Dynamic Pricing Oracles: NATS to Sui

### 7.1 Capacity Signal Oracle

The marketplace derives pricing from real-time capacity signals (M.5, M.7.1).
These signals originate in NATS (`commons.capacity.{orgId}`) and need to reach
on-chain pricing contracts.

**Architecture**:

```
NATS (real-time)                  Oracle Service              Sui (on-chain)
─────────────────                 ──────────────              ─────────────
commons.capacity.*  ────────►     Aggregate + Sign  ────────► CapacityOracle
                                  (runs in TEE via             (shared object)
                                   Nautilus)
                                                              PricingEngine
                                                              reads oracle
                                                              to compute
                                                              suggested ranges
```

### 7.2 Oracle Design

```move
module tmnl::capacity_oracle {
    use sui::object::{Self, UID};

    /// On-chain capacity snapshot, updated by oracle service
    struct CapacityOracle has key {
        id: UID,
        total_idle_machines: u64,
        total_machines: u64,
        utilization_bps: u64,        // Basis points (0-10000)
        region: vector<u8>,           // e.g., "atlanta-metro"
        updated_at: u64,
        oracle_address: address,      // Only this address can update
    }

    /// Authorized oracle updates capacity snapshot
    public entry fun update_capacity(
        oracle: &mut CapacityOracle,
        total_idle: u64,
        total: u64,
        timestamp: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == oracle.oracle_address, 0);
        oracle.total_idle_machines = total_idle;
        oracle.total_machines = total;
        oracle.utilization_bps = ((total - total_idle) * 10000) / total;
        oracle.updated_at = timestamp;
    }
}
```

### 7.3 Oracle Trust via Nautilus TEE

Sui's **Nautilus** framework enables the oracle service to run in a Trusted
Execution Environment (TEE). The TEE:

1. Subscribes to NATS capacity subjects
2. Aggregates signals across organizations
3. Signs the update with an ephemeral key registered on-chain
4. Submits the signed update to the CapacityOracle contract

The on-chain contract verifies the TEE's Platform Configuration Registers (PCRs)
and ephemeral public key before accepting the update. This ensures the oracle
data hasn't been tampered with, even by the platform operator.

### 7.4 Oracle Frameworks on Sui

| Framework | Status | Use Case |
|-----------|--------|----------|
| **Pyth Network** | Live on Sui | Financial price feeds (SUI/USD, USDC rates) |
| **Switchboard** | Live on Sui | General-purpose oracle (custom feeds) |
| **Nautilus (native)** | Production (2026) | TEE-verified off-chain compute |
| **Custom oracle** | Recommended | Manufacturing-specific capacity signals |

**Recommendation**: Use Pyth for financial price feeds (SUI/USD conversion).
Build a custom Nautilus-based oracle for manufacturing capacity signals. The
custom oracle aggregates NATS streams and publishes to a shared Sui object.

---

## 8. Privacy: Encrypted Work Orders on Sui

### 8.1 The Privacy Challenge

Organizations do not want competitors seeing:
- What parts they're ordering (reveals product roadmap)
- Who they're buying from (reveals supply chain)
- How much they're paying (reveals margins)
- Their production capacity (reveals business health)

But settlement MUST be verifiable for trust. The challenge: **encrypt the
details, verify the settlement**.

### 8.2 Seal Framework (Deployed January 2026)

Sui's **Seal framework** provides programmable encryption at the protocol level:

| Feature | Description | Manufacturing Use |
|---------|-------------|-------------------|
| **Threshold encryption** | Data encrypted to N-of-M key holders | Work order details encrypted to buyer + seller + arbitrator (2-of-3) |
| **On-chain access policies** | Move smart contracts define who can decrypt | Only parties to the work order can see details |
| **Separation of signing and decryption** | Different keys for transaction auth vs data access | Auditors can verify settlement without seeing order details |
| **Programmable secrets** | Encryption policies encoded in Move | Time-locked disclosure for regulatory audit |

### 8.3 Privacy Architecture for Work Orders

```
Layer 1: Public (on-chain, visible to all)
  - EscrowVault: amount, status, timestamps
  - SettlementReceipt: amount, parties (addresses), timestamp
  - TrustScore: aggregate score

Layer 2: Encrypted (on-chain, access-controlled via Seal)
  - WorkOrderDetails: part specs, quantities, tolerances
  - QCReport: measurements, pass/fail criteria, evidence
  - PricingTerms: unit price, discount, payment schedule

Layer 3: Off-chain (NATS, organization-scoped)
  - Production progress events
  - Machine assignments
  - Internal WO state
```

### 8.4 Selective Disclosure for Compliance

Manufacturing often requires regulatory disclosure (FDA CFR 11, AS9100 audit).
Seal enables **time-locked selective disclosure**:

1. Work order details are encrypted with a Seal policy
2. The policy includes a `regulatory_audit` condition
3. When an auditor presents valid credentials (another soulbound NFT), the
   policy allows decryption of specific fields
4. The audit access is logged on-chain (who accessed what, when)

This satisfies the RFC's regulatory requirements ([FDA-CFR11] citation in M.7.2)
while keeping details private from competitors.

### 8.5 Zero-Knowledge Proofs on Sui

Sui supports **Groth16 zkSNARKs** natively (used in zkLogin). For the
marketplace, ZK proofs enable:

- **Proof of capability without disclosure**: "I have AS9100 certification"
  without revealing the auditor or expiration date
- **Proof of capacity without disclosure**: "I have idle 5-axis machines"
  without revealing how many or which ones
- **Proof of reputation threshold**: "My G-10 score is above 60" without
  revealing the exact score

These are not yet production-ready for complex manufacturing claims, but the
infrastructure exists. As ZK tooling matures on Sui (2026-2027), these proofs
become viable for privacy-preserving marketplace participation.

---

## 9. Real-World References and Precedents

### 9.1 Sui Marketplace dApps

| Project | Type | Relevance |
|---------|------|-----------|
| **OVERTAKE** | Gaming marketplace on Sui | On-chain escrow, $63K in trades during closed beta (May 2025). Demonstrates escrow + fee collection pattern. |
| **sui-foundation/sui-move-intro-course** | Reference marketplace | Canonical Move marketplace with `Bag`-based listings, typed payments, concurrent sellers. |
| **jhuhnke/sui-escrow** | Escrow reference implementation | Production-quality escrow in Move. Token-agnostic, deadline-based refund, two-party swap pattern. |
| **Cetus Zone** | DeFi AMM on Sui | Demonstrates PTB composability for multi-step swaps. Relevant for fee splitting pattern. |
| **DeepBook** | On-chain order book | Sui's native CLOB. Demonstrates shared object performance at high throughput. |

### 9.2 Supply Chain on Blockchain

| Project | Chain | Relevance |
|---------|-------|-----------|
| **VeChain** | VeChainThor | Supply chain provenance. Demonstrates NFT-as-certificate pattern at scale. |
| **IBM Food Trust** | Hyperledger | Enterprise supply chain. Demonstrates permissioned-on-public-chain hybrid. |
| **Springer: Blockchain-based IoT cargo security (2025)** | Research | Academic validation of blockchain + IoT for supply chain transparency. |

### 9.3 Manufacturing-Specific Blockchain

No major manufacturing marketplace has deployed on Sui specifically. This
represents a **first-mover opportunity**. The closest analogues are:

- **Xometry** (centralized MaaS platform) -- no blockchain settlement
- **MFG.com** (centralized job board) -- no trustless escrow
- **Syncfab** (attempted manufacturing blockchain on Ethereum) -- abandoned due
  to gas costs and throughput limitations

Sui's sub-cent transaction costs and 200K TPS eliminate the barriers that
stopped previous manufacturing blockchain attempts.

---

## 10. Proposed Hybrid Architecture

### 10.1 NATS + Sui Integration Model

```
                    TMNL Manufacturing Commons
                    ========================

    NATS Layer (Real-Time)              Sui Layer (Settlement)
    ─────────────────────               ─────────────────────
    Equipment state events              EscrowVault objects
    Capacity signals                    CapabilityNFT (soulbound)
    RFQ discovery                       TrustScore objects
    Quote negotiation                   SettlementReceipt
    Production progress                 CapacityOracle
    Internal WO state                   Hash anchors
    Alarm/quality events                DisputeResolution

    Speed: < 10ms                       Finality: 0.5-3s
    Throughput: millions/sec            Throughput: 200K TPS
    Privacy: NATS account isolation     Privacy: Seal encryption
    Trust: platform-mediated            Trust: cryptographic/trustless
```

### 10.2 Settlement Flow

```
1. Discovery (NATS only)
   Requester posts RFQ → NATS commons.marketplace.rfq.*
   Bidders submit quotes → NATS commons.marketplace.quote.*
   Platform indexes and ranks

2. Commitment (NATS + Sui)
   Requester accepts quote → NATS event + Sui PTB
   PTB creates EscrowVault → Sui shared object
   Requester funds vault → Sui coin transfer

3. Execution (NATS only)
   Fulfiller starts work → NATS commons.marketplace.progress.*
   Production events → NATS internal streams
   Platform publishes hash anchors to Sui (periodic)

4. Verification (NATS + Sui)
   QC completed → NATS event + Sui QCAttestation object
   Parts shipped → NATS event
   Receiver confirms → NATS event + Sui ReceiverConfirm object

5. Settlement (Sui only)
   PTB executes atomic settlement:
     - Verify QCAttestation + ReceiverConfirm
     - Split escrow: fulfiller payment + network fee
     - Update both TrustScore objects
     - Emit SettlementReceipt (owned by fulfiller)
   All atomic. All trustless.
```

### 10.3 Gradual Adoption Path

The hybrid model enables **incremental blockchain adoption** -- consistent with
the Strangler Fig pattern defined in MIG.3:

| Phase | Timeline | Scope |
|-------|----------|-------|
| **Phase 0: Shadow** | Months 1-3 | Sui records hash anchors of NATS events. No financial settlement on-chain. Parallel operation. |
| **Phase 1: Escrow** | Months 3-6 | Opt-in on-chain escrow for willing participants. Platform escrow remains as fallback. |
| **Phase 2: Reputation** | Months 6-9 | G-10 Trust Score migrated to Sui. Capability NFTs minted by auditors. |
| **Phase 3: Full Settlement** | Months 9-12 | All marketplace settlements through Sui PTBs. NATS handles operational events only. |
| **Phase 4: Decentralized Governance** | Year 2+ | Network fee structure, dispute arbitration, and oracle management governed by DAO. |

---

## 11. Risk Analysis

### 11.1 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sui network downtime | High | NATS continues operating; settlement queued for when Sui recovers |
| Gas price spikes | Medium | USDC settlement absorbs; storage rebate model limits exposure |
| Smart contract bugs | Critical | Formal verification of Move contracts; upgrade via `UpgradeCap` |
| Oracle manipulation | High | Nautilus TEE attestation; multi-oracle consensus |
| Key management | High | Organization key custody; multisig for high-value escrow |

### 11.2 Business Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Manufacturer blockchain aversion | High | Phase 0 shadow mode -- no behavior change required initially |
| Regulatory uncertainty | Medium | Seal enables compliance; settlement receipts satisfy audit requirements |
| SUI token volatility | Medium | USDC settlement; SUI only for gas |
| Competitor adoption | Low | First-mover advantage; no competing manufacturing marketplace on Sui |

### 11.3 What Sui Does NOT Solve

- **Real-time event streaming**: NATS remains essential for sub-10ms operational events
- **Equipment state management**: Entity lifecycle stays in Effect-TS + NATS KV
- **Machine-level control**: ISA-95 L0-L2 automation untouched by blockchain
- **High-frequency data**: Sensor readings (1000/sec/machine) never touch chain

Sui is the **settlement and trust layer**, not the operational layer. The two
systems are complementary, not competing.

---

## 12. Open Questions

1. **USDC liquidity on Sui**: Is there sufficient USDC liquidity on Sui for
   manufacturing-scale settlement ($10M+/month across the network)?

2. **Regulatory classification**: Are on-chain work order settlements treated as
   securities, payment transactions, or commodity trades? Jurisdiction matters.

3. **Key custody for small manufacturers**: Earl's 2-person shop needs simple
   key management. Hardware wallet? Custodial with platform? zkLogin with
   existing Google account?

4. **Cross-chain settlement**: If a partner network runs on a different chain,
   how do cross-chain settlements work? Wormhole bridge?

5. **Dispute arbitration decentralization**: Should dispute resolution move to
   a DAO model, or does manufacturing require human expert arbitrators?

6. **Move contract upgradeability**: How do we upgrade escrow contracts without
   disrupting active escrows? Sui's `UpgradeCap` model needs evaluation.

---

## 13. Recommendations

### 13.1 Immediate Actions (Pre-RFC Finalization)

1. **Add Section M.12: Blockchain Settlement Layer** to the RFC as an optional
   extension, describing the Sui integration as a progressive enhancement
2. **Define the on-chain/off-chain boundary** using the table in Section 6.1
3. **Specify the Seal privacy model** for work order encryption (Section 8.3)

### 13.2 Implementation Priorities

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Move escrow contract (Section 3.2) | 2 weeks |
| P0 | PTB settlement flow (Section 3.1) | 1 week |
| P1 | Capability NFT minting (Section 4.1) | 1 week |
| P1 | TrustScore on-chain migration (Section 5.1) | 2 weeks |
| P2 | Capacity oracle via Nautilus (Section 7) | 3 weeks |
| P2 | Seal integration for work order privacy (Section 8) | 3 weeks |
| P3 | ZK proofs for privacy-preserving search (Section 8.5) | Research phase |

### 13.3 Why Sui Over Alternatives

| Chain | Verdict | Reason |
|-------|---------|--------|
| **Ethereum L1** | Reject | $5-50 per tx. Manufacturing margins cannot absorb. |
| **Ethereum L2 (Arbitrum/Base)** | Possible | Lower fees but no object model, no native Seal/PTB. |
| **Solana** | Possible | High TPS but account model less natural for manufacturing assets. |
| **Sui** | Recommended | Object model maps to manufacturing entities. PTBs enable atomic settlement. Seal provides enterprise privacy. Sub-cent costs. 200K TPS. |
| **Hyperledger** | Reject | Permissioned -- defeats trustless purpose. |

---

## 14. Bibliography

- [SUI-OBJECT] Sui Object Model, MystenLabs/sui documentation
- [SUI-PTB] Programmable Transaction Blocks, Sui Developer Guides
- [SUI-MYSTICETI] Mysticeti consensus protocol, MystenLabs
- [SUI-SEAL] Seal Framework Whitepaper, Sui Network (January 2026)
- [SUI-NAUTILUS] Nautilus: Verifiable Off-chain Compute, MystenLabs
- [SUI-ZKLOGIN] zkLogin: ZK-based Authentication, Sui Documentation
- [OVERTAKE] OVERTAKE Marketplace on Sui, blog.sui.io (August 2025)
- [SUI-ESCROW] Secure Escrow Contracts on Sui, jhuhnke (April 2025)
- [PYTH-SUI] Pyth Network Oracle on Sui
- [MOVE-LANG] Move Programming Language, sui.io/move
- [RFC2119] RFC 2119: Key Words for Use in RFCs, IETF
- [CRDT-SHAPIRO] Shapiro et al., CRDTs: Consistency without consensus
- [FDA-CFR11] 21 CFR Part 11, Electronic Records
- [FOWLER-POEAA] Fowler, Patterns of Enterprise Application Architecture

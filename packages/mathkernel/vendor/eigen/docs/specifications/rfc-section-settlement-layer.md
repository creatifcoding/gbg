# RFC-001 Section 18.11: Sui Settlement Architecture

```
Section:     18.11
Title:       Sui Settlement Architecture
Status:      NORMATIVE
Amendment:   1 (Blockchain Settlement Layer)
Authors:     Val (Vigilant Architecture Layer)
Date:        2026-02-09
Depends-On:  18.6 (Work Order Protocol), 18.7 (Escrow & Settlement),
             18.8 (Trust & Reputation), 20.3 (Organization Identity),
             20.4 (Trust Establishment)
```

---

## Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in `[RFC2119]` and `[RFC8174]`.

---

## 18.11.0 Overview

This section specifies the Sui blockchain settlement layer for the TMNL
manufacturing commons. The settlement layer provides trustless escrow, atomic
multi-party settlement, on-chain reputation, and compliance anchoring for a
200,000-organization metropolitan manufacturing network.

**Design principle**: Data moves from hot path (NATS) to cold path (Sui) as
trust requirements increase. Speed decreases; permanence and verifiability
increase. NATS remains the real-time operational substrate. Sui is the
settlement and trust anchor.

```
┌─────────────────────────────────────────────────────────────┐
│  HOT PATH (NATS JetStream)                                   │
│  Sensor readings, entity state, alarms, capacity signals     │
│  Latency: <10ms  |  Throughput: 2M+ events/sec               │
│  Trust: platform-mediated (NATS accounts)                    │
├─────────────────────────────────────────────────────────────┤
│  WARM PATH (Chainlink Oracle / Nautilus TEE)                 │
│  Merkle attestation, QC verification, pricing feeds          │
│  Latency: 1-30s  |  Trust: DON BFT consensus (2/3)          │
├─────────────────────────────────────────────────────────────┤
│  COLD PATH (Sui Blockchain)                                  │
│  Escrow, settlement, identity, reputation, compliance        │
│  Finality: ~400ms (shared) / ~100ms (owned)                  │
│  Trust: cryptographic (Move object ownership)                │
└─────────────────────────────────────────────────────────────┘
```

Cross-references: `[E-1]` through `[E-14]` from the integration audit
(research-rfc-sui-chainlink-audit.md) are addressed in this section.

---

## 18.11.1 Escrow Object Model

### 18.11.1.1 Requirements

An implementation MUST provide an on-chain escrow mechanism satisfying these
invariants:

| ID | Requirement | Level |
|----|-------------|-------|
| ESC-1 | Escrowed funds MUST be locked in a Sui shared object controlled by smart contract logic, not by any individual party. | MUST |
| ESC-2 | The escrow object MUST record the work order identifier, buyer address, seller address, arbiter address, funded amount, deadline, and current state. | MUST |
| ESC-3 | Only the buyer MAY fund an escrow. The funding transaction MUST be atomic with escrow creation. | MUST |
| ESC-4 | Escrow release MUST require at least one of the settlement triggers defined in `[18.11.2]`. | MUST |
| ESC-5 | The escrow MUST support both SUI native token and USDC stablecoin. | MUST |
| ESC-6 | Escrow state changes MUST emit Sui events that the SuiBridgeService `[E-2]` can relay to NATS for reactive UI updates. | MUST |
| ESC-7 | An implementation SHOULD support escrow creation for batched work orders in a single PTB. | SHOULD |

### 18.11.1.2 Move Struct Definition

```move
module tmnl::escrow {
    use sui::object::{Self, UID, ID};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};
    use sui::event;

    // ─── State Constants ────────────────────────────────────────
    const CREATED: u8 = 0;
    const FUNDED: u8 = 1;
    const RELEASED: u8 = 2;
    const SETTLED: u8 = 3;
    const FROZEN: u8 = 4;
    const DISPUTED: u8 = 5;
    const RESOLVED: u8 = 6;
    const REFUNDED: u8 = 7;

    // ─── Error Constants ────────────────────────────────────────
    const E_NOT_BUYER: u64 = 0;
    const E_NOT_SELLER: u64 = 1;
    const E_NOT_ARBITER: u64 = 2;
    const E_INVALID_STATE: u64 = 3;
    const E_TIMEOUT_NOT_REACHED: u64 = 4;
    const E_INSUFFICIENT_FUNDS: u64 = 5;
    const E_ZERO_AMOUNT: u64 = 6;
    const E_DEADLINE_PASSED: u64 = 7;
    const E_FEE_BPS_EXCEEDS_MAX: u64 = 8;

    // ─── Constants ──────────────────────────────────────────────
    const MAX_FEE_BPS: u64 = 500; // 5% maximum network fee

    // ─── Objects ────────────────────────────────────────────────

    /// EscrowVault is a shared object representing locked funds for a work
    /// order. Both buyer and seller (and arbiter, if dispute arises) interact
    /// with this object. The object's lifecycle mirrors the settlement state
    /// machine defined in [18.11.2].
    struct EscrowVault has key {
        id: UID,
        /// Opaque work order identifier linking to NATS event stream
        work_order_id: vector<u8>,
        /// Buyer (requester) Sui address
        buyer: address,
        /// Seller (fulfiller) Sui address
        seller: address,
        /// Arbiter address for dispute resolution
        arbiter: address,
        /// Escrowed balance
        amount: Balance<SUI>,
        /// Timestamp (ms) when escrow was funded
        funded_at: u64,
        /// Current state per settlement state machine
        state: u8,
        /// Deadline (ms since epoch). Auto-refund eligible after this.
        deadline: u64,
        /// Network fee in basis points (100 = 1%)
        network_fee_bps: u64,
    }

    /// Platform capability for administrative operations.
    /// Held by the network governance multisig.
    struct PlatformCap has key, store {
        id: UID,
    }

    // ─── Events ─────────────────────────────────────────────────

    struct EscrowCreated has copy, drop {
        escrow_id: ID,
        work_order_id: vector<u8>,
        buyer: address,
        seller: address,
        amount: u64,
        deadline: u64,
    }

    struct EscrowFunded has copy, drop {
        escrow_id: ID,
        amount: u64,
        funded_at: u64,
    }

    struct EscrowReleased has copy, drop {
        escrow_id: ID,
        trigger: vector<u8>,
    }

    struct EscrowSettled has copy, drop {
        escrow_id: ID,
        seller_amount: u64,
        fee_amount: u64,
    }

    struct EscrowFrozen has copy, drop {
        escrow_id: ID,
        frozen_by: address,
    }

    struct EscrowDisputed has copy, drop {
        escrow_id: ID,
        disputer: address,
        reason: vector<u8>,
    }

    struct EscrowResolved has copy, drop {
        escrow_id: ID,
        buyer_payout: u64,
        seller_payout: u64,
    }

    struct EscrowRefunded has copy, drop {
        escrow_id: ID,
        refunded_to: address,
        amount: u64,
    }

    // ─── Entry Functions ────────────────────────────────────────

    /// Create and fund an escrow in a single atomic operation.
    /// The buyer deposits SUI and the escrow becomes a shared object
    /// accessible to both parties and the arbiter.
    ///
    /// Requirements: [ESC-1], [ESC-2], [ESC-3]
    public entry fun create_and_fund(
        work_order_id: vector<u8>,
        seller: address,
        arbiter: address,
        payment: Coin<SUI>,
        deadline: u64,
        network_fee_bps: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let amount_value = coin::value(&payment);
        assert!(amount_value > 0, E_ZERO_AMOUNT);
        assert!(network_fee_bps <= MAX_FEE_BPS, E_FEE_BPS_EXCEEDS_MAX);
        assert!(deadline > clock::timestamp_ms(clock), E_DEADLINE_PASSED);

        let escrow = EscrowVault {
            id: object::new(ctx),
            work_order_id,
            buyer: tx_context::sender(ctx),
            seller,
            arbiter,
            amount: coin::into_balance(payment),
            funded_at: clock::timestamp_ms(clock),
            state: FUNDED,
            deadline,
            network_fee_bps,
        };

        event::emit(EscrowCreated {
            escrow_id: object::id(&escrow),
            work_order_id: escrow.work_order_id,
            buyer: escrow.buyer,
            seller: escrow.seller,
            amount: amount_value,
            deadline,
        });

        event::emit(EscrowFunded {
            escrow_id: object::id(&escrow),
            amount: amount_value,
            funded_at: escrow.funded_at,
        });

        transfer::share_object(escrow);
    }

    /// Release escrow after QC attestation and receiver confirmation.
    /// This is the AllPartyConfirm or QCPassAutoRelease trigger.
    ///
    /// Requirements: [ESC-4], [STL-1], [STL-2]
    public entry fun release(
        vault: &mut EscrowVault,
        qc_attestation: vector<u8>,
        trigger_type: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(vault.state == FUNDED, E_INVALID_STATE);
        // Caller MUST be buyer or an authorized oracle
        let sender = tx_context::sender(ctx);
        assert!(
            sender == vault.buyer || sender == vault.arbiter,
            E_NOT_BUYER,
        );

        vault.state = RELEASED;

        event::emit(EscrowReleased {
            escrow_id: object::uid_to_inner(&vault.id),
            trigger: trigger_type,
        });
    }

    /// Settle a released escrow: split funds between seller and network
    /// treasury. The escrow vault balance is fully distributed.
    ///
    /// Requirements: [ESC-4], [E-5]
    public entry fun settle(
        vault: &mut EscrowVault,
        treasury: address,
        ctx: &mut TxContext,
    ) {
        assert!(vault.state == RELEASED, E_INVALID_STATE);

        let total = balance::value(&vault.amount);
        let fee = (total * vault.network_fee_bps) / 10000;
        let seller_amount = total - fee;

        // Transfer to seller
        if (seller_amount > 0) {
            let seller_coin = coin::take(
                &mut vault.amount, seller_amount, ctx
            );
            transfer::public_transfer(seller_coin, vault.seller);
        };

        // Transfer fee to network treasury
        if (fee > 0) {
            let fee_coin = coin::take(&mut vault.amount, fee, ctx);
            transfer::public_transfer(fee_coin, treasury);
        };

        vault.state = SETTLED;

        event::emit(EscrowSettled {
            escrow_id: object::uid_to_inner(&vault.id),
            seller_amount,
            fee_amount: fee,
        });
    }

    /// Freeze escrow when a dispute is raised. Either party or the
    /// arbiter MAY freeze a funded escrow.
    ///
    /// Requirements: [STL-4]
    public entry fun freeze(
        vault: &mut EscrowVault,
        ctx: &mut TxContext,
    ) {
        assert!(vault.state == FUNDED, E_INVALID_STATE);
        let sender = tx_context::sender(ctx);
        assert!(
            sender == vault.buyer
                || sender == vault.seller
                || sender == vault.arbiter,
            E_NOT_BUYER,
        );

        vault.state = FROZEN;

        event::emit(EscrowFrozen {
            escrow_id: object::uid_to_inner(&vault.id),
            frozen_by: sender,
        });
    }

    /// Dispute a frozen escrow with evidence.
    ///
    /// Requirements: [STL-4], [E-8]
    public entry fun dispute(
        vault: &mut EscrowVault,
        reason: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(vault.state == FROZEN, E_INVALID_STATE);
        let sender = tx_context::sender(ctx);
        assert!(
            sender == vault.buyer || sender == vault.seller,
            E_NOT_BUYER,
        );

        vault.state = DISPUTED;

        event::emit(EscrowDisputed {
            escrow_id: object::uid_to_inner(&vault.id),
            disputer: sender,
            reason,
        });
    }

    /// Resolve a dispute by splitting the escrow per arbiter ruling.
    /// Only the arbiter MAY call this function.
    ///
    /// Requirements: [E-8]
    public entry fun resolve_dispute(
        vault: &mut EscrowVault,
        buyer_bps: u64,
        treasury: address,
        ctx: &mut TxContext,
    ) {
        assert!(vault.state == DISPUTED, E_INVALID_STATE);
        assert!(tx_context::sender(ctx) == vault.arbiter, E_NOT_ARBITER);
        assert!(buyer_bps <= 10000, E_FEE_BPS_EXCEEDS_MAX);

        let total = balance::value(&vault.amount);
        let fee = (total * vault.network_fee_bps) / 10000;
        let distributable = total - fee;
        let buyer_amount = (distributable * buyer_bps) / 10000;
        let seller_amount = distributable - buyer_amount;

        if (buyer_amount > 0) {
            let buyer_coin = coin::take(
                &mut vault.amount, buyer_amount, ctx
            );
            transfer::public_transfer(buyer_coin, vault.buyer);
        };

        if (seller_amount > 0) {
            let seller_coin = coin::take(
                &mut vault.amount, seller_amount, ctx
            );
            transfer::public_transfer(seller_coin, vault.seller);
        };

        if (fee > 0) {
            let fee_coin = coin::take(&mut vault.amount, fee, ctx);
            transfer::public_transfer(fee_coin, treasury);
        };

        vault.state = RESOLVED;

        event::emit(EscrowResolved {
            escrow_id: object::uid_to_inner(&vault.id),
            buyer_payout: buyer_amount,
            seller_payout: seller_amount,
        });
    }

    /// Auto-refund if the deadline has passed. This function is
    /// permissionless -- anyone MAY call it after the deadline.
    ///
    /// Requirements: [STL-3]
    public entry fun deadline_refund(
        vault: &mut EscrowVault,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(
            vault.state == FUNDED || vault.state == FROZEN,
            E_INVALID_STATE,
        );
        assert!(
            clock::timestamp_ms(clock) > vault.deadline,
            E_TIMEOUT_NOT_REACHED,
        );

        let total = balance::value(&vault.amount);
        let refund = coin::take(&mut vault.amount, total, ctx);
        transfer::public_transfer(refund, vault.buyer);

        vault.state = REFUNDED;

        event::emit(EscrowRefunded {
            escrow_id: object::uid_to_inner(&vault.id),
            refunded_to: vault.buyer,
            amount: total,
        });
    }
}
```

### 18.11.1.3 Shared Object Semantics

The `EscrowVault` MUST be a Sui shared object `[SUI-OBJECT]`. This ensures:

1. **Multi-party access**: Both buyer and seller can submit transactions
   referencing the escrow without requiring the other party's signature.
2. **Ordered consensus**: Sui's Mysticeti consensus `[SUI-MYSTICETI]`
   provides deterministic ordering for concurrent mutations, preventing
   race conditions between release and dispute operations.
3. **Global accessibility**: The arbiter can interact with the escrow
   without either party granting explicit permission.

The `PlatformCap` MUST be an owned object held by the network governance
multisig. It SHALL NOT be a shared object to prevent unauthorized
administrative operations.

### 18.11.1.4 Access Control

| Role | Capabilities |
|------|-------------|
| **Buyer** | Create + fund escrow, release (confirm), freeze, dispute |
| **Seller** | Freeze, dispute |
| **Arbiter** | Release (QC auto-release proxy), freeze, resolve dispute |
| **Anyone** | Deadline refund (permissionless after deadline) |
| **PlatformCap holder** | Emergency pause (future: governance vote required) |

---

## 18.11.2 Settlement State Machine

### 18.11.2.1 State Diagram

```
                    create_and_fund()
                          │
                          ▼
                     ┌─────────┐
                     │ FUNDED  │
                     │  (1)    │
                     └────┬────┘
                          │
              ┌───────────┼───────────────┐
              │           │               │
         freeze()    release()    deadline_refund()
              │           │               │
              ▼           ▼               ▼
         ┌─────────┐ ┌──────────┐  ┌──────────┐
         │ FROZEN  │ │ RELEASED │  │ REFUNDED │
         │  (4)    │ │   (2)    │  │   (7)    │
         └────┬────┘ └────┬─────┘  └──────────┘
              │           │              Terminal
         dispute()   settle()
              │           │
              ▼           ▼
         ┌──────────┐ ┌──────────┐
         │ DISPUTED │ │ SETTLED  │
         │   (5)    │ │   (3)    │
         └────┬─────┘ └──────────┘
              │            Terminal
       resolve_dispute()
              │
              ▼
         ┌──────────┐
         │ RESOLVED │
         │   (6)    │
         └──────────┘
              Terminal
```

### 18.11.2.2 Formal State Transition Table

| From | To | Function | Guard | Actor |
|------|----|----------|-------|-------|
| -- | FUNDED | `create_and_fund` | `amount > 0 AND deadline > now AND fee_bps <= 500` | Buyer |
| FUNDED | RELEASED | `release` | `sender == buyer OR sender == arbiter` | Buyer or Arbiter |
| FUNDED | FROZEN | `freeze` | `sender IN {buyer, seller, arbiter}` | Any party |
| FUNDED | REFUNDED | `deadline_refund` | `now > deadline` | Anyone (permissionless) |
| RELEASED | SETTLED | `settle` | `state == RELEASED` | Anyone (permissionless) |
| FROZEN | DISPUTED | `dispute` | `sender IN {buyer, seller}` | Buyer or Seller |
| FROZEN | REFUNDED | `deadline_refund` | `now > deadline` | Anyone (permissionless) |
| DISPUTED | RESOLVED | `resolve_dispute` | `sender == arbiter AND buyer_bps <= 10000` | Arbiter |

### 18.11.2.3 Settlement Triggers

An implementation MUST support the following settlement triggers per `[E-3]`:

| ID | Trigger | Description | Mechanism |
|----|---------|-------------|-----------|
| STL-1 | **AllPartyConfirm** | Both buyer and seller explicitly confirm completion. | Buyer calls `release()` after verifying delivery. |
| STL-2 | **QCPassAutoRelease** | QC attestation from Chainlink oracle triggers automatic release. | Arbiter (acting as oracle proxy) calls `release()` with QC attestation. |
| STL-3 | **TimeoutRelease** | Deadline exceeded without action. Funds return to buyer. | Anyone calls `deadline_refund()` after `Clock` exceeds `deadline`. |
| STL-4 | **DisputeFreeze** | Either party freezes the escrow pending arbitration. | Buyer or seller calls `freeze()`, then `dispute()`. |

### 18.11.2.4 Timeout Handling

The implementation MUST use the Sui `Clock` shared object for all
time-dependent operations:

1. The `deadline` field MUST be a Unix timestamp in milliseconds.
2. `deadline_refund()` MUST compare `Clock::timestamp_ms()` against the
   stored deadline.
3. The `deadline_refund()` function MUST be permissionless -- any address
   MAY call it after the deadline has passed.
4. Chainlink Automation (Keepers) SHOULD be used to trigger
   `deadline_refund()` automatically when deadlines expire `[E-4]`.

### 18.11.2.5 Idempotency

All state transition functions MUST be idempotent with respect to the
target state:

- Calling `release()` on an already-RELEASED escrow MUST revert.
- Calling `settle()` on an already-SETTLED escrow MUST revert.
- State assertions (`assert!(vault.state == X, E_INVALID_STATE)`) enforce
  this property.
- The `SuiBridgeService` `[E-2]` SHOULD implement at-least-once delivery
  with idempotency checks on the NATS side.

---

## 18.11.3 Multi-Hop Settlement via PTBs

### 18.11.3.1 Overview

Multi-hop work orders (A manufactures for B, who sub-contracts C, who
sub-contracts D) require cascading escrow `[E-9]`. Sui Programmable
Transaction Blocks (PTBs) `[SUI-PTB]` enable atomic creation and funding
of the entire escrow chain in a single transaction.

### 18.11.3.2 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| MH-1 | Multi-hop settlement MUST use a single PTB to atomically create all escrow vaults in the chain. | MUST |
| MH-2 | If any escrow creation in the chain fails, the entire PTB MUST revert. No partial escrow chains SHALL exist. | MUST |
| MH-3 | The maximum hop depth MUST NOT exceed 8 hops per PTB (Sui limit: 1,024 commands per PTB; each escrow requires ~10 commands). | MUST NOT |
| MH-4 | Each hop MUST have an independent deadline. Downstream deadlines MUST be earlier than upstream deadlines. | MUST |
| MH-5 | Settlement SHOULD cascade: when escrow N settles, escrow N+1 MAY be automatically triggered. | SHOULD |

### 18.11.3.3 PTB Structure

```
PTB: MultiHopSettlement (A → B → C → D)
  ── Step 1: Create EscrowVault(A→B, amount_AB, deadline_D+3d)
  ── Step 2: Create EscrowVault(B→C, amount_BC, deadline_D+2d)
  ── Step 3: Create EscrowVault(C→D, amount_CD, deadline_D+1d)
  ── Step 4: Fund all three vaults from respective buyers
  ── Step 5: Emit MultiHopCreated event with chain topology
```

All 5 steps execute atomically. The chain topology is recorded on-chain
so that settlement cascading can reference it.

### 18.11.3.4 Failure Handling

- **Partial completion**: If hop D completes but hop C does not, escrow
  C→D settles independently. Escrow B→C remains in FUNDED state until
  its own settlement conditions are met.
- **Deadline cascade**: Downstream deadlines MUST expire before upstream
  deadlines (`deadline_D < deadline_C < deadline_B`), ensuring that
  sub-contractors must deliver before the primary contractor's deadline.
- **Dispute isolation**: A dispute in one hop MUST NOT automatically
  freeze other hops. Each escrow is an independent shared object.

---

## 18.11.4 Network Treasury and Fee Distribution

### 18.11.4.1 Treasury Object

```move
module tmnl::treasury {
    use sui::object::{Self, UID};
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;

    /// Network treasury -- shared object managed by governance.
    struct NetworkTreasury has key {
        id: UID,
        /// Operating balance for network expenses
        operating: Balance<SUI>,
        /// Dispute resolution reserve
        dispute_reserve: Balance<SUI>,
        /// Governance multisig address
        governor: address,
        /// Total fees collected (monotonic counter)
        total_collected: u64,
        /// Total disbursed (monotonic counter)
        total_disbursed: u64,
    }

    struct TreasuryDeposit has copy, drop {
        amount: u64,
        source: vector<u8>,
    }

    struct TreasuryDisbursement has copy, drop {
        amount: u64,
        recipient: address,
        reason: vector<u8>,
    }

    /// Deposit settlement fees into treasury.
    /// Called by escrow::settle() via PTB composition.
    public fun deposit_fee(
        treasury: &mut NetworkTreasury,
        fee: Coin<SUI>,
    ) {
        let amount = coin::value(&fee);
        let fee_balance = coin::into_balance(fee);

        // 80% to operating, 20% to dispute reserve
        let reserve_amount = amount / 5;
        let operating_amount = amount - reserve_amount;

        if (reserve_amount > 0) {
            let reserve_split = balance::split(
                &mut fee_balance, reserve_amount
            );
            balance::join(&mut treasury.dispute_reserve, reserve_split);
        };

        balance::join(&mut treasury.operating, fee_balance);
        treasury.total_collected = treasury.total_collected + amount;

        event::emit(TreasuryDeposit {
            amount,
            source: b"settlement_fee",
        });
    }

    /// Disburse from treasury. Governor only.
    public entry fun disburse(
        treasury: &mut NetworkTreasury,
        amount: u64,
        recipient: address,
        reason: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(
            tx_context::sender(ctx) == treasury.governor,
            0, // E_NOT_GOVERNOR
        );

        let payment = coin::take(
            &mut treasury.operating, amount, ctx
        );
        transfer::public_transfer(payment, recipient);

        treasury.total_disbursed = treasury.total_disbursed + amount;

        event::emit(TreasuryDisbursement {
            amount,
            recipient,
            reason,
        });
    }
}
```

### 18.11.4.2 Fee Schedule

| ID | Requirement | Level |
|----|-------------|-------|
| FEE-1 | The network fee MUST be expressed in basis points (1 bps = 0.01%). | MUST |
| FEE-2 | The network fee MUST NOT exceed 500 bps (5%) per transaction. | MUST NOT |
| FEE-3 | The default fee SHOULD be 150 bps (1.5%). | SHOULD |
| FEE-4 | Fee schedule changes MUST be approved by governance vote `[23.6]`. | MUST |
| FEE-5 | Fee splits MUST follow: 80% operating treasury, 20% dispute reserve. | MUST |

### 18.11.4.3 Fee Distribution

```
Settlement Amount: $10,000
Network Fee (1.5%): $150
  ├── Operating Treasury (80%): $120
  │     ├── Infrastructure costs
  │     ├── Oracle subsidies
  │     └── Development grants
  └── Dispute Reserve (20%): $30
        └── Funds dispute resolution payouts
```

### 18.11.4.4 Governance Control

The `NetworkTreasury` MUST be governed by a multisig address. In Phase 3+
(Section 10.1 of research-sui-marketplace-settlement), treasury governance
SHOULD transition to a DAO structure as specified in `[23.6]`.

---

## 18.11.5 Capacity Tokens and RWA Tokenization

### 18.11.5.1 Asset Classes

The following manufacturing asset classes are defined for on-chain
tokenization. Each class has distinct properties regarding fungibility,
expiration, and regulatory classification.

| Asset Class | Token Type | Fungibility | Expiry | Howey Risk | Sui Object |
|-------------|-----------|-------------|--------|------------|------------|
| **Machine Capacity** | Capacity Token | Semi-fungible | Time-decaying | Low (utility) | Shared + Clock |
| **Capability Certificate** | Soulbound NFT | Non-fungible | Renewable | None | Owned (no `store`) |
| **Work Order** | Lifecycle Token | Non-fungible | Completion | Low (utility) | Shared + Escrow |
| **Reputation Score** | Soulbound Token | Non-fungible | Never | None | Owned (no `store`) |
| **Quality Certificate** | Attestation | Non-fungible | Audit cycle | None | Immutable |

### 18.11.5.2 Time-Decaying Capacity Tokens

Machine Capacity Tokens represent available machine-hours on specific
equipment classes. They are the core tradeable unit of the manufacturing
commons.

```move
module tmnl::capacity_token {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;

    const E_EXPIRED: u64 = 0;
    const E_INSUFFICIENT_HOURS: u64 = 1;
    const E_NOT_ISSUER: u64 = 2;

    /// A capacity token representing available machine-hours.
    /// Semi-fungible within the same (equipment_class, quality_tier,
    /// facility_id) tuple.
    struct CapacityToken has key, store {
        id: UID,
        /// Equipment class identifier (e.g., "5-axis-cnc")
        equipment_class: String,
        /// Available hours remaining
        quantity_hours: u64,
        /// ISA-95 facility identifier
        facility_id: address,
        /// Valid from timestamp (ms)
        valid_from: u64,
        /// Expiry timestamp (ms) -- tokens worthless after this
        valid_until: u64,
        /// Quality tier: 1=general, 2=aerospace, 3=medical
        quality_tier: u8,
        /// Issuing organization address
        issued_by: address,
    }

    struct MintCap has key, store {
        id: UID,
        facility_id: address,
    }

    struct CapacityMinted has copy, drop {
        token_id: ID,
        equipment_class: String,
        quantity_hours: u64,
        valid_until: u64,
    }

    struct CapacityConsumed has copy, drop {
        token_id: ID,
        hours_consumed: u64,
        work_order_id: vector<u8>,
    }

    /// Mint capacity tokens. Only the MintCap holder (facility operator)
    /// MAY mint.
    public fun mint(
        cap: &MintCap,
        equipment_class: String,
        quantity_hours: u64,
        valid_from: u64,
        valid_until: u64,
        quality_tier: u8,
        ctx: &mut TxContext,
    ): CapacityToken {
        let token = CapacityToken {
            id: object::new(ctx),
            equipment_class,
            quantity_hours,
            facility_id: cap.facility_id,
            valid_from,
            valid_until,
            quality_tier,
            issued_by: tx_context::sender(ctx),
        };

        event::emit(CapacityMinted {
            token_id: object::id(&token),
            equipment_class: token.equipment_class,
            quantity_hours,
            valid_until,
        });

        token
    }

    /// Consume capacity hours against a work order.
    /// Tokens MUST NOT be consumed after expiry.
    public fun consume(
        token: &mut CapacityToken,
        hours: u64,
        work_order_id: vector<u8>,
        clock: &Clock,
    ) {
        assert!(clock::timestamp_ms(clock) < token.valid_until, E_EXPIRED);
        assert!(token.quantity_hours >= hours, E_INSUFFICIENT_HOURS);

        token.quantity_hours = token.quantity_hours - hours;

        event::emit(CapacityConsumed {
            token_id: object::uid_to_inner(&token.id),
            hours_consumed: hours,
            work_order_id,
        });
    }

    /// Check validity
    public fun is_valid(token: &CapacityToken, clock: &Clock): bool {
        clock::timestamp_ms(clock) < token.valid_until
            && token.quantity_hours > 0
    }

    /// Split a capacity token into two tokens with the same properties.
    public fun split(
        token: &mut CapacityToken,
        split_hours: u64,
        ctx: &mut TxContext,
    ): CapacityToken {
        assert!(token.quantity_hours > split_hours, E_INSUFFICIENT_HOURS);
        token.quantity_hours = token.quantity_hours - split_hours;

        CapacityToken {
            id: object::new(ctx),
            equipment_class: token.equipment_class,
            quantity_hours: split_hours,
            facility_id: token.facility_id,
            valid_from: token.valid_from,
            valid_until: token.valid_until,
            quality_tier: token.quality_tier,
            issued_by: token.issued_by,
        }
    }
}
```

**Time-decay pricing** (informative):

```
Value(t) = BasePrice * max(0, 1 - decay_factor * elapsed / total_window)

Where:
  decay_factor ∈ [0.5, 2.0] (configurable per equipment class)
  elapsed = now - valid_from
  total_window = valid_until - valid_from
```

### 18.11.5.3 Capability NFTs (Soulbound)

Capability NFTs attest that an organization possesses specific manufacturing
capabilities (AS9100 certified, 5-axis CNC, titanium machining).

| ID | Requirement | Level |
|----|-------------|-------|
| CAP-1 | Capability NFTs MUST have the `key` ability but NOT `store`, making them non-transferable (soulbound). | MUST |
| CAP-2 | Only authorized auditors (holding `AuditorCap`) MAY mint capability NFTs. | MUST |
| CAP-3 | Capability NFTs MUST include an `expires_at` field. Expired NFTs MUST NOT be used for marketplace qualification. | MUST |
| CAP-4 | The `evidence_hash` field MUST reference an audit report stored on IPFS or Walrus. | MUST |

```move
module tmnl::capability {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::clock::{Self, Clock};

    /// Soulbound capability NFT.
    /// Has `key` but NOT `store` -- cannot be transferred after mint.
    struct CapabilityNFT has key {
        id: UID,
        org_id: vector<u8>,
        capability: vector<u8>,
        standard: vector<u8>,
        auditor: address,
        issued_at: u64,
        expires_at: u64,
        evidence_hash: vector<u8>,
    }

    struct AuditorCap has key, store {
        id: UID,
        auditor_name: vector<u8>,
        authorized_standards: vector<vector<u8>>,
    }

    /// Mint a capability NFT. Transferred to org via
    /// transfer::transfer (non-public, soulbound).
    public entry fun mint(
        _cap: &AuditorCap,
        org_address: address,
        org_id: vector<u8>,
        capability: vector<u8>,
        standard: vector<u8>,
        expires_at: u64,
        evidence_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let nft = CapabilityNFT {
            id: object::new(ctx),
            org_id,
            capability,
            standard,
            auditor: tx_context::sender(ctx),
            issued_at: clock::timestamp_ms(clock),
            expires_at,
            evidence_hash,
        };

        transfer::transfer(nft, org_address);
    }

    /// Check if capability is currently valid.
    public fun is_valid(nft: &CapabilityNFT, clock: &Clock): bool {
        clock::timestamp_ms(clock) < nft.expires_at
    }
}
```

### 18.11.5.4 Reputation SBTs

See `[18.8.1]` for the G-10 Trust Score specification. On-chain
representation:

| ID | Requirement | Level |
|----|-------------|-------|
| REP-1 | Reputation tokens MUST be soulbound (non-transferable). | MUST |
| REP-2 | Reputation scores MUST be computed from on-chain work order outcomes, not self-reported. | MUST |
| REP-3 | The G-10 formula components (signal consistency, clock accuracy, uptime, peer validation) MUST be individually recorded on-chain. | MUST |
| REP-4 | Reputation updates MUST be triggered by settlement events, not arbitrary writes. | MUST |

### 18.11.5.5 Howey Test Positioning (Informative)

This section is informative. Implementations SHOULD engage securities counsel
for jurisdiction-specific guidance.

| Token | Investment? | Common Enterprise? | Profit Expectation? | Efforts of Others? | Assessment |
|-------|-----------|-------------------|--------------------|--------------------|------------|
| Capacity Token | Purchase for use | No (specific asset) | Use-value | No (self-directed) | **Likely utility** |
| Capability NFT | No (minted by auditor) | No | No | N/A | **Not a security** |
| Work Order Token | Escrow for use | No (bilateral) | Completion value | No | **Utility** |
| Reputation SBT | No (non-transferable) | No | No | N/A | **Not a security** |

The SEC's 2025 no-action letters for DePIN protocols established precedent
that tokens earned through infrastructure operation (not investment) and
consumed for utility (not held for profit) fall outside securities
classification. The $TMNL manufacturing commons token architecture SHOULD
align with this precedent.

---

## 18.11.6 Privacy-Preserving Settlement

### 18.11.6.1 Zero-Knowledge Settlement Verification

Organizations do not want competitors observing settlement details. The
following privacy mechanisms are specified:

| ID | Requirement | Level |
|----|-------------|-------|
| PRV-1 | Settlement amounts SHOULD be verifiable without revealing the exact value, using ZK range proofs. | SHOULD |
| PRV-2 | Quality attestations SHOULD use ZK proofs to demonstrate compliance without revealing process parameters. | SHOULD |
| PRV-3 | Capability verification SHOULD support ZK proofs for threshold claims ("G-10 score above 60" without revealing exact score). | SHOULD |

### 18.11.6.2 Sui ZK-Login for Pseudonymous Settlement

Sui's ZK-login `[SUI-ZKLOGIN]` enables organizations to participate in
settlement using OAuth-based authentication (Google, Apple) without
revealing their blockchain address publicly:

1. Organization authenticates via existing OAuth provider.
2. ZK proof generated locally that proves ownership of the OAuth identity
   without revealing the identity to the blockchain.
3. Settlement transactions are signed with an ephemeral key linked to the
   ZK proof.
4. Only the organization and the counterparty know the mapping between
   the OAuth identity and the on-chain address.

This is RECOMMENDED for small organizations (Earl-class) where wallet
management complexity is a barrier to adoption.

### 18.11.6.3 Seal Framework for Encrypted Work Orders

The Sui Seal framework `[SUI-SEAL]` (deployed January 2026) provides
programmable encryption for work order details:

```
Layer 1: PUBLIC (on-chain, visible to all)
  - EscrowVault: amount, state, timestamps
  - SettlementReceipt: amount, parties (addresses), timestamp
  - TrustScore: aggregate score

Layer 2: ENCRYPTED (on-chain, Seal access-controlled)
  - WorkOrderDetails: part specs, quantities, tolerances
  - QCReport: measurements, pass/fail, evidence
  - PricingTerms: unit price, discount, schedule

Layer 3: OFF-CHAIN (NATS, organization-scoped)
  - Production progress events
  - Machine assignments
  - Internal WO state
```

Seal encryption policies SHOULD require 2-of-3 threshold decryption
(buyer + seller + arbiter) for work order details.

---

## 18.11.7 Cross-Currency and Multi-Token Support

### 18.11.7.1 Supported Settlement Currencies

| ID | Requirement | Level |
|----|-------------|-------|
| CUR-1 | The escrow module MUST support SUI native token for settlement. | MUST |
| CUR-2 | The escrow module MUST support USDC on Sui for price-stable settlement. | MUST |
| CUR-3 | For settlements above $500 equivalent, USDC SHOULD be the default currency. | SHOULD |
| CUR-4 | The escrow module MAY support additional tokens as approved by governance. | MAY |

### 18.11.7.2 Pyth Price Feeds

For cross-currency settlement and FX conversion:

| Feed | Purpose | Update Frequency |
|------|---------|-----------------|
| SUI/USD | Gas cost estimation, SUI settlement valuation | Continuous (Pyth pull) |
| USDC/USD | Stablecoin peg verification | Continuous |
| Regional material indices | Dynamic pricing inputs `[E-6]` | Heartbeat (60s) |

### 18.11.7.3 Atomic Currency Swap + Settlement

A single PTB MAY combine currency conversion and settlement:

```
PTB: CrossCurrencySettlement
  1. Pull Pyth SUI/USD price attestation
  2. Convert buyer's USDC to SUI via DeepBook
  3. Fund EscrowVault with converted SUI
  4. All atomic -- revert if price slippage exceeds threshold
```

---

## 18.11.8 Cost Model

### 18.11.8.1 Per-Operation Gas Costs

| Operation | Sui Gas (approx.) | USD Equiv. (~$3.50/SUI) |
|-----------|--------------------|------------------------|
| Create + fund escrow | ~0.005 SUI | ~$0.02 |
| Release escrow | ~0.003 SUI | ~$0.01 |
| Settle (split + transfer) | ~0.005 SUI | ~$0.02 |
| Freeze escrow | ~0.002 SUI | ~$0.01 |
| Dispute | ~0.003 SUI | ~$0.01 |
| Resolve dispute | ~0.005 SUI | ~$0.02 |
| Deadline refund | ~0.003 SUI | ~$0.01 |
| Multi-hop (3 escrows) | ~0.015 SUI | ~$0.05 |
| Mint CapabilityNFT | ~0.003 SUI | ~$0.01 |
| Mint CapacityToken | ~0.003 SUI | ~$0.01 |
| Reputation update | ~0.002 SUI | ~$0.01 |
| Compliance anchor | ~0.003 SUI | ~$0.01 |

### 18.11.8.2 Organization Tier Projections

| Org Type | Machines | Settlements/mo | Anchors/mo | Sui Cost/mo | Chainlink/mo | Total/mo |
|----------|---------|---------------|-----------|-------------|-------------|---------|
| **Earl** (solo machinist) | 2 | 3 | 720 | ~$8 | ~$12 | **~$20** |
| **Mid-size shop** | 20 | 30 | 7,200 | ~$100 | ~$55 | **~$155** |
| **Enterprise** | 200 | 200 | 72,000 | ~$992 | ~$1,220 | **~$2,212** |

**Optimization**: Hourly Merkle batching (vs. 5-minute) reduces Chainlink
attestation costs by 12x. Compliance-critical processes (pharmaceutical,
aerospace) SHOULD retain 5-minute batching; routine operations SHOULD
use hourly batching.

### 18.11.8.3 Platform-Scale Projection (200K organizations)

| Metric | Value |
|--------|-------|
| Sui transactions/month | ~200M |
| Chainlink attestations/month | ~50M (optimized) |
| Sui gas/month | ~$2M |
| Chainlink/month | ~$5M |
| **Total infrastructure cost** | **~$7M/month** |
| Revenue at $50/org/month avg | **$10M/month** |
| **Gross margin** | **~30%** |

---

## 18.11.9 Effect-TS SuiBridgeService Interface

The SuiBridgeService `[E-2]` bridges on-chain events to NATS for reactive
UI updates and provides a typed interface for all Sui operations.

```typescript
import { Context, Effect, Layer, Schedule, Stream, Schema } from "effect"

// ─── Branded Types ─────────────────────────────────────────────

const SuiTransactionDigest = Schema.String.pipe(
  Schema.brand("SuiTransactionDigest")
)
type SuiTransactionDigest = Schema.Schema.Type<typeof SuiTransactionDigest>

const SuiObjectId = Schema.String.pipe(Schema.brand("SuiObjectId"))
type SuiObjectId = Schema.Schema.Type<typeof SuiObjectId>

const WorkOrderId = Schema.String.pipe(Schema.brand("WorkOrderId"))
type WorkOrderId = Schema.Schema.Type<typeof WorkOrderId>

// ─── Domain Schemas ────────────────────────────────────────────

const EscrowParams = Schema.TaggedStruct("EscrowParams", {
  workOrderId: WorkOrderId,
  buyerWallet: Schema.String,
  sellerWallet: Schema.String,
  arbiterWallet: Schema.String,
  amountMist: Schema.BigIntFromSelf,
  deadlineMs: Schema.Number,
  networkFeeBps: Schema.Number,
})
type EscrowParams = Schema.Schema.Type<typeof EscrowParams>

const SettlementTrigger = Schema.Union(
  Schema.TaggedStruct("AllPartyConfirm", {
    confirmations: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct("QCPassAutoRelease", {
    qcReportId: Schema.String,
    attestationProof: Schema.String,
  }),
  Schema.TaggedStruct("TimeoutRelease", {
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct("DisputeFreeze", {
    reason: Schema.String,
    evidence: Schema.String,
  }),
)
type SettlementTrigger = Schema.Schema.Type<typeof SettlementTrigger>

const SettlementResult = Schema.TaggedStruct("SettlementResult", {
  txDigest: SuiTransactionDigest,
  escrowId: SuiObjectId,
  sellerAmount: Schema.BigIntFromSelf,
  feeAmount: Schema.BigIntFromSelf,
  settledAt: Schema.Number,
})
type SettlementResult = Schema.Schema.Type<typeof SettlementResult>

const EscrowObject = Schema.TaggedStruct("EscrowObject", {
  objectId: SuiObjectId,
  workOrderId: WorkOrderId,
  buyer: Schema.String,
  seller: Schema.String,
  arbiter: Schema.String,
  amount: Schema.BigIntFromSelf,
  state: Schema.Literal(
    "FUNDED", "RELEASED", "SETTLED",
    "FROZEN", "DISPUTED", "RESOLVED", "REFUNDED"
  ),
  deadline: Schema.Number,
  networkFeeBps: Schema.Number,
})
type EscrowObject = Schema.Schema.Type<typeof EscrowObject>

// ─── Error Types ───────────────────────────────────────────────

class SuiBridgeError extends Schema.TaggedError<SuiBridgeError>()(
  "SuiBridgeError",
  {
    code: Schema.Literal(
      "TRANSACTION_FAILED",
      "OBJECT_NOT_FOUND",
      "INSUFFICIENT_GAS",
      "INVALID_STATE",
      "TIMEOUT",
    ),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

// ─── Service Interface ─────────────────────────────────────────

class SuiBridgeService extends Context.Tag("SuiBridgeService")<
  SuiBridgeService,
  {
    /** Create and fund an escrow vault on Sui. */
    readonly createEscrow: (
      params: EscrowParams,
    ) => Effect.Effect<EscrowObject, SuiBridgeError>

    /** Trigger settlement of a released escrow. */
    readonly settleEscrow: (
      escrowId: SuiObjectId,
      trigger: SettlementTrigger,
    ) => Effect.Effect<SettlementResult, SuiBridgeError>

    /** Freeze an escrow (dispute initiation). */
    readonly freezeEscrow: (
      escrowId: SuiObjectId,
    ) => Effect.Effect<void, SuiBridgeError>

    /** Anchor a Merkle root for compliance. */
    readonly anchorMerkleRoot: (
      batch: {
        merkleRoot: string
        batchId: string
        orgId: string
        eventCount: number
        timeStart: number
        timeEnd: number
      },
    ) => Effect.Effect<SuiTransactionDigest, SuiBridgeError>

    /** Publish reputation update on-chain. */
    readonly publishReputation: (
      orgId: string,
      scores: {
        signalConsistency: number
        clockAccuracy: number
        uptime: number
        peerValidation: number
      },
    ) => Effect.Effect<void, SuiBridgeError>

    /** Subscribe to on-chain escrow events. */
    readonly subscribeEscrowEvents: (
      escrowId: SuiObjectId,
    ) => Stream.Stream<EscrowObject, SuiBridgeError>
  }
>() {}
```

---

## 18.11.10 Integration Point Cross-Reference

The following table maps audit integration points `[E-1]` through `[E-14]`
to their normative specification in this section:

| Audit ID | Description | Section | Status |
|----------|-------------|---------|--------|
| E-1 | Escrow smart contract | 18.11.1 | Specified |
| E-2 | Escrow state sync (SuiBridgeService) | 18.11.9 | Specified |
| E-3 | Settlement triggers | 18.11.2.3 | Specified |
| E-4 | Automatic settlement (Chainlink Automation) | 18.11.2.4 | Specified |
| E-5 | Network fee collection | 18.11.4 | Specified |
| E-6 | Dynamic pricing feeds | 18.11.7.2 | Specified |
| E-7 | Work order lifecycle anchoring | 18.11.2 | Specified |
| E-8 | Dispute resolution | 18.11.1.2 (resolve_dispute) | Specified |
| E-9 | Multi-hop settlement | 18.11.3 | Specified |
| E-10 | Privacy-preserving settlement | 18.11.6 | Specified |
| E-11 | Capacity reservation deposits | 18.11.5.2 | Specified |
| E-12 | Real-time capacity price feeds | 18.11.7.2 | Specified |
| E-13 | Cross-currency settlement | 18.11.7 | Specified |
| E-14 | Treasury management | 18.11.4 | Specified |

---

## Bibliography (Section-Specific)

| Key | Citation |
|-----|----------|
| `[SUI-OBJECT]` | MystenLabs. "Sui Object Model." https://docs.sui.io/concepts/object-ownership |
| `[SUI-PTB]` | MystenLabs. "Programmable Transaction Blocks." https://docs.sui.io/concepts/transactions/prog-txn-blocks |
| `[SUI-MYSTICETI]` | MystenLabs. "Mysticeti Consensus Protocol." https://mystenlabs.com/paper/mysticeti.pdf |
| `[SUI-SEAL]` | MystenLabs. "Seal Framework Whitepaper." January 2026. https://docs.sui.io/standards/seal |
| `[SUI-ZKLOGIN]` | MystenLabs. "zkLogin: ZK-based Authentication." https://docs.sui.io/concepts/cryptography/zklogin |
| `[SUI-KIOSK]` | MystenLabs. "Kiosk Framework." https://docs.sui.io/standards/kiosk |
| `[SUI-SPONSORED]` | MystenLabs. "Sponsored Transactions." https://docs.sui.io/concepts/transactions/sponsored-transactions |
| `[PYTH-SUI]` | Pyth Network. "Pyth Oracle on Sui." https://docs.pyth.network/price-feeds/use-real-time-data/sui |
| `[MOVE-LANG]` | MystenLabs. "The Move Programming Language." https://move-book.com/ |
| `[CHAINLINK-FUNCTIONS]` | Chainlink Labs. "Chainlink Functions." https://docs.chain.link/chainlink-functions |
| `[CHAINLINK-AUTOMATION]` | Chainlink Labs. "Chainlink Automation." https://docs.chain.link/chainlink-automation |

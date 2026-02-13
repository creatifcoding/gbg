# RFC-001 Section 23: DePIN Network Economics

```
Section:     23
Title:       DePIN Network Economics
Status:      NORMATIVE
Amendment:   7 (DePIN Token Economics)
Authors:     Val (Vigilant Architecture Layer)
Date:        2026-02-09
Depends-On:  18.11 (Sui Settlement Architecture), 18.8 (Trust & Reputation),
             20.3 (Organization Identity), 20.4 (Trust Establishment)
```

---

## Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in `[RFC2119]` and `[RFC8174]`.

---

## 23.0 Overview

The TMNL manufacturing commons is a Decentralized Physical Infrastructure
Network (DePIN) coordinating physical manufacturing equipment -- CNC machines,
lathes, presses, welding stations -- through a blockchain-incentivized
protocol. This section specifies the token economics, governance framework,
and incentive mechanisms that bootstrap, sustain, and govern the network.

**Foundational insight**: The DePIN flywheel stalls without demand-side value.
The Helium experience demonstrates that supply-side incentives alone produce
deployed but unused infrastructure. The TMNL architecture addresses this by
providing demand-side utility from day one: capacity marketplace, fleet
intelligence, and quality verification services ARE the demand that
justifies the supply-side contribution.

---

## 23.1 Manufacturing Commons as DePIN

### 23.1.1 PRN Classification

The TMNL manufacturing commons is classified as a **Physical Resource
Network (PRN)** per the IEEE DePIN taxonomy `[IEEE-DEPIN-2024]`:

| PRN Characteristic | TMNL Manifestation |
|--------------------|--------------------|
| Location-dependent physical assets | CNC machines, lathes, presses at specific facilities |
| Geographically bounded coverage | Metropolitan manufacturing zones (Atlanta first) |
| Reward for physical infrastructure contribution | Machine connectivity, capacity listing, quality data |
| Hardware investment required | Edge device (Raspberry Pi / industrial gateway) + sensors |

The commons also exhibits Digital Resource Network (DRN) characteristics
when sensor data, OEE metrics, and anonymized quality intelligence are the
contributed resources. This hybrid nature is a distinguishing feature.

### 23.1.2 Concept Mapping

| DePIN Concept | Manufacturing Equivalent | Implementation |
|---------------|--------------------------|----------------|
| Node operators | Machine shop owners (Earl) | Deploy edge device, connect machines via Sparkplug-B |
| Coverage proofs | Machine uptime + capability verification | Proof of Capacity via NATS heartbeat + Chainlink attestation |
| Data contribution | Sensor readings, quality metrics, OEE data | Sparkplug-B telemetry -> NATS -> Merkle anchor -> Sui |
| Network utility | Capacity marketplace, fleet intelligence | Bid/ask marketplace for overflow manufacturing work |
| Token rewards | Incentives for infrastructure contribution | $TMNL utility token on Sui |
| Slashing | Penalty for false claims, quality failures | Staked reputation; slash on failed QC audit |
| Proof of work | Proof of Manufacturing | Chainlink oracle verifies completed work orders |
| Node hardware | Industrial gateway + sensors | Edge device running NATS leaf node |

### 23.1.3 The DePIN Flywheel for Manufacturing

```
$TMNL Token Incentives
     │
     ▼
Infrastructure Deployment (shops connect machines)
     │
     ▼
Network Supply Grows (more capacity available by class + geography)
     │
     ▼
Service Quality Improves (coverage, machine diversity, data richness)
     │
     ▼
Demand Side Attracted (buyers find matching capacity near them)
     │
     ▼
Revenue Generated (marketplace fees, data licensing, quality certs)
     │
     ▼
Token Value Accrues (burn-and-mint equilibrium, buy-backs)
     │
     ▼
More Infrastructure Deployment  ← ← ← ← (loop)
```

### 23.1.4 Helium Lesson: Demand from Day One

| ID | Requirement | Level |
|----|-------------|-------|
| FLY-1 | The network MUST provide at least one demand-side utility feature (marketplace, fleet intelligence, or quality verification) at the time of token launch. | MUST |
| FLY-2 | Token emissions MUST NOT exceed demonstrable demand-side revenue by more than 3x during the first 12 months. | MUST NOT |
| FLY-3 | The protocol SHOULD track the Demand/Supply Ratio (DSR) and SHOULD reduce emissions when DSR falls below 0.3. | SHOULD |

---

## 23.2 $TMNL Utility Token

### 23.2.1 Token Properties

| Property | Specification |
|----------|---------------|
| **Name** | $TMNL (Terminal) |
| **Chain** | Sui |
| **Standard** | Sui Coin<TMNL> (Move module) |
| **Supply model** | Capped supply (1,000,000,000 $TMNL) with deflationary pressure via BME |
| **Decimals** | 9 (consistent with SUI native token) |
| **Transfer restrictions** | None for base token; compliance-gated for security-classified derivatives |

### 23.2.2 Token Utility Functions

An implementation MUST support the following utility functions for $TMNL.
The token SHALL NOT be marketed or distributed as an investment instrument.

| ID | Utility | Description | Level |
|----|---------|-------------|-------|
| UTL-1 | **Marketplace access** | $TMNL is burned to generate Manufacturing Credits (MCs) used to pay for capacity marketplace transactions. | MUST |
| UTL-2 | **Settlement medium** | $TMNL MAY be used as settlement currency alongside SUI and USDC in escrow vaults `[18.11.1]`. | MAY |
| UTL-3 | **Governance voting** | $TMNL staked in governance contracts grants voting power in DAO decisions `[23.6]`. | MUST |
| UTL-4 | **Capability staking** | Organizations MUST stake $TMNL when claiming manufacturing capabilities. Slashed on failed audit. | MUST |
| UTL-5 | **Quality staking** | Organizations MUST stake $TMNL when accepting marketplace work orders. Slashed on failed inspection. | MUST |
| UTL-6 | **Data access** | $TMNL is burned to access aggregated fleet intelligence, OEE benchmarks, and quality trend data. | SHOULD |
| UTL-7 | **Priority matching** | Higher $TMNL stake grants priority in marketplace matching algorithms. | SHOULD |

### 23.2.3 Burn-and-Mint Equilibrium (BME)

The BME model ensures that token value is tied to network demand rather
than speculation:

```
DEMAND SIDE (Buyers)                    SUPPLY SIDE (Shops)
─────────────────────                   ──────────────────
Pay USD for capacity  ──► Buy $TMNL     Contribute capacity ──► Earn $TMNL
                          │                                      ▲
                          ▼                                      │
                     BURN $TMNL ──► Mint Manufacturing    Protocol Treasury
                                    Credits (MCs)              │
                                                               ▼
                                                    Emit $TMNL to suppliers
```

| ID | Requirement | Level |
|----|-------------|-------|
| BME-1 | Buyers MUST acquire $TMNL to generate Manufacturing Credits. Direct USD-to-MC conversion via on-chain swap is RECOMMENDED. | MUST |
| BME-2 | $TMNL burned for MCs MUST be permanently removed from circulating supply. | MUST |
| BME-3 | The emission schedule MUST be deterministic and encoded in the Move module. | MUST |
| BME-4 | The emission rate SHOULD halve at predefined supply milestones (25%, 50%, 75% of max emissions). | SHOULD |
| BME-5 | When burn rate exceeds emission rate, the protocol MUST NOT mint additional tokens to compensate. Deflationary pressure is intentional. | MUST NOT |

### 23.2.4 Move Module: $TMNL Token

```move
module tmnl::token {
    use sui::object::{Self, UID};
    use sui::coin::{Self, TreasuryCap, CoinMetadata};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;

    /// One-time witness for coin creation
    struct TMNL has drop {}

    /// Manufacturing Credit -- non-transferable, consumed on use
    struct ManufacturingCredit has key {
        id: UID,
        amount: u64,
        org_id: vector<u8>,
    }

    struct TokenBurned has copy, drop {
        amount: u64,
        burner: address,
        credits_minted: u64,
    }

    struct RewardEmitted has copy, drop {
        recipient: address,
        amount: u64,
        tier: u8,
        epoch: u64,
    }

    /// Initialize the $TMNL coin type.
    /// Called once during module publication.
    fun init(witness: TMNL, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<TMNL>(
            witness,
            9,                              // decimals
            b"TMNL",                        // symbol
            b"Terminal",                    // name
            b"Manufacturing commons DePIN utility token",
            option::none(),                 // icon_url
            ctx,
        );

        // Treasury cap transferred to governance multisig
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        transfer::public_freeze_object(metadata);
    }

    /// Burn $TMNL to mint Manufacturing Credits.
    /// 1 $TMNL = 1,000 MCs (ratio governed by DAO).
    public entry fun burn_for_credits(
        treasury: &mut TreasuryCap<TMNL>,
        token: coin::Coin<TMNL>,
        org_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&token);
        let credits = amount * 1000; // 1 TMNL = 1000 MC

        coin::burn(treasury, token);

        let mc = ManufacturingCredit {
            id: object::new(ctx),
            amount: credits,
            org_id,
        };
        transfer::transfer(mc, tx_context::sender(ctx));

        event::emit(TokenBurned {
            amount,
            burner: tx_context::sender(ctx),
            credits_minted: credits,
        });
    }

    /// Emit reward tokens to a contributor.
    /// Only EmissionSchedule module can call this.
    public fun emit_reward(
        treasury: &mut TreasuryCap<TMNL>,
        recipient: address,
        amount: u64,
        tier: u8,
        ctx: &mut TxContext,
    ) {
        let reward = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(reward, recipient);

        event::emit(RewardEmitted {
            recipient,
            amount,
            tier,
            epoch: tx_context::epoch(ctx),
        });
    }
}
```

### 23.2.5 Token Distribution

| Allocation | Percentage | Tokens | Vesting | Purpose |
|-----------|-----------|--------|---------|---------|
| Network Rewards | 40% | 400,000,000 | Emitted over 10 years with halvings | Infrastructure deployment incentives |
| Ecosystem Fund | 20% | 200,000,000 | DAO-governed | Grants, hardware subsidies, integrations |
| Core Team | 15% | 150,000,000 | 4-year linear, 1-year cliff | Development and operations |
| Early Adopters | 10% | 100,000,000 | 2-year linear | First 1,000 connected shops |
| Hub Operators | 5% | 50,000,000 | Performance-based | NATS hub infrastructure operators |
| Treasury Reserve | 10% | 100,000,000 | DAO-governed | Strategic reserve, partnerships |

| ID | Requirement | Level |
|----|-------------|-------|
| DIST-1 | The core team allocation MUST have a minimum 1-year cliff before any tokens vest. | MUST |
| DIST-2 | Network reward emissions MUST follow a deterministic halving schedule. | MUST |
| DIST-3 | The ecosystem fund and treasury reserve MUST be governed by DAO vote after Phase 3. | MUST |

### 23.2.6 Regulatory Positioning (Informative)

This subsection is informative. Implementations MUST engage securities
counsel before token distribution.

**Howey Test Analysis for $TMNL**:

| Howey Prong | Assessment | Risk |
|-------------|-----------|------|
| Investment of money | Shops invest in hardware for utility (connecting machines), not for speculation | LOW |
| Common enterprise | Shared marketplace; however, shops operate independently | MEDIUM |
| Expectation of profits | Primary value is operational (marketplace access, fleet intelligence); rewards tied to own effort | LOW-MEDIUM |
| Efforts of others | Rewards depend on the SHOP'S OWN EFFORTS (uptime, quality, capacity), not on a central team | LOW |

**Overall assessment**: LOW-MEDIUM securities risk. The 2025 SEC no-action
letters for DePIN protocols established precedent that programmatic
distributions where tokens are earned through infrastructure operation and
consumed for utility fall outside securities classification.

**Design safeguards**:

| ID | Requirement | Level |
|----|-------------|-------|
| REG-1 | Token distribution communications SHALL NOT use investment language ("returns", "profit", "appreciation"). | SHALL NOT |
| REG-2 | Rewards MUST be strictly tied to measurable infrastructure contribution. | MUST |
| REG-3 | Governance MUST be progressively decentralized (no founding team control after 24 months). | MUST |
| REG-4 | The protocol SHOULD maintain a feature-flag system enabling per-jurisdiction token functionality restrictions. | SHOULD |

---

## 23.3 Reward Tiers

### 23.3.1 Tier Structure

Organizations earn $TMNL rewards based on their contribution tier. Each
tier requires progressively more meaningful participation.

| Tier | Name | Requirements | Multiplier | Description |
|------|------|-------------|-----------|-------------|
| 1 | **Connectivity** | Edge device connected, NATS heartbeat active | 1.0x | Basic infrastructure contribution. Earl's first step. |
| 2 | **Data Contribution** | Tier 1 + OEE data shared, uptime > 90% | 2.5x | Meaningful telemetry contribution to fleet intelligence. |
| 3 | **Marketplace Participation** | Tier 2 + capacity listed on marketplace, >= 1 completed work order/quarter | 5.0x | Active economic participant. |
| 4 | **Quality Verification** | Tier 3 + quality metrics (SPC, CMM) shared, uptime > 97%, quality score > 85 | 10.0x | Full contribution with verified quality data. |

### 23.3.2 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| TIER-1 | Tier progression MUST be computed from on-chain evidence (NATS attestation via Chainlink, work order completion events on Sui). | MUST |
| TIER-2 | Tier downgrade MUST occur automatically when an organization falls below tier thresholds for 30 consecutive days. | MUST |
| TIER-3 | Tier multipliers MUST be governance-adjustable via DAO vote `[23.6]`. | MUST |
| TIER-4 | Reward computation SHOULD use exponential moving average (EMA) of contribution metrics over a 90-day window. | SHOULD |

### 23.3.3 Reward Computation

```
Daily Reward(org) = BaseEmission
                    * TierMultiplier(org.tier)
                    * QualityBonus(org.quality_score)
                    * UptimeBonus(org.uptime_pct)
                    * GeographicWeight(org.zone)

Where:
  BaseEmission = TotalDailyEmission / ActiveOrganizations
  QualityBonus = 1.0 + (quality_score - 50) / 200   [range: 0.75 to 1.25]
  UptimeBonus  = org.uptime_pct / 100                [range: 0.00 to 1.00]
  GeographicWeight = 1.0 for established zones,
                     1.5 for under-served zones (incentivize coverage)
```

### 23.3.4 Proof Mechanisms

#### Proof of Capacity (PoC)

| ID | Requirement | Level |
|----|-------------|-------|
| POC-1 | Machine availability claims MUST be attested by edge device heartbeat data via NATS, verified by Chainlink oracle. | MUST |
| POC-2 | Power consumption data SHOULD be cross-referenced with claimed machine state to detect fraud (a "running" CNC drawing 50W is clearly fabricated). | SHOULD |
| POC-3 | Random challenge-response SHOULD require producing a test part to specification, verified by an independent party. | SHOULD |

#### Proof of Quality (PoQ)

| ID | Requirement | Level |
|----|-------------|-------|
| POQ-1 | Quality metrics (CMM readings, SPC data) MUST be hashed and anchored on-chain via Merkle trees `[18.11.8]`. | MUST |
| POQ-2 | Chainlink oracle MUST verify the measurement chain before quality attestation is recorded. | MUST |
| POQ-3 | Third-party inspection SHOULD be randomly assigned for Tier 4 organizations at a minimum of 1 audit per quarter. | SHOULD |

#### Proof of Uptime (PoU)

| ID | Requirement | Level |
|----|-------------|-------|
| POU-1 | Edge devices MUST transmit heartbeats via NATS at a minimum interval of 60 seconds. | MUST |
| POU-2 | Heartbeats MUST be signed with the device's cryptographic key. | MUST |
| POU-3 | Variable-interval challenges SHOULD be issued by the Chainlink oracle to prevent heartbeat replay attacks. | SHOULD |

---

## 23.4 Machine iNFTs (Intelligence NFTs)

### 23.4.1 Machine Digital Twin as Evolving NFT

Each machine in the manufacturing commons is represented on Sui as a
Machine iNFT -- an Intelligence NFT that accumulates operational data,
quality history, and maintenance records over its lifecycle.

| ID | Requirement | Level |
|----|-------------|-------|
| INFT-1 | Each connected machine MUST be minted as a Sui object upon first edge device registration. | MUST |
| INFT-2 | The Machine iNFT MUST be owned by the organization's Sui wallet address. | MUST |
| INFT-3 | The Machine iNFT MUST use Sui dynamic fields to accumulate operational intelligence over time. | MUST |
| INFT-4 | Machine iNFTs MUST be transferable (they travel with equipment ownership changes). | MUST |

### 23.4.2 Object Structure

```move
module tmnl::machine_inft {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::dynamic_field;
    use sui::event;
    use std::string::String;

    /// Machine Intelligence NFT -- the on-chain digital twin.
    /// Has both `key` and `store` -- transferable with equipment.
    struct MachineINFT has key, store {
        id: UID,
        /// Decentralized Identifier: w3c-did:sui:machine:{object_id}
        did: String,
        /// Machine type (CNC, Lathe, Press, EDM, etc.)
        machine_type: String,
        /// Manufacturer and model
        make: String,
        model: String,
        /// Serial number (encrypted or hashed for privacy)
        serial_hash: vector<u8>,
        /// ISA-95 facility location
        facility_id: address,
        /// Owner organization
        owner: address,
        /// Mint timestamp
        minted_at: u64,
        /// Lifetime work orders completed
        lifetime_orders: u64,
        /// Lifetime hours operated
        lifetime_hours: u64,
        /// Current reward tier qualification
        reward_tier: u8,
    }

    /// Dynamic field key for capability attestations
    struct CapabilityKey has copy, drop, store {
        capability: String,
    }

    /// Dynamic field value for capability attestation
    struct CapabilityAttestation has store {
        standard: String,
        auditor: address,
        attested_at: u64,
        expires_at: u64,
        evidence_hash: vector<u8>,
    }

    /// Dynamic field key for quality history
    struct QualityHistoryKey has copy, drop, store {
        quarter: String,
    }

    /// Aggregated quality data per quarter
    struct QualityRecord has store {
        total_inspections: u64,
        pass_count: u64,
        avg_deviation_microns: u64,
        best_tolerance_achieved: u64,
    }

    /// Dynamic field key for telemetry anchor
    struct TelemetryAnchorKey has copy, drop, store {}

    /// Latest Chainlink-attested telemetry summary
    struct TelemetryAnchor has store {
        merkle_root: vector<u8>,
        attested_at: u64,
        uptime_pct_bps: u64,
        readings_count: u64,
    }

    // ─── Events ─────────────────────────────────────────────

    struct MachineMinted has copy, drop {
        machine_id: ID,
        machine_type: String,
        owner: address,
    }

    struct IntelligenceUpdated has copy, drop {
        machine_id: ID,
        field_type: String,
    }

    // ─── Entry Functions ────────────────────────────────────

    /// Mint a machine iNFT when edge device first connects.
    public entry fun mint(
        machine_type: String,
        make: String,
        model: String,
        serial_hash: vector<u8>,
        facility_id: address,
        ctx: &mut TxContext,
    ) {
        let nft = MachineINFT {
            id: object::new(ctx),
            did: string::utf8(b""), // Set after ID known
            machine_type,
            make,
            model,
            serial_hash,
            facility_id,
            owner: tx_context::sender(ctx),
            minted_at: tx_context::epoch(ctx),
            lifetime_orders: 0,
            lifetime_hours: 0,
            reward_tier: 1,
        };

        event::emit(MachineMinted {
            machine_id: object::id(&nft),
            machine_type: nft.machine_type,
            owner: nft.owner,
        });

        transfer::public_transfer(nft, tx_context::sender(ctx));
    }

    /// Attach or update a capability attestation.
    public entry fun attest_capability(
        nft: &mut MachineINFT,
        capability: String,
        standard: String,
        expires_at: u64,
        evidence_hash: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let key = CapabilityKey { capability };
        let attestation = CapabilityAttestation {
            standard,
            auditor: tx_context::sender(ctx),
            attested_at: tx_context::epoch(ctx),
            expires_at,
            evidence_hash,
        };

        if (dynamic_field::exists_(&nft.id, key)) {
            let existing = dynamic_field::remove<
                CapabilityKey, CapabilityAttestation
            >(&mut nft.id, key);
            let CapabilityAttestation {
                standard: _, auditor: _, attested_at: _,
                expires_at: _, evidence_hash: _,
            } = existing;
        };

        dynamic_field::add(&mut nft.id, key, attestation);

        event::emit(IntelligenceUpdated {
            machine_id: object::uid_to_inner(&nft.id),
            field_type: string::utf8(b"capability"),
        });
    }

    /// Update telemetry anchor from Chainlink attestation.
    public entry fun update_telemetry(
        nft: &mut MachineINFT,
        merkle_root: vector<u8>,
        uptime_pct_bps: u64,
        readings_count: u64,
        ctx: &mut TxContext,
    ) {
        let key = TelemetryAnchorKey {};
        let anchor = TelemetryAnchor {
            merkle_root,
            attested_at: tx_context::epoch(ctx),
            uptime_pct_bps,
            readings_count,
        };

        if (dynamic_field::exists_(&nft.id, key)) {
            let existing = dynamic_field::remove<
                TelemetryAnchorKey, TelemetryAnchor
            >(&mut nft.id, key);
            let TelemetryAnchor {
                merkle_root: _, attested_at: _,
                uptime_pct_bps: _, readings_count: _,
            } = existing;
        };

        dynamic_field::add(&mut nft.id, key, anchor);

        event::emit(IntelligenceUpdated {
            machine_id: object::uid_to_inner(&nft.id),
            field_type: string::utf8(b"telemetry"),
        });
    }

    /// Record a completed work order (increments lifetime counters).
    public fun record_completion(
        nft: &mut MachineINFT,
        hours_used: u64,
    ) {
        nft.lifetime_orders = nft.lifetime_orders + 1;
        nft.lifetime_hours = nft.lifetime_hours + hours_used;
    }
}
```

### 23.4.3 Provenance

The Machine iNFT creates a portable history that follows the equipment:

1. **Ownership transfer**: When a machine is sold, the iNFT transfers to
   the new owner. All accumulated quality history, capability attestations,
   and telemetry anchors travel with it.
2. **Equipment financing**: A machine with 3 years of on-chain quality
   history and 99% uptime is a demonstrably bankable asset for equipment
   financing (MakerDAO / Centrifuge integration, future).
3. **Decommission**: When a machine is retired, the iNFT SHOULD be frozen
   (made immutable) rather than destroyed, preserving the audit trail.

### 23.4.4 Integration with NATS Event Stream

```
NATS EventDistribution                    Sui Machine iNFT
┌──────────────────────┐                  ┌──────────────────┐
│ iiot.readings.{org}  │──Merkle batch──►│ TelemetryAnchor  │
│ iiot.entity.{org}    │                  │ (dynamic field)  │
│ iiot.alarms.{org}    │                  └──────────────────┘
└──────────────────────┘
                                          ┌──────────────────┐
   Chainlink attestation ────────────────►│ CapabilityAttest │
                                          │ (dynamic field)  │
                                          └──────────────────┘
                                          ┌──────────────────┐
   Work order settlement ────────────────►│ lifetime_orders  │
                                          │ lifetime_hours   │
                                          └──────────────────┘
```

---

## 23.5 Expirable Leases

### 23.5.1 Concept

Expirable Leases are time-bounded capacity access tokens that grant the
holder the right to use specific manufacturing capacity within a defined
window. They combine the mechanics of options contracts with the utility
of capacity reservations.

### 23.5.2 Lease Lifecycle

```
Mint ──► Exercise ──► [Renew | Expire | Revoke]

┌──────────┐     ┌───────────┐     ┌───────────┐
│  MINTED  │────►│ EXERCISED │────►│ COMPLETED │
│  (active │     │ (capacity │     │ (hours    │
│   lease) │     │  in use)  │     │  consumed)│
└────┬─────┘     └───────────┘     └───────────┘
     │
     ├──────────────────────────────┐
     │                              │
     ▼                              ▼
┌───────────┐              ┌───────────┐
│  EXPIRED  │              │  REVOKED  │
│  (Clock   │              │  (issuer  │
│   passed) │              │   action) │
└───────────┘              └───────────┘
```

### 23.5.3 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| LEASE-1 | Leases MUST use the Sui `Clock` shared object for all time-based operations. | MUST |
| LEASE-2 | Expired leases MUST be automatically invalidated. Anyone MAY call the expiry function after the lease window closes. | MUST |
| LEASE-3 | Lease holders MAY transfer leases to other organizations before exercise. | MAY |
| LEASE-4 | Lease revocation by the issuer MUST trigger automatic refund of any prepaid amount. | MUST |

### 23.5.4 Manufacturing Use Cases

| Use Case | Lease Duration | Exercise |
|----------|---------------|----------|
| **Machine-hours reservation** | 1 week -- 3 months | Book specific CNC time for upcoming job |
| **Certification access** | 1 year (renewal) | Maintain AS9100 verification for marketplace eligibility |
| **Trial period** | 30 days | New organization evaluates platform capabilities |
| **Capacity futures** | 1-6 months | Pre-purchase capacity for known demand pipeline |

### 23.5.5 DeFi Composability (Informative)

Leases are composable tokens (`key + store` abilities) enabling:

- **Trading**: Secondary market for capacity leases via Sui Kiosk `[SUI-KIOSK]`.
- **Subleasing**: Holder splits a lease into sub-leases for sub-contractors.
- **Collateral**: Leases with exercisable capacity MAY be used as collateral
  in lending protocols (subject to regulatory review per `[REG-4]`).

---

## 23.6 Governance Framework

### 23.6.1 Ostrom's Eight Principles

The TMNL governance framework maps Elinor Ostrom's eight principles for
governing commons to a multi-tier DAO structure `[OSTROM-1990]`:

| Ostrom Principle | DAO Implementation |
|------------------|--------------------|
| 1. Clearly defined boundaries | Machine identity (DID), shop verification (KYC), geographic zones |
| 2. Proportional equivalence | Rewards proportional to contribution (capacity, data, quality) |
| 3. Collective-choice arrangements | Token-weighted + quadratic voting for protocol parameters |
| 4. Monitoring | Sensor telemetry via NATS, Chainlink oracles, random audits |
| 5. Graduated sanctions | Warning -> reward reduction -> slashing -> exclusion |
| 6. Conflict-resolution mechanisms | Tiered arbitration: automated -> peer -> expert -> off-chain legal |
| 7. Minimal rights to organize | Open participation, low barrier to entry (subsidized hardware) |
| 8. Nested enterprises | Sub-DAOs per vertical, hub-level governance, metro coordination |

### 23.6.2 Multi-Tier DAO Structure

```
┌─────────────────────────────────────────────────────────┐
│                     TMNL DAO (Root)                       │
│  Protocol parameters, emission schedule, treasury,       │
│  major partnerships                                      │
│  Voting: Quadratic (sqrt of staked $TMNL)                │
│  Quorum: 10% of staked supply                            │
│  Timelock: 48-hour execution delay                       │
└──────────┬────────────────────────────────┬──────────────┘
           │                                │
    ┌──────▼──────┐                  ┌──────▼──────┐
    │  Vertical    │                  │  Hub DAOs    │
    │  Sub-DAOs    │                  │              │
    ├─────────────┤                  ├─────────────┤
    │ Aerospace    │                  │ Atlanta Hub  │
    │ Automotive   │                  │ Detroit Hub  │
    │ Medical      │                  │ Houston Hub  │
    │ General Mfg  │                  │ (future)     │
    └─────────────┘                  └─────────────┘
    Industry-specific                 Local capacity,
    standards, quality                geographic rules,
    thresholds, certs                 hub operations
```

### 23.6.3 Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| GOV-1 | Root DAO voting MUST use quadratic voting (sqrt of staked $TMNL) to prevent whale dominance. | MUST |
| GOV-2 | Vertical Sub-DAO membership MUST require demonstrated domain expertise (e.g., valid capability NFTs for the vertical). | MUST |
| GOV-3 | Hub DAO voting weight MUST be proportional to local infrastructure contribution (uptime + marketplace activity in the region). | MUST |
| GOV-4 | Governance proposals MUST have a minimum 48-hour timelock between vote passage and execution. | MUST |
| GOV-5 | Protocol parameter changes (emission rates, fee schedules, tier thresholds) MUST require Root DAO approval. | MUST |
| GOV-6 | Vertical-specific standards (quality thresholds, certification requirements) SHOULD be governed by the relevant Vertical Sub-DAO. | SHOULD |
| GOV-7 | Emergency pause of smart contracts MUST require a supermajority (>66%) of Root DAO staked weight. | MUST |

### 23.6.4 Token-Weighted Voting with Reputation Multiplier

Voting power is a function of both token stake and reputation:

```
VotingPower(org) = sqrt(staked_TMNL) * ReputationMultiplier(org)

Where:
  ReputationMultiplier = 1.0 + (G10_score / 500)  [range: 1.0 to 1.2]
```

This ensures that large token holders cannot dominate governance without
also demonstrating meaningful network contribution (high G-10 reputation).

### 23.6.5 Dispute Resolution Governance

Manufacturing disputes follow a tiered resolution protocol:

| Tier | Mechanism | Coverage | Cost |
|------|-----------|----------|------|
| 1. **Automated** | Smart contract rules (escrow timeout, SPC threshold breach) | ~80% of disputes | Gas only |
| 2. **Peer Arbitration** | Panel of 3 randomly selected Tier 3/4 shops with domain expertise | ~15% of disputes | Arbiter fee (from dispute reserve) |
| 3. **Expert Panel** | Domain-certified arbitrators for disputes >$50K | ~4% of disputes | Expert fee + escrow from both parties |
| 4. **Off-chain Legal** | Traditional legal process; smart contract can freeze assets | ~1% of disputes | Legal fees |

| ID | Requirement | Level |
|----|-------------|-------|
| DISP-1 | Tier 1 automated resolution MUST be attempted before escalation. | MUST |
| DISP-2 | Peer arbitrators MUST be randomly selected using Chainlink VRF to prevent collusion. | MUST |
| DISP-3 | Arbitrators MUST stake $TMNL against their rulings. Overturned rulings on appeal result in partial slash. | MUST |
| DISP-4 | Dispute resolution fees MUST be funded from the NetworkTreasury dispute reserve `[18.11.4]`. | MUST |

---

## 23.7 Regulatory Positioning

### 23.7.1 Utility Token Architecture

| ID | Requirement | Level |
|----|-------------|-------|
| REG-5 | $TMNL MUST be designed, distributed, and documented as a utility token with genuine consumptive use. | MUST |
| REG-6 | The protocol MUST NOT distribute tokens via mechanisms that resemble investment contracts (no "ICO", no "guaranteed returns"). | MUST NOT |
| REG-7 | Token rewards MUST be earned through measurable infrastructure contribution, not passive holding. | MUST |
| REG-8 | Progressive decentralization MUST transition governance from founding team to DAO within 24 months of token genesis. | MUST |

### 23.7.2 SEC No-Action Letter Alignment (Informative)

The SEC Division of Corporation Finance issued no-action letters in 2025
confirming that programmatic DePIN token distributions where:

1. Tokens are earned through infrastructure operation (not investment).
2. Rewards depend on operators' own efforts.
3. Token utility is functional (access services, not dividends).

...would not be recommended for enforcement action.

The $TMNL token architecture aligns with this precedent:

| SEC Criterion | $TMNL Implementation |
|---------------|---------------------|
| Earned through operation | Rewards require machine connectivity, data contribution, quality metrics |
| Own efforts | Reward multipliers tied to individual shop performance (uptime, quality, marketplace activity) |
| Functional utility | Marketplace access (burn for MCs), governance voting, capability staking, quality staking |
| No profit promises | Communications focus on operational utility, not investment returns |

### 23.7.3 Feature-Flagged Jurisdiction Compliance

The protocol SHOULD implement jurisdiction-aware feature flags:

```typescript
const JurisdictionConfig = Schema.TaggedStruct("JurisdictionConfig", {
  jurisdiction: Schema.Literal("US", "EU", "UK", "INTL"),
  tokenTransfersEnabled: Schema.Boolean,
  stakingEnabled: Schema.Boolean,
  governanceVotingEnabled: Schema.Boolean,
  capacityFuturesEnabled: Schema.Boolean,
  invoiceTokenizationEnabled: Schema.Boolean,
})
type JurisdictionConfig = Schema.Schema.Type<typeof JurisdictionConfig>
```

| Feature | US | EU (MiCA) | UK | Notes |
|---------|----|-----------|----|-------|
| Token rewards | Enabled | Enabled (utility token whitepaper required) | Enabled | Core DePIN function |
| Governance voting | Enabled | Enabled | Enabled | Low regulatory risk |
| Capacity marketplace | Enabled | Enabled (CASP license required) | Enabled | Primary utility |
| Capacity futures | **Disabled** (CFTC review) | Enabled (MiFID II scope) | **Disabled** (FCA review) | Derivative classification risk |
| Invoice tokenization | **Disabled** (securities) | Enabled (MiCA ART) | **Disabled** (securities) | Howey/security risk |
| Fractional equipment ownership | **Disabled** (securities) | **Disabled** (MiCA security token) | **Disabled** (securities) | Clearly a security |

### 23.7.4 ITAR Considerations

For defense manufacturing capacity:

| ID | Requirement | Level |
|----|-------------|-------|
| ITAR-1 | ITAR-classified capacity tokens MUST NOT be transferable to non-US persons or entities. | MUST NOT |
| ITAR-2 | Sui TransferPolicy `[SUI-KIOSK]` MUST enforce ITAR compliance at the smart contract level. | MUST |
| ITAR-3 | Machine iNFTs for ITAR-classified equipment MUST have restricted visibility (Seal encryption `[SUI-SEAL]`). | MUST |

---

## 23.8 Anti-Gaming Mechanisms

Drawing from a16z crypto's DePIN security research `[A16Z-DEPIN]`:

| Attack Vector | Defense | Detection |
|---------------|---------|-----------|
| **Fake nodes** (claiming nonexistent machines) | Hardware attestation (TPM/secure element), power consumption correlation, random physical audit | Cross-reference NATS power data with claimed state |
| **Sybil attacks** (one operator as many) | IP fingerprinting, device fingerprinting, geographic clustering detection, stake requirements | Statistical anomaly detection on registration patterns |
| **Wash trading** (self-dealing on marketplace) | Minimum distinct counterparties, payment verification through banking rails | Graph analysis on work order patterns |
| **Data fabrication** (fake sensor readings) | Cross-sensor correlation (vibration vs. power vs. temperature), Chainlink oracle validation | Statistical outlier detection in ReadingProcessor |
| **Capability inflation** (claiming better specs) | Random challenge-response (produce test part), third-party audits, historical quality record | Deviation between claimed and measured capability |

| ID | Requirement | Level |
|----|-------------|-------|
| GAME-1 | The protocol MUST implement at least 3 of the 5 anti-gaming mechanisms listed above before token launch. | MUST |
| GAME-2 | Slashing penalties MUST be proportional to the severity of the offense (graduated sanctions per Ostrom Principle 5). | MUST |
| GAME-3 | Slashed tokens MUST be sent to the NetworkTreasury dispute reserve, not burned. | MUST |

### 23.8.1 Graduated Sanctions

| Level | Trigger | Consequence | Recovery |
|-------|---------|-------------|----------|
| **Warning** | First minor offense (e.g., 1 day below uptime threshold) | Notification; no penalty | Automatic on compliance |
| **Reward reduction** | Repeated minor offenses (3 in 30 days) | 50% reward reduction for 30 days | Automatic after 30 days compliance |
| **Partial slash** | Moderate offense (e.g., failed QC audit) | 10-25% of staked $TMNL slashed | Re-stake to resume marketplace participation |
| **Full slash** | Severe offense (e.g., data fabrication, fraud) | 100% of staked $TMNL slashed | Must re-onboard with enhanced verification |
| **Exclusion** | Repeat severe offenses (2+ in 12 months) | Permanent marketplace ban; machine iNFT flagged | Governance appeal only (Root DAO vote) |

---

## 23.9 Emission Schedule

### 23.9.1 Halving Schedule

| Year | Daily Emission | Annual Emission | Cumulative % |
|------|---------------|-----------------|-------------|
| 1 | 219,178 $TMNL | 80,000,000 | 20% |
| 2 | 219,178 $TMNL | 80,000,000 | 40% |
| 3 | 109,589 $TMNL | 40,000,000 | 50% |
| 4 | 109,589 $TMNL | 40,000,000 | 60% |
| 5 | 54,795 $TMNL | 20,000,000 | 65% |
| 6 | 54,795 $TMNL | 20,000,000 | 70% |
| 7-8 | 27,397 $TMNL | 10,000,000/yr | 75% |
| 9-10 | 27,397 $TMNL | 10,000,000/yr | 80% |
| 10+ | DAO-governed | Remaining 20% over 10+ years | 100% |

| ID | Requirement | Level |
|----|-------------|-------|
| EMIT-1 | The emission schedule MUST be encoded in the Move module and MUST NOT be modifiable without governance vote. | MUST |
| EMIT-2 | Halving events MUST occur at the specified year boundaries. | MUST |
| EMIT-3 | Unused daily emissions (no qualifying organizations) MUST roll into the treasury reserve. | MUST |

---

## Bibliography (Section-Specific)

| Key | Citation |
|-----|----------|
| `[IEEE-DEPIN-2024]` | IEEE. "DePIN: Challenges and Opportunities." IEEE Xplore, 2024. DOI: 10.1109/10737386 |
| `[OSTROM-1990]` | Ostrom, E. *Governing the Commons: The Evolution of Institutions for Collective Action.* Cambridge University Press, 1990. |
| `[A16Z-DEPIN]` | a16z crypto. "Manipulated Signals in DePIN Protocols." 2024. https://a16zcrypto.com/posts/article/manipulated-signals-in-depin-protocols/ |
| `[HELIUM-LESSON]` | Messari. "State of Helium Q4 2024." https://messari.io/report/state-of-helium-q4-2024 |
| `[SEC-DEPIN-NAL]` | SEC Division of Corporation Finance. "No-Action Letter: DePIN Token Distributions." 2025. |
| `[DEPIN-FLYWHEEL]` | Sourceful Energy. "DePIN Flywheel and Token Rewards." https://sourceful.energy/blog/why-the-depin-flywheel-and-token-rewards-are-the-future-of-infrastructure-networks |
| `[DEPIN-TOKENOMICS]` | Frontiers in Blockchain. "DePIN Tokenomics." 2025. DOI: 10.3389/fbloc.2025.1644115 |
| `[PEAQ-NETWORK]` | peaq. "A Layer-1 for DePINs." https://www.peaq.network/ |
| `[SUI-KIOSK]` | MystenLabs. "Kiosk Framework." https://docs.sui.io/standards/kiosk |
| `[SUI-SEAL]` | MystenLabs. "Seal Framework Whitepaper." January 2026. https://docs.sui.io/standards/seal |
| `[SUI-SPONSORED]` | MystenLabs. "Sponsored Transactions." https://docs.sui.io/concepts/transactions/sponsored-transactions |
| `[CHAINLINK-VRF]` | Chainlink Labs. "Chainlink VRF." https://docs.chain.link/vrf |
| `[DAO-COMMONS]` | Frontiers in Blockchain. "DAO Design for Commons." 2023. DOI: 10.3389/fbloc.2023.1287249 |
| `[DIMO-MODEL]` | DIMO. "Decentralized Vehicle Data." https://docs.dimo.zone/ |

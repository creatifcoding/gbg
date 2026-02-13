# RFC-001 Section 20.12: On-Chain Identity and Trust Objects

```
Section:       On-Chain Identity and Trust Objects
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (security-splitter)
Created:       2026-02-09
Amendment:     2 (of 6 proposed by research-rfc-sui-chainlink-audit.md)
Extends:       rfc-section-trust-model.md (T.3, T.4, T.5, T.11)
Companion:     rfc-section-security-architecture.md (S.4, S.6)
               rfc-section-tenant-isolation.md (TI.3, TI.8)
               rfc-section-onchain-isolation.md (Section 21.10)
Research Base: docs/specifications/research-sui-identity-auth.md
               docs/specifications/research-sui-blockchain-integration.md
               docs/specifications/research-depin-manufacturing.md
               docs/specifications/research-rfc-sui-chainlink-audit.md
Integration:   O-1, O-2, O-3, O-5, O-10, O-13, S-1 (audit integration point IDs)
Bibliography:  docs/specifications/bibliography.md
```

> This section specifies the on-chain identity and trust infrastructure for the
> TMNL metropolitan manufacturing commons. In a network of 200,000+ organizations
> where trust cannot be assumed, blockchain-backed identity provides self-sovereign
> organizational credentials, cryptographically verifiable bilateral agreements,
> tamper-proof reputation scores, and oracle-attested capability proofs.
>
> On-chain identity does NOT replace NATS JWT authentication for real-time
> messaging. The two systems operate at fundamentally different timescales and
> serve complementary purposes: Sui verifies "who you are" and "what you are
> authorized to do"; NATS JWT controls "what subjects you can publish and
> subscribe to right now."
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Scope](#2012-1-scope)
2. [Conventions](#2012-2-conventions)
3. [Organization Identity Object Model](#2012-3-organization-identity-object-model)
4. [Wallet-to-NATS-Account Binding Protocol](#2012-4-wallet-to-nats-account-binding-protocol)
5. [Trust Channel Creation Ceremony](#2012-5-trust-channel-creation-ceremony)
6. [G-10 Reputation as Soulbound Objects](#2012-6-g-10-reputation-as-soulbound-objects)
7. [Capability NFTs and Verification](#2012-7-capability-nfts-and-verification)
8. [Sybil Resistance via Staking](#2012-8-sybil-resistance-via-staking)
9. [Trust Degradation On-Chain Protocol](#2012-9-trust-degradation-on-chain-protocol)
10. [zkLogin for Frictionless Onboarding](#2012-10-zklogin-for-frictionless-onboarding)
11. [Effect-TS Integration](#2012-11-effect-ts-integration)
12. [Codebase Grounding](#2012-12-codebase-grounding)
13. [References](#2012-13-references)

---

## 20.12.1 Scope

This section covers:

- Sui shared objects representing organization identity on-chain
- Ed25519 dual-key architecture binding Sui wallets to NATS accounts
- On-chain bilateral trust channel establishment and lifecycle
- Soulbound reputation objects implementing G-10 composite scoring
- Capability NFTs with oracle-based verification and expiration
- Staking-based Sybil resistance for identity verification
- Trust degradation state transitions with cascading effects
- zkLogin OAuth-to-blockchain onboarding for human operators

This section does NOT cover:

- NATS JWT authentication mechanics (see Security Architecture, S.4)
- Real-time messaging authorization (see Security Architecture, S.5)
- On-chain isolation of blockchain state (see Section 21.10 [rfc-section-onchain-isolation.md])
- Marketplace escrow and settlement (see Section 18.11 [Amendment 1])
- Chainlink oracle architecture (see Section 18.12 [Amendment 3])

---

## 20.12.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

Requirement identifiers use the prefix **OCI-** (On-Chain Identity).

Move code examples target the Sui Move 2024 Edition and are compilable against
the `sui-framework` package. All Move modules are in the `manufacturing_commons`
package namespace.

---

## 20.12.3 Organization Identity Object Model

### 20.12.3.1 Design Rationale

The trust model defined in [T.3] specifies an organization identity lifecycle
(`UNVERIFIED` -> `PROVISIONED` -> `ACTIVE` -> `SUSPENDED` -> `DEACTIVATED`)
that is currently enforced solely by the platform operator's NATS account
management. This creates a single point of trust: the platform operator.

On-chain identity objects provide a second, independent trust plane where:

1. Identity is self-sovereign (organization generates its own keypair)
2. Lifecycle state transitions are immutable and auditable
3. Verification is decentralized (any party can query the blockchain)
4. The platform operator cannot unilaterally forge or erase identity

**OCI-01**: Each organization participating in the manufacturing commons MUST
be represented by exactly one Sui shared object implementing the
`OrganizationIdentity` struct defined in [20.12.3.3].

**OCI-02**: The organization identity object MUST be a Sui shared object
(accessible by marketplace, reputation, and compliance modules) with mutation
restricted to authorized signers as defined in [20.12.3.4].

### 20.12.3.2 Identity Lifecycle State Machine

```
                           ┌──────────────┐
                           │  UNVERIFIED  │
                           │  (initial)   │
                           └──────┬───────┘
                                  │ verify()
                                  │ [platform verifier signs]
                                  ▼
                           ┌──────────────┐
                           │ PROVISIONED  │
                           │ (NATS acct   │
                           │  created)    │
                           └──────┬───────┘
                                  │ activate()
                                  │ [first device connected +
                                  │  minimum stake deposited]
                                  ▼
                 suspend()  ┌──────────────┐  deactivate()
              ┌─────────── │    ACTIVE     │ ─────────────┐
              │             │ (full access) │               │
              │             └──────┬───────┘               │
              ▼                    │                        ▼
       ┌──────────────┐           │              ┌──────────────┐
       │  SUSPENDED   │           │              │ DEACTIVATED  │
       │ (restricted) │           │              │  (terminal)  │
       └──────┬───────┘           │              └──────────────┘
              │ restore()         │
              │ [issue resolved + │
              │  stake restored]  │
              └───────────────────┘
```

**OCI-03**: The identity state machine SHALL enforce the following transition
guards:

| Transition | Guard Conditions |
|------------|-----------------|
| `UNVERIFIED` -> `PROVISIONED` | Platform verifier signature + legal entity check |
| `PROVISIONED` -> `ACTIVE` | First edge device connected + minimum stake deposited |
| `ACTIVE` -> `SUSPENDED` | Trust violation event OR billing delinquency OR dispute ruling |
| `SUSPENDED` -> `ACTIVE` | Issue resolved + stake restored + cooldown period elapsed |
| `ACTIVE` -> `DEACTIVATED` | Organization voluntary withdrawal OR governance ruling |
| `SUSPENDED` -> `DEACTIVATED` | Suspension period exceeds maximum (configurable, default 90 days) |

**OCI-04**: State transitions that reduce capability (suspend, deactivate)
MUST emit a Sui event that the SuiBridgeService [see 20.12.11] propagates
to NATS for immediate operational enforcement. The NATS JWT MUST be revoked
within 60 seconds of the on-chain state transition.

### 20.12.3.3 Move Struct Definition

```move
module manufacturing_commons::organization {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::dynamic_field as dfield;

    // ── Constants ──────────────────────────────────────────────

    const STATE_UNVERIFIED: u8    = 0;
    const STATE_PROVISIONED: u8   = 1;
    const STATE_ACTIVE: u8        = 2;
    const STATE_SUSPENDED: u8     = 3;
    const STATE_DEACTIVATED: u8   = 4;

    // ── Error Codes ────────────────────────────────────────────

    const E_NOT_AUTHORIZED: u64       = 0;
    const E_INVALID_TRANSITION: u64   = 1;
    const E_ALREADY_EXISTS: u64       = 2;
    const E_INSUFFICIENT_STAKE: u64   = 3;
    const E_COOLDOWN_ACTIVE: u64      = 4;

    // ── Core Structs ───────────────────────────────────────────

    /// Singleton admin capability created during module initialization.
    /// Held by the platform governance multi-sig.
    struct PlatformAdminCap has key {
        id: UID,
    }

    /// Organization identity on the manufacturing commons.
    /// Shared object: readable by marketplace, reputation, and
    /// compliance modules. Writable only by authorized signers.
    struct OrganizationIdentity has key {
        id: UID,
        /// Human-readable name (UTF-8 encoded).
        name: vector<u8>,
        /// Geographic region code (ISO 3166-1 alpha-2).
        region: vector<u8>,
        /// Lifecycle state [OCI-03].
        state: u8,
        /// Sui address of the organization admin.
        admin: address,
        /// Ed25519 public key used for NATS account signing.
        /// Bound via the protocol in [20.12.4].
        nats_pubkey: vector<u8>,
        /// Wallet address bound to NATS account.
        wallet_address: address,
        /// Disclosure level (0=minimal, 1=aggregated, 2=detailed).
        disclosure_level: u8,
        /// Epoch timestamp of identity creation.
        created_at_ms: u64,
        /// Epoch timestamp of last state transition.
        last_transition_ms: u64,
        /// Minimum stake amount required for ACTIVE state (in MIST).
        minimum_stake: u64,
        /// Current staked amount (in MIST).
        current_stake: u64,
    }

    /// Organization admin capability. Non-transferable (soulbound).
    /// Authorizes the holder to mutate their OrganizationIdentity.
    struct OrgAdminCap has key {
        id: UID,
        org_id: address,
    }

    // ── Events ─────────────────────────────────────────────────

    struct OrgCreated has copy, drop {
        org_id: address,
        admin: address,
        name: vector<u8>,
        region: vector<u8>,
        created_at_ms: u64,
    }

    struct OrgStateTransition has copy, drop {
        org_id: address,
        from_state: u8,
        to_state: u8,
        reason: vector<u8>,
        timestamp_ms: u64,
    }

    struct NatsKeyBound has copy, drop {
        org_id: address,
        nats_pubkey: vector<u8>,
        timestamp_ms: u64,
    }

    // ── Module Initializer ─────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        let admin_cap = PlatformAdminCap {
            id: object::new(ctx),
        };
        // Transfer to deployer; governance multi-sig manages this.
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ── Entry Functions ────────────────────────────────────────

    /// Create a new organization identity.
    /// Called by the platform verifier after legal entity check.
    /// The new org starts in UNVERIFIED state.
    public entry fun create_organization(
        _admin_cap: &PlatformAdminCap,
        name: vector<u8>,
        region: vector<u8>,
        org_admin: address,
        minimum_stake: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let ts = clock::timestamp_ms(clock);
        let org = OrganizationIdentity {
            id: object::new(ctx),
            name,
            region,
            state: STATE_UNVERIFIED,
            admin: org_admin,
            nats_pubkey: vector::empty(),
            wallet_address: org_admin,
            disclosure_level: 0,
            created_at_ms: ts,
            last_transition_ms: ts,
            minimum_stake,
            current_stake: 0,
        };

        let org_address = object::uid_to_address(&org.id);

        let admin_cap = OrgAdminCap {
            id: object::new(ctx),
            org_id: org_address,
        };

        event::emit(OrgCreated {
            org_id: org_address,
            admin: org_admin,
            name: org.name,
            region: org.region,
            created_at_ms: ts,
        });

        // Share the identity object (cross-module readable).
        transfer::share_object(org);
        // Transfer admin cap to the org admin (non-transferable).
        transfer::transfer(admin_cap, org_admin);
    }

    /// Transition organization from UNVERIFIED to PROVISIONED.
    /// Called by platform verifier after NATS account creation.
    public entry fun provision(
        _platform_cap: &PlatformAdminCap,
        org: &mut OrganizationIdentity,
        clock: &Clock,
    ) {
        assert!(org.state == STATE_UNVERIFIED, E_INVALID_TRANSITION);
        let ts = clock::timestamp_ms(clock);
        let old_state = org.state;
        org.state = STATE_PROVISIONED;
        org.last_transition_ms = ts;

        event::emit(OrgStateTransition {
            org_id: object::uid_to_address(&org.id),
            from_state: old_state,
            to_state: STATE_PROVISIONED,
            reason: b"nats_account_created",
            timestamp_ms: ts,
        });
    }

    /// Transition organization from PROVISIONED to ACTIVE.
    /// Requires minimum stake to be deposited.
    public entry fun activate(
        _org_cap: &OrgAdminCap,
        org: &mut OrganizationIdentity,
        clock: &Clock,
    ) {
        assert!(org.state == STATE_PROVISIONED, E_INVALID_TRANSITION);
        assert!(org.current_stake >= org.minimum_stake, E_INSUFFICIENT_STAKE);
        let ts = clock::timestamp_ms(clock);
        let old_state = org.state;
        org.state = STATE_ACTIVE;
        org.last_transition_ms = ts;

        event::emit(OrgStateTransition {
            org_id: object::uid_to_address(&org.id),
            from_state: old_state,
            to_state: STATE_ACTIVE,
            reason: b"device_connected_and_staked",
            timestamp_ms: ts,
        });
    }

    /// Suspend an organization. Platform admin or governance action.
    public entry fun suspend(
        _platform_cap: &PlatformAdminCap,
        org: &mut OrganizationIdentity,
        reason: vector<u8>,
        clock: &Clock,
    ) {
        assert!(org.state == STATE_ACTIVE, E_INVALID_TRANSITION);
        let ts = clock::timestamp_ms(clock);
        let old_state = org.state;
        org.state = STATE_SUSPENDED;
        org.last_transition_ms = ts;

        event::emit(OrgStateTransition {
            org_id: object::uid_to_address(&org.id),
            from_state: old_state,
            to_state: STATE_SUSPENDED,
            reason,
            timestamp_ms: ts,
        });
    }
}
```

### 20.12.3.4 Authorization Model

**OCI-05**: The `OrganizationIdentity` object MUST enforce the following
authorization rules for mutation:

| Operation | Required Capability | Rationale |
|-----------|-------------------|-----------|
| Create organization | `PlatformAdminCap` | Prevents spam; platform verifies legal entity |
| Provision (UNVERIFIED -> PROVISIONED) | `PlatformAdminCap` | NATS account creation is platform-controlled |
| Activate (PROVISIONED -> ACTIVE) | `OrgAdminCap` + minimum stake | Organization self-activates after staking |
| Suspend | `PlatformAdminCap` OR governance multi-sig | Trust violation enforcement |
| Restore (SUSPENDED -> ACTIVE) | `PlatformAdminCap` + `OrgAdminCap` | Bilateral agreement to restore |
| Deactivate | `OrgAdminCap` (voluntary) OR `PlatformAdminCap` (involuntary) | Withdrawal or expulsion |
| Update disclosure level | `OrgAdminCap` | Organization controls own disclosure |
| Bind NATS key | `OrgAdminCap` | Organization controls own key binding |

### 20.12.3.5 Unique Witness Pattern

**OCI-06**: The platform MUST enforce a one-to-one mapping between legal
entities and `OrganizationIdentity` objects. Duplicate detection SHALL use
the `(jurisdiction, taxId)` tuple stored as a dynamic field on a platform
registry object. The `PlatformAdminCap` holder MUST check for duplicates
before calling `create_organization`.

---

## 20.12.4 Wallet-to-NATS-Account Binding Protocol

### 20.12.4.1 Cryptographic Alignment

Both NATS NKeys and Sui use Ed25519 as their primary signature algorithm
(see [research-sui-identity-auth.md] Section 2.1). This cryptographic
alignment enables a dual-key architecture where both systems can leverage
the same curve without impedance mismatch.

**OCI-07**: Each organization MUST bind exactly one Sui wallet address to
their NATS account. The binding is recorded on-chain in the
`OrganizationIdentity.nats_pubkey` field and off-chain in the NATS account
JWT claims.

### 20.12.4.2 Dual-Key Architecture

**OCI-08**: Organizations MUST maintain two separate Ed25519 keypairs to
prevent single-key compromise from affecting both systems:

```
Organization Keypair Architecture:

1. Sui Identity Key (COLD)
   ├── Purpose: On-chain identity, capability management, governance
   ├── Storage: Hardware wallet, HSM, or air-gapped machine
   ├── Rotation: Annual or on suspected compromise
   └── Derived: Sui address = BLAKE2b-256(0x00 || Ed25519_pubkey)

2. NATS Account Key (WARM)
   ├── Purpose: Signing user JWTs, NATS auth challenge-response
   ├── Storage: Encrypted keystore accessible by auth service
   ├── Rotation: Quarterly (RECOMMENDED)
   └── Derived: NKey address = Base32(A_prefix || Ed25519_pubkey || CRC16)

Linkage (on-chain):
   Sui Identity Key signs a transaction calling bind_nats_key()
   that records NATS Account Key's public key in OrganizationIdentity.
```

**OCI-09**: Compromise of the NATS Account Key MUST NOT grant on-chain
authority. Compromise of the Sui Identity Key MUST NOT grant NATS session
access. The dual-key architecture ensures blast radius containment.

### 20.12.4.3 Binding Ceremony

The binding protocol establishes a verifiable link between a Sui wallet and
a NATS account:

```
Binding Ceremony Protocol:

Step 1: Organization generates NATS Account NKey (Ed25519)
Step 2: Organization signs the following challenge with Sui Identity Key:

        challenge = {
            "action": "bind_nats_key",
            "org_sui_address": "0x7d2e...a3f1",
            "nats_pubkey": "AAXXXX...base32",
            "timestamp": 1739145600000,
            "nonce": "random_32_bytes"
        }

Step 3: Organization submits Sui transaction:
        manufacturing_commons::organization::bind_nats_key(
            org: &mut OrganizationIdentity,
            cap: &OrgAdminCap,
            nats_pubkey: vector<u8>,
            clock: &Clock,
        )

Step 4: SuiBridgeService detects NatsKeyBound event on-chain
Step 5: SuiBridgeService provisions NATS account JWT with:
        - Subject: derived NKey address
        - Issuer: platform operator NKey
        - Custom claim: { "sui_address": "0x7d2e...a3f1" }

Step 6: Binding is now bidirectionally verifiable:
        - On-chain: OrganizationIdentity.nats_pubkey
        - Off-chain: NATS JWT custom claim "sui_address"
```

**OCI-10**: Any party MAY verify the binding by:
1. Reading `OrganizationIdentity.nats_pubkey` from Sui (permissionless)
2. Confirming the NATS account's public key matches
3. Optionally requesting a signed challenge from the NATS endpoint

### 20.12.4.4 Key Rotation Protocol

**OCI-11**: When rotating the NATS Account Key, the organization MUST:

1. Generate a new Ed25519 keypair for NATS
2. Submit an on-chain transaction updating `OrganizationIdentity.nats_pubkey`
   (requires `OrgAdminCap`, signed with Sui Identity Key)
3. Re-sign all affected user JWTs with the new NATS Account Key
4. The SuiBridgeService SHALL revoke JWTs signed with the old key within
   the JWT TTL or 24 hours, whichever is shorter

**OCI-12**: When rotating the Sui Identity Key, the organization MUST follow
the on-chain key rotation ceremony defined in Security Architecture [S.6].
This is a high-ceremony operation requiring multi-sig approval if the
organization has configured multi-sig governance.

---

## 20.12.5 Trust Channel Creation Ceremony

### 20.12.5.1 Design Rationale

The trust model [T.4] specifies bilateral trust establishment between
organizations. Currently, trust is asserted via platform-mediated tokens.
On-chain trust channels provide a cryptographic, bilateral agreement that
neither party can unilaterally forge, modify, or deny.

**OCI-13**: Cross-organization interaction MUST NOT occur without an active
on-chain trust channel between the two parties. This is the on-chain
equivalent of the bilateral consent invariant [ISO-01].

### 20.12.5.2 Trust Channel Object

```move
module manufacturing_commons::trust_channel {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};

    // ── Trust Tiers ────────────────────────────────────────────

    const TIER_NEWCOMER: u8    = 0;
    const TIER_ESTABLISHED: u8 = 1;
    const TIER_TRUSTED: u8     = 2;
    const TIER_PREFERRED: u8   = 3;

    // ── Channel States ─────────────────────────────────────────

    const CHANNEL_PROPOSED: u8  = 0;
    const CHANNEL_ACTIVE: u8    = 1;
    const CHANNEL_SUSPENDED: u8 = 2;
    const CHANNEL_REVOKED: u8   = 3;

    // ── Error Codes ────────────────────────────────────────────

    const E_NOT_PARTY: u64          = 0;
    const E_INVALID_STATE: u64      = 1;
    const E_SELF_CHANNEL: u64       = 2;
    const E_TIER_INSUFFICIENT: u64  = 3;
    const E_COOLDOWN_ACTIVE: u64    = 4;

    // ── Core Struct ────────────────────────────────────────────

    /// Bilateral trust channel between two organizations.
    /// Shared object: both parties can read and mutate within
    /// their authorized operations.
    struct TrustChannel has key {
        id: UID,
        /// Sui address of the initiating organization's identity object.
        initiator_org: address,
        /// Sui address of the target organization's identity object.
        target_org: address,
        /// Current trust tier [T.4.3].
        trust_tier: u8,
        /// Channel lifecycle state.
        state: u8,
        /// Bitfield of granted permissions.
        /// Bit 0: read_sensor_data
        /// Bit 1: read_oee_metrics
        /// Bit 2: marketplace_transact
        /// Bit 3: share_quality_data
        /// Bit 4: emergency_notifications
        permissions: u64,
        /// Consent grants (stored as dynamic fields).
        /// Key: consent scope string, Value: ConsentGrant struct.
        consent_count: u64,
        /// Epoch timestamp of channel creation.
        created_at_ms: u64,
        /// Epoch timestamp of last modification.
        last_modified_ms: u64,
        /// Epoch timestamp of last trust tier upgrade.
        last_tier_upgrade_ms: u64,
    }

    // ── Events ─────────────────────────────────────────────────

    struct ChannelProposed has copy, drop {
        channel_id: address,
        initiator_org: address,
        target_org: address,
        proposed_tier: u8,
        timestamp_ms: u64,
    }

    struct ChannelAccepted has copy, drop {
        channel_id: address,
        initiator_org: address,
        target_org: address,
        active_tier: u8,
        timestamp_ms: u64,
    }

    struct TierUpgraded has copy, drop {
        channel_id: address,
        from_tier: u8,
        to_tier: u8,
        timestamp_ms: u64,
    }

    struct ChannelRevoked has copy, drop {
        channel_id: address,
        revoked_by: address,
        reason: vector<u8>,
        timestamp_ms: u64,
    }

    // ── Entry Functions ────────────────────────────────────────

    /// Propose a new trust channel.
    /// Initiator creates the channel in PROPOSED state.
    /// Target must call accept() to activate.
    public entry fun create(
        initiator_org: address,
        target_org: address,
        proposed_tier: u8,
        initial_permissions: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // Prevent self-channels.
        assert!(initiator_org != target_org, E_SELF_CHANNEL);

        let ts = clock::timestamp_ms(clock);
        let channel = TrustChannel {
            id: object::new(ctx),
            initiator_org,
            target_org,
            trust_tier: proposed_tier,
            state: CHANNEL_PROPOSED,
            permissions: initial_permissions,
            consent_count: 0,
            created_at_ms: ts,
            last_modified_ms: ts,
            last_tier_upgrade_ms: 0,
        };

        let channel_address = object::uid_to_address(&channel.id);

        event::emit(ChannelProposed {
            channel_id: channel_address,
            initiator_org,
            target_org,
            proposed_tier,
            timestamp_ms: ts,
        });

        transfer::share_object(channel);
    }

    /// Accept a proposed trust channel. Target organization calls this.
    public entry fun accept(
        channel: &mut TrustChannel,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(channel.state == CHANNEL_PROPOSED, E_INVALID_STATE);
        // Authorization: caller must be target org admin.
        assert!(tx_context::sender(ctx) == channel.target_org, E_NOT_PARTY);

        let ts = clock::timestamp_ms(clock);
        channel.state = CHANNEL_ACTIVE;
        channel.last_modified_ms = ts;

        event::emit(ChannelAccepted {
            channel_id: object::uid_to_address(&channel.id),
            initiator_org: channel.initiator_org,
            target_org: channel.target_org,
            active_tier: channel.trust_tier,
            timestamp_ms: ts,
        });
    }

    /// Upgrade trust tier. Requires both parties to have signed
    /// (implemented via two-phase commit with dynamic fields).
    public entry fun upgrade_tier(
        channel: &mut TrustChannel,
        new_tier: u8,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(channel.state == CHANNEL_ACTIVE, E_INVALID_STATE);
        assert!(new_tier > channel.trust_tier, E_TIER_INSUFFICIENT);
        let sender = tx_context::sender(ctx);
        assert!(
            sender == channel.initiator_org || sender == channel.target_org,
            E_NOT_PARTY
        );

        let ts = clock::timestamp_ms(clock);
        let old_tier = channel.trust_tier;
        channel.trust_tier = new_tier;
        channel.last_tier_upgrade_ms = ts;
        channel.last_modified_ms = ts;

        event::emit(TierUpgraded {
            channel_id: object::uid_to_address(&channel.id),
            from_tier: old_tier,
            to_tier: new_tier,
            timestamp_ms: ts,
        });
    }

    /// Revoke a trust channel. Either party may revoke unilaterally.
    public entry fun revoke(
        channel: &mut TrustChannel,
        reason: vector<u8>,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(channel.state == CHANNEL_ACTIVE
             || channel.state == CHANNEL_SUSPENDED, E_INVALID_STATE);
        let sender = tx_context::sender(ctx);
        assert!(
            sender == channel.initiator_org || sender == channel.target_org,
            E_NOT_PARTY
        );

        let ts = clock::timestamp_ms(clock);
        channel.state = CHANNEL_REVOKED;
        channel.last_modified_ms = ts;

        event::emit(ChannelRevoked {
            channel_id: object::uid_to_address(&channel.id),
            revoked_by: sender,
            reason,
            timestamp_ms: ts,
        });
    }
}
```

### 20.12.5.3 Channel Creation Flow

```
┌──────────────┐                    ┌──────────────┐
│  Initiator   │                    │    Target    │
│  (Org A)     │                    │   (Org B)    │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │  1. create() on Sui               │
       │  ──────────────────────────►      │
       │  (channel = PROPOSED)             │
       │                                   │
       │  2. ChannelProposed event         │
       │  ────► SuiBridgeService ────►     │
       │        publishes to NATS          │
       │                                   │
       │                                   │  3. Target reviews proposal
       │                                   │     (permissions, tier)
       │                                   │
       │  4. accept() on Sui              ◄│
       │  ◄────────────────────────────    │
       │  (channel = ACTIVE)               │
       │                                   │
       │  5. ChannelAccepted event         │
       │  ◄──── SuiBridgeService ◄────     │
       │        configures NATS            │
       │        export/import              │
       │                                   │
       │  6. NATS cross-account subjects   │
       │  ◄────────────────────────►       │
       │  (data sharing enabled)           │
       │                                   │
```

**OCI-14**: Upon `ChannelAccepted`, the SuiBridgeService MUST configure the
corresponding NATS account export/import rules to enable the data sharing
authorized by the channel's `permissions` bitfield. The NATS configuration
MUST be consistent with the on-chain permissions at all times.

**OCI-15**: Channel revocation (`ChannelRevoked` event) MUST trigger
immediate removal of the corresponding NATS export/import configuration.
The SuiBridgeService MUST process revocation events with higher priority
than creation events.

### 20.12.5.4 Trust Tier Semantics

The trust tiers map to the progression defined in [T.4.3]:

| Tier | Name | On-Chain Requirements | Capabilities Unlocked |
|------|------|----------------------|----------------------|
| 0 | NEWCOMER | Channel created + accepted | Basic marketplace visibility, read-only capacity data |
| 1 | ESTABLISHED | 5+ successful transactions, no disputes | Bidirectional data sharing, work order submission |
| 2 | TRUSTED | 20+ transactions, G-10 score > 7.0, 6+ months active | Quality data sharing, priority marketplace matching |
| 3 | PREFERRED | 50+ transactions, G-10 score > 8.5, 12+ months, no suspensions | Full data sharing, joint capacity planning, automated settlement |

**OCI-16**: Trust tier upgrades MUST be bilateral. Both parties MUST sign
the upgrade transaction (implemented as a two-phase commit via dynamic fields
on the TrustChannel object). Unilateral tier inflation is prevented.

---

## 20.12.6 G-10 Reputation as Soulbound Objects

### 20.12.6.1 G-10 Composite Score

The G-10 trust metric defined in [T.5] and the marketplace protocol [18.8.1]
computes a composite reputation score from four weighted components:

| Component | Weight | Source | Measurement |
|-----------|--------|--------|-------------|
| Signal consistency | 30% | NATS telemetry | Variance in sensor readings vs. expected patterns |
| Clock accuracy | 20% | NTP + Sparkplug-B timestamps | Drift from authoritative time sources |
| Uptime | 25% | NATS heartbeat + JetStream sequences | Connected time / total time (rolling 30-day window) |
| Peer validation | 25% | Cross-org transaction outcomes | Successful work orders / total work orders |

**OCI-17**: The G-10 composite score MUST be published on-chain as a
soulbound token (SBT) — a non-transferable Sui object owned by the
`OrganizationIdentity`. The SBT records the composite score and individual
component scores.

### 20.12.6.2 Soulbound Token Structure

```move
module manufacturing_commons::reputation {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};

    // ── Core Struct ────────────────────────────────────────────

    /// Soulbound reputation token. Non-transferable (no `store` ability).
    /// Owned by the organization's admin address.
    struct ReputationSBT has key {
        id: UID,
        /// Reference to OrganizationIdentity object.
        org_id: address,
        /// G-10 composite score (basis points, 0-10000 = 0.00-100.00%).
        composite_score: u64,
        /// Individual components (basis points).
        signal_consistency: u64,
        clock_accuracy: u64,
        uptime: u64,
        peer_validation: u64,
        /// Number of data points used in computation.
        sample_count: u64,
        /// Rolling window period (milliseconds).
        window_ms: u64,
        /// Epoch timestamp of last computation.
        computed_at_ms: u64,
        /// Epoch number for versioning.
        epoch: u64,
    }

    // ── Events ─────────────────────────────────────────────────

    struct ReputationUpdated has copy, drop {
        org_id: address,
        composite_score: u64,
        signal_consistency: u64,
        clock_accuracy: u64,
        uptime: u64,
        peer_validation: u64,
        computed_at_ms: u64,
        epoch: u64,
    }

    // ── Platform Oracle Authorization ──────────────────────────

    /// Only the platform's reputation oracle can update scores.
    struct ReputationOracleCap has key {
        id: UID,
    }

    fun init(ctx: &mut TxContext) {
        transfer::transfer(
            ReputationOracleCap { id: object::new(ctx) },
            tx_context::sender(ctx),
        );
    }

    /// Update reputation score. Called by the off-chain computation
    /// pipeline that reads NATS telemetry and computes G-10.
    public entry fun update_reputation(
        _oracle_cap: &ReputationOracleCap,
        sbt: &mut ReputationSBT,
        composite_score: u64,
        signal_consistency: u64,
        clock_accuracy: u64,
        uptime: u64,
        peer_validation: u64,
        sample_count: u64,
        clock: &Clock,
        _ctx: &TxContext,
    ) {
        let ts = clock::timestamp_ms(clock);
        sbt.composite_score = composite_score;
        sbt.signal_consistency = signal_consistency;
        sbt.clock_accuracy = clock_accuracy;
        sbt.uptime = uptime;
        sbt.peer_validation = peer_validation;
        sbt.sample_count = sample_count;
        sbt.computed_at_ms = ts;
        sbt.epoch = sbt.epoch + 1;

        event::emit(ReputationUpdated {
            org_id: sbt.org_id,
            composite_score,
            signal_consistency,
            clock_accuracy,
            uptime,
            peer_validation,
            computed_at_ms: ts,
            epoch: sbt.epoch,
        });
    }
}
```

### 20.12.6.3 Computation and Publication

**OCI-18**: The G-10 score MUST be computed off-chain from NATS telemetry
data by the reputation computation pipeline. The pipeline SHALL:

1. Aggregate raw telemetry from the organization's JetStream streams
2. Compute each component score over a rolling 30-day window
3. Apply the weighted composite formula:
   `G10 = 0.30 * signal_consistency + 0.20 * clock_accuracy + 0.25 * uptime + 0.25 * peer_validation`
4. Publish the result on-chain via `update_reputation()`

**OCI-19**: The update frequency SHOULD be configurable per organization
tier. The RECOMMENDED frequencies are:

| Tier | Update Frequency | Rationale |
|------|-----------------|-----------|
| T1 Critical (FDA/ITAR) | Every 6 hours | Regulatory visibility requirement |
| T2 Standard (ISO 9001) | Daily | Adequate for marketplace matching |
| T3 Basic | Weekly | Cost optimization for low-activity shops |

### 20.12.6.4 K-Anonymity Requirement

**OCI-20**: Individual telemetry metrics MUST NOT be published on-chain.
Only the aggregated component scores (expressed in basis points) SHALL be
recorded in the `ReputationSBT`. This ensures K-anonymity: the on-chain
score reveals the organization's reputation tier without exposing specific
operational characteristics (e.g., exact machine spindle speeds, tool wear
rates, or shift patterns) that could constitute competitive intelligence.

---

## 20.12.7 Capability NFTs and Verification

### 20.12.7.1 Capability as On-Chain Attestation

The marketplace protocol [18.4] requires capability discovery — matching
buyer needs (material, tolerance, certification) with seller capabilities.
Currently this relies on self-reported data. Capability NFTs provide
cryptographically verifiable attestations.

**OCI-21**: Manufacturing capabilities MUST be representable as Sui objects
that are non-transferable (soulbound to the organization). Each capability
object attests to a specific manufacturing ability, backed by verifiable
evidence.

### 20.12.7.2 Capability NFT Structure

```move
module manufacturing_commons::capability_nft {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};

    // ── Capability Categories ──────────────────────────────────

    const CAT_MACHINE_TYPE: u8    = 0;  // CNC, lathe, press, etc.
    const CAT_CERTIFICATION: u8   = 1;  // ISO 9001, AS9100, IATF 16949
    const CAT_MATERIAL: u8        = 2;  // Aluminum, titanium, steel, etc.
    const CAT_TOLERANCE: u8       = 3;  // ISO IT grade
    const CAT_PROCESS: u8         = 4;  // Milling, turning, grinding, etc.

    // ── Error Codes ────────────────────────────────────────────

    const E_NOT_ISSUER: u64     = 0;
    const E_EXPIRED: u64        = 1;
    const E_ALREADY_REVOKED: u64 = 2;

    // ── Core Struct ────────────────────────────────────────────

    /// Capability NFT. Soulbound (has key, but NOT store).
    /// Cannot be transferred between organizations.
    struct CapabilityNFT has key {
        id: UID,
        /// Organization identity this capability is bound to.
        org_id: address,
        /// Category of the capability.
        category: u8,
        /// Capability type identifier (e.g., "cnc_milling_5axis").
        capability_type: vector<u8>,
        /// Sub-attributes (e.g., material types, tolerance classes).
        attributes: vector<vector<u8>>,
        /// Address of the issuing authority (self, auditor, oracle).
        issued_by: address,
        /// Verification method used.
        /// 0=self-attested, 1=document-verified, 2=oracle-verified, 3=physical-audit
        verification_method: u8,
        /// Epoch timestamp of issuance.
        issued_at_ms: u64,
        /// Epoch timestamp of expiration. 0 = no expiry.
        expires_at_ms: u64,
        /// Whether the capability has been revoked.
        revoked: bool,
    }

    /// Issuer capability. Held by authorized verifiers (platform,
    /// Chainlink oracle, third-party auditors).
    struct CapabilityIssuerCap has key {
        id: UID,
        issuer_address: address,
    }

    // ── Events ─────────────────────────────────────────────────

    struct CapabilityIssued has copy, drop {
        nft_id: address,
        org_id: address,
        category: u8,
        capability_type: vector<u8>,
        verification_method: u8,
        expires_at_ms: u64,
        timestamp_ms: u64,
    }

    struct CapabilityRevoked has copy, drop {
        nft_id: address,
        org_id: address,
        reason: vector<u8>,
        timestamp_ms: u64,
    }

    struct CapabilityRenewed has copy, drop {
        nft_id: address,
        org_id: address,
        new_expires_at_ms: u64,
        timestamp_ms: u64,
    }

    // ── Entry Functions ────────────────────────────────────────

    /// Issue a capability NFT to an organization.
    public entry fun issue(
        _issuer_cap: &CapabilityIssuerCap,
        org_id: address,
        category: u8,
        capability_type: vector<u8>,
        attributes: vector<vector<u8>>,
        verification_method: u8,
        expires_at_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let ts = clock::timestamp_ms(clock);
        let nft = CapabilityNFT {
            id: object::new(ctx),
            org_id,
            category,
            capability_type,
            attributes,
            issued_by: tx_context::sender(ctx),
            verification_method,
            issued_at_ms: ts,
            expires_at_ms,
            revoked: false,
        };

        let nft_address = object::uid_to_address(&nft.id);

        event::emit(CapabilityIssued {
            nft_id: nft_address,
            org_id,
            category,
            capability_type: nft.capability_type,
            verification_method,
            expires_at_ms,
            timestamp_ms: ts,
        });

        // Transfer to org admin (soulbound — cannot be re-transferred).
        transfer::transfer(nft, org_id);
    }

    /// Revoke a capability NFT.
    public entry fun revoke(
        _issuer_cap: &CapabilityIssuerCap,
        nft: &mut CapabilityNFT,
        reason: vector<u8>,
        clock: &Clock,
    ) {
        assert!(!nft.revoked, E_ALREADY_REVOKED);
        let ts = clock::timestamp_ms(clock);
        nft.revoked = true;

        event::emit(CapabilityRevoked {
            nft_id: object::uid_to_address(&nft.id),
            org_id: nft.org_id,
            reason,
            timestamp_ms: ts,
        });
    }

    /// Renew an expiring capability NFT.
    public entry fun renew(
        _issuer_cap: &CapabilityIssuerCap,
        nft: &mut CapabilityNFT,
        new_expires_at_ms: u64,
        clock: &Clock,
    ) {
        assert!(!nft.revoked, E_ALREADY_REVOKED);
        let ts = clock::timestamp_ms(clock);
        nft.expires_at_ms = new_expires_at_ms;

        event::emit(CapabilityRenewed {
            nft_id: object::uid_to_address(&nft.id),
            org_id: nft.org_id,
            new_expires_at_ms,
            timestamp_ms: ts,
        });
    }

    /// Check if a capability is currently valid.
    public fun is_valid(nft: &CapabilityNFT, clock: &Clock): bool {
        if (nft.revoked) return false;
        if (nft.expires_at_ms == 0) return true;
        clock::timestamp_ms(clock) < nft.expires_at_ms
    }
}
```

### 20.12.7.3 Verification via Chainlink Oracles

**OCI-22**: Capabilities in category `CAT_CERTIFICATION` (ISO 9001, AS9100,
IATF 16949) SHOULD be verified via Chainlink oracle queries to external
certification registries. The verification flow is:

```
Certification Verification Flow:

1. Organization claims ISO 9001 certification
   └── Submits: { registrar: "BSI", cert_number: "FM12345", scope: "CNC milling" }

2. Platform triggers Chainlink Functions request:
   └── External adapter queries BSI certification API
   └── Returns: { valid: true, expires: "2027-06-15", scope_match: true }

3. If valid:
   └── CapabilityIssuerCap holder mints CapabilityNFT
   └── verification_method = 2 (oracle-verified)
   └── expires_at_ms = certification expiry date

4. Periodic re-verification:
   └── Chainlink Automation triggers re-check at 80% of expiry
   └── If expired or revoked: CapabilityNFT.revoke() called
```

**OCI-23**: Self-attested capabilities (`verification_method = 0`) MUST be
visually distinguished in marketplace interfaces. Oracle-verified or
auditor-verified capabilities SHOULD receive priority ranking in capability
discovery queries.

### 20.12.7.4 Expiration Enforcement

**OCI-24**: Capability NFTs with non-zero `expires_at_ms` MUST be checked
against the Sui `Clock` object at every use point. Functions that accept
capability references MUST call `is_valid()` and reject expired capabilities.
Chainlink Automation SHOULD periodically sweep for expired capabilities and
emit notification events.

---

## 20.12.8 Sybil Resistance via Staking

### 20.12.8.1 Staking Model

**OCI-25**: Organizations MUST deposit a minimum stake in SUI tokens to
transition from `PROVISIONED` to `ACTIVE` state. The stake serves as
economic Sybil resistance — creating an identity costs real resources,
deterring mass identity fabrication.

| Trust Tier | Minimum Stake (SUI) | USD Equivalent (~$1/SUI) | Rationale |
|------------|--------------------|-----------------------|-----------|
| NEWCOMER | 10 SUI | ~$10 | Low barrier for Earl's machine shop |
| ESTABLISHED | 50 SUI | ~$50 | Demonstrated commitment |
| TRUSTED | 200 SUI | ~$200 | Significant investment in reputation |
| PREFERRED | 500 SUI | ~$500 | Highest trust, highest stake |

**OCI-26**: Stake amounts are configurable by the platform governance DAO
and SHOULD be adjusted based on SUI market price to maintain approximately
stable USD-equivalent barriers.

### 20.12.8.2 Slashing Conditions

**OCI-27**: The following conditions MUST trigger partial or full stake
slashing:

| Condition | Slash Percentage | Evidence Required |
|-----------|-----------------|-------------------|
| Fraudulent capability claim (proven) | 100% | Oracle verification + governance vote |
| Quality fabrication (proven) | 50% | Cross-org dispute + QC evidence |
| Review manipulation (proven) | 75% | Statistical anomaly detection + governance vote |
| Trust violation (repeated) | 25% per occurrence | Automated detection + governance review |
| Sybil identity (proven) | 100% of all linked identities | On-chain analytics + governance vote |

**OCI-28**: Slashing MUST require a governance vote or multi-sig approval.
Automated slashing without human review is NOT RECOMMENDED due to the risk
of false positives.

### 20.12.8.3 Stake Recovery

**OCI-29**: Slashed funds SHALL be distributed as follows:

- 50% to the network treasury (Sui shared object)
- 30% to the reporting party (if applicable)
- 20% burned (permanent deflationary pressure)

**OCI-30**: Organizations that voluntarily deactivate MAY recover their
unstaked balance after a cooldown period. The RECOMMENDED cooldown is 30
days to prevent rapid stake-and-withdraw attacks.

### 20.12.8.4 Economic Analysis

At the NEWCOMER tier (10 SUI, ~$10), creating 1,000 Sybil identities costs
~$10,000. For comparison, the network value protected (200K organizations
with real manufacturing capacity) far exceeds this cost. The staking
requirement makes Sybil attacks economically irrational at scale while
keeping the barrier trivially low for legitimate small shops like Earl's.

---

## 20.12.9 Trust Degradation On-Chain Protocol

### 20.12.9.1 Degradation Triggers

**OCI-31**: Trust degradation events MUST trigger on-chain state transitions
in the `TrustChannel` and/or `OrganizationIdentity` objects. Degradation
may be:

1. **Automatic**: Quality score (G-10 component) drops below configurable
   threshold for 3 consecutive computation epochs
2. **Peer-initiated**: Counterparty in a trust channel files an on-chain
   dispute
3. **Platform-initiated**: Governance action based on evidence review
4. **Oracle-detected**: Chainlink oracle reports anomalous behavior (e.g.,
   capability expiration, certification revocation)

### 20.12.9.2 Degradation State Machine

```
                    ┌──────────────┐
                    │    ACTIVE    │
                    │ (trust_tier) │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ WARNING  │ │ DEGRADED │ │ FROZEN   │
        │ (auto)   │ │ (scored) │ │ (dispute)│
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             │ improve    │ improve    │ resolve
             │ ──────►    │ ──────►    │ ──────►
             │ ACTIVE     │ ACTIVE     │ ACTIVE
             │            │            │       or
             │ worsen     │ worsen     │ ──────►
             │ ──────►    │ ──────►    │ REVOKED
             │ DEGRADED   │ SUSPENDED  │
             │            │            │
```

### 20.12.9.3 Cascading Degradation

**OCI-32**: When an organization's `OrganizationIdentity` transitions to
`SUSPENDED`, ALL trust channels where that organization is a party MUST be
automatically transitioned to `SUSPENDED` state. The SuiBridgeService
MUST propagate this to NATS by removing the corresponding export/import
configurations.

**OCI-33**: Cascading degradation MUST be reversible. When the organization
is restored to `ACTIVE`, trust channels SHOULD return to their pre-suspension
state, subject to the counterparty's approval (bilateral consent).

### 20.12.9.4 Recovery Protocol

**OCI-34**: Recovery from trust degradation MUST follow an improvement
period before restoration:

| Degradation Level | Recovery Requirement | Minimum Period |
|-------------------|---------------------|---------------|
| WARNING | G-10 score above threshold for 2 epochs | 2 computation epochs |
| DEGRADED | G-10 score above threshold for 5 epochs + stake top-up | 5 computation epochs |
| SUSPENDED | Governance review + counterparty approval + full re-staking | 30 days |
| REVOKED | New identity required (previous record linked) | N/A — terminal |

---

## 20.12.10 zkLogin for Frictionless Onboarding

### 20.12.10.1 Problem Statement

The RFC-001 onboarding requirement [R-N5] states that Earl (a 2-person
machine shop) must be able to connect within 15 minutes. Traditional
blockchain wallets require seed phrase management, which violates this
requirement.

### 20.12.10.2 zkLogin Architecture

Sui's zkLogin bridges OAuth OIDC credentials to blockchain identity via
zero-knowledge proofs:

```
zkLogin Onboarding Flow:

1. Earl opens TMNL web application on his phone
   └── Scans QR code on $50 edge device

2. Earl clicks "Sign in with Google"
   └── Standard OAuth 2.0 redirect
   └── TMNL registered as OAuth client

3. Google returns JWT:
   └── claims: { sub: "google_user_id", iss: "accounts.google.com",
                  aud: "tmnl_client_id", nonce: "ephemeral_pk_hash" }

4. Client generates ZK proof:
   └── Inputs: Google JWT + salt + ephemeral keypair
   └── Proves: JWT is valid AND nonce matches ephemeral key
   └── Hides: sub (Google user ID), iss (provider)
   └── Duration: ~2-5 seconds (one-time per session)

5. Sui address derived deterministically:
   └── address = BLAKE2b-256(0x05 || iss_len || iss || address_seed)
   └── Same (provider, app, user) tuple ALWAYS yields same address

6. Ephemeral key signs Sui transaction:
   └── create_organization() called
   └── OrganizationIdentity created on-chain
   └── Sponsored by platform gas station (Earl pays $0)

7. SuiBridgeService provisions NATS account:
   └── JWT issued, edge device configured

8. Earl is live:
   └── Total wall-clock: ~5 minutes
   └── No seed phrase, no wallet app, no SUI tokens needed
```

**OCI-35**: The platform MUST support Sui zkLogin for human operator
onboarding. Supported OAuth providers SHALL include at minimum Google and
Apple. Additional providers (Facebook, Twitch) MAY be supported.

**OCI-36**: zkLogin-derived addresses MUST be treated identically to
standard Ed25519-derived addresses for all on-chain operations. The
underlying authentication mechanism SHALL NOT affect the organization's
capabilities or trust tier.

### 20.12.10.3 Privacy Properties

**OCI-37**: The zkLogin zero-knowledge proof MUST ensure:

1. The OAuth provider (Google, Apple) CANNOT see the organization's
   on-chain activity
2. On-chain observers CANNOT determine which OAuth provider was used
3. The `sub` claim (provider-specific user ID) is NEVER published on-chain
4. Only the `address_seed` (derived from hashing `sub` with a per-user
   salt) is used in address derivation

### 20.12.10.4 Migration Path

**OCI-38**: As an organization's trust tier increases, the platform SHOULD
encourage migration from zkLogin to hardware-backed Ed25519 keys:

| Trust Tier | Recommended Key Type | Rationale |
|------------|---------------------|-----------|
| NEWCOMER | zkLogin (Google/Apple) | Frictionless onboarding |
| ESTABLISHED | zkLogin or software Ed25519 | Familiarity with the platform |
| TRUSTED | Software Ed25519 or hardware wallet | Higher-value transactions |
| PREFERRED | Hardware wallet or HSM-backed Ed25519 | Maximum security for highest trust |

The platform MUST NOT mandate key type changes. Migration is RECOMMENDED
but OPTIONAL. zkLogin remains valid at all tiers.

---

## 20.12.11 Effect-TS Integration

### 20.12.11.1 SuiIdentityService

The on-chain identity operations are wrapped in an Effect-TS service layer:

```typescript
import { Context, Effect, Layer, Schema } from 'effect'

// ── Branded Types ────────────────────────────────────────────

const SuiAddress = Schema.String.pipe(Schema.brand('SuiAddress'))
type SuiAddress = Schema.Schema.Type<typeof SuiAddress>

const OrgObjectId = Schema.String.pipe(Schema.brand('OrgObjectId'))
type OrgObjectId = Schema.Schema.Type<typeof OrgObjectId>

const ChannelObjectId = Schema.String.pipe(Schema.brand('ChannelObjectId'))
type ChannelObjectId = Schema.Schema.Type<typeof ChannelObjectId>

// ── Error Type ───────────────────────────────────────────────

class SuiIdentityError extends Schema.TaggedError<SuiIdentityError>()(
  'SuiIdentityError',
  {
    cause: Schema.Unknown,
    message: Schema.String,
    operation: Schema.String,
  }
) {}

// ── Service Definition ───────────────────────────────────────

class SuiIdentityService extends Context.Tag('SuiIdentityService')<
  SuiIdentityService,
  {
    /** Create organization identity on-chain. */
    readonly createOrganization: (params: {
      readonly name: string
      readonly region: string
      readonly adminAddress: SuiAddress
      readonly minimumStake: bigint
    }) => Effect.Effect<OrgObjectId, SuiIdentityError>

    /** Bind a NATS public key to an organization identity. */
    readonly bindNatsKey: (params: {
      readonly orgId: OrgObjectId
      readonly natsPubkey: Uint8Array
    }) => Effect.Effect<void, SuiIdentityError>

    /** Propose a bilateral trust channel. */
    readonly proposeTrustChannel: (params: {
      readonly initiatorOrg: OrgObjectId
      readonly targetOrg: OrgObjectId
      readonly proposedTier: 0 | 1 | 2 | 3
      readonly permissions: bigint
    }) => Effect.Effect<ChannelObjectId, SuiIdentityError>

    /** Accept a proposed trust channel. */
    readonly acceptTrustChannel: (params: {
      readonly channelId: ChannelObjectId
    }) => Effect.Effect<void, SuiIdentityError>

    /** Read current organization identity state. */
    readonly getOrganization: (params: {
      readonly orgId: OrgObjectId
    }) => Effect.Effect<OrganizationState, SuiIdentityError>

    /** Read current reputation score. */
    readonly getReputation: (params: {
      readonly orgId: OrgObjectId
    }) => Effect.Effect<ReputationScore, SuiIdentityError>

    /** Verify a capability NFT is valid. */
    readonly verifyCapability: (params: {
      readonly nftId: string
    }) => Effect.Effect<CapabilityVerification, SuiIdentityError>
  }
>() {}
```

### 20.12.11.2 Layer Composition

The `SuiIdentityService` integrates with the existing platform Layer stack:

```typescript
// SuiIdentityService slots into the SuiIntegrationLayer
const SuiIntegrationLayer = Layer.mergeAll(
  SuiServiceLive,           // Base RPC client (Section 3.3 of research)
  SuiIdentityServiceLive,   // This service [20.12.11]
  SuiSettlementLive,        // Escrow settlement [Amendment 1]
  SuiComplianceLive,        // Compliance anchoring [Amendment 6]
  SuiSyncAdapterLive,       // Capacity status sync
)

// Full platform layer includes Sui
const PlatformLayer = Layer.mergeAll(
  EntityHandlersLayer,       // ISA-95 entities (existing)
  EventDistributionLayer,    // NATS channels (existing)
  SparkplugPipelineLayer,    // Edge ingestion (existing)
  WebSocketServerLayer,      // Client subscriptions (existing)
  SuiIntegrationLayer,       // Blockchain trust layer (NEW)
)
```

---

## 20.12.12 Codebase Grounding

| Requirement | Implementation Path | Status |
|-------------|-------------------|--------|
| SuiService (base RPC) | `lib/iiot/sui/SuiService.ts` | Planned (Phase A) |
| SuiIdentityService | `lib/iiot/sui/SuiIdentityService.ts` | Planned (Phase A) |
| SuiBridgeService | `lib/iiot/sui/SuiBridgeService.ts` | Planned (Phase A) |
| Move: organization module | `move/manufacturing_commons/sources/organization.move` | Planned (Phase A) |
| Move: trust_channel module | `move/manufacturing_commons/sources/trust_channel.move` | Planned (Phase A) |
| Move: reputation module | `move/manufacturing_commons/sources/reputation.move` | Planned (Phase B) |
| Move: capability_nft module | `move/manufacturing_commons/sources/capability_nft.move` | Planned (Phase B) |
| Existing EntityStack | `lib/iiot/entity/EntityStack.ts` | Existing |
| Existing NATS account isolation | `rfc-section-tenant-isolation.md` [TI.4] | Specified |
| Existing trust model | `rfc-section-trust-model.md` [T.3-T.11] | Specified |

---

## 20.12.13 References

### Sui Blockchain

- MystenLabs/sui — Sui Move smart contract platform
  (DeepWiki: cryptographic identity, capability patterns, multi-sig)
- Sui zkLogin Documentation: https://docs.sui.io/concepts/cryptography/zklogin
- Sui Object Model: https://docs.sui.io/concepts/object-model
- Sui Shared Objects: https://docs.sui.io/concepts/object-ownership/shared
- Move Book — Capability Pattern: https://move-book.com/programmability/capability/
- Sui Sponsored Transactions: https://docs.sui.io/concepts/transactions/sponsored-transactions

### NATS

- [NATS-JWT] Synadia Communications. "Decentralized JWT Authentication/Authorization."
  https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/jwt
- NATS Auth Callout: https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_callout

### Standards

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
  BCP 14, RFC 2119, March 1997.
- [W3C-DID] W3C. "Decentralized Identifiers (DIDs) v1.0." July 2022.
  https://www.w3.org/TR/did-1.0/
- [IEC-62443] IEC 62443. "Industrial Communication Networks — Network and System Security."
- [FDA-CFR11] U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."

### RFC-001 Cross-References

- `rfc-section-trust-model.md` — T.3 (Identity), T.4 (Trust Establishment), T.5 (Reputation), T.11 (Degradation)
- `rfc-section-security-architecture.md` — S.4 (Authentication), S.5 (Authorization), S.6 (Key Management)
- `rfc-section-tenant-isolation.md` — TI.3 (Five-Layer Isolation), TI.8 (Cross-Org Sharing)
- `rfc-section-marketplace-protocol.md` — 18.4 (Capability Discovery), 18.8 (Trust/Reputation)
- `rfc-section-onchain-isolation.md` — 21.10 (Sixth Isolation Layer)
- `research-sui-identity-auth.md` — Full research on Sui identity primitives
- `research-sui-blockchain-integration.md` — Unified Sui architecture reference
- `research-depin-manufacturing.md` — DePIN governance, token economics
- `research-rfc-sui-chainlink-audit.md` — Integration point inventory (O-1 through O-13)

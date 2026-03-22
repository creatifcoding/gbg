# Research: Sui Blockchain Identity & Auth vs NATS JWT

```
Topic:         Sui Blockchain Identity & Authentication for Manufacturing Commons
Author:        Val (security-splitter)
Date:          2026-02-09
Status:        RESEARCH (pre-decisional)
Related RFC:   RFC-001 Section: Security Architecture (rfc-section-security-architecture.md)
               RFC-001 Section: Trust Model (rfc-section-trust-model.md)
               RFC-001 Section: Tenant Isolation (rfc-section-tenant-isolation.md)
Sources:       DeepWiki (MystenLabs/sui, nats-io/nats-server)
               W3C DID 1.0/1.1 Specification
               IEC 62443-4-2 (Industrial Cybersecurity)
               NATS Auth Callout Documentation
```

> This document evaluates how Sui blockchain identity primitives could replace
> or augment the NATS JWT authentication model specified in RFC-001 Section S.4.
> The analysis covers cryptographic alignment, decentralized identity (DID),
> on-chain authorization via capability objects, credential rotation, regulatory
> compliance, multi-sig governance, and hybrid auth composition.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Cryptographic Identity Comparison](#2-cryptographic-identity-comparison)
3. [Sui Keypairs as Organization Identity](#3-sui-keypairs-as-organization-identity)
4. [Decentralized Identity (DID) on Sui](#4-decentralized-identity-did-on-sui)
5. [On-Chain Access Control via Capability Objects](#5-on-chain-access-control-via-capability-objects)
6. [Credential Rotation: NATS JWT vs Sui Keypair Management](#6-credential-rotation-nats-jwt-vs-sui-keypair-management)
7. [IEC 62443 Compliance Analysis](#7-iec-62443-compliance-analysis)
8. [Multi-Sig for High-Value Operations](#8-multi-sig-for-high-value-operations)
9. [Hybrid Auth Flow: Sui + NATS Composition](#9-hybrid-auth-flow-sui--nats-composition)
10. [Edge Device Identity with Sui](#10-edge-device-identity-with-sui)
11. [Threat Model Delta](#11-threat-model-delta)
12. [Decision Matrix](#12-decision-matrix)
13. [Open Questions](#13-open-questions)
14. [References](#14-references)

---

## 1. Executive Summary

### Current Architecture (RFC-001 S.4)

The manufacturing commons currently specifies a three-tier NATS JWT authentication
hierarchy:

```
Platform Operator (NKey: Ed25519)
  └── Organization Account (NKey: Ed25519, JWT signed by operator)
        └── User/Device (NKey: Ed25519, JWT signed by account)
```

Trust is rooted in the platform operator's NKey. Organizations receive account
JWTs signed by the operator. Devices and humans receive user JWTs signed by their
organization's account key. NATS servers validate the chain without a central auth
server at runtime [NATS-JWT].

### Proposed Enhancement: Sui Blockchain Identity Layer

Sui introduces a parallel identity plane where:

1. **Organizations own Sui addresses** derived from Ed25519/Secp256k1 keypairs
2. **Identity is self-sovereign** — no platform operator required for initial
   identity assertion
3. **Authorization is object-based** — capability NFTs replace centralized
   permission databases
4. **Multi-sig governance** enables weighted approval policies for high-value
   manufacturing operations
5. **On-chain audit trail** provides tamper-evident identity lifecycle events

### Key Finding

Sui does NOT replace NATS JWT for real-time messaging auth. The two systems
operate at different timescales and serve different purposes:

| Concern | NATS JWT | Sui Blockchain |
|---------|----------|----------------|
| **Timescale** | Milliseconds (real-time messaging) | Seconds (transaction finality ~480ms, but variable) |
| **Scope** | Session authentication, subject permissions | Identity verification, authorization proofs |
| **Revocation** | JWT expiry + NKey rotation | Object transfer/burn + address rotation |
| **Trust root** | Platform operator NKey | Sui validator consensus |
| **Offline capable** | Yes (JWT pre-signed, cached) | No (requires chain access for verification) |
| **Cost** | Zero per auth check | Gas fee per transaction (~$0.001-0.01) |

**Recommendation**: Hybrid composition where Sui provides the identity and
authorization substrate, and NATS JWT provides real-time session credentials.
Sui verifies "who you are" and "what you're allowed to do"; NATS JWT controls
"what subjects you can publish/subscribe to right now."

---

## 2. Cryptographic Identity Comparison

### 2.1 Key Type Alignment

Both Sui and NATS use Ed25519 as their primary key type, creating natural
cryptographic alignment:

| Property | NATS NKeys | Sui Keypairs |
|----------|-----------|--------------|
| **Primary algorithm** | Ed25519 | Ed25519, Secp256k1, Secp256r1 |
| **Key derivation** | Custom prefix encoding (O=operator, A=account, U=user) | BLAKE2b-256(flag \|\| pubkey) |
| **Address format** | Base32 with prefix (`OAXXXX`, `AAXXXX`, `UAXXXX`) | 32-byte hex (0x...) |
| **Multi-sig** | Not natively supported | Native weighted threshold (max 10 signers) |
| **Key hierarchy** | Operator > Account > User (trust chain) | Flat (any address is equal, hierarchy via objects) |
| **Signing** | Ed25519 sign/verify | Ed25519, Secp256k1, Secp256r1 sign/verify |
| **zkLogin** | N/A | OAuth OIDC -> ZK proof -> ephemeral key |

### 2.2 Critical Insight: Same Curve, Different Trust Models

NATS NKeys and Sui both use Ed25519, meaning the same cryptographic material
could serve both systems. An organization's Ed25519 keypair could simultaneously
be:

- A **NATS account NKey** (for signing user JWTs)
- A **Sui address** (for on-chain identity and object ownership)

This dual-purpose key usage eliminates the need for separate key management
infrastructure. However, it introduces a coupling risk: compromise of the Ed25519
private key compromises both NATS auth AND Sui identity simultaneously. Mitigation
options are analyzed in Section 6.

### 2.3 Address Derivation

**NATS**: Operator NKey = Ed25519 public key with `O` prefix encoding.
Account NKey = Ed25519 public key with `A` prefix encoding.

```
NKey Address = Base32(prefix_byte || Ed25519_pubkey || CRC16)
Example: OAIIOBCJGGXZPJZZWQSPMXQUMWG4G7JTJJZ4LM2UU64FPU...
```

**Sui**: Address = BLAKE2b-256(flag_byte || Ed25519_pubkey)

```
Sui Address = BLAKE2b-256(0x00 || Ed25519_pubkey)
Example: 0x7d2e...a3f1 (32 bytes, hex-encoded)
```

Both derive deterministically from the same Ed25519 public key, but produce
different addresses. A mapping table (pubkey -> NATS NKey, Sui address) is
straightforward and could be stored on-chain or in NATS KV.

---

## 3. Sui Keypairs as Organization Identity

### 3.1 Self-Sovereign Organization Identity

In the current RFC-001 architecture (S.4.2), organization identity is granted
by the platform operator:

```
Current flow (RFC-001 S.4.2):
1. Organization requests onboarding
2. Platform operator generates account NKey
3. Platform operator signs account JWT
4. Organization receives account JWT + NKey seed
5. Organization uses account key to sign user JWTs

Trust root: Platform operator
```

With Sui, the flow inverts — organizations generate their own identity:

```
Proposed flow (Sui-enhanced):
1. Organization generates Ed25519 keypair locally
2. Organization derives Sui address from public key
3. Organization publishes Sui address to on-chain registry
4. Organization proves identity via challenge-response (sign nonce)
5. Platform verifies Sui signature + on-chain registry entry
6. Platform mints NATS account JWT with Sui address as subject

Trust root: Sui validator consensus + organization's private key
```

### 3.2 Earl's Machine Shop Scenario

The RFC frequently references Earl's 2-person machine shop as the minimum-viable
organization. How does Sui identity benefit Earl?

**Current model**: Earl depends on the platform operator to issue his account
credentials. If the operator is compromised or goes offline, Earl cannot
re-authenticate his devices.

**Sui model**: Earl generates his own Ed25519 keypair (possibly on a $5 hardware
token). His Sui address IS his identity — no platform operator required for the
identity assertion itself. The platform still provisions his NATS account, but
Earl's identity proof is self-sovereign.

**Practical considerations for Earl**:

| Concern | Current (NATS-only) | Sui-Enhanced |
|---------|--------------------|--------------|
| **Initial cost** | Free (operator provisions) | ~$0.01 in SUI gas for registry transaction |
| **Key storage** | NKey seed file on edge device | Same Ed25519 key, optionally HSM-backed |
| **Recovery** | Request new JWT from operator | Sui address is permanent; can re-prove identity anytime |
| **Portability** | Locked to platform operator | Sui address works across any platform using same chain |
| **Complexity** | Low (receive JWT, connect) | Medium (generate key, register, then receive JWT) |

### 3.3 Comparison to NATS NKeys

| Property | NATS NKey (Org Account) | Sui Address (Org Identity) |
|----------|------------------------|---------------------------|
| **Generation** | Operator generates for org | Org generates independently |
| **Trust root** | Platform operator | Sui validator consensus |
| **Revocation** | Operator revokes JWT | On-chain registry update + burn |
| **Portability** | Platform-specific | Chain-wide (any verifier) |
| **Cost** | Free | Gas per transaction |
| **Offline verification** | Yes (JWT is self-contained) | No (chain query required) |
| **Recovery** | New JWT from operator | Same address, re-register |

---

## 4. Decentralized Identity (DID) on Sui

### 4.1 W3C DID Standard Compliance

The W3C Decentralized Identifiers (DIDs) v1.0 specification (approved July 2022)
defines a URI scheme for self-sovereign identity:

```
DID Syntax:
  did:<method>:<method-specific-identifier>

Example for Sui:
  did:sui:mainnet:0x7d2e...a3f1
  did:sui:testnet:0x1234...beef
```

A Sui DID method would need to define:

1. **Create**: Generate Ed25519 keypair, derive Sui address, register DID document
   on-chain
2. **Resolve**: Given `did:sui:mainnet:0x...`, fetch the DID document from Sui
   objects
3. **Update**: Modify DID document (add/remove verification methods, service
   endpoints)
4. **Deactivate**: Mark DID as deactivated on-chain

### 4.2 DID Document Structure for Manufacturing Org

A manufacturing organization's DID document would contain:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:sui:mainnet:0x7d2e...a3f1",
  "verificationMethod": [
    {
      "id": "did:sui:mainnet:0x7d2e...a3f1#nats-account",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:sui:mainnet:0x7d2e...a3f1",
      "publicKeyMultibase": "z6Mkf5r...NATS_ACCOUNT_PUBKEY"
    },
    {
      "id": "did:sui:mainnet:0x7d2e...a3f1#sui-signing",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:sui:mainnet:0x7d2e...a3f1",
      "publicKeyMultibase": "z6MkpT...SUI_PUBKEY"
    }
  ],
  "authentication": ["did:sui:mainnet:0x7d2e...a3f1#sui-signing"],
  "assertionMethod": ["did:sui:mainnet:0x7d2e...a3f1#nats-account"],
  "service": [
    {
      "id": "did:sui:mainnet:0x7d2e...a3f1#nats-endpoint",
      "type": "NATSAccountEndpoint",
      "serviceEndpoint": "nats://hub.manufacturing-commons.io:4222"
    },
    {
      "id": "did:sui:mainnet:0x7d2e...a3f1#isa95-profile",
      "type": "ISA95OrganizationProfile",
      "serviceEndpoint": "https://api.manufacturing-commons.io/org/0x7d2e...a3f1/profile"
    }
  ]
}
```

### 4.3 Current Status of Sui DID Method

As of February 2026, there is no ratified `did:sui` method registered with W3C.
The W3C DID Method Registry lists 103+ experimental methods, but Sui is not
among them. A `did:sui` method would need to be specified and submitted.

**Gap analysis**:

| DID Requirement | Sui Capability | Gap |
|-----------------|---------------|-----|
| Create | Keypair generation + on-chain registration | Move module needed for DID document storage |
| Resolve | Object read via Sui RPC | Resolver service needed |
| Update | Object mutation via signed transaction | Move module for DID document updates |
| Deactivate | Object deletion or flag update | Move module for deactivation |
| Key rotation | New keypair + DID document update | Supported via Move object mutation |
| Service endpoints | DID document field | Standard JSON structure, no gap |

### 4.4 Benefit for Self-Sovereign Manufacturing Identity

The key question: **Does Earl's 2-person machine shop benefit from DID?**

**Yes**, because:

1. **Platform independence**: Earl's DID is not locked to any single manufacturing
   commons platform. If Earl switches platforms, his DID travels with him.
2. **Verifiable credentials**: Earl can present verifiable credentials (ISO 9001
   certification, machine capability attestations) signed by third-party auditors,
   without the platform as intermediary.
3. **Cross-commons discovery**: If multiple manufacturing commons networks emerge,
   Earl's DID is resolvable across all of them.

**No**, because:

1. **Complexity**: Earl needs to understand keypairs, DID documents, and
   verifiable credentials. His $50 edge device may not have the compute for
   DID resolution.
2. **No existing `did:sui` method**: Earl would be adopting a non-standard,
   platform-specific DID method.
3. **Overkill for single-platform**: If Earl only uses one manufacturing commons,
   a NATS NKey is simpler.

**Recommendation**: Offer DID as an OPTIONAL enhancement. The platform SHOULD
support `did:sui` resolution for cross-org identity verification. Organizations
MAY use DID for portable identity. The platform MUST NOT require DID for basic
participation.

---

## 5. On-Chain Access Control via Capability Objects

### 5.1 Sui Capability Pattern

Sui uses object ownership as its authorization primitive. In the Move programming
language, capability objects gate access to functions:

```move
module manufacturing_commons::authorization {
    // Capability: Organization is verified and active
    struct OrgVerifiedCap has key, store {
        id: UID,
        org_address: address,
        verification_level: u8,    // 1=basic, 2=audited, 3=certified
        verified_at: u64,          // epoch timestamp
        verifier: address,         // who verified this org
    }

    // Capability: Organization may participate in cross-org marketplace
    struct MarketplaceParticipantCap has key, store {
        id: UID,
        org_address: address,
        max_order_value_usd: u64,  // spending limit
        allowed_categories: vector<u8>,
    }

    // Capability: Quality control authority for specific material types
    struct QualityInspectorCap has key, store {
        id: UID,
        org_address: address,
        material_types: vector<u8>,
        certification_expiry: u64,
    }

    // Function gated by capability
    public fun submit_work_order(
        cap: &MarketplaceParticipantCap,
        order_value: u64,
        // ... other params
    ) {
        assert!(order_value <= cap.max_order_value_usd, E_EXCEEDS_LIMIT);
        // proceed with work order submission
    }

    // Function gated by quality inspector capability
    public fun approve_batch(
        cap: &QualityInspectorCap,
        batch_id: address,
        // ... other params
    ) {
        assert!(cap.certification_expiry > tx_context::epoch(ctx), E_CERT_EXPIRED);
        // proceed with batch approval
    }
}
```

### 5.2 Mapping to Manufacturing Commons Authorization

The current RFC-001 authorization model (S.5) uses NATS subject-based permissions
and RPC middleware. Sui capability objects could augment this:

| Authorization Concern | Current (NATS + RPC) | Sui Capability Enhancement |
|----------------------|---------------------|---------------------------|
| **Device publishing** | JWT subject scoping (`iiot.readings.{deviceId}`) | No change — NATS is correct here |
| **Cross-org data sharing** | RPC middleware checks + signed tokens (S.5.3) | `DataSharingAgreementCap` NFT proves consent on-chain |
| **Work order approval** | Application-level role check | `MarketplaceParticipantCap` with spending limit |
| **Quality inspection** | Trusted-but-unverified role claim | `QualityInspectorCap` with certification expiry |
| **Platform admin** | NATS `$SYS.>` subject access | Multi-sig `PlatformAdminCap` (Section 8) |
| **Regulatory audit** | Application-level audit log | On-chain audit trail (immutable) |

### 5.3 Key Insight: Capability Objects Solve Cross-Org Trust

Within a single organization, NATS subject permissions are sufficient — the org
trusts its own JWT issuance. But CROSS-ORG authorization has a trust gap:

```
Current cross-org problem:
  Org A wants to share data with Org B.
  How does Org A verify that Org B is authorized?
  Answer: Trust the platform operator's assertion (centralized).

Sui-enhanced cross-org solution:
  Org A wants to share data with Org B.
  Org B presents MarketplaceParticipantCap (on-chain, verifiable).
  Org A verifies the capability object exists and is valid.
  No platform operator involvement needed for verification.
```

This aligns with the RFC-001 trust model (T.4) goal of trust establishment
between unknown organizations. Capability objects are cryptographic proof of
authorization, not just a claim in a JWT.

### 5.4 Capability Object Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                  CAPABILITY LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. MINT                                                        │
│     Platform or verifier creates capability object              │
│     → Requires verifier's signing key                           │
│     → Object transferred to org's Sui address                   │
│                                                                 │
│  2. HOLD                                                        │
│     Organization owns capability object                         │
│     → Can present to any on-chain function                      │
│     → Can present proof to off-chain verifiers                  │
│                                                                 │
│  3. USE                                                         │
│     Organization presents capability to gated function          │
│     → Move runtime verifies ownership                           │
│     → Function executes if capability is valid                  │
│                                                                 │
│  4. TRANSFER (optional)                                         │
│     Organization transfers capability to another org            │
│     → Only if capability has `store` ability                    │
│     → Creates audit trail on-chain                              │
│                                                                 │
│  5. REVOKE                                                      │
│     Verifier or platform burns capability object                │
│     → Requires revocation authority (separate cap)              │
│     → Organization loses authorization immediately              │
│                                                                 │
│  6. EXPIRE                                                      │
│     Capability has on-chain expiry timestamp                    │
│     → Functions check expiry before executing                   │
│     → Requires renewal transaction to remain valid              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Credential Rotation: NATS JWT vs Sui Keypair Management

### 6.1 NATS JWT Rotation (Current)

Per RFC-001 S.4.2, NATS JWT rotation uses signing keys:

```
NATS rotation workflow:
1. Account has primary NKey + N signing keys
2. To rotate: add new signing key to account JWT
3. Re-sign affected user JWTs with new signing key
4. Revoke old signing key from account JWT
5. Connected clients with old-key JWTs are disconnected
6. Clients reconnect with new JWTs

Impact: Brief disconnection for affected devices
Offline support: Old JWTs remain valid until expiry (cached)
Complexity: Moderate (re-sign all user JWTs)
```

### 6.2 Sui Keypair Rotation

```
Sui rotation workflow:
1. Organization generates new Ed25519 keypair
2. Organization submits on-chain transaction: update DID document
   (requires old key signature)
3. New Sui address = BLAKE2b-256(0x00 || new_pubkey)
4. Capability objects must be transferred to new address
5. NATS account JWT must be re-issued with new NKey

Impact: On-chain transaction + NATS JWT re-issuance
Offline support: Old address remains resolvable (historical)
Complexity: Higher (chain transaction + capability migration + NATS re-issuance)
```

### 6.3 Edge Device Key Management with HSMs

For edge devices with Hardware Security Modules (HSMs):

| Aspect | NATS-only | Sui-enhanced |
|--------|-----------|--------------|
| **Key generation** | HSM generates Ed25519 NKey | HSM generates Ed25519 keypair (dual-use) |
| **Key storage** | Private key in HSM secure element | Same key, same HSM |
| **Signing** | HSM signs NATS challenge-response | HSM signs Sui transactions + NATS challenges |
| **Rotation** | New NKey in HSM, new JWT from org | New keypair in HSM, on-chain update, new JWT |
| **Attestation** | None (trust the JWT) | Sui transaction proves key was generated in HSM |
| **Cost** | No additional hardware | Same hardware (Ed25519 compatible) |

### 6.4 Dual-Key Architecture (Recommended)

To mitigate the risk of single-key compromise affecting both NATS and Sui:

```
RECOMMENDED dual-key architecture:

Organization holds TWO Ed25519 keypairs:
  1. Sui Identity Key (cold storage / HSM)
     - Used for: on-chain identity, capability management, DID
     - Rotation frequency: Annual or on suspected compromise
     - Storage: Hardware wallet, HSM, or air-gapped machine

  2. NATS Account Key (warm storage)
     - Used for: signing user JWTs, NATS auth
     - Rotation frequency: Quarterly (RECOMMENDED)
     - Storage: Encrypted keystore accessible by auth service

Linkage:
  - Sui Identity Key signs a registration transaction linking
    the NATS Account Key public key to the org's Sui address
  - On-chain record: { sui_address, nats_pubkey, registered_at }
  - Verification: Anyone can confirm NATS pubkey is endorsed by Sui identity
```

This separation ensures that NATS key compromise does not grant on-chain
authority, and Sui key compromise does not grant NATS session access.

---

## 7. IEC 62443 Compliance Analysis

### 7.1 IEC 62443-4-2 Identity Requirements

IEC 62443-4-2 (Component Security Requirements) defines four Security Levels
(SL 1-4) for industrial component authentication:

| Security Level | Identity Requirement | NATS JWT | Sui Blockchain |
|----------------|---------------------|----------|----------------|
| **SL 1** | Unique identifier per component | NKey per device | Sui address per device |
| **SL 2** | Authentication via shared secret or PKI | JWT + NKey challenge-response | Ed25519 signature verification |
| **SL 3** | Multi-factor authentication | NKey + mTLS certificate | Sui keypair + HSM attestation |
| **SL 4** | Hardware-based identity, tamper-evident | HSM-stored NKey + mTLS | HSM-stored Sui key + on-chain attestation |

### 7.2 Compliance Gap Analysis

| IEC 62443 Requirement | NATS JWT Compliance | Sui Enhancement |
|----------------------|--------------------|-----------------|
| **CR 1.1** Human user identification | OIDC -> JWT (S.4.4) | zkLogin (OAuth -> ZK proof -> Sui address) |
| **CR 1.2** Software process identification | SPIFFE ID (S.4.5) | Sui address for service identity |
| **CR 1.5** Authenticator management | JWT TTL + NKey rotation | On-chain key lifecycle, immutable audit |
| **CR 1.7** Strength of password-based auth | N/A (key-based) | N/A (key-based) |
| **CR 1.10** Authenticator feedback | NATS connection error codes | Sui transaction failure receipts |
| **CR 1.11** Unsuccessful login attempts | NATS server rate limiting | On-chain rate limiting (gas-based) |
| **CR 2.1** Authorization enforcement | Subject-based (S.5.1) | Capability object ownership |
| **CR 2.6** Remote session termination | JWT revocation + disconnect | Capability burn + NATS JWT revocation |
| **CR 3.1** Communication integrity | TLS 1.3 (S.6) | Sui transaction signing (Ed25519/Secp256k1) |
| **CR 6.1** Audit log accessibility | Application-level logs | On-chain (immutable, publicly verifiable) |
| **CR 6.2** Continuous monitoring | OTEL traces | On-chain event monitoring |

### 7.3 Key IEC 62443 Gaps with Blockchain

| Gap | Description | Mitigation |
|-----|-------------|------------|
| **Offline operation** | IEC 62443 requires auth to work when network is degraded. Sui requires chain access. | Cached capability proofs (signed attestations valid for N hours) |
| **Deterministic latency** | Industrial control requires bounded auth latency. Sui finality is ~480ms but variable. | NATS JWT for real-time path; Sui for enrollment/renewal only |
| **Air-gapped networks** | Some IEC 62443 SL 4 zones are air-gapped. Sui is internet-dependent. | Local capability cache with periodic sync (batch update model) |
| **Regulatory approval** | IEC 62443 certifiers may not accept blockchain-based identity. | Offer blockchain as optional enhancement, not replacement |

### 7.4 Compliance Recommendation

Sui blockchain identity SHOULD be positioned as an **SL 3/4 enhancement** to the
existing NATS JWT model, not a replacement. The base NATS JWT system satisfies
SL 1-3 requirements. Sui adds:

- Tamper-evident identity lifecycle (SL 4 audit trail)
- Hardware attestation proof (SL 4 device identity)
- Decentralized cross-org verification (beyond IEC 62443 scope, but valuable)

---

## 8. Multi-Sig for High-Value Operations

### 8.1 Sui Multi-Sig Architecture

Sui natively supports weighted multi-signature with these properties:

- **Maximum signers**: 10 per multi-sig address
- **Key mixing**: Ed25519, Secp256k1, Secp256r1, and zkLogin can be combined in
  a single multi-sig
- **Weighted threshold**: Each key has a weight; transaction is valid when
  sum(weights of signers) >= threshold
- **Address derivation**: Multi-sig address = BLAKE2b-256(0x03 || threshold ||
  (flag || pubkey || weight) for each signer)

### 8.2 Manufacturing Governance Scenarios

#### Scenario 1: Work Order Approval ($100K+ threshold)

```
Multi-sig address: "EarlShop-HighValue-Approvals"
  Key 1: Earl (owner)          - Weight: 3 (Ed25519)
  Key 2: Plant manager          - Weight: 2 (Ed25519)
  Key 3: Quality engineer        - Weight: 2 (Secp256k1)
  Threshold: 4

Approval combinations:
  Earl + Plant manager (3+2=5 >= 4)         ✓
  Earl + Quality engineer (3+2=5 >= 4)      ✓
  Plant manager + Quality engineer (2+2=4)  ✓
  Earl alone (3 < 4)                        ✗
  Plant manager alone (2 < 4)               ✗
```

#### Scenario 2: Cross-Org Data Sharing Agreement

```
Multi-sig address: "DataSharing-OrgA-OrgB"
  Key 1: Org A legal representative  - Weight: 1 (Ed25519)
  Key 2: Org B legal representative  - Weight: 1 (Ed25519)
  Key 3: Platform compliance officer - Weight: 1 (Ed25519)
  Threshold: 2

Approval combinations:
  Both orgs agree (1+1=2)                   ✓
  One org + platform (1+1=2)                ✓
  Platform alone (1 < 2)                    ✗
  Single org alone (1 < 2)                  ✗
```

#### Scenario 3: ITAR-Controlled Work Order

```
Multi-sig address: "ITAR-Controlled-Orders"
  Key 1: Facility security officer   - Weight: 3 (Ed25519, HSM)
  Key 2: Program manager             - Weight: 2 (Ed25519)
  Key 3: Export control officer       - Weight: 3 (Secp256k1, HSM)
  Key 4: Quality assurance           - Weight: 1 (Ed25519)
  Threshold: 6

Approval combinations:
  Security + Export control (3+3=6)         ✓
  Security + PM + QA (3+2+1=6)             ✓
  PM + QA only (2+1=3 < 6)                 ✗
  No single person can approve              ✓ (max single weight = 3 < 6)
```

### 8.3 Multi-Sig Integration with NATS

Multi-sig approvals happen on-chain. The result triggers NATS actions:

```
Flow:
1. Work order submitted via RPC (NATS transport)
2. If order value > threshold, entity handler emits "pending_approval" event
3. Approval request published to relevant signers' NATS subjects
4. Each signer submits partial Sui signature via RPC
5. When threshold met, partial sigs combined into multi-sig transaction
6. Sui transaction executes (on-chain record)
7. On-chain event emitted -> bridge service publishes NATS event
8. Entity handler transitions work order to "approved" state
```

### 8.4 Multi-Sig Gas Considerations

| Operation | Estimated Gas (SUI) | USD Equivalent (~$1.50/SUI) |
|-----------|--------------------|-----------------------------|
| Create multi-sig address | 0 (offline derivation) | $0.00 |
| Submit partial signature | 0 (off-chain until combined) | $0.00 |
| Execute multi-sig transaction | ~0.005 SUI | ~$0.0075 |
| Mint capability NFT | ~0.01 SUI | ~$0.015 |
| Transfer capability | ~0.005 SUI | ~$0.0075 |
| Burn capability | ~0.003 SUI | ~$0.0045 |

At these costs, even Earl's 2-person shop can afford multi-sig governance.
A $100K work order incurring $0.01 in blockchain fees is negligible.

---

## 9. Hybrid Auth Flow: Sui + NATS Composition

### 9.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    HYBRID AUTH ARCHITECTURE                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: IDENTITY (Sui Blockchain)                              │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  Sui Address = Organization Identity                  │        │
│  │  Capability Objects = Authorization Proofs            │        │
│  │  Multi-Sig Addresses = Governance Policies            │        │
│  │  DID Documents = Discoverable Identity Metadata       │        │
│  │                                                       │        │
│  │  Timescale: Seconds (enrollment, renewal, governance) │        │
│  └──────────────────────────────────────────────────────┘        │
│                          │                                       │
│                          │ Sui verifies identity                 │
│                          │ Sui proves authorization              │
│                          ▼                                       │
│  LAYER 2: SESSION AUTH (Auth Bridge Service)                     │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  Sui signature -> Verify on-chain identity            │        │
│  │  Check capability objects -> Derive NATS permissions   │        │
│  │  Mint NATS account JWT (signed by operator)           │        │
│  │  Mint NATS user JWT (signed by account)               │        │
│  │                                                       │        │
│  │  Timescale: Seconds (one-time per session)            │        │
│  └──────────────────────────────────────────────────────┘        │
│                          │                                       │
│                          │ NATS JWT issued                       │
│                          ▼                                       │
│  LAYER 3: REAL-TIME MESSAGING (NATS)                             │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  JWT-based subject permissions                        │        │
│  │  NKey challenge-response per connection               │        │
│  │  Account-level isolation                              │        │
│  │                                                       │        │
│  │  Timescale: Microseconds (per-message authorization)  │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Auth Bridge Service: Sui -> NATS JWT

The critical integration point is the **Auth Bridge Service** that translates
Sui identity into NATS session credentials.

```
Sui -> NATS JWT Bridge Protocol:

1. CLIENT: Generate ephemeral Ed25519 keypair
2. CLIENT: Sign challenge = { timestamp, nonce, sui_address }
           with Sui private key
3. CLIENT -> BRIDGE: { sui_address, challenge, sui_signature, ephemeral_pubkey }
4. BRIDGE: Verify sui_signature against sui_address (on-chain lookup)
5. BRIDGE: Query Sui objects owned by sui_address:
           - OrgVerifiedCap? -> org is verified
           - MarketplaceParticipantCap? -> marketplace access level
           - QualityInspectorCap? -> QC authority
6. BRIDGE: Map capabilities to NATS subject permissions:
           - OrgVerifiedCap -> basic iiot.* pub/sub
           - MarketplaceParticipantCap -> workorders.* pub/sub
           - QualityInspectorCap -> iiot.quality.* pub
7. BRIDGE: Mint NATS user JWT:
           - Subject: ephemeral_pubkey (NKey format)
           - Issuer: org account NKey
           - Permissions: derived from capabilities
           - TTL: 24 hours (human) or 90 days (device)
8. BRIDGE -> CLIENT: { nats_jwt, nats_nkey_seed }
9. CLIENT: Connect to NATS with JWT + NKey
```

### 9.3 NATS Auth Callout Integration

NATS natively supports Auth Callout — a mechanism for delegating authentication
to external services. The Sui bridge can be implemented as a NATS Auth Callout
handler:

```
NATS Auth Callout Configuration:

authorization {
  auth_callout {
    # The account that hosts the auth callout service
    account: SUI_BRIDGE_ACCOUNT
    # Subject the auth callout listens on
    auth_users: ["$SUI_BRIDGE"]
    # XKey for encrypted auth exchange
    xkey: XAIIOB...
  }
}
```

When a client connects with Sui credentials instead of a pre-minted JWT:

1. NATS server forwards auth request to `$SUI_BRIDGE` subject
2. Auth callout service receives `{ client_info, nonce }`
3. Service verifies Sui signature + on-chain capabilities
4. Service responds with `AuthorizationResponseClaims` JWT
5. NATS server accepts or rejects the connection

This approach uses NATS's native extension mechanism rather than requiring an
external HTTP bridge, reducing latency and eliminating an additional service.

### 9.4 zkLogin for Human Operators

Sui's zkLogin bridges OAuth OIDC credentials to on-chain identity via
zero-knowledge proofs:

```
zkLogin flow for manufacturing operator:

1. Operator clicks "Login with Google" on platform UI
2. Platform redirects to Google OAuth with embedded:
   - Ephemeral public key (short-lived)
   - Max epoch (expiry)
   - Randomness
3. Google returns JWT with claims { sub, iss, aud, nonce }
4. Client generates ZK proof:
   - Proves: JWT is valid, nonce matches ephemeral key
   - Hides: sub, iss (privacy-preserving)
5. ZK proof + ephemeral signature -> Sui transaction
6. Sui address = BLAKE2b-256(0x05 || iss_len || iss || address_seed)
7. Operator's Sui address is deterministic from their Google identity
8. Auth bridge verifies ZK proof -> mints NATS JWT
```

This eliminates the separate OIDC -> NATS JWT bridge described in RFC-001 S.4.4.
Instead:

```
Current:  Google OIDC -> Platform Auth Service -> NATS JWT
Proposed: Google OIDC -> zkLogin -> Sui Address -> Auth Bridge -> NATS JWT
```

The advantage: the platform auth service is no longer a trusted intermediary.
The ZK proof is verifiable by anyone with the Sui verifier, and the operator's
Sui address is self-sovereign (not platform-granted).

---

## 10. Edge Device Identity with Sui

### 10.1 Device Provisioning with Sui

```
Device provisioning flow:

1. Manufacturer burns Ed25519 keypair into device HSM during production
2. Device HSM generates attestation: { pubkey, hsm_model, firmware_hash }
3. Organization registers device on Sui:
   - Transaction: register_device(org_cap, device_pubkey, attestation)
   - Creates on-chain DeviceIdentity object owned by org's Sui address
4. Organization signs NATS user JWT for device using account key
5. Device stores: { hsm_private_key, nats_jwt, org_sui_address }
6. Device connects to NATS with JWT, signs challenges with HSM key
```

### 10.2 Device Trust Score Enhancement

The RFC-001 trust model (T.6, T.7) defines signal trustworthiness and edge device
trust boundaries. Sui can enhance this:

```
On-chain device trust record:

struct DeviceTrustRecord has key, store {
    id: UID,
    device_pubkey: vector<u8>,
    org_address: address,
    hsm_attestation: vector<u8>,     // Hardware attestation blob
    clock_drift_history: vector<u64>, // Rolling window of drift measurements
    uptime_score: u64,               // Cumulative uptime (basis points)
    last_calibration: u64,           // Epoch of last calibration
    trust_score: u64,                // Computed G-10 trust score
}
```

This record is updated periodically (not per-reading — that would be too expensive)
and provides an immutable, publicly verifiable trust history for each device.

### 10.3 Offline Edge Operation

Edge devices in manufacturing environments frequently operate with degraded
network connectivity. The hybrid model handles this:

| State | Sui Available | NATS Available | Auth Behavior |
|-------|--------------|----------------|---------------|
| **Normal** | Yes | Yes | Full hybrid auth (Sui + NATS JWT) |
| **Edge-degraded** | No | Yes | Cached NATS JWT (pre-signed, TTL-bounded) |
| **Hub-degraded** | Yes | No | Buffer readings locally, resume on reconnect |
| **Full offline** | No | No | Local operation only, no auth required for local buffering |

The key design principle: **NATS JWT is the real-time auth mechanism. Sui is the
enrollment, renewal, and governance mechanism.** Edge devices do not need Sui
access for normal operation.

---

## 11. Threat Model Delta

### 11.1 New Threats Introduced by Sui

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Chain dependency** | Platform availability now depends on Sui network uptime | Cached proofs + NATS JWT fallback |
| **Key reuse attack** | Same Ed25519 key for NATS + Sui increases blast radius | Dual-key architecture (Section 6.4) |
| **On-chain data leakage** | Sui objects are publicly readable; org structure visible | Encrypt sensitive fields; use minimal on-chain data |
| **MEV/front-running** | Validators could reorder capability transactions | Not applicable to auth (no financial MEV) |
| **Smart contract bugs** | Move module vulnerabilities could grant unauthorized caps | Formal verification of Move modules; upgrade policies |
| **Gas price spikes** | Volatile gas prices could make auth expensive | Gas sponsorship by platform operator |
| **Validator collusion** | 1/3+ validators could censor org transactions | Sui BFT requires 2/3+; monitor validator set |

### 11.2 Threats Mitigated by Sui

| Threat | Current Risk | Sui Mitigation |
|--------|-------------|----------------|
| **Platform operator compromise** | Single point of failure for all org identities | Self-sovereign identity; operator cannot forge Sui addresses |
| **JWT forgery** | Operator key compromise = all JWTs forged | Sui signature = independent verification |
| **Cross-org impersonation** | Trust platform's assertion of org identity | On-chain capability proof = cryptographic, not claimed |
| **Audit trail tampering** | Application-level logs can be modified | On-chain events are immutable |
| **Credential theft without detection** | JWT theft is silent | On-chain transactions are visible; anomaly detection possible |
| **Centralized revocation failure** | If operator's revocation service is down, compromised JWTs remain valid | On-chain capability burn is immediate and verifiable |

---

## 12. Decision Matrix

### 12.1 Feature-Level Adoption Recommendations

| Feature | Recommendation | Priority | Complexity | Value |
|---------|---------------|----------|------------|-------|
| **Sui address as org identity** | SHOULD adopt | High | Medium | High — self-sovereign identity |
| **Capability NFTs for cross-org auth** | SHOULD adopt | High | High | High — trustless cross-org verification |
| **Multi-sig for high-value ops** | SHOULD adopt | Medium | Medium | High — governance without central authority |
| **DID (`did:sui`)** | MAY adopt (OPTIONAL) | Low | High | Medium — portability, but no standard yet |
| **zkLogin for human auth** | SHOULD adopt | Medium | Medium | Medium — eliminates OIDC bridge |
| **On-chain device identity** | MAY adopt (OPTIONAL) | Low | Medium | Low — NATS JWT sufficient for most devices |
| **On-chain audit trail** | SHOULD adopt for regulatory | Medium | Low | High — FDA 21 CFR Part 11, immutable |
| **Dual-key architecture** | MUST adopt if Sui is used | High | Low | Critical — prevents blast radius expansion |
| **Auth callout bridge** | MUST adopt if Sui is used | High | Medium | Critical — integration point |

### 12.2 Phased Adoption Path

```
Phase 1: Foundation (no blockchain dependency)
  - NATS JWT hierarchy (current RFC-001 S.4) -- already specified
  - No Sui dependency for basic platform operation

Phase 2: Identity Enhancement
  - Sui address registration for organizations (optional)
  - Auth Bridge Service with NATS Auth Callout
  - Dual-key architecture
  - On-chain org registry

Phase 3: Authorization Enhancement
  - Capability NFTs for cross-org marketplace
  - Multi-sig governance for high-value operations
  - On-chain audit trail for regulatory events

Phase 4: Advanced Identity
  - did:sui method specification and registration
  - zkLogin for human operator onboarding
  - On-chain device trust records
  - Verifiable credentials for certifications (ISO 9001, etc.)
```

### 12.3 Architecture Decision Record

```
ADR: Sui Blockchain Identity Layer

Status: PROPOSED
Context: RFC-001 specifies NATS JWT for all auth. Cross-org trust
         relies on platform operator assertions. This creates a
         centralized trust bottleneck for 200K+ organizations.

Decision: Adopt Sui as an OPTIONAL identity and authorization layer
          that composes with (not replaces) NATS JWT.

Rationale:
  1. Ed25519 alignment eliminates crypto impedance mismatch
  2. Capability objects solve cross-org trust without central authority
  3. Multi-sig enables governance at manufacturing network scale
  4. On-chain audit trail satisfies FDA 21 CFR Part 11 immutability
  5. Self-sovereign identity empowers small manufacturers (Earl)
  6. zkLogin simplifies human onboarding

Consequences:
  + Cross-org trust becomes cryptographic, not platform-asserted
  + Audit trail becomes immutable and publicly verifiable
  + Platform operator is no longer single point of identity failure
  - Additional infrastructure dependency (Sui network)
  - Move smart contract development and auditing required
  - Gas costs (minimal, ~$0.01/transaction)
  - Regulatory acceptance of blockchain-based identity is uncertain
```

---

## 13. Open Questions

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| OQ-1 | Should a `did:sui` method be formally specified and submitted to W3C? | Portability, standards compliance | Architecture team |
| OQ-2 | What is the gas sponsorship model? Platform pays gas for org transactions? | Cost allocation, sustainability | Business team |
| OQ-3 | How do we handle Sui network partitions? What is the fallback auth path? | Availability, SLA compliance | Infrastructure team |
| OQ-4 | Can Move modules be formally verified for manufacturing authorization? | Security assurance, IEC 62443 SL 4 | Security team |
| OQ-5 | What is the regulatory stance on blockchain-based identity in FDA-regulated manufacturing? | Compliance, market access | Legal team |
| OQ-6 | Should capability NFTs be soulbound (non-transferable) or transferable? | Authorization model, audit trail | Architecture team |
| OQ-7 | How does Sui's ~480ms finality interact with IEC 62443 bounded-latency requirements? | Real-time compliance | Architecture team |
| OQ-8 | What happens to an org's capabilities if they lose their Sui private key? | Recovery model, business continuity | Architecture team |
| OQ-9 | Should the 3DOS/Sui manufacturing partnership be evaluated for collaboration? | Partnership, ecosystem | Business team |
| OQ-10 | How do we prevent on-chain capability object data from leaking competitive intelligence? | Privacy, competitive dynamics | Security team |

---

## 14. References

### Sui Blockchain

- MystenLabs/sui — Sui Move smart contract platform
  (DeepWiki: cryptographic identity, capability patterns, multi-sig)
- Sui zkLogin Documentation: https://docs.sui.io/concepts/cryptography/zklogin
- Sui + 3DOS Decentralized Manufacturing Partnership (2025):
  https://www.cointrust.com/market-news/sui-and-3dos-join-forces-to-revolutionize-decentralized-manufacturing

### NATS

- [NATS-JWT] Synadia Communications. "Decentralized JWT Authentication/Authorization."
  https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/jwt
- NATS Auth Callout: https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_callout
- NATS by Example — Auth Callout Decentralized:
  https://natsbyexample.com/examples/auth/callout-decentralized/cli

### Standards

- [RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- W3C DID 1.0: https://www.w3.org/TR/did-1.0/
- W3C DID 1.1: https://www.w3.org/TR/did-1.1/
- W3C DID Primer: https://w3c-ccg.github.io/did-primer/
- [IEC-62443] IEC 62443. "Industrial Communication Networks — Network and System Security."
- PKI's Role in IEC 62443: https://www.keyfactor.com/blog/pkis-role-in-iec-62443/
- Mastering IEC 62443: https://www.keyfactor.com/education-center/mastering-iec-62443-a-guide-to-securing-industrial-automation-and-control-systems/

### RFC-001 Cross-References

- rfc-section-security-architecture.md — S.4 Authentication Architecture, S.5 Authorization Model
- rfc-section-trust-model.md — T.3 Org Identity Verification, T.4 Trust Establishment
- rfc-section-tenant-isolation.md — TI.4 NATS Account Isolation
- rfc-section-marketplace-protocol.md — Marketplace economics and cross-org transactions

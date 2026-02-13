# RFC-001 Sui + Chainlink Integration Audit

**RFC**: `docs/specifications/rfc-entity-realtime-integration.md` (22,254 lines)
**Auditor**: Val (Vigilant Architecture Layer)
**Date**: 2026-02-09
**Scope**: Identify every integration point where Sui blockchain and Chainlink oracle infrastructure should augment or replace existing Effect-TS + NATS JetStream mechanisms.

---

## Executive Summary

RFC-001 specifies entity lifecycle event distribution for a 200K+ organization manufacturing commons. The architecture is currently pure Effect-TS + @effect/cluster + NATS JetStream. This audit identifies **47 integration points** across 4 domains where Sui smart contracts and Chainlink oracles should be woven into the specification.

The integration follows a clear division of responsibility:

| Layer | Technology | Role |
|-------|-----------|------|
| **Real-time operations** | NATS JetStream | Intra-org events, <100ms sensor data, equipment telemetry |
| **Trust & settlement** | Sui Move | Escrow, reputation, identity, audit anchoring, dispute resolution |
| **External data & cross-chain** | Chainlink | Price feeds, certification verification, CCIP messaging, oracle attestation |

**Critical insight**: NATS remains the operational nervous system. Sui and Chainlink augment it at trust boundaries and economic settlement points. No replacement of NATS for real-time data flow is proposed.

---

## Integration Point Master Table

### Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Foundational — blocks other integrations | Sprint 1-2 |
| **P1** | Core value — marketplace cannot function trustlessly without it | Sprint 3-5 |
| **P2** | High value — materially improves trust/compliance | Sprint 6-8 |
| **P3** | Enhancement — nice-to-have, can defer | Sprint 9+ |

### Effort Legend

| Size | Meaning | Story Points |
|------|---------|-------------|
| **XS** | Config/wiring only | 1-2 SP |
| **S** | Single service + tests | 3-5 SP |
| **M** | Multi-service, schema changes | 8-13 SP |
| **L** | New subsystem, Move contracts | 13-21 SP |
| **XL** | Cross-cutting, multi-sprint | 21-34 SP |

---

### Domain 1: Escrow & Settlement (14 integration points)

| # | RFC Section | Integration Point | Technology | Priority | Effort | Description |
|---|-------------|-------------------|------------|----------|--------|-------------|
| E-1 | 18.7.2 | Escrow smart contract | Sui Move | P0 | L | Replace event-sourced `EscrowCreated/Funded/Released/Frozen/Settled` ledger with Sui Move escrow objects. Funds locked on-chain with programmable release conditions. |
| E-2 | 18.7.2 | Escrow state sync | Sui + NATS | P0 | M | Bridge Sui escrow object state changes back to NATS EventLog via `SuiBridgeService`. Dual-write: on-chain source of truth, NATS for reactive UI. |
| E-3 | 18.7.3 | Settlement triggers | Sui Move | P1 | M | Implement `AllPartyConfirm`, `QCPassAutoRelease`, `TimeoutRelease`, `DisputeFreeze` as Move module entry functions with programmable conditions. |
| E-4 | 18.7.3 | Automatic settlement | Sui + Chainlink | P1 | L | QC-pass auto-release triggers on-chain settlement. Chainlink Automation (Keepers) can trigger timeout-based releases when no party acts within SLA. |
| E-5 | 18.7.4 | Network fee collection | Sui Move | P1 | S | Network fee (1-3% commission) collected on-chain during settlement. Move module splits payment: vendor share + network treasury + dispute reserve. |
| E-6 | 18.7.1 | Dynamic pricing feeds | Chainlink | P2 | M | Chainlink Data Feeds for material costs, market rates, regional multipliers feeding into the `PricingEngine` (18.7.1). Price attestation anchored on-chain. |
| E-7 | 18.6.1 | Work order lifecycle anchoring | Sui Move | P1 | L | Work order state machine (`RFQ_POSTED` through `SETTLED`) anchored as Sui shared objects. State transitions require on-chain authorization. |
| E-8 | 18.6.5 | Dispute resolution | Sui Move | P2 | L | On-chain dispute evidence submission. Escrow frozen on-chain. Arbitration panel votes recorded as Sui transactions. Resolution triggers automatic fund release. |
| E-9 | 18.9.3 | Multi-hop work order settlement | Sui Move | P2 | XL | Multi-hop work orders (A->B->C->D) require cascading escrow. Sui PTBs (Programmable Transaction Blocks) can atomically settle multi-party chains. |
| E-10 | 18.10 | Privacy-preserving settlement | Sui Move | P3 | L | ZK-proof based settlement verification. Prove work completed without revealing proprietary process details. Sui's ZK-login and future ZK-Move support. |
| E-11 | 18.5.3 | Capacity reservation deposits | Sui Move | P2 | M | Capacity reservations backed by on-chain deposits. Forfeit conditions for no-show. Automatic refund on fulfillment. |
| E-12 | 18.5.1 | Real-time capacity price feeds | Chainlink | P3 | M | Chainlink custom Data Streams publishing aggregate capacity/demand metrics per region per capability. Enables market-driven pricing. |
| E-13 | 18.7.2 | Cross-currency settlement | Chainlink + Sui | P3 | L | Chainlink CCIP for cross-chain token bridging if multi-chain settlement needed. Chainlink price feeds for FX conversion in multi-currency escrow. |
| E-14 | 18.7.4 | Treasury management | Sui Move | P2 | M | Network treasury as Sui shared object. Governance-controlled spending. Fee distribution to validators/operators. |

**Subtotal**: 14 points, estimated 145-210 SP

---

### Domain 2: Legal & Compliance (10 integration points)

| # | RFC Section | Integration Point | Technology | Priority | Effort | Description |
|---|-------------|-------------------|------------|----------|--------|-------------|
| L-1 | 19.8.4 | FDA 21 CFR Part 11 audit trail | Sui | P1 | L | Immutable audit trail anchoring. Merkle root of EventLog batches posted to Sui at configurable intervals. Provides tamper-evident regulatory proof. |
| L-2 | 19.8.6 | ITAR export control proof | Sui + Chainlink | P2 | L | On-chain proof that ITAR-controlled data never crossed jurisdiction boundaries. Chainlink oracles attest to geographic compliance of data routing. |
| L-3 | 20.9 | Consent management | Sui Move | P1 | M | `ConsentGrant` and `ConsentRevocation` schemas (20.9) as on-chain objects. Programmable expiry, scope enforcement, auditable consent trail. |
| L-4 | 20.10 | Data classification enforcement | Sui Move | P2 | M | Data classification levels C-0 through C-5 (20.10) enforced on-chain. Sharing agreements reference classification level. Violations create on-chain evidence. |
| L-5 | 21.9 | Audit trail isolation | Sui | P1 | M | Per-organization audit streams (ISO-41) with Merkle root anchoring to Sui. Cross-org audit queries verified against on-chain roots. |
| L-6 | 19.6 | Cryptographic key management | Sui | P2 | M | Ed25519 signing keys (19.6) bridged to Sui wallet addresses. Dual-use: NATS JWT signing + Sui transaction authorization. Key rotation events anchored on-chain. |
| L-7 | 20.6 | Signal attestation | Sui + Chainlink | P2 | M | Attestation envelopes (20.6.1) anchored on-chain. Chainlink oracles can serve as independent attestation verifiers for cross-org signal claims. |
| L-8 | 19.8.4 | Electronic signature compliance | Sui | P2 | S | Sui transaction signatures satisfy electronic signature requirements. Map Sui `Ed25519` signatures to FDA-compliant audit records. |
| L-9 | 21.8 | Cross-org sharing agreements | Sui Move | P1 | L | Bilateral sharing agreements (ISO-33 through ISO-40) as on-chain contracts. `Schema.omit` redaction rules encoded in Move. Consent and revocation tracked on-chain. |
| L-10 | 19.8 | SOC 2 Type II evidence | Sui | P3 | M | Continuous compliance evidence anchored on-chain. SOC 2 control attestations with Sui timestamps. Auditor-verifiable without platform access. |

**Subtotal**: 10 points, estimated 95-140 SP

---

### Domain 3: Operations & Identity (13 integration points)

| # | RFC Section | Integration Point | Technology | Priority | Effort | Description |
|---|-------------|-------------------|------------|----------|--------|-------------|
| O-1 | 20.3 | Organization identity | Sui Move | P0 | L | Organization identity lifecycle (`UNVERIFIED` -> `PROVISIONED` -> `ACTIVE` -> `SUSPENDED` -> `DEACTIVATED`) as Sui objects. Identity is the anchor for all trust operations. |
| O-2 | 20.4 | Bilateral trust channels | Sui Move | P0 | M | Trust establishment (20.4) as on-chain bilateral agreements. Zero-trust default. Trust tier progression (`NEWCOMER` -> `ESTABLISHED` -> `TRUSTED` -> `PREFERRED`) recorded on-chain. |
| O-3 | 18.8.1 | G-10 trust score | Sui Move | P1 | L | G-10 composite reputation (signal consistency 30%, clock accuracy 20%, uptime 25%, peer validation 25%) computed and published on-chain. Soulbound score objects. |
| O-4 | 18.8.2 | Capability verification | Sui + Chainlink | P1 | M | On-chain capability attestation NFTs. Chainlink oracles verify external certifications (ISO 9001, AS9100, IATF 16949) against certificate registries. |
| O-5 | 18.8.3 | Sybil resistance | Sui Move | P1 | M | Stake-weighted identity verification. Organizations stake tokens on-chain; slashing for fraudulent behavior. Economic Sybil resistance complements NATS account isolation. |
| O-6 | 18.4 | Capability discovery | Chainlink | P2 | M | Chainlink Functions for querying external certification databases. Real-time capability verification without trusting self-reported claims. |
| O-7 | 15 | Network entity objects | Sui Move | P1 | L | Network-level entities (Organization, Capability, Capacity, Reputation from Section 15) as Sui shared objects. These are the atoms of the commons graph. |
| O-8 | 20.5 | Reputation scoring | Sui + Chainlink | P1 | L | On-chain reputation computation. Chainlink VRF for randomized audit sampling. K-anonymity requirement (20.5.4) enforced at query layer. |
| O-9 | 5.7 (O-1/O-2/O-3) | Outward propagation | Chainlink CCIP | P2 | XL | Outward propagation rules (O-1 marketplace signals, O-2 reputation updates, O-3 compliance events) delivered cross-network via Chainlink CCIP. |
| O-10 | 20.11 | Trust degradation & revocation | Sui Move | P1 | M | Trust degradation events and emergency revocation (20.11) as on-chain state transitions. Immediate propagation via NATS, immutable record on Sui. |
| O-11 | 21.4 | Account provisioning proof | Sui | P2 | S | NATS account provisioning (21.4) anchored with Sui transaction proof. Verifiable that account was created by authorized provisioner. |
| O-12 | 21.6 | Compute isolation attestation | Chainlink | P3 | M | Chainlink oracles attest to compute isolation guarantees (ISO-19 through ISO-26). TEE attestation verification via oracle network. |
| O-13 | 20.4.3 | Trust tier progression proofs | Sui Move | P2 | S | Trust tier changes (NEWCOMER -> ESTABLISHED -> TRUSTED -> PREFERRED) require on-chain proof of criteria met. Prevents trust inflation. |

**Subtotal**: 13 points, estimated 120-175 SP

---

### Domain 4: Security & Infrastructure (10 integration points)

| # | RFC Section | Integration Point | Technology | Priority | Effort | Description |
|---|-------------|-------------------|------------|----------|--------|-------------|
| S-1 | 19.4 | Wallet-based identity | Sui | P0 | M | Sui wallet addresses as identity anchors alongside NATS JWT. `SuiWallet <-> NATS Account` mapping. Wallet-based authentication for marketplace operations. |
| S-2 | 19.4.5 | Service-to-service auth on-chain | Sui | P2 | M | SPIFFE identities (19.4.5) with on-chain registration. Service identity lifecycle anchored to Sui. Revocation propagates via both NATS and on-chain state. |
| S-3 | 19.5.4 | Cross-org signed tokens | Sui | P1 | M | Cross-org authorization tokens (19.5.4) as Sui-signed capabilities. Verifiable without contacting issuing organization. Time-bounded, scope-limited. |
| S-4 | 19.7.6 | Zero-trust boundary enforcement | Sui + Chainlink | P2 | L | Zero-trust boundaries (19.7.6) with on-chain policy definitions. Chainlink oracles validate boundary conditions for cross-org operations. |
| S-5 | 19.3 | Threat model: blockchain layer | Sui | P1 | M | **New subsection needed**: Threat model for Sui integration. 51% attack irrelevance (Sui BFT), smart contract vulnerabilities, oracle manipulation, front-running. |
| S-6 | 21.3 | Five-layer isolation + chain layer | Sui | P2 | M | **Sixth isolation layer**: On-chain isolation. Sui shared objects scoped to bilateral agreements. No global state leakage. Complements NATS account isolation. |
| S-7 | 21.5 | JetStream domain anchoring | Sui | P3 | S | JetStream domain configurations (ISO-14 through ISO-18) with on-chain configuration hashes. Tamper detection for stream topology changes. |
| S-8 | 19.6 | Key rotation ceremony | Sui Move | P2 | M | Cryptographic key rotation (19.6) with on-chain ceremony. Old key deauthorized, new key authorized atomically. Rotation history immutable. |
| S-9 | 19.4.3 | Edge device identity | Sui | P3 | L | Edge device authentication (19.4.3) with lightweight on-chain identity. Device attestation via Sui objects. Supports device lifecycle (provision, rotate, decommission). |
| S-10 | 19.5.1 | Subject-based auth + on-chain ACL | Sui Move | P2 | M | NATS subject-based authorization (19.5.1) augmented with on-chain ACL definitions. Cross-org subject permissions governed by bilateral Sui agreements. |

**Subtotal**: 10 points, estimated 85-130 SP

---

## Priority Summary

| Priority | Count | Estimated SP | Key Deliverables |
|----------|-------|-------------|------------------|
| **P0** | 5 | 55-75 SP | Org identity (O-1), trust channels (O-2), escrow contract (E-1), escrow sync (E-2), wallet identity (S-1) |
| **P1** | 15 | 155-215 SP | Settlement (E-3/E-4), work order anchoring (E-7), G-10 score (O-3), capabilities (O-4), Sybil resistance (O-5), reputation (O-8), network entities (O-7), trust degradation (O-10), FDA audit (L-1), consent (L-3), audit isolation (L-5), sharing agreements (L-9), cross-org tokens (S-3), threat model (S-5), network fees (E-5) |
| **P2** | 18 | 155-240 SP | Dispute resolution (E-8), pricing feeds (E-6), multi-hop (E-9), capacity deposits (E-11), ITAR (L-2), classification (L-4), key mgmt (L-6), attestation (L-7), SOC 2 (L-10), outward propagation (O-9), provisioning proof (O-11), trust tier proofs (O-13), service auth (S-2), zero-trust (S-4), isolation (S-6), key rotation (S-8), ACL (S-10), treasury (E-14) |
| **P3** | 9 | 60-90 SP | Privacy settlement (E-10), capacity feeds (E-12), cross-currency (E-13), compute attestation (O-12), JetStream anchoring (S-7), edge device identity (S-9) |
| **Total** | **47** | **425-620 SP** | |

---

## Recommended RFC Amendments

The following new subsections should be added to RFC-001:

### Amendment 1: New Section — "Blockchain Settlement Layer" (insert after Section 18.10)

**Proposed**: Section 18.11 — Sui Settlement Architecture

Content:
- 18.11.1 — Escrow Move module specification (object model, entry functions, access control)
- 18.11.2 — Settlement state machine (on-chain states, transition guards, timeout handling)
- 18.11.3 — Multi-hop settlement via PTBs (atomic cascading settlement)
- 18.11.4 — Network treasury and fee distribution
- 18.11.5 — Cross-currency and multi-token support
- 18.11.6 — Privacy-preserving settlement (ZK proofs)

**Rationale**: Section 18.7 defines escrow and settlement as event-sourced NATS patterns. These MUST be augmented with on-chain settlement for trustless operation between untrusted organizations.

### Amendment 2: New Section — "On-Chain Identity & Trust" (insert after Section 20.11)

**Proposed**: Section 20.12 — Sui Identity Objects

Content:
- 20.12.1 — Organization identity object model (Sui shared objects)
- 20.12.2 — Wallet-to-NATS-account binding protocol
- 20.12.3 — Trust channel creation ceremony (on-chain bilateral agreement)
- 20.12.4 — G-10 reputation as soulbound objects
- 20.12.5 — Capability NFTs and verification oracles
- 20.12.6 — Sybil resistance via staking
- 20.12.7 — Trust degradation on-chain protocol

**Rationale**: Section 20 defines trust model semantically but lacks on-chain anchoring. Without blockchain-backed identity, the trust model relies entirely on NATS account isolation — insufficient for a 200K-org commons where organizations are mutually untrusted.

### Amendment 3: New Section — "Oracle Integration" (insert after proposed 18.11)

**Proposed**: Section 18.12 — Chainlink Oracle Architecture

Content:
- 18.12.1 — Price feed integration (material costs, market rates, FX)
- 18.12.2 — Certification verification oracles (ISO 9001, AS9100, IATF 16949)
- 18.12.3 — Chainlink Automation for timeout-based settlement triggers
- 18.12.4 — Chainlink VRF for randomized audit sampling
- 18.12.5 — Chainlink CCIP for cross-network event delivery (outward propagation)
- 18.12.6 — Custom Data Streams for capacity/demand aggregation
- 18.12.7 — Oracle security model and manipulation resistance

**Rationale**: The RFC references external data (pricing, certifications, geographic compliance) but provides no oracle architecture. Chainlink provides battle-tested infrastructure for all external data requirements.

### Amendment 4: New Subsection in Security — "Blockchain Threat Model"

**Proposed**: Section 19.3.5 — Blockchain-Specific Threats

Content:
- Smart contract vulnerabilities (reentrancy, integer overflow — mitigated by Move's type system)
- Oracle manipulation and flash loan attacks
- Front-running and MEV (mitigated by Sui's DAG-based consensus)
- Key management for organizational wallets
- Bridge/CCIP security assumptions
- Governance attack vectors (if DAO-governed treasury)

**Rationale**: Section 19.3 defines threat models for NATS/network/application layers but has no blockchain-specific threat analysis.

### Amendment 5: Extend Tenant Isolation — "Sixth Layer: On-Chain Isolation"

**Proposed**: Section 21.10 — On-Chain Isolation

Content:
- ISO-42: Sui shared objects scoped to bilateral agreements only
- ISO-43: No global state readable by unauthorized organizations
- ISO-44: On-chain data classification enforcement
- ISO-45: Cross-chain message isolation via CCIP lane configuration

**Rationale**: The five-layer isolation model (21.3) must be extended to six layers when blockchain state is introduced. Without on-chain isolation, the carefully constructed NATS isolation can be bypassed via on-chain state queries.

### Amendment 6: New Section — "NATS-to-Sui Bridge Service"

**Proposed**: Section 22.X (or as appendix) — SuiBridgeService Architecture

Content:
- Bridge service as Effect-TS Layer (SuiBridgeService.Default)
- Event routing: which NATS events trigger on-chain transactions
- Batching strategy: Merkle root anchoring at configurable intervals (not per-event)
- Failure modes: Sui unavailable, transaction rejected, gas exhaustion
- Consistency model: Eventual consistency between NATS state and on-chain state
- Cost optimization: Batch anchoring vs. per-transaction costs

**Rationale**: The bridge between NATS real-time operations and Sui settlement is the most critical integration seam. It needs its own architectural specification.

---

## Per-Section Deep Analysis

### Section 5: Event Taxonomy & Propagation (Lines 2000-3000)

**Current**: Events classified by ISA-95 level, latency tier, delivery model. Propagation rules (upward U-1..U-4, downward D-1..D-3, lateral L-1..L-3, outward O-1..O-3).

**Blockchain relevance**: Outward propagation rules O-1 (marketplace signals), O-2 (reputation updates), O-3 (compliance events) are the natural candidates for on-chain anchoring and cross-network delivery.

**Integration**:
- O-1 marketplace signals -> Sui event emission for cross-org visibility
- O-2 reputation updates -> On-chain reputation object mutations
- O-3 compliance events -> Merkle root anchoring for regulatory proof
- NATS remains the transport for T1/T2 intra-org events (no blockchain needed for <1s sensor data)

**RFC change**: Add O-4 (settlement events) and O-5 (identity events) as new outward propagation categories that are blockchain-native.

### Section 15: Network Entity Types

**Current**: Defines Organization, Capability, Capacity, Reputation as network-level entity types with CRDT-based aggregates (OR-Set, G-Counter, Bounded Counter, LWW-Register).

**Blockchain relevance**: These four entity types are the atoms of the commons. They MUST have on-chain representations for trustless operation.

**Integration**:
- `Organization` -> Sui shared object with identity fields
- `Capability` -> Sui NFT with attestation metadata (verifiable via Chainlink oracles)
- `Capacity` -> Sui dynamic field updated by authorized signers (bridge from NATS telemetry)
- `Reputation` -> Soulbound Sui object with G-10 score components

**CRDT compatibility**: Sui's object model supports OR-Set semantics via dynamic fields. G-Counter via integer fields with monotonic increment guards. The CRDTs described in the RFC map naturally to Move structs.

### Section 18: Marketplace Protocol (Lines 11592-12477)

**Current**: Comprehensive marketplace with capability discovery, capacity signaling, work order lifecycle, escrow, settlement, trust/reputation. All implemented as NATS-based event sourcing.

**Blockchain relevance**: This is the highest-density integration zone. Nearly every subsection has a blockchain integration point.

**Key transformations**:

1. **Escrow (18.7.2)**: The event-sourced escrow ledger (`EscrowCreated`, `EscrowFunded`, `EscrowReleased`, `EscrowFrozen`, `EscrowSettled`) becomes a Sui Move module. Events still published to NATS for reactive UI, but the source of truth moves on-chain.

2. **Settlement triggers (18.7.3)**: `AllPartyConfirm`, `QCPassAutoRelease`, `TimeoutRelease`, `DisputeFreeze` become Move entry functions with guard conditions. Chainlink Automation handles timeout triggers.

3. **Work order state machine (18.6.1)**: `RFQ_POSTED` -> `QUOTING` -> `ACCEPTED` -> `IN_PROGRESS` -> `QC_PENDING` -> `SHIPPED` -> `COMPLETE` -> `SETTLED` — each transition anchored on-chain. NATS handles real-time notifications; Sui handles authoritative state.

4. **G-10 trust score (18.8.1)**: Composite score (signal consistency 30%, clock accuracy 20%, uptime 25%, peer validation 25%) computed off-chain (from NATS telemetry) but published on-chain as soulbound reputation objects. Chainlink VRF for randomized audit verification.

5. **Multi-hop work orders (18.9.3)**: A->B->C->D chains require cascading escrow. Sui PTBs can atomically create/fund/link escrow objects for the entire chain in a single transaction.

### Section 19: Security Architecture (Lines 12478-13377)

**Current**: NATS decentralized JWT auth, SPIFFE for services, OIDC bridge, edge device auth, zero-trust boundaries.

**Blockchain relevance**: Authentication and authorization can be augmented (not replaced) with wallet-based identity for marketplace operations.

**Key transformations**:

1. **Auth (19.4)**: Add `Sui wallet` as third identity provider alongside NATS JWT and OIDC. Wallet used for marketplace signing, escrow funding, reputation staking.

2. **Cross-org tokens (19.5.4)**: Currently signed JWT tokens for cross-org authorization. Augment with Sui-signed capability tokens — verifiable without contacting issuing org, on-chain revocation.

3. **Key management (19.6)**: Ed25519 keys used for both NATS JWT signing and Sui transactions. Key rotation requires on-chain ceremony to prevent orphaned authorizations.

4. **Threat model (19.3)**: Needs blockchain-specific threat analysis. Sui's Move language mitigates many smart contract risks (no reentrancy by design), but oracle manipulation and governance attacks need coverage.

### Section 20: Trust Model (Lines 13386-14177)

**Current**: Organization identity lifecycle, trust establishment, reputation scoring, signal attestation, consent management, data classification, trust degradation.

**Blockchain relevance**: The entire trust model is the natural home for blockchain integration. Trust between mutually untrusted organizations is exactly what blockchain solves.

**Key transformations**:

1. **Org identity (20.3)**: Lifecycle states (`UNVERIFIED` -> `PROVISIONED` -> `ACTIVE` -> `SUSPENDED` -> `DEACTIVATED`) as Sui object states. On-chain identity is the root of all trust.

2. **Trust establishment (20.4)**: Bilateral trust channels as on-chain agreements. Zero-trust default enforced by requiring on-chain agreement before any data sharing.

3. **Trust tiers (20.4.3)**: `NEWCOMER` -> `ESTABLISHED` -> `TRUSTED` -> `PREFERRED` progression requires on-chain proof of criteria met. Prevents trust inflation.

4. **Reputation (20.5)**: G-10 score published on-chain. K-anonymity (20.5.4) enforced by aggregating scores before on-chain publication (never individual metrics on-chain).

5. **Consent (20.9)**: `ConsentGrant` and `ConsentRevocation` as Sui events. Programmable expiry enforced by Move module. Auditable consent trail without trusting any single party.

6. **Data classification (20.10)**: C-0 through C-5 levels encoded in sharing agreement Move modules. Classification violations create on-chain evidence for dispute resolution.

### Section 21: Tenant Isolation (Lines 14178-14777)

**Current**: Five-layer isolation (NATS account, JetStream domain, cluster shard, data-at-rest encryption, cross-org sharing controls).

**Blockchain relevance**: A sixth isolation layer is needed for on-chain state. Without it, the careful NATS isolation can be circumvented via blockchain state queries.

**Key transformations**:

1. **Sixth layer (21.10 proposed)**: On-chain isolation. Sui shared objects scoped to specific bilateral agreements. No global query that reveals relationships between organizations.

2. **Cross-org sharing (21.8)**: Bilateral sharing agreements (ISO-33 through ISO-40) enforced on-chain. `Schema.omit` redaction rules encoded as Move access control. Consent required before any cross-org on-chain state is readable.

3. **Audit trail (21.9)**: Per-org EventLog Merkle roots anchored to Sui. Cross-org audit queries verified against on-chain roots without exposing underlying events.

---

## Architecture Decision: Hybrid NATS + Sui + Chainlink

### What stays on NATS (unchanged)

| Category | Rationale |
|----------|-----------|
| T1 sensor telemetry (<100ms) | Blockchain latency (~400ms on Sui) is too high |
| T2 intra-org events (<1s) | Internal operations need no external trust |
| Equipment state transitions | Real-time operational safety cannot wait for finality |
| Alarm propagation | ISA-18.2 alarm response times require NATS speed |
| Hot delivery tier (p99 <3s) | On-chain settlement adds unacceptable latency |
| Intra-org event sourcing | EventLog + JetStream is correct for internal state |

### What moves to Sui

| Category | Rationale |
|----------|-----------|
| Escrow funds and settlement | Trustless custody between untrusted orgs |
| Organization identity | Foundational anchor for all trust operations |
| Bilateral trust agreements | Cannot be unilaterally modified by either party |
| Reputation scores | Publicly verifiable, tamper-proof |
| Consent grants/revocations | Neither party can deny or fabricate consent |
| Regulatory audit anchoring | Immutable proof for FDA/SOC2/ITAR compliance |
| Capability attestation NFTs | Verifiable credentials without contacting issuer |
| Cross-org authorization | Verifiable without trusting issuing organization |

### What uses Chainlink

| Category | Rationale |
|----------|-----------|
| Material/market price feeds | External data with cryptographic attestation |
| Certification verification | Query ISO/AS9100 registries via oracle network |
| Timeout-based triggers | Chainlink Automation for SLA enforcement |
| VRF for audit sampling | Provably random, manipulation-resistant selection |
| Cross-network messaging | CCIP for multi-network event delivery |
| Geographic compliance | Oracle attestation of data routing paths |

---

## Implementation Roadmap

### Phase A: Foundation (P0 items, Sprints 1-2)

```
A.1  Organization identity on Sui (O-1)                    → L  (13-21 SP)
A.2  Wallet-to-NATS binding (S-1)                          → M  (8-13 SP)
A.3  Bilateral trust channel creation (O-2)                 → M  (8-13 SP)
A.4  Escrow Move module (E-1)                               → L  (13-21 SP)
A.5  Escrow-to-NATS bridge (SuiBridgeService) (E-2)        → M  (8-13 SP)
                                                     Total: 50-81 SP
```

### Phase B: Core Marketplace (P1 items, Sprints 3-5)

```
B.1  Settlement triggers on-chain (E-3)                     → M  (8-13 SP)
B.2  Automatic settlement + Chainlink Automation (E-4)      → L  (13-21 SP)
B.3  Network fee collection (E-5)                           → S  (3-5 SP)
B.4  Work order lifecycle anchoring (E-7)                   → L  (13-21 SP)
B.5  G-10 reputation on-chain (O-3)                         → L  (13-21 SP)
B.6  Capability verification + oracles (O-4)                → M  (8-13 SP)
B.7  Sybil resistance staking (O-5)                         → M  (8-13 SP)
B.8  Network entity Sui objects (O-7)                       → L  (13-21 SP)
B.9  Reputation scoring on-chain (O-8)                      → L  (13-21 SP)
B.10 Trust degradation protocol (O-10)                      → M  (8-13 SP)
B.11 FDA audit trail anchoring (L-1)                        → L  (13-21 SP)
B.12 Consent management on-chain (L-3)                      → M  (8-13 SP)
B.13 Audit isolation (L-5)                                  → M  (8-13 SP)
B.14 Cross-org sharing agreements (L-9)                     → L  (13-21 SP)
B.15 Cross-org signed tokens (S-3)                          → M  (8-13 SP)
B.16 Blockchain threat model (S-5)                          → M  (8-13 SP)
                                                     Total: 160-266 SP
```

### Phase C: Enhanced Trust & Compliance (P2 items, Sprints 6-8)

```
C.1  Dynamic pricing feeds (E-6)                            → M  (8-13 SP)
C.2  Dispute resolution on-chain (E-8)                      → L  (13-21 SP)
C.3  Multi-hop settlement (E-9)                             → XL (21-34 SP)
C.4  Capacity reservation deposits (E-11)                   → M  (8-13 SP)
C.5  Treasury management (E-14)                             → M  (8-13 SP)
C.6  ITAR export control proof (L-2)                        → L  (13-21 SP)
C.7  Data classification enforcement (L-4)                  → M  (8-13 SP)
C.8  Key management (L-6)                                   → M  (8-13 SP)
C.9  Signal attestation (L-7)                               → M  (8-13 SP)
C.10 Capability discovery oracles (O-6)                     → M  (8-13 SP)
C.11 Outward propagation via CCIP (O-9)                     → XL (21-34 SP)
C.12 Trust tier proofs (O-13)                               → S  (3-5 SP)
C.13 Account provisioning proof (O-11)                      → S  (3-5 SP)
C.14 Service-to-service auth on-chain (S-2)                 → M  (8-13 SP)
C.15 Zero-trust boundary enforcement (S-4)                  → L  (13-21 SP)
C.16 Six-layer isolation (S-6)                              → M  (8-13 SP)
C.17 Key rotation ceremony (S-8)                            → M  (8-13 SP)
C.18 Subject-based auth + on-chain ACL (S-10)               → M  (8-13 SP)
                                                     Total: 183-290 SP
```

### Phase D: Advanced Features (P3 items, Sprints 9+)

```
D.1  Privacy-preserving settlement (E-10)                   → L  (13-21 SP)
D.2  Capacity price feeds (E-12)                            → M  (8-13 SP)
D.3  Cross-currency settlement (E-13)                       → L  (13-21 SP)
D.4  SOC 2 evidence (L-10)                                  → M  (8-13 SP)
D.5  Compute isolation attestation (O-12)                   → M  (8-13 SP)
D.6  JetStream domain anchoring (S-7)                       → S  (3-5 SP)
D.7  Edge device identity on-chain (S-9)                    → L  (13-21 SP)
D.8  Electronic signature compliance (L-8)                  → S  (3-5 SP)
                                                     Total: 69-112 SP
```

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| **Sui throughput at 200K-org scale** | Batch anchoring (Merkle roots) not per-event. Only settlement-critical operations on-chain. |
| **Gas cost scaling** | Move modules optimized for minimal storage. Batch operations via PTBs. Sponsored transactions for onboarding. |
| **Oracle manipulation** | Multiple Chainlink nodes, price deviation circuit breakers, TWAP instead of spot for settlement. |
| **Smart contract bugs** | Move's type system prevents reentrancy. Formal verification of escrow module. Audit by Sui ecosystem security firm. |
| **Latency for time-sensitive operations** | NATS remains primary for all T1/T2 operations. Sui only for settlement (T3/T4 acceptable latency). |
| **Key management complexity** | Ed25519 key shared between NATS and Sui. HSM-backed for organizations. Key rotation ceremony spec. |
| **Regulatory uncertainty** | Modular architecture — blockchain layer can be swapped/disabled per jurisdiction. Feature-flagged. |
| **Bridge reliability** | SuiBridgeService with retry, dead-letter queue, and idempotency. NATS is operational truth; Sui is settlement truth. |

---

## Appendix A: Move Module Sketch — Escrow

```move
module commons::escrow {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};

    /// Escrow states
    const CREATED: u8 = 0;
    const FUNDED: u8 = 1;
    const RELEASED: u8 = 2;
    const FROZEN: u8 = 3;
    const SETTLED: u8 = 4;
    const DISPUTED: u8 = 5;

    /// Error codes
    const E_NOT_BUYER: u64 = 0;
    const E_NOT_SELLER: u64 = 1;
    const E_INVALID_STATE: u64 = 2;
    const E_TIMEOUT_NOT_REACHED: u64 = 3;

    struct Escrow has key, store {
        id: UID,
        work_order_id: vector<u8>,
        buyer: address,
        seller: address,
        amount: u64,
        funded: Coin<SUI>,
        state: u8,
        created_at: u64,
        timeout_ms: u64,
        network_fee_bps: u64,  // basis points (100 = 1%)
    }

    /// Create escrow — buyer initiates
    public fun create(
        work_order_id: vector<u8>,
        seller: address,
        payment: Coin<SUI>,
        timeout_ms: u64,
        network_fee_bps: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Escrow {
        Escrow {
            id: object::new(ctx),
            work_order_id,
            buyer: tx_context::sender(ctx),
            seller,
            amount: coin::value(&payment),
            funded: payment,
            state: FUNDED,
            created_at: clock::timestamp_ms(clock),
            timeout_ms,
            network_fee_bps,
        }
    }

    /// Release — both parties confirm, or QC auto-release
    public fun release(
        escrow: &mut Escrow,
        ctx: &TxContext
    ) {
        assert!(escrow.state == FUNDED, E_INVALID_STATE);
        // Authorization logic (buyer or QC oracle)
        escrow.state = RELEASED;
    }

    /// Settle — distribute funds after release
    public fun settle(
        escrow: Escrow,
        treasury: address,
        ctx: &mut TxContext
    ) {
        assert!(escrow.state == RELEASED, E_INVALID_STATE);
        let Escrow {
            id, work_order_id: _, buyer: _, seller,
            amount, funded, state: _,
            created_at: _, timeout_ms: _,
            network_fee_bps
        } = escrow;

        let fee_amount = (amount * network_fee_bps) / 10000;
        let seller_amount = amount - fee_amount;

        // Split and transfer
        let fee_coin = coin::split(&mut funded, fee_amount, ctx);
        transfer::public_transfer(fee_coin, treasury);
        transfer::public_transfer(funded, seller);

        object::delete(id);
    }

    /// Freeze — dispute raised
    public fun freeze(
        escrow: &mut Escrow,
        ctx: &TxContext
    ) {
        assert!(escrow.state == FUNDED, E_INVALID_STATE);
        escrow.state = FROZEN;
    }

    /// Timeout release — Chainlink Automation calls this
    public fun timeout_release(
        escrow: &mut Escrow,
        clock: &Clock,
        ctx: &TxContext
    ) {
        assert!(escrow.state == FUNDED, E_INVALID_STATE);
        let now = clock::timestamp_ms(clock);
        assert!(now >= escrow.created_at + escrow.timeout_ms, E_TIMEOUT_NOT_REACHED);
        escrow.state = RELEASED;
    }
}
```

## Appendix B: Effect-TS SuiBridgeService Sketch

```typescript
import { Context, Effect, Layer, Schedule, Stream } from 'effect'
import { Schema } from 'effect'

// --- Service Definition ---
class SuiBridgeService extends Context.Tag('SuiBridgeService')<
  SuiBridgeService,
  {
    readonly anchorMerkleRoot: (
      batch: EventLogBatch
    ) => Effect.Effect<SuiTransactionDigest, SuiBridgeError>

    readonly createEscrow: (
      params: EscrowParams
    ) => Effect.Effect<EscrowObject, SuiBridgeError>

    readonly settleEscrow: (
      escrowId: SuiObjectId,
      trigger: SettlementTrigger
    ) => Effect.Effect<SettlementResult, SuiBridgeError>

    readonly publishReputation: (
      orgId: OrganizationId,
      score: G10Score
    ) => Effect.Effect<void, SuiBridgeError>

    readonly verifyCapability: (
      orgId: OrganizationId,
      capability: CapabilityId
    ) => Effect.Effect<VerificationResult, SuiBridgeError>
  }
>() {}

// --- Schemas ---
const SuiTransactionDigest = Schema.String.pipe(
  Schema.brand('SuiTransactionDigest')
)
const SuiObjectId = Schema.String.pipe(Schema.brand('SuiObjectId'))

const EscrowParams = Schema.TaggedStruct('EscrowParams', {
  workOrderId: Schema.String,
  buyerWallet: Schema.String,
  sellerWallet: Schema.String,
  amountMist: Schema.BigIntFromSelf,
  timeoutMs: Schema.Number,
  networkFeeBps: Schema.Number,
})

const SettlementTrigger = Schema.Union(
  Schema.TaggedStruct('AllPartyConfirm', { confirmations: Schema.Array(Schema.String) }),
  Schema.TaggedStruct('QCPassAutoRelease', { qcReportId: Schema.String }),
  Schema.TaggedStruct('TimeoutRelease', { timestamp: Schema.Number }),
  Schema.TaggedStruct('DisputeResolution', { ruling: Schema.Literal('buyer', 'seller', 'split') })
)

// --- Layer ---
const SuiBridgeServiceLive = Layer.succeed(SuiBridgeService, {
  anchorMerkleRoot: (batch) =>
    Effect.gen(function* () {
      // Compute Merkle root of EventLog batch
      // Submit Sui transaction via @mysten/sui SDK
      // Retry with exponential backoff on failure
      // Return transaction digest
    }).pipe(
      Effect.retry(Schedule.exponential('1 second').pipe(Schedule.compose(Schedule.recurs(5))))
    ),

  createEscrow: (params) =>
    Effect.gen(function* () {
      // Build PTB: call commons::escrow::create
      // Sign with org wallet
      // Execute and return escrow object
    }),

  settleEscrow: (escrowId, trigger) =>
    Effect.gen(function* () {
      // Match on trigger type
      // Build appropriate PTB (release + settle, or freeze)
      // Execute and return result
    }),

  publishReputation: (orgId, score) =>
    Effect.gen(function* () {
      // Update soulbound reputation object
      // Publish to NATS for reactive UI
    }),

  verifyCapability: (orgId, capability) =>
    Effect.gen(function* () {
      // Check on-chain capability NFT
      // Optionally trigger Chainlink oracle for external verification
    }),
})
```

---

## Appendix C: Sections Not Requiring Blockchain Integration

The following RFC sections require **no** Sui or Chainlink integration and should remain purely NATS-based:

| Section | Topic | Rationale |
|---------|-------|-----------|
| 4-5 | Event taxonomy, ISA-95 hierarchy | Internal operational semantics — no trust boundary |
| 6-7 | Entity lifecycle, state machines | Intra-org state management — NATS + EventLog sufficient |
| 8-10 | Alarm, WorkOrder, EquipmentState ES | Internal event sourcing — no cross-org trust needed |
| 11-12 | Non-ES entities, integration | Internal entity management |
| 13-14 | Stream composition, ChannelService | Real-time data plumbing — latency critical |
| 16 | Holonet/cluster topology | Internal infrastructure — no external trust |
| 17 | RPC layer | Internal API — auth already handled by NATS JWT |
| 22-27 | Performance, testing, migration, governance | Implementation details — blockchain-agnostic |

---

*End of audit. 47 integration points identified across 4 domains. 6 RFC amendments recommended. Estimated total effort: 425-620 SP across 4 phases.*

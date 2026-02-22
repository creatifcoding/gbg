# WBS V2 — DePIN & Blockchain Economics

**Author**: depin-architect
**Date**: 2026-02-13
**RFC Sections**: S30 (Part VIII), S18.11, S18.12, S19.3.5, S20.12, S21.13, S22.10
**Total Story Points**: 397 SP across 25 Epics (DP-01 through DP-15, DP-17 through DP-26) + 1 cross-ref (DP-16)
**Domain Prefix**: **DP**

---

## Scope

This WBS covers all blockchain and DePIN content from RFC-001:

| Section | Title | Lines | Role |
|---------|-------|-------|------|
| **S30** | DePIN Network Economics | 28854-29759 | PRIMARY — Token model, mining, governance |
| **S18.11** | Sui Settlement Architecture | 12344-13643 | Escrow, treasury, capacity tokens, privacy |
| **S18.12** | Oracle Integration Architecture | 13664-14163+ | Pyth, Chainlink Functions, attestation |
| **S19.3.5** | Blockchain-Specific Threat Model | 15007-15706 | 19 threats, 40+ requirements |
| **S20.12** | On-Chain Identity and Trust Objects | 17218-18720 | Org identity, trust channels, reputation, DID |
| **S21.13** | On-Chain Isolation | 19653-20430 | 6-layer isolation for blockchain state |
| **S22.10** | NATS-to-Sui Bridge Service | 21443-22660 | SuiBridgeService, batching, failure modes |

---

## Cross-Domain Dependencies

| Dependency | Owner | Nature |
|-----------|-------|--------|
| Marketplace protocol (S18.1-18.10) | network-architect (NW) | Escrow integrates with marketplace work orders |
| Security threat model (S19.1-19.3.4) | security-architect (SC) | Blockchain threats extend existing model |
| Governance DAO UI (S23.6) | devex-architect (DX) | DAO voting UI and proposal display (Move contracts are ours) |
| NATS infrastructure (S13-14) | platform-architect (PL) / infra-architect (IF) | Bridge service depends on NATS JetStream |
| Edge device / gateway | infra-architect (IF) | Proof-of-Capacity requires hardware attestation |
| Regulatory compliance (S25) | platform-architect (PL) | ITAR, FDA Part 11 anchoring requirements |
| Observer infrastructure (PL-07, PL-08, PL-09, PL-11) | platform-architect (PL) | `makeEntityObserver()` factory for DePIN entities |

---

## Phase 0: DePIN Type Foundation (Sprint 0) — 79 SP

> **E2E Stack Audit Addition** — Layers 1 (Schema), 2 (Model), 3 (DDL), 4 (Repository), 5 (Error) were missing from the original WBS. These are foundational and must be completed before Phase 1 services can compile.

### Epic DP-17: DePIN Schemas & Branded Types — 8 SP

Effect Schema definitions for all blockchain domain types. Follows patterns from `src/lib/iiot/schemas/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-17.1.1 | 2 | Blockchain identifiers — `SuiTransactionDigest`, `SuiObjectId`, `MerkleRoot`, `OrganizationId` (branded via `Schema.String.pipe(Schema.brand(...))`) | S22.10.3.1 |
| ⏳ | DP-17.1.2 | 2 | Bridge domain schemas — `EventLogBatch`, `AnchorResult`, `EscrowParams`, `EscrowObject`, `SettlementTrigger`, `SettlementResult` (TaggedStruct) | S22.10.3.1 |
| ⏳ | DP-17.1.3 | 2 | Token & reward schemas — `RewardTier`, `ProofAttestation`, `EmissionEpoch`, `JurisdictionConfig`, `G10Score`, `VerificationResult` (TaggedStruct) | S30.2-3 |
| ⏳ | DP-17.1.4 | 1 | Oracle schemas — `PriceFeed`, `OracleAttestation`, `ChainlinkFunctionResult` | S18.12 |
| ⏳ | DP-17.1.5 | 1 | Barrel export — `src/lib/depin/schemas/index.ts` | — |

**Dependencies**: None (foundational)
**RFC Sections**: S22.10.3, S30.2-3, S18.12

---

### Epic DP-18: DePIN Error Schemas — 5 SP

Domain-specific TaggedError types per entity domain. Follows patterns from `src/lib/iiot/errors/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-18.1.1 | 2 | Bridge errors — `SuiBridgeError` (7 error codes: NETWORK_ERROR, GAS_EXCEEDED, OBJECT_NOT_FOUND, INVALID_PTB, SIGNATURE_FAILED, TIMEOUT, UNKNOWN), `MerkleError`, `ReconciliationError` | S22.10.7 |
| ⏳ | DP-18.1.2 | 1 | Settlement errors — `EscrowNotFoundError`, `InvalidEscrowTransitionError`, `InsufficientFundsError`, `DeadlineExceededError` | S18.11.2 |
| ⏳ | DP-18.1.3 | 1 | Oracle errors — `PriceFeedStaleError`, `OracleTimeoutError`, `CircuitBreakerTrippedError` | S18.12, R-BC-5 |
| ⏳ | DP-18.1.4 | 1 | Token errors — `InsufficientStakeError`, `RewardComputationError`, `JurisdictionBlockedError`, `SlashingError` | S30.3, S30.8 |

**Dependencies**: DP-17 (schemas)
**RFC Sections**: S22.10.7, S18.11.2, S18.12, S30.3

---

### Epic DP-19: DePIN Models, DDL & Repositories — 13 SP

Persistence layer for bridge-side state. On-chain entities live in Sui; bridge operational state needs SQL persistence for outbox, DLQ, digest cache, batching state, and reward computation snapshots.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-19.1.1 | 2 | `BridgeTransactionModel` — Model.Class for outbox entries (tx_digest, status, payload_hash, retry_count, created_at, confirmed_at) | S22.10.7.3, R-BRG-15 |
| ⏳ | DP-19.1.2 | 2 | `MerkleBatchModel` — Model.Class for batch records (batch_id, org_id, event_type, leaf_count, root_hash, anchored_at, sui_digest) | S22.10.5.3 |
| ⏳ | DP-19.1.3 | 2 | `RewardSnapshotModel` — Model.Class for reward computation snapshots (epoch, org_id, device_id, tier, multiplier, amount, proof_type) | S30.3.3 |
| ⏳ | DP-19.2.1 | 2 | DDL migrations — `depin_bridge_transactions`, `depin_merkle_batches`, `depin_reward_snapshots` tables with indexes, constraints | — |
| ⏳ | DP-19.2.2 | 1 | `DeadLetterModel` — Model.Class for DLQ entries (dlq_id, operation_type, payload, error_code, failed_at, resolved_at) | S22.10.7.3 |
| ⏳ | DP-19.3.1 | 2 | `BridgeTransactionRepo` + `MerkleBatchRepo` — Effect SQL CRUD repos with query-by-status, query-by-org, pending-tx-scan | S22.10.8.3 |
| ⏳ | DP-19.3.2 | 2 | `RewardSnapshotRepo` + `DeadLetterRepo` — Effect SQL CRUD repos with epoch queries, DLQ resolution tracking | S30.3, S22.10.7 |

**Dependencies**: DP-17 (schemas), DP-18 (errors)
**RFC Sections**: S22.10.5-8, S30.3

**Note on scope**: On-chain entities (EscrowVault, CapacityToken, OrganizationIdentity, MachineINFT, etc.) do NOT get SQL models — Sui is their persistence layer. These models cover only the **bridge operational state** that the Effect-TS service layer needs for crash recovery, reconciliation, and analytics.

---

## Entity Tier Classification

> **Machine/CRUD Audit Addition** — Each DePIN entity classified into Tier 1 (Machine-backed, 12 layers) or Tier 2 (CRUD, 8 layers).

### Tier 1: Machine-Backed Entities (state machine lifecycle)

These entities have defined state machines. On-chain state machines live in Move; the Effect-TS side maintains **mirror state** for optimistic queries, streaming, and reconciliation.

| Entity | States | Source of Truth | Effect-TS Mirror? |
|--------|--------|----------------|-------------------|
| **EscrowVault** | CREATED -> FUNDED -> RELEASED -> SETTLED / FROZEN -> DISPUTED -> RESOLVED / REFUNDED (8 states) | Sui Move | Yes — optimistic tracking for streaming + reconciliation |
| **OrganizationIdentity** | UNVERIFIED -> PROVISIONED -> ACTIVE -> SUSPENDED -> DEACTIVATED (5 states) | Sui Move | Yes — NATS JWT authorization depends on current state |
| **TrustChannel** | PROPOSED -> ACCEPTED -> NEWCOMER -> BASIC -> VERIFIED -> TRUSTED -> PREMIUM / REVOKED (8 states) | Sui Move | Yes — marketplace matching queries trust tier |
| **ExpirableLease** | MINTED -> EXERCISED -> COMPLETED / EXPIRED / REVOKED (5 states) | Sui Move | Yes — capacity availability queries |
| **BridgeTransaction** | PENDING -> SUBMITTED -> CONFIRMED / FAILED -> DLQ (5 states) | Effect-TS (local) | N/A — this IS the source of truth |

**Layer requirements for Machine entities:**
- Machine definition (`@effect/experimental/Machine`) with state graph
- ES Handler (command handlers writing to EventLog)
- Entity definition (`@effect/cluster/Entity` with Rpc wiring)
- Observer/Reactivity (cache invalidation + EventDistribution bridge)

### Tier 2: CRUD Entities (data records)

| Entity | Reason | Layers |
|--------|--------|--------|
| **CapacityToken** | Semi-fungible, consumed/split — no lifecycle states | 8 (Schema, Model, DDL, Repo, Errors, Service, RPC, HTTP) |
| **CapabilityNFT** | Soulbound, minted with expiry — binary valid/expired | 8 |
| **ReputationSBT** | Score updates, no transitions | 8 |
| **NetworkTreasury** | Accumulator, deposit/disburse only | 8 |
| **MerkleBatch** | Batch records — immutable after anchoring | 8 |
| **RewardSnapshot** | Computation snapshots — immutable | 8 |
| **MachineINFT** | Dynamic field updates, not state transitions | 8 |

**Note**: CRUD entities that live on-chain (CapacityToken, CapabilityNFT, ReputationSBT, NetworkTreasury, MachineINFT) get their Schema/Errors/Service/RPC/HTTP layers in Effect-TS but NO Model/DDL/Repo — Sui is their persistence. Only MerkleBatch and RewardSnapshot get SQL persistence (already covered in DP-19).

---

### Epic DP-23: DePIN Machine Definitions — 21 SP

State machine definitions using `@effect/experimental/Machine` for entities with lifecycle states. Follows patterns from `src/lib/iiot/machines/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-23.1.1 | 5 | `EscrowMachine` — 8-state graph (CREATED/FUNDED/RELEASED/SETTLED/FROZEN/DISPUTED/RESOLVED/REFUNDED), Machine.procedures for create/fund/release/settle/freeze/dispute/resolve/refund, StateService delegation | S18.11.2 |
| ⏳ | DP-23.1.2 | 3 | `escrow-state-graph.ts` — Graph edge definitions with guard conditions (deadline validation, authorization checks, fee BPS bounds) | S18.11.2.3 |
| ⏳ | DP-23.2.1 | 3 | `OrganizationIdentityMachine` — 5-state graph (UNVERIFIED/PROVISIONED/ACTIVE/SUSPENDED/DEACTIVATED), procedures for register/provision/activate/suspend/deactivate | S20.12.3 |
| ⏳ | DP-23.2.2 | 2 | `TrustChannelMachine` — 8-state graph (PROPOSED/ACCEPTED/NEWCOMER through PREMIUM/REVOKED), procedures for propose/accept/upgrade/revoke, tier progression guards | S20.12.5 |
| ⏳ | DP-23.3.1 | 3 | `ExpirableLeaseMachine` — 5-state graph (MINTED/EXERCISED/COMPLETED/EXPIRED/REVOKED), Clock-based expiry transitions, exercise/complete/revoke procedures | S30.5 |
| ⏳ | DP-23.3.2 | 3 | `BridgeTransactionMachine` — 5-state graph (PENDING/SUBMITTED/CONFIRMED/FAILED/DLQ), retry logic, gas resubmission, DLQ escalation, confirmation tracking | S22.10.7 |
| ⏳ | DP-23.3.3 | 2 | Machine unit tests — state graph invariant assertions, guard condition coverage, invalid transition rejection | — |

**Dependencies**: DP-17 (schemas), DP-18 (errors)
**RFC Sections**: S18.11.2, S20.12.3-5, S22.10.7, S30.5

**Design note**: On-chain Machines (Escrow, OrgIdentity, TrustChannel, Lease) mirror Sui state for optimistic local queries. State updates arrive via Sui event subscriptions through the SuiBridgeService. The `BridgeTransactionMachine` is fully Effect-native — it IS the source of truth.

---

### Epic DP-24: DePIN Entity Layer & Observer Wiring — 32 SP

Entity definitions (`@effect/cluster/Entity`), ES handlers (EventLog command handlers), and **observer registration** with platform-architect's `makeEntityObserver()` infrastructure (PL-07, PL-08, PL-09, PL-11). Follows patterns from `src/lib/iiot/entity/`, `src/lib/iiot/handlers/`.

> **Architecture**: `Machine.changes` (built-in `Stream<State>` on every Machine) drives all real-time. At entity activation, a scoped fiber pipes `Machine.changes` through `Stream.zipWithPrevious` (NOT `Stream.pairwise` — does not exist) to compute (previous, current) pairs. Each transition emits an `EntityStateChanged` event to the `iiot:entity-changes` EventDistribution channel. Platform-architect provides this infrastructure — we **register** our entities, we don't rebuild it.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-24.0.1 | 2 | Extend `EntityStateChanged.entityType` union — add DePIN entity types: `'Escrow'`, `'OrganizationIdentity'`, `'TrustChannel'`, `'ExpirableLease'`, `'BridgeTransaction'` to the existing `Schema.Literal(...)` | RFC S8.1 |
| ⏳ | DP-24.1.1 | 5 | `EscrowEntity` — `Entity.make()` with Rpc definitions (CreateEscrow, GetEscrow, FundEscrow, ReleaseEscrow, SettleEscrow, FreezeEscrow, DisputeEscrow, ResolveDispute, RefundEscrow), Machine boot + `makeEntityObserver('Escrow', machine.changes)` registration via `Effect.forkScoped` | S18.11 |
| ⏳ | DP-24.1.2 | 3 | `escrow-handlers.ts` — ES command handlers writing EscrowCreated/EscrowFunded/EscrowReleased/EscrowSettled/EscrowFrozen/EscrowDisputed/EscrowResolved/EscrowRefunded events to EventLog | S18.11 |
| ⏳ | DP-24.1.3 | 2 | `escrow-reactivity.ts` — EventLog.groupReactivity mapping escrow events to cache keys (escrows:active, escrows:settled, escrows:disputed) | S18.11 |
| ⏳ | DP-24.2.1 | 5 | `OrganizationIdentityEntity` — Entity.make() with Rpc definitions (Register, Get, Provision, Activate, Suspend, Deactivate, BindNATSKey, RotateKey), Machine boot + observer registration. **Special**: SUSPENDED transition must trigger NATS JWT revocation within 60s SLA | S20.12 |
| ⏳ | DP-24.2.2 | 3 | `org-identity-handlers.ts` — ES command handlers writing OrgRegistered/OrgProvisioned/OrgActivated/OrgSuspended/OrgDeactivated/NATSKeyBound/KeyRotated events | S20.12 |
| ⏳ | DP-24.2.3 | 2 | `org-identity-reactivity.ts` — Cache invalidation for org identity state changes + JWT revocation hook (subscribe to `EntityStateChanged` where entityType='OrganizationIdentity' AND currentState='SUSPENDED') | S20.12, OCI-04 |
| ⏳ | DP-24.3.1 | 3 | `TrustChannelEntity` + `trust-channel-handlers.ts` — Entity + ES handlers + observer registration for trust channel lifecycle (propose/accept/upgrade/revoke) | S20.12.5 |
| ⏳ | DP-24.3.2 | 2 | `ExpirableLeaseEntity` + `lease-handlers.ts` — Entity + ES handlers + observer registration for lease lifecycle (mint/exercise/complete/expire/revoke) | S30.5 |
| ⏳ | DP-24.3.3 | 3 | `BridgeTransactionEntity` + `bridge-tx-handlers.ts` — Entity + ES handlers + observer registration for bridge transaction lifecycle (submit/confirm/fail/dlq) | S22.10.7 |
| ⏳ | DP-24.4.1 | 2 | Observer `Stream.zipWithPrevious` handler — handle `Option.none()` for previous state on first emission (action = "initialized"), map to correct `EntityStateChanged` action names per entity type | RFC S8.1, S12 |

**Dependencies**: DP-23 (machines), DP-19 (repos for BridgeTransaction persistence), DP-17/DP-18 (schemas, errors), **PL-07** (makeEntityObserver factory), **PL-08** (handler observer wiring), **PL-09** (SubscribeEntityChanges streaming RPC), **PL-11** (consistency guarantees)
**RFC Sections**: S18.11, S20.12, S22.10, S30.5, S8.1 (EntityStateChanged), S12 (Observer Pattern)

**Design notes**:
- On-chain entity handlers act as **event receivers** — they consume Sui event subscriptions, update local mirror state, write to EventLog, and trigger reactivity via `Machine.changes`. This is the inverse of IIoT entities where handlers are the primary writers.
- All 5 DePIN Machine entities publish to the **existing** `iiot:entity-changes` EventDistribution channel (maxLag 1k). No new channels needed — the unified `EntityStateChanged` schema with `entityType` discriminator handles filtering.
- `Stream.zipWithPrevious` (NOT `Stream.pairwise`) is the correct API. First emission yields `[Option.none(), currentState]` — mapped to action "initialized".
- Streaming RPCs (DP-22) subscribe to the `iiot:entity-changes` channel filtered by DePIN entity types — they do NOT subscribe to `Machine.changes` directly.

---

## Phase 1: Sui Foundation & Bridge Service (Sprints 1-3) — 55 SP

### Epic DP-01: Sui Client Service & Bridge Core — 21 SP

The foundational Effect-TS services wrapping the Sui SDK and providing the bridge between NATS and Sui.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-01.1.1 | 2 | `SuiClientService` — Effect service wrapping `@mysten/sui` SDK (`executePTB`, `dryRun`, `getObject`, `getGasPrice`) | S22.10.3.1 |
| ⏳ | DP-01.1.2 | 2 | `BridgeConfig` — Configuration service (Sui RPC URLs, package ID, signer key ref, gas budgets, batching intervals) | S22.10.3.2 |
| ⏳ | DP-01.1.3 | 3 | `SuiTransactionBuilder` — PTB construction helpers: `buildAnchorPTB`, `buildSettlementPTB`, `buildEscrowPTB` | S22.10.6.1-6.2 |
| ⏳ | DP-01.1.4 | 3 | Gas estimation + budget enforcement — dry-run validation, 20% buffer, hard cap checking | S22.10.6.3, R-BRG-11/12 |
| ⏳ | DP-01.1.5 | 3 | Sponsored transaction support — gas station for onboarding orgs below Basic trust tier | S22.10.6.4, R-BRG-13/14 |
| ⏳ | DP-01.1.6 | 3 | Error classification + retry strategy — `classifySuiError`, exponential backoff, settlement retry schedule | S22.10.7.1-7.2 |
| ⏳ | DP-01.1.7 | 3 | Dead-letter queue service — NATS KV-backed DLQ, monitoring alerts, operation type tracking | S22.10.7.3, R-BRG-15/16 |
| ⏳ | DP-01.1.8 | 2 | Leader election — `@effect/cluster` lease for single-writer bridge instance | S22.10.7.5, R-BRG-17 |

**Dependencies**: None (foundational)
**RFC Sections**: S22.10.3-22.10.7

---

### Epic DP-02: Merkle Batching & Compliance Anchoring — 18 SP

Event batching into Merkle trees and anchoring roots on Sui for compliance.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-02.1.1 | 3 | `MerkleAccumulator` — Effect.Schedule-based stream accumulator with configurable batch windows | S22.10.5.3 |
| ⏳ | DP-02.1.2 | 2 | Merkle tree computation — keccak256 leaf hashing, binary tree construction, root extraction | S22.10.5.1 |
| ⏳ | DP-02.1.3 | 2 | Tiered batching intervals — L0 (5min) through L4 (24hr), per-org per-event-type configuration | S22.10.5.2, R-BRG-7/8 |
| ⏳ | DP-02.1.4 | 2 | Leaf data persistence — NATS KV `merkle-batches` store for future proof generation | S22.10.5.3, R-BRG-9 |
| ⏳ | DP-02.2.1 | 3 | `ComplianceAnchor` Move module — `AuditAnchor` struct (owned object), `anchor()` entry function | S21.13.8.3 |
| ⏳ | DP-02.2.2 | 2 | Event routing rules — BATCHED/IMMEDIATE/PERIODIC/ON-CHANGE classification per NATS subject pattern | S22.10.4.2-4.3, R-BRG-4/5/6 |
| ⏳ | DP-02.2.3 | 2 | Empty batch skip + tiered anchoring schedule (ISA-95 level-based intervals with jitter) | S21.13.8.2, R-BRG-10, ISO-46-4/5 |
| ⏳ | DP-02.2.4 | 2 | Integration test — end-to-end NATS event -> Merkle batch -> Sui anchor with mock SuiClient | S22.10.3.3, R-BRG-2 |

**Dependencies**: DP-01
**RFC Sections**: S22.10.4-5, S21.13.8

---

### Epic DP-03: Consistency & Monitoring — 16 SP

Reconciliation daemon, divergence detection, and bridge observability.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-03.1.1 | 5 | Reconciliation daemon — 5-minute cycle comparing NATS KV state vs Sui on-chain objects for escrows, anchors | S22.10.8.3, R-BRG-21 |
| ⏳ | DP-03.1.2 | 3 | Outbox pattern — NATS KV-backed outbox for pending Sui TXs, confirmation tracking, crash recovery | S19.3.5.4 T-BC-10, R-BC-10.2 |
| ⏳ | DP-03.1.3 | 2 | Dual-truth authority rules — Sui authoritative for escrow/settlement, NATS authoritative for capacity/operational | S22.10.8.1-2, R-BRG-19/20 |
| ⏳ | DP-03.1.4 | 3 | Transaction digest cache — 24hr local cache for replay prevention, dedup on submission | S19.3.5.4 T-BC-11, R-BC-11.2 |
| ⏳ | DP-03.2.1 | 3 | Bridge metrics + alerting — all 9 metrics from S22.10.12.1, convergence SLA monitoring | S22.10.12, R-BRG-27/28/29 |

**Dependencies**: DP-01, DP-02
**RFC Sections**: S22.10.8, S22.10.12, S19.3.5.4

---

## Phase 2: Settlement & Escrow (Sprints 4-6) — 52 SP

### Epic DP-04: Escrow Smart Contracts (Sui Move) — 21 SP

The core settlement contracts on Sui.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-04.1.1 | 5 | `tmnl::escrow` Move module — `EscrowVault` shared object, state constants (CREATED through REFUNDED), error codes | S18.11.1.2 |
| ⏳ | DP-04.1.2 | 3 | `create_and_fund()` — atomic escrow creation + funding, `Clock` deadline validation, fee BPS validation | S18.11.1.2, ESC-1/2/3 |
| ⏳ | DP-04.1.3 | 3 | `release()` + `settle()` — QC-attestation release, fee split to treasury, state transitions | S18.11.2.3, STL-1/2 |
| ⏳ | DP-04.1.4 | 3 | `freeze()` + `dispute()` + `resolve_dispute()` — dispute lifecycle, arbiter-only resolution, buyer_bps split | S18.11.2.3, STL-4 |
| ⏳ | DP-04.1.5 | 2 | `deadline_refund()` — permissionless auto-refund after Clock exceeds deadline | S18.11.2.4, STL-3 |
| ⏳ | DP-04.1.6 | 3 | Multi-hop settlement via PTBs — atomic creation of chained escrow vaults, cascading deadlines | S18.11.3, MH-1/2/3/4 |
| ⏳ | DP-04.1.7 | 2 | Move unit tests — state machine invariants, authorization guards, overflow protection verification | R-BC-1.1 |

**Dependencies**: None (Move contracts are independent)
**RFC Sections**: S18.11.1-3

---

### Epic DP-05: Treasury & Fee Distribution — 8 SP

Network treasury management and fee mechanics.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-05.1.1 | 3 | `tmnl::treasury` Move module — `NetworkTreasury` shared object, operating/dispute_reserve split (80/20) | S18.11.4.1 |
| ⏳ | DP-05.1.2 | 2 | `deposit_fee()` + `disburse()` — settlement fee collection, governor-only disbursement, monotonic counters | S18.11.4.1, FEE-1/2/3/5 |
| ⏳ | DP-05.1.3 | 1 | Fee schedule governance — configurable BPS (default 150, max 500), DAO vote requirement | S18.11.4.2, FEE-4 |
| ⏳ | DP-05.1.4 | 2 | Treasury integration with escrow — PTB composition: `escrow::settle` -> `treasury::deposit_fee` | S18.11.4.3 |

**Dependencies**: DP-04
**RFC Sections**: S18.11.4

---

### Epic DP-06: Capacity Tokens & Asset Tokenization — 13 SP

On-chain representation of manufacturing capacity and capabilities.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-06.1.1 | 3 | `tmnl::capacity_token` Move module — `CapacityToken` (key+store), time-decay via `Clock`, `MintCap` | S18.11.5.2 |
| ⏳ | DP-06.1.2 | 2 | `mint()`, `consume()`, `split()`, `is_valid()` — semi-fungible hours tracking, work order linkage | S18.11.5.2 |
| ⏳ | DP-06.2.1 | 3 | `tmnl::capability` Move module — soulbound `CapabilityNFT` (key only, no store), `AuditorCap`, expiry enforcement | S18.11.5.3, CAP-1/2/3/4 |
| ⏳ | DP-06.2.2 | 2 | Reputation SBTs — soulbound tokens from G-10 trust score, settlement-triggered updates | S18.11.5.4, REP-1/2/3/4 |
| ⏳ | DP-06.3.1 | 3 | Howey test positioning — documentation + feature-flag schema for per-jurisdiction token restrictions | S18.11.5.5, S30.7.3 |

**Dependencies**: DP-04, DP-05
**RFC Sections**: S18.11.5, S30.7

---

### Epic DP-07: Privacy-Preserving Settlement — 10 SP

ZK proofs, Seal encryption, and cross-currency support.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-07.1.1 | 3 | ZK settlement verification — range proofs for settlement amounts, threshold claims for G-10 scores | S18.11.6.1, PRV-1/2/3 |
| ⏳ | DP-07.1.2 | 3 | Sui zkLogin integration — OAuth-to-blockchain onboarding for Earl-class operators | S18.11.6.2, S20.12.10 |
| ⏳ | DP-07.1.3 | 2 | Seal framework integration — 3-layer data model (public/encrypted/off-chain), 2-of-3 threshold decryption | S18.11.6.3 |
| ⏳ | DP-07.2.1 | 2 | Cross-currency settlement — USDC support, Pyth price feed integration, atomic swap+settle PTBs | S18.11.7, CUR-1/2/3 |

**Dependencies**: DP-04, DP-08 (oracle)
**RFC Sections**: S18.11.6-7

---

## Phase 3: Oracle & Identity (Sprints 7-9) — 50 SP

### Epic DP-08: Oracle Integration — 21 SP

Hybrid Pyth + Chainlink oracle architecture.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-08.1.1 | 3 | `tmnl_commons::price_oracle` Move module — Pyth price feed consumer, staleness checks (MAX_PRICE_AGE_SECS), confidence intervals | S18.12.2.4-2.6 |
| ⏳ | DP-08.1.2 | 2 | Pyth feed configuration — catalog lookup for manufacturing price feeds (aluminum, steel, copper, natural gas, FX) | S18.12.2.3 |
| ⏳ | DP-08.1.3 | 2 | TWAP computation — 5-minute time-weighted average for settlement, circuit breaker (10% deviation) | R-BC-5.1/5.2 |
| ⏳ | DP-08.2.1 | 5 | `ChainlinkOracleService` Effect service — EVM bridge relay, Functions invocation, result bridging to Sui | S18.12.3.1-3.2 |
| ⏳ | DP-08.2.2 | 3 | Merkle batch verification Function — JS source code for DON execution, independent root recomputation | S18.12.3.4 |
| ⏳ | DP-08.2.3 | 3 | Certification verification Function — ISO/AS9100 cert status lookup, expiry validation, attestation | S18.12.3.5 |
| ⏳ | DP-08.3.1 | 3 | Chainlink Automation integration — EVM sidechain keeper for escrow deadline enforcement, Sui bridge relay | S18.12.4 |

**Dependencies**: DP-01 (SuiClient), DP-04 (escrow)
**RFC Sections**: S18.12

---

### Epic DP-09: On-Chain Identity & Trust — 21 SP

Organization identity, trust channels, reputation, and DID.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-09.1.1 | 5 | `manufacturing_commons::organization` Move module — `OrganizationIdentity` shared object, lifecycle state machine (UNVERIFIED->PROVISIONED->ACTIVE->SUSPENDED->DEACTIVATED) | S20.12.3.3, OCI-01/02/03 |
| ⏳ | DP-09.1.2 | 2 | `PlatformAdminCap` + `OrgAdminCap` — OTW singleton, soulbound admin capability, authorization model | S20.12.3.4-3.5, OCI-05/06 |
| ⏳ | DP-09.1.3 | 3 | Wallet-to-NATS binding protocol — dual-key architecture (Sui cold + NATS warm), `bind_nats_key()`, rotation ceremony | S20.12.4, OCI-07/08/09/10/11/12 |
| ⏳ | DP-09.2.1 | 3 | `manufacturing_commons::trust_channel` Move module — bilateral trust channel creation, tier progression (NEWCOMER through PREMIUM) | S20.12.5, OCI-13 |
| ⏳ | DP-09.2.2 | 3 | G-10 reputation SBT — composite score (signal consistency, clock accuracy, uptime, peer validation), K-anonymity | S20.12.6, REP-1/2/3/4 |
| ⏳ | DP-09.2.3 | 3 | Capability NFT verification — Chainlink oracle-based cert verification, expiry enforcement, `AuditorCap` | S20.12.7 |
| ⏳ | DP-09.3.1 | 2 | Sybil resistance via staking — minimum stake, slashing conditions, stake recovery protocol | S20.12.8, R-BC-17.1/17.2/17.3 |

**Dependencies**: DP-04 (escrow references identity), DP-08 (Chainlink verification), **SC-04** (off-chain OrgIdentity lifecycle defines states mirrored on-chain), **SC-05** (G-10 composite score must exist before DP-09.2.2 ReputationSBT publishes on-chain)
**RFC Sections**: S20.12

#### Entity Ownership Split: OrgIdentity & TrustChannel (DP ↔ SC boundary)

Per MASTER.md entity ownership resolution, these two entities are split across domains:

| Entity | DP Owns (On-Chain) | SC Owns (Off-Chain) |
|--------|-------------------|---------------------|
| **OrganizationIdentity** | DP-09.1.1: `manufacturing_commons::organization` Move module (5 states: UNVERIFIED→PROVISIONED→ACTIVE→SUSPENDED→DEACTIVATED) | SC-04 (schema), SC-17.1.1 (model), SC-18.1.1 (DDL), SC-19.1.1 (repo), SC-24.1.2 (Machine), SC-25.1.1 (ES handler), SC-26.1.1 (Entity), SC-27.1.1 (observer) |
| **TrustChannel** | DP-09.2.1: `manufacturing_commons::trust_channel` Move module (on-chain subset: PROPOSED→ACCEPTED→NEWCOMER→BASIC→VERIFIED→TRUSTED→PREMIUM / REVOKED) | SC-05.1.2 (schema), SC-17.1.2 (model), SC-18.1.2 (DDL), SC-19.1.2 (repo), SC-24.1.4 (Machine), SC-25.1.2 (ES handler), SC-26.1.2 (Entity), SC-27.1.2 (observer) |
| **ReputationSBT** | DP-09.2.2: publishes G-10 score on-chain as Soulbound Token | SC-05.2.x: computes G-10 composite score off-chain |

**Mirror Sync Boundary — Bidirectional via SuiBridgeService (DP-01, per S22.10):**

**Direction 1: SC → DP (off-chain triggers on-chain mirror)**

| SC Event | Trigger | DP Action | Latency | Notes |
|----------|---------|-----------|---------|-------|
| OrgVerified (SC-04.2.2) | Identity verification complete | SuiBridgeService submits PTB → Move: UNVERIFIED→PROVISIONED | Best-effort, subject to batch window | Non-critical — on-chain state is auditable but not real-time |
| OrgActivated (SC-04.2.2) | First device + stake | SuiBridgeService submits PTB → Move: PROVISIONED→ACTIVE | Best-effort, subject to batch window | Same |
| ReputationUpdated (SC-05.2.6) | G-10 score recomputed | DP-09.2.2 publishes new ReputationSBT | Best-effort, batched | Batch accumulation may exceed 60s |

**Transport**: SC-27 observer publishes state transitions to NATS `iiot:entity-changes` channel. SuiBridgeService (DP-01) subscribes to this channel and submits Sui PTBs. No separate bridge call — NATS-mediated.

**Batching**: SC→DP sync goes through SuiBridgeService batching strategy (S22.10). Batch window applies to all non-critical mirrors.

**Direction 2: DP → SC (on-chain triggers off-chain enforcement)**

| DP Event | Trigger | SC Action | Latency | RFC Ref |
|----------|---------|-----------|---------|---------|
| OrgStateTransition (suspend) | Trust violation / dispute on-chain | SC-09 revokes NATS JWT, disables cross-org exports | **<60s hard SLO** (OCI-04) | S20.11.2 |
| OrgStateTransition (deactivate) | Governance ruling / voluntary withdrawal | SC-09 full revocation: JWT + data retention + marketplace | **<60s hard SLO** (OCI-04) | S20.11.3 |
| OrgStateTransition (restore) | Issue resolved + stake restored | SC-04 reinstates SUSPENDED→ACTIVE | Best-effort, <60s | S20.11.4 |
| TrustChannelRevoked | Admin/governance revocation on-chain | SC-05 removes from active scoring pool | **<60s hard SLO** | S20.12.5 |

**Transport**: SuiBridgeService (DP-01) polls/subscribes to Sui `OrgStateTransition` events, publishes to NATS `tmnl.depin.identity.<org_id>.events` and `tmnl.depin.trust.<org_id>.<channel_id>.events` (`.events` suffix per SC agreement — distinguishes from future query subjects). SC consumers (NATS consumer groups for exactly-once delivery):
- SC-09.1.2 (`SuspensionService`) subscribes to org suspension events
- SC-09.1.3 (`RevocationService`) subscribes to org deactivation events
- SC-04.1.3 (`IdentityLifecycleService`) subscribes to restoration events

**Key asymmetry**: SC→DP is best-effort (batched). DP→SC is **hard SLO 60s** (OCI-04) — on-chain suspension must immediately restrict NATS operational access.

**Transition origination**: SC-04 is the primary initiator for provisioning/activation (happy path). DP-09 is the primary initiator for punitive actions (suspend, deactivate via governance multi-sig or automated dispute module per OCI-03). **Either side can trigger any transition — the other mirrors.** On-chain timer triggers (e.g., suspension >90d → auto-deactivate) require no SC involvement.

**TrustChannel on-chain scope**: DP-09.2.1 Move module implements **establishment + tier states only**: PROPOSED → ACCEPTED → NEWCOMER → BASIC → VERIFIED → TRUSTED → PREMIUM / REVOKED. Early bilateral negotiation states (DISCOVERY, INQUIRY, EVALUATION) are purely off-chain in SC-05 — no on-chain representation needed. The Move module cares about **tier level** for bilateral guard enforcement and marketplace matching, not negotiation process.

**Reconciliation**: DP-24 observer wiring detects divergence between on-chain state (Sui query) and off-chain mirror (SC Machine state). Mismatch triggers `EntityStateDiverged` alarm via EventDistribution `iiot:entity-changes` channel.

---

### Epic DP-10: On-Chain Isolation — 8 SP

Extending the 5-layer isolation model to blockchain state.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-10.1.1 | 2 | `tmnl::bilateral_guard` Move module — `assert_is_party()`, `assert_is_escrow_party()` reusable guards | S21.13.4.2, ISO-42 |
| ⏳ | DP-10.1.2 | 2 | `tmnl::classification` Move module — C-0 through C-5 data classification, `validate_storage()`, sharing guards. **Refinement (SC)**: attestation carries `ClassificationEnforcement` (exportPolicy, retentionDays, accessScope) so Move module enforces without hardcoded mapping. `expiresAt` field for temporal validity (TTL: 24h C-0/C-1, 1h C-2/C-3, per-request C-4/C-5). Reject if attestation expired. | S21.13.6.3, ISO-44 |
| ⏳ | DP-10.1.3 | 2 | `SuiQueryFilter` Effect service — authorization filter for bilateral scope, owned-only, public aggregates | S21.13.5.3, ISO-43 |
| ⏳ | DP-10.1.4 | 2 | Temporal privacy + object ownership isolation — jitter on anchoring timestamps, ISA-95 tree scoping, Kiosk exposure pattern | S21.13.8-10, ISO-46/47/48 |

**Dependencies**: DP-09 (identity + trust channels), **SC-02** (PDP produces ClassificationAttestation with enforcement metadata + expiry; shared schema at `src/lib/iiot/schemas/shared/classification.ts`)
**RFC Sections**: S21.13

---

## Phase 4: DePIN Token Economics (Sprints 10-12) — 47 SP

### Epic DP-11: $TMNL Token & Burn-and-Mint Equilibrium — 18 SP

The core DePIN utility token and its economic mechanics.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-11.1.1 | 5 | `tmnl::token` Move module — `TMNL` OTW coin type, `TreasuryCap`, `CoinMetadata`, 9 decimals, 1B max supply | S30.2.4 |
| ⏳ | DP-11.1.2 | 3 | `ManufacturingCredit` struct — non-transferable MC tokens, `burn_for_credits()` (1 TMNL = 1000 MC) | S30.2.4, UTL-1 |
| ⏳ | DP-11.1.3 | 3 | `emit_reward()` — minting rewards to contributors, tier + epoch tracking, EmissionSchedule authorization | S30.2.4, BME-3 |
| ⏳ | DP-11.2.1 | 3 | Emission schedule Move module — deterministic halving (Years 1-2: 80M/yr, 3-4: 40M/yr, etc.), DAO-governed post-Y10 | S30.9, EMIT-1/2/3 |
| ⏳ | DP-11.2.2 | 2 | Token distribution vesting — core team 4yr cliff, early adopters 2yr linear, hub operators performance-based | S30.2.5, DIST-1/2/3 |
| ⏳ | DP-11.2.3 | 2 | `JurisdictionConfig` Effect Schema — per-jurisdiction feature flags (US/EU/UK/INTL), capacity futures gating | S30.7.3, REG-4 |

**Dependencies**: DP-05 (treasury)
**RFC Sections**: S30.2, S30.7, S30.9

---

### Epic DP-12: Reward Tiers & Proof Mechanisms — 16 SP

Mining reward computation, tier progression, and proof-of-capacity/quality/uptime.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-12.1.1 | 3 | Reward tier system — 4-tier structure (Connectivity 1x, Data 2.5x, Marketplace 5x, Quality 10x), auto-downgrade after 30 days | S30.3.1-2, TIER-1/2/3 |
| ⏳ | DP-12.1.2 | 3 | Reward computation engine — `BaseEmission * TierMultiplier * QualityBonus * UptimeBonus * GeographicWeight`, 90-day EMA | S30.3.3, TIER-4 |
| ⏳ | DP-12.2.1 | 3 | Proof of Capacity (PoC) — NATS heartbeat attestation via Chainlink oracle, power consumption cross-reference | S30.3.4, POC-1/2/3 |
| ⏳ | DP-12.2.2 | 3 | Proof of Quality (PoQ) — CMM/SPC data Merkle anchoring, Chainlink oracle verification chain | S30.3.4, POQ-1/2/3 |
| ⏳ | DP-12.2.3 | 2 | Proof of Uptime (PoU) — 60s signed heartbeat, device cryptographic key, variable-interval challenges | S30.3.4, POU-1/2/3 |
| ⏳ | DP-12.2.4 | 2 | Integration with edge devices — NATS subjects: `tmnl.depin.attestation.<org_id>.<device_id>` (60s heartbeat), `tmnl.depin.challenge.*` / `tmnl.depin.challenge-response.*` (oracle challenges), `tmnl.depin.power-state.*` (power consumption). `tpmType: 'hardware' \| 'optee'` field for trust tier discounting. TPM-agnostic at NATS interface. | S30.3.4 |

**Dependencies**: DP-11 (token), DP-08 (oracle), **IF-04.2.5** (OP-TEE fallback for iMX8MP/AM62x), **IF-04.2.6** (hardware TPM 2.0 for QCS6490), **IF-13.6.3-IF-13.6.6** (attestation/challenge/power NATS subjects)
**RFC Sections**: S30.3

---

### Epic DP-13: Machine iNFTs & Expirable Leases — 13 SP

On-chain digital twins and capacity lease tokens.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-13.1.1 | 5 | `tmnl::machine_inft` Move module — `MachineINFT` (key+store), DID, dynamic fields (capability, quality, telemetry) | S30.4.2, INFT-1/2/3/4 |
| ⏳ | DP-13.1.2 | 2 | `attest_capability()` + `update_telemetry()` — dynamic field CRUD, Chainlink-attested merkle root | S30.4.2 |
| ⏳ | DP-13.1.3 | 1 | `record_completion()` — lifetime order/hour counters, NATS EventDistribution integration | S30.4.4 |
| ⏳ | DP-13.2.1 | 3 | Expirable lease Move module — `Clock`-based lifecycle (MINTED->EXERCISED->COMPLETED/EXPIRED/REVOKED) | S30.5, LEASE-1/2/3/4 |
| ⏳ | DP-13.2.2 | 2 | DeFi composability — Sui Kiosk integration for secondary market, sub-leasing, TransferPolicy for ITAR | S30.5.5, ITAR-1/2/3 |

**Dependencies**: DP-09 (identity), DP-11 (token)
**RFC Sections**: S30.4, S30.5

---

## Phase 5: Governance & Anti-Gaming (Sprints 13-14) — 23 SP

### Epic DP-14: DAO Governance Framework — 13 SP

Multi-tier DAO structure implementing Ostrom's eight principles.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-14.1.1 | 5 | Root DAO Move module — quadratic voting (sqrt staked TMNL), reputation multiplier, 48hr timelock, 10% quorum | S30.6.2-4, GOV-1/4/5/7 |
| ⏳ | DP-14.1.2 | 3 | Vertical Sub-DAOs — domain-specific governance (Aerospace, Automotive, Medical), capability NFT membership gate | S30.6.2, GOV-2/6 |
| ⏳ | DP-14.1.3 | 3 | Hub DAOs — geographic governance (Atlanta, Detroit, Houston), uptime + marketplace activity weighted voting | S30.6.2, GOV-3 |
| ⏳ | DP-14.1.4 | 2 | Guardian multi-sig — 5-of-9 veto power during timelock, emergency pause (>66% supermajority) | S30.6.3, R-BC-15.4 |

**Dependencies**: DP-11 (token staking), DP-09 (identity/reputation)
**RFC Sections**: S30.6

---

### Epic DP-15: Anti-Gaming & Dispute Resolution — 10 SP

Fraud detection, graduated sanctions, and tiered dispute resolution.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-15.1.1 | 3 | Anti-gaming mechanisms — hardware attestation, Sybil detection (IP/device fingerprinting), wash trading graph analysis | S30.8, GAME-1/2/3 |
| ⏳ | DP-15.1.2 | 2 | Graduated sanctions — Warning -> reward reduction (50%, 30d) -> partial slash (10-25%) -> full slash -> exclusion | S30.8.1 |
| ⏳ | DP-15.2.1 | 3 | Tiered dispute resolution — Tier 1 automated (smart contract rules), Tier 2 peer arbitration (Chainlink VRF selection) | S30.6.5, DISP-1/2/3 |
| ⏳ | DP-15.2.2 | 2 | Expert panel + off-chain legal — escalation path for disputes >$50K, asset freeze capability | S30.6.5, DISP-4 |

**Dependencies**: DP-04 (escrow disputes), DP-14 (governance)
**RFC Sections**: S30.6.5, S30.8

---

## Phase 5b: DePIN API Surface (Sprints 13-14, parallel with Phase 5) — 45 SP

> **E2E Stack Audit Addition** — Layers 8 (RPC Groups), 9 (HTTP Endpoints), 10 (Streaming RPCs) were missing from the original WBS. These provide the consumer-facing API surface for DePIN operations.

### Epic DP-20: DePIN RPC Groups — 16 SP

RPC definitions and handlers for blockchain operations. Follows patterns from `src/lib/iiot/rpc/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-20.1.1 | 3 | `EscrowRpcs` — RpcGroup: `CreateEscrow`, `GetEscrow`, `ReleaseEscrow`, `FreezeEscrow`, `DisputeEscrow`, `ResolveDispute`, `RefundEscrow` | S18.11.1-3 |
| ⏳ | DP-20.1.2 | 2 | `TreasuryRpcs` — RpcGroup: `GetTreasuryBalance`, `GetFeeSchedule`, `ProposeFeeChange` | S18.11.4 |
| ⏳ | DP-20.1.3 | 2 | `CapacityTokenRpcs` — RpcGroup: `MintCapacity`, `GetCapacityBalance`, `ValidateCapacity`, `ConsumeCapacity` | S18.11.5 |
| ⏳ | DP-20.2.1 | 3 | `IdentityRpcs` — RpcGroup: `RegisterOrganization`, `GetOrganization`, `BindNATSKey`, `RotateKey`, `SuspendOrganization` | S20.12 |
| ⏳ | DP-20.2.2 | 2 | `TrustRpcs` — RpcGroup: `CreateTrustChannel`, `GetTrustScore`, `GetReputationSBT`, `VerifyCapabilityNFT` | S20.12.5-7 |
| ⏳ | DP-20.3.1 | 2 | `TokenRpcs` — RpcGroup: `GetTokenBalance`, `GetEmissionSchedule`, `GetRewardTier`, `ClaimReward` | S30.2-3 |
| ⏳ | DP-20.3.2 | 2 | `GovernanceRpcs` — RpcGroup: `CreateProposal`, `CastVote`, `GetProposal`, `GetDAOState`, `ExecuteProposal` | S30.6 |

**Dependencies**: DP-01 through DP-15 (all service epics must exist for handlers to call)
**RFC Sections**: S18.11, S20.12, S22.10, S30

---

### Epic DP-21: DePIN HTTP API — 13 SP

REST endpoints wrapping DePIN RPC groups. Follows patterns from `src/lib/iiot/http/api.ts` using `EntityProxy.toHttpApiGroup`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-21.1.1 | 3 | `DePINApi` — HttpApi.make('depin-api') composing all DePIN HttpApiGroups under `/api/depin/*` prefix | S22.10 |
| ⏳ | DP-21.1.2 | 2 | Escrow endpoints — `POST /api/depin/escrow/{Create|Get|Release|Freeze|Dispute|Resolve|Refund}` | S18.11 |
| ⏳ | DP-21.1.3 | 2 | Identity endpoints — `POST /api/depin/identity/{Register|Get|Bind|Rotate|Suspend}` | S20.12 |
| ⏳ | DP-21.1.4 | 2 | Token endpoints — `POST /api/depin/token/{Balance|Emission|Reward|Claim}` | S30.2-3 |
| ⏳ | DP-21.1.5 | 2 | Governance endpoints — `POST /api/depin/governance/{Propose|Vote|Get|Execute}` | S30.6 |
| ⏳ | DP-21.2.1 | 2 | Bridge admin endpoints — `POST /api/depin/bridge/{Status|DLQ|Reconcile|Metrics}` (admin-only, rate-limited) | S22.10.8, S22.10.12 |

**Dependencies**: DP-20 (RPC groups)
**RFC Sections**: S18.11, S20.12, S22.10, S30

**Note**: Machine-backed DePIN entities (Escrow, OrgIdentity, TrustChannel, Lease, BridgeTx) ARE `@effect/cluster` entities (added in DP-24) and CAN use `EntityProxy.toHttpApiGroup`. CRUD entities (CapacityToken, Treasury, etc.) use manual `HttpApiGroup` composition since they lack Entity definitions.

---

### Epic DP-22: DePIN Streaming RPCs — 16 SP

Real-time WebSocket subscriptions for live blockchain events. Follows patterns from `src/lib/iiot/rpc/RealtimeRpcs.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-22.1.1 | 3 | `SubscribeSettlements` — streaming RPC emitting escrow state transitions (CREATED, FUNDED, RELEASED, SETTLED, DISPUTED, RESOLVED, REFUNDED) per org | S18.11.2 |
| ⏳ | DP-22.1.2 | 3 | `SubscribeAnchoring` — streaming RPC emitting Merkle batch anchor confirmations (batch_id, root_hash, sui_digest, leaf_count, confirmation_latency_ms) | S22.10.5 |
| ⏳ | DP-22.1.3 | 3 | `SubscribeRewards` — streaming RPC emitting reward minting events (device_id, tier, amount, proof_type, epoch) per org | S30.3 |
| ⏳ | DP-22.1.4 | 2 | `SubscribeBridgeHealth` — streaming RPC emitting bridge metrics (queue_depth, pending_txs, gas_balance, reconciliation_status, convergence_lag_ms) | S22.10.12 |
| ⏳ | DP-22.2.1 | 3 | Streaming handler implementations — `Stream.fromPubSub` bridging NATS subjects to RPC streams, per-org filtering, backpressure via `Stream.groupedWithin` | S22.10, S30 |
| ⏳ | DP-22.2.2 | 2 | Integration with WebSocket router — register DePIN streaming RPCs on `/ws/depin` alongside existing `/ws/iiot` | S22.10.11 |

**Dependencies**: DP-20 (RPC group schemas), DP-01 through DP-03 (bridge service emitting events)
**RFC Sections**: S18.11, S22.10, S30.3

**Architecture note**: `SubscribeSettlements` subscribes to the `iiot:entity-changes` EventDistribution channel, filtering by `entityType IN ('Escrow', 'TrustChannel', 'ExpirableLease')`. This leverages the unified `EntityStateChanged` -> `Machine.changes` -> `makeEntityObserver()` pipeline from platform-architect's infrastructure. `SubscribeAnchoring` and `SubscribeRewards` subscribe to domain-specific NATS subjects (not the entity-changes channel) since Merkle batches and rewards are not Machine-backed entities. `SubscribeBridgeHealth` reads from the monitoring service (DP-03).

**IMPORTANT**: `Stream.zipWithPrevious` (NOT `Stream.pairwise`) is the correct API for computing state deltas. First emission has `Option.none()` for previous state.

---

## Phase T: Per-Entity Testing (Continuous — runs alongside Phases 0-5b) — 46 SP

> **Test Addendum** — Dedicated test tasks per entity at each stack layer. Not an afterthought — tests are first-class deliverables written alongside implementation.
>
> **CRITICAL**: PubSub roundtrip tests (streaming, observer emission) MUST use plain `it()` + `Effect.runPromise`, NOT `it.effect()` or `it.scoped()` — they timeout with PubSub + Stream.fromPubSub + Effect.fork. (From MEMORY.md, verified 2026-02-09.)

### Epic DP-25: Machine-Backed Entity Tests — 25 SP

12+ test files per Machine entity, covering every stack layer.

| Status | Task | SP | Description | Test Layer |
|--------|------|----|-------------|------------|
| | | | **EscrowVault (8-state Machine)** | |
| ⏳ | DP-25.1.1 | 1 | `escrow-schema.test.ts` — Schema decode/encode roundtrip for EscrowParams, EscrowObject, SettlementTrigger, SettlementResult | Schema |
| ⏳ | DP-25.1.2 | 1 | `escrow-errors.test.ts` — Each error variant (NotFound, InvalidTransition, InsufficientFunds, DeadlineExceeded) | Errors |
| ⏳ | DP-25.1.3 | 2 | `escrow-machine.test.ts` — All 8 valid state transitions + rejected invalid transitions (e.g., CREATED->SETTLED, REFUNDED->FUNDED) | Machine |
| ⏳ | DP-25.1.4 | 2 | `escrow-handlers.test.ts` — ES command -> events -> state for each operation (create, fund, release, settle, freeze, dispute, resolve, refund) | ES Handler |
| ⏳ | DP-25.1.5 | 2 | `escrow-entity.test.ts` — Entity.make() lifecycle, Rpc wiring, cluster integration with mock sharding | Entity |
| ⏳ | DP-25.1.6 | 1 | `escrow-reactivity.test.ts` — Cache key invalidation per event type, ReactivityBridge emission (use `it()` + `Effect.runPromise`) | Observer |
| ⏳ | DP-25.1.7 | 1 | `escrow-rpc.test.ts` — RPC roundtrip (client -> server -> response) for each EscrowRpc operation | RPC |
| ⏳ | DP-25.1.8 | 1 | `escrow-streaming.test.ts` — SubscribeSettlements streaming RPC (use `it()` + `Effect.runPromise` for PubSub) | Streaming |
| | | | **OrganizationIdentity (5-state Machine)** | |
| ⏳ | DP-25.2.1 | 1 | `org-identity-schema.test.ts` — Schema roundtrip for OrganizationId, identity schemas | Schema |
| ⏳ | DP-25.2.2 | 1 | `org-identity-machine.test.ts` — 5 valid transitions + rejected invalids, NATS JWT revocation on SUSPENDED | Machine |
| ⏳ | DP-25.2.3 | 2 | `org-identity-entity.test.ts` — Entity lifecycle, handler ES -> events -> state, reactivity (60s JWT revocation SLA) | Entity + Handler + Observer |
| ⏳ | DP-25.2.4 | 1 | `org-identity-rpc.test.ts` — RPC roundtrip for Register, Get, Bind, Rotate, Suspend, Deactivate | RPC |
| | | | **TrustChannel (8-state Machine)** | |
| ⏳ | DP-25.3.1 | 1 | `trust-channel-machine.test.ts` — Tier progression (NEWCOMER -> PREMIUM), REVOKED from any tier, rejected transitions | Machine |
| ⏳ | DP-25.3.2 | 2 | `trust-channel-entity.test.ts` — Entity lifecycle, handler ES, bilateral trust ceremony (propose/accept) | Entity + Handler |
| | | | **ExpirableLease (5-state Machine)** | |
| ⏳ | DP-25.4.1 | 1 | `lease-machine.test.ts` — 5 valid transitions, Clock-based EXPIRED auto-transition, REVOKED from MINTED/EXERCISED | Machine |
| ⏳ | DP-25.4.2 | 2 | `lease-entity.test.ts` — Entity lifecycle, handler ES, Kiosk integration for secondary market | Entity + Handler |
| | | | **BridgeTransaction (5-state Machine, Effect-native)** | |
| ⏳ | DP-25.5.1 | 1 | `bridge-tx-model.test.ts` — Model.Class derivation, computed fields, SQL roundtrip | Model |
| ⏳ | DP-25.5.2 | 1 | `bridge-tx-repo.test.ts` — CRUD integration: create -> query-by-status -> update -> scan-pending | Repository |
| ⏳ | DP-25.5.3 | 1 | `bridge-tx-machine.test.ts` — 5 valid transitions, retry logic, DLQ escalation after max retries | Machine |

**Dependencies**: DP-17 through DP-24 (built alongside implementation)
**Test location**: `src/lib/depin/__tests__/`

---

### Epic DP-26: CRUD Entity & Cross-Cutting Tests — 21 SP

8 test files per CRUD entity + integration/E2E tests.

| Status | Task | SP | Description | Test Layer |
|--------|------|----|-------------|------------|
| | | | **SQL-Backed CRUD Entities** | |
| ⏳ | DP-26.1.1 | 1 | `merkle-batch-schema.test.ts` — Schema roundtrip for MerkleBatch, MerkleRoot | Schema |
| ⏳ | DP-26.1.2 | 1 | `merkle-batch-model.test.ts` — Model.Class derivation, DDL migration test (table + indexes exist) | Model + DDL |
| ⏳ | DP-26.1.3 | 2 | `merkle-batch-repo.test.ts` — CRUD integration: create batch -> query by org -> query by anchored status | Repository |
| ⏳ | DP-26.1.4 | 1 | `reward-snapshot-repo.test.ts` — CRUD integration: create snapshot -> query by epoch -> aggregate by device | Repository |
| ⏳ | DP-26.1.5 | 1 | `dead-letter-repo.test.ts` — CRUD integration: create DLQ entry -> query unresolved -> mark resolved | Repository |
| | | | **On-Chain CRUD Entities (Schema + Service + RPC only)** | |
| ⏳ | DP-26.2.1 | 1 | `capacity-token-schema.test.ts` — Schema roundtrip, time-decay validation | Schema |
| ⏳ | DP-26.2.2 | 2 | `capacity-token-service.test.ts` — L2 service: mint, consume, split, is_valid, balance query via mock SuiClient | Service |
| ⏳ | DP-26.2.3 | 1 | `capacity-token-rpc.test.ts` — RPC roundtrip for Mint, GetBalance, Validate, Consume | RPC |
| ⏳ | DP-26.2.4 | 1 | `reputation-sbt-service.test.ts` — G-10 score computation, SBT update trigger | Service |
| ⏳ | DP-26.2.5 | 1 | `machine-inft-service.test.ts` — iNFT dynamic field CRUD, telemetry update, capability attestation | Service |
| ⏳ | DP-26.2.6 | 1 | `treasury-service.test.ts` — Deposit, disburse, fee schedule, 80/20 split validation | Service |
| | | | **Cross-Cutting Integration Tests** | |
| ⏳ | DP-26.3.1 | 3 | `bridge-e2e.test.ts` — Full pipeline: NATS event -> MerkleAccumulator -> batch -> PTB -> mock Sui -> AnchorResult -> reconciliation | E2E |
| ⏳ | DP-26.3.2 | 2 | `settlement-e2e.test.ts` — Full escrow lifecycle: create -> fund -> release -> settle -> treasury deposit -> event emission | E2E |
| ⏳ | DP-26.3.3 | 2 | `depin-streaming-e2e.test.ts` — Subscribe to all 4 streaming RPCs, verify events arrive for escrow + anchoring + rewards + health (use `it()` + `Effect.runPromise`) | Streaming E2E |
| ⏳ | DP-26.3.4 | 1 | `depin-http-e2e.test.ts` — REST endpoint smoke tests for all `/api/depin/*` routes | HTTP E2E |

**Dependencies**: DP-17 through DP-24 (built alongside implementation), DP-20 through DP-22 (API surface)
**Test location**: `src/lib/depin/__tests__/`

---

## Phase 6: Security Hardening (Sprint 15) — Parallel with Phase 5

**Note**: This phase runs in parallel with Phase 5. The security hardening tasks can begin as soon as Phases 1-4 produce deployable artifacts.

### Epic DP-16: Blockchain Security & Formal Verification — Tracked in security-architect WBS (SC)

The 19 blockchain-specific threats from S19.3.5 and their 40+ normative requirements are primarily the security-architect's domain. The following items are **depin-architect's contribution** to that effort:

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | DP-16.1.1 | — | Move Prover formal verification specs for escrow state machine invariants | R-BC-1.1 |
| ⏳ | DP-16.1.2 | — | Canonical package ID configuration + verification in SuiBridgeService | R-BC-4.2/4.3 |
| ⏳ | DP-16.1.3 | — | HSM integration for Sui signing key | R-BC-9.3 |
| ⏳ | DP-16.1.4 | — | Multi-sig enforcement for high-value transactions (>$1K) | R-BC-9.1 |

**Note**: SP tracked in security-architect's WBS (SC) to avoid double-counting. Listed here for cross-reference.

---

## SP Summary

| Phase | Epics | SP | Sprints |
|-------|-------|----|---------|
| Phase 0: DePIN Type Foundation | DP-17, DP-18, DP-19, DP-23, DP-24 | 79 | 0 (pre-sprint) |
| Phase 1: Sui Foundation & Bridge | DP-01, DP-02, DP-03 | 55 | 1-3 |
| Phase 2: Settlement & Escrow | DP-04, DP-05, DP-06, DP-07 | 52 | 4-6 |
| Phase 3: Oracle & Identity | DP-08, DP-09, DP-10 | 50 | 7-9 |
| Phase 4: DePIN Token Economics | DP-11, DP-12, DP-13 | 47 | 10-12 |
| Phase 5: Governance & Anti-Gaming | DP-14, DP-15 | 23 | 13-14 |
| Phase 5b: DePIN API Surface | DP-20, DP-21, DP-22 | 45 | 13-14 (parallel) |
| Phase T: Per-Entity Testing | DP-25, DP-26 | 46 | Continuous (0-14) |
| **TOTAL** | **25 Epics** | **397 SP** | **15 Sprints** |

---

## E2E Stack Layer Coverage

### Machine-Backed Entities (Tier 1 — 12 layers)

Entities: EscrowVault, OrganizationIdentity, TrustChannel, ExpirableLease, BridgeTransaction

| # | Layer | Epic(s) | Status | Notes |
|---|-------|---------|--------|-------|
| 1 | **Schema** | DP-17 (8 SP) | ADDED | Branded IDs, TaggedStruct for all domain types |
| 2 | **Model** | DP-19 (7 SP) | ADDED | Model.Class for BridgeTransaction; on-chain entities mirror via EventLog |
| 3 | **DDL** | DP-19 task DP-19.2.1 (2 SP) | ADDED | `depin_bridge_transactions` + on-chain entity mirror tables |
| 4 | **Repository** | DP-19 tasks DP-19.3.1-DP-19.3.2 (4 SP) | ADDED | BridgeTransactionRepo + mirror state repos |
| 5 | **Errors** | DP-18 (5 SP) | ADDED | TaggedError per domain (bridge, settlement, oracle, token) |
| 6 | **L2 Service** | DP-01 through DP-03, DP-08 through DP-15 | ORIGINAL | SuiBridgeService, ChainlinkOracleService, etc. |
| 7 | **Machine** | DP-23 (21 SP) | **ADDED** | 5 Machine definitions: Escrow, OrgIdentity, TrustChannel, Lease, BridgeTx |
| 8 | **ES Handler** | DP-24 tasks DP-24.1.2, DP-24.2.2, DP-24.3.1-DP-24.3.3 (14 SP) | **ADDED** | EventLog command handlers per entity |
| 9 | **Entity** | DP-24 tasks DP-24.1.1, DP-24.2.1, DP-24.3.1-DP-24.3.3 (16 SP) | **ADDED** | Entity.make() with Rpc wiring + Machine boot |
| 10 | **Observer/Reactivity** | DP-24 tasks DP-24.1.3, DP-24.2.3, DP-24.4.1 (6 SP) | **ADDED** | EventLog.groupReactivity + makeEntityObserver() + EventDistribution |
| 11 | **RPC Group** | DP-20 (16 SP) | ADDED | 7 RpcGroups covering all entity operations |
| 12 | **HTTP Routes** | DP-21 (13 SP) | ADDED | REST under `/api/depin/*` |

**Plus**: Streaming RPCs via DP-22 (16 SP) on `/ws/depin`

### CRUD Entities (Tier 2 — 8 layers)

Entities: CapacityToken, CapabilityNFT, ReputationSBT, NetworkTreasury, MerkleBatch, RewardSnapshot, MachineINFT

| # | Layer | Epic(s) | Status | Notes |
|---|-------|---------|--------|-------|
| 1 | **Schema** | DP-17 | ADDED | Shared with Machine entities |
| 2 | **Model** | DP-19 | ADDED | MerkleBatch + RewardSnapshot only (on-chain CRUDs use Sui) |
| 3 | **DDL** | DP-19 | ADDED | For SQL-backed CRUDs only |
| 4 | **Repository** | DP-19 | ADDED | For SQL-backed CRUDs only |
| 5 | **Errors** | DP-18 | ADDED | Shared error types |
| 6 | **L2 Service** | DP-05, DP-06, DP-11 through DP-13 | ORIGINAL | Treasury, CapacityToken, Token, Reward, iNFT services |
| 7 | **RPC Group** | DP-20 | ADDED | Included in RpcGroups (Treasury, CapacityToken, Token) |
| 8 | **HTTP Routes** | DP-21 | ADDED | Included in REST endpoints |

### Layer N/A Justifications

| Layer | Applies To | Reason N/A |
|-------|-----------|------------|
| **ES Handlers** | CRUD entities | No state machine = no event sourcing needed. Simple CRUD via repo. |
| **Machine** | CRUD entities | No lifecycle states to model. |
| **Entity** (@effect/cluster) | CRUD entities | No sharding/distribution needed — stateless query services suffice. |
| **Observer/Reactivity** | CRUD entities | No state transitions to observe. Cache invalidation via simple TTL. |
| **Model/DDL/Repo** | On-chain CRUD entities (CapacityToken, CapabilityNFT, ReputationSBT, NetworkTreasury, MachineINFT) | Sui is the persistence layer. Effect-TS queries on-chain state directly via SuiClientService. |

---

## Existing Code That Applies

From WBS V1 (266 SP complete):

| Asset | Path | Reuse |
|-------|------|-------|
| Effect Schema patterns | `src/lib/iiot/schemas/` | Schema.TaggedStruct, branded types — reuse for SuiBridgeService types |
| EventLog infrastructure | `src/lib/iiot/infrastructure/` | EventJournal provides leaf data for Merkle batching |
| NATS ChannelService | `src/lib/iiot/streaming/` | Bridge subscribes to ChannelService outlets |
| Feature flags | `src/lib/iiot/infrastructure/feature-flags.ts` | Extend for jurisdiction-based token restrictions |
| Error patterns | `src/lib/iiot/errors/` | TaggedError pattern reusable for SuiBridgeError |
| RPC infrastructure | `src/lib/iiot/rpc/` | RpcGroup patterns for Sui-related API surface |
| Entity Layer | `src/lib/iiot/entity-layer/` | @effect/cluster patterns for bridge leader election |

---

## Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Smart contracts | **Sui Move 2024 Edition** | OTW, capability pattern, PTBs |
| Sui SDK | **@mysten/sui** (TypeScript) | PTB construction, object queries |
| Oracle (Sui-native) | **Pyth Network** | Pull-based price feeds, sub-second |
| Oracle (EVM bridge) | **Chainlink Functions/Automation** | Via Arbitrum/Base sidechain |
| Oracle (TEE) | **Nautilus** | Future: Sui-native verifiable computation |
| Bridge service | **Effect-TS** | SuiBridgeService Layer, @effect/cluster leader |
| Token standard | **Sui Coin\<TMNL\>** | 1B supply, 9 decimals, BME model |
| Privacy | **Sui Seal** (Jan 2026) | Encrypted work order details |
| Auth | **Sui zkLogin** | OAuth-to-blockchain for small operators |
| Key management | **HSM + Ed25519** | Dual-key architecture (Sui + NATS) |

---

## Verification Notes

- **DeepWiki confirmed** (2026-02-13): OTW pattern, shared objects for escrow, PTBs, capability-based access control are all current Sui best practices.
- **Chainlink does NOT support Sui natively** (as of Feb 2026) — hybrid Pyth + Chainlink-via-EVM strategy is architecturally required.
- **Seal framework** deployed Jan 2026 — not yet in Sui repo docs but referenced in Sui documentation site.
- All Move code in the RFC has been verified against Sui Move 2024 Edition patterns.

---

## Items Routed to Other Architects

| Item | Target | Reason |
|------|--------|--------|
| Marketplace matching algorithm (capacity tokens) | network-architect (NW) | Marketplace protocol owns matching logic |
| NATS-side governance UI | devex-architect (DX) | DAO voting UI is a frontend concern |
| Edge device TPM attestation | infra-architect (IF-04.2.5, IF-04.2.6, IF-13.6.3-IF-13.6.6) | Hardware attestation for Proof of Capacity — NATS subjects + TPM/OP-TEE interface agreed |
| Blockchain threat model implementation | security-architect (SC) | S19.3.5 requirements are security domain |
| Regulatory compliance (FDA Part 11, ITAR) enforcement | platform-architect (PL) | Regulatory epic owns compliance rules |

# WBS V2 — Security & Governance Domain

**Author**: security-architect
**Date**: 2026-02-13
**Domain Prefix**: SC (Security)
**RFC Sections**: S19 (Security Architecture), S20 (Trust Model), S21 (Tenant Isolation), S22 (Failure Modes & Recovery)
**Total Story Points**: ~430 SP across 32 epics (SC-01 through SC-32)

---

## Existing Codebase Inventory

### What Already Exists (from WBS V1)

| Item | Path | Status |
|------|------|--------|
| Auth middleware | `src/lib/iiot/http/middleware/auth.ts` | Basic HTTP auth |
| Auth middleware test | `src/lib/iiot/http/__tests__/integration/auth-middleware.test.ts` | Integration test |
| Regulatory events (FDA) | `src/lib/iiot/schemas/events/regulatory/operator-events.ts` | Implemented |
| Quality events (ISO 9001) | `src/lib/iiot/schemas/events/regulatory/quality-events.ts` | Implemented |
| Batch events (FDA Part 11) | `src/lib/iiot/schemas/events/regulatory/batch-events.ts` | Implemented |
| EventLog audit trail | `src/lib/iiot/infrastructure/eventlog-layer.ts` | Implemented |
| Alarm lifecycle (ISA-18.2) | `src/lib/iiot/schemas/alarms.ts` + entity/AlarmEntity.ts | Implemented |
| Subject specs | `src/lib/iiot/realtime/iiot-subjects.ts` | Implemented |
| HolonetBridge | `src/lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| Sparkplug adapter | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Implemented |
| Entity stack | `src/lib/iiot/entity/EntityStack.ts` | Implemented |

### What Does NOT Exist Yet

- NATS JWT authentication service (S19.4)
- NATS account provisioning service (S19.4.2)
- RPC authorization middleware (S19.5.2)
- Cross-org authorization token service (S19.5.4)
- SPIFFE integration for @effect/cluster (S19.4.5)
- Trust score computation service (S20.5)
- Organization identity verification service (S20.3)
- Signal attestation service (S20.6)
- Consent management service (S20.9)
- Data classification enforcement service (S20.10)
- Tenant isolation provisioning service (S21)
- Isolation verification tests (S21.11)
- Regulatory isolation profiles (S21.12)
- Chaos engineering test suite (S22.9)
- Recovery automation services (S22.8)

---

## Blockchain Cross-References (Owned by depin-architect)

The following subsections contain blockchain-specific content and are **flagged for depin-architect**:

| RFC Section | Topic | Blockchain Content |
|-------------|-------|-------------------|
| **S19.3.5** | Blockchain threat model | T-BC-1 through T-BC-19, Move-specific threats, oracle threats, bridge threats |
| **S20.12** | On-chain identity objects | OrganizationIdentity Move struct, TrustChannel, ReputationSBT, CapabilityNFT, zkLogin |
| **S21.13** | On-chain isolation | ISO-42 through ISO-48, bilateral guards, classification enforcement, Merkle anchoring |
| **S22.10** | SuiBridgeService | Bridge service architecture, event routing, batching strategy, gas management |

These sections define normative requirements (R-BC-*, OCI-*, ISO-42+, R-BRG-*) that belong in the DePIN WBS. Security epics below reference them as dependencies where the non-blockchain security services must integrate with blockchain-side implementations.

---

## Mirror Synchronization Boundary (SC <-> DP)

> Agreed between security-architect and depin-architect. Defines the on-chain/off-chain ownership split for OrganizationIdentity and TrustChannel.

### Ownership Table

| Entity | Off-Chain (SC) | On-Chain (DP) |
|--------|---------------|---------------|
| **OrganizationIdentity** | SC-04: Effect-TS Machine, 5 states (UNVERIFIED -> PROVISIONED -> ACTIVE -> SUSPENDED -> DEACTIVATED), full E2E stack (schema/model/DDL/repo/machine/handler/entity/observer/RPC/HTTP) | DP-09: Sui Move `manufacturing_commons::organization`, 5 states (STATE_UNVERIFIED=0 through STATE_DEACTIVATED=4), OCI-01 through OCI-06 |
| **TrustChannel** | SC-05/SC-24: Effect-TS Machine, 6 states (DISCOVERY -> INQUIRY -> ESTABLISHED -> ACTIVE -> SUSPENDED -> TERMINATED), full E2E stack | DP-09: Sui Move `manufacturing_commons::trust_channel`, 4 on-chain states (PROPOSED=0, ACTIVE=1, SUSPENDED=2, REVOKED=3) |

### TrustChannel State Mapping (Off-Chain -> On-Chain)

| Off-Chain State (SC) | On-Chain State (DP) | Notes |
|---------------------|--------------------| ------|
| DISCOVERY | — (pre-chain) | Off-chain only — no on-chain object yet |
| INQUIRY | — (pre-chain) | Off-chain only — CrossOrgAuthToken exchange |
| ESTABLISHED | PROPOSED | On-chain object created when bilateral acceptance confirmed |
| ACTIVE | ACTIVE | Full bilateral data flow enabled |
| SUSPENDED | SUSPENDED | Channel frozen, NATS exports disabled |
| TERMINATED | REVOKED | Terminal state, on-chain object frozen |

### Bidirectional Sync

| Direction | Transport | SLO | Mechanism |
|-----------|-----------|-----|-----------|
| SC -> DP | SuiBridgeService (DP-owned) | Best-effort, batched | SC emits domain events to NATS; SuiBridgeService subscribes and batches Sui transactions |
| DP -> SC | NATS subscription | **60s hard SLO** (OCI-04) | SuiBridgeService translates Sui events to NATS messages; SC subscribes to `tmnl.depin.identity.<org_id>.events` and `tmnl.depin.trust.<org_id>.<channel_id>.events` |

### Sync Events

| Event | Direction | Trigger | Action |
|-------|-----------|---------|--------|
| `OrgProvisioned` | SC -> DP | SC-04 completes verification + NATS provisioning | DP creates on-chain OrganizationIdentity (STATE_UNVERIFIED -> STATE_PROVISIONED) |
| `OrgActivated` | SC -> DP | SC-04 activates org (device connected + tier met) | DP transitions on-chain to STATE_ACTIVE |
| `OrgSuspended` | SC -> DP | SC-04 anomaly detection or manual suspension | DP transitions on-chain to STATE_SUSPENDED |
| `OrgSuspended` | DP -> SC | On-chain governance ruling or stake slashing | SC-04 suspends off-chain Machine + revokes NATS JWT within 60s |
| `OrgDeactivated` | SC -> DP | SC-04 voluntary withdrawal | DP transitions on-chain to STATE_DEACTIVATED |
| `OrgDeactivated` | DP -> SC | On-chain governance deactivation | SC-04 deactivates off-chain Machine + purges NATS exports |
| `ChannelEstablished` | SC -> DP | SC-05/SC-25 bilateral acceptance completed | DP creates on-chain TrustChannel (PROPOSED -> ACTIVE) |
| `ChannelSuspended` | Both | Trust violation or consent revocation | Originating side emits, other side mirrors |
| `ChannelTerminated` | Both | Voluntary or governance termination | Originating side emits, other side mirrors |

### Transition Origination Rules

1. **Happy-path transitions** (provisioning, activation, channel establishment): Initiated by SC off-chain, mirrored to DP on-chain
2. **Punitive transitions** (suspend, deactivate): Can originate from EITHER side — on-chain (governance ruling, stake slashing) or off-chain (anomaly detection, manual admin action)
3. **Both sides MUST handle inbound punitive transitions** — SC must accept on-chain suspension events; DP must accept off-chain suspension commands

### Transport Details

- **NATS subject pattern (DP -> SC)**: `tmnl.depin.identity.<org_id>.events`, `tmnl.depin.trust.<org_id>.<channel_id>.events`
- **SC subscribes** via NATS subscription (loose coupling, no service endpoint dependency)
- **SuiBridgeService** (DP-owned, DP-09/S22.10): Translates between Sui events and NATS messages in both directions
- **Reconciliation**: SC persists all sync events to EventLog for audit; periodic reconciliation query compares off-chain state with on-chain state (SC-04.2.3 integration test covers this)

---

## Phase SC-1: Authentication Infrastructure (Sprints 1-3) — 55 SP

### Epic SC-01: NATS JWT Authentication Service — 21 SP

Implements S19.4.1-19.4.4: Decentralized JWT auth, account provisioning, edge device auth, human auth bridge.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-01.1.1 | 2 | Define `NatsOperatorKey` branded type + HSM key reference schema | S19.4.1 |
| ⏳ | SC-01.1.2 | 3 | `NatsAccountProvisioningService` — Effect service generating NKey pairs + account JWTs | S19.4.2 |
| ⏳ | SC-01.1.3 | 2 | Account JWT claims schema (`NatsAccountJwtClaims`) with limits, exports, imports, default_permissions | S19.4.2 |
| ⏳ | SC-01.1.4 | 3 | `NatsUserJwtService` — Effect service for issuing user JWTs (device + human) with subject-scoped permissions | S19.4.3 |
| ⏳ | SC-01.1.5 | 2 | Edge device JWT template: unique-per-device, subject-scoped (`iiot.readings.{deviceId}`), 90-day TTL | S19.4.3 |
| ⏳ | SC-01.1.6 | 3 | `OidcBridgeService` — OIDC/OAuth2 token validation -> NATS user JWT mapping with role encoding | S19.4.4 |
| ⏳ | SC-01.1.7 | 2 | Human operator JWT template: 24h TTL, identity for FDA audit, MFA flag, role claim | S19.4.4 |
| ⏳ | SC-01.1.8 | 2 | JWT revocation list management — publish revocation updates to NATS cluster | S19.4.1 |
| ⏳ | SC-01.1.9 | 2 | Integration tests: account provisioning -> JWT issuance -> NATS connection flow | S19.4.2 |

**Dependencies**: PL (platform-architect) Epic for NATS infrastructure
**RFC Sections**: S19.4.1, S19.4.2, S19.4.3, S19.4.4

---

### Epic SC-02: Service-to-Service Authentication (SPIFFE) — 13 SP

Implements S19.4.5: SPIFFE identities for @effect/cluster runner-to-runner mTLS.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-02.1.1 | 2 | Define SPIFFE ID format schema: `spiffe://org-{orgId}.manufacturing-commons/service/{serviceName}` | S19.4.5 |
| ⏳ | SC-02.1.2 | 3 | `SpiffeWorkloadService` — Effect service wrapping SPIFFE Workload API for automatic X.509-SVID rotation (1h TTL) | S19.4.5 |
| ⏳ | SC-02.1.3 | 3 | Integration with @effect/cluster Layer: inject SPIFFE SVIDs as mTLS certificates for runner-to-runner comms | S19.4.5 |
| ⏳ | SC-02.1.4 | 2 | Platform trust domain separation: `platform.manufacturing-commons` vs `org-{orgId}.manufacturing-commons` | S19.4.5 |
| ⏳ | SC-02.1.5 | 3 | Integration tests: runner-to-runner mTLS with SPIFFE, cross-domain rejection | S19.4.5 |

**Dependencies**: PL (platform-architect) Epic for @effect/cluster infrastructure
**RFC Sections**: S19.4.5

---

### Epic SC-03: Authorization Framework — 21 SP

Implements S19.5: Subject-based, RPC-level, entity-level, and cross-org authorization.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-03.1.1 | 2 | `Role` schema: `Schema.Literal('admin', 'supervisor', 'operator', 'viewer', 'device')` with hierarchy | S19.5.5 |
| ⏳ | SC-03.1.2 | 3 | `SubjectPermissionService` — maps roles to NATS pub/sub permission templates per S19.5.1 table | S19.5.1 |
| ⏳ | SC-03.2.1 | 3 | `SessionContext` Tag — Effect Context.Tag carrying orgId, role, identity for every RPC request | S19.5.2 |
| ⏳ | SC-03.2.2 | 5 | `AuthorizationMiddleware` — RpcMiddleware.make checking orgId match + role permission on every RPC call | S19.5.2 |
| ⏳ | SC-03.2.3 | 2 | Authorization failure logging: session identity, target entity, attempted operation, timestamp | S19.5.2 |
| ⏳ | SC-03.3.1 | 2 | Entity-level orgId verification in EntityStack — shard key prefix enforcement, cross-org migration prevention | S19.5.3 |
| ⏳ | SC-03.4.1 | 3 | `CrossOrgAuthToken` schema + `CrossOrgAuthService` — signed token generation, validation, single-use/TTL enforcement | S19.5.4 |
| ⏳ | SC-03.4.2 | 1 | Role gate for cross-org interactions: supervisor/admin only (S19.5.5 rule 4) | S19.5.4 |

**Dependencies**: SC-01 (JWT auth provides session identity)
**RFC Sections**: S19.5.1-S19.5.6

---

## Phase SC-2: Trust & Identity (Sprints 3-5) — 55 SP

### Epic SC-04: Organization Identity Verification — 18 SP

Implements S20.3: Identity provisioning lifecycle, verification requirements, tiered verification.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-04.1.1 | 2 | `OrganizationIdentity` Effect Schema: orgId (branded), legalName, jurisdiction, taxId, contacts, certifications | S20.3.4 |
| ⏳ | SC-04.1.2 | 2 | `IdentityState` Schema.Literal: 'unverified', 'provisioned', 'active', 'suspended', 'deactivated' | S20.3.1 |
| ⏳ | SC-04.1.3 | 3 | `IdentityLifecycleService` — Effect service managing state transitions with guard conditions | S20.3.1 |
| ⏳ | SC-04.1.4 | 3 | Tiered verification logic: T0 (email+legal), T1 (+capability), T2 (+certs), T3 (full+ITAR) | S20.3.3 |
| ⏳ | SC-04.2.1 | 3 | `OrgProvisioningWorkflow` — orchestrates identity verification -> NATS account creation -> JWT issuance | S20.3.2 |
| ⏳ | SC-04.2.2 | 2 | Provisioning events: `OrgVerified`, `OrgProvisioned`, `OrgActivated`, `OrgSuspended`, `OrgDeactivated` | S20.3.1 |
| ⏳ | SC-04.2.3 | 3 | Integration tests: full provisioning lifecycle, suspension, deactivation | S20.3 |

**Dependencies**: SC-01 (NATS account provisioning)
**Cross-domain**: Off-chain mirror — syncs with DP-09 on-chain source (S20.12 OCI-01 through OCI-06). SC-04 owns the Effect-TS Machine (5-state lifecycle), full E2E stack, and NATS provisioning. DP-09 owns the Sui Move OrganizationIdentity object. Bidirectional sync via SuiBridgeService with 60s hard SLO for punitive transitions (OCI-04). See [Mirror Synchronization Boundary](#mirror-synchronization-boundary-sc--dp) for full specification.
**RFC Sections**: S20.3.1-S20.3.4

---

### Epic SC-05: Trust Establishment & Scoring — 21 SP

Implements S20.4-S20.5: Trust tiers, reputation-based scoring, k-anonymity, trust score service.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-05.1.1 | 2 | `TrustTier` Schema.Literal: 'newcomer', 'established', 'trusted', 'preferred' + progression criteria | S20.4.3 |
| ⏳ | SC-05.1.2 | 3 | `TrustEstablishmentService` — bilateral trust setup: discovery -> inquiry -> channel setup -> transaction flow | S20.4.2 |
| ⏳ | SC-05.2.1 | 2 | `TrustScore` Effect Schema: composite score [0.0-1.0], 4 component scores, computedAt, publishable flag | S20.5.6 |
| ⏳ | SC-05.2.2 | 5 | `TrustScoreComputationService` — singleton @effect/cluster entity computing weighted scores per S20.5.2 formula | S20.5.1, S20.5.5 |
| ⏳ | SC-05.2.3 | 3 | Score component calculators consuming `MarketplaceSignalEvent` (LOCKED schema — NW-22): `delivery_outcome` (outcome: fulfilled/partial/failed/disputed, value=completion ratio) -> PV 0.25w, `capacity_declaration` (period: hourly, value=valid/total ratio) -> SC 0.30w, `clock_report` (period: daily, value=normalized drift) -> CA 0.20w, `peer_attestation` (attestation.confidence + attestorTrustTier weighting) -> PV 0.25w. Uptime (UP 0.25w) computed internally from equipment state stream. Windows: SC=90d, CA=30d, UP=30d, PV=180d | S20.5.2 |
| ⏳ | SC-05.2.4 | 2 | K-anonymity enforcement: min 10 transactions + 3 distinct counterparties before publishing | S20.5.4 |
| ⏳ | SC-05.2.5 | 2 | Score properties enforcement: [0-1] normalization, 0.5 default, max 0.05 drop per cycle, 90-day recovery | S20.5.3 |
| ⏳ | SC-05.2.6 | 2 | `ReputationUpdated` event + NATS publication to `reputation.{orgId}` on manufacturing-commons account | S20.5.3 |

**Dependencies**: SC-04 (org identity), NW-21 (Marketplace Work Order Lifecycle — delivery_outcome signals), NW-22 (Trust, Reputation & Geographic Optimization — peer_attestation + capacity_declaration signals)
**Signal Contract**: Consumes `MarketplaceSignalEvent` from `commons.reputation.{orgId}.signals.{signalType}` (NW schema). Signal-to-component mapping: `delivery_outcome` -> PV (peer validation, 0.25 weight), `peer_attestation` -> PV (attestor-weighted), `capacity_declaration` -> SC (signal consistency, 0.30 weight), `clock_report` -> CA (clock accuracy, 0.20 weight). Uptime (UP, 0.25 weight) computed internally from equipment state stream — not a marketplace signal.
**Cross-domain**: depin-architect (DP) owns on-chain reputation SBT (S20.12.6 OCI-17). This epic computes off-chain scores that feed into on-chain publication. See DePIN WBS.
**RFC Sections**: S20.4.1-S20.5.6

---

### Epic SC-06: Signal Attestation & Anomaly Detection — 16 SP

Implements S20.6-S20.7: Attestation envelopes, clock quality, suspicious signal detection, edge device trust boundaries.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-06.1.1 | 2 | `AttestationEnvelope` Effect Schema: timing, source, quality, signature fields per S20.6.1 | S20.6.1 |
| ⏳ | SC-06.1.2 | 2 | Clock quality assessment logic: ptp-gps (<1ms), ntp-enterprise (<100ms), ntp-consumer (<1s), unknown (>1s) | S20.6.3 |
| ⏳ | SC-06.1.3 | 2 | `AttestationService` — enriches cross-org events with attestation envelope, computes clockDrift at hub | S20.6.2 |
| ⏳ | SC-06.2.1 | 3 | `AnomalyDetectionService` — capacity inflation, clock manipulation, sybil detection, replay detection | S20.6.4 |
| ⏳ | SC-06.2.2 | 2 | Timestamp anomaly handling: SuspiciousTimestamp, ClockRegression, SystematicClockBias flags per S20.7.2 | S20.7.2 |
| ⏳ | SC-06.2.3 | 2 | Device attestation tier mapping: T0 (none), T1 (software), T2 (optional TPM), T3 (required TPM+re-attestation) | S20.7.3 |
| ⏳ | SC-06.2.4 | 3 | Integration tests: anomaly detection against crafted attack scenarios | S20.6.4 |

**Dependencies**: SC-05 (trust scoring consumes anomaly signals)
**RFC Sections**: S20.6.1-S20.7.3

---

## Phase SC-3: Data Governance (Sprints 5-7) — 47 SP

### Epic SC-07: Data Classification & Sharing Controls — 18 SP

Implements S20.8-S20.10: Four data categories, consent protocol, data classification framework, ITAR.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-07.1.1 | 2 | `DataCategory` Schema.Literal: 'public', 'bilateral', 'private', 'regulatory' | S20.8.1 |
| ⏳ | SC-07.1.2 | 2 | `DataClassification` Schema.Literal: C-0 (Public) through C-5 (Restricted) with enforcement rules per level | S20.10.1 |
| ⏳ | SC-07.1.3 | 3 | `DataClassificationService` — Effect service enforcing classification on export boundaries (NATS + on-chain) | S20.10.2 |
| ⏳ | SC-07.1.4 | 2 | Default classification rules: readings=C-3, entity=C-3, alarms=C-4(ISA-18.2)/C-3, workorders=C-2/C-3 | S20.10.3 |
| ⏳ | SC-07.2.1 | 3 | Schema redaction at export boundary: `Schema.pick`/`Schema.omit` transformations at NATS export point | S20.9.3 |
| ⏳ | SC-07.2.2 | 3 | `CapabilityDeclaration` schema + public export to `commons.capabilities.{orgId}`, staleness detection (7d) | S20.8.2 |
| ⏳ | SC-07.2.3 | 3 | ITAR-specific requirements: disable all exports, US-only hosting, FIPS 140-3, separate JetStream domains | S20.10.4 |

**Dependencies**: SC-03 (authorization), NW (network-architect) cross-org export epics
**RFC Sections**: S20.8.1-S20.10.4

---

### Epic SC-08: Consent Management — 13 SP

Implements S20.9: Consent protocol (declare, accept, revoke, audit), consent schemas, selective disclosure.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-08.1.1 | 2 | `ConsentGrant` TaggedStruct: grantId, grantorOrgId, granteeOrgId, scope (subjects, category, fields) | S20.9.2 |
| ⏳ | SC-08.1.2 | 2 | `ConsentRevocation` TaggedStruct: grantId, revokedAt, reason, effectiveWithin (max 60s) | S20.9.2 |
| ⏳ | SC-08.1.3 | 5 | `ConsentManagementService` — Effect service for consent lifecycle: grant, revoke (NATS export removal within 60s), expire, audit logging | S20.9.1 |
| ⏳ | SC-08.1.4 | 2 | Consent events: ConsentGranted, ConsentRevoked, ConsentExpired with full audit metadata | S20.9.1 |
| ⏳ | SC-08.1.5 | 2 | Integration tests: consent grant -> data sharing -> revocation -> export removal within SLO | S20.9.1 |

**Dependencies**: SC-07 (data classification), NW (network-architect) NATS export/import epics
**RFC Sections**: S20.9.1-S20.9.3

---

### Epic SC-09: Trust Degradation & Revocation — 16 SP

Implements S20.11: Degradation triggers, suspension protocol, permanent revocation, appeal process.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-09.1.1 | 2 | Degradation trigger schemas: failed delivery (-0.03), clock drift (-0.01/cycle), extended offline, rate limit violation (-0.05) | S20.11.1 |
| ⏳ | SC-09.1.2 | 3 | `SuspensionService` — NATS account restricted mode: disable cross-org exports, freeze bilateral channels, freeze trust score | S20.11.2 |
| ⏳ | SC-09.1.3 | 3 | `RevocationService` — permanent removal: JWT revocation list, data retention/purge, marketplace deactivation | S20.11.3 |
| ⏳ | SC-09.1.4 | 3 | Automated trust score review pipeline: anomaly detection -> freeze -> 72h investigation -> suspension/clear | S20.11.1, S20.11.2 |
| ⏳ | SC-09.1.5 | 2 | Appeal workflow: submit (30d window) -> independent review -> decision (14d) -> reinstate/confirm | S20.11.4 |
| ⏳ | SC-09.1.6 | 3 | Integration tests: trust degradation scenarios, suspension/revocation flows, appeal process | S20.11 |

**Dependencies**: SC-05 (trust scoring), SC-08 (consent revocation)
**Cross-domain**: depin-architect (DP) owns on-chain suspension propagation (OCI-04: Sui event -> NATS JWT revocation within 60s). This epic handles the off-chain enforcement. See DePIN WBS.
**RFC Sections**: S20.11.1-S20.11.4

---

## Phase SC-4: Tenant Isolation (Sprints 7-9) — 42 SP

### Epic SC-10: Multi-Tenant Isolation Infrastructure — 21 SP

Implements S21.4-S21.10: NATS account isolation, JetStream domains, compute isolation, data-at-rest encryption, device isolation.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-10.1.1 | 3 | `TenantIsolationService` — Effect service configuring 5-layer isolation per org (messaging, persistence, compute, encryption, sharing) | S21.3, S21.14 |
| ⏳ | SC-10.1.2 | 3 | NATS account isolation: per-org account with JWT auth, subject namespace invisibility, export/import controls | S21.4 |
| ⏳ | SC-10.1.3 | 3 | JetStream domain isolation: per-org stream prefix, deny_delete/deny_purge for regulatory streams, independent replication | S21.5 |
| ⏳ | SC-10.2.1 | 3 | Compute isolation: entity shard orgId affinity, resource limits per runner, dedicated runner pools for ITAR/FDA | S21.6, S21.12.2 |
| ⏳ | SC-10.2.2 | 3 | Data-at-rest encryption: per-org AES-256-GCM keys, KMS integration (Vault/AWS KMS/Azure KV), 90-day rotation | S19.6.3 |
| ⏳ | SC-10.3.1 | 2 | Device-level isolation: per-device pub.allow enforcement, edge-to-edge isolation between orgs, compromised device containment (JWT revocation within 60s) | S21.10 |
| ⏳ | SC-10.3.2 | 2 | Platform operator isolation: no read access to org data by default, aggregated metrics only via $SYS.>, time-bounded grant for access | S19.7.2 |
| ⏳ | SC-10.3.3 | 2 | Cross-org sharing boundary: manufacturing-commons system account mediation, private NATS exports, bilateral channels only | S19.7.6, S21.8 |

**Dependencies**: SC-01 (NATS JWT), SC-03 (authorization), NW (network-architect) NATS infrastructure
**RFC Sections**: S19.6.3, S19.7.2, S19.7.6, S21.3-S21.10

---

### Epic SC-11: Regulatory Isolation Profiles — 13 SP

Implements S21.12: Profile definitions, ITAR isolation, FDA isolation, profile application at provisioning.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-11.1.1 | 2 | `RegulatoryProfile` Schema.Literal: 'standard', 'fda', 'aerospace', 'defense', 'medical', 'food' | S21.12.1 |
| ⏳ | SC-11.1.2 | 3 | Profile configuration engine: auto-configure isolation properties (stream retention, deny_delete, runner pool, encryption) based on profile | S21.12.4 |
| ⏳ | SC-11.2.1 | 3 | ITAR profile (ISO-58): dedicated NATS cluster (US-only), dedicated runner pool, export prohibition, enhanced access logging | S21.12.2 |
| ⏳ | SC-11.2.2 | 3 | FDA profile (ISO-59): deny_delete+deny_purge, 7-year retention, electronic signatures, batch traceability | S21.12.3 |
| ⏳ | SC-11.2.3 | 2 | Profile application at provisioning: validate declared requirements, apply profile, prevent downgrade without approval | S21.12.4 |

**Dependencies**: SC-10 (isolation infrastructure), SC-04 (org provisioning)
**RFC Sections**: S21.12.1-S21.12.4

---

### Epic SC-12: Isolation Verification & Chaos Engineering — 8 SP

Implements S21.11, S22.9: Automated isolation tests, chaos engineering, isolation metrics.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-12.1.1 | 3 | Automated isolation test suite (ISO-54): cross-account subscribe/publish rejection, stream visibility, entity access, export boundary, rate limits | S21.11.1 |
| ⏳ | SC-12.1.2 | 2 | Isolation metrics collection (ISO-56): cross-account access attempts, export config changes, JWT revocations, stream config mutations | S21.11.3 |
| ⏳ | SC-12.1.3 | 3 | Chaos engineering test suite (S22.9): NATS server kill, network partition, shard migration, edge disconnect, database failover, cascading backpressure | S22.9.1 |

**Dependencies**: SC-10 (isolation infrastructure must exist to test)
**RFC Sections**: S21.11.1-S21.11.3, S22.9.1

---

## Phase SC-5: Failure Recovery & Network Security (Sprints 9-10) — 34 SP

### Epic SC-13: Cryptographic Infrastructure — 13 SP

Implements S19.6: TLS 1.3, identity crypto, data-at-rest encryption, edge device crypto tiers, key rotation policies.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-13.1.1 | 2 | TLS 1.3 enforcement config: cipher suite ordering (AES-256-GCM > ChaCha20 > AES-128-GCM), X25519 key exchange | S19.6.1 |
| ⏳ | SC-13.1.2 | 2 | WSS enforcement for `/ws/iiot` + HSTS headers for HTTP API | S19.6.1 |
| ⏳ | SC-13.1.3 | 3 | mTLS configuration service: hub server cert, edge client cert, org trust anchor verification, Tier 1 JWT-only fallback | S19.6.6 |
| ⏳ | SC-13.2.1 | 2 | Edge device crypto tier config: Tier 1 (software TLS), Tier 2 (hardware accel), Tier 3 (mTLS+X.509+TPM), Tier 4 (SPIFFE SVIDs) | S19.6.4 |
| ⏳ | SC-13.2.2 | 2 | `KeyRotationService` — automated key rotation: operator (manual/HSM), account (annual), device JWT (90d), SPIFFE (1h), JetStream (90d), TLS (90d) | S19.6.5 |
| ⏳ | SC-13.2.3 | 2 | Hub-to-hub and gateway encryption: TLS 1.3 route connections, operator-level NKey auth, mTLS with platform CA certs | S19.7.3 |

**Dependencies**: SC-01 (JWT auth), SC-02 (SPIFFE)
**RFC Sections**: S19.6.1-S19.6.6, S19.7.3

---

### Epic SC-14: Network Security & Rate Limiting — 8 SP

Implements S19.7.5: Per-org rate limits, cross-org rate limits, DDoS protection.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-14.1.1 | 3 | `RateLimitService` — NATS account-level rate limits: max_data (10MB/s small, 100MB/s enterprise), max_payload (1MB), max_subscriptions (1000), max_connections (100) | S19.7.5 |
| ⏳ | SC-14.1.2 | 2 | Cross-org rate limits on manufacturing-commons imports: max 100 events/org/s, 10x burst for 30s | S19.7.5 |
| ⏳ | SC-14.1.3 | 1 | DDoS protection config: connection rate limit (10/s per IP), 5s JWT validation timeout, 30s TLS handshake timeout | S19.7.5 |
| ⏳ | SC-14.1.4 | 2 | Rate limit violation logging + automated capacity reduction after 10min sustained violation | S19.7.5 |

**Dependencies**: SC-10 (tenant isolation)
**RFC Sections**: S19.7.5

---

### Epic SC-15: Failure Detection & Recovery Automation — 13 SP

Implements S22.3-S22.8: Failure classification, propagation model, recovery procedures, SLOs.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-15.1.1 | 2 | `FailureClassificationService` — categorize failures by duration (transient/persistent), trust (honest/byzantine), domain (edge/hub/cluster/db/cross-org) | S22.3 |
| ⏳ | SC-15.1.2 | 3 | `AutoRecoveryService` — automatic recovery for transient failures: MQTT reconnect, Raft failover, JetStream consumer resume, HashRing rebalance | S22.8.1 |
| ⏳ | SC-15.1.3 | 3 | Semi-automatic recovery workflows: JetStream storage alerts, entity state corruption replay, trust score anomaly freeze | S22.8.2 |
| ⏳ | SC-15.1.4 | 2 | Recovery SLO monitoring: transient <60s, persistent <15min, byzantine <1h, cascading <5min (bulkhead) | S22.8.4 |
| ⏳ | SC-15.2.1 | 3 | Cross-org failure handling: work order during offline org (saga compensation), trust score manipulation response, data sovereignty violation emergency response | S22.7 |

**Dependencies**: All prior security epics (this is the resilience layer)
**RFC Sections**: S22.3-S22.8

---

## Phase SC-6: Compliance Mapping (Sprint 10) — Scope: documentation + config

### Epic SC-16: Security Compliance Documentation — 8 SP (non-code)

Implements S19.8: IEC 62443, NIST CSF, SOC 2, FDA 21 CFR Part 11, ISA-18.2, ITAR mappings.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-16.1.1 | 2 | IEC 62443 compliance matrix: FR1-FR7 mapped to TMNL implementations with SL-2/SL-3 target levels | S19.8.1 |
| ⏳ | SC-16.1.2 | 2 | NIST CSF alignment doc: Identify/Protect/Detect/Respond/Recover mapped to TMNL implementations | S19.8.2 |
| ⏳ | SC-16.1.3 | 2 | SOC 2 Type II requirements doc: access control, audit logging, encryption, availability, change management | S19.8.3 |
| ⏳ | SC-16.1.4 | 2 | FDA 21 CFR Part 11 + ISA-18.2 + ITAR compliance checklist: regulatory operator events, alarm records, export controls | S19.8.4-S19.8.6 |

**Dependencies**: All prior epics (documents reference implementations)
**RFC Sections**: S19.8.1-S19.8.6

---

## Entity Classification

### Machine-Backed Entities (12-layer stack)

| Entity | States | Rationale |
|--------|--------|-----------|
| **OrganizationIdentity** | UNVERIFIED -> PROVISIONED -> ACTIVE -> SUSPENDED -> DEACTIVATED | Long-lived entity with guarded state transitions per S20.3.1, distributed via @effect/cluster |
| **TrustChannel** | DISCOVERY -> INQUIRY -> ESTABLISHED -> ACTIVE -> SUSPENDED -> TERMINATED | Bilateral relationship entity per S20.4.2, state transitions triggered by cross-org events |

### CRUD Entities (8-layer stack)

| Entity | Rationale |
|--------|-----------|
| **TrustScore** | Computed aggregate — periodic recalculation, no state machine (S20.5) |
| **ConsentGrant** | Data record with status field (active/revoked/expired) — 60s revocation SLA is operational, not a state graph (S20.9) |
| **ClassificationRecord** | Attestation record with expiry — no state transitions (S20.10) |
| **IsolationConfig** | Configuration record per org — no state transitions (S21.14) |

---

## Phase SC-7: E2E Stack Completion (Cross-cutting) — 189 SP

> Added per E2E Stack Audit + Machine/CRUD entity classification. Machine-backed entities (OrganizationIdentity, TrustChannel) get full 12-layer stack. CRUD entities (TrustScore, ConsentGrant, ClassificationRecord, IsolationConfig) get 8-layer stack.

---

### Epic SC-17: Security Model Derivation — 13 SP

Derives Model.Class types from security schemas for SQL persistence. Pattern: `src/lib/iiot/models/alarms/AlarmModel.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-17.1.1 | 2 | `OrganizationIdentityModel` — Model.Class derived from OrganizationIdentity schema, Model.Generated(OrgId), Model.FieldOption for optional contacts/certifications, JsonFromString for metadata | S20.3.4 |
| ⏳ | SC-17.1.2 | 3 | `TrustChannelModel` — Model.Class: channelId (Generated), initiatorOrgId/responderOrgId FKs, state (Literal: discovery/inquiry/established/active/suspended/terminated), capabilities (JsonFromString), createdAt, lastTransitionAt | S20.4.2 |
| ⏳ | SC-17.1.3 | 2 | `TrustScoreModel` — Model.Class for trust score persistence: composite + 4 component scores, computedAt (CreatedAt transform), publishable flag, orgId FK | S20.5.6 |
| ⏳ | SC-17.1.4 | 2 | `ConsentGrantModel` — Model.Class: grantId (Generated), grantorOrgId/granteeOrgId FKs, scope (JsonFromString), status, createdAt/revokedAt (FieldOption DateFromSelf) | S20.9.2 |
| ⏳ | SC-17.1.5 | 2 | `ClassificationRecordModel` — Model.Class: resourceId, orgId FK, classification level (C-0..C-5), attestedBy, attestedAt, expiresAt, signature | S20.10.2 |
| ⏳ | SC-17.1.6 | 1 | `IsolationConfigModel` — Model.Class: orgId FK, profile (regulatory profile enum), 5-layer config (JsonFromString), provisionedAt, lastAuditedAt | S21.14 |
| ⏳ | SC-17.1.7 | 1 | Barrel export `src/lib/iiot/models/security/index.ts` + registration in `models/index.ts` | — |

**Dependencies**: SC-04, SC-05, SC-07, SC-08, SC-10 (schema definitions)
**Pattern Reference**: `src/lib/iiot/models/alarms/AlarmModel.ts`

---

### Epic SC-18: Security DDL — 16 SP

SQL table definitions, indexes, and migrations for security entities. Pattern: `src/lib/iiot/models/alarms/AlarmModel.ddl.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-18.1.1 | 3 | `OrganizationIdentityModel.ddl.ts` — CREATE TABLE iiot.organizations (id, legal_name, jurisdiction, tax_id, state, verification_tier, contacts JSONB, certifications JSONB, created_at, updated_at); indexes on state, jurisdiction | S20.3.4 |
| ⏳ | SC-18.1.2 | 3 | `TrustChannelModel.ddl.ts` — CREATE TABLE iiot.trust_channels (id, initiator_org_id FK, responder_org_id FK, state TEXT CHECK, capabilities JSONB, nats_export_subject TEXT, created_at, last_transition_at); indexes on (initiator, responder) UNIQUE, state; FK to iiot.organizations | S20.4.2 |
| ⏳ | SC-18.1.3 | 2 | `TrustScoreModel.ddl.ts` — CREATE TABLE iiot.trust_scores (id SERIAL, org_id FK, composite NUMERIC, signal_consistency NUMERIC, clock_accuracy NUMERIC, uptime_reliability NUMERIC, peer_validation NUMERIC, computed_at TIMESTAMPTZ, publishable BOOLEAN); index on org_id, computed_at DESC | S20.5.6 |
| ⏳ | SC-18.1.4 | 2 | `ConsentGrantModel.ddl.ts` — CREATE TABLE iiot.consent_grants (id, grantor_org_id FK, grantee_org_id FK, scope JSONB, status, created_at, revoked_at, expires_at); indexes on grantor/grantee pairs, status | S20.9.2 |
| ⏳ | SC-18.1.5 | 2 | `ClassificationRecordModel.ddl.ts` — CREATE TABLE iiot.classification_records (id SERIAL, org_id FK, resource_id TEXT, classification TEXT CHECK, attested_by TEXT, attested_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, signature BYTEA); index on org_id + resource_id | S20.10.2 |
| ⏳ | SC-18.1.6 | 2 | `IsolationConfigModel.ddl.ts` — CREATE TABLE iiot.isolation_configs (org_id PK FK, profile TEXT, layer_config JSONB, provisioned_at TIMESTAMPTZ, last_audited_at TIMESTAMPTZ) | S21.14 |
| ⏳ | SC-18.1.7 | 2 | Security migration script: ordered table creation with FK constraints, audit trigger functions (org state changes, trust channel transitions, consent changes, classification changes log to iiot.event_journal) | — |

**Dependencies**: SC-17 (model definitions)
**Pattern Reference**: `src/lib/iiot/models/alarms/AlarmModel.ddl.ts`

---

### Epic SC-19: Security Repositories — 16 SP

CRUD repositories using Effect SQL patterns. Pattern: `src/lib/iiot/repositories/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-19.1.1 | 3 | `OrganizationRepository` — findById, findByState, create, updateState, updateVerificationTier, deactivate; uses SqlResolver patterns | S20.3 |
| ⏳ | SC-19.1.2 | 3 | `TrustChannelRepository` — findById, findByOrgPair, findByState, create, updateState, findActiveByOrg; composite queries for bilateral channel lookups | S20.4 |
| ⏳ | SC-19.1.3 | 3 | `TrustScoreRepository` — findLatestByOrgId, findHistory(orgId, since), create, findPublishable; uses TimeSeries patterns for historical queries | S20.5 |
| ⏳ | SC-19.1.4 | 2 | `ConsentGrantRepository` — findByGrantorOrg, findByGranteeOrg, findActiveByPair, create, revoke, expire; composite queries for bilateral lookups | S20.9 |
| ⏳ | SC-19.1.5 | 2 | `ClassificationRecordRepository` — findByResource, findByOrg, create, invalidate, findExpired; time-bounded queries for attestation validity | S20.10 |
| ⏳ | SC-19.1.6 | 2 | `IsolationConfigRepository` — findByOrgId, create, updateProfile, findByProfile; simple CRUD for isolation configs | S21.14 |
| ⏳ | SC-19.1.7 | 1 | Barrel export `src/lib/iiot/repositories/security/index.ts` + registration in `repositories/index.ts` | — |

**Dependencies**: SC-18 (DDL tables must exist)
**Pattern Reference**: `src/lib/iiot/repositories/`

---

### Epic SC-20: Security Error Schemas — 8 SP

Domain-specific TaggedError types per security domain. Pattern: `src/lib/iiot/errors/alarm.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-20.1.1 | 2 | `src/lib/iiot/errors/auth.ts` — AuthenticationFailedError, InvalidJwtError, JwtExpiredError, JwtRevokedError, InsufficientRoleError, CrossOrgTokenInvalidError, SpiffeValidationError + union type `AuthError` | S19.4-S19.5 |
| ⏳ | SC-20.1.2 | 2 | `src/lib/iiot/errors/trust.ts` — OrgNotFoundError, InvalidOrgTransitionError, TrustScoreComputationError, KAnonymityViolationError, TrustDegradationError, SuspensionError + union type `TrustError` | S20.3-S20.11 |
| ⏳ | SC-20.1.3 | 2 | `src/lib/iiot/errors/consent.ts` — ConsentNotFoundError, ConsentAlreadyRevokedError, ConsentExpiredError, InvalidConsentScopeError, RevocationTimeoutError + union type `ConsentError` | S20.9 |
| ⏳ | SC-20.1.4 | 1 | `src/lib/iiot/errors/isolation.ts` — IsolationViolationError, ProfileMismatchError, ITARExportViolationError, CrossAccountAccessError + union type `IsolationError` | S21 |
| ⏳ | SC-20.1.5 | 1 | Barrel export `src/lib/iiot/errors/security/index.ts` + registration in `errors/index.ts`, error tests | — |

**Dependencies**: None (error schemas are standalone)
**Pattern Reference**: `src/lib/iiot/errors/alarm.ts`

---

### Epic SC-21: Security RPC Groups — 16 SP

RPC group definitions and handlers for security administration. Pattern: `src/lib/iiot/rpc/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-21.1.1 | 3 | `AuthRpcs` — RpcGroup: ValidateSession, IssueDeviceJwt, IssueHumanJwt, RevokeJwt, RotateAccountKeys, GetSessionContext | S19.4-S19.5 |
| ⏳ | SC-21.1.2 | 3 | `OrgIdentityRpcs` — RpcGroup: RegisterOrg, VerifyOrg, ActivateOrg, SuspendOrg, DeactivateOrg, GetOrgIdentity, ListOrgsByState | S20.3 |
| ⏳ | SC-21.1.3 | 3 | `TrustRpcs` — RpcGroup: GetTrustScore, GetTrustHistory, GetTrustTier, ComputeTrustScore, FreezeScore, InitiateSuspension, ProcessAppeal | S20.4-S20.11 |
| ⏳ | SC-21.1.4 | 3 | `ConsentRpcs` — RpcGroup: GrantConsent, RevokeConsent, GetConsent, ListActiveConsents, GetConsentAuditTrail | S20.9 |
| ⏳ | SC-21.1.5 | 2 | `IsolationRpcs` — RpcGroup: GetIsolationConfig, UpdateProfile, RunIsolationTest, GetIsolationMetrics | S21 |
| ⏳ | SC-21.1.6 | 2 | `ClassificationRpcs` — RpcGroup: ClassifyResource, GetClassification, ReclassifyResource, GetRedactionRules | S20.10 |

**Dependencies**: SC-01 through SC-15 (L2 services), SC-20 (error schemas)
**Pattern Reference**: `src/lib/iiot/rpc/`

---

### Epic SC-22: Security HTTP Endpoints — 8 SP

REST API routes wrapping security RPC groups. Pattern: `src/lib/iiot/http/api.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-22.1.1 | 2 | `SecurityHttpApi` — HttpApiGroup composing Auth, OrgIdentity, Trust, Consent, Isolation, Classification RPC groups into REST endpoints under `/api/security/` | S19-S21 |
| ⏳ | SC-22.1.2 | 2 | Auth endpoints: `POST /api/security/auth/{validate|issue-device-jwt|issue-human-jwt|revoke|rotate-keys}` | S19.4 |
| ⏳ | SC-22.1.3 | 2 | Trust + Consent endpoints: `POST /api/security/trust/{score|history|tier|suspend}`, `POST /api/security/consent/{grant|revoke|list|audit}` | S20 |
| ⏳ | SC-22.1.4 | 2 | Isolation + Classification endpoints: `POST /api/security/isolation/{config|test|metrics}`, `POST /api/security/classification/{classify|get|reclassify}` | S21, S20.10 |

**Dependencies**: SC-21 (RPC groups)
**Pattern Reference**: `src/lib/iiot/http/api.ts`

---

### Epic SC-23: Security Streaming RPCs — 8 SP

Real-time streaming endpoints for security-specific event feeds (non-entity events). Machine-backed entity state changes (OrgIdentity, TrustChannel) flow automatically through `Machine.changes` -> `makeEntityObserver` -> `iiot:entity-changes` EventDistribution channel (PL-07/08) and are consumed via the shared `SubscribeEntityChanges` RPC (PL-09). This epic covers **additional** security-domain streams for CRUD events that do NOT flow through the observer pattern.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-23.1.1 | 3 | `SecurityRealtimeRpcs` — RpcGroup with `stream: true`: SubscribeTrustScoreUpdates (computed score changes — CRUD, not Machine-backed), SubscribeConsentChanges (grant/revoke events — CRUD lifecycle), SubscribeIsolationViolations (cross-account access attempts, export boundary violations — operational alerts) | S20.5, S20.9, S21.11 |
| ⏳ | SC-23.1.2 | 3 | `SecurityStreamHandlers` — streaming handler implementations: trust score updates -> PubSub channel (maxLag 1k), consent events -> PubSub channel (maxLag 1k), isolation violations -> PubSub channel (maxLag 100, high priority). These are domain-specific PubSub channels separate from the shared `iiot:entity-changes` channel. | S20.5, S20.9, S21.11 |
| ⏳ | SC-23.1.3 | 2 | Integration tests: subscribe to trust score stream, verify score update delivery; subscribe to consent stream, verify grant/revoke events; subscribe to isolation stream, verify violation alerts. Use `it()` + `Effect.runPromise` for PubSub tests. | — |

**Dependencies**: SC-21 (RPC groups), PL-09 (SubscribeEntityChanges for Machine entity streams), PL (platform-architect) WebSocket infrastructure
**Pattern Reference**: `src/lib/iiot/rpc/RealtimeRpcs.ts`
**Note**: OrgIdentity and TrustChannel real-time state changes are handled by the observer pattern (SC-27 -> PL-07/08 -> PL-09). This epic adds security-specific CRUD event streams only.

---

### Epic SC-24: Security State Machines — 13 SP

Machine definitions for stateful security entities. Pattern: `src/lib/iiot/machines/AlarmMachine.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-24.1.1 | 2 | `org-identity-graph.ts` — State graph: UNVERIFIED -> PROVISIONED -> ACTIVE -> SUSPENDED -> DEACTIVATED with guard conditions (verification tier gates PROVISIONED->ACTIVE, anomaly/manual triggers ACTIVE->SUSPENDED) | S20.3.1 |
| ⏳ | SC-24.1.2 | 5 | `OrgIdentityMachine.ts` — Machine.make() with procedures: Register (-> UNVERIFIED), Verify (-> PROVISIONED), Activate (-> ACTIVE), Suspend (-> SUSPENDED), Deactivate (-> DEACTIVATED), Reinstate (SUSPENDED -> ACTIVE). Feature-flag controlled event emission to EventLog. | S20.3.1, S20.11.2 |
| ⏳ | SC-24.1.3 | 2 | `trust-channel-graph.ts` — State graph: DISCOVERY -> INQUIRY -> ESTABLISHED -> ACTIVE -> SUSPENDED -> TERMINATED with guard conditions (bilateral acceptance gates INQUIRY->ESTABLISHED, consent revocation triggers ACTIVE->SUSPENDED) | S20.4.2 |
| ⏳ | SC-24.1.4 | 3 | `TrustChannelMachine.ts` — Machine.make() with procedures: Discover (-> DISCOVERY), Inquire (-> INQUIRY), Establish (-> ESTABLISHED), Activate (-> ACTIVE), Suspend (-> SUSPENDED), Terminate (-> TERMINATED). NATS export/import setup on ESTABLISHED, teardown on TERMINATED. | S20.4.2 |
| ⏳ | SC-24.1.5 | 1 | Barrel export `src/lib/iiot/machines/security/index.ts`, graph registration in `machines/graphs/index.ts` | — |

**Dependencies**: SC-04 (OrgIdentity schema), SC-05 (TrustChannel schema)
**Cross-domain**: OrgIdentity Machine (SC-24.1.1/SC-24.1.2) is the off-chain mirror of DP-09 on-chain Move module. TrustChannel Machine (SC-24.1.3/SC-24.1.4) is the off-chain superset (6 states) mirroring DP-09 on-chain subset (4 states). See [Mirror Synchronization Boundary](#mirror-synchronization-boundary-sc--dp).
**Pattern Reference**: `src/lib/iiot/machines/AlarmMachine.ts`, `src/lib/iiot/machines/graphs/alarm-state-graph.ts`

---

### Epic SC-25: Security ES Handlers — 10 SP

Event sourcing command handlers for machine-backed security entities. Pattern: `src/lib/iiot/handlers/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-25.1.1 | 5 | `OrgIdentityHandler` — ES handler for OrganizationIdentity: Register (create org + provision NATS account), Verify (update tier), Activate (enable cross-org exports), Suspend (disable exports, freeze trust), Deactivate (revoke JWT, purge exports). Each command emits domain event to EventLog. | S20.3, S20.11 |
| ⏳ | SC-25.1.2 | 3 | `TrustChannelHandler` — ES handler for TrustChannel: Discover (log inquiry), Inquire (send CrossOrgAuthToken), Establish (create NATS export/import pair), Activate (enable bilateral data flow), Suspend (freeze channel), Terminate (remove NATS exports, archive). Each command emits domain event. | S20.4.2 |
| ⏳ | SC-25.1.3 | 2 | Handler integration tests: OrgIdentity full lifecycle (register -> verify -> activate -> suspend -> reinstate), TrustChannel full lifecycle (discover -> inquire -> establish -> activate -> terminate) | S20.3, S20.4 |

**Dependencies**: SC-24 (machines), SC-01 through SC-03 (auth services for NATS provisioning)
**Pattern Reference**: `src/lib/iiot/handlers/`

---

### Epic SC-26: Security Entity Layer — 10 SP

Entity.make() definitions with Machine + RPC wiring for @effect/cluster distribution. Pattern: `src/lib/iiot/entity/AlarmEntity.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-26.1.1 | 5 | `OrgIdentityEntity` — Entity.make("OrgIdentity", OrgIdentityRpcGroup) with Machine boot, shard group "security", orgId as entity ID, state persistence via OrgIdentityHandler. Annotate with ClusterSchema.ShardGroup("security"). | S20.3 |
| ⏳ | SC-26.1.2 | 3 | `TrustChannelEntity` — Entity.make("TrustChannel", TrustChannelRpcGroup) with Machine boot, shard group "security", channelId as entity ID (composite of initiator+responder orgIds), state persistence via TrustChannelHandler. | S20.4 |
| ⏳ | SC-26.1.3 | 2 | Entity registration in EntityStack + SecurityEntityLayer composition (Layer.mergeAll of both entities + their handler/machine dependencies) | — |

**Dependencies**: SC-24 (machines), SC-25 (handlers), SC-21 (RPC groups)
**Pattern Reference**: `src/lib/iiot/entity/AlarmEntity.ts`, `src/lib/iiot/entity/EntityStack.ts`

---

### Epic SC-27: Security Entity Observer Wiring — 8 SP

Wires security Machine-backed entities into platform-architect's observer infrastructure (PL-07 `makeEntityObserver` factory, PL-02 EventDistribution channels). Does NOT rebuild the observer — calls the factory with security-specific parameters.

**Architecture**: `Machine.changes` (Stream<State>) piped through `Stream.zipWithPrevious` (NOT `Stream.pairwise` — does not exist) inside `makeEntityObserver()`. First emission has `Option.none()` for previous state — handled as "initialized" action. Observer runs as `Effect.forkScoped` with finalizer.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-27.1.1 | 2 | OrgIdentity transition-to-action map: `{UNVERIFIED->PROVISIONED: 'verified', PROVISIONED->ACTIVE: 'activated', ACTIVE->SUSPENDED: 'suspended', SUSPENDED->ACTIVE: 'reinstated', ACTIVE->DEACTIVATED: 'deactivated', *->UNVERIFIED: 'initialized'}`. Register with `makeEntityObserver(OrgIdentityMachine, 'OrgIdentity', orgId, 'org', 'none', transitionMap)` | S20.3.1 |
| ⏳ | SC-27.1.2 | 2 | TrustChannel transition-to-action map: `{DISCOVERY->INQUIRY: 'inquiry_sent', INQUIRY->ESTABLISHED: 'channel_established', ESTABLISHED->ACTIVE: 'activated', ACTIVE->SUSPENDED: 'suspended', ACTIVE->TERMINATED: 'terminated', *->DISCOVERY: 'initialized'}`. Register with `makeEntityObserver(TrustChannelMachine, 'TrustChannel', channelId, 'org', 'none', transitionMap)` | S20.4.2 |
| ⏳ | SC-27.1.3 | 2 | Wire observers into OrgIdentityHandler and TrustChannelHandler — add EventDistribution dependency, call makeEntityObserver at entity activation (scoped fiber). Events flow to existing `iiot:entity-changes` channel (PL-02). | S12.4 |
| ⏳ | SC-27.1.4 | 2 | Observer tests: trigger OrgIdentity state transition -> verify EntityStateChanged event on `iiot:entity-changes` channel with correct entityType/action/previousState/currentState. Trigger TrustChannel transition -> same. Use `it()` + `Effect.runPromise` (NOT `it.effect()` — PubSub timeout). | — |

**Dependencies**: SC-24 (machines with state graphs), SC-25 (handlers), PL-07 (`makeEntityObserver` factory), PL-02 (EventDistribution 5th channel)
**Pattern Reference**: Platform-architect Epic PL-08 (wiring pattern for V1 entities)

---

### Epic SC-28: Machine-Backed Entity Tests (OrganizationIdentity) — 13 SP

Per-layer test suite for OrganizationIdentity. Pattern: `src/lib/iiot/__tests__/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-28.1.1 | 2 | `__tests__/schemas/org-identity.test.ts` — Schema decode/encode roundtrip: OrganizationIdentity, IdentityState, valid/invalid payloads, branded OrgId validation | S20.3.4 |
| ⏳ | SC-28.1.2 | 1 | `__tests__/schemas/org-identity-model.test.ts` — Model derivation: OrganizationIdentityModel computed fields, Model.FieldOption transforms, JsonFromString for contacts/certifications | S20.3.4 |
| ⏳ | SC-28.1.3 | 1 | DDL migration test: verify iiot.organizations table exists, column types, constraints (state CHECK), indexes | S20.3.4 |
| ⏳ | SC-28.1.4 | 2 | `__tests__/repos/org-identity-repo.test.ts` — Repo integration: create -> findById -> updateState -> findByState -> deactivate. SqlResolver roundtrip. | S20.3 |
| ⏳ | SC-28.1.5 | 2 | `__tests__/machines/org-identity-machine.test.ts` — Every valid state transition (5 states, 6 transitions). Every invalid transition (e.g., UNVERIFIED -> ACTIVE rejected). Guard conditions. Event emission verification. | S20.3.1 |
| ⏳ | SC-28.1.6 | 2 | `__tests__/integration/org-identity-handler.test.ts` — ES handler: Register -> events -> state, Verify -> events -> state, Activate -> events -> state, Suspend -> events -> state. Command rejection for invalid transitions. | S20.3, S20.11 |
| ⏳ | SC-28.1.7 | 2 | `__tests__/integration/org-identity-entity.test.ts` — Entity.make integration: cluster entity lifecycle, RPC routing through entity proxy, shard assignment verification | S20.3 |
| ⏳ | SC-28.1.8 | 1 | Observer emission test: trigger OrgIdentity Machine state transition, verify `Machine.changes` -> `Stream.zipWithPrevious` -> EntityStateChanged event published to `iiot:entity-changes` channel. Verify "initialized" action for first emission (`Option.none()` previous). **NOTE**: Use `it()` + `Effect.runPromise`, NOT `it.effect()` (PubSub timeout). | S20.3.1 |

**Dependencies**: SC-17 through SC-19 (model/DDL/repo), SC-24 through SC-27 (machine/handler/entity/observer)
**Test Convention**: `src/lib/iiot/__tests__/{schemas,repos,machines,integration}/`

---

### Epic SC-29: Machine-Backed Entity Tests (TrustChannel) — 13 SP

Per-layer test suite for TrustChannel. Pattern: `src/lib/iiot/__tests__/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-29.1.1 | 2 | `__tests__/schemas/trust-channel.test.ts` — Schema decode/encode roundtrip: TrustChannel, TrustChannelState (6 states), bilateral org pair validation, capabilities array | S20.4.2 |
| ⏳ | SC-29.1.2 | 1 | `__tests__/schemas/trust-channel-model.test.ts` — Model derivation: TrustChannelModel computed fields, JsonFromString for capabilities, FieldOption for optional NATS subject | S20.4.2 |
| ⏳ | SC-29.1.3 | 1 | DDL migration test: verify iiot.trust_channels table exists, UNIQUE constraint on (initiator, responder), state CHECK, FK to organizations | S20.4.2 |
| ⏳ | SC-29.1.4 | 2 | `__tests__/repos/trust-channel-repo.test.ts` — Repo integration: create -> findByOrgPair -> updateState -> findActiveByOrg -> findByState. Bilateral composite queries. | S20.4 |
| ⏳ | SC-29.1.5 | 2 | `__tests__/machines/trust-channel-machine.test.ts` — Every valid transition (6 states, 7 transitions). Invalid transitions (e.g., DISCOVERY -> ACTIVE rejected). Guard conditions (bilateral acceptance required for INQUIRY->ESTABLISHED). | S20.4.2 |
| ⏳ | SC-29.1.6 | 2 | `__tests__/integration/trust-channel-handler.test.ts` — ES handler: Discover -> Inquire (CrossOrgAuthToken sent) -> Establish (NATS export/import created) -> Activate -> Suspend -> Terminate (exports torn down). Event verification per step. | S20.4.2 |
| ⏳ | SC-29.1.7 | 2 | `__tests__/integration/trust-channel-entity.test.ts` — Entity.make integration: cluster entity lifecycle, channelId as composite entity ID, RPC routing, shard assignment | S20.4 |
| ⏳ | SC-29.1.8 | 1 | Observer emission test: trigger TrustChannel Machine state transition, verify `Machine.changes` -> `Stream.zipWithPrevious` -> EntityStateChanged event on `iiot:entity-changes` channel. Verify "initialized" action for first emission. Use `it()` + `Effect.runPromise`. | S20.4.2 |

**Dependencies**: SC-17 through SC-19 (model/DDL/repo), SC-24 through SC-27 (machine/handler/entity/observer)
**Test Convention**: `src/lib/iiot/__tests__/{schemas,repos,machines,integration}/`

---

### Epic SC-30: CRUD Entity Tests (TrustScore, ConsentGrant, ClassificationRecord, IsolationConfig) — 21 SP

Per-layer test suite for all 4 CRUD entities. Pattern: `src/lib/iiot/__tests__/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-30.1.1 | 2 | `__tests__/schemas/trust-score.test.ts` — Schema roundtrip: TrustScore, [0.0-1.0] range validation, 4 component scores, publishable flag, branded OrgId | S20.5.6 |
| ⏳ | SC-30.1.2 | 1 | `__tests__/schemas/trust-score-model.test.ts` — Model derivation: TrustScoreModel, CreatedAt transform, NUMERIC precision | S20.5.6 |
| ⏳ | SC-30.1.3 | 2 | `__tests__/repos/trust-score-repo.test.ts` — Repo integration: create -> findLatestByOrgId -> findHistory(since) -> findPublishable. TimeSeries query patterns. | S20.5 |
| ⏳ | SC-30.1.4 | 2 | `__tests__/integration/trust-score-service.test.ts` — L2 service: compute trust score from mock signals, verify weighted formula, k-anonymity enforcement (reject publish <10 transactions), score properties ([0-1], max 0.05 drop) | S20.5.1-S20.5.4 |
| ⏳ | SC-30.2.1 | 2 | `__tests__/schemas/consent-grant.test.ts` — Schema roundtrip: ConsentGrant, ConsentRevocation, scope validation, branded ConsentGrantId | S20.9.2 |
| ⏳ | SC-30.2.2 | 1 | `__tests__/schemas/consent-grant-model.test.ts` — Model derivation: ConsentGrantModel, JsonFromString for scope, FieldOption for revokedAt/expiresAt | S20.9.2 |
| ⏳ | SC-30.2.3 | 2 | `__tests__/repos/consent-grant-repo.test.ts` — Repo integration: create -> findActiveByPair -> revoke -> findByGrantorOrg. Bilateral composite queries. | S20.9 |
| ⏳ | SC-30.2.4 | 2 | `__tests__/integration/consent-service.test.ts` — L2 service: grant consent -> verify NATS export created -> revoke -> verify export removed within 60s SLO -> expire -> verify cleanup | S20.9.1 |
| ⏳ | SC-30.3.1 | 1 | `__tests__/schemas/classification-record.test.ts` — Schema roundtrip: ClassificationRecord, C-0..C-5 validation, ClassificationAttestation signature field | S20.10 |
| ⏳ | SC-30.3.2 | 2 | `__tests__/repos/classification-repo.test.ts` — Repo integration: create -> findByResource -> findExpired -> invalidate. Time-bounded queries. | S20.10 |
| ⏳ | SC-30.3.3 | 2 | `__tests__/integration/classification-service.test.ts` — L2 service: classify resource -> verify enforcement rules applied -> reclassify (upgrade C-3 to C-4) -> verify retention/export rules change | S20.10.2 |
| ⏳ | SC-30.4.1 | 1 | `__tests__/schemas/isolation-config.test.ts` — Schema roundtrip: IsolationConfig, RegulatoryProfile validation, 5-layer config structure | S21.14 |
| ⏳ | SC-30.4.2 | 1 | `__tests__/repos/isolation-config-repo.test.ts` — Repo integration: create -> findByOrgId -> updateProfile -> findByProfile | S21.14 |

**Dependencies**: SC-17 through SC-20 (model/DDL/repo/errors)
**Test Convention**: `src/lib/iiot/__tests__/{schemas,repos,integration}/`

---

### Epic SC-31: Security RPC + HTTP + Streaming Tests — 13 SP

End-to-end tests for RPC, HTTP, and streaming layers. Pattern: `src/lib/iiot/http/__tests__/`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-31.1.1 | 2 | `rpc/auth-rpcs.test.ts` — RPC roundtrip: ValidateSession, IssueDeviceJwt, IssueHumanJwt, RevokeJwt. Verify schema encode/decode, error responses for invalid tokens. | S19.4 |
| ⏳ | SC-31.1.2 | 2 | `rpc/org-identity-rpcs.test.ts` — RPC roundtrip: RegisterOrg, VerifyOrg, ActivateOrg, SuspendOrg, GetOrgIdentity. Entity proxy routing verification. | S20.3 |
| ⏳ | SC-31.1.3 | 2 | `rpc/trust-rpcs.test.ts` — RPC roundtrip: GetTrustScore, GetTrustHistory, ComputeTrustScore, FreezeScore. Consent RPCs: GrantConsent, RevokeConsent, ListActiveConsents. | S20.4-S20.9 |
| ⏳ | SC-31.1.4 | 2 | `rpc/isolation-rpcs.test.ts` — RPC roundtrip: GetIsolationConfig, UpdateProfile, RunIsolationTest. Classification RPCs: ClassifyResource, GetClassification. | S21, S20.10 |
| ⏳ | SC-31.2.1 | 2 | `http/security-api.test.ts` — HTTP endpoint tests: POST /api/security/auth/*, trust/*, consent/*, isolation/*, classification/*. Verify auth middleware integration, rate limiting, error responses. | S19-S21 |
| ⏳ | SC-31.2.2 | 3 | `streaming/security-realtime.test.ts` — Streaming RPC tests: SubscribeTrustScoreUpdates (trigger score computation, verify event delivery), SubscribeConsentChanges (grant+revoke, verify event pair), SubscribeIsolationViolations (simulate cross-account access, verify alert). Use `it()` + `Effect.runPromise` for PubSub tests. | S20.5, S20.9, S21.11 |

**Dependencies**: SC-21 through SC-23 (RPC/HTTP/streaming), SC-26 (entities for proxy routing)
**Test Convention**: `src/lib/iiot/http/__tests__/`, `src/lib/iiot/rpc/__tests__/`

---

### Epic SC-32: Security Error Schema Tests — 3 SP

Test every error variant for exhaustive error handling. Pattern: `src/lib/iiot/errors/__tests__/errors.test.ts`.

| Status | Task | SP | Description | RFC Ref |
|--------|------|----|-------------|---------|
| ⏳ | SC-32.1.1 | 1 | `errors/auth-errors.test.ts` — Verify each AuthError variant: AuthenticationFailedError, InvalidJwtError, JwtExpiredError, JwtRevokedError, InsufficientRoleError, CrossOrgTokenInvalidError, SpiffeValidationError. Test `_tag` discrimination, Data.TaggedError instanceof checks. | S19.4-S19.5 |
| ⏳ | SC-32.1.2 | 1 | `errors/trust-errors.test.ts` — Verify each TrustError variant: OrgNotFoundError, InvalidOrgTransitionError, TrustScoreComputationError, KAnonymityViolationError. ConsentError variants: ConsentNotFoundError, ConsentAlreadyRevokedError, RevocationTimeoutError. | S20 |
| ⏳ | SC-32.1.3 | 1 | `errors/isolation-errors.test.ts` — Verify each IsolationError variant: IsolationViolationError, ProfileMismatchError, ITARExportViolationError, CrossAccountAccessError. Effect.catchTags exhaustive matching test. | S21 |

**Dependencies**: SC-20 (error schemas)
**Pattern Reference**: `src/lib/iiot/errors/__tests__/errors.test.ts`

---

## E2E Stack Coverage Matrix

### Machine-Backed Entities: OrganizationIdentity, TrustChannel

| Layer | Epic | SP | Tests | Status |
|-------|------|----|-------|--------|
| 1. Schema | SC-04.1.1, SC-05.1.2 (embedded) | — | SC-28.1.1, SC-29.1.1 | Covered |
| 2. Model Derivation | **SC-17** (SC-17.1.1, SC-17.1.2) | 5 | SC-28.1.2, SC-29.1.2 | Covered |
| 3. DDL | **SC-18** (SC-18.1.1, SC-18.1.2) | 6 | SC-28.1.3, SC-29.1.3 | Covered |
| 4. Repository | **SC-19** (SC-19.1.1, SC-19.1.2) | 6 | SC-28.1.4, SC-29.1.4 | Covered |
| 5. Error Schemas | **SC-20** (SC-20.1.2 trust) | 2 | SC-32.1.2 | Covered |
| 6. L1/L2 Services | SC-04, SC-05 (embedded) | — | SC-28.1.6, SC-29.1.6 | Covered |
| 7. Machine | **SC-24** (SC-24.1.1-SC-24.1.4) | 12 | SC-28.1.5, SC-29.1.5 | Covered |
| 8. ES Handler | **SC-25** (SC-25.1.1-SC-25.1.2) | 8 | SC-28.1.6, SC-29.1.6 | Covered |
| 9. Entity | **SC-26** (SC-26.1.1-SC-26.1.2) | 8 | SC-28.1.7, SC-29.1.7 | Covered |
| 10. Observer | **SC-27** (SC-27.1.1-SC-27.1.2) | 6 | SC-28.1.8, SC-29.1.8 | Covered |
| 11. RPC Groups | **SC-21** (SC-21.1.2, SC-21.1.3) | 6 | SC-31.1.2, SC-31.1.3 | Covered |
| 12. HTTP Endpoints | **SC-22** | — | SC-31.2.1 | Covered |
| Streaming RPCs | **SC-23** | — | SC-31.2.2 | Covered |

### CRUD Entities: TrustScore, ConsentGrant, ClassificationRecord, IsolationConfig

| Layer | Epic | SP | Tests | Status |
|-------|------|----|-------|--------|
| 1. Schema | SC-05, SC-07, SC-08 (embedded) | — | SC-30.1.1, SC-30.2.1, SC-30.3.1, SC-30.4.1 | Covered |
| 2. Model Derivation | **SC-17** (SC-17.1.3-SC-17.1.6) | 6 | SC-30.1.2, SC-30.2.2 | Covered |
| 3. DDL | **SC-18** (SC-18.1.3-SC-18.1.6) | 8 | (via repo tests) | Covered |
| 4. Repository | **SC-19** (SC-19.1.3-SC-19.1.6) | 7 | SC-30.1.3, SC-30.2.3, SC-30.3.2, SC-30.4.2 | Covered |
| 5. Error Schemas | **SC-20** (SC-20.1.3-SC-20.1.4) | 3 | SC-32.1.2, SC-32.1.3 | Covered |
| 6. L1/L2 Services | SC-05 through SC-10 (embedded) | — | SC-30.1.4, SC-30.2.4, SC-30.3.3 | Covered |
| 7. RPC Groups | **SC-21** (SC-21.1.3-SC-21.1.6) | 10 | SC-31.1.3, SC-31.1.4 | Covered |
| 8. HTTP Endpoints | **SC-22** | — | SC-31.2.1 | Covered |
| N/A Machine | — | — | — | Not applicable |
| N/A ES Handler | — | — | — | Not applicable |
| N/A Entity | — | — | — | Not applicable |
| N/A Observer | — | — | — | Not applicable |

---

## Summary

### Total Story Points by Phase

| Phase | Epics | SP | Sprints |
|-------|-------|----|---------|
| SC-1: Authentication Infrastructure | SC-01, SC-02, SC-03 | 55 | 1-3 |
| SC-2: Trust & Identity | SC-04, SC-05, SC-06 | 55 | 3-5 |
| SC-3: Data Governance | SC-07, SC-08, SC-09 | 47 | 5-7 |
| SC-4: Tenant Isolation | SC-10, SC-11, SC-12 | 42 | 7-9 |
| SC-5: Failure Recovery & Network Security | SC-13, SC-14, SC-15 | 34 | 9-10 |
| SC-6: Compliance Documentation | SC-16 | 8 | 10 |
| SC-7: E2E Stack Completion | SC-17 through SC-23 (stack layers) + SC-24 through SC-27 (Machine layers) + SC-28 through SC-32 (tests) | 189 | 10-15 |
| **Total** | **32 epics (SC-01 through SC-32)** | **430 SP** | **~15 sprints** |

### Cross-Domain Dependencies

| This Epic | Depends On | Domain Owner |
|-----------|-----------|-------------|
| SC-01 (NATS JWT) | NATS cluster infrastructure | PL (platform-architect) |
| SC-02 (SPIFFE) | @effect/cluster Layer composition | PL (platform-architect) |
| SC-03 (AuthZ) | Cross-org NATS export/import | NW-18 (NATS Multi-Org Topology) |
| SC-04 (Org Identity) | On-chain identity mirror (S20.12 OCI-01-06) — bidirectional sync via SuiBridgeService, 60s SLO for punitive transitions | DP-09 (depin-architect) |
| SC-05 (Trust Scoring) | On-chain reputation SBT (S20.12.6) | DP-09 (depin-architect) |
| SC-05 (Trust Scoring) | MarketplaceSignalEvent signals | NW-21 (Work Order Lifecycle), NW-22 (Trust & Reputation) |
| SC-07 (Data Classification) | Cross-org export infrastructure | NW-18 (NATS Multi-Org Topology) |
| SC-09 (Trust Degradation) | On-chain suspension propagation (OCI-04) — 60s NATS JWT revocation SLO | DP-09 (depin-architect) |
| SC-24 (Machines) | On-chain OrganizationIdentity + TrustChannel mirror sync | DP-09 (depin-architect) |
| SC-10 (Isolation) | NATS multi-tenant provisioning at scale (S21.15.1) | PL (platform-architect) |
| SC-10 (Isolation) | Cross-region isolation (S21.15.2) | IF (infra-architect) |

### Items Flagged for depin-architect (DP)

These blockchain subsections contain security-adjacent content owned by depin-architect:

1. **S19.3.5**: Blockchain threat model (T-BC-1 through T-BC-19) — 19 threat scenarios with 50+ normative requirements (R-BC-*)
2. **S20.12**: On-chain identity (OCI-01 through OCI-17+) — OrganizationIdentity, TrustChannel, ReputationSBT, CapabilityNFT, zkLogin, dual-key architecture
3. **S21.13**: On-chain isolation (ISO-42 through ISO-48) — bilateral guards, classification enforcement, query isolation, temporal privacy, Merkle anchoring
4. **S22.10**: SuiBridgeService (R-BRG-1 through R-BRG-10+) — service definition, event routing, batching strategy, gas management, outbox pattern

### Items for network-architect (NW) Coordination

1. NATS account export/import configuration for cross-org data sharing (S21.4.3, S21.8)
2. Manufacturing-commons system account mediation for cross-org messages (S19.7.6)
3. Marketplace integration with trust scoring (S20.5)
4. Rate limiting at cross-org boundary (S19.7.5)

### Items for platform-architect (PL) Coordination

1. NATS cluster infrastructure for JWT validation and account provisioning (S19.4)
2. @effect/cluster Layer composition for SPIFFE mTLS injection (S19.4.5)
3. Account provisioning at scale for 200K+ orgs (S21.15.1)
4. Key management service (KMS) integration at scale (S21.15.3)

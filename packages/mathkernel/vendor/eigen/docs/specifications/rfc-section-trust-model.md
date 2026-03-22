# RFC-001 Section: Trust Model

```
Section:       Trust Model
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (effect-specialist)
Created:       2026-02-09
Supersedes:    rfc-section-security-trust.md (Sections Z.7, Z.9, Z.11)
Research Base: docs/specifications/research-consistency-models.md (Section 8.11)
               docs/specifications/research-manufacturing-commons.md (Section 3)
               docs/specifications/research-effect-architecture.md (Section 5)
               rfc-section-security-architecture.md (S.4-S.5)
               rfc-section-two-domain-consistency.md (G-9, G-10)
```

> This section specifies the trust model for the TMNL metropolitan manufacturing
> network. In a network of 200,000+ organizations — from Earl's 2-person machine
> shop to aerospace contractors subject to ITAR — trust cannot be assumed. It
> must be established, verified, computed, and revocable. The trust model defines
> how organizations prove identity, earn reputation, share data selectively, and
> maintain sovereignty over their operational intelligence.
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Scope](#t1-scope)
2. [Conventions](#t2-conventions)
3. [Organization Identity Verification](#t3-organization-identity-verification)
4. [Trust Establishment Protocol](#t4-trust-establishment-protocol)
5. [Reputation-Based Trust Scoring](#t5-reputation-based-trust-scoring)
6. [Signal Trustworthiness & Attestation](#t6-signal-trustworthiness--attestation)
7. [Edge Device Trust Boundaries](#t7-edge-device-trust-boundaries)
8. [Cross-Org Data Sharing Model](#t8-cross-org-data-sharing-model)
9. [Consent and Selective Disclosure](#t9-consent-and-selective-disclosure)
10. [Data Classification Framework](#t10-data-classification-framework)
11. [Trust Degradation and Revocation](#t11-trust-degradation-and-revocation)
12. [Codebase Grounding](#t12-codebase-grounding)
13. [References](#t13-references)

---

## T.1 Scope

This section covers:

- Organization identity lifecycle (provisioning through deactivation)
- Trust establishment between unknown organizations
- Reputation computation from anonymized transaction data
- Signal attestation for cross-org events (G-10 implementation)
- Edge device trust boundaries (untrusted clocks, attestation)
- Data sharing categories and consent protocols
- Data classification framework (public, bilateral, private, regulatory)
- Trust degradation, suspension, and revocation procedures

This section does NOT cover:

- NATS account provisioning mechanics (see Security Architecture, S.4)
- Cryptographic algorithms and key management (see Security Architecture, S.6)
- Network-level security boundaries (see Security Architecture, S.7)
- Tenant isolation enforcement (see Tenant Isolation section)

---

## T.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## T.3 Organization Identity Verification

### T.3.1 Identity Provisioning Lifecycle

Every organization in the manufacturing commons MUST pass through a defined
identity lifecycle:

```
UNVERIFIED → PROVISIONED → ACTIVE → [SUSPENDED] → [DEACTIVATED]
```

| State | Meaning | Capabilities |
|-------|---------|-------------|
| `UNVERIFIED` | Registration submitted, identity not yet verified | None — cannot connect |
| `PROVISIONED` | NATS account created, JWT issued, awaiting first connection | Local NATS only |
| `ACTIVE` | Connected, identity verified, participating in network | Full capabilities per tier |
| `SUSPENDED` | Temporarily restricted (trust violation, billing, dispute) | Local-only, no cross-org |
| `DEACTIVATED` | Permanently removed from network | None — JWT revoked |

### T.3.2 Verification Requirements

Organization identity verification MUST include:

1. **Legal entity verification**: The organization MUST provide a verifiable
   business identity (EIN/TIN for US entities, equivalent for international).
   Self-attestation alone is insufficient.
2. **Point of contact**: At least one verified human identity (name, email,
   phone) MUST be associated with the organization's NATS account.
3. **Capability attestation**: Declared manufacturing capabilities (CNC milling,
   welding, inspection, etc.) SHOULD be backed by at least one of:
   - Industry certification (AS9100, ISO 9001, ITAR registration)
   - Customer reference (verifiable transaction with another network org)
   - Physical inspection (for high-value capabilities like titanium machining)
4. **Edge device registration**: Each edge device MUST be associated with the
   organization and issued a unique user JWT.

### T.3.3 Tiered Verification

The verification depth SHOULD scale with the organization's stated tier:

| Tier | Verification Depth | Rationale |
|------|-------------------|-----------|
| T0 | Email + legal entity | Minimal — observer only |
| T1 | Legal entity + single capability | Entry-level participation |
| T2 | Legal entity + certifications + capability proof | Active marketplace |
| T3 | Full verification + ITAR/export control check | Enterprise integration |

### T.3.4 Identity Schema

```typescript
const OrganizationIdentity = Schema.Struct({
  orgId: Schema.String.pipe(Schema.brand('OrgId')),
  legalName: Schema.NonEmptyString,
  jurisdiction: Schema.String,
  taxId: Schema.optional(Schema.String),
  verificationLevel: Schema.Literal('basic', 'standard', 'enterprise'),
  verifiedAt: Schema.DateTimeUtc,
  verifiedBy: Schema.Literal('self-attestation', 'document-review', 'third-party-audit'),
  contacts: Schema.Array(Schema.Struct({
    name: Schema.NonEmptyString,
    email: Schema.String,
    role: Schema.Literal('admin', 'technical', 'billing'),
  })),
  certifications: Schema.Array(Schema.Struct({
    standard: Schema.String,       // 'AS9100', 'ISO 9001', 'ITAR'
    issuedBy: Schema.String,
    validUntil: Schema.DateTimeUtc,
    scope: Schema.optional(Schema.String),
  })),
})
```

---

## T.4 Trust Establishment Protocol

### T.4.1 Zero-Trust Default

All organizations start with zero trust. The network provides:

- **No implicit trust**: Being on the network confers no trust. An organization
  MUST earn trust through verifiable behavior.
- **No transitive trust**: If Org A trusts Org B, and Org B trusts Org C, Org A
  does NOT automatically trust Org C. Trust is bilateral.
- **No inherited trust**: Certifications and reputation are organization-scoped.
  A subsidiary or acquisition starts with fresh trust metrics.

### T.4.2 Trust Establishment Sequence

When two organizations interact for the first time:

```
Step 1: Discovery
  └─ Org A discovers Org B via capability search (marketplace)
  └─ Org B's public profile: capabilities, certifications, trust score

Step 2: Inquiry
  └─ Org A sends CrossOrgAuthToken to manufacturing-commons
  └─ Token type: 'capability-inquiry'
  └─ Token scope: Org B's public capability subjects only
  └─ Org B's account receives the inquiry notification

Step 3: Bilateral Channel Setup
  └─ If Org B accepts:
       Org B creates private NATS export to Org A's account
       Org A creates corresponding import
       Bilateral channel established for work order subjects
  └─ If Org B declines:
       No further communication possible
       Decline event logged (anonymized) for network analytics

Step 4: Transaction
  └─ Work order placed via bilateral channel (Z.11.3)
  └─ Both orgs retain independent event copies
  └─ manufacturing-commons receives aggregate metadata only

Step 5: Settlement
  └─ Work order completed, quality assessed
  └─ Both orgs submit anonymized transaction feedback
  └─ Reputation scores updated (T.5)
```

### T.4.3 Trust Tiers

Organizations accumulate trust through successful interactions:

| Trust Tier | Criteria | Network Privileges |
|-----------|----------|-------------------|
| `NEWCOMER` | 0-2 completed transactions | Basic marketplace visibility |
| `ESTABLISHED` | 3-9 transactions, >80% on-time | Enhanced marketplace ranking |
| `TRUSTED` | 10+ transactions, >90% quality rating | Featured in capability search |
| `PREFERRED` | 50+ transactions, >95% quality, AS9100/ISO cert | Priority marketplace matching |

Trust tiers are informational. They MUST NOT gate event delivery (G-8 requires
unconditional delivery). Consumers MAY use trust tiers to weight marketplace
results and filter capability searches.

---

## T.5 Reputation-Based Trust Scoring

### T.5.1 Trust Score Computation

The platform MUST compute per-organization trust scores from anonymized
transaction data. The trust score is a composite metric:

| Factor | Weight | Measurement | Window |
|--------|--------|-------------|--------|
| **Signal consistency** | 30% | Correlation between declared capacity and actual job completions | Rolling 90 days |
| **Clock accuracy** | 20% | Moving average of |originTimestamp - networkTimestamp| | Rolling 30 days |
| **Uptime reliability** | 25% | Online hours / total hours | Rolling 30 days |
| **Peer validation** | 25% | Weighted feedback from transacting organizations | Rolling 180 days |

### T.5.2 Score Calculation

```
TrustScore(org) =
  0.30 * SignalConsistency(org, 90d) +
  0.20 * ClockAccuracy(org, 30d) +
  0.25 * UptimeReliability(org, 30d) +
  0.25 * PeerValidation(org, 180d)

Where:
  SignalConsistency = completed_jobs / declared_capacity_signals
                      (capped at 1.0, penalized below 0.5)

  ClockAccuracy = 1.0 - min(1.0, avg_drift_ms / 60000)
                  (perfect = 0ms drift, 0.0 = ≥60s systematic drift)

  UptimeReliability = online_seconds / (30 * 24 * 3600)
                      (excludes scheduled maintenance windows)

  PeerValidation = Σ(feedback_score * reviewer_weight) / Σ(reviewer_weight)
                   (reviewer_weight = reviewer's own trust score)
```

### T.5.3 Score Properties

1. **Range**: Trust scores MUST be normalized to [0.0, 1.0].
2. **Default**: New organizations start at 0.5 (neutral).
3. **Inertia**: Scores SHOULD change slowly. A single bad transaction MUST NOT
   drop a score by more than 0.05 per computation cycle.
4. **Recovery**: Suspended organizations that resume normal operation MUST be
   able to recover their trust score within 90 days of consistent good behavior.
5. **Privacy**: Trust scores are published to `manufacturing-commons` as
   `reputation.{orgId}`. The underlying factors (individual transaction
   details) MUST NOT be derivable from the published score.

### T.5.4 K-Anonymity Requirement

Reputation scores MUST NOT be published until the organization has completed at
least 10 transactions with at least 3 distinct counterparties. This prevents:

- Single-transaction manipulation (sock puppet attack)
- Counterparty identification from score changes
- Low-volume statistical inference

### T.5.5 Trust Score Service Architecture

Trust scores are computed by a singleton entity in `@effect/cluster`:

```typescript
const TrustScoreService = Entity.make("TrustScoreComputer", TrustScoreRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "network")

// Singleton: exactly one instance processes all trust computations
// Runs on the cloud tier, not on any org's edge device
```

The singleton pattern ensures:
- Atomic score computation (no split-brain score disagreements)
- Access to all anonymized transaction metadata
- No single org can influence its own score computation

### T.5.6 Trust Score Schema

```typescript
const TrustScore = Schema.Struct({
  orgId: Schema.String.pipe(Schema.brand('OrgId')),
  score: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.0),
    Schema.lessThanOrEqualTo(1.0),
  ),
  tier: Schema.Literal('newcomer', 'established', 'trusted', 'preferred'),
  components: Schema.Struct({
    signalConsistency: Schema.Number,
    clockAccuracy: Schema.Number,
    uptimeReliability: Schema.Number,
    peerValidation: Schema.Number,
  }),
  computedAt: Schema.DateTimeUtc,
  transactionCount: Schema.Number,
  distinctCounterparties: Schema.Number,
  publishable: Schema.Boolean,  // false until k-anonymity threshold met
})

const ReputationUpdated = Schema.TaggedStruct('ReputationUpdated', {
  orgId: Schema.String.pipe(Schema.brand('OrgId')),
  previousScore: Schema.Number,
  newScore: Schema.Number,
  previousTier: Schema.Literal('newcomer', 'established', 'trusted', 'preferred'),
  newTier: Schema.Literal('newcomer', 'established', 'trusted', 'preferred'),
  timestamp: Schema.DateTimeUtc,
})
```

---

## T.6 Signal Trustworthiness & Attestation

### T.6.1 Attestation Envelope

Cross-organization events MUST include attestation metadata (G-10
implementation):

```typescript
const AttestationEnvelope = Schema.Struct({
  // Timing attestation
  originTimestamp: Schema.DateTimeUtc,
  networkTimestamp: Schema.DateTimeUtc,
  clockDrift: Schema.optional(Schema.Number), // ms, computed at hub

  // Source attestation
  orgId: Schema.String,
  entityId: Schema.String,
  sequenceNumber: Schema.Number,

  // Quality attestation
  clockQuality: Schema.optional(
    Schema.Literal('ntp-consumer', 'ntp-enterprise', 'ptp-gps', 'unknown')
  ),
  dataSource: Schema.optional(
    Schema.Literal('sensor-direct', 'manual-entry', 'derived-calculation', 'third-party')
  ),
  certifications: Schema.optional(Schema.Array(Schema.String)),
  softwareVersion: Schema.optional(Schema.String),

  // Signature
  signature: Schema.optional(Schema.String), // Ed25519 signature by org account key
})
```

### T.6.2 Attestation Requirements

1. **REQUIRED fields**: `originTimestamp`, `networkTimestamp`, `orgId`,
   `entityId`, `sequenceNumber`. Every cross-org event MUST include these.
2. **RECOMMENDED fields**: `clockQuality`, `dataSource`. These enable consumers
   to weight signals by quality.
3. **OPTIONAL fields**: `certifications`, `softwareVersion`, `signature`. These
   provide additional provenance for high-stakes transactions.
4. The `signature` field, when present, MUST be an Ed25519 signature of the
   event payload using the organization's account key. Consumers MAY verify
   signatures for high-value events.

### T.6.3 Clock Quality Assessment

Edge device clock quality is assessed continuously:

| Quality Level | Detection | Impact on Trust Score |
|---------------|-----------|----------------------|
| `ptp-gps` | Drift < 1ms from hub | clockAccuracy = 1.0 |
| `ntp-enterprise` | Drift < 100ms from hub | clockAccuracy = 0.95+ |
| `ntp-consumer` | Drift < 1s from hub | clockAccuracy = 0.85+ |
| `unknown` | Drift > 1s or inconsistent | clockAccuracy penalized |

The hub MUST compute `clockDrift` for every cross-org event by comparing
`originTimestamp` with `networkTimestamp` at hub ingestion. This measurement
feeds into the trust score's ClockAccuracy component (T.5.2).

### T.6.4 Suspicious Signal Detection

The manufacturing-commons system SHOULD detect anomalous signals:

1. **Capacity inflation**: Organization declares high capacity but completes
   few jobs. SignalConsistency component drops.
2. **Clock manipulation**: Systematic `originTimestamp` bias (always slightly
   in the future to appear more responsive). Detectable via drift trend
   analysis.
3. **Sybil attack**: Multiple organizations controlled by the same entity,
   providing mutual peer validation. Detectable via transaction graph
   analysis (same billing address, same IP ranges, correlated uptime
   patterns).
4. **Replay attack**: Old cross-org events replayed to inflate activity
   metrics. Prevented by `sequenceNumber` monotonicity check.

Detected anomalies MUST be logged. Sustained anomalies (>7 days) SHOULD
trigger trust score review and potential suspension.

---

## T.7 Edge Device Trust Boundaries

### T.7.1 Untrusted Timestamps (Intra-Org Trusted, Cross-Org Untrusted)

Edge device clocks occupy a dual trust position:

- **Within an organization**: `originTimestamp` is the authoritative event
  time. The edge device is the source of truth for its own sensor data.
  Per-entity sequential ordering (G-1) uses `originTimestamp`.
- **Across organizations**: `originTimestamp` is UNTRUSTED. Cross-org consumers
  SHOULD use `networkTimestamp` (hub-assigned) for ordering. The
  `originTimestamp` is retained for provenance but MUST NOT be used for
  cross-org temporal ordering.

### T.7.2 Timestamp Anomaly Handling

| Anomaly | Detection | Action |
|---------|-----------|--------|
| Future timestamp (>24h ahead) | `originTimestamp - networkTimestamp > 24h` | Flag `SuspiciousTimestamp`, deliver with warning |
| Past timestamp (>24h behind) | `networkTimestamp - originTimestamp > 24h` | Flag `SuspiciousTimestamp`, deliver with warning |
| Clock regression | `originTimestamp[n] < originTimestamp[n-1]` for same entity | Flag `ClockRegression`, deliver with warning |
| Systematic bias | Moving average drift > 5s over 1h window | Flag `SystematicClockBias`, reduce clockAccuracy score |

**Critical property**: Flagged events MUST still be delivered (G-8 requires
unconditional delivery). Flags are advisory for consumers and feed into trust
score computation.

### T.7.3 Device Attestation (Tier-Dependent)

Edge devices MAY support hardware attestation:

| Tier | Attestation | Mechanism |
|------|------------|-----------|
| T0 | None | Browser/mobile — no hardware trust anchor |
| T1 | Software-only | Application-level health check |
| T2 | Optional TPM | TPM 2.0 boot attestation if hardware supports |
| T3 | REQUIRED TPM | TPM 2.0 + signed boot chain + periodic re-attestation |

**T3 device attestation sequence**:
1. On boot: TPM measures software stack, produces signed attestation quote
2. Attestation quote included in NATS connection JWT as custom claim
3. Hub validates attestation quote against known-good reference values
4. Re-attestation every 24 hours (or on software update)
5. Failed attestation: device enters `SUSPENDED` state until remediated

**T1/T2 devices**: The absence of hardware attestation is explicitly acceptable.
The platform MUST NOT require TPM for participation. Earl's $50 edge device
participates without attestation — his trust score may reflect lower
clockAccuracy and reliability, but his data is still delivered.

---

## T.8 Cross-Org Data Sharing Model

### T.8.1 Four Data Categories

Data in the manufacturing commons falls into four categories with distinct
sharing rules:

| Category | Visibility | NATS Mechanism | Redaction |
|----------|-----------|----------------|-----------|
| **Public** | All orgs | Export to `manufacturing-commons` | None (self-declared) |
| **Bilateral** | Two orgs | Private export between accounts | Schema.omit sensitive fields |
| **Private** | Org only | No export | N/A |
| **Regulatory** | Org + regulator | Audit export with access control | Regulator-specific scope |

### T.8.2 Public Data: Capability Declarations

```typescript
const CapabilityDeclaration = Schema.Struct({
  orgId: Schema.String,
  capabilities: Schema.Array(Schema.Struct({
    type: Schema.Literal(
      'cnc-milling', 'cnc-turning', 'welding', 'assembly',
      'inspection', 'heat-treatment', 'surface-finishing',
      'additive-manufacturing', '3d-printing', 'casting',
    ),
    materials: Schema.Array(Schema.String),
    tolerance: Schema.optional(Schema.String),
    certifications: Schema.Array(Schema.String),
    maxPartSize: Schema.optional(Schema.String),
  })),
  capacity: Schema.Struct({
    available: Schema.Boolean,
    leadTimeDays: Schema.optional(Schema.Number),
  }),
  updatedAt: Schema.DateTimeUtc,
})
```

**Requirements**:
1. Published to `commons.capabilities.{orgId}` in the system account.
2. Fully public within the network — any org MAY subscribe.
3. MUST NOT include pricing, utilization rates, or order backlog.
4. Organizations MAY withdraw declarations at any time (empty publication).
5. Stale declarations (no update in 7 days) SHOULD be marked `potentially-stale`
   in capability search results.

### T.8.3 Private Data: Raw Telemetry

Raw sensor readings are the most sensitive operational data:

1. `iiot.readings.*` subjects MUST remain within the organization's NATS account.
2. Raw readings MUST NOT be exported to any account, including
   `manufacturing-commons`.
3. Derived metrics (OEE, utilization) MAY be shared if:
   - Organization explicitly configures the export
   - Metrics are aggregated to at minimum 15-minute windows
   - Real-time readings never cross org boundaries

### T.8.4 Bilateral Data: Work Order Details

When organizations transact:

1. Work order details are visible only to requesting org and executing org.
2. The `manufacturing-commons` account sees aggregate metadata only ("Org A
   placed order with Org B" — no contents).
3. Both parties retain independent copies in their JetStream domains.
4. Bilateral channels use private NATS exports:
   ```
   Account: earl-machine-shop
     Export: workorders.{orderId} → precision-machining-inc (private)
   Account: precision-machining-inc
     Import: earl-machine-shop:workorders.{orderId}
   ```

### T.8.5 Regulatory Data: Audit Trails

For regulated industries:

1. Audit trail data MUST be retained per regulatory requirements (FDA 21 CFR
   Part 11, ISA-18.2, ISO 9001).
2. Regulatory exports SHOULD use dedicated NATS subjects: `audit.{standard}.>`
3. Access MUST be restricted to the organization and authorized auditors.
4. Export to auditors MUST use time-bounded, scope-limited authorization
   tokens (24-hour max TTL, specific stream subjects only).

---

## T.9 Consent and Selective Disclosure

### T.9.1 Consent Protocol

All cross-org data sharing MUST be based on explicit, revocable consent:

```
┌────────────────────────────────────────────────────────────┐
│                     CONSENT PROTOCOL                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. DECLARE: Org specifies what it's willing to share      │
│     └─ Capability declarations (public)                    │
│     └─ Derived metrics (opt-in, aggregated)                │
│     └─ Reputation participation (opt-in)                   │
│                                                            │
│  2. ACCEPT: Org explicitly accepts incoming relationships  │
│     └─ Work order from Org X (bilateral, time-bounded)     │
│     └─ Capability inquiry from Org Y (read-only, scoped)   │
│                                                            │
│  3. REVOKE: Org withdraws consent at any time              │
│     └─ NATS export removed within 60 seconds               │
│     └─ Cached data at consumer side: consumer's problem    │
│     └─ Audit log records revocation event                  │
│                                                            │
│  4. AUDIT: All consent changes are logged                  │
│     └─ ConsentGranted event: who, what, when, scope        │
│     └─ ConsentRevoked event: who, what, when, reason       │
│     └─ ConsentExpired event: automatic TTL expiry          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### T.9.2 Consent Schema

```typescript
const ConsentGrant = Schema.TaggedStruct('ConsentGrant', {
  grantId: Schema.String.pipe(Schema.brand('ConsentGrantId')),
  grantorOrgId: Schema.String,     // org sharing data
  granteeOrgId: Schema.String,     // org receiving data
  scope: Schema.Struct({
    subjects: Schema.Array(Schema.String),  // NATS subject patterns
    dataCategory: Schema.Literal('public', 'bilateral', 'regulatory'),
    fields: Schema.optional(Schema.Array(Schema.String)),  // if field-level consent
  }),
  grantedAt: Schema.DateTimeUtc,
  expiresAt: Schema.optional(Schema.DateTimeUtc),
  revocable: Schema.Boolean,       // always true for bilateral
  autoRenew: Schema.Boolean,       // if true, extends on expiry
})

const ConsentRevocation = Schema.TaggedStruct('ConsentRevocation', {
  grantId: Schema.String.pipe(Schema.brand('ConsentGrantId')),
  revokedAt: Schema.DateTimeUtc,
  reason: Schema.optional(Schema.Literal(
    'manual', 'dispute', 'contract-end', 'trust-violation', 'regulatory',
  )),
  effectiveWithin: Schema.Number,  // seconds until export removed (max 60)
})
```

### T.9.3 Selective Disclosure via Schema Projection

Organizations control field-level disclosure using Effect Schema projections:

```typescript
// Internal machine status (full detail)
const MachineStatusInternal = Schema.Struct({
  machineId: Schema.String,
  state: Schema.Literal('running', 'idle', 'faulted'),
  operatorId: Schema.String,      // PRIVATE: employee identity
  currentJobId: Schema.String,    // PRIVATE: customer order
  utilization: Schema.Number,     // SHAREABLE: aggregate metric
  cycleTime: Schema.Number,       // SHAREABLE: performance metric
  faultCode: Schema.optional(Schema.String),  // BILATERAL: shared with customer
})

// Public disclosure: capability signals only
const MachineStatusPublic = MachineStatusInternal.pipe(
  Schema.pick('machineId', 'state', 'utilization', 'cycleTime'),
)

// Bilateral disclosure: includes fault info for active customer
const MachineStatusBilateral = MachineStatusInternal.pipe(
  Schema.omit('operatorId'),
)
```

The redaction boundary MUST be applied at the NATS export point (before
publishing to the manufacturing-commons account), not at the subscriber side.

---

## T.10 Data Classification Framework

### T.10.1 Classification Levels

All data within the platform MUST be classified according to the following
levels:

| Level | Label | Description | Examples |
|-------|-------|-------------|----------|
| C-0 | **PUBLIC** | Freely shareable across network | Capability declarations, org profile |
| C-1 | **NETWORK** | Visible to authenticated network members | Trust scores, aggregate metrics |
| C-2 | **BILATERAL** | Shared between two specific orgs | Work order details, quality reports |
| C-3 | **PRIVATE** | Organization internal only | Raw telemetry, employee data, costs |
| C-4 | **REGULATORY** | Subject to regulatory retention and access | FDA audit trails, ISA-18.2 records |
| C-5 | **RESTRICTED** | Export-controlled (ITAR, EAR) | Defense-related manufacturing data |

### T.10.2 Classification Enforcement

| Level | NATS Export | JetStream Retention | Access Control |
|-------|-----------|--------------------|--------------------|
| C-0 | Public export to system account | 90 days | Any authenticated org |
| C-1 | Public export to system account | 90 days | Any authenticated org |
| C-2 | Private export between accounts | Per-contract duration | Two named accounts |
| C-3 | No export | Org-defined | Org account only |
| C-4 | Audit export (time-bounded token) | Regulatory minimum (7 years) | Org + authorized auditor |
| C-5 | No export (air-gapped if required) | Regulatory minimum | Org + cleared personnel |

### T.10.3 Default Classifications

When data classification is not explicitly specified:

1. Sensor readings: C-3 (PRIVATE) by default
2. Entity state events: C-3 (PRIVATE) by default
3. Alarm events: C-4 (REGULATORY) if ISA-18.2 applies, else C-3
4. Work order events: C-2 (BILATERAL) if cross-org, else C-3
5. Capability declarations: C-0 (PUBLIC) by definition
6. Reputation scores: C-1 (NETWORK) by definition

### T.10.4 ITAR-Specific Requirements (C-5)

Organizations subject to ITAR MUST:

1. Run T3-tier infrastructure with air-gapped or government-approved cloud
   hosting (FedRAMP High or equivalent).
2. Disable all cross-org exports except to approved bilateral partners.
3. Use FIPS 140-3 validated cryptographic modules for all data at rest and in
   transit.
4. Maintain separate JetStream domains for ITAR and non-ITAR data.
5. Implement additional access logging per ITAR Part 122.

---

## T.11 Trust Degradation and Revocation

### T.11.1 Degradation Triggers

Trust scores degrade naturally through the weighted computation (T.5.2). In
addition, specific events trigger accelerated degradation:

| Event | Impact | Duration |
|-------|--------|----------|
| Failed work order delivery | -0.03 per incident | Recovers over 90 days |
| Consistent clock drift > 5s | -0.01 per computation cycle | Recovers when drift corrected |
| Extended offline (>48h) | UptimeReliability drops naturally | Recovers proportionally |
| Rate limit violation (sustained) | -0.05 immediate penalty | Recovers after 30 days clean |
| Sybil detection (confirmed) | Score set to 0.0, SUSPENDED | Requires manual review |
| Fraudulent capability declaration | Score set to 0.0, SUSPENDED | Requires manual review |

### T.11.2 Suspension Protocol

When an organization is suspended:

1. NATS account transitions to restricted mode:
   - All cross-org exports disabled
   - Intra-org subjects remain operational (local data continues)
   - manufacturing-commons imports paused
2. Active bilateral channels are frozen (no new messages, existing retained)
3. Trust score is frozen at suspension value
4. Suspension event published to `manufacturing-commons` (orgId, reason, timestamp)
5. Open work orders with suspended org enter escalation state
6. Suspension review initiated within 72 hours

### T.11.3 Revocation (Permanent Removal)

Revocation is the permanent removal of an organization from the network:

1. NATS account JWT placed on revocation list
2. All user JWTs for the account become invalid
3. JetStream data on the organization's edge devices is NOT deleted
   (organization retains its own data per sovereignty principle E-1)
4. Cloud-mirrored JetStream data is retained for regulatory period, then purged
5. Trust score removed from public reputation data
6. Marketplace listings deactivated
7. Revocation event published to manufacturing-commons

### T.11.4 Appeal Process

Suspended organizations MAY appeal through a defined process:

1. Submit appeal with evidence (within 30 days of suspension)
2. Independent review (not the same reviewer who initiated suspension)
3. Decision within 14 days of appeal submission
4. If reinstated: account restrictions lifted, trust score begins recovery
   from the suspension value (not from 0.0)

---

## T.12 Codebase Grounding

File paths are relative to `packages/tmnl/src/`.

### T.12.1 Attestation Envelope Integration Point

**File**: `lib/iiot/realtime/reactivity-bridge.ts`

The ReactivityBridge (lines 91-135) is the handler-level adapter connecting
entity state changes to EventDistribution. This is the integration point where
the `AttestationEnvelope` (T.6.1) would be attached to cross-org events. The
bridge has access to entity context (orgId, entityId, timestamps) needed for
envelope construction.

### T.12.2 Cross-Org Event Transport

**File**: `lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) is the NATS transport layer for all
inter-node communication. Outbound publishes (lines 102-128) use
`NatsPubSubService.publish()`. In the multi-tenant architecture, the
HolonetBridge operates within the org's NATS account. The cross-org data
sharing model (T.8) is enforced by NATS account export/import configuration —
the HolonetBridge simply publishes to org-scoped subjects, and NATS handles
the cross-account routing per Z.3.3.

### T.12.3 Schema Redaction Infrastructure

**Directory**: `lib/iiot/schemas/assets/`

Nine asset schemas (area, device, enterprise, line, machine, plant, sensor,
site, workcell) each use `Schema.Struct` with branded identifiers. These are
the internal representations from which cross-org export schemas (T.9.3)
are derived via `Schema.omit` / `Schema.pick` at the export boundary.

### T.12.4 Trust Score Entity (Planned)

The TrustScoreService (T.5.5) would be implemented as a singleton entity in
`@effect/cluster`, similar to the existing entity patterns in
`lib/iiot/entity/EntityStack.ts` (lines 54-67). The entity would:
- Subscribe to anonymized transaction metadata on `manufacturing-commons`
- Compute trust scores per the formula in T.5.2
- Publish `ReputationUpdated` events to `commons.reputation.{orgId}`
- Store score history in NATS KV bucket `NETWORK_REPUTATION`

### T.12.5 Summary: Trust Concept to File Mapping

| Trust Concept | Implementation File | Status |
|---------------|---------------------|--------|
| Attestation envelope (T.6) | `lib/iiot/realtime/reactivity-bridge.ts` | Bridge ready; envelope not yet deployed |
| Cross-org transport (T.8) | `lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| Schema redaction (T.9.3) | `lib/iiot/schemas/assets/*.ts` | Schema ready; projections not yet deployed |
| Subject isolation (T.8) | `lib/iiot/realtime/iiot-subjects.ts` | Implemented |
| Entity patterns (T.5.5) | `lib/iiot/entity/EntityStack.ts` | Pattern exists; TrustScoreEntity planned |
| NATS KV (T.5.5) | `lib/holonet/nats/kv.ts` | Implemented |

---

## T.13 References

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."
- [EFFECT-CLUSTER] -- Effect Contributors. "@effect/cluster."

### Trust & Identity Standards

- [ZERO-TRUST] -- Rose, S., et al. "Zero Trust Architecture." NIST SP 800-207, 2020.
- [SPIFFE] -- CNCF. "Secure Production Identity Framework for Everyone (SPIFFE)."
- [IDS-SOVEREIGNTY] -- International Data Spaces Association. "Data Sovereignty in IDS."

### Regulatory

- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records; Electronic Signatures.
- [ISA-18.2] -- ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [IEC-62443] -- IEC 62443. Industrial Communication Networks - IT Security.
- [ITAR-PART122] -- U.S. Department of State, ITAR Part 122. Registration and Licensing.

### Companion Sections

- `rfc-section-security-architecture.md` -- Authentication, authorization, cryptography
- `rfc-section-tenant-isolation.md` -- NATS account isolation, FiberRef scoping
- `rfc-section-two-domain-consistency.md` -- G-9 (Data Sovereignty), G-10 (Signal Trust)
- `rfc-section-competitive-analysis.md` -- Industry comparison of trust models

---

*End of RFC-001 Section: Trust Model*

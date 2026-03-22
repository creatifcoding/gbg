# RFC-001 Section: Tenant Isolation

```
Section:       Tenant Isolation
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (interface-visionary)
Created:       2026-02-09
Supersedes:    rfc-section-security-trust.md (Sections Z.3, Z.6, Z.11)
Companion:     rfc-section-security-architecture.md (S.4, S.5, S.7)
               rfc-section-trust-model.md (T.4 attestation, T.8 anti-fraud)
               rfc-section-two-domain-consistency.md (G-9 data sovereignty)
               rfc-section-edge-architecture-v2.md (E-1 edge sovereignty)
Research Base: docs/specifications/research-consistency-models.md (Sections 8.4, 8.11)
               docs/specifications/research-effect-architecture.md (Section 6)
Bibliography:  docs/specifications/bibliography.md
```

> This section specifies the tenant isolation model for the TMNL metropolitan
> manufacturing network. With 200,000+ organizations sharing NATS messaging
> infrastructure, @effect/cluster compute resources, and JetStream persistence,
> isolation is the non-negotiable foundation upon which every other guarantee
> rests. A failure of tenant isolation is not a bug — it is an existential
> threat. Earl's machine shop data MUST be as invisible to the aerospace
> contractor next door as if they were on separate planets.
>
> Isolation operates at five layers: messaging namespace, event persistence,
> compute (entity sharding), data at rest, and cross-organization data
> sharing. Each layer is independently enforceable — a breach at one layer
> MUST NOT compromise isolation at another.
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [Scope](#ti1-scope)
2. [Conventions](#ti2-conventions)
3. [Isolation Architecture Overview](#ti3-isolation-architecture-overview)
4. [NATS Account Isolation](#ti4-nats-account-isolation)
5. [JetStream Domain Isolation](#ti5-jetstream-domain-isolation)
6. [Compute Isolation (@effect/cluster)](#ti6-compute-isolation)
7. [Data at Rest Isolation](#ti7-data-at-rest-isolation)
8. [Cross-Organization Data Sharing](#ti8-cross-organization-data-sharing)
9. [Audit Trail Isolation](#ti9-audit-trail-isolation)
10. [Edge Device Isolation](#ti10-edge-device-isolation)
11. [Isolation Verification](#ti11-isolation-verification)
12. [Regulatory Isolation Profiles](#ti12-regulatory-isolation-profiles)
13. [Codebase Grounding](#ti13-codebase-grounding)
14. [Open Questions](#ti14-open-questions)

---

## TI.1 Scope

This section covers:

- NATS account-based namespace isolation (the primary isolation boundary)
- JetStream domain isolation for event persistence
- @effect/cluster shard isolation for compute resources
- Data-at-rest encryption and key separation
- Controlled cross-organization data sharing model
- Audit trail isolation and immutability guarantees
- Edge device isolation and trust boundaries
- Isolation verification and chaos engineering tests
- Regulatory isolation profiles (ITAR, FDA 21 CFR Part 11, ISO 13485)

This section does NOT cover:

- Authentication mechanisms (see `rfc-section-security-architecture.md`, S.4)
- Authorization models (see `rfc-section-security-architecture.md`, S.5)
- Trust scoring (see `rfc-section-trust-model.md`)
- Network-level security (see `rfc-section-security-architecture.md`, S.7)

---

## TI.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

Requirement identifiers use the prefix **ISO-** (Isolation) to avoid confusion
with ISO standards, which are cited as [ISO-9001], [ISO-13485], etc.

---

## TI.3 Isolation Architecture Overview

### TI.3.1 Five-Layer Isolation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    ISOLATION LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: NATS Account (Messaging Namespace)                    │
│  ├── Each org = one NATS account                                │
│  ├── Subjects fully isolated between accounts                   │
│  └── Cross-account: explicit export/import only                 │
│                                                                 │
│  Layer 2: JetStream Domain (Event Persistence)                  │
│  ├── Each edge = own JetStream domain                           │
│  ├── Cloud persistence = per-account streams                    │
│  └── Mirror between edge and cloud = same account only          │
│                                                                 │
│  Layer 3: @effect/cluster Shard (Compute)                       │
│  ├── Entity shards carry orgId                                  │
│  ├── Entity handlers verify orgId on every request              │
│  └── Cross-org entity access = forbidden by default             │
│                                                                 │
│  Layer 4: Data at Rest (Storage Encryption)                     │
│  ├── Per-org encryption keys                                    │
│  ├── JetStream encryption = per-stream                          │
│  └── Key rotation without service interruption                  │
│                                                                 │
│  Layer 5: Cross-Org Sharing (Controlled Leakage)                │
│  ├── manufacturing-commons system account                       │
│  ├── Explicit export/import configuration                       │
│  └── Schema-level redaction at export boundary                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TI.3.2 Isolation Invariant

**ISO-01**: At no point in the event lifecycle — from edge device publication
through NATS transport, JetStream persistence, entity handler processing,
WebSocket delivery, and cross-org export — SHALL an organization's data be
accessible to another organization unless BOTH of the following conditions
are met:

1. The originating organization has configured an explicit export for the
   specific subject pattern.
2. The receiving organization (or the `manufacturing-commons` system account)
   has configured an explicit import for that subject pattern.

This is the **bilateral consent invariant**. Neither unilateral export nor
unilateral import is sufficient. Both parties must opt in.

---

## TI.4 NATS Account Isolation

### TI.4.1 One Organization, One Account

**ISO-02**: Each organization in the metropolitan manufacturing network MUST
map to exactly one dedicated NATS account [NATS-ACCOUNTS]. This is the
primary isolation boundary.

```
NATS Cluster
  ├── Account: earl-machine-shop
  │     Subject namespace: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  │     ← INVISIBLE to all other accounts
  │
  ├── Account: precision-machining-inc
  │     Subject namespace: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  │     ← Completely separate namespace, no collision
  │
  ├── Account: aero-dynamics-corp
  │     Subject namespace: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  │     ← Fully isolated
  │
  └── Account: manufacturing-commons (system)
        Subject namespace: capabilities.*, reputation.*, marketplace.*
        ← System account for cross-org aggregation
```

**ISO-03**: The NATS server MUST enforce account isolation at the protocol
level. Application code MUST NOT be relied upon for inter-account isolation.
A bug in application code MUST NOT result in cross-account data leakage.

**ISO-04**: The `manufacturing-commons` system account is the ONLY account
that MAY receive data from multiple organizations. It MUST NOT contain raw
sensor data — only aggregated, anonymized, or explicitly exported data.

### TI.4.2 Subject Namespace Within an Account

Within an account, subjects follow the IIoT namespace pattern defined in the
codebase subject specifications:

```
iiot.readings.{deviceId}       -- sensor readings
iiot.alarms.{deviceId}         -- alarm state changes
iiot.equipment.{equipmentId}   -- equipment state transitions
iiot.invalidations.{cacheKey}  -- cache invalidation signals
```

**ISO-05**: Subject names within an account are fully isolated from other
accounts. Two organizations MAY use identical subject names without collision
or confusion. The NATS account boundary is the namespace separator.

**ISO-06**: Wildcards (`*`, `>`) in subscriptions are scoped to the account.
A subscription to `iiot.readings.>` in Account A receives ONLY Account A's
readings. The NATS server guarantees this at the protocol level.

### TI.4.3 Cross-Account Export/Import

Cross-account data sharing uses the NATS export/import mechanism:

```
Account: earl-machine-shop
  Export: capacity.available → manufacturing-commons (public export)
  Export: status.machine.* → manufacturing-commons (public export)
  ← Earl opts in to sharing capacity and machine status

Account: manufacturing-commons (system)
  Import: earl-machine-shop:capacity.available
  Import: precision-machining-inc:capacity.available
  ← Aggregates capacity from participating orgs
```

**ISO-07**: Exports MUST specify the target account. An export to `*`
(any account) is PROHIBITED except for the `manufacturing-commons` system
account.

**ISO-08**: Exports MUST NOT include raw sensor data (`iiot.readings.*`) by
default. Only aggregate, status, or capability subjects SHOULD be exportable.
An organization that explicitly configures raw reading export MUST receive a
warning that this action shares proprietary process data.

**ISO-09**: Export configuration changes MUST be logged with:

- Timestamp
- Operator identity (the account holder who made the change)
- Subject pattern being exported
- Target account
- Authorization reference (why this export was approved)

**ISO-10**: Export revocation MUST take effect within 60 seconds (one G-8
bounded staleness window per `rfc-section-two-domain-consistency.md`).

### TI.4.4 Bilateral Work Order Channels

When two organizations transact directly (work orders), a bilateral private
channel is established:

```
Account: earl-machine-shop
  Export: workorders.{orderId} → precision-machining-inc (private export)

Account: precision-machining-inc
  Import: earl-machine-shop:workorders.{orderId}
```

**ISO-11**: Bilateral exports MUST be:

1. **Scoped**: Limited to the specific work order subject, not a wildcard.
2. **Temporary**: Automatically expire when the work order reaches a terminal
   state (completed, cancelled, rejected).
3. **Bilateral**: Both parties must configure their side independently
   (export and import).
4. **Invisible to third parties**: No other account, including
   `manufacturing-commons`, can see the bilateral channel's content.

**ISO-12**: The `manufacturing-commons` account MUST NOT have access to work
order details. It receives only aggregate metadata: "Org A placed an order
with Org B." This preserves competitive confidentiality.

### TI.4.5 Account Resource Limits

NATS accounts enforce resource isolation through JWT claims:

| Resource | Purpose | Default Limit | Configurable |
|----------|---------|---------------|:------------:|
| `max_connections` | Prevent connection flooding | 100 | Yes |
| `max_payload` | Prevent oversized message attacks | 1 MB | Yes |
| `max_data` | Prevent bandwidth abuse | 10 MB/s | Yes |
| `max_subscriptions` | Prevent subscription sprawl | 10,000 | Yes |
| `max_leaf_nodes` | Limit edge device connections | 10 | Yes |
| `max_exports` | Limit cross-org exposure surface | 50 subjects | Yes |
| `max_imports` | Limit inbound cross-org data | 50 subjects | Yes |

**ISO-13**: Account resource limits MUST be enforced by the NATS server, not
by application code. A malfunctioning or compromised edge device MUST NOT be
able to exhaust cluster resources beyond its account's allocation.

---

## TI.5 JetStream Domain Isolation

### TI.5.1 Per-Edge JetStream Domains

Each edge device runs its own JetStream domain for local event persistence:

```
Earl's $50 edge device:
  JetStream Domain: earl-shop-edge-001
  Streams:
    iiot-readings  (subjects: iiot.readings.>)
    iiot-alarms    (subjects: iiot.alarms.>)
    iiot-equipment (subjects: iiot.equipment.>)
  Storage: Local filesystem (SQLite or file-backed)
  Retention: 7 days or 1 GB, whichever comes first
  ← Persists events locally during offline periods
  ← Mirrors to cloud domain on reconnection
```

**ISO-14**: JetStream domains MUST be scoped to the organization's NATS
account. An edge device in Account A MUST NOT be able to create streams in
Account B's domain.

**ISO-15**: Domain mirroring between edge and cloud MUST:

1. Use TLS-encrypted connections (per
   `rfc-section-security-architecture.md`, S.6.1).
2. Preserve per-subject ordering (G-1) regardless of reconnection timing.
3. Target ONLY the cloud streams within the same organization's account.
4. NEVER mirror to another organization's domain.

### TI.5.2 Cloud JetStream Isolation

In the cloud cluster, each organization's streams are isolated within their
NATS account:

```
Cloud NATS Cluster
  Account: earl-machine-shop
    Stream: iiot-readings (mirror of edge domain)
    Stream: iiot-alarms (mirror of edge domain)
    Stream: iiot-equipment (mirror of edge domain)
    Stream: entity-events (EventLog persistence)
    ← All streams within this account are invisible to other accounts

  Account: precision-machining-inc
    Stream: iiot-readings
    Stream: iiot-alarms
    Stream: iiot-equipment
    Stream: entity-events
    ← Completely separate streams, separate storage
```

**ISO-16**: JetStream stream names MAY be identical across accounts. The
NATS account provides the isolation — `iiot-readings` in Account A and
`iiot-readings` in Account B are entirely separate streams with separate
storage, separate consumers, and separate retention policies.

### TI.5.3 Stream Configuration Isolation

**ISO-17**: Each organization MUST be able to configure stream properties
independently:

| Property | Per-Org Configurable | Default | Regulatory Override |
|----------|:-------------------:|---------|:-------------------:|
| `max_age` | Yes | 90 days | FDA: 7 years minimum |
| `max_bytes` | Yes | 10 GB | N/A |
| `max_msgs` | Yes | 10M | N/A |
| `deny_delete` | Yes | false | FDA: MUST be true |
| `deny_purge` | Yes | false | FDA: MUST be true |
| `replicas` | Yes | 1 (edge), 3 (cloud) | ITAR: 3 minimum |
| `placement` | Yes | auto | ITAR: US-only |

**ISO-18**: Regulatory organizations (FDA, ITAR) MUST have stream properties
enforced by policy. The account provisioning service MUST apply the
organization's regulatory profile (TI.12) during stream creation. An
organization subject to FDA 21 CFR Part 11 MUST NOT be able to set
`deny_delete: false` on entity event streams.

---

## TI.6 Compute Isolation (@effect/cluster)

### TI.6.1 Entity Shard Isolation

`@effect/cluster` [EFFECT-CLUSTER] distributes entities across runner nodes
using consistent hashing. Each entity carries an `orgId` as part of its
identity.

**ISO-19**: Entity handlers MUST verify that
`request.authContext.orgId === entity.orgId` before processing any state
mutation. This check is the compute-layer isolation boundary.

**ISO-20**: The orgId verification MUST be enforced in the entity handler
layer (`EntityStack.ts`), not in individual handlers. This ensures uniform
enforcement across all 12 entity types (Alarm, WorkOrder, EquipmentState,
Enterprise, Site, Area, Plant, Line, WorkCell, MachineAsset, Device,
SensorAsset).

### TI.6.2 Shard Colocation

**ISO-21**: Entities from different organizations MAY be colocated on the
same runner node (shared infrastructure model). The isolation boundary is
the entity handler's orgId check (ISO-19), not physical node separation.

**ISO-22**: For organizations requiring physical compute isolation (ITAR
classification per TI.12.2), the shard allocator MUST support dedicated
runner node pools:

```
Runner Pool: default
  ├── Runner-1: earl-machine-shop entities, precision-machining-inc entities
  ├── Runner-2: small-shop-xyz entities, local-fabricators entities
  └── Runner-3: mixed org entities (standard isolation)

Runner Pool: itar-classified
  ├── Runner-4: aero-dynamics-corp entities ONLY
  └── Runner-5: defense-mfg-inc entities ONLY
  ← No co-tenancy with non-ITAR organizations
```

### TI.6.3 Entity Event Isolation

**ISO-23**: Entity events produced by `@effect/experimental/EventLog` MUST
be persisted in JetStream streams scoped to the entity's organization
account. An entity event from Org A MUST NOT be written to a stream
accessible by Org B.

**ISO-24**: The EventLog persistence layer MUST derive the target stream
from the entity's orgId, not from the runner node's configuration. This
ensures that entity migration (shard rebalancing) does not change the
stream where events are persisted.

### TI.6.4 Cross-Org Entity Access

**ISO-25**: Direct cross-org entity access is PROHIBITED. An RPC request
from Org A's user to read Org B's entity MUST be rejected at the entity
handler layer (ISO-19). There is no "admin" override for cross-org entity
access.

**ISO-26**: Cross-org interactions occur exclusively through the marketplace
protocol (`rfc-section-marketplace-protocol.md`), which uses NATS
export/import subjects — not direct entity access. The marketplace protocol
creates events in the `manufacturing-commons` system account, which are then
imported by the relevant organizations.

---

## TI.7 Data at Rest Isolation

### TI.7.1 Encryption Key Separation

**ISO-27**: Each organization MUST have dedicated encryption keys for data at
rest. Key material MUST NOT be shared across organizations.

```
Key Management Service
  ├── earl-machine-shop
  │     ├── stream-encryption-key (AES-256-GCM)
  │     └── kv-encryption-key (AES-256-GCM)
  │
  ├── precision-machining-inc
  │     ├── stream-encryption-key (AES-256-GCM)
  │     └── kv-encryption-key (AES-256-GCM)
  │
  └── manufacturing-commons (system)
        ├── stream-encryption-key (AES-256-GCM)
        └── kv-encryption-key (AES-256-GCM)
```

**ISO-28**: NATS JetStream's per-stream encryption SHOULD be used for cloud
persistence. The encryption key for a stream MUST be derived from the
organization's master key, not from a shared platform key.

### TI.7.2 Edge Device Data at Rest

**ISO-29**: Edge device local storage (JetStream file backend) SHOULD be
encrypted at rest. The encryption requirements scale with device capability:

| Device Tier | Encryption Requirement | Key Storage |
|------------|----------------------|-------------|
| Tier 1 ($50) | RECOMMENDED (filesystem encryption if available) | Filesystem |
| Tier 2 ($500) | REQUIRED (OS-level full-disk encryption) | Encrypted keystore |
| Tier 3 ($2K) | REQUIRED (application-level stream encryption) | TPM-backed |
| Tier 4 ($5K+) | REQUIRED (FIPS 140-2 Level 2+ encryption) | HSM |

**ISO-30**: For Tier 1 devices where encryption adds unacceptable
performance overhead, the data-at-rest isolation relies on:

1. Physical isolation (the device is on the organization's premises).
2. OS-level file permissions (0600 on JetStream data directory).
3. Automatic data expiry (stream `max_age` ensures old data is purged).

### TI.7.3 Key Rotation

**ISO-31**: Organization encryption keys MUST be rotatable without service
interruption. Key rotation uses a versioned key scheme:

1. New key version is generated and distributed to all stream replicas.
2. New writes use the new key version.
3. Old data is re-encrypted on background (RECOMMENDED: within 7 days).
4. Old key version is retired after all data has been re-encrypted.

**ISO-32**: Key rotation for one organization MUST NOT affect any other
organization's data access. This is a corollary of ISO-27 (key separation).

---

## TI.8 Cross-Organization Data Sharing

### TI.8.1 Data Classification

All data in the platform falls into one of four sharing categories:

| Category | Visibility | NATS Mechanism | Redaction Required |
|----------|------------|----------------|:------------------:|
| **Private** | Org-only | No export | N/A |
| **Public** | All orgs via commons | Public export to `manufacturing-commons` | No (self-declared) |
| **Bilateral** | Two orgs only | Private export between accounts | Yes |
| **Anonymized** | All orgs via commons | System account publish | Yes (k-anonymity) |

### TI.8.2 Private Data (Default)

**ISO-33**: All data is private by default. Raw sensor readings, entity
state, alarm history, work order details, and operator actions are private
unless explicitly exported.

The following data categories MUST remain private:

| Data Type | Subject Pattern | Exportable |
|-----------|----------------|:----------:|
| Raw sensor readings | `iiot.readings.*` | NEVER |
| Operator actions | `iiot.equipment.*.commands.>` | NEVER |
| Entity event log | `entity-events.>` | NEVER |
| Internal alarm history | `iiot.alarms.*` | NEVER (aggregate only) |

**ISO-34**: The prohibition on raw reading export (ISO-33) is absolute. Even
if an organization attempts to configure an export for `iiot.readings.>`,
the platform provisioning service MUST reject the configuration and log the
attempt.

### TI.8.3 Public Data (Opt-In)

Organizations MAY publish the following to the `manufacturing-commons`
system account:

```typescript
// Capability declaration (public, self-declared)
const CapabilityDeclaration = Schema.Struct({
  orgId: Schema.String,
  capabilities: Schema.Array(Schema.Struct({
    type: Schema.Literal(
      'cnc-milling', 'cnc-turning', 'welding', 'assembly',
      'inspection', 'surface-treatment', 'additive',
    ),
    materials: Schema.Array(Schema.String),
    tolerance: Schema.optional(Schema.String),
    certifications: Schema.Array(Schema.String),
  })),
  updatedAt: Schema.DateTimeUtc,
})
```

**ISO-35**: Public capability declarations MUST NOT include:

1. Pricing information
2. Current utilization percentages
3. Customer identity or order details
4. Any data that could reveal competitive intelligence

Public declarations are discoverable by all network participants.

### TI.8.4 Bilateral Data (Transactional)

When two organizations engage in a transaction, bilateral data sharing is
scoped to the transaction:

**ISO-36**: Bilateral sharing MUST follow this lifecycle:

1. **Initiation**: Org A creates a work order referencing Org B. The
   platform creates a bilateral subject `workorders.{orderId}` with
   private exports between the two accounts.
2. **Active**: Both orgs can publish and subscribe to the bilateral
   subject. Updates flow in both directions.
3. **Completion**: When the work order reaches a terminal state, the
   bilateral export is revoked automatically.
4. **Retention**: Both orgs retain their own copies of the bilateral
   event stream in their respective JetStream domains (per ISO-23).

### TI.8.5 Anonymized Data (Platform-Computed)

The platform publishes anonymized aggregate data:

**ISO-37**: Anonymized data MUST satisfy:

1. **k-anonymity (k=10)**: No aggregate can be computed from fewer than 10
   organizations. A "CNC utilization in Atlanta" metric requires at least
   10 CNC-capable organizations in the Atlanta region before publication.
2. **Temporal aggregation**: Minimum 15-minute windows. No real-time
   per-second anonymized data crosses org boundaries.
3. **Differential privacy** (RECOMMENDED): Add calibrated noise to
   aggregates when the contributing population is small (10-50 orgs).

### TI.8.6 Schema-Level Redaction

When data crosses organizational boundaries, the Effect Schema system
provides compile-time safe field redaction:

```typescript
// Internal schema (full detail, org-private)
const MachineStatus = Schema.Struct({
  machineId: Schema.String,
  state: Schema.Literal('running', 'idle', 'faulted'),
  operatorId: Schema.String,        // SENSITIVE: employee identity
  currentJobId: Schema.String,      // SENSITIVE: customer order info
  utilization: Schema.Number,       // Shareable (aggregate)
  cycleTime: Schema.Number,         // Shareable (aggregate)
})

// Cross-org export schema (redacted)
const MachineStatusPublic = MachineStatus.pipe(
  Schema.omit('operatorId', 'currentJobId'),
)
// Result: { machineId, state, utilization, cycleTime }
```

**ISO-38**: Cross-org event schemas MUST be defined as explicit subsets of
internal schemas using `Schema.omit` or `Schema.pick`.

**ISO-39**: Schema redaction MUST be applied at the export boundary — before
publishing to the `manufacturing-commons` account, not at the subscriber
side. The subscriber never sees the unredacted fields.

**ISO-40**: The redaction boundary MUST be auditable. Logs MUST record which
fields were redacted, for which export, at what time.

---

## TI.9 Audit Trail Isolation

### TI.9.1 Per-Org Audit Immutability

**ISO-41**: Each organization's audit trail (EventLog events in JetStream)
MUST be independently immutable. Immutability is enforced by JetStream
stream configuration:

```
Stream: entity-events (per-org)
  deny_delete: true    -- events cannot be deleted
  deny_purge: true     -- stream cannot be purged
  max_age: 7y          -- retain for regulatory minimum
  sealed: false        -- new events can be appended
```

**ISO-42**: The immutability configuration MUST be set at stream creation
and MUST NOT be modifiable by the organization's account holder after
creation. Only the platform operator (via operator key) can modify stream
security properties, and such modifications MUST be logged.

### TI.9.2 Cross-Org Audit (Bilateral Transactions)

When two organizations transact, audit trails exist in three places:

```
Work Order WO-12345:
  ├── Earl's account: entity-events stream contains
  │   WO-12345 events from Earl's perspective
  │
  ├── Precision Machining's account: entity-events stream
  │   contains WO-12345 events from PM's perspective
  │
  └── manufacturing-commons: marketplace-audit stream
      contains WO-12345 metadata (parties, dates, terminal
      state) but NOT work order details
```

**ISO-43**: Both the requesting org and the executing org MUST retain
independent copies of bilateral transaction events in their respective
JetStream domains. These copies are authoritative for each party.

**ISO-44**: The `manufacturing-commons` audit MUST contain ONLY transaction
metadata (parties involved, timestamps, terminal state). It MUST NOT
contain work order specifications, pricing, or any business-sensitive
details.

**ISO-45**: Discrepancies between the two party copies SHOULD be detectable
via hash comparison of event sequences. The platform MAY provide a
reconciliation service that compares hashes without revealing event content.

### TI.9.3 FDA 21 CFR Part 11 Audit Isolation

For organizations subject to FDA 21 CFR Part 11 [FDA-CFR11]:

**ISO-46**: Electronic signature events (`OperatorLogin`, `OperatorLogout`,
`ParameterOverride`, `ManualAcknowledgment`, `ShiftHandoff`) MUST carry
operator identity and authentication method. These events are part of the
org's private audit trail and MUST NOT be shared cross-org.

**ISO-47**: Batch record events (`BatchStarted`, `ParameterRecorded`,
`BatchCompleted`, `BatchDeviation`) MUST include an `electronicSignature`
field and an `auditTrailId` correlation identifier. The complete batch
record MUST be reconstructible from the org's entity-events stream.

### TI.9.4 ISA-18.2 Alarm Audit Isolation

For alarm events subject to ISA-18.2 [ISA-18.2]:

**ISO-48**: The complete alarm lifecycle (triggered -> acknowledged ->
cleared) MUST be recorded as an ordered sequence within the org's
account. Alarm ordering MUST be provably correct (G-1 enforcement via
JetStream per-subject ordering).

**ISO-49**: Alarm audit records MUST NOT cross org boundaries. An
organization's alarm history is proprietary operational data. The
`manufacturing-commons` account MAY receive anonymized alarm rate
metrics (e.g., "average alarms per day for CNC machines in this region")
but MUST NOT receive individual alarm events.

---

## TI.10 Edge Device Isolation

### TI.10.1 Device-Level Subject Isolation

**ISO-50**: Each edge device MUST be restricted to publishing on subjects
that include its device identifier. Device `earl-edge-001` MUST be able to
publish to `iiot.readings.earl-edge-001.>` but MUST NOT be able to publish
to `iiot.readings.earl-edge-002.>`.

This is enforced by the NATS user JWT's `pub.allow` claims (per
`rfc-section-security-architecture.md`, S.4.1.2).

### TI.10.2 Edge-to-Edge Isolation

**ISO-51**: Edge devices within the SAME organization MAY communicate via
shared subjects within the account (e.g., `iiot.readings.>` subscriptions
see all devices). This is intra-org communication and is considered trusted.

**ISO-52**: Edge devices in DIFFERENT organizations MUST NOT have any
communication path. NATS account isolation (TI.4) ensures that Device A
in Org X cannot subscribe to any subject in Org Y's namespace.

### TI.10.3 Compromised Device Containment

**ISO-53**: A compromised edge device MUST be containable:

1. **Immediate**: Revoke the device's user JWT. The NATS cluster terminates
   the connection within 60 seconds.
2. **Scope**: The compromised device can only have published to subjects
   matching its `pub.allow` claims. Damage is limited to the device's own
   subject namespace within its org's account.
3. **Forensic**: All messages published by the device are in the org's
   JetStream streams with timestamps. The audit trail is intact.
4. **Recovery**: Issue a new JWT for a replacement device. The org's NATS
   account, streams, and entity state are unaffected.

---

## TI.11 Isolation Verification

### TI.11.1 Automated Isolation Testing

**ISO-54**: The platform MUST include automated isolation verification tests
that run continuously (RECOMMENDED: hourly):

| Test | Verification | Expected Result |
|------|-------------|-----------------|
| **Cross-account subscribe** | Attempt to subscribe to Org B's subjects from Org A's credentials | Connection rejected or zero messages |
| **Cross-account publish** | Attempt to publish to Org B's subjects from Org A's credentials | Publish rejected |
| **Stream visibility** | List JetStream streams with Org A's credentials | Only Org A's streams visible |
| **Entity access** | Send RPC to Org B's entity with Org A's auth context | Request rejected at handler layer |
| **Export boundary** | Publish raw reading to exported subject | Verify redacted schema at import side |
| **Rate limit** | Exceed Org A's `max_data` | Subsequent publishes rejected, connection maintained |

### TI.11.2 Chaos Engineering for Isolation

**ISO-55**: The platform SHOULD conduct periodic chaos engineering
experiments targeting isolation boundaries:

1. **Configuration mutation**: Temporarily misconfigure an export to include
   raw readings. Verify the provisioning service rejects it (ISO-34).
2. **JWT forgery**: Present a modified JWT claiming Account B's identity.
   Verify the NATS server rejects the invalid signature.
3. **Shard migration**: Migrate entities between runner nodes during active
   traffic. Verify no cross-org data leakage during migration.
4. **Key exposure**: Simulate a leaked device NKey. Verify revocation
   contains the blast radius.

### TI.11.3 Isolation Metrics

**ISO-56**: The platform MUST track the following isolation health metrics:

| Metric | Alert Threshold | Response |
|--------|----------------|----------|
| Cross-account access attempts | > 0 per hour | Investigate immediately |
| Export configuration changes | Any change | Log and notify account holder |
| Device JWT revocations | Trend increase | Review device fleet health |
| Stream configuration mutations | Any change to deny_delete/deny_purge | Escalate to platform security |

---

## TI.12 Regulatory Isolation Profiles

### TI.12.1 Profile Definitions

**ISO-57**: The platform MUST support regulatory isolation profiles that
automatically configure isolation properties based on an organization's
regulatory requirements:

| Profile | Regulations | Additional Isolation Requirements |
|---------|-------------|----------------------------------|
| **Standard** | None specific | Default isolation (TI.4-TI.10) |
| **FDA** | 21 CFR Part 11 | `deny_delete: true`, `deny_purge: true`, 7-year retention, electronic signatures on state changes |
| **Aerospace** | AS9100, NADCAP | Enhanced audit trail, certification-verified trust floor |
| **Defense** | ITAR, EAR | Dedicated runner pool, US-only data residency, no cross-org exports without ITAR officer approval |
| **Medical** | ISO 13485, EU MDR | Traceability to individual device serial numbers, UDI integration |
| **Food** | FSMA, HACCP | Critical control point monitoring, automated deviation alerting |

### TI.12.2 ITAR Isolation (Defense)

**ISO-58**: Organizations with ITAR classification MUST receive enhanced
isolation:

1. **Dedicated NATS cluster**: ITAR organizations MUST be provisioned on
   NATS servers physically located within the United States. No gateway
   routes to international servers.
2. **Dedicated runner pool**: Entity shards for ITAR organizations MUST run
   on dedicated runner nodes (ISO-22) that do not host non-ITAR entities.
3. **Export prohibition**: Cross-org exports MUST be disabled by default.
   Each export requires explicit ITAR officer approval with a documented
   technology assessment.
4. **Audit enhancement**: All access to ITAR organization data (including
   platform operational access for maintenance) MUST be logged with
   individual operator identity.

### TI.12.3 FDA Isolation (Pharmaceutical/Medical)

**ISO-59**: Organizations with FDA 21 CFR Part 11 classification MUST
receive:

1. **Immutable streams**: `deny_delete: true` and `deny_purge: true` on all
   entity event streams (ISO-18).
2. **7-year retention**: `max_age` set to 7 years minimum on entity event
   streams.
3. **Electronic signatures**: All human-initiated state changes MUST include
   operator identity, authentication method, and timestamp
   (`OperatorEvents` schema).
4. **Batch traceability**: Batch events MUST include `auditTrailId` for
   end-to-end batch record reconstruction (ISO-47).

### TI.12.4 Profile Application

**ISO-60**: Regulatory profiles MUST be applied at account provisioning time.
The provisioning service:

1. Accepts the organization's declared regulatory requirements.
2. Validates against known certification registries (where possible).
3. Applies the corresponding profile to all account, stream, and shard
   configurations.
4. Prevents downgrade of regulatory requirements without platform
   operator approval.

---

## TI.13 Codebase Grounding

File paths are relative to `packages/tmnl/`.

### TI.13.1 NATS Account Boundary (TI.4)

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

Four subject specs (lines 39, 61, 83, 105) define the
`iiot.{type}.{entityId}` pattern. Within a NATS account, these subjects
form the namespace that account isolation protects. The `createSubjectSpec`
function produces `resolve()` for concrete subjects and
`wildcardPattern()` for subscriptions — both scoped to the calling
account's namespace.

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) operates within an org's NATS
account. All publishes (lines 102-128) and subscriptions (lines 136-182)
are account-scoped. The bridge is the Layer 1 isolation boundary in code —
it publishes to the org's subjects, not to a global namespace.

### TI.13.2 Entity orgId Verification (TI.6)

**File**: `src/lib/iiot/entity/EntityStack.ts`

`EntityHandlersLayer = Layer.mergeAll(...)` (lines 54-67) composes all 12
entity handlers. This is the enforcement point for ISO-19 (orgId
verification on every request). The handler stack is where a cross-org
entity access attempt would be rejected.

### TI.13.3 EventLog Audit Trail (TI.9)

**File**: `src/lib/iiot/infrastructure/eventlog-layer.ts`

The EventLog layer (lines 46-50) composes:
`IIoTEventLogSchema = EventLog.schema(StructuralEvents, OperationalEvents, AlarmEvents)`.
This wires `@effect/experimental/EventLog` with the EventJournal
persistence service. All entity handlers write through this EventLog,
producing the immutable audit trail that TI.9 requires.

### TI.13.4 Regulatory Event Schemas (TI.9.3, TI.9.4)

**File**: `src/lib/iiot/schemas/events/regulatory/operator-events.ts`

Five FDA 21 CFR Part 11 operator audit events: `OperatorLogin`,
`OperatorLogout`, `ParameterOverride`, `ManualAcknowledgment`,
`ShiftHandoff`. These events carry branded identifiers and authentication
method, satisfying ISO-46.

**File**: `src/lib/iiot/schemas/events/regulatory/quality-events.ts`

Five ISO 9001 quality events: `InspectionCompleted`, `NCROpened`,
`NCRClosed`, `CAPACreated`, `CAPAResolved`. The NCR-CAPA linking pattern
creates an auditable corrective action chain.

**File**: `src/lib/iiot/schemas/events/regulatory/batch-events.ts`

Four FDA 21 CFR Part 11 batch record events: `BatchStarted`,
`ParameterRecorded`, `BatchCompleted`, `BatchDeviation`. Each carries
`electronicSignature` and `auditTrailId` fields, satisfying ISO-47.

### TI.13.5 Schema Redaction Infrastructure (TI.8.6)

**Directory**: `src/lib/iiot/schemas/assets/`

Nine asset schemas use `Schema.Struct` extensively. The `Schema.omit` and
`Schema.pick` transformations used in TI.8.6 are standard Effect Schema
operations. The schemas are the internal representations from which
cross-org export schemas are derived at the export boundary.

**File**: `src/lib/iiot/schemas/identifiers.ts`

Branded identifiers (`EnterpriseId`, `SiteId`, `AreaId`, `PlantId`,
`LineId`, `MachineId`, `SensorId`, `DeviceId` — lines 28-39) provide
type-safe entity references. In a multi-tenant context, these branded
types ensure cross-org event payloads reference entities within the
correct org namespace.

### TI.13.6 Edge Device Ingestion Boundary (TI.10)

**File**: `src/lib/iiot/adapters/sparkplug-adapter.ts`

The Sparkplug B protocol adapter is the first point where edge device data
enters the platform. The adapter receives MQTT-transported Sparkplug B
payloads via `@selfcharters/sparkplug-client`. This is the enforcement
point for TI.10.1 (device-level subject isolation) — the adapter publishes
to subjects that include the device identifier.

### TI.13.7 Event Distribution (TI.4.2 scope)

**File**: `src/lib/iiot/realtime/event-distribution.ts`

EventDistribution manages the 4-channel broadcast system (lines 169-199).
This service operates within the org's local runtime. Cross-org events
would be published from EventDistribution to the HolonetBridge, which
publishes to the org's NATS account. The `manufacturing-commons` system
account imports selected subjects per TI.4.3.

### TI.13.8 Summary: Isolation Concept to File Mapping

| Isolation Concept | Implementation File | Requirement | Status |
|------------------|---------------------|-------------|--------|
| NATS account namespace (TI.4) | `src/lib/iiot/realtime/iiot-subjects.ts` | ISO-02, ISO-05 | Implemented |
| NATS transport boundary (TI.4) | `src/lib/iiot/realtime/holonet-bridge.ts` | ISO-03, ISO-06 | Implemented |
| Entity orgId check (TI.6) | `src/lib/iiot/entity/EntityStack.ts` | ISO-19, ISO-20 | Designed |
| EventLog audit (TI.9) | `src/lib/iiot/infrastructure/eventlog-layer.ts` | ISO-41, ISO-42 | Implemented |
| Operator events (TI.9.3) | `src/lib/iiot/schemas/events/regulatory/operator-events.ts` | ISO-46 | Implemented |
| Quality events (TI.9.3) | `src/lib/iiot/schemas/events/regulatory/quality-events.ts` | ISO-48 | Implemented |
| Batch events (TI.9.3) | `src/lib/iiot/schemas/events/regulatory/batch-events.ts` | ISO-47 | Implemented |
| Schema redaction (TI.8.6) | `src/lib/iiot/schemas/assets/*.ts` | ISO-38, ISO-39 | Schema ready; omit not yet deployed |
| Branded identifiers (TI.8) | `src/lib/iiot/schemas/identifiers.ts` | ISO-38 | Implemented |
| Edge ingestion (TI.10) | `src/lib/iiot/adapters/sparkplug-adapter.ts` | ISO-50 | Implemented |
| Event distribution (TI.4) | `src/lib/iiot/realtime/event-distribution.ts` | ISO-04 | Implemented |

---

## TI.14 Open Questions

### TI.14.1 Account Provisioning at Scale

At 200,000 organizations, the NATS account provisioning system must handle:

- Bulk account creation (onboarding campaigns)
- Automated export/import configuration for marketplace opt-in
- Account deprovisioning (organization leaves the network)

The provisioning service architecture is not yet specified. It should be an
`@effect/cluster` singleton with a queue-based workflow.

### TI.14.2 Cross-Region Isolation

When the platform expands to multiple metropolitan regions, isolation must
extend across region boundaries:

- Can an organization in Atlanta export data to a system account in Chicago?
- How does JetStream domain mirroring work across regions?
- Does ITAR isolation apply per-region or per-cluster?

### TI.14.3 Encryption Key Management at Scale

With 200,000 per-org encryption keys:

- Key management service must be highly available (HSM cluster or cloud KMS).
- Key rotation across 200K organizations requires a background process with
  rate limiting to avoid overwhelming the KMS.
- Key escrow for law enforcement requests (if required by jurisdiction) needs
  careful design to avoid undermining the isolation model.

### TI.14.4 Shared Compute Cost Model

ISO-21 allows entity colocation. This implies shared compute costs. The
billing model for shared vs. dedicated runner pools needs to balance:

- Cost efficiency (shared is cheaper)
- Isolation guarantees (dedicated is stronger)
- Regulatory compliance (some orgs MUST use dedicated)

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement
  Levels."
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records; Electronic
  Signatures.
- [ISA-18.2] -- ANSI/ISA-18.2-2016. Management of Alarm Systems.

### NATS / Infrastructure

- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."
- [JETSTREAM] -- Synadia. "NATS JetStream."

### Security Standards

- [ISO-9001] -- ISO 9001:2015. Quality Management Systems.
- [ISO-13485] -- ISO 13485:2016. Medical Devices — Quality Management.
- [IEC-62443] -- IEC 62443. "Industrial Communication Networks — Network
  and System Security."

### Architecture

- [EFFECT-CLUSTER] -- Effect Contributors. "@effect/cluster -- Distributed
  Entity Management with Sharding."

### Companion Sections

- `rfc-section-security-architecture.md` -- Authentication, authorization,
  cryptographic requirements (S.4-S.7)
- `rfc-section-trust-model.md` -- Trust scoring, attestation, anti-fraud
  (T.4-T.8)
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees
  (G-1 through G-10)
- `rfc-section-edge-architecture-v2.md` -- Edge device deployment and
  sovereignty (E-1)
- `rfc-section-marketplace-protocol.md` -- Cross-org transaction protocol

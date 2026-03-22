# RFC Section: Security, Trust & Tenant Isolation

```
Section:       Security Architecture
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        consistency-theorist (Val)
Created:       2026-02-09
Research Base: docs/specifications/research-consistency-models.md (Sections 8.4, 8.11)
               docs/specifications/research-cluster-patterns.md (Section 5)
```

---

## Z. Security, Trust & Tenant Isolation

### Z.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### Z.2 Threat Model

The metropolitan manufacturing network presents a threat model distinct from
single-enterprise IIoT:

| Threat | Source | Impact | Likelihood |
|--------|--------|--------|------------|
| **Data exfiltration** | Compromised org account | Competitor intelligence, trade secrets | Medium |
| **False capacity injection** | Malicious org | Corrupted marketplace aggregates | Medium |
| **Denial of service** | Compromised edge device | Flooding NATS cluster | Low (rate limits) |
| **Man-in-the-middle** | Network attacker | Intercepted sensor data | Low (TLS) |
| **Unauthorized cross-org access** | Misconfigured export | Data sovereignty violation | Medium |
| **Clock manipulation** | Compromised edge | Ordering corruption within org | Low |
| **Supply chain espionage** | Malicious platform operator | Access to all org data | Critical if unmitigated |

### Z.3 NATS Account-Based Tenant Isolation

Each organization in the network MUST map to a dedicated NATS Account
[NATS-ACCOUNTS]. This is the primary isolation boundary.

#### Z.3.1 Account Provisioning

Organizations are provisioned via operator-signed JWTs [NATS-JWT]:

```
Operator Key (platform root of trust)
  └── Account Key: earl-machine-shop
        └── User Key: earl-edge-001 (CNC machine gateway)
        └── User Key: earl-edge-002 (secondary gateway)
  └── Account Key: precision-machining-inc
        └── User Key: pm-edge-001 (factory server)
        └── User Key: pm-cloud-001 (cloud analytics)
  └── Account Key: manufacturing-commons (system)
        └── User Key: commons-aggregator
        └── User Key: commons-monitor
```

**Requirements**:

1. The operator key MUST be stored in an HSM or vault. It signs account JWTs but
   is never transmitted to edge devices.
2. Account keys MAY be self-managed by the organization (decentralized model) or
   managed by the platform operator (centralized model).
3. User keys (edge device credentials) MUST be revocable via JWT revocation list
   without requiring device physical access.
4. Account JWTs MUST specify resource limits:
   - `max_connections`: Maximum concurrent connections per account
   - `max_payload`: Maximum message payload size (RECOMMENDED: 1MB)
   - `max_data`: Maximum data throughput per account
   - `max_subscriptions`: Maximum subscription count

#### Z.3.2 Subject Namespace Isolation

Within an account, subjects are fully isolated:

```
Account: earl-machine-shop
  Subjects: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  ← These are INVISIBLE to all other accounts by default

Account: precision-machining-inc
  Subjects: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  ← Completely separate namespace, no collision with Earl's subjects
```

**No implicit trust**: Even if two organizations use identical subject names, they
are isolated. A subscription to `iiot.readings.*` in Account A receives ONLY
Account A's readings.

#### Z.3.3 Cross-Account Sharing (G-9 Enforcement)

Cross-account data sharing MUST be explicit, auditable, and revocable:

```
Account: earl-machine-shop
  Export: capacity.available → manufacturing-commons (public export)
  Export: status.machine.* → manufacturing-commons (public export)
  ← Earl opts in to sharing capacity and machine status

Account: manufacturing-commons (system account)
  Import: earl-machine-shop:capacity.available
  Import: precision-machining-inc:capacity.available
  Import: aero-dynamics-corp:capacity.available
  ← Aggregates capacity from all participating orgs
```

**Export rules**:

1. Exports MUST specify the target account (private export) or `*` (public export
   to system account only).
2. Exports MUST NOT include raw sensor data (`iiot.readings.*`) by default. Only
   aggregate or status subjects SHOULD be exportable.
3. Export changes MUST be logged with timestamp, operator identity, and
   authorization reference.
4. Export revocation MUST take effect within 60 seconds (one G-8 staleness window).

#### Z.3.4 JetStream Domain Isolation

Each edge device runs its own JetStream domain [JETSTREAM]:

```
Earl's $50 edge device:
  JetStream Domain: earl-shop-edge-001
  Streams: iiot.readings.>, iiot.alarms.>, iiot.equipment.>
  ← Persists events locally during offline periods
  ← Mirrors to cloud domain on reconnection
```

**Requirements**:

1. JetStream domains MUST be scoped to the organization's account.
2. Domain mirroring between edge and cloud MUST use TLS-encrypted connections.
3. Mirror catchup MUST preserve per-subject ordering (G-1) regardless of
   reconnection timing.
4. Edge devices MUST NOT mirror streams from other organizations' domains.

### Z.4 Decentralized Authentication

#### Z.4.1 JWT-Based Identity

Authentication uses NATS' decentralized JWT model [NATS-DECENTRALIZED]:

1. **No central auth database**: Edge devices authenticate using signed JWTs. The
   NATS server validates the JWT signature chain (user → account → operator)
   without querying a central database.
2. **Offline-capable**: The JWT is self-contained. An edge device with a valid JWT
   can authenticate to any NATS server even if the provisioning service is down.
3. **Revocation**: JWTs can be revoked via a revocation list published to the NATS
   cluster. Revoked JWTs are rejected on next connection attempt.

#### Z.4.2 Edge Device Identity

Edge devices MUST authenticate with credentials that:

1. Are unique per device (not shared across devices within an org).
2. Include the device's role in the subject permissions (e.g., `publish: iiot.readings.{deviceId}` — a device can only publish its own readings).
3. Are rotatable without device physical access (JWT re-signing by account key).
4. Expire with a configurable TTL (RECOMMENDED: 90 days for edge devices, 24 hours
   for cloud services).

### Z.5 Zero Trust Boundaries

The metropolitan network applies Zero Trust principles [ZERO-TRUST] at
organization boundaries:

| Boundary | Trust Level | Verification |
|----------|-------------|-------------|
| **Within an org (edge ↔ edge)** | High — same operator, same account | NATS account credential |
| **Within an org (edge ↔ cloud)** | High — TLS + account credential | Mutual TLS + JWT |
| **Cross-org (account ↔ account)** | Zero — untrusted | Export/import only; no direct message path |
| **Platform ↔ org** | Limited — platform operates infrastructure | Operator key ≠ account key; data access requires explicit grant |

**Zero Trust requirements**:

1. Cross-organization messages MUST transit through the `manufacturing-commons`
   system account, never directly between org accounts.
2. The platform operator MUST NOT have read access to org account data by default.
   Platform monitoring MUST use aggregated metrics, not raw event streams.
3. All inter-node communication (runner ↔ runner, edge ↔ cloud) MUST use TLS 1.3.

### Z.5.1 SPIFFE Service Identity

Within an organization's infrastructure, services (cloud runners, aggregation
workers, API gateways) SHOULD use SPIFFE [SPIFFE] identities for mutual
authentication:

```
SPIFFE ID format:
  spiffe://org-{orgId}.manufacturing-commons/service/{serviceName}

Examples:
  spiffe://org-earl-machine-shop.manufacturing-commons/service/entity-runner
  spiffe://org-earl-machine-shop.manufacturing-commons/service/api-gateway
  spiffe://org-earl-machine-shop.manufacturing-commons/service/analytics-worker
  spiffe://platform.manufacturing-commons/service/commons-aggregator
```

**Requirements**:

1. Each `@effect/cluster` runner node MUST present a SPIFFE identity when
   communicating with other runner nodes within the same org.
2. SPIFFE identities MUST be scoped to the organization's trust domain. A
   service in `org-earl-machine-shop` MUST NOT present an identity in the
   `org-precision-machining-inc` trust domain.
3. The SPIFFE Workload API SHOULD be used for automatic credential rotation.
   Short-lived X.509-SVIDs (RECOMMENDED: 1-hour TTL) eliminate the need for
   manual certificate management.
4. Platform-level services (commons-aggregator, trust-score-computer) MUST use
   the `platform.manufacturing-commons` trust domain, separate from any org
   trust domain.

**Relationship to NATS authentication**: SPIFFE provides service-to-service
identity within an org's cloud infrastructure. NATS JWTs (Z.4) provide
device-to-cluster identity for edge devices. Both operate independently:

| Identity System | Scope | Use Case |
|----------------|-------|----------|
| NATS JWT (Z.4) | Edge device → NATS cluster | Device authentication, subject permissions |
| SPIFFE (Z.5.1) | Service → Service (cloud) | Runner-to-runner mTLS, API gateway auth |
| Operator Key (Z.3.1) | Platform → Account | Account provisioning, JWT signing |

**Codebase integration point**: `@effect/cluster` runner nodes communicate via
the Effect RPC transport. The TLS configuration for runner-to-runner
communication (currently in the Layer composition at
`src/lib/iiot/realtime/layers.ts`) is where SPIFFE X.509-SVIDs would be
provided as the mTLS certificate source.

### Z.6 Data Sovereignty (G-9 Implementation)

G-9 (Data Sovereignty) requires that each organization retains control over its data
even after sharing:

#### Z.6.1 Schema-Level Redaction

When events cross organization boundaries, sensitive fields MUST be redacted or
transformed. The Effect Schema system provides `Schema.omit` and `Schema.pick` for
compile-time safe field selection:

```typescript
// Internal schema (full detail)
const MachineStatus = Schema.Struct({
  machineId: Schema.String,
  state: Schema.Literal('running', 'idle', 'faulted'),
  operatorId: Schema.String,      // ← Sensitive: employee identity
  currentJobId: Schema.String,    // ← Sensitive: customer order info
  utilization: Schema.Number,     // ← Shareable
  cycleTime: Schema.Number,       // ← Shareable (aggregate)
})

// Cross-org export schema (redacted)
const MachineStatusPublic = MachineStatus.pipe(
  Schema.omit('operatorId', 'currentJobId'),
)
// Result: { machineId, state, utilization, cycleTime }
```

**Requirements**:

1. Cross-org event schemas MUST be defined as explicit subsets of internal schemas.
2. Schema transformations MUST be applied at the export boundary (before publishing
   to the `manufacturing-commons` account), not at the subscriber side.
3. The redaction boundary MUST be auditable — logs MUST record which fields were
   redacted for which export.

#### Z.6.2 Data Residency

For organizations subject to data residency requirements:

1. The edge JetStream domain provides data residency by default — data stays on the
   edge device until explicitly mirrored.
2. Cloud mirroring targets SHOULD be configurable per-org (which cloud region to
   mirror to).
3. Cross-org exports to `manufacturing-commons` MUST document the cloud region
   where aggregate data is stored.

### Z.7 Signal Trustworthiness (G-10 Implementation)

G-10 requires attestation metadata on cross-org events and trust score computation.

#### Z.7.1 Attestation Envelope

Cross-organization events SHOULD include attestation metadata:

```typescript
const CrossOrgEventEnvelope = Schema.Struct({
  // Required fields (all cross-org events)
  originTimestamp: Schema.DateTimeUtc,
  networkTimestamp: Schema.DateTimeUtc,
  orgId: Schema.String,
  entityId: Schema.String,
  sequenceNumber: Schema.Number,
  payload: Schema.Unknown,

  // Attestation fields (G-10)
  attestation: Schema.optional(Schema.Struct({
    clockQuality: Schema.optional(
      Schema.Literal('ntp-consumer', 'ntp-enterprise', 'ptp-gps', 'unknown')
    ),
    dataSource: Schema.optional(
      Schema.Literal('sensor-direct', 'manual-entry', 'derived-calculation', 'third-party')
    ),
    certifications: Schema.optional(Schema.Array(Schema.String)),
    softwareVersion: Schema.optional(Schema.String),
  })),
})
```

#### Z.7.2 Trust Score Model

The platform SHOULD compute per-organization trust scores:

| Factor | Weight | Measurement |
|--------|--------|-------------|
| **Signal consistency** | 30% | Correlation between reported capacity and actual job completions |
| **Clock accuracy** | 20% | Moving average of \|originTimestamp - networkTimestamp\| |
| **Uptime reliability** | 25% | Online hours / total hours over rolling 30-day window |
| **Peer validation** | 25% | Weighted feedback from organizations that transacted with this org |

Trust scores are computed by a singleton service in `@effect/cluster`
[EFFECT-CLUSTER]. The singleton publishes updated scores to the
`manufacturing-commons` account as `ReputationUpdated` events.

**Trust score is informational, not enforceable**: Trust scores do NOT gate event
delivery. All events are delivered per G-8 regardless of trust score. Consumers MAY
use trust scores to weight aggregates (G-10 Section 3).

### Z.8 Audit Trail Requirements

#### Z.8.1 FDA 21 CFR Part 11 Compliance

For organizations in regulated industries (pharmaceutical, food, medical devices):

1. **Electronic signatures**: State change events MUST carry operator identity when
   the change was initiated by a human operator [FDA-CFR11].
2. **Audit trail immutability**: Entity event streams in JetStream MUST be configured
   with `deny_delete: true` and `deny_purge: true` to prevent retroactive
   modification.
3. **Timestamp integrity**: Both `originTimestamp` and `networkTimestamp` MUST be
   preserved for all regulatory events. Neither MAY be modified after initial
   recording.

#### Z.8.2 ISA-18.2 Alarm Records

For alarm events subject to ISA-18.2 [ISA-18.2]:

1. The complete alarm lifecycle (triggered → acknowledged → cleared) MUST be
   recorded as an ordered sequence.
2. Alarm sequence ordering MUST be provably correct (G-1 enforcement via JetStream
   per-subject ordering).
3. Alarm records MUST be retained for the period specified by the organization's
   regulatory requirements (configurable stream `max_age`).

#### Z.8.3 Cross-Org Audit

Cross-organization interactions (work order lifecycle, bid/accept chains) MUST be
auditable by both parties:

1. Both the requesting org and the executing org MUST retain their own copies of the
   interaction events in their respective JetStream domains.
2. The `manufacturing-commons` account MUST retain a third copy for network-level
   audit.
3. Discrepancies between copies SHOULD be detectable via hash comparison of event
   sequences.

### Z.9 Edge Device Trust Boundaries

#### Z.9.1 Untrusted Timestamps

Edge device clocks are untrusted for cross-org purposes (per Section X.6 of the
companion document). Additional protections:

1. Events with `originTimestamp` more than 24 hours in the future or past relative
   to `networkTimestamp` SHOULD be flagged as `SuspiciousTimestamp`.
2. Events with monotonically decreasing `originTimestamp` for the same entity
   SHOULD be flagged as `ClockRegression`.
3. Flagged events MUST still be delivered (G-8) but SHOULD carry a warning
   annotation for consumers.

#### Z.9.2 Device Attestation (Future)

For enhanced security, edge devices MAY support device attestation:

1. TPM-based attestation of software integrity
2. Signed boot measurements included in connection JWT
3. Periodic re-attestation during long-lived connections

This is RECOMMENDED for large facilities but NOT REQUIRED for small shops (Earl's
$50 edge device will not have a TPM).

### Z.10 Codebase File Reference

File paths are relative to `packages/tmnl/`.

#### Z.10.1 NATS Transport & Subject Isolation

The NATS subject namespace that forms the per-org isolation boundary (Z.3.2) is
defined by subject specifications in the codebase:

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

Four subject specs (lines 39, 61, 83, 105) define the `iiot.{type}.{entityId}`
pattern. Within a NATS account, these subjects are the namespace that account
isolation protects. Each `createSubjectSpec` produces `resolve()` for concrete
subjects and `wildcardPattern()` for subscriptions.

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) is the NATS transport layer through
which all inter-node and edge-cloud communication flows. Outbound publishes
(lines 102-128) use `NatsPubSubService.publish()` with `Effect.ignoreLogged` for
fire-and-forget semantics. Inbound subscriptions (lines 136-182) use scoped
streams. In the multi-tenant architecture, the HolonetBridge operates within the
org's NATS account, making all its publishes and subscriptions account-scoped.

#### Z.10.2 Schema-Level Redaction (G-9)

The `Schema.omit`/`Schema.pick` pattern described in Z.6.1 is not yet deployed
for cross-org exports, but the schema infrastructure that enables it exists:

**Directory**: `src/lib/iiot/schemas/assets/`

Nine asset schemas (area, device, enterprise, line, machine, plant, sensor,
site, workcell) each use `Schema.Struct` and `Schema.brand` extensively. These
schemas are the internal representations from which cross-org export schemas
would be derived via `Schema.omit` at the export boundary.

**File**: `src/lib/iiot/schemas/identifiers.ts`

Branded identifiers (lines 28-39: `EquipmentLevel` with 9 ISA-95 levels;
`EnterpriseId`, `SiteId`, `AreaId`, `PlantId`, `LineId`, `MachineId`,
`SensorId`, `DeviceId`) provide type-safe entity references. In a multi-tenant
context, these branded types ensure cross-org event payloads reference the
correct entity within the correct org namespace.

#### Z.10.3 ISA-18.2 Alarm Audit Trail (Z.8.2)

**File**: `src/lib/iiot/schemas/alarms.ts`

The `AlarmState` literal type (lines 32-45) encodes the full ISA-18.2 alarm
lifecycle: `unacknowledged`, `acknowledged`, `shelved`, `suppressed`, `cleared`,
`out_of_service`. This Schema-based definition provides compile-time safety and
runtime validation for alarm state transitions.

**File**: `src/lib/iiot/entity/AlarmEntity.ts`

The AlarmEntity (lines 1-20 docblock) implements ISA-18.2 compliant alarm
lifecycle management using `@effect/cluster` Entity + `@effect/experimental`
Machine. The Machine pattern validates state transitions against the ISA-18.2
graph. Events are recorded via EventLog (event sourced per ADR-0012), providing
the immutable audit trail required by Z.8.2.

**File**: `src/lib/iiot/machines/AlarmMachine.ts`

Contains the state machine definition (`makeAlarmMachine`) that enforces valid
ISA-18.2 transitions. Invalid transitions are rejected at the Machine level,
ensuring the alarm lifecycle sequence integrity required by Z.8.2 item 2.

#### Z.10.4 Entity Stack Composition (Z.8.1 Scope)

**File**: `src/lib/iiot/entity/EntityStack.ts`

`EntityHandlersLayer = Layer.mergeAll(...)` (lines 54-67) composes all 12 entity
handlers: Alarm, WorkOrder, EquipmentState, Enterprise, Site, Area, Plant, Line,
WorkCell, MachineAsset, Device, SensorAsset. Each entity handler in this stack
is the boundary where FDA 21 CFR Part 11 audit trail requirements (Z.8.1) would
be enforced — the handler writes to EventLog before any side effect.

#### Z.10.5 Event Distribution & Real-Time Delivery

**File**: `src/lib/iiot/realtime/event-distribution.ts`

EventDistribution manages the 4-channel broadcast system (lines 169-199). In the
multi-tenant architecture, this service operates within the org's local runtime.
Cross-org events would be published from EventDistribution to the HolonetBridge,
which publishes to the org's NATS account. The manufacturing-commons system
account imports selected subjects per Z.3.3.

**File**: `src/lib/iiot/realtime/reactivity-bridge.ts`

The ReactivityBridge (lines 91-135) is the handler-level adapter that connects
entity state changes to EventDistribution. Each entity handler calls the bridge
inline after EventLog writes. This is where the attestation envelope (Z.7.1)
would be attached — the bridge has access to the entity context (orgId, entityId,
timestamps) needed to populate the `CrossOrgEventEnvelope`.

**File**: `src/lib/iiot/realtime/websocket-server.ts`

The WebSocket server at `/ws/iiot` provides the per-session delivery channel.
In the multi-tenant context, WebSocket connections are authenticated per Z.4 and
scoped to the org's NATS account. The `RpcSerialization.layerJson` ensures
browser-compatible serialization.

#### Z.10.6 Summary: Security Concept to File Mapping

| Security Concept | Implementation File | Status |
|-----------------|---------------------|--------|
| NATS subject namespace (Z.3.2) | `src/lib/iiot/realtime/iiot-subjects.ts` | Implemented |
| NATS transport (Z.3, Z.4) | `src/lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| Schema redaction (Z.6.1) | `src/lib/iiot/schemas/assets/*.ts` | Schema ready; omit not yet deployed |
| Branded identifiers (Z.6) | `src/lib/iiot/schemas/identifiers.ts` | Implemented |
| ISA-18.2 alarm lifecycle (Z.8.2) | `src/lib/iiot/schemas/alarms.ts` | Implemented |
| Alarm entity audit trail (Z.8.2) | `src/lib/iiot/entity/AlarmEntity.ts` | Implemented |
| Alarm state machine (Z.8.2) | `src/lib/iiot/machines/AlarmMachine.ts` | Implemented |
| Entity handler stack (Z.8.1) | `src/lib/iiot/entity/EntityStack.ts` | Implemented |
| Event distribution (Z.3.2, Z.5) | `src/lib/iiot/realtime/event-distribution.ts` | Implemented |
| Attestation envelope point (Z.7.1) | `src/lib/iiot/realtime/reactivity-bridge.ts` | Bridge ready; envelope not yet deployed |
| WebSocket delivery (Z.4, Z.5) | `src/lib/iiot/realtime/websocket-server.ts` | Implemented |
| EventLog audit trail (Z.8.1, Z.8.2) | `src/lib/iiot/infrastructure/eventlog-layer.ts` | Implemented |
| Operator audit events (Z.8.1) | `src/lib/iiot/schemas/events/regulatory/operator-events.ts` | Implemented |
| Quality audit events (Z.8.1) | `src/lib/iiot/schemas/events/regulatory/quality-events.ts` | Implemented |
| Batch records (Z.8.1) | `src/lib/iiot/schemas/events/regulatory/batch-events.ts` | Implemented |
| Edge device ingestion (Z.9) | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Implemented |

#### Z.10.7 EventLog & Regulatory Event Schemas (Z.8.1)

**File**: `src/lib/iiot/infrastructure/eventlog-layer.ts`

The EventLog layer (line 46-50) composes the complete audit schema:
`IIoTEventLogSchema = EventLog.schema(StructuralEvents, OperationalEvents, AlarmEvents)`.
This wires `@effect/experimental/EventLog` with the EventJournal (persistence) and
Identity (operator context) services. All entity handlers write through this EventLog,
producing the immutable, append-only audit trail required by Z.8.1. The three event
categories (`StructuralEvents`, `OperationalEvents`, `AlarmEvents`) partition the
audit namespace, enabling selective retention policies per stream.

**File**: `src/lib/iiot/schemas/events/regulatory/operator-events.ts`

Five FDA 21 CFR Part 11 operator audit events: `OperatorLogin`, `OperatorLogout`,
`ParameterOverride`, `ManualAcknowledgment`, `ShiftHandoff`. Each event carries
branded identifiers (`SessionId`, `OverrideId`, `AcknowledgmentId`, `HandoffId`)
and an `AuthMethod` literal (`'badge' | 'password' | 'biometric'`). These events
satisfy Z.8.1 item 1 (electronic signatures carry operator identity) and provide
the traceability chain for manual interventions.

**File**: `src/lib/iiot/schemas/events/regulatory/quality-events.ts`

Five ISO 9001 quality events: `InspectionCompleted`, `NCROpened`, `NCRClosed`,
`CAPACreated`, `CAPAResolved`. The NCR-CAPA linking pattern (an NCR references a
CAPA, a CAPA references the originating NCR) creates an auditable corrective action
chain. These events flow through the same EventLog infrastructure, satisfying both
ISO 9001 traceability requirements and Z.8.1 audit immutability.

**File**: `src/lib/iiot/schemas/events/regulatory/batch-events.ts`

Four FDA 21 CFR Part 11 batch record events: `BatchStarted`, `ParameterRecorded`,
`BatchCompleted`, `BatchDeviation`. Each event carries an `electronicSignature`
field and an `auditTrailId` correlation identifier linking all events within a batch
run. The `BatchDeviation` event captures out-of-spec conditions with deviation reason
and corrective action, satisfying 21 CFR Part 11 §11.10(e) (complete audit trail).

#### Z.10.8 Edge Device Trust Boundary (Z.9)

**File**: `src/lib/iiot/adapters/sparkplug-adapter.ts`

The Sparkplug B protocol adapter provides the ingestion trust boundary for edge
devices. It uses `@selfcharters/sparkplug-client` to receive MQTT-transported
Sparkplug B payloads. The `AliasRegistry` (Map-based, in-memory) resolves metric
name ↔ alias mappings from device BIRTH messages. This adapter is the first point
where edge device data enters the platform — and therefore the enforcement point
for Z.9.1 (untrusted timestamps), Z.9.2 (device attestation), and Z.4.2 (device
identity validation). The `SparkplugAdapterConfig` schema validates adapter
configuration at startup via Effect Schema.

### Z.11 Cross-Org Data Sharing Model

The manufacturing commons requires precise rules governing what data crosses
organizational boundaries. This section specifies the four data sharing categories.

#### Z.11.1 Capability Declarations (PUBLIC)

Organizations MAY publish **capability declarations** to the network:

```typescript
const CapabilityDeclaration = Schema.Struct({
  orgId: Schema.String,
  capabilities: Schema.Array(Schema.Struct({
    type: Schema.Literal('cnc-milling', 'cnc-turning', 'welding', 'assembly', 'inspection'),
    materials: Schema.Array(Schema.String),        // e.g., ['aluminum', 'steel', 'titanium']
    tolerance: Schema.optional(Schema.String),     // e.g., '±0.001 inch'
    certifications: Schema.Array(Schema.String),   // e.g., ['AS9100', 'ISO 9001']
  })),
  updatedAt: Schema.DateTimeUtc,
})
```

**Requirements**:

1. Capability declarations MUST be published to the `manufacturing-commons` system
   account on the subject `capabilities.{orgId}`.
2. Declarations are **fully public** within the network — any participating org
   MAY subscribe to `capabilities.>` to build a local capability index.
3. Capability declarations MUST NOT include pricing, capacity utilization, or any
   data that could reveal competitive intelligence.
4. Organizations MAY withdraw capability declarations at any time by publishing an
   empty declaration (zero capabilities).

#### Z.11.2 Telemetry & Sensor Data (PRIVATE)

Raw telemetry is the most sensitive data category:

1. Raw sensor readings (`iiot.readings.*`) MUST remain within the organization's
   NATS account. They MUST NOT be exported to any other account, including the
   `manufacturing-commons` system account.
2. Derived metrics (OEE, utilization percentages) MAY be shared if the organization
   explicitly configures an export per Z.3.3.
3. Shared metrics MUST be aggregated to at minimum 15-minute windows. Real-time
   readings MUST NOT cross org boundaries.
4. **File grounding**: The 4-channel EventDistribution
   (`src/lib/iiot/realtime/event-distribution.ts`) publishes readings internally.
   The HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`) is the only
   outbound path — the export boundary filter would be applied here.

#### Z.11.3 Work Order Details (BILATERAL)

When organizations transact (one org requests work from another), work order data
is shared bilaterally:

1. Work order details MUST be visible only to the requesting org and the executing
   org. The `manufacturing-commons` system account MUST NOT have access to work
   order contents (only aggregate metadata: "Org A placed an order with Org B").
2. The bilateral sharing channel uses NATS private exports between the two org
   accounts:
   ```
   Account: earl-machine-shop
     Export: workorders.{orderId} → precision-machining-inc (private)
   Account: precision-machining-inc
     Import: earl-machine-shop:workorders.{orderId}
   ```
3. Both parties MUST retain independent copies of work order events in their
   JetStream domains (Z.8.3 dual-copy requirement).
4. **File grounding**: The `WorkOrderEntity` (`src/lib/iiot/entity/WorkOrderEntity.ts`)
   manages the FDA 21 CFR Part 11 compliant work order lifecycle. The bilateral
   export would publish redacted work order state changes through HolonetBridge to
   the partner org's account.

#### Z.11.4 Reputation & Network Intelligence (ANONYMIZED)

Reputation data is derived from anonymized completion metrics:

1. The platform MUST compute reputation scores (Z.7.2) from anonymized data:
   completion rates, on-time delivery percentages, quality ratings.
2. Individual transaction details MUST NOT be derivable from reputation data.
   Reputation scores MUST be computed from at minimum 10 transactions before
   publication (k-anonymity threshold).
3. Reputation data is published to the `manufacturing-commons` account as
   `reputation.{orgId}` and is visible to all network participants.
4. Organizations MAY opt out of reputation publication entirely. Opting out
   SHOULD reduce their discoverability in capability matching but MUST NOT
   prevent them from transacting.

#### Z.11.5 Data Sharing Summary

| Data Category | Visibility | NATS Mechanism | Redaction Required |
|--------------|------------|----------------|-------------------|
| Capability declarations | Public (all orgs) | Public export to `manufacturing-commons` | No (self-declared) |
| Raw telemetry | Private (org only) | No export | N/A |
| Derived metrics | Opt-in (aggregated) | Public export with aggregation filter | Yes (15-min window minimum) |
| Work order details | Bilateral (two orgs) | Private export between accounts | Yes (Schema.omit sensitive fields) |
| Reputation scores | Public (all orgs) | System account publish | Yes (k-anonymity, ≥10 transactions) |

### Z.12 Authorization Model

#### Z.12.1 Per-Org RBAC (Within NATS Account)

Within an organization's NATS account, role-based access control is enforced via
user JWT subject permissions:

| Role | Publish Permissions | Subscribe Permissions |
|------|--------------------|-----------------------|
| **Edge Device** | `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}` | `iiot.commands.{deviceId}` |
| **Operator** | `iiot.commands.*`, `iiot.overrides.*` | `iiot.readings.*`, `iiot.alarms.*`, `iiot.equipment.*` |
| **Supervisor** | `workorders.*`, `iiot.overrides.*` | `iiot.*` (full internal visibility) |
| **Analytics** | (none — read-only) | `iiot.readings.*`, `iiot.equipment.*` |
| **Admin** | `$SYS.>` (system subjects) | `$SYS.>`, `iiot.*` |

**Requirements**:

1. Edge devices MUST be restricted to publishing only their own device's subjects.
   A device credential for `edge-001` MUST NOT be able to publish to
   `iiot.readings.edge-002`.
2. The Operator role MUST be able to issue commands (parameter overrides, manual
   acknowledgments) and MUST have these actions recorded as `OperatorEvents`
   (`src/lib/iiot/schemas/events/regulatory/operator-events.ts`).
3. Role assignments are encoded in the user JWT's `pub.allow` and `sub.allow`
   fields [NATS-JWT].

#### Z.12.2 Cross-Org Authorization (Signed Tokens)

Cross-organization authorization uses signed tokens for transactional interactions:

1. When Org A requests a transaction with Org B (e.g., work order placement), Org A
   MUST present a signed authorization token to the `manufacturing-commons` system
   account.
2. The authorization token MUST include:
   ```typescript
   const CrossOrgAuthToken = Schema.Struct({
     requestingOrgId: Schema.String,
     targetOrgId: Schema.String,
     transactionType: Schema.Literal('work-order', 'capability-inquiry', 'quality-report'),
     scope: Schema.Array(Schema.String),      // Subjects granted access to
     issuedAt: Schema.DateTimeUtc,
     expiresAt: Schema.DateTimeUtc,            // RECOMMENDED: 24-hour max TTL
     signature: Schema.String,                 // Signed by requesting org's account key
   })
   ```
3. The target org MUST validate the token signature against the requesting org's
   public key (available via NATS account resolution).
4. Cross-org tokens MUST be single-use or time-bounded. Long-lived cross-org
   access grants are PROHIBITED.

#### Z.12.3 Rate Limiting

To prevent network abuse and ensure fair resource allocation:

1. Per-org rate limits MUST be enforced at the NATS account level:
   - `max_data`: Maximum bytes per second (RECOMMENDED: 10 MB/s for small orgs,
     100 MB/s for enterprise)
   - `max_payload`: Maximum single message size (RECOMMENDED: 1 MB)
   - `max_subscriptions`: Maximum concurrent subscriptions (RECOMMENDED: 1000)
   - `max_connections`: Maximum concurrent connections (RECOMMENDED: 100)
2. Cross-org rate limits MUST be enforced on the `manufacturing-commons` system
   account's import configuration:
   - Maximum events per org per second on shared subjects (RECOMMENDED: 100/s)
   - Burst allowance for initial connection (RECOMMENDED: 10x sustained rate for
     30 seconds)
3. Rate limit violations MUST be logged with the violating org ID, subject pattern,
   and violation type.
4. Sustained rate limit violations (>10 minutes) SHOULD trigger automated capacity
   reduction for the violating org's account until the org contacts support.

#### Z.12.4 Authorization Flow Summary

```
┌──────────────────────────────────────────────────────────┐
│                     AUTHORIZATION FLOW                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  INTRA-ORG (Z.12.1):                                    │
│  Device → [JWT pub/sub perms] → NATS account subjects   │
│  Operator → [JWT role perms] → commands, overrides       │
│                                                          │
│  CROSS-ORG (Z.12.2):                                    │
│  Org A → [signed token] → manufacturing-commons          │
│  manufacturing-commons → [validate sig] → route to Org B │
│  Org B → [validate + accept/reject] → bilateral channel  │
│                                                          │
│  RATE LIMITING (Z.12.3):                                 │
│  Per-account: NATS account limits (max_data, etc.)       │
│  Cross-org: import config limits on system account        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records; Electronic Signatures.
- [ISA-18.2] — ANSI/ISA-18.2-2016. Management of Alarm Systems.

### NATS / Security

- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-JWT] — Synadia. "In-Depth JWT Guide for NATS."
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [JETSTREAM] — Synadia. "NATS JetStream."

### Security Standards

- [ZERO-TRUST] — Rose, S., Borchert, O., Mitchell, S., and Connelly, S. "Zero Trust Architecture." NIST SP 800-207, 2020.
- [SPIFFE] — CNCF. "Secure Production Identity Framework for Everyone (SPIFFE)."

### Architecture

- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster — Distributed Entity Management with Sharding."
- [IDS-RAM] — International Data Spaces Association. "IDS Reference Architecture Model (IDS-RAM) 4.0."
- [IDS-SOVEREIGNTY] — International Data Spaces Association. "Data Sovereignty in IDS."

### Data Sharing & Privacy

- [DATA-COOP-2023] — Data Cooperative patterns for manufacturing intelligence sharing.
- [OSTROM-COMMONS] — Ostrom, E. "Governing the Commons." Cambridge University Press, 1990.

### Companion Sections

- `rfc-section-two-domain-consistency.md` — Normative ordering guarantees (G-1 through G-8)
- `rfc-section-consistency-guarantees.md` — Implementation mapping for consistency guarantees
- `research-consistency-models.md` Section 8.11 — G-9, G-10, G-12 formal definitions

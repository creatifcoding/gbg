# RFC-001 Section: Network Entity Types

> **Status:** Draft
> **Section:** N (Network Entity Types)
> **Authors:** Val (entity-types-writer)
> **Date:** 2026-02-09
> **Target Audience:** Platform architects, backend engineers, integration developers

---

## N.1 Scope

This section defines the **network-level entity types** that exist beyond the ISA-95 equipment hierarchy. While the Reactive ISA-95 section specifies intra-organizational entities (Enterprise through Sensor), this section specifies entities that operate at the **manufacturing commons** level — constructs that coordinate BETWEEN organizations in a metropolitan-scale network serving 200K+ organizations [TMNL-MFG-COMMONS].

Network entities are the architectural primitives that transform a collection of isolated ISA-95 hierarchies into a federated manufacturing marketplace. They enable cross-organizational discovery, capacity sharing, work order routing, trust computation, and regulatory compliance verification [PARKER-PLATFORM], [OSTROM-COMMONS].

Each network entity type is specified with:

1. Effect Schema definition (runtime-validated, JSON-serializable) [EFFECT-SCHEMA]
2. Lifecycle state machine (Graph.directed validation) [EFFECT-MACHINE]
3. @effect/cluster Entity composition [EFFECT-ENTITY]
4. CRDT strategy for cross-node convergence [CRDT-SHAPIRO]
5. Shard group assignment and partition strategy [EFFECT-CLUSTER]

### N.1.1 Relationship to Other Sections

| Section | Relationship |
|---------|-------------|
| Reactive ISA-95 Hierarchy | Network entities reference intra-org entities by branded ID |
| Two-Domain Consistency | Network entities follow cross-org consistency model (eventual, 30s SLA) |
| Security, Trust & Tenant Isolation | Network entity access controlled by NATS account-scoped JWTs |
| Marketplace Protocol | Marketplace operations compose network entity state |
| Edge-First Architecture | Edge nodes maintain local projections of network entity state |

---

## N.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC2119] and [RFC8174].

### N.2.1 Notation

- **Entity schemas** use Effect Schema notation [EFFECT-SCHEMA] with `Schema.TaggedClass` for entities with methods and `Schema.TaggedStruct` for pure data
- **State machines** are specified as ASCII diagrams with corresponding `Graph.directed` definitions
- **Branded identifiers** follow the pattern `PREFIX-{slug}` with `Schema.brand()`, consistent with existing codebase identifiers (e.g., `ENT-acme-corp`, `SIT-chicago`)
- **CRDT specifications** reference Shapiro et al. taxonomy [CRDT-SHAPIRO]: OR-Set, LWW-Register, G-Counter, PN-Counter

---

## N.3 Entity Classification

### N.3.1 Taxonomy

Entities in the TMNL platform fall into three categories:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ENTITY CLASSIFICATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  INTRA-ORG ENTITIES          NETWORK ENTITIES       HYBRID ENTITIES │
│  (ISA-95 Equipment)          (Manufacturing Commons) (Cross-visible)│
│                                                                     │
│  Enterprise ─────────────── Organization ──────── Capability        │
│  Site                        Capacity              Reputation       │
│  Area                        WorkOrder (Cross-Org)                  │
│  Plant                       Compliance                             │
│  Line                        Marketplace Listing                    │
│  WorkCell                                                           │
│  Machine                                                            │
│  Device                                                             │
│  Sensor                                                             │
│                                                                     │
│  Alarm (ES)                                                         │
│  EquipmentState (ES)                                                │
│  WorkOrder (Intra-Org, ES)                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### N.3.2 Intra-Org Entities

Covered in the Reactive ISA-95 Hierarchy section. These entities are STRICTLY tenant-isolated — no cross-org visibility. Implemented as @effect/cluster entities with Machine-backed handlers and Graph.directed state validation.

**Codebase grounding:**
- Entity definitions: `src/lib/iiot/entity/*.ts` (16 files)
- Schema definitions: `src/lib/iiot/schemas/assets/*/schema.ts` (9 asset schemas)
- State machines: `src/lib/iiot/machines/*.ts` (13 machines)
- State graphs: `src/lib/iiot/machines/graphs/*.ts` (12 directed graphs)
- RPC definitions: `src/lib/iiot/rpc/*.ts` (19 RPC group files)

### N.3.3 Network Entities

Operate at the manufacturing commons level. These entities are visible across organization boundaries, subject to access control policies defined by NATS account-scoped JWTs [NATS-ACCOUNTS], [NATS-DECENTRALIZED].

Network entities MUST:
- Use cross-org consistent identifiers (globally unique, not org-scoped)
- Support eventual consistency with bounded staleness (30 second SLA) [TMNL-CONSISTENCY]
- Implement CRDT-based convergence for multi-region deployment
- Emit events on the `commons.>` NATS subject namespace

### N.3.4 Hybrid Entities

Org-owned but network-visible. The organization controls the authoritative state, but a redacted projection is published to the commons for discovery purposes. Hybrid entities implement the **Redacted Causality** pattern — the network sees WHAT changed but not internal operational details [TMNL-THEORY].

---

## N.4 Organization Entity

### N.4.1 Overview

The Organization entity represents a participant in the manufacturing commons. It maps 1:1 to an ISA-95 Enterprise entity [ISA-95-1] within the org's internal hierarchy, but exposes a network-facing profile with marketplace metadata, tier information, and variable-depth ISA-95 configuration.

### N.4.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/OrganizationEntity.ts

const OrgId = Schema.String.pipe(
  Schema.pattern(/^ORG-[a-zA-Z0-9-]+$/),
  Schema.brand('OrgId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/OrgId',
    description: 'Organization identifier with ORG- prefix',
  })
)
type OrgId = typeof OrgId.Type

const OrgTier = Schema.Literal('free', 'pro', 'enterprise')
type OrgTier = typeof OrgTier.Type

const ISA95Depth = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(9),
  Schema.annotations({
    description: 'ISA-95 hierarchy depth: 1 (solo machinist) to 9 (full enterprise)',
  })
)

const OrgStatus = Schema.Literal(
  'onboarding',
  'active',
  'suspended',
  'deactivated'
)
type OrgStatus = typeof OrgStatus.Type

class Organization extends Schema.TaggedClass<Organization>()(
  'Organization',
  {
    id: OrgId,
    name: Schema.NonEmptyString,
    status: OrgStatus,
    tier: OrgTier,
    isa95Depth: ISA95Depth,

    /** Maps to internal EnterpriseId for bridge operations */
    internalEnterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),

    /** Primary industry classification */
    industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Geographic region for shard assignment */
    region: Schema.NonEmptyString,

    /** NATS account ID for tenant isolation */
    natsAccountId: Schema.NonEmptyString,

    /** Onboarding completion percentage (0-100) */
    onboardingProgress: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(100)
    ),

    /** Timestamp of initial registration */
    registeredAt: Schema.DateTimeUtc,

    /** Timestamp of last activity */
    lastActiveAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Extensible metadata */
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  }
) {
  isOperational(): boolean {
    return this.status === 'active'
  }

  canPublishToCommons(): boolean {
    return this.status === 'active' && this.tier !== 'free'
  }
}
```

**Codebase alignment:** This schema follows the pattern established by `Enterprise` in `src/lib/iiot/schemas/assets/enterprise/schema.ts:96-150`, using `Schema.TaggedClass` with branded identifiers, `Schema.optionalWith` for optional fields, and instance methods for domain logic.

### N.4.3 Variable-Depth ISA-95

Organizations MUST declare their ISA-95 hierarchy depth at registration. This controls which asset entity types are available within their tenant scope:

| Depth | Available Levels | Persona |
|-------|-----------------|---------|
| 1 | Machine + Sensor | Solo machinist, garage shop |
| 2 | Line + Machine + Sensor | Small job shop (5-10 people) |
| 3 | Plant + Line + Machine + Sensor | Single-plant manufacturer |
| 4 | Site + Plant + Line + Machine + Sensor | Multi-building campus |
| 5 | Area + Site + Plant + Line + Machine + Sensor | Regional division |
| 6-9 | Full hierarchy with Enterprise | Multi-site corporation |

The `isa95Depth` field determines:
1. Which entity types are instantiated in @effect/cluster
2. Which state machines are booted (only machines for present levels)
3. Which RPC groups are registered (only RPCs for present entity types)
4. How hierarchy paths are materialized (shorter paths for shallow orgs)

### N.4.4 Lifecycle State Machine

```
                        Register
                           │
                           ▼
                    ┌──────────────┐
                    │  onboarding  │
                    └──────┬───────┘
                           │ CompleteOnboarding
                           ▼
        Suspend     ┌──────────────┐     Deactivate
      ┌────────────│    active     │────────────────┐
      │             └──────┬───────┘                │
      ▼                    │                        ▼
┌──────────────┐           │              ┌──────────────┐
│  suspended   │           │              │ deactivated  │ (terminal)
└──────┬───────┘           │              └──────────────┘
       │ Reinstate         │ Deactivate
       └───────────────────┘
```

**Graph definition** (proposed `src/lib/iiot/machines/graphs/organization-graph.ts`):

```typescript
const organizationStateGraph = Graph.directed<OrgStateNode, OrgTransitionAction>(
  (mutable) => {
    const onboarding = Graph.addNode(mutable, 'onboarding')
    const active     = Graph.addNode(mutable, 'active')
    const suspended  = Graph.addNode(mutable, 'suspended')
    const deactivated = Graph.addNode(mutable, 'deactivated')

    Graph.addEdge(mutable, onboarding, active, 'CompleteOnboarding')
    Graph.addEdge(mutable, active, suspended, 'Suspend')
    Graph.addEdge(mutable, active, deactivated, 'Deactivate')
    Graph.addEdge(mutable, suspended, active, 'Reinstate')
    Graph.addEdge(mutable, suspended, deactivated, 'Deactivate')
  }
)
```

This follows the identical pattern used by `enterpriseStateGraph` in `src/lib/iiot/machines/graphs/enterprise-graph.ts:71-92`.

### N.4.5 Entity Composition

The Organization entity MUST be composed as an @effect/cluster Entity [EFFECT-ENTITY] with Machine-backed handlers, following the architecture pattern established throughout the codebase:

```typescript
// Pattern from src/lib/iiot/entity/EnterpriseEntity.ts:168-175
const OrganizationEntity = Entity.make('Organization', [
  CreateOrganizationRpc,
  GetOrganizationRpc,
  CompleteOnboardingRpc,
  SuspendOrganizationRpc,
  ReinstateOrganizationRpc,
  DeactivateOrganizationRpc,
  UpdateProfileRpc,
])
```

### N.4.6 Network Events

Organization lifecycle transitions MUST emit events on the commons namespace:

| Event | NATS Subject | Consumers |
|-------|-------------|-----------|
| `OrganizationRegistered` | `commons.org.{orgId}.registered` | Directory, Analytics |
| `OrganizationActivated` | `commons.org.{orgId}.activated` | Marketplace, Directory |
| `OrganizationSuspended` | `commons.org.{orgId}.suspended` | Marketplace (delist), Counterparties |
| `OrganizationDeactivated` | `commons.org.{orgId}.deactivated` | All network services |

---

## N.5 Capability Entity

### N.5.1 Overview

The Capability entity declares WHAT an organization can do — materials it processes, manufacturing processes it performs, and certifications it holds. Capabilities are **hybrid entities**: owned by the organization but published to the commons for discovery by potential counterparties [MAAS-FRAMEWORK], [XOMETRY-PLATFORM].

### N.5.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/CapabilityEntity.ts

const CapabilityId = Schema.String.pipe(
  Schema.pattern(/^CAP-[a-zA-Z0-9-]+$/),
  Schema.brand('CapabilityId'),
)
type CapabilityId = typeof CapabilityId.Type

const ProcessType = Schema.Literal(
  'cnc_milling', 'cnc_turning', 'cnc_grinding',
  'injection_molding', 'blow_molding', 'thermoforming',
  'sheet_metal_cutting', 'sheet_metal_bending', 'sheet_metal_welding',
  'casting', 'forging', 'extrusion',
  'additive_fdm', 'additive_sla', 'additive_sls', 'additive_dmls',
  'assembly', 'finishing', 'inspection', 'testing',
  'heat_treatment', 'surface_treatment', 'packaging',
  'other'
)
type ProcessType = typeof ProcessType.Type

const MaterialType = Schema.Literal(
  'aluminum', 'steel', 'stainless_steel', 'titanium', 'copper', 'brass',
  'abs', 'nylon', 'polycarbonate', 'peek', 'pla', 'petg',
  'carbon_fiber', 'fiberglass', 'kevlar',
  'wood', 'ceramic', 'glass',
  'other'
)
type MaterialType = typeof MaterialType.Type

const CertificationType = Schema.Literal(
  'iso_9001', 'iso_14001', 'iso_45001',
  'as9100', 'as9110', 'as9120',
  'iatf_16949',
  'iso_13485',
  'nadcap',
  'itar',
  'fda_21_cfr_part_11', 'fda_21_cfr_part_820',
  'ul_listed',
  'ce_marked',
  'other'
)
type CertificationType = typeof CertificationType.Type

const CapabilityVisibility = Schema.Literal('private', 'published')
type CapabilityVisibility = typeof CapabilityVisibility.Type

class Capability extends Schema.TaggedClass<Capability>()(
  'Capability',
  {
    id: CapabilityId,
    orgId: OrgId,
    visibility: CapabilityVisibility,

    /** Manufacturing processes this org can perform */
    processTypes: Schema.Array(ProcessType),

    /** Materials this org can work with */
    materialTypes: Schema.Array(MaterialType),

    /** Active certifications */
    certifications: Schema.Array(Schema.Struct({
      type: CertificationType,
      issuedBy: Schema.String,
      validUntil: Schema.DateTimeUtc,
      certificateNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
    })),

    /** Tolerance ranges per process (e.g., CNC milling: +/- 0.005mm) */
    tolerances: Schema.Record({ key: Schema.String, value: Schema.String }),

    /** Maximum part dimensions per process */
    maxDimensions: Schema.optionalWith(
      Schema.Struct({
        lengthMm: Schema.Number,
        widthMm: Schema.Number,
        heightMm: Schema.Number,
      }),
      { as: 'Option' }
    ),

    /** Free-text description of specialty capabilities */
    specialtyDescription: Schema.optionalWith(Schema.String, { as: 'Option' }),

    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  }
)
```

### N.5.3 CRDT Strategy: OR-Set for Capability Aggregation

Capabilities across the network are aggregated using an **OR-Set CRDT** [CRDT-SHAPIRO] for the material and process type collections. This ensures:

- **Convergence**: All network nodes eventually agree on the full capability set
- **Conflict-free merges**: Adding a capability on one node never conflicts with additions on another
- **Availability**: Capability queries remain available during network partitions [CAP-BREWER]

```
OR-Set Operations:
  add(processType) → Adds element with unique tag
  remove(processType) → Removes all tags for element
  merge(remote) → Union of all tagged elements

Network Convergence:
  Node A adds 'cnc_milling' ──┐
                               ├── merge → {cnc_milling, additive_sla}
  Node B adds 'additive_sla' ─┘
```

### N.5.4 Searchable Material-Process Matrix

The platform MUST maintain a materialized view indexing capabilities for marketplace search:

```
Search Query: "Who can CNC-mill titanium with AS9100 certification?"

Index Structure:
  processType:cnc_milling → [ORG-001, ORG-042, ORG-187, ...]
  materialType:titanium   → [ORG-042, ORG-187, ORG-301, ...]
  certification:as9100    → [ORG-042, ORG-301, ...]

  Intersection: [ORG-042] → result set
```

This index is maintained as a NATS KV store [NATS-KV] with subject-based partitioning per capability dimension.

### N.5.5 Published vs. Private Capabilities

Implementations MUST enforce visibility control:

| Visibility | Who Can See | NATS Subject |
|------------|------------|--------------|
| `private` | Only the owning organization | `org.{orgId}.capabilities.>` |
| `published` | All active organizations | `commons.capabilities.{capId}` |

When visibility transitions from `private` to `published`, a `CapabilityPublished` event MUST be emitted on the commons namespace. When transitioning back to `private`, a `CapabilityRetracted` event MUST be emitted.

---

## N.6 Capacity Entity

### N.6.1 Overview

The Capacity entity declares AVAILABLE machine-hours, lead times, and pricing tiers for published capabilities. While Capability declares what an organization CAN do, Capacity declares what it can do RIGHT NOW — available time slots, current queue depth, and dynamic pricing [MAAS-PRICING], [SHARED-MFG-2020].

### N.6.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/CapacityEntity.ts

const CapacityId = Schema.String.pipe(
  Schema.pattern(/^CPT-[a-zA-Z0-9-]+$/),
  Schema.brand('CapacityId'),
)
type CapacityId = typeof CapacityId.Type

const PriceTier = Schema.Literal('standard', 'rush', 'premium')
type PriceTier = typeof PriceTier.Type

const CapacityStatus = Schema.Literal(
  'available',
  'limited',
  'reserved',
  'unavailable'
)
type CapacityStatus = typeof CapacityStatus.Type

class Capacity extends Schema.TaggedClass<Capacity>()(
  'Capacity',
  {
    id: CapacityId,
    orgId: OrgId,
    capabilityId: CapabilityId,

    /** Reference to internal machine (bridged via org's ISA-95 hierarchy) */
    machineRef: Schema.optionalWith(Schema.String, { as: 'Option' }),

    status: CapacityStatus,

    /** Available hours in the next scheduling window */
    availableHoursWeekly: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

    /** Current queue depth (number of pending work orders) */
    queueDepth: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

    /** Estimated lead time in business days */
    leadTimeDays: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

    /** Price range per hour (currency-agnostic, marketplace handles conversion) */
    priceRange: Schema.Struct({
      minPerHour: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
      maxPerHour: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
      currency: Schema.String,
      tier: PriceTier,
    }),

    /** Process types this capacity slot covers */
    processTypes: Schema.Array(ProcessType),

    /** Time window for this capacity offer */
    validFrom: Schema.DateTimeUtc,
    validUntil: Schema.DateTimeUtc,

    updatedAt: Schema.DateTimeUtc,
  }
)
```

### N.6.3 Real-Time Capacity Derivation from Equipment State

Capacity entities MUST be updated in response to EquipmentState transitions within the owning organization. This creates a reactive bridge between intra-org state (EquipmentState entity, event-sourced per `src/lib/iiot/entity/EquipmentStateEntity.ts`) and network-visible capacity:

```
Internal Event Flow:
  EquipmentState.running  ──→  Capacity consumed (availableHours decreases)
  EquipmentState.idle     ──→  Capacity available (availableHours increases)
  EquipmentState.faulted  ──→  Capacity unavailable (status → 'unavailable')
  EquipmentState.setup    ──→  Capacity limited (status → 'limited')
```

This bridge follows the **Redacted Causality** pattern [TMNL-THEORY]: the network observes that capacity changed, but does not see the internal equipment state details that caused the change.

### N.6.4 Marketplace Integration

Published capacity listings feed into the marketplace matching engine:

```
Capacity Publishing Flow:

  1. Org updates internal EquipmentState (via Machine-backed entity handler)
  2. ReactivityBridge detects state change
  3. Capacity projection updated in org's local state
  4. If capability is published: CapacityUpdated event → commons.capacity.{cptId}
  5. Marketplace index updated (NATS KV materialized view)
  6. Searching orgs see updated availability in real-time
```

### N.6.5 Capacity Status Transitions

```
                    ┌────────────────────┐
          Reserve   │                    │  Release
      ┌────────────│    available       │────────────┐
      │             │                    │            │
      ▼             └─────────┬──────────┘            │
┌──────────┐                  │                       │
│ reserved │                  │ Constrain             │
└──────────┘                  ▼                       │
                    ┌────────────────────┐            │
                    │     limited        │────────────┘
                    └─────────┬──────────┘  Restore
                              │
                              │ Exhaust / Fault
                              ▼
                    ┌────────────────────┐
                    │   unavailable      │
                    └────────────────────┘
                              │
                              │ Restore
                              ▼
                         (available)
```

---

## N.7 Work Order Entity (Cross-Org)

### N.7.1 Overview

The existing intra-org WorkOrder entity (`src/lib/iiot/entity/WorkOrderEntity.ts`) manages FDA 21 CFR Part 11 compliant work order lifecycle WITHIN a single organization. The **Cross-Org Work Order** extends this concept to work orders that span organizational boundaries — when one organization needs another's manufacturing capacity [MAAS-CATENAX], [ISA-95-5].

### N.7.2 Relationship to Intra-Org WorkOrder

The cross-org work order does NOT replace the intra-org entity. Instead, it creates a **federated work order pair**:

```
┌─────────────────────┐         ┌─────────────────────┐
│ Requesting Org      │         │ Fulfilling Org       │
│                     │         │                      │
│  CrossOrgWorkOrder  │◄───────►│  CrossOrgWorkOrder   │
│  (requester view)   │  NATS   │  (fulfiller view)    │
│         │           │  events │          │            │
│         ▼           │         │          ▼            │
│  Intra-Org WorkOrder│         │  Intra-Org WorkOrder │
│  (internal tracking)│         │  (production exec.)  │
│                     │         │                      │
└─────────────────────┘         └─────────────────────┘
```

### N.7.3 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/CrossOrgWorkOrderEntity.ts

const CrossOrgWorkOrderId = Schema.String.pipe(
  Schema.pattern(/^XWO-[a-zA-Z0-9-]+$/),
  Schema.brand('CrossOrgWorkOrderId'),
)
type CrossOrgWorkOrderId = typeof CrossOrgWorkOrderId.Type

const CrossOrgWorkOrderStatus = Schema.Literal(
  'draft',
  'submitted',
  'accepted',
  'in_progress',
  'quality_check',
  'complete',
  'settled',
  'disputed',
  'cancelled'
)
type CrossOrgWorkOrderStatus = typeof CrossOrgWorkOrderStatus.Type

class CrossOrgWorkOrder extends Schema.TaggedClass<CrossOrgWorkOrder>()(
  'CrossOrgWorkOrder',
  {
    id: CrossOrgWorkOrderId,

    /** Organization requesting the work */
    requestingOrgId: OrgId,

    /** Organization fulfilling the work (set on acceptance) */
    fulfillingOrgId: Schema.optionalWith(OrgId, { as: 'Option' }),

    status: CrossOrgWorkOrderStatus,

    /** Reference to capability being requested */
    capabilityRef: CapabilityId,

    /** Line items for the work order */
    items: Schema.Array(Schema.Struct({
      description: Schema.NonEmptyString,
      quantity: Schema.Number.pipe(Schema.positive()),
      unit: Schema.String,
      processType: ProcessType,
      materialType: MaterialType,
      toleranceSpec: Schema.optionalWith(Schema.String, { as: 'Option' }),
    })),

    /** Agreed pricing (set during negotiation/acceptance) */
    agreedPrice: Schema.optionalWith(
      Schema.Struct({
        amount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
        currency: Schema.String,
      }),
      { as: 'Option' }
    ),

    /** Delivery requirements */
    deliveryDeadline: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Quality requirements and acceptance criteria */
    qualityCriteria: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Escrow reference for payment settlement */
    escrowRef: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Internal work order IDs on each side (bridged) */
    requesterInternalWoId: Schema.optionalWith(Schema.String, { as: 'Option' }),
    fulfillerInternalWoId: Schema.optionalWith(Schema.String, { as: 'Option' }),

    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  }
)
```

### N.7.4 Cross-Org Work Order Lifecycle

```
                    ┌──────────┐
         Create     │  draft   │
                    └────┬─────┘
                         │ Submit
                         ▼
                    ┌──────────┐   Reject    ┌───────────┐
                    │ submitted│─────────────►│ cancelled │ (terminal)
                    └────┬─────┘              └───────────┘
                         │ Accept                   ▲
                         ▼                          │
                    ┌──────────┐                    │ Cancel (either party)
                    │ accepted │────────────────────┤
                    └────┬─────┘                    │
                         │ BeginWork                │
                         ▼                          │
                    ┌──────────────┐                │
                    │ in_progress  │────────────────┤
                    └────┬─────────┘                │
                         │ SubmitForQC              │
                         ▼                          │
                    ┌──────────────────┐            │
                    │ quality_check    │────────────┘
                    └────┬──────┬──────┘
                         │      │ Dispute
                         │      ▼
                         │ ┌──────────┐
                         │ │ disputed │──► Resolve ──► complete
                         │ └──────────┘
                         │ Approve
                         ▼
                    ┌──────────┐
                    │ complete │
                    └────┬─────┘
                         │ Settle
                         ▼
                    ┌──────────┐
                    │ settled  │ (terminal)
                    └──────────┘
```

**State count:** 9 states, consistent with the intra-org WorkOrder which has 12 states (`src/lib/iiot/machines/graphs/work-order-graph.ts`). The cross-org variant has fewer states because internal execution detail (suspend, resume, fail) is managed by the fulfiller's intra-org WorkOrder entity.

### N.7.5 Cross-Org Event Distribution

Status transitions on cross-org work orders MUST be visible to both parties:

| Transition | Publisher | NATS Subject | Subscriber(s) |
|-----------|-----------|--------------|---------------|
| Submitted | Requester | `commons.xwo.{xwoId}.submitted` | Potential fulfillers |
| Accepted | Fulfiller | `commons.xwo.{xwoId}.accepted` | Requester |
| InProgress | Fulfiller | `commons.xwo.{xwoId}.in_progress` | Requester |
| QualityCheck | Fulfiller | `commons.xwo.{xwoId}.qc` | Requester |
| Complete | Both verify | `commons.xwo.{xwoId}.complete` | Settlement service |
| Disputed | Either party | `commons.xwo.{xwoId}.disputed` | Both + Arbitration |
| Settled | Settlement svc | `commons.xwo.{xwoId}.settled` | Both parties |

Events MUST be persisted in JetStream [JETSTREAM] with per-subject retention for audit compliance [FDA-CFR11].

### N.7.6 Saga Coordination

Cross-org work orders implement a **choreography-based saga** [SAGA-GARCIA], [MSVC-SAGA] with compensating transactions:

| Step | Action | Compensation |
|------|--------|-------------|
| 1 | Reserve fulfiller capacity | Release capacity |
| 2 | Create escrow hold | Release escrow |
| 3 | Create fulfiller internal WO | Cancel internal WO |
| 4 | Begin production | Halt production, return materials |
| 5 | Complete QC | Return to production |
| 6 | Settle payment | Initiate dispute resolution |

Each step emits a domain event. Failures trigger compensating events in reverse order. The saga state is reconstructed from the event log — there is no centralized saga coordinator [MSVC-EVENTSRC].

---

## N.8 Reputation Entity

### N.8.1 Overview

The Reputation entity computes and maintains an event-sourced trust score for each organization in the manufacturing commons. Reputation is CRITICAL for marketplace function — it determines listing visibility, matching priority, and eligibility for high-value work orders [PARKER-PLATFORM].

### N.8.2 G-10 Trust Score Model

The trust score is composed of four factors, each ranging from 0.0 to 1.0:

| Factor | Weight | Derivation | Update Frequency |
|--------|--------|-----------|-----------------|
| **Signal Consistency** (SC) | 0.30 | Ratio of valid to total sensor readings over 30-day window | Hourly |
| **Clock Accuracy** (CA) | 0.20 | Mean clock drift across org's edge nodes vs. NTP reference | Daily |
| **Uptime** (UP) | 0.25 | Percentage of time org's published machines are in operational state | Hourly |
| **Peer Validation** (PV) | 0.25 | Weighted count of positive cross-org work order completions | Per settlement |

```
G-10 Trust Score = (SC × 0.30) + (CA × 0.20) + (UP × 0.25) + (PV × 0.25)
```

### N.8.3 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/ReputationEntity.ts

const ReputationId = Schema.String.pipe(
  Schema.pattern(/^REP-[a-zA-Z0-9-]+$/),
  Schema.brand('ReputationId'),
)
type ReputationId = typeof ReputationId.Type

const TrustFactor = Schema.Struct({
  value: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(1)
  ),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  lastUpdated: Schema.DateTimeUtc,
})

class Reputation extends Schema.TaggedClass<Reputation>()(
  'Reputation',
  {
    id: ReputationId,
    orgId: OrgId,

    /** Signal Consistency factor (0.0 - 1.0) */
    signalConsistency: TrustFactor,

    /** Clock Accuracy factor (0.0 - 1.0) */
    clockAccuracy: TrustFactor,

    /** Uptime factor (0.0 - 1.0) */
    uptime: TrustFactor,

    /** Peer Validation factor (0.0 - 1.0) */
    peerValidation: TrustFactor,

    /** Computed composite score (0.0 - 1.0) */
    compositeScore: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1)
    ),

    /** Number of completed cross-org work orders (total) */
    completedWorkOrders: Schema.Number.pipe(
      Schema.int(), Schema.greaterThanOrEqualTo(0)
    ),

    /** Number of disputed work orders (total) */
    disputedWorkOrders: Schema.Number.pipe(
      Schema.int(), Schema.greaterThanOrEqualTo(0)
    ),

    /** Timestamp of last score recomputation */
    lastComputedAt: Schema.DateTimeUtc,

    /** Score history (last 90 days, daily snapshots) */
    scoreHistory: Schema.Array(Schema.Struct({
      date: Schema.DateTimeUtc,
      score: Schema.Number,
    })),
  }
) {
  computeScore(): number {
    return (
      this.signalConsistency.value * 0.30 +
      this.clockAccuracy.value * 0.20 +
      this.uptime.value * 0.25 +
      this.peerValidation.value * 0.25
    )
  }

  isHighTrust(): boolean {
    return this.compositeScore >= 0.85
  }

  isSuspicious(): boolean {
    // Anomaly: score jumped more than 0.3 in a single day
    if (this.scoreHistory.length < 2) return false
    const latest = this.scoreHistory[this.scoreHistory.length - 1]
    const previous = this.scoreHistory[this.scoreHistory.length - 2]
    return Math.abs(latest.score - previous.score) > 0.3
  }
}
```

### N.8.4 CRDT Strategy

Reputation uses a combination of CRDTs [CRDT-SHAPIRO]:

| Factor | CRDT Type | Rationale |
|--------|----------|-----------|
| Signal Consistency | **LWW-Register** | Single authoritative value, updated by monitoring service |
| Clock Accuracy | **LWW-Register** | Single authoritative value, updated by NTP comparison service |
| Uptime | **LWW-Register** | Single authoritative value, computed from equipment state stream |
| Peer Validation | **G-Counter** | Monotonically increasing count of positive validations |

The composite score is derived from CRDT state — it is NOT itself a CRDT. Each node computes the composite independently from the converged factor values.

### N.8.5 Fraud Detection

The system MUST monitor for anomalous reputation changes that may indicate gaming:

| Anomaly | Detection Rule | Response |
|---------|---------------|----------|
| Score spike | Score increases > 0.3 in 24h | Flag for manual review |
| Signal flooding | > 10x normal reading rate | Quarantine readings, freeze SC factor |
| Peer collusion | Same 3 orgs repeatedly validate each other | Weight reduction for circular validations |
| Clock manipulation | Sudden clock correction > 5s | Freeze CA factor, audit edge nodes |

Anomaly detection events MUST be emitted on `commons.reputation.{orgId}.anomaly` for platform operations monitoring.

---

## N.9 Compliance Entity

### N.9.1 Overview

The Compliance entity manages regulatory certification state for organizations participating in the manufacturing commons. It provides shared infrastructure for verifying that counterparties meet the regulatory requirements for specific work order types [FDA-CFR11], [IEC-62443].

### N.9.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/ComplianceEntity.ts

const ComplianceId = Schema.String.pipe(
  Schema.pattern(/^CMP-[a-zA-Z0-9-]+$/),
  Schema.brand('ComplianceId'),
)
type ComplianceId = typeof ComplianceId.Type

const ComplianceStatus = Schema.Literal(
  'valid',
  'expiring_soon',   // Within 90 days of expiration
  'expired',
  'revoked',
  'under_audit'
)
type ComplianceStatus = typeof ComplianceStatus.Type

const RegulatoryFramework = Schema.Literal(
  'iso_9001',
  'iso_14001',
  'iso_45001',
  'as9100',          // Aerospace
  'iatf_16949',      // Automotive
  'iso_13485',       // Medical devices
  'fda_21_cfr_11',   // Electronic records (pharma)
  'fda_21_cfr_820',  // Quality system regulation (medical)
  'itar',            // International Traffic in Arms
  'ear',             // Export Administration Regulations
  'reach',           // EU chemicals regulation
  'rohs',            // EU hazardous substances
  'nadcap',          // Aerospace special processes
  'iec_62443'        // Industrial cybersecurity
)
type RegulatoryFramework = typeof RegulatoryFramework.Type

class Compliance extends Schema.TaggedClass<Compliance>()(
  'Compliance',
  {
    id: ComplianceId,
    orgId: OrgId,
    framework: RegulatoryFramework,
    status: ComplianceStatus,

    /** Certificate number from certifying body */
    certificateNumber: Schema.NonEmptyString,

    /** Name of the certifying body */
    certifyingBody: Schema.NonEmptyString,

    /** Scope of certification (which processes/facilities) */
    scope: Schema.String,

    /** Date certification was issued */
    issuedAt: Schema.DateTimeUtc,

    /** Date certification expires */
    expiresAt: Schema.DateTimeUtc,

    /** Date of last audit */
    lastAuditDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Next scheduled audit date */
    nextAuditDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Audit trail: all verification events for this certification */
    auditLog: Schema.Array(Schema.Struct({
      timestamp: Schema.DateTimeUtc,
      action: Schema.Literal(
        'issued', 'renewed', 'scope_changed',
        'audit_scheduled', 'audit_completed', 'audit_failed',
        'expiry_warning', 'expired', 'revoked', 'reinstated'
      ),
      actor: Schema.String,
      notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
    })),
  }
) {
  isValid(): boolean {
    return this.status === 'valid' || this.status === 'expiring_soon'
  }

  daysUntilExpiry(): number {
    const now = Date.now()
    const expiry = Number(this.expiresAt.epochMillis)
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  }
}
```

### N.9.3 Cross-Org Compliance Verification

Before a cross-org work order can transition from `submitted` to `accepted`, the platform MUST verify that the fulfilling organization holds valid certifications required by the work order's compliance profile:

```
Verification Flow:

  1. Cross-Org WorkOrder submitted with required frameworks: [as9100, itar]
  2. Platform queries fulfiller's Compliance entities
  3. For each required framework:
     a. Compliance entity exists? ────── NO → REJECT
     b. Status == 'valid' or 'expiring_soon'? ── NO → REJECT
     c. Scope covers requested processes? ─────── NO → REJECT
  4. All checks pass → WorkOrder eligible for acceptance
```

### N.9.4 FDA 21 CFR Part 11 Requirements

For pharmaceutical participants, the compliance infrastructure MUST satisfy [FDA-CFR11]:

| Requirement | Implementation |
|-------------|---------------|
| **Audit trail** (11.10(e)) | All compliance events persisted in JetStream with append-only guarantee |
| **Electronic signatures** (11.50) | Compliance verification actions signed with org's NATS credential |
| **Record protection** (11.10(c)) | Compliance events stored in dedicated JetStream stream with no-delete policy |
| **Authority checks** (11.10(g)) | Only authorized org representatives can modify compliance state |
| **Operational checks** (11.10(f)) | System prevents work order acceptance when compliance is invalid |

The existing intra-org WorkOrder entity already implements FDA 21 CFR Part 11 compliance through its state machine graph and dual-write audit trail (see `src/lib/iiot/entity/WorkOrderEntity.ts:10-11`). The cross-org compliance entity extends this to network-level verification.

### N.9.5 Compliance Lifecycle

```
                         Issue
                           │
                           ▼
                    ┌──────────────┐
                    │    valid     │◄────── Reinstate
                    └──────┬───────┘
                           │ 90 days before expiry
                           ▼
                    ┌──────────────────┐
                    │ expiring_soon    │──── Renew ──► valid
                    └──────┬───────────┘
                           │ Expiry date passes
                           ▼
                    ┌──────────────┐
                    │   expired    │──── Reinstate ──► valid
                    └──────────────┘

        (From any non-revoked state)
                           │ Revoke
                           ▼
                    ┌──────────────┐
                    │   revoked    │ (terminal unless appealed)
                    └──────────────┘

        (From valid or expiring_soon)
                           │ BeginAudit
                           ▼
                    ┌──────────────┐
                    │ under_audit  │──── CompleteAudit ──► valid
                    └──────────────┘──── FailAudit ──► expired
```

---

## N.10 Entity Cardinality at Scale

### N.10.1 Projected Entity Counts

Entity counts projected at 200K organizations, based on industry distribution analysis [TEDALDI-MAAS-2023], [XOMETRY-PLATFORM]:

| Entity Type | Estimated Count | Per-Org Average | Growth Rate |
|------------|----------------|-----------------|-------------|
| **Organization** | 200,000 | 1 | +2K/month |
| **Capability** | 800,000 | 4 | +8K/month |
| **Capacity** | 2,000,000 | 10 | +20K/month |
| **CrossOrgWorkOrder** | 500,000 active | 2.5 active | +50K/month |
| **Reputation** | 200,000 | 1 | Matches org growth |
| **Compliance** | 600,000 | 3 | +6K/month |
| **Enterprise** (intra-org) | 200,000 | 1 | Matches org growth |
| **Site** (intra-org) | 400,000 | 2 | +4K/month |
| **Plant** (intra-org) | 600,000 | 3 | +6K/month |
| **Line** (intra-org) | 2,000,000 | 10 | +20K/month |
| **Machine** (intra-org) | 8,000,000 | 40 | +80K/month |
| **Sensor** (intra-org) | 40,000,000 | 200 | +400K/month |
| **Alarm** (intra-org) | ~100K active | Bursty | Varies |
| **EquipmentState** (intra-org) | 8,000,000 | 40 | Matches machine count |
| **WorkOrder** (intra-org) | ~2M active | ~10 active | +200K/month |

**Total entity count at 200K orgs: ~54M entities**

### N.10.2 Shard Group Assignment

@effect/cluster [EFFECT-CLUSTER] distributes entities across shard groups using consistent hashing [EFFECT-HASHRING]. Entity types are assigned to shard groups based on access pattern affinity and load characteristics:

| Shard Group | Entity Types | Partition Key | Estimated Shards |
|------------|-------------|---------------|-----------------|
| `org-identity` | Organization, Reputation, Compliance | `orgId` | 256 |
| `marketplace` | Capability, Capacity, CrossOrgWorkOrder | `orgId` (creator) | 512 |
| `asset-hierarchy` | Enterprise, Site, Area, Plant, Line, WorkCell | `enterpriseId` | 1024 |
| `equipment` | Machine, Device, Sensor | `machineId` | 2048 |
| `operational` | Alarm, EquipmentState, WorkOrder (intra) | `machineId` | 2048 |

### N.10.3 Partition Strategy

**Intra-org entities** are partitioned by `enterpriseId` (for hierarchy entities) or `machineId` (for equipment-level entities). This ensures that all entities within a single org's hierarchy are co-located on the same shard group, enabling efficient hierarchy traversal without cross-shard queries.

**Network entities** are partitioned by `orgId` (the creating organization). This ensures that an organization's marketplace profile (capabilities, capacity, compliance) is co-located for efficient profile queries.

**Cross-org work orders** are partitioned by the `requestingOrgId`. When the fulfilling org queries their work orders, a secondary index keyed by `fulfillingOrgId` provides O(1) lookup via NATS KV [NATS-KV].

### N.10.4 Memory and Compute Requirements

| Shard Group | Avg Entity Size | Total Memory | Compute (vCPU) |
|------------|----------------|-------------|----------------|
| `org-identity` | 2 KB | ~2 GB | 4 |
| `marketplace` | 4 KB | ~13 GB | 16 |
| `asset-hierarchy` | 1 KB | ~3.2 GB | 8 |
| `equipment` | 0.5 KB | ~24 GB | 32 |
| `operational` | 1.5 KB | ~15 GB | 32 |
| **Total** | — | **~57 GB** | **92 vCPU** |

These are hot-path memory estimates. Cold entities (inactive orgs, historical work orders) are evicted from memory and reconstructed from event log on access. @effect/cluster's entity mailbox [EFFECT-ENTITY] handles the rehydration transparently.

### N.10.5 Event Throughput by Entity Type

| Entity Type | Events/sec (steady) | Events/sec (peak) | JetStream Stream |
|------------|--------------------|--------------------|-----------------|
| Sensor readings | 800,000 | 2,000,000 | `iiot.readings.>` |
| Equipment state | 50,000 | 200,000 | `iiot.equipment.>` |
| Alarms | 5,000 | 50,000 | `iiot.alarms.>` |
| Intra-org WO transitions | 1,000 | 10,000 | `iiot.workorders.>` |
| Capacity updates | 10,000 | 50,000 | `commons.capacity.>` |
| Cross-org WO transitions | 500 | 5,000 | `commons.xwo.>` |
| Reputation updates | 100 | 1,000 | `commons.reputation.>` |
| Compliance events | 10 | 100 | `commons.compliance.>` |
| **Total** | **~866,610** | **~2,316,100** | — |

---

## N.11 Codebase Grounding

### N.11.1 Existing Entity Definitions

The following files implement the intra-org entity types referenced throughout this section:

| File | Entity | Pattern |
|------|--------|---------|
| `src/lib/iiot/entity/EnterpriseEntity.ts` | Enterprise | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/SiteEntity.ts` | Site | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/AreaEntity.ts` | Area | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/PlantEntity.ts` | Plant | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/LineEntity.ts` | Line | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/WorkCellEntity.ts` | WorkCell | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/MachineAssetEntity.ts` | Machine | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/DeviceEntity.ts` | Device | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/SensorAssetEntity.ts` | Sensor | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/AlarmEntity.ts` | Alarm | Entity.make + Machine.boot (EVENT SOURCED) |
| `src/lib/iiot/entity/WorkOrderEntity.ts` | WorkOrder | Entity.make + Machine.boot (EVENT SOURCED, FDA 21 CFR 11) |
| `src/lib/iiot/entity/EquipmentStateEntity.ts` | EquipmentState | Entity.make + Machine.boot (EVENT SOURCED) |
| `src/lib/iiot/entity/AssetEntity.ts` | Asset (generic) | Entity.make (hierarchy queries) |
| `src/lib/iiot/entity/SensorEntity.ts` | Sensor (readings) | Entity.make (time-series queries) |
| `src/lib/iiot/entity/EntityStack.ts` | Layer composition | EntityHandlersLayer, EntityTestingStack |
| `src/lib/iiot/entity/_helpers.ts` | Event emission | maybeEmitWorkOrder, maybeEmitAlarm, maybeEmitEquipment |
| `src/lib/iiot/entity/index.ts` | Barrel export | Re-exports with collision avoidance |

### N.11.2 Schema Definitions

| File | Schema | Key Types |
|------|--------|-----------|
| `src/lib/iiot/schemas/assets/enterprise/schema.ts` | Enterprise | EnterpriseId (branded), EnterpriseStatus, Schema.TaggedClass |
| `src/lib/iiot/schemas/assets/site/schema.ts` | Site | SiteId (branded), SiteStatus |
| `src/lib/iiot/schemas/assets/area/schema.ts` | Area | AreaId (branded), AreaStatus |
| `src/lib/iiot/schemas/assets/plant/schema.ts` | Plant | PlantId (branded), PlantStatus |
| `src/lib/iiot/schemas/assets/line/schema.ts` | Line | LineId (branded), LineStatus |
| `src/lib/iiot/schemas/assets/workcell/schema.ts` | WorkCell | WorkCellId (branded), WorkCellStatus |
| `src/lib/iiot/schemas/assets/machine/schema.ts` | Machine | MachineId (branded), MachineStatus |
| `src/lib/iiot/schemas/assets/device/schema.ts` | Device | DeviceId (branded), DeviceStatus |
| `src/lib/iiot/schemas/assets/sensor/schema.ts` | Sensor | SensorId (branded), SensorType, MeasurementUnit |

### N.11.3 State Machine Graphs

| File | Graph | States | Transitions |
|------|-------|--------|------------|
| `src/lib/iiot/machines/graphs/enterprise-graph.ts` | Enterprise lifecycle | 4 | 5 |
| `src/lib/iiot/machines/graphs/site-graph.ts` | Site lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/area-graph.ts` | Area lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/plant-graph.ts` | Plant lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/line-graph.ts` | Line lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/workcell-graph.ts` | WorkCell lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/machine-asset-graph.ts` | Machine lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/device-graph.ts` | Device lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/sensor-graph.ts` | Sensor lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/alarm-state-graph.ts` | Alarm ISA-18.2 | Variable | Variable |
| `src/lib/iiot/machines/graphs/work-order-graph.ts` | WorkOrder FDA lifecycle | 12 | Complex |
| `src/lib/iiot/machines/graphs/equipment-state-graph.ts` | Equipment OEE | Variable | Variable |

### N.11.4 RPC Groups

| File | RPC Group | Transport |
|------|-----------|-----------|
| `src/lib/iiot/rpc/EnterpriseRpcs.ts` | EnterpriseEntityRpcs | EntityProxy.toRpcGroup |
| `src/lib/iiot/rpc/WorkOrderRpcs.ts` | WorkOrderEntityRpcs | EntityProxy.toRpcGroup |
| `src/lib/iiot/rpc/EquipmentStateRpcs.ts` | EquipmentStateEntityRpcs | EntityProxy.toRpcGroup |
| `src/lib/iiot/rpc/RealtimeRpcs.ts` | RealtimeRpcs | WebSocket streaming |
| `src/lib/iiot/rpc/index.ts` | IIoTRpcs (combined) | All 17 groups merged |

### N.11.5 Network Entity Implementation Path

Network entities described in this section (Organization, Capability, Capacity, CrossOrgWorkOrder, Reputation, Compliance) are **specified but not yet implemented**. They SHOULD follow the established patterns:

1. **Schema**: `src/lib/iiot/schemas/network/{entity}/schema.ts` — Effect Schema TaggedClass with branded ID
2. **Graph**: `src/lib/iiot/machines/graphs/{entity}-graph.ts` — Graph.directed state machine
3. **Machine**: `src/lib/iiot/machines/{Entity}Machine.ts` — Machine with Internal* request classes
4. **Entity**: `src/lib/iiot/entity/{Entity}Entity.ts` — Entity.make + toLayer + Machine.boot
5. **RPC**: `src/lib/iiot/rpc/{Entity}Rpcs.ts` — EntityProxy.toRpcGroup
6. **State**: `src/lib/iiot/state/{Entity}State.ts` — Service interface with in-memory and SQL adapters

The `EntityStack.ts` composition layer (`src/lib/iiot/entity/EntityStack.ts:54-67`) MUST be extended to include network entity handlers when they are implemented.

---

## N.12 Cross-References

| Topic | Reference |
|-------|-----------|
| ISA-95 equipment hierarchy | Reactive ISA-95 Hierarchy section |
| Intra-org consistency model | Two-Domain Consistency section, Domain 1 |
| Cross-org consistency model | Two-Domain Consistency section, Domain 2 |
| NATS subject hierarchy | Edge-First Architecture section |
| Tenant isolation | Security, Trust & Tenant Isolation section |
| Marketplace protocol | Marketplace Protocol section |
| Effect-TS patterns | Effect-TS Implementation Architecture section |
| Event distribution | Entity-Realtime Integration section |

---

## N.13 Open Questions

The following design decisions are deferred to implementation phase:

1. **Capacity pricing model**: Should capacity pricing be market-driven (bid/ask) or posted-price? The schema supports both but marketplace matching logic differs significantly [MARKET-MICROSTRUCTURE].

2. **Reputation bootstrapping**: How do new organizations (with no history) receive initial reputation scores? Options include vouching by existing high-trust orgs, certification-based floor scores, or a probationary period with restricted marketplace access.

3. **Compliance certificate verification**: Should the platform verify certificates with certifying bodies via API integration, or trust self-reported compliance with audit trail? The answer likely differs by framework (ISO self-reported, ITAR mandates verification).

4. **Cross-org work order dispute resolution**: What is the arbitration mechanism when a cross-org work order enters the `disputed` state? Options range from platform-mediated resolution to third-party arbitration services [OSTROM-COMMONS].

5. **CRDT garbage collection**: OR-Set tombstones for removed capabilities accumulate over time. What is the compaction strategy? Options include periodic snapshot compaction or tombstone TTL with causal consistency guarantees [CRDT-SHAPIRO].

---

*This section is part of TMNL-RFC-001: Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT.*

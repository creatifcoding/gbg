# RFC Section: Marketplace Protocol

```
Section:       Marketplace Protocol
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        marketplace-writer (Val)
Created:       2026-02-09
Research Base: docs/specifications/research-manufacturing-commons.md (Sections 1-4, 9-10)
               docs/specifications/rfc-section-two-domain-consistency.md (X.8, X.9)
               docs/specifications/rfc-section-multi-tenant.md (Y.8)
```

---

## M. Marketplace Protocol

### M.1 Scope

This section specifies the **Marketplace Protocol** for the metropolitan
manufacturing commons -- the event-driven mechanism by which 200,000+
organizations discover capabilities, signal capacity, negotiate work orders,
settle payments, and build trust within the Atlanta manufacturing network.

The marketplace is not a bolt-on feature. It is the economic engine that
justifies network participation. Earl's 2-person machine shop joins because
the marketplace connects him to Boeing's overflow CNC work. Boeing joins
because the marketplace provides elastic manufacturing capacity without
capital expenditure.

This section covers:
- Capability discovery and search
- Real-time capacity signaling derived from equipment state events
- Work order lifecycle from RFQ to settlement
- Pricing, escrow, and settlement protocol
- Trust, reputation, and Sybil resistance
- Geographic optimization for Atlanta metro routing
- Privacy-preserving marketplace participation

For cross-organization consistency guarantees, see Section X (Two-Domain
Consistency Model). For tenant isolation and NATS account architecture, see
Section Y (Multi-Tenant Manufacturing Network Architecture). For trust
infrastructure, see Section Z (Security, Trust & Tenant Isolation).

### M.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### M.3 Marketplace Vision

#### M.3.1 The Manufacturing Commons as Two-Sided Market

The manufacturing commons operates as a two-sided marketplace [TWO-SIDED]
[PARKER-PLATFORM] where the same organization can simultaneously act as both
a capacity provider and a capacity consumer:

| Role | Description | Example |
|------|-------------|---------|
| **Capacity Provider** | Organization with idle machines offering manufacturing services | Earl has a 5-axis CNC idle on Thursdays |
| **Capacity Consumer** | Organization with overflow work seeking external fulfillment | Boeing needs 200 aluminum brackets by Friday |
| **Both** | Most organizations occupy both roles at different times | Precision Parts Co. fills Earl's lathe work and outsources its own heat treating |

This dual-role model distinguishes the manufacturing commons from traditional
job shops or contract manufacturing platforms [XOMETRY-PLATFORM] where roles
are fixed. In our model, every participant is both buyer and seller, creating
a denser network with stronger [METCALFE-LAW] effects.

#### M.3.2 Real-Time State as Market Signal

The fundamental innovation: **entity state events ARE market signals**. When a
machine transitions from `RUNNING` to `IDLE`, that is simultaneously:

1. An **operational event** (the machine finished its job)
2. A **capacity signal** (the machine is now available for marketplace work)
3. A **pricing input** (more idle machines = lower spot prices in the region)

No existing Manufacturing-as-a-Service (MaaS) platform [TEDALDI-MAAS-2023]
provides this real-time linkage between operational state and marketplace
availability. Xometry [XOMETRY-PLATFORM] relies on manual capacity
declaration; EFPF [EFPF-2020] exchanges batch documents. Our platform derives
marketplace signals directly from the entity lifecycle event stream.

#### M.3.3 "Uber for CNC" with ISA-95 Compliance

The marketplace metaphor is deliberately accessible: match available machines
to needed work in real time, with quality verification. But unlike ride-sharing,
manufacturing carries regulatory weight:

- **Quality certificates**: AS9100 (aerospace), ISO 13485 (medical),
  IATF 16949 (automotive) -- capabilities MUST be verified, not self-declared
- **Material traceability**: 21 CFR Part 11 [FDA-CFR11] compliance for regulated
  industries requires full audit trails
- **Process validation**: A CNC mill can cut aluminum, but IS it validated for
  aerospace-grade aluminum? Process-material combinations matter
- **ISA-95 compliance**: Work orders MUST integrate with existing MES/ERP systems
  at the executing organization via [ISA-95-5] transaction models

The marketplace protocol addresses these requirements through verified
capability claims, event-sourced audit trails, and ISA-95-aligned work order
transactions.

### M.4 Capability Discovery Protocol

#### M.4.1 Capability Declaration

Organizations that opt into the marketplace MUST publish their capabilities
to the manufacturing commons. A capability declaration consists of:

```
CapabilityDeclaration {
  orgId:            OrganizationId      // Publishing org
  capabilityId:     CapabilityId        // Unique per org
  category:         CapabilityCategory  // 'machining' | 'fabrication' | 'finishing' | ...
  processes:        Process[]           // CNC milling, turning, grinding, etc.
  materials:        Material[]          // Aluminum, steel, titanium, etc.
  tolerances:       ToleranceSpec       // +/- 0.001", surface finish Ra
  maxPartSize:      Dimensions          // Work envelope
  certifications:   Certification[]     // AS9100, ISO 13485, etc.
  verifiedAt:       ISO-8601 | null     // Last third-party verification date
  automatedSignal:  boolean             // True if capacity derived from equipment state
  declaredAt:       ISO-8601            // Declaration timestamp
}
```

**NATS subject**: `commons.capability.{orgId}.declared`

**Storage**: CRDT-based capability index using OR-Set [CRDT-SHAPIRO] stored in
NATS KV bucket `network.capabilities`. Each organization writes only to its own
key prefix (`network.capabilities.{orgId}.*`), ensuring conflict-free updates.

#### M.4.2 Capability Categories

The marketplace defines a structured taxonomy of manufacturing capabilities
aligned with ISA-95 activity models [ISA-95-1]:

| Category | Subcategories | ISA-95 Mapping |
|----------|---------------|----------------|
| Machining | CNC milling (3/4/5-axis), turning, drilling, boring, EDM | Production capability |
| Fabrication | Sheet metal, welding (MIG/TIG/laser), bending, punching | Production capability |
| Finishing | Anodizing, powder coating, plating, heat treating, deburring | Quality operations |
| Additive | FDM, SLA, SLS, DMLS, binder jetting | Production capability |
| Inspection | CMM, optical, X-ray, ultrasonic | Quality operations |
| Assembly | Mechanical, electronic, clean-room | Production capability |
| Raw Material | Stock cutting, material supply, bar stock | Material management |

Organizations MUST declare capabilities at the subcategory level. The
category-level grouping is used for search optimization.

#### M.4.3 Capability Search Protocol

Search follows a structured RPC-based query pattern. The marketplace exposes
a `Marketplace.SearchCapabilities` RPC:

```
SearchCapabilitiesRequest {
  processes:        Process[]           // Required processes
  materials:        Material[]          // Required materials
  certifications:   Certification[]     // Required certs (AND logic)
  minTolerance:     ToleranceSpec?      // Minimum precision
  maxDistance:       DistanceKm?         // Proximity filter (from org's location)
  minReputation:    number?             // Minimum G-10 trust score (0-100)
  onlyVerified:     boolean             // Only third-party verified capabilities
  onlyAvailable:    boolean             // Cross-reference with live capacity
}

SearchCapabilitiesResponse {
  results: CapabilityMatch[]
  totalMatches: number
  searchLatency: DurationMs
}

CapabilityMatch {
  orgId:            OrganizationId
  capability:       CapabilityDeclaration
  currentCapacity:  CapacitySignal?     // Live capacity if available
  distance:         DistanceKm
  reputation:       number              // G-10 score
  estimatedLeadTime: DurationDays?      // Based on current backlog
}
```

**Search semantics**: "I need 5-axis CNC in aluminum, AS9100 certified, within
50 miles" translates to:

```
{
  processes: ["cnc_milling_5axis"],
  materials: ["aluminum_6061", "aluminum_7075"],
  certifications: ["AS9100"],
  maxDistance: 80,  // km (~50 miles)
  onlyAvailable: true
}
```

**Implementation**: The CRDT-based OR-Set capability index supports full-scan
queries across all organizations. For the Atlanta metro network (200K+ orgs),
the index is expected to contain ~500K capability entries. Queries SHOULD
complete within 500ms (P95) using NATS KV range scans with in-memory
filtering.

#### M.4.4 Verified vs. Self-Declared Capabilities

Trust in the marketplace hinges on capability verification:

| Verification Level | Indicator | Trust Weight |
|--------------------|-----------|-------------|
| **Self-declared** | Org claims capability, no external verification | Low (0.3x weight in search ranking) |
| **Peer-attested** | Another org confirms capability from prior transaction | Medium (0.6x weight) |
| **Third-party audited** | Independent auditor confirms (AS9100 registrar, etc.) | High (1.0x weight) |
| **Platform-verified** | Platform's own verification process (sample job, documentation review) | High (1.0x weight) |

Organizations with third-party or platform verification MUST have their
`verifiedAt` timestamp updated within the past 12 months to maintain
"verified" status. Expired verifications automatically downgrade to
"self-declared."

### M.5 Capacity Signaling Protocol

#### M.5.1 Capacity Derived from Equipment State

Capacity signals are derived automatically from equipment state transitions
processed by the EventDistribution service
(`src/lib/iiot/realtime/event-distribution.ts`). The signal derivation:

```
Equipment State Event              Capacity Signal
─────────────────────              ───────────────
Machine.GoIdle       ──────────►   CapacityAvailable(machineId, capabilities)
Machine.Resume       ──────────►   CapacityConsumed(machineId)
Machine.MarkFaulted  ──────────►   CapacityUnavailable(machineId, reason: "faulted")
Machine.ScheduleRepair ────────►   CapacityUnavailable(machineId, reason: "maintenance")
Line.MarkStarved     ──────────►   CapacityDegraded(lineId, utilization: reduced)
Plant.EmergencyShutdown ───────►   CapacityUnavailable(plantId, reason: "emergency")
```

**NATS subject**: `commons.capacity.{orgId}`

#### M.5.2 Aggregation Rules

Capacity is aggregated at multiple levels following the ISA-95 hierarchy:

| Level | Aggregation | Signal Subject |
|-------|-------------|----------------|
| Machine | Direct: machine IDLE = 1 unit available | `commons.capacity.{orgId}.machine.{machineId}` |
| Line | Sum of idle machines on line | `commons.capacity.{orgId}.line.{lineId}` |
| Organization | Sum of all idle machines across all sites | `commons.capacity.{orgId}` |
| Network | Sum of all org-level capacities (G-Counter CRDT) | `network.capacity.summary` |

The network-level aggregate uses a G-Counter CRDT [CRDT-SHAPIRO] stored in
NATS KV bucket `network.capacity`. Each organization updates only its own
counter value. The aggregate is computed by summing all keys -- conflict-free
by construction. See Section X.9 for CRDT specification.

#### M.5.3 Outward Propagation Rules

Capacity signals propagate outward from the organization to the network
following three rules:

**O-1 (Opt-In Gating)**: Capacity signals MUST NOT leave the organization's
NATS account unless the organization has explicitly enabled marketplace
participation. The export configuration in the organization's account JWT
[NATS-JWT] controls this gate.

**O-2 (Aggregation Privacy)**: Organizations MAY choose to publish only
aggregate capacity (org-level count of idle machines) rather than per-machine
signals. This prevents competitors from inferring production schedules. The
aggregation level is configurable: `machine` (full detail), `line`
(line-level), or `org` (aggregate only).

**O-3 (Staleness Bound)**: Capacity signals MUST be refreshed within the G-8
bounded staleness window (60 seconds) as specified in Section X.4. Stale
capacity entries older than 120 seconds SHOULD be flagged as `possibly_stale`
in search results.

#### M.5.4 Capacity Signal Schema

```
CapacitySignal {
  _tag:             'CapacitySignal'
  orgId:            OrganizationId
  timestamp:        ISO-8601
  totalMachines:    number            // Total registered machines
  idleMachines:     number            // Currently idle
  faultedMachines:  number            // Currently faulted
  utilization:      number            // 0.0 - 1.0
  capabilities:     CapabilityId[]    // What idle machines can do
  aggregationLevel: 'machine' | 'line' | 'org'
}
```

### M.6 Work Order Lifecycle

#### M.6.1 State Machine

Marketplace work orders follow a structured lifecycle that extends the
existing WorkOrderEntity (`src/lib/iiot/entity/WorkOrderEntity.ts`) with
cross-organization states:

```
                    ┌──────────────┐
                    │  RFQ_POSTED  │
                    └──────┬───────┘
                           │ Bids received
                    ┌──────▼───────┐
                    │   QUOTING    │◄──── Multiple orgs submit quotes
                    └──────┬───────┘
                           │ Requester selects
                    ┌──────▼───────┐
                    │   ACCEPTED   │ ──── Quote accepted, escrow funded
                    └──────┬───────┘
                           │ Fulfiller begins
                    ┌──────▼───────┐
                    │ IN_PROGRESS  │ ──── Mapped to internal WO at fulfiller
                    └──────┬───────┘
                           │ Production complete
                    ┌──────▼───────┐
                    │  QC_PENDING  │ ──── Quality check at fulfiller
                    └──────┬───────┘
                     ┌─────┴──────┐
               ┌─────▼─────┐ ┌───▼────┐
               │ QC_PASSED  │ │QC_FAIL │
               └─────┬──────┘ └───┬────┘
                     │            │ Rework or dispute
               ┌─────▼─────┐ ┌───▼──────────┐
               │  SHIPPED   │ │  REWORK      │ ──► Back to IN_PROGRESS
               └─────┬──────┘ └──────────────┘
                     │
               ┌─────▼──────────┐
               │ RECEIVER_CHECK │ ──── Requester inspects delivery
               └─────┬──────────┘
                ┌────┴─────┐
          ┌─────▼────┐ ┌───▼──────┐
          │ COMPLETE  │ │ DISPUTED │
          └─────┬─────┘ └───┬──────┘
                │           │ Resolution
          ┌─────▼─────┐ ┌──▼───────┐
          │ SETTLED   │ │ RESOLVED │──► SETTLED or REFUNDED
          └───────────┘ └──────────┘
```

#### M.6.2 State Transition Events

Each transition emits an event to the marketplace commons:

| Transition | Publisher | NATS Subject | G-8 Applies |
|------------|-----------|-------------|-------------|
| `RfqPosted` | Requester | `commons.marketplace.rfq.{rfqId}` | Yes (60s bound) |
| `QuoteSubmitted` | Bidder | `commons.marketplace.quote.{rfqId}.{bidderId}` | Yes |
| `QuoteAccepted` | Requester | `commons.marketplace.accept.{rfqId}` | Causal (MUST follow quote) |
| `EscrowFunded` | Platform | `commons.marketplace.escrow.{orderId}` | Yes |
| `WorkStarted` | Fulfiller | `commons.marketplace.progress.{orderId}` | Yes |
| `QcCompleted` | Fulfiller | `commons.marketplace.qc.{orderId}` | Yes |
| `Shipped` | Fulfiller | `commons.marketplace.ship.{orderId}` | Yes |
| `ReceiverConfirmed` | Requester | `commons.marketplace.confirm.{orderId}` | Yes |
| `Settled` | Platform | `commons.marketplace.settle.{orderId}` | Yes |
| `Disputed` | Either party | `commons.marketplace.dispute.{orderId}` | Yes |
| `DisputeResolved` | Platform | `commons.marketplace.resolve.{orderId}` | Yes |

**Causal ordering note**: `QuoteAccepted` MUST be causally ordered with
respect to `QuoteSubmitted`. This is achievable without global coordination
because both events route through the requester's NATS account, preserving
per-subject ordering (see Section X.8 special case for `WorkOrderAccepted`).

#### M.6.3 Cross-Organization Visibility

The marketplace work order creates a shared view between requester and
fulfiller while preserving data sovereignty:

| Data | Requester Sees | Fulfiller Sees | Network Sees |
|------|----------------|----------------|-------------|
| Work order details | Full | Full | Anonymized summary |
| Production progress | Status only | Full internal WO state | Status only |
| Machine assignment | No | Yes (internal) | No |
| Quality results | Pass/fail + cert | Full QC data | Pass/fail only |
| Pricing | Agreed price | Agreed price | Aggregate stats |
| Audit trail | Own actions | Own actions | Event count |

**Implementation**: Cross-org visibility is controlled by NATS account
subject exports (see Section Y.8). The requester's account imports only
the subject patterns listed in the "Requester Sees" column. The fulfiller's
internal subjects remain within their account boundary.

#### M.6.4 SLA Enforcement

Marketplace work orders carry service level agreements with automatic
escalation:

| SLA Metric | Threshold | Escalation Action |
|------------|-----------|-------------------|
| Quote response time | 24 hours after RFQ | Auto-notify requester of non-responsive bidders |
| Acceptance confirmation | 4 hours after selection | Auto-cancel if unfunded |
| Work start deadline | Per quote lead time | Auto-escalation to platform ops |
| QC completion | 48 hours after production | Auto-flag for review |
| Shipping confirmation | Per quote terms | Partial refund trigger |
| Receiver confirmation | 72 hours after delivery | Auto-confirm (silent acceptance) |

SLA monitoring is event-driven: each state transition resets a timer. If the
timer expires without the expected next transition, the platform emits an
`SlaBreached` event and triggers the escalation action.

#### M.6.5 Dispute Resolution Protocol

When either party raises a dispute:

```
Requester or Fulfiller
        │
        ▼
┌───────────────┐
│ DISPUTE_FILED │ ──── Both parties notified
└───────┬───────┘
        │ 48h window
┌───────▼───────┐
│ EVIDENCE      │ ──── Both parties submit documentation
│ SUBMISSION    │      (photos, measurements, certificates)
└───────┬───────┘
        │
┌───────▼───────────┐
│ MEDIATION         │ ──── Platform mediator reviews evidence
│ (platform-assisted│      Attempts mutual resolution
│  or automated)    │
└───────┬───────────┘
   ┌────┴────┐
   ▼         ▼
RESOLVED   ARBITRATION ──► Final binding decision
   │         │
   ▼         ▼
SETTLED    SETTLED (with penalty allocation)
```

**Dispute evidence** is stored as encrypted payloads in the requester's
NATS account, shared with the platform mediator via time-limited subject
exports. Evidence is NOT visible to the broader network.

### M.7 Pricing and Settlement

#### M.7.1 Dynamic Pricing Inputs

Marketplace pricing is influenced by real-time signals, not fixed rate cards:

| Signal | Effect on Price | Source |
|--------|----------------|--------|
| Machine availability in region | More idle = lower spot price | Capacity signals (M.5) |
| Urgency (lead time requested) | Shorter lead time = premium | RFQ parameters |
| Complexity (tolerances, certifications) | Tighter = higher | Capability matching |
| Requester reputation | Higher trust = better terms | G-10 score |
| Fulfiller reputation | Higher trust = premium pricing | G-10 score |
| Material costs | Pass-through | External feed |
| Historical transaction prices | Anchor | Platform analytics |

The platform SHOULD provide pricing guidance (suggested range) based on
recent comparable transactions. Actual pricing is negotiated between parties.

#### M.7.2 Escrow Protocol

All marketplace transactions above a configurable threshold (RECOMMENDED:
$100 USD) MUST use the event-sourced escrow ledger:

```
1. QuoteAccepted
   ├── Platform creates EscrowRecord(orderId, amount, requester, fulfiller)
   └── Event: EscrowCreated

2. Requester funds escrow
   ├── Payment confirmed via payment processor webhook
   └── Event: EscrowFunded(orderId, amount, paymentRef)

3. Work completed + QC passed + Receiver confirmed
   ├── Platform releases escrow to fulfiller
   ├── Platform deducts network fee
   └── Event: EscrowReleased(orderId, fulfillerAmount, feeAmount)

4. Dispute filed
   ├── Escrow frozen until resolution
   └── Event: EscrowFrozen(orderId, reason)

5. Dispute resolved
   ├── Escrow allocated per resolution (full release, partial refund, full refund)
   └── Event: EscrowSettled(orderId, allocation)
```

**Event sourcing**: The escrow ledger is event-sourced [EVENT-SOURCING]. The
current balance of any escrow account can be reconstructed by replaying its
events. This provides a complete audit trail for regulatory compliance
[FDA-CFR11] and dispute resolution.

#### M.7.3 Settlement Triggers

Settlement occurs automatically when all conditions are met:

| Trigger | Condition | Action |
|---------|-----------|--------|
| Happy path | QC passed + Receiver confirmed | Release to fulfiller minus fee |
| Silent acceptance | 72h after delivery, no dispute filed | Release to fulfiller minus fee |
| Quality failure | QC failed, no rework agreed | Full refund to requester |
| Partial delivery | Partial quantity received and confirmed | Pro-rata settlement |
| Dispute resolution | Mediator/arbitrator decision | Per decision allocation |

#### M.7.4 Network Fee Structure

The platform charges a network fee on settled transactions:

| Transaction Value | Fee Rate | Rationale |
|-------------------|----------|-----------|
| $0 - $500 | 5% | Cover payment processing + platform costs |
| $500 - $5,000 | 3% | Standard marketplace rate |
| $5,000 - $50,000 | 2% | Volume discount |
| $50,000+ | 1.5% | Enterprise tier |

The fee is deducted from the escrow at settlement. Organizations MAY
negotiate custom rates at the enterprise tier.

**Transparency**: Fee calculations MUST be visible to both parties before
the transaction is finalized. The platform MUST NOT charge hidden fees.

### M.8 Trust and Reputation in the Marketplace

#### M.8.1 G-10 Trust Score

The G-10 Trust Score extends the network's guarantee framework (G-1 through
G-9) with a marketplace-specific reputation metric. G-10 is a bounded counter
CRDT [CRDT-SHAPIRO] stored at `network.reputation.{orgId}` (see Section X.9).

**Score computation**:

```
G-10 Score = base_score
  + (successful_completions * 2)
  - (disputes_lost * 5)
  - (sla_breaches * 3)
  + (verification_bonus)
  + (tenure_bonus)
  , clamped to [0, 100]
```

| Component | Value | Rationale |
|-----------|-------|-----------|
| Base score (new org) | 30 | Neutral starting point |
| Successful completion | +2 per transaction | Proven reliability |
| Dispute lost | -5 per dispute | Strong deterrent |
| SLA breach | -3 per breach | Timeliness matters |
| Third-party verification | +10 (one-time) | Certified capability |
| Tenure bonus | +1 per 6 months (max +10) | Long-term participants |

#### M.8.2 Verified Capability Claims

Capability verification is the marketplace's trust foundation:

1. **Self-declaration** (onboarding): Organization declares capabilities
   during marketplace opt-in. Score weight: 0.3x in search ranking.

2. **Transaction attestation** (organic): After successful marketplace
   completion, the requester MAY attest to the fulfiller's capability.
   Attestations accumulate and increase search ranking weight to 0.6x.

3. **Third-party audit** (formal): Independent auditors (AS9100 registrars,
   ISO certification bodies) submit digitally signed verification records.
   Score weight: 1.0x. Verification MUST be renewed annually.

4. **Platform spot-check** (random): The platform MAY commission sample jobs
   to verify declared capabilities. Organizations that fail spot-checks
   receive a `CapabilityDowngraded` event and search ranking penalty.

#### M.8.3 Sybil Resistance

New organizations start with limited marketplace access to prevent gaming:

| Marketplace Tier | Requirements | Capabilities |
|------------------|-------------|-------------|
| **Newcomer** | Account created, edge device connected | Can browse, post RFQs (max 3/week), bid on jobs (max 3/week) |
| **Established** | 5+ successful transactions, G-10 >= 40, 30+ days tenure | Unlimited RFQs and bids, eligible for escrow-free small jobs |
| **Trusted** | 20+ transactions, G-10 >= 60, 90+ days, verified capabilities | Priority in search results, higher bid limits, escrow-free up to $1000 |
| **Verified** | 50+ transactions, G-10 >= 75, third-party audit complete | Featured in search, eligible for enterprise contracts, reduced fees |

**Tier progression** is event-sourced. Each transaction, verification, and
time-based milestone emits an event. Tier calculations are idempotent
projections of the event stream.

#### M.8.4 Transaction History as Reputation Input

Every marketplace transaction contributes to reputation through three channels:

1. **Completion rate**: % of accepted work orders completed successfully
2. **On-time rate**: % of work orders completed within quoted lead time
3. **Quality rate**: % of work orders passing QC on first attempt

These rates are published as CRDT aggregates (LWW-Register per metric per
org) at `network.reputation.{orgId}.metrics`. Historical rates are computed
over a rolling 12-month window.

### M.9 Geographic Optimization

#### M.9.1 Proximity-Based Matching

The Atlanta metropolitan manufacturing network is geographically bounded.
Proximity is a first-class search parameter because logistics cost scales
with distance:

```
SearchCapabilitiesRequest.maxDistance = 80 km  // ~50 miles

Matching algorithm:
1. Filter capabilities by process/material/certification
2. Compute haversine distance from requester to each match
3. Rank by: capability_fit * 0.5 + proximity * 0.3 + reputation * 0.2
4. Return top N matches
```

**Organization location** is declared at onboarding (lat/lng of primary
facility). Multi-site organizations declare location per site. Location is
stored in NATS KV at `network.locations.{orgId}`.

#### M.9.2 Metro Routing Optimization

For the Atlanta metro region, the marketplace SHOULD optimize routing to
minimize total logistics time:

| Route Pattern | Example | Optimization |
|---------------|---------|-------------|
| Direct | Requester -> Fulfiller | Single hop, minimize distance |
| Multi-hop | Requester -> Machining (Org B) -> Finishing (Org C) -> Requester | Minimize total path distance |
| Co-located | Both orgs in same industrial park | Priority match (logistics ~= 0) |

#### M.9.3 Multi-Hop Work Orders

Complex parts may require multiple manufacturing processes that no single
organization provides. The marketplace supports multi-hop work orders:

```
Multi-Hop Work Order Sequence:

Requester (Boeing) posts RFQ:
  "Need 200 aluminum brackets: CNC machining + anodizing + inspection"

Platform decomposes into sub-orders:
  Sub-1: CNC machining (5-axis, aluminum 6061) → Earl's Machine Shop
  Sub-2: Anodizing (Type III, hard coat)       → Metro Surface Finishing
  Sub-3: CMM inspection (AS9100 certified)     → Precision QC Services

Routing:
  Boeing → Earl's (machining) → Metro Surface (anodizing)
        → Precision QC (inspection) → Boeing

Each sub-order is an independent marketplace work order with:
  - Its own escrow
  - Its own SLA
  - Chain-linked delivery: Sub-2 starts when Sub-1 ships
```

**Event distribution for multi-hop**: Each sub-order emits standard work order
events. The parent work order aggregates sub-order states:

- Parent = `IN_PROGRESS` while any sub-order is active
- Parent = `QC_PENDING` when final sub-order reaches QC
- Parent = `COMPLETE` when all sub-orders are settled

The parent work order MUST maintain causal links to all sub-orders via
`causedBy` metadata (see Section X.3, G-3).

#### M.9.4 Logistics Integration Events

The marketplace emits logistics events to coordinate physical transport
between organizations in multi-hop and direct work orders:

| Event | Description | NATS Subject |
|-------|-------------|-------------|
| `PickupScheduled` | Parts ready for transport at source org | `commons.logistics.{orderId}.pickup` |
| `InTransit` | Parts en route between orgs | `commons.logistics.{orderId}.transit` |
| `Delivered` | Parts arrived at destination org | `commons.logistics.{orderId}.delivered` |

Logistics events are informational (not transactional). They provide
visibility into the physical supply chain but do NOT trigger settlement.
Only the work order state machine controls financial flows.

### M.10 Privacy-Preserving Marketplace

#### M.10.1 Data Sovereignty Principles

Organizations control what the marketplace can see. This is not optional --
it is architecturally enforced via NATS account subject exports [NATS-ACCOUNTS]:

| Data Category | Default Visibility | Org Can Override |
|---------------|-------------------|-----------------|
| Capability declarations | Visible to marketplace searchers | Can restrict to specific industries |
| Capacity signals | Aggregated (org-level count) | Can expose per-machine detail (opt-in) |
| Work order details | Visible to counterparty + platform only | Cannot broaden (privacy floor) |
| Machine identity | Hidden (only org sees) | Can expose for trusted partners |
| Production schedule | Hidden | Hidden (never exportable) |
| Pricing history | Aggregated in network analytics | Individual transactions are private |

#### M.10.2 Capacity Signal Aggregation

The default privacy mode for capacity signals is **org-level aggregation**:

```
Default (privacy-preserving):
  Network sees: "Earl's Machine Shop has 2 idle machines (CNC capability)"
  Network does NOT see: "Earl's Haas VF-2 (serial #12345) is idle"

Opt-in detailed mode:
  Network sees: "Earl's Machine Shop: VF-2 (5-axis CNC, aluminum) idle,
                 SL-20 (lathe, steel/aluminum) idle"
```

Organizations SHOULD use org-level aggregation unless they specifically
want machine-level visibility for competitive advantage (e.g., advertising
a rare 5-axis capability).

#### M.10.3 Encrypted Work Order Details

Work order details between counterparties MUST be encrypted in transit and
at rest within the NATS messaging layer:

1. **In transit**: NATS TLS encryption protects all messages on the wire
2. **Subject-level isolation**: Work order subjects are scoped to the
   requester's account. The fulfiller accesses them via targeted subject
   imports that the requester grants per-order.
3. **Audit trail access**: The platform mediator can access work order
   details only during active disputes, via time-limited subject exports.

The network (other organizations) sees only: `"Organization A posted a
marketplace work order"` with anonymized metadata (category, approximate
value range, required capabilities). Counterparty identities are not
disclosed to the network.

#### M.10.4 Right to Revoke

Per Section Y.7.2 (Organization Offboarding), organizations MUST be able to
revoke all marketplace exports within 60 seconds. This means:

1. Capability declarations are removed from the OR-Set CRDT
2. Capacity signals stop propagating
3. Active work orders continue to completion (contractual obligation) but
   no new marketplace interactions are possible
4. Historical transaction records are retained for the regulatory retention
   period but are not visible in marketplace search

### M.11 Codebase Grounding

This section maps marketplace protocol concepts to existing TMNL codebase
patterns, identifying current artifacts and extension points.

#### M.11.1 Entity Schemas and Identifiers

| Marketplace Concept | Existing Codebase Artifact | Extension Needed |
|---------------------|---------------------------|-----------------|
| OrganizationId | Not yet defined | Add to `src/lib/iiot/schemas/identifiers.ts` as branded type |
| CapabilityId | Not yet defined | New branded type in identifiers.ts |
| Work order entity | `src/lib/iiot/entity/WorkOrderEntity.ts` | Extend with cross-org states (RFQ, QUOTING, ACCEPTED, etc.) |
| Work order state machine | `src/lib/iiot/machines/graphs/work-order-graph.ts` | Add marketplace states to transition graph |
| Equipment level enum | `src/lib/iiot/schemas/identifiers.ts:28-38` `EquipmentLevel` | Already includes all 9 ISA-95 levels needed |
| Machine state transitions | `src/lib/iiot/machines/MachineAssetMachine.ts` | GoIdle, Resume, MarkFaulted already emit transitions |

#### M.11.2 Event Distribution Infrastructure

| Marketplace Concept | Existing Codebase Artifact | Extension Needed |
|---------------------|---------------------------|-----------------|
| Capacity signal derivation | `src/lib/iiot/realtime/event-distribution.ts:136-157` | Add 5th channel: `iiot:marketplace` for capacity signals |
| Cross-org event delivery | `src/lib/iiot/realtime/holonet-bridge.ts` | Add account-aware subject routing for cross-org |
| NATS subject patterns | `src/lib/iiot/realtime/iiot-subjects.ts` | Add `commons.*` subject specs for marketplace |
| Broadcast outlets | `src/lib/streams/constructs/ChannelService.ts` | Already supports fan-out; no change needed |
| Dual-publish (local + NATS) | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Pattern reusable for marketplace events |

#### M.11.3 RPC Definitions

| Marketplace RPC | Existing Pattern | Extension Needed |
|-----------------|-----------------|-----------------|
| `Marketplace.SearchCapabilities` | Follows `Rpc.make()` pattern from `src/lib/iiot/rpc/RealtimeRpcs.ts` | New RPC group: `MarketplaceRpcs` |
| `Marketplace.PostRfq` | Follows `EntityProxy.toRpcGroup()` from `src/lib/iiot/rpc/WorkOrderRpcs.ts` | Extend WorkOrderEntity or create MarketplaceEntity |
| `Marketplace.SubmitQuote` | Similar to entity RPCs | New marketplace-specific RPC |
| `Marketplace.AcceptQuote` | Similar to entity RPCs | New marketplace-specific RPC |
| `Marketplace.SubscribeCapacity` | Follows `stream: true` pattern from `RealtimeRpcs.ts:107-121` | New streaming RPC for live capacity |
| `Marketplace.SubscribeOrderStatus` | Follows `stream: true` pattern | New streaming RPC for work order status |

The existing RPC infrastructure (`src/lib/iiot/rpc/index.ts`) composes
groups via `RpcGroup.make()`. A new `MarketplaceRpcs` group would be added
to `IIoTRpcs` using the same composition pattern.

#### M.11.4 CRDT Storage

| CRDT Aggregate | KV Bucket | CRDT Type | Existing Pattern |
|----------------|-----------|-----------|-----------------|
| Capability registry | `network.capabilities` | OR-Set | Defined in Section X.9 |
| Capacity counters | `network.capacity` | G-Counter | Defined in Section X.9 |
| Reputation scores | `network.reputation` | Bounded Counter | Defined in Section X.9 |
| Organization locations | `network.locations` | LWW-Register | New; same KV pattern |
| Metric rates | `network.reputation.{orgId}.metrics` | LWW-Register | New; same KV pattern |

All CRDT operations use the existing NATS KV infrastructure. Per Section X.9,
each organization writes only its own key prefix, ensuring conflict-free
updates without coordination.

#### M.11.5 State Machine Extension

The marketplace work order state machine extends the existing work order
state graph (`src/lib/iiot/machines/graphs/work-order-graph.ts`):

```
Existing WorkOrder states:
  draft → submitted → approved → in_progress → completed → closed
  (with: rejected, suspended, failed, cancelled branches)

Marketplace extension (new states, same graph pattern):
  rfq_posted → quoting → accepted → escrow_funded
    → in_progress → qc_pending → qc_passed → shipped
    → receiver_check → complete → settled

Mapping between internal and marketplace states:
  Marketplace "in_progress" maps to internal WorkOrder "in_progress"
  Marketplace "qc_pending" maps to internal WorkOrder "completed" + QC phase
  This mapping preserves the fulfiller's internal WO lifecycle
```

The existing `EntityProxy.toRpcGroup()` pattern from
`src/lib/iiot/rpc/WorkOrderRpcs.ts:25` generates RPCs automatically from
entity definitions. A `MarketplaceOrderEntity` would follow the same pattern,
generating cross-org RPCs from the marketplace state machine.

---

## Open Questions

1. **Multi-hop escrow coordination**: When a multi-hop work order spans 3+
   organizations, how are escrow funds allocated across sub-orders? If Sub-1
   succeeds but Sub-2 fails, the requester has paid for machining but received
   no finished parts. A sub-order escrow chain with conditional release
   triggers needs specification.

2. **Cross-metro marketplace**: The current design scopes to Atlanta metro.
   If a second metropolitan network (e.g., Detroit) joins, how do cross-metro
   marketplace queries work? Federated capability search across NATS
   superclusters needs additional specification.

3. **Intellectual property protection**: Some RFQs include CAD files or
   proprietary specifications. The marketplace needs a secure file transfer
   mechanism that protects IP after the work order is complete (e.g.,
   time-limited access, watermarking).

4. **Antitrust considerations**: If the marketplace achieves dominant market
   share in a metro region, the pricing guidance and fee structure may face
   regulatory scrutiny. Platform neutrality guarantees need legal review.

5. **Insurance and liability**: When a marketplace work order produces
   defective parts that cause downstream harm, liability allocation between
   requester, fulfiller, and platform needs contractual specification.

6. **Gale-Shapley for stable matching**: The current search-and-bid model
   allows requester choice. For automated matching (e.g., recurring orders),
   a stable matching algorithm [ZHANG-GS-CMfg-2015] could optimize
   network-wide allocation. This is deferred to a future RFC section.

---

## References

All references use canonical keys from the project bibliography
(`docs/specifications/bibliography.md`).

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records.
- [ISA-95-1] -- ANSI/ISA-95.00.01-2010. Enterprise-Control System Integration Part 1.
- [ISA-95-5] -- ANSI/ISA-95.00.05-2018. Enterprise-Control System Integration Part 5.

### Platform Economics

- [PARKER-PLATFORM] -- Parker, G.G. et al. Platform Revolution. W.W. Norton, 2016.
- [OSTROM-COMMONS] -- Ostrom, E. Governing the Commons. Cambridge UP, 1990.
- [TWO-SIDED] -- Rochet, J.-C. and Tirole, J. "Platform Competition in Two-Sided Markets." 2003.
- [METCALFE-LAW] -- Metcalfe, R.M. "Metcalfe's Law after 40 Years of Ethernet." 2013.
- [XOMETRY-PLATFORM] -- Xometry Inc. "Xometry Instant Quoting Engine."

### Manufacturing-as-a-Service

- [TEDALDI-MAAS-2023] -- Tedaldi, G. and Miragliotta, G. "Early Adopters of MaaS." 2023.
- [EFPF-2020] -- EFPF Consortium. "European Connected Factory Platform." EU Horizon 2020.
- [ZHANG-GS-CMfg-2015] -- Zhang, Y. et al. "Resource Service Sharing in Cloud Manufacturing." 2015.
- [TAO-CMFG-2011] -- Tao, F. et al. "Cloud Manufacturing: A Computing and Service-Oriented Model." 2011.
- [MAAS-PRICING] -- Zhang, Y. et al. "Optimal Pricing Strategies for MaaS Platforms." 2021.

### Distributed Systems

- [CRDT-SHAPIRO] -- Shapiro, M. et al. "Conflict-Free Replicated Data Types." 2011.
- [EVENT-SOURCING] -- Fowler, M. "Event Sourcing." 2005.

### NATS

- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."

### Internal Research

- [TMNL-MFG-COMMONS] -- Val. "Research: Manufacturing Commons." `docs/specifications/research-manufacturing-commons.md`
- [TMNL-CONSISTENCY] -- Val. "Research: Consistency Models." `docs/specifications/research-consistency-models.md`

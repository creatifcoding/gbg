# Research: Manufacturing Commons — Platform Economics for Metropolitan-Scale IIoT

> **Author:** realtime-philosopher (Val)
> **Date:** 2026-02-09
> **Status:** Research Complete — Revision 2 (codebase-grounded)
> **Purpose:** Theoretical foundation for TMNL-RFC-001 Manufacturing Network Architecture
> **Bibliography:** All citations use [KEY] format per `docs/specifications/bibliography.md`

---

## Table of Contents

1. [The Manufacturing Commons Thesis](#1-the-manufacturing-commons-thesis)
2. [Cloud Manufacturing and MaaS Literature](#2-cloud-manufacturing-and-maas-literature)
3. [Platform Economics Applied to Manufacturing](#3-platform-economics-applied-to-manufacturing)
4. [Federated Manufacturing Networks](#4-federated-manufacturing-networks)
5. [Telescoping ISA-95 for Variable-Scale Organizations](#5-telescoping-isa-95-for-variable-scale-organizations)
6. [Network-Level Reactive Semantics](#6-network-level-reactive-semantics)
7. [Edge-First Architecture for Small Manufacturers](#7-edge-first-architecture-for-small-manufacturers)
8. [Two-Tier Consistency Model](#8-two-tier-consistency-model)
9. [Persona-Adaptive Realtime](#9-persona-adaptive-realtime)
10. [Design Implications for the RFC](#10-design-implications-for-the-rfc)
11. [Codebase Reference Map](#11-codebase-reference-map)
12. [References](#12-references)

---

## 1. The Manufacturing Commons Thesis

### 1.1 Beyond Enterprise IIoT

Traditional IIoT platforms (Siemens Insights Hub [SIEMENS-INSIGHTS], PTC ThingWorx [TWX-EVENTS], AVEVA System Platform [AVEVA-SP]) are designed for a single enterprise deploying sensors across its own facilities. The implicit assumption: one organization owns the infrastructure, controls the data, and manages the hierarchy.

Our platform inverts this assumption. We are building a **manufacturing commons** — a civic-scale infrastructure where:

- **200,000+ independent organizations** participate, from a 2-person machine shop to large aerospace manufacturers
- **Located in a metropolitan region** (Atlanta, Georgia), forming a regional manufacturing ecosystem
- **Small manufacturers are first-class citizens** — a machinist with a CNC mill and a lathe is as important as a 500-employee factory
- **The value is in the NETWORK** — collective intelligence, shared capacity, coordinated production

This is not an IIoT platform. It is a **manufacturing network operating system**.

### 1.2 The Commons Analogy

Ostrom's work on governing common-pool resources [OSTROM-COMMONS] provides the foundational governance model. A manufacturing commons shares key characteristics with natural commons:

| Commons Property | Natural Commons (Ostrom) | Manufacturing Commons (Ours) |
|---|---|---|
| **Resource** | Fishery, forest, irrigation | Manufacturing capacity, equipment time, capabilities |
| **Appropriators** | Fishers, farmers | Organizations needing manufacturing services |
| **Providers** | The ecosystem itself | Organizations offering manufacturing capabilities |
| **Governance challenge** | Over-extraction, free-riding | Under-sharing, quality defection, data sovereignty |
| **Solution** | Self-governing institutions with rules | Federated trust with transparent reputation |

Ostrom's eight design principles for governing commons map directly:

1. **Clearly defined boundaries** — Each org controls what data/capabilities they share
2. **Proportional equivalence** — Benefits (jobs, intelligence) scale with contribution (data, availability)
3. **Collective-choice arrangements** — Network governance includes participant voice
4. **Monitoring** — Transparent quality metrics, delivery tracking
5. **Graduated sanctions** — Reputation scoring, capability verification
6. **Conflict resolution** — Dispute mechanisms for quality, payment, scheduling
7. **Recognized rights to organize** — Orgs can form sub-networks (capability clusters)
8. **Nested enterprises** — The network is a network of networks, not a monolith

### 1.3 Why This Hasn't Been Built

Several factors explain why manufacturing commons at this scale don't exist yet:

1. **IIoT platforms assumed enterprise scale** — Siemens, PTC, AVEVA target companies with IT departments. A $50/month subscription for a solo machinist doesn't exist.
2. **Onboarding friction** — Connecting to existing platforms requires weeks of integration work. For small shops, this is prohibitive.
3. **Data sovereignty fears** — Small manufacturers won't share operational data with a platform controlled by a large competitor.
4. **No network-level entity model** — Existing platforms model equipment, not organizations-as-participants.
5. **Missing economic layer** — IIoT platforms track machine state but don't connect state to market signals (availability, pricing, capability matching).

---

## 2. Cloud Manufacturing and MaaS Literature

### 2.1 Cloud Manufacturing (CMfg)

Cloud Manufacturing extends cloud computing concepts to manufacturing, where distributed manufacturing resources are provided as services over the internet [TAO-CMFG-2011]. The seminal work by Tao et al. defined CMfg as:

> "A new manufacturing paradigm... that manages manufacturing resources and capabilities... providing various manufacturing services for the full lifecycle of manufacturing."

Key CMfg architectural concepts relevant to our design:

| CMfg Concept | Our Equivalent | Extension |
|---|---|---|
| Manufacturing Cloud | Atlanta Manufacturing Network | Geographic scope + civic mission |
| Cloud Service Provider | Participating Organization | Any size, from 1 person to 1,000 |
| Cloud Service Consumer | Job Requester | Any participant can also be a consumer |
| Service Matching | Capability Discovery + Routing | Real-time, event-driven matching |
| QoS Monitoring | Entity State + Reputation | Live operational data, not just SLAs |

### 2.2 Manufacturing-as-a-Service (MaaS)

Tedaldi and Miragliotta's 2023 study of early MaaS adopters [TEDALDI-MAAS-2023] identified six operational Cloud Manufacturing platforms and analyzed their deployment models. Key findings:

1. **Two deployment archetypes**: Marketplace (matchmaking only) vs. Managed (platform orchestrates production)
2. **Service matching is the critical gap**: "The matching of trading partners is barely described in the literature; few findings suggest a matchmaking process on the marketplace"
3. **Trust is the adoption barrier**: Small manufacturers resist platforms where data flows to competitors

**Our differentiation**: We provide real-time entity state as the matchmaking signal. When a machine goes IDLE, that's not just an operational event — it's a market signal. No existing MaaS platform has live equipment-state-driven matching.

### 2.3 EFPF — European Connected Factory Platform

The EU Horizon 2020 EFPF project [EFPF-2020] is the closest existing analog to our manufacturing commons. EFPF federated four existing smart factory platforms through a common "Data Spine":

**Architecture parallels:**

| EFPF Component | Our Equivalent |
|---|---|
| Data Spine (federated data exchange) | NATS-based EventDistribution |
| Factory Connectors (edge adapters) | Sparkplug/MQTT ingestion adapters |
| Service Registry | Capability discovery via entity state |
| Security Token Service | NATS account-based multi-tenancy [NATS-ACCOUNTS] |
| Collaboration Environment | Network-level entity interactions |

**Where EFPF falls short:**
- **Batch-oriented**: EFPF exchanges documents and data sets, not real-time event streams
- **Project-scoped**: Built for specific manufacturing collaborations, not always-on marketplace
- **No real-time entity state**: No concept of live equipment state as a network resource
- **Limited scale**: Designed for dozens of participants, not 200K+
- **No propagation semantics**: Data exchange is point-to-point, not hierarchical event propagation

### 2.4 Gale-Shapley for Manufacturing Resource Matching

Zhang et al. applied the Gale-Shapley stable matching algorithm to cloud manufacturing resource allocation [ZHANG-GS-CMfg-2015], where:
- Manufacturing tasks express preferences over available machines
- Machines express preferences over tasks (based on capability fit, utilization)
- The algorithm finds a stable matching that maximizes overall satisfaction

**Relevance**: Our capacity marketplace could use similar matching algorithms, but augmented with real-time state. Gale-Shapley assumes static preferences; our system has dynamic preferences that change as machine states change.

---

## 3. Platform Economics Applied to Manufacturing

### 3.1 Two-Sided Market Dynamics

Rochet and Tirole's foundational work on two-sided markets [TWO-SIDED] applies directly:

- **Side 1 (Demand)**: Organizations needing manufacturing services — parts, prototypes, production runs
- **Side 2 (Supply)**: Organizations with manufacturing capability and available capacity
- **Platform**: The manufacturing commons that matches demand to supply

The classic chicken-and-egg problem [PARKER-PLATFORM] is acute: why would Earl join if there are no jobs? Why would a buyer use the network if there aren't enough capable shops?

**Our solution**: The platform provides immediate value BEFORE the marketplace matures:
1. **Phase 1 (standalone)**: Equipment monitoring, OEE tracking, maintenance prediction — value for Earl even with zero network effects
2. **Phase 2 (local network)**: Peer visibility — "Which shops in my area have similar equipment?" — community building
3. **Phase 3 (marketplace)**: Active capacity matching and job routing — full network effects

This follows the "come for the tool, stay for the network" strategy identified by Parker et al. [PARKER-PLATFORM].

### 3.2 Network Effects and Metcalfe's Law

Metcalfe's Law [METCALFE-LAW] states network value scales with the square of participants. For our manufacturing commons:

- At 100 participants: Local visibility, limited matching
- At 1,000 participants: Meaningful capability coverage, predictive maintenance from fleet data
- At 10,000 participants: Rich marketplace, supply chain resilience, collective quality intelligence
- At 200,000 participants: Metropolitan-scale manufacturing operating system with full economic dynamics

**Critical mass estimation**: Based on Atlanta's manufacturing ecosystem (approximately 5,000+ machine shops and manufacturers in the metro area), achieving 10-20% penetration (500-1,000 shops) would provide sufficient capability coverage for most common manufacturing operations.

### 3.3 Information Asymmetry and Trust

Shapiro and Varian's analysis of information goods [SHAPIRO-VARIAN] identifies the core tension: manufacturing capability information is the product, but sharing it creates vulnerability.

**Earl's dilemma**: If he publishes "CNC-1: IDLE, 4 hours available," competitors know his utilization rate. If he doesn't publish, the network can't route jobs to him.

**Resolution through selective disclosure**:

| Data Category | Visibility | Rationale |
|---|---|---|
| Capability list (what I can make) | Network-wide | Required for matching |
| Availability (am I free?) | Network-wide, aggregated | "Available" / "Busy" binary |
| Utilization rate | Private | Competitive intelligence |
| Specific job details | Bilateral (requester + provider only) | Trade secret |
| Quality history | Anonymized aggregate | Builds trust without exposure |
| Pricing | Bilateral or posted | Market dynamics |

This is architecturally enforced through NATS account isolation [NATS-ACCOUNTS] with explicit export/import rules per data category.

### 3.4 Transaction Cost Economics

Coase's theory of the firm [COASE-FIRM] and Williamson's transaction cost economics [WILLIAMSON-TCE] explain why small manufacturers currently operate in isolation: the transaction costs of finding, vetting, and coordinating with peers exceed the benefits.

The manufacturing commons reduces transaction costs by:
1. **Search costs**: Capability discovery replaces cold-calling and trade show networking
2. **Verification costs**: Transparent quality metrics and on-time delivery history
3. **Coordination costs**: Automated work order routing and status tracking
4. **Enforcement costs**: Escrow, dispute resolution, reputation systems

When transaction costs drop below a threshold, new forms of collaboration emerge that were previously uneconomical — ad hoc job sharing, overflow routing, capability pooling.

---

## 4. Federated Manufacturing Networks

### 4.1 Federation vs. Centralization

The manufacturing commons must be **federated**, not centralized. Key distinction:

| Property | Centralized Platform | Federated Network |
|---|---|---|
| Data ownership | Platform owns data | Each org owns its data |
| Trust model | Trust the platform | Trust is peer-to-peer |
| Governance | Platform sets rules | Participants govern collectively |
| Single point of failure | Platform goes down = all stop | Network degrades gracefully |
| Vendor lock-in | High | Low (data portability) |
| Pricing power | Platform extracts rent | Competitive, transparent |

### 4.2 NATS as Federation Infrastructure

NATS provides native federation primitives [NATS-ACCOUNTS], [NATS-LEAFNODE], [NATS-DECENTRALIZED]:

**Account-based multi-tenancy:**
- Each organization is a NATS account
- Accounts are isolated by default — no cross-account visibility
- Explicit `exports` and `imports` define what data crosses boundaries
- JWT-based decentralized authentication [NATS-DECENTRALIZED] — no central auth server required

**Leaf nodes for edge connectivity:**
- Earl's $50 edge device connects via NATS leaf node
- Leaf nodes authenticate with the account's JWT
- Subjects are automatically mapped between leaf and hub
- Works over unreliable connections with automatic reconnection

**Subject mapping for selective disclosure:**
```
# Earl's account exports availability (aggregated) to the network
exports:
  - stream: "org.earls-machine-works.availability.>"  # Public

# Earl's account does NOT export raw readings
# iiot.readings.* stays within Earl's account boundary

# The network account imports availability from all participants
imports:
  - stream: "org.*.availability.>"  # Aggregated marketplace view
```

### 4.3 Blockchain-Based Manufacturing Governance

Recent research on blockchain-based manufacturing collaborative platforms [BLOCKCHAIN-MFG-GOV-2024] proposes a three-layer governance framework:
1. **Off-chain community layer**: Human governance, dispute resolution
2. **On-chain DAO layer**: Automated governance rules, voting
3. **On-chain contract layer**: Smart contracts for escrow, SLAs

While we don't use blockchain, the governance framework is relevant. Our equivalent:
1. **Community layer**: Organization profiles, reputation, manual dispute resolution
2. **Protocol layer**: NATS account rules, automatic export/import policies
3. **Contract layer**: Work order state machines with escrow semantics via event sourcing

### 4.4 Data Cooperatives for Manufacturing

The data cooperative model [DATA-COOP-2023] provides a governance pattern where:
- Each participant contributes data (operational metrics, quality data, capability information)
- The cooperative aggregates and anonymizes data to produce collective intelligence
- Intelligence (maintenance predictions, quality benchmarks, market trends) flows back to participants
- No single participant can access another's raw data

This maps directly to our architecture:
- Raw data stays within each org's NATS account
- Aggregation services (running in the network tier) consume anonymized, exported events
- Collective intelligence is published to network-level subjects accessible to all participants

---

## 5. Telescoping ISA-95 for Variable-Scale Organizations

### 5.1 The Hierarchy Collapse Problem

ISA-95's equipment hierarchy [ISA-95-1] assumes large-scale manufacturing: Enterprise > Site > Area > Line > WorkCell > Machine > Device > Sensor. For a 2-person machine shop, this hierarchy collapses:

```
Full ISA-95 (Boeing supplier):     Collapsed (Earl's shop):
Enterprise                         Organization (= Enterprise + Site + Plant)
  Site                               CNC-1 (= Machine + Device)
    Area                               Spindle Temp Sensor
      Line                           Lathe-1 (= Machine + Device)
        WorkCell                       Vibration Sensor
          Machine
            Device
              Sensor
```

The hierarchy must support 1-8 levels of depth while maintaining consistent propagation semantics.

### 5.2 Telescoping Hierarchy Model

We propose a **telescoping hierarchy** where ISA-95 levels are optional structural markers, not mandatory layers:

**Level 0 (Minimum Viable)**:
```
Organization
  Equipment[]
```

**Level 1 (Small shop with grouping)**:
```
Organization
  WorkCell[]
    Equipment[]
```

**Level 2 (Medium facility)**:
```
Organization
  Area[]
    Line[]
      Equipment[]
```

**Level 3 (Full ISA-95)**:
```
Enterprise
  Site[]
    Area[]
      Line[]
        WorkCell[]
          Machine[]
            Device[]
              Sensor[]
```

**Key design constraint**: Propagation rules (U-1 through U-4, D-1 through D-3, L-1 through L-3 from [TMNL-REACTIVE-ISA95]) must work identically at any depth. A "worst-of" health roll-up from Equipment to Organization traverses the same algorithm whether it crosses 1 level or 6 levels.

### 5.3 Implementation: Parent-Child as Graph Edges

Rather than fixed hierarchy types, entities relate via generic `contains` edges in the asset graph:

```
Organization --contains--> Equipment              (depth 1)
Organization --contains--> WorkCell --contains--> Equipment  (depth 2)
Organization --contains--> Area --contains--> Line --contains--> Equipment  (depth 3)
```

Propagation rules traverse `contains` edges upward/downward regardless of what entity types are at each level. The entity TYPE determines behavior (state graphs, alarm semantics), but the STRUCTURE is flexible.

### 5.4 NATS Subjects for Variable Depth

The NATS subject hierarchy must accommodate variable depth:

```
# Fixed prefix: org identifier + event type
# Variable suffix: equipment path

# Earl's shop (depth 1):
iiot.readings.earls-machine-works.cnc-1.spindle-temp

# Medium factory (depth 3):
iiot.readings.acme-mfg.plant-a.line-1.press-3.pressure-sensor

# Full hierarchy:
iiot.readings.boeing-atl.site-1.area-north.line-A.cell-1.robot-3.torque-sensor
```

Wildcard subscriptions work at any level:
```
# All readings from Earl's shop:
iiot.readings.earls-machine-works.>

# All readings from any org:
iiot.readings.>

# All readings from Boeing ATL site-1:
iiot.readings.boeing-atl.site-1.>
```

---

## 6. Network-Level Reactive Semantics

### 6.1 The Network as a Reactive Entity

In our reactive ISA-95 model [TMNL-REACTIVE-ISA95], every entity in the hierarchy is a reactive stream source. The manufacturing commons adds a layer ABOVE the traditional ISA-95 top:

```
Network (Atlanta Manufacturing Commons)
  Cluster (capability group, e.g., "5-axis CNC Machining")
    Organization (Earl's Machine Works)
      [telescoping ISA-95 hierarchy]
```

The Network level has its own reactive semantics:

| Propagation | Direction | Example |
|---|---|---|
| **Upward** | Org -> Cluster -> Network | Earl's machine goes IDLE -> "Precision Machining" cluster availability increases -> network capacity heatmap updates |
| **Downward** | Network -> Cluster -> Org | Work order posted -> matched to "5-axis CNC" cluster -> routed to Earl's queue |
| **Lateral** | Org -> Org (via Cluster) | Earl's CNC faults -> overflow opportunity sent to peer shops in same cluster |

### 6.2 Entity State as Market Signal

The novel insight: within a single organization, entity state changes are operational events. At the NETWORK level, the same state changes become **market signals**:

| Entity State Change | Internal Meaning | Network Meaning |
|---|---|---|
| Machine: RUNNING -> IDLE | "Machine finished job" | "Capacity available" |
| Machine: RUNNING -> FAULTED | "Maintenance needed" | "Capability temporarily unavailable" |
| Machine: IDLE -> RUNNING | "Operator started new job" | "Capacity consumed" |
| Organization: all machines IDLE | "Slow day" | "High availability, may accept rush jobs" |
| Organization: all machines RUNNING | "Fully utilized" | "No capacity, don't route new jobs here" |

This dual interpretation requires an **event transformation layer** at the org boundary:
1. Internal events use detailed state (specific fault codes, sensor readings)
2. Network events use aggregated signals (available/busy, capability status, quality rating)
3. The transformation is controlled by the organization's disclosure policy

### 6.3 Capacity Marketplace Semantics

The capacity marketplace introduces event types that don't exist in traditional IIoT:

| Event Type | Publisher | Subscribers | Semantics |
|---|---|---|---|
| `CapabilityAdvertised` | Organization | Network marketplace | "I can do X with Y material at Z tolerance" |
| `AvailabilityChanged` | Organization | Network marketplace | "I have N hours available in next 7 days" |
| `JobPosted` | Requester | Matching engine | "I need 50 parts, spec attached" |
| `JobOffered` | Matching engine | Candidate organizations | "This job matches your capabilities" |
| `JobAccepted` | Organization | Requester + Network | "I'll take this job, ETA: 3 days" |
| `JobCompleted` | Organization | Requester + Network | "Job done, quality report attached" |
| `QualityVerified` | Requester | Network reputation | "Quality meets spec, 5/5" |
| `DisputeRaised` | Either party | Governance system | "Quality below spec, seeking resolution" |

These events form **sagas** that cross trust boundaries — a concept not present in any existing IIoT platform.

### 6.4 Network Health as Emergent Property

Just as a Plant's health is derived from its Lines' health (reactive ISA-95 upward propagation), the **Network's health** is derived from its Organizations' states:

```
NetworkHealth = aggregate(ClusterHealth[])
ClusterHealth = aggregate(OrgHealth[], weighted_by=capability_criticality)
OrgHealth = aggregate(EquipmentHealth[], per_org_rules)
```

Novel network-level health metrics:
- **Capability coverage**: What percentage of common manufacturing capabilities are available right now?
- **Redundancy factor**: For each capability, how many independent providers exist?
- **Response latency**: How quickly do shops respond to job offers?
- **Quality index**: Rolling aggregate quality metrics across the network
- **Resilience score**: Can the network absorb N simultaneous shop outages without capability gaps?

---

## 7. Edge-First Architecture for Small Manufacturers

### 7.1 The $50 Edge Device Constraint

For the manufacturing commons to achieve 200K-org scale, onboarding must be trivial:

> "Plug in a $50 edge device, scan a QR code, you're on the network."

This constrains the architecture:
- **Compute**: ARM-based SBC (Raspberry Pi class), 1-4GB RAM
- **Connectivity**: WiFi or Ethernet, potentially cellular (LTE-M)
- **Reliability**: Must work offline, sync when connected
- **Software**: Minimal agent — NOT a full Effect runtime, NOT Kubernetes

### 7.2 Edge-Cloud Boundary

The Effect runtime lives in the cloud/regional infrastructure. Edge devices speak simple protocols:

```
Earl's Workshop                    Regional Cloud
┌──────────────────┐              ┌──────────────────────────────┐
│  $50 Edge Device │              │  Effect Runtime               │
│                  │              │  ┌─────────────────────────┐  │
│  MQTT/Sparkplug  │──internet──>│  │ Sparkplug Adapter       │  │
│  Agent           │              │  │ (TopicRouter, Processor) │  │
│                  │              │  └─────────────────────────┘  │
│  Sensors via     │              │  ┌─────────────────────────┐  │
│  Modbus/OPC-DA   │              │  │ Entity State Machines   │  │
│                  │              │  │ (per-org, per-equipment) │  │
│  Local display   │              │  └─────────────────────────┘  │
│  (optional)      │              │  ┌─────────────────────────┐  │
│                  │              │  │ Network Services         │  │
│  QR code setup   │              │  │ (matching, reputation)  │  │
└──────────────────┘              │  └─────────────────────────┘  │
                                  └──────────────────────────────┘
```

### 7.3 Offline-First Operation

When Earl's internet goes down:
1. Edge device continues collecting sensor data locally (circular buffer, last 24h)
2. Local display (if attached) shows machine state from local computation
3. MQTT agent queues messages with QoS 1 (at-least-once delivery)
4. When connection restores, queued messages sync to cloud
5. Entity state machines process backlog, updating health and availability
6. Network marketplace sees Earl's availability update with slight delay

**Consistency implication**: During offline periods, the network's view of Earl's capacity is stale. The marketplace must handle "availability advertised but shop unreachable" gracefully — timeouts on job offers, automatic de-listing after connectivity gap.

### 7.4 Progressive Capability Tiers

Not all organizations need the same edge capabilities:

| Tier | Hardware | Capabilities | Monthly Cost |
|---|---|---|---|
| **Tier 0** (Phone only) | Smartphone app | Manual status, job notifications, basic OEE | Free |
| **Tier 1** (Basic edge) | $50 SBC + sensors | Automatic machine state, temperature monitoring | ~$15/mo |
| **Tier 2** (Full edge) | $200 industrial gateway | Multi-machine, full sensor suite, local analytics | ~$50/mo |
| **Tier 3** (Enterprise) | On-prem server cluster | Full ISA-95 hierarchy, local Effect runtime, HA | Custom |

The platform must serve ALL tiers. Earl might start at Tier 0 (phone app, manually marking "available/busy") and graduate to Tier 1 when the network proves its value.

---

## 8. Two-Tier Consistency Model

### 8.1 Why Traditional Consistency Is Insufficient

Traditional distributed systems consistency models (linearizability, causal, eventual) [LAMPORT-1978], [BAILIS-EC] assume a single system with shared state. The manufacturing commons is NOT a single system — it's 200,000 independent systems that choose to share selected state.

### 8.2 Intra-Org Consistency

Within a single organization, our existing consistency guarantees [TMNL-CONSISTENCY] apply:

- **Per-entity causal ordering**: Guaranteed by NATS subject-based ordering and entity mailbox serialization [EFFECT-ENTITY]
- **Event sourcing replay**: Full reconstructive replay within org boundary
- **Strong consistency**: Equipment state machines enforce valid transitions

This is the "traditional" distributed systems problem, well-served by NATS JetStream [JETSTREAM] + Effect cluster [EFFECT-CLUSTER].

### 8.3 Inter-Org "Economic Consistency"

Across organization boundaries, a different consistency model is needed — one optimized for market dynamics, not data correctness:

| Property | Intra-Org | Inter-Org (Network) |
|---|---|---|
| **Ordering** | Per-entity causal | Saga-level causal (within a transaction) |
| **Staleness** | Sub-second | Seconds to minutes acceptable |
| **Conflict resolution** | State machine rejects invalid transitions | Optimistic concurrency with compensation |
| **Replay** | Reconstructive (rebuild state) | Audit-only (view history, no re-execution) |
| **Availability vs. Consistency** | CP within org | AP across orgs (availability trumps) |

**Formal definition**: Network events are **saga-eventually-consistent** — within a cross-org saga (job offer -> accept -> execute -> complete), events are causally ordered. Between independent sagas, events are eventually consistent with no ordering guarantees.

### 8.4 The Staleness Budget

For market signals, staleness matters more than ordering:

| Signal Type | Useful Staleness Window | Beyond This, Discard |
|---|---|---|
| Equipment availability | < 5 minutes | > 30 minutes |
| Capability listing | < 1 hour | > 24 hours |
| Quality rating | < 1 day | > 30 days |
| Job offer response | < 15 minutes | > 2 hours |
| Active job status | < 5 minutes | > 1 hour |

Events arriving outside their staleness window should be treated as informational (audit trail) not actionable (don't route jobs based on 2-hour-old availability).

---

## 9. Persona-Adaptive Realtime

### 9.1 Realtime Is Persona-Relative

Our previous research [TMNL-REACTIVE-ISA95] defined realtime by ISA-95 level:
- L0-L1: Microseconds to seconds (telemetry)
- L2: Seconds (supervisory)
- L3: Seconds to minutes (operations)
- L4: Minutes to hours (business)

The manufacturing commons reframe reveals: **realtime is defined by PERSONA, not by level.** The same data has different latency requirements for different humans.

### 9.2 Persona Latency Matrix

| Persona | Critical Data | Acceptable Latency | Interface |
|---|---|---|---|
| **Earl (solo machinist)** | Machine status, new jobs | 1-30 seconds | Phone notification |
| **Shop foreman (5-person shop)** | All machine status, job queue | 1-5 seconds | Tablet dashboard |
| **Plant manager (100-person factory)** | OEE, alarms, schedules | 5-60 seconds | Multi-monitor control room |
| **Operations VP (multi-plant)** | KPIs, exceptions | 1-5 minutes | Executive summary app |
| **Network participant (any)** | Capacity signals, job offers | 5-60 seconds | Marketplace interface |
| **Network operator (commons admin)** | Health, coverage, disputes | 30-300 seconds | Network operations center |

### 9.3 Network-Derived Intelligence

The most novel "realtime" capability is intelligence that can only exist at network scale:

**Predictive maintenance from fleet data**: Earl has 1 CNC machine with 2 years of data. Alone, he can't predict failures. But 5,000 similar CNCs across the network provide enough data for predictive models. When the network's ML model detects a pattern in Earl's vibration data that precedes spindle failure (based on 500 other machines' failure histories), it alerts Earl.

This is Endsley's Level 3 situational awareness [ENDSLEY-1995] — projection — delivered through network intelligence rather than individual sensor history. No existing IIoT vendor offers this at the small-shop level because no vendor has the fleet-scale data from independent organizations.

**Collective quality intelligence**: When multiple shops report similar quality issues with the same material batch, the network can alert all shops working with that batch — before each shop discovers the problem independently.

**Pricing intelligence**: Anonymized aggregate pricing data helps small shops understand market rates. "Your quoted price for 5-axis titanium work is 15% below network average" helps Earl avoid underpricing.

### 9.4 Situational Awareness at Network Scale

Applying Endsley's three-level model [ENDSLEY-1995], [ENDSLEY-2012] to the manufacturing commons:

| SA Level | Individual Org | Network Level |
|---|---|---|
| **L1: Perception** | My machine states, sensor readings | Capability coverage map, active capacity |
| **L2: Comprehension** | My OEE, my backlog, my quality metrics | Supply/demand balance, network health, cluster status |
| **L3: Projection** | My maintenance predictions (limited data) | Fleet-derived predictions, trend analysis, demand forecasting |

The manufacturing commons uniquely enables **cross-level SA transfer**: network-level L3 intelligence (fleet predictions) feeds back as individual-level L1 data (maintenance alert on your phone).

---

## 10. Design Implications for the RFC

### 10.1 Entity Model Extensions

The RFC must define:

1. **Organization as first-class entity** — with state (active/idle/maintenance), capabilities, availability, reputation
2. **Capability schema** — what an org can make (materials, tolerances, certifications)
3. **Telescoping hierarchy** — 1-8 levels, consistent propagation at any depth
4. **Network-level entities** — Capability Clusters, Marketplace Listings, Work Order Sagas

### 10.2 Event Model Extensions

New event categories beyond traditional IIoT:

1. **Market events** — CapabilityAdvertised, AvailabilityChanged, JobPosted, JobAccepted, JobCompleted
2. **Reputation events** — QualityVerified, DeliveryRated, DisputeRaised, DisputeResolved
3. **Network health events** — ClusterHealthChanged, CapabilityCoverageChanged, RedundancyAlert
4. **Fleet intelligence events** — MaintenancePrediction, QualityAnomaly, PricingInsight

### 10.3 Consistency Model

The RFC must specify:

1. **Intra-org**: Per-entity causal ordering, event sourcing, strong state machine consistency
2. **Inter-org**: Saga-eventually-consistent, staleness-budgeted, audit-replay-only
3. **Boundary transformation**: How internal events become network signals (aggregation, anonymization)

### 10.4 Onboarding Architecture

The RFC must address:

1. **Tier 0** (phone only): REST API + WebSocket for manual status
2. **Tier 1** (basic edge): MQTT/Sparkplug to NATS bridge, auto-provisioned
3. **Tier 2** (full edge): Direct NATS leaf node, multi-sensor
4. **Tier 3** (enterprise): Full Effect runtime, on-prem cluster

### 10.5 Trust Architecture

The RFC must define:

1. **Data sovereignty**: Each org controls exports via NATS account rules
2. **Selective disclosure**: Aggregated signals vs. raw data vs. bilateral sharing
3. **Reputation transparency**: Quality/delivery metrics visible, raw operational data private
4. **Governance**: Ostrom-aligned principles for commons management

---

## 11. Codebase Reference Map

This section grounds every theoretical concept from Sections 1-10 in actual implementation files within the TMNL codebase. Per directive: "When you write 'Entity X does Y', cite the file."

### 11.1 Entity System — What Exists Today

The current entity system implements the **single-organization** model. The manufacturing commons extends this to multi-organization, but the per-org entity machinery is already built.

| Concept | Codebase File | What It Provides |
|---|---|---|
| **Entity definitions** (15 entities) | `src/lib/iiot/entity/index.ts` | Barrel exports for AlarmEntity (EVENT SOURCED), WorkOrderEntity (EVENT SOURCED), EquipmentStateEntity (EVENT SOURCED), AssetEntity, SensorEntity |
| **ISA-95 asset entities** (9 types) | `src/lib/iiot/entity/{Enterprise,Site,Area,Plant,Line,WorkCell,MachineAsset,Device,SensorAsset}Entity.ts` | Full ISA-95 hierarchy as Effect Cluster entities — **these map directly to the telescoping hierarchy** (Section 5) |
| **Entity Layer composition** | `src/lib/iiot/entity/EntityStack.ts` | `EntityHandlersLayer` merges 12 handler layers; `EntityTestingStack` adds in-memory state services |
| **Branded identifiers** | `src/lib/iiot/schemas/identifiers.ts` | 20+ branded ID types: `EnterpriseId`, `SiteId`, `AreaId`, `PlantId`, `LineId`, `WorkCellId`, `MachineId`, `SensorId`, `DeviceId`, `AssetId`, `AlarmId`, `WorkOrderId`, etc. |
| **EquipmentLevel enum** | `src/lib/iiot/schemas/identifiers.ts:28-38` | `Schema.Literal('enterprise', 'site', 'area', 'plant', 'line', 'workcell', 'machine', 'sensor', 'device')` — **the 9-level hierarchy that must telescope** |
| **Enterprise schema** | `src/lib/iiot/schemas/assets/enterprise/schema.ts` | `Enterprise` Schema.TaggedClass with `EnterpriseStatus` (active/restructuring/merged/dissolved), `getAutomationLevel() => 4`, `isContainer() => true`, `materializePath()` — **the top of the current ISA-95 hierarchy** |

**Manufacturing commons extension needed**: An `Organization` entity above or alongside `Enterprise` that represents a network participant. `EnterpriseId` serves as the org identity within the current model; the network-level entities (Cluster, Marketplace) don't exist yet.

### 11.2 State Machines & Transition Graphs — Per-Org Operational Logic

The state machine infrastructure validates all equipment state transitions. This is the **intra-org consistency** mechanism (Section 8.2).

| Concept | Codebase File | What It Provides |
|---|---|---|
| **12 state transition graphs** | `src/lib/iiot/machines/graphs/index.ts` | Graph.directed definitions for all entity types: alarm (ISA-18.2), work order (FDA 21 CFR Part 11), equipment state (OEE), enterprise, site, area, plant, line, workcell, machine-asset, device, sensor |
| **12 state machines** | `src/lib/iiot/machines/{Enterprise,Site,Area,Plant,Line,WorkCell,MachineAsset,Device,SensorAsset,Alarm,WorkOrder,EquipmentState}Machine.ts` | Machine implementations that enforce graph-validated transitions |
| **Equipment state as market signal** (Section 6.2) | `src/lib/iiot/machines/graphs/machine-asset-graph.ts` | `canActivate`, `canGoIdle`, `canResume`, `canMarkFaulted` — the transitions that become market signals at network level |
| **12 state services** | `src/lib/iiot/state/index.ts` | Swappable persistence (InMemory for tests, SQL for production) for all 12 entity types |
| **All-in-one test stack** | `src/lib/iiot/state/index.ts:132-147` | `AllStateServicesInMemory` — Layer.mergeAll of 12 InMemory state services |

**Manufacturing commons implication**: Machine state transitions (IDLE, RUNNING, FAULTED) already exist as graph-validated operations. The **event transformation layer** (Section 6.2) needs to map these internal state changes to network-level aggregated signals via the ReactivityBridge.

### 11.3 Realtime Stack — The Cross-Org Event Pathway

The realtime stack provides the plumbing for events to flow from entity handlers to WebSocket subscribers. For the manufacturing commons, this same plumbing must extend across org boundaries via NATS.

| Concept | Codebase File | What It Provides |
|---|---|---|
| **EventDistribution** (4-channel hub) | `src/lib/iiot/realtime/event-distribution.ts` | 4 ChannelService channels: `iiot:readings` (maxLag 10K), `iiot:alarms`, `iiot:equipment`, `iiot:invalidations` (maxLag 1K each). Dual-writes to local PubSub AND NATS via HolonetBridge |
| **Event type schemas** | `src/lib/iiot/realtime/event-distribution.ts:41-70` | `ReadingEvent`, `AlarmEvent`, `EquipmentStateChange`, `CacheInvalidation` — Schema.TaggedClass events |
| **HolonetBridge** (NATS gateway) | `src/lib/iiot/realtime/holonet-bridge.ts` | Fire-and-forget NATS publish (outbound) + wildcard subscription streams (inbound). Uses `NatsPubSubService` for transport |
| **NATS subject definitions** | `src/lib/iiot/realtime/iiot-subjects.ts` | 4 subject specs: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`, `iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}` — **currently flat, must become hierarchical for variable-depth orgs** |
| **ReactivityBridge** (handler-to-EventDist adapter) | `src/lib/iiot/realtime/reactivity-bridge.ts` | Thin adapter called by entity handlers inline after writing to EventLog. Maps handler events to `EventDistribution.publish*()` calls |
| **Realtime RPC handlers** | `src/lib/iiot/realtime/realtime-handlers.ts` | Bridges EventDistribution outlet streams to RPC streaming responses |
| **WebSocket server** | `src/lib/iiot/realtime/websocket-server.ts` | RpcServer.layerProtocolWebsocketRouter at `/ws/iiot`, `RpcSerialization.layerJson` for browser compat |
| **Layer composition** | `src/lib/iiot/realtime/layers.ts` | Composes EventDistribution + ReactivityBridge + HolonetBridge + WebSocket layers |

**Manufacturing commons extension**: The current NATS subjects (`iiot.readings.{deviceId}`) are **single-org scoped**. For the network, subjects must include org identity: `iiot.readings.{orgId}.{equipmentPath}`. The HolonetBridge's account-based NATS isolation already supports this via NATS account boundaries.

### 11.4 RPC System — Client-Facing API Surface

| Concept | Codebase File | What It Provides |
|---|---|---|
| **17 RPC groups** | `src/lib/iiot/rpc/index.ts` | Combined `IIoTRpcs` group: SensorRpcs, AssetRpcs, AlarmRpcs, WorkOrderRpcs, EquipmentStateRpcs, PlantRpcs, LineRpcs, WorkCellRpcs, MachineAssetRpcs, DeviceRpcs, SensorAssetRpcs, EnterpriseRpcs, SiteRpcs, AreaRpcs, AssetEntityRpcs, SensorEntityRpcs, RealtimeRpcs |
| **4 streaming RPCs** | `src/lib/iiot/rpc/RealtimeRpcs.ts` | `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` — all `stream: true` with filters (deviceId, plantId, throttleMs, minSeverity, entityType) |

**Manufacturing commons extension**: Network-level RPCs don't exist yet. Needed: `SubscribeCapacity`, `PostJob`, `SubscribeJobOffers`, `GetNetworkHealth`, `QueryCapabilities`. These would be a separate `NetworkRpcs` group.

### 11.5 Ingestion Pipeline — Sensor Data Entry Point

| Concept | Codebase File | What It Provides |
|---|---|---|
| **Pipeline orchestrator** | `src/lib/iiot/adapters/ingestion-service.ts` | `IngestionService`: IngestionAdapter.subscribe -> ReadingProcessor.process -> AlarmDetector.checkReading -> Stream<ProcessedBatch> |
| **Sparkplug adapter** | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Sparkplug-B MQTT protocol adapter — **this is the edge device ingestion point** (Section 7.2) |
| **Topic router** | `src/lib/iiot/adapters/device-routing.ts` | Maps topic patterns to device IDs — **this is where variable-depth NATS subjects must be parsed** |
| **Alarm detection** | `src/lib/iiot/adapters/alarm-detection.ts` | Threshold-based alarm detection on ingested readings |
| **Pipeline layers** | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | `SparkplugPipelineLayer` composes all adapter components into a single Layer |

**Manufacturing commons implication**: Earl's $50 edge device publishes via MQTT/Sparkplug. The `SparkplugAdapterLive` already handles this protocol. The TopicRouter must be extended to resolve org-scoped routes (e.g., `spBv1.0/earls-machine-works/DDATA/cnc-1/spindle-temp`).

### 11.6 Fermion (Reactive State Atoms) — Client-Side Reactivity

| Concept | Codebase File | What It Provides |
|---|---|---|
| **Schema-driven atom families** | `src/lib/iiot/fermion/index.ts` | `sensorFermion` — Atom.family keyed by deviceId with Effect-based fetch. `workOrderFermion` with stats and list atoms |

**Manufacturing commons implication**: The Fermion pattern extends naturally to network-level atoms. A `networkCapacityFermion` keyed by capability type would provide reactive client-side state for marketplace views.

### 11.7 Concept-to-File Cross-Reference

This table maps each theoretical concept from Sections 1-10 to the specific codebase files that either implement it today or represent the closest extension point.

| Theoretical Concept | Section | Existing File(s) | Status |
|---|---|---|---|
| **ISA-95 equipment hierarchy** | 5.1 | `schemas/identifiers.ts` (EquipmentLevel enum), `entity/{Enterprise..Sensor}Entity.ts` | IMPLEMENTED — 9 levels, fixed |
| **Telescoping hierarchy** | 5.2 | `schemas/identifiers.ts:28-38` | EXTENSION NEEDED — currently all 9 levels are mandatory schema types; need parent-child generic edges |
| **Entity state as market signal** | 6.2 | `machines/graphs/machine-asset-graph.ts` (state transitions), `realtime/reactivity-bridge.ts` (event publication) | EXTENSION NEEDED — ReactivityBridge publishes intra-org events; network-level aggregation layer missing |
| **Event transformation at org boundary** | 6.2 | `realtime/holonet-bridge.ts` (NATS publish), `realtime/iiot-subjects.ts` (subject patterns) | EXTENSION NEEDED — HolonetBridge publishes raw events to NATS; needs aggregation/anonymization at org boundary |
| **Two-tier consistency** | 8 | `state/index.ts` (intra-org state services), `realtime/event-distribution.ts` (event channels) | PARTIAL — intra-org consistency implemented; inter-org saga consistency not yet designed |
| **NATS federation** | 4.2 | `realtime/holonet-bridge.ts`, `realtime/iiot-subjects.ts` | FOUNDATION — NATS transport exists; account-based multi-tenancy and subject mapping not yet implemented |
| **Edge ingestion** | 7.2 | `adapters/sparkplug-adapter.ts`, `adapters/ingestion-service.ts` | IMPLEMENTED — Sparkplug-B protocol adapter handles edge device MQTT |
| **Capacity marketplace events** | 6.3 | (none) | NOT IMPLEMENTED — new event types needed: CapabilityAdvertised, AvailabilityChanged, JobPosted, etc. |
| **Network health aggregation** | 6.4 | (none) | NOT IMPLEMENTED — requires Network and Cluster entities above Enterprise |
| **Persona-adaptive realtime** | 9 | `rpc/RealtimeRpcs.ts` (streaming subscriptions with filters) | PARTIAL — filters exist (throttleMs, minSeverity); persona-based filter presets not yet defined |
| **Progressive capability tiers** | 7.4 | `adapters/sparkplug-adapter.ts` (Tier 1-2), `rpc/RealtimeRpcs.ts` (Tier 0 via WebSocket) | PARTIAL — Tier 1-3 ingestion exists; Tier 0 phone-only interface not yet designed |
| **Fermion/atom reactivity** | 9.3 | `fermion/index.ts` (sensorFermion, workOrderFermion) | IMPLEMENTED — client-side reactive state; extend to network-level atoms |
| **Data cooperative aggregation** | 4.4 | (none) | NOT IMPLEMENTED — aggregation services for anonymized cross-org intelligence not yet designed |

### 11.8 Architecture Gap Summary

The codebase provides a complete **single-organization IIoT platform** with:
- 15 entity types covering the full ISA-95 hierarchy
- 12 state machine graphs enforcing valid transitions
- 4-channel event distribution with NATS bridge
- Sparkplug-B edge ingestion pipeline
- WebSocket streaming RPCs with filters
- Schema-driven reactive state (Fermion)

The manufacturing commons requires these **extensions** (ordered by dependency):

1. **Organization entity** — new entity type representing a network participant (extends Enterprise)
2. **NATS account provisioning** — automated account creation per org with export/import rules
3. **Subject hierarchy refactoring** — `iiot.{event}.{orgId}.{equipmentPath}` variable-depth subjects
4. **Aggregation layer** — transforms detailed internal events to network-level signals at org boundary
5. **Network-level entities** — Cluster, MarketplaceListing, CapacitySaga
6. **Marketplace RPCs** — SubscribeCapacity, PostJob, QueryCapabilities
7. **Fleet intelligence services** — cross-org aggregation with anonymization

---

## 12. References

All references use canonical citation keys. Full URLs and metadata are maintained in the project bibliography:

> **See [`docs/specifications/bibliography.md`](bibliography.md)**

### Citation Keys Used in This Document

#### Standards
[ISA-95-1], [ISA-95-2]

#### Platform Economics & Network Theory
[PARKER-PLATFORM], [OSTROM-COMMONS], [COASE-FIRM], [WILLIAMSON-TCE], [SHAPIRO-VARIAN], [METCALFE-LAW], [TWO-SIDED]

#### Distributed Systems
[LAMPORT-1978], [BAILIS-EC], [EFFECT-CLUSTER], [EFFECT-ENTITY], [JETSTREAM]

#### Cloud Manufacturing & MaaS
[TAO-CMFG-2011], [TEDALDI-MAAS-2023], [EFPF-2020], [ZHANG-GS-CMfg-2015], [BLOCKCHAIN-MFG-GOV-2024], [DATA-COOP-2023], [CMfg-REVIEW-2024]

#### Cognitive Science
[ENDSLEY-1995], [ENDSLEY-2012]

#### IIoT Platforms (Competitive Context)
[SIEMENS-INSIGHTS], [TWX-EVENTS], [AVEVA-SP]

#### NATS Infrastructure
[NATS-ACCOUNTS], [NATS-LEAFNODE], [NATS-DECENTRALIZED]

#### Internal Research
[TMNL-REACTIVE-ISA95], [TMNL-CONSISTENCY]

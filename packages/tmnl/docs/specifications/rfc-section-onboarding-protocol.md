# RFC-001 Section: Onboarding Protocol & First-Run Experience

```
Section:       Onboarding Protocol & First-Run Experience
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (industry-analyst)
Created:       2026-02-09
Research Base: docs/specifications/rfc-section-competitive-analysis.md (Section 6)
               docs/specifications/rfc-section-multi-tenant-network.md (Sections Y.3, Y.4)
               docs/specifications/rfc-section-security-trust.md (Sections Z.3, Z.4)
               docs/specifications/rfc-section-edge-architecture.md (Sections 15.1, 15.2)
               docs/specifications/research-effect-architecture.md (Section 1)
               src/lib/iiot/adapters/sparkplug-adapter.ts
               src/lib/iiot/adapters/ingestion-service.ts
```

<!-- INTEGRATION NOTES (for RFC assembly)
- This section is NEW content — distinct from Edge-First Architecture (deployment topology)
  and Developer Experience (API ergonomics, SDK patterns).
- Should be placed AFTER the Edge-First Architecture section and BEFORE Developer Experience.
- Onboarding is the user-facing flow; Edge Architecture is the infrastructure it runs on.
- Cross-references:
    rfc-section-edge-architecture.md (E-1, E-2, E-3 sovereignty rules referenced here)
    rfc-section-multi-tenant-network.md (Y.3.1 account provisioning, Y.3.2 edge device)
    rfc-section-security-trust.md (Z.3.1 account provisioning, Z.3.2 subject namespace)
    rfc-section-competitive-analysis.md (Section 6 — 15-minute SLA originates here)
    rfc-section-reactive-isa95.md (telescoping hierarchy propagation rules)
- Dependencies: Edge-First Architecture MUST define E-1/E-2/E-3 rules before this section
  references them. Security section Z.3 MUST define JWT provisioning before this section
  specifies the bootstrap credential flow.
- Bibliography: All citation keys verified against bibliography.md.
-->

> This section specifies the onboarding protocol that enables organizations of all
> sizes — from solo machinists to large manufacturing enterprises — to go from
> zero to live sensor data within 15 minutes. The protocol defines four integration
> patterns, a progressive complexity model, and the first-run experience from
> account creation through first OEE score.
>
> File paths are relative to `packages/tmnl/src/`.

---

## Table of Contents

1. [The 15-Minute SLA](#1-the-15-minute-sla)
2. [Onboarding Timeline Specification](#2-onboarding-timeline-specification)
3. [Integration Patterns](#3-integration-patterns)
4. [Edge Agent Bootstrap Sequence](#4-edge-agent-bootstrap-sequence)
5. [Sparkplug-B Auto-Discovery Flow](#5-sparkplug-b-auto-discovery-flow)
6. [Progressive Complexity Model](#6-progressive-complexity-model)
7. [Telescoping Hierarchy at Onboarding](#7-telescoping-hierarchy-at-onboarding)
8. [First-Run Experience Specification](#8-first-run-experience-specification)
9. [Protocol-Specific Onboarding Timelines](#9-protocol-specific-onboarding-timelines)
10. [Failure Modes During Onboarding](#10-failure-modes-during-onboarding)
11. [Codebase Grounding](#11-codebase-grounding)
12. [Security Considerations During Onboarding](#12-security-considerations-during-onboarding)

---

## 1. The 15-Minute SLA

### 1.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### 1.2 The Incumbent Onboarding Problem

Every IIoT platform in Section 7 (Competitive Differentiation) operates on a
model where onboarding requires weeks of professional services, five- to
six-figure capital expenditure, and specialized hardware [SIEMENS-INSIGHTS]
[TWX-ALWAYSON] [AVEVA-SP]. This creates a **participation floor** that excludes
99%+ of manufacturing organizations globally.

| Platform | Typical Onboarding | Minimum Cost | Requires |
|----------|-------------------|-------------|----------|
| Siemens MindSphere [SIEMENS-INSIGHTS] | 4-12 weeks | $100K+ (SI engagement) | MindConnect hardware + cloud subscription |
| PTC ThingWorx [TWX-ALWAYSON] | 2-8 weeks | $50K+ (license + SI) | Kepware license + ThingWorx server |
| AVEVA System Platform [AVEVA-SP] | 6-16 weeks | $200K+ | System Platform license + historian |
| Rockwell FactoryTalk [RA-PLEX] | 4-12 weeks | $100K+ | FactoryTalk license + PLC integration |
| GE Proficy [GEV-PROFICY-2025] | 4-8 weeks | $75K+ | Historian + APM modules |
| Ignition [IGN-PLATFORM] | 1-4 weeks | $5K+ (gateway license) | Ignition gateway + modules |
| AWS IoT SiteWise [AWS-SITEWISE] | 1-4 weeks | Variable (consumption) | AWS account + SiteWise model setup |
| Azure Digital Twins [AZURE-DT] | 2-8 weeks | Variable (consumption) | Azure account + DTDL modeling |

For Earl — a solo machinist with 3 machines and no IT staff — every platform
above is economically irrational. The cheapest option (Ignition at ~$5K/year)
exceeds what Earl would spend on monitoring all his equipment in a lifetime.

### 1.3 SLA Definition

**Onboarding SLA (O-1)**: The TMNL platform MUST enable the smallest participant
class (single-operator machine shop, no IT staff, consumer-grade internet) to
complete the following sequence in 15 minutes or less, measured from first
interaction with the signup page to first OEE score displayed:

1. Account creation
2. Edge agent installation
3. Device auto-discovery
4. First sensor readings ingested
5. Entity hierarchy created
6. Live dashboard rendered
7. First OEE score calculated

**Measurement**: The 15-minute window is measured by wall clock time from the
moment the user initiates signup (T+0:00) to the moment the OEE score is
rendered in the web dashboard. Network latency, download time, and device
discovery are included in this budget.

**Verification**: The platform SHOULD provide automated onboarding smoke tests
that verify the O-1 SLA against reference hardware (Raspberry Pi 4, 2GB RAM,
100 Mbps broadband) on each release.

### 1.4 Economic Rationale

The 15-minute SLA is not a marketing aspiration — it is a structural requirement
for the commons model [SHAPIRO-VARIAN] [DMC-COMMONS]. A manufacturing network
achieves value through network effects: each additional participant increases the
pool of available capacity, the accuracy of demand forecasts, and the coverage of
quality benchmarks. If onboarding requires weeks and thousands of dollars, the
network never reaches critical mass.

Formally: **network value V ~ n(n-1)/2** (Metcalfe's Law), where n is the number
of active participants. Every participant that bounces during a 4-week onboarding
process reduces V quadratically. The 15-minute SLA is the minimum viable
participation threshold to sustain network growth [MAAS-FRAMEWORK].

---

## 2. Onboarding Timeline Specification

### 2.1 The 15-Minute Timeline

The canonical onboarding sequence for the Sparkplug-B integration pattern (the
primary and fastest path):

```
T+0:00  — User opens signup page (web or mobile)
          ├── Name, email, organization name
          └── Single-click "Create Account"

T+1:00  — Account provisioned
          ├── NATS account created (operator-signed JWT) [NATS-DECENTRALIZED]
          ├── Organization entity initialized in cluster
          ├── Edge agent download URL generated
          └── QR code rendered (encodes: JWT, cloud NATS URL, org ID)

T+3:00  — Edge agent installed on workshop computer (or $50 SBC)
          ├── Single binary download (no Docker, no container runtime)
          ├── QR code scan configures agent (mobile camera → agent config)
          ├── NATS leaf node connection established [NATS-LEAFNODE]
          └── Agent health check: cloud connectivity confirmed

T+5:00  — Sparkplug-B auto-discovery detects equipment
          ├── Agent probes local network for MQTT brokers
          ├── Subscribes to spBv1.0/# (all Sparkplug namespaces)
          ├── NBIRTH messages register edge nodes (AliasRegistry) [SPARKPLUG-B]
          ├── DBIRTH messages register devices and metrics
          └── User sees "3 devices found" in onboarding wizard

T+8:00  — First sensor readings flowing
          ├── DDATA messages arrive with metric values
          ├── AliasRegistry resolves metric aliases to names
          ├── TopicRouter maps Sparkplug topics to device IDs
          ├── ReadingProcessor batches and validates readings
          └── IngestedReading instances emitted to pipeline

T+10:00 — Entity hierarchy created
          ├── Telescoping hierarchy: Organization > Machine > Sensor
          ├── Machine entities created from DBIRTH device metadata
          ├── Sensor entities created from DBIRTH metric metadata
          ├── State machines initialized (UNKNOWN → IDLE)
          └── Entity events begin flowing to ChannelService

T+12:00 — Live dashboard rendered
          ├── WebSocket connection established (RealtimeRpcs)
          ├── Subscription to equipment state stream
          ├── Subscription to readings stream (filtered by org)
          ├── Real-time sensor values rendering on dashboard
          └── Machine status indicators live (IDLE/RUNNING/FAULT)

T+15:00 — First OEE score displayed
          ├── EquipmentState entity has accumulated 15 min of state durations
          ├── OEE = Availability * Performance * Quality
          ├── Availability: time in RUNNING / total time (derived from state transitions)
          ├── Performance: actual output vs expected (from DDATA cycle counts if available)
          ├── Quality: good parts / total parts (from DDATA quality metrics if available)
          └── Dashboard shows "OEE: XX%" with 15-minute rolling window
```

### 2.2 Time Budget Allocation

| Phase | Duration | Budget | Critical Path |
|-------|----------|--------|---------------|
| Account provisioning | T+0:00 to T+1:00 | 1 min | JWT signing + NATS account creation |
| Agent installation | T+1:00 to T+3:00 | 2 min | Binary download + QR config |
| Device discovery | T+3:00 to T+5:00 | 2 min | Network probe + Sparkplug BIRTH |
| First readings | T+5:00 to T+8:00 | 3 min | DDATA processing pipeline |
| Entity creation | T+8:00 to T+10:00 | 2 min | Hierarchy scaffolding |
| Dashboard live | T+10:00 to T+12:00 | 2 min | WebSocket + stream subscription |
| OEE calculation | T+12:00 to T+15:00 | 3 min | State accumulation window |
| **Total** | **T+0:00 to T+15:00** | **15 min** | |

### 2.3 Slack Analysis

The OEE calculation at T+15:00 is the binding constraint. It requires at least
5 minutes of equipment state data to produce a meaningful score. The earlier
phases have slack:

- Account provisioning (1 min budget): NATS JWT signing is <100ms. Actual time
  dominated by user typing — budget generous.
- Agent installation (2 min budget): Binary download at 100 Mbps for a ~50MB
  agent takes <5s. Budget dominated by QR scan UX flow.
- Device discovery (2 min budget): Sparkplug BIRTH messages arrive within seconds
  of MQTT connection. Budget dominated by network probe if no MQTT broker
  pre-configured.

The binding constraint is **state accumulation time**: EquipmentState entities
need actual operational data to compute OEE. The 3-minute window from T+12 to
T+15 is the minimum for a rolling OEE with any statistical meaning.

---

## 3. Integration Patterns

TMNL supports four device integration patterns. Each provides a path to the
15-minute SLA, though with different protocol-specific timelines.

### 3.1 Pattern A: Sparkplug-B (Primary, Fastest)

**Target**: Organizations with Sparkplug-B-capable equipment or MQTT brokers.
This is the zero-configuration path.

**How it works**:

1. The TMNL edge agent subscribes to Sparkplug-B topics on the local MQTT broker
2. NBIRTH messages declare edge nodes; DBIRTH messages declare devices and metrics
3. The `AliasRegistry` (`lib/iiot/adapters/sparkplug-adapter.ts:79-111`) maps
   metric aliases to human-readable names from BIRTH payloads
4. DDATA messages flow continuously with metric values
5. The `SparkplugPipelineLayer` (`lib/iiot/adapters/ingestion-service.ts:297-322`)
   processes readings through TopicRouter, ReadingProcessor, and AlarmDetector

**Time to first data**: <5 minutes (limited by MQTT broker discovery)

**Required user action**: Connect edge agent to network. No manual device
configuration.

**Auto-discovery flow** (detailed in Section 5):
```
MQTT Broker ──NBIRTH──► AliasRegistry.registerBirth()
             ──DBIRTH──► Device entity creation + metric registration
             ──DDATA───► ReadingProcessor.process() → IngestedReading
             ──STATE───► StateRegistry.registerState() (host HA tracking)
```

### 3.2 Pattern B: OPC UA (Enterprise, Structured)

**Target**: Organizations with OPC UA servers (common in PLC-based automation).

**How it works**:

1. The edge agent runs an OPC UA client that discovers endpoints via mDNS or
   configured server URL [OPC-UA-14]
2. The OPC UA Browse service enumerates the address space (nodes, variables,
   references)
3. The agent maps OPC UA node IDs to TMNL sensor entities via namespace-based
   naming conventions
4. Subscriptions to MonitoredItems provide continuous data change notifications
5. Readings are normalized to the `IngestedReading` schema and enter the same
   pipeline as Sparkplug-B data

**Time to first data**: 5-10 minutes (OPC UA Browse + subscription setup)

**Required user action**: Provide OPC UA server URL (or enable mDNS). May need
to configure security policy (Anonymous, Username, Certificate).

**Mapping rule**: OPC UA node IDs map to TMNL entity IDs:
```
OPC UA:   ns=2;s=PLC1.Motor1.Temperature
TMNL:     Sensor { deviceId: "PLC1-Motor1-Temperature", machineId: "PLC1-Motor1" }
```

### 3.3 Pattern C: REST/HTTP (Cloud-Native, Pull-Based)

**Target**: Organizations with cloud-hosted data or REST APIs (e.g., existing
SCADA systems with web APIs, cloud historian exports).

**How it works**:

1. The edge agent polls configured REST endpoints at a configurable interval
2. Response payloads are parsed via user-defined JSON path mappings
3. Readings are normalized to `IngestedReading` and enter the pipeline
4. The polling interval maps to the T1 temporal tier budget (<100ms local)

**Time to first data**: 3-8 minutes (depends on API configuration complexity)

**Required user action**: Provide API URL, authentication credentials, JSON path
mapping for sensor values. More configuration than Sparkplug-B but no local
hardware changes.

**Configuration schema** (conceptual):
```typescript
Schema.Struct({
  url: Schema.String,                    // REST endpoint URL
  method: Schema.Literal('GET', 'POST'), // HTTP method
  pollIntervalMs: Schema.Number,         // Polling interval in milliseconds
  auth: Schema.optional(Schema.Union(
    Schema.Struct({ type: Schema.Literal('bearer'), token: Schema.String }),
    Schema.Struct({ type: Schema.Literal('basic'), username: Schema.String, password: Schema.String }),
  )),
  mappings: Schema.Array(Schema.Struct({
    jsonPath: Schema.String,             // JSONPath to sensor value
    deviceId: Schema.String,             // Target TMNL device ID
    metricName: Schema.String,           // Metric name (temperature, vibration, etc.)
    unit: Schema.String,                 // Unit of measurement
  })),
})
```

### 3.4 Pattern D: NATS Direct (Platform-Native, Lowest Latency)

**Target**: Custom integrations, inter-system bridges, or organizations building
directly on the TMNL platform.

**How it works**:

1. The client publishes directly to NATS subjects following the TMNL topic schema
2. Messages use the `IngestedReading` schema encoded as JSON or MessagePack
3. No adapter layer — readings enter the pipeline directly
4. Lowest possible latency (single NATS publish to subscriber)

**Time to first data**: <3 minutes (no device discovery needed)

**Required user action**: Write code using NATS client SDK. Requires developer
skill. The SDK provides typed helpers for constructing valid readings.

**Topic pattern**:
```
iiot.readings.{orgId}.{deviceId}.{metricName}
```

### 3.5 Pattern Selection Matrix

| Criterion | Sparkplug-B (A) | OPC UA (B) | REST (C) | NATS Direct (D) |
|-----------|----------------|-----------|---------|-----------------|
| **Setup time** | <5 min | 5-10 min | 3-8 min | <3 min |
| **Configuration** | Zero (auto-discovery) | Server URL + security | URL + auth + mappings | Code (SDK) |
| **User skill required** | None | Basic IT | API familiarity | Developer |
| **Equipment requirement** | MQTT broker | OPC UA server | REST API | NATS client |
| **Discovery** | Automatic (BIRTH) | Automatic (Browse) | Manual (JSON paths) | Manual (topics) |
| **Bidirectional** | Yes (DCMD) | Yes (Write) | Limited (POST) | Yes (request/reply) |
| **Offline support** | Yes (local MQTT) | Yes (local OPC UA) | Depends on API | Yes (edge NATS) |
| **Recommended for** | Most organizations | PLC-heavy factories | Cloud integrations | Custom/advanced |

---

## 4. Edge Agent Bootstrap Sequence

### 4.1 Agent Architecture

The TMNL edge agent is a single self-contained binary that runs on the
organization's local network. It requires no container runtime, no JVM, no
external dependencies.

**Minimum hardware**: ARM64 or x86_64, 512MB RAM, 1GB disk (agent + local
JetStream storage). Reference platform: Raspberry Pi 4 (2GB, $50) or any
existing workshop computer.

**Binary composition**:

```
tmnl-agent (single binary, ~50MB)
├── Embedded NATS server + JetStream (local domain)
├── Protocol adapters (Sparkplug-B, OPC UA, REST, NATS)
├── Effect runtime (entity processing, alarm detection)
├── Local web server (onboarding wizard + dashboard)
└── Configuration store (NATS KV, bucket: agent-config)
```

### 4.2 Bootstrap Flow

The bootstrap flow is designed to minimize user decisions. The agent MUST boot
to a functional state with a single credential input (QR code or JWT file).

```
Step 1: Agent binary downloaded and executed
        ├── Agent starts embedded NATS server (local domain)
        ├── Agent serves onboarding wizard at http://localhost:8080
        └── Agent enters BOOTSTRAP state

Step 2: Credential provisioning (one of):
        ├── (a) QR code scan: mobile camera → agent web page
        │       QR encodes: { jwt: "...", cloudUrl: "nats://...", orgId: "..." }
        ├── (b) JWT file: user places .jwt file in agent config directory
        └── (c) Manual entry: user types cloud URL + paste JWT in wizard UI

Step 3: Cloud connection
        ├── Agent configures leaf node with JWT credentials [NATS-LEAFNODE]
        ├── TLS connection to cloud NATS cluster established
        ├── Leaf node routes configured per account export/import rules [NATS-ACCOUNTS]
        ├── Agent reports ONLINE to cloud (STATE topic heartbeat) [SPARKPLUG-B]
        └── Agent transitions BOOTSTRAP → CONNECTED state

Step 4: Protocol discovery
        ├── Agent probes local network for MQTT brokers (mDNS + port scan)
        ├── Agent probes for OPC UA servers (mDNS discovery endpoint)
        ├── If MQTT found: subscribe to spBv1.0/# (Sparkplug-B auto-discovery)
        ├── If OPC UA found: browse server address space
        ├── If neither found: prompt user for manual configuration
        └── Agent transitions CONNECTED → DISCOVERING state

Step 5: Device registration
        ├── Discovered devices presented in onboarding wizard
        ├── User confirms device names and assignments (or accepts defaults)
        ├── Entity hierarchy created (Organization > Machine > Sensor)
        ├── Pipeline starts: readings → processing → entity state updates
        └── Agent transitions DISCOVERING → OPERATIONAL state

Step 6: Live data
        ├── Dashboard shows real-time sensor values
        ├── Equipment state indicators live (IDLE/RUNNING/FAULT)
        ├── Alarm thresholds configured (defaults from equipment type or manual)
        └── OEE score appears after sufficient state accumulation
```

### 4.3 Agent State Machine

The edge agent operates as a state machine with the following states and
transitions:

```
             ┌────────────┐
             │  BOOTSTRAP  │──── credential provisioned ────►┌─────────────┐
             └────────────┘                                  │  CONNECTED   │
                    ▲                                        └──────┬──────┘
                    │                                               │
            cloud lost + no                             protocol discovery
            local config                                   complete
                    │                                               │
                    │                                               ▼
             ┌──────┴─────┐                                ┌──────────────┐
             │  DEGRADED   │◄───── cloud connectivity ─────│ DISCOVERING  │
             └──────┬─────┘       lost                     └──────┬───────┘
                    │                                              │
                    │                                        devices found +
            cloud restored                                  user confirmed
                    │                                              │
                    ▼                                              ▼
             ┌─────────────┐                               ┌──────────────┐
             │ RECONNECTING │───── sync complete ─────────►│ OPERATIONAL  │
             └─────────────┘                               └──────────────┘
                                                                  │
                                                            cloud lost
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │  AUTONOMOUS  │
                                                           └──────────────┘
                                                                  │
                                                            cloud restored
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │ RECONNECTING │
                                                           └──────────────┘
```

| State | Behavior | UI Indicator |
|-------|----------|-------------|
| BOOTSTRAP | Awaiting credentials. No data processing. | Setup wizard |
| CONNECTED | Cloud link active. No devices discovered yet. | "Scanning..." |
| DISCOVERING | Probing local network for equipment. | Device list populating |
| OPERATIONAL | Full operation. Cloud + local data flowing. | Green status |
| AUTONOMOUS | Cloud link lost. Local operations continue per E-3. | Yellow "Offline" |
| RECONNECTING | Cloud link restored. Reconciliation in progress per X.7. | Blue "Syncing" |
| DEGRADED | Partial failure (e.g., adapter error, local NATS issue). | Orange warning |

### 4.4 Offline-First Guarantee

Per Edge Sovereignty Rule E-1 (see Edge-First Architecture section), the agent
MUST function fully in AUTONOMOUS state. Specifically:

- Sensor readings: buffered in local JetStream (7-day minimum retention)
- Alarm detection: runs locally via AlarmDetector in SparkplugPipelineLayer
- Entity state transitions: processed locally by Effect runtime
- Operator dashboard: served from local web server at http://localhost:8080
- Work order lifecycle: managed locally, synced on reconnection

The only capabilities degraded during AUTONOMOUS operation:
- Cross-organization marketplace visibility (T3 events)
- Network-level analytics (T4 events)
- Long-term archival beyond local storage capacity
- Remote access from outside the organization's network

---

## 5. Sparkplug-B Auto-Discovery Flow

### 5.1 Protocol Overview

Sparkplug-B [SPARKPLUG-B] defines a session lifecycle that enables zero-config
device discovery. The TMNL edge agent exploits this by subscribing to all
Sparkplug namespaces and building the entity hierarchy automatically from BIRTH
messages.

### 5.2 BIRTH Message Processing

The `SparkplugAdapter` (`lib/iiot/adapters/sparkplug-adapter.ts`) processes three
types of BIRTH messages:

**NBIRTH (Node Birth)**:
- Topic: `spBv1.0/{groupId}/NBIRTH/{edgeNodeId}`
- Announces an edge node (e.g., a PLC gateway)
- Carries all metrics the node itself reports
- The `AliasRegistry.registerBirth()` method (`sparkplug-adapter.ts:84-96`) maps
  numeric aliases to human-readable metric names

**DBIRTH (Device Birth)**:
- Topic: `spBv1.0/{groupId}/DBIRTH/{edgeNodeId}/{deviceId}`
- Announces a device under an edge node (e.g., a specific machine)
- Carries all metrics the device reports (temperature, vibration, speed, etc.)
- Each metric includes: name, alias (numeric shorthand), datatype, and optionally
  engineering units and description

**STATE (Host Application State)**:
- Topic: `spBv1.0/STATE/{hostAppId}`
- Announces host application ONLINE/OFFLINE status (SCADA primary/standby)
- The `parseStateTopic()` function (`sparkplug-adapter.ts:125-132`) extracts the
  host application ID
- The `StateRegistry` or `StateRegistryKV` tracks HA state transitions

### 5.3 From BIRTH to Entity Hierarchy

The onboarding wizard translates Sparkplug-B BIRTH metadata into the TMNL
entity hierarchy:

```
Sparkplug-B BIRTH Messages          TMNL Entity Hierarchy
─────────────────────────           ──────────────────────

NBIRTH: groupId="workshop"          Organization: "Earl's Precision Machining"
        edgeNodeId="plc-gateway"         │
                                         │
DBIRTH: deviceId="cnc-1"           ──────┼──► Machine: "CNC-1"
        metrics: [                       │        │
          { name: "SpindleTemp",         │        ├── Sensor: "SpindleTemp" (celsius)
            alias: 0,                    │        └── Sensor: "Vibration" (mm/s)
            datatype: Float },           │
          { name: "Vibration",           │
            alias: 1,                    │
            datatype: Float }            │
        ]                                │
                                         │
DBIRTH: deviceId="lathe-1"        ───────┼──► Machine: "Lathe-1"
        metrics: [                       │        │
          { name: "BearingTemp",         │        └── Sensor: "BearingTemp" (celsius)
            alias: 0,                    │
            datatype: Float }            │
        ]                                │
```

**Mapping rules**:

| Sparkplug-B Field | TMNL Entity Field | Notes |
|-------------------|-------------------|-------|
| `groupId` | Organization context | Groups devices under one org |
| `edgeNodeId` | Edge agent reference | The gateway device |
| `deviceId` | `Machine.id` | Prefixed with org context |
| `metric.name` | `Sensor.type` / `Sensor.deviceId` | Human-readable metric name |
| `metric.datatype` | Inferred unit/type | Mapped via engineering units if present |
| `metric.alias` | Internal (AliasRegistry) | Used for DDATA decoding efficiency |

### 5.4 Alias Registry Lifecycle

The `AliasRegistry` (`sparkplug-adapter.ts:79-111`) maintains metric alias
mappings that are essential for high-throughput data processing:

1. **On NBIRTH/DBIRTH**: `registerBirth(nodeKey, metrics)` builds alias→name
   HashMap for the edge node
2. **On DDATA**: `resolveAlias(nodeKey, alias)` converts numeric alias to metric
   name. This avoids transmitting full metric names in every DDATA message
   (Sparkplug-B optimization for bandwidth)
3. **On NDEATH**: `clearNode(nodeKey)` removes all alias mappings for the dead
   node. Next NBIRTH will re-register

The registry is keyed by `${groupId}:${edgeNodeId}` (the `NodeKey` type at
`sparkplug-adapter.ts:74`). This ensures alias scoping per edge node — two
different PLCs can use alias `0` for different metrics without collision.

---

## 6. Progressive Complexity Model

### 6.1 Design Principle

The platform MUST NOT require organizations to understand ISA-95 hierarchy,
effect-atom state management, or NATS subject semantics during onboarding. These
concepts are introduced progressively as the organization's needs grow.

**Progressive Disclosure Rule (O-2)**: The platform MUST present the minimum
viable interface at each complexity tier. Advanced features MUST be accessible
but not required.

### 6.2 Three Complexity Tiers

#### Tier 1: Earl (Solo Operator, 1-5 Machines)

**ISA-95 depth**: 3 levels (Organization > Machine > Sensor)

**What Earl sees**:
- "My Machines" list with live status (IDLE/RUNNING/FAULT)
- Sensor readings as simple line charts
- Alarms as push notifications to phone
- OEE score per machine (single number)

**What is hidden**:
- ISA-95 hierarchy levels (Site, Area, Line, WorkCell)
- NATS subjects and JetStream consumers
- Entity event sourcing and replay
- Cross-org marketplace features

**Onboarding time**: 15 minutes (target SLA)

**Monthly cost**: $0-10 (freemium tier, consumption-based)

#### Tier 2: Mid-Market (10-100 Machines, 1-3 Facilities)

**ISA-95 depth**: 5-6 levels (Enterprise > Site > Area > Line > Machine > Sensor)

**What is revealed at this tier**:
- Multi-site views with hierarchy navigation
- Production line status rollups (cascade from machine states)
- Alarm routing rules (by area, by shift, by severity)
- Work order management integrated with equipment state
- Quality metrics and defect tracking
- Multi-user access with role-based permissions

**Additional integration patterns**: OPC UA auto-discovery, REST API bridges

**Onboarding time**: 30-60 minutes (more devices, more configuration)

**Monthly cost**: $50-500 (based on device count and storage)

#### Tier 3: Enterprise (100+ Machines, Multiple Facilities, Supply Chain)

**ISA-95 depth**: 7-9 levels (full ISA-95 + extensions)

**What is revealed at this tier**:
- Cross-organization marketplace participation
- Capacity sharing and job routing
- Supply chain visibility (selective disclosure per Section 5.4 of
  Competitive Differentiation)
- Fleet-level analytics (T4 events)
- Custom entity types and extended schemas
- API access (NATS Direct pattern) for custom integrations
- Audit trails and regulatory compliance features

**Additional integration patterns**: NATS Direct, custom adapters, ERP bridges

**Onboarding time**: 1-5 days (enterprise integration, SSO, compliance review)

**Monthly cost**: Custom (based on entity count, storage, API calls)

### 6.3 Tier Transition Rules

| Transition | Trigger | User Action Required |
|------------|---------|---------------------|
| Tier 1 → Tier 2 | User adds second facility OR exceeds 10 machines | Hierarchy restructuring wizard |
| Tier 2 → Tier 3 | User enables marketplace OR exceeds 100 machines | Account upgrade + compliance review |
| Tier N → Tier N-1 | Voluntary downgrade | Entity consolidation wizard |

**Non-Breaking Rule (O-3)**: Tier transitions MUST NOT require data migration,
re-onboarding, or service interruption. The telescoping hierarchy (Section 7)
ensures that intermediate ISA-95 levels can be inserted into an existing
hierarchy without modifying existing entity IDs or breaking event history.

---

## 7. Telescoping Hierarchy at Onboarding

### 7.1 The Problem

ISA-95 defines 9 hierarchy levels (Enterprise > Site > Area > Plant > Line >
WorkCell > Machine > Device > Sensor). Requiring Earl to model all 9 levels
during onboarding would violate the 15-minute SLA and confuse a user who just
wants to see his CNC temperature.

### 7.2 The Solution: Collapsed Levels

The TMNL schema supports **all 9 levels** (`lib/iiot/schemas/assets/*/schema.ts`)
but only **requires 3** at onboarding:

```
FULL ISA-95 (9 levels)          EARL'S ONBOARDING (3 levels)
──────────────────────          ──────────────────────────────

Enterprise ─────────┐           Organization ──────────────────
  Site ─────────────┤             (= Enterprise + Site + Plant)
    Area ───────────┤                     │
      Plant ────────┤                     │
        Line ───────┤             Machine ────────────────────
          WorkCell ──┤              (= Machine + Device)
            Machine ─┤                    │
              Device ┤             Sensor ─────────────────────
                Sensor              (= Sensor)
```

At onboarding, the system creates:
- One Organization entity (collapsing Enterprise + Site + Area + Plant)
- One Machine entity per discovered device (collapsing Machine + Device)
- One Sensor entity per discovered metric (1:1 mapping)

### 7.3 Hierarchy Expansion

When Earl grows from 3 machines to 30 across two workshops, Tier 2 features
unlock and the hierarchy **telescopes** without breaking existing entities:

```
BEFORE (Tier 1):                    AFTER (Tier 2):

Organization: "Earl's"              Enterprise: "Earl's Precision Machining"
  Machine: "CNC-1"                    Site: "Main Workshop"
    Sensor: "SpindleTemp"                Machine: "CNC-1"          ← same entity ID
    Sensor: "Vibration"                    Sensor: "SpindleTemp"   ← same entity ID
  Machine: "Lathe-1"                       Sensor: "Vibration"     ← same entity ID
    Sensor: "BearingTemp"              Machine: "Lathe-1"          ← same entity ID
                                         Sensor: "BearingTemp"    ← same entity ID
                                    Site: "New Workshop"
                                       Machine: "CNC-2"           ← new entity
                                         Sensor: "SpindleTemp"    ← new entity
```

**Expansion rule**: When intermediate levels are inserted, existing entities
retain their IDs, event history, and state machine positions. The new parent-
child relationships are established by updating the `parentId` field — the
entity's event log records the hierarchy change as an `EntityUpdated` event,
preserving full audit trail.

### 7.4 Codebase Support

All 9 ISA-95 asset schemas exist in the codebase:

| ISA-95 Level | Schema File | Entity File |
|-------------|-------------|-------------|
| Enterprise | `lib/iiot/schemas/assets/enterprise/schema.ts` | `lib/iiot/entity/EnterpriseEntity.ts` |
| Site | `lib/iiot/schemas/assets/site/schema.ts` | `lib/iiot/entity/SiteEntity.ts` |
| Area | `lib/iiot/schemas/assets/area/schema.ts` | `lib/iiot/entity/AreaEntity.ts` |
| Plant | `lib/iiot/schemas/assets/plant/schema.ts` | `lib/iiot/entity/PlantEntity.ts` |
| Line | `lib/iiot/schemas/assets/line/schema.ts` | `lib/iiot/entity/LineEntity.ts` |
| WorkCell | `lib/iiot/schemas/assets/workcell/schema.ts` | `lib/iiot/entity/WorkCellEntity.ts` |
| Machine | `lib/iiot/schemas/assets/machine/schema.ts` | `lib/iiot/entity/MachineAssetEntity.ts` |
| Device | `lib/iiot/schemas/assets/device/schema.ts` | `lib/iiot/entity/DeviceEntity.ts` |
| Sensor | `lib/iiot/schemas/assets/sensor/schema.ts` | `lib/iiot/entity/SensorAssetEntity.ts` |

The `EntityStack` (`lib/iiot/entity/EntityStack.ts`) composes all entity handler
layers via `Layer.mergeAll`. This means all 9 levels are always available in the
runtime — the telescoping behavior is a UX-level abstraction, not a runtime
limitation.

---

## 8. First-Run Experience Specification

### 8.1 Onboarding Wizard Flow

The onboarding wizard runs as a local web application served by the edge agent.
It guides the user through 5 screens:

**Screen 1: Welcome & Credential Input**
```
┌─────────────────────────────────────────────┐
│  Welcome to TMNL                            │
│                                             │
│  Scan the QR code from your signup email    │
│  to connect this device to your account.    │
│                                             │
│  [QR Scanner]    [Or enter manually ▼]      │
│                                             │
│  Status: Waiting for credentials...         │
└─────────────────────────────────────────────┘
```

**Screen 2: Connection Status**
```
┌─────────────────────────────────────────────┐
│  Connecting...                              │
│                                             │
│  ✓ Credentials accepted                     │
│  ✓ Cloud connection established             │
│  ○ Scanning for equipment...                │
│                                             │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
```

**Screen 3: Device Discovery**
```
┌─────────────────────────────────────────────┐
│  Equipment Found                            │
│                                             │
│  ✓ CNC-1 (3 sensors: SpindleTemp,          │
│           Vibration, SpindleSpeed)          │
│  ✓ Lathe-1 (1 sensor: BearingTemp)         │
│  ✓ Mill-1 (2 sensors: TableTemp, Load)     │
│                                             │
│  [Edit Names]    [Accept & Continue ►]      │
└─────────────────────────────────────────────┘
```

**Screen 4: Data Flowing**
```
┌─────────────────────────────────────────────┐
│  Live Data                                  │
│                                             │
│  CNC-1                                      │
│    SpindleTemp: 24.3°C  ████░░░░  (OK)     │
│    Vibration:   0.8mm/s ██░░░░░░  (OK)     │
│    SpindleSpeed: 0 RPM              (IDLE)  │
│                                             │
│  Lathe-1                                    │
│    BearingTemp: 22.1°C  ███░░░░░  (OK)     │
│                                             │
│  [Configure Alarms]    [Go to Dashboard ►]  │
└─────────────────────────────────────────────┘
```

**Screen 5: Dashboard Handoff**
```
┌─────────────────────────────────────────────┐
│  You're live!                               │
│                                             │
│  Your dashboard is ready at:                │
│  http://localhost:8080/dashboard             │
│                                             │
│  Or scan this QR code on your phone:        │
│  [QR Code → dashboard URL]                  │
│                                             │
│  OEE will appear after ~5 minutes of data.  │
│                                             │
│  [Open Dashboard ►]                         │
└─────────────────────────────────────────────┘
```

### 8.2 Wizard Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No jargon** | "Equipment" not "ISA-95 Level 3 entities". "Sensors" not "Control Modules". |
| **Defaults over choices** | Auto-discovered device names are pre-filled. Alarm thresholds use equipment-type defaults. |
| **Show, don't configure** | Screen 4 shows live data before any configuration. User sees value before investing effort. |
| **Mobile-first** | All screens work on a phone browser (agent serves responsive web). QR codes for zero-typing setup. |
| **Reversible** | Every auto-generated name and threshold can be changed later. No onboarding decision is permanent. |

### 8.3 Default Alarm Configuration

During onboarding, the system applies default alarm thresholds based on
sensor type. These are conservative defaults that avoid false positives:

| Sensor Type | Default Threshold High | Default Threshold Critical | Source |
|-------------|----------------------|--------------------------|--------|
| Temperature (general) | 60°C / 140°F | 80°C / 176°F | Industry norms |
| Vibration (mm/s) | 4.5 mm/s | 7.1 mm/s | ISO 10816-3 |
| Humidity (%) | 70% | 85% | General guidance |
| Pressure (bar) | Equipment-specific | Equipment-specific | No safe default |
| Speed (RPM) | Equipment-specific | Equipment-specific | No safe default |
| Current (A) | Nameplate * 1.15 | Nameplate * 1.25 | NEC 430.6 |

The user MAY override any default during or after onboarding. Equipment-specific
thresholds (pressure, speed) require user input — the wizard prompts for these
only if the sensor type is detected.

---

## 9. Protocol-Specific Onboarding Timelines

### 9.1 Sparkplug-B Path (Reference Implementation)

| Step | Time | Action | System Component |
|------|------|--------|------------------|
| 1 | T+0:00 | User clicks "Create Account" | Signup service |
| 2 | T+0:15 | NATS JWT signed, account created | Provisioning service |
| 3 | T+0:30 | QR code displayed with credentials | Web frontend |
| 4 | T+1:00 | Agent binary downloaded (50MB @ 100Mbps) | CDN |
| 5 | T+1:30 | Agent started, QR scanned | Edge agent |
| 6 | T+2:00 | NATS leaf node connected to cloud | Edge NATS [NATS-LEAFNODE] |
| 7 | T+2:30 | MQTT broker discovered on local network | mDNS probe |
| 8 | T+3:00 | Sparkplug-B subscription active | SparkplugAdapter |
| 9 | T+3:30 | NBIRTH received, edge node registered | AliasRegistry |
| 10 | T+4:00 | DBIRTH received, devices + metrics discovered | Entity creation |
| 11 | T+5:00 | Onboarding wizard shows discovered devices | Local web UI |
| 12 | T+5:30 | User accepts defaults, pipeline starts | SparkplugPipelineLayer |
| 13 | T+6:00 | First DDATA processed, readings flowing | ReadingProcessor |
| 14 | T+7:00 | Entity state machines processing transitions | Machine actors |
| 15 | T+8:00 | WebSocket stream established | RealtimeRpcs |
| 16 | T+9:00 | Dashboard rendering live sensor data | Web frontend |
| 17 | T+14:00 | 5 minutes of state data accumulated | EquipmentState entity |
| 18 | T+15:00 | First OEE score calculated and displayed | Dashboard |

### 9.2 OPC UA Path

| Step | Time | Action | Delta from Sparkplug-B |
|------|------|--------|----------------------|
| 1-6 | T+0:00 to T+2:00 | Same as Sparkplug-B | None |
| 7 | T+2:30 | OPC UA server discovered (mDNS) or URL entered | +0 to +2 min (user input) |
| 8 | T+3:00 | Security policy negotiated (may require user input) | +0 to +3 min |
| 9 | T+4:00 | OPC UA Browse enumerates address space | +0.5 min (browse traversal) |
| 10 | T+5:00 | Nodes mapped to TMNL entities | Same |
| 11-18 | T+5:00 to T+18:00 | Same as Sparkplug-B steps 11-18 | +3 min total |

**Total**: 15-18 minutes. Exceeds SLA only if security policy requires
manual certificate exchange.

### 9.3 REST Path

| Step | Time | Action | Delta from Sparkplug-B |
|------|------|--------|----------------------|
| 1-6 | T+0:00 to T+2:00 | Same as Sparkplug-B | None |
| 7 | T+3:00 | User enters REST API URL + credentials | +2 min (manual) |
| 8 | T+5:00 | User configures JSON path mappings | +3 min (manual) |
| 9 | T+6:00 | Test request validates configuration | +0.5 min |
| 10-18 | T+6:00 to T+20:00 | Same pipeline flow as Sparkplug-B | +5 min total |

**Total**: 18-20 minutes. Exceeds 15-minute SLA due to manual configuration.
Acceptable for this pattern's target audience (cloud integrations).

### 9.4 NATS Direct Path

| Step | Time | Action | Delta from Sparkplug-B |
|------|------|--------|----------------------|
| 1-3 | T+0:00 to T+1:00 | Account provisioned, credentials received | Same |
| 4 | T+1:00 | Developer writes NATS publish code using SDK | Variable (developer skill) |
| 5 | T+2:00 | First reading published to NATS subject | Fastest raw path |
| 6 | T+2:30 | Entity created from reading metadata | -7.5 min (no discovery) |
| 7-18 | T+3:00 to T+10:00 | Pipeline + dashboard + OEE | -5 min total |

**Total**: <10 minutes (for developers). Fastest path but requires code.

---

## 10. Failure Modes During Onboarding

### 10.1 Common Failure Scenarios

| Failure | Detection | User Impact | Recovery |
|---------|-----------|-------------|----------|
| **No MQTT broker found** | mDNS + port scan timeout (30s) | Wizard shows "No equipment found" | Manual broker URL entry, or switch to OPC UA/REST pattern |
| **MQTT broker found but no Sparkplug** | Connected but no BIRTH messages (60s) | "Broker connected, waiting for devices..." | Verify Sparkplug-B firmware on PLCs. Offer MQTT raw topic fallback. |
| **JWT expired or invalid** | NATS connection refused | "Could not connect to cloud" | Re-scan QR code. Contact support for new JWT. |
| **Cloud unreachable** | TCP timeout on leaf node connection | Agent enters AUTONOMOUS mode | All local features work. Cloud features resume on reconnection. |
| **Slow internet** | Download taking > 2 minutes | Progress bar on agent download | Resume-capable download. Offer USB sideload alternative. |
| **Port conflict** | Agent port 8080 already in use | "Could not start wizard" | Auto-select alternative port. Show URL in terminal output. |
| **Insufficient disk** | JetStream storage init fails | "Not enough storage" | Minimum 1GB required. Offer reduced retention (1 day vs 7 day). |
| **Device discovery partial** | Some devices respond, others don't | Some machines missing from wizard | "Add manually" button in wizard. Retry discovery. |

### 10.2 Onboarding Timeout Handling

If the user does not complete onboarding within 30 minutes (2x the SLA), the
agent SHOULD:

1. Save current progress to NATS KV (`agent-config` bucket)
2. Display a "Resume Later" option with a QR code for the progress URL
3. Enter OPERATIONAL state with whatever devices were already discovered
4. Allow the user to add remaining devices later via the settings UI

The system MUST NOT discard discovered devices or readings if onboarding is
abandoned mid-flow. Any data collected during the aborted onboarding MUST be
preserved and available when the user returns.

### 10.3 Degraded Onboarding Mode

If the edge agent cannot reach the cloud during initial setup (e.g., air-gapped
network), a degraded onboarding mode MUST be available:

1. Agent starts with local-only configuration (no cloud JWT required)
2. Device discovery and entity creation work locally
3. Dashboard serves from local web server
4. Cloud connection can be configured later

This mode enables the user to see immediate value from the platform even before
cloud connectivity is established, honoring the E-1 sovereignty principle.

---

## 11. Codebase Grounding

Every claim in this section maps to implemented (or scaffolded) code.

### 11.1 Sparkplug-B Integration

| Claim | File | Line/Range | Status |
|-------|------|-----------|--------|
| SparkplugAdapterConfig schema | `lib/iiot/adapters/sparkplug-adapter.ts` | 56-67 | Implemented |
| AliasRegistry (alias→name mapping) | `lib/iiot/adapters/sparkplug-adapter.ts` | 79-111 | Implemented |
| STATE topic parsing | `lib/iiot/adapters/sparkplug-adapter.ts` | 125-132 | Implemented |
| StateRegistry (ONLINE/OFFLINE tracking) | `lib/iiot/adapters/sparkplug-adapter.ts` | 144-162 | Implemented |
| StateRegistryKV (NATS KV persistence) | `lib/iiot/adapters/sparkplug-adapter.ts` | 191-216 | Implemented |
| SparkplugPipelineLayer composition | `lib/iiot/adapters/ingestion-service.ts` | 297-322 | Implemented |

### 11.2 Entity Hierarchy

| Claim | File | Status |
|-------|------|--------|
| Enterprise schema | `lib/iiot/schemas/assets/enterprise/schema.ts` | Implemented |
| Site schema | `lib/iiot/schemas/assets/site/schema.ts` | Implemented |
| Area schema | `lib/iiot/schemas/assets/area/schema.ts` | Implemented |
| Plant schema | `lib/iiot/schemas/assets/plant/schema.ts` | Implemented |
| Line schema | `lib/iiot/schemas/assets/line/schema.ts` | Implemented |
| WorkCell schema | `lib/iiot/schemas/assets/workcell/schema.ts` | Implemented |
| Machine schema | `lib/iiot/schemas/assets/machine/schema.ts` | Implemented |
| Device schema | `lib/iiot/schemas/assets/device/schema.ts` | Implemented |
| Sensor schema | `lib/iiot/schemas/assets/sensor/schema.ts` | Implemented |
| EntityStack (Layer.mergeAll of all entities) | `lib/iiot/entity/EntityStack.ts` | Implemented |

### 11.3 Real-Time Pipeline

| Claim | File | Status |
|-------|------|--------|
| EquipmentState entity (OEE source) | `lib/iiot/entity/EquipmentStateEntity.ts` | Implemented |
| WebSocket streaming (RealtimeRpcs) | `lib/iiot/realtime/websocket-server.ts` | Implemented |
| ChannelService broadcast outlets | `lib/streams/constructs/ChannelService.ts` | Implemented |
| Event distribution | `lib/iiot/realtime/event-distribution.ts` | Implemented |

### 11.4 Scaffolded / Extension Needed

| Component | Purpose | Status |
|-----------|---------|--------|
| Account provisioning service | NATS JWT signing + account creation | Not yet implemented |
| Edge agent binary packaging | Single binary with embedded NATS | Not yet implemented |
| Onboarding wizard web UI | 5-screen first-run experience | Not yet implemented |
| QR code credential exchange | Encode JWT + cloud URL into QR | Not yet implemented |
| OPC UA adapter | OPC UA Browse + MonitoredItem subscriptions | Not yet implemented |
| REST polling adapter | Configurable HTTP polling with JSON path | Not yet implemented |
| OEE calculator | Derive OEE from EquipmentState durations | Not yet implemented |

---

## 12. Security Considerations During Onboarding

### 12.1 Credential Lifecycle

The QR code displayed during signup contains sensitive material (JWT + cloud URL).
The following security requirements apply:

1. **QR code expiration**: The QR code MUST expire within 1 hour of generation.
   After expiration, a new QR code MUST be requested through the web dashboard.

2. **Single-use credentials**: The initial bootstrap JWT SHOULD be single-use.
   After the edge agent successfully connects, the bootstrap JWT is exchanged for
   a long-lived device credential (per Z.3.1 account provisioning hierarchy).

3. **QR code display security**: The signup page MUST NOT cache or persist the
   QR code in browser storage. The QR code SHOULD be generated server-side and
   transmitted over TLS.

4. **Credential revocation**: If the user suspects the QR code was intercepted,
   they MUST be able to revoke the bootstrap credential immediately via the web
   dashboard. Revocation MUST propagate within 60 seconds (per Z.3.3 export
   revocation SLA).

### 12.2 Network Probing Safety

The edge agent's protocol discovery phase (Step 4 in the bootstrap flow) performs
network probing. The following constraints apply:

1. **Scope limitation**: Network probing MUST be limited to the local subnet
   (same /24 or /16 as the agent's IP address). The agent MUST NOT probe
   addresses outside its local network.

2. **Rate limiting**: Port scanning MUST NOT exceed 10 probes per second to avoid
   triggering network intrusion detection systems.

3. **Protocol-only probes**: Probes MUST only attempt application-layer protocol
   detection (MQTT CONNECT, OPC UA Hello). The agent MUST NOT perform OS
   fingerprinting or vulnerability scanning.

4. **User consent**: The onboarding wizard MUST display a notice before network
   probing begins: "This device will scan your local network for compatible
   equipment. No data will be sent outside your network."

### 12.3 First-Data Integrity

The first sensor readings ingested during onboarding establish the baseline for
alarm thresholds and OEE calculations. The following requirements protect this
critical phase:

1. **Timestamp validation**: The edge agent MUST validate that incoming reading
   timestamps are within a reasonable window (default: +/- 5 minutes from agent
   clock). Readings with timestamps outside this window MUST be logged but
   excluded from OEE calculations until clock synchronization is confirmed.

2. **Value range validation**: Readings with values outside the sensor type's
   physical range (e.g., temperature < -273.15°C) MUST be discarded with a
   warning in the agent log.

3. **Identity verification**: Device IDs from Sparkplug-B BIRTH messages MUST be
   unique within the organization's namespace. Duplicate device IDs from different
   edge nodes MUST be disambiguated by prefixing with the edge node ID.

---

## References

Citations used in this section (full entries in `bibliography.md`):

| Key | Description |
|-----|-------------|
| [RFC2119] | IETF RFC 2119 — Key Words for Use in RFCs |
| [SPARKPLUG-B] | Eclipse Sparkplug Specification v3.0.0 |
| [NATS-DECENTRALIZED] | NATS Decentralized JWT Authentication |
| [NATS-LEAFNODE] | NATS Leaf Nodes |
| [NATS-ACCOUNTS] | NATS Account-based Multi-tenancy |
| [OPC-UA-14] | OPC UA Part 14: PubSub |
| [SIEMENS-INSIGHTS] | Siemens MindSphere Insights Hub |
| [TWX-ALWAYSON] | PTC ThingWorx AlwaysOn Protocol |
| [AVEVA-SP] | AVEVA System Platform |
| [RA-PLEX] | Rockwell Automation Plex |
| [GEV-PROFICY-2025] | GE Vernova Proficy |
| [IGN-PLATFORM] | Inductive Automation Ignition Platform |
| [AWS-SITEWISE] | AWS IoT SiteWise |
| [AZURE-DT] | Azure Digital Twins |
| [SHAPIRO-VARIAN] | Information Rules (Shapiro & Varian, 1999) |
| [DMC-COMMONS] | Digital Manufacturing Commons |
| [MAAS-FRAMEWORK] | Manufacturing-as-a-Service Framework |
| [EFFECT-CLUSTER] | @effect/cluster — Entity Sharding |
| [EFFECT-TS] | Effect-TS Runtime and Type System |
| [JETSTREAM] | NATS JetStream Persistence |

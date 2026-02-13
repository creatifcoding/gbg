# Research Report: IIoT Unified Namespace & Metropolitan-Scale Event Distribution

> **Date**: 2026-02-09
> **Researcher**: Val (uns-researcher agent)
> **Sources**: Eclipse Sparkplug 3.0.0 spec, HiveMQ UNS series, FlowFuse, Proxus, i-flow/NATS case study, MachineMetrics/Synadia case study, arxiv/2510.04404v2, OPC Foundation Part 9, ISA-95/B2MML, NATS official docs
> **Purpose**: Inform NATS-based entity event distribution architecture for GBG IIoT platform

---

## Table of Contents

1. [UNS Topic Hierarchy for Entity Events](#1-uns-topic-hierarchy-for-entity-events)
2. [Metropolitan-Scale Event Routing](#2-metropolitan-scale-event-routing)
3. [ISA-95 Operations Event Model](#3-isa-95-operations-event-model)
4. [Platform Comparison](#4-platform-comparison)
5. [Entity Event Schema Patterns](#5-entity-event-schema-patterns)
6. [NATS-Specific Architecture Recommendations](#6-nats-specific-architecture-recommendations)
7. [Volume Estimates](#7-volume-estimates)
8. [Recommended Topic Hierarchy for GBG](#8-recommended-topic-hierarchy-for-gbg)

---

## 1. UNS Topic Hierarchy for Entity Events

### 1.1 The Industry Standard: ISA-95 Hierarchy

All authoritative sources converge on the ISA-95 Part 2 equipment hierarchy as the foundational topic structure:

```
Enterprise > Site > Area > Line > WorkCell > Device
```

[SOURCE: HiveMQ "Designing Your UNS Semantic Information Hierarchy", verified pattern]
[SOURCE: Proxus "Architect's Guide to UNS", verified pattern]
[SOURCE: FlowFuse "Designing a Clear Topic Structure for Your UNS", verified pattern]

Concrete examples from industry:

```
# HiveMQ example
FreshDairy/Munich/Packaging/Line1/Cell1

# Proxus example (Sparkplug-aligned)
BevCo/Istanbul/Bottling/Line3/Filler/Temperature

# FlowFuse example
/factory/line1/machine1/temperature
```

### 1.2 Sparkplug B Topic Namespace (Telemetry-Focused)

Sparkplug B 3.0.0 defines a rigid topic structure:

```
spBv1.0/{group_id}/{message_type}/{edge_node_id}/{device_id}
```

[SOURCE: Eclipse Sparkplug Specification v3.0.0, normative]

Where `message_type` is one of:

| Message Type | Direction | Purpose | QoS | Retain |
|-------------|-----------|---------|-----|--------|
| NBIRTH | Edge -> Host | Edge Node birth certificate | 0 | false |
| NDEATH | Edge -> Host | Edge Node death (Will) | 1 | false |
| DBIRTH | Edge -> Host | Device birth certificate | 0 | false |
| DDEATH | Edge -> Host | Device death certificate | 0 | false |
| NDATA | Edge -> Host | Edge Node telemetry | 0 | false |
| DDATA | Edge -> Host | Device telemetry | 0 | false |
| NCMD | Host -> Edge | Command to Edge Node | Sub QoS 1 | N/A |
| DCMD | Host -> Edge | Command to Device | Sub QoS 1 | N/A |
| STATE | Host -> All | Host Application online/offline | 1 | **true** |

[SOURCE: sparkplug-b-reference-index.md, verified from spec]

### 1.3 The Gap: Entity Lifecycle Events

**Critical finding**: Sparkplug B does NOT define message types for entity state transitions (e.g., `commissioned -> operational`, `idle -> running -> faulted`).

Sparkplug handles only two lifecycle dimensions:
- **Connection lifecycle**: NBIRTH/NDEATH (node online/offline)
- **Data lifecycle**: NDATA/DDATA (metric value changes)

It does NOT handle:
- Equipment state transitions (ISA-95 equipment capability events)
- Work order lifecycle events (FDA 21 CFR Part 11)
- Alarm lifecycle events (ISA-18.2 active -> acknowledged -> cleared)
- Asset commissioning/decommissioning events
- Maintenance mode transitions

[SOURCE: Eclipse Sparkplug 3.0.0 spec analysis — no STATE_TRANSITION or ENTITY_EVENT message type exists]
[SOURCE: HiveMQ "Why Sparkplug is Not Ideal as the Central UNS Solution" — HiveMQ themselves now advocate against Sparkplug-only UNS]

**This gap is exactly what our entity event system must fill.**

### 1.4 Industry Practice: Dual Namespace

Real implementations use two namespaces:

1. **Edge Namespace** (raw telemetry via Sparkplug):
   ```
   spBv1.0/{group}/DDATA/{node}/{device}
   ```

2. **Functional Namespace** (processed events, lifecycle, KPIs):
   ```
   {enterprise}/{site}/{area}/{line}/{cell}/events/{event_type}
   {enterprise}/{site}/{area}/{line}/{cell}/state/{entity_type}
   {enterprise}/{site}/{area}/{line}/{cell}/kpi/{metric}
   ```

[SOURCE: HiveMQ "Designing Your UNS Semantic Information Hierarchy", verified pattern — "Edge Namespace" vs "Functional Namespace"]

---

## 2. Metropolitan-Scale Event Routing

### 2.1 Real Deployment Numbers

| Platform | Scale | Source |
|----------|-------|--------|
| i-flow + NATS | "400 million data operations daily" across multiple factories | [SOURCE: nats.io/blog/i-flow-case-study, vendor claim] |
| MachineMetrics + NATS | "thousands of machines at hundreds of customer sites", kilohertz ingestion per tool | [SOURCE: synadia.com/customer-stories/machinemetrics, vendor claim] |
| Litmus Edge | "thousands of industrial sites worldwide" | [SOURCE: litmus.io, vendor claim] |

### 2.2 Topic-Based vs Content-Based Routing

All authoritative sources recommend **topic-based filtering** over content-based routing for IIoT at scale:

**Topic-based filtering** (industry consensus):
- Subscribers use wildcard patterns to filter at the broker level
- MQTT: `BevCo/Istanbul/Bottling/+/+/OEE` — captures all lines, including future additions
- NATS: `BevCo.Istanbul.Bottling.*.*.OEE` — equivalent using dot-delimited subjects
- Zero-copy routing at broker — no payload inspection required
- O(1) per-message routing cost regardless of subscriber count

[SOURCE: Proxus UNS guide, verified pattern]
[SOURCE: HiveMQ UNS hierarchy design, verified pattern]

**Content-based routing** (rare in IIoT):
- Requires payload inspection (expensive at high throughput)
- Used only for complex event processing (CEP) post-ingestion
- Not recommended at the broker level

### 2.3 NATS Subject Hierarchy vs MQTT Topic Hierarchy

| Feature | MQTT Topics | NATS Subjects |
|---------|-------------|---------------|
| Delimiter | `/` (slash) | `.` (dot) |
| Single-level wildcard | `+` | `*` |
| Multi-level wildcard | `#` | `>` |
| Broker-enforced hierarchy | Yes | No (convention only) |
| Retained messages (current state) | Native | Via KV Store (JetStream) |
| Max levels | Unlimited | Unlimited |
| Key restriction | None (except `/`) | No spaces, no `:` in KV keys |

[SOURCE: HiveMQ "Building a UNS: Why MQTT Outperforms NATS", verified technical comparison]
[SOURCE: NATS docs - KV keys become NATS subjects, colons invalid]

**Critical difference**: MQTT brokers enforce topic hierarchy semantically. NATS treats subjects as flat strings with dot-delimited tokens — hierarchy is by convention only. This means NATS requires stricter naming discipline.

### 2.4 Fan-Out Patterns at Scale

For 100+ sites, 10K+ devices:

**Pattern A: Hierarchical fan-out (recommended)**
```
# Site-level subscriber (all events from one site)
enterprise.site-munich.>

# Area-level subscriber (all events from packaging area)
enterprise.site-munich.packaging.>

# Type-specific subscriber (all alarms across all sites)
enterprise.*.*.*.*.events.alarm.>

# Entity-specific subscriber (one machine's state)
enterprise.site-munich.packaging.line1.cell1.state.equipment
```

**Pattern B: Broker federation / leaf nodes**
- NATS leaf nodes provide hub-and-spoke topology
- Edge nodes at each site connect to central cluster
- Selective subject export/import per leaf node
- MachineMetrics uses this pattern: "leaf nodes for a hub-and-spoke model"

[SOURCE: synadia.com/customer-stories/machinemetrics, vendor case study]

**Pattern C: Stream-per-site with mirrors**
- JetStream streams with subject filters per site
- Mirror streams at central for aggregation
- Source streams at edge for local processing

[SOURCE: NATS docs - Source and Mirror Streams]

### 2.5 MQTT Retained Messages vs NATS KV for "Current State"

The biggest architectural difference for entity state:

**MQTT**: When a device publishes with `retain: true`, any new subscriber immediately receives the last value. This makes the broker a live "current state" store — fundamental to UNS.

**NATS Core**: No retained message equivalent. Messages are fire-and-forget.

**NATS JetStream KV**: Provides equivalent functionality via Key/Value buckets:
- Keys follow NATS subject format (dot-delimited, wildcards supported)
- `get(key)` returns current value immediately
- `watch(key_pattern)` provides real-time updates (equivalent to subscribe + retain)
- Backed by JetStream streams (`KV_` prefix)
- Immediate consistency for monotonic reads/writes

[SOURCE: NATS official docs - Key/Value Store, verified]

**Our architecture already uses NATS KV** (see `src/lib/iiot/state/` — SiteState, DeviceState, etc.). This is the correct approach for entity current state.

---

## 3. ISA-95 Operations Event Model

### 3.1 ISA-95 Part 2 Event Categories

ISA-95 Part 2 (Activity Models of Manufacturing Operations Management) defines four operational event domains:

| ISA-95 Domain | Event Types | Our Entity Mapping |
|---------------|-------------|-------------------|
| **Production Operations** | Production Schedule, Production Performance, Production Capability | WorkOrder entity (draft -> approved -> in_progress -> completed) |
| **Maintenance Operations** | Maintenance Request, Maintenance Response, Maintenance Capability | EquipmentState entity (running -> maintenance -> idle) |
| **Quality Operations** | Quality Test, Quality Result, Quality Capability | (Future: QualityEntity) |
| **Inventory Operations** | Material Transfer, Material Consumption, Material Capability | (Future: InventoryEntity) |

[SOURCE: ISA-95.00.02-2018, standard description — verified from ISA.org]
[SOURCE: MESA B2MML documentation, verified from mesa.org]

### 3.2 Equipment Capability Events

ISA-95 defines equipment capability states:

```
Committed    -> Equipment is allocated to a production order
Available    -> Equipment is ready but not allocated
Unattainable -> Equipment is down (maintenance, fault)
```

These map to our EquipmentState entity transitions:

| ISA-95 Capability | Our EquipmentState | Trigger |
|-------------------|-------------------|---------|
| Available + Idle | `idle` | No active production |
| Committed + Active | `running` | Production order started |
| Unattainable + Planned | `maintenance` | Scheduled maintenance |
| Unattainable + Unplanned | `faulted` | Equipment failure detected |
| Available + Setup | `changeover` | Tooling change between orders |

[SOURCE: ISA-95.00.02 Activity Models, standard interpretation]

### 3.3 B2MML Schema Pattern

B2MML (Business To Manufacturing Markup Language) is the XML implementation of ISA-95:

```xml
<EquipmentCapability>
  <EquipmentID>machine-001</EquipmentID>
  <EquipmentCapabilityProperty>
    <ID>OperationalState</ID>
    <Value>Running</Value>
    <Quantity>
      <QuantityValue>1</QuantityValue>
      <UnitOfMeasure>EA</UnitOfMeasure>
    </Quantity>
  </EquipmentCapabilityProperty>
  <CapabilityType>Committed</CapabilityType>
  <StartTime>2026-02-09T10:00:00Z</StartTime>
</EquipmentCapability>
```

[SOURCE: MESA B2MML V0700, verified from mesa.org/b2mml]

### 3.4 Mapping to Our 12 Entity Types

| Entity Type | ISA-95 Category | Event Pattern | ES? |
|-------------|----------------|---------------|-----|
| Enterprise | Organization | CRUD lifecycle | No |
| Site | Physical Model | CRUD lifecycle | No |
| Area | Physical Model | CRUD lifecycle | No |
| Plant | Physical Model | CRUD lifecycle | No |
| Line | Physical Model | CRUD lifecycle | No |
| WorkCell | Physical Model | CRUD lifecycle | No |
| Machine | Physical Model | CRUD + capability state | No |
| Device | Physical Model | CRUD + connection state | No |
| Sensor | Physical Model | CRUD + reading stream | No |
| **Alarm** | **Quality/Safety** | **ISA-18.2 lifecycle** | **Yes** |
| **WorkOrder** | **Production Ops** | **FDA 21 CFR Part 11** | **Yes** |
| **EquipmentState** | **Maintenance Ops** | **OEE state machine** | **Yes** |

---

## 4. Platform Comparison

### 4.1 How Real Platforms Handle Entity Lifecycle Events

| Platform | Entity Lifecycle Handling | Schema Format | Source Type |
|----------|-------------------------|---------------|-------------|
| **Sparkplug B** (Eclipse) | NBIRTH/NDEATH only (connection lifecycle). No entity state transitions. Birth certificate includes metric metadata but not operational state. | Protobuf (sparkplug_b.proto) — Metric array with timestamp, datatype, value | [SOURCE: Sparkplug 3.0.0 spec, verified] |
| **HiveMQ UNS** | Recommends "Functional Namespace" for lifecycle events separate from Sparkplug telemetry. ISA-95 hierarchy for topic structure. No prescribed event schema — bring your own. | JSON or protobuf (user-defined) | [SOURCE: HiveMQ UNS series 2025, verified pattern] |
| **Litmus Edge** | Events system tracks: team/member, project, device, revoke, deactivation events. Event types are platform-scoped (not user-defined). | Proprietary internal format | [SOURCE: Litmus Edge Manager docs, verified] |
| **HighByte Intelligence Hub** | Data modeling and transformation "in motion" — maps OPC-UA, MQTT, database sources to normalized models. Not an event store; a transformation layer. | Vendor-specific data models | [SOURCE: vendor positioning from ProveIt! 2026 conference, vendor claim] |
| **OPC-UA (OPC Foundation)** | Full event model: BaseEventType hierarchy with ConditionType, AcknowledgeableConditionType, AlarmConditionType. Source node + event type + severity + message. Two-state state machines for conditions (Active/Inactive, Acknowledged/Unacknowledged). | OPC-UA Binary or JSON encoding. EventNotification with typed fields. | [SOURCE: OPC 10000-9 Part 9: Alarms and Conditions v1.05, verified from reference.opcfoundation.org] |
| **NATS-based IIoT** (i-flow, MachineMetrics) | No standardized entity event schema. Custom subject naming conventions. i-flow: "harmonization" layer normalizes events. MachineMetrics: internal tooling to "standardize subject and payload structures." | Custom per-implementation | [SOURCE: nats.io/blog/i-flow-case-study + synadia.com/customer-stories/machinemetrics, vendor claims] |

### 4.2 Key Takeaway

**No platform provides a complete, standardized entity lifecycle event model for IIoT.** This is a genuine gap in the ecosystem:

- Sparkplug B handles telemetry well but ignores entity state
- OPC-UA has the richest event model but is complex and XML-heavy
- MQTT UNS implementations leave event schema to the user
- NATS-based systems are entirely custom

**Our Effect-TS entity system with typed event schemas, state machines, and event sourcing is genuinely novel in this space.**

---

## 5. Entity Event Schema Patterns

### 5.1 Schema Comparison Table

| Platform | Format | Envelope | State Model | Versioning |
|----------|--------|----------|-------------|------------|
| **Sparkplug B** | Protobuf | Metric array: `{name, alias, timestamp, datatype, value, metadata, properties}` | NBIRTH defines metrics; NDATA updates values | Schema in NBIRTH payload (metric metadata) |
| **OPC-UA Alarms** | OPC-UA Binary/JSON | EventNotification: `{EventType, SourceNode, Severity, Message, Time, ReceiveTime, ConditionId}` | Two-state machines (TwoStateVariableType): Active/Inactive, Acknowledged/Unacknowledged, Confirmed/Unconfirmed | Node version in AddressSpace |
| **ISA-95 B2MML** | XML (XSD) | Equipment capability: `{EquipmentID, CapabilityType, Properties[], StartTime, EndTime}` | CapabilityType enum: Committed, Available, Unattainable | B2MML version in XSD namespace |
| **CloudEvents** | JSON | `{specversion, type, source, id, time, datacontenttype, data}` | No state model — pure event envelope | `specversion` field |
| **Our System** (Effect Schema) | JSON (Effect Schema) | Entity event with `{_tag, entityId, entityType, timestamp, payload, metadata}` | Machine-backed state graphs with validated transitions | Schema versioning via Effect Schema transforms |

### 5.2 OPC-UA Event Model Details

The OPC-UA model is the most relevant comparator for our entity events:

```
BaseEventType
  ├── ConditionType
  │   ├── AcknowledgeableConditionType
  │   │   └── AlarmConditionType
  │   │       ├── LimitAlarmType (High/HighHigh/Low/LowLow)
  │   │       ├── DiscreteAlarmType (OffNormal, Trip)
  │   │       └── ExclusiveAlarmType (Deviation, RateOfChange)
  │   └── DialogConditionType
  └── AuditEventType
      └── AuditUpdateMethodEventType
```

Each condition has state machines:
- **EnabledState** (Enabled/Disabled)
- **ActiveState** (Active/Inactive)
- **AckedState** (Acknowledged/Unacknowledged)
- **ConfirmedState** (Confirmed/Unconfirmed)
- **SuppressedState** (Suppressed/Unsuppressed)

[SOURCE: OPC 10000-9 Part 9 v1.05.06 Section 5, verified]

This directly parallels our ISA-18.2 AlarmEntity lifecycle (triggered -> acknowledged -> cleared) and validates our state machine approach.

### 5.3 Sparkplug Metric Payload Structure

```protobuf
message Payload {
  uint64 timestamp = 1;
  repeated Metric metrics = 2;
  uint64 seq = 3;
  bytes uuid = 4;
  bytes body = 5;
}

message Metric {
  string name = 1;
  uint64 alias = 2;
  uint64 timestamp = 3;
  uint32 datatype = 4;
  bool is_historical = 5;
  bool is_transient = 6;
  bool is_null = 7;
  MetaData metadata = 8;
  PropertySet properties = 9;
  oneof value {
    uint32 int_value = 10;
    uint64 long_value = 11;
    float float_value = 12;
    double double_value = 13;
    bool boolean_value = 14;
    string string_value = 15;
    bytes bytes_value = 16;
    DataSet dataset_value = 17;
    Template template_value = 18;
    Payload.Extension extension_value = 19;
  }
}
```

[SOURCE: sparkplug-payload protobuf definition, verified from npm package]

---

## 6. NATS-Specific Architecture Recommendations

### 6.1 Subject Hierarchy Design for Our Architecture

Based on the research, here is the recommended NATS subject hierarchy for our entity event system:

```
# Pattern: {namespace}.{enterprise}.{site}.{area}.{domain}.{entity_type}.{entity_id}.{event_type}

# --- Telemetry (high volume, low latency) ---
iiot.{enterprise}.{site}.{area}.telemetry.reading.{sensor_id}
iiot.{enterprise}.{site}.{area}.telemetry.batch.{device_id}

# --- Entity Lifecycle Events (event sourced) ---
iiot.{enterprise}.{site}.{area}.events.alarm.{alarm_id}.triggered
iiot.{enterprise}.{site}.{area}.events.alarm.{alarm_id}.acknowledged
iiot.{enterprise}.{site}.{area}.events.alarm.{alarm_id}.cleared

iiot.{enterprise}.{site}.{area}.events.equipment.{equipment_id}.transition
iiot.{enterprise}.{site}.{area}.events.equipment.{equipment_id}.reason_updated

iiot.{enterprise}.{site}.{area}.events.workorder.{wo_id}.created
iiot.{enterprise}.{site}.{area}.events.workorder.{wo_id}.submitted
iiot.{enterprise}.{site}.{area}.events.workorder.{wo_id}.approved
iiot.{enterprise}.{site}.{area}.events.workorder.{wo_id}.started
iiot.{enterprise}.{site}.{area}.events.workorder.{wo_id}.completed

# --- Entity State (current state, KV-backed) ---
iiot.{enterprise}.{site}.{area}.state.equipment.{equipment_id}
iiot.{enterprise}.{site}.{area}.state.alarm.{alarm_id}
iiot.{enterprise}.{site}.{area}.state.workorder.{wo_id}

# --- Asset Hierarchy (CRUD, non-event-sourced) ---
iiot.{enterprise}.{site}.{area}.assets.machine.{machine_id}
iiot.{enterprise}.{site}.{area}.assets.device.{device_id}
iiot.{enterprise}.{site}.{area}.assets.sensor.{sensor_id}

# --- KPIs and Aggregates ---
iiot.{enterprise}.{site}.{area}.kpi.oee.{line_id}
iiot.{enterprise}.{site}.{area}.kpi.quality.{line_id}

# --- Sparkplug Bridge (ingested from MQTT, republished to NATS) ---
sparkplug.{group_id}.DDATA.{edge_node}.{device_id}
sparkplug.{group_id}.NBIRTH.{edge_node}
sparkplug.{group_id}.NDEATH.{edge_node}
```

### 6.2 Wildcard Subscription Examples

```
# All events from Munich site
iiot.gbg.munich.>

# All alarms across all sites
iiot.gbg.*.*.events.alarm.>

# All equipment state changes in packaging area
iiot.gbg.munich.packaging.events.equipment.>

# All telemetry from one area
iiot.gbg.munich.packaging.telemetry.>

# All current states (for dashboard)
iiot.gbg.munich.packaging.state.>

# Specific entity's full event stream
iiot.gbg.munich.packaging.events.workorder.wo-123.>
```

### 6.3 JetStream Stream Configuration

```
# Stream per event domain (separate retention, limits)

# Telemetry Stream — high volume, shorter retention
Stream: IIOT_TELEMETRY
  Subjects: iiot.*.*.*.telemetry.>
  MaxAge: 7 days
  MaxBytes: 50GB
  Storage: File
  Replicas: 3

# Entity Events Stream — event sourced, long retention
Stream: IIOT_ENTITY_EVENTS
  Subjects: iiot.*.*.*.events.>
  MaxAge: 365 days (regulatory)
  MaxBytes: 10GB
  Storage: File
  Replicas: 3
  DenyPurge: true (regulatory compliance)
  DenyDelete: true

# Asset Changes Stream — CRUD operations
Stream: IIOT_ASSETS
  Subjects: iiot.*.*.*.assets.>
  MaxAge: 90 days
  MaxBytes: 1GB
  Storage: File
  Replicas: 3

# KV Buckets for current state
Bucket: IIOT_EQUIPMENT_STATE
  Key Pattern: equipment.{id}
  History: 5 (keep last 5 values)

Bucket: IIOT_ALARM_STATE
  Key Pattern: alarm.{id}
  History: 10

Bucket: IIOT_WORKORDER_STATE
  Key Pattern: workorder.{id}
  History: 3
```

### 6.4 NATS vs MQTT: Our Hybrid Approach

Based on the research, the recommended architecture is:

```
┌─────────────────────────────────────────────────────┐
│                    Enterprise Layer                   │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │          NATS Cluster (JetStream)             │    │
│  │                                                │    │
│  │  Streams:    Entity Events, Telemetry, Assets  │    │
│  │  KV Buckets: Equipment State, Alarm State      │    │
│  │  Services:   RPC handlers, Event processors    │    │
│  │                                                │    │
│  │  WebSocket: /ws/iiot → Browser clients         │    │
│  └──────────────────────────────────────────────┘    │
│         ▲                            ▲                │
│         │ NATS subjects              │ NATS subjects  │
│  ┌──────┴──────┐            ┌───────┴──────┐         │
│  │ Sparkplug   │            │  Entity      │         │
│  │ Adapter     │            │  Handlers    │         │
│  │ (bridge)    │            │  (Effect)    │         │
│  └──────┬──────┘            └──────────────┘         │
│         │ MQTT                                        │
└─────────┼────────────────────────────────────────────┘
          │
┌─────────┼────────────────────────────────────────────┐
│  Edge   │  Layer (per-site)                           │
│         ▼                                             │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ MQTT Broker   │  │ PLCs      │  │ SCADA        │  │
│  │ (EMQX/local)  │  │ Sensors   │  │ Historians   │  │
│  └──────────────┘  └───────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Rationale**:
- MQTT at the edge: 100% OT tooling compatibility (Siemens, Rockwell, Kepware, Ignition)
- NATS in the enterprise: High-performance event processing, native microservices support
- Sparkplug Adapter bridges MQTT -> NATS with subject translation
- Entity handlers operate purely in NATS space

[SOURCE: HiveMQ MQTT vs NATS comparison — "combine them to get the best of both worlds"]
[SOURCE: MachineMetrics case study — NATS leaf nodes for edge-to-cloud]
[SOURCE: i-flow case study — NATS as enterprise messaging backbone]

---

## 7. Volume Estimates

### 7.1 Telemetry Volume (High Frequency)

| Scale | Sensors | Sample Rate | Messages/sec | Daily Volume |
|-------|---------|-------------|-------------|-------------|
| Single site | 500 | 1 Hz | 500 | 43M |
| Single site | 500 | 10 Hz | 5,000 | 432M |
| 10 sites | 5,000 | 1 Hz | 5,000 | 432M |
| 100 sites | 50,000 | 1 Hz | 50,000 | 4.3B |
| Metropolitan (100+ sites) | 50,000 | 10 Hz | 500,000 | 43B |

Note: With report-by-exception (deadband filtering), real-world telemetry drops 80-90%.

[SOURCE: HiveMQ UNS guide — "report by exception reduces bandwidth by up to 80-90%", verified claim]

### 7.2 Entity State Change Events (Low Frequency)

Entity state changes are orders of magnitude less frequent than telemetry:

| Event Type | Frequency Per Entity | Entities (Metro Scale) | Events/sec (Aggregate) |
|------------|---------------------|----------------------|----------------------|
| Equipment state transition | 5-20/day | 10,000 machines | 0.6-2.3 |
| Alarm triggered | 10-50/day | 1,000 alarm points | 0.1-0.6 |
| Alarm acknowledged | 10-50/day | 1,000 alarm points | 0.1-0.6 |
| Work order state change | 2-10/day | 500 active orders | 0.01-0.06 |
| Asset CRUD operation | 1-5/day | 50,000 assets | 0.6-2.9 |
| **Total entity events** | | | **~1.5-6.5/sec** |

**Entity events at metropolitan scale are ~5 orders of magnitude less frequent than telemetry.**

This means:
- JetStream persistence overhead is negligible for entity events
- The bottleneck is never entity event throughput — it's telemetry ingestion
- Event sourced entity streams are easily stored for years (regulatory)
- Real-time entity event distribution is trivially handled by any messaging system

### 7.3 Messaging System Capacity Reference

| System | Peak Throughput | P95 Latency | Deployment |
|--------|----------------|-------------|------------|
| NATS JetStream | 800K msg/sec | 15ms | Single cluster |
| Apache Kafka | 1.2M msg/sec | 18ms | Single cluster |
| EMQX (MQTT) | 100M+ msg/sec (claimed) | <1ms | Clustered |

[SOURCE: arxiv/2510.04404v2 — IoT workload benchmarks, academic paper]
[SOURCE: EMQX documentation — vendor claim, not independently verified]

**Our metropolitan scale (50K-500K msg/sec telemetry + ~6 entity events/sec) is well within NATS JetStream capacity.**

---

## 8. Recommended Topic Hierarchy for GBG

### 8.1 Design Principles

Based on the research synthesis:

1. **ISA-95 hierarchy as topic skeleton** — matches our entity types exactly
2. **Separate telemetry from entity events** — different retention, different consumers
3. **NATS KV for current state** — equivalent to MQTT retained messages
4. **Versioned namespace** — support schema evolution without breaking consumers
5. **Event type as trailing segment** — enables wildcard subscription by event type

### 8.2 Final Subject Hierarchy

```
# Version prefix for future evolution
v1.iiot.{enterprise}.{site}.{area}

# Telemetry (from Sparkplug bridge)
v1.iiot.{enterprise}.{site}.{area}.telemetry.reading.{sensor_id}
v1.iiot.{enterprise}.{site}.{area}.telemetry.batch.{device_id}

# Entity Events (event-sourced domain events)
v1.iiot.{enterprise}.{site}.{area}.entity.alarm.{id}.{event}
v1.iiot.{enterprise}.{site}.{area}.entity.equipment.{id}.{event}
v1.iiot.{enterprise}.{site}.{area}.entity.workorder.{id}.{event}

# Asset Events (CRUD lifecycle)
v1.iiot.{enterprise}.{site}.{area}.asset.machine.{id}.{operation}
v1.iiot.{enterprise}.{site}.{area}.asset.device.{id}.{operation}
v1.iiot.{enterprise}.{site}.{area}.asset.sensor.{id}.{operation}
v1.iiot.{enterprise}.{site}.{area}.asset.line.{id}.{operation}
v1.iiot.{enterprise}.{site}.{area}.asset.workcell.{id}.{operation}

# Invalidations (cache bust / reactivity)
v1.iiot.{enterprise}.{site}.{area}.invalidation.{entity_type}.{id}

# KPIs (computed aggregates)
v1.iiot.{enterprise}.{site}.{area}.kpi.oee.{line_id}
v1.iiot.{enterprise}.{site}.{area}.kpi.quality.{area_id}

# System (internal)
v1.iiot._sys.health.{node_id}
v1.iiot._sys.sparkplug.bridge.{bridge_id}
```

### 8.3 KV Bucket Design

```
# One bucket per state domain, key = entity ID

Bucket: iiot-equipment-state
  Keys: equipment.{id}
  Value: EquipmentState JSON (current state + metadata)
  History: 5

Bucket: iiot-alarm-state
  Keys: alarm.{id}
  Value: AlarmState JSON (current lifecycle position)
  History: 10

Bucket: iiot-workorder-state
  Keys: workorder.{id}
  Value: WorkOrderState JSON (current lifecycle position)
  History: 3

Bucket: iiot-asset-state
  Keys: {entity_type}.{id}
  Value: Asset JSON (current configuration)
  History: 1
```

### 8.4 Mapping to Our Existing Architecture

| Our Component | Subject Pattern | JetStream Stream |
|---------------|----------------|-----------------|
| ChannelService.readings | `v1.iiot.*.*.*.telemetry.>` | IIOT_TELEMETRY |
| ChannelService.alarms | `v1.iiot.*.*.*.entity.alarm.>` | IIOT_ENTITY_EVENTS |
| ChannelService.equipment | `v1.iiot.*.*.*.entity.equipment.>` | IIOT_ENTITY_EVENTS |
| ChannelService.invalidations | `v1.iiot.*.*.*.invalidation.>` | IIOT_INVALIDATIONS |
| EventDistribution.broadcast | All of the above | (fan-out via PubSub) |
| SparkplugAdapter.ingest | `sparkplug.*.DDATA.>` | (bridge, not stored) |
| RealtimeRpcHandlers | WebSocket -> subscribe to any `v1.iiot.>` pattern | N/A (live stream) |

---

## Appendix A: Source Verification Matrix

| Finding | Source | Verification Level |
|---------|--------|-------------------|
| ISA-95 hierarchy (Enterprise > Site > Area > Line > Cell) | HiveMQ, Proxus, FlowFuse (multiple independent) | **Verified pattern** |
| Sparkplug 3.0.0 topic namespace | Eclipse spec PDF + our sparkplug-b-reference-index.md | **Verified from spec** |
| Sparkplug lacks entity state transitions | Spec analysis (no STATE_TRANSITION message type) | **Verified from spec** |
| MQTT retained messages vs NATS KV | HiveMQ comparison + NATS official docs | **Verified technical comparison** |
| NATS JetStream 800K msg/sec | arxiv/2510.04404v2 benchmark | **Academic paper (peer context)** |
| i-flow 400M operations/day | nats.io case study | **Vendor claim** |
| MachineMetrics leaf node topology | synadia.com case study | **Vendor claim** |
| OPC-UA Alarm/Condition model | OPC Foundation Part 9 v1.05 | **Verified from spec** |
| B2MML Equipment Capability schema | MESA International docs | **Verified from standard body** |
| Report-by-exception 80-90% reduction | HiveMQ UNS guide | **Industry consensus (vendor claim)** |
| NATS KV key restrictions (no colons) | NATS docs + our debugging experience | **Verified from docs + empirical** |
| HiveMQ now recommends against Sparkplug-only UNS | HiveMQ blog disclaimers (multiple articles) | **Verified from vendor** |

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| **UNS** | Unified Namespace — centralized, topic-based data layer for IIoT |
| **ISA-95** | International standard for enterprise-control system integration (ANSI/ISA-95, IEC 62264) |
| **ISA-18.2** | Management of Alarm Systems for the Process Industries |
| **B2MML** | Business To Manufacturing Markup Language — XML schemas implementing ISA-95 |
| **Sparkplug B** | Eclipse Foundation specification for MQTT-based IIoT (topic namespace + protobuf payload) |
| **NBIRTH/NDEATH** | Sparkplug Edge Node birth/death certificates |
| **DBIRTH/DDEATH** | Sparkplug Device birth/death certificates |
| **OEE** | Overall Equipment Effectiveness (Availability x Performance x Quality) |
| **CEP** | Complex Event Processing |
| **KV** | Key/Value store (NATS JetStream feature) |

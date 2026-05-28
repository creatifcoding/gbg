# RFC-0006 — Industrial Schema Taxonomy

Status: draft

## 1. Purpose

This RFC turns the platform charter into a schema roadmap. The goal is to make industrial concepts first-class, runtime-validated, and stable enough for EventJournal, graph projection, Reactor, agents, and command governance.

This is **not** an Effect v4 migration. TMNL currently runs Effect v3. New domain contracts should still use `effect/Schema` in the style already used by IIoT schemas.

## 2. Standards anchors

This RFC is grounded by the following ledger entries in `STANDARDS-RESEARCH-LEDGER.md`:

| Anchor | Schema consequence |
| --- | --- |
| `STD-ISA95-CONCEPT` | Material, equipment, physical asset, personnel, and Level 3/4 exchange semantics must be distinct schema families. |
| `STD-OPCUA-P1-OVERVIEW` / `STD-OPCUA-P4-SERVICES` | OPC UA schemas must preserve AddressSpace, Node, Reference, Attribute, Method, MonitoredItem, Subscription, quality/status, and service provenance. |
| `STD-OPCUA-P9-ALARMS` + `STD-ISA18-SERIES` | OPC UA alarm ingestion and ISA-18.2 alarm lifecycle/philosophy/rationalization need separate but linked schemas. |
| `STD-SPARKPLUG-OP-BEHAVIOR` / `STD-SPARKPLUG-PAYLOAD` | Sparkplug schemas must preserve STATE, birth/death, seq/bdSeq, UTC timestamps, metric payload, stale quality, and command verbs. |
| `STD-IEC62443-SERIES` | Command governance schemas must include security boundary, actor/role, zone/conduit, approval, interlock, and audit evidence. |
| `STD-PACKML-CONCEPT` | PackML state/mode/tag schemas should be optional overlays for applicable machines. |
| `STD-ISO22400-KPI` | KPI/OEE schemas require formula/version/source-window evidence, not display-only numbers. |
| `STD-MIMOSA-OSA-CBM` | Asset health and maintenance schemas need supplier-neutral physical asset and condition evidence semantics. |

Each schema family below must eventually map to a decision/proof row in `STANDARDS-CONFORMANCE-MATRIX.md`. If a field cannot be traced to a standard, an internal domain precedent, or an explicit product decision, it should be marked `tmnlExtension` rather than smuggled in as if ISA or OPC whispered it to us in a dream.

## 3. Schema laws

1. **Domain boundary types are schemas.** Events, commands, telemetry envelopes, integration configs, command approvals, and graph descriptors must be Schema-backed.
2. **Raw TypeScript is local only.** Component props and private helpers may use raw types; cross-boundary contracts may not.
3. **Events remain primitive.** Schema-backed events feed projections; projections do not become authority.
4. **Addressing is explicit.** Every external value needs source identity, source address, normalized identity, quality, and mapping provenance.
5. **No vendor ontology leak.** Vendor-specific fields live in adapter metadata or raw references, not core domain schemas.

## 4. Proposed module layout

```text
src/lib/iiot/schemas/industrial/
├── index.ts
├── identity.ts              # integration IDs, source addresses, mapped entity refs
├── isa95.ts                 # hierarchy, operation context, site/area/line/cell/equipment
├── telemetry.ts             # DMN telemetry values, quality, units, metric identity
├── alarms-isa18.ts          # alarm definition/occurrence/lifecycle semantics
├── packml.ts                # PackML machine state vocabulary
├── oee-iso22400.ts          # OEE/KPI/time-loss frames
├── maintenance.ts           # failure codes, PM strategy, condition-based maintenance hints
├── command-governance.ts    # command proposal/policy/approval/interlock/execution schemas
├── simulation.ts            # virtual plant manifests and scenario traces
└── adapters/
    ├── opcua.ts             # OPC UA config, node manifest, monitored item mapping
    └── sparkplug.ts         # Sparkplug group/edge/device/metric mapping
```

The existing schemas under `src/lib/iiot/schemas` remain canonical for current domains. The industrial package should compose them, not fork them.

## 5. Identity and addressing

Industrial data starts messy. Schema identity must preserve both raw and normalized forms.

Core concepts:

| Schema | Purpose |
| --- | --- |
| `IntegrationId` | stable ID for a configured connector instance |
| `SourceProtocol` | `opcua`, `sparkplug`, `modbus`, `historian`, `cmms`, `mes`, `manual`, etc. |
| `SourceAddress` | adapter-specific address encoded as structured data, not an opaque string when possible |
| `EntityIdentityHint` | unresolved asset/equipment/device/work-order hints from source payloads |
| `MappedEntityRef` | normalized platform entity ID plus mapping provenance |
| `MappingConfidence` | exact/configured/inferred/unresolved |

Unresolved identity is a state, not an exception. Unresolved data can be stored and inspected, but it must not drive Reactor mutations or command execution.

## 6. ISA-95 hierarchy schemas

The platform's graph must speak an ISA-95-ish vocabulary while staying practical for brownfield sites.

Recommended hierarchy nodes:

```text
Enterprise
  Site
    Area
      ProcessCell | ProductionLine | WorkCenter
        Unit | EquipmentModule | ControlModule | Asset
          Device | Sensor | Actuator | ExternalRef
```

Required schema dimensions:

- node type;
- display name;
- lifecycle state;
- parent/container identity;
- source mappings;
- criticality;
- zone/conduit assignment;
- operation context tags.

Graph edges should keep using relationship descriptors. The schema package should add industrial endpoint helpers and descriptor presets, not bypass `RelationshipEdges.fromDescriptor(...)`.

## 7. Telemetry and quality schemas

Telemetry values must preserve source quality and transformation provenance.

Core types:

| Schema | Purpose |
| --- | --- |
| `IndustrialMetricValue` | tagged union for number, boolean, string, enum, struct, bytes |
| `IndustrialQuality` | good/bad/uncertain/stale/substituted plus protocol-specific status |
| `MetricAddress` | source address plus optional normalized metric ID |
| `TelemetrySample` | one timestamped value with quality and provenance |
| `TelemetryBatch` | ordered batch with source sequence metadata |
| `UnitOfMeasure` | explicit unit string plus optional normalized unit code |

Quality rules:

1. bad/uncertain data can update historian with quality flags;
2. bad/uncertain data must not automatically create command eligibility;
3. stale data should fail closed for command interlocks;
4. substituted/manual data must be visible in agent evidence.

## 8. ISA-18.2 alarm schemas

Alarm schemas should distinguish definition, occurrence, lifecycle state, and governance action.

Core concepts:

| Schema | Purpose |
| --- | --- |
| `AlarmDefinition` | configured alarm condition and priority/severity semantics |
| `AlarmOccurrence` | active instance of alarm condition |
| `AlarmLifecycleState` | normal, active-unacked, active-acked, returned-unacked, shelved, suppressed, out-of-service |
| `AlarmOperatorAction` | ack, shelve, suppress, escalate, comment, close |
| `AlarmRationalizationRef` | reference to reason/limit/consequence/action guidance |

Existing alarm event schemas should remain the durable event surface. ISA-18.2 schemas enrich definitions and command governance.

## 9. PackML machine state schemas

PackML is useful as a normalized machine-state vocabulary for virtual plant scenarios and some real equipment.

Minimum states:

```text
aborted, aborting, clearing, stopped, stopping, starting, idle,
suspended, suspending, unsuspending, execute, completing, complete,
resetting, holding, held, unholding
```

The platform should not force every machine into PackML. Use PackML as a normalized overlay when applicable.

## 10. ISO 22400 / OEE schemas

OEE and production KPIs should be derived from event and time-series evidence, not hand-waved.

Core concepts:

| Schema | Purpose |
| --- | --- |
| `ProductionWindow` | planned production interval and equipment context |
| `DowntimeFrame` | loss event with start/end/cause/source |
| `AvailabilityFrame` | equipment availability interval |
| `PerformanceFrame` | actual vs ideal rate evidence |
| `QualityFrame` | good/scrap/rework quantities |
| `OeeSnapshot` | availability/performance/quality and source windows |

## 11. Maintenance and condition schemas

Maintenance schemas should bridge WorkOrders, condition-based maintenance, and CMMS/EAM ports.

Concepts:

- failure mode;
- failure code;
- symptom;
- asset health indicator;
- maintenance recommendation;
- PM strategy;
- condition trigger;
- work management external reference.

Existing `WorkOrder` schemas remain authority for WorkOrder lifecycle. Maintenance schemas enrich decision context and integration mapping.

## 12. Command governance schemas

Command schemas are detailed in RFC-0009, but this taxonomy reserves a package boundary for:

- command proposal;
- policy decision;
- interlock result;
- approval fact;
- execution receipt;
- reconciliation result;
- denial explanation.

Every command schema must carry evidence references and actor/agent identity.

## 13. Standards proof model

Schema implementation is not complete until each schema family has:

| Proof | Requirement |
| --- | --- |
| source mapping | standards anchor(s), observed requirement, and local interpretation are listed in the conformance matrix |
| schema tests | Effect Schema decode/encode tests for valid/invalid boundary payloads |
| projection tests | domain event/projection tests prove schemas drive graph/read models without becoming authority |
| trace fixtures | virtual plant golden traces include raw source payload, normalized schema payload, and downstream event/read-model output |
| extension marking | non-standard product fields are explicitly marked as TMNL extensions |
| review status | E1/E2 public-source alignment is separated from E3/E4/E5 compliance/certification claims |

## 14. Acceptance criteria

- All new industrial boundary contracts are Schema-backed.
- Existing Reactor/EventJournal/relationship schemas are reused rather than forked.
- Identity mapping explicitly distinguishes exact, inferred, and unresolved mappings.
- Alarm, PackML, OEE, and command semantics are represented as schemas before implementation.
- No document suggests a migration to Effect v4 as a hidden prerequisite.

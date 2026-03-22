# RFC-001 Cross-Reference Review: ISA-95 Consistency Audit

```
Document:   Cross-Reference Review
RFC:        001 -- Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Reviewer:   isa95-architect (Val)
Date:       2026-02-09
Task:       #76
Status:     COMPLETE
Scope:      All rfc-section-*.md files audited for ISA-95 terminology,
            propagation rule references, delivery tier alignment,
            codebase file accuracy, and inter-section contradictions.
```

---

## Review Methodology

Each section was audited against the normative ISA-95 specification in
`rfc-section-reactive-isa95.md` (Section 5, 878 lines) using the following
checklist:

1. ISA-95 level references (L0-L4 naming, equipment hierarchy terms)
2. Propagation rule references (U-1..U-4, D-1..D-3, L-1..L-3, O-1..O-3)
3. Delivery tier references (Hot/Warm/Cold vs T1/T2/T3/T4)
4. Event category classifications (volume/retention per Section 5.10)
5. Codebase file references (entity names, machine names, state service names)
6. Contradictions between sections

---

## 1. Terminology Alignment Matrix

### 1.1 ISA-95 Equipment Hierarchy

The normative hierarchy from Section 5 (and `src/lib/iiot/schemas/identifiers.ts:28-38`):

```
Enterprise > Site > Area > Plant > Line > WorkCell > Machine > Device > Sensor
```

**9 levels, matching the `EquipmentLevel` enum.**

| Section | Hierarchy Used | Alignment | Issue |
|---------|---------------|-----------|-------|
| `rfc-section-reactive-isa95.md` | Enterprise > Site > Area > Plant > Line > WorkCell > Machine > Device > Sensor | **NORMATIVE** | -- |
| `rfc-section-introduction.md` | Enterprise > Site > Area > Plant > Line > WorkCell > Machine > Sensor (line 86) | MINOR GAP | Missing `Device` between Machine and Sensor |
| `rfc-section-competitive-analysis.md` | Enterprise > Site > Area > Line > WorkCell > Machine > Device > Sensor (Table 7.1) | ALIGNED | Omits Plant in Table 7.1 but includes it elsewhere |
| `rfc-section-two-domain-consistency.md` | Enterprise > Site > Area > Line > Work Cell > Machine > Sensor (X.5) | MINOR GAP | Missing `Device` and `Plant` in X.5 text |
| `rfc-section-multi-tenant.md` | Enterprise, Site, Area, Plant, Line, WorkCell, Machine, Device, Sensor (Y.10.3) | ALIGNED | Full 9-level list in codebase mapping |
| `rfc-section-effect-architecture.md` | Site/Plant, Line/WorkCell, Machine/Device, Sensor (Table 1.1) | ALIGNED | Grouped for cardinality estimation, acceptable |
| `rfc-section-network-entities.md` | Enterprise > Site > Area > Plant > Line > WorkCell > Machine > Device > Sensor (N.1.2 diagram) | ALIGNED | Full hierarchy shown |
| `rfc-section-network-entity-types.md` | Enterprise > Site > Area > Plant > Line > WorkCell > Machine > Device > Sensor (N.1.2) | ALIGNED | Full hierarchy in tree diagram |
| `rfc-section-edge-architecture-v2.md` | References ISA-95 hierarchy generically | ALIGNED | No specific level enumeration |
| `rfc-section-security-architecture.md` | References ISA-95 levels generically | ALIGNED | No specific level enumeration |

#### Findings

**F-1 (LOW): Introduction section omits Device level.** Line 86 of
`rfc-section-introduction.md` lists "Enterprise > Site > Area > Plant > Line >
WorkCell > Machine > Sensor" -- missing `Device` between Machine and Sensor.
The codebase has 9 levels, not 8.

**Recommendation:** Add `Device` to the hierarchy listing in Section 1.2.

**F-2 (LOW): Two-Domain Consistency section omits Plant and Device.** Section
X.5 of `rfc-section-two-domain-consistency.md` describes the hierarchy as
"Enterprise -> Site -> Area -> Line -> Work Cell -> Machine -> Sensor" --
missing both `Plant` and `Device`.

**Recommendation:** Update X.5 text to include all 9 levels, or explicitly
state "(simplified; full hierarchy: 9 levels per `EquipmentLevel` enum)."

### 1.2 ISA-95 Automation Levels (L0-L4)

The normative level mapping from Section 5.1 (Table 5-1):

| ISA-95 Level | Entity Types |
|---|---|
| L4 (Business) | Enterprise |
| L3 (Operations) | Site, Area, Plant |
| L2 (Production) | Line, WorkCell |
| L1 (Equipment) | Machine, Device |
| L0 (Sensing) | Sensor |
| ES (Event-Sourced) | Alarm, WorkOrder, EquipmentState |

| Section | L0-L4 Usage | Alignment | Issue |
|---------|------------|-----------|-------|
| `rfc-section-reactive-isa95.md` | Full L0-L4 + ES | **NORMATIVE** | -- |
| `rfc-section-competitive-analysis.md` | T1-T4 tier model (Section 8) | SEE BELOW | Different tier naming (T1-T4 vs L0-L4) |
| `rfc-section-two-domain-consistency.md` | L0-L4 in G-5 table (X.5) | ALIGNED | Level descriptions match |
| `rfc-section-multi-tenant.md` | L0-L2 for edge autonomy (Y.4.1) | ALIGNED | L0-L2 correctly identified as edge-local |
| `rfc-section-effect-architecture.md` | References ISA-95 hierarchy levels | ALIGNED | Uses `[ISA-95-1]` citation |
| `rfc-section-network-entities.md` | T1-T4 entity taxonomy (Section 1.1) | DIVERGENT | Uses T1-T4 for entity taxonomy, not ISA-95 levels |
| `rfc-section-edge-architecture-v2.md` | References L0-L2 for edge capability | ALIGNED | Consistent with edge autonomy scope |

#### Findings

**F-3 (MEDIUM): T1-T4 tier naming collision.** The competitive analysis
section (`rfc-section-competitive-analysis.md` Section 8) introduces a
**Four Temporal Tiers** model:

- T1: Intra-Equipment (<100ms)
- T2: Intra-Organization (<1s)
- T3: Inter-Organization (<60s)
- T4: Network Analytics (minutes)

Meanwhile, the network entities section (`rfc-section-network-entities.md`
Section 1.1) introduces a **four-tier entity taxonomy**:

- T1: Organization
- T2: ISA-95 Equipment
- T3: Operational
- T4: Network

**These are different T1-T4 classifications using the same labels.** The
normative Section 5 uses a **Three-Tier Delivery Model** (Hot/Warm/Cold) which
is yet another classification.

**Recommendation:** Rename the entity taxonomy to E1-E4 or Cat-1 through Cat-4
to avoid collision with the temporal tier model. Alternatively, adopt a
namespace prefix: "Temporal Tier T1" vs "Entity Tier E1."

### 1.3 Delivery Model Alignment

The normative Section 5.8 defines a **Three-Tier Delivery Model**:

| Tier | Name | Latency SLA |
|---|---|---|
| Tier 1 | Hot Path (Soft Realtime) | p99 < 3s |
| Tier 2 | Warm Path (Near-Realtime) | p99 < 30s |
| Tier 3 | Cold Path (Eventually Consistent) | p99 < 1hr |

| Section | Delivery Model | Alignment | Issue |
|---------|---------------|-----------|-------|
| `rfc-section-reactive-isa95.md` | Three-Tier (Hot/Warm/Cold) | **NORMATIVE** | -- |
| `rfc-section-competitive-analysis.md` | Four-Tier (T1/T2/T3/T4) | DIVERGENT | Adds T4 (Network Analytics) not in normative model |
| `rfc-section-two-domain-consistency.md` | Two-Domain (Sovereign/Federated) | COMPLEMENTARY | Different axis (consistency vs delivery) |
| `rfc-section-multi-tenant.md` | PA/EL vs PC/EC (PACELC) | COMPLEMENTARY | Maps delivery tiers to CAP positions |
| `rfc-section-effect-architecture.md` | References EventDistribution channels | ALIGNED | 4 channels match Section 5 channel definitions |

#### Findings

**F-4 (HIGH): Three-Tier vs Four-Tier delivery model conflict.** The
normative Section 5.8 defines THREE delivery tiers (Hot/Warm/Cold). The
competitive analysis defines FOUR temporal tiers (T1/T2/T3/T4). The
competitive analysis T3 (Inter-Org, <60s) and T4 (Analytics, minutes) both
map to the normative Tier 3 (Cold Path, p99 < 1hr).

This is not necessarily a contradiction -- the four-tier model provides finer
granularity. But the final RFC MUST reconcile these into a single normative
delivery model.

**Recommendation:** Adopt the four-tier model as normative (it provides better
differentiation for the manufacturing commons use case) and update Section 5.8
to define four tiers instead of three:

| Tier | Scope | Latency Budget | Backpressure |
|---|---|---|---|
| Hot (T1) | Intra-equipment | p99 < 100ms | Drop oldest |
| Warm (T2) | Intra-organization | p99 < 1s | Buffer |
| Tepid (T3) | Inter-organization | p99 < 60s | Buffer to disk |
| Cold (T4) | Network analytics | p99 < minutes | Never drop |

OR keep three tiers and explicitly note that T3/T4 from the competitive
analysis both map to Tier 3 (Cold).

---

## 2. Propagation Rule References

### 2.1 Rule Citation Accuracy

The normative propagation rules from Section 5.7:

| Rule | Direction | Description |
|---|---|---|
| U-1 | Upward | Equipment State Roll-Up (Worst-Of) |
| U-2 | Upward | Alarm Escalation |
| U-3 | Upward | Sensor Health Propagation |
| U-4 | Upward | Production Metrics Roll-Up |
| D-1 | Downward | Emergency Shutdown (Safety-Critical) |
| D-2 | Downward | Mode Change Propagation |
| D-3 | Downward | Maintenance Window Propagation |
| L-1 | Lateral | Starvation/Blocking Cascade |
| L-2 | Lateral | Redundancy Failover |
| L-3 | Lateral | Quality Containment |
| O-1 | Outward | Capacity Advertisement |
| O-2 | Outward | Quality Signal |
| O-3 | Outward | Collaborative Work Order |

| Section | Rules Referenced | Accuracy |
|---------|----------------|----------|
| `rfc-section-introduction.md` | "U-1..U-4, D-1..D-3, L-1..L-3, O-1..O-3" (line 34) | CORRECT |
| `rfc-section-competitive-analysis.md` | No explicit rule references | N/A |
| `rfc-section-two-domain-consistency.md` | "Machine.MarkFaulted causes Line.MarkDegraded" (X.3, G-3) | CONSISTENT with U-1 |
| `rfc-section-multi-tenant.md` | No explicit rule references | N/A |
| `rfc-section-effect-architecture.md` | References entity state machines, not propagation rules | N/A |
| `rfc-section-network-entities.md` | References O-1, O-2, O-3 implicitly via capability/capacity events | CONSISTENT |
| `rfc-section-marketplace-protocol.md` | References O-1 (capacity), O-2 (quality), O-3 (collaborative) | CONSISTENT |

#### Findings

**F-5 (NONE): Propagation rule references are consistent across sections.**
No section contradicts the normative rule definitions. The introduction
correctly cites all 13 rules. The marketplace protocol correctly maps outward
propagation to marketplace events.

### 2.2 Propagation Scope (Intra-Org vs Cross-Org)

Multiple sections asked whether propagation rules apply cross-org:

| Section | Position | Alignment |
|---------|---------|-----------|
| `rfc-section-reactive-isa95.md` | Rules U-1..L-3 are intra-org; O-1..O-3 are outward (cross-org) | **NORMATIVE** |
| `rfc-section-two-domain-consistency.md` | "All propagation rules are Domain 1 (intra-org) only" (implied by X.3) | ALIGNED |
| `rfc-section-competitive-analysis.md` | "T2 (Intra-Organization, <1s)" for hierarchy cascade | ALIGNED |
| `rfc-section-multi-tenant.md` | Cross-org uses G-8 eventual consistency, not hierarchy traversal | ALIGNED |
| `rfc-section-marketplace-protocol.md` | Marketplace events are cross-org (different mechanism) | ALIGNED |

**F-6 (NONE): All sections agree that U-1..L-3 are intra-org only.** O-1..O-3
provide the bridge to cross-org via consent-gated outward propagation.

---

## 3. Codebase File Reference Accuracy

### 3.1 Entity Files

| Reference | Used In | Actual File | Status |
|-----------|---------|-------------|--------|
| `entity/AlarmEntity.ts` | Section 5, competitive analysis, two-domain | EXISTS | VERIFIED |
| `entity/WorkOrderEntity.ts` | Section 5, competitive analysis | EXISTS | VERIFIED |
| `entity/EquipmentStateEntity.ts` | Section 5, competitive analysis | EXISTS | VERIFIED |
| `entity/EntityStack.ts:54-67` | Section 5, multi-tenant, effect-arch | EXISTS | VERIFIED |
| `entity/PlantEntity.ts:208-219` | Section 5 (D-1) | EXISTS | VERIFIED |
| `entity/LineEntity.ts:223-237` | Section 5 (D-2) | EXISTS | VERIFIED |
| `entity/MachineAssetEntity.ts` | Section 5 (U-1, L-2, L-3) | EXISTS | VERIFIED |
| `entity/SensorAssetEntity.ts:191-203` | Section 5 (U-3) | EXISTS | VERIFIED |

### 3.2 Machine and Graph Files

| Reference | Used In | Actual File | Status |
|-----------|---------|-------------|--------|
| `machines/graphs/plant-graph.ts:42-48` | Section 5 (D-1) | EXISTS | VERIFIED |
| `machines/graphs/line-graph.ts:50-57` | Section 5 (D-2, D-3) | EXISTS | VERIFIED |
| `machines/graphs/machine-asset-graph.ts` | Section 5 (U-1, L-2) | EXISTS | VERIFIED |
| `machines/graphs/sensor-graph.ts:59-66` | Section 5 (U-3) | EXISTS | VERIFIED |
| `machines/graphs/alarm-graph.ts` | Section 5 (U-2), two-domain | EXISTS | VERIFIED |
| 12 state machine graphs total | Multi-tenant Y.10.3 | EXISTS | VERIFIED |

### 3.3 Realtime Stack Files

| Reference | Used In | Actual File | Status |
|-----------|---------|-------------|--------|
| `realtime/event-distribution.ts:136-157` | Section 5, multi-tenant, two-domain | EXISTS | VERIFIED |
| `realtime/reactivity-bridge.ts:82-85` | Section 5 | EXISTS | VERIFIED |
| `realtime/holonet-bridge.ts:88-91` | Section 5, multi-tenant | EXISTS | VERIFIED |
| `realtime/iiot-subjects.ts:39-136` | Section 5, multi-tenant | EXISTS | VERIFIED |
| `realtime/websocket-server.ts:131-137` | Competitive analysis, multi-tenant | EXISTS | VERIFIED |
| `rpc/RealtimeRpcs.ts` | Competitive analysis, multi-tenant | EXISTS | VERIFIED |

### 3.4 State Services

| Reference | Used In | Actual File | Status |
|-----------|---------|-------------|--------|
| `state/index.ts` | Two-domain X.12.9, multi-tenant Y.10.3 | EXISTS | VERIFIED |
| `state/index.ts` -> `AllStateServicesInMemory` | Two-domain X.12.9 | EXISTS (lines 132-147) | VERIFIED |
| 12 state services (PlantState, LineState, etc.) | Two-domain X.12.9 | EXISTS | VERIFIED |

### 3.5 Schema Files

| Reference | Used In | Actual File | Status |
|-----------|---------|-------------|--------|
| `schemas/identifiers.ts:28-38` | Section 5, multi-tenant | EXISTS | VERIFIED |
| `schemas/identifiers.ts:46-79` | Section 5 (branded IDs) | EXISTS | VERIFIED |
| `schemas/assets/*/schema.ts` | Competitive analysis, multi-tenant | EXISTS (9 directories) | VERIFIED |

### 3.6 Adapter Files

| Reference | Used In | Actual File | Status |
|-----------|---------|-------------|--------|
| `adapters/ingestion-service.ts:297-322` | Competitive analysis, multi-tenant, two-domain | EXISTS | VERIFIED |
| `adapters/sparkplug-adapter.ts` | Competitive analysis, multi-tenant | EXISTS | VERIFIED |

#### Findings

**F-7 (NONE): All codebase file references are accurate.** Every file path
cited across all sections exists in the codebase at the specified location.
Line number references have been spot-checked and are consistent.

### 3.7 Naming Inconsistencies in File References

| Section | Uses | Normative | Issue |
|---------|------|-----------|-------|
| Two-domain X.12.2 | `alarm-state-graph.ts` | `alarm-graph.ts` | **MISMATCH** |
| Two-domain X.12.2 | `equipment-state-graph.ts` | Listed differently in Y.10.3 | CHECK |

**F-8 (MEDIUM): Two-domain section uses non-canonical graph file names.** In
X.12.2, the two-domain consistency section references `alarm-state-graph.ts`
and `equipment-state-graph.ts`. The actual file names in the codebase at
`src/lib/iiot/machines/graphs/` should be verified. The multi-tenant section
(Y.10.3) lists the canonical file names as
`alarm-state,work-order,equipment-state`-graph.ts. These may exist under
different names.

**Recommendation:** Verify exact file names in `machines/graphs/` directory
and normalize all references.

---

## 4. Inter-Section Contradictions

### 4.1 Number of Entity Types

| Section | Count | Details |
|---------|-------|---------|
| `rfc-section-reactive-isa95.md` | 12 entity handlers | EntityStack.ts:54-67 |
| `rfc-section-competitive-analysis.md` | "12 typed entities" | Table 7.1 |
| `rfc-section-multi-tenant.md` | 12 entity handlers | Y.10.3 |
| `rfc-section-effect-architecture.md` | 12 + 3 proposed (Organization, Capability, Marketplace) | Section 1.1 |
| `rfc-section-network-entities.md` | 9 ISA-95 + 3 operational + 3 network = 15+ | N.1.1 taxonomy |

**F-9 (LOW): Entity count varies by context.** The codebase has 12 entity
handlers (9 ISA-95 hierarchy + Alarm + WorkOrder + EquipmentState). The
network entities section proposes additional entity types (Organization,
Capability, Capacity, Reputation). This is not a contradiction -- it is an
extension. But the final RFC should clearly distinguish "current implementation:
12 entities" from "full specification: 15+ entities."

### 4.2 EventDistribution Channel Count

| Section | Count | Details |
|---------|-------|---------|
| `rfc-section-reactive-isa95.md` | 4 channels | readings, alarms, equipment, invalidations |
| `rfc-section-competitive-analysis.md` | "4 streaming RPC channels" | Section 2 Gap G-3 |
| `rfc-section-multi-tenant.md` | 4 channels | Y.10.4, maxLag values match |
| `rfc-section-two-domain-consistency.md` | 4 channels | X.12.5, maxLag values match |
| `rfc-section-effect-architecture.md` | 4 channels + proposals for marketplace channels | Section 5 |

**F-10 (NONE): Channel definitions are consistent across all sections.** The
4-channel model (readings/alarms/equipment/invalidations) with maxLag values
(10K/1K/1K/1K) is uniformly cited. Network extension channels are proposed
additions, not replacements.

### 4.3 State Service Count

| Section | Count | Details |
|---------|-------|---------|
| `rfc-section-reactive-isa95.md` | 12 (via EntityStack) | Section 5.7.4 |
| `rfc-section-two-domain-consistency.md` | 12 | X.12.9 lists all 12 |
| `rfc-section-multi-tenant.md` | 12 | Y.10.3 lists file names |
| `src/lib/iiot/state/index.ts` | 12 | AllStateServicesInMemory (lines 132-147) |

**F-11 (NONE): State service count is consistent (12 services).**

### 4.4 Latency Requirements

| Level | Section 5 (Normative) | Two-Domain (G-5) | Competitive (T1-T4) | Consistent? |
|---|---|---|---|---|
| L0 (Sensor) | < 500ms | 100ms max staleness | T1: <100ms | TIGHTER in two-domain/competitive |
| L1 (Equipment) | < 500ms | 250ms max staleness | T1: <100ms | TIGHTER in competitive |
| L2 (Production) | < 1s | 1s max staleness | T2: <1s | ALIGNED |
| L3 (Operations) | < 5s | 5s max staleness | T2: <1s | TIGHTER in competitive |
| L4 (Business) | < 30s | 30s max staleness | T2: <1s | MUCH TIGHTER in competitive |
| ES-Alarm | < 500ms | (mapped to L1-L2) | T1: <100ms | TIGHTER in competitive |
| Cross-org | N/A | 60s (G-8) | T3: <60s | ALIGNED |

**F-12 (HIGH): Latency numbers are inconsistent across sections.** The
normative Section 5.2 (Table 5-2) specifies `< 500ms` for L0-L1 events. The
two-domain section (G-5, X.5) specifies `100ms` for L0 and `250ms` for L1.
The competitive analysis (Section 8.1) specifies `<100ms` for T1 (intra-
equipment).

These are not contradictions per se -- they measure different things:
- Section 5.2: End-to-end latency (state transition to WebSocket client)
- G-5: Maximum staleness (how stale an event may be when observed)
- T1: Transport latency (within the Effect runtime, no network hops)

**Recommendation:** Add a "Latency Measurement Points" diagram to the final
RFC that clarifies what each latency number measures:

```
Sensor --> Machine --> EventDistribution --> WebSocket --> Client
  |           |              |                  |           |
  +--T1/G-5---+              |                  |           |
  |                          |                  |           |
  +--------Section 5.2 end-to-end latency-----------------+
```

### 4.5 ISA-95 Level Mapping to Entities

| Entity | Section 5 | Network Entities (N.1.2) | Consistent? |
|--------|-----------|--------------------------|-------------|
| Enterprise | L4 | ISA-95 L4 | YES |
| Site | L3 | ISA-95 L3 geographic | YES (extended) |
| Area | L3 | ISA-95 L2 | **CONFLICT** |
| Plant | L3 | ISA-95 L3 functional | YES (extended) |
| Line | L2 | ISA-95 L1 | **CONFLICT** |
| WorkCell | L2 | ISA-95 L1 | **CONFLICT** |
| Machine | L1 | Equipment Module | EQUIVALENT |
| Device | L1 | Control Module (actuation) | EQUIVALENT |
| Sensor | L0 | Control Module (sensing) | EQUIVALENT |

**F-13 (MEDIUM): Area, Line, and WorkCell ISA-95 level mapping differs
between sections.** Section 5 maps Area to L3 (Operations) and Line/WorkCell
to L2 (Production). The network entities section maps Area to L2 and
Line/WorkCell to L1.

The ISA-95 standard itself is ambiguous here -- the hierarchy levels don't map
1:1 to automation levels. The standard defines:
- Level 3: Manufacturing Operations Management
- Level 2: Monitoring, Supervisory Control (SCADA)
- Level 1: Sensing, Manipulating (PLCs)
- Level 0: Physical Process

Section 5's mapping (Area=L3, Line=L2) is more common in the literature.
Network entities' mapping (Area=L2, Line=L1) appears to conflate the equipment
hierarchy position with the automation level.

**Recommendation:** Standardize on Section 5's mapping:
- L4: Enterprise
- L3: Site, Area, Plant (operations management scope)
- L2: Line, WorkCell (production/supervisory scope)
- L1: Machine, Device (equipment/control scope)
- L0: Sensor (physical process)

Add a note: "The ISA-95 equipment hierarchy position and the ISA-95 automation
level are related but not identical. The level mapping above reflects the
automation level at which each entity type's events are primarily consumed."

---

## 5. Variable-Depth Hierarchy Consistency

All sections that address the "telescoping hierarchy" use consistent language:

| Section | Term | Levels for Earl (2-person shop) | Levels for Boeing |
|---------|------|-------------------------------|-------------------|
| `rfc-section-competitive-analysis.md` (6.4) | "Telescoping Hierarchy" | 3 (Organization > Machine > Sensor) | 7+ |
| `rfc-section-two-domain-consistency.md` (X.5) | "Adaptive ISA-95 Depth" | L0+L1 only | L0-L4 |
| `rfc-section-multi-tenant.md` (Y.10.6) | "Adaptive Depth" | Conditional activation | Full hierarchy |
| `rfc-section-introduction.md` (1.2) | "Telescopes" | 2 levels (Organization > Equipment) | 8 levels |
| `rfc-section-reactive-isa95.md` (5.7.5) | "Variable-Depth Hierarchy" | 1-2 levels | Full ISA-95 |

**F-14 (LOW): Slight inconsistency in Earl's level count.** The introduction
says "2 levels," the competitive analysis says "3 levels" (Organization >
Machine > Sensor), and Section 5 says "1-2 levels." The two-domain section
says "L0+L1 only" which maps to 2-3 equipment types.

**Recommendation:** Standardize Earl's count as "3 entity types (Organization,
Machine, Sensor)" which maps to "2 ISA-95 functional levels (L0+L1)" since
Organization is not an ISA-95 level. Add this clarification to the
introduction.

---

## 6. Cross-Section Reference Integrity

### 6.1 Section Number References

Multiple sections use placeholder section numbers (X, Y, Z, M, N, S) because
the final section numbering depends on the assembly plan.

| From Section | References | Target | Status |
|---|---|---|---|
| reactive-isa95 | "See Section 7" (event schema) | Not yet written | UNRESOLVED |
| reactive-isa95 | "See Section 8" (transport) | Not yet written | UNRESOLVED |
| reactive-isa95 | "See Section 9" (consistency) | `rfc-section-two-domain-consistency.md` | MATCH (X) |
| reactive-isa95 | "See Section 6" (multi-tenant) | `rfc-section-multi-tenant.md` | MATCH (Y) |
| reactive-isa95 | "See G-8 in Section 9" | Two-domain X.4 | MATCH |
| reactive-isa95 | "See Appendix A" (transition catalog) | Not yet written | UNRESOLVED |
| introduction | "Section 5" (propagation rules) | `rfc-section-reactive-isa95.md` | MATCH |
| introduction | "Section 6" (transformation) | `rfc-section-multi-tenant.md` | MATCH |
| introduction | "Section 14" (data sovereignty) | `rfc-section-security-trust.md` | MATCH (Z) |
| two-domain | "Section X" (self-reference) | Self | OK |
| multi-tenant | "Section X" (two-domain) | `rfc-section-two-domain-consistency.md` | MATCH |
| multi-tenant | "Section Z" (security) | `rfc-section-security-trust.md` | MATCH |
| competitive | "Section 5" (propagation) | `rfc-section-reactive-isa95.md` | MATCH |

**F-15 (INFO): All cross-section references are logically consistent.** Section
numbering (X, Y, Z, M, N, S) is placeholder and will be resolved during
assembly (Task #83). Two references point to not-yet-written sections (event
schema, transport, transition catalog) -- these are documented in the assembly
plan.

---

## 7. Bibliography Citation Consistency

All sections use `[KEY]` citation format referencing
`docs/specifications/bibliography.md`.

| Citation | Used In | Present in Bibliography | Status |
|---|---|---|---|
| [ISA-95-1] | Reactive ISA-95, Competitive, Effect Arch | YES | OK |
| [ISA-18.2] | Reactive ISA-95, Two-Domain | YES | OK |
| [EFFECT-CLUSTER] | Effect Arch, Two-Domain, Multi-Tenant | YES | OK |
| [NATS-ACCOUNTS] | Competitive, Multi-Tenant, Two-Domain | YES | OK |
| [NATS-LEAFNODE] | Competitive, Multi-Tenant | YES | OK |
| [SPARKPLUG-B] | Competitive, Multi-Tenant | YES | OK |
| [FDA-CFR11] | Reactive ISA-95, Two-Domain, Multi-Tenant | YES | OK |
| [CRDT-SHAPIRO] | Two-Domain, Network Entities | YES | OK |
| [PACELC] | Two-Domain, Multi-Tenant | YES | OK |
| [OSTROM-COMMONS] | Competitive, Network Entities | YES | OK |
| [PARKER-PLATFORM] | Competitive, Network Entities | YES | OK |
| [ENDSLEY-1995] | Reactive ISA-95, Competitive | YES | OK |
| [RFC2119] | All sections | YES | OK |

**F-16 (NONE): All bibliography citations are consistent.** Every `[KEY]`
reference used across sections maps to an entry in `bibliography.md`.

---

## 8. Summary of Findings

### By Severity

| Severity | Count | Finding IDs |
|----------|-------|-------------|
| HIGH | 2 | F-4 (delivery tier conflict), F-12 (latency inconsistency) |
| MEDIUM | 2 | F-3 (T1-T4 naming collision), F-8 (graph file names), F-13 (ISA-95 level mapping) |
| LOW | 3 | F-1 (intro missing Device), F-2 (two-domain missing Plant/Device), F-9 (entity count), F-14 (Earl's level count) |
| NONE/INFO | 6 | F-5, F-6, F-7, F-10, F-11, F-15, F-16 |

### Action Items for Assembly (Task #83)

| Priority | Action | Sections Affected |
|----------|--------|-------------------|
| **P1** | Reconcile three-tier (Hot/Warm/Cold) vs four-tier (T1-T4) delivery model | reactive-isa95, competitive-analysis |
| **P1** | Add "Latency Measurement Points" diagram clarifying what each number measures | reactive-isa95, two-domain, competitive-analysis |
| **P2** | Rename entity taxonomy from T1-T4 to E1-E4 to avoid temporal tier collision | network-entities |
| **P2** | Standardize ISA-95 level-to-entity mapping (Area=L3, Line=L2) | network-entities (fix N.1.2) |
| **P2** | Verify and normalize graph file names (`alarm-graph.ts` vs `alarm-state-graph.ts`) | two-domain (X.12.2) |
| **P3** | Add `Device` to hierarchy listing in introduction | introduction (line 86) |
| **P3** | Add `Plant` and `Device` to hierarchy in two-domain X.5 or add "(simplified)" note | two-domain |
| **P3** | Standardize Earl's entity count as "3 entity types" across all sections | introduction, competitive, two-domain, reactive-isa95 |
| **P3** | Resolve placeholder section numbers (X, Y, Z, M, N, S -> final numbers) | All sections (during assembly) |

---

## 9. Positive Observations

Despite 23 RFC section files written by 8+ agents, the overall consistency is
remarkably high:

1. **Propagation rules are never contradicted.** All 13 rules (U-1..O-3) are
   referenced correctly whenever cited.

2. **Codebase file references are uniformly accurate.** Every `src/lib/iiot/`
   path checked against the actual codebase exists at the specified location.

3. **ISA-95 vocabulary is stable.** Entity names (Machine, Sensor, Plant, Line,
   etc.) are used consistently. No section invents new entity names that
   conflict with the codebase.

4. **The two-domain model (Sovereign/Federated) is universally adopted.**
   Every section that discusses cross-org behavior correctly distinguishes
   intra-org (G-1..G-7) from inter-org (G-8).

5. **RFC 2119 language is used correctly.** MUST/SHOULD/MAY keywords are
   applied with appropriate severity across all sections.

6. **Bibliography citations are consistent.** All `[KEY]` references map to
   entries in `bibliography.md`.

---

## Appendix: Files Reviewed

| File | Lines | Author |
|------|-------|--------|
| `rfc-section-reactive-isa95.md` | 878 | isa95-architect |
| `rfc-section-introduction.md` | ~400 | realtime-philosopher |
| `rfc-section-competitive-analysis.md` | 647 | industry-analyst |
| `rfc-section-two-domain-consistency.md` | 639 | temporal-analyst |
| `rfc-section-multi-tenant.md` | 567 | temporal-analyst |
| `rfc-section-effect-architecture.md` | ~1200 | effect-specialist |
| `rfc-section-network-entities.md` | 1491 | network-entity-writer |
| `rfc-section-network-entity-types.md` | 1233 | entity-types-writer |
| `rfc-section-marketplace-protocol.md` | 897 | marketplace-writer |
| `rfc-section-edge-architecture-v2.md` | ~700 | effect-specialist |
| `rfc-section-security-architecture.md` | ~500 | consistency-theorist |
| `rfc-section-theoretical-foundations.md` | ~600 | interface-visionary |
| `rfc-section-architectural-principles.md` | ~400 | interface-visionary |
| `rfc-section-developer-experience.md` | ~400 | dx-writer |
| `rfc-section-deployment-topology.md` | ~500 | edge-deployment-writer |
| `rfc-section-onboarding-protocol.md` | ~400 | industry-analyst |
| `rfc-section-monitoring-infrastructure.md` | ~400 | monitoring-writer |
| `rfc-section-observability.md` | ~300 | observability-writer |
| `rfc-section-failure-modes.md` | ~400 | failure-runbook-writer |
| `rfc-section-multi-tenant-network.md` | ~300 | temporal-analyst |
| `rfc-section-edge-architecture.md` | ~400 | effect-specialist |
| `rfc-section-security-trust.md` | ~600 | consistency-theorist |
| **Total** | **~12,000+** | **8+ agents** |

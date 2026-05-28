# Standards Conformance Matrix — Industrial Agentic Platform

Status: draft proof model

## 1. Purpose

This matrix reconciles platform design decisions with standards research. It exists to stop architectural folklore from quietly becoming “compliance.”

A row in this matrix is not a certification. A row is a **traceable claim**:

```text
standard source -> observed requirement/concept -> design decision -> implementation artifact -> proof obligation -> residual gap
```

If any part is missing, the claim is not ready to be sold as compliance.

## 2. Claim lifecycle

| Status | Meaning |
| --- | --- |
| `researched` | source found and summarized |
| `design-aligned` | RFC decision explicitly maps to source |
| `schema-planned` | schema boundary identified but not implemented |
| `implemented` | code exists |
| `verified` | tests/golden traces prove scoped behavior |
| `certification-required` | requires full standard text or third-party certification before external compliance claim |

## 3. Proof obligations

| Proof kind | Evidence example |
| --- | --- |
| Schema proof | Effect Schema validates required fields and rejects invalid envelopes/actions |
| Adapter proof | fake and real adapter pass the same contract suite |
| Golden trace proof | deterministic scenario proves source -> event -> graph -> Reactor -> command/audit path |
| SQL proof | authority records exist with exact IDs, timestamps, actor, policy, result, and causality |
| Policy proof | unsafe/unapproved action is denied with explainable reason |
| Replay proof | replay reconstructs decision context from durable records |
| Human review proof | standards owner reviews clause mapping against acquired standard text |

## 4. Decision traceability table

### DEC-IND-001 — Treat external industrial systems as dependency-injected ports

| Field | Value |
| --- | --- |
| Standards anchors | `STD-OPCUA-P1-OVERVIEW`, `STD-OPCUA-P4-SERVICES`, `STD-ISA95-CONCEPT`, `STD-MIMOSA-OSA-CBM` |
| Observed basis | OPC UA models broad cross-level data/services; ISA-95 frames L3/L4/MOM exchange; MIMOSA/OpenO&M emphasizes supplier-neutral interoperability. |
| Design decision | Represent OPC UA, Sparkplug, historian, CMMS, MES, ERP, and command gateways as Effect Layer ports with concrete adapters. |
| Artifacts | `RFC-0001-INTEGRATION-PORTS.md`, `RFC-0006-INDUSTRIAL-SCHEMAS.md` |
| Proof obligations | Define port schemas; add fake adapters; add adapter contract tests; require health/capability descriptors. |
| Current status | `design-aligned` |
| Residual gap | Full adapter contracts and tests not implemented yet. |

### DEC-IND-002 — Preserve OPC UA information-model semantics at ingestion

| Field | Value |
| --- | --- |
| Standards anchors | `STD-OPCUA-P1-OVERVIEW`, `STD-OPCUA-P4-SERVICES`, `STD-OPCUA-P9-ALARMS`, `STD-OPCUA-P11-HISTORICAL` |
| Observed basis | OPC UA AddressSpace has Nodes, References, Objects, Variables, Methods, Alarms/Events, history, service sets, subscriptions, and auditing/security concerns. |
| Design decision | OPC UA adapter must capture NodeId, BrowseName, NodeClass, References, Variable values, quality/status, event/alarm identity, method/write capability, and audit/security provenance. |
| Artifacts | `RFC-0002-DMN-DATA-MESSAGE-NETWORK.md`, `RFC-0007-OPCUA-SPARKPLUG-EMULATORS.md` |
| Proof obligations | OPC UA emulator manifest validates browse/read/subscribe/event/method paths; real adapter contract tests match emulator behavior. |
| Current status | `schema-planned` |
| Residual gap | Need exact schema definitions and adapter/emulator implementation. |

### DEC-IND-003 — Model Sparkplug session/lifecycle semantics, not just MQTT messages

| Field | Value |
| --- | --- |
| Standards anchors | `STD-SPARKPLUG-OP-BEHAVIOR`, `STD-SPARKPLUG-PAYLOAD` |
| Observed basis | Sparkplug Birth/Death Certificates provide state/context; primary host controls command authority; NBIRTH/DBIRTH precede data; NDEATH/DDEATH imply offline/stale; seq/bdSeq guard ordering/session validity. |
| Design decision | Sparkplug adapter and emulator must model STATE, NBIRTH, NDEATH, DBIRTH, DDEATH, DDATA, NCMD/DCMD, sequence, bdSeq, stale quality, UTC timestamps, and primary host behavior. |
| Artifacts | `RFC-0002-DMN-DATA-MESSAGE-NETWORK.md`, `RFC-0007-OPCUA-SPARKPLUG-EMULATORS.md` |
| Proof obligations | Golden trace covers edge birth, device birth, data, device death, edge death, stale metrics, rebirth request, and command denial. |
| Current status | `schema-planned` |
| Residual gap | Need protobuf decoder boundary and Sparkplug contract tests. |

### DEC-IND-004 — Center the product at ISA-95 Level 3 while integrating L2/L4

| Field | Value |
| --- | --- |
| Standards anchors | `STD-ISA95-CONCEPT` |
| Observed basis | ISA-95 frames Level 3 as MOM and includes maintenance, quality, inventory movement, SCADA monitoring/control, historians, scheduling, dispatching, work/product tracking, and exchanges with ERP and control systems. |
| Design decision | The platform is an L3-ish agentic digital-twin/control-plane layer integrating L2 telemetry/SCADA/historian and L4 ERP/CMMS/MES through ports. |
| Artifacts | `RFC-0000-CHARTER.md`, `RFC-0006-INDUSTRIAL-SCHEMAS.md` |
| Proof obligations | Schema taxonomy distinguishes material, equipment, physical asset, personnel, operation context, and external-system identity mappings. |
| Current status | `design-aligned` |
| Residual gap | Need full ISA-95 clause review before claiming ISA-95 conformance. |

### DEC-IND-005 — Distinguish equipment role identity from physical asset identity

| Field | Value |
| --- | --- |
| Standards anchors | `STD-ISA95-CONCEPT`, `STD-MIMOSA-OSA-CBM` |
| Observed basis | ISA-95 distinguishes equipment role/tag identity from physical asset identity; MIMOSA/OpenO&M emphasizes physical asset lifecycle and identifier harmonization. |
| Design decision | Industrial identity schemas must represent role/equipment IDs and physical asset IDs separately, with mapping provenance and time-bounded assignments. |
| Artifacts | `RFC-0006-INDUSTRIAL-SCHEMAS.md` |
| Proof obligations | Schema tests prove role/asset split; graph projection tests prove asset swap preserves history and relationship audit. |
| Current status | `schema-planned` |
| Residual gap | Need schema implementation and asset-swap scenario. |

### DEC-IND-006 — Alarm management follows ISA-18.2 lifecycle, OPC UA Part 9 supplies one ingestion model

| Field | Value |
| --- | --- |
| Standards anchors | `STD-ISA18-SERIES`, `STD-OPCUA-P9-ALARMS` |
| Observed basis | OPC UA Part 9 defines Alarm/Condition information model and acknowledgement capabilities; ISA-18.2 governs alarm lifecycle, philosophy, rationalization, prioritization, performance monitoring, and ongoing change management. |
| Design decision | Alarm schemas separate definition, occurrence, lifecycle, ack, shelving/suppression, rationalization reference, operator action, and audit. |
| Artifacts | `RFC-0003-COMMAND-GOVERNANCE.md`, `RFC-0006-INDUSTRIAL-SCHEMAS.md` |
| Proof obligations | Alarm golden trace covers active/unacked, ack, shelve/suppress denied/approved, return-to-normal, audit, and alarm flood grouping. |
| Current status | `schema-planned` |
| Residual gap | Need acquired ISA-18.2 text for clause-level lifecycle field mapping. |

### DEC-IND-007 — Agent commands must be governed with policy, interlocks, approvals, audit, and deny-by-default OT posture

| Field | Value |
| --- | --- |
| Standards anchors | `STD-IEC62443-SERIES`, `STD-OPCUA-P1-OVERVIEW`, `STD-SPARKPLUG-OP-BEHAVIOR` |
| Observed basis | ISA/IEC 62443 addresses secure IACS lifecycle, stakeholders, risk assessment, security levels, and secure development; OPC UA includes authentication/encryption/integrity/auditing; Sparkplug states that only Primary Host should issue commands and discusses ACL/security for CMD verbs. |
| Design decision | Agents produce command proposals; execution requires command class, actor/role, zone/conduit/deployment profile, policy, interlock, approval, execution receipt, audit, and reconciliation. |
| Artifacts | `RFC-0003-COMMAND-GOVERNANCE.md` |
| Proof obligations | SQL command authority tables; denial tests for unapproved PLC writes; approval tests for CMMS actions; replay reconstructs command decision. |
| Current status | `design-aligned` |
| Residual gap | Need full 62443-3-2/3-3/4-1/4-2 review before any 62443 compliance claim. |

### DEC-IND-008 — Use PackML as optional normalized machine-state overlay

| Field | Value |
| --- | --- |
| Standards anchors | `STD-PACKML-CONCEPT` |
| Observed basis | PackML defines standard state-based model, Unit Modes, StateMachine, PackTags, command/status/admin tags, OEE/RCA data, and consistent SCADA/MES inputs. |
| Design decision | Virtual plant and applicable adapters may emit PackML-normalized machine states/tags, but non-PackML equipment is not forced into the model. |
| Artifacts | `RFC-0006-INDUSTRIAL-SCHEMAS.md`, `RFC-0007-OPCUA-SPARKPLUG-EMULATORS.md` |
| Proof obligations | PackML machine scenario covers mode/state/tag changes and maps to telemetry/events/OEE evidence. |
| Current status | `schema-planned` |
| Residual gap | Need PackML state/tag schema and scenario implementation. |

### DEC-IND-009 — OEE/KPI calculations must be evidence-backed, not dashboard math

| Field | Value |
| --- | --- |
| Standards anchors | `STD-ISO22400-KPI`, `STD-PACKML-CONCEPT`, `STD-ISA95-CONCEPT` |
| Observed basis | ISO 22400 defines an industry-neutral KPI framework for MOM, aligned with IEC 62264/ISA-95; PackML can provide OEE data and state/tag evidence. |
| Design decision | OEE/KPI read models require production windows, downtime frames, quantities, units, source events/time-series, and formula/version metadata. |
| Artifacts | `RFC-0006-INDUSTRIAL-SCHEMAS.md`, `RFC-0007-OPCUA-SPARKPLUG-EMULATORS.md` |
| Proof obligations | Golden trace proves availability/performance/quality inputs and generated OEE snapshot from replayed evidence. |
| Current status | `schema-planned` |
| Residual gap | Need full ISO 22400-1/2 formula review before external KPI conformance claim. |

### DEC-IND-010 — Condition-based maintenance and asset health should use supplier-neutral maintenance semantics

| Field | Value |
| --- | --- |
| Standards anchors | `STD-MIMOSA-OSA-CBM`, `STD-ISA95-CONCEPT` |
| Observed basis | MIMOSA OSA-CBM supports condition-based maintenance information movement; MIMOSA/OpenO&M emphasize supplier-neutral physical asset management and identifier harmonization. ISA-95 identifies maintenance and physical asset information as MOM exchange concerns. |
| Design decision | Maintenance schemas should preserve condition evidence, diagnostic/prognostic recommendation context, physical asset identity, CMMS mapping, and source-system provenance. |
| Artifacts | `RFC-0006-INDUSTRIAL-SCHEMAS.md`, `RFC-0005-MARKET-WEDGES.md` |
| Proof obligations | Condition evidence -> recommendation -> approved CMMS WorkOrder update golden trace. |
| Current status | `schema-planned` |
| Residual gap | Need selected OSA-CBM/CCOM object mapping and CMMS adapter contract. |

### DEC-IND-011 — Agents consume replayable context packets that separate evidence from inference

| Field | Value |
| --- | --- |
| Standards anchors | `STD-ISA95-CONCEPT`, `STD-ISA18-SERIES`, `STD-IEC62443-SERIES`, `STD-OPCUA-P1-OVERVIEW`, `STD-SPARKPLUG-OP-BEHAVIOR`, `STD-ISO22400-KPI`, `STD-MIMOSA-OSA-CBM` |
| Observed basis | Industrial decisions mix Level 3 operations context, alarms, security boundaries, protocol evidence, KPI evidence, and asset-health evidence. Public standards sources consistently emphasize structured context, roles, lifecycle state, and traceability. |
| Design decision | Agents receive `AgentContextPacket` objects with authority refs, projection refs, standards refs, observations, inferences, recommendations, limits, and replay locators. |
| Artifacts | `RFC-0008-AGENT-CONTEXT-PACKETS.md` |
| Proof obligations | `PROOF-AGENT-CONTEXT-REPLAY` |
| Current status | `design-aligned` |
| Residual gap | Need schemas, assembler service, and replay tests. |

### DEC-IND-012 — Industrial commands use SQL-backed authority records before execution

| Field | Value |
| --- | --- |
| Standards anchors | `STD-IEC62443-SERIES`, `STD-OPCUA-P1-OVERVIEW`, `STD-OPCUA-P4-SERVICES`, `STD-SPARKPLUG-OP-BEHAVIOR`, `STD-ISA18-SERIES`, `STD-ISA95-CONCEPT` |
| Observed basis | IEC 62443 requires secure IACS lifecycle/risk posture; OPC UA has auditable service classes; Sparkplug has Primary Host / NCMD / DCMD command semantics; ISA-18.2 and ISA-95 require role/lifecycle context for alarm and operations actions. |
| Design decision | Command proposals, policy decisions, interlock results, approvals, execution receipts, and reconciliation facts are SQL-backed authority records before any adapter write is attempted. |
| Artifacts | `RFC-0009-COMMAND-SQL-AUTHORITY.md` |
| Proof obligations | `PROOF-COMMAND-SQL-AUTHORITY`, `PROOF-COMMAND-DENIAL`, `PROOF-COMMAND-REPLAY` |
| Current status | `design-aligned` |
| Residual gap | Need DDL/models/repos/services/tests. |

### DEC-IND-013 — Implementation roadmap is gated by standards traceability, emulators, golden traces, and command governance

| Field | Value |
| --- | --- |
| Standards anchors | `STD-OPCUA-P1-OVERVIEW`, `STD-SPARKPLUG-OP-BEHAVIOR`, `STD-ISA95-CONCEPT`, `STD-ISA18-SERIES`, `STD-IEC62443-SERIES`, `STD-PACKML-CONCEPT`, `STD-ISO22400-KPI`, `STD-MIMOSA-OSA-CBM` |
| Observed basis | Each standard family imposes different obligations: protocol semantics, L3 model semantics, alarm lifecycle, cybersecurity risk posture, machine states, KPI evidence, and asset-health interoperability. |
| Design decision | Implementation proceeds through standards traceability, schemas, emulators, golden traces, SQL command authority, context packets, real adapters, deployment policies, and market wedge validation. |
| Artifacts | `RFC-0010-IMPLEMENTATION-ROADMAP.md`, `STANDARDS-RESEARCH-LEDGER.md`, `STANDARDS-CONFORMANCE-MATRIX.md`, `scripts/industrial-platform-standards-check.ts` |
| Proof obligations | `PROOF-STANDARDS-TRACEABILITY-GATE` |
| Current status | `design-aligned` |
| Residual gap | Need future implementation phases to satisfy their planned proof gates. |

## 5. Proof obligation registry

| Proof ID | Owner | Kind | Status | Required evidence |
| --- | --- | --- | --- | --- |
| `PROOF-PORT-CONTRACTS` | integration-platform | adapter-contract-tests | planned | Port schemas, fake adapters, health/capability descriptors, and adapter contract tests. |
| `PROOF-OPCUA-CONTRACT` | opcua-adapter | adapter-contract-tests | planned | Browse/read/subscribe/event/method/write-denial tests shared by emulator and real adapter. |
| `PROOF-SPARKPLUG-GOLDEN-TRACE` | sparkplug-adapter | golden-trace | planned | STATE, NBIRTH, DBIRTH, DDATA, DDEATH, NDEATH, stale metric, rebirth, and command-denial trace. |
| `PROOF-ISA95-SCHEMA-SPLIT` | industrial-schemas | schema-tests | planned | Material/equipment/physical-asset/personnel schema separation and identity mapping tests. |
| `PROOF-ASSET-IDENTITY-SWAP` | industrial-graph | golden-trace | planned | Asset swap trace proving role/equipment identity and physical asset identity remain distinct across history. |
| `PROOF-ALARM-LIFECYCLE-TRACE` | alarm-domain | golden-trace | planned | Active/unacked, ack, shelve/suppress, return-to-normal, rationalization, and audit trace. |
| `PROOF-COMMAND-DENIAL` | command-governance | policy-tests | planned | Unsafe or unapproved OT write attempts are denied with policy/interlock explanation. |
| `PROOF-COMMAND-REPLAY` | command-governance | replay-tests | planned | Command proposal/approval/interlock/execution/denial can be reconstructed from durable records. |
| `PROOF-PACKML-SCENARIO` | virtual-plant | golden-trace | planned | PackML mode/state/tag scenario maps to telemetry, events, OEE evidence, and read models. |
| `PROOF-OEE-GOLDEN-TRACE` | oee-read-model | golden-trace | planned | Availability/performance/quality inputs produce versioned OEE snapshot from replayable evidence. |
| `PROOF-CBM-WORKORDER-TRACE` | maintenance-domain | golden-trace | planned | Condition evidence leads to recommendation, governed approval, and CMMS/WorkOrder update trace. |
| `PROOF-AGENT-CONTEXT-REPLAY` | agent-context | replay-tests | planned | Agent context packet can be reconstructed from durable authority/projection/standards refs and preserves observation/inference separation. |
| `PROOF-COMMAND-SQL-AUTHORITY` | command-governance | sql-authority-tests | planned | SQL records exist for proposal, policy, interlock, approval, execution receipt, reconciliation, and replay. |
| `PROOF-STANDARDS-TRACEABILITY-GATE` | industrial-platform | docs-traceability-check | implemented | `scripts/industrial-platform-standards-check.ts` verifies sources, decisions, proof obligations, and artifact paths. |

## 6. Minimum CI conformance gate

The lightweight gate for docs/design phase:

```bash
bun run scripts/industrial-platform-standards-check.ts
```

The script checks:

1. standards source IDs are unique;
2. decision IDs are unique;
3. each decision cites at least one standards source;
4. each cited standards source exists;
5. proof obligations have owners/status;
6. artifact paths exist where marked as required;
7. standards and decision IDs are represented in this matrix.

This is not a standards certification suite. It is a traceability anti-fraud device. Lovely little bureaucratic sword, really.

## 7. Immediate remediation backlog

1. Acquire/review full ISA-18.2 and map alarm lifecycle fields clause-by-clause.
2. Acquire/review ISA/IEC 62443-3-2/3-3/4-1/4-2 and map command/deployment/security controls.
3. Pull Sparkplug TCK-testable requirements into emulator contract tests.
4. Pull OPC UA Part 4 service sets into adapter contract suite.
5. Define PackML state/tag schema from ISA-TR88.00.02 and OPC UA PackML reference.
6. Define ISO 22400 KPI calculation proof fixtures after full formula review.
7. Define MIMOSA/OSA-CBM mapping for asset health and maintenance recommendation payloads.

# RFC-0010 — Standards-Grounded Implementation Roadmap

Status: draft

## 1. Purpose

This RFC turns the industrial platform RFC pack into an implementation sequence with standards research, conformance proof, emulator/golden-trace gates, and safe promotion milestones.

This roadmap deliberately separates:

```text
standards alignment -> schema design -> emulator proof -> SQL authority -> adapter implementation -> guarded activation -> external compliance claim
```

Skipping those layers is how an “AI control plane” becomes a Rube Goldberg liability sculpture. We are not doing that.

## 2. Roadmap rules

1. **Research before implementation.** Each domain slice starts by adding or updating standards ledger entries.
2. **Conformance row before code.** Every material design decision gets a conformance matrix row before implementation.
3. **Schema before adapter.** Boundary payloads are Schema-backed before a real connector exists.
4. **Emulator before live adapter.** OPC UA and Sparkplug behavior is proven in simulation first.
5. **Golden trace before activation.** A slice is not promoted until replayable traces prove source -> event -> projection -> decision -> audit.
6. **Command governance before commands.** No adapter write surface is live without SQL command authority and policy/interlock tests.
7. **Public-source alignment is not certification.** Compliance claims remain internal until full standard text or third-party review supports them.

## 3. Phase 0 — Standards control plane

Goal: make standards traceability a first-class build artifact.

Deliverables:

- `STANDARDS-RESEARCH-LEDGER.md`
- `STANDARDS-CONFORMANCE-MATRIX.md`
- `standards-conformance.json`
- `scripts/industrial-platform-standards-check.ts`

Gate:

```bash
bun run scripts/industrial-platform-standards-check.ts
```

Exit criteria:

- every source has an evidence level;
- every decision cites at least one source;
- every decision has proof obligations;
- every artifact path exists;
- no RFC uses standards-alignment language without matrix coverage.

## 4. Phase 1 — Industrial schema nucleus

Goal: implement the schema package proposed by RFC-0006.

First schema files:

```text
src/lib/iiot/schemas/industrial/
├── identity.ts
├── telemetry.ts
├── adapters/opcua.ts
├── adapters/sparkplug.ts
├── alarms-isa18.ts
├── command-governance.ts
└── simulation.ts
```

Standards decisions:

- `DEC-IND-002` OPC UA information semantics.
- `DEC-IND-003` Sparkplug lifecycle/session semantics.
- `DEC-IND-006` ISA-18.2 alarm lifecycle split.
- `DEC-IND-007` command governance boundary.

Proof gates:

- schema decode/encode tests;
- invalid payload rejection tests;
- extension fields marked as TMNL extension;
- docs update showing standards mapping per schema.

## 5. Phase 2 — OPC UA emulator and contract suite

Goal: prove OPC UA ingestion expectations before real plant connectivity.

Deliverables:

- OPC UA virtual namespace manifest;
- browse/read/subscribe/event simulation;
- alarm/condition simulation;
- Method/Attribute write capability descriptors;
- command-denial path through command governance stub;
- contract tests that real adapter must later satisfy.

Standards gates:

- Part 1 AddressSpace/Nodes/References represented;
- Part 4 service families represented in contract tests;
- Part 9 alarm/condition identity preserved;
- Part 11 historical identity mapped to historian port where used.

## 6. Phase 3 — Sparkplug emulator and contract suite

Goal: prove Sparkplug semantics as stateful session/lifecycle behavior, not generic MQTT ingestion.

Deliverables:

- Sparkplug virtual group/edge/device manifest;
- STATE/NBIRTH/NDEATH/DBIRTH/DDEATH/DDATA scenario runner;
- seq/bdSeq validation;
- stale-quality behavior;
- primary-host command capability behavior;
- NCMD/DCMD command-denial path.

Standards gates:

- UTC timestamp behavior;
- birth before data;
- death implies offline/stale;
- rebirth request trace;
- command topic class mapped to governance.

## 7. Phase 4 — Virtual plant golden traces

Goal: make the first sellable demo reproducible and testable.

Golden traces:

| Trace | Standards exercised |
| --- | --- |
| machine fault impact | OPC UA/Sparkplug, ISA-95, PackML, Reactor, command governance |
| alarm flood triage | ISA-18.2, OPC UA Part 9, agent context packets |
| unsafe command blocked | IEC 62443-inspired posture, OPC UA/Sparkplug command classes |
| external dependency unavailable | ISA-95 L3/L4 integration, Reactor constraints, CMMS/MES ports |
| OEE downtime explanation | ISO 22400, PackML, historian/event evidence |
| condition-based maintenance | MIMOSA/OSA-CBM, ISA-95 physical asset identity, WorkOrder/CMMS port |

Exit criteria:

- each trace starts from source protocol payloads;
- each trace includes standards anchor IDs;
- replay reconstructs expected domain events/read models/command decisions;
- generated guided reader links traces to RFCs.

## 8. Phase 5 — SQL command authority

Goal: implement RFC-0009 before any real write-capable adapter.

Deliverables:

- command proposal model/DDL/repo;
- policy decision model/DDL/repo;
- interlock result model/DDL/repo;
- approval model/DDL/repo;
- execution receipt model/DDL/repo;
- reconciliation model/DDL/repo;
- command authority service;
- command replay query surface.

Proof gates:

- denied PLC write test;
- approved CMMS update test;
- stale data fails closed;
- missing approval fails closed;
- adapter rejection becomes durable receipt;
- replay reconstructs proposal -> policy -> result.

## 9. Phase 6 — Agent context assembler

Goal: agents consume context packets, not raw sprawling system internals.

Deliverables:

- AgentContextPacket schemas;
- AgentContextAssembler service;
- standards trace attachment;
- evidence ref resolver;
- packet replay tests;
- first prompt/output contract for explanation/recommendation.

Proof gates:

- observed facts/inferences separation;
- missing evidence surfaced;
- standards refs present for standards-derived semantics;
- command proposal output cannot bypass command authority.

## 10. Phase 7 — Real adapters behind the same ports

Only after emulator/SQL/context gates:

| Adapter | First live posture |
| --- | --- |
| OPC UA | read/browse/subscribe only; writes locked |
| Sparkplug | host subscriber; command publishing locked except rebirth under policy if explicitly enabled |
| Historian | read/write according to deployment profile |
| CMMS | create/update WorkOrders through approval workflow |
| MES | schedule/status integration, write operations approval-gated |

## 11. Phase 8 — Deployment and Kubernetes policy

Goal: prove deployment profiles enforce architecture.

Deliverables:

- deployment profile schema;
- Pepr/Kubernetes policy research update;
- local k3d/kind profile;
- edge-readonly profile;
- edge-supervisory simulated profile;
- admission rules preventing unsafe command gateway deployment.

Proof gates:

- edge-readonly cannot deploy write-capable command gateway;
- simulator profile can deploy simulated command gateway;
- required audit/log sinks enforced;
- zone/conduit labels required for command-capable workloads.

## 12. Phase 9 — Market wedge validation

Goal: select first productized workflow.

Candidate wedge stack remains:

```text
Primary: graph intelligence / impact analysis
Paired with: agentic maintenance planner
Proven through: virtual plant + alarm/fault/OEE scenario
Protected by: command governance
```

Research artifacts:

- competitor matrix;
- buyer/persona scoring;
- integration expectation matrix;
- demo conversion rubric;
- pilot scope proposal;
- standards/compliance claim policy.

## 13. Standards acquisition backlog

Before external compliance language:

1. Acquire/review ANSI/ISA-18.2 and selected TR18.2 reports.
2. Acquire/review ISA/IEC 62443-3-2, 3-3, 4-1, 4-2; possibly 2-1/2-4 by role.
3. Acquire/review ISA-TR88.00.02 PackML full text.
4. Acquire/review ISO 22400-1/2 full text for KPI formulas and terminology.
5. Acquire/review ISA-95/IEC 62264 parts required for schema scope.
6. Select MIMOSA OSA-CBM/CCOM artifacts for asset health mapping.

## 14. Acceptance criteria

- Implementation cannot outrun standards traceability.
- Emulators and golden traces precede live adapters.
- SQL command authority precedes write-capable integration.
- Agent output remains evidence-backed and replayable.
- Deployment policy prevents accidental command-capable live profiles.
- External compliance claims are explicitly gated by evidence level and review status.

# RFC-0011 — Plant Ops Deep Decomposition

Status: draft implementation architecture

## 1. Purpose

The platform is too large to survive as an `industrial/*` bucket. That name hides the actual product shape and invites a convenient architectural crime: one folder for standards, protocols, schemas, adapters, command governance, simulation, agents, deployment, and market evidence.

This RFC decomposes the post-Reactor platform into narrow, testable plant-operations tracks. The objective is not “more docs.” The objective is to make every future implementation slice small enough to validate, deny, replay, and replace.

## 2. Product center of gravity

Preferred product namespace: **Plant Ops Platform**.

The platform is an ISA-95 Level 3-centered operations intelligence and supervisory control plane that integrates downward into Level 2 telemetry/alarm/supervisory systems and upward into Level 4 enterprise planning/work systems.

It is not:

- a SCADA clone;
- a PLC or SIS runtime;
- a generic “industrial” bag;
- an agent free-for-all;
- a graph database pretending to be authority.

It is:

- a standards-grounded operations substrate;
- a graph-backed digital twin projection layer;
- a command-governed supervisory action plane;
- a deterministic virtual plant and golden-trace harness;
- a packetized context source for agents;
- a SQL/EventJournal-authoritative audit system.

## 3. Dependency spine

Effect v3 grounding gives the dependency direction:

```text
standards ledgers
  ↓
pure schemas
  ↓
service interfaces / ports
  ↓
domain services / policies / planners
  ↓
Layer.scoped adapter implementations
  ↓
application edges / ManagedRuntime clients / scripts / UI
```

Forbidden reverse edges:

```text
schema → service
schema → adapter
schema → SQL client
schema → ManagedRuntime
port interface → vendor SDK
business service → ManagedRuntime.make(...)
adapter → command authorization bypass
projection → Reactor mutation dispatch
agent → direct write-capable adapter
```

## 4. Bounded contexts

### 4.1 Standards Workbench

Feature plan: `#F1197 Plant Ops Standards Conformance Workbench`

Owns:

- source ledger;
- standards research ledger;
- conformance matrix;
- evidence levels;
- proof obligations;
- traceability gate.

Primary artifacts:

```text
STANDARDS-RESEARCH-LEDGER.md
STANDARDS-CONFORMANCE-MATRIX.md
standards-conformance.json
scripts/*standards-check.ts
```

Authority rule: standards claims must map source → decision → artifact → proof obligation.

### 4.2 Effect Boundary and Naming Decomposition

Feature plan: `#F1201 Plant Ops Effect Boundary and Naming Decomposition`

Owns:

- Effect v3 grounding ledger;
- namespace migration plan;
- dependency DAG;
- boundary lint rules;
- physical rename sequence.

Primary artifacts:

```text
EFFECT-V3-GROUNDING-LEDGER.md
NAMESPACE-MIGRATION.md
BOUNDARY-RULES.md
RFC-0011-PLANT-OPS-DECOMPOSITION.md
```

Authority rule: Effect runtime boundaries are architectural boundaries, not convenience wrappers.

### 4.3 Schema and DMN Contract Nucleus

Feature plan: `#F1205 Plant Ops Schema and DMN Contract Nucleus`

Owns pure Effect Schema contracts for:

- standards/evidence refs;
- plant identity and source addresses;
- telemetry quality/value frames;
- OPC UA evidence;
- Sparkplug evidence;
- ISA-18.2 alarm overlays;
- PackML overlays;
- ISO 22400/OEE KPI evidence;
- command proposal envelopes;
- DMN normalized message families.

Preferred future code path:

```text
src/lib/iiot/schemas/plant-ops/
  standards.ts
  identity.ts
  telemetry.ts
  dmn.ts
  protocols/
    opcua.ts
    sparkplug.ts
  overlays/
    alarms-isa18.ts
    packml.ts
    kpi-iso22400.ts
  commands.ts
  index.ts
```

Authority rule: schema modules are pure data contracts. No I/O, no runtime, no adapter imports.

### 4.4 Protocol Emulators and Golden Traces

Feature plan: `#F1209 Plant Ops Protocol Emulators and Golden Trace Harness`

Owns:

- virtual plant manifests;
- OPC UA emulator;
- Sparkplug emulator;
- scenario DSL;
- deterministic golden traces;
- real-vs-sim adapter contract tests.

Preferred future paths:

```text
src/lib/iiot/plant-ops/simulation/
src/lib/iiot/plant-ops/adapters/opcua/sim/
src/lib/iiot/plant-ops/adapters/sparkplug/sim/
src/lib/iiot/plant-ops/golden-traces/
```

Authority rule: live adapter activation waits for simulator/golden-trace proof.

### 4.5 Command Authority and Agent Context Plane

Feature plan: `#F1213 Plant Ops Command Authority and Agent Context Plane`

Owns:

- agent context packet schemas;
- context assembler service;
- command authority SQL DDL/models/repos;
- policy/interlock/approval/evidence lifecycle;
- command executor ports;
- replay tests.

Preferred future paths:

```text
src/lib/iiot/plant-ops/agent-context/
src/lib/iiot/plant-ops/command-authority/
src/lib/iiot/models/plant-ops/commands/
src/lib/iiot/repos/plant-ops/commands/
```

Authority rule: agents propose; SQL command authority disposes. No direct OT write path.

### 4.6 Deployment Profiles and Market Wedge

Feature plan: `#F1217 Plant Ops Deployment Profiles and Market Wedge Validation`

Owns:

- deployment profile schema;
- edge/cloud/airgapped profile rules;
- Kubernetes/Pepr policy plan;
- market wedge research;
- pilot/demo acceptance rubric.

Preferred future paths:

```text
src/lib/iiot/plant-ops/deployment/
src/lib/iiot/plant-ops/policy/kubernetes/
src/lib/iiot/docs/plant-ops-platform/market/
```

Authority rule: command-capable deployment requires explicit policy gates and audit sinks.

## 5. Module DAG

```text
standards
  └─ schemas
      ├─ dmn
      ├─ ports
      │   ├─ telemetry-source
      │   ├─ alarm-source
      │   ├─ historian
      │   ├─ command-executor
      │   └─ work-system
      ├─ domain policies
      │   ├─ command governance
      │   ├─ context assembly
      │   ├─ golden-trace assertions
      │   └─ deployment profile validation
      ├─ adapters
      │   ├─ opcua-sim
      │   ├─ opcua-live
      │   ├─ sparkplug-sim
      │   ├─ sparkplug-live
      │   ├─ historian-live
      │   └─ work-system-live
      └─ edges
          ├─ CLI/script runners
          ├─ Tauri/UI clients
          ├─ test ManagedRuntime harnesses
          └─ deployment entrypoints
```

Read-model/projection dependencies sit beside this DAG, not above it:

```text
durable source event / adapter observation
  → DMN envelope
  → domain event / SQL write
  → graph/read-model projection
  → Reactor observation if eligible
  → context packet assembly
```

## 6. First implementation train

The safe sequence is:

1. Finalize Effect/naming docs.
2. Add boundary lint specification.
3. Rename docs/readers in a dedicated path migration commit.
4. Implement pure schema nucleus.
5. Add schema tests.
6. Implement simulator manifests.
7. Add OPC UA/Sparkplug emulator contract tests.
8. Add first golden traces.
9. Implement command SQL authority.
10. Implement agent context assembler.
11. Add deployment profile and policy checks.
12. Only then consider live read-only adapters.

No live write-capable adapter appears before command authority denial/replay tests pass.

## 7. Integration with Reactor

Reactor remains structural consistency, not workflow orchestration.

Allowed:

- graph projections expose topology used by Reactor;
- command authority can include Reactor/graph impact evidence in context packets;
- golden traces can assert Reactor side effects as downstream projections.

Forbidden:

- adapter observation directly mutates Reactor targets;
- projection handlers dispatch Reactor target mutations;
- agents trigger Reactor paths directly;
- command execution bypasses SQL command authority because “the graph says so.”

## 8. Done means

A slice is done when it has:

- source/proof mapping;
- pure schemas where applicable;
- service interface if behavior exists;
- Layer implementation if resources exist;
- simulator/fake before live adapter;
- invalid/denied test cases;
- replay story;
- reader/conformance update.

Pretty diagrams are optional. Durable evidence is not.

# Plant Ops Boundary Rules

Status: implementation guardrail spec

## 1. Purpose

The Plant Ops Platform will touch standards, protocols, SQL, EventJournal, graph projections, Reactor, simulators, agents, deployment policy, and live adapters. Without boundary rules, it becomes one import cycle in a trench coat.

These rules define what each layer may import and where runtime/resource ownership belongs.

## 2. Layer taxonomy

```text
standards docs / conformance ledgers
  ↓
pure schema modules
  ↓
service interfaces / ports
  ↓
domain services / policies
  ↓
Layer implementations / adapters
  ↓
edge runtimes / CLI / UI / deployment entrypoints
```

## 3. Schema purity rule

Applies to future paths:

```text
src/lib/iiot/schemas/plant-ops/**
src/lib/iiot/schemas/**/plant-ops/**
```

Allowed imports:

```text
effect
./*
../* schema-only modules
```

Forbidden imports:

```text
@effect/sql
@effect/platform
@effect/cluster
node:*
postgres/SQL clients
NATS/MQTT/OPC UA/vendor SDKs
src/lib/iiot/repos/*
src/lib/iiot/services/*
src/lib/iiot/infrastructure/*
ManagedRuntime
Layer.scoped
Effect.runPromise
```

Allowed contents:

- `Schema.Literal`, `Schema.Struct`, `Schema.TaggedStruct`, `Schema.TaggedClass`;
- brands and refinements;
- pure constructors/constants;
- schema unions and transforms;
- exported inferred types.

Forbidden contents:

- SQL queries;
- network calls;
- environment reads;
- runtime construction;
- service provisioning;
- hidden policy execution.

Reason: schemas are shared contracts. Importing a schema must never acquire resources or choose behavior.

## 4. Service interface rule

Applies to future paths:

```text
src/lib/iiot/plant-ops/ports/**
src/lib/iiot/plant-ops/*/services/**
```

Service interfaces may import:

- `effect` Context/Effect/Stream types;
- local schema types;
- error schemas/types;
- pure helper types.

Service interfaces must not import:

- vendor SDKs;
- SQL model implementations;
- concrete adapter layers;
- runtime factories;
- UI code.

A service interface names a role, not a product:

```text
OpcUaPort
SparkplugPort
HistorianPort
IdentityResolver
CommandAuthority
AgentContextAssembler
VirtualPlantRunner
```

## 5. Adapter implementation rule

Applies to future paths:

```text
src/lib/iiot/plant-ops/adapters/**
src/lib/iiot/plant-ops/**/live/**
src/lib/iiot/plant-ops/**/sim/**
```

Adapter implementations may import vendor SDKs and resource clients.

Resource-owning adapters must expose `Layer.scoped` or an equivalent scoped Layer. They should not export a global singleton client.

Adapter implementations must not:

- bypass command authority for writes;
- emit domain events without schema decoding;
- write graph topology directly except through projection contracts;
- be required by schema modules.

## 6. ManagedRuntime edge rule

Allowed locations for `ManagedRuntime`:

```text
scripts/**
CLI entrypoints
test harnesses
Tauri/UI integration clients
src/lib/iiot/**/runtime/**
src/lib/iiot/**/edge/**
```

Forbidden locations:

```text
src/lib/iiot/schemas/**
src/lib/iiot/plant-ops/ports/**
src/lib/iiot/plant-ops/*/domain/**
src/lib/iiot/plant-ops/*/services/**  (unless explicitly an edge client module)
```

Rule of thumb:

```text
Business logic composes Layers.
Edges run Effects.
```

If a domain service calls `ManagedRuntime.make`, it is probably hiding dependency injection and lifecycle ownership. That is not clever; it is just a singleton with better stationery.

## 7. SQL/EventJournal authority rule

Effect primitives are process-local. Durable truth remains SQL/EventJournal.

| Concern | Authority |
| --- | --- |
| command proposal/policy/interlock/approval/execution/reconciliation | SQL command authority |
| domain transitions | EventJournal / target entity handlers |
| graph topology | durable StructuralEvents/ContextEvents projections plus audit |
| Reactor source claims/checkpoints/constraints | SQL Reactor tables |
| historical telemetry | historian port/store |
| standards/proof claims | conformance ledgers and JSON gate |

## 8. Agent boundary rule

Agents consume context packets and emit structured proposals.

Agents must not:

- query arbitrary repos directly in production flow;
- call command executors directly;
- bypass SQL command authority;
- treat graph projections as durable authority;
- collapse observation and inference in the same untagged field.

Agent context packets must include:

- observed facts;
- inferred claims;
- evidence refs;
- standards refs where applicable;
- freshness/watermark data;
- permitted action classes;
- denied action classes.

## 9. Projection/Reactor rule

Projection handlers materialize read models. Reactor handles structural consistency by explicit policy.

Forbidden:

```text
projection handler -> Reactor target mutation
adapter observation -> direct Reactor target mutation
agent proposal -> direct Reactor target mutation
```

Allowed:

```text
durable event -> graph/read model projection
durable event -> Reactor observation expansion through registered policy
Reactor target request -> target-owned transition logic -> durable event
```

## 10. Future lint checks

Recommended static checks:

```bash
# Schema purity: no runtime/resource imports under plant-ops schemas
rg "(@effect/sql|ManagedRuntime|Layer\.scoped|Effect\.runPromise|node:|nats|mqtt|opcua|src/lib/iiot/(repos|services|infrastructure))" \
  src/lib/iiot/schemas/plant-ops

# ManagedRuntime only at edges
rg "ManagedRuntime" src/lib/iiot src/components scripts

# No broad industrial implementation namespace
find src/lib/iiot -path '*industrial*' -print
```

These should become scripted gates once the physical `plant-ops` paths exist.

## 11. Done criteria

A Plant Ops implementation slice satisfies boundary rules when:

- schemas decode independently without side effects;
- service interfaces are adapter-free;
- resource implementations are scoped Layers;
- runtime execution is at an edge;
- writes route through command authority;
- projection and Reactor responsibilities remain separate;
- tests cover invalid payloads and denied actions;
- conformance artifacts are updated.

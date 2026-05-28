# Effect v3 Grounding Ledger — Plant Ops Platform Decomposition

Status: draft, source-grounded architecture ledger

## 1. Why this ledger exists

The plant-operations platform is about to get large: standards conformance, OPC UA and Sparkplug adapters, DMN normalization, virtual plants, agent context packets, command authority, graph projections, read models, deployment profiles, and market/product slices.

If we do not anchor the decomposition in Effect's actual architecture, the codebase will drift into a handsome pile of “services” that are secretly singletons, runtime islands, and hidden I/O. That is how you get a monolith wearing a functional-programming lapel pin.

This ledger records the Effect v3 grounding used for the decomposition plan.

## 2. Researched sources

| Source | Evidence used |
| --- | --- |
| Effect official docs via Effect MCP — Writing Effect Code Guide | Prefer `Effect.gen`, write most Effect code as services, use `scoped` services, define domain entities with `Schema`, prefer `Schema.DateTimeUtc`, use `Effect.withSpan`/`Effect.fn`, provide services at the top-level as a composed Layer, and use `ManagedRuntime` for third-party/framework integration. |
| DeepWiki over `Effect-TS/effect` — ManagedRuntime / Layer / Schema question | `Schema` is pure data modeling; `Context`/`Layer` handle dependency injection; `Layer.scoped` manages resource lifecycle; `ManagedRuntime.make(layer)` is an application-edge runtime with disposal; long-lived integrations should be services within Layers. |
| DeepWiki over `Effect-TS/effect` — Schema idioms question | Use `Schema.TaggedClass` / `Schema.TaggedStruct`, branded primitives, `Schema.DateTimeUtc`, `Schema.optionalWith`; schema modules should not mix runtime services. |
| DeepWiki over `Effect-TS/effect` — service decomposition question | Use `Context.Tag` / `Effect.Service` for service interfaces, `Layer.scoped` for implementations, `Layer.merge`/`Layer.provide` for composition, mocks/fakes for tests, `Stream`/`Queue`/`PubSub` for async boundaries, and `Schema` for service boundary validation. |
| Current repo observation | TMNL is pinned to `effect@3.19.18`; Reactor v2 uses Effect v3 Schema and services. No v4-only APIs. |

## 3. Non-negotiable Effect boundaries

### 3.1 Schema modules are pure

Schema modules define data contracts only:

```text
schema module = literals + brands + TaggedClass/TaggedStruct + schema unions + helper constructors/constants
```

Schema modules must not:

- import SQL clients;
- open NATS/MQTT/OPC connections;
- create ManagedRuntime;
- call adapters;
- read environment variables;
- perform Effectful I/O;
- hide policy decisions.

Allowed imports:

- `effect/Schema` via `import { Schema } from 'effect'`;
- local schema modules;
- pure constants.

This is essential because schemas are used by EventJournal, SQL models, graph projections, agents, adapters, tests, and docs. If a schema import starts a runtime, Prime, I will personally set it on fire.

### 3.2 Service interfaces are thin Context/Service contracts

A service module should answer one question: **what role does this dependency play?**

Examples:

```text
OpcUaPort
SparkplugPort
HistorianPort
IdentityResolver
DmnNormalizer
StandardsConformanceRegistry
CommandAuthority
AgentContextAssembler
VirtualPlantRunner
```

Interface methods return `Effect.Effect<Success, Error, Requirements>` or `Stream.Stream<...>`.

They should depend on schema types, not vendor SDK classes.

### 3.3 Implementations are Layers

Concrete implementations live in adapters/layers:

```text
OpcUaNodeOpcuaLive
OpcUaSimulatorLive
SparkplugNatsMqttLive
SparkplugSimulatorLive
HistorianTimescaleLive
HistorianInMemoryLive
CommandAuthoritySqlLive
CommandAuthorityInMemoryLive
```

Resource-owning integrations use `Layer.scoped` / acquire-release patterns.

Implementation modules may import vendor SDKs, SQL clients, network libraries, and config. Interface/schema modules may not.

### 3.4 ManagedRuntime is an edge object

Use `ManagedRuntime` at application/framework edges where a non-Effect consumer needs a Promise/AsyncIterable API:

- React/Tauri boundary;
- CLI/demo runner;
- test harness that needs a long-lived runtime;
- adapter host process;
- browser/server bridge.

Do not put `ManagedRuntime` inside domain services. Internal services compose by Layer, not by nested runtimes.

Correct shape:

```text
Schema -> Service interfaces -> Layer implementations -> App Layer -> ManagedRuntime edge client
```

Incorrect shape:

```text
Service method -> ManagedRuntime.make(...) -> runPromise(...) -> hidden singleton runtime
```

### 3.5 Streams, Queue, and PubSub mark async boundaries

Use `Stream` when consumers need ordered data over time:

- OPC UA monitored item stream;
- Sparkplug topic stream;
- DMN normalized envelope stream;
- virtual plant scenario trace stream.

Use `Queue` / `PubSub` only as explicit fiber boundaries:

- adapter ingestion buffer;
- command execution queue;
- simulator scenario step queue;
- fan-out to read-model/projection workers.

The queue is not authority. Authority remains SQL/EventJournal. The queue is pressure control.

### 3.6 SQL/EventJournal remains authority

Effect primitives are process-local structure. They do not become durable truth.

| Need | Authority |
| --- | --- |
| command proposal/policy/interlock/approval/execution | SQL command authority tables |
| domain transition | EventJournal / target entity handler |
| graph topology | projection from durable structural/context events plus audit |
| source claim/checkpoint | SQL Reactor tables |
| telemetry history | historian/time-series port |
| packet/recommendation replay | refs to durable records and versioned policy/standards fingerprints |

### 3.7 One top-level provide per application slice

The official guide's “one top-level `Effect.provide`” rule maps to our architecture as:

```text
Feature test / CLI / runtime entrypoint builds one composed Layer.
Business services should not locally provide their own production dependencies.
```

Local `Effect.provide` is acceptable in tests and narrowly scoped helpers, not in domain services as hidden wiring.

## 4. Decomposition implications

### 4.1 Package by boundary, not noun excitement

Bad:

```text
industrial/
  everything.ts
```

Better:

```text
plant-ops/
  standards/
  schemas/
  ports/
  adapters/
  dmn/
  projections/
  command-authority/
  agent-context/
  simulation/
  deployment/
```

Each folder should have a clear dependency direction.

### 4.2 Adapter ports must be contract-tested against simulators

A real adapter is not “done” because it connects. It is done when it passes the same contract suite as the simulator:

```text
port contract -> simulator implementation -> real implementation -> same tests
```

This applies especially to OPC UA and Sparkplug, whose standards define stateful semantics beyond simple messages.

### 4.3 Context packets prevent agent sprawl

Agents should not query arbitrary services directly. They consume assembled context packets with evidence refs and standards refs.

Effect boundary:

```text
AgentContextAssembler service
  depends on SQL repos, EventJournal reader, graph queries, historian, standards registry
  returns Schema-backed AgentContextPacket
```

Agent providers consume packets and return structured output. Command proposals still go to `CommandAuthority`.

### 4.4 Command authority is its own domain

Do not bury command governance under adapters. OPC UA and Sparkplug adapters expose command *capability*. The command authority decides whether a command may execute.

Effect boundary:

```text
CommandAuthority service
  owns SQL state transitions
  depends on PolicyRegistry, InterlockRegistry, ApprovalRepo, ExecutionReceiptRepo
  calls CommandExecutorPort only after execution authorization
```

## 5. Naming decision

The broad architecture namespace should be **plant-ops**, not **industrial**.

Reasoning:

- “industrial” is too broad and vague;
- “plant ops” maps better to ISA-95 Level 3 operations, maintenance, alarms, production, and supervisory coordination;
- the system is not all industrial software; it is a plant-operations intelligence/control-plane substrate;
- standards research remains industrial, but implementation namespaces should be product/domain-specific.

Migration posture:

```text
Current committed docs path: src/lib/iiot/docs/industrial-platform
Future preferred docs path:  src/lib/iiot/docs/plant-ops-platform
Future preferred schemas:    src/lib/iiot/schemas/plant-ops
Future preferred services:   src/lib/iiot/services/plant-ops
```

Do not rename in a drive-by commit while deeper decomposition is still changing. First document the migration plan; then move paths in a dedicated commit.

## 6. Acceptance checks for implementation phases

Before implementation of any plant-ops slice:

1. standards source exists or the field is explicitly TMNL extension;
2. schema is pure and decodable;
3. service interface has no concrete adapter imports;
4. implementation is a Layer;
5. resourceful implementation is scoped;
6. app/framework integration uses ManagedRuntime only at the edge;
7. simulator/fake exists before live adapter;
8. SQL/EventJournal authority is explicit;
9. tests include invalid payload and denied action cases;
10. conformance matrix points to proof obligations.

## 7. Summary

Effect v3 gives us the decomposition spine:

```text
Schema purity
  -> Context/Service contracts
  -> Layer.scoped implementations
  -> Stream/Queue/PubSub async seams
  -> SQL/EventJournal durable authority
  -> ManagedRuntime at application edges only
```

That is the shape we should apply everywhere in the plant-ops platform. Small pieces, hard boundaries, boring authority, glamorous composability. Naturally.

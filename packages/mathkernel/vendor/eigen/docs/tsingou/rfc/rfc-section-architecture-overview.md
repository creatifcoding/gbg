# TSG-RFC-001 Section: Architecture Overview

```
Section:       Architecture Overview
Parent RFC:    TSG-RFC-001 (Tsingou Signal Analysis Platform)
Status:        DRAFT
Author:        Val (architecture-reviewer)
Created:       2026-02-18
Research Base: SPEC.md (215 lines), FLOW_ARCHITECTURE.md (693 lines), R3F_MIGRATION.md (1038 lines),
               ADR-001 through ADR-013, nw-wrld reference docs (7 files),
               TsingouFlow.ts (276 lines), AdapterManager.ts (411 lines)
```

> This section provides the system-level architecture overview for Tsingou, a unified
> signal-driven SIGINT/OSINT analysis platform. It establishes the design philosophy,
> component topology, service composition model, messaging fabric, intelligence
> integration strategy, deployment model, and relationship to the predecessor system
> nw_wrld. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are
> to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.1.1 Design Philosophy](#tsg11-design-philosophy)
2. [TSG.1.2 System Topology](#tsg12-system-topology)
3. [TSG.1.3 Layer Composition and Service Dependencies](#tsg13-layer-composition-and-service-dependencies)
4. [TSG.1.4 Messaging Fabric](#tsg14-messaging-fabric)
5. [TSG.1.5 Intelligence Integration](#tsg15-intelligence-integration)
6. [TSG.1.6 Deployment Model](#tsg16-deployment-model)
7. [TSG.1.7 nw_wrld Divergence Analysis](#tsg17-nw_wrld-divergence-analysis)
8. [TSG.1.8 Implementation Status](#tsg18-implementation-status)
9. [TSG.1.9 Normative Requirements](#tsg19-normative-requirements)
10. [TSG.1.10 References](#tsg110-references)

---

## TSG.1.1 Design Philosophy

### TSG.1.1.1 Identity and Mission

Tsingou is a unified, signal-driven, multi-layer SIGINT/OSINT analysis platform [ADR-008]. It ingests signals from arbitrary sources — network feeds, messaging fabrics, hardware interfaces, and local data — processes them through a differential dataflow pipeline, and delivers derived analytical state to a composited rendering surface.

The system is named after Mary Tsingou (1928-2023), a programmer at Los Alamos National Laboratory who programmed the MANIAC I computer for the Fermi-Pasta-Ulam-Tsingou problem in 1955. Her work established that nonlinear systems exhibit recurrent, quasi-periodic behavior — a foundational insight for signal analysis. The name carries the values of signals, analysis, computation, and justice.

Implementations MUST treat the signal pipeline as the primary product. The rendering surface is the output modality, not the product itself. This distinction separates Tsingou from audiovisual sequencers and creative coding tools.

### TSG.1.1.2 Foundational Runtime

Tsingou is built entirely on Effect-TS [EFFECT]. Every service, adapter, pipeline stage, and state primitive uses the Effect algebra for composition, error handling, resource management, and lifecycle control. This is a non-negotiable architectural constraint.

| Concern | Effect-TS Primitive | Rationale |
|---------|-------------------|-----------|
| Service composition | `Effect.Service<A>()` | Typed dependency injection, testable isolation |
| Error handling | `Data.TaggedError` | Typed error channels with `catchTag` precision recovery [ADR-006] |
| Resource lifecycle | `Effect.addFinalizer`, `Scope` | Deterministic cleanup, no leaked connections |
| Concurrency | `Fiber`, `Queue`, `Effect.fork` | Structured concurrency without raw Promise chains |
| State management | `Atom.make()` (effect-atom) | Reactive state bridge between services and React [ADR-005] |
| Schema validation | `Effect.Schema` | Runtime validation, encode/decode, JSON Schema generation |
| Streaming | `Effect.Stream` | Backpressure-aware data flow |
| Tracing | `Effect.withSpan` | Observability through all pipeline stages |

Implementations MUST use Effect-TS primitives for all concerns listed in the table above. Raw TypeScript `interface` types for domain models, `Promise` for asynchronous operations, `try/catch` for error handling, and `EventEmitter` for pub/sub are all prohibited within Tsingou's core packages.

### TSG.1.1.3 Schema-First Design

All domain types MUST be defined as `Effect.Schema` constructs [EFFECT-SCHEMA]. This enables:

1. **Runtime validation** — Signals from external sources are validated at ingest.
2. **Encode/decode transformations** — Bidirectional codec for STIX interop [ADR-009].
3. **JSON Schema generation** — `JSONSchema.make()` for API documentation and AI tool integration.
4. **Branded types** — `Schema.brand()` for `SignalId`, `SourceId`, `SessionId` preventing misuse at the type level.

```typescript
// Canonical pattern — branded identifier
const SignalId = Schema.String.pipe(Schema.brand('SignalId'))

// Canonical pattern — tagged struct for domain entity
const BaseSignal = Schema.Struct({
  id:        SignalId,
  sourceId:  SourceId,
  timestamp: Schema.DateFromSelf,
  version:   SignalVersion,
  kind:      SignalKind,
  payload:   Schema.Unknown,
  metadata:  Schema.optional(SignalMetadata),
})
```

### TSG.1.1.4 Relationship to nw_wrld

Tsingou is NOT a fork of nw_wrld [ADR-008]. nw_wrld (`submodules/nw_wrld/`, GPL-3.0, v0.5.0-beta) is included as a git submodule for architectural reference only. The project studies nw_wrld's patterns, learns from its decisions, and deliberately diverges where the SIGINT/OSINT mission demands different architecture.

No nw_wrld code is copied. The implementation is entirely new, built on Effect-TS. See [TSG.1.7](#tsg17-nw_wrld-divergence-analysis) for the complete divergence analysis.

---

## TSG.1.2 System Topology

### TSG.1.2.1 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TSINGOU PLATFORM                              │
│                                                                      │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐    │
│  │   SOURCE ADAPTERS    │    │        SIGNAL PIPELINE            │    │
│  │                      │    │                                   │    │
│  │  NATS ──────────┐   │    │  ┌──────────┐   ┌────────────┐  │    │
│  │  HTTP (4 modes)─┤   │    │  │  INGEST   │   │  DERIVED   │  │    │
│  │  WebSocket ─────┤   │    │  │  GRAPH    │──▶│  GRAPH     │  │    │
│  │  RSS ───────────┤   │    │  │  (d2ts)   │   │  (d2ts)    │  │    │
│  │  FileWatch ─────┼───┼───▶│  └──────────┘   └─────┬──────┘  │    │
│  │  Serial ────────┤   │    │                        │         │    │
│  │  MIDI (stub) ───┤   │    │  Queue.bounded(4096)   │         │    │
│  │  OSC (stub) ────┘   │    │                   OutputBridge   │    │
│  │                      │    │                        │         │    │
│  └─────────────────────┘    └────────────────────────┼─────────┘    │
│                                                      │              │
│  ┌───────────────────────────────────────────────────▼──────────┐   │
│  │                    RENDERING SURFACE                           │   │
│  │                                                               │   │
│  │   z:0 R3F (WebGL 3D)  ┊  z:1 visx (SVG)  ┊  z:2 p5 (Canvas) │   │
│  │   Link analysis       ┊  Timelines       ┊  Spectrum waterfall│   │
│  │   Geospatial          ┊  Heatmaps        ┊  Noise fields      │   │
│  │   Signal flow         ┊  ATT&CK matrix   ┊  Constellations    │   │
│  │                                                               │   │
│  │   z:3 DOM (React + framer-motion)                             │   │
│  │   Controls, alerts, tables, annotation                        │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   STATE MANAGEMENT    │    │      MESSAGING FABRIC             │   │
│  │                       │    │                                   │   │
│  │  Atom.make() (primary)│    │  NATS (5 roles)                  │   │
│  │  Effect.Ref (internal)│    │  Holonet service stack            │   │
│  │  useAtomValue() (sub) │    │  JetStream + KV                  │   │
│  └──────────────────────┘    └──────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │   INTELLIGENCE INTEGRATION                                     │   │
│  │                                                               │   │
│  │  STIX 2.1 codec ┊ TAXII transport ┊ Palantir KG ┊ MISP/CTI  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### TSG.1.2.2 Technology Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Runtime | Effect-TS | ^3.x | Service composition, typed errors, streams, scheduling, scoped resources |
| State | effect-atom | ^0.x | Reactive state, React subscriptions, service-to-view bridge |
| Pipeline | d2ts | ^0.x | Incremental computation, joins, windowing, aggregation |
| Transport | NATS | ^3.x | Universal signal fabric, JetStream persistence, KV schema registry |
| Shell | Tauri v2 | ^2.x | Native window, filesystem scoping, system tray, plugin ecosystem |
| 3D Rendering | React Three Fiber (R3F) | ^8.x | Declarative WebGL scene graph |
| Data Visualization | visx | ^3.x | D3-powered composable React charts |
| Generative | p5.js (@p5-wrapper/react) | ^4.x | Creative coding, spectrum visualization |
| Animation | framer-motion | ^11.x | Layout transitions, enter/exit, gestures |
| Schemas | Effect.Schema | ^0.x | Runtime validation, encode/decode, JSON Schema |
| Errors | Data.TaggedError | (Effect) | Typed error channels, catchTag recovery |

### TSG.1.2.3 Package Structure

The primary package is `@tmnl/tsingou-flow`, located at `src/lib/tsingou-flow/`. It contains 40 TypeScript files totaling approximately 5,800 lines of code.

```
src/lib/tsingou-flow/              # @tmnl/tsingou-flow
├── schemas/                        # 13 files — signal schemas
│   ├── base-signal.ts             #   BaseSignal + branded IDs + SignalVersion
│   ├── midi-signal.ts             #   MidiSignal extension (kind: 'midi')
│   ├── osc-signal.ts              #   OscSignal extension (kind: 'osc')
│   ├── nats-signal.ts             #   NatsSignal extension (kind: 'nats')
│   ├── http-signal.ts             #   HttpSignal extension (kind: 'http')
│   ├── serial-signal.ts           #   SerialSignal extension (kind: 'serial')
│   ├── rss-signal.ts              #   RssSignal extension (kind: 'rss')
│   ├── websocket-signal.ts        #   WebSocketSignal extension (kind: 'websocket')
│   ├── file-watch-signal.ts       #   FileWatchSignal extension (kind: 'file-watch')
│   ├── signal-union.ts            #   Signal union type (all 8 extensions)
│   ├── schema-registry-entry.ts   #   SchemaRegistryEntry for NATS KV
│   ├── adapter-types.ts           #   SourceAdapterShape, AdapterHealth
│   └── index.ts                   #   Schema barrel export
├── adapters/                       # 12 files — source adapters
│   ├── types.ts                   #   SourceAdapterShape interface
│   ├── errors.ts                  #   17 Data.TaggedError classes
│   ├── NatsAdapter.ts             #   NATS JetStream subscription
│   ├── HttpAdapter.ts             #   HTTP poll / SSE / webhook / long-poll
│   ├── WebSocketAdapter.ts        #   WebSocket bidirectional
│   ├── RssAdapter.ts              #   RSS/Atom feed polling
│   ├── FileWatchAdapter.ts        #   Filesystem watching (Holonet bridge)
│   ├── SerialAdapter.ts           #   Serial port (Holonet bridge)
│   ├── MidiAdapter.ts             #   Web MIDI (stub)
│   ├── OscAdapter.ts              #   OSC UDP (stub)
│   ├── xml-parser.ts              #   RSS XML parsing utilities
│   └── index.ts                   #   Adapter barrel export
├── services/                       # 4 files — core services
│   ├── TsingouFlow.ts             #   Main pipeline lifecycle (276 lines)
│   ├── AdapterManager.ts          #   Hot-plug adapter registry (411 lines)
│   ├── SchemaRegistry.ts          #   NATS KV schema registry
│   └── OutputBridge.ts            #   Queue -> Atom bridge
├── graph/                          # 5 files — d2ts graph construction
│   ├── ingest.ts                  #   Ingest D2 graph factory
│   ├── derived.ts                 #   Derived D2 graph factory
│   ├── version.ts                 #   Version/Antichain helpers
│   ├── multiset-helpers.ts        #   MultiSet<Signal> constructors
│   └── index.ts                   #   Graph barrel export
├── operators/                      # 4 files — custom d2ts operators
│   ├── window.ts                  #   Sliding time window
│   ├── throttle.ts                #   Rate limiter
│   ├── schema-validate.ts         #   Schema validation operator
│   └── index.ts                   #   Operator barrel export
└── index.ts                       # Master barrel — all public exports
```

Implementations MUST maintain this package structure. New adapters MUST be added to `adapters/`. New signal schemas MUST be added to `schemas/` with a corresponding entry in the Signal union type. New graph operators MUST be added to `operators/`.

---

## TSG.1.3 Layer Composition and Service Dependencies

### TSG.1.3.1 Effect Layer Tree

Tsingou uses Effect's Layer system for dependency injection. The complete layer composition tree, from leaf dependencies to the root service, is:

```
TsingouFlowLive (root)
  └── TsingouFlow.Default (scoped service)
       └── AdapterManager.Default (scoped service)
            └── [adapters consume SignalQueueTag via register()]
                 └── NatsPubSubService.Default
                      └── NatsHubService.Default
                           └── NatsInnerService.Default
                                └── NatsConnectionService.Default
                                     └── HolonetConfigTag.Default
```

This composition is defined in `TsingouFlow.ts:269`:

```typescript
export const TsingouFlowLive = TsingouFlow.Default
```

Where `TsingouFlow.Default` includes `AdapterManager.Default` via the `dependencies` array at line 223:

```typescript
dependencies: [AdapterManager.Default],
```

### TSG.1.3.2 Service Dependency Table

| Service | Depends On | Provides | Scoped? |
|---------|-----------|----------|---------|
| `HolonetConfigTag` | (none — configuration) | NATS connection parameters | No |
| `NatsConnectionService` | `HolonetConfigTag` | Raw NATS connection | No |
| `NatsInnerService` | `NatsConnectionService` | Internal NATS operations | No |
| `NatsHubService` | `NatsInnerService` | NATS hub abstraction | No |
| `NatsPubSubService` | `NatsHubService` | Pub/sub messaging | No |
| `NatsStreamService` | `NatsInnerService` | JetStream operations | No |
| `NatsKVService` | `NatsInnerService` | Key-Value store operations | No |
| `SchemaRegistry` | `NatsKVService` | Signal schema CRUD + watch | No |
| `AdapterManager` | `NatsPubSubService` | Adapter registration, signal queue | Yes |
| `TsingouFlow` | `AdapterManager` | Pipeline lifecycle, output bridge | Yes |

### TSG.1.3.3 Scoped Lifecycle Semantics

Services marked as "scoped" use `Effect.addFinalizer()` for deterministic cleanup when the enclosing scope closes. This is critical for:

1. **AdapterManager** — All registered adapters MUST be disconnected and their scopes closed when the AdapterManager scope closes. The service uses `Scope.make()` and `Scope.close()` for per-adapter lifecycle management [ADR-002].

2. **TsingouFlow** — The processing fiber MUST be interrupted, and the output bridge MUST be shut down when the TsingouFlow scope closes. This is implemented via `Effect.addFinalizer(() => shutdown)` at line 202 of `TsingouFlow.ts`.

Implementations MUST ensure that scoped services clean up all forked fibers, open connections, and allocated resources when their scope closes. Resource leaks are treated as correctness bugs, not performance issues.

### TSG.1.3.4 Layer Provision Pattern

Consumer code provides the full layer stack in a single `Effect.provide` call:

```typescript
const program = Effect.gen(function* () {
  const flow = yield* TsingouFlow
  yield* flow.start

  // Hot-plug an adapter
  const adapter = yield* flow.adapterManager.registerSimple(
    HttpSourceAdapter.scoped,
    Layer.succeed(HttpAdapterConfigTag, myConfig),
  )

  // Subscribe to output via atoms
  const signals = Atom.unsafeGet(activeSignalsAtom)
})

// Run with full layer stack:
Effect.runFork(program.pipe(Effect.provide(TsingouFlowLive)))
```

This pattern ensures that all dependencies are resolved at the composition root. Individual services MUST NOT construct their own dependencies.

---

## TSG.1.4 Messaging Fabric

### TSG.1.4.1 NATS Five-Role Architecture

NATS serves as the universal messaging fabric for Tsingou, fulfilling five distinct roles [ADR-003]:

| Role | Description | Subject Pattern | Example |
|------|-------------|----------------|---------|
| **Direct Source** | Tsingou subscribes to NATS subjects as a signal source | `tsingou.signal.>` | External sensor publishes to `tsingou.signal.temperature.sensor-1` |
| **Message Bus** | Internal communication between Tsingou components | `tsingou.internal.>` | Adapter lifecycle events, schema change notifications |
| **Bridge** | Sidecar processes publish hardware/network data to NATS | `tsingou.signal.{kind}.{sourceId}` | Serial sidecar publishes to `tsingou.signal.serial.COM3` |
| **Fan-out** | Multiple consumers subscribe to the same signal subjects | `tsingou.signal.>` | Multiple rendering layers consume same signal feed |
| **JetStream Replay** | Historical signal playback for retrospective analysis | `TSINGOU_SIGNALS` stream | Replay last 24h of signals through the same d2ts graph |

### TSG.1.4.2 Holonet Service Stack

"Holonet" is Tsingou's Effect.Service abstraction layer over NATS. The name distinction is intentional: "NATS" refers to the underlying technology, "Holonet" refers to Tsingou's typed service wrappers.

The Holonet stack provides:

| Service | NATS Primitive | Tsingou Capability |
|---------|---------------|-------------------|
| `HolonetConfigTag` | Connection config | URL, credentials, TLS, reconnect policy |
| `NatsConnectionService` | `NatsConnection` | Managed connection with automatic reconnect |
| `NatsInnerService` | Internal ops | Connection state monitoring |
| `NatsHubService` | Hub abstraction | Multi-consumer message routing |
| `NatsPubSubService` | Core NATS pub/sub | Typed publish/subscribe with Effect integration |
| `NatsStreamService` | JetStream | Persistent message streams with delivery guarantees |
| `NatsKVService` | KV Store | Configuration and schema persistence |

### TSG.1.4.3 Subject Naming Convention

All NATS subjects in Tsingou follow a hierarchical naming convention:

```
tsingou.signal.{kind}.{sourceId}          — Raw signal subjects
tsingou.derived.{computationId}           — Derived state subjects
tsingou.schema.{kind}                     — Schema registry notifications
tsingou.adapter.{adapterId}.health        — Adapter health telemetry
tsingou.adapter.{adapterId}.control       — Adapter control commands
tsingou.internal.{component}.{event}      — Internal system events
```

Implementations MUST follow this naming convention for all NATS subjects. Subject names MUST use lowercase alphanumeric characters and hyphens for identifiers. Colons MUST NOT be used in subject names because NATS subjects become dot-separated hierarchies [MEMORY-NATS-KV].

### TSG.1.4.4 Persistence: KV Buckets and JetStream Streams

**KV Buckets** (configuration and registry state):

| Bucket | Key Pattern | Value | Purpose |
|--------|------------|-------|---------|
| `tsingou-schemas` | Signal kind string | JSON Schema AST + version metadata | Schema registry [TSG.2.3] |
| `tsingou-adapters` | Adapter ID | Adapter configuration JSON | Adapter config persistence |
| `tsingou-sessions` | Session ID | Graph configuration + analysis state | Session state persistence |

**JetStream Streams** (historical data):

| Stream | Subjects | Retention | Purpose |
|--------|---------|-----------|---------|
| `TSINGOU_SIGNALS` | `tsingou.signal.>` | Limits (time + size) | Signal replay for retrospective analysis |
| `TSINGOU_DERIVED` | `tsingou.derived.>` | Limits | Derived state history |
| `TSINGOU_AUDIT` | `tsingou.adapter.*.health`, `tsingou.internal.>` | Workqueue | Adapter lifecycle audit trail |

---

## TSG.1.5 Intelligence Integration

### TSG.1.5.1 STIX Interoperability Layer

Tsingou uses a custom internal signal model (`BaseSignal`) and provides STIX 2.1 interoperability as a bidirectional codec layer [ADR-009]. This is a revised position from the initial "STIX-native" decision.

**Note on consistency:** ADR-012 currently states "STIX-native Signals" and "Every signal is a STIX observed-data object." This contradicts ADR-009's revised decision. ADR-012 SHOULD be updated to say "STIX-interoperable signals." See [ADR INDEX — Consistency Note 6.1][INDEX-6.1].

| Concern | Internal Model | STIX Interop |
|---------|---------------|-------------|
| Signal identity | `SignalId` (branded nanoid) | STIX `id` (UUID v4 with SCO prefix) |
| Versioning | `[tick, source_seq]` tuple | `created` / `modified` timestamps |
| Schema validation | `Effect.Schema` with branded types | STIX JSON Schema |
| Payload format | Minimal, domain-specific | STIX SCO properties (verbose) |
| Throughput | Optimized for 10k+ signals/sec | Designed for sharing, not processing |

The codec layer provides:

```
BaseSignal ──encode──▶ STIX observed-data SDO
STIX observed-data SDO ──decode──▶ BaseSignal
```

### TSG.1.5.2 Intelligence Cycle Coverage

Tsingou covers all 6 phases of the intelligence cycle [ADR-010]:

| Phase | Tsingou Subsystem | Implementation Status |
|-------|-------------------|----------------------|
| **1. Direction** | Session configuration — collection requirements, priority sources, ATT&CK focus | Design-only |
| **2. Collection** | 8 source adapters + SDR bridge + STIX/TAXII ingestion | Built |
| **3. Processing** | d2ts ingest graph — validation, normalization, enrichment, dedup | Stubbed |
| **4. Analysis** | d2ts derived graph — correlation, windowing, anomaly, ATT&CK mapping | Stubbed |
| **5. Dissemination** | STIX/TAXII export, NATS fan-out, alerts, CTI connectors | Design-only |
| **6. Feedback** | Accuracy tracking, collection priority adjustment, graph tuning | Design-only |

### TSG.1.5.3 Platform Integration Points

Tsingou is positioned as the visualization and real-time analysis layer [ADR-012]. Knowledge graph persistence and entity management are delegated to specialized platforms:

| Platform | Integration Role | Transport |
|----------|-----------------|-----------|
| **Palantir Gotham** | Entity/knowledge graph persistence, ontology management | REST API + Streaming |
| **MISP** | Threat intelligence sharing, IOC correlation | MISP API + STIX |
| **OpenCTI** | CTI knowledge management, STIX native storage | GraphQL + STIX/TAXII |
| **TheHive** | Incident response, case management | REST API |
| **Cortex** | Automated enrichment, observable analysis | REST API |

### TSG.1.5.4 TAXII Transport Bridge

STIX data exchange with external platforms uses the TAXII protocol. Tsingou maps NATS subjects to TAXII collections:

```
NATS subject: tsingou.signal.{kind}.{sourceId}
    ↕ (STIX codec)
TAXII collection: tsingou-signals-{kind}
```

The bridge operates bidirectionally:
- **Ingest**: TAXII poll/subscribe -> STIX decode -> BaseSignal -> pipeline
- **Export**: BaseSignal -> STIX encode -> TAXII publish

### TSG.1.5.5 STIX Object Coverage

The following STIX 2.1 object types are relevant to Tsingou's signal processing and interop:

| STIX Category | Object Types | Tsingou Usage |
|--------------|-------------|---------------|
| **SDOs (domain)** | `observed-data`, `indicator`, `attack-pattern`, `malware`, `threat-actor`, `identity`, `location` | Signal encoding, threat correlation, ATT&CK mapping |
| **SROs (relationship)** | `relationship`, `sighting` | Link analysis, correlation graph edges |
| **SCOs (cyber observable)** | `ipv4-addr`, `domain-name`, `url`, `file`, `network-traffic`, `artifact` | HTTP/RSS/NATS signal payload encoding |
| **Custom SCOs** | `x-tsingou-sdr-capture`, `x-tsingou-serial-frame` | SDR IQ data and serial telemetry (non-standard) |

For signal types that have no STIX SCO equivalent (MIDI, OSC, serial telemetry, SDR IQ samples), Tsingou defines custom STIX extensions using the `x-tsingou-` prefix. These extensions follow the STIX 2.1 custom object specification [STIX-CUSTOM] and MUST include:
- A `type` property with the `x-tsingou-` prefix
- All required STIX common properties (`id`, `type`, `spec_version`, `created`, `modified`)
- The source-specific payload in an `extensions` property

### TSG.1.5.6 Intelligence Cycle Phase Detail

Each intelligence cycle phase maps to specific Tsingou components with defined interfaces:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INTELLIGENCE CYCLE                               │
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                       │
│  │1.DIRECTION│───▶│2.COLLECT │───▶│3.PROCESS │                       │
│  │           │    │          │    │          │                       │
│  │ Session   │    │ 8 Source │    │ d2ts     │                       │
│  │ Config UI │    │ Adapters │    │ Ingest   │                       │
│  │ (Design)  │    │ (Built)  │    │ Graph    │                       │
│  └─────▲─────┘    └──────────┘    └─────┬────┘                       │
│        │                                │                            │
│  ┌─────┴─────┐    ┌──────────┐    ┌─────▼────┐                       │
│  │6.FEEDBACK │◀───│5.DISSEMIN│◀───│4.ANALYSIS│                       │
│  │           │    │          │    │          │                       │
│  │ Accuracy  │    │ STIX/    │    │ d2ts     │                       │
│  │ Tracking  │    │ TAXII    │    │ Derived  │                       │
│  │ (Design)  │    │ (Design) │    │ Graph    │                       │
│  └───────────┘    └──────────┘    └──────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

The four-wave implementation strategy prioritizes Collection and Processing (Waves 1-2) because they are prerequisites for Analysis, which in turn is a prerequisite for Dissemination and Feedback.

### TSG.1.5.7 SDR Integration Architecture

The SDR integration [ADR-011] provides SIGINT-specific capabilities through a dual-path architecture:

```
┌─────────────────────────────────┐
│  GNU Radio Flow Graph           │
│                                 │
│  RTL-SDR ──▶ Demod ──▶ Decode  │
│                       ──▶ FFT  │
│                                 │
│  Output: decoded data + FFT    │
└────────────┬────────────────────┘
             │ ZMQ PUB socket
             ▼
┌────────────────────────────────┐
│  GNU Radio Bridge Sidecar      │
│                                │
│  ZMQ SUB → BaseSignal → NATS  │
│  (kind: 'sdr', SigMF metadata)│
└────────────┬───────────────────┘
             │ NATS publish
             ▼
┌────────────────────────────────┐
│  Tsingou (NatsAdapter)         │
│                                │
│  Subscribe tsingou.signal.sdr.>│
│  → Pipeline → p5 waterfall    │
└────────────────────────────────┘

┌─────────────────────────────────┐
│  RTL-SDR Sidecar (lightweight)  │
│                                 │
│  librtlsdr → raw IQ → FFT     │
│  → NATS publish                │
│  (lighter weight than GNU Radio)│
└────────────┬────────────────────┘
             │ NATS publish
             ▼
             (same Tsingou NatsAdapter)
```

Supported SDR devices and their integration paths:

| Device | Price | Integration | Bandwidth | Use Case |
|--------|-------|-------------|-----------|----------|
| RTL-SDR v4 | ~$30 | RTL-SDR sidecar | 2.4 MHz | ADS-B, FM, pager |
| HackRF One | ~$350 | GNU Radio bridge | 20 MHz | Wideband survey |
| LimeSDR | ~$300 | GNU Radio bridge | 61.44 MHz | MIMO, cellular |
| USRP | $1k+ | GNU Radio bridge | 40+ MHz | Professional SIGINT |

---

## TSG.1.6 Deployment Model

### TSG.1.6.1 Tauri v2 Architecture

Tsingou uses Tauri v2 as its application shell, replacing nw_wrld's Electron 3-process model with a leaner single-process architecture:

| Aspect | nw_wrld (Electron) | Tsingou (Tauri v2) |
|--------|-------------------|-------------------|
| Process model | 3 processes (main, renderer, sandbox) | 1 process + sidecar daemons |
| Backend | Node.js (main process) | Rust (Tauri core) |
| Frontend | Chromium renderer | System WebView |
| IPC | `ipcMain`/`ipcRenderer` | Tauri commands + NATS |
| Sandbox | Custom iframe sandbox | NATS subject isolation |
| Binary size | ~150MB (Chromium bundled) | ~10MB (system WebView) |
| Memory baseline | ~200MB (3 Chromium processes) | ~30MB (single process) |

### TSG.1.6.2 Sidecar Architecture

Sources that cannot run in the Tauri WebView (Node.js serial port, UDP sockets, GNU Radio) deploy as sidecar processes that communicate via NATS:

```
┌─────────────────┐     NATS      ┌────────────────────┐
│  Serial Sidecar  │─────publish───▶│                    │
│  (Node/Bun)      │               │  Tsingou WebView   │
└─────────────────┘               │                    │
                                   │  NatsAdapter       │
┌─────────────────┐     NATS      │  subscribes to     │
│  GNU Radio       │─────publish───▶│  tsingou.signal.>  │
│  Bridge          │               │                    │
└─────────────────┘               └────────────────────┘

┌─────────────────┐     NATS
│  RTL-SDR         │─────publish───▶ (same pattern)
│  Sidecar         │
└─────────────────┘
```

This architecture MUST be used for any source adapter that requires:
- Native hardware access (serial, USB, GPIO)
- UDP socket listeners (OSC, GNU Radio ZMQ)
- CPU-intensive DSP processing (FFT, demodulation)
- Libraries unavailable in the WebView runtime

### TSG.1.6.3 NATS Leaf Nodes for Edge Deployment

For edge and remote sensor deployments, NATS leaf nodes provide geographic distribution:

```
┌───────────────────┐          ┌──────────────────┐
│  Edge Sensor (Pi)  │──leaf───▶│  NATS Cluster     │
│  + RTL-SDR         │   node  │  (cloud/on-prem)  │
│  + GPS             │          │                   │
└───────────────────┘          │  Tsingou connects  │
                                │  as subscriber     │
┌───────────────────┐          │                   │
│  Remote Station    │──leaf───▶│                   │
│  + HackRF          │   node  └──────────────────┘
│  + Antenna array   │
└───────────────────┘
```

### TSG.1.6.4 Workspace Structure

Tsingou workspaces provide project-level isolation for analysis sessions:

```
~/.tsingou/                    # Global Tsingou configuration
├── config.toml                # Global preferences
├── schemas/                   # User-defined signal schemas
└── sessions/                  # Session history index

<project>/                     # Project workspace
├── tsingou.toml              # Project configuration
├── adapters/                 # Adapter configurations
├── graphs/                   # d2ts graph definitions
├── recordings/               # Signal recordings (SigMF format for SDR)
└── exports/                  # STIX/TAXII export packages
```

---

## TSG.1.7 nw_wrld Divergence Analysis

### TSG.1.7.1 Architectural Divergence Table

Tsingou studies nw_wrld's patterns and deliberately diverges in every major architectural dimension:

| Dimension | nw_wrld | Tsingou | Rationale |
|-----------|---------|---------|-----------|
| **Runtime** | Electron (Node.js + Chromium) | Tauri v2 (Rust + WebView) | 10x smaller binary, 6x lower memory, no Chromium bundling |
| **Language paradigm** | OOP (classes, `this`, prototype) | FP (Effect-TS, algebraic composition) | Typed effects, testable services, composable errors |
| **Process model** | 3 processes (main/renderer/sandbox) | 1 process + sidecar daemons | Simpler IPC, NATS replaces `ipcRenderer` |
| **Signal pipeline** | 7-stage imperative (`broadcast` -> `forEach` -> `execute`) | d2ts differential dataflow (declarative graph) | Joins, aggregation, incremental computation, windowing |
| **State management** | Jotai atoms + mutable closures + `UserData` god-object | effect-atom `Atom.make()` + `Effect.Ref` (internal only) | Reactive, scoped, no god-objects, no split-brain state |
| **IPC / messaging** | `ipcMain` / `ipcRenderer` (Electron-only) | NATS (transport-agnostic, persistent, distributed) | Works across processes, machines, datacenters |
| **Error handling** | `try/catch` + `console.error` (silently swallowed) | `Data.TaggedError` + `catchTag` (typed, recoverable) | Every error is typed, every recovery is explicit |
| **Rendering** | Single Canvas (Three.js imperative) | 4-layer composited (R3F + visx + p5 + DOM) | Multiple rendering technologies for different data types |
| **Module system** | Sandboxed iframe modules (21 starter modules) | Effect.Service with Layer composition | Type-safe dependency injection, no iframe overhead |
| **Persistence** | `fs.writeFile` + `.backup` (split-brain) | NATS KV + JetStream (transactional, distributed) | No file corruption, no backup dance, distributed state |
| **Schema validation** | None (raw JSON, `typeof` checks) | Effect.Schema (branded types, runtime validation) | Invalid signals caught at ingest, not at render time |
| **Animation** | Custom `animatable()` + GSAP + anime.js | framer-motion (declarative, React-native) | Simpler API, better React integration, smaller bundle |
| **Hot reload** | Module-level `require()` with sandbox | Effect.Service hot-swap via AdapterManager | Type-safe, no eval, no sandbox security risks |
| **Dashboard** | 300-line monolith root + 60 hooks + 15 modals | Composited DOM layer (z:3) with framer-motion | Decomposed, animated, accessible |

### TSG.1.7.2 What nw_wrld Does Well

The divergence analysis acknowledges nw_wrld's strengths that Tsingou preserves in evolved form:

1. **Signal normalization** — nw_wrld's insight that raw input must be normalized before processing is preserved in Tsingou's ingest graph. The 7-stage signal flow (`Origin -> Normalize -> IPC -> Listener -> Dispatch -> Execute -> Sandbox`) demonstrated that normalization at ingest prevents downstream errors.

2. **Module isolation** — nw_wrld's sandbox architecture (iframe per module, `postMessage` IPC) demonstrates the need for module boundaries. Tsingou replaces iframe sandboxes with Effect.Service scoping, achieving the same isolation with lower overhead and type safety.

3. **Workspace concept** — nw_wrld's project directory structure (`workspace/projects/<name>/`) provides a sound model for workspace isolation. Tsingou adapts it for Tauri's filesystem scoping and NATS session persistence.

4. **Real-time rendering** — nw_wrld proves that live signal-to-visual pipelines are viable at 60fps. Tsingou extends this to 4 rendering layers with domain-specific technologies, each optimized for its data type.

5. **Channel dispatch pattern** — nw_wrld's `channelDispatch` mechanism (routing signals to rendering modules by channel and method) inspired Tsingou's d2ts graph-based routing, which provides the same flexibility with incremental computation semantics.

### TSG.1.7.3 Critical nw_wrld Architecture Issues

The nw_wrld architecture analysis (`ARCHITECTURE_ANALYSIS.md`, 700 lines) identifies 14 key observations. The following issues directly informed Tsingou's design decisions:

| nw_wrld Issue | Observation | Tsingou Resolution |
|--------------|-------------|-------------------|
| `Projector` god-object | ~2000 LOC monolith handling graphics, state, sequencing, rendering | Decomposed into TsingouFlow, AdapterManager, OutputBridge, SchemaRegistry |
| Split-brain state | 3 state sources (Jotai, closures, UserData) requiring manual sync | Single source per concern (atoms), persistence as downstream projection |
| Error swallowing | `try/catch` + `console.error` hides failures | `Data.TaggedError` + typed error channels make every error visible |
| Global mutable state | `Projector` state accessible from anywhere | Scoped `Effect.Service` instances with explicit dependency injection |
| Manual resource cleanup | `clearState()` functions called at various lifecycle points | `Effect.addFinalizer()` guarantees cleanup regardless of exit path |
| Synchronous file I/O | `fs.writeFileSync` blocks the main thread during saves | NATS KV operations are async and non-blocking |
| No schema validation | Raw JSON parsed with `typeof` checks | `Effect.Schema` validates at ingest with branded types |
| Tight coupling | Rendering modules directly reference InputManager and Projector | Zero-coupling via atom subscription [TSG.2.8.4] |

### TSG.1.7.4 nw_wrld Metrics

For reference, nw_wrld v0.5.0-beta contains:

| Metric | Value |
|--------|-------|
| Source files | 177 TypeScript files |
| Lines of code | ~32,700 LOC |
| Starter modules | 21 (20-21, count varies across docs — see [INDEX-6.6]) |
| Processes | 3 (Electron main, renderer, sandbox) |
| IPC bridge modules | 10 |
| React hooks | 60+ |
| Modals | 15 |
| `Projector` LOC | ~2,000 |
| `UserData` fields | ~2,000 |

---

## TSG.1.8 Implementation Status

### TSG.1.8.1 Status by Component

| Component | Status | Evidence | Lines |
|-----------|--------|---------|-------|
| BaseSignal schema + 8 extensions | Built | `schemas/base-signal.ts` + 8 extension files | ~600 |
| Signal union type | Built | `schemas/signal-union.ts` | ~30 |
| Adapter error hierarchy | Built | `adapters/errors.ts` — 17 `Data.TaggedError` classes | 188 |
| AdapterManager service | Built | `services/AdapterManager.ts` — hot-plug lifecycle, scoped cleanup | 411 |
| TsingouFlow service | Built (d2ts stubbed) | `services/TsingouFlow.ts` — processing loop, output bridge | 276 |
| OutputBridge | Built | `services/OutputBridge.ts` — Queue -> Atom bridge | ~150 |
| SchemaRegistry | Built | `services/SchemaRegistry.ts` — NATS KV wrapper | ~100 |
| 8 source adapters | Built | `adapters/*.ts` — NATS, HTTP, WS, RSS, File, Serial, MIDI(stub), OSC(stub) | ~1,500 |
| d2ts graph processing | Stubbed | `TsingouFlow.ts:122-135` — pass-through until `@electric-sql/d2ts` installed | -- |
| Custom operators | Built | `operators/window.ts`, `throttle.ts`, `schema-validate.ts` | ~300 |
| Graph construction | Built | `graph/ingest.ts`, `derived.ts`, `version.ts`, `multiset-helpers.ts` | ~200 |
| STIX codec | Design-only | ADR-009 documents architecture, no implementation | -- |
| Direction phase UI | Design-only | ADR-010 documents design, no implementation | -- |
| Dissemination / TAXII | Design-only | ADR-009, ADR-010 document architecture | -- |
| Feedback loop | Design-only | ADR-010 documents design | -- |
| SDR sidecar | Design-only | ADR-011 documents architecture | -- |
| R3F rendering layer | Design-only | R3F_MIGRATION.md documents migration plan | -- |
| visx rendering layer | Design-only | ADR-013 documents technique mapping | -- |
| p5 rendering layer | Design-only | ADR-013 documents technique mapping | -- |

### TSG.1.8.2 Codebase Metrics

| Metric | Value | Source |
|--------|-------|--------|
| Total TypeScript files | 40 | `src/lib/tsingou-flow/` Glob |
| Total lines of code | ~5,800 | SPEC.md §7 |
| Schema files | 13 | `schemas/` directory |
| Adapter files | 12 | `adapters/` directory |
| Service files | 4 | `services/` directory |
| Graph files | 5 | `graph/` directory |
| Operator files | 4 | `operators/` directory |
| Tagged error classes | 18 | 17 in `errors.ts` + 1 in `AdapterManager.ts` |
| Atom definitions | 12 (built) | Across TsingouFlow, AdapterManager, OutputBridge |
| Signal extensions | 8 | One per adapter type |
| d2ts integration | Stubbed | Pass-through until `@electric-sql/d2ts` stabilizes |

### TSG.1.8.3 Implementation Wave Progression

| Wave | Focus | Status | Dependencies |
|------|-------|--------|-------------|
| **Wave 1** | Collection + Processing (adapters, schema, pipeline service) | Built (d2ts stub) | None |
| **Wave 2** | Analysis + Rendering (d2ts wiring, OutputBridge -> rendering layers) | Pending | `@electric-sql/d2ts` stabilization |
| **Wave 3** | Dissemination (STIX codec, TAXII bridge, CTI connectors) | Design-only | Wave 2 (d2ts for derived state) |
| **Wave 4** | Direction + Feedback (session UI, collection tuning, accuracy tracking) | Design-only | Wave 3 (dissemination for feedback loop) |

### TSG.1.8.4 External Dependency Readiness

| Dependency | Version | Status | Blocking |
|-----------|---------|--------|----------|
| `effect` | ^3.x | Stable, production-ready | No |
| `@effect/platform` | ^0.x | Stable API, pre-1.0 | No |
| `@effect-atom/atom` | ^0.x | Stable, used in production | No |
| `@electric-sql/d2ts` | ^0.x | Pre-alpha, API stabilizing | **Yes** — blocks Wave 2 |
| `@nats-io/nats.js` | ^3.x | Stable, production-ready | No |
| `@nats-io/jetstream` | ^3.x | Stable | No |
| `@nats-io/kv` | ^3.x | Stable | No |
| `@react-three/fiber` | ^8.x | Stable, production-ready | No |
| `visx` | ^3.x | Stable, production-ready | No |
| `@p5-wrapper/react` | ^4.x | Stable | No |
| `framer-motion` | ^11.x | Stable, production-ready | No |

The critical path dependency is `@electric-sql/d2ts`. Until it stabilizes, the d2ts graph processing remains stubbed with a pass-through implementation. All other dependencies are production-ready.

---

## TSG.1.9 Normative Requirements

This section consolidates all normative requirements from TSG.1:

### MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.1-R1 | Implementations MUST treat the signal pipeline as the primary product | TSG.1.1.1 |
| TSG.1-R2 | Implementations MUST use Effect-TS primitives for service composition, error handling, resource lifecycle, concurrency, state management, schema validation, streaming, and tracing | TSG.1.1.2 |
| TSG.1-R3 | All domain types MUST be defined as Effect.Schema constructs | TSG.1.1.3 |
| TSG.1-R4 | Implementations MUST maintain the package structure defined in TSG.1.2.3 | TSG.1.2.3 |
| TSG.1-R5 | Scoped services MUST clean up all forked fibers, open connections, and allocated resources when their scope closes | TSG.1.3.3 |
| TSG.1-R6 | Individual services MUST NOT construct their own dependencies | TSG.1.3.4 |
| TSG.1-R7 | Implementations MUST follow the NATS subject naming convention defined in TSG.1.4.3 | TSG.1.4.3 |
| TSG.1-R8 | Colons MUST NOT be used in NATS subject names | TSG.1.4.3 |
| TSG.1-R9 | The sidecar architecture MUST be used for adapters requiring native hardware access, UDP sockets, CPU-intensive DSP, or libraries unavailable in the WebView | TSG.1.6.2 |

### SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.1-S1 | ADR-012 SHOULD be updated to say "STIX-interoperable signals" instead of "STIX-native Signals" | TSG.1.5.1 |

### MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.1-M1 | Implementations MAY use `Effect.Ref` for internal-only service state that React never consumes | TSG.1.1.2 |
| TSG.1-M2 | Implementations MAY extend the subject naming convention with additional hierarchical levels | TSG.1.4.3 |

---

## TSG.1.10 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [EFFECT] | Effect-TS. "Effect: A TypeScript library for building production-grade applications." https://effect.website |
| [EFFECT-SCHEMA] | Effect-TS. "@effect/schema — Schema validation and transformation." Part of the Effect ecosystem. |
| [ADR-001] | ADR-001: d2ts as Signal Pipeline Core. `docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md` |
| [ADR-002] | ADR-002: Source Adapter Contract. `docs/tsingou/adr/ADR-002-source-adapter-contract.md` |
| [ADR-003] | ADR-003: NATS as Universal Signal Fabric. `docs/tsingou/adr/ADR-003-nats-as-universal-fabric.md` |
| [ADR-004] | ADR-004: @effect/platform for HTTP, WebSocket, FileSystem. `docs/tsingou/adr/ADR-004-effect-platform-adapters.md` |
| [ADR-005] | ADR-005: Atom-as-State Pattern. `docs/tsingou/adr/ADR-005-atom-as-state.md` |
| [ADR-006] | ADR-006: Tagged Errors Everywhere. `docs/tsingou/adr/ADR-006-tagged-errors-everywhere.md` |
| [ADR-007] | ADR-007: Framer Motion for Animation. `docs/tsingou/adr/ADR-007-framer-motion-for-animation.md` |
| [ADR-008] | ADR-008: System Named "Tsingou". `docs/tsingou/adr/ADR-008-tsingou-naming-and-identity.md` |
| [ADR-009] | ADR-009: STIX Interoperability Layer. `docs/tsingou/adr/ADR-009-stix-interop-layer.md` |
| [ADR-010] | ADR-010: Full Intelligence Cycle Coverage. `docs/tsingou/adr/ADR-010-full-intelligence-cycle.md` |
| [ADR-011] | ADR-011: SDR Integration via GNU Radio Bridge. `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md` |
| [ADR-012] | ADR-012: Tsingou as Visualization Platform. `docs/tsingou/adr/ADR-012-visualization-focused-platform.md` |
| [ADR-013] | ADR-013: Eight Analysis Techniques. `docs/tsingou/adr/ADR-013-analysis-techniques.md` |
| [INDEX-6.1] | ADR Index — Consistency Note 6.1. `docs/tsingou/adr/INDEX.md` |
| [MEMORY-NATS-KV] | Val's persistent memory: "NATS KV keys become NATS subjects — colons INVALID" |
| [NATS] | NATS.io. "NATS — Cloud Native Messaging System." https://nats.io |
| [TAURI] | Tauri. "Tauri — Build an optimized, secure, and frontend-independent application." https://tauri.app |
| [D2TS] | Electric SQL. "@electric-sql/d2ts — Differential dataflow in TypeScript." |
| [STIX] | OASIS. "STIX Version 2.1." OASIS Standard, June 2021 |
| [TAXII] | OASIS. "TAXII Version 2.1." OASIS Standard, June 2021 |

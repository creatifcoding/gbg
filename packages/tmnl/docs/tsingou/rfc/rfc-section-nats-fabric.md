# TSG.11 NATS Messaging Fabric

```
Section:       TSG.11 — NATS Messaging Fabric
Parent RFC:    TMNL-RFC-002 (Tsingou SIGINT Visualization Platform)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-18
Part:          II — Architecture (Normative)
Prerequisites: TSG.6 (Architecture Overview), TSG.7 (Signal Pipeline),
               TSG.8 (BaseSignal Schema), TSG.9 (Source Adapters)
Feeds:         TSG.14 (TAXII Transport), TSG.34 (Deployment Topology),
               TSG.32 (Effect-TS Architecture)
```

> This section specifies the NATS messaging fabric that serves as the universal
> communication backbone for the Tsingou SIGINT visualization platform. NATS
> provides core publish/subscribe messaging, JetStream persistence for signal
> replay, KV Store for schema registry and adapter configuration, Object Store
> for large payloads, and leaf node topology for distributed deployments. The
> key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in
> this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Introduction](#tsg111-introduction)
2.  [NATS Core Concepts](#tsg112-nats-core-concepts)
3.  [Subject Topology](#tsg113-subject-topology)
4.  [JetStream Persistence](#tsg114-jetstream-persistence)
5.  [KV Store](#tsg115-kv-store)
6.  [Object Store](#tsg116-object-store)
7.  [Backpressure Strategy](#tsg117-backpressure-strategy)
8.  [NATS-TAXII Bridge](#tsg118-nats-taxii-bridge)
9.  [Leaf Node Topology](#tsg119-leaf-node-topology)
10. [Connection Management](#tsg1110-connection-management)
11. [Multi-Tenant Isolation](#tsg1111-multi-tenant-isolation)
12. [Monitoring and Observability](#tsg1112-monitoring-and-observability)
13. [Security](#tsg1113-security)
14. [Performance Considerations](#tsg1114-performance-considerations)
15. [Normative Requirements Summary](#tsg1115-normative-requirements-summary)
16. [References](#tsg1116-references)

---

## TSG.11.1 Introduction

### TSG.11.1.1 Purpose

NATS is the universal messaging backbone for the Tsingou platform. It serves as
the sole inter-process communication mechanism between the core application
(Tauri WebView hosting the Effect-TS runtime and d2ts pipeline), sidecar
processes (SDR hardware bridges, GNU Radio flowgraphs, serial device readers,
file watchers), and external systems (TAXII servers, partner NATS clusters,
distributed collection nodes).

Every signal that enters, traverses, or exits the Tsingou boundary passes
through NATS. The messaging fabric is not merely a transport convenience -- it
is the architectural spine upon which signal persistence, schema distribution,
backpressure propagation, multi-tenant isolation, and distributed deployment
all depend.

### TSG.11.1.2 Scope

This section covers:

1. **Core messaging primitives** -- publish/subscribe, request/reply, queue
   groups, wildcard subjects (TSG.11.2)
2. **Subject namespace design** -- the hierarchical subject tree that organizes
   all Tsingou communication (TSG.11.3)
3. **JetStream persistence** -- streams, consumers, retention policies, and
   exactly-once delivery (TSG.11.4)
4. **KV Store** -- schema registry, adapter configuration, session state
   (TSG.11.5)
5. **Object Store** -- large payload storage for IQ samples and STIX bundles
   (TSG.11.6)
6. **Backpressure** -- four-point flow control from adapter to rendering
   (TSG.11.7)
7. **TAXII bridge** -- mapping TAXII collections to NATS subjects (TSG.11.8)
8. **Leaf node topology** -- hub-and-spoke for distributed deployments
   (TSG.11.9)
9. **Connection management** -- Effect Layer lifecycle, reconnection, health
   (TSG.11.10)
10. **Multi-tenant isolation** -- NATS accounts and subject permissions
    (TSG.11.11)
11. **Monitoring** -- $SYS subjects, advisory streams, health atoms
    (TSG.11.12)
12. **Security** -- TLS, NKey, JWT authorization (TSG.11.13)
13. **Performance** -- throughput benchmarks, latency targets, buffer sizing
    (TSG.11.14)

### TSG.11.1.3 Architectural Position

NATS occupies the center of the Tsingou process model. Every process in the
deployment topology [TSG.34] communicates exclusively through NATS, with the
sole exception of the Tauri IPC bridge between the Rust backend and the WebView.

```
                    ┌─────────────────────────────────┐
                    │         NATS Server              │
                    │    (nats-server, embedded)        │
                    │                                   │
                    │  Core NATS    JetStream   KV/OBJ  │
                    │  pub/sub      streams     stores   │
                    └──────────┬────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
    ┌─────▼──────┐      ┌─────▼──────┐      ┌─────▼──────┐
    │  WebView    │      │  SDR       │      │  GNU Radio │
    │  (nats.ws)  │      │  Sidecar   │      │  Sidecar   │
    │             │      │  (nats-c)  │      │  (nats-py) │
    │  Effect-TS  │      │            │      │            │
    │  d2ts       │      │  Hardware  │      │  DSP       │
    │  Adapters   │      │  I/O       │      │  Flowgraph │
    └────────────┘      └────────────┘      └────────────┘
          │
    ┌─────▼──────┐
    │  Serial    │
    │  Bridge    │
    │  (nats-rs) │
    └────────────┘
```

### TSG.11.1.4 Design Lineage

The choice of NATS as the universal fabric is documented in ADR-003 [ADR-003].
The decision evaluated four messaging systems:

| System | Verdict | Rationale |
|--------|---------|-----------|
| NATS | **Selected** | Single binary, JetStream persistence, KV/Object Store, leaf nodes, WebSocket transport, <10ms latency, zero-config embedded deployment |
| MQTT | Rejected | No built-in persistence, no KV store, no object store, no leaf node topology |
| Redis Pub/Sub | Rejected | No persistence guarantees, no subject wildcards, no leaf nodes |
| Apache Kafka | Rejected | JVM dependency, heavy operational overhead, excessive for desktop deployment |

NATS is deployed as an embedded sidecar managed by the Tauri shell plugin. No
external infrastructure is required for single-host deployments. Multi-host
deployments use NATS leaf nodes to extend the subject namespace across hosts.

### TSG.11.1.5 Terminology

**Table TSG.11-1: NATS Terminology**

| Term | Definition |
|------|-----------|
| **Subject** | A string-based address for message routing (e.g., `tsingou.signal.http.feed-1`) |
| **Publisher** | A client that sends messages to a subject |
| **Subscriber** | A client that receives messages from a subject (or wildcard pattern) |
| **Queue Group** | A named group of subscribers where each message is delivered to exactly one member |
| **Wildcard** | `*` matches a single token; `>` matches one or more trailing tokens |
| **JetStream** | NATS persistence layer providing at-least-once and exactly-once delivery |
| **Stream** | A JetStream storage unit that captures messages published to matching subjects |
| **Consumer** | A stateful view of a stream; tracks acknowledged messages for a subscriber |
| **KV Bucket** | A NATS-native key-value store backed by a JetStream stream |
| **Object Store** | A NATS-native large-object store with chunked upload/download |
| **Leaf Node** | A NATS server that connects to a hub, transparently bridging local subjects |
| **Hub** | The central NATS server or cluster that leaf nodes connect to |
| **Account** | A NATS namespace providing subject isolation between tenants |
| **NKey** | An Ed25519 key pair used for NATS authentication |
| **JWT** | A JSON Web Token encoding NATS authorization claims (accounts, users, permissions) |
| **$SYS** | The NATS system account subject namespace for server monitoring |

### TSG.11.1.6 Conventions

- NATS subjects use dot-separated tokens: `tsingou.signal.http.feed-1`
- Subject tokens MUST NOT contain spaces, colons, or null bytes
- Subject tokens SHOULD use lowercase alphanumeric characters and hyphens
- The `>` wildcard MUST only appear as the last token in a subject pattern
- The `*` wildcard matches exactly one token at any position

---

## TSG.11.2 NATS Core Concepts

### TSG.11.2.1 Publish/Subscribe

NATS core pub/sub is the foundational messaging pattern. A publisher sends a
message to a subject; all subscribers matching that subject receive the message.
Delivery is **at-most-once** -- if no subscriber is connected when the message
is published, the message is lost.

```
Publisher                         Subscribers
─────────                         ───────────
                                  ┌─── Sub A (tsingou.signal.http.>)
nats.publish(                     │
  "tsingou.signal.http.feed-1",  ─┤─── Sub B (tsingou.signal.http.feed-1)
  payload                         │
)                                 └─── Sub C (tsingou.signal.>)
```

**Characteristics:**

| Property | Value |
|----------|-------|
| Delivery guarantee | At-most-once |
| Ordering | Per-publisher FIFO within a single connection |
| Fan-out | All matching subscribers receive the message |
| Latency | Sub-millisecond on localhost |
| Persistence | None -- message exists only in transit |
| Backpressure | None at the NATS level (see TSG.11.7 for application-level) |

### TSG.11.2.2 Request/Reply

Request/reply is a synchronous pattern built on pub/sub. The requester publishes
a message with a unique reply subject; the responder subscribes, processes, and
publishes the response to the reply subject.

```
Requester                                      Responder
─────────                                      ─────────
nats.request(                                  nats.subscribe(
  "tsingou.control.adapter.pause",               "tsingou.control.adapter.pause",
  { adapterId: "nats-feed-1" }                   (msg) => {
)                                                  pause(msg.data.adapterId)
  │                                                msg.respond({ ok: true })
  └──── awaits on unique _INBOX.xxx ◄──────────  }
                                               )
```

Tsingou uses request/reply for:

- **Adapter control** -- pause, resume, reconfigure commands
- **Schema registry lookup** -- query-by-kind with cached response
- **Sidecar commands** -- start, stop, reconfigure sidecar processes
- **Health probes** -- synchronous health check with timeout

### TSG.11.2.3 Queue Groups

Queue groups provide load-balanced message delivery. When multiple subscribers
join the same queue group on the same subject, each message is delivered to
exactly one member of the group. NATS selects the recipient using round-robin
distribution.

```
Publisher                          Queue Group "tsingou-processors"
─────────                          ────────────────────────────────
                                   ┌─── Worker A ← receives msg 1, 4, 7, ...
nats.publish(                      │
  "tsingou.signal.http.feed-1",   ─┤─── Worker B ← receives msg 2, 5, 8, ...
  payload                          │
)                                  └─── Worker C ← receives msg 3, 6, 9, ...
```

Tsingou uses queue groups for:

| Use Case | Queue Group Name | Purpose |
|----------|-----------------|---------|
| Signal processing | `tsingou-processors` | Distribute signal processing across workers |
| TAXII bridge | `tsingou-taxii-bridge` | Load-balance STIX encoding across bridge instances |
| Sidecar health aggregation | `tsingou-health-agg` | Single health aggregator per cluster |

### TSG.11.2.4 Subject Wildcards

NATS supports two wildcard tokens for subject pattern matching:

| Wildcard | Matches | Position | Example Pattern | Matches Subject |
|----------|---------|----------|----------------|-----------------|
| `*` | Exactly one token | Any | `tsingou.signal.*.feed-1` | `tsingou.signal.http.feed-1` |
| `>` | One or more tokens | Last only | `tsingou.signal.>` | `tsingou.signal.http.feed-1`, `tsingou.signal.sdr.rtlsdr-0.iq` |

**Wildcard usage in Tsingou:**

| Pattern | Meaning | Consumer |
|---------|---------|----------|
| `tsingou.signal.>` | All signals from all sources | SignalQueue drain (d2ts ingest) |
| `tsingou.signal.http.>` | All HTTP-sourced signals | HTTP-specific processing operators |
| `tsingou.signal.sdr.*` | All SDR signals (one level) | SDR adapter health aggregation |
| `tsingou.sidecar.*.health` | Health from any sidecar | Sidecar health dashboard |
| `tsingou.control.>` | All control messages | Control plane router |

### TSG.11.2.5 Subject Token Format

Subject tokens in Tsingou follow these conventions:

| Token Position | Convention | Examples |
|---------------|-----------|----------|
| Root | `tsingou` (always) | `tsingou.*` |
| Category | Functional area | `signal`, `control`, `telemetry`, `sidecar`, `taxii`, `internal` |
| Kind | Signal kind or service name | `http`, `nats`, `sdr`, `serial`, `rss` |
| Instance | Source or device identifier | `feed-1`, `rtlsdr-0`, `COM3` |
| Qualifier | Sub-resource or action | `health`, `metrics`, `status`, `iq`, `fft` |

Token values MUST conform to:

- Lowercase alphanumeric characters: `[a-z0-9]`
- Hyphens for multi-word tokens: `threat-intel`, `file-watch`
- No dots within tokens (dots are separators)
- No colons, spaces, or special characters
- Maximum 64 characters per token

---

## TSG.11.3 Subject Topology

### TSG.11.3.1 Subject Tree Overview

The Tsingou subject namespace is organized as a hierarchical tree. Every NATS
message published by Tsingou components uses a subject within this tree.

```
tsingou
├── signal                                    Signal data plane
│   ├── nats                                  NATS-sourced signals
│   │   ├── {source_id}                       Per-source instance
│   │   └── ...
│   ├── http                                  HTTP-sourced signals
│   │   ├── {source_id}
│   │   └── ...
│   ├── websocket                             WebSocket-sourced signals
│   │   └── {source_id}
│   ├── rss                                   RSS feed signals
│   │   └── {source_id}
│   ├── serial                                Serial device signals
│   │   └── {port_id}
│   ├── midi                                  MIDI signals
│   │   └── {device_id}
│   ├── osc                                   OSC signals
│   │   └── {port}
│   ├── file-watch                            File watch events
│   │   └── {path_hash}
│   └── sdr                                   SDR signals
│       ├── iq.{device_id}                    Raw IQ samples
│       ├── fft.{device_id}                   FFT spectrum data
│       ├── waterfall.{device_id}             Waterfall display data
│       ├── decoded.{protocol}                Decoded protocol data
│       └── recording.{device_id}             SigMF recording notifications
│
├── derived                                   Derived/processed signals
│   ├── correlation.{session_id}              Correlation results
│   ├── aggregate.{window_id}                 Aggregation outputs
│   ├── alert.{rule_id}                       Alert triggers
│   └── enrichment.{source_id}                Enrichment outputs
│
├── control                                   Control plane
│   ├── adapter                               Adapter management
│   │   ├── pause                             Pause adapter (request/reply)
│   │   ├── resume                            Resume adapter
│   │   ├── register                          Register new adapter
│   │   └── unregister                        Unregister adapter
│   ├── pipeline                              Pipeline management
│   │   ├── start                             Start d2ts pipeline
│   │   ├── stop                              Stop pipeline
│   │   └── reconfigure                       Update pipeline config
│   └── sidecar                               Sidecar management
│       ├── {name}.start                      Start sidecar
│       ├── {name}.stop                       Stop sidecar
│       └── {name}.reconfigure                Reconfigure sidecar
│
├── telemetry                                 Health and metrics
│   ├── adapter.{adapter_id}.health           Adapter health snapshots
│   ├── pipeline.health                       Pipeline health
│   ├── pipeline.throughput                   Signal throughput metrics
│   └── system.resources                      System resource usage
│
├── sidecar                                   Sidecar lifecycle
│   ├── {name}.health                         Sidecar health heartbeat
│   ├── {name}.status                         Sidecar lifecycle events
│   ├── {name}.metrics                        Performance metrics
│   ├── {name}.log                            Structured log messages
│   └── {name}.devices                        Device discovery results
│
├── taxii                                     TAXII bridge subjects
│   ├── {api_root}.{collection_id}            TAXII collection mapping
│   ├── ingestion.{source}.{collection}       Inbound TAXII objects
│   └── export.{collection}                   Outbound TAXII objects
│
├── schema                                    Schema registry events
│   ├── registered                            New schema registered
│   ├── updated                               Schema version updated
│   └── deprecated                            Schema deprecated
│
├── session                                   Analysis session events
│   ├── {session_id}.created                  Session created
│   ├── {session_id}.closed                   Session closed
│   └── {session_id}.snapshot                 Session state snapshot
│
├── audit                                     Audit trail
│   ├── config.change                         Configuration changes
│   ├── auth.event                            Authentication events
│   └── security.alert                        Security alerts
│
└── internal                                  Internal system subjects
    ├── dead-letter                            Failed validation signals
    ├── gc.expired                             Expired signal notifications
    └── diagnostic.{component}                Component diagnostics
```

### TSG.11.3.2 Subject Pattern Reference

**Table TSG.11-2: Complete Subject Pattern Reference**

| Subject Pattern | Direction | Publisher | Subscriber | Payload |
|----------------|-----------|-----------|------------|---------|
| `tsingou.signal.{kind}.{source_id}` | Data plane | Source adapter | SignalQueue / JetStream | BaseSignal (JSON) |
| `tsingou.signal.sdr.iq.{device}` | Data plane | SDR sidecar | JetStream / Object Store ref | IQ samples (binary or ref) |
| `tsingou.signal.sdr.fft.{device}` | Data plane | SDR sidecar / GNU Radio | d2ts pipeline | FFT magnitude array |
| `tsingou.signal.sdr.decoded.{proto}` | Data plane | GNU Radio sidecar | d2ts pipeline | Decoded protocol data |
| `tsingou.derived.correlation.{sid}` | Data plane | d2ts pipeline | OutputBridge / JetStream | Correlation result |
| `tsingou.derived.alert.{rule}` | Data plane | d2ts pipeline | Alert service / UI | Alert trigger event |
| `tsingou.control.adapter.*` | Control | AdapterManager | NatsSourceAdapter | Command payload |
| `tsingou.control.pipeline.*` | Control | UI / API | TsingouFlow service | Pipeline command |
| `tsingou.control.sidecar.{name}.*` | Control | Tauri backend | Sidecar process | Sidecar command |
| `tsingou.telemetry.adapter.{id}.health` | Telemetry | Adapter | Health dashboard | AdapterHealth |
| `tsingou.telemetry.pipeline.health` | Telemetry | TsingouFlow | Health dashboard | PipelineHealth |
| `tsingou.telemetry.pipeline.throughput` | Telemetry | TsingouFlow | Throughput gauge | Throughput snapshot |
| `tsingou.sidecar.{name}.health` | Sidecar | Sidecar process | Sidecar manager | SidecarHealth |
| `tsingou.sidecar.{name}.status` | Sidecar | Sidecar process | Lifecycle log | Lifecycle event |
| `tsingou.taxii.{root}.{collection}` | Bridge | TAXII bridge | TAXII server | STIX Bundle |
| `tsingou.schema.registered` | Schema | SchemaRegistry | Schema watchers | SchemaRegistryEntry |
| `tsingou.audit.config.change` | Audit | Config services | Audit log | Change record |
| `tsingou.internal.dead-letter` | Internal | Validation layer | Dead-letter inspector | Failed signal + error |

### TSG.11.3.3 Subject Naming Rules

Implementations MUST enforce the following subject naming rules:

1. All Tsingou subjects MUST begin with the `tsingou.` prefix.
2. Subject tokens MUST NOT contain colons (`:`), spaces, or null bytes.
3. Subject tokens MUST use lowercase alphanumeric characters and hyphens only.
4. The `>` wildcard MUST only appear as the last token.
5. Source identifiers used as subject tokens MUST use dots (`.`) as separators
   within the NATS subject hierarchy, NOT colons.

**CRITICAL: NATS KV keys become NATS subjects internally (`$KV.{bucket}.{key}`).
Colons are INVALID in NATS subjects. All keys MUST use dots as separators.**

Example:
```
CORRECT:   host.sensor-alpha.config     (dots as separators)
INCORRECT: host:sensor-alpha:config     (colons — INVALID)
```

This constraint originates from the NATS subject addressing model and applies
to all NATS interactions including KV keys, stream subject filters, and
consumer filter subjects.

### TSG.11.3.4 Subject Hierarchy Design Rationale

The subject tree is organized by **function first, kind second, instance third**.
This hierarchy enables efficient wildcard subscriptions:

| Subscription Need | Wildcard Pattern | Tokens Matched |
|------------------|-----------------|----------------|
| All signals | `tsingou.signal.>` | All signal subjects across all kinds and sources |
| All HTTP signals | `tsingou.signal.http.>` | All HTTP-sourced signals |
| Specific source | `tsingou.signal.http.feed-1` | Exactly one source |
| All sidecar health | `tsingou.sidecar.*.health` | Health from any sidecar |
| All telemetry | `tsingou.telemetry.>` | All telemetry subjects |
| All SDR data | `tsingou.signal.sdr.>` | IQ, FFT, waterfall, decoded, recordings |

The function-first design ensures that subscribing to `tsingou.signal.>` captures
ALL signals regardless of kind -- this is the pattern used by the SignalQueue
drain in the d2ts ingest graph. An alternative kind-first design would require
multiple subscriptions or a top-level wildcard that also captures control and
telemetry messages.

---

## TSG.11.4 JetStream Persistence

### TSG.11.4.1 Purpose

NATS JetStream provides persistent, replay-capable message storage. In Tsingou,
JetStream enables:

1. **Signal replay** -- Replay historical signals for retrospective analysis
2. **At-least-once delivery** -- Guaranteed processing of every signal
3. **Exactly-once semantics** -- Deduplication via message ID headers
4. **Durable consumers** -- Resume from last acknowledged position after restart
5. **Time-based retention** -- Automatic signal expiration (default 24 hours)
6. **Size-based retention** -- Prevent disk exhaustion on constrained deployments

### TSG.11.4.2 Stream Definitions

**Table TSG.11-3: JetStream Stream Configuration**

| Stream Name | Subjects | Storage | Max Age | Max Bytes | Retention | Replicas | Purpose |
|------------|----------|---------|---------|-----------|-----------|----------|---------|
| `TSINGOU_SIGNALS` | `tsingou.signal.>` | File | 24h | 1 GB | Limits | 1 (embedded) / 3 (cluster) | Raw signal history for replay |
| `TSINGOU_DERIVED` | `tsingou.derived.>` | File | 24h | 512 MB | Limits | 1 / 3 | Derived state snapshots |
| `TSINGOU_SIDECAR` | `tsingou.sidecar.>` | File | 7d | 256 MB | Limits | 1 / 3 | Sidecar health, status, metrics |
| `TSINGOU_AUDIT` | `tsingou.audit.>` | File | 30d | 128 MB | Limits | 1 / 3 | Configuration changes, security events |
| `TSINGOU_TELEMETRY` | `tsingou.telemetry.>` | Memory | 1h | 64 MB | Limits | 1 | Adapter and pipeline telemetry |
| `TSINGOU_TAXII` | `tsingou.taxii.>` | File | 7d | 1 GB | Limits | 1 / 3 | TAXII bridge message history |
| `TSINGOU_SCHEMA` | `tsingou.schema.>` | File | None | 32 MB | Interest | 1 / 3 | Schema registry events |
| `TSINGOU_DEADLETTER` | `tsingou.internal.dead-letter` | File | 72h | 256 MB | Limits | 1 | Failed validation signals |

### TSG.11.4.3 Retention Policies

JetStream supports three retention policies:

| Policy | Behavior | Tsingou Usage |
|--------|----------|---------------|
| **Limits** | Messages retained until age/size/count limit exceeded; oldest purged first | Signal streams, sidecar, audit, telemetry |
| **Interest** | Messages retained only while at least one consumer exists; purged when all consumers acknowledge | Schema events (ephemeral interest) |
| **WorkQueue** | Each message delivered to exactly one consumer; purged after acknowledgement | TAXII batch processing (future) |

Implementations MUST use the **Limits** retention policy for all signal streams.
The Interest policy MAY be used for ephemeral event streams where replay is not
required. The WorkQueue policy SHOULD be used for distributed processing where
exactly-once semantics are required.

### TSG.11.4.4 Consumer Configuration

**Table TSG.11-4: Standard Consumer Definitions**

| Consumer Name | Stream | Type | Deliver Policy | Ack Policy | Max Ack Pending | Filter Subject | Purpose |
|--------------|--------|------|---------------|------------|-----------------|---------------|---------|
| `tsingou-ingest` | `TSINGOU_SIGNALS` | Durable | New | Explicit | 4096 | `tsingou.signal.>` | d2ts pipeline ingest |
| `tsingou-replay-{session}` | `TSINGOU_SIGNALS` | Ephemeral | ByStartSequence | None | 1024 | `tsingou.signal.>` | Session replay |
| `tsingou-taxii-bridge` | `TSINGOU_SIGNALS` | Durable | New | Explicit | 256 | `tsingou.signal.>` | TAXII export bridge |
| `tsingou-health-agg` | `TSINGOU_SIDECAR` | Durable | Last | Explicit | 64 | `tsingou.sidecar.*.health` | Health aggregation |
| `tsingou-audit-log` | `TSINGOU_AUDIT` | Durable | All | Explicit | 128 | `tsingou.audit.>` | Audit log persistence |

### TSG.11.4.5 Deliver Policies

| Policy | Behavior | When to Use |
|--------|----------|-------------|
| `All` | Deliver all messages in the stream | Audit log replay, full history reconstruction |
| `Last` | Deliver only the last message per subject | Health snapshots, configuration state |
| `New` | Deliver only messages published after consumer creation | Live signal processing |
| `ByStartSequence` | Deliver from a specific stream sequence number | Replay from known checkpoint |
| `ByStartTime` | Deliver from a specific timestamp | Time-based replay |
| `LastPerSubject` | Deliver the last message for each unique subject | State reconstruction across sources |

### TSG.11.4.6 Acknowledgement Semantics

JetStream consumers with `ackPolicy: 'explicit'` require the subscriber to
acknowledge each message after processing:

```typescript
// JetStream consumer with explicit ack
const jsStream = yield* streamSvc.subscribe(
  'TSINGOU_SIGNALS',
  RawPayload,
  {
    consumer: 'tsingou-ingest',
    filterSubject: 'tsingou.signal.>',
    deliverPolicy: 'new',
    ackPolicy: 'explicit',
  },
)

yield* Stream.runForEach(jsStream, (msg) =>
  Effect.gen(function* () {
    yield* internals.push(normalizeSignal(msg))
    yield* msg.ack()  // Acknowledge AFTER successful push
  }),
)
```

**Ack timing contract:**

| Scenario | Ack Timing | Guarantee |
|----------|-----------|-----------|
| Normal processing | After `internals.push()` succeeds | At-least-once |
| Push failure (queue full) | After backpressure resolves and push succeeds | At-least-once |
| Processing error | No ack; message redelivered after `ack_wait` timeout | At-least-once |
| Adapter crash | No ack; message redelivered to durable consumer on restart | At-least-once |

### TSG.11.4.7 Exactly-Once Delivery

For scenarios requiring exactly-once semantics (e.g., TAXII export to avoid
duplicate STIX objects), JetStream provides deduplication via message headers:

```typescript
// Publish with deduplication ID
yield* nats.publish('tsingou.signal.http.feed-1', payload, {
  headers: {
    'Nats-Msg-Id': signalId,  // SignalId serves as dedup key
  },
})
```

The JetStream server maintains a deduplication window (default: 2 minutes).
Messages with duplicate `Nats-Msg-Id` values within this window are silently
discarded.

**Deduplication configuration:**

| Parameter | Default | Tsingou Setting | Rationale |
|-----------|---------|----------------|-----------|
| `duplicate_window` | 2m | 5m | Accommodate adapter restart + replay overlap |
| `max_msgs_per_subject` | Unlimited | 10000 | Prevent subject-level unbounded growth |

### TSG.11.4.8 Stream Mirroring and Sourcing

For multi-cluster deployments [TSG.34], JetStream supports stream mirroring
(read-only copy) and sourcing (merge from multiple streams):

```
                Hub Cluster
    ┌─────────────────────────────┐
    │  TSINGOU_SIGNALS (primary)  │
    │  ◄── sources:               │
    │       TSINGOU_SIGNALS_LEAF_A│
    │       TSINGOU_SIGNALS_LEAF_B│
    └─────────────────────────────┘
           ▲              ▲
           │              │
    ┌──────┴──────┐ ┌────┴────────┐
    │ Leaf Node A │ │ Leaf Node B │
    │ TSINGOU_    │ │ TSINGOU_    │
    │ SIGNALS_    │ │ SIGNALS_    │
    │ LEAF_A      │ │ LEAF_B      │
    └─────────────┘ └─────────────┘
```

The hub cluster sources signals from all leaf node streams, providing a
unified view of all signals across the deployment. Consumers on the hub
stream receive signals from all leaf nodes.

---

## TSG.11.5 KV Store

### TSG.11.5.1 Purpose

NATS KV Store provides a simple key-value interface backed by JetStream. In
Tsingou, KV stores manage configuration state, schema definitions, and session
metadata that must persist across process restarts and be observable by multiple
components.

KV Store is preferred over external databases (PostgreSQL, SQLite) because:

1. **No additional dependency** -- KV is built into the same NATS server
2. **Watch capability** -- Subscribers receive real-time updates on key changes
3. **Versioned entries** -- KV maintains revision history for each key
4. **Consistent deployment** -- Same storage backend (JetStream) for all persistence

### TSG.11.5.2 KV Bucket Inventory

**Table TSG.11-5: KV Bucket Definitions**

| Bucket Name | Key Pattern | Value Schema | History Depth | TTL | Purpose |
|-------------|------------|-------------|---------------|-----|---------|
| `tsingou-schemas` | `{signal_kind}` | `SchemaRegistryEntry` | 5 | None | Signal type schema definitions |
| `tsingou-adapters` | `{adapter_id}` | `AdapterConfig` | 3 | None | Adapter configuration snapshots |
| `tsingou-sessions` | `{session_id}` | `SessionState` | 1 | 24h | Analysis session state |
| `tsingou-sidecars` | `{sidecar_name}` | `SidecarConfig` | 3 | None | Last-known sidecar configuration |
| `tsingou-rss-dedup` | `{feed_id}` | `RssDeduplicationState` | 1 | 7d | RSS item GUID dedup sets |
| `tsingou-taxii-sync` | `sync.{source}.{collection}` | `TaxiiSyncState` | 3 | None | TAXII delta sync watermarks |
| `tsingou-pipeline` | `{config_key}` | `PipelineConfig` | 5 | None | Pipeline configuration parameters |

### TSG.11.5.3 KV Key Format

**CRITICAL:** NATS KV keys become NATS subjects internally. The internal subject
format is `$KV.{bucket}.{key}`. Because NATS subjects MUST NOT contain colons,
KV keys MUST NOT contain colons.

**Key format rules:**

| Rule | Valid | Invalid | Rationale |
|------|-------|---------|-----------|
| Dot separators | `host.sensor-alpha` | `host:sensor-alpha` | NATS subject compatibility |
| Lowercase tokens | `mqtt-bridge` | `MQTT_Bridge` | Convention consistency |
| Alphanumeric + hyphens | `feed-1` | `feed_1` | Subject token convention |
| No spaces | `threat-intel` | `threat intel` | NATS subject constraint |
| Wildcard in watch only | `>` in `kv.watch({key: '>'})` | `>` in `kv.put()` | Wildcards are for patterns, not keys |

### TSG.11.5.4 SchemaRegistry KV Usage

The TsingouSchemaRegistry service [TSG.8.8] stores runtime-registered signal
schemas in the `tsingou-schemas` KV bucket:

```typescript
// Register a runtime schema (from SchemaRegistry.ts)
const KV_BUCKET = 'tsingou-schemas'

// Store schema entry
yield* holonetKV.put(KV_BUCKET, schemaId, SchemaRegistryEntry, entry)

// Lookup schema entry
const entry = yield* holonetKV.get(KV_BUCKET, schemaId, SchemaRegistryEntry)

// List all registered schemas
const entries = yield* holonetKV.list(KV_BUCKET, SchemaRegistryEntry)

// Watch for schema changes (real-time)
const watchStream = holonetKV.watch(KV_BUCKET, SchemaRegistryEntry, { key: '>' })
```

**Watch semantics:**

The `kv.watch()` operation returns a `Stream` of key-value change events. This
enables reactive schema updates -- when a new schema is registered on any node
in the cluster, all nodes with active watches receive the update immediately.

```
Node A: kv.put("tsingou-schemas", "custom-sensor", entry)
  │
  ├──► JetStream persists entry
  │
  ├──► Node B watch stream emits: { key: "custom-sensor", value: entry, op: "PUT" }
  │
  └──► Node C watch stream emits: { key: "custom-sensor", value: entry, op: "PUT" }
```

### TSG.11.5.5 Adapter Configuration KV Usage

Adapter configurations are persisted to enable reconstruction after restart:

**Table TSG.11-6: Adapter Configuration KV Entries**

| Key | Value | Written By | Read By |
|-----|-------|-----------|---------|
| `nats-threat-feed-1` | NatsAdapterConfig JSON | AdapterManager.register | AdapterManager.bootstrap |
| `http-shodan-monitor` | HttpAdapterConfig JSON | AdapterManager.register | AdapterManager.bootstrap |
| `ws-crypto-stream-1` | WsAdapterConfig JSON | AdapterManager.register | AdapterManager.bootstrap |
| `rss-reuters-world` | RssAdapterConfig JSON | RssFeedManager.addFeed | RssFeedManager.bootstrap |

### TSG.11.5.6 Session State KV Usage

Analysis session state is stored with a 24-hour TTL:

```typescript
const SessionState = Schema.Struct({
  sessionId: SessionId,
  createdAt: Schema.DateFromSelf,
  lastActiveAt: Schema.DateFromSelf,
  selectedSignalIds: Schema.Array(SignalId),
  activeAdapterIds: Schema.Array(Schema.String),
  pipelineConfig: Schema.optional(Schema.Unknown),
  viewState: Schema.optional(Schema.Unknown),
})
```

Session state is written periodically (every 30 seconds) and on session close.
On application restart, the last session state is hydrated from KV to restore
the user's workspace.

### TSG.11.5.7 KV Bucket Configuration

```
# JetStream KV bucket creation (via NATS CLI or programmatic)

# Schema registry — persistent, versioned
nats kv add tsingou-schemas \
  --history=5 \
  --storage=file \
  --replicas=1 \
  --max-value-size=1048576    # 1 MB max per schema entry

# Adapter config — persistent
nats kv add tsingou-adapters \
  --history=3 \
  --storage=file \
  --replicas=1

# Session state — ephemeral with TTL
nats kv add tsingou-sessions \
  --history=1 \
  --storage=file \
  --ttl=24h \
  --replicas=1

# RSS deduplication — ephemeral with TTL
nats kv add tsingou-rss-dedup \
  --history=1 \
  --storage=file \
  --ttl=7d \
  --replicas=1
```

---

## TSG.11.6 Object Store

### TSG.11.6.1 Purpose

NATS Object Store provides storage for large payloads that exceed the practical
message size limit of core NATS (~1 MB default, configurable up to 64 MB). In
Tsingou, large payloads include:

- **Raw IQ samples** -- SDR captures at 2.4 MSPS produce 19 MB/s of raw data
- **SigMF recordings** -- Signal Metadata Format files with multi-GB IQ data
- **STIX bundles** -- Large intelligence packages with embedded artifacts
- **PCAP captures** -- Network packet captures for protocol analysis
- **Analysis reports** -- Generated PDF/HTML reports with embedded visualizations

### TSG.11.6.2 Object Store Buckets

**Table TSG.11-7: Object Store Bucket Definitions**

| Bucket Name | Max Object Size | Max Bucket Size | TTL | Chunk Size | Purpose |
|-------------|----------------|----------------|-----|------------|---------|
| `tsingou-iq-samples` | 1 GB | 50 GB | 72h | 256 KB | Raw IQ sample data files |
| `tsingou-sigmf` | 2 GB | 100 GB | 7d | 256 KB | SigMF recordings (.sigmf-data + .sigmf-meta) |
| `tsingou-stix-bundles` | 50 MB | 5 GB | 30d | 128 KB | Large STIX 2.1 bundles with artifacts |
| `tsingou-pcap` | 500 MB | 20 GB | 7d | 256 KB | Network packet captures |
| `tsingou-reports` | 100 MB | 10 GB | 90d | 128 KB | Generated analysis reports |

### TSG.11.6.3 Chunked Upload Pattern

Object Store automatically chunks large objects and stores each chunk as a
JetStream message. The upload/download process is transparent to the application:

```
Application                    NATS Object Store
───────────                    ─────────────────
                               ┌─────────────────────┐
obj.put(                       │  Chunk 1 (256 KB)   │
  "iq-capture-2026-02-18",    │  Chunk 2 (256 KB)   │
  iqData  // 50 MB            │  ...                 │
)                              │  Chunk 200 (256 KB) │
  │                            │  Metadata entry      │
  └── chunked upload ────────►│  (name, size, digest)│
                               └─────────────────────┘
```

### TSG.11.6.4 Reference-by-Key in BaseSignal

When a signal payload references a large object, the BaseSignal metadata
carries the object store reference:

```typescript
const signal: BaseSignal = {
  id: generateSignalId('sdr'),
  sourceId: 'rtlsdr-field-0' as SourceId,
  timestamp: new Date(),
  version: [0, seq],
  kind: 'sdr',
  payload: {
    centerFreqHz: 433920000,
    sampleRate: 2400000,
    format: 'cf32',
    // Reference to object store instead of inline data
    objectStoreRef: {
      bucket: 'tsingou-iq-samples',
      key: 'iq-capture-2026-02-18T14-30-00',
      sizeBytes: 52428800,
      digest: 'sha256:a3f7b2...',
    },
  },
  metadata: {
    'sdr.objectStore': true,
    'sdr.chunkCount': 200,
  },
}
```

This pattern keeps BaseSignal messages small (< 1 KB) while enabling arbitrary
payload sizes through indirection.

### TSG.11.6.5 Object Store vs. Direct Disk Storage

| Criterion | Object Store | Direct Disk |
|-----------|-------------|-------------|
| Distribution | Automatically replicated in NATS cluster | Requires manual file sync |
| Access from WebView | Via NATS WebSocket client | Requires Tauri IPC for filesystem access |
| Retention | TTL-based automatic cleanup | Manual cleanup required |
| Discovery | `obj.list()` returns all objects | Filesystem walk required |
| Chunking | Automatic | Application-level |
| Size limit | Configurable per bucket | Filesystem limit |

For objects requiring maximum throughput (real-time IQ streaming), direct disk
storage with a NATS notification message (containing the file path) is
RECOMMENDED [TSG.34.9.4]. For objects requiring distribution and discovery,
Object Store is RECOMMENDED.

---

## TSG.11.7 Backpressure Strategy

### TSG.11.7.1 Four Pressure Points

The Tsingou data path has four pressure points where backpressure is applied
to prevent unbounded memory growth:

```
Pressure Point 1          Pressure Point 2          Pressure Point 3          Pressure Point 4
Adapter Output            SignalQueue                JetStream Consumer        OutputBridge
Queue.bounded(4096)       Queue.bounded(4096)        max_ack_pending(4096)    Queue.bounded(1024)
                          (shared across adapters)

      ┌──────────┐            ┌──────────┐            ┌──────────┐            ┌──────────┐
      │ Source    │            │ Signal   │            │ d2ts     │            │ Output   │
      │ Adapter   │───push───►│ Queue    │───drain───►│ Pipeline │───emit───►│ Bridge   │───write──► Atoms
      │          │            │          │            │          │            │          │
      └──────────┘            └──────────┘            └──────────┘            └──────────┘
           │                       │                       │                       │
           ▼                       ▼                       ▼                       ▼
      Queue full?             Queue full?             Acks pending?            Queue full?
      Fiber suspends          Adapter fiber           Consumer paused          Pipeline fiber
                              suspends                by NATS server           suspends
```

### TSG.11.7.2 Pressure Point Details

**Table TSG.11-8: Backpressure Pressure Points**

| Point | Component | Mechanism | Capacity | Trigger | Effect |
|-------|-----------|-----------|----------|---------|--------|
| PP-1 | Adapter output | `Queue.bounded(4096)` | 4096 signals | Queue full | Adapter fiber suspends; source may buffer or drop |
| PP-2 | SignalQueue | `Queue.bounded(4096)` | 4096 signals | Queue full | All adapter push fibers suspend |
| PP-3 | JetStream consumer | `max_ack_pending` | 4096 messages | Ack limit reached | NATS stops delivering to consumer |
| PP-4 | OutputBridge | `Queue.bounded(1024)` | 1024 signals | Queue full | d2ts output fiber suspends |

### TSG.11.7.3 Backpressure Propagation

Backpressure propagates upstream through the fiber suspension chain:

```
Scenario: Rendering layer stalls (e.g., GC pause, tab backgrounded)
  │
  ├── PP-4: OutputBridge queue fills → d2ts output fiber suspends
  │
  ├── PP-3: d2ts stops draining → ack count reaches max_ack_pending
  │         → NATS pauses consumer delivery
  │
  ├── PP-2: SignalQueue fills → Queue.offer suspends calling fibers
  │
  └── PP-1: Adapter push suspends → source-specific behavior:
              ├── NATS: Messages accumulate in JetStream (replay on resume)
              ├── WebSocket: Frames buffer in OS socket buffer
              ├── HTTP poll: Next poll delayed until current signal processed
              ├── RSS: Items queue in memory; next poll delayed
              └── Serial: OS serial buffer fills; bytes may be lost
```

### TSG.11.7.4 NATS Flow Control

NATS JetStream provides server-side flow control through two mechanisms:

1. **Max Ack Pending** -- Limits the number of unacknowledged messages a consumer
   can have outstanding. When reached, the server stops delivering.

2. **Max Waiting** -- Limits the number of pull requests that can be outstanding
   for pull-based consumers.

```typescript
// Consumer configuration with flow control
const consumerConfig = {
  durable_name: 'tsingou-ingest',
  filter_subject: 'tsingou.signal.>',
  deliver_policy: 'new',
  ack_policy: 'explicit',
  max_ack_pending: 4096,       // Flow control: max unacked messages
  ack_wait: Duration.seconds(30).toNanos(), // Redeliver after 30s if not acked
  max_deliver: 5,              // Give up after 5 delivery attempts
}
```

### TSG.11.7.5 Capacity Tuning Guidelines

**Table TSG.11-9: Backpressure Capacity Tuning**

| Deployment | PP-1 (Adapter) | PP-2 (SignalQueue) | PP-3 (max_ack_pending) | PP-4 (OutputBridge) | Rationale |
|-----------|---------------|-------------------|----------------------|--------------------|-----------|
| Desktop (analyst laptop) | 4096 | 4096 | 4096 | 1024 | Balanced memory vs. latency |
| High-throughput server | 16384 | 16384 | 16384 | 4096 | Higher burst absorption |
| Constrained embedded | 1024 | 1024 | 1024 | 256 | Lower memory footprint |
| Development/testing | 256 | 256 | 256 | 64 | Surface backpressure issues early |

---

## TSG.11.8 NATS-TAXII Bridge

### TSG.11.8.1 Purpose

The NATS-TAXII bridge maps TAXII 2.1 collections [TSG.14] to NATS subjects,
enabling bidirectional intelligence exchange between Tsingou's internal signal
pipeline and external CTI platforms (OpenCTI, MISP, Anomali).

### TSG.11.8.2 Subject-to-Collection Mapping

**Table TSG.11-10: TAXII Collection to NATS Subject Mapping**

| TAXII Collection | Collection ID | NATS Subject | Direction | STIX Types |
|-----------------|--------------|-------------|-----------|------------|
| NATS Observations | `col-nats-obs` | `tsingou.taxii.internal.col-nats-obs` | Export | observed-data |
| HTTP Observations | `col-http-obs` | `tsingou.taxii.internal.col-http-obs` | Export | observed-data, network-traffic |
| WebSocket Observations | `col-ws-obs` | `tsingou.taxii.internal.col-ws-obs` | Export | observed-data |
| Threat Indicators | `col-indicators` | `tsingou.taxii.internal.col-indicators` | Export | indicator |
| Correlations | `col-correlations` | `tsingou.taxii.internal.col-correlations` | Export | relationship, sighting |
| Partner Indicators | `col-partner-indicators` | `tsingou.taxii.partner.col-partner-indicators` | Export (filtered) | indicator (TLP:AMBER) |
| External Feed | `{ext-collection}` | `tsingou.taxii.ingestion.{source}.{collection}` | Import | * |

### TSG.11.8.3 Export Pipeline (NATS to TAXII)

```
NATS JetStream Consumer (TSINGOU_SIGNALS)
  │  subscribe(tsingou.signal.>)
  │  queue group: tsingou-taxii-bridge
  ▼
Signal Demultiplexer
  │  Route by subject → collection mapping
  │  tsingou.signal.nats.* → col-nats-obs
  │  tsingou.signal.http.* → col-http-obs
  ▼
Batch Accumulator
  │  Buffer per collection
  │  Flush conditions:
  │    batch_size = 100 signals
  │    timeout = 5 seconds
  │    buffer_bytes = 5 MB
  ▼
STIX Codec (TSG.13)
  │  BaseSignal[] → StixBundle
  │  Deterministic UUIDs for dedup
  ▼
TAXII Server Ingest (internal API)
  │  Bypasses HTTP for same-process efficiency
  ▼
JetStream ACK
  │  Acknowledge consumed messages
  │  Retry on failure (max 3 attempts)
```

### TSG.11.8.4 Import Pipeline (TAXII to NATS)

```
TAXII Client (TSG.14.6)
  │  poll external TAXII server
  │  delta sync via manifest watermark
  ▼
STIX Bundle
  │  Decode via StixCodec
  ▼
BaseSignal[] (kind = stix-{type})
  │
  ├── Publish to NATS: tsingou.taxii.ingestion.{source}.{collection}
  │   (for JetStream persistence and audit)
  │
  └── Publish to NATS: tsingou.signal.nats.{source-id}
      (for d2ts pipeline ingestion as standard signals)
```

### TSG.11.8.5 Polling vs. Push Synchronization

| Mode | Mechanism | Latency | Use Case |
|------|-----------|---------|----------|
| **Polling** | TAXII Client polls external server on schedule | Minutes | External feeds without webhook support |
| **Push (NATS)** | External system publishes directly to NATS subject | Milliseconds | Partner systems with NATS connectivity |
| **Push (Webhook)** | External system sends HTTP POST; bridge publishes to NATS | Seconds | Systems with webhook support |

Implementations SHOULD prefer push-based synchronization for partner feeds to
minimize latency. Polling SHOULD be used as a fallback for systems that do not
support push mechanisms.

---

## TSG.11.9 Leaf Node Topology

### TSG.11.9.1 Purpose

NATS leaf nodes extend the Tsingou messaging topology across host boundaries
without requiring full cluster membership. A leaf node is a NATS server instance
that connects to a hub server, transparently bridging local subjects to the hub's
subject namespace.

### TSG.11.9.2 Hub-and-Spoke Architecture

```
                    ┌──────────────────────────────────┐
                    │          NATS Hub Server          │
                    │  (Analyst Station / Datacenter)   │
                    │                                    │
                    │  Subjects visible:                 │
                    │    tsingou.signal.>                │
                    │    tsingou.sidecar.>               │
                    │    tsingou.control.>               │
                    │    tsingou.telemetry.>             │
                    │                                    │
                    │  JetStream:                        │
                    │    TSINGOU_SIGNALS (sourced from   │
                    │      leaf streams)                 │
                    │    TSINGOU_SIDECAR                 │
                    │    TSINGOU_AUDIT                   │
                    │                                    │
                    │  KV Buckets:                       │
                    │    tsingou-schemas (authoritative)  │
                    │    tsingou-sessions                │
                    └──────┬──────────┬────────────┬────┘
                           │          │            │
          ┌────────────────┘          │            └────────────────┐
          │                           │                            │
    ┌─────▼──────────┐        ┌──────▼───────────┐        ┌──────▼───────────┐
    │  Leaf Node A   │        │  Leaf Node B     │        │  Leaf Node C     │
    │  (SDR Station) │        │  (Serial Bridge) │        │  (GNU Radio)     │
    │                │        │                  │        │                  │
    │  Local NATS    │        │  Local NATS      │        │  Local NATS      │
    │  server        │        │  server          │        │  server          │
    │                │        │                  │        │                  │
    │  Sidecars:     │        │  Sidecars:       │        │  Sidecars:       │
    │  - SDR bridge  │        │  - Serial bridge │        │  - GR flowgraph  │
    │  - GPS bridge  │        │  - GPS bridge    │        │  - SDR bridge    │
    │                │        │                  │        │                  │
    │  Publishes:    │        │  Publishes:      │        │  Publishes:      │
    │  tsingou.      │        │  tsingou.        │        │  tsingou.        │
    │  signal.sdr.>  │        │  signal.serial.> │        │  signal.sdr.     │
    │                │        │                  │        │  decoded.>       │
    └────────────────┘        └──────────────────┘        └──────────────────┘
```

### TSG.11.9.3 Subject Filtering for Bandwidth-Constrained Links

Leaf nodes MAY filter which subjects are bridged to the hub to conserve
bandwidth on constrained links (satellite, radio modem, cellular):

**Table TSG.11-11: Subject Filtering Strategies**

| Strategy | Subjects Forwarded | Bandwidth Savings | Use Case |
|----------|-------------------|-------------------|----------|
| **Full bridge** | `tsingou.>` (all) | None | High-bandwidth LAN |
| **Signal only** | `tsingou.signal.>` | ~30% (no telemetry/control) | Moderate bandwidth |
| **Filtered signal** | `tsingou.signal.sdr.fft.>` (no raw IQ) | ~90% (FFT only, no IQ) | Low bandwidth |
| **Alerts only** | `tsingou.derived.alert.>` | ~99% (alerts only) | Extremely constrained |
| **Store-and-forward** | None (batch upload) | Variable | Disconnected operation |

Subject filtering is configured in the leaf node configuration:

```
# Leaf node with subject filtering
leafnodes {
  remotes [
    {
      url: "nats-leaf://hub.tsingou.local:7422"
      credentials: "/etc/tsingou/leaf.creds"

      # Only forward signal subjects and alerts
      # Keeps telemetry and control local
      deny_exports: [
        "tsingou.telemetry.>",
        "tsingou.sidecar.>",
        "tsingou.internal.>"
      ]
      deny_imports: [
        "tsingou.control.>",       # Don't receive control from hub
      ]
    }
  ]
}
```

### TSG.11.9.4 NATS Account Isolation for Leaf Nodes

In multi-organization deployments, leaf nodes from different organizations MUST
be isolated using NATS accounts:

```
Hub Server
├── Account: org-alpha
│   ├── Leaf Node: alpha-station-1
│   ├── Leaf Node: alpha-station-2
│   └── Subjects: tsingou.alpha.>
│
├── Account: org-bravo
│   ├── Leaf Node: bravo-station-1
│   └── Subjects: tsingou.bravo.>
│
└── Account: shared
    ├── Imported from org-alpha: tsingou.alpha.signal.>
    ├── Imported from org-bravo: tsingou.bravo.signal.>
    └── Subjects: tsingou.shared.>
```

Subject export/import between accounts enables controlled data sharing:

```
# Account org-alpha exports signals to shared account
accounts {
  org-alpha {
    exports: [
      { stream: "tsingou.alpha.signal.>", accounts: ["shared"] }
    ]
  }
  shared {
    imports: [
      { stream: { account: "org-alpha", subject: "tsingou.alpha.signal.>" },
        to: "tsingou.shared.alpha.signal.>" }
    ]
  }
}
```

### TSG.11.9.5 Cluster Formation

For high-availability deployments, NATS servers can form clusters. A cluster
provides:

- **Automatic failover** -- If one node fails, clients reconnect to another
- **JetStream replication** -- Streams replicated across cluster nodes
- **Consistent KV** -- Raft-based consensus for KV operations

```
                ┌─────────────────┐
                │   NATS Cluster  │
                │                 │
                │  ┌───┐ ┌───┐   │
                │  │ N1│─│ N2│   │
                │  └─┬─┘ └─┬─┘   │
                │    │     │     │
                │  ┌─┴─────┴─┐   │
                │  │   N3    │   │
                │  └─────────┘   │
                │                 │
                │  Raft consensus │
                │  for JetStream  │
                │  and KV ops     │
                └─────────────────┘
                      │
            ┌─────────┴─────────┐
            │                   │
      ┌─────▼─────┐       ┌────▼──────┐
      │ Leaf A    │       │ Leaf B    │
      └───────────┘       └───────────┘
```

**Cluster sizing recommendations:**

| Deployment | Nodes | JetStream Replicas | Rationale |
|-----------|-------|-------------------|-----------|
| Desktop (single host) | 1 | 1 | No redundancy needed |
| Field station | 3 | 3 | Survive single-node failure |
| CEMA cell | 5 | 3 | Higher availability, more capacity |
| Datacenter | 5-7 | 3 | Production redundancy |

---

## TSG.11.10 Connection Management

### TSG.11.10.1 Effect Layer Lifecycle

The NATS client connection is managed as an Effect service with scoped lifecycle.
The connection is acquired when the service layer is provided and released when
the scope closes:

```typescript
// NatsClient Effect.Service (from Holonet)
export class NatsClient extends Effect.Service<NatsClient>()(
  'holonet/NatsClient',
  {
    scoped: Effect.gen(function* () {
      const config = yield* NatsClientConfigTag

      // Acquire: connect to NATS server
      const nc = yield* Effect.tryPromise(() =>
        nats.connect({
          servers: config.servers,
          reconnect: true,
          maxReconnectAttempts: config.maxReconnectAttempts ?? -1,
          reconnectTimeWait: config.reconnectTimeWaitMs ?? 2000,
          pingInterval: config.pingIntervalMs ?? 30000,
          maxPingOut: config.maxPingOut ?? 3,
          tls: config.tls,
          authenticator: config.authenticator,
        })
      )

      // Release: drain and close on scope close
      yield* Effect.addFinalizer(() =>
        Effect.tryPromise(() => nc.drain()).pipe(
          Effect.catchAll((err) =>
            Effect.log(`NATS drain error: ${err}`)
          ),
        )
      )

      return {
        connection: nc,
        status: () => nc.status(),
        publish: (subject, data, opts) => /* ... */,
        subscribe: (subject, opts) => /* ... */,
        request: (subject, data, opts) => /* ... */,
        jetstream: () => nc.jetstream(),
        jetstreamManager: () => nc.jetstreamManager(),
      }
    }),
  },
)
```

### TSG.11.10.2 acquireRelease Pattern

The NATS connection follows the Effect `acquireRelease` pattern, ensuring that
the connection is always properly drained on shutdown:

```
Application Start
  │
  ├── Effect.provide(NatsClient.Default)
  │     │
  │     ├── Acquire: nats.connect(servers)
  │     │     ├── TCP handshake
  │     │     ├── TLS negotiation (if configured)
  │     │     ├── Authentication (NKey/JWT/token)
  │     │     └── INFO exchange (server capabilities)
  │     │
  │     └── Connection established → service available
  │
  ├── ... application runs ...
  │
  └── Scope closes (shutdown or error)
        │
        ├── Release: nc.drain()
        │     ├── Flush pending publishes
        │     ├── Unsubscribe from all subjects
        │     ├── Wait for in-flight messages to complete
        │     └── Close TCP connection
        │
        └── Connection released
```

### TSG.11.10.3 Reconnection Strategy

The NATS client library (`nats.ws` for WebView, `nats` for Node.js) provides
built-in reconnection with configurable parameters:

**Table TSG.11-12: Reconnection Parameters**

| Parameter | Default | Tsingou Setting | Rationale |
|-----------|---------|----------------|-----------|
| `reconnect` | `true` | `true` | Always attempt reconnection |
| `maxReconnectAttempts` | 10 | `-1` (unlimited) | Desktop apps should reconnect indefinitely |
| `reconnectTimeWait` | 2000ms | 2000ms | Base reconnection interval |
| `reconnectJitter` | 100ms | 100ms | Jitter to prevent thundering herd |
| `reconnectJitterTLS` | 1000ms | 1000ms | Higher jitter for TLS connections |
| `pingInterval` | 120000ms | 30000ms | More frequent pings for health detection |
| `maxPingOut` | 2 | 3 | Allow 3 missed pings before disconnect |

### TSG.11.10.4 Connection State Machine

```
                    ┌───────────────┐
                    │  DISCONNECTED │
                    └───────┬───────┘
                            │ connect()
                            ▼
                    ┌───────────────┐
              ┌────►│  CONNECTING   │
              │     └───────┬───────┘
              │             │ INFO received
              │             ▼
              │     ┌───────────────┐
              │     │   CONNECTED   │◄─── reconnected
              │     └───────┬───────┘
              │             │ connection lost
              │             ▼
              │     ┌───────────────┐
              │     │ RECONNECTING  │──── timeout ───┐
              │     └───────┬───────┘                │
              │             │ reconnected            ▼
              └─────────────┘                ┌───────────────┐
                                             │    CLOSED     │
                                             └───────────────┘
                                                     │
                                                     │ drain complete
                                                     ▼
                                             ┌───────────────┐
                                             │   DRAINED     │
                                             └───────────────┘
```

### TSG.11.10.5 Health Heartbeat

The NatsClient service publishes health status to an effect-atom for UI
consumption:

```typescript
// Connection health atom
export const connectionHealthAtom = Atom.make<NatsConnectionHealth>({
  status: 'disconnected',
  server: null,
  rtt: null,
  reconnectCount: 0,
  lastError: null,
  connectedAt: null,
})

// Health update on connection events
nc.on('connect', () => {
  Atom.set(connectionHealthAtom, {
    status: 'connected',
    server: nc.getServer(),
    rtt: null,
    reconnectCount: 0,
    lastError: null,
    connectedAt: new Date(),
  })
})

nc.on('reconnect', () => {
  const current = Atom.unsafeGet(connectionHealthAtom)
  Atom.set(connectionHealthAtom, {
    ...current,
    status: 'connected',
    reconnectCount: current.reconnectCount + 1,
  })
})

nc.on('disconnect', () => {
  Atom.set(connectionHealthAtom, (prev) => ({
    ...prev,
    status: 'reconnecting',
  }))
})
```

### TSG.11.10.6 $SYS Monitoring Integration

The NATS server publishes monitoring data on the `$SYS` account subjects:

| Subject | Data | Frequency |
|---------|------|-----------|
| `$SYS.SERVER.ACCOUNT.{id}.CONNS` | Connection count per account | 1s |
| `$SYS.SERVER.ACCOUNT.{id}.LEAFNODES` | Leaf node count per account | 1s |
| `$SYS.REQ.SERVER.PING` | Server ping (request/reply) | On demand |
| `$SYS.ACCOUNT.{id}.SERVER.CONNS` | Connection details | On demand |

Tsingou subscribes to `$SYS` subjects for server health monitoring:

```typescript
// Server health atom (updated from $SYS)
export const serverHealthAtom = Atom.make<NatsServerHealth>({
  connections: 0,
  leafNodes: 0,
  jetstreamEnabled: false,
  memoryBytes: 0,
  cpuPercent: 0,
})
```

---

## TSG.11.11 Multi-Tenant Isolation

### TSG.11.11.1 NATS Account Model

NATS accounts provide namespace isolation for multi-tenant deployments. Each
account has its own subject namespace, JetStream resources, and user permissions.

### TSG.11.11.2 Tsingou Account Architecture

**Table TSG.11-13: NATS Account Architecture**

| Account | Purpose | Users | Subject Access | JetStream |
|---------|---------|-------|---------------|-----------|
| `tsingou-system` | Platform infrastructure | Core services, AdapterManager | `tsingou.>` (full access) | All streams, all KV |
| `tsingou-operator` | Analyst workstation | Human operators, UI | `tsingou.signal.>` (read), `tsingou.control.>` (pub) | Read-only on signal streams |
| `tsingou-sidecar` | Sidecar processes | SDR bridge, GNU Radio, serial bridge | `tsingou.signal.{kind}.>` (pub), `tsingou.sidecar.{name}.>` (pub) | Publish to signal streams only |
| `tsingou-partner` | External partner feeds | Partner NATS clients | `tsingou.taxii.partner.>` (pub/sub) | Limited JetStream access |
| `$SYS` | Server monitoring | Internal | `$SYS.>` (read) | None |

### TSG.11.11.3 User-Level Permissions

Within each account, users have granular subject permissions:

```typescript
// User permission schema
const NatsUserPermission = Schema.Struct({
  publish: Schema.Struct({
    allow: Schema.Array(Schema.String),
    deny: Schema.optional(Schema.Array(Schema.String)),
  }),
  subscribe: Schema.Struct({
    allow: Schema.Array(Schema.String),
    deny: Schema.optional(Schema.Array(Schema.String)),
  }),
  allow_responses: Schema.optional(Schema.Boolean),
})
```

**Example: SDR sidecar user permissions:**

```json
{
  "publish": {
    "allow": [
      "tsingou.signal.sdr.>",
      "tsingou.sidecar.sdr-bridge.>"
    ],
    "deny": [
      "tsingou.control.>",
      "tsingou.audit.>"
    ]
  },
  "subscribe": {
    "allow": [
      "tsingou.control.sidecar.sdr-bridge.>",
      "_INBOX.>"
    ]
  },
  "allow_responses": true
}
```

### TSG.11.11.4 Subject Export/Import Between Accounts

Accounts communicate through explicit subject exports and imports:

```
Account: tsingou-sidecar
  │
  ├── exports: tsingou.signal.sdr.> (to tsingou-system)
  │
  └── imports: tsingou.control.sidecar.> (from tsingou-system)

Account: tsingou-system
  │
  ├── imports: tsingou.signal.sdr.> (from tsingou-sidecar)
  │
  └── exports: tsingou.control.sidecar.> (to tsingou-sidecar)
```

This model ensures that a compromised sidecar cannot access or modify system-level
subjects (audit, session, schema) even if it gains full access to its own account.

### TSG.11.11.5 Single-Host vs. Multi-Host Isolation

| Deployment | Account Isolation | Authentication | Rationale |
|-----------|------------------|---------------|-----------|
| Single laptop | None (single account) | None (localhost only) | Minimal overhead |
| Field station | 2 accounts (system + sidecar) | NKey | Sidecar isolation |
| CEMA cell | 4 accounts (full model) | NKey + JWT | Multi-operator security |
| Multi-organization | Per-organization accounts | NKey + JWT + mTLS | Full isolation |

---

## TSG.11.12 Monitoring and Observability

### TSG.11.12.1 $SYS Subjects for Server Stats

The NATS server exposes operational statistics on the `$SYS` account:

**Table TSG.11-14: $SYS Monitoring Subjects**

| Subject | Payload | Update Frequency |
|---------|---------|-----------------|
| `$SYS.SERVER.{id}.STATSZ` | Server statistics (connections, messages, bytes) | On request |
| `$SYS.SERVER.{id}.VARZ` | Server configuration variables | On request |
| `$SYS.SERVER.{id}.CONNZ` | Active connections detail | On request |
| `$SYS.SERVER.{id}.ROUTEZ` | Cluster route information | On request |
| `$SYS.SERVER.{id}.GATEWAYZ` | Gateway connections | On request |
| `$SYS.SERVER.{id}.LEAFZ` | Leaf node connections | On request |
| `$SYS.SERVER.{id}.JSZ` | JetStream statistics | On request |
| `$SYS.ACCOUNT.{id}.CONNS` | Account connection events | Real-time |

### TSG.11.12.2 JetStream Advisory Subjects

JetStream publishes advisory messages for significant events:

**Table TSG.11-15: JetStream Advisory Subjects**

| Subject | Event | Severity |
|---------|-------|----------|
| `$JS.EVENT.ADVISORY.API` | JetStream API calls | Info |
| `$JS.EVENT.ADVISORY.STREAM.CREATED.{stream}` | Stream created | Info |
| `$JS.EVENT.ADVISORY.STREAM.DELETED.{stream}` | Stream deleted | Warning |
| `$JS.EVENT.ADVISORY.STREAM.UPDATED.{stream}` | Stream configuration updated | Info |
| `$JS.EVENT.ADVISORY.CONSUMER.CREATED.{stream}.{consumer}` | Consumer created | Info |
| `$JS.EVENT.ADVISORY.CONSUMER.DELETED.{stream}.{consumer}` | Consumer deleted | Warning |
| `$JS.EVENT.ADVISORY.CONSUMER.MSG_TERMINATED.{stream}.{consumer}` | Message exceeded max deliveries | Error |
| `$JS.EVENT.METRIC.CONSUMER.ACK.{stream}.{consumer}` | Consumer acknowledgement metrics | Info |

### TSG.11.12.3 Health Atoms

Tsingou maintains effect-atom instances for NATS health monitoring. React
components subscribe to these atoms via `useAtomValue()` for real-time
dashboard rendering:

**Table TSG.11-16: NATS Health Atoms**

| Atom | Type | Updated By | UI Consumer |
|------|------|-----------|-------------|
| `connectionHealthAtom` | `NatsConnectionHealth` | NATS client events | Connection status badge |
| `serverHealthAtom` | `NatsServerHealth` | $SYS polling (5s interval) | Server health panel |
| `streamHealthAtom` | `Map<string, StreamHealth>` | JetStream API polling (10s) | Stream status table |
| `consumerHealthAtom` | `Map<string, ConsumerHealth>` | JetStream API polling (10s) | Consumer status table |
| `leafNodeHealthAtom` | `Array<LeafNodeHealth>` | $SYS.LEAFZ polling (10s) | Leaf node topology view |

### TSG.11.12.4 Stream Health Schema

```typescript
const StreamHealth = Schema.Struct({
  name: Schema.String,
  state: Schema.Struct({
    messages: Schema.Number,
    bytes: Schema.Number,
    firstSeq: Schema.Number,
    lastSeq: Schema.Number,
    consumerCount: Schema.Number,
  }),
  config: Schema.Struct({
    subjects: Schema.Array(Schema.String),
    retention: Schema.Literal('limits', 'interest', 'workqueue'),
    maxAge: Schema.Number,
    maxBytes: Schema.Number,
    storage: Schema.Literal('file', 'memory'),
    replicas: Schema.Number,
  }),
  healthy: Schema.Boolean,
})
```

### TSG.11.12.5 Tsingou Telemetry Subjects

In addition to NATS-native monitoring, Tsingou publishes its own telemetry:

| Subject | Payload | Frequency | Publisher |
|---------|---------|-----------|-----------|
| `tsingou.telemetry.adapter.{id}.health` | AdapterHealth | 500ms | AdapterManager aggregation fiber |
| `tsingou.telemetry.pipeline.health` | PipelineHealth | 1s | TsingouFlow service |
| `tsingou.telemetry.pipeline.throughput` | `{ signalsPerSecond, totalProcessed }` | 5s | TsingouFlow service |
| `tsingou.telemetry.system.resources` | `{ cpuPercent, memoryMb, diskMb }` | 10s | System monitor |
| `tsingou.telemetry.nats.connection` | NatsConnectionHealth | On change | NatsClient |

---

## TSG.11.13 Security

### TSG.11.13.1 Transport Encryption

All NATS connections MUST use TLS for transport encryption in production
deployments. The embedded (localhost-only) deployment MAY use unencrypted
connections.

**Table TSG.11-17: TLS Configuration Requirements**

| Deployment | TLS Required | TLS Version | Certificate Source |
|-----------|-------------|-------------|-------------------|
| Embedded (localhost) | NOT REQUIRED | N/A | N/A |
| Leaf node to hub | REQUIRED | TLS 1.3 | CA-signed or self-signed with pinned CA |
| Client to cluster | REQUIRED | TLS 1.3 | CA-signed |
| WebSocket (WSS) | REQUIRED | TLS 1.3 | CA-signed (browser requires valid cert) |
| Inter-cluster route | REQUIRED | TLS 1.3 | CA-signed, mutual TLS |

### TSG.11.13.2 NKey Authentication

NATS NKeys use Ed25519 key pairs for authentication. Each client presents its
public key; the server verifies using a challenge-response protocol. No secrets
are transmitted over the wire.

**NKey types:**

| Key Type | Prefix | Purpose |
|----------|--------|---------|
| Operator | `O` | Top-level authority; signs account JWTs |
| Account | `A` | Account authority; signs user JWTs |
| User | `U` | Client authentication |
| Server | `N` | Server identity |
| Cluster | `C` | Cluster identity |

**NKey generation (via `nsc` tool):**

```bash
# Generate operator key pair
nsc add operator --name tsingou-ops

# Generate account
nsc add account --name tsingou-system

# Generate user for core service
nsc add user --account tsingou-system --name core-service

# Generate user for SDR sidecar
nsc add user --account tsingou-sidecar --name sdr-bridge-1
```

### TSG.11.13.3 JWT-Based Authorization

NATS JWTs encode authorization claims (accounts, users, permissions). JWTs are
signed by the issuing authority (operator or account NKey) and verified by the
NATS server without requiring the server to hold the signing key.

**JWT claim hierarchy:**

```
Operator JWT
  │  Signs: Account JWTs
  │  Contains: Operator NKey, system account
  │
  ├── Account JWT (tsingou-system)
  │   │  Signs: User JWTs
  │   │  Contains: JetStream limits, subject permissions, exports/imports
  │   │
  │   ├── User JWT (core-service)
  │   │   Contains: publish/subscribe permissions
  │   │
  │   └── User JWT (adapter-manager)
  │       Contains: publish/subscribe permissions
  │
  ├── Account JWT (tsingou-sidecar)
  │   │
  │   ├── User JWT (sdr-bridge-1)
  │   │   Contains: limited publish/subscribe
  │   │
  │   └── User JWT (serial-bridge-1)
  │       Contains: limited publish/subscribe
  │
  └── Account JWT (tsingou-partner)
      │
      └── User JWT (partner-alpha)
          Contains: restricted TAXII subject access
```

### TSG.11.13.4 Credential Rotation

Credentials SHOULD be rotated on the following schedule:

| Credential Type | Rotation Interval | Mechanism |
|----------------|-------------------|-----------|
| User NKey seed | 90 days | Generate new seed, reissue JWT |
| Account JWT | 365 days | Reissue with updated claims |
| TLS certificate | 90 days | CA renewal, distribute new cert |
| Leaf node credentials | 90 days | Regenerate via `nsc` |

Rotation MUST be performed without service interruption. NATS supports online
credential reloading:

```bash
# Signal NATS server to reload TLS certificates
nats-server --signal reload

# Or via management API
nats server request reload
```

### TSG.11.13.5 Security Hardening Checklist

Implementations MUST verify the following for production deployments:

| Item | Requirement | Verification |
|------|-------------|-------------|
| TLS for all external connections | MUST | `nats server check connection --tls` |
| NKey authentication for all clients | MUST | No anonymous connections in CONNZ output |
| Account isolation for sidecars | SHOULD | Separate accounts in VARZ output |
| No wildcard publish permissions | MUST | User JWTs specify explicit publish subjects |
| Audit logging enabled | SHOULD | TSINGOU_AUDIT stream receiving events |
| JetStream encryption at rest | MAY | `jetstream.cipher` configuration |
| Rate limiting for partner accounts | SHOULD | Account-level `max_payload`, `max_connections` |

---

## TSG.11.14 Performance Considerations

### TSG.11.14.1 Message Throughput Benchmarks

**Table TSG.11-18: Expected NATS Throughput (Embedded, Single Host)**

| Payload Size | Core NATS Pub/Sub | JetStream (File) | JetStream (Memory) | Notes |
|-------------|------------------|------------------|-------------------|-------|
| 100 bytes | ~5M msgs/s | ~1M msgs/s | ~2M msgs/s | Metadata, control messages |
| 1 KB | ~2M msgs/s | ~500K msgs/s | ~1M msgs/s | Typical BaseSignal payload |
| 10 KB | ~500K msgs/s | ~200K msgs/s | ~400K msgs/s | Large signal payloads |
| 100 KB | ~100K msgs/s | ~50K msgs/s | ~80K msgs/s | SDR FFT batches |
| 1 MB | ~10K msgs/s | ~5K msgs/s | ~8K msgs/s | STIX bundles, IQ chunks |

These are theoretical maximums for a single NATS server on modern hardware
(8-core, 32 GB RAM, NVMe SSD). Actual throughput depends on payload encoding,
client library overhead, and application processing time.

### TSG.11.14.2 Latency Targets

**Table TSG.11-19: Latency Targets**

| Path | Target | Measured At |
|------|--------|-------------|
| Adapter push to SignalQueue | < 1ms | `Queue.offer` return |
| NATS pub to sub (localhost) | < 0.5ms | Wire-to-wire |
| NATS pub to JetStream ack | < 2ms | Publish ack return (file storage) |
| NATS pub to JetStream ack | < 0.5ms | Publish ack return (memory storage) |
| KV get | < 1ms | Key lookup return |
| KV put | < 2ms | Write acknowledgement |
| Leaf node hub to leaf | < 5ms + network RTT | Cross-host wire-to-wire |
| Full pipeline (adapter to atom) | < 10ms | Signal creation to atom write |

### TSG.11.14.3 Buffer Sizing

**Table TSG.11-20: Buffer Size Recommendations**

| Component | Buffer | Size | Memory Impact | Tuning Knob |
|-----------|--------|------|---------------|-------------|
| NATS client write buffer | Per-connection | 32 KB | N * 32 KB (N connections) | `write_buffer_size` |
| NATS client read buffer | Per-connection | 32 KB | N * 32 KB | `read_buffer_size` |
| JetStream in-memory cache | Per-stream | 64 MB max | Sum of all stream caches | `max_mem` |
| JetStream file store | Per-stream | Disk-based | `max_file` per stream | Stream `max_bytes` |
| Effect Queue (SignalQueue) | Application | 4096 signals | ~4 MB (1 KB/signal) | `Queue.bounded` capacity |
| Effect Queue (OutputBridge) | Application | 1024 signals | ~1 MB | `Queue.bounded` capacity |

### TSG.11.14.4 Batch Publishing for High-Rate Sources

For SDR and serial sources producing > 1000 signals/second, batch publishing
reduces per-message overhead:

```typescript
// Batch publish pattern for high-rate sources
const BATCH_SIZE = 64
const BATCH_TIMEOUT_MS = 50

const batchPublish = (signals: BaseSignal[]) =>
  Effect.gen(function* () {
    const batched: BaseSignal[][] = []
    for (let i = 0; i < signals.length; i += BATCH_SIZE) {
      batched.push(signals.slice(i, i + BATCH_SIZE))
    }

    yield* Effect.forEach(batched, (batch) =>
      nats.publish(
        `tsingou.signal.sdr.batch.${deviceId}`,
        JSON.stringify(batch),
        {
          headers: {
            'Nats-Msg-Id': `batch-${Date.now()}-${batchSeq++}`,
            'Tsingou-Batch-Size': String(batch.length),
          },
        },
      ),
    )
  })
```

**Batch sizing trade-offs:**

| Batch Size | Throughput | Latency | Memory | Recommendation |
|-----------|-----------|---------|--------|----------------|
| 1 (no batch) | Baseline | Lowest | Lowest | < 100 signals/s |
| 16 | ~4x | +2ms | ~16 KB | 100-1000 signals/s |
| 64 | ~10x | +10ms | ~64 KB | 1000-10000 signals/s |
| 256 | ~20x | +50ms | ~256 KB | > 10000 signals/s |
| 1024 | ~30x | +200ms | ~1 MB | Bulk replay only |

### TSG.11.14.5 Message Size Limits

| Limit | Default | Tsingou Setting | Rationale |
|-------|---------|----------------|-----------|
| `max_payload` | 1 MB | 8 MB | Accommodate SDR FFT batches |
| `max_pending` | 64 MB | 128 MB | Higher burst tolerance |
| `max_connections` | 65536 | 1024 | Desktop deployment limit |
| `max_subscriptions` | Unlimited | 10000 | Prevent resource exhaustion |

Payloads exceeding `max_payload` MUST be stored in Object Store (TSG.11.6) with
a reference published as a standard-sized NATS message.

---

## TSG.11.15 Normative Requirements Summary

### TSG.11.15.1 MUST Requirements

**Table TSG.11-21: MUST Requirements**

| ID | Requirement | Source |
|----|------------|--------|
| TSG.11-R1 | All Tsingou NATS subjects MUST begin with the `tsingou.` prefix | TSG.11.3.3 |
| TSG.11-R2 | Subject tokens MUST NOT contain colons, spaces, or null bytes | TSG.11.3.3 |
| TSG.11-R3 | NATS KV keys MUST NOT contain colons (keys become NATS subjects internally) | TSG.11.5.3 |
| TSG.11-R4 | JetStream consumers for signal processing MUST use explicit acknowledgement | TSG.11.4.6 |
| TSG.11-R5 | Messages MUST NOT be acknowledged before successful processing | TSG.11.4.6 |
| TSG.11-R6 | The SignalQueue MUST be bounded with configurable capacity (default 4096) | TSG.11.7.2 |
| TSG.11-R7 | Backpressure MUST propagate upstream through fiber suspension | TSG.11.7.3 |
| TSG.11-R8 | All external NATS connections MUST use TLS in production deployments | TSG.11.13.1 |
| TSG.11-R9 | NKey authentication MUST be used for all clients in multi-host deployments | TSG.11.13.2 |
| TSG.11-R10 | Payloads exceeding `max_payload` MUST use Object Store with reference messages | TSG.11.14.5 |
| TSG.11-R11 | NATS client connections MUST use the Effect scoped lifecycle (acquireRelease) | TSG.11.10.1 |
| TSG.11-R12 | Connection finalization MUST call `nc.drain()` to flush pending operations | TSG.11.10.2 |
| TSG.11-R13 | JetStream stream `TSINGOU_SIGNALS` MUST use Limits retention policy | TSG.11.4.3 |
| TSG.11-R14 | TAXII export bridge MUST acknowledge JetStream messages only after successful TAXII ingest | TSG.11.8.3 |
| TSG.11-R15 | Leaf node connections MUST use TLS and credential-based authentication | TSG.11.9.4 |
| TSG.11-R16 | Multi-organization leaf nodes MUST be isolated using NATS accounts | TSG.11.9.4 |
| TSG.11-R17 | The `>` wildcard MUST only appear as the last token in a subject pattern | TSG.11.2.4 |
| TSG.11-R18 | Subject tokens MUST use lowercase alphanumeric characters and hyphens | TSG.11.2.5 |

### TSG.11.15.2 SHOULD Requirements

**Table TSG.11-22: SHOULD Requirements**

| ID | Requirement | Source |
|----|------------|--------|
| TSG.11-S1 | Implementations SHOULD use push-based synchronization for partner TAXII feeds | TSG.11.8.5 |
| TSG.11-S2 | Subject filtering SHOULD be configured on leaf nodes for bandwidth-constrained links | TSG.11.9.3 |
| TSG.11-S3 | Health atoms SHOULD be updated within 500ms of a NATS connection state change | TSG.11.10.5 |
| TSG.11-S4 | Credential rotation SHOULD occur every 90 days for user NKeys and TLS certificates | TSG.11.13.4 |
| TSG.11-S5 | High-rate sources (> 1000 signals/s) SHOULD use batch publishing | TSG.11.14.4 |
| TSG.11-S6 | Field deployments SHOULD use 3-node NATS clusters for fault tolerance | TSG.11.9.5 |
| TSG.11-S7 | JetStream deduplication window SHOULD be set to 5 minutes | TSG.11.4.7 |
| TSG.11-S8 | KV bucket `tsingou-schemas` SHOULD maintain 5 versions of history per key | TSG.11.5.7 |
| TSG.11-S9 | Audit logging SHOULD be enabled for all configuration changes | TSG.11.13.5 |
| TSG.11-S10 | Sidecar accounts SHOULD deny publish access to control and audit subjects | TSG.11.11.3 |

### TSG.11.15.3 MAY Requirements

**Table TSG.11-23: MAY Requirements**

| ID | Requirement | Source |
|----|------------|--------|
| TSG.11-M1 | Embedded deployments MAY use unencrypted NATS connections (localhost only) | TSG.11.13.1 |
| TSG.11-M2 | Single-host deployments MAY omit account isolation (single account) | TSG.11.11.5 |
| TSG.11-M3 | Implementations MAY use memory-based JetStream storage for telemetry streams | TSG.11.4.2 |
| TSG.11-M4 | Object Store MAY be used for large STIX bundles instead of inline payloads | TSG.11.6.1 |
| TSG.11-M5 | JetStream encryption at rest MAY be enabled for sensitive deployments | TSG.11.13.5 |
| TSG.11-M6 | Implementations MAY adjust backpressure queue capacities based on deployment profile | TSG.11.7.5 |

---

## TSG.11.16 References

### Normative References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |

### Architecture Decision Records

| Key | Reference |
|-----|-----------|
| [ADR-003] | Prime, Val. "NATS as Universal Fabric." ADR-003, 2026-02-18. `docs/tsingou/adr/ADR-003-nats-as-universal-fabric.md` |
| [ADR-002] | Prime, Val. "Source Adapter Contract — Effect.Service with Push API." ADR-002, 2026-02-18. `docs/tsingou/adr/ADR-002-source-adapter-contract.md` |
| [ADR-011] | Prime, Val. "SDR Integration Architecture." ADR-011, 2026-02-18. `docs/tsingou/adr/ADR-011-sdr-integration.md` |

### NATS Documentation

| Key | Reference |
|-----|-----------|
| [NATS-CORE] | Synadia. "NATS Core — Publish/Subscribe." https://docs.nats.io/nats-concepts/core-nats/pubsub |
| [NATS-JETSTREAM] | Synadia. "NATS JetStream." https://docs.nats.io/nats-concepts/jetstream |
| [NATS-KV] | Synadia. "NATS Key/Value Store." https://docs.nats.io/nats-concepts/jetstream/key-value-store |
| [NATS-OBJSTORE] | Synadia. "NATS Object Store." https://docs.nats.io/nats-concepts/jetstream/obj_store |
| [NATS-LEAF] | Synadia. "NATS Leaf Nodes." https://docs.nats.io/running-a-nats-service/configuration/leafnodes |
| [NATS-CLUSTER] | Synadia. "NATS Clustering." https://docs.nats.io/running-a-nats-service/configuration/clustering |
| [NATS-ACCOUNTS] | Synadia. "NATS Multi-Tenancy with Accounts." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/accounts |
| [NATS-NKEY] | Synadia. "NATS NKey Authentication." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/nkey_auth |
| [NATS-JWT] | Synadia. "NATS JWT Authentication." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/jwt |
| [NATS-TLS] | Synadia. "NATS TLS Configuration." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/tls |
| [NATS-MONITORING] | Synadia. "NATS Monitoring." https://docs.nats.io/running-a-nats-service/configuration/monitoring |
| [NATS-SYS] | Synadia. "NATS System Events." https://docs.nats.io/running-a-nats-service/configuration/sys_accounts |
| [NATS-SERVER] | Synadia. "NATS Server." https://github.com/nats-io/nats-server |

### Effect-TS

| Key | Reference |
|-----|-----------|
| [EFFECT] | Effect-TS. "Effect: A TypeScript library for building production-grade applications." https://effect.website |
| [EFFECT-SERVICE] | Effect-TS. "Effect.Service API." https://effect.website/docs/guides/context-management/services |
| [EFFECT-SCOPE] | Effect-TS. "Scope and Resource Management." https://effect.website/docs/guides/resource-management/scope |
| [EFFECT-QUEUE] | Effect-TS. "Queue — Bounded and Unbounded." https://effect.website/docs/guides/concurrency/queues |
| [EFFECT-SCHEMA] | Effect-TS. "@effect/schema — Schema validation and transformation." https://effect.website/docs/guides/schema/introduction |
| [EFFECT-ATOM] | Tim Smart. "effect-atom — Reactive State for Effect." https://github.com/tim-smart/effect-atom |

### Standards

| Key | Reference |
|-----|-----------|
| [STIX-2.1] | OASIS CTI TC. "STIX Version 2.1." https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html |
| [TAXII-2.1] | OASIS CTI TC. "TAXII Version 2.1." https://docs.oasis-open.org/cti/taxii/v2.1/taxii-v2.1.html |
| [SIGMF] | The SigMF Specification. "Signal Metadata Format." https://sigmf.org |
| [RFC8446] | Rescorla, E., "The Transport Layer Security (TLS) Protocol Version 1.3", RFC 8446, August 2018 |

### Cross-Referenced RFC Sections

| Key | Reference |
|-----|-----------|
| [TSG.6] | Architecture Overview — `rfc-section-architecture-overview.md` |
| [TSG.7] | Signal Pipeline & d2ts — `rfc-section-signal-pipeline.md` |
| [TSG.8] | BaseSignal Schema — `rfc-section-base-signal-schema.md` |
| [TSG.9] | Source Adapter Contract — `rfc-section-source-adapters.md` |
| [TSG.10] | State Management — `rfc-section-state-management.md` |
| [TSG.12] | STIX 2.1 Data Model — `rfc-section-stix-data-model.md` |
| [TSG.13] | BaseSignal-STIX Codec — `rfc-section-stix-codec.md` |
| [TSG.14] | TAXII 2.1 Transport — `rfc-section-taxii-transport.md` |
| [TSG.32] | Effect-TS Architecture — `rfc-section-effect-architecture.md` |
| [TSG.34] | Deployment Topology — `rfc-section-deployment-topology.md` |
| [TSG.35] | Error Handling — `rfc-section-error-handling.md` |
| [TSG.36] | EW Doctrine — `rfc-section-ew-doctrine.md` |

### Implementation References

| File | Purpose |
|------|---------|
| `src/lib/tsingou-flow/adapters/NatsAdapter.ts` | NatsSourceAdapter Effect.Service implementation |
| `src/lib/tsingou-flow/services/SchemaRegistry.ts` | TsingouSchemaRegistry with NATS KV backing |
| `src/lib/holonet/nats/pubsub.ts` | Holonet NatsPubSubService (typed pub/sub) |
| `src/lib/holonet/nats/stream.ts` | Holonet NatsStreamService (JetStream) |
| `src/lib/holonet/nats/kv.ts` | Holonet NatsKVService (KV Store) |
| `src/lib/holonet/core/schema/SchemaRegistry.ts` | Holonet in-memory schema registry |

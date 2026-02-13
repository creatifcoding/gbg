# TMNL Streams — Ontological Foundations

A formal treatment of the streams library through the lens of Basic Formal Ontology (BFO).

---

## Why Ontology?

Software abstractions often collapse under complexity because they lack rigorous categorical foundations. BFO provides:

1. **Precise classification** — Is this a thing or a process? An instance or a type?
2. **Principled composition** — How do parts relate to wholes?
3. **Change semantics** — What persists vs. what occurs?
4. **Dependency analysis** — What can exist independently?

This document maps TMNL Streams constructs to BFO categories, clarifying their nature and relationships.

---

## BFO Categories (Relevant Subset)

```
Entity
├── Continuant (exists in full at any moment)
│   ├── Independent Continuant (can exist on its own)
│   │   ├── Material Entity (has matter)
│   │   └── Immaterial Entity (spatial region, boundary)
│   └── Dependent Continuant (requires bearer)
│       ├── Specifically Dependent Continuant (one bearer)
│       │   ├── Quality (measurable property)
│       │   └── Realizable Entity (disposition, role, function)
│       └── Generically Dependent Continuant (can transfer bearers)
│           └── Information Content Entity (data, schema, protocol)
│
└── Occurrent (unfolds through time)
    ├── Process (has temporal parts)
    └── Temporal Region (spans of time)
```

---

## Construct Mappings

### Feed : Process

A Feed is an **Occurrent** — specifically, a **Process**.

**Why Process?**
- A Feed *unfolds through time* — it has a start, middle, and end
- It has *temporal parts* — each emission is a subprocess
- It *occurs in* a bearer (the runtime environment)
- It can be *interrupted* mid-execution

**BFO Properties:**
| Property | Feed Manifestation |
|----------|-------------------|
| Temporal extent | `startedAt` → `stoppedAt` |
| Temporal parts | Individual emissions (`lastEvent`) |
| Participant | The producer effect |
| Realizes | The `FeedConfig` disposition |

**Lifecycle as Process Phases:**
```
Feed Process
├── idle phase (potential, not yet actualized)
├── running phase (ongoing process)
│   ├── emission₁ (subprocess)
│   ├── emission₂ (subprocess)
│   └── ...
└── stopped phase (completed process)
```

**Code Alignment:**
```typescript
// FeedStatus maps to process phases
type FeedStatus = "idle" | "running" | "paused" | "stopped"

// FeedState captures process qualities at a moment
interface FeedState<A, E> {
  status: FeedStatus           // Current phase
  startedAt: Option<number>    // Process start boundary
  eventCount: number           // Count of subprocesses
  lastEvent: Option<A>         // Most recent subprocess output
}
```

---

### FeedConfig : Generically Dependent Continuant (Disposition)

`FeedConfig` is a **Realizable Entity** — specifically, a **Disposition**.

**Why Disposition?**
- It describes what *can happen* under certain conditions
- It's *realized* when a Feed starts running
- It can be *transferred* (same config, new Feed instance)
- It doesn't exist on its own — requires a bearer (Feed instance)

**BFO Properties:**
| Property | FeedConfig Manifestation |
|----------|-------------------------|
| Realizes in | Feed.start() → running process |
| Bearer | Feed instance |
| Transferable | Yes (same config, multiple Feeds) |

**Code Alignment:**
```typescript
interface FeedConfig<A, E, R> {
  id: string          // Identity for the disposition
  name: string        // Label
  producer: Effect    // What to realize
  interval?: Duration // Temporal pattern for realization
  onConnect?: Effect  // Boundary behavior (start)
  onDisconnect?: Effect // Boundary behavior (end)
}
```

---

### FeedsManager : Role-Bearing Service

`FeedsManager` is an **Independent Continuant** that bears **Roles**.

**Why Role-Bearing?**
- It persists across Feed lifetimes (not a process)
- It has *capabilities* (register, start, stop) — these are roles
- It maintains *relationships* to Feeds (the registry)
- It's a *site* where processes occur

**BFO Roles:**
| Role | Capability |
|------|------------|
| Registrar | `register()`, `unregister()` |
| Controller | `start()`, `stop()`, `signal()` |
| Observer | `getStatuses()`, `subscribeEvents()` |
| Coordinator | `startAll()`, `stopAll()` |

**As a Site:**
The FeedsManager is also a **Site** — a special kind of immaterial entity where processes occur. Feeds don't float in void; they occur *in* the manager's context.

**Code Alignment:**
```typescript
interface FeedsManagerService {
  // Registry (Site function)
  register: <A, E, R>(feed: Feed<A, E, R>) => Effect<FeedId<A>>

  // Control (Role realization)
  start: (id: string) => Effect<void>
  stop: (id: string) => Effect<void>

  // Observation (Quality exposure)
  getStatuses: () => Effect<HashMap<string, FeedStatus>>
  subscribeEvents: () => Effect<Queue.Dequeue<FeedManagerEvent>>
}
```

---

### Channel : Generically Dependent Continuant (Information Content Entity)

A Channel is a **Generically Dependent Continuant** — specifically, an **Information Content Entity**.

**Why GDC/ICE?**
- A Channel is *information about topology and protocol*
- It can be *copied, transmitted, stored* without loss
- It *depends on bearers* (the runtime, the data flowing through)
- Multiple *concretizations* can exist (same topology, different instances)

**BFO Properties:**
| Property | Channel Manifestation |
|----------|----------------------|
| About | Data flow topology |
| Concretized in | Runtime stream graph |
| Generic dependence | Can transfer between runtimes |
| Parts | Inlets, Outlets, Junctions, Wires |

**Topology as Part-Whole:**
```
Channel (whole)
├── Inlet (part) — input boundary
├── Outlet (part) — output boundary
├── Junction (part) — transformation site
└── Wire (part) — relational link
```

**Protocol as Disposition:**
The `ChannelProtocol` is itself a disposition within the Channel ICE:
- **Timeout** — disposition to fail on temporal boundary
- **CircuitBreaker** — disposition to isolate on failure pattern
- **Backpressure** — disposition to regulate on capacity boundary
- **Retry** — disposition to recover on transient failure

---

### Inlet / Outlet : Sites (Boundaries)

Inlets and Outlets are **Sites** — specifically, **Boundaries**.

**Why Boundary?**
- They're where data *enters* or *exits* the Channel
- They don't exist independently — they're boundaries *of* the Channel
- They're immaterial — no data "lives" at an inlet
- Processes occur *at* them (connection, disconnection)

**BFO Properties:**
| Property | Inlet/Outlet |
|----------|--------------|
| Boundary of | Channel |
| Site for | Connect/Disconnect events |
| Depends on | Channel (the bounded entity) |

---

### Junction : Site (Process Locus)

A Junction is a **Site** where transformation processes occur.

**Why Site?**
- Data flows *through* junctions
- Processes (filter, map, merge) occur *at* junctions
- The junction itself is not the process — it's where the process happens
- Multiple processes can occur at the same junction over time

**Junction Kinds as Process Types:**
| Kind | Process Type |
|------|--------------|
| `filter` | Selection process |
| `map` | Transformation process |
| `flatMap` | Expansion process |
| `merge` | Aggregation process |
| `partition` | Distribution process |
| `broadcast` | Replication process |
| `buffer` | Accumulation process |
| `throttle` | Regulation process |
| `debounce` | Stabilization process |
| `timeout` | Boundary enforcement |

---

### Wire : Relation (Specifically Dependent)

A Wire is a **Specifically Dependent Continuant** — it's a relation between topology components.

**Why SDC?**
- It depends on *both* endpoints (from, to)
- It doesn't transfer — it's specific to this topology
- It represents *connection*, not the data flowing through
- It can be active or inactive (relational quality)

**Code Alignment:**
```typescript
class Wire {
  id: WireId
  channelId: ChannelId
  from: InletId | JunctionId   // First relatum
  to: OutletId | JunctionId    // Second relatum
  active: boolean              // Relational quality
}
```

---

### ChannelCommand / ChannelEvent : Process Triggers & Records

Commands and Events are **Information Content Entities** about processes.

**Commands (Directive ICE):**
- *About* a process that *should* occur
- Carry *illocutionary force* (performative)
- Examples: OpenChannel, ConnectInlet, ResetCircuitBreaker

**Events (Descriptive ICE):**
- *About* a process that *did* occur
- Carry *record* (historical)
- Examples: ChannelOpened, InletConnected, TimeoutOccurred

**The Command-Event Duality:**
```
Command (directive) → Process occurs → Event (record)
    OpenChannel    →   opening...   →  ChannelOpened
```

---

### ChannelRequest / ChannelResponse : Correlated ICE Pairs

Request/Response are **Paired Information Content Entities** linked by correlation.

**Why Paired?**
- They're *about each other* — response is about the request
- The `correlationId` is a *relational identity*
- Together they form a *dialogue unit*

**BFO Alignment:**
| Entity | BFO Type | About |
|--------|----------|-------|
| Request | Directive ICE | Desired process |
| Response | Descriptive ICE | Process outcome |
| CorrelationId | Identity | The pairing relation |

---

## Composition Patterns

### Feed → FeedsManager (Participation)

Feeds *participate in* the FeedsManager's registry. This is a **participation** relation:
- The Feed (process) occurs in the Manager (site)
- The Manager provides context for the Feed
- Multiple Feeds can participate simultaneously

```
FeedsManager (site)
└── Feed₁ participates_in
└── Feed₂ participates_in
└── Feed₃ participates_in
```

### Feed → Channel (Connection)

Feeds *connect to* Channel Inlets. This is a **realizes** relation:
- The Feed realizes its disposition at the Inlet
- The Channel provides the topology context
- The connection is documented in `Inlet.sourceId`

```
Channel (ICE)
├── Inlet (boundary)
│   └── Feed (process) connected_at
```

### Channel → Channel (Composition)

Channels can compose via Outlet→Inlet wiring. This is **part-whole** aggregation:
- A super-Channel contains sub-Channels as parts
- Wires connect across Channel boundaries
- The whole topology is still a single GDC

---

## Temporal Semantics

### Process Boundaries

| Entity | Start Boundary | End Boundary |
|--------|---------------|--------------|
| Feed | `onConnect` fires | `onDisconnect` fires |
| Channel | `ChannelOpened` event | `ChannelClosed` event |
| Junction process | Data arrives | Data departs |

### Quality Change Over Time

Qualities of continuants change over time:
- `Feed.status` — quality that changes as process phases change
- `Outlet.subscriberCount` — quality that changes with subscriptions
- `CircuitBreakerConfig.state` — quality that changes with failures
- `ChannelMetrics.*` — qualities that change with data flow

---

## Summary Table

| Construct | BFO Category | Key Insight |
|-----------|--------------|-------------|
| Feed | Process | Unfolds through time, has temporal parts |
| FeedConfig | Disposition | Potential for process, realized on start |
| FeedsManager | Role-bearing Site | Where Feed processes occur |
| Channel | Information Content Entity | Transferable topology + protocol |
| Inlet/Outlet | Boundary (Site) | Where data enters/exits |
| Junction | Site | Where transformations occur |
| Wire | Specifically Dependent | Relation between topology parts |
| Command | Directive ICE | About process to occur |
| Event | Descriptive ICE | About process that occurred |
| Request/Response | Correlated ICE pair | Dialogue unit |

---

## Design Implications

### 1. Processes Are Not Stored, They Occur

Don't try to "save" a Feed. Save its configuration (disposition). The process unfolds anew each time.

### 2. Sites Enable Processes

The FeedsManager and Channel aren't doing work — they're *where* work happens. Design them as contexts, not actors.

### 3. Information Can Transfer

Channel topologies are GDCs — you can serialize them, send them across networks, instantiate them in new runtimes.

### 4. Boundaries Are Real

Inlets and Outlets aren't just labels — they're genuine ontological boundaries where system state changes.

### 5. Commands and Events Are Distinct

Don't conflate "OpenChannel" (command) with "ChannelOpened" (event). One is directive, one is descriptive.

---

## References

- [Basic Formal Ontology 2.0 Specification](https://basic-formal-ontology.org/)
- [BFO 2020](https://github.com/BFO-ontology/BFO-2020)
- [Information Artifact Ontology](http://www.obofoundry.org/ontology/iao.html)
- [Common Core Ontologies](https://github.com/CommonCoreOntology/CommonCoreOntologies)

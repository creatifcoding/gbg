# TSINGOU — System Specification

> **Version**: 0.1.0  
> **Date**: 2026-02-18  
> **Author**: Prime + Val (Vigilant Architecture Layer)  
> **Status**: Living document  

---

## 1. What Tsingou Is

**Tsingou is a unified, signal-driven, multi-layer SIGINT/OSINT analysis platform.**

It ingests signals from arbitrary sources — network feeds (HTTP, WebSocket, RSS, SSE), messaging fabrics (NATS, MQTT), hardware interfaces (serial, MIDI, OSC), and local data (file watch, database tails) — and processes them through a differential dataflow pipeline that supports incremental computation, cross-source correlation, temporal windowing, and anomaly detection.

Its output modality is audiovisual rendering across four composited layers:

| Layer | Technology | Z-Index | Purpose |
|-------|-----------|---------|---------|
| 3D Scene | React Three Fiber (R3F) | 0 | WebGL spatial visualization — network graphs, signal topology |
| Data Viz | visx (D3 composable) | 1 | SVG analytical overlays — timelines, heatmaps, distributions |
| 2D Canvas | p5 (via @p5-wrapper/react) | 2 | Generative signal representations — noise fields, particle flows |
| DOM | React + framer-motion | 3 | Text, controls, status panels, annotation layers |

**Tsingou is not a fork of nw_wrld.** It is a new system, designed from scratch using Effect-TS, that uses nw_wrld as architectural reference material — studying its patterns, learning from its decisions, and deliberately diverging where the SIGINT/OSINT mission demands it.

---

## 2. What Tsingou Is Not

- **Not an audiovisual sequencer.** nw_wrld is a creative tool for live visuals. Tsingou is an analysis platform. The rendering is output, not the product.
- **Not a fork.** No nw_wrld code is copied into Tsingou. nw_wrld is a submodule studied for reference — its architecture informs our design, but the implementation is entirely new.
- **Not Electron.** Tsingou runs on Tauri (Rust backend, WebView frontend). Single process + sidecar daemons, not 3 Electron processes.
- **Not Jotai.** State management uses effect-atom (`Atom.make()`) with the Atom-as-State pattern — services mutate atoms directly, React subscribes directly.
- **Not imperative.** Signal processing uses d2ts (differential dataflow) — declarative graph-based incremental computation, not `broadcast()` → `forEach` → `execute()`.

---

## 3. Relationship to nw_wrld

nw_wrld (`https://github.com/aagentah/nw_wrld`, GPL-3.0, v0.5.0-beta) is an Electron-based event-driven visual sequencer — 177 source files, ~32,700 LOC. It is included as a git submodule at `submodules/nw_wrld/` for reference.

### What We Study From nw_wrld

| nw_wrld Concept | What We Learn | How Tsingou Differs |
|----------------|---------------|---------------------|
| **InputManager** — 7-stage signal flow | Signal normalization is necessary before processing | We use d2ts ingest graph instead of imperative pipeline |
| **Module system** — sandboxed visual modules | Modules need isolation and a standard lifecycle contract | We use 4 rendering layers (R3F/visx/p5/DOM) instead of one canvas |
| **Channel dispatch** — method × channel × track routing | Signals need configurable routing to rendering targets | We use d2ts graph operators for routing, not manual dispatch |
| **IPC bridge** — cross-process messaging | Multi-process communication needs typed contracts | We use NATS (Holonet) instead of Electron IPC |
| **Dashboard** — React control surface | Users need a control surface for configuration | We build on the DOM rendering layer with framer-motion |
| **Workspace** — project directory structure | Projects need self-contained workspace isolation | We preserve the concept, adapt for Tauri fs scoping |
| **UserData schema** — tracks, modules, config, sets | Domain model for composition structure | We define all types as Effect.Schema, not raw interfaces |
| **Sequencer** — 16-step pattern grid | Temporal sequencing is a valid signal source | We treat it as one source among many, not the primary mode |

### What We Deliberately Reject

| nw_wrld Pattern | Why We Reject It |
|----------------|-----------------|
| Electron 3-process model | Overhead. Tauri single process + sidecars is leaner |
| `Projector` god-object (~2000 LOC) | Violates single responsibility. Services decompose it |
| Jotai for state | No Effect integration. effect-atom provides reactive state within Effect runtime |
| `ipcRenderer.invoke()` IPC | Electron-only. NATS is transport-agnostic |
| `try/catch` + `console.error` | No typed errors. Data.TaggedError provides typed recovery |
| `fs.writeFile` + `.backup` | No transactional writes. Effect.Scope + NATS KV persistence |
| Global mutable state in Projector | No isolation. Scoped Effect.Service instances |
| Module-level `require()` for hot reload | No sandbox security. Dynamic import with validation |

---

## 4. Mission: SIGINT/OSINT Analysis

### Primary Use Cases

1. **Multi-source signal monitoring** — Ingest from 8+ simultaneous sources (RSS feeds, WebSocket streams, HTTP APIs, NATS subjects, file tails, serial devices, MIDI controllers, OSC messages). Display signal flow in real-time across 4 rendering layers.

2. **Cross-source correlation** — d2ts `join` operator maintains state from both sides. Correlate HTTP API responses with RSS feed items. Match NATS events with file-watch changes. Enrich signals with metadata from secondary sources.

3. **Temporal windowing** — Custom `window(duration)` operator maintains sliding time windows. "Show me all signals from the last 5 minutes." "Alert when signal rate exceeds threshold over 30-second window."

4. **Retrospective analysis** — NATS JetStream stores signal history. Replay last 24h of signals through the same d2ts graph. Compare live patterns against historical baselines.

5. **Anomaly detection** — d2ts `iterate` operator for recursive refinement. Establish baseline signal patterns, detect deviations. Statistical operators compute rolling averages, standard deviations, z-scores.

6. **Live feed composition** — Add and remove signal sources at runtime (hot-plug). Adapt analysis view during a live investigation. No restart required.

### Signal Sources for SIGINT/OSINT

| Source | Adapter | Intelligence Value |
|--------|---------|-------------------|
| RSS/Atom feeds | `RssSourceAdapter` | News monitoring, blog tracking, threat intelligence feeds |
| HTTP APIs | `HttpSourceAdapter` (poll/SSE) | Social media APIs, threat intel APIs, geolocation services |
| WebSocket streams | `WebSocketSourceAdapter` | Real-time market data, chat monitoring, sensor streams |
| NATS subjects | `NatsSourceAdapter` | Internal telemetry, distributed sensor networks, message buses |
| File watch | `HolonetBridgeAdapter` | Log tailing, pcap analysis, database export monitoring |
| Serial | `HolonetBridgeAdapter` | SDR (software-defined radio) output, hardware sensors |
| MIDI | Stub (bridge-ready) | Control surface for analysis parameters |
| OSC | Stub (bridge-ready) | Sensor networks, IoT device telemetry |

---

## 5. Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Runtime** | Effect-TS | Service composition, typed errors, streams, scheduling, scoped resources |
| **State** | effect-atom (Atom-as-State) | Reactive state, React subscriptions, service-to-view bridge |
| **Pipeline** | d2ts (differential dataflow) | Incremental computation, joins, windowing, aggregation |
| **Transport** | NATS (Holonet) | Universal signal fabric, JetStream persistence, KV schema registry |
| **Shell** | Tauri v2 | Native window, fs scoping, system tray, plugin ecosystem |
| **Rendering** | R3F + visx + p5 + React/framer-motion | 4-layer composited visualization |
| **Schemas** | Effect.Schema | Runtime validation, encode/decode, JSON Schema generation |
| **Errors** | Data.TaggedError | 17 typed error classes, `catchTag`/`catchTags` recovery |
| **Animation** | framer-motion | Layout transitions, enter/exit, gesture support |

---

## 6. Architecture Summary

```
Signal Sources (8 adapter types)
    │
    ▼ push(signal) via SignalQueueTag
┌─────────────────────────────┐
│    Effect.Queue(4096)       │  ◄── Bounded, backpressure-aware
└─────────────┬───────────────┘
              │
              ▼ TsingouFlow drain loop
┌─────────────────────────────┐
│    d2ts Ingest Graph        │  ◄── Normalize, tag, version
│    (pure function stubs     │
│     → real D2 when wired)   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│    d2ts Derived Graph       │  ◄── Join, window, aggregate, topK
│    Custom operators:        │
│    window, throttle,        │
│    schema-validate          │
└─────────────┬───────────────┘
              │
              ▼ output() → Effect.Queue → consumer fiber
┌─────────────────────────────┐
│    OutputBridge              │  ◄── Batched write to atoms
│    → activeSignalsAtom      │
│    → derivedSignalCountAtom │
└─────────────┬───────────────┘
              │
              ▼ React subscribes via useAtomValue()
┌─────────────────────────────┐
│    4-Layer Rendering         │
│    z:0 R3F (WebGL 3D)       │
│    z:1 visx (SVG data viz)  │
│    z:2 p5 (Canvas 2D)       │
│    z:3 DOM (text/controls)  │
└─────────────────────────────┘
```

---

## 7. Package Structure

```
src/lib/tsingou-flow/          # @tmnl/tsingou-flow — 40 files, ~5,800 LOC
├── schemas/                    # 13 files — BaseSignal + 8 extensions + union + registry + adapter types
├── adapters/                   # 12 files — 8 adapters + types + errors + xml + barrel
├── services/                   # 4 files — AdapterManager, SchemaRegistry, OutputBridge, TsingouFlow
├── graph/                      # 5 files — version, multiset-helpers, ingest, derived, barrel
├── operators/                  # 4 files — window, throttle, schema-validate, barrel
└── index.ts                    # Master barrel — exports everything
```

### Layer Composition

```
TsingouFlowLive
  └─ TsingouFlow.Default
       └─ AdapterManager.Default
            └─ [adapters consume SignalQueueTag via register()]
                 └─ NatsPubSubService.Default
                      └─ NatsHubService.Default
                           └─ NatsInnerService.Default
                                └─ NatsConnectionService.Default
                                     └─ HolonetConfigTag.Default
```

---

## 8. Named After

**Mary Tsingou (1928–2023)** — programmer at Los Alamos National Laboratory who ran one of the first computer simulations in history on the MANIAC I. Her work on the Fermi-Pasta-Ulam-Tsingou problem revealed that nonlinear systems exhibit recurrent, quasi-periodic behavior — a foundational insight for signal analysis. She was systematically uncredited for decades until the problem was finally renamed to include her in 2008.

Signals. Analysis. Computation. Justice.

---

## 9. Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Architecture Analysis | `ARCHITECTURE_ANALYSIS.md` | Pre-design analysis of nw_wrld internals |
| Signal Pipeline (nw_wrld) | `docs/01_SIGNAL_PIPELINE.md` | Reference: how nw_wrld routes signals |
| Module System (nw_wrld) | `docs/02_MODULE_SYSTEM.md` | Reference: sandbox architecture |
| IPC Bridge (nw_wrld) | `docs/03_IPC_BRIDGE.md` | Reference: cross-process messaging |
| State & Persistence (nw_wrld) | `docs/04_STATE_PERSISTENCE.md` | Reference: Jotai atoms, JSON persistence |
| Dashboard UI (nw_wrld) | `docs/05_DASHBOARD_UI.md` | Reference: React component patterns |
| Workspace (nw_wrld) | `docs/06_WORKSPACE.md` | Reference: project directory structure |
| R3F Migration | `docs/R3F_MIGRATION_POSTULATION.md` | Three.js → R3F rendering layer plan |
| Tsingou Flow Architecture | `docs/TSINGOU_FLOW_ARCHITECTURE.md` | Signal pipeline design document |
| ADR-001 through ADR-008 | `docs/adr/` | Architectural decisions with evidence |

---

*Tsingou sees everything. Tsingou correlates everything. Tsingou renders everything.*

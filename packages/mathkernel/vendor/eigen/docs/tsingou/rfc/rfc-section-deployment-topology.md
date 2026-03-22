# TSG.34: Deployment Topology

```
Section:       TSG.34 — Deployment Topology
Parent RFC:    TMNL-RFC-002 (Tsingou SIGINT Visualization Platform)
Status:        DRAFT
Author:        Val (ew-doctrine-advisor)
Created:       2026-02-18
Part:          VII — Implementation (Normative)
Prerequisites: TSG.6 (Architecture Overview), TSG.7 (Signal Pipeline),
               TSG.11 (NATS Fabric), TSG.16-19 (SDR/RF Integration),
               TSG.32 (Effect-TS Architecture), TSG.36 (EW Doctrine)
```

> This section specifies the deployment topology for the Tsingou SIGINT visualization
> platform across operational environments ranging from single-laptop analyst stations
> to multi-host distributed field collection systems. The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and
> "OPTIONAL" in this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Introduction and Scope](#1-introduction-and-scope)
2. [Design Principles](#2-design-principles)
3. [Tauri v2 Desktop Shell](#3-tauri-v2-desktop-shell)
4. [Process Model](#4-process-model)
5. [Sidecar Architecture](#5-sidecar-architecture)
6. [NATS Server Deployment](#6-nats-server-deployment)
7. [NATS Leaf Node Topology](#7-nats-leaf-node-topology)
8. [GNU Radio Sidecar](#8-gnu-radio-sidecar)
9. [SDR Hardware Sidecar](#9-sdr-hardware-sidecar)
10. [Serial Device Bridge](#10-serial-device-bridge)
11. [File Watch Sidecar](#11-file-watch-sidecar)
12. [Sidecar Lifecycle Management](#12-sidecar-lifecycle-management)
13. [IPC Protocol and Command Architecture](#13-ipc-protocol-and-command-architecture)
14. [Filesystem Scope and Permissions](#14-filesystem-scope-and-permissions)
15. [WebView Rendering Architecture](#15-webview-rendering-architecture)
16. [Multi-Window Management](#16-multi-window-management)
17. [Deployment Profile: Analyst Laptop](#17-deployment-profile-analyst-laptop)
18. [Deployment Profile: Field Collection Station](#18-deployment-profile-field-collection-station)
19. [Deployment Profile: CEMA Cell](#19-deployment-profile-cema-cell)
20. [Deployment Profile: Distributed Sensor Network](#20-deployment-profile-distributed-sensor-network)
21. [Deployment Profile: Containerized Server](#21-deployment-profile-containerized-server)
22. [Resource Budgets](#22-resource-budgets)
23. [Network Topology and Connectivity](#23-network-topology-and-connectivity)
24. [Store-and-Forward for Disconnected Operations](#24-store-and-forward-for-disconnected-operations)
25. [Security and Trust Boundaries](#25-security-and-trust-boundaries)
26. [Platform-Specific Considerations](#26-platform-specific-considerations)
27. [Build and Distribution](#27-build-and-distribution)
28. [Operational Scenarios](#28-operational-scenarios)
29. [Normative Requirements](#29-normative-requirements)
30. [Open Questions](#30-open-questions)
31. [Bibliography](#31-bibliography)

---

## 1. Introduction and Scope

### 1.1 Purpose

This section specifies the deployment topology for Tsingou across operational contexts that
range from a single analyst laptop performing passive SIGINT collection to a multi-node
distributed collection architecture supporting a Cyber Electromagnetic Activities (CEMA)
cell or joint SIGINT operations center. The deployment model MUST support all contexts
without requiring codebase forks or feature flags — the same binary artifact adapts to its
deployment environment through configuration and sidecar composition.

### 1.2 Relationship to Other Sections

The deployment topology implements architectural decisions specified in:

| Section | Relationship |
|---------|-------------|
| TSG.6 (Architecture Overview) | Deployment topology realizes the layered architecture |
| TSG.7 (Signal Pipeline) | d2ts graph runs within the Tauri process; sidecars feed it via NATS |
| TSG.11 (NATS Fabric) | NATS server deployment and leaf node topology specified here |
| TSG.16 (SDR Hardware) | Hardware interfaces mediated by sidecars specified here |
| TSG.17 (GNU Radio Bridge) | GNU Radio sidecar deployment specified here |
| TSG.32 (Effect-TS Architecture) | Effect service composition within the Tauri process |
| TSG.34 (This section) | Self-referential — deployment topology specification |
| TSG.36 (EW Doctrine) | Field deployment scenarios grounded in EMSO/CEMA doctrine |

### 1.3 Deployment Philosophy

Tsingou follows a **core + sidecars** deployment model. The core application is a Tauri v2
desktop binary containing the Effect-TS runtime, d2ts signal pipeline, 4-layer rendering
surface, and an embedded NATS client. Signal sources that require native hardware access,
external runtimes, or process isolation are deployed as sidecar processes that communicate
with the core through NATS subjects.

This model is informed by the sidecar pattern from microservices architecture [BURNS-SIDECARS]
adapted for desktop deployment. Each sidecar is a single-purpose process with a well-defined
NATS interface, independently deployable, independently restartable, and independently
monitorable.

### 1.4 Terminology

Table 34-1: Deployment Terminology

| Term | Definition |
|------|-----------|
| **Core Process** | The Tauri v2 main process: Rust backend + WebView frontend |
| **Sidecar** | An external binary managed by Tauri's shell plugin, communicating via NATS |
| **Leaf Node** | A NATS server instance that connects to a hub cluster, bridging local subjects |
| **Hub** | The central NATS server or cluster that leaf nodes connect to |
| **Collection Node** | A device running one or more sidecars for signal collection (may lack GUI) |
| **Analyst Station** | A device running the full Tsingou core with rendering layers |
| **Field Station** | A self-contained deployment combining collection nodes and analyst stations |
| **CEMA Cell** | A Cyber Electromagnetic Activities tactical operations center |
| **SWaP** | Size, Weight, and Power — operational constraint for field deployments |
| **PACE Plan** | Primary, Alternate, Contingency, Emergency — communications redundancy |
| **EMCON** | Emissions Control — operational restriction on electromagnetic emissions |

---

## 2. Design Principles

### 2.1 Separation of Concerns

The deployment topology MUST enforce strict separation between:

1. **Rendering** — WebView process handles all visualization (R3F, visx, p5, DOM)
2. **Computation** — Effect-TS runtime + d2ts pipeline within Tauri Rust process
3. **Collection** — Sidecar processes handle hardware I/O and external runtimes
4. **Transport** — NATS fabric provides all inter-process and inter-host communication
5. **Persistence** — NATS JetStream provides signal history and state persistence

Table 34-2: Concern Separation Matrix

| Concern | Process | Language | Communication |
|---------|---------|----------|---------------|
| Signal rendering | WebView (Chromium/WebKitGTK) | TypeScript/React | Tauri IPC events |
| Signal pipeline | Tauri main process | Rust + Effect-TS (via WebView) | Internal function calls |
| SDR collection | SDR sidecar | Python/Rust/C | NATS publish |
| GNU Radio DSP | GNU Radio sidecar | Python (GRC flowgraph) | NATS publish |
| Serial devices | Serial bridge sidecar | Rust | NATS publish |
| File monitoring | File watch sidecar | Rust/TypeScript | NATS publish |
| Message routing | NATS server | Go (nats-server binary) | TCP/WebSocket |

### 2.2 Progressive Deployment

The deployment topology MUST support progressive composition — an analyst MAY start with
the core application alone (built-in adapters only) and progressively add sidecars as
collection requirements grow. The core MUST function without any sidecars. Sidecars MUST
function without the core (publishing to NATS for later consumption).

### 2.3 Fail-Safe Sidecar Isolation

A sidecar crash MUST NOT affect the core process. A core process crash MUST NOT affect
running sidecars. NATS provides the isolation boundary — if a publisher disappears, subscribers
simply stop receiving messages on those subjects. JetStream persistence ensures that messages
published by sidecars during a core restart are available for replay.

### 2.4 Operational Adaptability

The deployment topology MUST adapt to operational constraints without code changes:

| Constraint | Adaptation |
|-----------|-----------|
| No GPU available | Disable R3F layer; use visx + DOM only |
| No network connectivity | Embedded NATS; all sidecars local |
| Low bandwidth link | NATS leaf node with subject filtering |
| EMCON restrictions | Disable all transmit sidecars; receive-only mode |
| High-security environment | Air-gapped; no leaf node connections |
| Mobile/battery operation | Reduce sidecar count; lower sampling rates |

---

## 3. Tauri v2 Desktop Shell

### 3.1 Architecture Overview

Tsingou is packaged as a Tauri v2 desktop application [TAURI-V2]. Tauri provides:

1. **Rust core process** — The main application binary, handling system interactions,
   sidecar management, filesystem access, and the Tauri command/event IPC bridge
2. **System WebView** — The rendering surface (WebView2 on Windows, WebKitGTK on Linux,
   WKWebView on macOS), running the React + Effect-TS frontend
3. **Plugin system** — Modular capabilities (shell, filesystem, window state, dialog, etc.)
   with granular permissions per window and per domain

Table 34-3: Tauri v2 Component Mapping

| Tauri Component | Tsingou Usage | Configuration |
|----------------|---------------|---------------|
| `tauri::App` | Main entry point; initializes NATS client, sidecar manager | `src-tauri/src/main.rs` |
| `tauri-plugin-shell` | Sidecar process spawning and lifecycle management | Capabilities: `shell:allow-spawn`, `shell:allow-execute` |
| `tauri-plugin-fs` | Workspace file access, SigMF recording storage | Scoped to workspace directory |
| `tauri-plugin-window-state` | Window position/size persistence across sessions | Automatic save/restore |
| `tauri-plugin-dialog` | File open/save dialogs for signal recordings | Capabilities: `dialog:allow-open`, `dialog:allow-save` |
| `tauri-plugin-notification` | Alert notifications for critical signal events | OS-native notifications |
| WebView | R3F + visx + p5 + DOM rendering layers | Hardware-accelerated compositing |

### 3.2 Rust Backend Responsibilities

The Tauri Rust backend SHALL handle:

1. **Sidecar process management** — Spawning, monitoring, and terminating sidecar binaries
   via `tauri-plugin-shell`
2. **NATS client initialization** — Establishing the NATS connection used by Effect-TS
   services in the WebView
3. **Filesystem scoping** — Enforcing workspace-scoped file access for SigMF recordings,
   configuration files, and JetStream data directories
4. **System tray integration** — Background operation with system tray icon showing
   collection status (active adapters, signal rates, alerts)
5. **Platform-specific adaptations** — WSLg compositing workarounds, GPU selection,
   WebView configuration per platform

### 3.3 WebView Frontend Responsibilities

The WebView SHALL host:

1. **Effect-TS runtime** — Service composition, atom management, stream processing
2. **d2ts pipeline** — Ingest and derived graphs executing in the WebView JavaScript context
3. **4-layer rendering surface** — R3F (WebGL), visx (SVG), p5 (Canvas 2D), DOM
4. **NATS WebSocket client** — Connecting to the local or remote NATS server via
   `nats.ws` transport for adapter subscriptions
5. **Tauri IPC consumer** — Receiving sidecar status events and system commands via
   the Tauri event bridge

---

## 4. Process Model

### 4.1 Process Tree

A fully deployed Tsingou installation produces the following process tree:

```
tsingou (Tauri main process — Rust)
├── tsingou-webview (WebView2/WebKitGTK — rendering)
├── nats-server (NATS server — message fabric)
├── tsingou-sdr-bridge (SDR sidecar — hardware I/O)
├── tsingou-gnuradio-bridge (GNU Radio sidecar — DSP)
├── tsingou-serial-bridge (Serial sidecar — UART devices)
└── tsingou-file-watcher (File watch sidecar — pcap/log tailing)
```

The process tree is **sparse by default** — only the core process and WebView are mandatory.
Sidecars are started on demand when the user configures signal sources that require them.

### 4.2 Process Communication Topology

```
                           ┌─────────────────┐
                           │   nats-server    │
                           │  (localhost:4222)│
                           └────────┬────────┘
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
              │ WebView   │  │ SDR       │  │ GNU Radio │
              │ (nats.ws) │  │ Sidecar   │  │ Sidecar   │
              │           │  │ (nats-c)  │  │ (nats-py) │
              └───────────┘  └───────────┘  └───────────┘
                    │
              ┌─────▼─────┐
              │ Tauri IPC │ ←→ Rust backend
              │ (events + │    (sidecar mgmt,
              │  commands) │     fs scoping)
              └───────────┘
```

All inter-process communication flows through NATS, with one exception: the Tauri IPC
bridge between the Rust backend and the WebView, which uses Tauri's native event/command
protocol for sidecar lifecycle management and filesystem operations.

### 4.3 Process Isolation Guarantees

Table 34-4: Process Isolation Matrix

| Failure | Impact on Core | Impact on Other Sidecars | Recovery |
|---------|---------------|------------------------|----------|
| SDR sidecar crash | None — NATS subject goes silent | None | Auto-restart via sidecar manager |
| GNU Radio sidecar crash | None | None | Auto-restart; flow graph state lost |
| Serial bridge crash | None | None | Auto-restart; serial port re-enumeration |
| NATS server crash | All NATS communication lost | All sidecars lose transport | Auto-restart; JetStream replay on recovery |
| WebView crash | Rendering lost; pipeline paused | None — sidecars continue collecting | Tauri restarts WebView; pipeline resumes |
| Tauri core crash | All processes orphaned | Sidecars continue until NATS timeout | User relaunches application |

### 4.4 Process Priority and Scheduling

On resource-constrained deployments, the following priority ordering SHOULD be enforced:

Table 34-5: Process Priority Ordering

| Priority | Process | Rationale |
|----------|---------|-----------|
| Highest | NATS server | Message fabric must remain available for all processes |
| High | SDR sidecar | Hardware I/O has real-time constraints; dropped samples are unrecoverable |
| Normal | Tauri core + WebView | User interface and pipeline processing |
| Low | GNU Radio sidecar | Batch DSP can tolerate scheduling delays |
| Lowest | File watch sidecar | Filesystem events are buffered by the OS |

---

## 5. Sidecar Architecture

### 5.1 Sidecar Contract

Every Tsingou sidecar MUST implement the following contract:

1. **NATS-only communication** — All data exchange with the core and other sidecars
   occurs via NATS subjects. No shared memory, no named pipes, no Unix sockets.
2. **Self-contained binary** — The sidecar is a single executable (or script with
   bundled runtime) that can be invoked with command-line arguments.
3. **Configuration via arguments or NATS KV** — Sidecar configuration is passed via
   command-line arguments at launch or read from a NATS KV bucket at runtime.
4. **Health heartbeat** — Each sidecar MUST publish health status to its designated
   health subject at a configurable interval (RECOMMENDED: every 5 seconds).
5. **Graceful shutdown** — On receiving a control message on its control subject or
   a POSIX signal (SIGTERM/SIGINT), the sidecar MUST flush pending data, close hardware
   connections, publish a final shutdown status, and exit cleanly.

### 5.2 NATS Subject Convention for Sidecars

Table 34-6: Sidecar NATS Subject Convention

| Subject Pattern | Direction | Purpose |
|----------------|-----------|---------|
| `tsingou.signal.{kind}.{sourceId}` | Sidecar → Core | Signal data publication |
| `tsingou.sidecar.{name}.health` | Sidecar → Core | Health heartbeat (JSON) |
| `tsingou.sidecar.{name}.control` | Core → Sidecar | Control commands (start, stop, reconfigure) |
| `tsingou.sidecar.{name}.status` | Sidecar → Core | Lifecycle events (started, stopped, error) |
| `tsingou.sidecar.{name}.metrics` | Sidecar → Core | Performance metrics (signal rate, latency, errors) |
| `tsingou.sidecar.{name}.log` | Sidecar → Core | Structured log messages |

### 5.3 Health Heartbeat Schema

```typescript
const SidecarHealth = Schema.Struct({
  name:          Schema.String,
  pid:           Schema.Number,
  status:        Schema.Literal('starting', 'running', 'degraded', 'stopping', 'error'),
  uptimeSeconds: Schema.Number,
  signalRate:    Schema.Number,    // signals per second (last interval)
  errorCount:    Schema.Number,    // cumulative errors since start
  memoryMb:      Schema.Number,    // resident memory in MB
  cpuPercent:    Schema.Number,    // CPU usage percentage (last interval)
  timestamp:     Schema.DateFromSelf,
  metadata:      Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })),
})
```

### 5.4 Sidecar Registration in Tauri

Sidecars are registered in the Tauri configuration as external binaries:

```json
{
  "bundle": {
    "externalBin": [
      "binaries/nats-server",
      "binaries/tsingou-sdr-bridge",
      "binaries/tsingou-serial-bridge",
      "binaries/tsingou-file-watcher"
    ]
  }
}
```

Each binary MUST be named with the platform-specific triple suffix for cross-platform
distribution:

Table 34-7: Platform Binary Naming

| Platform | Suffix | Example |
|----------|--------|---------|
| Linux x86_64 | `-x86_64-unknown-linux-gnu` | `nats-server-x86_64-unknown-linux-gnu` |
| Linux ARM64 | `-aarch64-unknown-linux-gnu` | `nats-server-aarch64-unknown-linux-gnu` |
| macOS Intel | `-x86_64-apple-darwin` | `nats-server-x86_64-apple-darwin` |
| macOS Apple Silicon | `-aarch64-apple-darwin` | `nats-server-aarch64-apple-darwin` |
| Windows x86_64 | `-x86_64-pc-windows-msvc.exe` | `nats-server-x86_64-pc-windows-msvc.exe` |

### 5.5 Sidecar Binary Sources

Table 34-8: Sidecar Binary Provenance

| Sidecar | Source | Language | Binary Size (est.) | Notes |
|---------|--------|----------|-------------------|-------|
| `nats-server` | [NATS-SERVER] upstream | Go | ~20 MB | Static binary; no dependencies |
| `tsingou-sdr-bridge` | Custom | Rust | ~5 MB | Links `librtlsdr`, `libhackrf` |
| `tsingou-gnuradio-bridge` | Custom | Python | ~1 MB (script) | Requires GNU Radio installation |
| `tsingou-serial-bridge` | Custom | Rust | ~3 MB | Uses `serialport` crate |
| `tsingou-file-watcher` | Custom | Rust | ~3 MB | Uses `notify` crate |

---

## 6. NATS Server Deployment

### 6.1 Embedded NATS Server

The NATS server is deployed as a Tauri sidecar, launched automatically when the Tsingou
application starts. This is the **embedded deployment** — the NATS server runs locally,
requires no external infrastructure, and is the default for all deployment profiles.

The embedded NATS server MUST be configured with:

1. **Client listen** — `localhost:4222` (TCP) for sidecar connections
2. **WebSocket listen** — `localhost:4223` (WS) for WebView NATS client
3. **JetStream enabled** — File-based persistence in the workspace directory
4. **No authentication** — Local-only; sidecars connect without credentials
5. **Monitoring** — HTTP monitoring endpoint on `localhost:8222`

### 6.2 NATS Server Configuration (Embedded Mode)

```
# tsingou-nats-embedded.conf
listen: 127.0.0.1:4222

websocket {
  listen: "127.0.0.1:4223"
  no_tls: true
}

jetstream {
  store_dir: "${TSINGOU_WORKSPACE}/nats-data"
  max_mem: 256MB
  max_file: 2GB
}

http: 127.0.0.1:8222

# No auth for local-only operation
# Auth is added when leaf nodes are configured
```

### 6.3 JetStream Stream Configuration

Table 34-9: JetStream Stream Definitions

| Stream Name | Subjects | Storage | Max Age | Max Bytes | Retention | Purpose |
|------------|----------|---------|---------|-----------|-----------|---------|
| `TSINGOU_SIGNALS` | `tsingou.signal.>` | File | 24h | 1 GB | Limits | Raw signal history for replay |
| `TSINGOU_DERIVED` | `tsingou.derived.>` | File | 24h | 512 MB | Limits | Derived state snapshots |
| `TSINGOU_SIDECAR` | `tsingou.sidecar.>` | File | 7d | 256 MB | Limits | Sidecar health/status/metrics |
| `TSINGOU_AUDIT` | `tsingou.audit.>` | File | 30d | 128 MB | Limits | Configuration changes, security events |

### 6.4 NATS KV Buckets

Table 34-10: NATS KV Bucket Definitions

| Bucket Name | Key Pattern | Purpose | TTL |
|-------------|------------|---------|-----|
| `tsingou-schemas` | `{signal_kind}` | Schema registry — signal type definitions | None |
| `tsingou-adapters` | `{adapter_id}` | Adapter configurations | None |
| `tsingou-sessions` | `{session_id}` | Analysis session state | 24h |
| `tsingou-sidecars` | `{sidecar_name}` | Last-known sidecar configuration | None |

### 6.5 Resource Requirements (Embedded NATS)

Table 34-11: NATS Server Resource Requirements

| Metric | Idle | 10 signals/s | 100 signals/s | 1000 signals/s | 10000 signals/s |
|--------|------|-------------|---------------|----------------|-----------------|
| Memory (RSS) | ~30 MB | ~40 MB | ~80 MB | ~200 MB | ~500 MB |
| CPU | < 1% | < 2% | ~5% | ~15% | ~40% |
| Disk I/O (JetStream) | Negligible | ~50 KB/s | ~500 KB/s | ~5 MB/s | ~50 MB/s |
| Network (local) | Negligible | ~20 KB/s | ~200 KB/s | ~2 MB/s | ~20 MB/s |

These estimates assume average signal payload sizes of 1-2 KB. SDR IQ data streams
(Section 9) generate significantly higher bandwidth per signal — a single RTL-SDR at
2.4 MSPS produces ~19 MB/s of raw IQ data [ADR-011].

---

## 7. NATS Leaf Node Topology

### 7.1 Purpose

NATS leaf nodes extend the Tsingou messaging topology across host boundaries [NATS-LEAF].
A leaf node is a NATS server instance that connects to a hub (another NATS server or cluster),
transparently bridging local subjects to remote subjects. This enables:

1. **Multi-host collection** — SDR hardware on one device, analysis on another
2. **Field station networking** — Multiple collection nodes feeding a central analyst station
3. **CEMA cell integration** — Tsingou stations connecting to a tactical NATS cluster
4. **Store-and-forward** — Edge collection with intermittent hub connectivity

### 7.2 Leaf Node Architecture

```
                    ┌──────────────────────────────┐
                    │        NATS Hub              │
                    │  (datacenter / analyst station)│
                    │                              │
                    │  Subjects:                   │
                    │    tsingou.signal.>           │
                    │    tsingou.derived.>          │
                    │    tsingou.sidecar.>          │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼────────┐ ┌────▼─────────┐ ┌───▼──────────┐
     │ Leaf Node A     │ │ Leaf Node B  │ │ Leaf Node C  │
     │ (SDR station)   │ │ (serial)     │ │ (GNU Radio)  │
     │                 │ │              │ │              │
     │ SDR sidecar     │ │ Serial bridge│ │ GR flowgraph │
     │ publishes to    │ │ publishes to │ │ publishes to │
     │ tsingou.signal. │ │ tsingou.     │ │ tsingou.     │
     │ sdr.>           │ │ signal.      │ │ signal.sdr.  │
     │                 │ │ serial.>     │ │ decoded.>    │
     └─────────────────┘ └──────────────┘ └──────────────┘
```

### 7.3 Leaf Node Configuration

```
# tsingou-nats-leaf.conf — collection node
listen: 127.0.0.1:4222

leafnodes {
  remotes [
    {
      url: "nats-leaf://hub.tsingou.local:7422"
      credentials: "/etc/tsingou/leaf.creds"
      tls {
        cert_file: "/etc/tsingou/leaf.crt"
        key_file: "/etc/tsingou/leaf.key"
        ca_file: "/etc/tsingou/ca.crt"
      }
    }
  ]
}

jetstream {
  store_dir: "/var/tsingou/nats-data"
  max_mem: 128MB
  max_file: 1GB
}

# Local clients connect without auth
# Hub connection uses mTLS + credentials
```

### 7.4 Hub Configuration for Leaf Nodes

```
# tsingou-nats-hub.conf — analyst station / central server
listen: 0.0.0.0:4222

leafnodes {
  listen: "0.0.0.0:7422"
  tls {
    cert_file: "/etc/tsingou/hub.crt"
    key_file: "/etc/tsingou/hub.key"
    ca_file: "/etc/tsingou/ca.crt"
    verify: true
  }
}

jetstream {
  store_dir: "/var/tsingou/nats-data"
  max_mem: 512MB
  max_file: 10GB
}

websocket {
  listen: "0.0.0.0:4223"
  tls {
    cert_file: "/etc/tsingou/hub.crt"
    key_file: "/etc/tsingou/hub.key"
  }
}
```

### 7.5 Subject Mapping for Leaf Nodes

Leaf nodes MAY remap local subjects to hub subjects for namespace isolation:

Table 34-12: Leaf Node Subject Mapping

| Local Subject | Hub Subject | Purpose |
|--------------|------------|---------|
| `tsingou.signal.sdr.rtlsdr-001` | `tsingou.signal.sdr.station-alpha.rtlsdr-001` | Station-prefixed namespace |
| `tsingou.sidecar.sdr-bridge.health` | `tsingou.sidecar.station-alpha.sdr-bridge.health` | Station-prefixed health |
| `tsingou.signal.serial.>` | `tsingou.signal.serial.station-alpha.>` | Wildcard station mapping |

### 7.6 Leaf Node Connectivity Patterns

Table 34-13: Leaf Node Connectivity Patterns

| Pattern | Direction | Authentication | Use Case |
|---------|-----------|---------------|----------|
| Dial-out | Leaf → Hub | mTLS + credentials | Default; works through NAT/firewalls |
| WebSocket | Leaf → Hub via WSS | Token + TLS | Through HTTP proxies |
| Bidirectional | Hub ↔ Leaf | mTLS | Controlled environments; enables hub → leaf commands |
| Mesh | Leaf ↔ Leaf (via hub) | mTLS | Inter-station communication |

---

## 8. GNU Radio Sidecar

### 8.1 Architecture

The GNU Radio sidecar bridges GNU Radio Companion (GRC) flowgraphs to Tsingou via NATS.
GNU Radio handles DSP operations (demodulation, decoding, FFT computation), and publishes
processed results to NATS subjects that the Tsingou core subscribes to.

```
┌──────────────────────────────────────────┐
│ GNU Radio Sidecar                        │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ GRC Flowgraph (.grc → .py)         │ │
│  │                                     │ │
│  │  SDR Source → Low-Pass → FM Demod  │ │
│  │                  → NATS Sink Block │ │
│  │                                     │ │
│  │  SDR Source → FFT → Mag²          │ │
│  │                  → NATS Sink Block │ │
│  └──────────────────┬──────────────────┘ │
│                     │                    │
│  ┌──────────────────▼──────────────────┐ │
│  │ NATS Publisher (nats.py)           │ │
│  │                                     │ │
│  │ tsingou.signal.sdr.decoded.{proto} │ │
│  │ tsingou.signal.sdr.fft.{device}    │ │
│  │ tsingou.signal.sdr.iq.{device}     │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ Health Reporter                     │ │
│  │ → tsingou.sidecar.gnuradio.health  │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 8.2 NATS Sink Block

The GNU Radio NATS sink block is a custom OOT (Out-Of-Tree) module that publishes
GNU Radio stream data to NATS subjects. This block MUST be implemented as a Python
block (for compatibility with GNU Radio's Python-based OOT module system).

```python
# tsingou_nats_sink.py — GNU Radio OOT block
import numpy as np
from gnuradio import gr
import nats

class nats_sink(gr.sync_block):
    """Publishes GNU Radio samples to a NATS subject."""

    def __init__(self, nats_url, subject, batch_size=1024, format='json'):
        gr.sync_block.__init__(self,
            name="NATS Sink",
            in_sig=[np.complex64],
            out_sig=None)
        self.nats_url = nats_url
        self.subject = subject
        self.batch_size = batch_size
        self.format = format
        self.nc = None
        self.buffer = []

    def start(self):
        import asyncio
        self.loop = asyncio.new_event_loop()
        self.nc = self.loop.run_until_complete(
            nats.connect(self.nats_url))
        return True

    def work(self, input_items, output_items):
        samples = input_items[0]
        # Batch and publish
        for i in range(0, len(samples), self.batch_size):
            batch = samples[i:i+self.batch_size]
            payload = self._encode(batch)
            self.loop.run_until_complete(
                self.nc.publish(self.subject, payload))
        return len(samples)

    def _encode(self, samples):
        if self.format == 'json':
            return json.dumps({
                'samples': samples.tolist(),
                'timestamp': time.time(),
            }).encode()
        elif self.format == 'sigmf':
            return samples.tobytes()
        # ... additional formats

    def stop(self):
        if self.nc:
            self.loop.run_until_complete(self.nc.drain())
        return True
```

### 8.3 Pre-Built Flowgraph Library

Tsingou SHALL ship with a library of pre-built GRC flowgraphs for common SIGINT protocols:

Table 34-14: Pre-Built GNU Radio Flowgraphs

| Flowgraph | Protocol | Frequency | Modulation | Output Subject |
|-----------|----------|-----------|------------|----------------|
| `adsb_decoder.grc` | ADS-B (Mode S) | 1090 MHz | PPM | `tsingou.signal.sdr.decoded.adsb` |
| `pocsag_decoder.grc` | POCSAG (pager) | 148-174 MHz | FSK | `tsingou.signal.sdr.decoded.pocsag` |
| `fm_broadcast.grc` | FM broadcast | 88-108 MHz | WBFM | `tsingou.signal.sdr.decoded.fm` |
| `acars_decoder.grc` | ACARS (aviation) | 131.550 MHz | AM/MSK | `tsingou.signal.sdr.decoded.acars` |
| `ais_decoder.grc` | AIS (maritime) | 161.975/162.025 MHz | GMSK | `tsingou.signal.sdr.decoded.ais` |
| `noaa_apt.grc` | NOAA APT (weather) | 137 MHz | APT/FM | `tsingou.signal.sdr.decoded.noaa` |
| `spectrum_survey.grc` | Wideband FFT | Configurable | — | `tsingou.signal.sdr.fft.{device}` |
| `waterfall.grc` | FFT waterfall | Configurable | — | `tsingou.signal.sdr.waterfall.{device}` |
| `iq_record.grc` | Raw IQ recording | Configurable | — | `tsingou.signal.sdr.iq.{device}` |

### 8.4 GNU Radio Deployment Requirements

The GNU Radio sidecar has unique deployment requirements:

1. **GNU Radio MUST be installed separately** — It is not bundled with Tsingou due to
   its size (~500 MB with dependencies) and GPL licensing considerations
2. **GRC flowgraphs are compiled to Python** — The `grcc` compiler generates standalone
   Python scripts from `.grc` files
3. **The NATS sink OOT module MUST be installed** — Into the GNU Radio module path
4. **SDR hardware drivers** — `librtlsdr`, `libhackrf`, `libuhd` etc. must be present

Table 34-15: GNU Radio Installation Matrix

| Platform | Installation Method | Notes |
|----------|-------------------|-------|
| Linux (Debian/Ubuntu) | `apt install gnuradio` | Recommended; includes gr-osmosdr |
| Linux (Fedora) | `dnf install gnuradio` | Includes gr-osmosdr |
| macOS | MacPorts or Homebrew | Limited SDR hardware support |
| Windows | Radioconda | Conda-based installer; includes RTL-SDR drivers |
| Docker | `gnuradio/gnuradio:latest` | Headless operation; no GUI required for compiled flowgraphs |

---

## 9. SDR Hardware Sidecar

### 9.1 Architecture

The SDR hardware sidecar provides direct access to SDR devices (RTL-SDR, HackRF, etc.)
without requiring GNU Radio. This lightweight sidecar reads raw IQ samples or computes
FFT data and publishes to NATS.

```
┌───────────────────────────────────────────┐
│ SDR Hardware Sidecar                      │
│                                           │
│  ┌──────────────┐   ┌──────────────────┐ │
│  │ librtlsdr /  │   │ IQ Processing    │ │
│  │ libhackrf /  │──►│ FFT (FFTW)       │ │
│  │ libuhd       │   │ Power spectrum   │ │
│  └──────────────┘   │ Waterfall gen    │ │
│                     └────────┬─────────┘ │
│                              │           │
│  ┌───────────────────────────▼─────────┐ │
│  │ NATS Publisher                      │ │
│  │ tsingou.signal.sdr.fft.{device}    │ │
│  │ tsingou.signal.sdr.iq.{device}     │ │
│  │ tsingou.signal.sdr.waterfall.{dev} │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │ Device Manager                      │ │
│  │ - USB hotplug detection             │ │
│  │ - Device enumeration                │ │
│  │ - Frequency/gain/sample rate config│ │
│  └─────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

### 9.2 SDR Device Support

Table 34-16: SDR Device Support Matrix

| Device | Library | IQ Streaming | FFT | Max Bandwidth | Tsingou Subject |
|--------|---------|-------------|-----|--------------|-----------------|
| RTL-SDR v3/v4 | `librtlsdr` | Yes | Yes | 2.4 MHz | `tsingou.signal.sdr.*.rtlsdr-{n}` |
| HackRF One | `libhackrf` | Yes | Yes | 20 MHz | `tsingou.signal.sdr.*.hackrf-{n}` |
| Airspy Mini | `libairspy` | Yes | Yes | 6 MHz | `tsingou.signal.sdr.*.airspy-{n}` |
| Airspy HF+ | `libairspyhf` | Yes | Yes | 768 kHz | `tsingou.signal.sdr.*.airspyhf-{n}` |
| LimeSDR | `LimeSuite` | Yes | Yes | 61.44 MHz | `tsingou.signal.sdr.*.lime-{n}` |
| USRP (Ettus) | `libuhd` | Yes | Yes | Device-dependent | `tsingou.signal.sdr.*.usrp-{n}` |
| KrakenRF | `krakenrf-api` | DF only | No | 2.4 MHz x5 | `tsingou.signal.sdr.df.kraken-{n}` |

### 9.3 Bandwidth Budget for IQ Streaming

Raw IQ streaming generates significant bandwidth. Implementations MUST account for
this when planning NATS buffer sizes and JetStream retention:

Table 34-17: IQ Streaming Bandwidth

| Sample Rate | Format | Bandwidth (raw) | Bandwidth (compressed) | JetStream/hour |
|-------------|--------|-----------------|----------------------|----------------|
| 240 kHz | cf32 | 1.9 MB/s | ~1 MB/s (LZ4) | ~3.6 GB |
| 1.024 MHz | cf32 | 8.2 MB/s | ~4 MB/s | ~14.4 GB |
| 2.4 MHz | cf32 | 19.2 MB/s | ~10 MB/s | ~36 GB |
| 10 MHz | cf32 | 80 MB/s | ~40 MB/s | ~144 GB |
| 20 MHz | cf32 | 160 MB/s | ~80 MB/s | ~288 GB |

For sample rates above 1 MHz, implementations SHOULD use the decimated FFT path
rather than raw IQ streaming through NATS. Raw IQ MAY be written directly to disk
in SigMF format [SIGMF] and referenced by a NATS message containing the file path.

### 9.4 SigMF Recording Integration

When raw IQ recording is required, the SDR sidecar SHALL:

1. Write IQ samples directly to a `.sigmf-data` file on disk
2. Generate the corresponding `.sigmf-meta` JSON metadata file
3. Publish a `tsingou.signal.sdr.recording.{device}` message containing:

```typescript
const SdrRecordingNotification = Schema.Struct({
  deviceId:      Schema.String,
  dataFile:      Schema.String,   // absolute path to .sigmf-data
  metaFile:      Schema.String,   // absolute path to .sigmf-meta
  startTime:     Schema.DateFromSelf,
  durationMs:    Schema.Number,
  centerFreqHz:  Schema.Number,
  sampleRate:    Schema.Number,
  format:        Schema.Literal('cf32_le', 'ci16_le', 'ci8', 'cu8'),
  sizeBytes:     Schema.Number,
})
```

This avoids streaming high-bandwidth IQ data through NATS while maintaining signal
metadata visibility in the Tsingou pipeline.

---

## 10. Serial Device Bridge

### 10.1 Architecture

The serial device bridge sidecar connects UART/serial devices to Tsingou via NATS.
This supports hardware sensors, GPS receivers, weather stations, and other devices
that communicate over RS-232/USB-serial interfaces.

### 10.2 Device Discovery

The serial bridge SHOULD enumerate available serial ports at startup and publish
a device manifest:

```
tsingou.sidecar.serial-bridge.devices → [
  { "port": "/dev/ttyUSB0", "description": "GPS Receiver", "vid": "1546", "pid": "01a7" },
  { "port": "/dev/ttyACM0", "description": "Arduino Mega", "vid": "2341", "pid": "0042" }
]
```

### 10.3 Serial Signal Schema

```typescript
const SerialSignalPayload = Schema.Struct({
  port:     Schema.String,
  baudRate: Schema.Number,
  raw:      Schema.Uint8ArrayFromSelf,
  parsed:   Schema.optional(Schema.Unknown),
  encoding: Schema.Literal('raw', 'nmea', 'ascii', 'binary'),
})
```

### 10.4 GPS Integration

GPS receivers communicating via NMEA 0183 over serial are a common SIGINT collection
requirement (geotagging signal detections). The serial bridge SHOULD include a built-in
NMEA parser that extracts position fixes and publishes them as:

```
tsingou.signal.serial.gps.{device} → {
  latitude:  47.6062,
  longitude: -122.3321,
  altitude:  15.2,
  speed:     0.0,
  heading:   0.0,
  fixType:   "3D",
  satellites: 12,
  hdop:      0.8,
  timestamp: "2026-02-18T14:30:00Z"
}
```

This enables geospatial correlation of SDR signal detections with GPS position —
a requirement for direction-finding (DF) and time-difference-of-arrival (TDOA)
computations described in TSG.36.17.

---

## 11. File Watch Sidecar

### 11.1 Architecture

The file watch sidecar monitors filesystem directories for new or modified files
and publishes events to NATS. This supports:

1. **pcap file ingestion** — Network packet captures written by tcpdump or Wireshark
2. **Log tailing** — Application logs, system logs, IDS/IPS alerts
3. **SigMF file detection** — New SDR recordings appearing in a watched directory
4. **Database export monitoring** — CSV/JSON exports from external systems

### 11.2 Watch Configuration

```typescript
const FileWatchConfig = Schema.Struct({
  paths:      Schema.Array(Schema.String),     // directories to watch
  patterns:   Schema.Array(Schema.String),     // glob patterns (e.g., "*.pcap")
  recursive:  Schema.Boolean,
  debounceMs: Schema.Number,                   // debounce interval for rapid writes
  parseMode:  Schema.Literal('raw', 'lines', 'json', 'csv', 'pcap', 'sigmf'),
})
```

### 11.3 NATS Subject Mapping

Table 34-18: File Watch Subject Mapping

| Event Type | Subject | Payload |
|-----------|---------|---------|
| File created | `tsingou.signal.file-watch.created.{tag}` | File path, size, content (if small) |
| File modified | `tsingou.signal.file-watch.modified.{tag}` | File path, size, diff (if text) |
| File deleted | `tsingou.signal.file-watch.deleted.{tag}` | File path only |
| Line appended | `tsingou.signal.file-watch.line.{tag}` | New line(s) content |

---

## 12. Sidecar Lifecycle Management

### 12.1 Lifecycle State Machine

Each sidecar follows a defined lifecycle:

```
                    ┌──────────┐
                    │ Pending  │ ← Configuration received, not yet started
                    └────┬─────┘
                         │ start()
                    ┌────▼─────┐
                    │ Starting │ ← Process spawning, initial connection
                    └────┬─────┘
                         │ health heartbeat received
                    ┌────▼─────┐
              ┌────►│ Running  │ ← Normal operation
              │     └────┬─────┘
              │          │ error / health degraded
              │     ┌────▼─────┐
              │     │ Degraded │ ← Running but reporting errors
              │     └────┬─────┘
              │          │ recovered
              └──────────┘
                         │ stop() or crash
                    ┌────▼─────┐
                    │ Stopping │ ← Graceful shutdown in progress
                    └────┬─────┘
                         │ process exited
                    ┌────▼─────┐
                    │ Stopped  │ ← Process terminated
                    └──────────┘
```

### 12.2 Auto-Restart Policy

Table 34-19: Sidecar Auto-Restart Policy

| Condition | Action | Delay | Max Retries |
|-----------|--------|-------|-------------|
| Clean exit (code 0) | Do not restart | — | — |
| Crash (code != 0) | Restart with exponential backoff | 1s, 2s, 4s, 8s, 16s | 5 |
| Health timeout (no heartbeat > 30s) | Kill + restart | 1s | 5 |
| OOM killed | Restart with reduced config | 5s | 3 |
| User-initiated stop | Do not restart | — | — |
| NATS connection lost | Wait for NATS, then restart | Polling 5s | Unlimited |

### 12.3 Sidecar Manager Service

The sidecar manager is an Effect service in the Tauri Rust backend that:

1. Reads sidecar configuration from NATS KV (`tsingou-sidecars` bucket)
2. Spawns sidecar processes via `tauri-plugin-shell`
3. Monitors health heartbeats on `tsingou.sidecar.{name}.health`
4. Implements auto-restart policies
5. Publishes aggregate sidecar status to the WebView via Tauri events

```typescript
class SidecarManager extends Effect.Service<SidecarManager>()(
  'tsingou/SidecarManager',
  {
    effect: Effect.gen(function* () {
      const shell = yield* TauriShell
      const nats = yield* NatsConnection
      const registry = yield* Atom.make(new Map<string, SidecarState>())

      return {
        start: (name: string, config: SidecarConfig) =>
          Effect.gen(function* () {
            const child = yield* shell.sidecar(name, config.args)
            yield* Atom.update(registry, m => {
              const n = new Map(m)
              n.set(name, { status: 'starting', pid: child.pid, config })
              return n
            })
            // Subscribe to health heartbeats
            yield* nats.subscribe(`tsingou.sidecar.${name}.health`)
          }),

        stop: (name: string) =>
          Effect.gen(function* () {
            yield* nats.publish(`tsingou.sidecar.${name}.control`,
              JSON.stringify({ command: 'shutdown' }))
            // Wait for graceful exit, then force-kill after timeout
          }),

        list: Atom.get(registry),

        health: (name: string) =>
          nats.subscribe(`tsingou.sidecar.${name}.health`).pipe(
            Stream.map(msg => Schema.decodeSync(SidecarHealth)(
              JSON.parse(msg.data.toString())))
          ),
      }
    }),
  }
) {}
```

---

## 13. IPC Protocol and Command Architecture

### 13.1 Tauri IPC Bridge

The Tauri IPC bridge connects the Rust backend to the WebView frontend. This is
the only communication channel that does NOT use NATS — it uses Tauri's native
event/command protocol for performance-critical operations.

### 13.2 Tauri Commands (Rust → WebView callable)

Table 34-20: Tauri Command Definitions

| Command | Direction | Parameters | Returns | Purpose |
|---------|-----------|-----------|---------|---------|
| `sidecar_start` | WebView → Rust | `{ name, config }` | `{ pid, status }` | Start a sidecar process |
| `sidecar_stop` | WebView → Rust | `{ name }` | `void` | Stop a sidecar process |
| `sidecar_list` | WebView → Rust | — | `SidecarState[]` | List all sidecar states |
| `nats_status` | WebView → Rust | — | `NatsServerStatus` | NATS server health |
| `workspace_info` | WebView → Rust | — | `WorkspaceInfo` | Current workspace metadata |
| `open_recording` | WebView → Rust | `{ path }` | `RecordingMetadata` | Open SigMF recording |
| `gpu_info` | WebView → Rust | — | `GpuInfo` | GPU capabilities for rendering |
| `platform_info` | WebView → Rust | — | `PlatformInfo` | OS, architecture, display info |

### 13.3 Tauri Events (Rust → WebView push)

Table 34-21: Tauri Event Definitions

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `sidecar-status-changed` | Rust → WebView | `{ name, status, pid }` | Sidecar lifecycle transition |
| `nats-connection-changed` | Rust → WebView | `{ connected, url }` | NATS connectivity change |
| `usb-device-changed` | Rust → WebView | `{ action, device }` | USB hotplug (SDR detection) |
| `recording-complete` | Rust → WebView | `{ path, metadata }` | SigMF recording finished |
| `system-alert` | Rust → WebView | `{ level, message }` | System-level alerts |

---

## 14. Filesystem Scope and Permissions

### 14.1 Tauri Filesystem Scoping

Tsingou uses Tauri's filesystem scoping to restrict WebView access to authorized
directories only [TAURI-FS]. The scope is defined in the capability configuration:

```json
{
  "identifier": "tsingou-filesystem",
  "description": "Filesystem access for Tsingou workspace",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read",
      "allow": [
        { "path": "$APPDATA/tsingou/**" },
        { "path": "$RESOURCE/**" }
      ]
    },
    {
      "identifier": "fs:allow-write",
      "allow": [
        { "path": "$APPDATA/tsingou/recordings/**" },
        { "path": "$APPDATA/tsingou/sessions/**" },
        { "path": "$APPDATA/tsingou/config/**" }
      ]
    },
    {
      "identifier": "fs:deny-write",
      "deny": [
        { "path": "$APPDATA/tsingou/nats-data/**" }
      ]
    }
  ]
}
```

### 14.2 Workspace Directory Structure

Table 34-22: Workspace Directory Layout

| Directory | Purpose | Access |
|-----------|---------|--------|
| `$APPDATA/tsingou/` | Workspace root | Read |
| `$APPDATA/tsingou/config/` | Application and sidecar configuration | Read/Write |
| `$APPDATA/tsingou/recordings/` | SigMF recordings and signal captures | Read/Write |
| `$APPDATA/tsingou/sessions/` | Analysis session state (graph configs) | Read/Write |
| `$APPDATA/tsingou/nats-data/` | NATS JetStream persistence | NATS only (deny WebView) |
| `$APPDATA/tsingou/flowgraphs/` | GNU Radio .grc and compiled .py files | Read/Write |
| `$APPDATA/tsingou/schemas/` | Custom signal schema definitions | Read/Write |
| `$APPDATA/tsingou/logs/` | Application and sidecar logs | Read |

---

## 15. WebView Rendering Architecture

### 15.1 Rendering Layer Performance

The 4-layer rendering surface (TSG.20-24) imposes specific requirements on the WebView:

Table 34-23: Rendering Layer Requirements

| Layer | Technology | GPU Requirement | Fallback |
|-------|-----------|----------------|----------|
| R3F (3D Scene) | WebGL 2.0 | Dedicated/Integrated GPU | Software rasterization (slow) |
| visx (Data Viz) | SVG | CPU (no GPU needed) | Always available |
| p5 (Generative) | Canvas 2D | GPU-accelerated compositing | CPU Canvas (adequate) |
| DOM (Controls) | HTML/CSS | GPU-accelerated compositing | CPU rendering |

### 15.2 WebView Engine Selection

Table 34-24: WebView Engine by Platform

| Platform | WebView Engine | WebGL Support | WebGPU Support | Notes |
|----------|---------------|---------------|----------------|-------|
| Windows | WebView2 (Chromium) | Full WebGL 2.0 | Experimental | Defaults to integrated GPU; discrete GPU requires env flags |
| Linux | WebKitGTK | WebGL 2.0 | Experimental (2.48+) | GPU process disabled by default; enable via feature flag |
| macOS | WKWebView (WebKit) | Full WebGL 2.0 | Via Metal backend | Best GPU integration |
| Linux (WSLg) | WebKitGTK | Software only | No | `WEBKIT_DISABLE_COMPOSITING_MODE=1` required |

### 15.3 GPU Selection on Multi-GPU Systems

On systems with both integrated and discrete GPUs, the R3F rendering layer SHOULD
use the discrete GPU. Tauri MUST expose environment variables or configuration to
control GPU selection:

| Platform | Mechanism | Configuration |
|----------|-----------|---------------|
| Windows | `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` | `--use-angle=d3d11 --gpu-preference=high-performance` |
| Linux | `WEBKIT_FORCE_SANDBOX=0` + GPU env vars | Distribution-dependent |
| macOS | System automatic | Metal selects appropriate GPU |

### 15.4 Hardware Acceleration Fallback

When GPU acceleration is unavailable (headless servers, WSLg, SSH X11 forwarding),
implementations MUST:

1. Disable R3F layer (WebGL unavailable or software-rendered)
2. Fall back to visx (SVG) + DOM rendering for all data visualization
3. Use p5 in Canvas 2D mode (software compositing)
4. Log a warning indicating degraded rendering performance

---

## 16. Multi-Window Management

### 16.1 Window Architecture

Tsingou MAY use multiple windows for specialized views:

Table 34-25: Window Definitions

| Window | Label | Purpose | Required Permissions |
|--------|-------|---------|---------------------|
| Main | `main` | Primary analysis workspace (4-layer rendering) | Full: NATS, fs, shell |
| Spectrum | `spectrum` | Dedicated spectrum analyzer (p5 + visx) | NATS read, no fs write |
| Signal Detail | `signal-detail` | Signal inspection and metadata | NATS read, no fs write |
| Configuration | `config` | Sidecar and adapter configuration | Full: NATS, fs, shell |

### 16.2 Inter-Window Communication

Windows communicate via Tauri's event system and shared NATS subscriptions:

1. **Signal selection** — User selects a signal in the main window; `signal-detail`
   window updates to show metadata
2. **Spectrum focus** — User clicks a frequency in the spectrum window; main window
   filters to signals near that frequency
3. **Configuration changes** — Config window modifies sidecar settings; all windows
   receive updated state via NATS KV watch

### 16.3 Window Capability Scoping

Each window receives a distinct capability set, enforcing least-privilege:

```json
{
  "identifier": "spectrum-window-capability",
  "windows": ["spectrum"],
  "permissions": [
    "core:event:allow-listen",
    "core:event:allow-emit"
  ]
}
```

The spectrum window MUST NOT have access to filesystem write, shell execute, or
sidecar management commands.

---

## 17. Deployment Profile: Analyst Laptop

### 17.1 Scenario

A single analyst running Tsingou on a laptop for passive SIGINT collection and analysis.
This is the most common deployment and the default configuration.

### 17.2 Topology

```
┌─────────────────────────────────────────────────┐
│ Analyst Laptop                                  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Tsingou Core (Tauri v2)                  │  │
│  │                                          │  │
│  │  WebView ← IPC → Rust Backend           │  │
│  │  [R3F | visx | p5 | DOM]                │  │
│  │  [Effect-TS + d2ts pipeline]            │  │
│  └──────────────────┬───────────────────────┘  │
│                     │ nats://localhost:4222     │
│  ┌──────────────────▼───────────────────────┐  │
│  │ nats-server (embedded sidecar)           │  │
│  │ JetStream: $APPDATA/tsingou/nats-data    │  │
│  └──────────────────┬───────────────────────┘  │
│                     │                          │
│  ┌──────────┐ ┌─────▼──────┐ ┌──────────────┐ │
│  │ SDR      │ │ File Watch │ │ Serial Bridge│ │
│  │ Sidecar  │ │ Sidecar    │ │ Sidecar      │ │
│  │ (RTL-SDR)│ │ (pcap/log) │ │ (GPS)        │ │
│  └──────────┘ └────────────┘ └──────────────┘ │
│                                                 │
│  USB: RTL-SDR v4 ─── GPS Receiver              │
└─────────────────────────────────────────────────┘
```

### 17.3 Resource Budget

Table 34-26: Analyst Laptop Resource Budget

| Process | Memory | CPU | Disk |
|---------|--------|-----|------|
| Tsingou core (Tauri + WebView) | 300-500 MB | 10-30% | — |
| NATS server (embedded) | 30-100 MB | 1-5% | 1-2 GB (JetStream) |
| SDR sidecar | 20-50 MB | 5-15% | — |
| File watch sidecar | 10-20 MB | < 1% | — |
| Serial bridge sidecar | 10-20 MB | < 1% | — |
| **Total** | **370-690 MB** | **17-52%** | **1-2 GB** |

### 17.4 Minimum Hardware Requirements

Table 34-27: Analyst Laptop Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores, 2.0 GHz | 8 cores, 3.0 GHz |
| RAM | 8 GB | 16 GB |
| Storage | 256 GB SSD | 512 GB NVMe SSD |
| GPU | Integrated (Intel UHD 620+) | Discrete (NVIDIA/AMD) |
| Display | 1920x1080 | 2560x1440 or dual 1080p |
| USB | USB 2.0 (for RTL-SDR) | USB 3.0 (for HackRF/USRP) |
| OS | Linux (Debian 12+, Ubuntu 22.04+) | Linux (recommended), Windows 10+, macOS 13+ |

---

## 18. Deployment Profile: Field Collection Station

### 18.1 Scenario

A portable, self-contained collection station for field SIGINT operations. Typically
a ruggedized laptop with multiple SDR receivers, GPS, and battery power. Designed for
operations described in TSG.36 (EW doctrine) including TPED-aligned collection.

### 18.2 Topology

```
┌──────────────────────────────────────────────────────────┐
│ Field Collection Station (Ruggedized Laptop)             │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │ Tsingou Core (Tauri v2)                      │       │
│  │ [Full 4-layer rendering]                     │       │
│  │ [Effect-TS + d2ts pipeline]                  │       │
│  └───────────────────┬──────────────────────────┘       │
│                      │ nats://localhost:4222             │
│  ┌───────────────────▼──────────────────────────┐       │
│  │ nats-server (embedded + leaf node)           │       │
│  │ Leaf → nats-leaf://base.tsingou.mil:7422     │       │
│  │ JetStream: 10 GB local store-and-forward     │       │
│  └───────────────────┬──────────────────────────┘       │
│          ┌───────────┼───────────┬──────────┐           │
│    ┌─────▼────┐ ┌────▼─────┐ ┌──▼────────┐ │           │
│    │ SDR #1   │ │ SDR #2   │ │ GNU Radio │ │           │
│    │ RTL-SDR  │ │ HackRF   │ │ Sidecar   │ │           │
│    │ VHF scan │ │ UHF/SHF  │ │ Decoders  │ │           │
│    └──────────┘ └──────────┘ └───────────┘ │           │
│          ┌───────────┼───────────┐          │           │
│    ┌─────▼────┐ ┌────▼─────┐ ┌──▼────────┐ │           │
│    │ Serial   │ │ File     │ │ KrakenRF  │ │           │
│    │ GPS      │ │ Watch    │ │ DF        │ │           │
│    │ Bridge   │ │ (pcap)   │ │ Sidecar   │ │           │
│    └──────────┘ └──────────┘ └───────────┘ │           │
│                                              │           │
│  Hardware:                                   │           │
│  ├─ RTL-SDR v4 (24-1766 MHz, RX)           │           │
│  ├─ HackRF One (1 MHz-6 GHz, TX/RX)        │           │
│  ├─ KrakenRF (5x coherent RTL-SDR, DF)     │           │
│  ├─ GPS receiver (USB)                      │           │
│  ├─ Directional antenna (rotator)           │           │
│  └─ Omnidirectional wideband antenna        │           │
└──────────────────────────────────────────────────────────┘
```

### 18.3 Field Station Operational Modes

Table 34-28: Field Station Operational Modes

| Mode | Description | NATS Config | Network | Duration |
|------|------------|-------------|---------|----------|
| Standalone | No network; all local | Embedded only | None | Battery-limited (4-8h) |
| Connected | Active leaf node link to base | Leaf + JetStream | LAN/WiFi/LTE | Unlimited with power |
| Store-and-Forward | Leaf node configured but disconnected | Leaf + JetStream (buffered) | Intermittent | Battery-limited; data syncs on reconnect |
| EMCON | No RF emissions; receive-only, no transmit sidecars | Embedded only | None (air-gapped) | Battery-limited |
| Covert | Minimal footprint; headless collection, no display | Headless (no WebView) | Optional leaf | Battery-limited |

### 18.4 SWaP Budget

Table 34-29: Field Station SWaP Budget

| Item | Weight | Power (idle) | Power (active) |
|------|--------|-------------|---------------|
| Ruggedized laptop | 2.5 kg | 15 W | 45 W |
| RTL-SDR v4 + antenna | 0.1 kg | 0.5 W | 0.5 W |
| HackRF One + antenna | 0.3 kg | 1.5 W | 2.5 W |
| KrakenRF (5-channel) | 0.5 kg | 2.5 W | 5 W |
| GPS receiver | 0.05 kg | 0.3 W | 0.3 W |
| Battery pack (100 Wh) | 0.7 kg | — | ~2h at full load |
| Cable bag + antennas | 1.0 kg | — | — |
| **Total** | **~5.2 kg** | **~20 W** | **~53 W** |

---

## 19. Deployment Profile: CEMA Cell

### 19.1 Scenario

A Cyber Electromagnetic Activities (CEMA) cell or joint SIGINT operations center
with multiple analyst stations, centralized collection, and multi-source fusion.
Grounded in FM 3-12 CEMA doctrine as described in TSG.36.

### 19.2 Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│ CEMA Cell / Joint SIGINT Operations Center                          │
│                                                                      │
│  ┌────────────────────────────────────────────┐                     │
│  │          NATS Hub Cluster (3-node)          │                     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │                     │
│  │  │ nats-01  │─│ nats-02  │─│ nats-03  │   │                     │
│  │  │ (leader) │ │ (follower)│ │(follower)│   │                     │
│  │  └──────────┘ └──────────┘ └──────────┘   │                     │
│  │  JetStream: replicated across 3 nodes     │                     │
│  └──────────────────┬────────────────────────┘                     │
│                     │                                               │
│  ┌──────────────────┼─────────────────────────────────────────┐    │
│  │                  │                                         │    │
│  │  ┌───────────────▼──────────────┐  ┌─────────────────────┐│    │
│  │  │ Analyst Station #1           │  │ Analyst Station #2  ││    │
│  │  │ Tsingou Core (full render)   │  │ Tsingou Core        ││    │
│  │  │ Role: COMINT analyst         │  │ Role: ELINT analyst ││    │
│  │  └──────────────────────────────┘  └─────────────────────┘│    │
│  │                                                           │    │
│  │  ┌─────────────────────────────┐  ┌──────────────────────┐│    │
│  │  │ Analyst Station #3          │  │ Fusion Display       ││    │
│  │  │ Tsingou Core                │  │ Tsingou Core         ││    │
│  │  │ Role: Spectrum manager      │  │ Role: COP overlay    ││    │
│  │  └─────────────────────────────┘  └──────────────────────┘│    │
│  └───────────────────────────────────────────────────────────┘    │
│                     │                                               │
│  ┌──────────────────┼────────────────────────────────┐             │
│  │  Collection Rack  │                                │             │
│  │  ┌────────────────▼──────────┐  ┌───────────────┐ │             │
│  │  │ Collection Server         │  │ GNU Radio     │ │             │
│  │  │ (NATS leaf + sidecars)    │  │ Server        │ │             │
│  │  │ ├─ SDR sidecar (4x USRP) │  │ (multiple     │ │             │
│  │  │ ├─ Serial bridge          │  │  flowgraphs)  │ │             │
│  │  │ └─ File watch (pcap)      │  └───────────────┘ │             │
│  │  └───────────────────────────┘                     │             │
│  └────────────────────────────────────────────────────┘             │
│                                                                      │
│  External Connections (NATS leaf):                                   │
│  ├─ Field Station Alpha ─── (leaf node via LTE)                     │
│  ├─ Field Station Bravo ─── (leaf node via SATCOM)                  │
│  └─ Partner SIGINT feed ─── (leaf node via VPN)                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 19.3 CEMA Cell NATS Configuration

The CEMA cell uses a 3-node NATS cluster for high availability:

```
# nats-cluster-node-01.conf
server_name: tsingou-hub-01
listen: 0.0.0.0:4222

cluster {
  name: tsingou-cema
  listen: 0.0.0.0:6222
  routes = [
    nats-route://nats-02.tsingou.local:6222
    nats-route://nats-03.tsingou.local:6222
  ]
  tls {
    cert_file: "/etc/tsingou/cluster.crt"
    key_file: "/etc/tsingou/cluster.key"
    ca_file: "/etc/tsingou/ca.crt"
  }
}

leafnodes {
  listen: "0.0.0.0:7422"
  tls {
    cert_file: "/etc/tsingou/hub.crt"
    key_file: "/etc/tsingou/hub.key"
    ca_file: "/etc/tsingou/ca.crt"
    verify: true
  }
}

jetstream {
  store_dir: "/data/tsingou/nats"
  max_mem: 2GB
  max_file: 100GB
}

accounts {
  COLLECTION {
    jetstream: enabled
    users: [
      { user: "collector", password: "$COLL_PASS" }
    ]
  }
  ANALYST {
    jetstream: enabled
    users: [
      { user: "analyst", password: "$ANALYST_PASS" }
    ]
  }
}
```

### 19.4 Role-Based Access

Table 34-30: CEMA Cell Role-Based Access

| Role | NATS Account | Subject Access | JetStream Access | Capabilities |
|------|-------------|---------------|-----------------|-------------|
| Collection | `COLLECTION` | Publish: `tsingou.signal.>` | Write: `TSINGOU_SIGNALS` | Signal ingestion only |
| Analyst | `ANALYST` | Subscribe: `tsingou.signal.>`, `tsingou.derived.>` | Read: all streams | Analysis and visualization |
| Operator | `OPERATOR` | All subjects | Read/Write all | Full system control |
| Field Station | `FIELD` | Publish: `tsingou.signal.>` | Write: `TSINGOU_SIGNALS` | Remote collection |

---

## 20. Deployment Profile: Distributed Sensor Network

### 20.1 Scenario

Multiple collection nodes deployed across a geographic area, each running SDR hardware
and publishing to a central NATS cluster via leaf nodes. The analyst station aggregates
and fuses signals from all nodes.

### 20.2 Topology

```
                    ┌────────────────────────────┐
                    │    Central NATS Hub         │
                    │    (datacenter / TOC)       │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │ Analyst Workstation   │  │
                    │  │ Tsingou Core (full)   │  │
                    │  └──────────────────────┘  │
                    └──────────┬─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼────────┐ ┌────▼─────────┐ ┌───▼──────────┐
     │ Sensor Node A   │ │ Sensor Node B│ │ Sensor Node C│
     │ (Raspberry Pi)  │ │ (Mini PC)    │ │ (Laptop)     │
     │                 │ │              │ │              │
     │ RTL-SDR + GPS   │ │ HackRF +GPS │ │ USRP + GPS  │
     │ NATS leaf node  │ │ NATS leaf    │ │ NATS leaf   │
     │ Store & forward │ │ Direct link  │ │ LTE/SATCOM  │
     └─────────────────┘ └──────────────┘ └──────────────┘
         Location A          Location B       Location C
```

### 20.3 Headless Collection Node

For sensor nodes without displays (e.g., Raspberry Pi), Tsingou supports a headless
deployment where only sidecars and a NATS leaf node run — no Tauri core, no WebView:

```
# Headless collection node process tree
nats-server (leaf node)
├── tsingou-sdr-bridge (SDR hardware)
├── tsingou-serial-bridge (GPS)
└── tsingou-file-watcher (optional)
```

The headless node is configured via NATS KV from the analyst station and managed
remotely through NATS control subjects.

### 20.4 Geolocation through Distributed Nodes

With GPS-equipped nodes at known positions, the distributed sensor network enables:

1. **TDOA (Time Difference of Arrival)** — Correlate signal arrival times across
   nodes to compute emitter position (TSG.36.17)
2. **FDOA (Frequency Difference of Arrival)** — Correlate Doppler shifts for
   moving emitter tracking
3. **DF (Direction Finding)** — KrakenRF coherent arrays at each node provide
   bearing estimates; intersection yields position

Signal time-stamping MUST use GPS-disciplined clocks for TDOA accuracy. Each signal
published by a collection node MUST include GPS timestamp and position metadata.

---

## 21. Deployment Profile: Containerized Server

### 21.1 Scenario

Tsingou deployed as a containerized service for server-side signal processing,
long-running collection, and headless analysis. The WebView rendering is replaced
by an HTTP API or WebSocket interface for remote clients.

### 21.2 Docker Compose Configuration

```yaml
# docker-compose.yml — Tsingou containerized deployment
services:
  nats:
    image: nats:latest
    ports:
      - "4222:4222"   # Client
      - "4223:4223"   # WebSocket
      - "7422:7422"   # Leaf nodes
      - "8222:8222"   # Monitoring
    volumes:
      - nats-data:/data
      - ./nats.conf:/etc/nats/nats.conf
    command: ["-c", "/etc/nats/nats.conf"]
    restart: unless-stopped

  sdr-bridge:
    build: ./sidecars/sdr-bridge
    devices:
      - /dev/bus/usb:/dev/bus/usb  # USB passthrough for SDR
    environment:
      - NATS_URL=nats://nats:4222
      - SDR_DEVICE=rtlsdr
      - SDR_FREQUENCY=433920000
      - SDR_SAMPLE_RATE=2400000
    depends_on:
      - nats
    restart: unless-stopped

  gnuradio:
    build: ./sidecars/gnuradio
    devices:
      - /dev/bus/usb:/dev/bus/usb
    environment:
      - NATS_URL=nats://nats:4222
    volumes:
      - ./flowgraphs:/app/flowgraphs
    depends_on:
      - nats
    restart: unless-stopped

  serial-bridge:
    build: ./sidecars/serial-bridge
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0
      - /dev/ttyACM0:/dev/ttyACM0
    environment:
      - NATS_URL=nats://nats:4222
    depends_on:
      - nats
    restart: unless-stopped

  file-watcher:
    build: ./sidecars/file-watcher
    environment:
      - NATS_URL=nats://nats:4222
      - WATCH_PATHS=/data/captures
    volumes:
      - captures:/data/captures
    depends_on:
      - nats
    restart: unless-stopped

volumes:
  nats-data:
  captures:
```

### 21.3 Container Resource Limits

Table 34-31: Container Resource Limits

| Container | Memory Limit | CPU Limit | Restart Policy |
|-----------|-------------|-----------|----------------|
| `nats` | 1 GB | 2 cores | `unless-stopped` |
| `sdr-bridge` | 256 MB | 1 core | `unless-stopped` |
| `gnuradio` | 1 GB | 2 cores | `unless-stopped` |
| `serial-bridge` | 128 MB | 0.5 cores | `unless-stopped` |
| `file-watcher` | 128 MB | 0.5 cores | `unless-stopped` |

---

## 22. Resource Budgets

### 22.1 Memory Budget by Deployment Profile

Table 34-32: Memory Budget Summary

| Deployment Profile | Min Memory | Recommended | Peak (SDR active) |
|-------------------|-----------|-------------|-------------------|
| Analyst Laptop | 4 GB | 8 GB | 6 GB |
| Field Station | 8 GB | 16 GB | 12 GB |
| CEMA Cell (per analyst) | 8 GB | 16 GB | 12 GB |
| CEMA Cell (collection server) | 16 GB | 32 GB | 24 GB |
| CEMA Cell (NATS cluster node) | 4 GB | 8 GB | 4 GB |
| Distributed Sensor Node | 2 GB | 4 GB | 3 GB |
| Containerized Server | 4 GB | 8 GB | 6 GB |

### 22.2 Storage Budget

Table 34-33: Storage Budget (24-hour operation)

| Data Type | Rate | 1 Hour | 24 Hours | 7 Days |
|-----------|------|--------|----------|--------|
| Signal metadata (NATS) | ~500 KB/s | 1.8 GB | 43 GB | 300 GB |
| FFT spectrum (NATS) | ~100 KB/s | 360 MB | 8.6 GB | 60 GB |
| Raw IQ (disk, SigMF) | ~19 MB/s (per SDR) | 68 GB | 1.6 TB | 11.5 TB |
| JetStream persistence | ~600 KB/s | 2.2 GB | 52 GB | 360 GB |
| Application logs | ~10 KB/s | 36 MB | 860 MB | 6 GB |
| **Total (without raw IQ)** | **~1.2 MB/s** | **4.4 GB** | **104 GB** | **726 GB** |
| **Total (with 1 SDR IQ)** | **~20 MB/s** | **72 GB** | **1.7 TB** | **12.2 TB** |

Raw IQ recording is the dominant storage consumer. Implementations SHOULD use selective
recording (record on trigger) rather than continuous IQ capture for extended operations.

### 22.3 Network Budget

Table 34-34: Network Budget (per leaf node link)

| Traffic Type | Direction | Bandwidth |
|-------------|-----------|-----------|
| Signal metadata | Leaf → Hub | 100-500 KB/s |
| FFT spectrum data | Leaf → Hub | 50-200 KB/s |
| Sidecar health/metrics | Leaf → Hub | ~1 KB/s |
| Control commands | Hub → Leaf | ~1 KB/s |
| NATS protocol overhead | Bidirectional | ~5% of payload |
| **Total per leaf** | **Primarily Leaf → Hub** | **~200 KB/s - 1 MB/s** |

---

## 23. Network Topology and Connectivity

### 23.1 PACE Communications Plan

Field deployments SHOULD implement a PACE (Primary, Alternate, Contingency, Emergency)
communications plan for the NATS leaf node connection to the hub:

Table 34-35: PACE Plan for NATS Connectivity

| Priority | Medium | NATS Transport | Bandwidth | Latency |
|----------|--------|---------------|-----------|---------|
| **Primary** | Ethernet/WiFi LAN | TCP (nats://) | 100+ Mbps | < 1 ms |
| **Alternate** | LTE/5G cellular | WebSocket (wss://) | 1-50 Mbps | 20-100 ms |
| **Contingency** | SATCOM (L-band) | WebSocket (wss://) | 64-512 Kbps | 250-600 ms |
| **Emergency** | Sneakernet (USB drive) | Offline export/import | N/A | Hours |

### 23.2 Subject Filtering for Low-Bandwidth Links

When operating over bandwidth-constrained links (SATCOM, cellular), leaf nodes
SHOULD filter subjects to reduce bandwidth:

```
# Low-bandwidth leaf node configuration
leafnodes {
  remotes [
    {
      url: "wss://hub.tsingou.mil:443"
      # Only forward critical subjects
      # Raw IQ and high-rate FFT stay local
    }
  ]
}

# Local-only subjects (not forwarded to hub)
no_responders: true
```

Subject filtering rules:

Table 34-36: Subject Filtering by Bandwidth Tier

| Bandwidth Tier | Forwarded Subjects | Held Local |
|---------------|-------------------|------------|
| High (> 10 Mbps) | All `tsingou.>` | None |
| Medium (1-10 Mbps) | `tsingou.signal.sdr.decoded.>`, `tsingou.signal.sdr.fft.>`, `tsingou.sidecar.>` | `tsingou.signal.sdr.iq.>`, `tsingou.signal.sdr.waterfall.>` |
| Low (< 1 Mbps) | `tsingou.signal.sdr.decoded.>`, `tsingou.sidecar.*.health` | All FFT, IQ, waterfall, metrics |
| Minimal (< 64 Kbps) | `tsingou.signal.sdr.decoded.>` (sampled) | Everything else |

---

## 24. Store-and-Forward for Disconnected Operations

### 24.1 JetStream as Buffer

When a leaf node loses connectivity to the hub, JetStream provides local persistence.
Signals published locally are stored in the JetStream file store and forwarded to the
hub when connectivity is restored.

### 24.2 Buffer Sizing

Table 34-37: Store-and-Forward Buffer Sizing

| Disconnection Duration | Buffer Size Required (metadata only) | Buffer Size (with FFT) |
|----------------------|-------------------------------------|----------------------|
| 1 hour | ~2 GB | ~3 GB |
| 4 hours | ~8 GB | ~12 GB |
| 8 hours | ~16 GB | ~24 GB |
| 24 hours | ~43 GB | ~52 GB |

### 24.3 Replay on Reconnection

When connectivity is restored, the leaf node MUST:

1. Resume the leaf node connection to the hub
2. JetStream automatically replays buffered messages to the hub
3. Hub receives signals with original timestamps (enabling temporal ordering)
4. Hub JetStream deduplicates messages using NATS message IDs

The analyst station at the hub SHALL observe a burst of historical signals during
replay, with the d2ts pipeline processing them in temporal order.

### 24.4 Offline Export/Import (Emergency)

When network connectivity is completely unavailable, the emergency PACE option
supports offline data transfer:

1. **Export** — The collection node exports JetStream data to a portable medium
   (USB drive, SD card) as NATS backup files
2. **Transfer** — Physical transport to the analyst station
3. **Import** — The analyst station imports the backup into its local JetStream,
   where the d2ts pipeline processes it

---

## 25. Security and Trust Boundaries

### 25.1 Trust Zones

Table 34-38: Security Trust Zones

| Zone | Processes | Authentication | Encryption | Network |
|------|----------|---------------|------------|---------|
| **Local** | Core + sidecars on same host | None (localhost) | None (loopback) | 127.0.0.1 only |
| **Station** | Processes on same LAN | NATS user/pass or NKey | TLS optional | Trusted LAN |
| **Field** | Leaf nodes over WAN | mTLS + credentials | TLS required | Untrusted |
| **External** | Partner feeds, external SIGINT | mTLS + JWT + account isolation | TLS required | Internet/VPN |

### 25.2 NATS Authentication Hierarchy

```
                    ┌──────────────┐
                    │ System       │  ← Operator account: full access
                    │ Operator     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼──────┐ ┌──▼─────────┐
       │ COLLECTION │ │ ANALYST  │ │ FIELD      │
       │ Account    │ │ Account  │ │ Account    │
       │            │ │          │ │            │
       │ pub:signal │ │ sub:*    │ │ pub:signal │
       │ sub:control│ │ pub:cmd  │ │ sub:control│
       └────────────┘ └──────────┘ └────────────┘
```

### 25.3 Certificate Management

For field deployments, certificate management follows a PKI model:

1. **Root CA** — Generated at CEMA cell / operations center
2. **Hub certificates** — Issued for each NATS hub server
3. **Leaf certificates** — Issued for each collection node
4. **Client certificates** — Issued for each analyst station
5. **Rotation** — Certificates SHOULD be rotated at mission boundaries

---

## 26. Platform-Specific Considerations

### 26.1 Linux

Table 34-39: Linux-Specific Configuration

| Component | Configuration | Notes |
|-----------|---------------|-------|
| WebKitGTK | `WEBKIT_DISABLE_COMPOSITING_MODE=1` (WSLg) | Required for WSLg; not needed on native Linux |
| USB access | `udev` rules for SDR devices | `/etc/udev/rules.d/99-rtlsdr.rules` |
| Serial access | User in `dialout` group | `sudo usermod -aG dialout $USER` |
| GPU | WebKitGTK GPU process disabled by default | Enable via `UseGPUProcessForWebGL` feature flag |
| Systemd | Sidecar units for headless deployment | `/etc/systemd/system/tsingou-*.service` |

### 26.2 Windows

Table 34-40: Windows-Specific Configuration

| Component | Configuration | Notes |
|-----------|---------------|-------|
| WebView2 | Runtime auto-installed via Tauri bootstrapper | Evergreen (auto-updating) |
| SDR drivers | Zadig USB driver replacement | Required for RTL-SDR; installs WinUSB driver |
| Serial | COM port access | No special configuration needed |
| GPU | WebView2 defaults to integrated GPU | Set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` for discrete GPU |
| Firewall | Allow NATS ports (4222, 4223, 7422) | For multi-host deployment only |

### 26.3 macOS

Table 34-41: macOS-Specific Configuration

| Component | Configuration | Notes |
|-----------|---------------|-------|
| WKWebView | Metal backend for WebGL | Best GPU integration of all platforms |
| SDR drivers | Homebrew: `brew install librtlsdr` | Limited hardware support vs Linux |
| Serial | `/dev/tty.usbserial-*` | USB-serial adapters auto-detected |
| Notarization | Required for distribution | Tauri handles notarization in build pipeline |
| Sandbox | App sandbox may restrict USB access | May require entitlements for SDR hardware |

### 26.4 ARM64 (Raspberry Pi / Edge Devices)

Table 34-42: ARM64-Specific Configuration

| Component | Configuration | Notes |
|-----------|---------------|-------|
| NATS server | ARM64 binary available | ~20 MB; runs on Pi 3B+ or newer |
| SDR bridge | Cross-compile from Rust | Requires ARM64 target in Cargo |
| WebView | Not available (headless only) | No Tsingou core; sidecars + leaf node only |
| GPIO | Optional direct GPIO access | For antenna rotator control |
| Power | USB-powered operation | 5V/3A sufficient for Pi + RTL-SDR |

---

## 27. Build and Distribution

### 27.1 Build Matrix

Table 34-43: Build Matrix

| Target | Architecture | Tauri Core | Sidecars | Bundle Format |
|--------|-------------|------------|----------|--------------|
| Linux Desktop | x86_64 | Yes | Yes | `.deb`, `.AppImage`, `.rpm` |
| Linux Desktop | aarch64 | Yes | Yes | `.deb`, `.AppImage` |
| Linux Headless | x86_64 | No | Yes | Tar archive |
| Linux Headless | aarch64 | No | Yes | Tar archive |
| Windows | x86_64 | Yes | Yes | `.msi`, `.exe` |
| macOS | x86_64 | Yes | Yes | `.dmg` |
| macOS | aarch64 | Yes | Yes | `.dmg` |
| Docker | multi-arch | No | Yes | Container images |

### 27.2 Sidecar Build Pipeline

Each sidecar is built independently and embedded into the Tauri bundle:

```
src-tauri/binaries/
├── nats-server-x86_64-unknown-linux-gnu           # Pre-built from NATS upstream
├── tsingou-sdr-bridge-x86_64-unknown-linux-gnu    # Built via cargo build --release
├── tsingou-serial-bridge-x86_64-unknown-linux-gnu # Built via cargo build --release
└── tsingou-file-watcher-x86_64-unknown-linux-gnu  # Built via cargo build --release
```

### 27.3 GNU Radio Distribution

GNU Radio is NOT bundled with Tsingou. The distribution includes:

1. **OOT module source** — `tsingou-gr-nats-sink/` (Python + XML block descriptors)
2. **Pre-built flowgraphs** — `flowgraphs/*.grc` (GRC files)
3. **Installation script** — `install-gnuradio-oot.sh` (installs OOT module)
4. **Documentation** — Setup guide for GNU Radio + Tsingou integration

---

## 28. Operational Scenarios

### 28.1 Scenario: Passive VHF/UHF Monitoring

**Profile**: Analyst Laptop
**Hardware**: RTL-SDR v4, omnidirectional antenna
**Objective**: Monitor VHF/UHF spectrum for signals of interest

**Process flow**:
1. Launch Tsingou → NATS server starts → SDR sidecar starts
2. SDR sidecar detects RTL-SDR via USB, begins FFT spectrum scan
3. `spectrum_survey.grc` flowgraph runs in GNU Radio sidecar
4. FFT data published to `tsingou.signal.sdr.fft.rtlsdr-001`
5. Tsingou core subscribes, feeds d2ts ingest graph
6. p5 layer renders real-time waterfall display
7. Analyst identifies signal of interest at 433.92 MHz
8. Switches to `ism_decoder.grc` flowgraph for 433 MHz ISM band
9. Decoded signals appear in visx data visualization layer

### 28.2 Scenario: Multi-Node Direction Finding

**Profile**: Distributed Sensor Network (3 nodes)
**Hardware**: 3x KrakenRF + GPS, separated by 100-500m
**Objective**: Geolocate an emitter using TDOA/DF

**Process flow**:
1. Three sensor nodes start with GPS-disciplined clocks
2. Each KrakenRF sidecar publishes bearing estimates to
   `tsingou.signal.sdr.df.kraken-{n}.station-{x}`
3. GPS bridge publishes position to `tsingou.signal.serial.gps.station-{x}`
4. Hub NATS cluster receives all bearings and positions
5. Analyst station d2ts derived graph computes bearing intersection
6. R3F 3D layer renders geospatial map with emitter position estimate
7. Analyst refines with TDOA correlation for higher accuracy

### 28.3 Scenario: CEMA Cell Shift Handoff

**Profile**: CEMA Cell
**Hardware**: 4 analyst stations, collection rack, 2 field stations
**Objective**: Transfer operational context between shift teams

**Process flow**:
1. Outgoing shift analyst saves session state to NATS KV (`tsingou-sessions`)
2. Session includes: active signal subscriptions, frequency watchlist,
   d2ts graph configuration, annotation notes, alert thresholds
3. Incoming shift analyst loads session from KV
4. Tsingou restores exact pipeline state, subscription filters, and view configuration
5. JetStream replay provides last 30 minutes of signal history for context
6. Incoming analyst achieves SA within 5 minutes (vs. 30+ without system support)

### 28.4 Scenario: Disconnected Field Collection

**Profile**: Field Station (store-and-forward mode)
**Hardware**: Ruggedized laptop, HackRF, GPS, battery
**Objective**: Collect signals in area without network, sync later

**Process flow**:
1. Field station starts with leaf node configured but disconnected
2. SDR sidecar collects and publishes to local NATS
3. JetStream stores all signals locally (10 GB buffer)
4. Analyst uses local Tsingou core for initial analysis
5. After 4-hour collection mission, returns to base
6. Connects to LAN → leaf node establishes connection to hub
7. JetStream replays 4 hours of buffered signals to hub
8. Hub analyst station receives historical signals with original timestamps
9. d2ts pipeline processes in temporal order — full reconstruction

---

## 29. Normative Requirements

### 29.1 Core Deployment Requirements (DT-C)

| ID | Requirement |
|----|-------------|
| DT-C1 | The Tsingou core application MUST function without any sidecars in a reduced-capability mode (built-in adapters only) |
| DT-C2 | All inter-process communication between the core and sidecars MUST use NATS as the transport protocol |
| DT-C3 | The embedded NATS server MUST be launched as a Tauri sidecar and MUST be available before any other sidecar starts |
| DT-C4 | JetStream MUST be enabled on all NATS server deployments for signal persistence and replay |
| DT-C5 | Sidecar crashes MUST NOT affect the core process or other running sidecars |
| DT-C6 | The application MUST support headless deployment (sidecars + NATS only, no Tauri core) for collection nodes |

### 29.2 Sidecar Requirements (DT-S)

| ID | Requirement |
|----|-------------|
| DT-S1 | Every sidecar MUST publish health heartbeats to its designated NATS subject at least every 10 seconds |
| DT-S2 | Every sidecar MUST implement graceful shutdown on POSIX signals (SIGTERM, SIGINT) and NATS control commands |
| DT-S3 | Sidecar binaries MUST be named with platform-specific triple suffixes for cross-platform distribution |
| DT-S4 | The sidecar manager MUST implement auto-restart with exponential backoff for crashed sidecars |
| DT-S5 | Sidecar configuration MUST be persisted in NATS KV and recoverable after application restart |
| DT-S6 | Sidecars MUST NOT require shared memory, named pipes, or Unix sockets — NATS is the sole IPC mechanism |

### 29.3 Network Requirements (DT-N)

| ID | Requirement |
|----|-------------|
| DT-N1 | NATS leaf node connections MUST use TLS when crossing trust zone boundaries (field → hub) |
| DT-N2 | Leaf nodes MUST support dial-out-only connectivity (leaf initiates connection to hub) |
| DT-N3 | Leaf nodes MUST support WebSocket transport for traversal of HTTP proxies and corporate firewalls |
| DT-N4 | Subject filtering MUST be configurable per leaf node to reduce bandwidth on constrained links |
| DT-N5 | Store-and-forward MUST be supported for disconnected operations with automatic replay on reconnection |
| DT-N6 | Multi-host NATS clusters MUST use mTLS for inter-node communication |

### 29.4 Security Requirements (DT-SEC)

| ID | Requirement |
|----|-------------|
| DT-SEC1 | Local-only NATS servers (embedded mode) MUST bind to 127.0.0.1 only |
| DT-SEC2 | Multi-host deployments MUST implement NATS account-based access control |
| DT-SEC3 | Certificate management MUST support rotation at mission boundaries |
| DT-SEC4 | Tauri filesystem scoping MUST restrict WebView access to authorized directories |
| DT-SEC5 | Multi-window deployments MUST assign least-privilege capabilities per window |
| DT-SEC6 | JetStream data directories MUST NOT be writable by the WebView process |

### 29.5 Performance Requirements (DT-P)

| ID | Requirement |
|----|-------------|
| DT-P1 | The core application MUST support at least 1,000 signals per second through the d2ts pipeline |
| DT-P2 | End-to-end latency from sidecar signal publication to rendering MUST be less than 500ms for decoded signals |
| DT-P3 | JetStream MUST support 24-hour signal replay at 10x real-time speed |
| DT-P4 | The total memory footprint of core + embedded NATS + 3 sidecars MUST NOT exceed 2 GB under normal operation |
| DT-P5 | GPU rendering (R3F layer) SHOULD gracefully degrade to CPU rendering when GPU is unavailable |
| DT-P6 | Store-and-forward replay MUST complete within 2x the disconnection duration |

### 29.6 Operational Requirements (DT-O)

| ID | Requirement |
|----|-------------|
| DT-O1 | Field deployments MUST support standalone operation without network connectivity |
| DT-O2 | EMCON mode MUST disable all transmit-capable sidecars while maintaining receive-only collection |
| DT-O3 | Session state MUST be exportable and importable for shift handoff via NATS KV |
| DT-O4 | The application MUST support operation on battery power with a defined SWaP budget |
| DT-O5 | Headless collection nodes MUST be remotely configurable via NATS control subjects |
| DT-O6 | The containerized deployment MUST use Docker Compose for service orchestration |

---

## 30. Open Questions

### 30.1 Unresolved Design Decisions

1. **NATS server embedding vs. sidecar**: Should NATS be embedded directly into the
   Tauri Rust binary (using `nats-server` as a Go library via FFI or `nats-server`
   reimplemented in Rust) rather than running as a separate sidecar process? Embedding
   eliminates the process management overhead but couples the NATS lifecycle to the
   application lifecycle.

2. **WebGPU migration**: WebKitGTK 2.48+ and WebView2 both have experimental WebGPU
   support. Should Tsingou migrate the R3F layer from WebGL to WebGPU for improved
   GPU utilization? This would require Three.js WebGPU backend adoption.

3. **IQ data transport**: For high-bandwidth SDR IQ streaming, should NATS be replaced
   with shared memory or memory-mapped files for local sidecar → core communication?
   The current NATS-only contract (DT-S6) may be too restrictive for 20+ MHz IQ streams.

4. **GNU Radio containerization**: Should GNU Radio be deployable as a Docker container
   with USB passthrough, eliminating the local installation requirement? This simplifies
   deployment but adds Docker as a dependency.

5. **Sidecar update mechanism**: How should sidecars be updated independently of the
   core application? Auto-update via NATS-transported binaries? Package manager integration?

6. **Raspberry Pi GPU**: The Raspberry Pi 4/5 has VideoCore VI/VII GPU. Can the
   Tsingou rendering layers run on Pi hardware for low-SWaP analyst stations?

### 30.2 Areas Requiring Empirical Validation

1. **NATS memory footprint** at scale — Benchmarks needed for 10,000+ signals/s with
   JetStream persistence on constrained hardware
2. **Leaf node reconnection time** — How long does JetStream replay take for 4h of
   buffered signals over a 1 Mbps link?
3. **WebView rendering performance** — R3F + visx + p5 concurrent rendering on
   integrated GPUs (Intel UHD 620 baseline)
4. **Battery life** under active SDR collection — Measured SWaP vs. estimated
5. **Cross-platform sidecar compatibility** — Build and test matrix validation

---

## 31. Bibliography

### Standards and Specifications

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [SIGMF] | The SigMF Project, "Signal Metadata Format Specification", v1.0.0, 2023. https://github.com/sigmf/SigMF |

### Platform Documentation

| Key | Reference |
|-----|-----------|
| [TAURI-V2] | Tauri Contributors, "Tauri v2 Documentation", 2024-2025. https://v2.tauri.app/ |
| [TAURI-SIDECAR] | Tauri Contributors, "Embedding External Binaries", 2025. https://v2.tauri.app/develop/sidecar/ |
| [TAURI-FS] | Tauri Contributors, "File System Plugin", 2025. https://v2.tauri.app/plugin/file-system/ |
| [TAURI-CAPABILITIES] | Tauri Contributors, "Capabilities", 2025. https://v2.tauri.app/security/capabilities/ |

### NATS Documentation

| Key | Reference |
|-----|-----------|
| [NATS-SERVER] | Synadia Communications, "NATS Server", 2024-2025. https://docs.nats.io/ |
| [NATS-LEAF] | Synadia Communications, "Leaf Nodes", 2025. https://docs.nats.io/running-a-nats-service/configuration/leafnodes |
| [NATS-JETSTREAM] | Synadia Communications, "JetStream", 2025. https://docs.nats.io/nats-concepts/jetstream |
| [NATS-EDGE] | Synadia Communications, "Adaptive Edge Architecture", 2024. https://nats.io/blog/synadia-adaptive-edge/ |
| [NATS-MACHINEMETRICS] | Synadia Communications, "MachineMetrics: Industrial IoT at the Edge", 2024. https://www.synadia.com/customer-stories/machinemetrics |

### SDR and Signal Processing

| Key | Reference |
|-----|-----------|
| [GNURADIO] | GNU Radio Project, "GNU Radio Documentation", 2025. https://wiki.gnuradio.org/ |
| [PYRTLSDR] | pyrtlsdr Contributors, "pyrtlsdr: Python wrapper for librtlsdr", 2024. https://github.com/pyrtlsdr/pyrtlsdr |
| [PYSDR] | Dr. Marc Lichtman, "PySDR: A Guide to SDR and DSP using Python", 2024. https://pysdr.org/ |
| [RTLPOWERFFTW] | AD-Vega, "rtl-power-fftw: Power spectrum for RTLSDR", 2023. https://github.com/AD-Vega/rtl-power-fftw |
| [SIGPI] | Joe Cupano, "SIGpi: A SIGINT Go-kit", 2024. https://github.com/joecupano/SIGpi |

### Architecture Patterns

| Key | Reference |
|-----|-----------|
| [BURNS-SIDECARS] | Burns, B. and Oppenheimer, D., "Design Patterns for Container-Based Distributed Systems", USENIX HotCloud, 2016 |
| [ADR-011] | Val, "ADR-011: SDR Integration via GNU Radio Bridge + RTL-SDR Sidecar", Tsingou ADR, 2026 |

### WebView and Rendering

| Key | Reference |
|-----|-----------|
| [WEBVIEW2-GPU] | Microsoft, "WebView2 GPU Performance", 2025. https://github.com/MicrosoftEdge/WebView2Feedback/issues/5072 |
| [WEBKITGTK-248] | WebKitGTK Project, "WebKitGTK 2.48 Highlights", 2025. https://webkitgtk.org/2025/04/08/webkitgtk-2.48.html |
| [WEBKITGTK-250] | WebKitGTK Project, "WebKitGTK 2.50 Highlights", 2025. https://webkitgtk.org/2025/11/26/webkitgtk-2.50.html |

### Cross-References to Other RFC Sections

| Section | Reference |
|---------|-----------|
| TSG.6 | Architecture Overview — overall system architecture |
| TSG.7 | Signal Pipeline — d2ts graph architecture |
| TSG.11 | NATS Messaging Fabric — NATS subject naming, JetStream streams, KV buckets |
| TSG.16 | SDR Hardware Landscape — hardware device specifications |
| TSG.17 | GNU Radio Bridge — DSP flowgraph architecture |
| TSG.18 | SigMF Codec — signal metadata format |
| TSG.19 | Spectrum Visualization — rendering pipeline for SDR data |
| TSG.20-24 | Rendering Surface — 4-layer rendering architecture |
| TSG.32 | Effect-TS Architecture — service composition patterns |
| TSG.36 | EW Doctrine — operational context for field deployments |

---

<!-- ASSEMBLY NOTES
Section: TSG.34 — Deployment Topology
Part: VII — Implementation (Normative)
Author: ew-doctrine-advisor
Tables: 34-1 through 34-43
Normative Requirements: DT-C1-6, DT-S1-6, DT-N1-6, DT-SEC1-6, DT-P1-6, DT-O1-6
Open Questions: 6 design decisions + 5 empirical validation areas
Bibliography: 27 references across 6 categories
Cross-references: TSG.6, TSG.7, TSG.11, TSG.16-19, TSG.20-24, TSG.32, TSG.36
Dependencies: Requires TSG.6, TSG.11 for NATS fabric; TSG.16-17 for SDR sidecars
-->

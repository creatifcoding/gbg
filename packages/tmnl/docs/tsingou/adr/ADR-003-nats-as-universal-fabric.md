# ADR-003: NATS as Universal Signal Fabric

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaires `tsingou-source-adapters` (NATS role), `tsingou-adapter-serial` (Holonet bridge), `tsingou-adapter-filewatch` (Holonet bridge)

---

## Context

Tsingou ingests signals from diverse sources: hardware (MIDI, serial, OSC), network (HTTP, WebSocket, RSS), and local (file watch). Some sources can't run in the Tauri webview (Node.js serial, UDP for OSC, filesystem watchers). A universal transport fabric is needed to bridge sidecar processes with the main application.

## Decision

**NATS serves all five roles**: direct source, message bus, bridge for non-NATS sources, fan-out, and JetStream replay.

### Five NATS Roles

| Role | Description | Example |
|------|-------------|---------|
| **Direct source** | Tsingou subscribes to NATS subjects directly | External system publishes sensor data to `tsingou.signal.>` |
| **Message bus** | Internal communication between components | `tsingou.internal.>` for system events |
| **Bridge** | Sidecar processes publish hardware data to NATS | Serial sidecar → `tsingou.signal.serial.COM3` |
| **Fan-out** | Multiple consumers on same signals | Multiple analysis views on same feed |
| **JetStream replay** | Historical signal playback | Replay last 24h of signals for retrospective analysis |

### Holonet Bridge Pattern

Sources that can't run in the Tauri webview use a sidecar → NATS → adapter pattern:

```
Sidecar (Node/Bun)              NATS              Webview (Tauri)
┌─────────────────┐                              ┌───────────────────┐
│ @effect/platform │                              │ HolonetBridgeAdapter│
│ FileSystem.watch │──publish──►  subject  ──────►│   subscribe via    │
│ or serialport    │             tsingou.         │   NatsPubSubService│
│ or osc.js UDP    │             signal.*         │   → push(signal)   │
└─────────────────┘                              └───────────────────┘
```

### Sources Using Each Pattern

| Source | Pattern | NATS Subject |
|--------|---------|-------------|
| NATS (direct) | Direct subscribe | `tsingou.signal.nats.>` |
| HTTP/SSE | In-process adapter | N/A (direct HttpClient) |
| WebSocket | In-process adapter | N/A (direct Socket) |
| RSS | In-process adapter | N/A (direct HttpClient) |
| FileWatch | Holonet bridge (sidecar) | `tsingou.signal.file-watch.>` |
| Serial | Holonet bridge (sidecar) | `tsingou.signal.serial.<port>` |
| OSC | Holonet bridge (sidecar) | `tsingou.signal.osc.>` |
| MIDI | Holonet bridge (sidecar) | `tsingou.signal.midi.>` |

## Consequences

### Positive
- Single transport for all sidecar-bridged sources — one `HolonetBridgeAdapter` handles FileWatch, Serial, OSC, MIDI
- JetStream enables signal replay — critical for SIGINT retrospective analysis
- Fan-out for multiple analysis views without duplicating adapter connections
- NATS KV for schema registry — pattern reused from Holonet `NatsKVService`

### Negative
- NATS dependency for sidecar sources — requires NATS server running
- Latency overhead for bridge pattern (~1-5ms per hop vs in-process)
- Schema registry in NATS KV requires network access for schema hydration

### Risks
- NATS server downtime blocks sidecar-bridged sources (mitigated: JetStream persistence)
- Message ordering across subjects not guaranteed (mitigated: per-subject ordering + version tracking)

## Implementation

- **Holonet stack**: `src/lib/holonet/nats/` — NatsConnectionService, NatsPubSubService, NatsStreamService, NatsKVService
- **Bridge adapter**: `adapters/HolonetBridgeAdapter.ts` — generic sidecar subscriber
- **Config factories**: `makeFileWatchBridgeConfig()`, `makeSerialBridgeConfig()`, `makeOscBridgeConfig()`
- **Schema registry**: `services/SchemaRegistry.ts` — wraps Holonet SchemaRegistry + NatsKVService
- **NATS config**: `docker/nats/nats-server.conf` — JetStream enabled

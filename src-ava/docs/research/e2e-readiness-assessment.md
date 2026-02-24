# E2E Readiness Assessment — ava-fusion-runtime

> **Date**: 2026-02-20
>
> **Scope**: Audit of what's needed to run the fusion pipeline end-to-end
> with real sensor data flowing through NATS JetStream. Identifies every
> gap between the current "library" state and a working system binary.
>
> **Verdict**: The pipeline is a **brain in a jar** — all internals are
> solid (562 tests passing), but every I/O boundary is missing.

---

## Executive Summary

| Metric | Status |
|--------|--------|
| Core algorithms | 562 tests passing (241 ava-fusion + 321 ava-fusion-runtime) |
| Actor lifecycle | Full GenServer impls, supervision tree, cancel propagation |
| asupersync coverage | ~55% API surface utilized |
| I/O boundaries | **Zero** — no binary, no NATS subscriber, no inter-actor routing |
| Data ingest | **Zero** — no real data format parsing |
| Output path | **Zero** — no result emission |

**Bottom line**: We have a world-class fusion engine that can't receive or emit a single byte.

---

## Architecture: Current vs Required

```
                    CURRENT STATE
                    ─────────────
                    ┌─────────────────────────────┐
                    │   ava-fusion (types crate)   │ ← 241 tests
                    │   ava-fusion-runtime (actors) │ ← 321 tests
                    │                               │
                    │   6 actors, supervision tree   │
                    │   Cancel propagation, budgets  │
                    │   Self-scheduling timers       │
                    │                               │
                    │   BUT: no main(), no NATS,     │
                    │   no subscriber, no output     │
                    └─────────────────────────────┘

                    REQUIRED STATE
                    ──────────────
    ┌──────────┐     ┌──────────────┐     ┌─────────────────────┐
    │ Data     │     │   NATS       │     │  Pipeline Binary    │
    │ Feeder   │────►│  JetStream   │────►│                     │
    │ (binary) │     │  (docker)    │     │  main.rs            │
    └──────────┘     │              │     │    ├─ NATS connect   │
                     │  KV buckets  │◄────│    ├─ subscribe      │
    ┌──────────┐     │  Streams     │     │    ├─ parse payload  │
    │ OpenSky  │     │  Subjects    │     │    ├─ cast to actor  │
    │ API      │     └──────────────┘     │    ├─ actor tree     │
    └──────────┘                          │    └─ publish results│
                                          └─────────────────────┘
         ▲                                         │
         │              ┌──────────┐               │
         └──────────────│ Results  │◄──────────────┘
                        │ Consumer │
                        │ (future) │
                        └──────────┘
```

---

## Gap Analysis

### BLOCKER: No Binary Entry Point

**Gap ID**: E2E-1
**Severity**: BLOCKER
**Location**: Missing `src-ava/ava-fusion-runtime/src/main.rs`

The runtime crate is a library (`lib.rs`). There is no binary target.
Without a `main()`, the pipeline cannot start.

**Required**:
```rust
#[tokio::main]  // or asupersync::main
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Parse CLI args / env config
    // 2. Connect to NATS
    // 3. Build PipelineConfig from env
    // 4. Start AppSpec supervision tree
    // 5. Subscribe to NATS subjects
    // 6. Bridge NATS messages → SensorIngestor casts
    // 7. Block on shutdown signal
}
```

**Cargo.toml change**:
```toml
[[bin]]
name = "ava-fusion"
path = "src/main.rs"
```

**Complexity**: MEDIUM — straightforward binary, but requires all other gaps resolved first.

---

### BLOCKER: No NATS Subscriber Bridge

**Gap ID**: E2E-2
**Severity**: BLOCKER
**Location**: Missing entirely

The SensorIngestor actor has a `handle_cast(SensorCast::IngestReading { ... })` interface,
but nothing subscribes to NATS subjects and sends those casts. The subscriber bridge must:

1. Connect to NATS JetStream
2. Subscribe to sensor data subjects (e.g., `sensor.adsb.>`, `sensor.ais.>`)
3. Parse incoming bytes into sensor readings
4. Cast readings to the appropriate SensorIngestor actor

**Subject taxonomy** (proposed):
```
sensor.adsb.raw          # Raw ADS-B position reports
sensor.ais.raw           # Raw AIS vessel messages
sensor.radar.tracks      # Radar track updates
sensor.elint.intercepts  # ELINT signal intercepts
fusion.results.>         # Pipeline output (publish side)
fusion.alarms.>          # Alarm notifications
```

**Complexity**: MEDIUM — NATS async client + message parsing + actor dispatch.

---

### BLOCKER: No Inter-Actor Message Routing

**Gap ID**: E2E-3
**Severity**: BLOCKER
**Location**: All actors — `handle_info` / `handle_cast` contain TODO stubs

Currently, actors process messages internally but don't forward results to
downstream actors. The routing map:

```
SensorIngestor ──cast──► FusionEngine (IngestReading)
FusionEngine   ──cast──► TrackManager (NewCorrelation)
FusionEngine   ──cast──► AlarmEvaluator (CorrelationEvent)
TrackManager   ──cast──► AlarmEvaluator (TrackStateChange)
AbsenceDetector──cast──► AlarmEvaluator (AbsenceEvent)
AlarmEvaluator ──info──► [NATS publish] (AlarmNotification)
```

Each actor needs `GenServerRef` handles to its downstream consumers.
The supervision tree's `depends_on` ordering is already correct; the
handles just need to be threaded through.

**Pattern**: Store `GenServerRef<DownstreamActor>` in each actor's state,
passed via the ChildSpec factory closure.

**Complexity**: HIGH — requires coordinating handle extraction across the
supervision tree. The factory closure pattern makes this non-trivial
because handles aren't available until after `spawn_gen_server()`.

---

### CRITICAL: No Payload Parsing

**Gap ID**: E2E-4
**Severity**: CRITICAL
**Location**: Missing entirely

Raw sensor data arrives as bytes/JSON. Nothing converts it to
`ava-fusion` domain types (`Observation`, `SignalReading`, etc.).

**Required parsers**:

| Format | Source | Key Fields |
|--------|--------|------------|
| OpenSky JSON | ADS-B API | `icao24`, `callsign`, `longitude`, `latitude`, `baro_altitude`, `velocity`, `true_track`, `time_position` |
| AIS NMEA / CSV | NOAA Marine Cadastre | `MMSI`, `BaseDateTime`, `LAT`, `LON`, `SOG`, `COG`, `Heading`, `VesselType` |
| Radar JSON | Custom/simulated | `track_id`, `range_nm`, `bearing_deg`, `altitude_ft`, `speed_kts` |

**Complexity**: MEDIUM — straightforward serde deserialization, but needs
schema definitions for each format.

---

### CRITICAL: No Output Sink

**Gap ID**: E2E-5
**Severity**: CRITICAL
**Location**: Missing entirely

FusionEngine produces `FusionResult` structs, but they go nowhere.
Need a sink that:

1. Serializes results to JSON
2. Publishes to NATS subjects (`fusion.results.tier1`, `fusion.results.tier2`, etc.)
3. Optionally writes to NATS KV for latest-state queries

**Complexity**: LOW — inverse of the subscriber bridge.

---

### CRITICAL: No Real JoinPath Configs

**Gap ID**: E2E-6
**Severity**: CRITICAL
**Location**: `pipeline.rs` uses placeholder configs

The `FusionTierConfig` structs use empty/default values. For E2E validation
we need at least one real join path:

**Minimum viable config — ADS-B Identity Join**:
```rust
JoinPathEntryV2 {
    id: JoinPathId::new("adsb-identity"),
    name: "ADS-B ICAO Identity".into(),
    tier: FusionTier::Tier1HardKey,
    join_type: JoinType::Identity,
    left: JoinPathSide {
        signal_kind: SignalKind::ADSB,
        key_path: "$.icao24".into(),
    },
    right: JoinPathSide {
        signal_kind: SignalKind::ADSB,
        key_path: "$.icao24".into(),
    },
    // ... defaults for remaining fields
}
```

**Complexity**: LOW — data entry, not engineering.

---

### HIGH: No Docker Compose for NATS

**Gap ID**: E2E-7
**Severity**: HIGH
**Location**: Missing `src-ava/docker-compose.yml`

Need a development docker compose that starts:
- NATS server with JetStream enabled
- KV bucket pre-configuration
- Stream pre-configuration

```yaml
services:
  nats:
    image: nats:2.10-alpine
    command: ["--jetstream", "--store_dir=/data", "-p", "4222"]
    ports:
      - "4222:4222"   # Client
      - "8222:8222"   # Monitoring
    volumes:
      - nats-data:/data
volumes:
  nats-data:
```

**Complexity**: LOW — standard NATS JetStream setup.

---

### HIGH: No Data Feeder

**Gap ID**: E2E-8
**Severity**: HIGH
**Location**: Missing entirely

A separate binary (or script) that fetches real sensor data and publishes
to NATS subjects. Two viable data sources:

**1. OpenSky Network (ADS-B)**
- REST API: `https://opensky-network.org/api/states/all`
- Free tier: anonymous access, 10-second resolution
- Returns JSON array of aircraft state vectors
- Fields: `icao24` (hex), `callsign`, `origin_country`, `longitude`, `latitude`, `baro_altitude`, `velocity`, `true_track`, `on_ground`, `time_position`
- Perfect for Tier 1 (hard key = `icao24` hex code)
- Polling interval: 10s (API rate limit)

**2. NOAA Marine Cadastre (AIS)**
- Bulk download: `https://marinecadastre.gov/ais/`
- CSV format with headers
- Fields: `MMSI`, `BaseDateTime`, `LAT`, `LON`, `SOG`, `COG`, `Heading`, `VesselName`, `IMO`, `VesselType`, `Status`, `Length`, `Width`
- Perfect for Tier 1 (hard key = `MMSI`)
- Replay mode: read CSV rows and publish at configurable rate

**Feeder modes**:
| Mode | Description | Use Case |
|------|-------------|----------|
| `live` | Poll OpenSky API every 10s, publish to NATS | Real-time validation |
| `replay` | Read CSV/JSON file, publish at configurable rate | Deterministic testing |
| `burst` | Dump entire dataset at once | Backpressure/load testing |

**Complexity**: MEDIUM — HTTP client + NATS publisher + rate control.

---

### MEDIUM: No Graceful Shutdown Protocol

**Gap ID**: E2E-9
**Severity**: MEDIUM
**Location**: Missing in main.rs (which doesn't exist yet)

The pipeline binary needs to handle SIGINT/SIGTERM:
1. Signal received
2. Stop NATS subscribers (no new messages)
3. Drain in-flight messages
4. Send shutdown to supervision tree
5. Wait for actors to stop (with timeout)
6. Flush NATS KV state
7. Exit

asupersync's `AppSpec` has built-in shutdown support via `Budget::MINIMAL`
on all actors, but the orchestration from signal to AppSpec shutdown
needs to be wired.

**Complexity**: LOW — standard signal handling + AppSpec integration.

---

## Data Sources Deep Dive

### OpenSky Network

| Attribute | Value |
|-----------|-------|
| **URL** | `https://opensky-network.org/api/states/all` |
| **Format** | JSON |
| **Update rate** | ~10 seconds |
| **Auth** | Anonymous (limited) or registered (better rate limits) |
| **Coverage** | Global ADS-B (commercial aviation) |
| **Key field** | `icao24` — unique aircraft hex identifier |
| **NATS subject** | `sensor.adsb.raw` |

**Sample response** (truncated):
```json
{
  "time": 1708444800,
  "states": [
    ["a12345", "UAL123  ", "United States", 1708444790, 1708444800,
     -87.6298, 41.8781, 10668.0, false, 230.5, 45.0, 0.0,
     null, 10972.0, "1234", false, 0]
  ]
}
```

### NOAA Marine Cadastre AIS

| Attribute | Value |
|-----------|-------|
| **URL** | `https://marinecadastre.gov/ais/` |
| **Format** | CSV (gzipped) |
| **Coverage** | US coastal waters |
| **Key field** | `MMSI` — unique vessel identifier |
| **NATS subject** | `sensor.ais.raw` |

**Sample row**:
```csv
MMSI,BaseDateTime,LAT,LON,SOG,COG,Heading,VesselName,IMO,VesselType,Status,Length,Width
366999000,2024-01-01T00:00:00,29.9500,-90.0667,0.0,511.0,511,VESSEL_A,0,70,0,200,32
```

### Cross-Source Correlation Opportunities

| Left Source | Right Source | Join Type | Join Key | Tier |
|-------------|-------------|-----------|----------|------|
| ADS-B | ADS-B | Identity | `icao24` | Tier 1 |
| AIS | AIS | Identity | `MMSI` | Tier 1 |
| ADS-B | AIS | Spatial+Temporal | H3 cell + time bucket | Tier 2 |
| ADS-B | Radar | Spatial+Temporal | H3 cell + time bucket | Tier 2 |
| ADS-B | ADS-B | Periodicity | Route pattern FFT | Tier 3 |
| AIS | AIS | Co-occurrence | Port visit overlap | Tier 3 |

---

## Build Order

### Phase 1: Infrastructure (docker compose + NATS)

**Goal**: Running NATS JetStream with pre-configured streams and KV buckets.

**Deliverables**:
- `src-ava/docker-compose.yml`
- `src-ava/scripts/nats-init.sh` (create streams, KV buckets, subjects)

**Verification**: `nats stream ls` shows configured streams.

---

### Phase 2: Binary Shell (main.rs)

**Goal**: A binary that starts, connects to NATS, builds the supervision tree, and shuts down cleanly.

**Deliverables**:
- `src-ava/ava-fusion-runtime/src/main.rs`
- Updated `Cargo.toml` with `[[bin]]` target
- CLI arg parsing (NATS URL, pipeline config)
- Signal handler for graceful shutdown

**Verification**: Binary starts, prints "connected to NATS", shuts down on Ctrl+C.

---

### Phase 3: Inter-Actor Routing

**Goal**: Actors forward results to downstream consumers via `GenServerRef` handles.

**Deliverables**:
- Modified actor constructors to accept downstream refs
- Modified ChildSpec factories to thread refs through
- SensorIngestor → FusionEngine routing
- FusionEngine → TrackManager + AlarmEvaluator routing

**Verification**: Unit tests with mock actors verify message delivery.

---

### Phase 4: Payload Parsing + Output Sink

**Goal**: Real sensor data parsed into domain types. Results published to NATS.

**Deliverables**:
- `src-ava/ava-fusion-runtime/src/parsers/` module (OpenSky JSON, AIS CSV)
- `src-ava/ava-fusion-runtime/src/sink.rs` (result → NATS publisher)
- NATS subscriber bridge (subject → SensorIngestor cast)

**Verification**: Parse a sample OpenSky JSON payload → correct domain types.

---

### Phase 5: Real JoinPath Configs

**Goal**: At least one working Tier 1 join path with real ADS-B identity matching.

**Deliverables**:
- `src-ava/ava-fusion-runtime/src/configs/` module with preset configs
- ADS-B identity join path (icao24 matching)
- AIS identity join path (MMSI matching)

**Verification**: Two readings with same `icao24` → FusionResult emitted.

---

### Phase 6: Data Feeder

**Goal**: A binary that fetches real data and publishes to NATS.

**Deliverables**:
- `src-ava/ava-data-feeder/` new crate
- OpenSky live poller (10s intervals)
- AIS CSV replay mode
- Rate limiting and backpressure

**Verification**: `cargo run --bin ava-data-feeder -- --mode live --source opensky` publishes to NATS.

---

## E2E Smoke Test Definition

**The minimum viable E2E test**:

```
1. docker compose up -d                    # Start NATS
2. cargo run --bin ava-fusion &           # Start pipeline
3. cargo run --bin ava-data-feeder \
     --mode replay \
     --source opensky-sample.json \
     --rate 100/s                          # Feed data
4. nats sub "fusion.results.>"            # Watch output
5. Verify: FusionResult messages appear
   with correct icao24 correlations
6. Ctrl+C pipeline → clean shutdown
7. docker compose down
```

**Success criteria**:
- Pipeline starts and connects to NATS
- Data feeder publishes readings
- SensorIngestor receives and casts to FusionEngine
- FusionEngine produces FusionResult for matching icao24 keys
- Results published to `fusion.results.tier1`
- Clean shutdown on SIGINT (no orphan threads, no data loss)

---

## Dependencies Required

| Crate | Version | Purpose |
|-------|---------|---------|
| `async-nats` | `0.35` | NATS client (async, JetStream support) |
| `serde_json` | `1.0` | OpenSky JSON parsing |
| `csv` | `1.3` | AIS CSV parsing |
| `clap` | `4.5` | CLI argument parsing |
| `tokio` | `1.0` | Signal handling (compatible with asupersync) |
| `reqwest` | `0.12` | OpenSky HTTP client (data feeder only) |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| asupersync + tokio signal incompatibility | Medium | High | Test signal handling early in Phase 2 |
| GenServerRef threading through supervision tree | Medium | High | Spike handle extraction pattern before Phase 3 |
| OpenSky API rate limiting | Low | Medium | Cache responses, use replay mode for testing |
| NATS message ordering under load | Low | Medium | Use JetStream consumer with ordered delivery |
| DataflowWorker not yet integrated | N/A | N/A | Phase 5 depends on plan completion (separate track) |

---

## Relationship to Other Plans

| Document | Relationship |
|----------|-------------|
| [asupersync-gap-analysis.md](./asupersync-gap-analysis.md) | Cx method gaps — Phase 1 complete, Phase 2 complete |
| [asupersync-integration-patterns.md](./asupersync-integration-patterns.md) | Implementation patterns used in actor code |
| [differential-dataflow-fusion-integration.md](./differential-dataflow-fusion-integration.md) | DataflowWorker plan — parallel track, Phase 5 prerequisite |
| [domain-expert-synthesis.md](./domain-expert-synthesis.md) | Fusion domain model that actors implement |

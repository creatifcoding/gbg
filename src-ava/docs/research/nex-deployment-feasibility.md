# NEX Deployment Feasibility — ava-fusion-runtime

> **Date**: 2026-02-20
>
> **Scope**: Feasibility assessment for running the ava-fusion-runtime
> pipeline as NATS NEX workloads. Evaluates deployment topologies,
> constraints, and a migration path from development to production.
>
> **Verdict**: NEX can host the pipeline as a **native binary workload**.
> WASM is not viable. Start monolith, split later.

---

## What is NEX?

NATS Execution Engine (NEX) is a workload orchestration layer built on
NATS. It runs processes on "NEX nodes" (machines running `nex node`)
and manages their lifecycle through NATS control plane messages.

### Workload Types

| Type | Runtime | Threading | Networking | Status |
|------|---------|-----------|------------|--------|
| **Native binary** | OS process | Full | Full | Stable |
| **WASM (wasm32-wasi)** | Wasmtime sandbox | Single-threaded | Limited | Experimental |
| **JavaScript** | V8 isolate | Event loop | Fetch API | Experimental |
| **OCI container** | Container runtime | Full | Full | Planned |

### NEX Supervision Model

| Feature | Capability |
|---------|-----------|
| Process restart | Yes — on crash, configurable |
| Health checking | Basic — process alive check |
| Resource limits | Memory/CPU via cgroups (native) |
| Dependency ordering | **No** — workloads start independently |
| Actor-level restart | **No** — process-level only |
| State persistence | **No** — workloads are stateless |
| Log aggregation | Via NATS subjects |
| Metrics | OpenTelemetry compatible |

---

## Can ava-fusion-runtime Run on NEX?

### Native Binary: YES

The pipeline can compile to a static Linux binary (musl target) and
run as a NEX native workload.

```bash
# Cross-compile for musl (static linking)
cargo build --release --target x86_64-unknown-linux-musl -p ava-fusion-runtime

# Deploy via NEX CLI
nex workload run \
  --name ava-fusion \
  --type native \
  --binary ./target/x86_64-unknown-linux-musl/release/ava-fusion \
  --env NATS_URL=nats://localhost:4222 \
  --env PIPELINE_CONFIG=tier1-adsb
```

**Requirements**:
- Static linking (musl) for portability across NEX nodes
- NATS URL passed via environment variable
- Pipeline config via env or NATS KV

### WASM: NO

The fusion pipeline cannot run as WASM for fundamental reasons:

| Blocker | Why |
|---------|-----|
| Threading | differential-dataflow uses OS threads. WASM is single-threaded. |
| Networking | async-nats requires TCP sockets. WASI networking is experimental. |
| Memory | Fusion state can exceed WASM linear memory defaults |
| asupersync | Runtime spawns OS threads for blocking pool + scheduler |
| Performance | No SIMD, no shared memory, significant overhead |

**Verdict**: WASM is architecturally incompatible with the pipeline.

### JavaScript: NO

The pipeline is Rust. JavaScript workers are irrelevant.

---

## Deployment Topology Options

### Option 1: Monolith (RECOMMENDED for E2E validation)

**Probability**: 85% — this is where we start.

```
┌─────────────────────────────────────────┐
│              NEX Node                    │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  ava-fusion (native binary)       │ │
│  │                                    │ │
│  │  asupersync runtime               │ │
│  │    ├── SensorIngestor (×2)        │ │
│  │    ├── FusionEngine Tier1         │ │
│  │    ├── FusionEngine Tier2         │ │
│  │    ├── FusionEngine Tier3         │ │
│  │    ├── AlarmEvaluator             │ │
│  │    ├── TrackManager               │ │
│  │    ├── AbsenceDetector            │ │
│  │    └── EntityResolver             │ │
│  │                                    │ │
│  │  NATS subscriber bridge           │ │
│  │  Result publisher                 │ │
│  └────────────────────────────────────┘ │
│                                          │
│  NATS Server (JetStream)                │
└─────────────────────────────────────────┘
```

**Pros**:
- Simplest to build and debug
- All inter-actor communication is in-process (zero network overhead)
- asupersync supervision handles all restarts internally
- Single binary to deploy

**Cons**:
- No horizontal scaling
- Single point of failure (mitigated by NEX process restart)
- All tiers share CPU/memory

---

### Option 2: Split by Tier

**Probability**: 10% — useful for scaling, but adds complexity.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   NEX Node A     │  │   NEX Node B     │  │   NEX Node C     │
│                  │  │                  │  │                  │
│  Ingestor(s)     │  │  FusionEngine    │  │  FusionEngine    │
│  + Tier1 Engine  │  │  Tier2           │  │  Tier3           │
│                  │  │                  │  │                  │
│  ──NATS──►       │  │  ◄──NATS──►      │  │  ◄──NATS──       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌──────────────────┐
                    │   NEX Node D     │
                    │                  │
                    │  AlarmEvaluator  │
                    │  TrackManager    │
                    │  AbsenceDetector │
                    │  EntityResolver  │
                    └──────────────────┘
```

**Pros**:
- Independent scaling per tier (Tier 1 is cheap, Tier 3 is expensive)
- Fault isolation between tiers
- Can upgrade tiers independently

**Cons**:
- Inter-tier communication now goes through NATS (latency)
- Requires NATS-based actor messaging (breaks GenServer ref model)
- Need distributed supervision (asupersync has this, but complexity++)
- Deployment complexity (4 binaries, coordinated rollout)

---

### Option 3: Actor-per-Workload

**Probability**: 3% — maximum granularity, maximum pain.

```
Each GenServer actor = separate NEX workload
Inter-actor messages = NATS pub/sub
```

**Pros**:
- Maximum fault isolation
- Independent scaling per actor

**Cons**:
- Defeats asupersync's supervision model entirely
- Every `GenServerRef::cast()` becomes a NATS publish (huge latency)
- 6+ workloads to manage per pipeline instance
- Debugging distributed actor failures is nightmare-grade

**Verdict**: Architecturally wrong. asupersync's value IS the in-process actor model.

---

### Option 4: Evolutionary (RECOMMENDED migration path)

**Probability**: 2% immediate, but this is the long-term trajectory.

```
Phase 1 (now):     Monolith binary, docker compose
Phase 2 (E2E):     Monolith binary, NEX single-node
Phase 3 (scale):   Split data feeder from pipeline
Phase 4 (prod):    Split by tier if load demands
```

**Decision points**:
- Split when a single node can't handle message throughput
- Split when different tiers need different hardware (GPU for Tier 3?)
- Split when uptime requirements differ between tiers

---

## NEX vs Docker compose vs Bare Metal

| Dimension | Docker compose | NEX | Bare Metal |
|-----------|---------------|-----|------------|
| **Development** | Best (standard tooling) | Good (nex CLI) | Manual |
| **Deployment** | docker push + compose up | nex workload run | scp + systemd |
| **Supervision** | Docker restart policy | NEX process restart | systemd |
| **NATS integration** | External service | Native (same infrastructure) | External |
| **Monitoring** | Docker stats + external | NATS-native metrics | Manual |
| **Scaling** | Docker Swarm/K8s | Multi-node NEX | Manual |
| **Maturity** | Production-grade | Experimental | N/A |

**Recommendation for E2E validation**: Docker compose. It's the standard,
it works everywhere, and it doesn't add experimental dependencies.

**Recommendation for production**: Evaluate NEX when it reaches stable
release. The pipeline is inherently NATS-native (all I/O through
JetStream), so NEX is a natural deployment target.

---

## asupersync + NEX Supervision Interaction

### Two Levels of Supervision

```
Level 1: NEX (process-level)
  └─ Restarts the entire binary if it crashes

Level 2: asupersync (actor-level)
  └─ Restarts individual actors within the process
  └─ OneForOne restart policy
  └─ Exponential backoff
  └─ Dependency ordering
```

**Key insight**: NEX's process restart is the **outer shell**. If the
asupersync runtime itself panics (rare), NEX restarts the whole binary.
Individual actor failures are handled by asupersync internally and
never reach NEX.

### Failure Cascade

```
Actor panic
  → asupersync catches, restarts actor (OneForOne)
  → If restart limit exceeded → supervisor stops
  → If top-level supervisor stops → process exits
  → NEX detects exit → restarts binary
  → Fresh startup → actors re-derive state from NATS data flow
```

**Recovery window**: Depends on tier (see e2e-readiness-assessment.md).
Tier 1 converges in sub-seconds. Tier 3 may take minutes.

---

## NEX Configuration

### Workload Specification

```json
{
  "name": "ava-fusion-pipeline",
  "type": "native",
  "binary": "ava-fusion",
  "description": "IIoT sensor fusion pipeline",
  "environment": {
    "NATS_URL": "nats://nats.internal:4222",
    "PIPELINE_CONFIG": "production",
    "RUST_LOG": "info,ava_fusion_runtime=debug",
    "EVAL_INTERVAL_SECS": "5"
  },
  "restart_policy": {
    "max_restarts": 5,
    "window_seconds": 300
  },
  "resources": {
    "memory_mb": 512,
    "cpu_shares": 1024
  }
}
```

### NEX Node Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 512 MB | 2 GB |
| Disk | 100 MB (binary + NATS data) | 1 GB |
| Network | 1 Gbps (NATS traffic) | 10 Gbps |
| OS | Linux (musl-compatible) | Ubuntu 22.04+ |

---

## Migration Path: Development to NEX

### Step 1: docker compose (NOW)

```yaml
services:
  nats:
    image: nats:2.10-alpine
    command: ["--jetstream", "--store_dir=/data"]
    ports: ["4222:4222", "8222:8222"]

  pipeline:
    build: ./ava-fusion-runtime
    environment:
      NATS_URL: nats://nats:4222
    depends_on: [nats]

  feeder:
    build: ./ava-data-feeder
    environment:
      NATS_URL: nats://nats:4222
      MODE: replay
    depends_on: [pipeline]
```

### Step 2: Static Binary

```bash
# Compile static musl binary
cross build --release --target x86_64-unknown-linux-musl -p ava-fusion-runtime
# Result: ~15-30 MB static binary, no runtime dependencies
```

### Step 3: NEX Single-Node

```bash
# Start NEX node
nex node up --config nex-node.json

# Deploy pipeline
nex workload run --name ava-fusion --binary ./ava-fusion

# Deploy feeder
nex workload run --name ava-feeder --binary ./ava-data-feeder
```

### Step 4: NEX Multi-Node (future)

```bash
# Node per AZ/region
nex node up --name nex-us-east-1a
nex node up --name nex-us-east-1b

# Deploy with placement
nex workload run --name ava-fusion --node nex-us-east-1a --binary ./ava-fusion
nex workload run --name ava-feeder --node nex-us-east-1b --binary ./ava-data-feeder
```

---

## Open Questions

| Question | Impact | Resolution Path |
|----------|--------|-----------------|
| Does asupersync's tokio dependency conflict with NEX's process model? | Medium | Spike: compile and run a minimal asupersync app as NEX workload |
| Can NEX pass NATS credentials to workloads securely? | Medium | Review NEX credential injection mechanism |
| What's NEX's behavior when NATS server restarts? | Medium | Test: kill NATS, observe NEX workload behavior |
| Is NEX's restart policy configurable enough for our needs? | Low | Review NEX restart config options vs asupersync's backoff |
| Can multiple NEX workloads share the same NATS connection? | Low | Likely yes (each workload is a separate process with own conn) |

---

## Recommendation

### For E2E Validation (immediate)

**Use docker compose.** It's boring, it works, and it has zero experimental risk.
The pipeline binary connects to NATS the same way regardless of how it's launched.

### For Production (future)

**Evaluate NEX when stable.** The pipeline is architecturally ready:
- Single static binary
- All I/O through NATS (native to NEX)
- Stateless process (state re-derived from data flow)
- asupersync handles internal supervision (NEX only needs process-level)

### What NOT to Do

- Don't split into micro-workloads (kills actor model benefits)
- Don't use WASM (fundamental blockers)
- Don't optimize for NEX before the pipeline works E2E
- Don't add NEX-specific code to the pipeline (keep it NATS-generic)

---

## Relationship to Other Plans

| Document | Relationship |
|----------|-------------|
| [e2e-readiness-assessment.md](./e2e-readiness-assessment.md) | Build order prerequisite — E2E before NEX |
| [asupersync-gap-analysis.md](./asupersync-gap-analysis.md) | Actor model that NEX supervises at process level |
| [asupersync-integration-patterns.md](./asupersync-integration-patterns.md) | Patterns unchanged by deployment target |
| [differential-dataflow-fusion-integration.md](./differential-dataflow-fusion-integration.md) | DataflowWorker uses OS threads — blocks WASM path |

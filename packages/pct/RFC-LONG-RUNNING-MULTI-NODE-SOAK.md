# RFC: PCT/LNK/MSH Long-Running Multi-Node Soak

Date: 2026-05-25
Status: feature plan
Parent: `#F1123 Feature-plan long-running multi-node soak`
Research task: `#4093`
Design task: `#4094`

## Intent

Design a reusable soak system for the PCT/LNK/MSH stack that can run long enough
to expose the boring, expensive failures: reconnect drift, JetStream/KV state
skew, producer-idempotency regressions, schema-resolution failures, fiber leaks,
slow consumers, outbox replay bugs, and projection worker stall patterns.

This is not another unit-test pile, Prime. This is a controlled endurance rig.

## Research evidence

### Existing repo anchors

- `packages/lnk/test/support/live-nats.ts` is the preferred local substrate:
  it starts JetStream + WebSocket NATS, accepts an external URL, and discovers
  `nats-server` via `NATS_SERVER_BIN`, `PATH`, then `/nix/store` fallback.
- `packages/msh/test/support/live-nats.ts` does the same basic server startup,
  but currently lacks the LNK harness' Nix-store binary fallback.
- `packages/lnk/test/services/wire/nats-bridge/MshBridgeLive.test.ts` proves
  LNK `MshBridgeWire` create/append/read/delete and producer idempotency against
  real JetStream + KV.
- `packages/pct/test/pct-lnk-msh-typed-proof.test.ts` proves live NATS + PCT
  HTTP schema resolution + LNK `TypedLnk` + `MshBridgeWire` across two
  independent runtimes.
- `packages/pct/test/pct-nats-schema-resolver.test.ts` proves PCT NATS
  `schema.get` / `capabilities.get` through generic MSH micro endpoints.
- `packages/pct/test/eventlog-remote-live.test.ts` is the current best example
  of real multi-process orchestration: two `pact serve` processes, temp configs,
  free ports, convergence polling, and explicit cleanup.
- `packages/tmnl/docker/docker-compose.yml` already provides persistent NATS +
  Postgres/Timescale-like local services; `docker-compose.iiot.yml` gives a
  smaller IIoT Timescale-focused DB stack.

### External / DeepWiki findings

- Official NATS Kubernetes docs recommend deploying with the official Helm chart
  and note that the default chart deploys NATS as a `StatefulSet` plus `nats-box`.
  Source: https://docs.nats.io/running-a-nats-service/nats-kubernetes
- The NATS Helm chart exposes `config.cluster`, `config.jetstream`,
  `config.jetstream.fileStore.pvc`, `promExporter`, `service`, `statefulSet`,
  `podTemplate`, and `headlessService`; it documents a 3-replica JetStream
  cluster with PVC storage and topology spread constraints. Source:
  https://github.com/nats-io/k8s/blob/main/helm/charts/nats/README.md
- The same chart recommends equal CPU/memory requests and limits for predictable
  performance / Guaranteed QoS and gives a production JetStream minimum example
  of 2 CPU and 8Gi memory. Source:
  https://github.com/nats-io/k8s/blob/main/helm/charts/nats/README.md
- NATS monitoring exposes `/varz`, `/connz`, `/routez`, `/subsz`, `/accountz`,
  `/accstatz`, `/jsz`, and `/healthz`; `/jsz` carries JetStream stats and
  `/healthz` has JetStream-related checks. Source:
  https://docs.nats.io/running-a-nats-service/nats_admin/monitoring
- NATS slow-consumer behavior is protective: a slow consumer can be cut off by
  the server, and client reconnect/error handling is required. Source:
  https://docs.nats.io/running-a-nats-service/nats_admin/slow_consumers
- The NATS JetStream Controller / NACK can manage Streams, Consumers, KV stores,
  Object stores, and Accounts through CRDs, but resources managed by NACK are
  expected to be exclusively managed by NACK. Source:
  https://github.com/nats-io/k8s/blob/main/helm/charts/nack/README.md
- DeepWiki on `nats-io/k8s` confirmed the useful Kubernetes surfaces: NATS Helm
  chart, optional NACK chart, JetStream fileStore/PVC config, cluster replicas,
  monitor port/probes, and the NACK exclusivity caveat.
- DeepWiki on `nats-io/nats-server` confirmed the soak-critical behaviors:
  JetStream clustering, restart/catch-up behavior, `store_dir`, healthz, monitor
  endpoints, reconnects, long-running server tests, and restart/chaos patterns.

## Decision: yes, Kubernetes is useful — but as tier 2, not the first knife

Kubernetes buys real value for soak testing:

- pod restart / reschedule lifecycle;
- StatefulSet identity + PVC-backed JetStream stores;
- headless service DNS for NATS cluster routing;
- resource requests/limits to catch pressure issues;
- Services and Jobs for multi-node app topology;
- cluster-internal monitoring scrape targets;
- later chaos primitives: pod delete, rollout restart, network delay, node drain.

But the first implementation should not start in Kubernetes. The reusable core
must run locally first, then acquire a Kubernetes substrate adapter. Otherwise we
will debug Helm, CRDs, and cluster permissions while the actual PCT/LNK/MSH soak
contract remains fuzzy. Elegant systems earn their orchestration layer.

## Soak tiers

### Tier 0 — Local process soak

Purpose: developer/operator repeatability without cluster prerequisites.

Substrate:

- preferred: `packages/lnk/test/support/live-nats.ts`;
- external URL mode for existing NATS;
- optional local Timescale via `packages/tmnl/docker/docker-compose.iiot.yml` once
  real Timescale runtime ports exist.

Runtime model:

- one local NATS daemon;
- multiple independent Effect runtimes in one Bun process;
- optional child `pact serve` processes when testing HTTP/EventLogRemote surfaces;
- JSONL artifact output under `packages/pct/.soak-runs/<run-id>/`.

Use cases:

- 15-60 minute CI/manual soak;
- schema resolver and LNK writer/reader endurance;
- projection worker memory/durable-runtime simulation;
- producer idempotency and reconnect smoke.

### Tier 1 — Docker Compose substrate soak

Purpose: persistent local services without Kubernetes.

Substrate:

- `packages/tmnl/docker/docker-compose.yml` for persistent NATS + Postgres stack;
- `packages/tmnl/docker/docker-compose.iiot.yml` for smaller Timescale-style DB
  target.

Runtime model:

- app nodes still launch from Bun scripts;
- substrate survives process restarts;
- useful for restart/resume and durable outbox/checkpoint verification.

### Tier 2 — Kubernetes soak

Purpose: production-shaped multi-node behavior.

Substrate:

- official NATS Helm chart;
- start with one NATS cluster, three replicas, JetStream enabled, fileStore PVC;
- expose client service and monitor service cluster-internal;
- enable `promExporter` when Prometheus is available;
- use topology spread constraints for pod distribution.

Application topology:

- `pct-control-plane` Deployment: 2 replicas hosting `schema.get` and
  `capabilities.get` over MSH micro endpoints;
- `lnk-writer` Job/Deployment: N producers writing pure source streams;
- `lnk-reader` Job/Deployment: M independent readers verifying durable offsets;
- `projection-worker` Deployment: K workers running scheduler/runtime;
- `outbox-publisher` Deployment: drains frame-stream outbox lane;
- `soak-verifier` Job: periodically checks integrity invariants;
- `soak-collector` sidecar/job: scrapes NATS monitor endpoints and app JSONL.

NACK policy:

- Do **not** use NACK for LNK/MSH app-owned streams in the first Kubernetes soak.
  LNK/MSH create JetStream/KV resources dynamically and NACK expects exclusive
  ownership. Mixing them is how we get a tiny reconciliation goblin with a knife.
- Consider NACK later only for operator-owned static resources with a strict
  boundary: e.g. pre-created shared streams not mutated by the app.

### Tier 3 — Kubernetes chaos overlay

Purpose: hostile network/failure feature lane, not baseline soak.

Faults:

- rolling restart NATS pods;
- delete one app pod;
- kill one projection worker mid-frame;
- pause/restart outbox publisher;
- inject slow consumer/backpressure;
- later: network partition/delay via Litmus/Chaos Mesh or equivalent.

This belongs primarily to `#F1125`, but the soak runner should expose hooks so
chaos can mount cleanly later.

## Workload model

Use deterministic synthetic vitals streams because they already exist in tests
and projection examples:

- source streams:
  - `vitals.heart_rate`
  - `vitals.spo2`
  - `vitals.temperature`
- frame output:
  - table: `vitals_snapshot_frames`
  - optional frame stream: `frames.vitals.snapshot`

Workload phases:

1. `warmup`: create schemas, create streams, start readers/workers.
2. `steady`: publish at configured rates for duration.
3. `restart`: optional restart/resume checkpoint phase.
4. `drain`: stop producers, wait for readers/projections/outbox to catch up.
5. `verify`: run final invariant checks and write summary.

## Metrics and artifacts

Each run writes:

```text
packages/pct/.soak-runs/<run-id>/
├── config.json
├── events.jsonl
├── nats-varz.jsonl
├── nats-connz.jsonl
├── nats-jsz.jsonl
├── pct-capabilities.jsonl
├── lnk-streams.jsonl
├── projection-workers.jsonl
├── outbox.jsonl
├── integrity.json
└── summary.md
```

NATS monitor samples:

- `/healthz`
- `/varz` for memory, CPU, connections, slow consumer count;
- `/connz?state=open&subs=1` for client pressure;
- `/jsz?accounts=true&streams=true&consumers=true` for JetStream state;
- `/routez` only when cluster mode is enabled.

Application samples:

- PCT `capabilities.get` or HTTP `/capabilities`;
- LNK stream heads and offsets;
- projection scheduler snapshots and pressure;
- outbox pending/failed/poison counts;
- process RSS/heap where local process mode can observe it.

## Integrity invariants

A soak run fails if any critical invariant breaks:

- PCT schema resolution success rate below threshold.
- LNK writer append count != durable read count after drain.
- Producer idempotency duplicate replay creates extra payloads.
- Reader offsets regress or disappear.
- Projection completed-frame count deviates from expected deterministic frame
  count after drain.
- Outbox pending count remains non-zero past drain grace.
- Any outbox record enters poison state.
- NATS `/healthz` fails outside declared chaos windows.
- Slow-consumer count increases above configured threshold.
- Reconnect/restart phase fails to recover within recovery SLO.

Warnings, not immediate failure:

- transient reconnects inside expected restart windows;
- retryable outbox failures that clear before drain;
- temporary pressure/parking within configured budget.

## Configuration schema sketch

The implementation should define this with Effect Schema, not raw TS interfaces:

```ts
SoakConfig = {
  runId?: string
  durationMs: number
  substrate: "local-nats" | "external-nats" | "docker-compose" | "kubernetes"
  nats: {
    servers?: string
    monitorUrl?: string
    clusterReplicas?: number
    jetstreamFileStore?: { pvcSize: string; storageClass?: string }
  }
  nodes: {
    pctControlPlanes: number
    lnkWriters: number
    lnkReaders: number
    projectionWorkers: number
    outboxPublishers: number
  }
  workload: {
    patients: number
    hzPerPatient: number
    duplicateRate: number
    malformedRate: number
    streamPrefix: string
  }
  verifier: {
    sampleEveryMs: number
    drainTimeoutMs: number
    maxSlowConsumers: number
    maxOutboxPendingAfterDrain: number
  }
  chaos?: {
    enabled: boolean
    events: Array<"restart-nats-pod" | "restart-worker" | "pause-outbox" | "slow-reader">
  }
}
```

## Implementation slices

### Slice A — Soak contract and artifact writer

Deliverables:

- `SoakConfig` / `SoakSummary` / `SoakEvent` Effect Schemas;
- artifact writer that appends JSONL and final `summary.md`;
- deterministic run id and output directory policy;
- no live infrastructure yet.

### Slice B — Local NATS substrate adapter

Deliverables:

- wrap/reuse LNK `startLiveNats` for local runs;
- accept external NATS URL + monitor URL;
- normalize substrate lifecycle into one service;
- sample `/healthz`, `/varz`, `/connz`, `/jsz`.

### Slice C — Workload nodes

Deliverables:

- PCT control-plane node factory;
- LNK writer node using `MshBridgeWire`;
- LNK reader/verifier node;
- projection worker node using existing projection scheduler/runtime seams;
- outbox publisher node using `ProjectionOutboxPublisher`.

### Slice D — Integrity verifier and gates

Deliverables:

- append/read count verifier;
- schema decode success/failure verifier;
- producer idempotency verifier;
- projection frame count verifier;
- outbox pending/poison verifier;
- final pass/fail summary.

### Slice E — CLI runner

Deliverables:

- `bun run soak:pct-lnk-msh -- --config <file>` in `packages/pct`;
- short smoke preset and long manual preset;
- signal-safe shutdown and artifact finalization.

### Slice F — Kubernetes substrate overlay

Deliverables:

- `ops/k8s/nats-soak-values.yaml` for official NATS Helm chart;
- optional kind/k3d bootstrap script;
- Kubernetes Job/Deployment templates for workload nodes;
- service discovery config for NATS client and monitor URLs;
- documented NACK non-use boundary.

### Slice G — Chaos hooks, not chaos policy

Deliverables:

- runner hook interface for timed fault events;
- local process restart hook;
- Kubernetes pod delete/restart hook;
- leave full fault matrix to `#F1125`.

## Proposed feature tree

Create follow-on implementation feature:

- Feature: `PCT/LNK/MSH Long-Running Multi-Node Soak Harness`
  - A: Define soak schemas and artifact model
  - B: Implement local/external NATS substrate adapter
  - C: Implement workload nodes over PCT/LNK/MSH seams
  - D: Implement integrity verifier and pass/fail gates
  - E: Add `packages/pct` CLI/scripts and smoke preset
  - F: Add Kubernetes Helm/kind overlay
  - G: Add chaos hook seam for later hostile-network lane

## Recommendation

Build the local/external substrate first, then Kubernetes. Kubernetes is useful,
but only after the soak runner has a crisp contract. The crisp contract is what
lets the same workload run locally, under Docker, and in Kubernetes without the
implementation mutating into a tiny CI cryptid.

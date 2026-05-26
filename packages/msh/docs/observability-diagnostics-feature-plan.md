# PCT/LNK/MSH Observability + Diagnostics Feature Plan

Status: design plan
Date: 2026-05-24

## 1. Why this lane goes first

Soak, ACL denial tests, failure chaos, and projection runtime all need a diagnostic spine. Without it, every later hardening lane becomes “run a scary thing and stare at logs.” That is not engineering, Prime; that is séance work with TypeScript.

The diagnostics surface gives the stack eyes before we start punching it in the ribs.

## 2. Boundary contract

Layer ownership stays strict:

| Layer | Owns | Must not own |
|---|---|---|
| MSH | transport substrate diagnostics: connection, auth metadata, core flush, JetStream manager, streams, consumers, KV, micro discovery, subject registry, safe redaction | PCT schema policy, LNK stream protocol semantics |
| LNK | bridge diagnostics: stream metadata, CAS health, shard guard state, append/read/delete outcomes, schema-id metadata presence | MSH auth/transport policy, PCT registry semantics |
| PCT | schema resolver/control-plane diagnostics, registry capability diagnostics, projection scheduler/worker diagnostics | MSH transport implementation, LNK durable stream internals |

First implementation should be package-local and read-only. Cross-package rollup can come after each layer has a safe diagnostic shape.

## 3. Current observability inventory

### 3.1 MSH spans

`packages/msh/src/tracing.ts` currently exposes stable span names for:

- `msh.connection.connect`
- low-level core publish/subscribe/request/flush/drain
- JetStream publish
- consumers: get/consume/fetch/next/add/info/delete/list
- streams: info/add/update/delete/list/purge/find
- KV: bucket/get/put/create/update/delete/deleteIfRevision/purge/watch/keys/history
- object store: bucket/info/get/put/delete/list/watch
- codec encode/decode
- hub publish/subscribe/flush
- pubsub publish/subscribe/request/flush
- high-level KV get/getEntry/getOrNull/put/create/updateIfRevision/delete/deleteIfRevision/purge/watch/keys/list/history
- high-level stream ensure/get/delete/publish/subscribe/getConsumer/fetch/next
- micro add/addScoped/stop/client
- micro-host host/handle
- discovery ping/info/stats
- subject registry register/unregister/update/get/find/query/catalog
- stream processor publish/read/subscribe/subscribeFrom/getInfo/delete
- auth and JWT lifecycle operations

Gap: spans exist, but there is no inventory test that public methods have span constants and no diagnostics output that summarizes recent failures.

### 3.2 LNK bridge spans

`packages/lnk/src/services/wire/nats-bridge/spans.ts` currently exposes:

- `lnk.mshBridge.port.create`
- `lnk.mshBridge.port.append`
- `lnk.mshBridge.port.read`
- `lnk.mshBridge.port.metadata`
- `lnk.mshBridge.port.delete`
- `lnk.mshBridge.cas.append`
- `lnk.mshBridge.cas.attempt`
- `lnk.mshBridge.metadata.get`
- `lnk.mshBridge.metadata.create`
- `lnk.mshBridge.metadata.updateIfRevision`
- `lnk.mshBridge.metadata.deleteIfRevision`
- `lnk.mshBridge.publisher.publish`

Gap: spans exist, but no bridge health report aggregates CAS conflicts, metadata bucket reachability, data stream reachability, or append/read latency/error counters.

### 3.3 PCT control/projection signals

Existing PCT surfaces:

- NATS control plane: `schema.get`, `capabilities.get`.
- NATS schema resolver maps service errors to LNK resolver errors.
- ProjectionWorker NATS host exposes `projection.plan`, `projection.start`, `projection.stop`, `projection.status`, `projection.run_once`, `projection.tail`.
- Projection scheduler exposes pressure snapshots: in-flight, parked, completed, failed, duplicate-in-flight, rejected, lane pressure, target in-flight.

Gap: these are operationally useful but not unified into a safe diagnostics report. Projection status exists, but there is no projection-runtime health contract beyond current control responses.

## 4. Diagnostic schema family

All diagnostics output should be Schema-backed and safe to log.

### 4.1 Common vocabulary

Suggested shared shape:

```ts
const DiagnosticSeverity = Schema.Literal("ok", "warn", "critical", "unknown")
const DiagnosticCheckStatus = Schema.Literal("passed", "failed", "skipped", "degraded", "unknown")

const DiagnosticFinding = Schema.Struct({
  severity: DiagnosticSeverity,
  code: Schema.String,
  message: Schema.String,
  layer: Schema.Literal("msh", "lnk", "pct"),
  component: Schema.String,
  subject: Schema.optional(Schema.String),
  stream: Schema.optional(Schema.String),
  bucket: Schema.optional(Schema.String),
  safeCause: Schema.optional(Schema.String),
  remediation: Schema.optional(Schema.String),
})

const DiagnosticCheck = Schema.Struct({
  checkId: Schema.String,
  layer: Schema.Literal("msh", "lnk", "pct"),
  component: Schema.String,
  status: DiagnosticCheckStatus,
  severity: DiagnosticSeverity,
  durationMs: Schema.Number,
  findings: Schema.Array(DiagnosticFinding),
  observedAt: Schema.Number,
})
```

### 4.2 Redaction rules

Diagnostics output must never include:

- token values,
- NKey seeds,
- creds contents,
- JWT full strings,
- request payloads unless explicitly declared safe,
- arbitrary exception stack strings from auth/transport layers.

Diagnostics output may include:

- auth mode tag,
- public key / account public ID when already safe,
- server URL host/port if configured as non-secret,
- subject names,
- stream names,
- KV bucket/key names only if the caller opts into key detail,
- service names, endpoint names, versions, and metadata.

## 5. MSH diagnostics plan

### 5.1 MshDiagnosticsService

Proposed service:

```ts
interface MshDiagnosticsServiceShape {
  readonly checkConnection: Effect.Effect<DiagnosticCheck>
  readonly checkCoreFlush: Effect.Effect<DiagnosticCheck>
  readonly checkJetStreamManager: Effect.Effect<DiagnosticCheck>
  readonly checkStream: (name: string) => Effect.Effect<DiagnosticCheck>
  readonly checkKvBucket: (bucket: string) => Effect.Effect<DiagnosticCheck>
  readonly checkMicroDiscovery: (serviceName?: string) => Effect.Effect<DiagnosticCheck>
  readonly checkAuthMetadata: Effect.Effect<DiagnosticCheck>
  readonly report: (options?: MshDiagnosticReportOptions) => Effect.Effect<MshDiagnosticReport>
}
```

### 5.2 Initial MSH checks

| Check | Mechanism | Expected failure mapping |
|---|---|---|
| connection | connection service exists and configured server metadata is safe-rendered | missing config / connect failure |
| core flush | `nc.flush()` through existing core seam | permission/network/server unavailable |
| JetStream manager | lazy `getJsm()` | missing `$JS.API.>` permission vs server unavailable |
| stream info | `streams.info(name)` | not-found vs permission vs operational failure |
| KV bucket | `kv.bucket(bucket)` and optional keys/list disabled by default | not-found vs permission vs operational failure |
| micro discovery | `$SRV.PING/INFO/STATS` via discovery service | no responders vs permission vs decode failure |
| auth metadata | `MshAuthService.safeStatus` style report | never include secrets |

### 5.3 MSH validation gates

- Unit tests over mock NATS for pass/fail/permission-like failures.
- Golden safe-to-log snapshots.
- Live opt-in tests for core flush, JSM, KV, stream, micro discovery.
- Redaction tests that search output for seed/token/JWT sentinels.

## 6. LNK bridge diagnostics plan

### 6.1 LnkMshBridgeDiagnosticsService

Proposed package-local service:

```ts
interface LnkMshBridgeDiagnosticsShape {
  readonly checkMetadataBucket: Effect.Effect<DiagnosticCheck>
  readonly checkDataStream: (streamId: StreamId) => Effect.Effect<DiagnosticCheck>
  readonly checkAppendPath: (streamId: StreamId) => Effect.Effect<DiagnosticCheck>
  readonly checkReadPath: (streamId: StreamId) => Effect.Effect<DiagnosticCheck>
  readonly report: Effect.Effect<LnkBridgeDiagnosticReport>
}
```

### 6.2 Initial LNK checks

| Check | Mechanism | Notes |
|---|---|---|
| metadata bucket | `CasMetadataStore.get/create/updateIfRevision/deleteIfRevision` against a reserved diagnostics stream id | dry-run/ephemeral only |
| data stream ensure | `NatsStreamService.ensureStream` through bridge config | validates stream naming/permissions |
| CAS conflict path | intentionally stale revision in mock/live opt-in | expected 409-shaped finding, not crash |
| append/read roundtrip | create ephemeral stream, append one small payload, read it back | opt-in live test; normal mock test mandatory |
| bridge spans inventory | static test over `MshBridgeSpan` | guards span name churn |

Non-goal: LNK diagnostics does not decide whether a PCT schema is valid. It may report schema-id metadata presence/absence only.

## 7. PCT diagnostics plan

### 7.1 PctDiagnosticsService

Proposed package-local service:

```ts
interface PctDiagnosticsServiceShape {
  readonly checkRegistry: Effect.Effect<DiagnosticCheck>
  readonly checkSchemaResolver: (schemaId: string) => Effect.Effect<DiagnosticCheck>
  readonly checkNatsControlPlane: Effect.Effect<DiagnosticCheck>
  readonly checkProjectionScheduler: Effect.Effect<DiagnosticCheck>
  readonly checkProjectionWorkerHost: Effect.Effect<DiagnosticCheck>
  readonly report: Effect.Effect<PctDiagnosticReport>
}
```

### 7.2 Initial PCT checks

| Check | Mechanism | Notes |
|---|---|---|
| registry | snapshot and known schema lookup | no transport required |
| schema resolver | HTTP or NATS resolver depending layer in scope | maps not-found separately from transport failure |
| NATS control plane | inspect hosted identity/info/stats or request `capabilities.get` | proves service discoverability |
| projection scheduler | pressure snapshot and worker snapshots | report parked/rejected/failed counts |
| projection worker host | micro service info/stats for projection endpoints | no projection.inspect yet |

Non-goal: PCT diagnostics does not probe raw NATS permissions directly; it asks MSH/LNK reports or surfaces semantic consequences.

## 8. Cross-package rollup

After package-local diagnosticss exist, add an optional rollup script or service:

```text
pct-lnk-msh diagnostics
  -> MSH substrate report
  -> LNK bridge report
  -> PCT semantic/control/projection report
  -> consolidated severity + findings
```

Rollup rules:

- keep raw layer reports intact,
- never discard lower-level findings,
- semantic layer may annotate substrate finding but not rewrite it,
- output JSON by default; pretty text can be a later CLI layer.

## 9. EDIN plan

### Experiment

Spikes:

1. Define shared diagnostics schemas in one package-local place first, likely MSH for substrate checks and duplicated/derived in PCT/LNK only if package boundary demands it.
2. Implement mock-only `MshDiagnosticsService.checkCoreFlush` and safe auth metadata report.
3. Add golden redaction snapshot test.
4. Build a tiny PCT report from registry snapshot + scheduler pressure without NATS.

Exit criteria:

- one MSH check, one PCT check, one redaction test pass,
- output is Schema-backed and serializable,
- no public CLI or NATS endpoint yet.

### Design

Design deliverables:

- final schema module placement,
- exact check IDs and finding codes,
- permission/ACL finding taxonomy,
- redaction policy,
- live opt-in policy,
- rollup boundary rules.

Exit criteria:

- no package boundary violation,
- tests can assert findings without stringly stack traces,
- later ACL/chaos/soak lanes can reuse check IDs.

### Implement

Slices:

1. MSH diagnostics schemas + redaction helpers.
2. MSH diagnostics substrate checks.
3. MSH diagnostics mock/live tests.
4. LNK bridge diagnostics checks over bridge dependencies.
5. PCT diagnostics semantic checks.
6. Optional JSON report script.
7. Cross-package rollup only if package-local surfaces are stable.

### Audit / reimplementation cycle

Audit after first implementation:

- Does every finding identify layer/component/check ID?
- Are permission failures distinguishable from not-found and network failures?
- Can ACL and chaos lanes use these checks without adding ad-hoc logs?
- Did any diagnostic leak a secret sentinel?
- Are any checks too destructive for a diagnostics command?

Reimplement if:

- reports contain raw exception dumps,
- check IDs churn during tests,
- MSH diagnostics starts importing PCT/LNK,
- PCT diagnostics starts probing raw NATS instead of consuming MSH/LNK substrate reports,
- live tests are flaky or require sleeps without health probes.

## 10. Feature implementation backlog

Recommended task slices for the actual implementation feature:

1. Schema and redaction foundation.
2. MSH substrate diagnostics service.
3. MSH mock/live validation.
4. LNK bridge diagnostics service.
5. PCT semantic diagnostics service.
6. Rollup JSON report.
7. CLI/script wrapper.
8. Docs, ADR, and closeout.

## 11. Closeout artifacts

When implemented, update:

- `packages/msh/docs/system-atlas.md`
- `packages/msh/docs/observability-diagnostics-feature-plan.md`
- `packages/lnk/NATS-BRIDGE.md`
- `packages/pct/NATS-INTEGRATION-CLOSEOUT.md` or a successor operational doc
- new ADR if diagnostics schemas become cross-package contract

## 12. Decision

Proceed with diagnostics planning as the first hardening implementation lane.

Do not start soak, chaos, or ACL implementation until the diagnostics schema and at least MSH/PCT first checks exist. The rest of the hardening portfolio needs eyes first; otherwise, we are testing a submarine by listening for vibes.

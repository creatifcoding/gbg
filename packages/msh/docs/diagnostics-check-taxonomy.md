# Diagnostics Check Taxonomy and Layer Contracts

Status: design checkpoint
Date: 2026-05-24

## 1. Purpose

This document freezes the first diagnostic vocabulary for the PCT/LNK/MSH diagnostics surface. It exists so later ACL, chaos, soak, and projection-runtime lanes can assert stable check IDs and finding codes instead of scraping logs like peasants.

## 2. Schema placement decision

Decision:

- `@tmnl/msh` owns the **generic** diagnostics vocabulary in `packages/msh/src/diagnostics`.
- The generic vocabulary uses `layer: string`, not a closed enum, so MSH does not encode PCT/LNK semantics.
- `@tmnl/pct` may keep package-local diagnostics schemas during the spike, then converge to the MSH generic shape once the rollup contract stabilizes.
- `@tmnl/lnk` should prefer the MSH generic vocabulary for bridge diagnostics because LNK already depends on MSH for `MshBridgeWire`.

Rationale:

- MSH must remain substrate-only.
- Cross-package rollup needs a common shape.
- A string layer label is enough for reports and avoids MSH importing or naming higher-layer policy.

## 3. Finding taxonomy

Finding code format:

```text
<check-id>.<condition>
```

Examples:

- `msh.core.flush.failed`
- `msh.auth.metadata.skipped`
- `pct.registry.snapshot.available`
- `lnk.mshBridge.cas.conflict`

Required fields:

- `severity`
- `code`
- `message`
- `layer`
- `component`

Optional fields:

- `subject`
- `stream`
- `bucket`
- `safeCause`
- `remediation`

Never include raw tokens, seeds, JWTs, credentials, or arbitrary auth payloads.

## 4. Status and severity semantics

| Status | Meaning |
|---|---|
| `passed` | The check completed and found no issue. |
| `failed` | The check could not complete or found a hard failure. |
| `skipped` | The required service/scope/config is absent by design. |
| `degraded` | The check completed but found reduced capability. |
| `unknown` | The check could not determine health without enough evidence. |

| Severity | Meaning |
|---|---|
| `ok` | No action required. |
| `warn` | Operational attention recommended; not immediately blocking. |
| `critical` | The layer cannot perform a required operation. |
| `unknown` | Health is not knowable from current scope/config. |

Rollup severity is the maximum severity by rank:

```text
ok < unknown < warn < critical
```

## 5. MSH check IDs

### Implemented in spike

| Check ID | Component | Meaning | Current status |
|---|---|---|---|
| `msh.core.flush` | `core` | Verify core NATS connection can flush. | implemented |
| `msh.auth.metadata` | `auth` | Report safe auth mode/state metadata if auth service is in scope. | implemented |

### Planned next

| Check ID | Component | Mechanism | Failure distinctions |
|---|---|---|---|
| `msh.connection.config` | `connection` | Safe-render config shape and server targets. | invalid/missing/safe |
| `msh.jsm.access` | `jetstream-manager` | Call lazy `getJsm()`. | permission denied vs unavailable |
| `msh.stream.info` | `stream` | Read stream info for configured stream. | not-found vs permission vs operational |
| `msh.kv.bucket` | `kv` | Open KV bucket and optionally list keys with key detail disabled by default. | not-found vs permission vs operational |
| `msh.micro.discovery` | `micro` | `$SRV.PING/INFO/STATS` through discovery client. | no responders vs permission vs decode |
| `msh.subject.registry` | `subject-registry` | Query registered subject catalog. | empty vs conflict vs operational |
| `msh.span.inventory` | `tracing` | Static inventory of public method span constants. | missing/churn |

## 6. LNK bridge check IDs

| Check ID | Component | Mechanism | Failure distinctions |
|---|---|---|---|
| `lnk.mshBridge.metadata.bucket` | `metadata` | Verify metadata store bucket access. | bucket unavailable, permission, codec |
| `lnk.mshBridge.stream.ensure` | `stream` | Ensure/read bridge data stream for diagnostics fixture. | config mismatch, permission, unavailable |
| `lnk.mshBridge.cas.conflict` | `cas` | Force stale revision in controlled fixture. | expected conflict vs unexpected failure |
| `lnk.mshBridge.append.roundtrip` | `wire` | Create ephemeral stream, append, read back. | append failure, read failure, framing mismatch |
| `lnk.mshBridge.span.inventory` | `tracing` | Static inventory of `MshBridgeSpan`. | missing/churn |

LNK diagnostics must not validate PCT schemas. It may report schema-id metadata presence only.

## 7. PCT check IDs

### Implemented in spike

| Check ID | Component | Meaning | Current status |
|---|---|---|---|
| `pct.registry.snapshot` | `registry` | Verify registry read surface returns coherent snapshot. | implemented |

### Planned next

| Check ID | Component | Mechanism | Failure distinctions |
|---|---|---|---|
| `pct.schemaResolver.fetch` | `schema-resolver` | Resolve configured schema id through HTTP or NATS resolver. | not-found vs transport vs decode |
| `pct.natsControl.capabilities` | `control-plane` | Call or inspect `capabilities.get`. | no responders vs service error vs decode |
| `pct.natsControl.discovery` | `control-plane` | Inspect hosted info/stats when host is in scope. | missing host vs no stats |
| `pct.projection.scheduler.pressure` | `projection-scheduler` | Read pressure and snapshots. | parked/rejected/failed pressure |
| `pct.projection.worker.status` | `projection-worker` | Read worker status via control service/host. | failed/stopped/running/degraded |
| `pct.projection.worker.host` | `projection-worker-host` | Check micro endpoint info/stats for projection endpoints. | missing endpoint/no responders |

PCT diagnostics should consume MSH/LNK reports for substrate/bridge findings rather than reproducing raw transport probes.

## 8. Layer boundary rules

### MSH

Allowed:

- NATS connection/auth/JSM/stream/KV/micro/subject diagnostics.
- Generic diagnostics schemas and redaction helpers.

Forbidden:

- Importing `@tmnl/pct` or `@tmnl/lnk`.
- Naming PCT schema IDs or LNK durable stream semantics in source.
- Producing domain authorization decisions beyond native NATS capability findings.

### LNK

Allowed:

- MSH bridge substrate health.
- Durable stream protocol health.
- Metadata/CAS/framing diagnostics.

Forbidden:

- PCT registry/schema policy.
- MSH auth implementation policy.

### PCT

Allowed:

- Registry, schema resolver, control-plane, projection scheduler/worker diagnostics.
- Semantic interpretation of MSH/LNK reports.

Forbidden:

- Reaching around MSH services to probe raw NATS internals.
- Hiding substrate failures as semantic failures.

## 9. Live opt-in policy

Normal CI:

- schema tests,
- redaction tests,
- mock diagnostics tests,
- static span inventory.

Opt-in live:

- MSH: core flush, JSM, stream, KV, micro discovery.
- LNK: append/read roundtrip over real MSH bridge.
- PCT: NATS control-plane resolver/capabilities and projection host discovery.

Live tests must remain bounded and health-probed. No soak hiding in diagnostics tests.

## 10. Next implementation target

Proceed to MSH substrate diagnostics:

1. add `msh.jsm.access`,
2. add `msh.stream.info`,
3. add `msh.kv.bucket`,
4. add redaction golden snapshots,
5. add opt-in live coverage.

Do not start LNK/PCT breadth until MSH substrate checks are stable enough to reuse.

# @tmnl/msh System Atlas

Status: living architecture artifact.
Audience: PCT/LNK integrators using MSH as substrate.
Update cadence: update at feature-suite closeout only.
Last refreshed: 2026-05-20.

## 1. What MSH is

MSH is the TMNL mesh substrate: typed NATS connectivity, auth, JetStream/KV wrappers, subject hygiene, and tracing on Effect v4.

It should remain boring infrastructure. That is the compliment, Prime. If MSH starts choosing procedure semantics, durable stream offsets, domain tenants, or schema compatibility policy, the layer cake has become soup.

## 2. Boundary contract

MSH owns infrastructure mechanics:

- NATS WebSocket connection lifecycle.
- NKey/JWT/creds/token auth material and authenticators.
- Low-level NATS core, JetStream, consumer, stream, KV, and object-store operations.
- Schema-backed encode/decode at transport edges.
- High-level typed pub/sub, KV, stream, micro, and discovery wrappers.
- Runtime subject registration, catalog introspection, and mechanical subject matching.
- Structured span names and error boundaries.
- Mock/live transport seams for tests.

MSH must not own:

- PCT procedure names, schema compatibility, registry policy, or federation semantics.
- LNK durable-stream offset math, producer fencing, or wire policy.
- Domain subject conventions beyond generic subject composition and validation.
- Application tenant routing, HTTP auth, Phoenix channels, or business authorization.

Related documents:

- [`AGENTS.md`](../AGENTS.md) — package discipline and current service graph.
- [`README.md`](../README.md) — public package overview and usage.
- [`pct-lnk-composition-rfc.md`](./pct-lnk-composition-rfc.md) — layer contract for PCT/LNK over MSH.
- [`critical-scrutiny-2026-05-18.md`](./critical-scrutiny-2026-05-18.md) — remediation closure and test evidence.

## 3. Current service architecture

```text
MshConfigTag
  ├─ MshAuthService ──► nats.ws Authenticator
  │    └─ MshCredentialSourceReader
  └─ NatsConnectionService ──► nc + js + lazy getJsm()
       └─ NatsInnerService
            ├─ NatsHubService
            │    └─ NatsPubSubService
            ├─ NatsKVService
            ├─ NatsStreamService
            │    └─ MshStreamProcessor
            ├─ NatsMicroService
            │    └─ NatsServiceDiscoveryService
            └─ Object store / stream / consumer wrappers

Independent utilities:
  ├─ MshJwtService        — NKey/JWT/.creds construction
  ├─ SubjectRegistry      — runtime subject catalog and matching
  ├─ NatsCodecService     — injectable codec service
  └─ NatsCodec            — static transport codec helpers
```

### Service ledger

| Subsystem | Service / module | Provides | Depends on | Notes |
|---|---|---|---|---|
| Config | `MshConfigTag` | Schema-decoded NATS connection config | none | Default server is `ws://localhost:9222`; custom layer validates input. |
| Auth | `MshCredentialSourceReader` | File/env credential loading | none | Keeps provenance and maps IO failures to `CredentialLoadError`. |
| Auth | `MshAuthService` | `nats.ws` authenticator plus auth lifecycle state | `MshConfigTag`, credential reader | Explicit 8-state FSM; secrets stay redacted; fail closed. |
| Auth | `MshJwtService` | NKey generation, JWT encode/decode, `.creds` formatting | none | Wraps `@nats-io/jwt`; server acceptance remains validated by NATS/nsc/go JWT tooling. |
| NATS foundation | `NatsConnectionService` | Scoped `nc`, `js`, lazy `getJsm()` | `MshConfigTag`, optional `MshAuthService` | Core pub/sub does not require eager JetStream-manager permission. |
| NATS foundation | `NatsInnerService` | Low-level Effect wrappers for core, JS, streams, consumers, KV, object store | `NatsConnectionService` | Converts NATS failures to structured `Schema.TaggedErrorClass` errors; safe consumer wrappers normalize stop/drain/fetch failure edges. |
| Codec | `NatsCodec` / `NatsCodecService` | Schema encode/decode for JSON bytes, stream/batch transforms | none | Batch concurrency is honored through stream-native `mapEffect`. |
| Pub/Sub | `NatsHubService` | Shared raw NATS subscriptions with local PubSub fan-out | `NatsInnerService` | Raw fanout; decode happens per subscriber schema. |
| Pub/Sub | `NatsPubSubService` | Typed publish, subscribe, request/reply | `NatsHubService`, `NatsInnerService` | High-level core NATS API with Schema codecs. |
| JetStream | `NatsStreamService` | Typed stream ensure/publish/subscribe/fetch/next | `NatsInnerService` | Strict `ensureStream`; supports start sequence/time and ack helpers. |
| KV | `NatsKVService` | Typed KV get/put/CAS/watch/list/history plus revision-aware create/update/delete wrappers | `NatsInnerService` | Bucket cache; not-found, revision conflict, and operational failure are distinct. |
| Micro | `NatsMicroService` | Add/stop NATS micro services and create discovery clients | `NatsConnectionService` | Scoped service lifecycle via `addScoped`. |
| Micro host | `MshMicroEndpointHost` | Schema-backed endpoint registration, request decode, response encode, and `respondError` mapping | `NatsMicroService` | Generic control-plane seam; intentionally imports no PCT/LNK semantics. |
| Discovery | `NatsServiceDiscoveryService` | PING/INFO/STATS streams | `NatsMicroService` | Stream adapters over NATS micro discovery responses. |
| Subject governance | `SubjectRegistry` | Runtime subject catalog, stream resolution, event stream | none | Token-wise matching; no raw regex subject semantics. |
| Integration | `MshStreamProcessor` | Durable typed stream processor with consumer offsets | `NatsStreamService`, `NatsInnerService` | Convenience integration over JetStream, not LNK policy. |
| Observability | `MshSpan` | Greppable span name constants | none | Structured spans must never include secrets. |

## 4. Data and control flows

### Typed pub/sub flow

1. Caller provides subject, Effect Schema, and typed payload.
2. `NatsPubSubService.publish` delegates to `NatsHubService.publish`.
3. Hub encodes once with `NatsCodec` and forwards bytes to core NATS.
4. Matching subscribers receive the NATS echo path through a shared raw hub.
5. Each subscriber decodes independently with its own schema.

Invariant: one publish should yield one local delivery through the server echo path, not synthetic local delivery plus echo.

### Typed JetStream flow

1. Caller ensures or references a stream via `NatsStreamService`.
2. `ensureStream` creates the stream or validates material config on existing streams.
3. Publish encodes payload and calls `inner.jsPublish` with optional expectations.
4. Subscribe gets or creates a consumer, honoring `deliverPolicy`, `startSequence`, and `startTime`.
5. Raw JetStream messages decode into `TypedJsMessage<A>` with ack/nak/working/term helpers.

Invariant: advertised replay and topology semantics must map to real NATS consumer config.

### Auth flow

1. `MshConfigTag` may carry `NKeyAuth`, `JwtAuth`, `CredsAuth`, `TokenAuth`, or no auth.
2. `MshAuthService` loads credentials if needed, emits lifecycle signals, and creates a `nats.ws` authenticator.
3. `NatsConnectionService` optionally obtains the authenticator and connects.
4. JWT/NKey construction lives in `MshJwtService`; auth consumption lives in `MshAuthService`.

Invariant: auth state transitions are explicit and recoverable; safe metadata never includes secrets.

## 5. Testing and validation map

| Concern | Primary coverage | Live coverage | Notes |
|---|---|---|---|
| Effect v4 isolation | `test/strict-v4.test.ts` | n/a | Guards against v3 imports and legacy bridges. |
| Auth invariants | `test/auth.test.ts`, `test/auth-behavior.test.ts`, `test/jwt.test.ts` | `test/live-token-auth.test.ts`, `test/live-jwt-auth.test.ts` | Covers redaction, state graph, retries, JWT/NKey/creds behavior. |
| Codec contract | `test/codec.test.ts`, `test/property.test.ts` | indirect | Batch concurrency and JSON-safe roundtrip coverage. |
| Subject registry | `test/subject-registry.test.ts`, `test/property.test.ts` | n/a | Token-wise matching and mutation resistance. |
| Hub/pubsub | `test/hub-pubsub.integration.test.ts` | `test/live-unauth.test.ts` | Duplicate-delivery and schema-isolation regressions. |
| Stream/KV inner wrappers | `test/service-mock.test.ts`, `test/errors.test.ts` | `test/live-infrastructure.test.ts` | Mock contract plus opt-in real NATS behavior, including KV revision CAS and safe consumer wrapper edges. |
| Stream processor | `test/service-mock.test.ts` | future expansion | Currently proves lifecycle over mock NATS. |
| Live server compatibility | opt-in live suites | `MSH_LIVE_NATS=1 bunx vitest run test/live-*.test.ts` | Requires available live NATS harness. |

Closeout baseline from scrutiny wave:

```bash
cd packages/msh && bunx vitest run && bunx tsc --noEmit --pretty false
cd packages/msh && MSH_LIVE_NATS=1 bunx vitest run test/live-*.test.ts
```

## 6. Useful future feature suites

These are feature suites, not one-off chores. Each suite should close with tests, an ADR if it changes contract shape, and an update to this atlas.

### Suite A — Operational readiness and diagnostics

Purpose: make MSH easy to operate and diagnose when embedded under PCT/LNK.

Candidate capabilities:

- `MshHealthService` with connection, core flush, JetStream manager, stream, KV, and auth metadata checks.
- Permission dry-run helpers that report missing `$JS.API.>`, `_INBOX.>`, pub/sub grants, and stream subjects.
- Trace/span inventory that validates every public method has a stable `MshSpan` constant.
- Structured diagnostic report safe for logs: no seeds, no tokens, no creds bytes.
- Optional CLI probe: `msh diagnostics`, `msh subjects`, `msh streams`, `msh auth inspect`.

Acceptance shape:

- Mock and live diagnostic tests.
- Golden safe-to-log JSON snapshots.
- No secret material in diagnostic output.

### Suite B — Adapter seams for PCT and LNK

Purpose: provide integration contracts without dragging PCT/LNK semantics into MSH.

Candidate capabilities:

- MSH-side subject and permission helpers only: builders, validators, grant templates.
- LNK-side `NatsMshWire` adapter consumes `NatsStreamService`, `NatsKVService`, `SubjectRegistry`.
- PCT-side binding consumes `NatsStreamService` / `NatsInnerService` for registry and invocation transport.
- Cross-package contract tests that prove MSH errors are wrapped at adapter boundaries.
- ADRs for subject namespace defaults and permission envelopes.

Acceptance shape:

- MSH remains domain-policy-free.
- PCT/LNK adapters own all protocol-level encoding and semantic decisions.
- Boundary tests fail if MSH imports PCT/LNK.

### Suite C — Deterministic transport test harness

Purpose: make mock/live parity trustworthy enough for infrastructure changes.

Candidate capabilities:

- Expand `test/support/mock-nats.ts` into a documented contract fixture.
- Matrix runner for mock, live unauth, token, NKey/JWT, and failure-permission modes.
- Replay fixtures for stream topology, KV revision CAS, duplicate message IDs, and consumer replay.
- Fault injection knobs: JSM unavailable, permission denied, network timeout, malformed payload, consumer stop failure.
- Fixture conformance page that maps each NATS behavior to mock/live evidence.

Acceptance shape:

- One command for normal suite, one opt-in live matrix command.
- Mock fixture cannot silently diverge from live behavior for known contracts.

### Suite D — Subject governance and ACL derivation

Purpose: turn subject specs into a navigable, auditable mesh catalog.

Candidate capabilities:

- Import/export subject catalogs as JSON/Schema values.
- Collision analysis beyond exact wildcard conflict: capture-pattern overlap, stream co-location, and tenant roots.
- ACL derivation helpers that produce NATS permission templates from `SubjectSpec` sets.
- Compatibility checks for pattern evolution: added tokens, removed tokens, placeholder renames.
- Catalog documentation generator for integrators.

Acceptance shape:

- Property tests for overlap and ACL derivation.
- Generated catalog excludes domain semantics but includes mechanical subject/stream mapping.

### Suite E — Reliability patterns

Purpose: provide safe transport primitives without inventing application policy.

Candidate capabilities:

- Retry policy wrappers with typed backoff and idempotency guidance.
- Dead-letter stream helper conventions for JetStream failures.
- Backpressure-aware stream processing examples.
- Exactly-once-ish helper recipes using message IDs, expectations, and KV CAS.
- Consumer recovery cookbook: replay from sequence/time, drain, stop, and resume.

Acceptance shape:

- Reliability helpers are opt-in wrappers, not hidden behavior changes.
- Tests prove retry boundaries do not duplicate non-idempotent publishes by default.

### Suite F — Developer tooling and cookbook

Purpose: make MSH grokkable and pleasant to integrate.

Candidate capabilities:

- Cookbook examples for auth modes, typed pub/sub, request/reply, KV CAS, JetStream, micro discovery, and stream processor.
- Layer recipe snippets for default, custom config, mock, live, and scoped services.
- Topology inspector that prints active hubs, streams, subjects, and service dependencies.
- Visual atlas generator that refreshes `~/.agent/diagrams/msh-system-atlas.html` from this Markdown.
- ADR index and feature-suite closeout checklist.

Acceptance shape:

- Examples compile under `bunx tsc --noEmit` or run as smoke tests.
- New integrators can implement a typed stream adapter without reading every service file first.

### Suite G — NATS microservice control plane

Purpose: use NATS services where they fit best: discoverable, request/reply control-plane operations with built-in `PING` / `INFO` / `STATS`, not durable data movement.

Current posture:

- `@tmnl/msh` exposes `NatsMicroService` and `NatsServiceDiscoveryService`.
- `MshMicroEndpointHost` now provides the first generic MSH-native host seam: schema-backed request decode, Effect handler execution, response encode, `respondError` mapping, and `$SRV.INFO` metadata support.
- Legacy Holonet already has a useful precedent: `AgentTaskMicroHostService` hosts an `agent-task` command control service, routes commands through a schema-backed router, and emits events over pub/sub.
- NATS services are a client/tooling protocol over normal request/reply subjects; they do not require JetStream or special server functionality.

Candidate capabilities:

- Harden `MshMicroEndpointHost` with live NATS discovery/stat tests and helper recipes.
- PCT registry control plane: `pct.registry.resolve`, `pct.registry.publish`, `pct.registry.status`, and `pct.node.capabilities` as discoverable services.
- LNK control plane: `lnk.stream.open`, `lnk.stream.describe`, `lnk.stream.tail`, and `lnk.producer.claim` as low-latency control endpoints, while stream bytes remain JetStream-backed.
- Cross-node discovery: use `$SRV.PING`, `$SRV.INFO`, and `$SRV.STATS` to discover PCT/LNK-capable nodes and their endpoint metadata.
- ADR for queue-group semantics: default queue group for load-balanced control operations; explicit no-queue or distinct queue groups only for fanout/hedged queries.

Acceptance shape:

- Micro endpoints are schema-backed and return typed service errors through NATS service error headers.
- Durable PCT registry events and LNK stream data still use EventLog/JetStream/KV, not microservice request/reply.
- Discovery tests prove `INFO` exposes endpoint subjects and metadata useful to PCT/LNK clients.

### Secondary suite — Security hardening

This overlaps with operations but deserves its own lane if auth churn increases:

- Permission-template compiler from subject catalogs.
- JWT rotation supervisor and expiry alarm stream.
- Redaction snapshot tests across errors, metadata, and diagnostics.
- NATS-account trust-chain fixtures for operator/account/user paths.

## 7. Living artifact protocol

At each feature-suite closeout:

1. Update the service ledger if dependencies, layer constructors, or public methods changed.
2. Update the data/control flow notes if behavior changed.
3. Add or revise a feature-suite section with status, acceptance evidence, and next seam.
4. Add an ADR under `packages/msh/docs/adr/` for any contract-level decision.
5. Regenerate the visual explainer snapshot in `~/.agent/diagrams/`.
6. Do not commit generated HTML under `packages/msh/docs` unless explicitly requested.

## 8. ADR candidates

- `ADR-0001-msh-is-substrate-not-protocol.md` — formalize MSH/PCT/LNK layer boundaries.
- `ADR-0002-health-diagnostics-surface.md` — define safe diagnostic output and permission checks.
- `ADR-0003-subject-catalog-acl-derivation.md` — define mechanical ACL derivation from subject specs.
- `ADR-0004-test-harness-parity.md` — define mock/live conformance rules.
- `ADR-0005-reliability-helper-boundaries.md` — define what retry/backpressure helpers may and may not do.

## 9. Current risk watchlist

- MSH imports from PCT/LNK or domain packages.
- Diagnostics accidentally include redacted secrets.
- Mock NATS behavior drifts from live NATS behavior.
- High-level helpers quietly change delivery semantics instead of exposing explicit options.
- Subject registry evolves into domain taxonomy ownership.
- Stream processor becomes a second LNK instead of a convenience wrapper.

## 10. Current good-shape signals

- `#F1021` critical scrutiny remediation is closed.
- All 13 scrutiny findings are remediated with regression coverage.
- Core service graph is explicit and Effect v4-only.
- Auth, subject, stream, KV, micro-host, and hub behavior have both focused tests and targeted live coverage.
- KV revision CAS and safe consumer wrapper semantics are validated against mock and live NATS.
- PCT/LNK composition boundary is documented and remains outside MSH source.

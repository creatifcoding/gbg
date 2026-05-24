# PCT/LNK/MSH Hardening Recon

Date: 2026-05-24

## Purpose

This is the research pass for the PCT/LNK/MSH hardening portfolio. It inventories what exists before we design the six production-hardening feature plans:

1. long-running multi-node soak,
2. permission / ACL matrix,
3. hostile network and failure chaos,
4. production observability / doctor surface,
5. projection worker runtime beyond contracts / host seam,
6. full workspace and root lockfile hygiene.

This document is descriptive, not an implementation. It must not smuggle source changes into the planning lane.

## Baseline evidence

The current integration stack is documented in:

- `packages/pct/NATS-INTEGRATION-CLOSEOUT.md`
- `packages/msh/docs/system-atlas.md`
- `packages/msh/docs/pct-lnk-composition-rfc.md`
- `packages/lnk/NATS-BRIDGE.md`
- `packages/pct/RFC-NATS-CONTROL-PLANE.md`
- `packages/pct/RFC-PROJECTION-SCHEDULER-SEDA.md`
- `packages/pct/RFC-SYSTEM-CAPABILITY-AUDIT.md`

Recent closeout validation proved targeted mock/live behavior, not production completeness.

## Test and live-harness inventory

### MSH

Current test files:

- unit/property: `auth.test.ts`, `auth-behavior.test.ts`, `codec.test.ts`, `errors.test.ts`, `jwt.test.ts`, `property.test.ts`, `strict-v4.test.ts`, `subject-registry.test.ts`
- integration/mock: `hub-pubsub.integration.test.ts`, `service-mock.test.ts`, `micro-host.test.ts`
- live: `live-unauth.test.ts`, `live-token-auth.test.ts`, `live-jwt-auth.test.ts`, `live-infrastructure.test.ts`
- harnesses: `test/support/live-nats.ts`, `test/support/mock-nats.ts`

What this proves:

- auth lifecycle, token/JWT/NKey/creds behavior, and fail-closed auth basics,
- typed codec and subject registry invariants,
- core pub/sub echo behavior,
- JetStream stream ensure/publish/fetch basics,
- KV get/put/revision CAS basics,
- micro endpoint host request/response/error mapping,
- strict Effect v4 isolation.

Current live harness details:

- Opt-in via `MSH_LIVE_NATS=1` or `MSH_LIVE_NATS_URL`.
- Starts one local `nats-server` with JetStream + WebSocket.
- Supports authorization and extra config injection.
- Uses `NATS_SERVER_BIN` or plain `nats-server` from `PATH`.
- Unlike LNK, MSH harness does **not yet** include the Nix-store fallback for restricted PATH reproducibility.

### LNK

Current test files include:

- contract tests for headers/content-type/offset/stream id/errors,
- in-memory and HTTP wire tests,
- durable-stream upstream conformance,
- `MshBridgeWire` conformance and adapter tests,
- CAS append, shard guard, kernel, intent, and live bridge tests,
- harness: `test/support/live-nats.ts`.

What this proves:

- LNK protocol contracts and headers,
- HTTP/in-memory wire semantics,
- MSH bridge semantics over opaque bytes,
- CAS append and metadata store behavior,
- targeted live bridge behavior.

Current live harness details:

- Opt-in via `LNK_LIVE_NATS=1`, `MSH_LIVE_NATS=1`, or external live URL.
- Starts one local `nats-server` with JetStream + WebSocket.
- Supports authorization and extra config injection.
- Resolves `nats-server` via `NATS_SERVER_BIN`, PATH scan, then `/nix/store/*-nats-server-*/bin/nats-server`.

### PCT

Current test files include:

- registry, manifest, publish, client/server, config, identity, notary,
- federation and EventLogRemote loopback/live/server tests,
- PCT HTTP schema resolution + LNK TypedLnk + MSH bridge proof,
- PCT NATS schema resolver/control-plane proof,
- frame projection specs/compiler/registry,
- projection scheduler/admission tests,
- projection worker contracts and NATS host tests.

What this proves:

- PCT registry and federation basics,
- live EventLogRemote federation,
- PCT HTTP schema resolution can feed LNK `TypedLnk`,
- PCT NATS `schema.get` and `capabilities.get` control-plane basics,
- projection contract schemas and NATS micro host shape,
- scheduler admission pressure/parking/retry behavior.

Current harness details:

- PCT typed proof uses LNK live harness (`LNK_LIVE_NATS=1`).
- `bun run demo:nats-control-plane` exercises readable NATS control-plane flow.

## Hardening lane gap map

### 1. Long-running multi-node soak

Existing anchors:

- MSH/LNK/PCT live harnesses can spawn single local NATS servers.
- PCT typed proof creates multiple runtimes against one NATS substrate.
- PCT NATS demo gives a readable end-to-end control-plane exercise.

Gaps:

- No prolonged soak duration mode.
- No multi-node application topology: multiple PCT nodes, multiple LNK clients, multiple projection workers.
- No memory/fiber/resource leak assertions.
- No data-integrity verifier over long streams and schema-resolved typed reads.
- No soak metrics output or artifact retention.
- No restart/resume phase inside a soak.

Planning implication:

- The soak feature plan should start with a reusable `soak` harness, not package-specific one-off tests.
- It should distinguish one NATS daemon with many app nodes from true multi-NATS topology; start with the former unless a concrete NATS cluster requirement appears.

### 2. Permission / ACL matrix

Existing anchors:

- MSH auth services cover TokenAuth, NKeyAuth, JwtAuth, CredsAuth.
- MSH live auth tests validate token/JWT/NKey/creds acceptance and some fail-closed cases.
- MSH docs already identify permission envelopes and the JetStream-manager permission pitfall.
- Subject registry exists and uses token-wise matching.

Gaps:

- No explicit matrix of operations to required NATS permissions.
- No negative tests for denied `$JS.API.>`, `_INBOX.>`, KV, stream, service discovery, or micro endpoint permissions.
- No generated NATS permission templates for MSH/PCT/LNK subject roots.
- No tenant/persona model for operator, schema resolver, projection worker, LNK producer, LNK reader, and diagnostics actor.
- No safe diagnostic explaining "permission denied" without leaking secrets.

Planning implication:

- The ACL feature plan needs a permission-persona matrix first, then targeted auth fixtures.
- MSH may provide mechanical grant/template helpers; PCT/LNK must own semantic envelopes.

### 3. Hostile network and failure chaos

Existing anchors:

- MSH errors are typed and tested in mock paths.
- MSH optional wrappers were hardened to distinguish not-found from operational failures.
- MSH safe consumer wrappers and KV revision conflicts have mock/live coverage.
- PCT scheduler has bounded retry parking and pressure snapshots.

Gaps:

- No controlled NATS restart/disconnect/reconnect tests.
- No slow consumer/backpressure chaos.
- No partial permission revocation during runtime.
- No malformed payload flood or service error storm tests.
- No dropped response / timeout / stale inbox tests for NATS micro endpoints.
- No fault-injection API in `mock-nats` beyond current contract mocks.
- No chaos report artifact that maps fault → expected typed error → recovery evidence.

Planning implication:

- The chaos plan should extend the mock harness with deliberate faults before attempting live process-kill chaos.
- Live chaos should be opt-in and bounded; no flaky infinite stress test masquerading as CI.

### 4. Production observability / doctor surface

Existing anchors:

- `MshSpan` contains broad span constants for connection, inner core/JS/consumers/streams/KV/object store, codec, hub, pubsub, micro, discovery, registry, processor, auth/JWT, and micro-host.
- PCT projection scheduler exposes pressure; a local uncommitted lane is demoting scheduler look from public API to internal `debugLook`.
- MSH system atlas has Suite A for operational diagnostics and doctor ideas.
- PCT NATS control-plane has `capabilities.get`.

Gaps:

- No `MshHealthService`.
- No `msh doctor`, `pct doctor`, or equivalent script surface.
- No safe-to-log diagnostic schema/golden snapshots.
- No span inventory test proving public methods have stable span constants.
- No metrics sink or counters for publish/request/consumer/kv/control-plane outcomes.
- No redaction tests for future diagnostic reports.

Planning implication:

- Observability should start with schemas and safe snapshots, not a CLI.
- The first doctor should be read-only and permission-aware: connection, core flush, JetStream manager, KV, stream, micro discovery, auth metadata.

### 5. Projection worker runtime beyond contracts / host seam

Existing anchors:

- Frame projection specs and Timescale projection compiler exist.
- Projection registry and worker contracts exist.
- ProjectionWorker NATS micro host exposes `projection.plan`, `projection.start`, `projection.stop`, `projection.status`, `projection.run_once`, and `projection.tail` contracts.
- Scheduler/admission layer has parking, pressure, retry budget, lane priority, and diagnostic look internals.
- RFC-SYSTEM-CAPABILITY-AUDIT says ProjectionWorker runtime is high-value and should be built as a vertical slice.

Gaps:

- No production worker runtime over real LNK streams and durable projection output.
- No offset/ledger authority for projection progress.
- No Timescale/Postgres write path in this lane.
- No multi-worker claim/fencing semantics beyond scheduler memory gates.
- No lifecycle supervision for worker processes/nodes.
- No operator workflow for `projection.inspect`; current local drift deliberately keeps diagnostic look internal.

Planning implication:

- The projection-runtime plan should be a vertical slice, not a grand framework.
- It should choose one source stream, one projection spec, one sink/ledger strategy, one worker lifecycle, and one audit story.

### 6. Workspace and root lockfile hygiene

Observed current dirty buckets:

- root: `.gitmodules`, `bun.lock`, `package.json`, untracked `projects/`, untracked `spark-*.md` files,
- `packages/datagrid`: broad source/test/package changes,
- `packages/db`: deleted package files,
- `packages/entity`: deleted package files,
- `packages/mathkernel`: package/source changes plus nested `agent-browser` dirt,
- `packages/stx`: source/test/package changes plus untracked machine files,
- `packages/tmnl`: extension state, extension package/lock changes, deleted extension files, app/router/scripts/testbed/reactor changes, generated/state DB files, untracked docs and libraries,
- submodules: `effect-smol` modified, `liveline`/`sui`/`ts-sdks` state.

Current PCT scoped dirt at recon time:

- `packages/pct/RFC-PROJECTION-SCHEDULER-SEDA.md`
- `packages/pct/src/frames/ProjectionScheduler.ts`
- `packages/pct/src/frames/ProjectionScheduling.ts`
- `packages/pct/src/frames/index.ts`
- `packages/pct/test/projection-scheduler.test.ts`

This PCT dirt appears to be a look-surface probation change: demote public scheduler `look` to internal `debugLook`, remove public exports/control-plane exposure, and update the RFC verdict. Treat it as a separate projection-look probation lane, not as hardening-planning dirt.

Gaps:

- No owner map for the broad dirty tree.
- No preserve/revert/commit classification yet.
- Root `bun.lock` has mixed workspace churn and must not be committed with unrelated features.
- Deleted `db`/`entity` packages require explicit confirmation before removal or restore.
- Generated state files under `.pi` and extension lockfiles need package-specific policy.

Planning implication:

- Workspace hygiene needs its own forensic inventory and should not be bundled with PCT/LNK/MSH hardening implementation.
- Lockfile reconciliation must be one explicit review, not an incidental side effect.

## Documentation/RFC inventory

### MSH

- `packages/msh/README.md`
- `packages/msh/docs/system-atlas.md`
- `packages/msh/docs/pct-lnk-composition-rfc.md`
- `packages/msh/docs/critical-scrutiny-2026-05-18.md`
- `packages/msh/docs/consumer-migration-inventory.md`

MSH docs are strong for boundaries and future suites. They lack concrete doctor/ACL/chaos execution plans.

### LNK

- `packages/lnk/README.md`
- `packages/lnk/ARCHITECTURE.md`
- `packages/lnk/CONFORMANCE.md`
- `packages/lnk/NATS-BRIDGE.md`
- `packages/lnk/PCT.md`

LNK docs are strong for protocol/bridge semantics. They lack long-soak and hostile-failure operating guidance.

### PCT

- `packages/pct/NATS-INTEGRATION-CLOSEOUT.md`
- `packages/pct/RFC-NATS-CONTROL-PLANE.md`
- `packages/pct/RFC-PROJECTION-SCHEDULER-SEDA.md`
- `packages/pct/RFC-SYSTEM-CAPABILITY-AUDIT.md`
- `packages/pct/RFC-EVENTLOG-REMOTE.md`
- `packages/pct/RFC-FRAME-PROJECTIONS.md`
- `packages/pct/RFC-IDENTITY.md`
- `packages/pct/RFC-NATS-JOURNAL-ROLE.md`

PCT docs are strong for control-plane and projection rationale. They need a runtime plan for projection workers and operational docs after hardening lanes land.

## Cross-lane dependencies

Recommended sequencing from recon:

1. **Observability / doctor design** before soak and chaos implementation, because soak/chaos need metrics and safe diagnostics.
2. **ACL matrix design** before chaos live-denial tests, because permission chaos needs expected denial semantics.
3. **Harness unification** before long soak: bring MSH live harness reproducibility up to LNK's standard and decide whether PCT should share one support package.
4. **Projection runtime vertical slice** can proceed after observability contracts define worker status/diagnostics shape.
5. **Workspace hygiene** is operationally separate and can proceed in parallel, but must never share commits with feature implementation.
6. **Closeout/docs planning** should wait until lane plans define exact artifacts and gates.

## Immediate design inputs for the six feature plans

Each lane plan should include:

- current evidence from this recon,
- explicit non-goals,
- spikes before implementation,
- implementation slices,
- audit/reimplementation checkpoint,
- validation commands and live opt-in policy,
- docs/ADR targets,
- closeout gate.

Do not promote internal diagnostic surfaces to public APIs without an operator workflow. Prime, that is how tiny seams become load-bearing gargoyles.

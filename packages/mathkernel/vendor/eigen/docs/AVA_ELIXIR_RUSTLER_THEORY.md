# AVA + Elixir Rustler Integration Theory

## 1) AVA architecture summary (integration-relevant)

Based on `src-ava` workspace layout:

- `ava-domain`: stable wire/domain types (`ViewProfileSpec`, `ViewArtifact`, `ChannelData`, IDs, events) using `serde` + `typeshare`.
- `ava-compiler`: compiles `ChannelPipelineSpec` → SQL/DataFusion plans.
- `ava-reconciler`:
  - `v2` (recommended): internal event loop + trigger engine + `tokio::broadcast` fanout.
  - `v1` remains for compatibility.
- `ava-runtime`: orchestrator (`SpecRegistry`, `ReconcilerV2`, `ViewCompiler`, `AdapterRegistry`, `HydrationService`, DataFusion `SessionContext`).
- `ava-adapters`: source adapters (`MemoryAdapter`, `SqliteAdapter`, optional `nats`, optional `durable-streams`).
- `ava-api`: REST + gRPC + SSE/WebSocket transport over `AvaRuntimeV2`.
- `ava-wasm`: lightweight WASM mirror API (not full runtime).

### Integration seams that matter

1. **Best contract boundary:** `ava-domain` payloads (serde-friendly).
2. **Streaming boundary:** `subscribe_view_hydrated()` returns broadcast receivers and spawns hydration tasks.
3. **Mutation boundary:** `register_spec`, `update_spec`, `invalidate`, `unsubscribe`.
4. **Transport fallback already exists:** `ava-api` sidecar mode is viable today.

### Practical caveat from current server bin

`src-ava/ava-api/src/bin/ava-server.rs` currently creates separate runtime instances for REST/gRPC/NATS paths. For production consistency, use one shared `AvaRuntimeV2` instance across transports.

---

## 2) Rustler integration theory

### Core theory

Use Rustler as an **in-process control/data bridge**, but keep AVA runtime semantics intact:

- AVA owns orchestration and streaming.
- Elixir owns supervision, orchestration policy, retries, and backpressure strategy.
- Boundary payloads should be `serde` JSON/binary using `ava-domain` types (avoid exposing Arrow internals to BEAM).

### Proposed Rustler shape

- Resource: `AvaRuntimeHandle` (wraps `AvaRuntimeV2` + Tokio runtime handle + subscription registry).
- NIF classes:
  - **Control NIFs**: `register_spec`, `get_spec`, `list_specs`, `invalidate`, `unsubscribe`.
  - **Subscription NIFs**: `subscribe(view_id, pid)` creates async task; sends messages to BEAM process.
- Message contract to Elixir:
  - `{:ava_artifact, sub_ref, artifact_json}`
  - `{:ava_error, sub_ref, code, reason}`
  - `{:ava_lagged, sub_ref, dropped_count}`

### Scheduler/safety rules

- Any compile/query/hydration/streaming operation must be async/dirty (never block normal schedulers).
- Guard all NIF entrypoints against panic boundaries.
- Add cancellation tokens per subscription; unsubscribe must be idempotent.
- Keep NIF API coarse-grained (fewer crossings, larger payloads).

### What should *not* cross the boundary initially

- Arrow `RecordBatch` internals
- DataFusion plans/contexts
- Rust async stream primitives

Start with hydrated `ChannelData` payloads and status/events only.

---

## 3) NIF vs Port vs Sidecar matrix

| Option | Latency | Fault isolation | Streaming complexity | Operational complexity | Best use here |
|---|---:|---:|---:|---:|---|
| **NIF (Rustler)** | Lowest | Lowest (in VM) | Medium-High | Medium | Hot path, low-latency control/data when stable |
| **Port program** | Low-Medium | Medium (separate OS proc) | Medium | Medium-High | Safer local bridge with custom protocol |
| **Sidecar (REST/gRPC via `ava-api`)** | Medium | Highest | Low-Medium (already implemented) | Low-Medium | Fastest safe integration path now |

### Recommendation

- **Phase in via Sidecar first**, then add Rustler where latency justifies risk.
- Keep a sidecar fallback path even after Rustler adoption.

---

## 4) Phased plan with guardrails

### Phase 0 — Contract freeze

- Define canonical payloads from `ava-domain` (spec/artifact/error/event).
- Generate golden fixtures for round-trip tests (Rust ↔ Elixir).
- Guardrail: no custom ad-hoc BEAM-only schema.

### Phase 1 — Sidecar baseline (production-safe)

- Integrate Elixir with `ava-api` (`REST/gRPC + SSE/WS`).
- Validate lifecycle: register → subscribe → invalidate → unsubscribe.
- Guardrail: single shared runtime instance in server wiring.

### Phase 2 — Rustler control plane NIF

- Implement non-streaming NIFs first (`register_spec`, `get_spec`, `invalidate`, status).
- Keep subscriptions on sidecar path initially.
- Guardrail: no long-running work on normal schedulers.

### Phase 3 — Rustler streaming NIF

- Add `subscribe/unsubscribe` bridge from `broadcast::Receiver` to BEAM mailbox.
- Add lag/drop telemetry and bounded mailbox policy.
- Guardrail: mandatory cancellation + leak checks.

### Phase 4 — Optimization and hybrid routing

- Route latency-critical calls to NIF, others to sidecar.
- Feature-flag routing per endpoint/use case.
- Guardrail: one-command rollback to sidecar-only.

---

## 5) Explicit gates/checks

## Gate A — AVA core correctness

**Check**
```bash
cd src-ava
cargo test -p ava-domain -p ava-compiler -p ava-reconciler -p ava-runtime -p ava-api
```

**Pass criteria**
- All tests pass.
- No regressions in `v2` runtime/reconciler paths.

## Gate B — Contract stability

**Check**
- Golden fixture round-trips for `ViewProfileSpec`, `ViewArtifact`, `ChannelData`, `ReconcilerEvent`.

**Pass criteria**
- Rust encode/decode matches Elixir decode/encode with zero field drift.

## Gate C — Streaming reliability

**Check**
- 15+ minute subscribe/invalidate soak test.
- Validate lag behavior and unsubscribe cleanup.

**Pass criteria**
- No task leaks, no unbounded mailbox growth, deterministic unsubscribe.

## Gate D — Failure containment

**Check**
- Force adapter/query failures and panic simulation paths.
- Verify Elixir supervision recovers worker/process.

**Pass criteria**
- No VM-wide crash from expected runtime errors.
- Errors propagate as structured tuples/events.

## Gate E — Performance budget

**Check**
- Measure p95 latency for register/get/invalidate/first-artifact.
- Compare Sidecar vs NIF paths under identical load.

**Pass criteria (initial targets)**
- Sidecar: acceptable functional baseline.
- NIF pilot: clear p95 improvement without scheduler starvation.

## Gate F — Rollback safety

**Check**
- Runtime feature flag to disable NIF path and route to sidecar.

**Pass criteria**
- Rollback can be performed without deploy-time schema changes.

---

## 6) Nix provisioning SoTA (Elixir/Rustler, 2026)

### Recommended baseline

For this repository style (flake-parts + custom `nix/modules/*`), the strongest path is:

1. **nixpkgs BEAM builders** (`beam.packagesWith`, `mixRelease`, `buildMix`, `fetchMixDeps`)
2. **`deps_nix` for dependency derivations** (preferred for modern mixed deps)
3. **`mix2nix` as compatibility fallback** (especially when teams already use it)
4. Optional **`rustler_precompiled` artifact pipeline** for consumer ergonomics

### Why this is the practical SoTA

- Nixpkgs BEAM docs still treat `mixRelease` / `buildMix` as canonical packaging paths.
- `mix2nix` is still valid, but ecosystem docs and maintainers note limitations around non-Hex/git scenarios.
- `deps_nix` is newer and supports git/path dependencies by querying Mix internals, which aligns better with real monorepos.
- `nix-phoenix` template codifies the practical workflow: flake init → Phoenix app → `mix deps.nix` → `nix build`.

### Rustler-specific provisioning stance

- In Nix-first CI, prefer **source builds** for Rustler deps to maximize cache determinism.
- Use `rustler_precompiled` for distribution convenience when needed, with checksum enforcement and explicit target matrix.
- Track OTP/NIF compatibility explicitly (Rustler `nif_version_*` features) in policy docs and CI matrix.

### Immediate implementation fit for TMNL

- Add `nix/modules/elixir.nix` with a dedicated `tmnl-elixir` shell.
- Include: Elixir, Erlang, rebar3, hex, rust/cargo (Rustler), pkg-config, openssl.
- Add mission-control scripts:
  - `elixir-deps` (`mix deps.get`, `mix deps.nix`)
  - `elixir-test` (`mix test`)
  - `elixir-build` (`mix compile` / `mix release`)
- Wire into unified `tmnl` shell and project NX/Bun wrappers for reproducible command paths.

---

## Bottom line

Use AVA’s existing `ava-domain` contracts and `ava-runtime` orchestration as the source of truth. For provisioning, use nixpkgs BEAM builders + `deps_nix` as the primary path, with `mix2nix` as fallback compatibility tooling. Start with sidecar for safety and delivery speed, then introduce Rustler incrementally for latency-critical paths, gated by explicit correctness, reliability, and rollback checks.

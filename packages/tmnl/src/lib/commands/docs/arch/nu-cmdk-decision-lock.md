# NuCmdk Design Decision Lock

**Status:** Locked (current wave)  
**Date:** 2026-02-13

---

## Locked decisions

1. **cmdk role**
   - cmdk is a baseline substrate, not a strict clone target.

2. **Provider envelope model**
   - **Variant C**: manifest + stream hybrid.

3. **Schema architecture**
   - Pluggable variant registry with dynamic schema modules.
   - Per-variant versioning.

4. **Renderer safety**
   - Every row variant must register a valid renderer token (or fallback).
   - Shell resolves renderer token; provider does not inject arbitrary component instances.

5. **Row assembly discipline**
   - Generic assembly pipeline through schema decode + assembler functions.
   - Invalid rows dropped with telemetry (non-fatal).

6. **Execution model**
   - Data resolvers (typed resolver specs), not raw executable closures crossing boundaries.

7. **Orchestration boundary**
   - Dedicated `NuCmdkSearchBroker` service.
   - Providers participate in choreography via lane adapters.

8. **State + cache**
   - Atoms + service-side cache.
   - Tiered cache with SQLite-backed persisted warm cache approved.

9. **Transport model**
   - Mixed lanes: in-process, RPC, HTTP, filesystem, vector, database.
   - Effect RPC-first for protocol design direction.
   - HTTP timeout + partial lane results.

10. **Ranking/categorization behavior**
    - Shell performs ranking/categorization on row updates (incremental recompute).
    - Hybrid score composition remains active.

11. **Fallback behavior**
    - Semantic fallback chain as previously proposed (lexical/operator fallback).

12. **Renderer token namespace**
    - Locked format: `<providerId>/<variantKey>/<viewKind>@v<major>`.
    - See: `nu-cmdk-renderer-token-namespace-lock.md`.

13. **Resolver allow-list policy**
    - Scope-by-resolver allow/deny matrix locked.
    - Dispatch requires schema decode + capability gates.
    - See: `nu-cmdk-resolver-allowlist-matrix.md`.

14. **SQLite cache migration policy**
    - L2 cache schema, migration model, epoch/version semantics, and WAL policy locked.
    - See: `nu-cmdk-sqlite-cache-migration-policy.md`.

15. **QuerySession actor model**
    - Search orchestration is per-query actor, mailbox-driven, scoped lifecycle.
    - Atom-backed session state is primary React surface.
    - See: `nu-cmdk-query-session-actor-effect-spec.md`.

16. **TTR-first performance objective**
    - Time-to-resolution (TTR) is the primary optimization target with safety/quality penalties.
    - See: `nu-cmdk-search-resolution-metrics-spec.md`.

17. **Constrained hillclimb tuning loop**
    - Parameter tuning uses constrained hillclimbing with hard guardrails.
    - See: `nu-cmdk-hillclimb-optimization-spec.md`.

18. **Provider/adapter LayerRouter + middleware parity**
    - Provider/adapter orchestration adopts `HttpLayerRouter`-style service + middleware architecture.
    - Middleware is split into global and adapter-local scopes with deterministic composition.
    - Query dispatch follows parse-once, typed-emits enforcement, and bounded scheduling for N+1 efficiency.
    - See: `nu-cmdk-provider-adapter-layer-router-decision.md` and `nu-cmdk-query-middleware-spec.md`.

---

## Required implementation invariants

- Value-based selection identity only (no index identity).
- No new undocumented cycle edges.
- No tiny text regressions (12px floor).
- Row/lane failure isolation is preserved.

---

## Follow-up lock dependencies

Core follow-up dependencies are now resolved in this wave (D12–D14).

Remaining bounded follow-ups:

1. Provider-specific resolver policy manifests (per lane) aligned to D13.
2. Cache compaction thresholds and pruning heuristics tuned with production telemetry.
3. Renderer compatibility policy for major-version fallback behavior in mixed deployments.
4. QuerySession runtime instrumentation wiring to emit required TTR event timeline.
5. Hillclimb harness automation pass from bootstrap logs to measured runs.

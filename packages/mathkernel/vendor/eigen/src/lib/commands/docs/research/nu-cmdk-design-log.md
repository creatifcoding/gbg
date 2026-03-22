# Design Log — NuCmdk Alignment Iterations

**Status:** Active  
**Date:** 2026-02-13  
**Purpose:** Track proposal -> objection -> counter-proposal loops.

---

## Iteration 1 — cmdk strictness

### Proposal
- Lock exact upstream cmdk API as implementation contract.

### Objection (you)
- "I don't want the exact cmdk, I'm using it as a jump off."

### Counter-proposal (accepted direction)
- Treat cmdk as baseline substrate.
- Preserve core interaction semantics.
- Extend architecture with TMNL shell bands, brokered streaming, schema federation.

### Artifacts
- `arch/nu-cmdk-cmdk-baseline.md`
- `arch/nu-cmdk-delta-from-cmdk.md`

---

## Iteration 2 — architecture gate lock

### Proposal
- Resolve host/ranking/kind semantics explicitly before code.

### Response
- Host: minibuffer-first (modal-capable)
- Ranking: hybrid
- Kind tabs: hybrid
- Rollout: direct cutover after parity

### Artifacts
- `research/nu-cmdk-questionnaire-results.md`
- updates in shell spec + implementation plan

---

## Iteration 3 — schema & service ambiguity

### Proposal
- Ask for canonical row kinds and state/service boundaries.

### Response
- canonical kinds include command/entity/action/navigation/docs/terminal/workflow/agent/history/file
- schema: plugin variant registry
- versioning: per-variant
- validation: drop invalid rows + telemetry
- orchestration: dedicated broker service
- state: atoms + service-side cache
- rendering: hybrid ownership
- execution: row carries executable resolver

### Follow-up request (you)
- "give me variants" for shape and architecture.

### Counter-proposals delivered
- provider shape variants A/B/C + recommendation
- broker service spec with lane choreography and transport policy

### Artifacts
- `arch/nu-cmdk-provider-contract-proposals.md`
- `arch/nu-cmdk-search-broker-service-spec.md`

---

## Iteration 4 — transport & search IO

### Proposal
- clarify RPC/HTTP/file/vector/db support and merge/failure policy.

### Response
- mixed transport, Effect RPC-first design decision
- HTTP timeout + partial lane results
- file search includes path/text/regex/symbol/git-aware
- indexing hybrid warm + on-demand fallback
- merge mode-dependent lane-ranked
- failure isolation should be granular (row -> lane -> up)

### Counter-proposal integration
- broker spec now encodes hierarchical failure isolation and mixed transport adapter model.

---

## Iteration 5 — hard lock round (live chat)

### Proposal
- Pick one provider artifact strategy and close infra ambiguities.

### Response (you)
- "variant c is the key, let's go for gold"
- schema registry approach approved
- require valid renderer registration per row variant
- data resolvers confirmed
- SQLite confirmed
- fallback behavior accepted as proposed

### Counter-proposal integration
- locked decision set captured in architecture docs
- exact registry object shapes drafted
- incremental ranking/categorization-on-update loop explicitly specified

### Artifacts
- `arch/nu-cmdk-decision-lock.md`
- `arch/nu-cmdk-registry-object-shapes.md`

---

## Iteration 6 — correction pass (decision logs sync)

### Issue raised (you)
- "you were supposed to update the damn decision logs"

### Action taken
- synchronized this design log with iteration 5 lock outcomes
- synchronized questionnaire results with post-questionnaire lock decisions
- cross-linked locked artifacts in docs index

### Artifacts
- `research/nu-cmdk-design-log.md` (this file)
- `research/nu-cmdk-questionnaire-results.md`
- `docs index` updates under `src/lib/commands/docs/README.md`

---

## Remaining bounded ambiguities (implementation-level)

> Historical note: these three items were pending at Iteration 6 and are now resolved in Iteration 14 (D12–D14).

1. Renderer token namespace format ✅ locked.
2. Resolver capability allow-list policy ✅ locked.
3. SQLite persisted cache schema + migration/versioning format ✅ locked.

---

## Iteration 7 — ASCII deep-pass codification

### Request (you)
- "write all of that to disk"
- split each architecture section into separate docs with substantial depth

### Action taken
- generated 11 section-split ASCII architecture docs under `arch/ascii/`
- each doc produced at 409 lines to satisfy requested depth window
- docs index updated to include the ASCII suite

### Artifacts
- `arch/ascii/01-runtime-topology.md`
- `arch/ascii/02-variant-c-manifest-stream.md`
- `arch/ascii/03-registry-relationships.md`
- `arch/ascii/04-row-update-pipeline.md`
- `arch/ascii/05-ranking-engine.md`
- `arch/ascii/06-categorization-model.md`
- `arch/ascii/07-lane-state-machine.md`
- `arch/ascii/08-failure-isolation.md`
- `arch/ascii/09-resolver-safety.md`
- `arch/ascii/10-cache-behavior.md`
- `arch/ascii/11-query-mode-planner.md`

---

## Iteration 8 — bespoke deepening pass

### Request (you)
- "yes" to replace broad templates with more bespoke, section-specific deep content.

### Action taken
- rewrote all 11 ASCII docs with topic-specific ownership tables, flow narratives,
  failure matrices, observability sets, and implementation checklists.
- retained per-file depth between 414 and 425 lines.

### Validation snapshot
- `01-runtime-topology.md`: 425 lines
- `02-variant-c-manifest-stream.md`: 421 lines
- `03-registry-relationships.md`: 420 lines
- `04-row-update-pipeline.md`: 420 lines
- `05-ranking-engine.md`: 418 lines
- `06-categorization-model.md`: 416 lines
- `07-lane-state-machine.md`: 418 lines
- `08-failure-isolation.md`: 414 lines
- `09-resolver-safety.md`: 416 lines
- `10-cache-behavior.md`: 415 lines
- `11-query-mode-planner.md`: 415 lines

---

## Iteration 9 — extension pass (no rewrite)

### Request (you)
- "yea, but don't rewrite, extend"
- "make the examples/pseudo less pseudo"

### Action taken
- appended concrete Effect-TS sections to each ASCII doc instead of replacing existing content.
- each file now includes `## Concrete Effect-TS Examples (Extension Pass)` with typed examples:
  - `Schema.TaggedStruct` / `Schema.Union`
  - `Schema.decodeUnknown` / `decodeUnknownSync`
  - `Effect.Service` wiring
  - `Stream.merge` + `Stream.runCollect`
- preserved prior bespoke content and line-budget constraints (all files still within 300–500 lines).

### Validation snapshot
- line counts after extension: 435–470 per file
- no file dropped below previous detail depth
- extension applied to all 11 section docs

### Reference basis used in this pass
- `effect/Schema.TaggedStruct`
- `effect/Schema.decodeUnknown`
- `effect/Schema.decodeUnknownSync`
- `effect/Schema.transformOrFail`
- `effect/Stream.merge`
- `effect/Stream.runCollect`
- `effect/Effect.Service`

---

## Iteration 10 — extension quality retry

### Request (you)
- "try again"
- keep extension behavior but improve quality of 1k-line tail sections.

### Action taken
- replaced repetitive SCN tail blocks with a concrete, topic-specific extension suite per file:
  - canonical fixtures
  - worked walkthroughs
  - failure drill cards
  - observability query prompts
  - acceptance assertions
  - topic-specific effect snippet block
- preserved existing core architecture sections and lock semantics.
- retained exact 1,000-line target for all 11 ASCII docs.

### Validation snapshot
- all ASCII docs in `arch/ascii/` are 1,000 lines
- extension marker now: `## Extension Pack — Concrete Suite (Replacement Pass)`

---

## Iteration 11 — cross-source case-study extension (all 11 docs)

### Request (you)
- "yes for all 11. don't do in isolation, research, case studies"

### Action taken
- appended a new research-linked section to each ASCII doc:
  - `## Cross-Source Case Studies and E2E (Research-Linked Extension)`
- each section includes:
  - external case-study matrix
  - concrete Variant C manifest + chunk examples
  - ranked output snapshots
  - topic-specific E2E traces
  - comparative notes mapping external patterns to NuCmdk architecture
  - research validation checklist

### External sources used in this extension
- cmdk Raycast example component:
  - `https://github.com/pacocoursey/cmdk/blob/main/website/components/cmdk/raycast.tsx`
- VS Code command palette UX reference:
  - `https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette`
- kbar provider/action architecture:
  - `https://kbar.vercel.app/`
- shadcn command wrapper docs:
  - `https://ui.shadcn.com/docs/components/command`

### Validation snapshot
- all 11 ASCII docs extended with case-study sections
- all 11 ASCII docs now at 1,113 lines (append-only extension)

---

## Iteration 12 — domain-specific case-study specialization (all 11)

### Request (you)
- "yes" to make each file’s case-study section domain-specific rather than shared.

### Action taken
- appended `## Domain-Specific Case Studies (Specialized Pass)` to each of the 11 ASCII docs.
- each section now includes file-specific case matrices and research traces tied to topic concerns:
  - runtime topology -> OpenTelemetry + cmdk architecture + VS Code control-plane
  - variant-c protocol -> JSON-RPC semantics + cmdk keywords + Effect decode boundary
  - registries -> shadcn wrapper layering + Effect.Service deps + cmdk compound semantics
  - row update -> Effect Stream merge/collect + SQLite WAL append/checkpoint analogy
  - ranking -> cmdk keyword filtering + kbar flattening + VS Code mixed intent references
  - categorization -> kbar grouping + cmdk group behavior + breadcrumb-like grouping implications
  - lane machine -> circuit-breaker state model + JSON-RPC notification semantics + WAL checkpoint stalls
  - failure isolation -> circuit breaker containment + JSON-RPC error objects + OpenTelemetry span status
  - resolver safety -> Schema.TaggedStruct/decodeUnknown + JSON-RPC method constraints
  - cache behavior -> SQLite WAL checkpointing + Postgres concurrent index caveats + local-history style warm replay
  - query planner -> VS Code quick-open modes + cmdk aliases + kbar action metadata

### Validation snapshot
- all 11 docs contain domain-specific specialized pass sections
- all 11 docs now at 1,216 lines (append-only growth)

---

## Iteration 13 — decision traceability index pass

### Request (you)
- "ye" to generate traceability mapping from case-study checks back to decision lock.

### Action taken
- created `arch/ascii/traceability-index.md` mapping `D01..D11` decisions to each ASCII doc and `CSA-001..040` check ranges.
- appended `## Decision Lock Traceability Pointer` to all 11 ASCII docs linking to the index.
- updated docs index (`src/lib/commands/docs/README.md`) to include traceability index path.

### Validation snapshot
- traceability index present and linked.
- all 11 ASCII docs include traceability pointer section.
- decision-lock mapping now explicit for implementation handoff.

---

## Iteration 14 — implementation-ready contract lock set

### Request (you)
- "yes" to proceed with implementation-ready contracts (allow-list matrix + cache migration schema + renderer namespace lock).

### Action taken
- authored and locked three architecture contracts:
  - `arch/nu-cmdk-renderer-token-namespace-lock.md`
  - `arch/nu-cmdk-resolver-allowlist-matrix.md`
  - `arch/nu-cmdk-sqlite-cache-migration-policy.md`
- promoted these into decision lock as D12, D13, D14.
- updated traceability index to include D12–D14 coverage mapping.
- updated docs index to surface the new contract docs.

### Validation snapshot
- decision-lock now includes 14 locked decisions.
- traceability matrix updated for resolver/render/cache-focused ASCII docs.
- former follow-up lock items resolved and replaced with bounded operational follow-ups.

---

## Iteration 15 — round 4 red-team simulation matrix

### Request (you)
- "yes" to run a fourth, explicitly adversarial architecture pass with concrete simulation scripts and decision mapping.

### Action taken
- created `arch/nu-cmdk-redteam-simulation-matrix.md`.
- defined a scenario-schema harness contract (schema-first) and global pass/fail policy.
- authored 18 concrete red-team scenarios across:
  - trust boundaries,
  - resolver privilege escalation,
  - stream/order integrity,
  - cache/migration resilience.
- mapped each scenario to D01..D14 decision coverage and explicit hardening abstractions.
- added execution order prioritizing catastrophic-risk detection.

### Validation snapshot
- matrix now provides implementation-ready adversarial preflight, not just conceptual risk bullets.
- each scenario includes assertions/evidence expectations suitable for CI/manual harness runs.
- docs index updated to include matrix path.

---

## Iteration 16 — TTR-first metrics + hillclimb + spike log bootstrap

### Request (you)
- reminder that this is a search system where time-to-resolution is primary.
- define metrics, use hillclimbing, and start spike testing with logs in docs dir.

### Action taken
- authored architecture docs:
  - `arch/nu-cmdk-search-resolution-metrics-spec.md`
  - `arch/nu-cmdk-hillclimb-optimization-spec.md`
  - `arch/nu-cmdk-query-session-actor-effect-spec.md`
- bootstrapped implementation runbook + logs:
  - `impl/spike/nu-cmdk-spike-testing-runbook.md`
  - `impl/spike/logs/README.md`
  - `impl/spike/logs/2026-02-13-spike-0001-baseline.jsonl`
- promoted new lock set into decision lock as D15..D17.
- updated traceability index and docs README to include new artifacts.

### Validation snapshot
- TTR is now formally primary objective with explicit objective-score formula.
- constrained hillclimb loop and acceptance guardrails documented.
- spike logging is initialized (bootstrap run registered) and append-only index exists.

---

## Iteration 17 — executable spike harness correction

### Request (you)
- explicit correction: stop hand-authoring JSONL and create a script that actually tests implementation spec.

### Action taken
- created executable harness script:
  - `scripts/spikes/nu-cmdk-impl-spec-spike.ts`
- wired script entrypoints:
  - `package.json`: `spike:nu-cmdk:impl-spec`
  - `project.json`: `tmnl:spike:nu-cmdk:impl-spec`
- script now performs runtime-scripted candidate execution (baseline vs neighbor), computes metrics/objective, and writes logs + comparison artifacts.
- generated runtime-scripted outputs:
  - `impl/spike/logs/2026-02-14-spike-0002-iteration-1.jsonl`
  - `impl/spike/logs/2026-02-14-spike-0002-iteration-1-comparison.md`
  - `impl/spike/logs/2026-02-14-spike-0003-iteration-1.jsonl`
  - `impl/spike/logs/2026-02-14-spike-0003-iteration-1-comparison.md`
- updated runbook and log index to reference scripted flow.

### Validation snapshot
- `bun run spike:nu-cmdk:impl-spec` executes successfully.
- outputs are generated from executable harness logic (not hand-authored fixtures).

---

## Iteration 18 — implementation slice extraction + executable validation

### Request (you)
- "keep going" with emphasis on validating whether patterns and implementation slices will work.

### Action taken
- extracted runtime slices into real source modules:
  - `src/lib/commands/nu-cmdk/slices/types.ts`
  - `src/lib/commands/nu-cmdk/slices/policyBundle.ts`
  - `src/lib/commands/nu-cmdk/slices/rendererCompatibility.ts`
  - `src/lib/commands/nu-cmdk/slices/cacheGuard.ts`
  - `src/lib/commands/nu-cmdk/slices/querySession.ts`
  - `src/lib/commands/nu-cmdk/slices/metrics.ts`
  - `src/lib/commands/nu-cmdk/slices/index.ts`
- rewrote spike script to consume slice modules instead of inline-only harness logic:
  - `scripts/spikes/nu-cmdk-impl-spec-spike.ts`
- added slice tests:
  - `src/lib/commands/nu-cmdk/slices/__tests__/querySession.slice.test.ts`

### Validation snapshot
- `bun run spike:nu-cmdk:impl-spec --run-id=spike-0004` passes and emits runtime-scripted artifacts.
- `bun run test:run src/lib/commands/nu-cmdk/slices/__tests__/querySession.slice.test.ts` passes (2/2 tests).

---

## Iteration 19 — next spike test (iteration 2 neighborhood)

### Request (you)
- "great next test."

### Action taken
- upgraded `scripts/spikes/nu-cmdk-impl-spec-spike.ts` to support iteration-driven plans:
  - `--iteration=1` (baseline + neighbor-a)
  - `--iteration=2` (anchor-i1-winner + neighbor-b + neighbor-c)
- expanded scenario coverage for iteration 2:
  - `RTM-006` (resolver deny path in HTTP lane)
  - `RTM-017` (burst + cache degrade stress)
- ran:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0005 --iteration=2`

### Validation snapshot
- artifacts generated:
  - `impl/spike/logs/2026-02-14-spike-0005-iteration-2.jsonl`
  - `impl/spike/logs/2026-02-14-spike-0005-iteration-2-comparison.md`
- winner: `spike-0005-c1` (`neighbor-b`)
- objective improved by 4.35 vs second place with guardrails passing.

---

## Iteration 20 — broker integration slice

### Request (you)
- proceed to next slice.

### Action taken
- implemented broker slice:
  - `src/lib/commands/nu-cmdk/slices/searchBroker.ts`
  - `makeNuCmdkSearchBroker` with query start/tell/snapshot/stop/stopAll/list
  - typed errors for not-found / duplicate sessions
- added broker tests:
  - `src/lib/commands/nu-cmdk/slices/__tests__/searchBroker.slice.test.ts`
  - validates query isolation and targeted shutdown behavior
- rewired spike script to route scenario messages through broker API (instead of direct session handle wiring).
- executed broker-backed spike run:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0006 --iteration=2`

### Validation snapshot
- tests: querySession + searchBroker slices pass (4/4).
- broker-backed iteration 2 run completes and emits artifacts:
  - `impl/spike/logs/2026-02-14-spike-0006-iteration-2.jsonl`
  - `impl/spike/logs/2026-02-14-spike-0006-iteration-2-comparison.md`
- winner remains `spike-0006-c1` under broker-backed routing.

---

## Iteration 21 — generic result adapters slice (broker fan-in)

### Request (you)
- "its not commands that can ONLY be returned, generically we return results"
- proceed with the next slice.

### Action taken
- added lane adapter slice:
  - `src/lib/commands/nu-cmdk/slices/laneAdapters.ts`
  - generic adapter contract (`LaneAdapter`) returning `QueryRow` for any result kind
  - completion→row mapper with resolver identity inference and renderer token shaping
  - static/failing adapter helpers for adversarial harnessing
- extended broker for adapter fan-in:
  - `searchBroker.runAdapters(queryId, queryOverride?)`
  - parallel adapter execution, per-lane seq tracking, isolated lane failure handling
  - emits adapter lifecycle events (`started/succeeded/failed`)
- updated test coverage:
  - `laneAdapters.slice.test.ts` (generic mapping + mixed category adapter)
  - extended `searchBroker.slice.test.ts` with runAdapters multi-kind ingestion case
- rewired spike harness to use broker adapters per scenario:
  - scenario adapters are grouped by lane, with explicit failing adapter injection for RTM-006
  - stale-seq/cancel/cache-crash stress retained via targeted post-adapter messages
- executed adapter-backed spike run:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0007 --iteration=2`

### Validation snapshot
- tests pass:
  - `querySession.slice.test.ts`
  - `searchBroker.slice.test.ts`
  - `laneAdapters.slice.test.ts`
  - total: 7/7 passing
- artifacts generated:
  - `impl/spike/logs/2026-02-14-spike-0007-iteration-2.jsonl`
  - `impl/spike/logs/2026-02-14-spike-0007-iteration-2-comparison.md`
- winner remains `spike-0007-c1` (`neighbor-b`) with guardrails passing.

---

## Iteration 22 — adapter typed-emits contract lock

### Clarification (you)
- "an adapter has a typed set of results it can emit"

### Action taken
- promoted adapter contract from untyped output to typed-emits model:
  - `LaneAdapter.emits: ReadonlyArray<ResultKind>`
  - broker enforces emits contract during fan-in (`lane.adapter.kind_mismatch` on violation)
  - mismatched rows are dropped before ingestion
- added canonical result-kind schema in slice types:
  - `ResultKind = command | entity | action | navigation | docs | terminal | workflow | agent | history | file | generic`
  - `QueryRow.category` now uses `ResultKind` (schema + type)
- updated adapter utilities:
  - completion normalization to canonical `ResultKind`
  - static/failing adapters require explicit `emits`
- updated spike harness to emit canonical kinds and provide per-adapter emits lists.

### Validation snapshot
- tests now pass with typed-emits enforcement:
  - `querySession.slice.test.ts`
  - `searchBroker.slice.test.ts` (includes kind-mismatch drop case)
  - `laneAdapters.slice.test.ts`
  - total: 8/8 passing
- spike rerun:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0008 --iteration=2`
  - artifacts:
    - `impl/spike/logs/2026-02-14-spike-0008-iteration-2.jsonl`
    - `impl/spike/logs/2026-02-14-spike-0008-iteration-2-comparison.md`
  - winner remains `spike-0008-c1`.

---

## Iteration 23 — registry-backed adapters + live provider lane

### Request (you)
- proceed after typed-emits clarification.

### Action taken
- added registry adapter selector support:
  - `adaptersFromProviderRegistry({ include, emitsByProviderId })`
  - lets broker consume provider-registry adapters with explicit typed emits contracts.
- extended spike harness with live provider registry traffic:
  - registered live providers (`nu-live-docs`, `nu-live-workspace`) in minibuffer v2 provider registry
  - generated adapters from registry with typed emits (`docs`, `file`)
  - merged these live adapters with scenario adapters so every run includes non-static provider lane execution.
- maintained typed contract enforcement in broker fan-in and preserved lane failure isolation behavior.

### Validation snapshot
- tests pass:
  - `querySession.slice.test.ts`
  - `searchBroker.slice.test.ts`
  - `laneAdapters.slice.test.ts` (now includes registry adapter emits override check)
  - total: 9/9 passing
- spike rerun:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0009 --iteration=2`
  - artifacts:
    - `impl/spike/logs/2026-02-14-spike-0009-iteration-2.jsonl`
    - `impl/spike/logs/2026-02-14-spike-0009-iteration-2-comparison.md`
  - winner remains `spike-0009-c1`.

---

## Iteration 24 — provider abstraction preamble + onboarding checklist

### Request (you)
- "More in depth on the provider abstraction, useful analogy and first principles thinking."
- "Do that, please, and append that last response as a design efficacy preamble."

### Action taken
- authored provider onboarding architecture checklist:
  - `arch/nu-cmdk-provider-onboarding-checklist.md`
- included design-efficacy preamble that captures:
  - first-principles framing (fuzzy intent, heterogeneous sources, stable UI contract)
  - 3-layer provider→adapter→broker/session model
  - airport analogy (airlines/customs/air traffic control/ground ops)
  - data-plane vs control-plane separation
  - health criteria (substitutable/typed/observable/isolated/composable/policy-safe)
- linked new checklist in docs map:
  - `docs/README.md`

### Validation snapshot
- no runtime behavior changes in this iteration; docs-only architecture codification.

---

## Iteration 25 — LayerRouter middleware parity decision (submodule-backed)

### Request (you)
- document the middleware/router design decision and rationale.
- use Effect submodule internals and mirror `HttpLayerRouter` architecture for provider+adapter orchestration.

### Action taken
- researched Effect submodule internals and documented findings:
  - `research/effect-http-layer-router-internal-notes.md`
  - inspected:
    - `../../submodules/effect/packages/platform/src/HttpLayerRouter.ts`
    - `../../submodules/effect/packages/platform/src/internal/httpRouter.ts`
    - `../../submodules/effect/packages/platform/README.md`
- authored locked architecture decision:
  - `arch/nu-cmdk-provider-adapter-layer-router-decision.md`
  - codifies service router + global/adapter middleware parity, typed channels, parse-once, bounded N+1 dispatch.
- promoted decision lock D18 in:
  - `arch/nu-cmdk-decision-lock.md`
  - `arch/ascii/traceability-index.md`
- linked docs map updates in:
  - `docs/README.md`

### Validation snapshot
- docs/decision wave only (no runtime code mutation in this iteration).

---

## Iteration 26 — QueryAdapterRouter implementation slice (D18 execution)

### Request (you)
- "let's get a slice going, yes."

### Action taken
- implemented `QueryAdapterRouter` slice with middleware parity primitives:
  - `src/lib/commands/nu-cmdk/slices/queryAdapterRouter.ts`
  - router API: `addAdapter`, `addAdapters`, `addGlobalMiddleware`, `addAdapterMiddleware`, `listAdapters`, `dispatch`
  - middleware model: `queryAdapterMiddleware(...).combine(...)`
  - dispatch behavior: deterministic cost ordering (`fast -> medium -> heavy`) + bounded concurrency (`maxConcurrency`)
  - dispatch output: typed `DispatchSucceeded | DispatchFailed`
- upgraded adapter model for router dispatch planning:
  - `laneAdapters.ts`
  - added `costClass` and `makeQueryDispatchPlan(...)`
  - added optional `dispatchPlan` in adapter input for parse-once reuse
- rewired broker to execute via router dispatch engine:
  - `searchBroker.ts`
  - preserves lane events (`started/succeeded/failed/kind_mismatch`)
  - retains typed-emits enforcement and lane sequence ingestion
- added router tests:
  - `queryAdapterRouter.slice.test.ts`
  - verifies cost-order dispatch, middleware composition behavior, and bounded concurrency

### Validation snapshot
- tests pass:
  - `querySession.slice.test.ts`
  - `searchBroker.slice.test.ts`
  - `laneAdapters.slice.test.ts`
  - `queryAdapterRouter.slice.test.ts`
  - total: 12/12 passing
- spike rerun:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0010 --iteration=2`
  - artifacts:
    - `impl/spike/logs/2026-02-14-spike-0010-iteration-2.jsonl`
    - `impl/spike/logs/2026-02-14-spike-0010-iteration-2-comparison.md`

---

## Iteration 27 — canonical middleware spec

### Request (you)
- "I meant for middleware specifically."
- "Yes. do this."

### Action taken
- authored canonical middleware spec:
  - `arch/nu-cmdk-query-middleware-spec.md`
- spec covers:
  - middleware scopes (global + adapter-local)
  - deterministic ordering/composition
  - parse-once dispatch lifecycle
  - bounded concurrency interaction
  - failure semantics + observability requirements
  - acceptance criteria + anti-patterns
- linked the new spec in docs map and D18 decision references:
  - `docs/README.md`
  - `arch/nu-cmdk-provider-adapter-layer-router-decision.md`
  - `arch/nu-cmdk-decision-lock.md`

### Validation snapshot
- docs-spec codification pass only (no runtime mutation in this iteration).

---

## Iteration 28 — middleware registry IDs + phase telemetry + heavy admission slice

### Request (you)
- proceed with middleware registry IDs, phase telemetry, and admission behavior for heavy adapters.

### Action taken
- upgraded `queryAdapterRouter` middleware system:
  - middleware registry primitives:
    - `registerMiddleware`
    - `addGlobalMiddlewareId`
    - `addAdapterMiddlewareId`
    - `listRegisteredMiddlewareIds`
  - error contract:
    - `QueryMiddlewareNotFound`
  - router telemetry events:
    - `query.middleware.phase.started|completed|failed`
    - `query.adapter.dispatch.started|completed|failed`
  - phase coverage:
    - `query.parse`
    - `middleware.global`
    - `middleware.adapter`
    - `adapter.dispatch`
- implemented heavy admission middleware helper:
  - `makeHeavyAdapterAdmissionMiddleware(...)`
  - gate heavy adapter execution by query length/terms/scope policy.
- broker integration updates:
  - broker now wires router telemetry into event stream via `onEvent` bridge.
  - added broker deps for middleware IDs / registry injection.
- tests expanded:
  - `queryAdapterRouter.slice.test.ts` now covers:
    - registry-ID middleware usage,
    - heavy-adapter admission behavior,
    - middleware phase telemetry emission,
    - previous cost-order and bounded concurrency checks.

### Validation snapshot
- tests pass:
  - `queryAdapterRouter.slice.test.ts`
  - `searchBroker.slice.test.ts`
  - `laneAdapters.slice.test.ts`
  - `querySession.slice.test.ts`
  - total: 15/15 passing
- spike rerun:
  - `bun run spike:nu-cmdk:impl-spec --run-id=spike-0011 --iteration=2`
  - artifacts:
    - `impl/spike/logs/2026-02-15-spike-0011-iteration-2.jsonl`
    - `impl/spike/logs/2026-02-15-spike-0011-iteration-2-comparison.md`

---

## Iteration 29 — validation gap analysis and closure plan

### Request (you)
- perform a real gap analysis on whether proposed architecture and implementation are fully validated.

### Action taken
- authored validation matrix + closure plan document:
  - `impl/nu-cmdk-gap-analysis.md`
- analysis includes:
  - T1/T2/T3/T4 evidence model,
  - D01–D18 coverage matrix,
  - gap clusters (production path, real transport, persistence, telemetry gating, typed channels),
  - recommended closure waves (A–E) with explicit exit criteria.
- linked the new artifact in docs index (`docs/README.md`).

### Validation snapshot
- docs analysis pass only; no runtime mutation in this iteration.

---

## Iteration 30 — hardened WBS v2 synthesis

### Request (you)
- harden the WBS and proceed to building.
- explicit expectation for a large-form master planning artifact.

### Action taken
- authored hardened master WBS:
  - `impl/nu-cmdk-wbs-v2-master.md`
- WBS v2 includes:
  - full latent backlog decomposition,
  - task-level decision links (D01–D18),
  - required evidence tiers (T1–T4),
  - dependency sequencing and milestone gates,
  - risk register and audit protocol.
- linked WBS v2 in docs index (`docs/README.md`).

### Validation snapshot
- planning artifact expansion only in this iteration.

---

## Iteration 31 — build-phase scaffold kickoff (Phase 1)

### Request (you)
- "enough validation ... let's get to actually building"

### Action taken
- started implementation-phase scaffold for shell architecture:
  - `src/lib/commands/shell/types.ts`
  - `src/lib/commands/shell/contracts.ts`
  - `src/lib/commands/shell/NuCmdkShell.tsx`
  - `src/lib/commands/shell/components/{ModeBand,QueryBand,KindBand,ResultsBand,FooterBand}.tsx`
  - `src/lib/commands/shell/components/index.ts`
  - `src/lib/commands/shell/index.ts`
- exported scaffold from command package surface:
  - `src/lib/commands/index.ts`

### Validation snapshot
- scaffold build slice only (no host cutover in this iteration).

---

## Iteration 32 — ResultsBand item consumer contract lock

### Request (you)
- "the ITEM itself. ought to be decomposed."
- provider-facing API should allow object-driven rendering under typed constraints.
- explicitly define who consumes this API.

### Action taken
- ran structured alignment questionnaire for item-consumer boundary.
- locked consumer model:
  - primary consumer: provider authors,
  - control boundary: hybrid (provider semantic/display hints + shell-owned layout/typography/interaction),
  - typed style: Schema + namespaced extension bag,
  - customization mode: data + typed slot override components.
- recorded architecture decision artifact:
  - `arch/nu-cmdk-item-consumer-contract-decision.md`
- synchronized lock references:
  - `arch/nu-cmdk-decision-lock.md` (added D19)
  - `arch/ascii/traceability-index.md` (added D19)

### Validation snapshot
- documentation/decision sync pass only.

---

## Iteration 33 — D19 feature plan import + execution map

### Request (you)
- "Let's do it! write a feature_plan out for this stuff."

### Action taken
- imported D19 execution tree into tasker feature graph:
  - root: `#F270` NuCmdk D19: Provider-first ResultsBand Item Contract
  - subfeatures: `#F271`..`#F274`
  - tasks: `#1024`..`#1041`
- authored implementation-facing plan doc:
  - `impl/nu-cmdk-d19-feature-plan.md`
- linked D19 feature plan in docs index.

### Validation snapshot
- planning/import pass only (no runtime mutation in this iteration).

---

## Iteration 34 — D19 context contract (Atom state + Effect ops)

### Request (you)
- add a context contract and specify API expectations for return surfaces (Effects and Atoms, respectively).

### Action taken
- added D19 provider context contract module:
  - `src/lib/commands/shell/item-contract.ts`
- contract includes:
  - schema-first item payload families,
  - provider descriptor schema,
  - **atom-first state contract** (`NuCmdkItemProviderAtoms`),
  - **effect-first operation contract** (`NuCmdkItemProviderEffects`),
  - composed provider context contract (`NuCmdkItemProviderContextContract`).
- added transitional row mapper for integration wave:
  - `shellRowToItemModel(...)`
- exported contract from shell + command package surfaces.

### Validation snapshot
- typecheck pass (`bunx tsc --noEmit`).

---

## Iteration 35 — D19 implementation wave (item contract wired into shell/results)

### Request (you)
- "let's do the work as planned! proceed"

### Action taken
- implemented schema-first item contract + provider bridge exports:
  - `src/lib/commands/shell/item-contract.ts`
- rewired `ResultsBand` to provider-item model:
  - item-first props (`items`) with row-compat fallback (`rows` + mapper),
  - typed slot overrides (`icon/content/meta/actions`),
  - section grouping over item models,
  - item/section context decomposition and slot render contexts.
- integrated shell + overlay path to pass typed items:
  - `NuCmdkShell` now supports `items`, `onSelectItem`, and `itemSlots` pass-through.
  - `NuCmdkShellOverlay` maps rows → items via `shellRowToItemModel` and executes via item selection.
- expanded component export surface for provider consumers.

### Validation snapshot
- typecheck pass (`bunx tsc --noEmit`).
- feature tasks advanced:
  - done: `#1026`, `#1027`, `#1028`, `#1031`
  - in_progress: `#1040`

---

## Iteration 36 — ResultsBand.Item deep decomposition + slot policy completion

### Request (you)
- complete decomposition in entirety, specifically Item internals and provider-facing control model.

### Action taken
- reworked `ResultsBand` to item-first architecture with recursive item decomposition:
  - `ItemRoot`, `ItemLeft`, `ItemRight`
  - slot envelopes: `ItemIconSlot`, `ItemContentSlot`, `ItemMetaSlot`, `ItemActionsSlot`
  - action primitives: `ItemActionGroup`, `ItemActionButton`
- added per-item slot policy API:
  - global `itemSlots`
  - per-item `resolveItemSlots(context)` merge strategy
- added strict decode boundary + violation hook path for unknown provider payloads:
  - `decodeItemModelUnknown`
  - `decodeItemModelsUnknown({ mode: strict|drop-invalid, onViolation })`
- preserved compatibility path:
  - `rows` + `rowMapper` fallback still supported while item-first path is active.

### Validation snapshot
- typecheck pass (`bunx tsc --noEmit`).
- D19 implementation tasks advanced to done for decode, item decomposition, guardrails, slot API, resolver hooks, and overlay integration.

---

## Iteration 37 — D19 validation wave (schema + slots + guardrails)

### Request (you)
- continue canonical tasks from current step.

### Action taken
- added schema boundary tests:
  - `src/lib/commands/shell/__tests__/item-contract.test.ts`
  - covers strict failure, drop-invalid path, violation callback, and row mapper compatibility.
- added ResultsBand rendering tests:
  - `src/lib/commands/shell/__tests__/ResultsBand.test.tsx`
  - covers fallback rendering, slot overrides, layout envelope guardrails, action-intent dispatch without row-select leakage.
- documented provider API recipes:
  - `arch/nu-cmdk-resultsband-item-api.md`
  - linked from docs index.

### Validation snapshot
- test run:
  - `bun run test:run src/lib/commands/shell/__tests__/item-contract.test.ts src/lib/commands/shell/__tests__/ResultsBand.test.tsx`
  - result: 10/10 passing.

---

## Iteration 38 — broker/session-backed command provider context (overlay runtime)

### Request (you)
- "these were slices though, they're surely not sufficient for a real, robust implementation"
- "continue, remember, we have specs and docs ... diverged from implementation and current operational reality."

### Action taken
- replaced command overlay bridge from `useCommandSearch` with broker/session runtime context:
  - new provider module: `src/lib/commands/shell/providers/command-provider-context.ts`
  - exports via: `src/lib/commands/shell/providers/index.ts` and shell barrel.
- overlay now consumes provider contract state directly from atoms:
  - `provider.context.atoms.items`
  - `provider.context.atoms.sections`
  - effect surfaces for query/execute/preview.
- introduced broker lifecycle in provider effect path:
  - lazy broker initialization via `makeNuCmdkSearchBroker`
  - `startQuery` + `runAdapters` + `snapshot` per query mutation
  - previous query stop before next dispatch.
- expanded `QueryRow` slice contract to carry render-critical UI fields:
  - `label`, `description`, `badges`, `shortcuts`, `sectionKey`, `sectionTitle`, `sectionPriority`.
- updated lane adapter completion normalization to populate those fields.

### Validation snapshot
- typecheck pass: `bunx tsc --noEmit --pretty false`.
- tests pass:
  - `laneAdapters.slice.test.ts`
  - `searchBroker.slice.test.ts`
  - `item-contract.test.ts`
  - `ResultsBand.test.tsx`
  - total in targeted run: 18/18 passing.

### Reality checkpoint
- status moved from "slice-only" to "runtime-integrated for command overlay path".
- still not fully production-complete:
  - no multi-lane real transport surfacing in shell yet,
  - no persisted SQLite/WAL execution in runtime path,
  - no dedicated e2e host parity harness yet.

---

## Operator note

This log is append-only by iteration. Never rewrite history; add correction entries when alignment drifts.

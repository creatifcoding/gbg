# RFC — Canonical TLA Package Suites (Layer-Compositional)

**Status:** Draft for Prime ratification · **Date:** 2026-07-03 · **Author:** Val (synthesis of a 12-agent Opus 4.8 + Sonnet workflow: 2 grounding agents, 5 cluster designers at high effort, 5 adversarial judges)
**Companions:** [`effect-v4-layer-doctrine.md`](effect-v4-layer-doctrine.md) (the verified v4 Layer doctrine this RFC builds on) · [`latent-systems-map.md`](latent-systems-map.md) (all boundary evidence; §4c = adversarially-verified facts) · [`../metaprompts/extract-latent-system.metaprompt.md`](../metaprompts/extract-latent-system.metaprompt.md) (execution protocol per pass)
**Judge verdicts:** transport ACCEPT (9/9/9) · state, runtime, morph, industrial ACCEPT_WITH_REVISIONS — all judge errata are folded into this synthesis and marked ⚠ where they changed a designer's claim.

> Every package in this register is **layer-compositional**: it exposes Effect v4 Layers composing into service graphs at multiple levels — L0 config/contracts → L1 infra/clients → L2 domain services → L3 app wiring, with `layerTest` siblings throughout. Where a package is genuinely reactive-state-shaped (the stx exception), the RFC says so honestly instead of faking a service graph (§0.3).

> **AMENDMENT 2026-07-03 (Prime directive — canonical-path inversion):** the `effect-v4` npm-alias regime described in §0.8 is **superseded**. The monorepo's canonical `effect` install path moves to the latest Effect v4; legacy v3 consumers are contained via an `effect-v3` alias / per-package pin instead. All §0.8 alias-name conventions (peer under `effect-atom-react-v4` etc.) invert to canonical names at the v4 pin. Execution spec: [`../../handoff/effect-canonical-inversion.md`](../../handoff/effect-canonical-inversion.md). This also dissolves OPEN-1's alias asymmetry — v3-consumer re-points become ordinary v3→v4 codemods.

---

## §0 — Conventions ratified (standardizing 11 verified divergences)

The four existing TLAs (stx, msh, pct, lnk) diverge on nearly every convention (verified by the grounding pass with file:line cites — see workflow journal). This RFC ratifies:

1. **Naming:** `@tmnl/<tla>` — exactly 3 lowercase letters, consonant-leaning. `@gbg/*` stays app-tier. A TLA is earned by owning **one architectural layer** in the composition stack.
2. **Service definition:** v4 `Context.Service<Self, Shape>()('<tag>')` two-generic class form, universally. **Tag-string shape standardized** (4 incompatible shapes exist today): `@tmnl/<pkg>/<seam>/<Name>` — source-path-shaped, no `services/` segment, no `Service` suffix in the tag. (Fixes lnk's own `MshBridgeDiagnostics.ts:35` convention bug.)
3. **Class naming:** `Service`-suffixed classes for genuine services (`NatsConnectionService` style); unsuffixed reserved for handles/values (`Lnk`, `Wire`).
4. **Layer factories:** `static readonly layer` (+ `layerFrom<Deps>` where injection matters, `layerConfig(input)` for parameterized, `layerTest` mandatory) on the class. The `Default.ts`-file idiom (pct) and bare `xxxLayer` free functions are deprecated; free `XxxLive` consts survive only as sugar aliases.
5. **Barrels:** namespaced `export * as X` (msh's flat `export *` hit a real collision at `msh/src/index.ts:16`) + **one frozen aggregate object** per package (`Msh`-pattern: `export const Xxx = {...} as const` mapping every Service/layer pair).
6. **Test layers:** every package ships `layerTest` siblings — **no existing package has one today** (house gap, verified). In-memory-impl-as-test-layer (lnk's `InMemoryWire`) is the model; per-test isolation via `Effect.provide(layer, { local: true })` (v4-new), `Layer.fresh` reserved for tests.
7. **NX:** every TLA registers a `project.json` with `tags: ["scope:tmnl","type:lib","domain:<real-domain>","effect:v4"]` — **pct currently has none** (fix), and the `domain:` taxonomy gets real values (msh=transport, not `domain:data`).
8. **Effect pinning:** `"effect-v4": "npm:effect@4.0.0-beta.59"` npm alias, no tsconfig path mapping (effect-sui's is redundant — remove). Peer-alias convention unified: peer under the alias name (lnk-style `effect-atom-react-v4`), not the real npm name. `effect-vitest-v4` mandatory (pct lacks it).
9. **Doctrine compliance** (headline v4 facts, all verified in the doctrine doc): **there is no `Layer.scoped`** (scoped construction folds into `Layer.effect`); `Layer.succeed(Tag)(value)` is curried; `Context.Service` `make` does **not** auto-generate `.Default` and `dependencies` is gone — layers are hand-composed with `Layer.provide`; the shared MemoMap dedups **by layer identity**; `unstable/*` (rpc, http, sql, cluster, schema, ai) may break between betas — pin exact and treat those Layer signatures as semver-exempt.

### §0.3 — The dual composition model (the stx exception, generalized)
Verified: `stx` contains **zero** `Context.Service`/`Layer` code — it is an Atom/XState factory. The morph cluster is predominantly the same shape. The RFC therefore recognizes **two composition kinds**, and every package declares which it is per tier:
- **Kind A — Layer graph** (msh precedent): genuine services, multi-level `layer`/`layerTest`.
- **Kind B — Atom/XState factory** (stx precedent): scoped atom registries + machines, composed by React context.
Faking Kind A onto Kind B tiers is forbidden (it's decorative Layer theatre). A package may be mixed (crd) — the manifest says which subpath is which.

---

## §1 — The `dmn` name conflict: RESOLVED (gating decision)

Two live RFCs define DMN incompatibly: `docs/rfc/0001-dmn-domain-module-network.md` (**Domain Module Network** — generic domain-module substrate) vs `src/lib/iiot/docs/industrial-platform/RFC-0002-DMN-DATA-MESSAGE-NETWORK.md` (**Data/Message Network** — IIoT telemetry fabric). **This RFC adopts RFC-0001**: `dmn` = the generic event-sourced domain-module kit. RFC-0002's telemetry-fabric concern re-homes into the `iot` vertical + `msh` (which explicitly refuses domain policy, `msh/AGENTS.md:17`). Scaffolding `dmn` before ratifying this bakes an ambiguous name into a production package — **this gates the industrial cluster.**

---

## §2 — The TLA register

| TLA | Expansion | Cluster | Kind | Status | Readiness |
|---|---|---|---|---|---|
| `stx` | Surgical State | state | B | exists (anchor) | AMBER (dup-React fix + 53-importer migration; absorbs fermion) |
| `msh` | Mesh (NATS substrate) | transport | A | exists (anchor) | **GREEN** |
| `pct` | Pact Protocol | protocol | A | exists | (not re-audited this pass) |
| `lnk` | Durable-stream handles | transport | A | exists, dormant | AMBER (activate; NATS-bridge Phase 5 unstarted) |
| `dmn` | Domain Module Network | industrial | A | **reserved → author** | RED (keystone; does not exist) |
| `prt` | Ports/linking | ports | A/B | proposed | RED (v3; dataplane tests RED) |
| `qry` | Query/search engine | state | A | proposed (ex-search) | **GREEN** (122/122) |
| `grd` | Grid (ex-datagrid) | state | A | rename+absorb | AMBER |
| `num` | Numeric WASM kernel (ex-mathkernel) | state | A | rename | AMBER |
| `vbl` | Variables + data-manager | state | A | proposed | RED (v1/v2 reconciliation) |
| `flo` | Flow (ex-streams) | state | A | proposed | AMBER (core green) |
| `cog` | Cognition (ai-core+mcp) | runtime | A | proposed | AMBER (v3→v4 codemod, 22 sites) |
| `rig` | Agent Rig (harness+agents auth) | runtime | A | proposed | RED (132 TaggedStruct — costliest) |
| `mrp` | Morph substrate | morph | B + tiny A | proposed | **GREEN** (keystone of morph) |
| `crd` | Card (morph-card suite) | morph | **A + B** | proposed | AMBER (agents subpath RED) |
| `srf` | Surface (morphchat suite) | morph | B | proposed | RED core / GREEN leaves |
| `iot` | Industrial Ops Telemetry (ex-iiot) | industrial | A | proposed | AMBER decompose / RED extract |
| `geo` | Geospatial server pipeline | industrial | A | proposed | AMBER (extract-first vertical) |
| `ams` | Asset Management System | industrial | A | natively TLA | AMBER (dormant-complete; root corrupted) |
| `sio` | Site Intelligence Ops (ex-sios) | industrial | A | proposed | RED (finish or shelve) |
| `srm` | Semantic Rules Model (ex-sream) | industrial | — | spec-only | RED (keep as docs) |

Alt-name notes: `var` rejected for JS-keyword adjacency → `vbl`. `prt` alternatives `pln`/`plx`. TLA taste is Prime's to ratify.

---

## §3 — Transport suite: `msh` ⊕ `lnk` (+ `prt` sibling) — judge ACCEPT 9/9/9

**Two TLAs, both existing.** `msh` (anchor, GREEN, 42 commits/90d hardening, the doctrine's own canonical reference) absorbs `src/lib/nats` and retires the frozen `holonet` shim. `lnk` (AMBER) activates, absorbing `src/lib/durable-streams` (broken v3) — its `NatsBridgeWire` composes `msh` rather than re-implementing a client. **Four parallel NATS clients cull to one.**

- **msh graph:** `MshConfigTag`/`MshJwtService` (L0) → `Connection`/`Auth`/`Codec`/`Inner` (L1, `Layer.effect`+`acquireRelease`) → `{Hub,PubSub,KV,Stream,Micro,Discovery,Diagnostics}Live` (L2) → consumer `mergeAll` (L3). The Inner-shared-by-PubSub-and-Hub overlap is the MemoMap single-build payoff: one NATS connection.
- **lnk graph:** `Contracts` (L0 Schema brands) → `Wire` (L1, three swappable impls: InMemory=test, Http, NatsBridge) → `Lnk`/`Lnks` RcMap (L2) → provide-once (L3).
- **Cross-package contract (critical):** the app must provide the **same** `Msh.ConnectionLive` instance to lnk's bridge and any direct msh usage — a re-declared connection layer is a distinct identity → two NATS connections despite the MemoMap.
- **`prt` (new sibling, separate pass):** `dataplane` (verified zero transport imports — it's an in-process d2ts block-linking graph) + `connection-ports`' port abstraction and **live** `buildLayersFromSpec` (map §4c-1). Its transport-touching halves (`NatsPort`, `DurableStreamsPort`) are deprecated in favor of `Msh.*Live` + lnk handles. RED until v3→v4 + dataplane test repair.
- **Deprecation ledger:** holonet shim (after 26 consumers re-point), `src/lib/nats`, `src/lib/durable-streams`, connection-ports' two port services, `msh/src/core/auth/schemas.ts` (verified orphan dup).
- **OPEN-1 (blocking):** v3 consumers (iiot/realtime, agents/tasks, tsingou-flow) — force-migrate to v4 **or** ship an msh v3-facade. Single-version discipline forbids mixed v3/v4 composition. *RFC default recommendation: v3-facade for iiot/realtime (Reactor is mid-convergence; don't force a migration into active work), force-migrate agents/tasks and tsingou-flow (small surfaces).*

## §4 — State/data suite: `stx` + `num` + `grd` + `qry` + `vbl` + `flo`

The keystone is **`Stx.RegistryLayer`** — the ONE Layer stx grows (an L0 `AtomRegistry` provisioner, ~30 lines, `LOOP OPEN`: verify Registry-as-Context.Service against atom-react beta) so `grd`/`vbl`/`flo` can share a single atom registry by layer identity. stx otherwise stays Kind B (its nature; do not "improve" it into a service graph).

- **`qry`** (ex-search): GREEN, extract-first of the whole program — L1 swappable driver layers (pct's strategy-fan-out pattern), L2 `SearchService.layer`, ~16 importers (⚠ judge: use the map's 16, not 17), near-zero codemod.
- **`grd`** (ex-datagrid + absorbs `src/lib/data-grid`): already v4-native `Context.Service` — but `makeDatagridLayer` hand-rolls nested `Effect.scoped(Layer.build)` per sub-service, the compose-once antipattern; refactor to a single provided graph. Dedup FormulaEngine v1/v2. Repair the two syntax-corrupted `data-grid/column-schema` files first. 18-importer migration.
- **`num`** (ex-mathkernel): ⚠ judge correction — it **is wired** to grd: `stack-vm` synchronously calls `tryWasmDispatch` on the hot path; the WASM module load is async/fire-and-forget, so cold-start falls back to in-JS eval. The work is wrapping the WASM lifecycle as a scoped `Layer.effect` + `acquireRelease`, not first-time wiring. Sole consumer is grd — folding in is legitimate; kept separate so qry/flo can borrow.
- **`vbl`** (variables + data-manager): RED — blocked on the v1/v2 reconciliation (v1 out-consumes "stable" v2; audit picks the loser before any Layer contract is drawn).
- **`flo`** (ex-streams): core 241/243 green; fold `playground/` out → GREEN. L1 `Channel.layer` (broadcast/backpressure) + L2 factories.
- **Cross-package contracts:** single-instance Registry (stx-exported only), single-instance WASM kernel, compose-then-provide-once, suite-wide beta.59 pin with the peer-alias convention from §0.8.

## §5 — Morph/surface suite: `mrp` + `crd` + `srf` (operator first-class)

⚠ Reframing (verified, honest): **this cluster is Effect v3 and predominantly Atom/XState** — only a thin service spine (card-state, card-server, cursor's cluster handlers) is Kind A. The 13-package wave-2 manifest **compresses to 3 TLAs with subpath exports** (the msh model: one package, 9 subpaths — not a package explosion).

- **`mrp`** (morph substrate, GREEN, extract FIRST): `mrp/grammar` (transition-grammar — the verified cross-suite import), `mrp/registry` (new `createScopedAtomRegistry` factory deleting the byte-copy registry pair), `mrp/streaming` (streaming-metrics provider — severs the chat→morphchat back-edge), `mrp/schemas` (`ToolInvocationState` leaf), `mrp/config` (the only Layer here — forcing more would be theatre).
- **`crd`** (card, AMBER, dormant → start here): subpaths schemas/state/server/machine/atoms/core/generative/agents. `crd/state` + `crd/server` carry the v3→v4 codemod (`Context.Tag`→`Context.Service` arg-inversion, curried `Layer.succeed`). `crd/core` AMBER until `MorphCard.tsx`'s module-scope genifer imports split into `crd/generative`. **`crd/agents` RED**: ⚠ judge correction — its public surface is exactly `streamFixAgent`/`streamEvolutionAgent`; `CardEntity`/`CardEntityHandlers` are **cursor-owned** and stay there. cursor remains an app-side external client; flag a future re-home of agents → `genifer` (U2 decision).
- **`srf`** (surface, Kind B by design): schemas/presets/adapter-mock GREEN; machine/atoms AMBER (atom-alias codemod); **core RED** (14-file/~30-symbol hard peer dep on `@tmnl/chat` — its rendering identity; ship with chat as peer); **adapter-harness RED** (all 8 recent commits land there — extract LAST, coordinated with pi-session work, against `rig`'s session-schemas contract leaf §6). Repair the corrupted `status-banner-view.tsx` before any srf tsc gate.
- **After the two mrp moves, `crd` ⊥ `srf`** (no direct edge) and the chat↔srf cycle dissolves — all edges downward-only.
- Deprecations: morphchat skins system (archived in reality, doc stale), UITreeDiffer (zero consumers — park as experimental in crd/generative or drop), the byte-copy registries, stale ARCHITECTURE.md diagram. Genifer-side flag: `prompt-eval.ts` hard-codes `'morphchat'` in its schema — replace with an `mrp` SurfaceId brand.

## §6 — Agent/AI runtime suite: `cog` + `rig`

**Two runtimes that verifiably never import each other — the suite names them honestly instead of merging them.**

- ⚠ Load-bearing correction to map §U3 (import-evidence, judge-accepted): `ai-core` imports `agents` **zero** times and has its own Pi path; the sole consumers of `agents/{providers,auth}` are harness files. **The OAuth-Pi bridge belongs in `rig`, not `cog`.** (Map §U3's "ai-core absorbs agents' bridge" is superseded.)
- **`cog`** (= ai-core + mcp as `@tmnl/cog/mcp`): L0 `CogConfig` → L1 `McpClient.layer` (scoped stdio/SSE) + `ProviderClient.layer` → L2 `ToolBridge`/`Compactor`/`Session*` → L2-top `AICoreService.layer` → L3 `CogLive`. Codemod: ⚠ ~22 service-definition sites (judge recount: agents' figures were 29+7, ai-core 15+6 + mcp 1+1 — show greps in the pass). Real consumers: terminal v2/v3, cop. AMBER → GREEN after codemod + a green test run (its tests have never been executed).
- **`rig`** (= harness − pragma + agents/{providers,auth,config}): the L3 graph already exists (`HarnessRuntimeLive` is `RigLive`, already using `provideMerge` correctly); in-memory session store is a free test layer. **RED — 132 `Schema.TaggedStruct` (recounted; the repo's costliest v4 conversion) + active-dev coupling.** DEFER full extraction.
- **`@tmnl/rig/session-schemas`** — the one near-term GREEN move inside rig: extract `harness/session/v2/{pi-session-schemas,schemas}` as an L0 contract leaf so `srf/adapter-harness` peer-depends on the **contract**, not engine internals. Land in lockstep with the morph cluster's adapter-harness work.
- `pragma` → `packages/pragma` (Rust, non-TLA). Deprecations: `ai` DELETE, `nex` DELETE, `rag` ARCHIVE (optional future cog tool), `editor-ai` ARCHIVE. `agents/tasks` (78 files) routes OUT to the chat suite (U1) — it's task-log rendering, not runtime. A future cog↔rig shared kernel is explicitly NOT proposed (zero shared code today).

## §7 — Industrial domain suite: `dmn` + `iot` + `geo` + `ams` + `sio` (+ deferred `srm`)

⚠ Judge-hedged framing: the four verticals show strong **directory-structure isomorphism** (es-core universal 4/4; facade 3/4; realtime 1.5/4) — the "one pattern" claim is *inferred from that isomorphism*, and its keystone `dmn` does not exist yet. Treat the Triptych as the working hypothesis the `dmn` authoring pass must prove, not settled fact.

- **The Domain-Vertical Triptych** (the working pattern): es-core plane → `dmn` (`makeAggregate`/`makeProjection`/`EventStore`), facade plane → `pct` + rpc (`LOOP OPEN`: pct-as-facade is a design proposal — iiot/geoint use `@effect/rpc` directly today; spike before committing), realtime plane → `lnk` over `msh`. Each independently omittable (ams omits both; sio omits realtime) — the variance is the flexibility proof.
- **`dmn`** (RED, keystone): author v4-native — `EventStore.layer` (L1 scoped sql-pg pool, single shared instance), builders returning per-vertical L2/L3 layers. Author BEFORE touching any vertical.
- **`geo`** (AMBER, extract-first vertical): ⚠ judge boundary fix — `geo` = geoint's server pipeline ONLY (`ingestion`, `cluster`, `persistence/postgis`, `server`, `migrations`); entity-fusion (`entities/`, `geoint/kori`, `lib/ecs`) and `SearchRpcServer`'s search-serving stay with the geoint client side until the fusion sub-vertical gets its own pass — the Triptych table's inclusion of them was a self-contradiction. Codemod: Context.Tag ×55, platform/rpc/cluster ×51, TaggedStruct ×37, **FiberRef 0**.
- **`iot`** (ex-iiot): decompose in place NOW along the 5 verified seams; extract post-Reactor-v2-convergence + scoped v4 migration (Context.Tag ×69, platform fold ×111 concentrated in rpc/http/entity). Holonet coupling resolves via §3 OPEN-1.
- **`ams`**: carry only `v2/base` (textbook CQRS, the purest `dmn.makeAggregate` reference); drop the corrupted root trio and the wms/tms stubs; then a WIRE-or-archive decision.
- **`sio`** (ex-sios): RED — orphaned mid-build; finish or shelve; valuable as the degraded-gracefully case.
- **`srm`** (ex-sream): spec-only; composes later as a policy layer over `dmn`/`ams`. No scaffold.
- Deprecations: iiot's two dead `@deprecated` symbols; maidens' duplicate ISA-18.2 contracts (reconcile onto iot schemas).

---

## §8 — Cross-suite composition (the whole-repo service graph)

```
L0  configs: MshConfig · CogConfig · RigConfig · MrpConfig · Xxx.configLayer · ddl/migrations
L1  SHARED SINGLE INSTANCES (by-identity memoization — export once, provide everywhere):
      Msh.ConnectionLive (one NATS conn)  ·  dmn.EventStore/SqlLive (one pg pool)
      Stx.RegistryLayer (one AtomRegistry) ·  num.NumKernel.layer (one WASM module)
L2  domain services: msh leaf services · lnk handles · grd/qry/vbl/flo · cog/rig cores
      crd state/server · iot/geo/ams/sio es-cores (via dmn builders)
L3  facades & wiring: vertical http/realtime layers (pct/lnk) · CogLive/RigLive ·
      srf/crd React roots (Kind B) · app mergeAll → Effect.provide ONCE
```
**The four shared-instance contracts** are the suite system's load-bearing rule: a re-declared layer is a distinct identity → duplicate connection/pool/registry/kernel, silently. Export the owning layer from exactly one package; peers `Layer.provide` that instance.

## §9 — Program sequencing (folds into map §5)

1. Repair the 13 corrupted files (gates all tsc acceptance gates) + stx React dedup + broken holonet imports. Zero-risk deletions (`ai`, `nex`, eisenhower, metaskill husk, components/shell, msh orphan dup).
2. **Ratify this RFC's names + the `dmn` §1 decision.**
3. `mrp` (morph keystone) → `crd` leaves → `qry` → `stx` migration (+fermion) → `flo`.
4. `@tmnl/rig/session-schemas` contract leaf ⟂ morph adapter-harness coordination. `cog` codemod. `pragma`/prospects/getbyshell/telegram relocations.
5. Transport OPEN-1 decision → holonet retirement → lnk activation (Phases 3–5). `grd` compose-once refactor + absorb data-grid (+`num` lifecycle layer).
6. Author `dmn` → extract `geo` → decompose `iot` in place → `ams` WIRE decision.
7. LAST: `srf/core` (+`@tmnl/chat` reconciliation), `srf/adapter-harness`, `rig` full conversion (132 TaggedStruct), `vbl` post-audit, `prt`.

## §10 — Open-threads ledger

| ID | Thread | Owner cluster |
|---|---|---|
| OPEN-1 | v3 consumers of msh: force-migrate vs v3-facade (default: facade for iiot/realtime, migrate the rest) | transport |
| LO-1 | lnk NATS-bridge single-build not runtime-observed | transport |
| LO-2 | lnk HttpRoutes covers retiring durable-streams/server surface — unconfirmed | transport |
| LO-3 | Registry-as-Context.Service adapter (`Stx.RegistryLayer`) vs atom-react beta — verify | state |
| LO-4 | num test-reality unmeasured | state |
| LO-5 | crd/agents final home (crd vs genifer) — U2 sequencing decision | morph |
| LO-6 | pct-as-facade-substrate needs a spike (iiot/geoint use @effect/rpc directly today) | industrial |
| LO-7 | ams v4 codemod magnitude uncounted (root corruption blocked the scan) | industrial |
| LO-8 | single-instance shared-infra guarantees are type/graph-level, not runtime-observed | all |
| LO-9 | cog tests never executed; rig 132-TaggedStruct conversion unscoped | runtime |

---

*Raw designer sections + full judge reports live in the wave-3 workflow journal (session artifacts). Durable evidence citations resolve to `latent-systems-map.md` §4c and `effect-v4-layer-doctrine.md` — session-scratchpad citations in the raw designs (e.g. `wave2-morph-suites.md`) were re-pointed here per judge errata.*

# TMNL Latent Systems Map

**Date:** 2026-07-02 · **Method:** 8-scout parallel evidence census (import-statement-level greps + barrel/header reads + git forensics) across all ~104 `src/lib` subsystems, `src/components` umbrellas, routes, and all 27 sibling packages.
**Companion doc:** [extract-latent-system.metaprompt.md](../metaprompts/extract-latent-system.metaprompt.md) — this map supersedes that doc's §2 seed dispositions where they conflict (several priors were refuted; see §9).
**Doctrine:** dispositions are UPGRADE (extract v4-native) / MERGE / ASSIMILATE-P1→DEPRECATE-P2 / DEPRECATE / DEFER. Testbed substantiation = validity signal — the app is structurally a testbed gallery (~70 of ~80 routes are `/testbed/*`; only `/tmnl` and the AVA data mini-app are conventional product surfaces), so *liveness = testbed + router wiring*, not production routes.

---

## 0. Ground truths that reframe everything

1. **App.tsx's CARDS array (~70 feature cards with status/label)** is the human-curated system status board — cross-reference it for any disposition.
2. **Import counts lie for service-shaped systems.** `iiot` (509 files) shows 1 importer because it's consumed over HTTP/RPC, not TS imports. `getbyshell` (39 files) shows 0 because it's a Nix-packaged Wayland deployable. `prospects`/`telegram` run via package.json scripts. Zero-importer ≠ dead when the system is a *service*.
3. **The "packages/ supersedes src/lib" story is currently REVERSED.** `src/lib/stx` has 53 importers vs `@tmnl/stx`'s 3 (all testbeds); `src/lib/data-grid` has 18 real production importers vs `@tmnl/datagrid`'s 2 (testbeds). The sibling packages are the *destination*, not yet the incumbent. `@tmnl/msh` has 0 tmnl importers while its deprecated predecessor `holonet` still has 26. `@tmnl/lnk` is a declared workspace dep with **zero** usage.
4. **~50% of the AI/agents slice is dead or testbed-only** — the dead-code ratio is far higher than directory names suggest.

### Immediately actionable breakage found (not architecture — bugs)
- **13 files have on-disk syntax corruption** (wave-2v compiler-verified, TS 5.9.3, 98 parser errors): `app/tmnl-data/assets/no-ava.tsx`, `components/cop/CopTestbed.tsx`, `components/playground/streams/panels/TelemetryStatsPanel.tsx`, `lib/ams/{constrainedAssets,index}.ts`, **`lib/charting/v2/themes.ts` (file truncated mid-expression at line 89)**, `lib/code-editor/overlay/CodeEditorOverlay.tsx`, `lib/data-grid/column-schema/{base,schemas/senml}.ts`, `lib/harness/tools/interactive-shell/key-encoding.ts`, `lib/morphchat/components/status-banner-view.tsx`, `lib/rvn/chat/integrate/{dynamic-semantic-summary-subcompcomponent,morebetter-inlinetask-muse}.tsx`. Several look like truncation events — plausibly from the 2026-05-13 "recover from session logs" commits. **These abort tsc's parser phase, masking all semantic errors repo-wide.**
- **Broken holonet imports COMPILER-CONFIRMED** (TS2307 via isolated compiles): `durable-streams/service.ts:38,49`, `holonet/integration/spike/nats-stream-bridge.ts:28`, both spike tests, `HolonetDurableStreamsTestbed.tsx:46,47`. Invisible in a full `tsc -p tsconfig.lib.json` run only because the syntax corruption above aborts before semantic checking — two independent bugs masking each other.
- **Typecheck tooling traps**: root `tsconfig.json` is references-only — bare `tsc --noEmit` false-greens on zero files. TS version is uniformly 5.9.3 (wrong-compiler hypothesis refuted).
- **stx test failures diagnosed** (wave-2v): 14 of 55 in `hooks.test.ts`, all `useStxData`→`@legendapp/state` resolving the bun-hoisted root `react@19.2.4` while the renderer uses tmnl's `react@19.3.0-canary` — duplicate-React. Fix: vitest `resolve.alias` for react or align versions.
- **`src/lib/metaskill` is a test-only husk**: 16 test files importing `.pi/extensions/metaskill/*` which is *staged as deleted* in git. Finish the removal or revert the deletion.
- **`src/components/shell/index.ts` barrel exports unresolvable paths** (no `AppShell.tsx` exists); zero consumers; shadows the real live `src/lib/shell/AppShell`. Delete.

---

## 1. Feature umbrellas (the latent map)

### U1 — Chat stack → `@tmnl/chat` + `@tmnl/rvn`
| Member | Files | Evidence |
|---|---|---|
| `chat` | 229 | "full parity with RVN chat" by its own header; the real production chat library |
| `morphchat` | 127 | Orchestration/adapter layer WRAPPING chat — **circularly coupled** (morphchat→chat ×33; chat/msg/*→morphchat ×13). Not a third generation. |
| `rvn/chat` | (inside rvn) | Structural fork of chat/ (identical concern taxonomy, zero shared code) |
| `chat-shell` | 2 | **DEAD** — sole importer is `GeniferTestbed.tsx.bak` |
| `rvn` (minus chat/) | ~250 | Brutalist design system, 60+ compound components; its tokens/primitives are the *actual shared foundation* (consumed by ai-core, morph-card skins, testbeds) |

**Speculation:** one `@tmnl/chat` = chat + morphchat (they're mutually dependent, must ship together) absorbing/retiring rvn/chat; separate `@tmnl/rvn` = the design system proper. Delete chat-shell.

### U2 — Generative UI → `@tmnl/genifer`
`genifer` (180 files, 42 tests, 39 external importers — the real "AI-generates-UI" runtime) + `morph-card` (45 files; genifer's UI face, 17 genifer imports, dynamic-island card system) + `cursor` (39 files; AI Dynamic Island overlay, imports genifer/morph-card/charts, 2 real consumers, **zero UI tests** — high-value testbed target). `layout` (30 files, Grid/Stack/Flex + genifer catalog coupling) sits adjacent.
**Speculation:** `@tmnl/genifer` = genifer + morph-card. cursor stays app-side (it's an overlay product surface) or rides along as a client. layout extracts separately or joins the design-system consolidation (U11).

### U3 — AI runtime → consolidate on `ai-core`
Verified: `ai`, `ai-core`, `agents`, `editor-ai`, `mcp` **never import each other** except `ai-core→mcp`. Three parallel "call an LLM" stacks:
- `ai-core` (55) — **the keeper**: real consumers (terminal v2/v3, cop panels), streaming + tool bridge + compaction.
- `mcp` (14) — clean one-directional dependency of ai-core. Rides along.
- `agents/providers`+`auth` (7 of agents' 87) — OAuth-via-Pi→`@effect/ai-anthropic` bridge. **Assimilate into ai-core.**
- `ai` (10) — **DEAD** (0 importers, verified word-boundary). Delete.
- `rag` (10) — DEAD but complete; either wire as an ai-core tool or archive.
- `editor-ai` (38) — designed-but-unadopted (1 testbed consumer); the intended editor↔AI seam nothing uses yet. Decide: wire or archive.

`agents/tasks` (78 files — agent task log ingestion/rendering, live in chat) is a **separate concern** from agents' auth bridge; it belongs with U4 or U1, not the provider stack.

### U4 — Agent orchestration (4 uncoordinated efforts — needs a Prime decision, not a merge)
`conductor` (17, PTY-spawned pi agents + workflows, testbed-only) · `maidens` (47 TS + Elixir/Jido tree, 0 TS importers) · `nex` (10, NATS workload orchestration, DEAD) · `agents/tasks` (78, the only live one) · `harness` (159 — full embedded pi-ai coding-agent runtime: session persistence, tool registry bridging genifer/geoint/panels, rendering pipeline, compaction, interactive shell; 31 importers — **production-live**). `harness/pragma/` is a hidden **Rust/Cargo workspace** (BERT/BLEURT prompt-ambiguity Tauri sidecar) — its own package candidate.
**Speculation:** `@tmnl/harness` extracts (minus pragma → `packages/pragma`). conductor+nex could form a "spawn agents as NATS workloads" story if wanted; otherwise deprecate nex, keep conductor testbed-side. maidens is an Elixir sub-project mislocated in src/lib.

### U5 — Command palette / Emacs layer (operator: ASSIMILATE P1 → DEPRECATE P2)
Refined topology: `commands↔hotkeys` is a true bidirectional pair; `nu-cmdk→commands` is a one-way spoke (nu-cmdk has its own runtime/shell/6 tests, more separable than assumed); all three share `minibuffer/v2`. `minibuffer/v1` (12 files) = confirmed dead, delete. `indices` (5 files, Consult-style multi-source composition) belongs to THIS cluster, not the filesystem one. ~70 of `commands/docs/`'s 75 files are misfiled nu-cmdk design history — `git mv` to nu-cmdk/docs.

### U6 — App chrome: overlays is the hub (the "@tmnl/panels" merge prior is REFUTED)
Real shape per import evidence: **`overlays` (67) is a hub-and-spoke hub** importing floating, sidebar, screensaver, tauri-windows, minibuffer, terminal, nu-cmdk, hotkeys — nexus file: `overlays/visual/PersistentOverlays.tsx`. `drawer` (12) is module-level `@deprecated`, actively migrating INTO overlays/visual. `sidebar` (14) and `screensaver` (8) are effectively overlays content plugins. `floating` (154, stx-powered, 20 importers, 7 testbeds) is its own umbrella — the claimed floating→overlays and drawer→animation edges were naming-collision false positives. `animation` (17, v2, zero outbound coupling, 15 consumers) is a clean standalone `@tmnl/animation`. `motion` (4) confirmed DEAD (logic forked into `drag`, not imported). `tauri-windows` = app-shell glue (stays). `windows` (Emacs panes, mounted in main.tsx) = thin but load-bearing glue. `panels` (7) is an **unrelated harness-facing API** — do NOT use the name `@tmnl/panels` for any chrome merge. `foldable-panel` (5) = standalone embeddable primitive (cop/charts/editor consumers), not chrome.
**Speculation:** `@tmnl/floating` standalone; `@tmnl/chrome` (overlays + drawer-sunset + sidebar/screensaver plugins) if extracted at all — it's app furniture; `@tmnl/animation` standalone.

### U7 — Terminal → `@tmnl/terminal`
`terminal` (79) is a coherent umbrella: root ghostty-web wrapper + `backend/` (Bun.Terminal PTY, the LIVE PTY implementation) + v2 (conductor's AgentTerminal) + v3 (commands' block terminal). v2/v3 is a live fork, not a deprecation chain. `pty` (5) = **DEAD, confirmed** — duplicate concept superseded by terminal/backend; delete.

### U8 — Authoring surfaces → `@tmnl/editor` (+ satellites)
Confirmed LAYERS, not rivals: `editor/v3` (187 files, Tiptap + Effect + y-Sweet collaboration, 19 test dirs, 25 importers — production) ← wrapped by `buffer` (10, Emacs-buffer layer, mounted in main.tsx, `useBuffer` has zero callers — half-finished). `code-editor` (14, Monaco+Tauri, 6 importers, 0 tests) is a sibling solving code files. **Legacy top-level `editor/` (18 files, AFFiNE-style) = dead first attempt, 1 testbed importer — archive.**
**Speculation:** `@tmnl/editor` = editor/v3 wholesale (it's already package-shaped); buffer + code-editor ride along or stay app-side.

### U9 — Filesystem vertical → `@tmnl/files`
Exactly 2 layers: `file-browser` (53 files, 3-service Effect architecture, 8 importers, **0 tests**) ← `file-index` (6, depends on file-browser, consumed by collaboration testbed). `indices` does NOT belong here (see U5).

### U10 — Streaming transport: five implementations, one convergence path
Coexisting NATS/durable-streams clients: (a) `nats` (3, KV-only, clean), (b) `holonet` (54, module-level `@deprecated` shim, **26 real consumers**: iiot/realtime, agents/tasks, tsingou-flow), (c) `connection-ports/services/{NatsPort,DurableStreamsPort}` (independent third implementation), (d) `durable-streams` (15, imports now-deleted holonet v1 paths — **broken**), (e) deleted `holonet/durable-streams/v1`.
Destination packages already exist: `@tmnl/msh` (v4 NATS, wired only to holonet's barrel) and `@tmnl/lnk` (v4 durable streams, 0 importers).
**Speculation:** this is the single most overdue convergence — finish the stalled holonet→msh migration (re-point iiot/realtime, agents/tasks, tsingou-flow), fix/redirect the 6 broken v1 imports toward lnk, then fold `nats` + `connection-ports` transport halves in.

### U11 — Ports & links → possible `@tmnl/ports`
`dataplane` (56, d2ts differential-dataflow port/link/plane graph) + `connection-ports` (22, NATS/durable-stream bindings) serve the **same consumer set** (editor/v3 blocks: MapBlock, Scene3DBlock, EmbeddedBlockWrapper). connection-ports' `buildLayersFromSpec` also duplicates geoint/layers' deck.gl spec-to-layer concern. Merge candidate once U10 settles transport.

### U12 — State & data primitives
- `stx` (in-tree, 53 importers) → **the** adoption-debt item: migrate consumers to `@tmnl/stx`, per the extraction program. `fermion` (14) → ASSIMILATE into @tmnl/stx (operator decision 2026-07-02).
- `data-grid` (in-tree, 18 production importers incl. editor v3 + tldraw shapes) → migrate to `@tmnl/datagrid`; also wire `@tmnl/mathkernel` (built for its Stack VM, currently disconnected).
- `streams` (49, 21 importers, playground + property tests) → clean `@tmnl/streams` extraction (confirmed).
- `tsingou-flow` (40, serious d2ts signal pipeline: MIDI/OSC/NATS/Serial/RSS sources, **ZERO consumers**) → big orphaned platform; needs a human pre-integration-vs-abandoned call.
- `ecs` (15) — NOT generic: geoint's private entity-fusion/provenance core (9/12 importers in geoint). Travels with geoint. `kori` (23, Koota ECS wrapper, used by geoint positioning + Scene3DBlock) — scene/3D infra, not AI.
- `capabilities` (8) + `src/components/affordances` = two halves of one system split across lib/ and components/.
- `variables`, `data-manager`: v1/v2 policy drift — **v1 has more production consumers than "stable" v2** in data-manager. Audit before any v1 deletion. `search` (16) = confirmed leaf, cleanest fresh extraction.

### U13 — Industrial domains (DEFER — decompose internally first)
- `iiot` (509, 172 tests) — near-standalone backend service (own HTTP/RPC servers, DDL, L1/L2/L3). Extraction shape = deployable service (`@tmnl/iiot-service`), not a library.
- `geoint` (296, 63 tests, 15 testbeds, 21 importers) — the richest true product domain; internal seams: persistence/cluster/server/ingestion = server-side extraction candidate; registry/ overlaps connection-ports' layer-building.
- `sios` (118) — self-contained construction/EVM domain explicitly modeled on iiot; orphaned mid-build (1 routed testbed).
- `ams/v2` (61, 15 tests) — complete BFO-grounded event-sourced asset domain, ZERO importers; wms/tms are stubs. + `sream` (spec-only deontic DSL) + `getbygui` (vision doc): three completion stages of the same event-sourcing methodology. Natural play: sream's deontic layer on ams/v2's CQRS base — or archive all three consciously.
- `maidens/domains/contracts` duplicates ISA-18.2 alarm/equipment-state modeling vs `iiot/schemas` — reconcile.
- `dataplane`→U11, `holonet`→U10, `transfer` (32, v1/v2 drag-token transfer, 11 importers) = self-contained library mid-migration.

### U14 — Design systems: consolidation, not merge
`tmnl-ui` (CEW kit), `fui` (vantablack modals), `primitives` (TokenRegistry + atom observability + Map primitive — three unrelated concerns in one dir) have **zero cross-imports** — the "one latent design-system package" hypothesis is REFUTED. Plus `portal/` (VANTA landing tokens), `rvn` tokens (the actually-shared foundation), `layout` (real primitives). A design-system package is a curation project; the mechanical merge doesn't exist.

### U15 — Standalone deployables mislocated in `src/lib` (relocate wholesale)
| System | Evidence | Destination |
|---|---|---|
| `prospects` (78 + py/sql) | zero @/lib coupling, own docker-compose/migrations/sqlite, run via scripts | `packages/prospects` |
| `getbyshell` (39) | Nix-packaged Wayland bar, built outside Vite; extensive nix/+smoke-script wiring | `packages/getbyshell` |
| `telegram` (12) | Effect.Service bot, `telegram:agent` script, zero lib coupling | `packages/telegram` or services bundle |
| `harness/pragma` | embedded Rust/Cargo workspace (4 crates) | `packages/pragma` |
| `src/infra/graph` | self-contained k8s operator (own package.json, pepr) | out of src/ entirely |
| `iiot` | own HTTP/RPC service | deferred, U13 |

### U16 — Ontology/domain-modeling (three overlapping efforts)
`bfo` (2, BFO literals — live, consumed by ams/v2), `axiom` (20, Palantir-OSDK-style DSL, testbed-only, silent v1 left in place), `maidens/domains/contracts` (14 domains, 0 importers). If ams/sream ever activate, bfo+axiom are the vocabulary layer they should share.

### U17 — Charts & charting (confirmed complementary — two packages)
`charts` (74, Ant Design catalog + AI discriminator + interactive-panel + locks; `discriminator/ai-tool.ts:42-44` is the CLAUDE.md-canonical AI-SDK+Effect-Schema gold pattern) and `charting/v2` (ECharts/SciChart streaming, 12 consumers + 13-file testbed suite). `charting/v1` is dead except **one caller**: `components/tldraw/shapes/echarts-widget-shape.tsx` — redirect, then delete v1.

---

## 2. Dead list (evidence-confirmed; delete or consciously archive)
`pty` · `motion` · `chat-shell` · `eisenhower` (unused alias→hypothesis-lab/v1) · `canvas` (docstring references a service that doesn't exist anywhere) · `session` (full Effect-SQL persistence, 0 wires) · `context` (ZON recontextualization, 0 wires) · `ai` · `nex` · `metaskill` (orphaned tests) · `minibuffer/v1` · legacy `editor/` top-level · `charting/v1` (after 1 redirect) · ams root trio (broken) · `components/shell` (broken barrel) · `GeniferTestbed.tsx.bak`.
**Spec-only, keep as docs not code:** `sream`, `getbygui`, `src/proto/PROTOPLS.md`. **Uncommitted scaffold:** `sdr` (untracked, 1 schema file).
**NOT dead despite 0 importers:** getbyshell, prospects, telegram, iiot (service-shaped — see §0.2). **NOT dead despite priors:** slider/v1 (it's the current *default*; v2 is the WIP).

## 3. Naming collisions (grep hazards, verified)
`floating/overlay/` ≠ `overlays/` · `tmnl-ui/primitives/` ≠ `lib/primitives/` · terminal v2's `PaneNode` ≠ windows' `PaneNode` · `panels` (harness API) ≠ any chrome merge · `indices` ≠ `file-index` · `shell` (in-app) ≠ `getbyshell` (Wayland) · `cursor` (AI overlay) ≠ text caret · lib/metaskill ≠ codemode's metaskill-services · in-tree `stx`/`data-grid` ≠ `@tmnl/stx`/`@tmnl/datagrid`.

## 4. Refuted / revised seed-map priors (feed back into metaprompt §2)
1. **@tmnl/panels 4-way merge cycle** — REFUTED (no floating→overlays or drawer→animation edges; overlays is the hub; drawer is deprecating into it; animation standalone; name taken).
2. **slider v1 dead** — REFUTED (v1 is the live default; v2+traits is WIP).
3. **"packages supersede src/lib"** — direction currently reversed (§0.3).
4. **commands+hotkeys+nu-cmdk 3-way mutual cluster** — refined: pair + spoke (§U5).
5. **search leaf** — CONFIRMED (~17 importers). **charts/charting complementary** — CONFIRMED. **pty dead** — CONFIRMED with named replacement (terminal/backend). **motion dead** — CONFIRMED (forked into drag).

## 4b. Wave-1 census efficacy audit + trend analysis (2026-07-03)

**Audit verdict:** wave 1 was strong on import topology (word-boundary greps, false-positive catches, prior refutation) and breakage discovery, but systematically shallow on four axes the extraction metaprompt itself demands:
1. **No v4 codemod-surface measurement** (metaprompt §4's cost model) — now filled, table below.
2. **No test execution** — test files were counted, never run. "Tests exist" ≠ "tests pass".
3. **Big domains got directory listings, not seam analysis** (iiot, geoint, rvn, harness, sios).
4. **~8 explicitly-flagged INFERRED threads left open** (@deprecated markers unread, ams-AVA vs lib/ava, transfer v1/v2 split, etc.).
Wave 2 (5 deep-dive agents) dispatched at exactly these gaps; results to be folded in below.

**Effect v4 codemod surface** (occurrences of `Schema.TaggedStruct` + `Context.Tag` + `FiberRef` + `@effect/platform|rpc|cluster` + `@effect-atom` — the §4 codemod table's break points), top of the league:

| Subsystem | Total | Notable |
|---|---|---|
| geoint | 234 | TaggedStruct 37, ContextTag 55, **FiberRef 18 (only user in repo)**, platform/rpc/cluster 51, atom 73 |
| iiot | 192 | ContextTag 69, platform/rpc/cluster 111 |
| harness | 178 | **TaggedStruct 126 — biggest single concentration of the #1 v4 break** |
| editor | 117 | atom 63, TaggedStruct 27 |
| genifer | 104 | atom 56, platform/rpc 24 |
| overlays / terminal / morphchat / sios / tsingou-flow | 64/57/56/55/50 | — |
| streams / stx / fermion / search | 36 / 15 / <12 / <12 | **search's near-zero surface confirms it as the cheapest extraction** |

**90-day churn** (file-touches): iiot 348 · holonet 113 · harness 47 · morphchat 28 · metaskill 15 · bar 15 · floating 11 · muse 7 · everything else ≤6.
**Trend findings:**
- **All the development heat is in the DEFER bucket** (iiot/harness) and in the "deprecated shim" (holonet — 113 touches means the msh story needs re-verification, not assumption). The extraction program targets cold code while hot code churns — sequence extractions to avoid colliding with active work, or extract *because* the hot code needs the boundary.
- **muse is the depth/activity mismatch champion**: 3-line census entry, yet subject of the 5 most recent commits (transport integrity reports, contact-fit proxy gate). Under wave-2 investigation.
- **Recurring pattern: build-ahead-of-integration** (ams, session, context, rag, nex, tsingou-flow, editor-ai — complete systems, zero wires). Dispositions need an explicit WIRE lane alongside UPGRADE/DEPRECATE.
- **Recurring pattern: migrations start, rarely finish** (holonet→msh, stx, data-grid, drawer→overlays, slider v1→v2, transfer v1→v2, editor legacy→v3; only minibuffer v1→v2 completed cleanly). Finish-the-migration passes are systematically higher-value than fresh extractions.

## 4c. Wave-2 deep-dive synthesis (2026-07-03) — verified via adversarial workflow

Five deep-dive agents + a 10-claim adversarial-verification workflow (each claim independently re-derived by a refuter). Verdicts: 6 CONFIRMED, 1 REFUTED, 3 REVISED.

### Corrections to this map (wave-2v verdicts)
1. **REFUTED — "connection-ports/layers is orphaned"**: it IS live. `connection-ports/atoms/index.ts:266-321` calls `buildLayersFromSpecSync` inside `createViewLayersAtoms()`, and the barrel is consumed by editor MapBlock/Scene3DBlock. U11 stands as a real merge candidate, not dead code.
2. **REVISED — charting/v1**: 5 of 7 imported symbols (Chart, useChart, generateSignal, RingBuffer, RealtimeSignalGenerator) have no v2 equivalent; CHART_TOKENS + ChartSeries already exist in v2. Still not a simple redirect — v1 stays until the tldraw shape is rewritten or those 5 APIs are ported.
3. **REVISED — geoint "74% orphaned"**: the doc is stale; commit `21615b57` (2026-02-25) wired Minimap + KeyboardShortcutsOverlay into GeointDashboardPanel → ≥15/51 active. ImmersiveHUD and NetworkGraph remain genuinely orphaned. Re-census before the prune pass.
4. **FiberRef correction to §4b**: geoint's "FiberRef=18" is variable naming (`Ref` holding `Fiber`), zero actual FiberRef module use — geoint's v4 surface drops to ~216 and the repo has NO FiberRef→Context.Reference codemod work at all.
5. **CONFIRMED**: msh-v4-blocker, transfer-v1-live (exactly 5 files), ecs-geoint-private, chat-vs-rvn/chat divergence, lnk-truly-dormant (the `latest/` shim from `7520d418` was deleted 15 days later by the msh extraction and was never imported).

### Structural findings
- **iiot** (deep-dive): L1/L2/L3 layering verified clean; 5 decomposition seams with zero cross-imports except reactor→realtime (one edge); churn is 101/250 paths in `services/reactor/` — **converging on Reactor v2, not expanding**. The holonet→msh re-point is **blocked by the Effect v3/v4 split** (msh is v4-native via its own `effect-v4` alias; symbol-for-symbol equivalents exist, `HolonetConfigTag`→`MshConfigTag` rename + new auth field). Treatment: decompose-first; extraction after Reactor converges and v4 migration is scoped. @deprecated: 2 dead (events/groups.ts BaseStructuralEventPayload, eventlog-layer.ts IIoTEventJournalLayer — delete), 2 load-bearing (asset-polymorphic aliases used by http/query-*; models/_common UpdatedAt).
- **geoint** (deep-dive): 5 sub-verticals — search / map-render / ui-shell / entity-fusion / **server-pipeline (extract FIRST: clean one-directional DAG, 20 test files, 100% sql-pg/cluster-locked)**. Three "kori" things disambiguated: `@/lib/kori` engine **stays shared** (editor Scene3DBlock is a real consumer); `geoint/kori/` is a private adapter (rename to kill the collision); `lib/ecs` **folds into geoint**. Internal duplication: SceneGraphBridge hand-builds deck.gl layers, duplicating geoint/layers factories. @deprecated ×17 = legit in-progress global-atoms→panel-scoped-family migration, don't touch blind.
- **muse is a Muse 2/S EEG headset pipeline** (BLE → Python capture/analyzers → Effect-Schema metric packs → floating log panel): 3 TS files + 8 Python scripts + 13 docs, the most actively-committed leaf in the repo. Status: active R&D, pre-extraction (TS side too small; growth is on the Python analyzer surface).
- **holonet→msh migration is ACTIVE at the msh address** (42 commits/90d of hardening) — holonet itself is a frozen compat shim last touched 2026-05-15. Never measure this migration by the old address.
- **Test reality** (executed, not counted): GREEN — search 122/122, minibuffer/v2 113/113, charting/v2, fermion, nu-cmdk. RED — stx (duplicate-React, see §0), dataplane (React Flow mock drift ×15 + 2 logic edge cases). FLAKY — streams (2 playground-only timeouts, core clean). **animation has ZERO executable tests** (wave-1 counted a manual testbed file).

### Morphchat + morph-card latent package suites (operator priority 2026-07-03)
Operator: first-class candidates; each composes a package suite in its latency. Full manifests in the wave-2 report; essentials:
- **Keystone substrate `@tmnl/morph-transition-grammar`** — morphchat/machines *actually imports* morph-card's transition-grammar (wave-1's "no direct imports" refuted), and morphchat's atom registry is a byte-level copy of morph-card's. Extract the substrate (grammar + `createScopedAtomRegistry` factory) FIRST; both suites re-point.
- **morph-card suite** (dormant: 0 commits/60d, zero tests, zero collision risk — START HERE): schemas / card-state (pure Effect Service) / machine / atoms all GREEN; core AMBER (`MorphCard.tsx` hard-imports genifer at module scope — needs core/generative split); **agents RED — live external backend consumer `src/lib/cursor/` (api/server.ts + cluster/CardEntityHandlers.ts)**.
- **morphchat suite**: schemas / presets / adapter-mock GREEN; core RED (14-file ~30-symbol hard peer dep on chat/ — its rendering identity); the chat→morphchat back-edge is NOT schema-only (3 chat components import `useStreamingMetrics`, a morphchat component hook — move the provider to the shared leaf to break the cycle); `morphchat-adapter-harness` (~3,880 lines, cleanly isolatable) is exactly where ALL recent commits land — extract LAST, coordinated with pi-session work.
- **genifer is the gravitational hub of both** — it hard-codes `'morphchat'` in its own schema enum (`compiler/prompt-eval.ts`) and round-trips test imports into both suites. Sequence morph extractions around genifer, and treat `@tmnl/genifer` (U2) as the follow-on anchor package.

## 4d. Wave-4 census — testbeds, components, and gap directories (2026-07-03, 3-scout sweep)

**Trigger:** operator suspicion that (a) testbeds carry latent functionality never attributed to umbrellas and (b) src/lib had uncensused directories. **Both confirmed.** 17 gap dirs censused (completeness verified: `comm -23` against `ls src/lib` leaves only `sdr`, already in §2); 90 testbed files swept; all ~24 src/components dirs inventoried. All VERIFIED claims below are Read-confirmed with file:line, not grep-trusted.

### New breakage (amends §0)
- **AVA data mini-app broken at 3 independent points** (one of the app's only 2 conventional product surfaces, per §0): `app/tmnl-data/pages/app.tsx:6` imports from `../../lib/ava-client-v2/` which **does not exist** (real path: `lib/ava/`); the real `ava/ssr-detection.ts:5` imports `AvaClientV2` from `../session-client` which only exports `AvaSessionClient`; and `ssr-detection.ts:30,33,42` does `new AvaClientV2(...)` on what is actually `Context.GenericTag` (`ava/services/AvaClientV2.ts:283`) — not constructable. Stale v1-era bootstrap never reconciled with the Effect-Service rewrite. Compounds the known `no-ava.tsx` corruption.
- **`components/tldraw/holonet-canvas.tsx` imports `holonetShapeUtils` that is defined nowhere** (only `tmnlShapeUtils` is exported from `shapes/index.tsx`) — compiler-confirmed broken import in a dead chain (`holonet-layout.tsx` has zero importers). NOTE: this "holonet" is a coincidental theme name, unrelated to the U10 NATS shim → new §3 collision.
- **CopTestbed.tsx corruption may be stale**: the current on-disk file (84L) parses fine — re-verify §0's 13-file corruption list before the repair pass; some entries may already be fixed.
- **Route wiring has FOUR disagreeing sources of truth**: App.tsx CARDS, router.tsx (82 routes), `routes/WindowRoute.tsx` TESTBED_COMPONENTS (Tauri child-window `?testbed=<id>` map), and `lib/testbed/registry.ts` TESTBED_REGISTRY (CommandBar search manifest). **5 CARDS links are dead** (no router.tsx entry): SCADA CANVAS `/scada`, SCADA/HMI `/testbed/scada`, RVN DESIGN SYSTEM `/testbed/rvn` (works only via `?testbed=rvn`), BLOCK EDITOR `/testbed/editor`, EDITOR V3 `/testbed/editor-v3`. Pick ONE source of truth before any testbed cleanup.

### New latent systems (the census misses)
1. **U18 — Splash auth domain** (`components/splash/`, 13 files): full multi-modal `AuthenticationService` (Effect.Service; Password/Biometric/Facial/Gesture authenticators) + `IdleDetectionService` + Effect-Schema credential/session types + lock screen, **eagerly mounted at router root** (`LockScreenController` wraps every route). Zero prior mention. Needs a WIRE-status + disposition decision.
2. **U19 — Testbed isolation platform** (`src/lib/testbed/`, **8,302L / 18 files**): an AI-assisted live component-editing platform — `WorktreeManager` (real `child_process` git worktrees, services/WorktreeManager.ts:1-323), `DevServerManager` (spawns per-worktree Vite dev servers for iframe preview, :1-372), `EditSessionService` ("Cursor-style editing" per its own doc), `IsolationChat.tsx` (1,526L Tiptap + ai-core chat), design-mode registry (registry.ts, 1,019L — ALSO the routing manifest above). Client chain complete (RvnTestbed→ComponentBox→IsolationModal→IsolationChat) but **zero external invocation of the services — the server half is unbuilt**; `cursor/tools/design-tools.ts:5` documents integration but never imports it (aspirational). Doubly hidden: reachable only via Tauri child-window → RvnTestbed → design mode. Attributable to NO existing umbrella; adjacent to U2 (cursor).
3. **Conductor's shadow chat surface** (`components/testbed/conductor/`, **5,344L + 7 test files** incl. contract/regression tests): ConductorAgentChat + agent-chat-stx machine (1,117L) + service layer + view-model, built ON rvn/chat + agents/tasks. This is conductor's *real* chat implementation mislocated under testbed/ and actively tested — the U4 orchestration decision must include it (lib/conductor's 17 files are not the whole story).
4. **hypothesis-lab** (24 files) — self-contained Effect-first dueling-hypothesis/audit/replay governance framework hiding behind the dead 2-file `eisenhower` alias §2 listed. Build-ahead-of-integration class (ams/session/context/rag/nex). Separate disposition line needed.
5. **Component-side halves never cross-referenced**: `ai-elements/` (19 files, Vercel AI-SDK Elements kit — UI half of U2 cursor + U3 editor-ai) · `static-ui/` (17 files — component half of the U6 overlays hub, consumed by PersistentOverlays.tsx) · `portal/` VantaCard = **78 importers, the most-imported component dir in the tree — the actual design-system foundation** (feeds U14; its docstrings cite `@/lib/design-system/vanta` which doesn't exist on disk) · `controllers/` Knob/Fader/Slider (third slider-family, feeds tldraw controller-widget) · `docs-3d/` (XState+atom 3D rolodex, live at /docs).
6. **Dead third canvas stack**: ReactFlow rig — `infinite-canvas.tsx` (0 importers) + `widget-toolbar` + `fullscreen-widget-wrapper` + `components/nodes/` (4) + `components/widgets/` (6) → §2 dead list. Also dead: `components/smoothui` (0 importers). **Split-brain**: `tactical/tmnl-ui.tsx` (facade over primitives/static-ui/controllers) vs `tactical/tactical-ui.tsx` (hand-rolled "CEW" design system, duplicate primitive names, zero shared code).

### Gap-directory dispositions (17 dirs, closes §4b's coverage debt)
| Dir | Files | Verdict |
|---|---|---|
| polyfills | 8 | **KEEP — load-bearing via vite.config.ts:97-107,152-169 resolve.alias** (Node-builtin shims for Tauri build); the §0.2 "import counts lie" doctrine, never applied here |
| scale | 3 | **KEEP — `ScaleProvider` wraps the whole app at main.tsx:150** (CSS custom-property zoom + cross-window sync) |
| testbed | 18 | UPGRADE → U19 above (registry.ts additionally backs the /testbed routing headline stat) |
| scroll | 4 | Clean extraction-ready leaf (5 real consumers: agents/tasks ×4, chat thread-band). Bonus: `agents/tasks/views/scroll-anchors.ts:2` @deprecated re-points here — a SECOND cleanly-completed migration (amends §4b's "only minibuffer") |
| traits | 6 | **Shared foundation of BOTH slider/v2's trait-composition WIP AND transfer v1/v2's drag tokens** (11 importers) — never named as either's satellite. **Operator 2026-07-03: latest version belongs in a "core" module** — consolidate there, don't dispose with slider/transfer |
| egui | 12 | UPGRADE candidate — wired at app boot (main.tsx:30 panel registration), WASM canvas in DynamicIslandCard, routed testbed |
| ava | 39 | Has 1 production consumer (editor MapBlock AvaMapContent) + broken bootstrap (see breakage above) — repair, then dispose with U11 |
| blocks | 9 | ASSIMILATE — thin bridge consumed by holonet registry-init + telegram; rides U10/U15 |
| debug | 2 | ASSIMILATE into U6/screensaver (its only consumers) |
| table-service | 7 | MERGE into U12 data-grid (consumers: drawer testbed, data-grid components, tldraw shapes) |
| selection | 8 | Testbed-solid (5 consumers, all testbed-side); its claimed drag integration **does not exist in code** |
| drag | 5 | Build-ahead — own header claims selection+floating consumers; grep confirms ZERO real use |
| adr-review | 30 | DEFER — complete Pipeline-ADR governance tool, testbed-only |
| theia | 3 | DEFER — Tauri-managed Eclipse Theia embed, testbed-only, U8-adjacent |
| hypothesis-lab | 24 | See #4 above. **Operator 2026-07-03: "cool, but an experiment" — ARCHIVE** (no wire) |
| bar | 14 | **DEAD — pre-fork ancestor of getbyshell** (structure near-identical; src-shell imports only getbyshell; sole "importer" is a stale JSDoc string) → §2 + new §3 collision `lib/bar` ≠ `lib/getbyshell` |
| instrumentation | 4 | **DEAD** — 0 real importers (all hits are the English word); added in `f6e161b9` beside iiot SQL work, never wired |

### Testbed embedded-implementation ledger (what's trapped where)
- **SUBSTANTIAL mini-apps in testbed subdirs**: conductor/ 5,344L (see #3) · collaboration/ 5,157L (AutonomousEditorPanel 1,614L + DocumentDrawer + panel-stx — editor/v3+variables/v2+y-sweet composition) · kori/ 4,937L (kori-testbed-stx.ts 1,420L real XState machine; AG-Grid InspectorPanel) · ava/ 2,259L (a mini observability IDE: ReplConsole/StateInspector/SequenceDiagram/ScenarioRunner).
- **MorphCardTestbed.tsx (3,946L — largest single testbed)**: composes morph-card+charts+data-grid+geoint+layout+tmnl-ui; the cross-umbrella integration knowledge lives ONLY here. **GATE: deep-read before the mrp/crd extraction pass.**
- **EffectAtomTestbed.tsx (3,858L, zero @/lib imports)**: H1-H10 spike suite for @effect-atom+XState incl. documented antipattern discovery ("Atom.family + useAtom infinite loop", lines 27-40) and render-leak DamageReport. It is the de-facto regression suite for the repo's core state primitive — do NOT delete casually; re-run during the stx migration.
- **FermionTestbed.tsx (2,008L)**: largest fermion consumer surface — the fermion→stx assimilation pass must audit it.
- **cop/ (1,512L)**: CopChatPanel + WorkOrderPanel genuinely wire to iiot WorkOrderRepo — real work-order UI, completely unrouted.
- **ScadaOverlayTestbed.tsx (1,106L, true orphan)**: SC-H1..H6 validation of TagBinding/Alarm/DataGrid/Chart/Navigation/Faceplate over lib/overlays — possibly the only test of the SCADA overlay-port pattern; check against sios/iiot before treating as dead.
- **Mock-not-wired trap**: `IngestionOrchestratorTestbed.tsx` and `MaterializerFlowTestbed.tsx` describe real geoint services in their headers but import NEITHER (bodies are local mock fns) — **geoint's two most-documented pipelines have no end-to-end testbed**; only `IngestionTestbed.tsx` is genuinely wired (real `IngestionClient.mutation()`, lines 43-88).
- **Orphan testbeds (zero reachability)**: AnimeLayoutTestbed · ChatComposerTestbed · DurableStreamTestbed(singular) · ErrorDetailTestbed · GeointTestbed (805L Mapbox+deck.gl+OpenSky, superseded by GeointDashboardTestbed) · LogPanel · StxStreamingTestbed · EditorTestbed · EditorV3Testbed · ScadaOverlayTestbed · cop/ trio · lib/testbed (doubly hidden, see U19).

### Sequencing impact (amends §5)
- Step 0 gains: AVA 3-point bootstrap repair; re-verify the 13-file corruption list (CopTestbed may be fixed); holonet-canvas dead chain → dead list.
- New cheap step: **unify the 4 routing sources of truth + fix the 5 dead CARDS links** (finished features currently unreachable from home).
- Morph pass (mrp/crd): **MorphCardTestbed deep-read is now a P0 gate.** fermion→stx pass: FermionTestbed audit. stx migration: keep EffectAtomTestbed green.
- U4 conductor decision must adjudicate the testbed/conductor shadow implementation (it, not lib/conductor, is the tested chat surface).
- New Prime decisions queued: U18 splash disposition · U19 testbed-platform (wire the server half / extract / archive) · tactical split-brain resolution · portal-as-design-system canonicalization (U14 input). RESOLVED 2026-07-03: hypothesis-lab → ARCHIVE (experiment); **traits and the overlay system are operator-designated "core module" material**; wave-5 deep-dives dispatched on the editor vertical (incl. AutonomousEditorPanel + block system), lib/floating, and the overlays/panel chrome.
- Ratified TLA register (2026-07-03) is **unaffected** — no wave-4 finding changes the 21 names; U18/U19 are future register candidates.

## 4e. Wave-5 deep-dives — editor vertical, floating, overlay chrome (2026-07-03, operator-directed)

Operator designated traits + the overlay system "core module" material and demanded coverage of the editor vertical (incl. AutonomousEditorPanel + block system), lib/floating, and the panel/overlay chrome. Three deep-dive scouts; all claims file:line-verified unless marked.

### HEADLINE CORRECTION — U6's "nexus" is dead code
**`overlays/visual/PersistentOverlays.tsx` has ZERO runtime consumers** (only its own barrel + 2 JSDoc mentions). It is the pre-AppShell header prototype, forked into `lib/shell/HeaderContent.tsx` (near-duplicate, live) and never deleted. **The real hub = `main.tsx:146-189` (composition root) + `HeaderContent.tsx`.** Consequences:
- **screensaver is DEAD in production** (only mount path was the orphaned file) → §2 candidate.
- **terminal's floating-panel registration is DEAD** (sole `registerPanelType('terminal')` call site is PersistentOverlays.tsx:304) — the map's overlays→floating spoke exists only in dead code.
- Missed spokes: `commands` (live via HeaderContent's useCommandWire) and `cursor` (mounted directly at main.tsx:177 — a root sibling, not a spoke).
- PersistentOverlays.tsx: **delete, don't extract**.

### lib/overlays is TWO systems sharing a directory
- **System A — Visual Overlay System** (schemas/visual.ts, atoms/*, visual/*): LIVE, Kind B (effect-atom Registry singleton), the production overlay state layer. BUT it is a **closed switchboard, not a plugin architecture**: `VisualOverlayType` is a 6-member Schema.Literal + hard-coded switch in GlobalSlot.tsx:56-99. **Bug: `top-bar` has schema+hook+renderer but GlobalSlot never handles the case — built, silently never renders.** One genuine open outlet exists: `registerDrawerSlot` content injection (drawer-scoped only).
- **System B — behavioral/EventLog overlay-port design** (Overlay.ts, services/*, events/*): half dead (`Overlay.ts` 0 importers; `OverlayRegistry` self-declared deprecated at services/index.ts:29-34), half **live and real** — `PortHub`+`EventDispatcher` are genuine Effect Services (Layer.mergeAll at atoms/index.ts:132-135) running Effect Streams through a shared runtime.
- **overlays/scada verdict**: a thin ISA-typed layer (TagId/TagQuality/AlarmPriority brands, `{domain}:{entity}:{property}` ports) built genuinely ON System B's generic primitives — the primary proof System B works. Not domain code bolted onto chrome. Its 8 domain files could ride with iot/sio (zero back-deps) or stay as the reference port-pattern consumer.
- **Extraction**: System A extracts clean (only real dep = effect-atom; cheap v4 surface) = the operator's "overlay core module." System B needs finish-or-archive. Header/AppShell wiring stays app furniture.

### lib/floating (154 files) — first full open
- Architecture: dnd-kit provider + **stx backbone (14 files, on IN-TREE `@/lib/stx` — 31 files deep; zero @tmnl/stx)** + XState panel-machine + **TWO competing tiled-layout engines running simultaneously** (split-tree vs Niri-style scroll-strip, runtime-toggled at PanelWorkspace.tsx:57) + dock-zone math + Effect-Schema types + visitors.
- **THREE non-interoperating panel-registration idioms, all live in production**: (A) typeId side-effect registry — egui/panels:17, code-editor/panels:118, geoint EntityPanel.tsx:575, booted from main.tsx:30,32; (B) visitorId Map that **genifer writes into directly** (panel-visitor.tsx:229 — the production path for AI-spawned surfaces), bypassing floating's own wrapper; (C) Effect Schema/Layer catalog (`definePanelVisitor`) carrying morphchat+muse-log via PanelWorkspace.tsx:47. **geoint integrates via A AND C independently** (two non-communicating integrations of one domain). Canonical-idiom decision is a P0 of any extraction. Dead paths: registerGeointVisitors/registerAllVisitors (testbed-only).
- **floating→drawer is a REAL LIVE edge** (PanelContent.tsx:18,66 + TiledPanel.tsx:15 render legacy `PanelSlot` from @/lib/drawer inside every panel) — previously catalogued only as a naming collision. The new overlays/visual PanelSlot has ZERO consumers — built, unused. Drawer sunset must repoint this edge.
- floating→overlays: 0 edges (refutation re-confirmed); foldable-panel/windows/tauri-windows: 0 edges either way.
- **A partial internal decomposition program already exists** (floating/docs/DECOMPOSITION_{AUDIT,SPEC}.md + GATES.md, 2026-02-20): content-splitting succeeded (976-line god-provider → 143), file relocation abandoned (root files + 341-line barrel violate its own gates). Finish or supersede — don't re-derive.
- Kind B confirmed empirically (6 v4-codemod hits / 154 files). Tests: 5 files only — nothing covers stx actions/machine/visitors/registries. Churn = refactor tail + muse landing, not instability. Production wart: console.log spam in panel-registry-{crud,open}.ts. **Shape: standalone `@tmnl/floating`, Kind B.** New §3 collision: npm `@floating-ui/react` ≠ lib/floating.

### Editor vertical — seams, blocks, and the mislocated host
- **editor/v3 seams**: extensions/blocks (84f) · **extensions/annotations (44f — a hidden 4th seam: 5 Effect Services + popover XState + own schemas/design docs; deserves its own subpath)** · services (12f, incl. CollaborationService → **@y-sweet/sdk DIRECTLY — a 6th uncounted realtime transport running parallel to U10's convergence, zero msh/lnk/pct imports in the vertical**) · atoms (8f, ~90 exports) · persistence (8f, Effect SQL; literally imported by dataplane's persistence test) · components/viewport/hooks/schemas. **Kind mixed A+B (crd-shaped) — declare honestly.**
- **Census corrections**: external importers 25 → **16 verified** (3 production: nu-cmdk, terminal/v3, buffer mount); test dirs "19" → **6 dirs / 13 files**; editor-ai 38 → 39.
- **Block system**: contract = @tiptap/core `Node.create` + ReactNodeViewRenderer + optional co-located atoms.ts / self-registering ports.ts (dataplane) / useStreamBinding (connection-ports). TWO registration layers: static hand-edited arrays (extensions/blocks/index.ts:184-255, the real TipTap type registry) + `BlockRegistry` Effect.Service per-document *instance* directory (PubSub events). **Separability**: NOT separable from v3 core (shared EditorContext/protectedNode/BlockRegistry); IS separable from the heavy externals — 14 simple blocks + TaskItem + ColumnLayout + EmbeddedBlockWrapper skeleton are peer-free; MapBlock/Scene3DBlock/DataGridBlock need `prt` as optional peer (lazy subpath). ChartBlock: ava only. CodeEditorBlock imports lib/code-editor — **a real reverse edge; editor ships it only with code-editor as peer**.
- **`src/lib/blocks` collision CONFIRMED and worse**: it *claims* (adapters/tiptap.ts:5-7) to be EmbeddedBlockWrapper's standalone bridge but editor/v3 references it ZERO times — aspirational build-ahead; sole real importer is holonet registry-init. ASSIMILATE verdict stands.
- **AutonomousEditorPanel (testbed/collaboration/v2, 5,157L) — VERDICT: real implementation mislocated under testbed/, the conductor pattern again.** It is editor/v3's multi-panel authoring host composing editor+file-browser+file-index+variables/v2+editor-ai+commands+portal tokens+y-sweet, with panel-scoped stx isolation. **Load-bearing backwards edge: `lib/dataplane/components/Port/port-stx.ts:12` imports panelRegistry from `@/components/testbed/collaboration/v2/panel-stx` — production lib depending on a testbed file.** nu-cmdk navigates to it; lib/testbed registry catalogs it as a feature.
  **⟶ OPERATOR DECISION 2026-07-03: PROMOTED. The system joins the MORPH SUITE as `morpheditor`, TLA `edt`** — a 4th morph-cluster member: edt is to morpheditor what srf is to morphchat (the authoring-surface sibling). It adopts its **ambient systems**: the v2 complex (DocumentDrawer, ContextualToolbar, DocumentWatchProvider, PresenceAvatars, panel-stx), editor-ai (verdict flips archive→WIRE — morpheditor is its home), and the panel-scoped registry pattern. The promotion pass must: relocate out of components/testbed/, repoint dataplane's port-stx.ts backwards edge, re-register routes/registry entries, and declare `@tmnl/editor` (core) as its peer — morpheditor is the morph-side HOST, editor stays the substrate package.
- **Satellites**: buffer — provider mounted at main.tsx:12 but useBuffer has ZERO callers; standalone defer/archive, does NOT ride the extraction. code-editor — 6 importers, corruption confirmed (CodeEditorOverlay.tsx truncated mid-string-literal); own package or app-side, peer of editor. legacy editor/ — doubly dead (1 importer, and it's an unrouted testbed); archive. **editor-ai — REVISED from "archive": its sole consumer is AutonomousEditorPanel — if the host promotes, editor-ai flips to "wire as the editor's AI seam."**
- **Proposed shape**: `@tmnl/editor`, msh-style subpaths — core(A)/atoms(B)/blocks(mixed, heavy blocks lazy)/annotations(own subpath)/components. Deps on ratified TLAs: vbl (real, via the host), prt (heavy blocks), grd. **The register has NO editor TLA — this drafts the missing entry.** v4 surface concentrates in extensions/ (33 of 48 atom-touching files), not the service core.
- LOOP OPEN (flagged by scout): whether editor/v3's @effect-atom usage bypasses in-tree stx entirely (zero direct stx imports found; unresolved whether that matters for the stx migration pass).

### Wave-5 additions to §0/§2/§3
- §0 bugs: GlobalSlot `top-bar` dead case · floating registry console.log spam · dataplane→testbed backwards import.
- §2 dead: PersistentOverlays.tsx · screensaver mount path · Overlay.ts + deprecated OverlayRegistry (System B dead half) · overlays' terminal registerPanelType call · registerGeointVisitors/registerAllVisitors paths · overlays/visual PanelSlot (0 consumers).
- §3 collisions: npm `@floating-ui/react` ≠ lib/floating · floating/overlay/ atom concept ≠ lib/overlays (re-confirmed with the true edge list: overlays→floating 1 dead site; floating→drawer 2 LIVE sites; floating→overlays 0).

### Sequencing/decision impact
- Overlay core module = **System A extraction** (+ top-bar fix + PersistentOverlays deletion + screensaver decision). System B: finish-or-archive decision (scada is the live proof either way).
- Floating extraction P0s — **OPERATOR DECISIONS 2026-07-03**: (a) layout-engine competition: **recency wins — the Niri-style scroll-strip engine "was the truth"; split-tree sunsets**; (b) registration idioms: **none of A/B/C becomes canonical — author a BRAND-NEW unified panel registry ("one to rule them all")** as part of the floating core-module pass; all three idioms + morpheditor's panel-stx migrate onto it (natural substrate: mrp/registry's createScopedAtomRegistry factory — design pass to confirm). Remaining P0s: drawer PanelSlot repoint, finish the internal decomposition spec, test coverage gate.
- Editor: **DECIDED — AutonomousEditorPanel promotes into the morph suite as `morpheditor`** (operator, 2026-07-03), adopting editor-ai + the v2 ambient systems; promotion fixes the dataplane backwards edge; the editor TLA register entry (substrate package) still drafts separately. y-sweet joins the U10 transport ledger as implementation #6. Morph suite is now 4 systems: mrp (substrate) / crd (card) / srf (surface) / **morpheditor (authoring host)** — sequence morpheditor's extraction with the existing §5 morph ordering (after mrp, alongside/after crd leaves).
- traits "core module" (operator): natural home alongside the floating/overlay core-module curation — same pass family.

## 5. Suggested extraction/assimilation order (revised 2026-07-03 after wave-2 verification)
0. **Repair the 13 syntax-corrupted files** (§0) — until then the repo cannot produce a full semantic typecheck, which gates every acceptance gate in the extraction metaprompt. Then fix the 6 compiler-confirmed broken holonet imports + stx duplicate-React vitest alias.
1. **Zero-risk deletions** (§2 dead list + iiot's 2 dead @deprecated + eisenhower + metaskill husk + components/shell).
2. **`@tmnl/morph-transition-grammar` substrate → morph-card suite leafs** (schemas, card-state, machine, atoms) — operator priority, dormant target, zero collision, GREEN throughout. Then morphchat leafs (schemas, presets, adapter-mock).
3. **`@tmnl/search`** — cleanest classic extraction (leaf, 122/122 tests green, near-zero v4 surface).
4. **stx adoption debt** — migrate 53 in-tree importers to `@tmnl/stx`; assimilate fermion during the pass (fermion 12/12 green). Fix the react dedup first so the gate suite is trustworthy.
5. **`@tmnl/streams`** (fix 2 playground timeouts first or fold them out), **`@tmnl/files`**; `@tmnl/animation` only after it gains real tests (currently zero executable).
6. **U15 relocations** (prospects, getbyshell, telegram, pragma) — mechanical moves, high hygiene value.
7. **U10 transport convergence** — now understood as a v4-migration project, not a re-point: migrate iiot/realtime + agents/tasks + tsingou-flow consumers to msh's v4 API (or ship a v3 facade in msh); retire the holonet shim; decide lnk's activation as part of the same pass.
8. **morph-card-core de-hardening → morph-card-generative → morphchat-core/adapter-harness** (the latter coordinated with active pi-session work), alongside **`@tmnl/chat`** (chat+morphchat+rvn/chat — must reconcile two diverged APIs, not delete one tree) and **`@tmnl/rvn`**.
9. **`@tmnl/genifer`** (the hub — after morph suites settle their genifer seams), **`@tmnl/editor`** (v3), **`@tmnl/terminal`**, **AI-runtime consolidation** (ai-core absorbs agents' bridge; delete ai).
10. **DEFER**: iiot (decompose internally now, extract after Reactor v2 converges), geoint (server-pipeline first when ready), sios, harness (its TaggedStruct=126 makes it the costliest v4 migration per file), U4 orchestration decision, U14 design-system curation.

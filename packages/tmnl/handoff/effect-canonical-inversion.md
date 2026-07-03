# HANDOFF — Effect Canonical-Path Inversion + TLA Suite Migration

> **✅ EXECUTED 2026-07-03 (Val, same session).** The inversion below is DONE, not pending.
> Outcome: root `effect` → `4.0.0-beta.93` (override removed); Strategy A containment
> proven at runtime (tmnl + 6 small packages nest v3 3.21.2; the v3 `@effect/*` ecosystem
> nests under tmnl and resolves v3 — verified; tmnl v3 suites green post-flip: search
> 122/122, fermion 12/12); 485 files codemodded across 11 packages (alias imports →
> canonical); 3 vitest shims retired; 6 tsconfig path-mappings cleaned; tmnl carries a
> transitional `effect-v4→beta.93` alias for its 8 v4-boundary files; msh's strict-v4
> guardrail test inverted to the new polarity; effect-smol submodule checked out at the
> `effect@4.0.0-beta.93` tag (migration corpus intact + new `v3-to-v4.md`).
> **Test gates:** stx 368/368 ✅ · msh 111/111 ✅ · pi-workflows 28/28 ✅ · codemode 630/631 ·
> **beta.59→93 unstable/schema drift (tracked, task #25):** lnk 24 test files fail at
> module load (`Schema.brand`/`.check` AST composition — SchemaAST `encoding` undefined),
> pct 20/99, datagrid 44/1378 · effect-sui unmeasured (long e2e).
> **Residual for Pi/next passes:** the drift fixes (= the front edge of the suite
> migration), the root-level v3-era `@effect/platform@0.94.x` sitting beside root v4
> effect (hazard only for root-level scripts importing it), and §5's metaskill-husk
> deletion (needs Prime approval for rm).
>
> **Post-inversion lesson (2026-07-03, fix-wave):** the import codemod rewrote SOURCES;
> 9 packages' `dist/` still carried `effect-v4` specifiers resolving through orphaned
> `node_modules/effect-v4` symlinks to OLD beta.59 — producing mixed-version Effect
> values at runtime (beta.59's driver requires `.asEffect()`, removed in beta.93). That
> stale-dist mix caused ALL 39 real datagrid "failures" (datagrid source needed zero
> changes). **Rule: any import codemod must be followed by rebuilding every affected
> package's dist, and orphaned alias symlinks in package node_modules must be pruned**
> (stale ones still exist in 10 packages pointing at beta.59/66 — cleanup pending
> approval; tmnl's effect-v4→beta.93 is the only legitimate one).
>
> **Verified beta.59→93 drift-pattern table (fix-wave, feed the codemod table):**
> | Old (beta.59) | New (beta.93) | Source |
> |---|---|---|
> | `Tag.asEffect()` / `Effect.YieldableClass` subclassing | `Effect.service(Tag)`; Yieldable removed entirely | effect-smol `ca2498e7` "remove Effect.Yieldable"; note `migration/yieldable.md` prose still shows `.asEffect()` — source is ground truth |
> | `Schema.Defect` (bare value) | `Schema.Defect()` (caching factory) — bare use crashes SchemaAST `toType` at module load ("encoding" undefined) | effect-smol `07299a33`; this was THE lnk/pct module-load crash |
> | `configProvider.get(path)` / `.mapInput` / `.prefix` | `configProvider.load(path)`; orElse composes via .load on both sides | effect-smol `25b44827` |
> | `new SqlError({cause,message})` | `new SqlError({reason})` via `classifySqliteError(cause,{...})` | unstable/sql SqlError.ts (reason union) |
> | mixed beta.59/beta.93 module instances | beta.59 driver requires `.asEffect()` on yielded values → `TypeError: state.value.asEffect is not a function` is the SIGNATURE of a stale dist/symlink mixing versions | fix-datagrid reproduction |
> | `class X extends Effectable.Class { asEffect() {...} }` (old contract, still type-checks in some shapes) | **runtime signature: INFINITE FIBER SPIN** (~97% CPU, suite never terminates) — beta.93's shared `Base.prototype.evaluate` returns `this` unconditionally, never calling `asEffect()`. ⚠ deepwiki's suggested `override = someEffect` field fix ALSO hangs (empirically refuted by spike against the installed package) — the ONLY working migration is the composition recipe (plain class + declaration-merge + `Effectable.Prototype({label, evaluate(){ return this.asEffect() }})`) | fix-codemode-sui empirical spike; effect-smol `ca2498e7` |
>
> **Fix-wave outcomes:** codemode 631/631 ✅ · datagrid 79/79 on affected files (5 pre-existing
> perf flakes remain) ✅ — zero datagrid changes, pure stale-stx-dist · pct **154/157** ✅
> (3 residuals = missing beta.93 `@effect/platform-bun` for the CLI subprocess — a
> dependency-graph gap, tracked; only a stale beta.59 symlink exists, built against
> effect@3.19.18) · **lnk 494 passed / 0 drift failures ✅** (24 module-load crashes all
> traced to bare `Schema.Defect` → `Schema.Defect()`; `Lnk` handle migrated off the
> removed `Effect.YieldableClass` via the canonical composition pattern: plain class +
> `interface Lnk extends Effect.Effect<...>` declaration-merge +
> `Object.assign(Lnk.prototype, Effectable.Prototype({label, evaluate}))` — mirrors how
> `Context.ServiceProto` migrated in `ca2498e7`; NATS-bridge suite fully green) ·
> **effect-sui build clean + 80/80 ✅** (single-file fix: `src/effectable/base.ts` —
> `SuiEffect` re-declares `abstract asEffect()` + declaration-merge +
> `Effectable.Prototype` assign; cascaded to all 5 subclasses with zero subclass edits —
> the base-class variant of the lnk composition recipe).
>
> **FIX-WAVE COMPLETE (2026-07-03):** all 11 v4 packages green on `effect@4.0.0-beta.93`
> — stx 368/368 · msh 111/111 · pi-workflows 28/28 · codemode 631/631 · datagrid
> 1373/1378 (5 pre-existing perf flakes) · **pct 153/157, 0 failures** (4 = live-NATS env
> gates; the earlier "3 platform-bun residuals" were another stale-dist artifact — they
> dissolved after the dist rebuilds; independently re-verified. pct never imports
> `@effect/platform-bun` at all: it ships its own in-package CLI runtime built to avoid
> the pre-inversion alias mismatch — that rationale is now moot, its doc comments in
> `src/cli/runtime.ts`/`bin/pact.ts` are stale, cosmetic follow-up only) · lnk 494 green
> / 0 drift (58 conformance fails = pre-existing Phase-3/4 feature gaps) · effect-sui
> 80/80 · cockpit/frknk/mathkernel small suites via earlier gates. Zero stale
> `effect-v4` dist references remain (sweep-verified). Zero tests weakened. Remaining:
> stale-symlink prune (Prime approval), lnk HttpWire type-contract gap, metaskill-husk
> deletion (Prime approval).
>
> **lnk residuals (pre-existing, NOT drift — map to lnk's ACTIVATE roadmap/Phases 3-5):**
> 58 upstream-conformance failures are unimplemented features (Fork, TTL reaper, ETag/
> If-None-Match, security headers) + one Offset validation-completeness gap (`../` not
> rejected) — exactly the Phase 3/4 gates the TLA RFC's transport section lists against
> lnk's AMBER readiness. Plus 3 pre-existing `HttpWire.ts` type-contract gaps
> (`WireShape.put/get/head` under-declare reachable errors, e.g. `InvalidPayloadError`).

**For:** Pi (sophisticated coding agent) · **From:** Val, session 2026-07-03 · **Authority:** Prime directive, verbatim below
**Repo:** `~/getbyzenbook/projects/gbg/assets/code/repos/gbg` (Bun workspaces + NX 22; **bun or nothing**)

> **Prime's directive (2026-07-03):** "We need to support the latest version of effect… in our codebase, we drop the `effect-v4` alias, instead alias `effect-v3`, and then we support the latest effect version via the canonical install path throughout the monorepo. We do this, and then migrate the package suites."

## 0. Mission in one paragraph

Invert the Effect version polarity of the monorepo. Today the canonical `effect` resolves to **v3 (3.21.2)** (root dependency + root `overrides`, package.json:86,101) and the v4 vanguard rides an npm alias (`"effect-v4": "npm:effect@4.0.0-beta.59"`). After this work: the canonical `effect` install path resolves to the **latest Effect v4** everywhere, the v4 packages' `effect-v4/*` imports are rewritten to plain `effect/*`, and everything still on v3 survives via a new **`effect-v3`** alias (`"effect-v3": "npm:effect@3.21.2"`) until it is migrated. Then execute the TLA package-suite migration program already ratified in draft (reading list §8). The inversion makes v4 the default and v3 the marked, dying exception — which is the correct polarity for a codebase whose future is v4.

## 1. Verified current-state inventory (measured 2026-07-03, fresh greps)

### 1a. The alias fleet to dissolve
| Alias | Pin | Declared by |
|---|---|---|
| `effect-v4` | `npm:effect@4.0.0-beta.59` | stx, msh, pct, lnk, effect-sui, cockpit, frknk, mathkernel, datagrid, pi-workflows (10 packages) |
| `effect-v4` | `npm:effect@4.0.0-beta.66` | **codemode — already skewed one beta ahead** ⚠ |
| `effect-atom-react-v4` | `npm:@effect/atom-react@4.0.0-beta.59` | ×3 (stx, lnk, +1) |
| `effect-vitest-v4` | `npm:@effect/vitest@4.0.0-beta.59` | ×5 (+1 at beta.66 in codemode) |

### 1b. Import-site surface (the mechanical rewrite)
`from 'effect-v4…'` sites to rewrite → `from 'effect…'`: **965 total** — pct 251, effect-sui 198, lnk 122, msh 110, codemode 109, stx 83, datagrid 46, pi-workflows 21, tmnl 12 (metaskill test husk — see §5 caveat), mathkernel 8, frknk 3, cockpit 2. Plus the `effect-atom-react-v4` / `effect-vitest-v4` import sites (same treatment: canonical names, v3 gets the alias if ever needed).

### 1c. The v3 residue (gets the `effect-v3` alias or migrates)
Bare `from 'effect'` sites currently meaning v3: **tmnl 2,197** (the monolith), ctl 24, spikectl 15, sparkplug-client 4, specs-core 2, cms 1 (+ core/ecotrace 0 in src). v3-era `@effect/*` ecosystem deps ride alongside (platform, sql-pg, cluster, rpc, ai-*, atom-react 0.4.4, vitest) — see the §4 hazard.

### 1d. Version pin decision required
The vendored reference (`submodules/effect-smol`) and the verified Layer doctrine target **beta.59**; codemode already runs **beta.66**; npm "latest" may be newer at execution time. **Recommendation:** pin the canonical `effect` to the newest published 4.0.0-beta at execution time, upgrade codemode's skew into the same pin, and re-verify the doctrine's `unstable/*` claims against that beta before the suite migration (v4's `unstable/{schema,rpc,http,sql,cluster,ai,reactivity}` may break between betas — this is a verified, documented hazard, not caution theater). If deltas from beta.59 are found, amend `docs/architecture/effect-v4-layer-doctrine.md` in place.

## 2. The inversion spec (before → after)

| Concern | Before | After |
|---|---|---|
| Root `dependencies`/`overrides` | `"effect": "3.21.2"` (both) | `"effect": "<latest 4.0.0-beta>"`; add `"effect-v3": "npm:effect@3.21.2"` where v3 consumers remain |
| v4 packages (11) | dep `effect-v4` alias; imports `effect-v4/*` | dep plain `effect`; imports `effect/*` (965-site codemod, mechanical) |
| v4 test/atom aliases | `effect-vitest-v4`, `effect-atom-react-v4` | canonical `@effect/vitest`, `@effect/atom-react` at the v4-beta pin |
| v3 packages/app (tmnl + 5 small) | dep + imports plain `effect` | **strategy decision — see §4** (alias-rewrite vs per-package pin) |
| stx's vitest shim `effectV4AliasForAtomReact` (packages/stx/vitest.config.ts) | rewrites `effect/*`→`effect-v4/*` for atom-react | **retire** — canonical effect IS v4; the shim's reason evaporates |
| tmnl's duplicate-React-style hoisting risks | latent | **audit after re-install** — this repo has a live precedent (stx `hooks.test.ts` fails on bun-hoisted `react@19.2.4` vs tmnl's canary; the same class of failure can appear for effect) |

## 3. Execution order for the inversion itself

1. **Preflight:** repair the 13 syntax-corrupted files (latent-systems-map §0 — they abort tsc's parser phase; without this NO acceptance gate is trustworthy). Note: bare `tsc --noEmit` at repo root **false-greens** (references-only tsconfig) — always use `tsc -p tsconfig.lib.json` or `-b`, budget >240s.
2. **Choose the canonical beta** (§1d) and update `submodules/effect-smol` checkout to match if it drifts.
3. **Flip root:** `effect` → v4 pin in root dependencies + overrides; add `effect-v3` alias. Decide the v3-resolution strategy (§4) BEFORE `bun install`.
4. **Codemod the 11 v4 packages:** `effect-v4/` → `effect/` (965 sites; ast-grep or sed-with-review — these are import-path-only, semantics unchanged), swap package.json deps, unify codemode's beta skew, canonicalize the vitest/atom-react aliases, retire the stx vitest shim.
5. **`bun install` + full verification:** per-package `vitest run` (known-green baselines: search 122, minibuffer/v2 113, msh 55, fermion 12, charting/v2 11, nu-cmdk 28; stx has 14 pre-existing dup-React failures — fix via vitest `resolve.alias` react, or accept as known), `tsc -p tsconfig.lib.json`, NX builds of the 11 packages.
6. **Then** begin the suite migration program (§6).

## 4. ⚠ THE CRITICAL HAZARD — v3 ecosystem peer resolution

The `effect-v3` alias only fixes **first-party** imports. tmnl's v3 world also depends on v3-era `@effect/platform`, `@effect/sql-pg`, `@effect/cluster`, `@effect/rpc`, `@effect/ai-*`, `@effect/atom-react@0.4.4` — each of which internally does `import … from 'effect'` and peer-depends on effect ^3. With canonical `effect` = v4, **those packages resolve the wrong major** unless contained. Two viable strategies — Pi must pick (this is the handoff's #1 open decision):

- **Strategy A — per-package pin (recommended):** tmnl (and ctl/spikectl/sparkplug-client/specs-core/cms) declare `"effect": "npm:effect@3.21.2"` in their OWN package.json dependencies. Bun resolves a nested v3 into each package's local `node_modules`, so both first-party `from 'effect'` imports AND the v3 `@effect/*` ecosystem keep resolving v3 **with zero source-code changes** in the 2,197-site monolith. The `effect-v3` alias then serves only new/boundary code that must be explicit. Root `overrides` must NOT force v4 into these subtrees — scope the override or drop it in favor of per-package pins. **Verify bun's overrides-vs-nested-resolution behavior empirically before committing** (spike it — one test package, one install, inspect `bun pm ls effect`).
- **Strategy B — literal alias rewrite:** codemod all 2,243 v3 first-party sites `'effect'` → `'effect-v3'`. Honest and explicit, but it does NOT fix the `@effect/*` ecosystem's internal resolution — you still need Strategy A's containment (or bun `resolutions`) for those, so B is strictly more work for the same residual problem. Use B only for small packages being kept-but-not-migrated long-term.

Either way: **the duplicate-React failure mode is the template** — after install, grep-audit that no v3 module instance and v4 module instance can meet on one fiber (mixed-version `Effect` values are undefined behavior; the doctrine's single-version discipline).

## 5. Post-inversion caveats
- `packages/tmnl`'s 12 `effect-v4` sites are `src/lib/metaskill/__tests__` — a test-only husk whose implementation (`.pi/extensions/metaskill`) is staged-deleted in git. **Finish that deletion instead of codemodding it.**
- After inversion, the extraction metaprompt (`docs/metaprompts/extract-latent-system.metaprompt.md`) §3/§4 references to the `effect-v4` alias and the stx template's move #1 ("v4 island via npm alias") are **obsolete** — new packages just depend on canonical `effect`. Amend the metaprompt as part of this work.
- The TLA RFC §0.8 convention ("effect-v4 npm alias, peer under alias names") is **superseded** by this inversion — an amendment note has been added to the RFC. Peer declarations become canonical names at the v4 pin.

## 6. The program this unlocks (what "migrate the package suites" means)

The full architecture is in three documents — Pi should ingest all three (they are evidence-dense and adversarially verified):
1. **`packages/tmnl/docs/architecture/latent-systems-map.md`** — every boundary fact: 17 umbrellas, dead list, §4b census-efficacy audit, §4c wave-2 verified synthesis (10 claims adversarially re-derived), revised sequencing in §5.
2. **`packages/tmnl/docs/architecture/effect-v4-layer-doctrine.md`** — the verified v4 doctrine (headline: NO `Layer.scoped`; `Context.Service<Self,Shape>()(tag)` arg-inverted; curried `Layer.succeed`; no auto-`.Default`/`dependencies`; by-identity MemoMap; deepwiki is v3-contaminated for Effect — trust vendored source).
3. **`packages/tmnl/docs/architecture/tla-package-suites-rfc.md`** — the register: 21 three-letter-acronym packages across 5 suites, all layer-compositional (L0 config → L1 infra → L2 domain → L3 wiring, `layerTest` siblings), dual composition model (Kind A Layer graphs vs Kind B Atom/XState factories — never fake A onto B), the `dmn` name resolution (Domain Module Network per docs/rfc/0001; iiot's RFC-0002 reading re-homed), four shared-instance contracts (one NATS connection / pg pool / AtomRegistry / WASM kernel — by-identity memoization), sequencing §9, open threads §10.

**Suite register at a glance:** transport `msh`(GREEN anchor)⊕`lnk`(activate)+`prt`(new) · state `stx`+`qry`(GREEN)+`grd`+`num`+`vbl`+`flo` · morph `mrp`(keystone)+`crd`+`srf` (operator first-class; morph-card dormant = start; morphchat adapter-harness = active-dev, LAST) · runtime `cog`+`rig` (two runtimes, never merge; agents' OAuth bridge → rig NOT cog; `@tmnl/rig/session-schemas` contract leaf severs the morphchat coupling) · industrial `dmn`(author first)+`iot`+`geo`(extract-first vertical)+`ams`+`sio`.

**Inversion's effect on the program:** it deletes the RFC's OPEN-1 asymmetry — after inversion, migrating a v3 consumer to msh/lnk is a normal v3→v4 codemod (Context.Tag→Context.Service, curried succeed, platform-fold), not an alias dance. The per-subsystem codemod surfaces are tabulated in map §4b (top: geoint ~216, iiot 192, harness 178 incl. 132 TaggedStruct, editor 117, genifer 104; search/stx/fermion near-zero).

## 7. Acceptance gates (inversion phase)
1. `grep -rn "effect-v4" packages/*/src` → zero (aliases dissolved).
2. `bun install` clean; `bun pm ls effect` shows exactly one v4 at root + contained v3 pins where declared (Strategy A) — no accidental dual-resolution.
3. The 11 ex-v4 packages: tests ≥ pre-inversion baselines; NX builds green.
4. tmnl: `tsc -p tsconfig.lib.json` error count ≤ the post-corruption-repair baseline (i.e., inversion introduces zero new errors); `vite build` green.
5. No mixed-version module instances demonstrable (spike: import Effect in a v3 subtree and v4 package, compare module identity).
6. Metaprompt + RFC amendments landed; this handoff updated with outcomes.

## 8. Reading list (order matters)
1. This handoff.
2. `docs/architecture/tla-package-suites-rfc.md` (the what + why).
3. `docs/architecture/effect-v4-layer-doctrine.md` (the how, verified).
4. `docs/architecture/latent-systems-map.md` (the evidence; §0 breakage first).
5. `docs/metaprompts/extract-latent-system.metaprompt.md` (per-pass execution protocol: P0 census → P1 human checkpoint → scaffold → transplant+migrate → validate → re-point+delete → govern; journal + `VERIFIED:` discipline).
6. `submodules/effect-smol/MIGRATION.md` + `migration/*.md` (the authoritative v4 corpus; deepwiki is v3-contaminated for this).

**Open decisions for Prime/Pi:** (1) §4 strategy A vs B; (2) the canonical beta pin (§1d); (3) RFC name ratifications (§2 register + `dmn`); (4) whether the 5 small v3 packages (ctl, spikectl, sparkplug-client, specs-core, cms) migrate to v4 opportunistically or pin v3 indefinitely.

*Val's note to Pi: the map's §4b lesson applies to you too — this repo punishes grep-and-trust. The corrupted files mask the typechecker, the root tsconfig false-greens, "dead" packages run via Nix and package.json scripts, and the last agent who assumed the compiler was lying about syntax errors was wrong: the files really are truncated on disk. Verify, then cut.*

# METAPROMPT — Latent System Extraction & Effect v4 Individuation

> **Operator usage:** Replace `{{TARGET}}` below with a vertical from §2 (e.g. `fermion`,
> `command-ux`, `search`) or a new candidate subsystem under `packages/tmnl/src/lib/`.

> **⚠ AMENDMENT 2026-07-03 — canonical-path inversion executed.** The monorepo's canonical
> `effect` now resolves to v4 (`4.0.0-beta.93`); legacy v3 is contained by per-package
> `"effect": "3.21.2"` pins (tmnl + 6 small packages) and tmnl carries a transitional
> `effect-v4` alias for its few v4-boundary files. Consequences for this metaprompt:
> STX-template move #1 ("v4 island via npm alias") is **obsolete** — new packages simply
> depend on canonical `effect`; the `effectV4AliasForAtomReact` vitest shim is retired;
> §4's version pin is now beta.93 (re-verify unstable/* APIs against
> `submodules/effect-smol` which is checked out at the `effect@4.0.0-beta.93` tag, incl.
> the new `migration/v3-to-v4.md`). See `handoff/effect-canonical-inversion.md` for the
> executed state and residual drift work.
> Paste the entire document into a fresh Fable 5 session started in
> `packages/tmnl/`. Everything after this block is addressed to the executing model.

---

## §0 Who you are, and how you must run

You are **Fable 5**, operating as an extraction surgeon on the `@gbg/tmnl` mega-package
(`packages/tmnl/`, ~4,600 source files, ~100 subsystems under `src/lib/`). Your mission is to
individuate ONE latent system per pass into a sibling package under `packages/`, born directly
on **Effect v4 (effect-smol)** — exactly as `@tmnl/stx` was (§3).

This prompt is engineered around four of your strengths. Honor the obligations each creates:

1. **Long-horizon execution.** The pass is a single phased mission (§6). Maintain a journal at
   `packages/<name>/.extraction-journal.md`, appending after every phase. If your context is
   compacted or the session resumes, your FIRST action is to re-read this metaprompt and the
   journal, then continue from the last journal entry. Never restart a completed phase.
2. **Whole-system context.** Before proposing anything, bulk-ingest: the ENTIRE target
   subsystem, the STX exemplar files (§3), and the relevant `submodules/effect-smol/migration/*.md`
   guides. Reason globally about the seam — do not plan file-by-file from partial reads.
3. **Aggressive tool grounding.** Effect v4 is **beta**. Its APIs drift between releases, and
   your training data is stale by construction. **Recall is a hypothesis, not a source.** Every
   v4 API claim you act on must terminate in a journal line:
   `VERIFIED: <finding> via <source>` — sources in priority order per §5. No verification,
   no write.
4. **Precision codemods.** All v3→v4 transforms come from the codemod table (§4). You may not
   freelance a transform that is not in the table; if you encounter a pattern the table does not
   cover, VERIFY it first (§5), append a new row to the table copy in your journal, then apply.

Hard rules:
- **BUN OR NOTHING.** `bun install`, `bun run`, `bunx`. Never npm/yarn/pnpm.
- Plan-mode discipline: P0/P1 are read-only. You touch zero files outside your journal and
  scratch notes until the P1 checkpoint is approved.
- Report faithfully. If a gate fails, say so with the output. Never claim green you didn't see.

---

## §1 Mission doctrine — extraction ≡ audit

You are not performing a lift-and-shift. **Every pass is an audit.** Not everything in
`src/lib` deserves to survive: some of it is dead, some never worked, and some of it is three
implementations of the same idea. For `{{TARGET}}`, every file receives exactly one disposition:

| Disposition | Meaning |
|---|---|
| **UPGRADE** | Transfer into the new package, migrated to Effect v4 per §4. |
| **DEPRECATE** | Do not transfer. Delete (with evidence), or tombstone if live consumers remain. |
| **MERGE** | Absorb into this package from a sibling subsystem in the same vein. |
| **DEFER** | Out of scope this pass. Record why, and what would bring it in scope. |

**Evidence hierarchy (the validity signal), strongest first:**
1. **Testbed substantiation** — exercised by `src/components/testbed/*` or a playground
   (registry: `src/lib/testbed/registry.ts`). Testbed-backed code is presumed valid.
2. **Production importers** — count distinct external importer files (`grep -rl "@/lib/<x>"`).
3. **Unit/property tests** inside the subsystem.
4. **Zero external importers + no testbed = deprecation suspect.** Default DEPRECATE unless
   the operator overrules.

**Version forensics:** a `v1/` superseded by a `v2/` defaults v1 to DEPRECATE. Check the barrel
(`index.ts`) — what it re-exports is what's alive.

**The pty cautionary tale (memorize this):** an early inventory ranked `src/lib/pty/` a
top-tier extraction candidate — small, clean, has its own server script. A later evidence pass
found it has **zero importers and no testbed**. It is a deprecation suspect, not a candidate.
Inventories age; evidence doesn't. **You must re-run the census (P0) every pass, even for
targets listed in §2.**

**Merciless merges:** when subsystems are the same vein (mutual imports, cross-referencing
barrels, one narrative), collapse them into ONE package. Do not ship four packages where the
dependency graph says one.

---

## §2 Seed disposition map (rebuttable priors — re-verify before acting)

Derived from an evidence census on 2026-07-02. Importer counts and testbed facts WILL age.
Treat every row as a prior to confirm or overturn in P0.

> **⚠️ 2026-07-02 full-codebase census supersedes several rows below.** See
> [`docs/architecture/latent-systems-map.md`](../architecture/latent-systems-map.md) §4 —
> notably: the `@tmnl/panels` 4-way merge cycle was REFUTED (overlays is a hub-and-spoke;
> drawer is `@deprecated` into overlays/visual; animation is a standalone extraction; the
> name `panels` is taken by an unrelated harness-facing lib); slider v1 is the live default
> (v2 is WIP, not the successor); and in-tree `stx`/`data-grid` currently out-consume their
> sibling packages. Consult the map before any pass.

### MERGE verticals
| Package | Absorbs | Key evidence & seam work |
|---|---|---|
| `@tmnl/panels` | `floating` (165 files) + `overlays` (70) + `drawer` (12) + `animation` (17) | Dependency **cycle** drawer→overlays→floating→drawer; drawer→animation is drawer's heaviest edge (45 refs). Not separable as a trio; animation rides along. Prune 9 `@deprecated` files (floating 5, overlays 4) during the pass. |

### ASSIMILATE (priority 1) → DEPRECATE (priority 2)
**Operator decision 2026-07-02:** these clusters are "not entirely that useful" as standalone
packages. Disposition order: **(P1)** assimilate their genuinely useful concepts into existing
packages; **(P2)** deprecate whatever remains. Neither becomes a new `packages/` sibling.

| Cluster | P1 assimilation target | P2 deprecation remainder | Evidence |
|---|---|---|---|
| `fermion` (`src/lib/fermion/`, 14 files) | `@tmnl/stx` — schema-driven `Atom.family` + algebra/interpreter split fold into the atom-state domain (stx already ships `stxFamily`) | Anything stx doesn't want; `iiot/fermion/` instantiation (itself 0 external consumers) | Consumers to re-point: `FermionTestbed.tsx`, `geoint/fermion/` (×2), `iiot/fermion/` (×1) — all import core via **relative** `../../fermion` paths. No `Schema.TaggedStruct`; ~77 Effect call sites; v4 surface trivially small. |
| `command-ux` cluster (`commands` + `hotkeys` + `nu-cmdk` + `minibuffer` v2) | Useful concepts (command registry engine from `commands/core`, host-bridge pattern `NuCmdkHostBridge`, hotkey binding model) absorb into existing packages/app shell where they fit | `minibuffer/v1` (dead, `@deprecated`, 0 importers), `commands/defaults.ts` app content stays in tmnl; the rest deprecates in place rather than extracting | Fully-connected mutual-import cluster; app-shell wiring (`nu-cmdk/wire/useNuCmdkWire.ts` → tauri-windows/editor; `hotkeys/hooks/useGlobalHotkeys.tsx` → tauri-windows) makes it app furniture, not a library. `commands/docs/**` (40+ misfiled nu-cmdk docs) relocate regardless. |

### UPGRADE standalone
| Package | Source | Evidence |
|---|---|---|
| `@tmnl/search` | `src/lib/search/` (16 files) | Leaf: depends on nothing in the command cluster; consumed one-way by commands AND data-manager + 5 testbeds; 18 importers. Separate package so non-command consumers don't import a command package. |
| `@tmnl/streams` | `src/lib/streams/` (49 files) | 21 importers, Streams Playground + property tests + geoint/iiot production use. Fold `src/components/playground/streams/` in as a dev/examples subpath. NOT the same concern as durable-streams. |
| `@tmnl/charts` | `src/lib/charts/` (74 files) | Ant Design catalog + AI discriminator + config panels. Complementary to charting, NOT a duplicate (different backend, disjoint consumers). |
| `@tmnl/charting` | `src/lib/charting/v2/` | ECharts/SciChart streaming render engine. Delete `charting/v1` first (1 importer, `@experimental`). ChartingTestbed targets v2 only. |
| `@tmnl/ui-widgets` | `src/lib/slider/` (v2) + `src/lib/traits/` | Isolated pair (slider→traits), disjoint from the command cluster. Drop `slider/v1`. |
| (later) data-manager | `src/lib/data-manager/` (v2) | 7 importers, testbed sub-app. Depends on `@tmnl/search` — extract search first. |

### DEPRECATE (do not transfer)
- `src/lib/pty/` — 0 importers, no testbed.
- `src/lib/motion/` — 0 importers, no testbed, zero cohesion with `animation` (false grouping).
- `minibuffer/v1`, `slider/v1`, `charting/v1`, `data-manager/v1` — superseded version layers.
- `src/lib/durable-streams/` — deprecate-in-place; converge on the existing `@tmnl/lnk`
  (v4-native, spec-faithful successor). **Caveat:** it has 9 live consumers (geoint) while lnk
  has 0 — migrate only when lnk reaches Phase 3+ maturity. Third copy
  `src/lib/holonet/durable-streams/v1/` is already scoped for absorption by lnk Phase 5.
- `src/components/testbed/GeniferTestbed.tsx.bak` and similar orphans encountered en route.

### DEFER (domains needing internal decomposition first)
`iiot` (509 files), `geoint` (296), `terminal` (79), `cursor` (39 — used but untestbedded),
`rvn`/`chat`/`editor`/`genifer`/`morphchat` product features.

### Standing adoption debt (fix opportunistically)
tmnl still imports local `@/lib/stx` (56 refs) and `@/lib/data-grid` (32 refs) despite
`@tmnl/stx` / `@tmnl/datagrid` existing. If your pass touches these files anyway, re-point them.

---

## §3 The STX template — the seven moves

`packages/stx/` (`@tmnl/stx`) is the canonical, completed extraction. Read these files IN FULL
during P0 — they are your scaffold source, not just references:

| # | Move | Copy from |
|---|---|---|
| 1 | **v4 island via npm alias** — `"effect-v4": "npm:effect@4.0.0-beta.59"` coexists with the monorepo's root-pinned `effect@3.21.2`. Package code imports from `effect-v4/...`. | `packages/stx/package.json` |
| 2 | **Duck-typed boundaries** — ZERO `@tmnl/*` imports in package src. Cross-package couplings become structural contracts: `detectEntity()` reads `constructor.fieldMeta` / `constructor.entityTag` off values at runtime. "STX never imports @tmnl/entity." | `packages/stx/src/stx.ts:77-90`, `src/types.ts` |
| 3 | **Minimal barrel** — ≤ 2-3 export entry points (`.`, `./hooks`); internals sealed under `src/internal/*` with `@internal` annotations. Deep-importing internals from app code is forbidden. | `packages/stx/src/index.ts`, `src/internal/index.ts` |
| 4 | **NX wiring** — `project.json` with tags `["scope:tmnl","type:lib","domain:<domain>","effect:v4"]`, `dependsOn: ["^build"]`, cached build → `dist/`. Targets wrap `bun run ...`. | `packages/stx/project.json`, `tsconfig.json` |
| 5 | **v3↔v4 friction shim** — a vitest resolver plugin rewrites `effect/*` imports ONLY when the importer is a v4-peer package (e.g. `@effect/atom-react`), so v4-targeting deps don't resolve to the monorepo's v3. | `packages/stx/vitest.config.ts` (`effectV4AliasForAtomReact`) |
| 6 | **Runtime re-export** — re-export the v4 primitives your consumers need (`export { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"`) so they never take a direct v4 dep. | `packages/stx/src/index.ts` (bottom) |
| 7 | **Governance** — extraction order lives in an RFC; a handoff doc forbids mixing the legacy in-tree shim with the package: *"Mixing `@/lib/stx` and `@tmnl/stx` in new architecture work is forbidden; that is how ghosts get tenure."* | `packages/tmnl/docs/architecture/tmnl-react-native-migration-rfc.md` §10.15.4 (line ~1164), §12 (line ~1486); `packages/tmnl/handoff/ui-surface-stx-context.md` |

Also read `packages/stx/.research/STM-INTEGRATION-ARCHITECTURE.md` if your target touches
transactional state.

---

## §4 Effect v4 codemod protocol

### The verify-then-write loop (per module you touch)
```
1. READ   submodules/effect-smol/migration/<module>.md        (local authority)
2. GREP   submodules/effect-smol/packages/effect/src/          (confirm the API exists as documented)
          — or node_modules/effect-v4/ once the alias is installed
3. APPLY  the transform (ast-grep / Edit), matching the table below
4. GATE   bunx tsc --noEmit in the package
5. LOG    "VERIFIED: <API> via <path>" in the journal
```
Available migration guides (all local, authoritative):
`MIGRATION.md`, `migration/{cause,equality,error-handling,fiber-keep-alive,fiberref,forking,generators,layer-memoization,runtime,schema,scope,services,yieldable}.md`
under `submodules/effect-smol/`.

### Seed codemod table (verified 2026-07-02 against effect-smol @ 4.0.0-beta.59)

| Concern | v3 | v4 |
|---|---|---|
| Service tag | `class X extends Context.Tag("X")<X, Shape>() {}` | `class X extends Context.Service<X, Shape>() {}` |
| Fiber-local state | `FiberRef.*` | `Context.Reference` |
| Schema import | `import { Schema } from "effect"` | `import { Schema } from "effect/unstable/schema"` (unstable namespace — re-verify per beta) |
| Reveal | `Schema.asSchema(s)` | `Schema.revealCodec(s)` |
| Union | `Schema.Union(A, B)` | `Schema.Union([A, B])` |
| Record | `Schema.Record({ key, value })` | `Schema.Record(key, value)` |
| Filter | `s.pipe(Schema.filter(pred))` | `s.check(Schema.makeFilter(pred))` |
| Pick | `struct.pipe(Schema.pick("a"))` | `struct.mapFields(Struct.pick(["a"]))` |
| Partial | `Schema.partial` | `mapFields(Struct.map(Schema.optional))` |
| Extend | `Schema.extend(structB)` | `mapFields(Struct.assign(fieldsB))` |
| Validation | `Schema.validateSync` etc. | **removed** — use `Schema.decode*` + `Schema.toType` |
| Fallback | `annotations({ decodingFallback })` | `Schema.catchDecoding(() => Effect.succeedSome(...))` |
| **TaggedStruct** | `Schema.TaggedStruct(tag, fields)` | **removed in v4.** This is tmnl's dominant convention (~31.6k `Schema.` sites package-wide) — the single biggest transform. Verify the v4 replacement idiom in `migration/schema.md` (tagged Struct with `Schema.tag`/class-based per current beta) BEFORE transplanting any schema-heavy file, and add the verified row to your journal table. |
| Atoms | `import { Atom } from "@effect-atom/atom"` (+ `@effect-atom/atom-react`) | `import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"` — in-core reimplementation; `Atom.make`/`Atom.family` near drop-in (import-path swap). React bindings: `@effect/atom-react` beta as optional peer, exactly as STX. |
| Platform/RPC/Cluster | `@effect/platform`, `@effect/rpc`, `@effect/cluster` | folded into core `effect` (unstable namespaces for rpc/httpapi/cli). `@effect/platform-node|bun`, `@effect/sql-*`, `@effect/ai-*`, `@effect/vitest` remain separate at matching beta versions. |

### Version discipline
- Pin exactly what STX pins: `"effect-v4": "npm:effect@4.0.0-beta.59"` — unless the operator
  bumps, in which case bump STX too and re-verify every `unstable/*` API you use (they may
  break between betas).
- Any remaining `@effect/*` deps must be at the SAME beta version (`4.0.0-beta.59`).
- The monorepo root `overrides: { "effect": "3.21.2" }` stays. Your package is a v4 island.

---

## §5 Tool arsenal — mandated cadence

Grounding sources, in priority order:
1. **Local effect-smol corpus** — `submodules/effect-smol/` source + `migration/*.md`. Free,
   exact, matches the pinned beta. Always first.
2. **deepwiki MCP** — `ask_question` against `Effect-TS/effect-smol` for conceptual questions
   the local docs don't settle.
3. **effect-docs MCP** — API reference lookups.
4. **exa / nia MCPs** — ecosystem gaps (xstate, ag-grid, vendor libs).
5. **ast-grep** (`/ast-grep-find` skill) — apply codemods structurally, not by regex.
6. **LSP / `bunx tsc --noEmit`** — the arbiter of every transform.

Prior art to consult when stuck on v4 migration strategy:
- `packages/stx/` and its tests — living v4 code in THIS repo.
- The v4 vanguard siblings: `packages/{msh,pct,effect-sui,lnk}` — more v4-native packages.
- `repos/digimasons/workspaces/internal/docs/feature-plans/digimasons-workspace-effect-v4-refactor.md`
  and the worktree `repos/digimasons/.worktrees/workspace/effect-v4-refactor/` — a sibling
  repo's completed v4 refactor (outside this repo; read-only precedent).

**Cadence rule:** research interleaves with writing. Never complete more than one phase without
at least one grounding call. If you notice yourself writing v4 code from memory — stop,
verify, journal, resume.

---

## §6 Phase protocol

Each phase ends by appending a dated entry to `packages/<name>/.extraction-journal.md`
(create it in P2; for P0/P1, keep the journal draft in your scratchpad and move it in P2).

### P0 — RECON (read-only)
Fresh evidence census for `{{TARGET}}`, even if it appears in §2:
- Importer counts: `grep -rl "@/lib/<x>" src/` per subsystem (exclude self), **plus relative
  paths**: `grep -rln "from ['\"].*\.\./<x>" src/` — the fermion dry-run found 3 of 4 consumers
  hiding behind relative `../../fermion` imports that alias-only greps miss.
- Testbed coverage: `src/components/testbed/`, `src/lib/testbed/registry.ts`, playgrounds.
- Version forensics: `v1/`/`v2/` dirs, what the barrel exports, `@deprecated` markers, `.bak`.
- External coupling: imports of tauri-windows, routes, editor, terminal, iiot, geoint —
  each is either a seam to cut (host bridge / duck-type) or a reason to DEFER a file.
- Effect surface: count `Schema.`/`Effect.gen`/`Layer.`/`Stream.`/`Atom.` occurrences —
  sizes the §4 work.
Output: **disposition table** (file/dir → UPGRADE/DEPRECATE/MERGE/DEFER + one-line evidence).

### P1 — CHECKPOINT (mandatory stop)
Present to the operator: the disposition table, the proposed package boundary
(name, absorbed subsystems, what stays), a public API sketch (barrel entries), and the planned
duck-type/host-bridge seams. **Do not touch code until the operator approves.** Disposition
flips here are cheap; after P2 they are not.

### P2 — SCAFFOLD
Create `packages/<name>/` from the STX template (§3 moves 1, 3, 4, 5): `package.json`
(effect-v4 alias, minimal exports, optional peers), `project.json` (tags incl. `effect:v4`),
`tsconfig.json` (extends `../../tsconfig.base.json`), `vitest.config.ts` (adapt the resolver
plugin if you have v4-peer deps), `src/index.ts`, `src/internal/`. Run `bun install` at the
package dir; confirm workspace linkage.

### P3 — TRANSPLANT + MIGRATE
Move UPGRADE files in dependency order (leaves first). Per file: apply the §4 codemod table;
replace any `@tmnl/*` or `@/lib/*` coupling with a duck-typed structural contract or an
injected host-bridge interface (§3 move 2); seal non-public modules under `src/internal/`.
Gate with `bunx tsc --noEmit` after each cohesive batch, not at the end.

### P4 — VALIDATE
`bun run typecheck` + `bun run test:run` in the new package. Port the tests and the
testbed(s) that substantiated the system — the testbed is the validity signal; it must survive
the move (either inside the package as examples/tests, or re-pointed in tmnl).

### P5 — RE-POINT + DELETE
Add `"@tmnl/<name>": "workspace:*"` to tmnl's package.json (+ vite alias if dev-source
resolution is wanted, mirroring `'@tmnl/stx'` in `packages/tmnl/vite.config.ts`). Rewrite ALL
tmnl imports from `@/lib/<target>` to `@tmnl/<name>`. Delete `src/lib/<target>` and every
DEPRECATE item. tmnl `bunx tsc --noEmit` + `bun run build` green. **No shims, no ghosts** —
the pass is not done while a legacy copy exists.

### P6 — GOVERN
Finalize the journal (every phase entry + all `VERIFIED:` lines). Write the package README
(purpose, API, v4 notes). Append a one-paragraph extraction record to
`docs/architecture/tmnl-react-native-migration-rfc.md` (or an extraction ledger if the operator
prefers). Write a short handoff note forbidding resurrection of the deleted legacy paths.

---

## §7 Acceptance gates (all must pass; report each with observed output)

1. New package: `bunx tsc --noEmit` clean; `bun run test:run` green.
2. **Zero `@tmnl/*` imports inside package src** (duck-typed contracts only):
   `grep -rn "from ['\"]@tmnl/" packages/<name>/src/` → empty.
3. **Zero residual legacy imports in tmnl** — alias AND relative paths (the fermion dry-run
   found consumers reaching core via `../../<target>`, invisible to alias-only greps):
   `grep -rn "@/lib/<target>" packages/tmnl/src/` → empty, AND
   `grep -rn "from ['\"].*\.\./<target>" packages/tmnl/src/ | grep -v "src/lib/<target>/"` → empty
   (for every absorbed subsystem).
4. `src/lib/<target>` (and all DEPRECATE items) deleted; tmnl `bunx tsc --noEmit` +
   `bun run build` green.
5. NX/workspace: `project.json` present with `effect:v4` tag; `bun install` resolves the
   workspace link; `bunx nx run @tmnl/<name>:build` succeeds.
6. Barrel ≤ 2-3 entry points; internals sealed (`src/internal/` + `@internal`); v4 runtime
   primitives re-exported for consumers.
7. Journal complete; README + governance record written.
8. Every v4 API used has a `VERIFIED: ... via ...` line in the journal.

---

## Target

```
{{TARGET}}
```

Begin with P0. Your first output is the recon plan: what you will read, count, and verify.

# Effect v4 Layer-Composition Doctrine (beta.59)

> Produced 2026-07-03 by the wave-3 grounding agent (Opus, high effort) from submodules/effect-smol source + migration corpus, deepwiki (flagged v3-contaminated), and nia. Companion to tla-package-suites-rfc.md.


---

# Effect v4 Layer-Composition Doctrine (beta.59) — for TLA package-suite authors

**Path aliases:** `SMOL` = `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/submodules/effect-smol` · `GBG` = `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg`. Workspace vanguard imports `effect-v4` (npm alias → `effect@4.0.0-beta.59`); `SMOL/packages/effect` IS that exact version. **VERIFIED: effect-smol vendored source is `4.0.0-beta.59` via `SMOL/packages/effect/package.json`.**

**Source-hierarchy caveat up front:** deepwiki's `Effect-TS/effect` index is **v3-contaminated** — it asserted `Layer.scoped` exists and was unaware of `Effect.provide({local})`. Both claims are false for v4. The vendored `SMOL/` source overrides deepwiki wherever they conflict. **VERIFIED: deepwiki returned v3 semantics (claims `Layer.scoped`, no `local`) contradicting local v4 source via deepwiki Effect-TS/effect ask_question 2026-07-03.** Where cited below, deepwiki is used only to *corroborate* MemoMap behavior that matches local source.

---

## §1 — Service Definition

**1.1 `Context.Service` unifies all v3 tag constructors.** `Context.Tag`, `Context.GenericTag`, `Effect.Tag`, and `Effect.Service` are all gone; every service identifier is now `Context.Service`. The runtime structure is a typed map from identifier → implementation. **VERIFIED: "In v3... `Context.Tag`, `Context.GenericTag`, `Effect.Tag`, or `Effect.Service`. In v4, all of these have been replaced by `Context.Service`" via `SMOL/migration/services.md:1-9`.**

**1.2 Two-generic class form — exact idiom + argument-order trap.** The type params come FIRST via `Context.Service<Self, Shape>()`, then the id string is passed to the *returned* constructor `(id)`. This inverts v3's `Context.Tag(id)<Self,Shape>()`.
```ts
class Database extends Context.Service<Database, {
  readonly query: (sql: string) => string
}>()("Database") {}
```
**VERIFIED: v4 class syntax `Context.Service<Self, Shape>()("Database")` with inverted arg order vs v3 via `SMOL/migration/services.md:48-61`.** House reference uses exactly this: `class NatsConnectionService extends Context.Service<NatsConnectionService, NatsConnectionShape>()('@tmnl/msh/nats/Connection')`. **VERIFIED: two-generic class form with namespaced id via `GBG/packages/msh/src/nats/connection.ts:69-72`.**

**1.3 Function (single-generic) form** for a bare identifier without a class: `const Database = Context.Service<Database>("Database")` (or `Context.Service<Identifier, Shape>(key)`). **VERIFIED: function-syntax `Context.Service<Database>("Database")` via `SMOL/migration/services.md:24-34` and signature `<Identifier, Shape = Identifier>(key: string): Service<Identifier, Shape>` at `SMOL/packages/effect/src/Context.ts:130-131`.** House L0 config uses this: `export const MshConfigTag = Context.Service<MshConfig>('@tmnl/msh/Config')`. **VERIFIED via `GBG/packages/msh/src/schemas/config.ts:45`.**

**1.4 Class static members you get.** A `ServiceClass` extends `Service<Self,Shape>` which extends `Key` and `Yieldable`. Instance/static API surface: `.of(shape)` (identity typing helper), `.context(shape): Context<Id>`, `.use(f: Shape => Effect<A,E,R>): Effect<A,E,R|Id>`, `.useSync(f: Shape => A): Effect<A,never,Id>`, `.asEffect(): Effect<Shape,never,Id>`, `.key`. **VERIFIED: `Service` interface members `of`/`context`/`use`/`useSync` and `ServiceClass` with `new`/`key` via `SMOL/packages/effect/src/Context.ts:67-99` and `ServiceProto` impl at `Context.ts:200-224`.** House uses `.of` for construction-site type locking: `return NatsConnectionService.of({ nc, js, getJsm, config })`. **VERIFIED via `GBG/packages/msh/src/nats/connection.ts:149`.**

**1.5 `make` option ≠ auto-layer.** `Context.Service<Self>()(id, { make })` stores the constructor Effect on the class as `.make` but **does NOT auto-generate a `.Default` layer** (the v3 `Effect.Service` behavior is gone, and `dependencies` no longer exists). You build the layer yourself with `Layer.effect(this, this.make).pipe(Layer.provide(Dep.layer))`. **VERIFIED: "`Context.Service` with `make` stores the constructor effect on the class but does **not** auto-generate a layer... The `dependencies` option no longer exists" via `SMOL/migration/services.md:172-194`;** signature confirms optional `make` in options object at `SMOL/packages/effect/src/Context.ts:138-166`.

**1.6 Accessors removed — use `yield*`, not `.use`.** v3's `Effect.Tag` static-method proxy is gone (it erased generics/overloads). Replacement is `Service.use`/`useSync`, but doctrine is **prefer `yield*` in a generator** — `use` hides the dependency at the call site and leaks `R` into return values. **VERIFIED: "In v4, accessors are removed... **Prefer `yield*` over `use` in most cases**" via `SMOL/migration/services.md:64-140`.**

**1.7 `Context.Reference` — service-with-default.** v4 form is `Context.Reference<Shape>(id, { defaultValue: () => ... })` (function call, NOT the v3 `Context.Reference<Self>()(id, opts)` double-call). A `Reference<Shape>` extends `Service<never, Shape>` — meaning **it self-satisfies: yielding it never adds to `R`** (default supplies the value). Use for ambient config/log-level knobs a consumer may override but need not provide. **VERIFIED: v4 `Context.Reference<T>(id, {defaultValue})` via `SMOL/migration/services.md:214-221`; `interface Reference<Shape> extends Service<never, Shape>` via `SMOL/packages/effect/src/Context.ts:249`; `ReferenceTypeId` branch set when `arguments[1]?.defaultValue` present at `Context.ts:176-181`.** Internally, the layer MemoMap itself is a Reference: `Layer.CurrentMemoMap` is a `Context.Reference` defaulting to a fresh MemoMap. **VERIFIED (corroborated): `Layer.CurrentMemoMap` is a `Context.Reference` via deepwiki Effect-TS/effect.**

**1.8 ServiceMap/Context vs v3.** The module is still `Context` and the value type is still `Context.Context<R>` (`Context.make`/`get`/`add`/`mergeAll` keep identical names). What changed is the identifier constructor (`Service`) and that `Runtime<R>` is deleted — carry a `Context<R>` directly where you used to carry a `Runtime`. **VERIFIED: `Context.make/get/add/mergeAll` unchanged (v3=v4) via quick-ref table `SMOL/migration/services.md:232-235`; "`Runtime<R>`... no longer exists and you can use `Context<R>` instead" via `SMOL/migration/runtime.md:14-15`.** Practical wiring impact: run-with-deps is `Effect.runForkWith(services)` after `yield* Effect.context<R>()`, not `Runtime.runFork`. **VERIFIED via `SMOL/migration/runtime.md:50-78`.**

---

## §2 — Layer API in v4

**2.1 Constructors — the complete exported set.** Verified by exhaustive export scan of `Layer.ts`:
`succeed` / `succeedContext` / `empty` / `sync` / `syncContext` / `effect` / `effectContext` / `effectDiscard` / `unwrap` / `fromBuild` / `fromBuildMemo` / `mergeAll` / `merge` / `provide` / `provideMerge` / `fresh` / `launch`; plus builders `build` / `buildWithScope` / `buildWithMemoMap` / `makeMemoMap` / `makeMemoMapUnsafe`. **VERIFIED: full constructor/operator export inventory via `SMOL/packages/effect/src/Layer.ts` lines 250,291,379,409,474,525,576,633,676,695,719,754,788,835,865,920,975,1014,1133,1237,1762,1819.**

**2.2 THERE IS NO `Layer.scoped`.** This is the headline v4 change and the deepwiki trap. Scoped construction folds into `Layer.effect`, whose signature *excludes* `Scope` from the residual requirements: `Layer.effect(service, effect): Layer<I, E, Exclude<R, Scope.Scope>>`. A scoped acquire inside the effect (e.g. `Effect.acquireRelease`) is bound to the layer's own scope automatically. Likewise `Layer.effectDiscard` (returns `Layer<never, E, Exclude<R, Scope.Scope>>`) explicitly **"replaces `Layer.scopedDiscard` from Effect 3.x."** **VERIFIED: zero matches for `export const (scoped|scopedContext|scopedDiscard)` in `Layer.ts` via local grep AND via nia `nia_grep` exhaustive on Effect-TS/effect-smol (Total Matches: 0);** `effect` signature `Layer<I, E, Exclude<R, Scope.Scope>>` at `SMOL/packages/effect/src/Layer.ts:788-806`; **VERIFIED: "This API replaces the following from Effect 3.x: `Layer.scopedDiscard`" doc-comment on `effectDiscard` via `SMOL/packages/effect/src/Layer.ts:843-866`.** House proof: `NatsConnectionService.layerFromConfig = Layer.effect(...)` wraps `Effect.acquireRelease(connect, releaseNatsConnection)` with **no** `Layer.scoped` — the drain/close finalizer is scope-bound through `Layer.effect`. **VERIFIED via `GBG/packages/msh/src/nats/connection.ts:74-151` (acquireRelease at :101-130).**

**2.3 `succeed` / `sync` are curried on the service.** House canonical form is `Layer.succeed(Tag)(value)` — service first, value in a second call. **VERIFIED: `Layer.succeed(MshConfigTag)(DEFAULT_CONFIG)` via `GBG/packages/msh/src/schemas/config.ts:48`;** `succeed`/`sync` dual signatures at `SMOL/packages/effect/src/Layer.ts:633,719`.

**2.4 Composition operators — exact v4 names + type behavior:**

| Operator | Signature effect on `<ROut, E, RIn>` | Meaning |
|---|---|---|
| `provide(self, dep)` | keeps `self`'s ROut; `RIn' = RIn(dep) ∪ Exclude<RIn(self), ROut(dep)>` | Feeds dep's outputs into self's inputs; **dep outputs are consumed/hidden** |
| `provideMerge(self, dep)` | `ROut' = ROut(self) ∪ ROut(dep)` | Same wiring but **re-exports** dep's outputs alongside self's |
| `merge(a, b)` | `ROut' = ROut(a) ∪ ROut(b)`, inputs unioned | Binary concurrent build, no wiring between them |
| `mergeAll(...layers)` | variadic union of all outputs/inputs | N-ary `merge`; builds all concurrently |

**VERIFIED: `provide` returns `Layer<ROut2, E|E2, RIn | Exclude<RIn2, ROut>>` (consumes dep output) via `SMOL/packages/effect/src/Layer.ts:1133-1160`; `provideMerge` returns `Layer<ROut | ROut2, ...>` (re-exports) via `Layer.ts:1237-1264`; `merge` is `dual(2, ...=> mergeAll(self, ...))` binary/array via `Layer.ts:1014-1060`; `mergeAll` variadic via `Layer.ts:975-981`.** Decision rule: use `provide` to satisfy-and-hide an internal dependency (the common case), `provideMerge` when a *consumer* still needs both the service and its dependency in `R`, `mergeAll`/`merge` to combine sibling services at the same level. House uses `provideMerge` precisely to keep Database+Logger visible to downstream: `userServiceLayer.pipe(Layer.provideMerge(Layer.mergeAll(databaseLayer, loggerLayer)))`. **VERIFIED via `provideMerge` doc example `SMOL/packages/effect/src/Layer.ts:1200-1235`.**

**2.5 Memoization semantics — THE key v4 behavioral change.** In v3 each `Effect.provide` call had its own memo scope: two provides of overlapping layers silently **built them twice**. In v4 the `MemoMap` (a `SynchronizedRef<Map<Layer, [Context, Finalizer]>>`) is **shared across all `Effect.provide` calls on the same fiber** — overlapping layers build **once**. **VERIFIED: "In v4, the underlying `MemoMap`... is shared between `Effect.provide` calls... layers are automatically memoized / deduplicated across `Effect.provide` calls" via `SMOL/migration/layer-memoization.md:8-11`; MemoMap impl `getOrElseMemoize` at `SMOL/packages/effect/src/Layer.ts:291-345` (`fromBuildMemo` → `memoMap.getOrElseMemoize`).** Corroborated: **VERIFIED (corroborated): "MemoMap is shared across Effect.provide calls by default... backed by a SynchronizedRef containing a Map of Layer instances to built contexts and finalizers" via deepwiki Effect-TS/effect.**

**2.6 Opting OUT of shared memoization — two mechanisms:**
- **`Layer.fresh(layer)`** — wraps a layer to always rebuild with a fresh memo (existed in v3). Impl flips the fresh op-code so `getOrElseMemoize` bypasses cache. **VERIFIED via `SMOL/migration/layer-memoization.md:66-78` and `Layer.ts:1762`; corroborated via deepwiki (OP_FRESH bypass).**
- **`Effect.provide(layer, { local: true })`** — **NEW in v4.** Builds that provide's subtree against a *local* memo map, isolated from the fiber's shared one. **VERIFIED: `Effect.provide` options `{ readonly local?: boolean }`, doc "Use `options.local` to build the layer every time; by default, layers are shared between provide calls" via `SMOL/packages/effect/src/Effect.ts:5608-5650`;** semantics per `SMOL/migration/layer-memoization.md:80-98`. (deepwiki was unaware of `local` — trust local source.)

**2.7 Doctrine still: compose-then-provide-once.** Auto-memoization is a *safety net for the v3 multi-provide footgun*, **NOT** a license to skip composition. Build one explicit graph and `Effect.provide` it once. **VERIFIED: "composing layers before providing is still the recommended pattern... It is **NOT** a substitute for proper layer composition" via `SMOL/migration/layer-memoization.md:44-57`.**

**2.8 Scope handling.** `Scope.extend` → **`Scope.provide`** (same behavior: provides a Scope to an effect, removing `Scope` from `R` without closing it). Data-first `Scope.provide(effect, scope)` and data-last `effect.pipe(Scope.provide(scope))` both supported. Layer-internal scoping is automatic (§2.2); reach for `Scope.provide` only in hand-rolled builders. **VERIFIED via `SMOL/migration/scope.md:1-44`.** `Layer.buildWithScope(layer, scope)` remains for manual builds. **VERIFIED: `buildWithScope` at `SMOL/packages/effect/src/Layer.ts:576`.**

---

## §3 — Multi-Level Layer Graph (L0→L3) + House Reference

**3.1 The msh house pattern (canonical v4 house reference).** Layering is expressed **per-service** via a static `layer` assembled from a private `layerFrom*` + `Layer.provide(dep.layer)` chain, with a `XxxLive` alias re-export. Verified across three services:

- **L0 config (`Reference`/`succeed`):** `MshConfigTag = Context.Service<MshConfig>(...)`; `MshConfigDefault = Layer.succeed(MshConfigTag)(DEFAULT_CONFIG)`; `MshConfigCustom = (input) => Layer.succeed(MshConfigTag, ...)`. **VERIFIED via `GBG/packages/msh/src/schemas/config.ts:45-53`.**
- **L1 infra (scoped client):** `NatsConnectionService.layerFromConfig = Layer.effect(...acquireRelease...)`; then `static layer = layerFromConfig.pipe(Layer.provide(MshConfigDefault))`; `layerCustom = (cfg) => layerFromConfig.pipe(Layer.provide(MshConfigCustom(cfg)))`. **VERIFIED via `GBG/packages/msh/src/nats/connection.ts:74-168`.**
- **L2 domain (multi-dep):** `NatsPubSubService.layer = layerFromServices.pipe(Layer.provide(NatsInnerService.layer), Layer.provide(NatsHubService.layer))`; `NatsKVService.layer = layerFromInner.pipe(Layer.provide(NatsInnerService.layer))`. **VERIFIED via `GBG/packages/msh/src/nats/pubsub.ts:186-192` and `kv.ts:260-265`.**

**Idiom summary:** `layerFrom<Deps>` = the raw `Layer.effect` (residual `R` = its deps, unresolved). `layer` = the *self-contained* variant (deps provided, `RIn=never` or `never`-ish). `XxxLive` = ergonomic alias (`export const NatsPubSubServiceLive = NatsPubSubService.layer`). **VERIFIED via `GBG/packages/msh/src/nats/connection.ts:168`, `pubsub.ts:192`.** This split is deliberate: expose `layerFrom*` so a consumer can inject an alternate dependency; expose `layer` as the batteries-included default.

**3.2 The double-provide → single-build payoff.** `PubSub.layer` provides `NatsInnerService.layer` and `Hub.layer`, and `Hub.layer` *also* transitively needs `Inner`. In v3 this risked building `NatsInnerService` twice; in v4's shared MemoMap it builds **once** (single NATS inner connection). This is exactly the footgun §2.5 eliminates — and why the per-service `Layer.provide` style is now safe at scale. **VERIFIED: overlapping `NatsInnerService.layer` provided via both PubSub and Hub paths via `GBG/packages/msh/src/nats/pubsub.ts:187-188`; dedup guaranteed by shared MemoMap `SMOL/migration/layer-memoization.md:8-11`.** ✗ UNCERTAIN caveat: I did not execute a runtime build to observe the single-build empirically; the claim rests on the type/graph structure + documented MemoMap semantics. `LOOP OPEN: runtime observation of single Inner build not performed.`

**3.3 Recommended L0→L3 stack shape for a package suite:**
- **L0 — config/platform:** `Context.Service`/`Context.Reference` + `Layer.succeed`/`Layer.sync`. Pure, synchronous, zero deps. Export both a `Default` and a `Custom(input)` factory. (msh: `schemas/config.ts`.)
- **L1 — clients/infra:** scoped resources via `Layer.effect` + `Effect.acquireRelease`; `Layer.provide(L0)`. (msh: `nats/connection.ts`, `nats/inner.ts`.)
- **L2 — domain services:** `Layer.effect` reading L1 services; `.pipe(Layer.provide(l1a), Layer.provide(l1b))`. (msh: `pubsub`, `kv`, `stream`, `micro`.)
- **L3 — app wiring:** ONE `Layer.mergeAll(...L2 layers)` (or `provideMerge` where a service must stay visible), `Effect.provide`d once at the entrypoint.

**3.4 Test vs Live conventions — NAME CHANGE.** v4 abandons v3's `Default`/`Live` naming convention in favor of **`layer`** for the primary, with descriptive suffixes for variants (`layerTest`, `layerConfig`). **VERIFIED: "v4 adopts the convention of naming layers with `layer`... instead of v3's `Default` or `Live`. Use `layer` for the primary... `layerTest`, `layerConfig`" via `SMOL/migration/services.md:196-199`.** House currently keeps a `XxxLive` *alias* for ergonomics but the source-of-truth is `.layer` — **new suites should follow the v4 `layer`/`layerTest` convention and treat `Live` aliases as optional sugar.** For test doubles, build with `Layer.succeed(Tag)(stub)` (msh codec/auth do exactly this at `codec.ts:189`, `auth/service.ts:137`, `auth/jwt.ts:351` — **VERIFIED via those lines**); for per-test isolation of real resources, use `Effect.provide(layer, { local: true })` or `Layer.fresh` (§2.6).

---

## §4 — Cross-Package Layer Composition (suite authoring)

**4.1 Peer-layer export contract.** Each package must export, per service: (a) the `Context.Service` identifier class, (b) `Service.layerFrom<Deps>` (deps unresolved — the composable primitive), (c) `Service.layer` (deps resolved — batteries-included), and optionally (d) a `ServiceLive` alias + (e) a package-level namespace object aggregating them. msh's `Msh` const is the reference aggregate — a frozen object mapping `{ Connection, ConnectionLive, PubSub, PubSubLive, ... }`. **VERIFIED: `export const Msh = { Connection: NatsConnectionService, ConnectionLive: NatsConnectionServiceLive, ... } as const` via `GBG/packages/msh/src/index.ts` (Msh namespace block).** Consumers then compose across packages with `Layer.mergeAll(PkgA.Msh.PubSubLive, PkgB.FooLive)` and provide once.

**4.2 Avoiding double-memoization pitfalls across packages.** The shared MemoMap dedups **by layer identity (referential)**. Two rules follow: **(i)** a shared dependency (e.g. one NATS connection, one DB pool) must be the **same layer instance** across packages — export it from one owning package and have peers `Layer.provide` *that* instance, never re-declare their own. If package B constructs its own `ConnectionService.layer`, it is a distinct identity and will build a **second** connection despite the shared MemoMap. **(ii)** Reserve `Layer.fresh`/`{ local: true }` for deliberate isolation (test harnesses, independent pools) — using them accidentally on a shared infra layer defeats the single-build guarantee. **VERIFIED: memoization is by-layer-identity via `getOrElseMemoize` keyed on the `Layer` instance at `SMOL/packages/effect/src/Layer.ts:291-345`; `fresh`/`local` isolation semantics via `SMOL/migration/layer-memoization.md:59-98`.** ? INFERRED (design guidance, not a source-quote): the "same-instance-across-packages" contract is my architectural recommendation derived from by-identity memoization — the docs state the mechanism; the suite-authoring rule is inference. `LOOP OPEN: no doc explicitly prescribes cross-package single-instance export.`

**4.3 `unstable/*` caveats at beta.59.** v4 gates fast-moving modules under `effect/unstable/*` — these may take **breaking changes in minor releases** while non-unstable modules follow strict semver. The unstable set includes `ai, cli, cluster, devtools, eventlog, http, httpapi, jsonschema, observability, persistence, process, reactivity, rpc, schema, socket, sql, workflow, workers`. **A package suite whose public layer contracts touch any of these (notably `rpc`, `http`, `sql`, `schema`, `eventlog`) must pin the exact `4.0.0-beta.59` across the whole suite and treat those layer signatures as unstable API surface.** **VERIFIED: unstable module list + "may receive breaking changes in minor releases" via `SMOL/MIGRATION.md:41-50`.**

**4.4 Single-version discipline.** All Effect-ecosystem packages now share ONE version and release together — `effect@4.0.0-beta.59` ⇒ `@effect/sql-pg@4.0.0-beta.59`, `@effect/vitest@4.0.0-beta.59`, etc. Peer packages (`@effect/platform-*`, `@effect/sql-*`, `@effect/ai-*`, `@effect/opentelemetry`, `@effect/atom-*`, `@effect/vitest`) must be bumped in lockstep; many former separate packages (`@effect/platform`, `@effect/rpc`, `@effect/cluster`) are now **inside** core `effect`. A suite must declare a single Effect version and forbid drift. **VERIFIED: single-version release + consolidation + separate-package list via `SMOL/MIGRATION.md:14-38`.** House already models this: `"effect-v4": "npm:effect@4.0.0-beta.59"` and `"effect-vitest-v4": "npm:@effect/vitest@4.0.0-beta.59"` pinned together. **VERIFIED via `GBG/packages/msh/package.json`.**

---

## Quick-Reference Deltas (v3 → v4)

| Concern | v3 | v4 | Source |
|---|---|---|---|
| Service id | `Context.Tag(id)<S,Sh>()` / `GenericTag` / `Effect.Tag` | `Context.Service<S,Sh>()(id)` | `services.md:225-229` |
| Effectful service | `Effect.Service()(id,{effect,dependencies})` → auto `.Default` | `Context.Service()(id,{make})` → **build layer yourself**, no `dependencies` | `services.md:142-199` |
| Reference | `Context.Reference<S>()(id,opts)` | `Context.Reference<T>(id,opts)` | `services.md:214-221` |
| Scoped layer | `Layer.scoped` / `Layer.scopedDiscard` | **gone** → `Layer.effect` / `Layer.effectDiscard` (Scope excluded from R) | `Layer.ts:788,843-866` |
| Cross-provide memo | per-provide, silent double-build | **shared MemoMap, single build** | `layer-memoization.md:8-11` |
| Isolate a layer | `Layer.fresh` | `Layer.fresh` **or** `Effect.provide(l,{local:true})` (new) | `layer-memoization.md:59-98` |
| Scope combinator | `Scope.extend` | `Scope.provide` | `scope.md` |
| Runtime | `Runtime<R>` + `Runtime.runFork` | removed → `Context<R>` + `Effect.runForkWith` | `runtime.md` |
| Layer naming | `.Default` / `.Live` | `.layer` (+ `.layerTest`) | `services.md:196-199` |

**Sources consulted:** local vendored `SMOL/` (authoritative, beta.59) — migration corpus + `Layer.ts`/`Context.ts`/`Effect.ts` source; deepwiki `Effect-TS/effect` (corroborated MemoMap only; **v3-contaminated on `scoped`/`local` — rejected**); nia `Effect-TS/effect-smol` (indexed ✓; exhaustive grep confirmed zero `Layer.scoped` exports). House reference: `GBG/packages/msh/src` (connection/pubsub/kv/config/index). All MCPs available and used.
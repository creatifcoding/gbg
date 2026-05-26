# Effect-Sui Realization Ledger

This is the tracked proposal-maintenance home for `@tmnl/effect-sui`.

The exploratory grand proposal remains useful session context, but the durable package record lives here and in sibling package docs:

- `docs/SOURCE_MAP.md` — source grounding and current module map.
- `docs/DESIGN_DECISIONS.md` — durable architecture decisions.
- `docs/MANAGED_RUNTIME_STRATEGY.md` — ManagedRuntime ownership and edge strategy.
- `docs/QUALITY_GATES.md` — fast, localnet, and decomposition gates.
- `docs/REALIZATION_LEDGER.md` — implementation slice check-ins and closeout status.

## Artifact-home decision

Tracked Effect-Sui proposal artifacts belong under `packages/effect-sui/docs/`.

Rationale:

1. the docs travel with the package when moved or published;
2. package quality gates can reference them without crossing into TMNL scratch space;
3. Effect-Sui implementation history remains visible to package maintainers;
4. untracked session proposals can still exist as scratch, but they are not the source of truth.

## Realization check-ins

| Slice | Status | Evidence |
|---|---:|---|
| Workspace scaffold | Done | `98ca0950 Scaffold Effect-Sui package` |
| Nix/Sui dev shell | Done | `3a422d82 Add Effect-Sui Sui development shell` |
| Localnet e2e harness | Done | `d188f724 Add Effect-Sui localnet e2e harness` |
| Schema domain core | Done | `e3849fa4 Add Effect-Sui schema domain core` |
| Ontology/design docs | Done | `f3c55d45`, `f15aa811`, package docs |
| Effectable ontology | Done | `f7940186 Add Effect-Sui Effectable ontology facades` |
| Service contracts and fake runtime | Done | `94416d72`, `626fb085` |
| PTB AST/analyzer/compiler | Done | `8ee6cbc4`, `10bdc114` |
| Query/object resolver/BCS | Done | `462214aa Add Effect-Sui object resolver and BCS bridge` |
| Payment/gas/auth services | Done | `d6bfb6bb Add Effect-Sui payment gas and auth services` |
| ManagedRuntime PTB edge | Done | `26df5840`, `356bd917` |
| Namespace API hardening | Done | `13d1f2f0 Refine Effect-Sui namespace API and Effect boundaries` |
| ManagedRuntime edge clients | Done | `6df663d1 Add Effect-Sui ManagedRuntime edge clients` |
| STM reservations | Done | `04224b75 Add Effect-Sui STM reservation engine` |
| Package registry/factories | Done | `4aa29fb9 Add Effect-Sui package registry factories` |
| Quality gates | Done | `75bb3f62 Add Effect-Sui quality gates` |
| Flow decomposition | Done | `5202b96b refactor(effect-sui): decompose SuiFlow module` |
| PTB decomposition | Done | `0e933940 refactor(effect-sui): decompose SuiPTB module` |
| Schema decomposition | Done | `a61ba2fb refactor(effect-sui): decompose schema domain module` |
| Query decomposition | Done | `22f668bb refactor(effect-sui): decompose SuiQuery module` |
| Service contract decomposition | Done | `97d838d9 refactor(effect-sui): decompose service contracts` |
| Decomposition docs/closeout | Done | `70ac071a docs(effect-sui): record decomposed module map` |
| Effectable ontology decomposition | Done | `d5bfcbc6 refactor(effect-sui): decompose Effectable ontology` |
| Reservation STM decomposition | Done | `1a7d3b9b refactor(effect-sui): decompose reservation STM module` |
| Flow RPC boundary decomposition | Done | `19a93b03 refactor(effect-sui): decompose flow RPC boundary` |
| Flow runner lifecycle decomposition | Done | `a1d5b385 refactor(effect-sui): decompose flow runner lifecycle` |
| PTB compiler decomposition | Done | `89fef190 refactor(effect-sui): decompose PTB compiler` |
| PTB analyzer decomposition | Done | `3d55e0ce refactor(effect-sui): decompose PTB analyzer` |
| Schema Move type-tag decomposition | Done | `f3cd3241 refactor(effect-sui): decompose Move type tags` |
| Query resolver decomposition | Done | `a0fa7b5c refactor(effect-sui): decompose query resolver` |
| Flow auth decomposition | Done | `882a9bb9 refactor(effect-sui): decompose flow auth service` |
| Adapter edge decomposition | Done | `0c8ed7c2 refactor(effect-sui): decompose adapter edge` |
| Package registry decomposition | Done | `303d951c refactor(effect-sui): decompose package registry` |
| Transaction service contract decomposition | Done | `8035f076 refactor(effect-sui): decompose transaction service contracts` |
| Flow runtime decomposition | Done | `201f93d1 refactor(effect-sui): decompose flow runtime edge` |
| Reservation operations decomposition | Done | `045f3f59 refactor(effect-sui): decompose reservation operations` |
| Schema string noun decomposition | Done | `2505c764 refactor(effect-sui): decompose schema string nouns` |
| Payment planner decomposition | Done | `e0f8dfe7 refactor(effect-sui): decompose payment planner` |
| Schema typed error decomposition | Done | `20557982 refactor(effect-sui): decompose schema typed errors` |
| Query runtime decomposition | Done | `96255d6f refactor(effect-sui): decompose query runtime edge` |
| Query resolver core decomposition | Done | `e18122d7 refactor(effect-sui): decompose query resolver core` |
| PTB analyzer core decomposition | Done | `2d88a132 refactor(effect-sui): decompose PTB analyzer core` |
| Schema type-tag parser decomposition | Done | `d2e4b47a refactor(effect-sui): decompose schema type tags` |
| Flow auth policy decomposition | Done | `5f1a4a38 refactor(effect-sui): decompose flow auth policies` |
| Schema policy noun decomposition | Done | `11671088 refactor(effect-sui): decompose schema policy nouns` |
| Reservation acquire guard decomposition | Done | `d2c6c85d refactor(effect-sui): decompose reservation acquire guards` |

## Surgical decomposition closeout

Source-only line budgets stayed under the 120% cap:

| Namespace | Baseline | Final source lines | Ratio |
|---|---:|---:|---:|
| `src/flow` | 787 | 901 | 114.5% |
| `src/ptb` | 622 | 725 | 116.6% |
| `src/schema` | 571 | 604 | 105.8% |
| `src/query` | 401 | 473 | 118.0% |
| `src/services` | 321 | 361 | 112.5% |
| `src/effectable` | 287 | 311 | 108.4% |
| `src/reservation` | 226 | 264 | 116.8% |
| `src/flow/rpc` | 175 | 178 | 101.7% |
| `src/flow/runner` | 169 | 171 | 101.2% |
| `src/ptb/compiler` | 179 | 186 | 103.9% |
| `src/ptb/analyzer` | 181 | 203 | 112.2% |
| `src/schema/move` | 174 | 169 | 97.1% |
| `src/query/resolver` | 160 | 162 | 101.3% |
| `src/flow/auth` | 152 | 166 | 109.2% |
| `src/adapter` | 118 | 133 | 112.7% |
| `src/package` | 130 | 150 | 115.4% |
| `src/services/tx` | 156 | 163 | 104.5% |
| `src/flow/runtime` | 120 | 120 | 100.0% |
| `src/reservation/operations` | 118 | 125 | 105.9% |
| `src/schema/strings` | 110 | 125 | 113.6% |
| `src/flow/payment` | 91 | 72 | 79.1% |
| `src/schema/errors` | 89 | 75 | 84.3% |
| `src/schema/policies` | 72 | 67 | 93.1% |
| `src/query/runtime` | 88 | 82 | 93.2% |
| `src/query/resolver-core` | 102 | 113 | 110.8% |

Final decomposition gates passed:

- `bun run quality`
- `NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality`
- real localnet `bun run test:e2e`
- local relative cycle checks across decomposed namespaces
- `.forEach(` / `.peek(` scans across decomposed namespaces
- `git diff --check` before each commit

## Current package shape

Effect-Sui is now stable at the package boundary:

- public namespace imports remain preserved through barrels;
- decomposed internals live in focused leaf modules;
- ManagedRuntime edges remain explicit and disposable;
- service internals remain Effect/Context.Service based;
- localnet e2e remains the confidence surface for chain semantics.

# Effect-Sui Source Map

This is the grounding map for implementation work. Read the relevant source before editing the matching module. Yes, Prime, this is the seatbelt.

## Effect-smol / Effect v4

| Concern | Source |
|---|---|
| Effectable programs | `../../submodules/effect-smol/packages/effect/src/Effectable.ts` |
| Core Effect combinators, STM boundary, scope, retries | `../../submodules/effect-smol/packages/effect/src/Effect.ts` |
| Schema classes, tagged classes, tagged errors, decoding | `../../submodules/effect-smol/packages/effect/src/Schema.ts` |
| Schema AST and transformations | `../../submodules/effect-smol/packages/effect/src/SchemaAST.ts` |
| Context services | `../../submodules/effect-smol/packages/effect/src/Context.ts` |
| Layers and runtime assembly | `../../submodules/effect-smol/packages/effect/src/Layer.ts` |
| Managed runtime for adapter edge | `../../submodules/effect-smol/packages/effect/src/ManagedRuntime.ts` |
| STM refs | `../../submodules/effect-smol/packages/effect/src/TxRef.ts` |
| STM maps | `../../submodules/effect-smol/packages/effect/src/TxHashMap.ts` |
| STM queues | `../../submodules/effect-smol/packages/effect/src/TxQueue.ts` |
| STM semaphores | `../../submodules/effect-smol/packages/effect/src/TxSemaphore.ts` |
| Retry schedules | `../../submodules/effect-smol/packages/effect/src/Schedule.ts` |
| Failure causes | `../../submodules/effect-smol/packages/effect/src/Cause.ts` |

## Mysten TypeScript SDK

| Concern | Source |
|---|---|
| Client extension seam | `../../submodules/ts-sdks/packages/sui/src/client/client.ts` |
| Client extension types | `../../submodules/ts-sdks/packages/sui/src/client/types.ts` |
| Transport-neutral Core client | `../../submodules/ts-sdks/packages/sui/src/client/core.ts` |
| Transaction and async thunks | `../../submodules/ts-sdks/packages/sui/src/transactions/Transaction.ts` |
| Object cache and transaction plugins | `../../submodules/ts-sdks/packages/sui/src/transactions/ObjectCache.ts` |
| Promise queues to replace/augment with STM | `../../submodules/ts-sdks/packages/sui/src/transactions/executor/queue.ts` |
| Signer/keypair edge | `../../submodules/ts-sdks/packages/sui/src/cryptography/keypair.ts` |
| Sui BCS definitions | `../../submodules/ts-sdks/packages/sui/src/bcs/bcs.ts` |
| BCS runtime type | `../../submodules/ts-sdks/packages/bcs/src/bcs-type.ts` |
| Move codegen helpers | `../../submodules/ts-sdks/packages/codegen/src/generate-utils.ts` |

## Sui ontology and transaction model

| Concern | Source |
|---|---|
| Transaction/object DAG and transaction response surface | `../../submodules/sui/docs/content/develop/transactions/txn-overview.mdx` |
| PTB inputs, commands, arguments, borrowing, atomic effects | `../../submodules/sui/docs/content/develop/transactions/ptbs/prog-txn-blocks.mdx` |
| Object model, refs, ownership, package objects, DAG | `../../submodules/sui/docs/content/develop/sui-architecture/object-model.mdx` |
| Move package/module/object concepts | `../../submodules/sui/docs/content/develop/write-move/package-overview.mdx` |

## Sui localnet / infra

| Concern | Source |
|---|---|
| Localnet docs and `sui start` flags | `../../submodules/sui/docs/content/getting-started/onboarding/local-network.mdx` |
| TS SDK testcontainers localnet setup | `../../submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts` |
| TS SDK e2e env injection | `../../submodules/ts-sdks/packages/sui/test/e2e/utils/setupEnv.ts` |
| TS SDK e2e Vitest config | `../../submodules/ts-sdks/packages/sui/test/e2e/vitest.config.mts` |
| Experimental forked network | `../../submodules/sui/crates/sui-fork/README.md` |
| Package Nix shell entrypoint | `flake.nix` |
| Nix module aggregator | `nix/default.nix` |
| Core tools and mission-control wrapper | `nix/modules/core.nix` |
| Sui/Move/gRPC/Postgres/Docker tools | `nix/modules/sui.nix` |
| Localnet lifecycle scripts | `nix/modules/localnet.nix` |
| Nix eval/shell smoke checks | `nix/modules/tests.nix` |
| Vitest localnet global setup | `test/e2e/utils/globalSetup.ts` |
| Vitest localnet env injection | `test/e2e/utils/setupEnv.ts` |
| Move fixture compile/prepublish seam | `test/e2e/utils/prepublish.ts` |
| Transport smoke tests | `test/e2e/localnet.smoke.test.ts` |
| Minimal shared counter fixture | `move/fixtures/counter` |

## Package design docs

| Concern | Source |
|---|---|
| Public Effectable ontology | `docs/ONTOLOGY.md` |
| Durable design decisions | `docs/DESIGN_DECISIONS.md` |
| Service ecosystem and normalized service form | `docs/SERVICE_ECOSYSTEM.md` |
| ManagedRuntime insertion strategy | `docs/MANAGED_RUNTIME_STRATEGY.md` |
| Grand proposal / realization plan | `../../packages/tmnl/thoughts/shared/plans/effect-sui-grand-proposal.md` |

## Package seams

| Module | Future contents |
|---|---|
| `src/schema` | IDs, refs, Move tags, object/PTB/transaction/package nouns, execution results, typed errors |
| `src/effectable` | `SuiEffect`; public `SuiObject`, `SuiPTB`, `SuiTx`, `SuiPackage` / `SuiModule`; supporting `SuiQuery`, `SuiFlow` |
| `src/services` | Context services and live/test layers per `docs/SERVICE_ECOSYSTEM.md` |
| `src/ptb` | Full PTB AST, input/argument/result graph, passes, compiler, combinators backing `SuiPTB` and `SuiTx` |
| `src/query` | Object reads, BCS decode, GraphQL/gRPC reads, streams backing `SuiObject` |
| `src/flow` | Execution orchestration and schedules; lifecycle glue, not the third ontology noun |
| `src/reservation` | Runtime-owned STM state for object/gas/sender/sponsor reservations |
| `src/package` | Schema-backed package/module descriptors, registry layer, and SuiPackage/SuiModule factory helpers |
| `src/adapter` | Mysten `$extend` registration and Promise facade |
| `src/testing` | Fake clients, fixtures, localnet helpers |

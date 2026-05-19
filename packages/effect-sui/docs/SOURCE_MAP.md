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

## Package seams

| Module | Future contents |
|---|---|
| `src/schema` | IDs, refs, Move tags, execution results, typed errors |
| `src/effectable` | `SuiEffect`, `SuiPTB`, `SuiQuery`, `SuiFlow` |
| `src/services` | Context services and live/test layers |
| `src/ptb` | PTB AST, passes, compiler, combinators |
| `src/query` | Object reads, BCS decode, GraphQL/gRPC reads, streams |
| `src/flow` | Execution orchestration and schedules |
| `src/adapter` | Mysten `$extend` registration and Promise facade |
| `src/testing` | Fake clients, fixtures, localnet helpers |

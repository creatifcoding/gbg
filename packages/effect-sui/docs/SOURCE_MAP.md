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
| Tracked realization ledger and proposal-maintenance home | `docs/REALIZATION_LEDGER.md` |
| Exploratory grand proposal / scratch plan | `../../packages/tmnl/thoughts/shared/plans/effect-sui-grand-proposal.md` |

## Package seams

Public namespace modules keep stable `index.ts` barrels. Internal logic is split by capability; prefer direct submodule imports inside the package and namespace imports from package consumers.

| Module | Current contents |
|---|---|
| `src/schema/index.ts` | Public barrel for schema nouns |
| `src/schema/bytes.ts` | Byte/Chunk helpers and 32-byte schemas |
| `src/schema/strings.ts` | Addresses, object ids, digests, versions, string codecs |
| `src/schema/move.ts` | Move identifiers and Sui type tags |
| `src/schema/objects.ts` | Object refs, shared refs, object args |
| `src/schema/descriptors.ts` | Package/module descriptors |
| `src/schema/errors.ts` | Schema-backed typed errors |
| `src/schema/policies.ts` | Build/gas/payment/auth policies |
| `src/schema/decode.ts` | Decode/encode helper functions |
| `src/effectable/index.ts` | Public barrel for Effectable ontology facades |
| `src/effectable/base.ts` | `SuiEffectKind`, `SuiEffect`, `SuiQuery`, `SuiFlow` base algebras |
| `src/effectable/object.ts` | `SuiObject` and object snapshot/options |
| `src/effectable/ptb.ts` | `SuiPTB`, PTB inputs/commands/build artifact/options |
| `src/effectable/tx.ts` | `SuiTx` lifecycle facade/options |
| `src/effectable/package.ts` | `SuiPackage` / `SuiModule` and typed factory surface |
| `src/services/index.ts` | Public barrel for Context.Service contracts |
| `src/services/client.ts` | Client service boundary |
| `src/services/object.ts` | Object resolver contracts |
| `src/services/bcs.ts` | BCS bridge contracts |
| `src/services/ptb.ts` | PTB analyzer/compiler contracts |
| `src/services/tx.ts` | Gas/payment/auth/preflight/execution/finality/runner contracts |
| `src/services/reservation.ts` | Reservation service contracts |
| `src/services/package.ts` | Package registry contracts |
| `src/services/diagnostics.ts` | Diagnostics contracts |
| `src/ptb/index.ts` | Public barrel for PTB AST/analyzer/compiler |
| `src/ptb/arguments.ts` | PTB argument schemas |
| `src/ptb/inputs.ts` | PTB input schemas |
| `src/ptb/commands.ts` | PTB command schemas |
| `src/ptb/ast.ts` | PTB root AST schema |
| `src/ptb/constructors.ts` | Ergonomic PTB constructors |
| `src/ptb/decode.ts` | PTB AST decode helpers |
| `src/ptb/analyzer.ts` | PTB static analyzer |
| `src/ptb/compiler.ts` | Mysten Transaction compiler |
| `src/ptb/make.ts` | Effectable `SuiPTB` facade constructor |
| `src/ptb/runtime.ts` | ManagedRuntime-backed PTB builder edge |
| `src/query/index.ts` | Public barrel for query/read helpers |
| `src/query/types.ts` | Query client/object/codec contracts |
| `src/query/schema.ts` | Query-local schema decode helpers |
| `src/query/bcs.ts` | BCS decode/encode bridge implementation |
| `src/query/resolver.ts` | Object resolver implementation |
| `src/query/operations.ts` | Service-use Effect constructors |
| `src/query/runtime.ts` | ManagedRuntime-backed Query client edge |
| `src/flow/index.ts` | Public barrel for transaction flow helpers |
| `src/flow/types.ts` | Flow client/signer contracts |
| `src/flow/errors.ts` | Flow typed error constructors |
| `src/flow/gas.ts` | Gas planning service implementation |
| `src/flow/payment.ts` | Payment planning service implementation |
| `src/flow/auth.ts` | Auth/build/sign service implementation |
| `src/flow/rpc.ts` | Public barrel for transaction RPC services |
| `src/flow/rpc-shared.ts` | RPC payload/status/digest normalization helpers |
| `src/flow/rpc-preflight.ts` | Preflight dry-run RPC service |
| `src/flow/rpc-execution.ts` | Transaction execution RPC service |
| `src/flow/rpc-finality.ts` | Transaction finality wait RPC service |
| `src/flow/reservation-request.ts` | Lifecycle reservation request construction |
| `src/flow/runner.ts` | `SuiTxRunner` service assembly |
| `src/flow/runner-types.ts` | Runner dependency/options contracts |
| `src/flow/runner-completion.ts` | PTB requirement, completion invariants, preflight guard |
| `src/flow/runner-lifecycle.ts` | Transaction lifecycle state machine |
| `src/flow/runtime.ts` | ManagedRuntime-backed Flow client edge |
| `src/reservation/index.ts` | Public barrel for STM reservation state/services |
| `src/reservation/types.ts` | Reservation resource/lock/record/state types |
| `src/reservation/resources.ts` | Resource-key derivation for objects/gas/sender/sponsor |
| `src/reservation/state.ts` | Runtime-owned `TxRef`/`TxHashMap` state and snapshots |
| `src/reservation/operations.ts` | STM acquire/release/reconcile operations |
| `src/reservation/service.ts` | `SuiReservationService` layer assembly |
| `src/package` | Registry layer and SuiPackage/SuiModule factory helpers |
| `src/adapter` | Mysten `$extend` registration and Promise facade |
| `src/testing` | Fake clients, fixtures, localnet helpers |

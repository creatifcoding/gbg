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
| `src/schema/bytes.ts` | Byte schema public barrel |
| `src/schema/byte-schemas.ts` | Byte and 32-byte branded schemas |
| `src/schema/byte-chunk.ts` | Chunk conversion and byte validation helpers |
| `src/schema/byte-codecs.ts` | Hex/base64 byte codec schemas |
| `src/schema/strings.ts` | Address/object id/digest/version schema barrel |
| `src/schema/string-normalize.ts` | Shared string normalization transforms |
| `src/schema/string-address.ts` | Sui address and object-id schemas/codecs |
| `src/schema/string-digest.ts` | Object and transaction digest schemas/codecs |
| `src/schema/string-version.ts` | Object version u64 string schema |
| `src/schema/move.ts` | Public barrel for Move identifiers and Sui type tags |
| `src/schema/move-identifiers.ts` | Move identifier schema/brand |
| `src/schema/type-tag-string.ts` | Type-tag string schema public surface |
| `src/schema/type-tag-primitives.ts` | Primitive type-tag literals |
| `src/schema/type-tag-normalize.ts` | Recursive type-tag string normalization |
| `src/schema/type-tag.ts` | Structured type-tag public barrel |
| `src/schema/type-tag-model.ts` | Recursive Sui type-tag model classes and stringify |
| `src/schema/type-tag-parser.ts` | Structured recursive Sui type-tag parser |
| `src/schema/objects.ts` | Object refs, shared refs, object args |
| `src/schema/descriptors.ts` | Package/module descriptors |
| `src/schema/errors.ts` | Typed error barrel |
| `src/schema/error-codes.ts` | Error code, phase, mode, and topology literals |
| `src/schema/error-classes.ts` | Public barrel and `SuiError` union for Schema-backed tagged errors |
| `src/schema/error-core-classes.ts` | Core schema/object/transport/execution/reservation/invariant errors |
| `src/schema/error-codec-classes.ts` | BCS parse and pure encode errors |
| `src/schema/error-ptb-classes.ts` | PTB analysis/argument/protocol/compile/build errors |
| `src/schema/error-flow-classes.ts` | Gas/payment/auth/preflight/execution/finality errors |
| `src/schema/error-package-classes.ts` | Package/module/type registry errors |
| `src/schema/policies.ts` | Build/gas/payment/auth policy public barrel |
| `src/schema/policy-build.ts` | Transaction build-mode literals |
| `src/schema/policy-gas.ts` | Gas policy schemas |
| `src/schema/policy-payment.ts` | Payment policy schemas |
| `src/schema/policy-auth.ts` | Auth policy schemas |
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
| `src/services/tx.ts` | Transaction lifecycle service contract barrel |
| `src/services/tx-planning.ts` | Gas/payment planning contracts |
| `src/services/tx-auth.ts` | Authorization result/service contracts |
| `src/services/tx-rpc.ts` | Preflight/execution/finality contract barrel |
| `src/services/tx-preflight.ts` | Dry-run preflight service contracts |
| `src/services/tx-execution.ts` | Transaction execution service contracts |
| `src/services/tx-finality.ts` | Finality/visibility service and watcher contracts |
| `src/services/tx-runner.ts` | Transaction lifecycle runner contracts |
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
| `src/ptb/analyzer.ts` | PTB analyzer service/public surface |
| `src/ptb/analyzer-arguments.ts` | PTB command argument validation |
| `src/ptb/analyzer-arity.ts` | PTB command result arity inference |
| `src/ptb/analyzer-diagnostics.ts` | PTB command diagnostic collection |
| `src/ptb/analyzer-inputs.ts` | PTB input name/object-id collection |
| `src/ptb/analyzer-core.ts` | End-to-end PTB analysis orchestration |
| `src/ptb/compiler.ts` | PTB compiler service/public surface |
| `src/ptb/compiler-types.ts` | Mysten Transaction/Argument compiler types |
| `src/ptb/compiler-args.ts` | PTB argument resolution |
| `src/ptb/compiler-input.ts` | PTB input compilation |
| `src/ptb/compiler-command.ts` | PTB command application |
| `src/ptb/compiler-core.ts` | End-to-end PTB compile program |
| `src/ptb/make.ts` | Effectable `SuiPTB` facade constructor |
| `src/ptb/runtime.ts` | ManagedRuntime-backed PTB builder edge |
| `src/query/index.ts` | Public barrel for query/read helpers |
| `src/query/types.ts` | Query client/object/codec contracts |
| `src/query/schema.ts` | Query-local schema decode helpers |
| `src/query/bcs.ts` | BCS bridge service surface |
| `src/query/bcs-codec.ts` | BCS codec parse/serialize helpers |
| `src/query/resolver.ts` | Object resolver service/public surface |
| `src/query/resolver-core.ts` | Core object read orchestration program |
| `src/query/resolver-decode.ts` | Resolved object field/ref/snapshot normalization |
| `src/query/resolver-shared-ref.ts` | Shared owner to `SharedObjectRef` normalization |
| `src/query/resolver-errors.ts` | Object resolver error normalization |
| `src/query/operations.ts` | Service-use Effect constructors |
| `src/query/runtime.ts` | ManagedRuntime-backed Query client public barrel |
| `src/query/runtime-types.ts` | Query runtime/client/service contracts |
| `src/query/runtime-layer.ts` | Query service layer graph |
| `src/query/runtime-client.ts` | ManagedRuntime-backed Query client facade |
| `src/flow/index.ts` | Public barrel for transaction flow helpers |
| `src/flow/types.ts` | Flow client/signer contracts |
| `src/flow/errors.ts` | Flow typed error constructors |
| `src/flow/gas.ts` | Gas planner service and layer surface |
| `src/flow/gas-plan.ts` | Gas price/budget resolution and rationale helpers |
| `src/flow/payment.ts` | Payment planning service assembly |
| `src/flow/payment-plan.ts` | Payment policy planning, gas overlap checks, and PTB object input collection |
| `src/flow/auth.ts` | Auth service/layer assembly |
| `src/flow/auth-build.ts` | Transaction artifact, gas/payment, and byte-build helpers |
| `src/flow/auth-signing.ts` | Signer normalization, signer address, and signature helpers |
| `src/flow/auth-core.ts` | Auth policy orchestration and transaction preparation |
| `src/flow/auth-policy-handlers.ts` | Offline/keypair/sponsored authorization handlers |
| `src/flow/rpc.ts` | Public barrel for transaction RPC services |
| `src/flow/rpc-shared.ts` | RPC payload/status/digest normalization helpers |
| `src/flow/rpc-preflight.ts` | Preflight dry-run RPC service |
| `src/flow/rpc-execution.ts` | Transaction execution RPC service |
| `src/flow/rpc-finality.ts` | Transaction finality wait/watch RPC service |
| `src/flow/reservation-request.ts` | Lifecycle reservation request construction |
| `src/flow/runner.ts` | `SuiTxRunner` service assembly |
| `src/flow/runner-types.ts` | Runner dependency/options contracts |
| `src/flow/runner-completion.ts` | PTB requirement, completion invariants, preflight guard |
| `src/flow/runner-lifecycle.ts` | Transaction lifecycle state machine |
| `src/flow/runner-reconcile.ts` | Lifecycle exit reconciliation finalizer |
| `src/flow/runtime.ts` | ManagedRuntime-backed Flow client public barrel |
| `src/flow/runtime-types.ts` | Flow runtime/client/service and watcher contracts |
| `src/flow/runtime-layer.ts` | Flow service layer graph |
| `src/flow/runtime-client.ts` | ManagedRuntime-backed client facade and finality watcher edge |
| `src/reservation/index.ts` | Public barrel for STM reservation state/services |
| `src/reservation/types.ts` | Reservation resource/lock/record/state types |
| `src/reservation/resources.ts` | Resource-key derivation for objects/gas/sender/sponsor |
| `src/reservation/state.ts` | Runtime-owned `TxRef`/`TxHashMap` state and snapshots |
| `src/reservation/operations.ts` | STM reservation operations barrel |
| `src/reservation/operations-acquire.ts` | Reservation token allocation and lock insertion |
| `src/reservation/operations-guards.ts` | Reservation resource derivation, duplicate detection, and conflict checks |
| `src/reservation/operations-release.ts` | Reservation release and reconciliation cleanup |
| `src/reservation/service.ts` | `SuiReservationService` layer assembly |
| `src/package/index.ts` | Public package registry/factory barrel |
| `src/package/types.ts` | Package descriptor input and registry state contracts |
| `src/package/descriptor.ts` | Descriptor normalization and counter fixture descriptor |
| `src/package/registry.ts` | `SuiPackageRegistry` state, service, and live layer |
| `src/package/operations.ts` | Effect operations over the package registry service |
| `src/package/factories.ts` | `SuiPackage`/`SuiModule` typed factory helpers |
| `src/adapter/index.ts` | Public adapter barrel |
| `src/adapter/types.ts` | Adapter client/source/cache/extension contracts |
| `src/adapter/cache.ts` | WeakMap-backed runtime cache |
| `src/adapter/client.ts` | ManagedRuntime-backed Flow/Query Promise facade |
| `src/adapter/extension.ts` | Mysten `$extend` registration factory |
| `src/testing` | Fake clients, fixtures, localnet helpers |

# Effect-Sui Service Ecosystem

`SuiObject`, `SuiPTB`, `SuiTx`, and `SuiPackage` are Effectable facades. The service ecosystem does the hard work behind those facades.

## Normalized service form

Every service is specified with the same form:

| Field | Meaning |
|---|---|
| Responsibility | One sentence describing what the service owns. |
| Consumes | Inputs accepted by the service. |
| Produces | Outputs emitted by the service. |
| Dependencies | Other services / SDK modules required. |
| Invariants | Conditions the service must preserve. |
| Failures | Tagged error families emitted. |
| STM / concurrency | Reservation, locking, and parallelism policy. |
| Observability | Required spans, metrics, and debug artifacts. |
| Tests | Unit, property, fake-client, localnet, and/or e2e coverage. |

This form is mandatory. If a service cannot be expressed this way, it is probably two services wearing a trench coat.

## Canonical transaction process

A `SuiTx` lifecycle is normalized into phases. Not every mode runs every phase, but every mode names where it deviates.

| Phase | Name | Owner | Output |
|---:|---|---|---|
| 0 | Intent capture | `SuiObject` / `SuiPackage` / user code | `SuiPTB` or `SuiTx` plan |
| 1 | Static analysis | `SuiPtbAnalyzer` | command graph diagnostics |
| 2 | Object resolution | `SuiObjectResolver` | current object refs / snapshots |
| 3 | Pure / BCS encode | `SuiBcsBridge` | pure input bytes / decoded content |
| 4 | Reservation | `SuiReservationService` / `SuiTxState` | reserved object + gas identities |
| 5 | Gas planning | `SuiGasPlanner` | gas price, budget, dry-run requirements |
| 6 | Payment planning | `SuiPaymentService` | gas payment / gas owner / sponsor data |
| 7 | PTB compilation | `SuiPtbCompiler` | Mysten `Transaction` / transaction kind |
| 8 | Preflight | `SuiPreflightService` | dry-run / simulation result |
| 9 | Auth | `SuiAuthService` | signatures / wallet handoff / offline payload |
| 10 | Execution | `SuiExecutionService` | submitted digest / raw execution response |
| 11 | Finality + visibility | `SuiFinalityService` | indexed transaction + effects/events |
| 12 | Reconciliation | `SuiTxState` | released or refreshed reservations |

## ManagedRuntime edge clients

ManagedRuntime clients are package/application edges, not service internals. They own cached `Context`, runtime-scoped fibers, and disposal.

| Client | Runtime services | Public edge |
|---|---|---|
| `SuiFlowClient` | `SuiClientService`, `SuiPTB` services, gas/payment/auth, preflight/execution/finality, `SuiTxRunner` | `run`, `runExit`, `runFork`, `runCallback`, `dispose` |
| `SuiQueryClient` | `SuiClientService`, `SuiObjectResolver`, `SuiBcsBridge` | `resolve`, `refresh`, `decode`, `encodePure`, `serialize`, `run`, `runExit`, `dispose` |
| `FakeSuiClient` | Full fake service stack | shared `flow`, shared `query`, generic `run`, `runExit`, `dispose` |
| `EffectSuiAdapterClient` | Shared `SuiFlowClient` + `SuiQueryClient` per Mysten client | `$extend` registration, `runTx`, `runTxExit`, `resolveObject`, idempotent `dispose` |

## Services

### `SuiObjectResolver`

| Field | Spec |
|---|---|
| Responsibility | Resolve object IDs/capabilities into current refs, ownership, and optional decoded snapshots. |
| Consumes | `SuiObjectId`, `SuiObject`, expected type tag, ownership requirement, freshness policy. |
| Produces | `SuiObjectRef`, `SharedObjectRef`, receiving refs, `SuiObjectSnapshot<A>`. |
| Dependencies | `SuiClientService`, `SuiBcsBridge`, `SuiSchemaRegistry`, optional indexer/GraphQL service. |
| Invariants | Returned refs are canonical; shared object mutability is explicit; stale refs are not silently reused. |
| Failures | `SuiObjectLoadError`, `SuiTransportError`, `SuiSchemaDecodeError`, future `SuiObjectStale`. |
| STM / concurrency | Reads can parallelize; reservation of mutable/owned refs happens in `SuiReservationService`. |
| Observability | Span per object batch with counts for found/missing/stale/shared/owned. |
| Tests | Fake-client object lookup tests, property tests for ref normalization, localnet object smoke. |

### `SuiBcsBridge`

| Field | Spec |
|---|---|
| Responsibility | Bridge Mysten/codegen BCS parsers and serializers to Effect Schema and typed errors. |
| Consumes | `Uint8Array`, generated codec, Mysten `BcsType`, Schema, pure value encode request. |
| Produces | decoded domain value, pure input bytes, serialized bytes, classified parse/decode failures. |
| Dependencies | `@mysten/bcs`, `@mysten/sui/bcs`, generated package codecs, `effect-v4/Schema`. |
| Invariants | No bespoke binary layout; encode/decode roundtrips are delegated to Mysten/codegen. |
| Failures | future `SuiBcsParseError`, `SuiSchemaDecodeError`, future `SuiPureEncodeError`. |
| STM / concurrency | Pure CPU; safe to parallelize. |
| Observability | Span with codec name, byte length, schema name, decode/encode direction. |
| Tests | Property tests for byte codecs; generated fixture parse tests; malformed byte failure tests. |

### `SuiPtbAnalyzer`

| Field | Spec |
|---|---|
| Responsibility | Analyze a `SuiPTB` command graph before compilation/execution. |
| Consumes | `SuiPTB` AST: inputs, commands, arguments, result references, type tags. |
| Produces | normalized command graph, diagnostics, inferred object/pure dependencies. |
| Dependencies | Schema models, package/type registry, protocol config limits when available. |
| Invariants | Result references point backward only; gas coin restrictions are represented; command order is preserved. |
| Failures | future `SuiPtbInvalid`, `SuiArgumentInvalid`, `SuiProtocolLimitExceeded`. |
| STM / concurrency | Pure analysis; parallelizable by subgraph except final ordered diagnostics. |
| Observability | Span with command count, input count, object count, pure count, diagnostics count. |
| Tests | Property tests over invalid result indices, gas coin misuse, empty command constraints. |

### `SuiPtbCompiler`

| Field | Spec |
|---|---|
| Responsibility | Compile a normalized `SuiPTB` into Mysten `Transaction` commands. |
| Consumes | analyzed `SuiPTB`, resolved object refs, pure bytes, package call targets. |
| Produces | Mysten `Transaction`, transaction kind bytes when requested, compile artifact. |
| Dependencies | `@mysten/sui/transactions`, `SuiObjectResolver`, `SuiBcsBridge`, `SuiPtbAnalyzer`. |
| Invariants | Mutations to a single Mysten `Transaction` occur sequentially; object/gas refs match resolved inputs. |
| Failures | future `SuiPtbCompileError`, `SuiBuildError`, `SuiBcsParseError`. |
| STM / concurrency | Validation/prefetch can parallelize; command insertion into `Transaction` uses concurrency 1. |
| Observability | Span per compile with command count and build mode: online/offline/wallet/sponsor. |
| Tests | No-network compiler tests with fake transaction boundary; localnet compile + dry-run smoke. |

### `SuiGasPlanner`

| Field | Spec |
|---|---|
| Responsibility | Decide gas price, budget, and whether dry-run estimation is required. |
| Consumes | `SuiTx`, payment policy, sender/sponsor, network reference gas price, optional dry-run result. |
| Produces | gas price, gas budget, budget rationale, estimation diagnostics. |
| Dependencies | `SuiClientService`, `SuiPreflightService`, protocol config / reference gas price reads. |
| Invariants | Budget respects network min/max; dry-run-derived budgets are reproducible and explainable. |
| Failures | future `SuiGasPlanningError`, `SuiTransportError`, `SuiDryRunError`. |
| STM / concurrency | Reads can parallelize; does not reserve coins itself. |
| Observability | Span records policy, reference price, estimated computation/storage units, final budget. |
| Tests | Unit tests for policy normalization; fake dry-run budget tests; boundary tests for min/max budget. |

### `SuiPaymentService`

| Field | Spec |
|---|---|
| Responsibility | Select, validate, reserve, and apply gas payment / gas owner data. |
| Consumes | payment policy, sender, gas owner, sponsor policy, excluded object inputs, gas plan. |
| Produces | gas payment refs, gas owner, address-balance mode, sponsored `GasData`, payment reservation. |
| Dependencies | `SuiObjectResolver`, `SuiTxState`, `SuiClientService`, optional gas station adapter. |
| Invariants | Gas payment objects do not overlap PTB inputs; no gas object version is reused concurrently; gas smashing limit is respected. |
| Failures | future `SuiPaymentError`, `SuiGasCoinConflict`, `SuiInsufficientGas`, `SuiSponsorRejected`. |
| STM / concurrency | Reserves selected gas coins in STM; sponsor pools require queue/semaphore discipline. |
| Observability | Span records payment mode, coin count, excluded input count, sponsor/user owner. |
| Tests | Concurrent gas reservation tests, gas coin overlap tests, sponsored fake gas-station tests. |

### `SuiAuthService`

| Field | Spec |
|---|---|
| Responsibility | Normalize signing/authentication flows for keypair, wallet, offline, multisig, and sponsor modes. |
| Consumes | compiled transaction, auth policy, sender, sponsor, wallet adapter, required signatures. |
| Produces | signatures, serialized wallet transaction, offline signing payload, signed transaction data. |
| Dependencies | Mysten keypair/wallet APIs, `SuiBcsBridge` for transaction bytes, `SuiPaymentService` for sponsor data. |
| Invariants | Signatures commit to full transaction data including gas data; wallet mode does not prebuild bytes when wallet must own gas logic. |
| Failures | future `SuiAuthError`, `SuiSignatureError`, `SuiWalletRejected`, `SuiSponsorRejected`. |
| STM / concurrency | No STM except reading reservations; signing can be external/interruptible. |
| Observability | Span records auth mode, signer count, sponsor required, wallet/offline handoff status. |
| Tests | Fake signer tests, sponsor dual-signature tests, offline payload shape tests. |

### `SuiPreflightService`

| Field | Spec |
|---|---|
| Responsibility | Simulate/dry-run transactions before execution when policy requires it. |
| Consumes | Mysten `Transaction` or transaction bytes, preflight policy, include options. |
| Produces | dry-run effects, gas usage, Move abort diagnostics, budget input for gas planner. |
| Dependencies | `SuiClientService`, `SuiGasPlanner`, `SuiDiagnostics`. |
| Invariants | Preflight does not mutate local reservation state except by explicit diagnostic recording. |
| Failures | future `SuiDryRunError`, `SuiMoveAbort`, `SuiTransportError`. |
| STM / concurrency | Network I/O outside STM; may run concurrently if reservations are already distinct. |
| Observability | Span records digest if available, status, gas usage, abort code/module/function. |
| Tests | Fake-client dry-run tests; localnet Move abort smoke when fixtures exist. |

### `SuiExecutionService`

| Field | Spec |
|---|---|
| Responsibility | Submit signed transactions or sign-and-execute requests and return raw execution response. |
| Consumes | signed transaction bytes/signatures or keypair+transaction, execution policy. |
| Produces | transaction digest, raw execution result, immediate effects if included. |
| Dependencies | `SuiClientService`, `SuiAuthService`, `SuiPaymentService`. |
| Invariants | Execution only happens after payment/object reservations; duplicate submissions are tracked. |
| Failures | `SuiExecutionError`, `SuiTransportError`, future `SuiRejectedByValidator`. |
| STM / concurrency | Uses execution queue/semaphore for same-sender or same-object conflict classes. |
| Observability | Span records execution mode, digest, include options, retry schedule. |
| Tests | Fake execute tests; localnet execute smoke; retry classification tests. |

### `SuiFinalityService`

| Field | Spec |
|---|---|
| Responsibility | Wait for transaction finality/indexer visibility and decode effects/events/object changes. |
| Consumes | digest, wait policy, include/decode options, package event schemas. |
| Produces | final transaction view, decoded effects/events, object change summary. |
| Dependencies | `SuiClientService`, GraphQL/indexer service, `SuiBcsBridge`, `SuiSchemaRegistry`. |
| Invariants | Wait policy is explicit; GraphQL visibility is not assumed immediately after execution. |
| Failures | future `SuiWaitError`, `SuiIndexerVisibilityError`, `SuiSchemaDecodeError`. |
| STM / concurrency | Network I/O outside STM; updates local state only during reconciliation. |
| Observability | Span records digest, wait duration, checkpoint, event count, object change count. |
| Tests | Fake wait tests; localnet waitForTransaction smoke; event decode fixture tests. |

### `SuiTxRunner`

| Field | Spec |
|---|---|
| Responsibility | Compose the lifecycle services into `build → gas/payment → auth → preflight → execute → finality`. |
| Consumes | `SuiTx`, `SuiPTB`, gas/payment/auth policies, lifecycle service dependencies. |
| Produces | `SuiTxLifecycleResult` containing artifact, plans, auth, preflight, execution, and finality envelopes. |
| Dependencies | `SuiPtbAnalyzer`, `SuiPtbCompiler`, `SuiGasPlanner`, `SuiPaymentService`, `SuiAuthService`, `SuiPreflightService`, `SuiExecutionService`, `SuiFinalityService`. |
| Invariants | `build-only` stops after auth/build bytes, `dry-run` stops after preflight, `execute` waits for finality. |
| STM / concurrency | Accepts reconcile hooks now; reservation-backed reconcile plugs in during `SuiReservationService` work. |
| Observability | Lifecycle span records transaction label and build mode. |
| Tests | Fake lifecycle test and localnet execute/finality proof. |

### `SuiReservationService` / `SuiTxState`

| Field | Spec |
|---|---|
| Responsibility | Coordinate local reservations for object refs, gas coins, signers, queues, and inflight transactions. |
| Consumes | object refs, gas payment refs, sender/sponsor, tx intent fingerprint. |
| Produces | reservation token, release/reconcile actions, conflict diagnostics. |
| Dependencies | `Effect.tx`, `TxRef`, `TxHashMap`, `TxQueue`, `TxSemaphore`. |
| Invariants | No RPC, signing, or wallet prompts inside STM; reservations are released or reconciled on every exit path. |
| Failures | future `SuiReservationConflict`, `SuiObjectStale`, `SuiGasCoinConflict`. |
| STM / concurrency | Implemented with `TxRef` token sequencing and `TxHashMap` live/completed maps. Owned object and gas refs share `owned:<objectId>` keys so payment and object-use conflict. Sender/sponsor keys serialize dispatch classes. |
| Observability | Span around acquire/release/reconcile with intent and token ID. |
| Tests | Unit and property tests cover conflict rejection, release/reacquire, reconcile cleanup, non-overlap concurrency, and arbitrary object/sender cases. |

### `SuiPackageRegistry`

| Field | Spec |
|---|---|
| Responsibility | Register package/module descriptors, type tags, generated calls, object factories, and codecs. |
| Consumes | Schema-backed `SuiPackageDescriptor`, generated codegen metadata, Move manifest/build output, onchain package ID. |
| Produces | `SuiPackage`, `SuiModule`, typed object factories, PTB/tx builders, BCS codecs. |
| Dependencies | `SuiBcsBridge`, `SuiObjectResolver`, codegen artifacts, optional package query service. |
| Invariants | Package IDs are canonical; module names exist; generated codecs match type tags. |
| Failures | future `SuiPackageError`, `SuiModuleNotFound`, `SuiTypeNotRegistered`. |
| STM / concurrency | Runtime-owned `TxHashMap` registry; writes are atomic at package registration boundary. |
| Observability | Span records package ID and module count for register/get. |
| Tests | Registry unit tests; generated counter fixture registration; package/module lookup tests; localnet Move build proof for counter fixture. |

### `SuiDiagnostics`

| Field | Spec |
|---|---|
| Responsibility | Classify causes, produce human/debug messages, and record spans/structured events. |
| Consumes | tagged errors, Effect causes, raw SDK errors, dry-run/execution responses. |
| Produces | classified diagnostics, retry hints, logs, metrics, debug artifacts. |
| Dependencies | Effect `Cause`, `Schedule`, tracing/logging integration. |
| Invariants | Diagnostics never alter execution semantics; they annotate and classify. |
| Failures | None under normal operation; diagnostics should degrade gracefully. |
| STM / concurrency | Pure / side-effect logging only; no reservation authority. |
| Observability | Owns normalized span names and attributes for the ecosystem. |
| Tests | Cause classification table tests; golden diagnostic snapshots. |

## Policy shapes to normalize

### `PaymentPolicy`

```ts
type PaymentPolicy =
  | { readonly _tag: 'AutoPayment' }
  | { readonly _tag: 'ExplicitPayment'; readonly coins: ReadonlyArray<SuiObjectRef>; readonly budget?: bigint; readonly price?: bigint }
  | { readonly _tag: 'AddressBalancePayment'; readonly expiration: ValidDuringEpochRange }
  | { readonly _tag: 'SponsoredPayment'; readonly sponsor: SuiAddress; readonly gasStation: GasStationRef }
  | { readonly _tag: 'WalletPayment'; readonly walletOwnsGasLogic: true }
```

### `AuthPolicy`

```ts
type AuthPolicy =
  | { readonly _tag: 'KeypairAuth'; readonly signer: SuiSigner }
  | { readonly _tag: 'WalletAuth'; readonly wallet: WalletAdapter }
  | { readonly _tag: 'OfflineAuth'; readonly output: 'unsigned-bytes' | 'intent-message' }
  | { readonly _tag: 'SponsoredAuth'; readonly user: SuiSignerRef; readonly sponsor: SponsorSignerRef }
  | { readonly _tag: 'MultisigAuth'; readonly participants: ReadonlyArray<SuiSignerRef>; readonly threshold: number }
```

### `BuildMode`

```ts
type BuildMode =
  | { readonly _tag: 'OnlineBuild' }
  | { readonly _tag: 'OfflineBuild'; readonly requireFullyResolvedInputs: true }
  | { readonly _tag: 'WalletSerialize'; readonly useTransactionSerialize: true }
  | { readonly _tag: 'SponsoredKind'; readonly onlyTransactionKind: true }
```

These are design sketches. Implementation must express them with Effect Schema, not raw TypeScript unions.

# Effect-Sui ManagedRuntime Strategy

ManagedRuntime is the package edge for long-lived Effect-Sui service stacks. Services still return `Effect`; runtimes cache the built `Context`, own a `Scope`, expose `runPromise` / `runPromiseExit` / `runSync` / `runFork`, and must be disposed.

Grounded sources:

- Local source: `../../submodules/effect-smol/packages/effect/src/ManagedRuntime.ts`.
- DeepWiki Q&A against `Effect-TS/effect-smol` on ManagedRuntime semantics and Effect-Sui design critique.

## Source facts

`ManagedRuntime.make(layer)`:

- builds the Layer once and caches the resulting Context after first use;
- stores the built Context in `cachedContext`; later `run*` calls take a fast path through `Effect.run*With(cachedContext)`;
- reuses a `Layer.MemoMap`, either supplied by caller or created with `Layer.makeMemoMapUnsafe()`;
- owns a root `Scope.Closeable` plus a forked layer scope; runtime disposal closes the root scope and therefore layer finalizers;
- merges run options with its own `onFiberStart`, so fibers started by the runtime are registered with the runtime scope;
- provides `runPromise`, `runPromiseExit`, `runSync`, `runSyncExit`, `runFork`, and `runCallback`;
- accepts `AbortSignal` through async run options; abort interrupts the fiber and the listener is removed on fiber completion;
- after `dispose()` / `disposeEffect`, `contextEffect` is replaced with a die effect and `cachedContext` is cleared.

Implication: use ManagedRuntime for repeated operations over the same Sui client / fake stack / localnet stack. Do not create one per tiny call unless the caller is already at a one-shot boundary.

## Run method semantics we should expose intentionally

| Method | Effect-Sui use |
|---|---|
| `runPromise` | default Promise facade for app/adapter users running query or tx lifecycle programs. |
| `runPromiseExit` | CLI, tests, adapters, and wallets that need typed failure/Cause inspection without Promise rejection control flow. |
| `runSync` | only sync-only PTB build paths; never for query, auth, preflight, execution, finality. |
| `runSyncExit` | sync PTB diagnostics; captures sync failure shape without throwing. |
| `runFork` | long-running watchers, subscriptions, polling/finality monitors, background reconcile loops; runtime disposal interrupts fibers. |
| `runCallback` | callback-style extension/SDK interop; returned interruptor becomes the cancellation handle. |

## DeepWiki correction to initial instinct

ManagedRuntime is not a thing to stuff inside every service. It is the **edge object** for non-Effect consumers and long-lived service stacks. Internal service implementations should remain pure `Effect` so they compose under any parent runtime.

## Existing precedent

### `SuiPTB`

Current APIs:

- `SuiPTB.makeRuntime(layer = SuiPtbLive)`
- `SuiPTB.makeBuilder(runtime = makeRuntime())`
- builder methods: `build`, `buildSync`, `buildExit`, `dispose`

This is the correct precedent: PTB analysis/compiler services are cached and reused over many PTBs.

## New runtime seams to add

### 1. `SuiQueryRuntime` / `SuiQueryClient`

Target module: `src/query/index.ts`

Layer:

```ts
SuiClientService.layer(client).pipe(Layer.provideMerge(SuiQueryLive))
```

Public shape:

```ts
export type SuiQueryRuntime = ManagedRuntime.ManagedRuntime<
  SuiClientService | SuiBcsBridge | SuiObjectResolver,
  never
>;

export const makeRuntime = (clientOrLayer) => ManagedRuntime.make(layer);
export const makeClient = (runtime = makeRuntime(client)) => ({
  runtime,
  resolve: (request, options?) => runtime.runPromise(SuiObjectResolver.use(_ => _.resolve(request)), options),
  refresh: (object, options?) => runtime.runPromise(SuiObjectResolver.use(_ => _.refresh(object)), options),
  decode: (request, options?) => runtime.runPromise(SuiBcsBridge.use(_ => _.decode(request)), options),
  dispose: () => runtime.dispose(),
});
```

Why:

- object reads and BCS operations are repeated;
- clients are expensive/environmentful;
- tests and adapter code currently manually `Effect.runPromise(...provide...)`.

### 2. `SuiFlowRuntime` / `SuiTxClient`

Target module: `src/flow/index.ts`

Layer:

```ts
Layer.mergeAll(
  SuiPtbLive,
  SuiClientService.layer(client),
  SuiTxLifecycleLive,
)
```

Public shape:

```ts
export type SuiFlowRuntime = ManagedRuntime.ManagedRuntime<
  SuiPtbAnalyzer | SuiPtbCompiler |
  SuiGasPlanner | SuiPaymentService | SuiAuthService |
  SuiPreflightService | SuiExecutionService | SuiFinalityService |
  SuiTxRunner,
  never
>;

export const makeRuntime = (clientOrLayer, options?) => ManagedRuntime.make(layer);
export const makeClient = (runtime = makeRuntime(client)) => ({
  runtime,
  run: (tx, options?) => runtime.runPromise(runTx(tx), options),
  runExit: (tx, options?) => runtime.runPromiseExit(runTx(tx), options),
  dispose: () => runtime.dispose(),
});
```

Why:

- this is the main lifecycle edge;
- repeated transaction execution should not rebuild gas/auth/preflight/execution/finality layers;
- `runExit` gives typed lifecycle failure capture for CLI/adapter surfaces;
- reconcile hooks can be installed once when the runtime is constructed.

### 3. `FakeSuiRuntime`

Target module: `src/testing/index.ts`

Current state:

- `FakeSuiRuntimeLayer(overrides)` returns a Layer.

Add:

```ts
export type FakeSuiRuntime = ManagedRuntime.ManagedRuntime<AllFakeServices, never>;
export const makeFakeRuntime = (overrides?) => ManagedRuntime.make(FakeSuiRuntimeLayer(overrides));
export const makeFakeClient = (runtime = makeFakeRuntime()) => ({
  runtime,
  runPromise: runtime.runPromise,
  runSync: runtime.runSync,
  runPromiseExit: runtime.runPromiseExit,
  dispose: runtime.dispose,
});
```

Why:

- test code currently repeats `Effect.provide(FakeSuiRuntimeLayer())`;
- fake contract tests should mirror app-edge runtime usage;
- makes lifecycle tests cleaner and closer to adapter behavior.

### 4. Adapter runtime cache

Target module: `src/adapter/index.ts`

Use a ManagedRuntime per extended Mysten client instance:

```ts
const runtime = SuiFlow.makeRuntime(client);
return {
  runTx: (tx, options) => runtime.runPromise(SuiFlow.runTx(tx), options),
  dispose: () => runtime.dispose(),
};
```

Why:

- `$extend` is an app edge;
- the extended client should own one Effect-Sui runtime stack;
- disposal belongs to adapter/client lifecycle, not individual transaction calls.

### 5. Localnet harness runtime

Target module: `test/e2e/**`

Use `SuiFlow.makeClient(client)` and `SuiQuery.makeClient(client)` in e2e tests instead of manually assembling services per assertion.

Why:

- the tests should exercise the intended public edge;
- localnet suites run multiple calls against one client;
- enables future fixture-level setup/teardown via runtime disposal.

### 6. Reservation runtime later

Target feature: `#F1065 STM reservation engine`

When `SuiReservationService` becomes stateful, the runtime becomes mandatory:

- STM refs/maps/queues live inside the Layer;
- reservations must survive across multiple transaction runs;
- disposal must release/close runtime-owned state.

This should plug into `SuiFlow.makeRuntime(client, { reservations: ... })`, not a separate ad-hoc global.

Reservation lifetime contract:

1. `SuiReservationService` state is allocated by the Flow runtime layer, not by individual transactions.
2. `SuiTxRunner` acquires before gas/payment/execution conflict-sensitive phases and releases/reconciles in `Effect.ensuring` / `Effect.onExit` style finalizers.
3. No RPC, signing, wallet prompt, or external callback runs inside STM; STM only reserves local identities and queue permits.
4. Runtime `dispose()` closes the layer scope; any reservation fibers/queues must finalize there.
5. Fake runtime may use an in-memory reservation service, but localnet remains the concurrency proof surface.

## Naming convention

Avoid duplicate `makeRuntime` names in root imports by keeping namespace imports:

```ts
import * as SuiPTB from '@tmnl/effect-sui/ptb';
import * as SuiQuery from '@tmnl/effect-sui/query';
import * as SuiFlow from '@tmnl/effect-sui/flow';

const ptbBuilder = SuiPTB.makeBuilder();
const query = SuiQuery.makeClient(client);
const flow = SuiFlow.makeClient(client);
```

Each namespace may expose:

- `makeRuntime(...)`
- `makeClient(...)` or domain-specific builder (`makeBuilder` for PTB)
- `run*` Effect constructors for callers that already have a runtime/layer

## Priority order

1. Add `SuiFlow.makeRuntime` / `SuiFlow.makeClient` around the lifecycle runner.
2. Convert new localnet SuiTx lifecycle proof to use `SuiFlow.makeClient`.
3. Add `SuiQuery.makeRuntime` / `SuiQuery.makeClient` and migrate object resolver e2e.
4. Add `SuiTesting.makeFakeRuntime` and migrate fake tests.
5. Use these runtime constructors in adapter work.
6. Extend `SuiFlow.makeRuntime` with stateful reservation layers when `#F1065` lands.

## Anti-patterns

- Do not hide ManagedRuntime inside service methods; services should stay compositional Effects.
- Do not create a runtime per Sui transaction in app code; create one per client/session and dispose it.
- Do not create a runtime inside an already-Effect application just to run another Effect; provide/compose layers instead.
- Do not use `runSync` for anything that may cross async boundaries (`tryPromise`, SDK calls, auth, network reads, finality waits).
- Do not forget disposal; whoever creates the runtime owns `dispose()`.
- Do not overuse fresh/non-memoized layers unless we explicitly need isolated state.
- Do not replace pure constructors with runtime constructors.
- Do not expose only Promise APIs; keep Effect constructors and runtime Promise facades side by side.

## Novel / future cases for Effect-Sui

- **Finality watcher fibers**: `SuiFlowClient.watchFinality(...)` can use `runtime.runFork`; disposing the client interrupts the watcher.
- **Callback-style wallet/adapter bridge**: `$extend` or wallet integration can expose `runCallback` and return the interruption function as an unsubscribe/cancel handle.
- **Shared localnet fixture scope**: one localnet runtime per test file/fixture can own fake or live clients and avoid rebuilding layers for each assertion.
- **Shared memo map across sibling runtimes**: advanced callers may pass a memo map when `SuiQuery` and `SuiFlow` should share expensive common layers while retaining separate facade clients.
- **STM reservation persistence**: once `SuiReservationService` owns TxRefs/TxHashMaps/TxQueues, runtime lifetime becomes reservation lifetime; per-transaction runtimes would destroy the whole point.
- **Exit-first CLI mode**: CLIs should prefer `runPromiseExit` so typed failures and defects can be rendered without generic Promise rejection formatting.

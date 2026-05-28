# @tmnl/effect-sui

Effect-smol-first executable Sui SDK layer.

This package will wrap Mysten's Sui TypeScript SDK with:

- `Schema.Class` / `Schema.TaggedClass` durable domain nouns and typed errors.
- Public `Effectable.Class` capabilities centered on Sui's object / PTB / transaction / package ontology:
  - `SuiObject` — onchain state + object capability around refs, ownership, content, refresh, transfer, and mutation.
  - `SuiPTB` — full programmable transaction block build program over inputs, commands, and result references.
  - `SuiTx` — payable/authenticated transaction lifecycle around simulation, signing/execution, effects, events, and object changes.
  - `SuiPackage` / `SuiModule` — immutable package/module surface that manufactures typed objects, PTBs, and transactions.
- Supporting execution algebras: `SuiQuery` and `SuiFlow`.
- `Effect.tx` / `Tx*` STM state for object refs, gas/coin reservations, queues, and signer/session state.
- Transport-safe gRPC / GraphQL / Core client integration.
- A Mysten `$extend` adapter after the Effect-first core is real.

## Current status

Effect-Sui now has a realized Effect-smol-first core: Schema-backed nouns/errors/diagnostics, Effectable objects/PTBs/transactions/packages, service-scoped Query and Flow runtimes, STM reservations with optional persistence hooks, Move package publishing, finality watcher fibers, wallet callback auth, adapter run handles, and package-local localnet proof gates. The public API is namespace-first and the release gate is `bun run quality:localnet`.

## Ontology

The public Effectable model is documented in [`docs/ONTOLOGY.md`](./docs/ONTOLOGY.md):

```text
SuiObject  — onchain state + object capability
SuiPTB     — full programmable transaction block build program
SuiTx      — payable/authenticated transaction lifecycle
SuiPackage — immutable package/module factory surface
```

`SuiQuery` and `SuiFlow` remain supporting execution algebras. Design decisions are tracked in [`docs/DESIGN_DECISIONS.md`](./docs/DESIGN_DECISIONS.md), and the service ecosystem behind the Effectable facades is specified in [`docs/SERVICE_ECOSYSTEM.md`](./docs/SERVICE_ECOSYSTEM.md).

## API shape

Effect-Sui follows Effect's namespace API style: import a module namespace and call short verbs on it.

```ts
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as SuiPTB from '@tmnl/effect-sui/ptb';
import * as SuiFlow from '@tmnl/effect-sui/flow';
import * as SuiQuery from '@tmnl/effect-sui/query';
import * as SuiAdapter from '@tmnl/effect-sui/adapter';
import * as SuiPackage from '@tmnl/effect-sui/package';
import * as SuiDiagnostics from '@tmnl/effect-sui/diagnostics';
import * as SuiReservation from '@tmnl/effect-sui/reservation';

const ptb = SuiPTB.make(ast);
const builder = SuiPTB.makeBuilder();
const artifact = builder.buildSync(ptb);

const gas = SuiFlow.makeGasPlanner(client);
const auth = SuiFlow.makeAuthService(client);

// Long-lived runtime edge for repeated transaction lifecycle runs.
const flow = SuiFlow.makeClient(client);
const result = await flow.run(tx);
await flow.dispose();

const query = SuiQuery.makeClient(client);
const resolved = await query.resolve({ id, decodeContent: true });
await query.dispose();

const extended = client.$extend(SuiAdapter.effectSui());
await extended.effectSui.resolveObject(id);
await extended.effectSui.dispose();

const counter = SuiPackage.counterFixtureDescriptor(packageId);
const pkg = SuiPackage.make(counter);
const module = await Effect.runPromise(SuiPackage.module(pkg, 'counter'));
```

No long compatibility aliases are kept; the namespace is the public API surface. Services remain Effect-returning; ManagedRuntime-backed clients live at package/application edges. Tests can use `SuiTesting.makeFakeClient()` or `SuiTesting.makeFakeFixtureScope()` for disposable fake runtimes with shared Flow and Query facades.

## Release-ready examples

### Wait for finality without owning the whole runtime

```ts
const flow = SuiFlow.makeClient(client);
const watcher = flow.watchFinality({ digest, include: { effects: true, objectTypes: true } });

const finalized = await watcher.join();
await watcher.dispose();
await flow.dispose();
```

### Publish compiled Move bytecode and register the package descriptor

```ts
const request = SuiPackage.publishRequestFromCompiled({
  name: 'counter',
  sender,
  modules: compiled.counter.modules,
  dependencies: compiled.counter.dependencies,
  moduleNames: ['counter'],
});

const published = await Effect.runPromise(
  SuiPackage.publishMovePackage({ request, authPolicy }).pipe(
    Effect.provide(Layer.mergeAll(SuiFlow.makeLayer(client), SuiPackage.makeRegistryLayer())),
  ),
);
```

### Wallet callback auth at an adapter edge

```ts
const adapter = SuiAdapter.makeClient(client);
const handle = adapter.runWalletTx(tx, {
  sender,
  chain: 'sui:localnet',
  account,
  signTransaction: ({ transaction, signal }) => wallet.signTransaction({ transaction, account, chain, signal }),
});

const lifecycle = await handle.promise;
handle.dispose();
await adapter.dispose();
```

### Reservation persistence is explicit and side-effect-free inside STM

```ts
const service = await Effect.runPromise(
  SuiReservation.makePersistentReservationService({
    persistence: {
      load: () => Effect.succeed(savedSnapshot),
      save: (next) => Effect.sync(() => { savedSnapshot = next; }),
    },
  }),
);
```

### Diagnostics classify; they do not change execution semantics

```ts
const diagnostic = await Effect.runPromise(SuiDiagnostics.classifyUnknown(error));
console.info(diagnostic.category, diagnostic.retryHint);
```

## Grounding

Before implementation, consult:

- `../../submodules/effect-smol/packages/effect/src/Effectable.ts`
- `../../submodules/effect-smol/packages/effect/src/Effect.ts`
- `../../submodules/effect-smol/packages/effect/src/Schema.ts`
- `../../submodules/effect-smol/packages/effect/src/TxHashMap.ts`
- `../../submodules/ts-sdks/packages/sui/src/client/core.ts`
- `../../submodules/ts-sdks/packages/sui/src/transactions/Transaction.ts`
- `../../submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts`
- `../../submodules/sui/docs/content/develop/transactions/txn-overview.mdx`
- `../../submodules/sui/docs/content/develop/transactions/ptbs/prog-txn-blocks.mdx`
- `../../submodules/sui/docs/content/develop/sui-architecture/object-model.mdx`
- `../../submodules/sui/docs/content/develop/write-move/package-overview.mdx`
- `../../submodules/sui/docs/content/getting-started/onboarding/local-network.mdx`

## Commands

```bash
bunx nx run @tmnl/effect-sui:typecheck
bunx nx run @tmnl/effect-sui:test
bunx nx run @tmnl/effect-sui:build
bunx nx run @tmnl/effect-sui:quality
```

Testing policy is localnet-first for chain semantics. Fast unit/property/fake tests are contract checks; PTB, object, payment, auth, execution, finality, and package behavior require localnet proof before feature closure. See [`test/README.md`](./test/README.md) and [`docs/QUALITY_GATES.md`](./docs/QUALITY_GATES.md).

## Package-local Sui environment

Enter the package shell from `packages/effect-sui`:

```bash
source_up
use flake
# or: nix develop .#effect-sui
```

Mission-control entrypoint:

```bash
effect-sui info
effect-sui sui-localnet help
effect-sui sui-localnet up-docker
effect-sui sui-localnet status
effect-sui sui-localnet down
effect-sui sui-move help
```

Localnet and Move helpers are intentionally collapsed behind `sui-localnet` and `sui-move` so nxi / Command Center stays readable:

```bash
effect-sui sui-move list
effect-sui sui-move new my_contract
effect-sui sui-move build counter
effect-sui sui-move test counter
effect-sui sui-move bytecode counter > /tmp/counter-bytecode.json
```

E2E harness modes:

```bash
# Fast config/compile smoke; does not start Docker
EFFECT_SUI_E2E_MODE=skip bun run test:e2e

# Default: start Docker localnet (testcontainers when installed, Docker CLI fallback otherwise)
bun run test:e2e

# Reuse an externally managed localnet
EFFECT_SUI_E2E_MODE=external \
  SUI_FULLNODE_URL=http://127.0.0.1:9000 \
  SUI_FAUCET_URL=http://127.0.0.1:9123 \
  SUI_GRAPHQL_URL=http://127.0.0.1:9125/graphql \
  bun run test:e2e
```

The localnet path is intentionally isolated from `~/.sui`:

- Sui config: `.direnv/sui/config`
- Sui data: `.direnv/sui/data`
- Docker localnet: `mysten/sui-tools:${SUI_TOOLS_TAG}` + `postgres:16`

Prime directive: stage explicit paths only. No `git add -A`.

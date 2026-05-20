# @tmnl/effect-sui

Effect-smol-first executable Sui SDK layer.

This package will wrap Mysten's Sui TypeScript SDK with:

- `Schema.Class` / `Schema.TaggedClass` durable domain nouns and typed errors.
- Public `Effectable.Class` capabilities centered on Sui's object/transaction/package ontology:
  - `SuiObject` — onchain state + object capability around refs, ownership, content, refresh, transfer, and mutation.
  - `SuiTx` — transaction capability around PTB planning, simulation, signing/execution, effects, events, and object changes.
  - `SuiPackage` / `SuiModule` — immutable package/module surface that manufactures typed objects and transactions.
- Internal/power-user execution algebras: `SuiPTB`, `SuiQuery`, and `SuiFlow`.
- `Effect.tx` / `Tx*` STM state for object refs, gas/coin reservations, queues, and signer/session state.
- Transport-safe gRPC / GraphQL / Core client integration.
- A Mysten `$extend` adapter after the Effect-first core is real.

## Current status

Workspace scaffold, package-local Sui development infrastructure, localnet e2e harness, and Schema-backed domain/error core are present. The stable module seams are ready for implementation slices behind explicit test and commit gates.

## Ontology

The public Effectable model is documented in [`docs/ONTOLOGY.md`](./docs/ONTOLOGY.md):

```text
SuiObject  — onchain state + object capability
SuiTx      — transaction/state-transition capability
SuiPackage — immutable package/module factory surface
```

`SuiPTB`, `SuiQuery`, and `SuiFlow` remain supporting execution algebras.

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
```

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
effect-sui sui-env-init
effect-sui sui-localnet-up-docker
effect-sui sui-localnet-status
effect-sui sui-localnet-down
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

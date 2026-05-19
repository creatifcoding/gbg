# @tmnl/effect-sui

Effect-smol-first executable Sui SDK layer.

This package will wrap Mysten's Sui TypeScript SDK with:

- `Schema.Class` / `Schema.TaggedClass` durable domain nouns and typed errors.
- `Effectable.Class` executable programs: `SuiPTB`, `SuiQuery`, and `SuiFlow`.
- `Effect.tx` / `Tx*` STM state for object refs, gas/coin reservations, queues, and signer/session state.
- Transport-safe gRPC / GraphQL / Core client integration.
- A Mysten `$extend` adapter after the Effect-first core is real.

## Current status

Workspace scaffold and package-local Sui development infrastructure are present. The stable module seams are ready for implementation slices behind explicit test and commit gates.

## Grounding

Before implementation, consult:

- `../../submodules/effect-smol/packages/effect/src/Effectable.ts`
- `../../submodules/effect-smol/packages/effect/src/Effect.ts`
- `../../submodules/effect-smol/packages/effect/src/Schema.ts`
- `../../submodules/effect-smol/packages/effect/src/TxHashMap.ts`
- `../../submodules/ts-sdks/packages/sui/src/client/core.ts`
- `../../submodules/ts-sdks/packages/sui/src/transactions/Transaction.ts`
- `../../submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts`
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

The localnet path is intentionally isolated from `~/.sui`:

- Sui config: `.direnv/sui/config`
- Sui data: `.direnv/sui/data`
- Docker localnet: `mysten/sui-tools:${SUI_TOOLS_TAG}` + `postgres:16`

Prime directive: stage explicit paths only. No `git add -A`.

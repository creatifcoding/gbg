# @tmnl/effect-sui

Effect-smol-first executable Sui SDK layer.

This package will wrap Mysten's Sui TypeScript SDK with:

- `Schema.Class` / `Schema.TaggedClass` durable domain nouns and typed errors.
- `Effectable.Class` executable programs: `SuiPTB`, `SuiQuery`, and `SuiFlow`.
- `Effect.tx` / `Tx*` STM state for object refs, gas/coin reservations, queues, and signer/session state.
- Transport-safe gRPC / GraphQL / Core client integration.
- A Mysten `$extend` adapter after the Effect-first core is real.

## Current status

Scaffold only. The stable module seams are present so implementation slices can land behind explicit test and commit gates.

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

Prime directive: stage explicit paths only. No `git add -A`.

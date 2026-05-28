---
up: INDEX.md
prereqs: grounding.md, nix-localnet-move.md
provides: quality-gates, localnet-proof, validation-matrix, release-checklist
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Testing and Release Gates

> up: INDEX.md
> prereqs: grounding.md, nix-localnet-move.md
> provides: quality-gates, localnet-proof, validation-matrix, release-checklist
> children: none

## Deep Sui Cross-Refs

- `sui/transaction-lifecycle.md`: finality, checkpoint/indexing lag, idempotent resubmit.
- `sui/programmable-transaction-blocks.md`: PTB command/input/result invariants.
- `sui/gas-auth.md`: gas/payment/sponsorship/reservation hazards.
- `sui/localnet-cli.md`: localnet startup, faucet, GraphQL/indexer, wrapper smokes.

## Fast Gate

From `packages/effect-sui`:

```bash
bun run quality
# or
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality
```

Runs boundary audit, typecheck, unit tests, property tests, e2e skip smoke, and build.

## Localnet Gate

```bash
bun run quality:localnet
# or
NX_DAEMON=false NX_NO_CLOUD=true NX_CLOUD=false bunx nx run @tmnl/effect-sui:quality:localnet
```

Use this before closing changes that alter object semantics, PTB compilation, gas/payment/auth, execution, finality, package publish, registry, reservations, wallet bridge, or localnet harness. Allow a generous timeout.

## E2E Modes

```bash
EFFECT_SUI_E2E_MODE=skip bun run test:e2e
bun run test:e2e
EFFECT_SUI_E2E_MODE=external \
  SUI_FULLNODE_URL=http://127.0.0.1:9000 \
  SUI_FAUCET_URL=http://127.0.0.1:9123 \
  SUI_GRAPHQL_URL=http://127.0.0.1:9125/graphql \
  bun run test:e2e
```

## Change-Type Matrix

| Change | Minimum proof | Final proof |
|---|---|---|
| Schema/type-only | `bun run typecheck && bun run test:run` | `bun run quality` |
| PTB AST/compiler | PTB tests + typecheck | `quality:localnet` if execution shape changed |
| Query resolver/BCS | query tests + fake fixtures | localnet object resolver tests |
| Flow/auth/payment/finality | flow tests | `quality:localnet` |
| Reservation STM | property tests | localnet lifecycle if used by TxRunner |
| Package publish/Move | `sui-move bytecode counter` | package registry localnet test |
| Nix/mission-control | Nix contract check + shell help | relevant command smoke |
| Docs only | scoped read/diff | no localnet unless examples changed |

## Artifact Hygiene

After Move/Docker smoke tests, remove generated fixture build artifacts:

```bash
effect-sui sui-move clean counter
rm -f move/fixtures/counter/Move.lock
```

Never stage `.direnv`, generated `build/`, root `package.json`, or root `bun.lock` unless the task explicitly owns them.

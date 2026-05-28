---
up: INDEX.md
prereqs: grounding.md
provides: effect-sui-nix, localnet-tooling, move-authoring, mission-control-contract
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Nix, Localnet, and Move Tooling

> up: INDEX.md
> prereqs: grounding.md
> provides: effect-sui-nix, localnet-tooling, move-authoring, mission-control-contract
> children: none

## Deep Sui Cross-Refs

- `sui/localnet-cli.md`: localnet flags, CLI config isolation, Docker fallback, wrapper validation.
- `sui/move-packages.md`: Move package/publish bytecode boundary.
- `sui/gas-auth.md`: gas/faucet/payment semantics that localnet tests exercise.

## Package Shell

From `packages/effect-sui`:

```bash
nix develop .#effect-sui
nix develop .#effect-sui --command effect-sui --help
```

Curated public mission-control commands:

```text
effect-sui info
effect-sui sui-localnet
effect-sui sui-move
effect-sui sui-e2e
```

Internals stay behind subcommands so nxi / Command Center does not drown.

## Localnet Toolbox

```bash
effect-sui sui-localnet help
effect-sui sui-localnet env-init
effect-sui sui-localnet up-docker
effect-sui sui-localnet status
effect-sui sui-localnet logs
effect-sui sui-localnet down
effect-sui sui-localnet faucet <0x-address>
```

`up-host` exists for host `sui`; Docker is the default reliable path. Local state is isolated under `.direnv/sui/**`, not `~/.sui`.

## Move Toolbox

```bash
effect-sui sui-move list
effect-sui sui-move new my_contract
effect-sui sui-move build counter
effect-sui sui-move test counter
effect-sui sui-move bytecode counter >/tmp/counter-bytecode.json
effect-sui sui-move clean counter
```

Mechanics:

- Prefer host `sui` when present.
- Otherwise use `mysten/sui-tools:$SUI_TOOLS_TAG`.
- Docker fallback runs as host UID/GID and mounts `$FLAKE_ROOT` at the same absolute path to avoid root-owned build artifacts and path mismatches.
- `SUI_MOVE_BUILD_ENV` defaults to `testnet` because the counter fixture's `Move.toml` pins that environment.
- `bytecode` uses `sui move ... build --dump-bytecode-as-base64` and should produce JSON with `modules` and `dependencies` arrays.

## Nix Module Map

| File | Owns |
|---|---|
| `nix/default.nix` | Module imports. Add new modules here. |
| `nix/modules/core.nix` | Mission-control wrapper, core shell vars/tools. |
| `nix/modules/sui.nix` | Sui SDK, Move, Docker, gRPC/Postgres shell tools. |
| `nix/modules/localnet.nix` | `sui-localnet` toolbox and `sui-e2e`. |
| `nix/modules/move.nix` | `sui-move` toolbox. |
| `nix/modules/tests.nix` | Nix shell and mission-control contract checks. |

Validate Nix edits with:

```bash
system=$(nix eval --raw --impure --expr builtins.currentSystem)
nix build ".#checks.$system.effect-sui-mission-control-contract" --print-build-logs
nix develop .#effect-sui --command effect-sui --help
```

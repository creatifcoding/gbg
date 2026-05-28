---
up: INDEX.md
prereqs: ../grounding.md, transaction-lifecycle.md, move-packages.md
provides: localnet-operations, sui-cli-config, faucet-graphql-indexer, effect-sui-shell-wrappers
children: none
update-strategy: refresh when Sui localnet docs, CLI flags, Docker image behavior, or Effect-Sui Nix modules change
update-status: current
---

# Localnet and CLI Operations

> up: INDEX.md
> prereqs: ../grounding.md, transaction-lifecycle.md, move-packages.md
> provides: localnet-operations, sui-cli-config, faucet-graphql-indexer, effect-sui-shell-wrappers
> children: none

Primary sources:

- `submodules/sui/docs/content/getting-started/onboarding/local-network.mdx`
- `submodules/sui/crates/sui/src/sui_commands.rs`
- `submodules/sui/crates/sui-sdk/src/sui_client_config.rs`
- `submodules/sui/crates/sui-test-validator/README.md`
- `submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts`
- `packages/effect-sui/nix/modules/localnet.nix`
- `packages/effect-sui/nix/modules/move.nix`

## Localnet Shape

Sui CLI starts local networks with `sui start`. Core flags from docs:

```bash
RUST_LOG="off,sui_node=info" sui start --with-faucet --force-regenesis
```

Useful options:

| Option | Meaning |
|---|---|
| `--network.config <CONFIG_DIR>` | Isolated config/db/keystore/genesis directory. |
| `--force-regenesis` | New random genesis; no persisted state. |
| `--with-faucet[=<host:port>]` | Faucet, default `0.0.0.0:9123`. |
| `--with-indexer[=<DATABASE_URL>]` | Start indexer, optionally with explicit Postgres URL. |
| `--with-consistent-store[=<host:port>]` | Required with GraphQL. |
| `--with-graphql[=<host:port>]` | GraphQL server, default `0.0.0.0:9125`; implies indexer/consistent store. |
| `--fullnode-rpc-port <PORT>` | Fullnode RPC, default `9000`. |
| `--epoch-duration-ms <MS>` | Set epoch duration with regenesis/no genesis. |

Effect-Sui isolates local state under `.direnv/sui/**` rather than `~/.sui`, because global Sui config as hidden coupling is how nice test rigs become haunted houses.

## CLI Environment

To connect a Sui CLI to localnet, docs use:

```bash
sui client new-env --alias local --rpc http://127.0.0.1:9000
sui client switch --env local
sui client active-env
sui client active-address
sui client faucet
sui client gas
```

Effect-Sui wrappers instead set explicit config/env vars/flags:

- `SUI_CLIENT_CONFIG`
- `SUI_CLIENT_ENV`
- `.direnv/sui/client.yaml`
- `.direnv/sui/network-config`

This avoids mutating a developer's global Sui profile.

## Curated Effect-Sui Commands

Public surface:

```bash
effect-sui info
effect-sui sui-localnet help
effect-sui sui-move help
effect-sui sui-e2e
```

Localnet toolbox:

```bash
effect-sui sui-localnet env-init
effect-sui sui-localnet up-docker
effect-sui sui-localnet up-host
effect-sui sui-localnet status
effect-sui sui-localnet logs
effect-sui sui-localnet faucet <0x-address>
effect-sui sui-localnet down
```

Move toolbox:

```bash
effect-sui sui-move list
effect-sui sui-move new my_contract
effect-sui sui-move build counter
effect-sui sui-move test counter
effect-sui sui-move bytecode counter
effect-sui sui-move clean counter
effect-sui sui-move codegen counter
```

## Docker Fallback

When host `sui` is unavailable, use `mysten/sui-tools:$SUI_TOOLS_TAG`.

Rules proven during wrapper hardening:

- run container as host UID/GID to avoid root-owned artifacts;
- mount `$FLAKE_ROOT` at the same absolute path in Docker to preserve paths in `Move.toml` / CLI output;
- set Docker `HOME` under `.direnv/sui/docker-home`;
- keep build artifacts out of commits.

## Move CLI Flag Order

Observed command shape for bytecode compilation:

```bash
sui move \
  --client.config "$SUI_CLIENT_CONFIG" \
  --client.env "$SUI_CLIENT_ENV" \
  --build-env "$SUI_MOVE_BUILD_ENV" \
  --path "$pkg" \
  build --dump-bytecode-as-base64
```

Global `sui move` options precede the subcommand. `--dump-bytecode-as-base64` belongs to the `build` subcommand. Yes, the ordering matters. The CLI parser is not here to indulge our vibes.

## Validation Commands

From `packages/effect-sui`:

```bash
system=$(nix eval --raw --impure --expr builtins.currentSystem)
nix build ".#checks.$system.effect-sui-mission-control-contract" --print-build-logs
nix develop .#effect-sui --command effect-sui --help
nix develop .#effect-sui --command effect-sui sui-localnet status
nix develop .#effect-sui --command effect-sui sui-move bytecode counter >/tmp/counter-bytecode.json
```

## Localnet Confidence Rule

Unit tests prove wrapper contracts. Localnet proves Sui contracts. If a change touches object refs, gas/payment/auth, PTB compilation, publish, finality, or reservations, run the localnet gate before calling it done.

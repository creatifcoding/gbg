---
up: INDEX.md
prereqs: grounding.md
provides: sui-primary-sources, mysten-sdk-map, cli-research, move-package-research, deep-sui-dossier-router
children: sui/INDEX.md
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Sui and Mysten SDK Research Map

> up: INDEX.md
> prereqs: grounding.md
> provides: sui-primary-sources, mysten-sdk-map, cli-research, move-package-research, deep-sui-dossier-router
> children: sui/INDEX.md

This file is the source map. For digested operational guidance, continue into `sui/INDEX.md` and its nested dossiers.

## Nested Dossier

| Dossier | Use it for |
|---|---|
| `sui/object-model.md` | Object IDs, refs, versions, digests, owners, active-vs-inert object boundary. |
| `sui/transaction-lifecycle.md` | Submission, consensus, certified effects, checkpoints, idempotent resubmit, watcher semantics. |
| `sui/programmable-transaction-blocks.md` | PTB commands, inputs/results, gas coin, publish/upgrade, analyzer/compiler rules. |
| `sui/gas-auth.md` | Gas budgets, smashing, sponsorship, signatures, same-sender concurrency. |
| `sui/move-packages.md` | Package/module/object model, `UpgradeCap`, bytecode compilation, publish boundary. |
| `sui/mysten-ts-sdk.md` | Core API, object includes, transaction methods, builder, wallet serialization, BCS/codegen. |
| `sui/localnet-cli.md` | `sui start`, faucet, GraphQL/indexer, config isolation, Docker fallback, wrapper smokes. |

## Local Primary Sources

| Topic | Source |
|---|---|
| Object model | `submodules/sui/docs/content/develop/sui-architecture/object-model.mdx` |
| Transaction overview | `submodules/sui/docs/content/develop/transactions/txn-overview.mdx` |
| Transaction lifecycle/finality | `submodules/sui/docs/content/develop/transactions/transaction-lifecycle.mdx` |
| PTB rules | `submodules/sui/docs/content/develop/transactions/ptbs/prog-txn-blocks.mdx` |
| PTB inputs/results | `submodules/sui/docs/content/develop/transactions/ptbs/inputs-and-results.mdx` |
| PTB builder docs | `submodules/sui/docs/content/develop/transactions/ptbs/building-ptb.mdx` |
| PTB command reference | `submodules/sui/docs/content/references/ptb-commands.mdx` |
| Gas fees | `submodules/sui/docs/content/develop/transaction-payment/gas-in-sui.mdx` |
| Gas smashing | `submodules/sui/docs/content/develop/transaction-payment/gas-smashing.mdx` |
| Sponsored transactions | `submodules/sui/docs/content/develop/transaction-payment/sponsor-txn.mdx` |
| Transaction auth | `submodules/sui/docs/content/develop/transactions/transaction-auth/auth-overview.mdx` |
| Move packages | `submodules/sui/docs/content/develop/write-move/package-overview.mdx` |
| Local network | `submodules/sui/docs/content/getting-started/onboarding/local-network.mdx` |
| CLI command parser | `submodules/sui/crates/sui/src/sui_commands.rs` |
| Sui client config | `submodules/sui/crates/sui-sdk/src/sui_client_config.rs` |
| TS client core docs | `submodules/ts-sdks/packages/docs/content/sui/clients/core.mdx` |
| TS gas builder docs | `submodules/ts-sdks/packages/docs/content/sui/transaction-building/gas.mdx` |
| TS client core source | `submodules/ts-sdks/packages/sui/src/client/core.ts` |
| TS client extension | `submodules/ts-sdks/packages/sui/src/client/client.ts`, `types.ts` |
| TS transaction builder | `submodules/ts-sdks/packages/sui/src/transactions/Transaction.ts` |
| TS transaction commands | `submodules/ts-sdks/packages/sui/src/transactions/Commands.ts` |
| TS transaction inputs | `submodules/ts-sdks/packages/sui/src/transactions/Inputs.ts` |
| TS object cache/plugins | `submodules/ts-sdks/packages/sui/src/transactions/ObjectCache.ts` |
| TS e2e localnet | `submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts` |
| TS prepublish fixture | `submodules/ts-sdks/packages/sui/test/e2e/utils/prePublish.ts` |

## Useful Source Searches

From repo root:

```bash
rg -n "dump-bytecode-as-base64|build-env|client.config|network.config" submodules/sui/crates/sui -g '*.rs'
rg -n "publish|UpgradeCap|PackageWrite|move build" submodules/ts-sdks/packages/sui -g '*.ts'
rg -n "Transaction\.publish|\.publish\(" submodules/ts-sdks/packages/sui/src submodules/ts-sdks/packages/sui/test -g '*.ts'
rg -n "SharedObjectRef|ObjectArg|CallArg|NestedResult|GasCoin" submodules/ts-sdks/packages/sui/src/transactions -g '*.ts'
rg -n "waitForTransaction|executeTransaction|simulateTransaction|getObject" submodules/ts-sdks/packages/sui/src submodules/ts-sdks/packages/docs/content/sui -g '*.{ts,mdx}'
```

## CLI Reality Checks

When CLI behavior matters, ask the actual image or host binary:

```bash
docker run --rm mysten/sui-tools:$SUI_TOOLS_TAG sui move --help
docker run --rm mysten/sui-tools:$SUI_TOOLS_TAG sui move build --help
docker run --rm mysten/sui-tools:$SUI_TOOLS_TAG sui start --help
```

Observed important shape: global `sui move` options like `--client.config`, `--client.env`, `--build-env`, and `--path` precede the subcommand; `build --dump-bytecode-as-base64` is a build subcommand flag.

## Research Rule

Prefer local sources over agent summaries. Use DeepWiki/web only after local source and docs are inconclusive, and cite what changed your next action.

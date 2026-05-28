---
up: ../sui-research.md
prereqs: ../grounding.md
provides: nested-sui-dossier, sui-source-router, mysten-sdk-operational-map
children: object-model.md, transaction-lifecycle.md, programmable-transaction-blocks.md, gas-auth.md, move-packages.md, mysten-ts-sdk.md, localnet-cli.md
update-strategy: refresh when Sui docs, Mysten TypeScript SDK, localnet CLI, or Effect-Sui transaction semantics change
update-status: current
---

# Sui Deep Dossier

> up: ../sui-research.md
> prereqs: ../grounding.md
> provides: nested-sui-dossier, sui-source-router, mysten-sdk-operational-map
> children: object-model.md, transaction-lifecycle.md, programmable-transaction-blocks.md, gas-auth.md, move-packages.md, mysten-ts-sdk.md, localnet-cli.md

This is the second-level Sui reference layer. Use it when the flat skill references feel too breezy for the local dragon you are currently poking, Prime.

## Reading Routes

| Concern | Read | Grounding source |
|---|---|---|
| Object identity, ownership, refs, shared/owned distinction | `object-model.md` | `submodules/sui/docs/content/develop/sui-architecture/object-model.mdx` |
| Submission, consensus, effects, checkpoint finality, idempotence | `transaction-lifecycle.md` | `submodules/sui/docs/content/develop/transactions/transaction-lifecycle.mdx` |
| PTB commands, inputs, results, gas coin, publish/upgrade rules | `programmable-transaction-blocks.md` | `submodules/sui/docs/content/develop/transactions/ptbs/*.mdx`, `references/ptb-commands.mdx` |
| Gas budgets, coin smashing, sponsorship, signatures | `gas-auth.md` | `develop/transaction-payment/*.mdx`, `transaction-auth/auth-overview.mdx` |
| Move packages, module/object model, bytecode publish boundary | `move-packages.md` | `develop/write-move/package-overview.mdx`, PTB publish rules |
| Mysten TS SDK Core API, transaction builder, BCS/codegen boundary | `mysten-ts-sdk.md` | `submodules/ts-sdks/packages/docs/content/sui/**`, `packages/sui/src/**` |
| Localnet, faucet, GraphQL/indexer, CLI config and shell wrappers | `localnet-cli.md` | `getting-started/onboarding/local-network.mdx`, `crates/sui/src/sui_commands.rs` |

## Operational Rule

When changing `@tmnl/effect-sui`, map the change to one of these Sui surfaces before editing. The SDK wrapper is only elegant if it preserves Sui's actual invariants rather than our favorite wish-shaped abstraction. Rude, but accurate.

---
up: INDEX.md
prereqs: none
provides: source-precedence, path-anchors, no-vibes-research
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Grounding Protocol

> up: INDEX.md
> prereqs: none
> provides: source-precedence, path-anchors, no-vibes-research
> children: none

## Path Anchors

From current default cwd `packages/tmnl`:

```bash
EFFECT_SUI=../../packages/effect-sui
REPO=../..
SUI_SRC=../../submodules/sui
TS_SDK=../../submodules/ts-sdks
EFFECT_SMOL=../../submodules/effect-smol
```

From repo root, drop the leading `../../`.

## Read Order

1. Package docs: `packages/effect-sui/README.md`, then relevant `docs/*.md`.
2. Package source: matching `src/<area>/**` and tests.
3. Local upstream sources:
   - `submodules/effect-smol/packages/effect/src/*`
   - `submodules/ts-sdks/packages/sui/src/*`
   - `submodules/sui/docs/content/**` and `submodules/sui/crates/**`
4. Only then use web/deepwiki/context docs if local sources do not answer it.

## Mandatory Sources by Concern

| Concern | Read first |
|---|---|
| Effectable/yield | `effect-smol/.../Effectable.ts`, `docs/ONTOLOGY.md` |
| Schema/errors | `effect-smol/.../Schema.ts`, `src/schema/**` |
| Services/layers | `effect-smol/.../Context.ts`, `Layer.ts`, `src/services/**` |
| STM reservations | `TxRef.ts`, `TxHashMap.ts`, `src/reservation/**` |
| PTB | `ts-sdks/.../transactions/Transaction.ts`, `Commands.ts`, `src/ptb/**` |
| Sui objects | `sui/docs/.../object-model.mdx`, `src/query/**`, `src/schema/objects.ts` |
| Move packages | `sui/docs/.../package-overview.mdx`, `src/package/**`, `test/e2e/utils/prepublish.ts` |
| Localnet | `sui/docs/.../local-network.mdx`, `test/e2e/utils/globalSetup.ts`, `nix/modules/localnet.nix` |

## Research Gate

If a command fails or behavior surprises you, explain the mechanism before retrying. Two same-family retries without new source evidence is thrash, darling. Read the relevant local upstream source or `--help` output first.

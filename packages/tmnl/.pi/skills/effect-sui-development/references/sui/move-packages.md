---
up: INDEX.md
prereqs: ../grounding.md, programmable-transaction-blocks.md
provides: move-package-model, publish-boundary, upgrade-cap-semantics, bytecode-tooling
children: none
update-strategy: refresh when Sui Move package docs, CLI bytecode output, or Effect-Sui package helpers change
update-status: current
---

# Move Packages and Publish Boundary

> up: INDEX.md
> prereqs: ../grounding.md, programmable-transaction-blocks.md
> provides: move-package-model, publish-boundary, upgrade-cap-semantics, bytecode-tooling
> children: none

Primary sources:

- `submodules/sui/docs/content/develop/write-move/package-overview.mdx`
- `submodules/sui/docs/content/develop/transactions/ptbs/prog-txn-blocks.mdx` publish/upgrade rules
- `submodules/sui/docs/content/references/ptb-commands.mdx`
- `submodules/ts-sdks/packages/sui/test/e2e/utils/prePublish.ts`

## Sui Move Constructs

Sui uses Move through three constructs:

| Construct | Meaning | Effect-Sui implication |
|---|---|---|
| Package | Published set of Move bytecode. Packages are immutable onchain objects; upgrades create new versions. | `SuiPackage` is an immutable factory/descriptor surface, not a mutable code blob. |
| Module | Named code unit inside a package. Module names are unique within a package. | `SuiModule` can expose generated factory/query functions. |
| Object | Typed data governed by modules. | Object schemas/codegen map type tags to BCS parsers and active object facades. |

## Immutability and UpgradeCaps

Published packages cannot be edited in place. Upgrading creates a new package object/version and leaves prior versions intact. `UpgradeCap` controls upgrade authority. Destroying it through `sui::package::make_immutable` makes the package permanently immutable and removes upgrade risk/flexibility.

Effect-Sui must surface upgrade evidence explicitly. Do not hide `UpgradeCap`/`UpgradeReceipt` behind a vague success boolean. We are building tooling, not a fog machine.

## PTB Publish Semantics

`Publish(ModuleBytes, TransitiveDependencies)`:

- embeds module bytes and dependency package IDs directly in the command;
- does not pass them as normal PTB `Argument`s;
- stages the package before calling module `init` functions;
- calls each module `init` in the order modules are provided;
- returns one `sui::package::UpgradeCap`.

Effect-Sui map:

- `src/package/publish.ts`: `publishMovePackage`, `makePublishPtb`, `makePublishTx`, `extractPublishResult`.
- `src/package/descriptor.ts`: package descriptors.
- `src/package/registry.ts`: published package registry evidence.
- `test/e2e/package-registry.localnet.test.ts`: localnet proof.

## Upgrade Semantics

`Upgrade(ModuleBytes, TransitiveDependencies, Package, UpgradeTicket)`:

- takes exactly one PTB argument: `UpgradeTicket` by value;
- returns one `UpgradeReceipt`;
- does not call `init` functions;
- enforces package ID, module digest, and upgrade policy from the ticket.

If Effect-Sui later grows high-level upgrade helpers, use the same boundary discipline: CLI/codegen may compile, Flow executes, package module extracts typed evidence.

## Bytecode Boundary

Compilation is allowed outside Effect-Sui execution:

```text
sui move build --dump-bytecode-as-base64
  → { modules: string[], dependencies: string[] }
  → Effect-Sui publish request schema
  → SuiPTB Publish command
  → SuiTx / Flow execution
  → PackageWrite + UpgradeCap evidence
```

Publishing must go through Effect-Sui `SuiTxRunner` / Flow so payment, auth, diagnostics, finality, and reservations remain in one lifecycle.

## Move Fixture Convention

Current fixture:

```text
packages/effect-sui/move/fixtures/counter/Move.toml
packages/effect-sui/move/fixtures/counter/sources/counter.move
```

Use the shell wrapper:

```bash
nix develop .#effect-sui --command effect-sui sui-move bytecode counter >/tmp/counter-bytecode.json
```

Expected smoke shape:

```json
{ "modules": ["...base64..."], "dependencies": ["0x1", "0x2"] }
```

After experiments, clean generated build state:

```bash
effect-sui sui-move clean counter
rm -f move/fixtures/counter/Move.lock
```

## Do Not

- Do not publish with raw `sui client publish` in package tests that are supposed to prove Effect-Sui Flow.
- Do not parse Move bytecode manually; treat compiled modules as opaque base64 payloads.
- Do not infer package IDs by string scraping CLI tables when transaction effects are available.

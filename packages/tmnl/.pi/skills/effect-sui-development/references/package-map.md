---
up: INDEX.md
prereqs: grounding.md
provides: effect-sui-module-map, ownership-routing, source-layout
children: none
update-strategy: refresh when @tmnl/effect-sui package, Sui SDK, Move tooling, or Nix mission-control patterns change
update-status: current
---

# Package Map

> up: INDEX.md
> prereqs: grounding.md
> provides: effect-sui-module-map, ownership-routing, source-layout
> children: none

## Public Shape

`@tmnl/effect-sui` is namespace-first. Consumers import submodules like:

```ts
import * as SuiPTB from '@tmnl/effect-sui/ptb';
import * as SuiFlow from '@tmnl/effect-sui/flow';
import * as SuiPackage from '@tmnl/effect-sui/package';
```

Preserve public barrels. Split internals freely, but keep stable `index.ts` exports.

## Ownership Map

| Area | Owns | Start here |
|---|---|---|
| `src/schema` | Branded strings, bytes, Move identifiers, type tags, policies, typed errors, diagnostics schemas. | `src/schema/index.ts`, `docs/ONTOLOGY.md` |
| `src/effectable` | Public Effectable facades: Object, PTB, Tx, Package/Module, Query/Flow base algebras. | `src/effectable/base.ts` |
| `src/ptb` | PTB AST, inputs, commands, constructors, analysis, compiler, runtime builder. | `src/ptb/index.ts` |
| `src/query` | Object reads, BCS bridge, decode/normalize, ManagedRuntime Query client. | `src/query/resolver.ts` |
| `src/flow` | Gas/payment/auth/preflight/execution/finality, runner lifecycle, runtime client. | `src/flow/runner.ts` |
| `src/reservation` | STM resource keys, Tx state snapshots, acquire/release/reconcile, persistence. | `src/reservation/index.ts` |
| `src/package` | Package descriptors, registry, typed factories, Move publish helper. | `src/package/publish.ts` |
| `src/adapter` | Mysten `$extend`, cache/client extension, wallet callback bridge, disposal handles. | `src/adapter/index.ts` |
| `src/diagnostics` | Error/Cause/Exit classification and event service. | `src/diagnostics/classify.ts` |
| `src/testing` | Fake clients, fake fixture scopes, runtime fixture scopes. Never import from production source. | `src/testing/index.ts` |

## Placement Rule

- If it validates a domain value, it starts in `schema`.
- If it describes a public capability, it starts in `effectable`.
- If it transforms PTB AST into Mysten `Transaction`, it belongs in `ptb`.
- If it reads chain state, it belongs in `query`.
- If it executes lifecycle, it belongs in `flow`.
- If it guards object/gas/signer mutation conflicts, it belongs in `reservation`.
- If it manufactures Move package-specific builders or publish requests, it belongs in `package`.

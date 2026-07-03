# GBG agent SDK / harness repo map

This file fills the failed first scout output from run `34c4c79a-4617-466f-b344-84a21df64274`. The failure mechanism was a bad `rg` path (`packages/tmnl/src/lib/pi-orchestrator` did not exist), not lack of repo evidence.

Scope: correct repo root `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg`. Research-only; no token-bearing ignored files or credential actions.

## High-signal observed inventory

| Area | Evidence paths | Observed relevance |
|---|---|---|
| Platform glossary | `CONTEXT.md` | Defines DMN as **Domain Module Network**, Domain Module, Capability Module, Persistence Capability Module, Reaction Policy, AVA, EVA. Establishes IIoT as one DMN domain, not the generic substrate. |
| DMN architecture | `docs/rfc/0001-dmn-domain-module-network.md` | Draft RFC extracting mature IIoT patterns into reusable Effect v4-native factories, capability modules, manifests, and runtime bindings. Explicitly places DMN above MSH/PCT/LNK/STX. |
| Codemode core | `packages/codemode/package.json`, `packages/codemode/src/index.ts` | `@tmnl/codemode`: “Domain SDK — persistent knowledge, procedures, plugin system, eval sandbox.” Strongest existing owned-agent SDK primitive. |
| Codemode Pi adapter | `packages/codemode-pi/package.json`, `packages/codemode-pi/src/index.ts` | `@tmnl/codemode-pi`: Pi host adapter for render/layout/steer/tool-guide primitives. Keeps Pi-specific UI/control-plane code separate from codemode core. |
| Pi dynamic workflows | `packages/pi-workflows/README.md`, `packages/pi-workflows/docs/V0_WORKFLOW_CONTRACT.md`, `packages/pi-workflows/package.json` | Pi extension package exposing a restricted workflow coordinator (`phase`, `log`, `agent`, `parallel`, `pipeline`) over `pi-subagents`. Good V0 model for multi-agent workflow scripts. |
| MSH | `packages/msh/README.md`, `packages/msh/package.json`, `packages/msh/docs/pct-lnk-composition-rfc.md` | `@tmnl/msh`: NATS Effect services, auth, subjects, JetStream/KV/micro substrate, tracing. Explicitly must not own domain/PCT/LNK semantics. |
| LNK | `packages/lnk/README.md`, `packages/lnk/package.json`, `packages/lnk/ARCHITECTURE.md` | `@tmnl/lnk`: Effect v4-native Durable Streams client/server-adapter library with offsets, producer fencing, Pull-driven catch-up, STX materializers, and MSH-backed transport seam. |
| PCT | `packages/pct/package.json`, `packages/pct/NATS-INTEGRATION-CLOSEOUT.md`, `packages/pct/docs/hardening/boundary-contracts.md` | `@tmnl/pct`: Pact Protocol, schema-first wire protocol, procedure/registry/control-plane contracts, federation, projection scheduler contracts, NATS resolver/control path. |
| STX | `packages/stx/package.json`, `packages/stx/src/index.ts`, `packages/pct/docs/hardening/boundary-contracts.md` | `@tmnl/stx`: unified state factory: effect-atom/reactive data × XState logic × Effect services; local/client/tooling state substrate, not durable cross-node ledger. |
| Graph package | `packages/getbygraph/package.json`, `packages/getbygraph/README.md` | `@gbg/graph` exists as a small/generated Nx library. It is currently a named graph package but not enough evidence by itself for full graph-memory-session semantics. |
| TMNL IIoT precedent | `docs/rfc/0001-dmn-domain-module-network.md`, `packages/tmnl/**`, log-visible `packages/tmnl/src/lib/iiot/**` references | IIoT contains mature patterns: schemas, SQL DDL/migrations, repositories, state services, machines, Effect Cluster entities, event handlers, graph projections, Reactor policies, adapters, tests. |
| OpenProse/Reactor | `submodules/openprose/**`, `packages/limitlessrp/reactor/**`, `research/gbg-openprose-reactor-map.md` | Source-vendored OpenProse plus concrete LimitlessRP Reactor contracts. Defines standing responsibilities/gateways and receipt-based surprise-driven work. |
| LimitlessRP domain slice | `packages/limitlessrp/**`, `research/gbg-limitlessrp-map.md` | Concrete polyglot domain module with TS memo helpers, Python registry validation, Rust normalization, Prose workflows, source registry, and Reactor standing-state contracts. |

## Acronym / layer findings

| Token | Observed meaning in GBG repo | Evidence |
|---|---|---|
| DMN | **Domain Module Network**. Generic substrate for composing reusable Domain Modules and Capability Modules. | `CONTEXT.md`; `docs/rfc/0001-dmn-domain-module-network.md` |
| MSH | Mesh substrate: NATS connection/auth/subjects/JetStream/KV/micro/tracing. Must not learn domain/PCT/LNK semantics. | `packages/msh/README.md`; `packages/msh/docs/pct-lnk-composition-rfc.md`; `packages/pct/docs/hardening/boundary-contracts.md` |
| PCT | Pact Protocol: schema/procedure registry, identity, federation, control plane, derived-data/projection specs. | `packages/pct/package.json`; `packages/pct/docs/hardening/boundary-contracts.md`; `packages/pct/NATS-INTEGRATION-CLOSEOUT.md` |
| LNK | Durable typed streams: offsets, producer fencing, durable wire semantics, STX materializers, MSH bridge seam. | `packages/lnk/README.md`; `packages/lnk/package.json`; `packages/lnk/ARCHITECTURE.md` |
| STX | Local/client/tooling state substrate: effect-atom × XState × Effect services; streaming materializers and reactive state. | `packages/stx/package.json`; `packages/stx/src/index.ts`; boundary docs |
| IIoT | Concrete domain precedent under TMNL, not DMN itself. It is the proving ground for DMN extraction and Reaction Policy generalization. | `CONTEXT.md`; `docs/rfc/0001-dmn-domain-module-network.md` |

## Boundary model observed in repo

The clearest current system boundary stack is:

```text
Domain modules / apps
  ↑ choose semantics, tenants, procedures, views
DMN — Domain Module Network
  ↑ generic domain-module factories, manifests, capability composition
PCT — schema/procedure registry + control plane
  ↑ contract semantics, registry, identity, federation, projections
LNK — durable typed streams
  ↑ offsets, framing, fencing, stream handles, STX materializers
MSH — mesh substrate
  ↑ NATS/auth/JetStream/KV/micro/tracing only
STX — local/client/tooling state
  ↑ reactive UI/tool state, not durable cross-node authority
```

`packages/pct/docs/hardening/boundary-contracts.md` states this split directly and adds SQL/Timescale as materialized read models, source facts, ledgers, and analytics.

## Existing agent-SDK / harness primitives

### Codemode

Observed current role: persistent knowledge/procedure/eval SDK.

Evidence:
- `packages/codemode/package.json`: “Domain SDK — persistent knowledge, procedures, plugin system, eval sandbox.”
- `packages/codemode/src/index.ts`: `createCodemode` assembles store + procedures + IO primitives + overlays into a merged API/eval sandbox.
- `packages/codemode/src/store/*`: persistence, domains, builders, procedures, search/export/import.
- `packages/codemode/src/overlay.ts`: stackable overlays with merged methods/context/steer/render surfaces.

Agent SDK relevance:
- This is already the closest owned SDK substrate.
- It supports persistent memory, stored procedures, plugin overlays, and generated tool surfaces.
- It should remain host-agnostic.

### Codemode Pi adapter

Observed current role: Pi host surface.

Evidence:
- `packages/codemode-pi/package.json`: Pi host adapter for TUI primitives, rendering, layout, steer formatting.
- `packages/codemode-pi/src/index.ts`: exports render, layout, primitives, tool guide, steer formatting.

Agent SDK relevance:
- Good adapter-seam precedent: keep host rendering/control-plane separate from domain SDK.
- A future owned SDK should keep similar host adapters for Pi, CLI, web, or other runtimes.

### Pi Workflows

Observed current role: coordinator runtime over subagents.

Evidence:
- `packages/pi-workflows/README.md`: V0 coordinator runtime with restricted globals.
- `packages/pi-workflows/docs/V0_WORKFLOW_CONTRACT.md`: owns workflow discovery, metadata validation, coordinator globals, run lifecycle, phases, progress normalization, journal records, narrow `SubagentAdapter`.
- Explicit non-ownership: child agent process/session execution, model fallback policy, worktree management, cross-session durable replay, arbitrary FS/shell capabilities.

Agent SDK relevance:
- Good pattern for multi-agent orchestration without giving workflow scripts arbitrary power.
- Missing: durable distributed workflow semantics, cross-session replay, and full policy layer.

## Graph / memory / session interpretation

Observed:
- No single current package literally called `graph-memory-session`.
- The repo has relevant parts split across:
  - Pi harness session lifecycle (external/local Pi docs and adapters)
  - `@tmnl/codemode` store/procedures/history/overlays
  - `@gbg/graph` placeholder/generated package
  - OpenProse/Reactor world-model + receipts
  - TMNL IIoT graph/projection/Reactor precedent
  - PCT/LNK/MSH event/log/control-plane stack

Inferred:
- “graph-memory-session” should be treated as an architecture composition phrase, not a shipped package name.
- A clean future package would likely expose:
  - graph topology / dependencies / propagation
  - session tree / resume / fork / compaction
  - durable memory store / provenance / export/import
  - replay/event receipt ledger

## Reusable patterns for the sophisticated owned agent SDK

1. **Host adapter separation**: `@tmnl/codemode` vs `@tmnl/codemode-pi` shows how to keep SDK core separate from Pi host/TUI specifics.
2. **Restricted workflow globals**: `@tmnl/pi-workflows` gives a safe multi-agent coordinator DSL that delegates child execution through a port.
3. **Boundary hygiene**: PCT/LNK/MSH/STX docs are a strong anti-bloat precedent for keeping responsibilities separate.
4. **Effect v4 package islands**: `msh`, `lnk`, `pct`, `stx`, `pi-workflows`, and `codemode` use `effect-v4` aliases to avoid Effect v3/v4 mixing.
5. **Contract-first transport stack**: PCT over LNK over MSH is a reusable model for schema/procedure protocols over streams over mesh substrate.
6. **Reaction Policy extraction**: DMN should generalize IIoT Reactor into Reaction Policy, not call every workflow “Reactor.”
7. **Standing-state domain slice**: LimitlessRP shows how OpenProse/Reactor can maintain source-grounded research cache and due-diligence memo state.
8. **Source/secret boundaries**: MSH auth docs and LimitlessRP guardrails both emphasize redaction, provenance, and not leaking private/token material.

## Gaps / risks

- **No first-class `@tmnl/dmn` package yet** observed, despite RFC topology proposing `packages/dmn/`.
- **`@gbg/graph` appears underdeveloped** from package metadata/README alone; graph semantics currently live more in TMNL/OpenProse/PCT patterns than in this package.
- **Potential name collision: Reactor** — OpenProse Reactor vs TMNL/IIoT Reactor/Reaction Policy are related ideas but not the same runtime. Visuals must distinguish them.
- **Effect version split** — root `package.json` uses Effect v3 (`effect: 3.21.2`) while many TMNL packages use `effect-v4` alias. This is deliberate in package islands but easy to blur.
- **Token/action boundary** — MSH can handle auth/JWT/NKeys; research/visual work must not inspect token-bearing ignored files or run token actions.
- **Over-composition risk** — Do not collapse Pi harness, codemode, pi-workflows, OpenProse/Reactor, DMN, PCT/LNK/MSH/STX, and LimitlessRP into one monolithic “SDK.”

## Visual explainer lanes/cards

1. **Glossary / language lane** — `CONTEXT.md`: DMN, Domain Module, Capability Module, Reaction Policy, AVA/EVA.
2. **Host layer lane** — Pi harness/session runtime as execution substrate; host-specific adapters stay outside SDK core.
3. **Codemode lane** — `packages/codemode`: persistent knowledge, procedures, overlays, eval sandbox.
4. **Pi adapter lane** — `packages/codemode-pi`: rendering/layout/steer/tool-guide.
5. **Workflow coordinator lane** — `packages/pi-workflows`: restricted workflow scripts over `SubagentAdapter`.
6. **DMN lane** — `docs/rfc/0001-dmn-domain-module-network.md`: domain/capability modules and Reaction Policy extraction.
7. **PCT/LNK/MSH/STX boundary lane** — `packages/pct/docs/hardening/boundary-contracts.md`.
8. **Transport/control stack lane** — MSH substrate → LNK durable streams → PCT registry/control plane.
9. **State lane** — STX local/reactive state vs LNK durable stream truth vs PCT registry/EventLog vs codemode memory.
10. **OpenProse/Reactor lane** — `submodules/openprose` + LimitlessRP reactor assets; compile/run, fingerprints, receipts.
11. **LimitlessRP example lane** — `packages/limitlessrp`: source registry → research cache → due-diligence memo.
12. **IIoT precedent lane** — TMNL IIoT as concrete domain pack and Reactor/Reaction Policy precedent.
13. **Gaps lane** — no generic DMN package yet, graph package underdeveloped, Reactor namespace collision, unresolved graph-memory-session package shape.
14. **Next decision lane** — choose first vertical slice, define graph-memory-session contract, decide what belongs in DMN vs codemode vs OpenProse.

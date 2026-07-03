# GBG-owned agent SDK synthesis

## Scope
Observed from local repo evidence in:
- `packages/codemode`, `packages/codemode-pi`
- `submodules/openprose`
- `packages/limitlessrp`
- `packages/tmnl` session/harness docs
- empty `research/` tree (no prior local research artifacts found there)

## Current architecture layers (observed)

### 1) Host/runtime layer: Pi harness
- Pi owns the session runtime, streaming/tool lifecycle, and per-session persistence.
- In TMNL docs, the runtime is split into `pi SessionManager`, `HarnessEngine`, and consumer UI.
- This is the lowest-level “execute, stream, abort, resume” substrate.

### 2) Agent SDK layer: codemode
- `@tmnl/codemode` is a persistent knowledge engine: store + procedures + overlays + eval sandbox.
- `@tmnl/codemode-pi` is the Pi host adapter: render/layout/steer/tool-guide primitives.
- Codemode’s LLM bridge shells out to `pi -p` in print mode for sub-LM calls.

### 3) Workflow/runtime layer: OpenProse + Reactor
- OpenProse authoring uses `*.prose.md` contracts, Forme wiring, and a compile/run split.
- Reactor is the run-phase reconciler: compare fingerprints, skip unchanged, render changed, propagate receipts.
- The runtime is intentionally dumb; intelligence is frozen at compile time.

### 4) Domain layer: LimitlessRP
- LimitlessRP is a GBG domain module for iridium research.
- It uses OpenProse Reactor responsibilities/gateways to keep research cache + due-diligence memo current.
- Its workflow dispatches specialist Pi-based research agents and audits citations.

### 5) Cross-cutting memory/session layer (provisional)
- There is no repo artifact literally named `graph-memory-session`.
- The closest local pattern is a graph + durable memory + session split across:
  - Pi session engine/state store,
  - codemode store/history/procedures/overlays,
  - OpenProse world-model + receipt ledger.
- Treat `graph-memory-session` as a conceptual label, not a current package name.

## Evidence ledger (GBG paths)

| Path | Observed fact | Why it matters |
|---|---|---|
| `packages/codemode/src/index.ts` | SDK core assembles store + procedures + I/O + overlays + eval sandbox | This is the strongest candidate for the “owned agent SDK” core |
| `packages/codemode/src/store/api.ts` | Persistent RLM store with query/search/domain/export/import | Durable knowledge substrate |
| `packages/codemode/src/store/procedures.ts` | Stored procedures persist across sessions and can call `ms` | Stateful agent automation / reusable behaviors |
| `packages/codemode/src/overlay.ts` | Overlays are stackable, dynamically switchable, and merge methods/steer/context/rendering | Composition mechanism for persona/capability bundles |
| `packages/codemode/src/llm-bridge.ts` | `pi -p --no-session --no-tools ...` sub-LM bridge | Local recursion / bounded subcalls without full harness baggage |
| `packages/codemode-pi/src/render.ts` | Pi TUI render path for tool calls/results | Human-facing adapter layer |
| `packages/codemode-pi/src/layout.ts` / `steer.ts` / `tool-guide.ts` | Adaptive layout + steering annotations + transactional guide injection | UX/control-plane polish for the Pi host |
| `submodules/openprose/skills/open-prose/SKILL.md` | OpenProse load map: contract markdown, Forme, Prose VM, ProseScript, Responsibility Runtime | Canonical runtime decomposition |
| `submodules/openprose/skills/open-prose/concepts/responsibility.md` | Responsibility = standing goal; `### Maintains` carries type/canonicalization/facets/postconditions | The semantic source for durable agent responsibilities |
| `submodules/openprose/skills/open-prose/concepts/reactor.md` | Reconciler compares fingerprints; receipt is the commit object; three wake sources | The exact control flow for surprise-based reactivity |
| `submodules/openprose/skills/open-prose/forme.md` | Forme semantically wires `Requires ↔ Maintains` into topology | Compile-time graph construction |
| `submodules/openprose/skills/open-prose/responsibility-runtime.md` | Compile/intelligent vs run/dumb split; no judge; no pressure enum | Confirms current runtime doctrine |
| `submodules/openprose/spec/02-ReactorHarness.md` | “Two adapter seams, never merged”: bounded agent SDK vs model gateway | Critical boundary for owned SDK design |
| `submodules/openprose/tools/cli/src/prose/repository-reactor.ts` | Repository IR → topology bridge; local storage adapter; render factory injection | Concrete implementation precedent for a repo-bound reactor |
| `packages/limitlessrp/README.md` | LimitlessRP is a GBG domain/capability module package | Confirms domain-module packaging |
| `packages/limitlessrp/docs/reactor/README.md` | LimitlessRP uses OpenProse Reactor for standing research state | Domain → runtime composition precedent |
| `packages/limitlessrp/reactor/reactor.yml` | Reactor project config uses `.reactor`, OpenRouter, Gemini Flash render/compile models | Real config surface, not just concept text |
| `packages/limitlessrp/reactor/iridium-source-refresh.prose.md` | Gateway maintains source-refresh arrivals and registry fingerprint | Gateway shape for external arrivals |
| `packages/limitlessrp/reactor/iridium-research-cache.prose.md` | Responsibility maintains audited research cache | Durable cache truth |
| `packages/limitlessrp/reactor/iridium-due-diligence-memo.prose.md` | Responsibility maintains memo + unknowns + red flags | Downstream memo composition |
| `packages/limitlessrp/workflows/iridium-research-scrape.prose.md` | Agentic scrape workflow dispatches specialist Pi researchers and audits citations | Control/data flow template for domain research |
| `packages/limitlessrp/data/sources/iridium.sources.json` | Source registry encodes source class, trust tier, cadence, expected fields | The authoritative input universe for research |
| `packages/tmnl/docs/architecture/SESSION-ARCHITECTURE-AUDIT.md` | TMNL has three session domains: pi SessionManager, HarnessEngine, consumer layer | Best local evidence for session composition |

## Candidate control/data flows (observed + inferred)

### A) Pi host → codemode
Observed:
- Pi session engine streams tool events and maintains session identity/state.
- Codemode sits on top as a persistent store/procedure/overlay runtime.

Inferred future-friendly flow:
- Pi opens a session.
- Codemode overlay loads a capability bundle.
- User/tool actions mutate codemode store and session history.
- `llm_bridge` uses `pi -p` for bounded subcalls.

### B) OpenProse compile/run → Reactor
Observed:
- Contracts are authored as Markdown.
- Forme wires `Requires ↔ Maintains` into a topology.
- Reactor skips or renders by comparing fingerprints.

Inferred flow:
- contract set changes → compile phase emits topology + canonicalizers + validators
- a gateway/input receipt arrives → reconciler compares memo key
- unchanged → `skipped`
- changed → bounded render → receipt → propagation

### C) LimitlessRP research maintenance
Observed:
- source registry defines source classes and cadence
- gateway captures refresh arrivals
- research-cache responsibility maintains audited facts
- memo responsibility consumes cache facets

Inferred flow:
- registry change or freshness lapse wakes gateway
- gateway triggers research-cache refresh
- specialist Pi agents extract facts by source class
- source-quality auditor rejects uncited/ambiguous claims
- due-diligence memo re-renders only when cache facets or intake move

### D) Session memory / “graph-memory-session”
Observed:
- TMNL uses a session graph + event store; codemode has session history + persistent store; OpenProse has world-model + receipt ledger.

Inferred flow:
- a session-scoped memory graph should probably be a thin abstraction over these three layers:
  - transient session context (Pi harness)
  - durable structured knowledge (codemode store/procedures)
  - cross-run truth trail (OpenProse world-model + receipts)

## How the pieces compose

### Pi harness
- Best understood as the execution substrate.
- It owns session lifecycle, tool streaming, abort/resume, and provider/model projection.
- It should not own the durable domain semantics.

### codemode
- Best understood as the owned-agent SDK that sits inside or above Pi.
- It gives the agent a persistent store, procedure registry, overlays, and host rendering.
- The Pi adapter (`codemode-pi`) is the UI/control-plane translation layer.

### OpenProse
- Best understood as the durable multi-agent workflow language/runtime.
- It supplies contracts, compile-time wiring, and the Reactor run loop.
- It is the right layer when the work should persist, replay, and propagate across runs.

### Reactor
- Best understood as the control law for standing goals.
- It should own: memoization, receipts, propagation, freshness, and bounded re-renders.
- It should not own: ad-hoc host UI, prompt-loop improvisation, or domain-specific research logic.

### LimitlessRP
- Best understood as a domain module that already demonstrates the stack end-to-end.
- It is an excellent concrete example for a visual explainer because it has:
  - a source registry
  - a gateway
  - a research cache responsibility
  - a memo responsibility
  - specialist agent dispatch
  - red-flag/unknown preservation

### graph-memory-session (provisional)
- Best treated as the “glue phrase” for:
  - graph = OpenProse/Reactor topology
  - memory = codemode store + OpenProse world-model
  - session = Pi harness session lifecycle / TMNL harness session store
- It is not a formal repo package today.

## Unresolved acronyms / labels

- `graph-memory-session` — no matching repo symbol found.
- `RLM` — used in codemode docs, but not expanded locally.
- `DPA` — used in codemode procedure docs; expansion not explicit in the repo.
- `Pi` — a local host/runtime brand (`@mariozechner/pi-*`), but not expanded in the repo.
- `GBG` — org/repo prefix; likely internal brand, not expanded in the docs.

## Risks

### Current/observed risks
- Terminology drift: old judge/status/pressure vocabulary still exists in adjacent docs, while current OpenProse Reactor docs have removed it.
- Session identity coupling: TMNL docs show in-memory mappings and provider session passthrough; this can be lossy across restarts.
- Secret boundary risk: OpenProse/LimitlessRP explicitly separate private workspace vs published truth; a visual explainer must not blur that line.
- Domain advice risk: LimitlessRP must stay factual/non-advisory.

### Future/inference risks
- A unified “owned agent SDK” could accidentally collapse host runtime, workflow compiler, and domain semantics into one blob.
- If `graph-memory-session` is drawn as a concrete product today, it would be misleading; it is a conceptual wrapper only.
- If the explainer hides the two adapter seams (bounded agent SDK vs model gateway), it will misstate the OpenProse/Reactor architecture.

## Implementation-ready meta-prompt for a revised visual explainer

**Goal:** Produce a clean architecture diagram and short caption set for a GBG-owned agent SDK stack, grounded in local evidence, with explicit observed-vs-inferred separation.

**Must show:**
1. `Pi harness` as the execution/runtime substrate.
2. `codemode` as the persistent knowledge / procedure / overlay SDK.
3. `OpenProse` as the contract + Forme + Reactor workflow layer.
4. `LimitlessRP` as a concrete domain module using OpenProse Reactor.
5. A dashed/provisional `graph-memory-session` label only as a concept, not as a shipped package.
6. The two adapter seams in OpenProse: bounded agent SDK vs model gateway.
7. The compile/run split: intelligent compile, dumb run.
8. The durable artifacts: session state, store, world-model, receipts, research cache.

**Hard constraints:**
- Separate **observed/current** from **inferred/future** in the captioning.
- Do not invent repo symbols or acronyms not found in local evidence.
- Do not present `graph-memory-session` as an existing package.
- Do not imply advisory/trading recommendations for LimitlessRP.
- Do not collapse host runtime, agent SDK, workflow runtime, and domain module into one box.

**Suggested visual structure:**
- Left-to-right pipeline with a bottom “durable state” rail.
- Top row: Pi → codemode → OpenProse/Reactor → LimitlessRP.
- Bottom row: session store / store / world-model / receipts / research cache.
- Use solid arrows for observed flows and dashed arrows for inferred flows.
- Color-code current vs future: solid = current, dashed = proposed.

**Caption tone:**
- Precise, non-salesy, and architecture-first.
- Every claim should map back to one of the evidence paths above.


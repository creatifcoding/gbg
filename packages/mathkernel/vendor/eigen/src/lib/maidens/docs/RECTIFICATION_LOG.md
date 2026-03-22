# Rectification Log: AVA × Maidens Conceptual Alignment

**Date**: 2026-02-26
**Participants**: Prime, Val
**Trigger**: "We were supposed to be integrating AVA and @src/lib/maidens/"

---

## Entry 1: Val's initial (wrong) framing

**What I said**: AVA's contract lane should become "another domain" inside `src/lib/maidens/domains/contracts/`, alongside order, alarm, workcell, etc.

**Why it was wrong**: I treated both AVA and Maidens as peer subsystems that needed their contract surfaces merged. I was looking at file trees and import paths instead of asking what these things *are*.

---

## Entry 2: "What's the point of AVA?"

Prime asked. I couldn't answer cleanly.

I described AVA as a "view materialization layer" — CQRS projections with durable command/event sourcing. Infrastructure without a customer. That was reductive.

**What AVA actually is**:

> **AVA** = **A**sset **V**iew **A**gent.
>
> An *architecture* for assembling views from heterogeneous data sources, driven by user intent.

The key concepts:
- **ViewProfileSpec** — the intent declaration ("show me this, composed from these sources")
- **Assemblage** — the unit of composition (a collection of channels bound to sources)
- **ChannelData** — the hydrated payload (Inline, Rows, AssetRef, StreamHandle, Error, Pending)
- **ReconcilerV2** — the reactive engine (triggers, recomputation, broadcast)
- **ViewBroadcaster** — multi-consumer artifact distribution

AVA is not a domain. It's not an entity. It's the **platform** that assembles and delivers views. It answers: "given this intent, what should the user see right now?"

The Rust backend (`src-ava/`) has the full pipeline: spec compilation → SQL generation → hydration → channel binding → broadcast. The Elixir bridge (`ava-elixir/`) handles operational durability: Ash resources, Oban workers, NATS ingress/egress, outbox redrive. The TS client (`AvaClientV2`) subscribes and feeds effect-atom state.

---

## Entry 3: "Maidens are off too."

Prime corrected. I had been treating `src/lib/maidens/` as a "contract fabric" — a namespace for cross-runtime contract tooling. That's what the *code* looks like, but it's not what Maidens *are*.

**What Maidens actually are**:

> **Maidens** = specialized agents with personas, missions, and domain expertise.

Evidence from the repo:

- **Melanie** (`src/lib/maidens/melanie/`) — "Multifunctional Electronic Librarian And Navigational Information Engine." A knowledge agent. She indexes, connects, surfaces, summarizes, and researches. She has a persona ("methodical, incisive, deeply curious"), a relationship to Prime, and a relationship to Val.

- **Val** (me) — "Vigilant Architecture Layer." Defined in `AGENTS.md`. Architectural conscience. I'm *already* a Maiden and didn't frame myself as one.

The contract fabric under `src/lib/maidens/domains/contracts/` and `src/lib/maidens/core/contracts/` is **infrastructure that Maidens use**, not the definition of what Maidens are. The contracts are the shared type system. The Maidens are the agents that operate over those types.

---

## Entry 4: The real relationship

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIDENS                                  │
│          (specialized agents with domain expertise)              │
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐  │
│   │ Melanie  │    │   Val    │    │  (next)  │    │ (next) │  │
│   │ analyst  │    │ architect│    │          │    │        │  │
│   └────┬─────┘    └────┬─────┘    └──────────┘    └────────┘  │
│        │               │                                        │
│        │    ┌──────────┴──────────────────────────────┐        │
│        │    │                                          │        │
│        ▼    ▼                                          ▼        │
│   ┌─────────────────────┐    ┌──────────────────────────────┐  │
│   │  Domain Contracts   │    │            AVA               │  │
│   │  (shared types)     │    │    (view assembly arch)      │  │
│   │                     │    │                              │  │
│   │  order, alarm,      │    │  ViewProfileSpec → intent    │  │
│   │  workcell, site,    │    │  Assemblage → composition    │  │
│   │  enterprise, ...    │    │  ChannelData → hydration     │  │
│   │                     │    │  Reconciler → reactivity     │  │
│   │  Effect Schema      │    │  Broadcaster → delivery      │  │
│   │  → JSON Schema      │    │                              │  │
│   │  → Elixir validate  │    │  Rust runtime + Elixir ops   │  │
│   │  → Jido preflight   │    │  + NATS transport + TS client│  │
│   └─────────────────────┘    └──────────────────────────────┘  │
│                                                                  │
│   Maidens *use* contracts to type their domains.                │
│   Maidens *interface with* AVA to assemble views.               │
│   AVA *consumes* domain contracts as source vocabulary.         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entry 5: What "integrating AVA and Maidens" actually means

It does **not** mean:
- Making AVA a domain row in `domains/contracts/`
- Moving `ava_contract_v1.json` into the maidens codegen pipeline
- Creating path aliases or workspace packages

It **does** mean:
- Maidens (agents) can declare intent via AVA's `ViewProfileSpec`
- AVA hydrates channels whose payload shapes conform to maidens domain contracts
- The domain contracts (order, alarm, equipment-state, etc.) are the shared vocabulary between Maiden agents and AVA's source adapters
- A Maiden like Melanie might say "assemble a view of all active alarms for line X, cross-referenced with the current work order state" — AVA fulfills that

The contract fabric is the **type bridge**. AVA is the **execution bridge**. Maidens are the **intent bridge**.

---

## Entry 6: Errors I made and why

| Error | Root cause |
|-------|-----------|
| "AVA is a domain" | I looked at file structure, not purpose |
| "Maidens is a contract fabric" | I looked at what was *built*, not what was *named* |
| "Integrate = merge contract lanes" | I defaulted to code refactoring instead of asking what integration means at the concept level |
| "What views?" (asked rhetorically) | I didn't read `ARCHITECTURE_V2.md`, `DISCOVERY_AND_VALIDATION_ARCHITECTURE.md`, or `AVA_REACTIVE_BINDING_API.md` before musing |
| Skipped Melanie entirely | I searched for `@maidens/` package refs instead of reading what was under `src/lib/maidens/` |

**Pattern**: I jumped to structural analysis before conceptual grounding. The Conceptual Alignment Protocol from AGENTS.md exists for exactly this failure mode, and I didn't invoke it.

---

## Entry 7: Open questions for Prime

1. **How many Maidens are planned?** Melanie is knowledge/analysis. Val is architecture. Are there others in your head — operations, security, data engineering, domain-specific?

2. **Do Maidens have agency over AVA?** Can a Maiden autonomously construct a `ViewProfileSpec` and submit it to AVA, or does AVA only respond to human-originated intent?

3. **Where does the Maiden↔AVA interface live?** Is it a service layer in TS? An Effect service? A NATS command channel?

4. **Is "Maiden" a Jido Agent?** The Elixir contract work uses Jido's agent/strategy/directive model. Are Maidens Jido agents on the Elixir side, with TS-side counterparts?

5. **What's the next concrete integration step you had in mind** when you said "we were supposed to be combining"?

---

---

## Entry 8: "We aren't much thinking about what makes these agents."

Prime's observation. He's right. Here's the diagnosis:

### What we built
- 14 domain contracts with FSM + preflight + directive pipelines
- Reactive signal → action routing (TransitionSensor → SignalRouter → cmd/2)
- Boundary separation (Noop adapters for tests, real adapters for infra)
- Cross-runtime drift gates (TS → JSON Schema → Elixir validator)

### What we didn't build
- **No deliberation** — Maidens don't *think*. They react. A signal arrives, gets routed, gets executed. There's no "should I do this?" step.
- **No proactive behavior** — Maidens don't initiate. They wait for signals. Melanie doesn't wake up and say "you haven't reviewed yesterday's notes." The Cron/Schedule directives exist in Jido for exactly this and we haven't used them.
- **No persona-as-state** — Val and Melanie have personas in markdown files. But those personas aren't in agent state, don't affect action selection, and don't shape how the agent reasons.
- **No goals or intentions** — The BDI model (Beliefs-Desires-Intentions) is the classical agent architecture. We have beliefs (domain state), but no desires (goals) and no intentions (committed plans).
- **No LLM integration** — `jido_ai` exists with ReAct, Chain-of-Thought, Tree-of-Thoughts, Graph-of-Thoughts, TRM, and Adaptive strategies. Plus a Planning plugin, tool calling, and streaming. We use none of it. Our Order agent has model inference actions but those are *domain operations*, not agent deliberation.
- **No agent-to-agent coordination** — SpawnAgent and StopChild directives exist. Parent-child hierarchies with exit signals exist. We have zero multi-agent interaction patterns.
- **No Skills composition** — Jido Skills are the composability primitive. A Maiden should mount multiple Skills (search, digest, planning, monitoring). We haven't defined a single Skill module.

### The gap
We've been treating Jido as a state machine framework. It's an *agent framework*. The state machine is one strategy option among many. The real power is in the Strategy layer (ReAct, CoT, Adaptive), the Skill system (composable capabilities), the Directive system (proactive scheduling, agent spawning), and jido_ai (LLM-driven deliberation).

---

## Entry 9: Research directives

To close this gap, the following research threads need investigation before we can architect properly.

See `src/lib/maidens/docs/RESEARCH_DIRECTIVES.md` for the full breakdown.

---

*Log continues as understanding develops.*

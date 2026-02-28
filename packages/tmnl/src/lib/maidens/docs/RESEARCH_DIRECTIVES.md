# Maidens Research Directives

**Date**: 2026-02-26
**Context**: Rectification Log Entry 9
**Status**: Open — awaiting Prime's selection/prioritization

---

## Premise

We've built the *plumbing* (14 domain contracts, FSM pipelines, drift gates, boundary separation) but haven't engaged with the *agency*. Jido is an agent framework with deliberation strategies, LLM integration, skill composition, proactive scheduling, and multi-agent hierarchies. We use almost none of this. The Maidens have personas in markdown but not in code.

These research directives aim to close that gap. Each is a self-contained investigation thread that produces a concrete artifact (spike code, design document, or working prototype).

---

## RD-1: jido_ai Integration Spike — ReAct Strategy for a Maiden

**Question**: What does it take to wire a Maiden (e.g., Melanie) to `jido_ai`'s ReAct strategy so she can reason-act-observe in a loop, calling tools (Jido Actions) based on LLM deliberation?

**Why it matters**: This is the difference between "signal arrives → action executes" (reactive) and "goal declared → agent reasons about which actions to take → executes → observes result → reasons again" (deliberative). ReAct is the simplest deliberative strategy and the best starting point.

**Investigation scope**:
- Read `jido_ai` source: strategy registration, ReAct state machine, tool adapter, directive flow
- Understand how `Jido.AI.Plugins.ToolCalling` bridges Actions to LLM tool specs
- Understand how `Jido.AI.Plugins.Planning` decomposes goals into sub-goals
- Spike: define a minimal Melanie agent that uses ReAct to answer a knowledge query by calling search + summarize tools
- Capture: what config, deps, and wiring are needed; what the directive flow looks like; where persona enters

**Artifact**: Working spike in `src/lib/maidens/melanie/spikes/react-strategy/` + brief design doc

---

## RD-2: Persona-as-State — How Agent Identity Shapes Behavior

**Question**: How should a Maiden's persona (name, expertise, values, communication style, goals) be represented in agent state, and how should that persona influence action selection, reasoning prompts, and directive emission?

**Why it matters**: Currently Val and Melanie are personas in markdown. They should be first-class data structures in agent state that shape how the agent reasons, what it prioritizes, and how it communicates. The BDI model says beliefs (world state), desires (goals), and intentions (committed plans) should all be in state. Persona is the seed of desires and the filter on intentions.

**Investigation scope**:
- BDI architecture: how beliefs, desires, and intentions map to Jido's `schema` / `state` / `__strategy__`
- How persona shapes LLM system prompts in jido_ai (does strategy config carry persona context?)
- How persona shapes action selection (should different personas route the same signal differently?)
- Effect Schema representation: `MaidenPersona` as a TaggedClass with expertise, values, goals
- Whether persona should be immutable (set at agent creation) or adaptive (evolves with experience)

**Artifact**: Design document + Effect Schema definitions for `MaidenPersona`, `MaidenGoal`, `MaidenBelief` in `src/lib/maidens/core/persona/`

---

## RD-3: Proactive Behavior — Cron, Schedule, and Self-Initiated Action

**Question**: How should a Maiden autonomously initiate work — not just respond to external signals, but wake up, assess its beliefs, and decide to act?

**Why it matters**: Melanie's mission says she should "proactively present relevant past context when the user is working." That's proactive behavior. It requires the agent to have scheduled self-assessment loops that evaluate beliefs against goals and emit actions when thresholds are met. Jido's `Cron` and `Schedule` directives are designed for exactly this.

**Investigation scope**:
- How Cron/Schedule directives work in AgentServer (SchedEx integration, Process.send_after)
- How `tick/2` in Strategy enables multi-step proactive loops
- Pattern: "belief assessment loop" — periodic strategy tick that evaluates beliefs, compares to goals, emits actions if thresholds met
- Pattern: "morning digest" — Cron-scheduled daily summary generation
- Pattern: "connection discovery" — background process that finds non-obvious links between entities
- How proactive emissions interact with the signal routing system (do self-initiated actions go through the same pipeline?)

**Artifact**: Prototype Cron-driven belief assessment in a test agent + design doc for Melanie's proactive loops

---

## RD-4: Skill Composition — Building Maiden Capabilities as Modules

**Question**: How should a Maiden's capabilities (search, digest, monitor, plan, etc.) be organized as Jido Skills, and how do multiple Skills compose within a single agent?

**Why it matters**: Skills are Jido's composability primitive. A Maiden should be a lean agent core that mounts domain-specific Skills. Melanie mounts `SemanticSearchSkill`, `DigestSkill`, `ConnectionDiscoverySkill`. An Operations Maiden mounts `MonitoringSkill`, `AlertSkill`, `SLOEnforcementSkill`. Skills bring their own actions, sensors, signal patterns, child processes, and state isolation under a `state_key`. We haven't built a single one.

**Investigation scope**:
- Anatomy of a Jido Skill: mount/2, router/1, subscriptions/2, child_spec/1, handle_signal/2
- State isolation via `state_key` — how multiple Skills share an agent without collision
- Signal pattern matching — how `"search.*"` routes to SearchSkill without conflicting with `"digest.*"` routes
- Sensor subscriptions — how a Skill declares which external event sources it listens to
- How Skills compose with jido_ai strategies — does a ReAct agent use Skills as its tool palette?

**Artifact**: First Maiden Skill module (`MelanieSearchSkill`) with actions, signal routes, and sensor subscription + design doc

---

## RD-5: Multi-Agent Coordination — Maiden-to-Maiden Communication

**Question**: How should Maidens communicate with each other? When Val detects an architectural violation, can she notify Melanie to log it in the knowledge graph? When Melanie discovers a pattern, can she notify an Operations Maiden to investigate?

**Why it matters**: The SpawnAgent/StopChild directives and parent-child hierarchy exist in Jido. So does Directive.Emit for signal dispatch and `emit_to_parent/3`. But we have no patterns for Maiden-to-Maiden coordination. The `on_parent_death` option (`:stop`, `:continue`, `:emit_orphan`) hints at a sophisticated hierarchy model we're not using.

**Investigation scope**:
- SpawnAgent directive: how parent-child relationships form, monitoring, exit signal propagation
- Signal dispatch between agents: Directive.Emit with routing to specific agent refs
- Shared beliefs: can agents share a belief store (ETS, or a shared Jido service)?
- Coordination protocols: request/inform/delegate patterns between agents
- The hierarchy question: is there a "Prime Maiden" that orchestrates others, or are they peers?

**Artifact**: Design document for Maiden coordination topology + spike with two agents communicating via signals

---

## RD-6: jido_ai Reasoning Strategies — Beyond ReAct

**Question**: When should a Maiden use Chain-of-Thought vs. Tree-of-Thoughts vs. Graph-of-Thoughts vs. Adaptive? How do these strategies map to different Maiden activities?

**Why it matters**: Different cognitive tasks need different reasoning patterns. A simple state transition needs no LLM. A complex diagnostic analysis needs Tree-of-Thoughts. A knowledge synthesis task needs Graph-of-Thoughts. The Adaptive strategy auto-selects, but understanding the landscape is prerequisite to using it well.

**Investigation scope**:
- ReAct: multi-step tool use — good for "find X, then analyze Y, then report Z"
- Chain-of-Thought: step-by-step sequential reasoning — good for structured analysis
- Tree-of-Thoughts: branching exploration with evaluation — good for planning with alternatives
- Graph-of-Thoughts: interconnected concept synthesis — good for Melanie's connection discovery
- TRM (Thought-Refine-Merge): iterative improvement with supervision — good for document generation
- Adaptive: auto-selection based on task characteristics — the default for most cases?
- How each strategy's state machine works (Fsmx integration)
- What directive types each strategy emits (LLMStream, LLMGenerate, ToolExec)

**Artifact**: Strategy selection guide mapped to Maiden activities + comparison table

---

## RD-7: The Hybrid Architecture — Reactive Floor + Deliberative Ceiling

**Question**: How do we layer reactive behavior (FSM-driven, fast, deterministic) with deliberative behavior (LLM-driven, slow, creative) in the same agent without them conflicting?

**Why it matters**: We've already built the reactive floor (14 domain FSMs with preflight gates). We don't want to rip it out. We want to add a deliberative ceiling on top. The question is how these layers interact. When a signal arrives, does it go through the reactive path first and only escalate to the deliberative path if the reactive path can't handle it? Or does the deliberative layer wrap the reactive one?

**Investigation scope**:
- Jido's signal routing priority system (strategy routes 50+ > agent routes 0 > skill routes -10)
- Can a strategy's signal_routes override an agent's signal_routes for specific signals?
- Pattern: "reactive guardrails, deliberative planning" — FSM handles transitions, LLM handles goal decomposition
- Pattern: "anomaly escalation" — reactive path handles 90% of inputs, anomalies trigger deliberative reasoning
- How the Strategy layer's tick/2 enables periodic deliberative assessment alongside reactive signal handling
- How existing preflight gates (JSON Schema + FSM legality) compose with LLM-driven action selection

**Artifact**: Architecture document for the hybrid reactive-deliberative Maiden model

---

## Suggested Sequencing

```
RD-1 (jido_ai spike)        — Ground truth: can we even wire it?
  ↓
RD-2 (persona-as-state)     — Design: what does a Maiden look like in state?
  ↓
RD-4 (skill composition)    — Structure: how do capabilities compose?
  ↓
RD-3 (proactive behavior)   — Autonomy: how does a Maiden self-initiate?
  ↓
RD-7 (hybrid architecture)  — Integration: how do reactive + deliberative coexist?
  ↓
RD-6 (reasoning strategies) — Depth: which cognitive tool for which task?
  ↓
RD-5 (multi-agent coord)    — Scale: how do Maidens talk to each other?
```

RD-1 is the foundation. If we can't wire jido_ai to a Maiden with a working ReAct loop, the rest is theoretical. Everything else builds on that proof of life.

---

## Prime's Direction (2026-02-26)

Answered via questionnaire `maidens-research-directives`:

| Question | Decision | Notes |
|----------|----------|-------|
| Test subject | **Melanie** | Knowledge agent — most context, clear mission |
| LLM provider | **Anthropic (Claude)** | Using existing OAuth shim |
| Autonomy scope | **Full autonomy** | BDI as a hard system, not a suggestion |
| AVA interaction | **Deferred** | Wait until AVA's purpose is clearer |
| Sequencing | **Accept proposed** | RD-1 → RD-2 → RD-4 → RD-3 → RD-7 → RD-6 → RD-5 |

**Key design constraint from Prime:** "BDI needs to be implemented as a hard system in Maidens." This means Beliefs-Desires-Intentions is not a pattern to consider — it's the architecture. Every Maiden must formally maintain belief state, declare desires/goals, and commit intentions/plans as first-class data structures.

---

## RD-1 Progress Log

### 2026-02-26T16:00Z — Spike Structure Created

**DeepWiki Divergence Discovery**: The indexed jido_ai docs described an older API surface.
Actual v2.0.0-rc.0 differs significantly:

| DeepWiki Said | Reality |
|---|---|
| `use Jido.AI.ReActAgent` | `use Jido.AI.Agent` (ReAct implied) |
| `Jido.start_agent/2` | `Jido.AgentServer.start(agent: Module)` |
| JSON Schema maps in `schema/0` | NimbleOptions keyword lists in `use Jido.Action` |
| Discrete state machine | Delegated worker pattern (parent→child) |

**Files created**:
- `src/lib/maidens/melanie/elixir/mix.exs` — jido 2.0.0 + jido_ai 2.0.0-rc.0
- `src/lib/maidens/melanie/elixir/lib/maiden/melanie_runtime/agent.ex` — `use Jido.AI.Agent`
- `src/lib/maidens/melanie/elixir/lib/maiden/melanie_runtime/persona.ex` — system prompt, status, values
- `src/lib/maidens/melanie/elixir/lib/maiden/melanie_runtime/actions/semantic_search.ex` — mock tool
- `src/lib/maidens/melanie/elixir/lib/maiden/melanie_runtime/actions/summarize.ex` — mock tool
- `src/lib/maidens/melanie/elixir/lib/maiden/melanie_runtime/actions/find_connections.ex` — mock tool
- `src/lib/maidens/melanie/elixir/test/melanie_react_test.exs` — unit + live provider tests

**Test results**: 8 tests, 0 failures, 2 excluded (live provider tests need `ANTHROPIC_API_KEY`)

**Next**: Run live provider test with `ANTHROPIC_API_KEY` to validate full ReAct loop.

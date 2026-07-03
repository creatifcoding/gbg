# Research: GBG agent SDK / harness external patterns refresh

## Summary
The strongest external match for GBG’s OpenProse/Reactor direction is OpenProse/Reactor itself: declarative contracts, graph wiring, session-scoped world-models, and receipt-based deterministic wake/skip behavior. OpenAI Agents SDK/Codex, LangGraph, AutoGen, Claude Skills/MCP, and DMN each add a transferable pattern—memory, handoffs, runtime orchestration, capability packaging, or decision modeling—but none combine all of those as cleanly as the OpenProse/Reactor stack.

## Findings
1. **OpenProse/Reactor is the closest architectural analog to GBG’s own vocabulary** — contracts declare what stays true; Reactor compiles once, then deterministically skips/rerenders from fingerprint movement; workspace is private scratch, world-model is canonical truth, and receipts are the audit trail. This maps directly onto GBG’s OpenProse/Reactor, graph/memory/session, and capability-package framing. [OpenProse docs](https://docs.openprose.ai/) · [OpenProse VM](https://github.com/openprose/prose/blob/main/skills/open-prose/prose.md) · [filesystem state](https://github.com/openprose/prose/blob/main/skills/open-prose/state/filesystem.md)
2. **OpenAI Agents SDK gives a clear runtime pattern for session memory, delegation, and observability** — sessions preserve conversation history across runs, handoffs delegate to specialist agents, and tracing captures runs, tool calls, guardrails, and handoffs by default. For GBG, this is the most directly reusable evidence for a harness that needs stable memory + multi-agent routing + traceable execution. [Sessions](https://github.com/openai/openai-agents-python/blob/main/docs/sessions/index.md) · [Handoffs](https://openai.github.io/openai-agents-python/handoffs/) · [Tracing](https://openai.github.io/openai-agents-python/tracing/)
3. **Codex CLI is a useful operational harness pattern, not just a coding assistant** — it runs locally, can inspect/edit/run code, and `codex exec` supports non-interactive automation, JSONL output, sandboxing, and resume. For GBG, this is directly useful if you want a “developer/operator surface” around the harness (CI, triage, summaries, reproducible diffs). [Codex CLI](https://developers.openai.com/codex/cli) · [Non-interactive mode](https://developers.openai.com/codex/noninteractive)
4. **LangGraph is the clearest low-level graph runtime reference for stateful orchestration** — workflows are graphs of shared state, nodes, and edges; persistence, human-in-the-loop, and memory are first-class; and `Command`/interrupts support routing and resume. For GBG, this is the best external evidence for a graph-centered visual explainer (state, node, edge, checkpoint, interrupt, resume). [Overview](https://docs.langchain.com/oss/python/langgraph/overview) · [Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
5. **AutoGen is the strongest evidence for multi-agent team patterns** — the core runtime manages agent lifecycle and communication, while AgentChat provides team presets like round-robin, selector, swarm, and termination conditions. This is useful for GBG if you want to show “specialist team” orchestration rather than a single agent loop. [AutoGen overview](https://microsoft.github.io/autogen/stable/index.html) · [Agent runtime](https://microsoft.github.io/autogen/dev/user-guide/core-user-guide/framework/agent-and-agent-runtime.html) · [Teams](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html)
6. **Claude Skills + MCP are the best external evidence for capability packages** — Skills are filesystem-based, load progressively, and bundle instructions/code/resources; Claude Code plugins expose MCP tools with discoverable tool names. For GBG, this is the most transferable pattern for “capability packages” that are installable, composable, and on-demand. [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview?_rsc=1hesf&fcdaa149_sort_date=desc) · [MCP tool usage in Claude plugins](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/plugin-dev/skills/mcp-integration/references/tool-usage.md)
7. **DMN is useful as a decision-layer complement, not as the primary agent framework** — it models precise business decisions/rules and is designed to sit alongside BPMN/CMMN. For GBG, DMN is most transferable as a visual language for routing/approval/guardrail nodes when you need explicit decision tables rather than free-form agent reasoning. [DMN overview](https://www.omg.org/dmn/)

## Sources
- Kept: OpenProse docs (https://docs.openprose.ai/) — best public summary of the OpenProse/Reactor architecture and the exact concepts GBG already uses.
- Kept: OpenProse VM skill (https://github.com/openprose/prose/blob/main/skills/open-prose/prose.md) — primary execution semantics for the OpenProse VM.
- Kept: OpenProse filesystem state (https://github.com/openprose/prose/blob/main/skills/open-prose/state/filesystem.md) — canonical evidence for world-model/workspace/receipt separation.
- Kept: OpenAI Agents sessions (https://github.com/openai/openai-agents-python/blob/main/docs/sessions/index.md) — primary evidence for session memory across turns.
- Kept: OpenAI Agents handoffs (https://openai.github.io/openai-agents-python/handoffs/) — primary evidence for agent-to-agent delegation.
- Kept: OpenAI Agents tracing (https://openai.github.io/openai-agents-python/tracing/) — primary evidence for run observability.
- Kept: Codex CLI docs (https://developers.openai.com/codex/cli) — concrete local harness / developer-surface pattern.
- Kept: Codex non-interactive mode (https://developers.openai.com/codex/noninteractive) — concrete automation / CI pattern.
- Kept: LangGraph overview (https://docs.langchain.com/oss/python/langgraph/overview) — high-level runtime framing.
- Kept: LangGraph graph API (https://docs.langchain.com/oss/python/langgraph/graph-api) — node/state/edge mechanics and persistence behavior.
- Kept: AutoGen overview (https://microsoft.github.io/autogen/stable/index.html) — product-level framing of multi-agent systems.
- Kept: AutoGen agent runtime (https://microsoft.github.io/autogen/dev/user-guide/core-user-guide/framework/agent-and-agent-runtime.html) — runtime lifecycle and communication details.
- Kept: AutoGen teams (https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html) — concrete team patterns.
- Kept: Claude Agent Skills overview (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview?_rsc=1hesf&fcdaa149_sort_date=desc) — filesystem-based capability packaging and progressive disclosure.
- Kept: Claude plugins MCP tool usage (https://github.com/anthropics/claude-plugins-official/blob/main/plugins/plugin-dev/skills/mcp-integration/references/tool-usage.md) — official plugin-side MCP integration pattern.
- Kept: DMN overview (https://www.omg.org/dmn/) — formal decision-model reference.
- Dropped: OpenAI Agents `ref/handoffs` page — redundant API reference; the guide page was clearer and more directly usable.
- Dropped: GitHub repo copies of the OpenAI Agents docs — duplicates of the rendered docs with less editorial context.
- Dropped: Search-result snippets — useful for discovery, but not primary sources.

## Gaps
- No direct public evidence for GBG’s internal implementation was reviewed here, so the mapping to GBG is architectural rather than code-specific.
- OpenProse/Reactor public docs explicitly say benchmarks are pending; treat performance claims as design intent, not measured throughput.
- Claude Skills and MCP patterns are strong for capability packaging, but surface constraints differ by product (API vs Code vs claude.ai), so GBG should specify its own runtime assumptions.
- DMN is helpful only for the decision/routing slice; it does not replace an agent runtime or graph orchestrator.

## Supervisor coordination
Not needed.

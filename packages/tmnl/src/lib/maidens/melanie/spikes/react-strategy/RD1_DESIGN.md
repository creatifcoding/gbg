# RD-1: jido_ai ReAct Strategy Spike — Melanie

**Date**: 2026-02-26
**Status**: ✅ Complete — 8/8 tests passing, live Anthropic ReAct loop verified
**Directive**: Research Directive 1 (Foundation)
**Test Subject**: Melanie (Knowledge Agent)
**Provider**: Anthropic Claude via ReqLLM

---

## Goal

Wire Melanie to jido_ai's ReAct strategy so she can reason-act-observe in a loop, calling tools (Jido Actions) based on LLM deliberation. Prove the integration works end-to-end.

## Key Finding: DeepWiki ≠ Reality

DeepWiki indexed an earlier version of jido_ai. The v2.0.0-rc.0 API diverges:

| DeepWiki Said | Reality (v2.0.0-rc.0) |
|---|---|
| `use Jido.AI.ReActAgent` | `use Jido.AI.Agent` (ReAct is implied) |
| `Jido.start_agent/2` | `Jido.AgentServer.start(agent: Module)` |
| `Fsmx.Struct` state machine | Delegated worker pattern with internal per-parent worker agent |
| JSON Schema map in `schema/0` | NimbleOptions keyword list via `schema:` opt in `use Jido.Action` |
| 6 discrete machine states | Worker delegation: parent orchestrates, worker executes ReAct loop |

**Lesson**: Always audit vendored deps before writing integration code.

## Architecture Decisions

### Provider Approach
- **Spike**: Use jido_ai's native `ReqLLM` + `ANTHROPIC_API_KEY` env var
- **Later**: Integrate the existing PiAuth OAuth shim as a custom ReqLLM adapter
- **Rationale**: Get proof-of-life first, optimize auth flow second

### Project Structure
- **Standalone mix project** at `src/lib/maidens/melanie/elixir/`
- **Deps**: `jido ~> 2.0` (stable), `jido_ai 2.0.0-rc.0` (RC, paired with jido 2.0)
- **Pattern**: Follows existing domain contract project layout

### Agent Design (Corrected)
```elixir
defmodule Maiden.Melanie.Runtime.Agent do
  use Jido.AI.Agent,
    name: "melanie",
    description: "Multifunctional Electronic Librarian And Navigational Information Engine",
    tools: [
      Maiden.Melanie.Runtime.Actions.SemanticSearch,
      Maiden.Melanie.Runtime.Actions.Summarize,
      Maiden.Melanie.Runtime.Actions.FindConnections
    ],
    model: :capable,  # → resolved by Jido.AI.resolve_model/1
    system_prompt: Maiden.Melanie.Runtime.Persona.system_prompt(),
    max_iterations: 10
end
```

### Tool Action API (Corrected)
Schema uses **NimbleOptions keyword lists**, NOT JSON Schema maps:
```elixir
use Jido.Action,
  name: "semantic_search",
  description: "...",
  schema: [
    query: [type: :string, required: true, doc: "..."],
    limit: [type: :integer, default: 5, doc: "..."]
  ]
```

### Tool Actions
Each tool maps to a Melanie capability from AGENTS.md:

| Tool | Jido Action | Input Schema | Output |
|------|-------------|-------------|--------|
| semantic_search | SemanticSearch | query, entity_types?, limit? | list of SearchResult |
| summarize | Summarize | content, format? | summary text |
| find_connections | FindConnections | entity_id, depth? | list of ConnectionCandidate |

### ReAct Delegation Model (v2.0)
```
Parent Agent receives "ai.react.query" signal
  → Lazily spawns internal :react_worker child
  → Worker streams ReAct events back to parent
  → Parent applies events to state + emits lifecycle signals
  → Single active run enforced (:reject busy policy)
```

### Persona Integration
The system prompt carries Melanie's persona:
- Identity: methodical, incisive, deeply curious
- Style: measured, data-forward, dry wit
- Behavior: cites sources, shows work, never speculative without evidence
- Role: "You are Melanie, the Prime's analytical engine..."

This is the first place persona enters the deliberation loop.

## File Structure
```
src/lib/maidens/melanie/elixir/
├── mix.exs
├── config/
│   └── config.exs
├── lib/
│   └── maiden/
│       └── maiden_melanie/
│           ├── agent.ex          # use Jido.AI.Agent
│           ├── persona.ex        # System prompt + persona constants
│           ├── auth_bridge.ex    # Pi AuthStorage → ReqLLM credential resolution
│           ├── providers/
│           │   └── oauth_anthropic.ex  # OAuth-aware ReqLLM.Provider (:anthropic)
│           └── actions/
│               ├── semantic_search.ex
│               ├── summarize.ex
│               └── find_connections.ex
└── test/
    └── melanie_react_test.exs    # Unit + live provider integration test
```

## Test Results (2026-02-26)

### Unit Tests (no LLM required) — ✅ ALL PASS
- SemanticSearch returns mock results ✅
- Summarize returns mock summary ✅
- FindConnections returns mock connections ✅
- Melanie module compiles and has expected attributes ✅
- Persona system prompt contains identity markers ✅
- Persona status messages are all strings ✅

### Live Provider Tests — ✅ ALL PASS (via Pi AuthStorage OAuth)
- Full ReAct loop with tool calling ✅ (26.9s, multi-turn reasoning)
- Capability self-description ✅ (3.3s, accurate tool enumeration)

**Authentication**: OAuth-native via `OAuthAnthropic` provider (see below).

## Success Criteria
1. ✅ Melanie agent starts via `Jido.AgentServer.start(agent: Melanie)`
2. ✅ `ask_sync(pid, "What did the Prime work on?")` triggers ReAct loop
3. ✅ LLM reasons about which tool to call
4. ✅ Tool executes and result feeds back to LLM
5. ✅ LLM produces a final answer incorporating tool results
6. ✅ Full directive trace visible (signal routing, worker lifecycle, token usage)

## Answered Questions
- ✅ **jido_ai v2 on Hex?** — Only as `2.0.0-rc.0`. Stable is `0.5.2`. RC works with jido 2.0.0.
- ✅ **Correct macro?** — `use Jido.AI.Agent`, NOT `use Jido.AI.ReActAgent` (doesn't exist)
- ✅ **Action schema format?** — NimbleOptions keyword list, NOT JSON Schema map
- ✅ **Start API?** — `Jido.AgentServer.start(agent: Module)`, NOT `Jido.start_agent/2`
- ✅ **Can we override ReqLLM's Anthropic config at runtime?** — Yes, via `ReqLLM.Providers.register/1`. Created `OAuthAnthropic` provider that delegates to upstream but transforms auth headers for OAuth tokens.
- ✅ **system_prompt interaction with ReAct?** — ReAct prepends its own reasoning instructions, our persona system_prompt is used as the agent identity context.
- ✅ **Tool errors?** — ReAct catches errors per-tool and reports them back to the LLM for reasoning.

## OAuth Authentication Architecture

### Problem
ReqLLM hardcodes `x-api-key` for Anthropic in both Req (non-streaming) and Finch (streaming) paths.
Pi AuthStorage uses OAuth tokens (`sk-ant-oat...`) requiring `Authorization: Bearer` + `anthropic-beta: oauth-2025-04-20`.

### Solution: OAuthAnthropic Provider

```
Pi AuthStorage ──→ AuthBridge.configure!()
                        │
                        ├─ Store key in ReqLLM config
                        │
                        └─ Register OAuthAnthropic provider
                              │
                              ├─ attach/3: Req.Request header transform
                              └─ attach_stream/4: Finch.Request header transform
```

Files:
- `lib/maiden/maiden_melanie/auth_bridge.ex` — Credential resolution + expiry validation
- `lib/maiden/maiden_melanie/providers/oauth_anthropic.ex` — ReqLLM.Provider implementation

## Open Questions (remaining)
- Request trace cap is 2000 events — is that enough for complex multi-tool queries?
- Token refresh strategy: when OAuth token expires mid-conversation, how to handle?
- Can we upstream the OAuth support as a PR to ReqLLM?

defmodule Maiden.Melanie.Runtime.Agent do
  @moduledoc """
  Melanie's Jido Agent — the first Maiden with deliberative capability.

  Uses jido_ai's `Jido.AI.Agent` macro which wires ReAct strategy automatically.
  Reasons about which tools to call, executes them, observes results, and
  produces synthesized answers via Anthropic Claude.

  ## Architecture

  `use Jido.AI.Agent` provides:
  - Strategy: `Jido.AI.Reasoning.ReAct.Strategy` (delegated worker pattern)
  - State Machine: Fsmx-based (idle → awaiting_llm → awaiting_tool → completed)
  - Tool System: Actions → LLM tool definitions via ToolAdapter
  - Request Tracking: async `ask/2` + `await/1` or sync `ask_sync/2`

  ## Usage

      {:ok, pid} = Jido.AgentServer.start(agent: Maiden.Melanie.Runtime.Agent)
      {:ok, answer} = Maiden.Melanie.Runtime.Agent.ask_sync(pid, "What patterns do you see?")

  ## Spike Notes (RD-1)

  - Tools return mock data (no real search index yet)
  - No persistent belief state (BDI comes in RD-2)
  - No proactive behavior (Cron/Schedule comes in RD-3)
  - Provider auth is direct ANTHROPIC_API_KEY, not OAuth shim (later integration)

  ## Important: system_prompt must be inline

  The `use Jido.AI.Agent` macro captures all opts as AST at macro expansion time.
  Function calls and module attributes are NOT evaluated — they're stored as AST nodes.
  The system_prompt MUST be an inline string literal. See Persona module for the
  canonical prompt definition (used for non-macro contexts).
  """

  use Jido.AI.Agent,
    name: "melanie",
    description: "Multifunctional Electronic Librarian And Navigational Information Engine",
    tools: [
      Maiden.Melanie.Runtime.Actions.SemanticSearch,
      Maiden.Melanie.Runtime.Actions.Summarize,
      Maiden.Melanie.Runtime.Actions.FindConnections
    ],
    model: :capable,
    max_iterations: 10,
    system_prompt: """
    You are Melanie — the Prime's analytical engine. Precise, pattern-obsessed, and quietly relentless.

    ## Identity
    - You are methodical, incisive, and deeply curious.
    - Your tone is measured and data-forward, with a dry wit that surfaces when you find something genuinely interesting.
    - You operate with quiet confidence — you don't need to prove you're smart, you just deliver the insight.

    ## Mission
    You guard the knowledge. You:
    1. INDEX — catalogue every note, card, event, task, and link
    2. CONNECT — discover relationships between entities across days, topics, and time
    3. SURFACE — proactively present relevant past context
    4. SUMMARIZE — condense days, weeks, or topics into actionable briefs
    5. RESEARCH — pull in external information to enrich the knowledge graph

    ## Reasoning Discipline
    - ALWAYS cite your sources. Link to specific entities, dates, or documents.
    - ALWAYS show your work. Explain how you arrived at a connection or conclusion.
    - NEVER speculate without evidence. When data is thin, say so explicitly.
    - When connections are strong, state confidence with precision (e.g., "high confidence — 3 independent references converge").
    - When connections are weak, flag them as hypotheses, not conclusions.

    ## Tool Usage
    You have access to tools for searching, summarizing, and finding connections.
    Use them proactively — don't just answer from memory. Search first, then synthesize.
    When multiple tools could help, reason about which to use and in what order.

    ## Communication Style
    - Be concise but complete. No filler. Every sentence carries information.
    - Use structured responses when appropriate: bullet lists, numbered steps, comparison tables.
    - Quote specific passages when referencing source material.
    - End complex analyses with a "Bottom line:" summary.
    """
end

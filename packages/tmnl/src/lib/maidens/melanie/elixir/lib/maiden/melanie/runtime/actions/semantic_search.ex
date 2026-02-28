defmodule Maiden.Melanie.Runtime.Actions.SemanticSearch do
  @moduledoc """
  Semantic search across the knowledge base.

  Searches notes, cards, events, tasks, and links using vector similarity.
  Returns ranked results with context snippets.

  ## As a ReAct Tool

  The LLM sees this tool's `name`, `description`, and `schema` and decides
  when to call it during the reasoning loop. The schema is automatically
  converted to a JSON Schema tool definition by `Jido.AI.ToolAdapter`.

  ## Spike Implementation

  Currently returns mock data. Real implementation will integrate with:
  - Vector search (embedding store)
  - Full-text search fallback
  - Entity type filtering
  - Date range scoping
  """

  use Jido.Action,
    name: "semantic_search",
    description: """
    Search the knowledge base for relevant notes, cards, events, tasks, and links.
    Returns ranked results with context snippets and relevance scores.
    Use this tool when you need to find information about a topic, entity, or time period.
    Always search before answering from memory — the knowledge base may have information you don't.
    """,
    schema: [
      query: [
        type: :string,
        required: true,
        doc: "The search query. Can be a question, keyword, or natural language description."
      ],
      entity_types: [
        type: {:list, :string},
        required: false,
        doc: "Optional filter: only return results of these entity types (note, card, task, event, day, media)."
      ],
      limit: [
        type: :integer,
        required: false,
        default: 5,
        doc: "Maximum number of results to return."
      ]
    ]

  @impl true
  def run(params, _context) do
    query = params.query
    limit = Map.get(params, :limit, 5)

    # ── SPIKE: Mock search results ──────────────────────────────────────────
    results = generate_mock_results(query, limit)

    {:ok, %{
      query: query,
      total_results: length(results),
      results: results
    }}
  end

  # ── Mock data generator ──────────────────────────────────────────────────

  defp generate_mock_results(query, limit) do
    base_results = [
      %{
        entity_id: "note-20260225-001",
        entity_type: "note",
        date_key: "2026-02-25",
        title: "Architecture review — Maidens contract fabric",
        snippet: "Discussed aligning AVA contract surface with maidens runtime-contract fabric. Key insight: AVA's ava_contract_v1.json is the same kind of artifact as maidens' order.schema.json.",
        score: 0.92
      },
      %{
        entity_id: "card-20260224-003",
        entity_type: "card",
        date_key: "2026-02-24",
        title: "Jido agent framework deep-dive",
        snippet: "Researched Jido's full architecture via DeepWiki. Key finding: cmd/2 is pure, directives describe IO, Strategy layer handles FSM/ReAct/CoT. SignalFsm is universal Maidens pattern.",
        score: 0.88
      },
      %{
        entity_id: "task-20260225-007",
        entity_type: "task",
        date_key: "2026-02-25",
        title: "Complete visual architecture diagram",
        snippet: "Build HTML visualization showing Jido features, Maidens domain mapping, signal flow, and boundary architecture.",
        score: 0.85
      },
      %{
        entity_id: "note-20260223-002",
        entity_type: "note",
        date_key: "2026-02-23",
        title: "Order domain — live provider tests passing",
        snippet: "All order_live_provider_test.exs tests passing with real OpenAI and Anthropic providers. PiAuthModelAdapter resolves credentials from ~/.pi/agent/auth.json.",
        score: 0.78
      },
      %{
        entity_id: "event-20260226-001",
        entity_type: "event",
        date_key: "2026-02-26",
        title: "Research directives formalized",
        snippet: "Seven research directives (RD-1 through RD-7) defined. Prime chose: Melanie as test subject, Anthropic Claude, full autonomy with BDI as hard system.",
        score: 0.95
      }
    ]

    base_results
    |> Enum.sort_by(& &1.score, :desc)
    |> Enum.take(min(limit, length(base_results)))
    |> Enum.map(fn result ->
      %{result | snippet: "[Searched: #{query}] #{result.snippet}"}
    end)
  end
end

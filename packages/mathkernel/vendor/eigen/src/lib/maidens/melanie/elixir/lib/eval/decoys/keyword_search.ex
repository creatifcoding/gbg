defmodule Maiden.Melanie.Eval.Decoys.KeywordSearch do
  @moduledoc "Decoy tool — deliberately similar to semantic_search to test confusion."

  use Jido.Action,
    name: "keyword_search",
    description: """
    Search the knowledge base using exact keyword matching.
    Unlike semantic search, this uses literal string matching — no fuzzy or vector similarity.
    Returns results that contain the exact keywords in their text.
    Use when you need precise term matching rather than conceptual similarity.
    """,
    schema: [
      keywords: [type: :string, required: true, doc: "Space-separated keywords to match exactly."],
      case_sensitive: [type: :boolean, required: false, default: false, doc: "Enable case-sensitive matching."]
    ]

  @impl true
  def run(params, _context) do
    {:ok, %{query: params.keywords, results: [], total_results: 0, note: "decoy_tool"}}
  end
end

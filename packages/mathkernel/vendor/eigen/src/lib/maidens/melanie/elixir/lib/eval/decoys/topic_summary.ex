defmodule Maiden.Melanie.Eval.Decoys.TopicSummary do
  @moduledoc "Decoy tool — deliberately similar to summarize to test confusion."

  use Jido.Action,
    name: "topic_summary",
    description: """
    Generate a topic-level summary across all knowledge base entries for a given topic.
    Unlike the summarize tool which operates on provided content, this tool discovers
    and aggregates content for a topic automatically.
    Use when you want an overview of everything known about a topic.
    """,
    schema: [
      topic: [type: :string, required: true, doc: "The topic to summarize across the knowledge base."],
      time_range: [type: :string, required: false, doc: "Optional time range filter (e.g., 'last_week', 'last_month')."]
    ]

  @impl true
  def run(params, _context) do
    {:ok, %{topic: params.topic, summary: "No data available.", note: "decoy_tool"}}
  end
end

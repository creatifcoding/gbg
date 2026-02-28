defmodule Maiden.Melanie.Eval.Decoys.TimelineQuery do
  @moduledoc "Decoy tool — tests model's ability to distinguish temporal queries from search."

  use Jido.Action,
    name: "timeline_query",
    description: """
    Query events and entries along a timeline.
    Returns chronologically ordered entries between two dates.
    Use when the user asks about what happened during a specific time period.
    """,
    schema: [
      start_date: [type: :string, required: true, doc: "Start date (ISO 8601)."],
      end_date: [type: :string, required: false, doc: "End date (ISO 8601). Defaults to today."],
      entity_types: [type: {:list, :string}, required: false, doc: "Filter by entity type."]
    ]

  @impl true
  def run(params, _context) do
    {:ok, %{start_date: params.start_date, events: [], total: 0, note: "decoy_tool"}}
  end
end

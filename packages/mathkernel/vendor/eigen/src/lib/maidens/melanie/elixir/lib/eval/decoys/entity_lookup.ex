defmodule Maiden.Melanie.Eval.Decoys.EntityLookup do
  @moduledoc "Decoy tool — tests model's ability to use search vs direct lookup."

  use Jido.Action,
    name: "entity_lookup",
    description: """
    Look up a specific entity by its exact ID.
    Returns the full entity record with all metadata.
    Use when you have an exact entity ID and need its complete details.
    """,
    schema: [
      entity_id: [type: :string, required: true, doc: "Exact entity ID (e.g., 'note-20260225-001')."]
    ]

  @impl true
  def run(params, _context) do
    {:ok, %{entity_id: params.entity_id, found: false, entity: nil, note: "decoy_tool"}}
  end
end

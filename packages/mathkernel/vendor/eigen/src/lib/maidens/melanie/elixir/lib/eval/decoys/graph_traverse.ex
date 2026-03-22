defmodule Maiden.Melanie.Eval.Decoys.GraphTraverse do
  @moduledoc "Decoy tool — deliberately similar to find_connections to test confusion."

  use Jido.Action,
    name: "graph_traverse",
    description: """
    Traverse the knowledge graph starting from a node, following edges by type.
    Unlike find_connections which discovers relationships, this follows explicit
    graph edges (parent_of, child_of, references, cited_by).
    Use when you need to walk a specific relationship path in the graph.
    """,
    schema: [
      start_node: [type: :string, required: true, doc: "Starting node ID."],
      edge_type: [type: :string, required: false, doc: "Edge type to follow (e.g., 'references', 'parent_of')."],
      max_depth: [type: :integer, required: false, default: 3, doc: "Maximum traversal depth."]
    ]

  @impl true
  def run(params, _context) do
    {:ok, %{start_node: params.start_node, path: [], nodes_visited: 0, note: "decoy_tool"}}
  end
end

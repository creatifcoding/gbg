defmodule Maiden.Melanie.Runtime.Actions.FindConnections do
  @moduledoc """
  Discover non-obvious connections between entities in the knowledge base.

  Given an entity ID, searches for related entities based on semantic similarity,
  temporal proximity, shared references, and thematic overlap.

  ## As a ReAct Tool

  The LLM calls this when it notices potential connections or when the user
  asks about relationships between topics. This is Melanie's signature capability —
  finding what others miss.

  ## Spike Implementation

  Returns mock connections. Real implementation will:
  - Use graph traversal on the knowledge graph
  - Combine vector similarity with structural proximity
  - Score connections by multiple dimensions (semantic, temporal, structural)
  """

  use Jido.Action,
    name: "find_connections",
    description: """
    Discover connections between entities in the knowledge base.
    Given an entity ID, finds related entities through semantic similarity,
    shared references, temporal proximity, and thematic overlap.
    Returns connection candidates with confidence scores and explanations.
    Use this when you notice potential relationships or when asked about
    how topics connect.
    """,
    schema: [
      entity_id: [
        type: :string,
        required: true,
        doc: "The entity ID to find connections for (e.g., 'note-20260225-001')."
      ],
      depth: [
        type: :integer,
        required: false,
        default: 2,
        doc: "How many hops to traverse in the knowledge graph."
      ]
    ]

  @impl true
  def run(params, _context) do
    entity_id = params.entity_id
    depth = Map.get(params, :depth, 2)

    # ── SPIKE: Mock connections ──────────────────────────────────────────────
    connections = generate_mock_connections(entity_id, depth)

    {:ok, %{
      entity_id: entity_id,
      search_depth: depth,
      connections_found: length(connections),
      connections: connections
    }}
  end

  defp generate_mock_connections(_entity_id, _depth) do
    [
      %{
        source_id: "note-20260225-001",
        source_type: "note",
        target_id: "card-20260224-003",
        target_type: "card",
        relationship: "continues",
        reason: "Both discuss Jido agent architecture. The note extends the card's research with boundary pattern details.",
        confidence: 0.91
      },
      %{
        source_id: "note-20260225-001",
        source_type: "note",
        target_id: "event-20260226-001",
        target_type: "event",
        relationship: "inspired_by",
        reason: "The architecture review directly led to formalizing the research directives. Temporal and causal link.",
        confidence: 0.87
      },
      %{
        source_id: "note-20260225-001",
        source_type: "note",
        target_id: "note-20260223-002",
        target_type: "note",
        relationship: "references",
        reason: "Both reference the PiAuthModelAdapter and live provider integration. Shared technical concern.",
        confidence: 0.73
      }
    ]
  end
end

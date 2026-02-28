defmodule Maiden.Melanie.Eval.Variants.FindConnectionsOverSpecified do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.FindConnections,
    variant: :over_specified,
    description: """
    Discover connections between entities in the knowledge base.
    Given an entity ID, finds related entities through semantic similarity,
    shared references, temporal proximity, and thematic overlap.
    Returns connection candidates with confidence scores and explanations.

    When to use: After identifying an entity of interest (from search results, user mention,
    or a previous find_connections result), use this to discover related entities the user
    may not know about. Useful for building a picture of how topics interconnect across time.
    Also use when the user explicitly asks about relationships, dependencies, or connections.

    When NOT to use: When searching for general information (use semantic_search). When
    summarizing content (use summarize). When the entity ID is unknown — you must have a
    concrete entity_id from a prior search or mention. Do not fabricate entity IDs.

    Edge cases:
    - If the entity ID doesn't exist, the tool returns an empty connections list. This is not
      an error — it means the entity has no indexed connections at the requested depth.
    - depth=1 is fastest but may miss transitive connections. depth=2 is the default and
      usually sufficient. depth=3+ is expensive and rarely adds value.
    - Connections are bidirectional — if A connects to B, querying B will also show A.
    - Confidence scores below 0.5 should be treated as weak hypotheses, not strong links.
    - The relationship field describes the nature of the link (continues, references,
      inspired_by, contradicts, etc.).

    Output: {entity_id, search_depth, connections_found, connections[]} where each connection
    has {source_id, source_type, target_id, target_type, relationship, reason, confidence}.
    """
end

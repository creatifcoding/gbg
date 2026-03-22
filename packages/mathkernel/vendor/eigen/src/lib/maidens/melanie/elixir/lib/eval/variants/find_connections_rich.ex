defmodule Maiden.Melanie.Eval.Variants.FindConnectionsRich do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.FindConnections,
    variant: :rich,
    description: """
    Discover connections between entities in the knowledge base.
    Given an entity ID, finds related entities through semantic similarity,
    shared references, temporal proximity, and thematic overlap.
    Returns connection candidates with confidence scores and explanations.

    When to use: After identifying an entity of interest (from search results or user mention),
    use this to discover related entities the user may not know about. Also use when the user
    explicitly asks about relationships between topics.
    When NOT to use: When the user hasn't identified a specific entity. When you're looking
    for direct information (use semantic_search instead). When the entity ID is unknown.
    """
end

defmodule Maiden.Melanie.Eval.Variants.FindConnectionsRichExamples do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.FindConnections,
    variant: :rich_examples,
    description: """
    Discover connections between entities in the knowledge base.
    Given an entity ID, finds related entities through semantic similarity,
    shared references, temporal proximity, and thematic overlap.
    Returns connection candidates with confidence scores and explanations.

    When to use: After identifying an entity of interest, use this to discover related entities.
    When NOT to use: When searching for information (use semantic_search) or summarizing content.

    Example inputs:
    - {"entity_id": "note-20260225-001", "depth": 2} — find what connects to a specific note
    - {"entity_id": "card-20260224-003", "depth": 1} — shallow connection scan for a card
    """
end

defmodule Maiden.Melanie.Eval.Variants.FindConnectionsLean do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.FindConnections,
    variant: :lean,
    description: """
    Discover connections between entities in the knowledge base.
    Given an entity ID, finds related entities through semantic similarity,
    shared references, temporal proximity, and thematic overlap.
    Returns connection candidates with confidence scores and explanations.
    Use this when you notice potential relationships or when asked about
    how topics connect.
    """
end

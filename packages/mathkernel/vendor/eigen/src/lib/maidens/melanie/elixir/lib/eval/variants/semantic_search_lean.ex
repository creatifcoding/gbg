defmodule Maiden.Melanie.Eval.Variants.SemanticSearchLean do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.SemanticSearch,
    variant: :lean,
    description: """
    Search the knowledge base for relevant notes, cards, events, tasks, and links.
    Returns ranked results with context snippets and relevance scores.
    Use this tool when you need to find information about a topic, entity, or time period.
    Always search before answering from memory — the knowledge base may have information you don't.
    """
end

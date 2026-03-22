defmodule Maiden.Melanie.Eval.Variants.SemanticSearchRichExamples do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.SemanticSearch,
    variant: :rich_examples,
    description: """
    Search the knowledge base for relevant notes, cards, events, tasks, and links.
    Returns ranked results with context snippets and relevance scores.
    Use this tool when you need to find information about a topic, entity, or time period.
    Always search before answering from memory — the knowledge base may have information you don't.

    When to use: The user asks about a specific topic, event, entity, or date.
    When NOT to use: The user asks a general question that doesn't reference the knowledge base,
    or when you already have sufficient information from a previous search in this conversation.

    Example inputs:
    - {"query": "Jido agent architecture", "limit": 5} — find notes about Jido's design
    - {"query": "Feb 24 decisions", "entity_types": ["note", "event"], "limit": 10} — scoped by date and type
    """
end

defmodule Maiden.Melanie.Eval.Variants.SemanticSearchOverSpecified do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.SemanticSearch,
    variant: :over_specified,
    description: """
    Search the knowledge base for relevant notes, cards, events, tasks, and links.
    Returns ranked results with context snippets and relevance scores.
    Use this tool when you need to find information about a topic, entity, or time period.
    Always search before answering from memory — the knowledge base may have information you don't.

    When to use: The user asks about a specific topic, event, entity, or date. This includes
    direct factual lookups ("what happened on Feb 24"), thematic queries ("what do we know about
    alarm systems"), entity searches ("find all notes about Jido"), and temporal ranges
    ("what changed this week"). Also use when you need to verify a claim or find supporting
    evidence for a hypothesis.

    When NOT to use: The user asks a general question that doesn't reference the knowledge base,
    or when you already have sufficient information from a previous search. Do not search for
    information that is clearly outside the knowledge base scope (weather, stock prices, math
    computations). Do not re-search for the same query within a conversation unless the user
    explicitly asks you to look again.

    Edge cases to handle:
    - If the query returns zero results, consider broadening the search terms or removing filters.
    - If results seem irrelevant, try rephrasing the query with different keywords.
    - For date-scoped queries, use ISO format dates in the query string for best matching.
    - Entity type filters are optional — omit them for broad searches, include them when
      the user specifies a particular kind of content.
    - The limit parameter defaults to 5; increase it for comprehensive surveys, decrease for
      quick lookups.

    Return format: Array of {entity_id, entity_type, date_key, title, snippet, score} objects
    sorted by relevance score descending. Scores range from 0.0 to 1.0.
    """
end

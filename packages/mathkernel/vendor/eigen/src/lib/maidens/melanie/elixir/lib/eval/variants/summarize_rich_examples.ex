defmodule Maiden.Melanie.Eval.Variants.SummarizeRichExamples do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.Summarize,
    variant: :rich_examples,
    description: """
    Summarize a collection of content into a structured brief.
    Use after gathering search results or when the user asks for an overview.
    Supports formats: 'brief' (3-5 sentences), 'detailed' (full analysis),
    'bullets' (key points list), 'narrative' (story form).

    When to use: After search results are gathered and need synthesis, or when the user
    explicitly asks for a summary of a topic, period, or collection of items.
    When NOT to use: When the user wants raw search results, or when the content is
    already concise enough that summarization would lose important detail.

    Example inputs:
    - {"content": "Note 1: Jido uses cmd/2... Note 2: Strategies wrap...", "format": "brief"} — quick overview
    - {"content": "Five search results about OAuth integration...", "format": "bullets"} — key points extraction
    """
end

defmodule Maiden.Melanie.Eval.Variants.SummarizeLean do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.Summarize,
    variant: :lean,
    description: """
    Summarize a collection of content into a structured brief.
    Use after gathering search results or when the user asks for an overview.
    Supports formats: 'brief' (3-5 sentences), 'detailed' (full analysis),
    'bullets' (key points list), 'narrative' (story form).
    """
end

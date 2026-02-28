defmodule Maiden.Melanie.Eval.Variants.SummarizeOverSpecified do
  use Maiden.Melanie.Eval.ActionVariant,
    base: Maiden.Melanie.Runtime.Actions.Summarize,
    variant: :over_specified,
    description: """
    Summarize a collection of content into a structured brief.
    Use after gathering search results or when the user asks for an overview.
    Supports formats: 'brief' (3-5 sentences), 'detailed' (full analysis),
    'bullets' (key points list), 'narrative' (story form).

    When to use: After search results are gathered and need synthesis. Also when the user
    explicitly asks for a summary of a topic, period, or collection of items. Use 'brief'
    for quick overviews, 'detailed' for comprehensive analysis, 'bullets' for scannable
    key points, and 'narrative' for storytelling contexts.

    When NOT to use: When the user wants raw search results. When the content is already
    concise. When the user is asking for specific facts rather than synthesis. When you
    have not yet gathered content to summarize — search first, then summarize.

    Edge cases:
    - If content is very short (< 100 chars), summarization may not add value. Consider
      returning the content directly.
    - If content contains conflicting information, the summary should note the conflict
      rather than silently resolving it.
    - For 'bullets' format, aim for 5-7 key points. More than 10 defeats the purpose.
    - For 'brief' format, exactly 3-5 sentences. No more.
    - The content parameter accepts raw text, not structured objects. Serialize search
      results as text before passing.

    Output: {format, summary, word_count, generated_at} object.
    """
end

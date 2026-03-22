defmodule Maiden.Melanie.Runtime.Actions.Summarize do
  @moduledoc """
  Summarize content into structured briefs.

  Takes raw content (search results, notes, card collections) and produces
  a concise, structured summary with key points and action items.

  ## As a ReAct Tool

  The LLM sees this as a tool it can call after gathering search results.
  Typical ReAct flow: search → gather results → summarize → final answer.

  ## Spike Implementation

  Returns a mock summary. Real implementation will:
  - Accept structured content (not just text)
  - Use LLM for actual summarization (nested LLM call)
  - Support multiple formats (brief, detailed, bullet, narrative)
  """

  use Jido.Action,
    name: "summarize",
    description: """
    Summarize a collection of content into a structured brief.
    Use after gathering search results or when the user asks for an overview.
    Supports formats: 'brief' (3-5 sentences), 'detailed' (full analysis),
    'bullets' (key points list), 'narrative' (story form).
    """,
    schema: [
      content: [
        type: :string,
        required: true,
        doc: "The content to summarize. Can be raw text, search results, or a collection of notes."
      ],
      format: [
        type: {:in, [:brief, :detailed, :bullets, :narrative]},
        required: false,
        default: :brief,
        doc: "Summary format."
      ]
    ]

  @impl true
  def run(params, _context) do
    content = params.content
    format = Map.get(params, :format, :brief)

    # ── SPIKE: Mock summary ──────────────────────────────────────────────────
    summary = generate_mock_summary(content, format)

    {:ok, %{
      format: format,
      summary: summary,
      word_count: length(String.split(summary)),
      generated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }}
  end

  defp generate_mock_summary(content, :brief) do
    """
    The Prime has been focused on three converging workstreams: (1) closing the agency gap \
    in the Maidens system by integrating jido_ai's deliberative strategies, \
    (2) completing visual architecture documentation for the Jido×Maidens mapping, and \
    (3) formalizing seven research directives (RD-1 through RD-7) to evolve Maidens from \
    reactive FSM pipelines to fully autonomous BDI agents. Key decision: full autonomy with \
    BDI as a hard system, Anthropic Claude as the LLM provider.

    [Source content length: #{String.length(content)} chars]
    """
  end

  defp generate_mock_summary(content, :bullets) do
    """
    Key points:
    • Agency gap identified: Maidens use ~30% of Jido's capability surface
    • Missing: deliberation, proactive behavior, persona-as-state, goals, LLM reasoning
    • jido_ai discovery: 6 reasoning strategies (ReAct, CoT, ToT, GoT, TRM, Adaptive)
    • Research directive RD-1: wire Melanie to ReAct strategy (proof of life)
    • Prime's direction: Melanie as test subject, full autonomy, BDI as hard system
    • Provider: Anthropic Claude via existing API access

    [Source content length: #{String.length(content)} chars]
    """
  end

  defp generate_mock_summary(content, _format) do
    "Summary of #{String.length(content)} characters of content. " <>
    "Multiple workstreams converge on evolving Maidens from reactive to agentic architecture."
  end
end

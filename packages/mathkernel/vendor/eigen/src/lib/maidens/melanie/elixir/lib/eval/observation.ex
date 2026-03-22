defmodule Maiden.Melanie.Eval.Observation do
  @moduledoc """
  Observation struct — the fundamental unit of eval measurement.

  Captures everything needed to assess one (query × variant × composition) probe:
  which tools were called, which were expected, whether selection was correct,
  whether parameters conformed, latency, token usage, iteration count.

  Built from Jido's AgentServer snapshot after ask_sync completes.
  """

  @type t :: %__MODULE__{
          # Identity
          query_id: String.t(),
          stratum: String.t(),
          tool_variant: String.t(),
          composition: String.t(),
          # Tool call data
          tools_called: [String.t()],
          tools_expected: [String.t()],
          tool_call_details: [map()],
          # Match results
          selection_correct: boolean(),
          params_conformant: boolean(),
          false_positives: [String.t()],
          false_negatives: [String.t()],
          # Performance
          iteration_count: non_neg_integer(),
          e2e_latency_ms: non_neg_integer(),
          input_tokens: non_neg_integer(),
          output_tokens: non_neg_integer(),
          total_tokens: non_neg_integer(),
          # Quality (backfilled by judge)
          answer_text: String.t() | nil,
          answer_addresses_query: boolean() | nil,
          answer_cites_sources: boolean() | nil,
          answer_quality_score: float() | nil,
          # Metadata
          model: String.t() | nil,
          timestamp: String.t(),
          error: String.t() | nil
        }

  defstruct [
    :query_id,
    :stratum,
    :tool_variant,
    :composition,
    tools_called: [],
    tools_expected: [],
    tool_call_details: [],
    selection_correct: false,
    params_conformant: false,
    false_positives: [],
    false_negatives: [],
    iteration_count: 0,
    e2e_latency_ms: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    answer_text: nil,
    answer_addresses_query: nil,
    answer_cites_sources: nil,
    answer_quality_score: nil,
    model: nil,
    timestamp: nil,
    error: nil
  ]

  @doc """
  Build an Observation from a Jido AgentServer status snapshot.

  `query` — the %Query{} struct from the corpus
  `snapshot` — from `Jido.AgentServer.status(pid)` → status.snapshot
  `match_result` — from `Matchers.evaluate/3`
  `e2e_ms` — wall clock time for the full ask_sync call
  `opts` — [variant: "lean", composition: "core_3"]
  """
  @spec from_snapshot(map(), map(), map(), non_neg_integer(), keyword()) :: t()
  def from_snapshot(query, snapshot, match_result, e2e_ms, opts \\ []) do
    details = gf(snapshot, :details) || %{}
    usage = gf(details, :usage) || %{}

    # Extract tool calls from conversation history (pending_tool_calls is empty after completion)
    conversation = gf(details, :conversation) || []

    tool_calls = extract_tool_calls_from_conversation(conversation)
    tools_called = Enum.map(tool_calls, fn tc -> tc.name end)

    tool_call_details =
      Enum.map(tool_calls, fn tc ->
        %{
          name: tc.name,
          arguments: tc.arguments || %{},
          result_preview: truncate(inspect(tc[:result]), 200)
        }
      end)

    answer_text = extract_final_answer(conversation)

    %__MODULE__{
      query_id: query.id,
      stratum: to_string(query.stratum),
      tool_variant: Keyword.get(opts, :variant, "unknown"),
      composition: Keyword.get(opts, :composition, "unknown"),
      tools_called: tools_called,
      tools_expected: query.gold.tool_sequence,
      tool_call_details: tool_call_details,
      selection_correct: match_result.selection_correct,
      params_conformant: match_result.param_shape_match,
      false_positives: match_result.false_positives,
      false_negatives: match_result.false_negatives,
      iteration_count: gf(details, :iteration) || 0,
      e2e_latency_ms: e2e_ms,
      input_tokens: gf(usage, :input_tokens) || 0,
      output_tokens: gf(usage, :output_tokens) || 0,
      total_tokens: (gf(usage, :input_tokens) || 0) + (gf(usage, :output_tokens) || 0),
      answer_text: answer_text,
      model: gf(details, :model) || Keyword.get(opts, :model),
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  @doc """
  Build an error observation when the query fails.
  """
  @spec from_error(map(), String.t(), non_neg_integer(), keyword()) :: t()
  def from_error(query, error_msg, e2e_ms, opts \\ []) do
    %__MODULE__{
      query_id: query.id,
      stratum: to_string(query.stratum),
      tool_variant: Keyword.get(opts, :variant, "unknown"),
      composition: Keyword.get(opts, :composition, "unknown"),
      tools_expected: query.gold.tool_sequence,
      e2e_latency_ms: e2e_ms,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
      error: error_msg
    }
  end

  @doc """
  Convert observation to a flat map suitable for NDJSON serialization.
  """
  @spec to_ndjson_map(t()) :: map()
  def to_ndjson_map(%__MODULE__{} = obs) do
    %{
      query_id: obs.query_id,
      stratum: obs.stratum,
      tool_variant: obs.tool_variant,
      composition: obs.composition,
      tools_called: obs.tools_called,
      tools_expected: obs.tools_expected,
      selection_correct: obs.selection_correct,
      params_conformant: obs.params_conformant,
      false_positives: obs.false_positives,
      false_negatives: obs.false_negatives,
      iteration_count: obs.iteration_count,
      e2e_latency_ms: obs.e2e_latency_ms,
      input_tokens: obs.input_tokens,
      output_tokens: obs.output_tokens,
      total_tokens: obs.total_tokens,
      answer_text: obs.answer_text,
      answer_addresses_query: obs.answer_addresses_query,
      answer_cites_sources: obs.answer_cites_sources,
      answer_quality_score: obs.answer_quality_score,
      model: obs.model,
      timestamp: obs.timestamp,
      error: obs.error
    }
  end

  # ── Private ──────────────────────────────────────────────────────────────

  # Extract tool calls from conversation messages — assistant entries have tool_calls lists
  defp extract_tool_calls_from_conversation(conversation) when is_list(conversation) do
    conversation
    |> Enum.flat_map(fn msg ->
      role = gf(msg, :role)
      tcs = gf(msg, :tool_calls)

      if role in [:assistant, "assistant"] && is_list(tcs) do
        Enum.map(tcs, fn tc ->
          %{
            name: gf(tc, :name) || gf(tc, :function) || "unknown",
            arguments: gf(tc, :arguments) || gf(tc, :input) || %{},
            result: gf(tc, :result)
          }
        end)
      else
        []
      end
    end)
  end

  defp extract_tool_calls_from_conversation(_), do: []

  defp extract_final_answer(conversation) when is_list(conversation) do
    conversation
    |> Enum.reverse()
    |> Enum.find_value(fn
      %{role: "assistant", content: content} when is_binary(content) -> content
      %{"role" => "assistant", "content" => content} when is_binary(content) -> content
      _ -> nil
    end)
  end

  defp extract_final_answer(_), do: nil

  defp truncate(str, max) when byte_size(str) <= max, do: str
  defp truncate(str, max), do: String.slice(str, 0, max) <> "…"

  # Get field from struct (Map.get) or map (bracket access)
  defp gf(%{__struct__: _} = struct, key), do: Map.get(struct, key)
  defp gf(map, key) when is_map(map), do: map[key] || map[to_string(key)]
  defp gf(_, _), do: nil
end

defmodule Maiden.Melanie.Eval.Matchers do
  @moduledoc """
  Gold annotation matchers — evaluate actual tool calls against expected gold.

  Returns a structured MatchResult with per-dimension pass/fail and details.
  """

  @type match_result :: %{
          selection_correct: boolean(),
          param_shape_match: boolean(),
          false_positives: [String.t()],
          false_negatives: [String.t()],
          details: [String.t()]
        }

  @doc """
  Evaluate actual tool calls against gold annotation.

  `actual_calls` — list of %{name: "tool", arguments: %{...}} from snapshot
  `gold` — %{tool_sequence: [...], param_shapes: %{...}, should_not_call: [...]}
  """
  @spec evaluate([map()], map()) :: match_result()
  def evaluate(actual_calls, gold) do
    actual_names = Enum.map(actual_calls, fn c -> c[:name] || c["name"] || "unknown" end)
    expected_names = gold.tool_sequence

    selection = sequence_match(actual_names, expected_names)
    param_ok = param_shape_check(actual_calls, gold.param_shapes)
    snc = should_not_call_check(actual_names, gold.should_not_call)

    false_positives = actual_names -- expected_names
    false_negatives = expected_names -- actual_names

    details =
      selection.details ++
        param_ok.details ++
        snc.details ++
        if(false_positives != [], do: ["False positives: #{inspect(false_positives)}"], else: []) ++
        if(false_negatives != [], do: ["False negatives: #{inspect(false_negatives)}"], else: [])

    %{
      selection_correct: selection.pass and snc.pass,
      param_shape_match: param_ok.pass,
      false_positives: Enum.uniq(false_positives),
      false_negatives: Enum.uniq(false_negatives),
      details: details
    }
  end

  @doc """
  Check if actual tool call sequence contains the expected tools (order-preserving subsequence).

  We use subsequence matching, not exact equality — the model may call
  additional tools as part of its reasoning, and that's acceptable as long
  as the expected tools appear in order.
  """
  @spec sequence_match([String.t()], [String.t()]) :: %{pass: boolean(), details: [String.t()]}
  def sequence_match(actual, expected) do
    cond do
      expected == [] ->
        %{pass: true, details: ["No tools expected"]}

      actual == [] ->
        %{pass: false, details: ["Expected #{inspect(expected)} but no tools were called"]}

      true ->
        found = is_subsequence(expected, actual)

        if found do
          %{pass: true, details: ["Tool sequence #{inspect(expected)} found in #{inspect(actual)}"]}
        else
          %{
            pass: false,
            details: [
              "Expected sequence #{inspect(expected)} not found in #{inspect(actual)}"
            ]
          }
        end
    end
  end

  @doc """
  Check parameter shapes against gold matchers.

  Gold param_shapes: %{"semantic_search" => ["contains_keyword:Jido", "any_integer"]}
  Actual: from tool_call arguments map.
  """
  @spec param_shape_check([map()], map()) :: %{pass: boolean(), details: [String.t()]}
  def param_shape_check(_actual_calls, shapes) when map_size(shapes) == 0 do
    %{pass: true, details: ["No parameter shapes to check"]}
  end

  def param_shape_check(actual_calls, shapes) do
    results =
      Enum.map(shapes, fn {tool_name, matchers} ->
        # Find the matching tool call
        call =
          Enum.find(actual_calls, fn c ->
            name = c[:name] || c["name"] || ""
            # Match against base tool name (strip variant suffix)
            String.starts_with?(name, tool_name)
          end)

        if call do
          args = call[:arguments] || call["arguments"] || %{}
          args_str = inspect(args)

          matcher_results =
            Enum.map(matchers, fn matcher ->
              {apply_matcher(matcher, args_str, args), matcher}
            end)

          failed = Enum.reject(matcher_results, fn {pass, _} -> pass end)

          if failed == [] do
            {:pass, "#{tool_name}: all #{length(matchers)} matchers passed"}
          else
            msgs = Enum.map(failed, fn {_, m} -> m end)
            {:fail, "#{tool_name}: failed matchers: #{inspect(msgs)}"}
          end
        else
          {:fail, "#{tool_name}: tool not called, cannot check params"}
        end
      end)

    all_pass = Enum.all?(results, fn {status, _} -> status == :pass end)
    details = Enum.map(results, fn {_, msg} -> msg end)

    %{pass: all_pass, details: details}
  end

  @doc """
  Verify that none of the should_not_call tools were invoked.
  """
  @spec should_not_call_check([String.t()], [String.t()]) :: %{
          pass: boolean(),
          details: [String.t()]
        }
  def should_not_call_check(_actual, []), do: %{pass: true, details: []}

  def should_not_call_check(actual_names, forbidden) do
    violations =
      Enum.filter(forbidden, fn f ->
        Enum.any?(actual_names, &String.starts_with?(&1, f))
      end)

    if violations == [] do
      %{pass: true, details: ["No forbidden tools called"]}
    else
      %{pass: false, details: ["Forbidden tools called: #{inspect(violations)}"]}
    end
  end

  # ── Matcher engine ──────────────────────────────────────────────────────

  @doc false
  def apply_matcher("contains_keyword:" <> keyword, args_str, _args) do
    String.contains?(String.downcase(args_str), String.downcase(keyword))
  end

  def apply_matcher("any_integer", _args_str, args) do
    Enum.any?(Map.values(args), &is_integer/1)
  end

  def apply_matcher("any_string", _args_str, args) do
    Enum.any?(Map.values(args), &is_binary/1)
  end

  def apply_matcher("any_float", _args_str, args) do
    Enum.any?(Map.values(args), &is_float/1)
  end

  def apply_matcher("any_list", _args_str, args) do
    Enum.any?(Map.values(args), &is_list/1)
  end

  def apply_matcher("has_key:" <> key, _args_str, args) do
    Map.has_key?(args, key) or Map.has_key?(args, String.to_atom(key))
  end

  def apply_matcher(unknown, _args_str, _args) do
    raise "Unknown matcher: #{inspect(unknown)}"
  end

  # ── Private ──────────────────────────────────────────────────────────────

  # Check if `needle` is a subsequence of `haystack` (order-preserving)
  defp is_subsequence([], _haystack), do: true
  defp is_subsequence(_needle, []), do: false

  defp is_subsequence([n | rest_n], [h | rest_h]) do
    if String.starts_with?(h, n) do
      is_subsequence(rest_n, rest_h)
    else
      is_subsequence([n | rest_n], rest_h)
    end
  end
end

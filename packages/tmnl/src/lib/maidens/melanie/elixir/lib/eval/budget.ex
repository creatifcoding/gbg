defmodule Maiden.Melanie.Eval.Budget do
  @moduledoc """
  Pre-run cost estimator for the eval harness.

  Computes total calls, estimated time, tokens, and API cost before executing.
  Supports budget caps to prevent runaway spend.
  """

  @type t :: %__MODULE__{
          total_calls: non_neg_integer(),
          estimated_time_s: float(),
          estimated_input_tokens: non_neg_integer(),
          estimated_output_tokens: non_neg_integer(),
          estimated_cost_usd: float(),
          effective_rpm: float(),
          breakdown: map()
        }

  defstruct [
    :total_calls,
    :estimated_time_s,
    :estimated_input_tokens,
    :estimated_output_tokens,
    :estimated_cost_usd,
    :effective_rpm,
    :breakdown
  ]

  # Default token estimates per variant (tool definitions only, per tool)
  @variant_tokens %{
    minimal: 100,
    lean: 280,
    rich: 470,
    rich_examples: 830,
    over_specified: 1330
  }

  # Per-query overhead
  @system_prompt_tokens 346
  @avg_query_tokens 50
  @avg_response_tokens 400
  @avg_iterations 2

  # Sonnet 4 pricing (Feb 2026)
  @default_pricing %{
    input_per_m: 3.0,
    output_per_m: 15.0
  }

  @doc """
  Compute a budget estimate for an eval run.

  ## Options

  - `:corpus_size` — number of queries (default 75)
  - `:variants` — list of variant atoms (default all 5)
  - `:compositions` — list of composition names with tool counts (default [{:core_3, 3}])
  - `:concurrency` — parallel AgentServers (default 5)
  - `:avg_latency_ms` — per-query latency estimate (default 5000)
  - `:pricing` — %{input_per_m: float, output_per_m: float}
  - `:judge_sample_rate` — fraction of results to judge (default 0.2)
  - `:judge_tokens_per` — tokens per judge call (default 500 in + 200 out)
  """
  @spec estimate(keyword()) :: t()
  def estimate(opts \\ []) do
    corpus_size = Keyword.get(opts, :corpus_size, 75)
    variants = Keyword.get(opts, :variants, Map.keys(@variant_tokens))
    compositions = Keyword.get(opts, :compositions, [{:core_3, 3}])
    concurrency = Keyword.get(opts, :concurrency, 5)
    avg_latency_ms = Keyword.get(opts, :avg_latency_ms, 5000)
    pricing = Keyword.get(opts, :pricing, @default_pricing)
    judge_sample_rate = Keyword.get(opts, :judge_sample_rate, 0.2)

    variant_count = length(variants)
    composition_count = length(compositions)

    total_calls = corpus_size * variant_count * composition_count

    # Time estimate
    batches = ceil(total_calls / concurrency)
    estimated_time_s = batches * (avg_latency_ms / 1000)

    # Token estimates per call
    per_call_tokens =
      for variant <- variants,
          {_comp_name, tool_count} <- compositions do
        tool_tokens = Map.get(@variant_tokens, variant, 280) * tool_count
        input = @system_prompt_tokens + tool_tokens + @avg_query_tokens
        # Multi-iteration: roughly input * iterations for subsequent turns
        total_input = input + input * (@avg_iterations - 1) * 0.4
        output = @avg_response_tokens * @avg_iterations

        %{variant: variant, input: round(total_input), output: round(output)}
      end

    total_input = Enum.sum(Enum.map(per_call_tokens, & &1.input)) * corpus_size
    total_output = Enum.sum(Enum.map(per_call_tokens, & &1.output)) * corpus_size

    # Judge pass cost
    judge_calls = round(total_calls * judge_sample_rate)
    judge_input = judge_calls * 500
    judge_output = judge_calls * 200

    grand_input = total_input + judge_input
    grand_output = total_output + judge_output

    cost_input = grand_input / 1_000_000 * pricing.input_per_m
    cost_output = grand_output / 1_000_000 * pricing.output_per_m
    total_cost = cost_input + cost_output

    effective_rpm = if estimated_time_s > 0, do: total_calls / estimated_time_s * 60, else: 0

    %__MODULE__{
      total_calls: total_calls,
      estimated_time_s: Float.round(estimated_time_s, 1),
      estimated_input_tokens: grand_input,
      estimated_output_tokens: grand_output,
      estimated_cost_usd: Float.round(total_cost, 2),
      effective_rpm: Float.round(effective_rpm, 1),
      breakdown: %{
        corpus_size: corpus_size,
        variant_count: variant_count,
        composition_count: composition_count,
        concurrency: concurrency,
        judge_calls: judge_calls,
        judge_cost_usd: Float.round((judge_input / 1_000_000 * pricing.input_per_m) + (judge_output / 1_000_000 * pricing.output_per_m), 2),
        main_cost_usd: Float.round(cost_input + cost_output - ((judge_input / 1_000_000 * pricing.input_per_m) + (judge_output / 1_000_000 * pricing.output_per_m)), 2)
      }
    }
  end

  @doc """
  Check if estimated cost is within budget. Returns :ok or {:over_budget, estimate}.
  """
  @spec check(t(), float()) :: :ok | {:over_budget, t()}
  def check(%__MODULE__{} = budget, max_cost_usd) do
    if budget.estimated_cost_usd <= max_cost_usd do
      :ok
    else
      {:over_budget, budget}
    end
  end

  @doc "Format budget as a human-readable string."
  @spec format(t()) :: String.t()
  def format(%__MODULE__{} = b) do
    """
    ╔══════════════════════════════════════════════╗
    ║          EVAL HARNESS BUDGET ESTIMATE        ║
    ╠══════════════════════════════════════════════╣
    ║ Total API calls:     #{String.pad_leading("#{b.total_calls}", 10)}         ║
    ║ Estimated time:      #{String.pad_leading("#{b.estimated_time_s}s", 10)}         ║
    ║ Input tokens:        #{String.pad_leading("#{format_tokens(b.estimated_input_tokens)}", 10)}         ║
    ║ Output tokens:       #{String.pad_leading("#{format_tokens(b.estimated_output_tokens)}", 10)}         ║
    ║ Effective RPM:       #{String.pad_leading("#{b.effective_rpm}", 10)}         ║
    ╠══════════════════════════════════════════════╣
    ║ Estimated cost:       $#{String.pad_leading("#{b.estimated_cost_usd}", 9)}         ║
    ║   Main eval:          $#{String.pad_leading("#{b.breakdown.main_cost_usd}", 9)}         ║
    ║   Judge pass:         $#{String.pad_leading("#{b.breakdown.judge_cost_usd}", 9)}         ║
    ╠══════════════════════════════════════════════╣
    ║ Queries: #{b.breakdown.corpus_size} │ Variants: #{b.breakdown.variant_count} │ Compositions: #{b.breakdown.composition_count}  ║
    ║ Concurrency: #{b.breakdown.concurrency} │ Judge calls: #{b.breakdown.judge_calls}              ║
    ╚══════════════════════════════════════════════╝
    """
  end

  @doc "Convert budget to a JSON-serializable map."
  @spec to_json(t()) :: map()
  def to_json(%__MODULE__{} = b) do
    %{
      total_calls: b.total_calls,
      estimated_time_s: b.estimated_time_s,
      estimated_input_tokens: b.estimated_input_tokens,
      estimated_output_tokens: b.estimated_output_tokens,
      estimated_cost_usd: b.estimated_cost_usd,
      effective_rpm: b.effective_rpm,
      breakdown: b.breakdown
    }
  end

  defp format_tokens(n) when n >= 1_000_000, do: "#{Float.round(n / 1_000_000, 1)}M"
  defp format_tokens(n) when n >= 1_000, do: "#{Float.round(n / 1_000, 1)}K"
  defp format_tokens(n), do: "#{n}"
end

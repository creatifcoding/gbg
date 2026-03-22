defmodule Maiden.Melanie.Eval.BudgetTest do
  use ExUnit.Case, async: true

  alias Maiden.Melanie.Eval.Budget

  describe "budget estimation" do
    test "full matrix estimate produces reasonable numbers" do
      budget =
        Budget.estimate(
          corpus_size: 75,
          variants: [:minimal, :lean, :rich, :rich_examples, :over_specified],
          compositions: [{:core_3, 3}, {:core_5, 5}, {:core_5_decoys, 8}, {:scaled_15, 15}]
        )

      assert budget.total_calls == 75 * 5 * 4
      assert budget.estimated_cost_usd > 5.0
      assert budget.estimated_cost_usd < 75.0
      assert budget.estimated_time_s > 0
      assert budget.estimated_input_tokens > 0
      assert budget.estimated_output_tokens > 0
    end

    test "diagonal slice is much cheaper" do
      budget =
        Budget.estimate(
          corpus_size: 75,
          variants: [:lean],
          compositions: [{:core_3, 3}]
        )

      assert budget.total_calls == 75
      assert budget.estimated_cost_usd < 5.0
    end

    test "budget check passes when under cap" do
      budget = Budget.estimate(corpus_size: 10, variants: [:lean], compositions: [{:core_3, 3}])
      assert :ok = Budget.check(budget, 100.0)
    end

    test "budget check fails when over cap" do
      budget =
        Budget.estimate(
          corpus_size: 75,
          variants: [:minimal, :lean, :rich, :rich_examples, :over_specified],
          compositions: [{:core_3, 3}, {:core_5, 5}, {:core_5_decoys, 8}, {:scaled_15, 15}]
        )

      assert {:over_budget, ^budget} = Budget.check(budget, 0.01)
    end

    test "format produces readable string" do
      budget = Budget.estimate(corpus_size: 75, variants: [:lean], compositions: [{:core_3, 3}])
      formatted = Budget.format(budget)

      assert formatted =~ "EVAL HARNESS BUDGET ESTIMATE"
      assert formatted =~ "Total API calls"
      assert formatted =~ "Estimated cost"
    end

    test "to_json produces a serializable map" do
      budget = Budget.estimate(corpus_size: 10, variants: [:lean], compositions: [{:core_3, 3}])
      json = Budget.to_json(budget)

      assert is_map(json)
      assert json.total_calls == 10
      assert is_float(json.estimated_cost_usd)

      # Should be JSON-encodable
      assert {:ok, _} = Jason.encode(json)
    end

    test "more variants increases cost" do
      small = Budget.estimate(corpus_size: 75, variants: [:lean], compositions: [{:core_3, 3}])
      large = Budget.estimate(corpus_size: 75, variants: [:lean, :rich, :over_specified], compositions: [{:core_3, 3}])

      assert large.estimated_cost_usd > small.estimated_cost_usd
      assert large.total_calls > small.total_calls
    end

    test "breakdown includes judge cost" do
      budget = Budget.estimate(corpus_size: 100, variants: [:lean], compositions: [{:core_3, 3}])

      assert budget.breakdown.judge_calls > 0
      assert budget.breakdown.judge_cost_usd >= 0
    end
  end
end

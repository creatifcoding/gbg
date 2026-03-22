defmodule Maiden.Melanie.Eval.MatchersTest do
  use ExUnit.Case, async: true

  alias Maiden.Melanie.Eval.Matchers

  describe "sequence_match/2" do
    test "exact match" do
      result = Matchers.sequence_match(["semantic_search", "summarize"], ["semantic_search", "summarize"])
      assert result.pass
    end

    test "subsequence match — extra tools in actual" do
      result = Matchers.sequence_match(
        ["semantic_search", "find_connections", "summarize"],
        ["semantic_search", "summarize"]
      )
      assert result.pass
    end

    test "wrong order fails" do
      result = Matchers.sequence_match(
        ["summarize", "semantic_search"],
        ["semantic_search", "summarize"]
      )
      refute result.pass
    end

    test "missing expected tool fails" do
      result = Matchers.sequence_match(
        ["semantic_search"],
        ["semantic_search", "summarize"]
      )
      refute result.pass
    end

    test "empty expected always passes" do
      result = Matchers.sequence_match(["semantic_search"], [])
      assert result.pass
    end

    test "empty actual with expected tools fails" do
      result = Matchers.sequence_match([], ["semantic_search"])
      refute result.pass
    end

    test "variant name prefix matching" do
      result = Matchers.sequence_match(
        ["semantic_search_lean", "summarize_lean"],
        ["semantic_search", "summarize"]
      )
      assert result.pass
    end
  end

  describe "param_shape_check/2" do
    test "contains_keyword match" do
      calls = [%{name: "semantic_search", arguments: %{"query" => "Jido architecture"}}]
      shapes = %{"semantic_search" => ["contains_keyword:Jido"]}

      result = Matchers.param_shape_check(calls, shapes)
      assert result.pass
    end

    test "contains_keyword miss" do
      calls = [%{name: "semantic_search", arguments: %{"query" => "OAuth integration"}}]
      shapes = %{"semantic_search" => ["contains_keyword:Jido"]}

      result = Matchers.param_shape_check(calls, shapes)
      refute result.pass
    end

    test "any_integer match" do
      calls = [%{name: "semantic_search", arguments: %{"query" => "test", "limit" => 5}}]
      shapes = %{"semantic_search" => ["any_integer"]}

      result = Matchers.param_shape_check(calls, shapes)
      assert result.pass
    end

    test "any_string match" do
      calls = [%{name: "semantic_search", arguments: %{"query" => "test"}}]
      shapes = %{"semantic_search" => ["any_string"]}

      result = Matchers.param_shape_check(calls, shapes)
      assert result.pass
    end

    test "has_key match" do
      calls = [%{name: "semantic_search", arguments: %{"query" => "test", "limit" => 5}}]
      shapes = %{"semantic_search" => ["has_key:query"]}

      result = Matchers.param_shape_check(calls, shapes)
      assert result.pass
    end

    test "empty shapes always passes" do
      result = Matchers.param_shape_check([%{name: "x", arguments: %{}}], %{})
      assert result.pass
    end

    test "tool not called fails param check" do
      calls = [%{name: "summarize", arguments: %{}}]
      shapes = %{"semantic_search" => ["any_string"]}

      result = Matchers.param_shape_check(calls, shapes)
      refute result.pass
    end

    test "case insensitive keyword matching" do
      calls = [%{name: "semantic_search", arguments: %{"query" => "JIDO Architecture"}}]
      shapes = %{"semantic_search" => ["contains_keyword:jido"]}

      result = Matchers.param_shape_check(calls, shapes)
      assert result.pass
    end
  end

  describe "should_not_call_check/2" do
    test "clean — no forbidden tools called" do
      result = Matchers.should_not_call_check(
        ["semantic_search", "summarize"],
        ["find_connections"]
      )
      assert result.pass
    end

    test "violation — forbidden tool called" do
      result = Matchers.should_not_call_check(
        ["semantic_search", "find_connections"],
        ["find_connections"]
      )
      refute result.pass
    end

    test "empty forbidden list always passes" do
      result = Matchers.should_not_call_check(["semantic_search"], [])
      assert result.pass
    end

    test "variant prefix matching for forbidden" do
      result = Matchers.should_not_call_check(
        ["find_connections_lean"],
        ["find_connections"]
      )
      refute result.pass
    end
  end

  describe "evaluate/2" do
    test "perfect match — all dimensions pass" do
      actual = [%{name: "semantic_search", arguments: %{"query" => "Jido"}}]
      gold = %{
        tool_sequence: ["semantic_search"],
        param_shapes: %{"semantic_search" => ["contains_keyword:Jido"]},
        should_not_call: ["find_connections"]
      }

      result = Matchers.evaluate(actual, gold)
      assert result.selection_correct
      assert result.param_shape_match
      assert result.false_positives == []
      assert result.false_negatives == []
    end

    test "selection wrong, params ok" do
      actual = [%{name: "summarize", arguments: %{"content" => "test"}}]
      gold = %{
        tool_sequence: ["semantic_search"],
        param_shapes: %{},
        should_not_call: []
      }

      result = Matchers.evaluate(actual, gold)
      refute result.selection_correct
      assert result.false_positives == ["summarize"]
      assert result.false_negatives == ["semantic_search"]
    end

    test "adversarial query — no tools expected, none called" do
      actual = []
      gold = %{
        tool_sequence: [],
        param_shapes: %{},
        should_not_call: ["semantic_search", "summarize", "find_connections"]
      }

      result = Matchers.evaluate(actual, gold)
      assert result.selection_correct
    end

    test "adversarial query — tools called when shouldn't" do
      actual = [%{name: "semantic_search", arguments: %{"query" => "weather Tokyo"}}]
      gold = %{
        tool_sequence: [],
        param_shapes: %{},
        should_not_call: ["semantic_search"]
      }

      result = Matchers.evaluate(actual, gold)
      refute result.selection_correct
    end
  end
end

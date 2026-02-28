defmodule Maiden.Melanie.Eval.ObservationTest do
  use ExUnit.Case, async: true

  alias Maiden.Melanie.Eval.Observation

  @sample_query %{
    id: "dl-001",
    stratum: :direct_lookup,
    query: "What happened with Jido?",
    gold: %{
      tool_sequence: ["semantic_search"],
      param_shapes: %{},
      should_not_call: []
    }
  }

  @sample_snapshot %{
    details: %{
      tool_calls: [],
      usage: %{input_tokens: 1500, output_tokens: 300},
      iteration: 2,
      model: "claude-sonnet-4-20250514",
      conversation: [
        %{role: "user", content: "What happened with Jido?"},
        %{role: "assistant", content: "", tool_calls: [
          %{name: "semantic_search", arguments: %{"query" => "Jido"}}
        ]},
        %{role: "tool", content: "search results here", name: "semantic_search"},
        %{role: "assistant", content: "Based on the search results..."}
      ]
    }
  }

  @sample_match_result %{
    selection_correct: true,
    param_shape_match: true,
    false_positives: [],
    false_negatives: [],
    details: []
  }

  describe "from_snapshot/5" do
    test "extracts all fields from a snapshot" do
      obs = Observation.from_snapshot(@sample_query, @sample_snapshot, @sample_match_result, 3500,
        variant: "lean",
        composition: "core_3"
      )

      assert obs.query_id == "dl-001"
      assert obs.stratum == "direct_lookup"
      assert obs.tool_variant == "lean"
      assert obs.composition == "core_3"
      assert obs.tools_called == ["semantic_search"]
      assert obs.tools_expected == ["semantic_search"]
      assert obs.selection_correct == true
      assert obs.params_conformant == true
      assert obs.iteration_count == 2
      assert obs.e2e_latency_ms == 3500
      assert obs.input_tokens == 1500
      assert obs.output_tokens == 300
      assert obs.total_tokens == 1800
      assert obs.model == "claude-sonnet-4-20250514"
      assert obs.answer_text =~ "Based on the search results"
      assert obs.timestamp
    end

    test "handles missing snapshot fields gracefully" do
      obs = Observation.from_snapshot(@sample_query, %{details: %{}}, @sample_match_result, 1000)

      assert obs.tools_called == []
      assert obs.iteration_count == 0
      assert obs.input_tokens == 0
      assert obs.output_tokens == 0
    end
  end

  describe "from_error/4" do
    test "creates error observation" do
      obs = Observation.from_error(@sample_query, "timeout", 90000,
        variant: "rich",
        composition: "core_5"
      )

      assert obs.query_id == "dl-001"
      assert obs.error == "timeout"
      assert obs.e2e_latency_ms == 90000
      assert obs.tool_variant == "rich"
    end
  end

  describe "to_ndjson_map/1" do
    test "produces a flat serializable map" do
      obs = Observation.from_snapshot(@sample_query, @sample_snapshot, @sample_match_result, 3500,
        variant: "lean",
        composition: "core_3"
      )

      map = Observation.to_ndjson_map(obs)

      assert is_map(map)
      assert map.query_id == "dl-001"
      assert map.selection_correct == true
      assert map.input_tokens == 1500

      # Must be JSON-encodable
      assert {:ok, json} = Jason.encode(map)
      assert is_binary(json)
    end
  end
end

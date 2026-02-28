defmodule Maiden.Melanie.Eval.CorpusTest do
  use ExUnit.Case, async: true

  alias Maiden.Melanie.Eval.Corpus

  @corpus_dir Path.expand("../../eval/corpus", __DIR__)

  describe "corpus loading" do
    test "loads the full corpus from eval/corpus/" do
      {:ok, queries} = Corpus.load(@corpus_dir)

      assert length(queries) >= 70, "Expected at least 70 queries, got #{length(queries)}"
      assert length(queries) <= 80, "Expected at most 80 queries, got #{length(queries)}"
    end

    test "all queries have required fields" do
      {:ok, queries} = Corpus.load(@corpus_dir)

      for q <- queries do
        assert q.id, "Query missing id"
        assert q.stratum, "Query #{q.id} missing stratum"
        assert q.query, "Query #{q.id} missing query text"
        assert q.gold, "Query #{q.id} missing gold"
        assert is_list(q.gold.tool_sequence), "Query #{q.id} gold.tool_sequence not a list"
        assert is_map(q.gold.param_shapes), "Query #{q.id} gold.param_shapes not a map"
        assert is_list(q.gold.should_not_call), "Query #{q.id} gold.should_not_call not a list"
      end
    end

    test "no duplicate IDs" do
      {:ok, queries} = Corpus.load(@corpus_dir)
      ids = Enum.map(queries, & &1.id)
      assert ids == Enum.uniq(ids), "Duplicate query IDs found"
    end

    test "all strata are valid" do
      {:ok, queries} = Corpus.load(@corpus_dir)
      valid = ~w(direct_lookup synthesis relationship ambiguous adversarial multi_hop)a

      for q <- queries do
        assert q.stratum in valid, "Invalid stratum #{q.stratum} for query #{q.id}"
      end
    end

    test "group_by_stratum produces expected groups" do
      {:ok, queries} = Corpus.load(@corpus_dir)
      groups = Corpus.group_by_stratum(queries)

      assert Map.has_key?(groups, :direct_lookup)
      assert Map.has_key?(groups, :synthesis)
      assert Map.has_key?(groups, :relationship)
      assert Map.has_key?(groups, :ambiguous)
      assert Map.has_key?(groups, :adversarial)
      assert Map.has_key?(groups, :multi_hop)

      # Each stratum should have 10-15 queries
      for {stratum, qs} <- groups do
        count = length(qs)
        assert count >= 10, "Stratum #{stratum} has only #{count} queries (min 10)"
        assert count <= 15, "Stratum #{stratum} has #{count} queries (max 15)"
      end
    end
  end

  describe "corpus validation" do
    test "error on missing directory" do
      assert {:error, {:corpus_dir, :enoent}} = Corpus.load("/nonexistent/path")
    end
  end
end

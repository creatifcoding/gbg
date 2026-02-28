defmodule Maiden.Melanie.Eval.ActionVariantTest do
  use ExUnit.Case, async: true

  alias Maiden.Melanie.Eval.Variants

  # All 15 variant modules
  @all_variants [
    Variants.SemanticSearchMinimal,
    Variants.SemanticSearchLean,
    Variants.SemanticSearchRich,
    Variants.SemanticSearchRichExamples,
    Variants.SemanticSearchOverSpecified,
    Variants.SummarizeMinimal,
    Variants.SummarizeLean,
    Variants.SummarizeRich,
    Variants.SummarizeRichExamples,
    Variants.SummarizeOverSpecified,
    Variants.FindConnectionsMinimal,
    Variants.FindConnectionsLean,
    Variants.FindConnectionsRich,
    Variants.FindConnectionsRichExamples,
    Variants.FindConnectionsOverSpecified
  ]

  describe "ActionVariant macro" do
    test "all 15 variant modules exist and compile" do
      for mod <- @all_variants do
        assert Code.ensure_loaded?(mod), "Module #{mod} failed to load"
      end
    end

    test "all variants export name/0, description/0, schema/0" do
      for mod <- @all_variants do
        assert function_exported?(mod, :name, 0), "#{mod} missing name/0"
        assert function_exported?(mod, :description, 0), "#{mod} missing description/0"
        assert function_exported?(mod, :schema, 0), "#{mod} missing schema/0"
      end
    end

    test "all variants pass ToolAdapter.validate_actions/1" do
      assert :ok = Jido.AI.ToolAdapter.validate_actions(@all_variants)
    end

    test "variant names include variant suffix" do
      assert Variants.SemanticSearchMinimal.name() == "semantic_search_minimal"
      assert Variants.SemanticSearchLean.name() == "semantic_search_lean"
      assert Variants.SemanticSearchRich.name() == "semantic_search_rich"
      assert Variants.SummarizeRichExamples.name() == "summarize_rich_examples"
      assert Variants.FindConnectionsOverSpecified.name() == "find_connections_over_specified"
    end

    test "variant descriptions differ from base" do
      base_desc = Maiden.Melanie.Runtime.Actions.SemanticSearch.description()
      minimal_desc = Variants.SemanticSearchMinimal.description()
      rich_desc = Variants.SemanticSearchRich.description()

      refute minimal_desc == base_desc
      refute minimal_desc == rich_desc
    end

    test "lean variant descriptions match base descriptions" do
      # Lean should be the same content as the base — that's the baseline
      lean = Variants.SemanticSearchLean.description()
      base = Maiden.Melanie.Runtime.Actions.SemanticSearch.description()

      assert String.trim(lean) == String.trim(base)
    end

    test "variant/0 returns the variant atom" do
      assert Variants.SemanticSearchMinimal.variant() == :minimal
      assert Variants.SummarizeRich.variant() == :rich
      assert Variants.FindConnectionsOverSpecified.variant() == :over_specified
    end

    test "base_module/0 returns the original action module" do
      assert Variants.SemanticSearchMinimal.base_module() ==
               Maiden.Melanie.Runtime.Actions.SemanticSearch

      assert Variants.SummarizeRich.base_module() ==
               Maiden.Melanie.Runtime.Actions.Summarize
    end

    test "schema delegates to base module" do
      base_schema = Maiden.Melanie.Runtime.Actions.SemanticSearch.schema()
      variant_schema = Variants.SemanticSearchMinimal.schema()

      assert base_schema == variant_schema
    end

    test "ToolAdapter.from_actions produces valid tools for all variants" do
      tools = Jido.AI.ToolAdapter.from_actions(@all_variants)

      assert length(tools) == 15

      # Verify unique names
      names = Enum.map(tools, & &1.name)
      assert length(names) == length(Enum.uniq(names)), "Duplicate tool names: #{inspect(names)}"
    end

    test "description length increases with variant richness" do
      minimal = Variants.SemanticSearchMinimal.description() |> String.length()
      lean = Variants.SemanticSearchLean.description() |> String.length()
      rich = Variants.SemanticSearchRich.description() |> String.length()
      rich_ex = Variants.SemanticSearchRichExamples.description() |> String.length()
      over = Variants.SemanticSearchOverSpecified.description() |> String.length()

      assert minimal < lean
      assert lean < rich
      assert rich < rich_ex
      assert rich_ex < over
    end
  end
end

defmodule Maiden.Melanie.Eval.VariantRegistry do
  @moduledoc """
  Maps variant atoms and composition names to tool module lists.

  Central registry for resolving (variant, composition) → [module] for the harness.
  """

  alias Maiden.Melanie.Runtime.Actions.{SemanticSearch, Summarize, FindConnections}
  alias Maiden.Melanie.Eval.Variants

  alias Maiden.Melanie.Eval.Decoys.{
    KeywordSearch,
    TopicSummary,
    GraphTraverse,
    TimelineQuery,
    EntityLookup
  }

  @doc "All known variant atoms."
  def variant_atoms, do: ~w(minimal lean rich rich_examples over_specified)a

  @doc "All known composition names."
  def composition_names, do: ~w(core_3 core_5 core_5_decoys scaled_15)

  @doc """
  Resolve a variant + composition to a list of tool modules.

  The variant determines which description variants of the 3 core tools to use.
  The composition determines which additional tools to include.
  """
  @spec resolve(atom(), String.t()) :: {:ok, [module()]} | {:error, term()}
  def resolve(variant, composition) do
    with {:ok, core_tools} <- core_tools_for_variant(variant),
         {:ok, extra_tools} <- extra_tools_for_composition(composition) do
      {:ok, core_tools ++ extra_tools}
    end
  end

  @doc "Resolve, raise on error."
  def resolve!(variant, composition) do
    case resolve(variant, composition) do
      {:ok, modules} -> modules
      {:error, reason} -> raise "Failed to resolve (#{variant}, #{composition}): #{inspect(reason)}"
    end
  end

  @doc "Get the tool count for a composition."
  @spec tool_count(String.t()) :: non_neg_integer()
  def tool_count("core_3"), do: 3
  def tool_count("core_5"), do: 5
  def tool_count("core_5_decoys"), do: 8
  def tool_count("scaled_15"), do: 15
  def tool_count(_), do: 3

  # ── Private ──────────────────────────────────────────────────────────────

  defp core_tools_for_variant(:minimal) do
    {:ok, [
      Variants.SemanticSearchMinimal,
      Variants.SummarizeMinimal,
      Variants.FindConnectionsMinimal
    ]}
  end

  defp core_tools_for_variant(:lean) do
    {:ok, [
      Variants.SemanticSearchLean,
      Variants.SummarizeLean,
      Variants.FindConnectionsLean
    ]}
  end

  defp core_tools_for_variant(:rich) do
    {:ok, [
      Variants.SemanticSearchRich,
      Variants.SummarizeRich,
      Variants.FindConnectionsRich
    ]}
  end

  defp core_tools_for_variant(:rich_examples) do
    {:ok, [
      Variants.SemanticSearchRichExamples,
      Variants.SummarizeRichExamples,
      Variants.FindConnectionsRichExamples
    ]}
  end

  defp core_tools_for_variant(:over_specified) do
    {:ok, [
      Variants.SemanticSearchOverSpecified,
      Variants.SummarizeOverSpecified,
      Variants.FindConnectionsOverSpecified
    ]}
  end

  # :base uses the original (non-variant) tool modules
  defp core_tools_for_variant(:base) do
    {:ok, [SemanticSearch, Summarize, FindConnections]}
  end

  defp core_tools_for_variant(unknown) do
    {:error, {:unknown_variant, unknown}}
  end

  defp extra_tools_for_composition("core_3"), do: {:ok, []}

  defp extra_tools_for_composition("core_5") do
    {:ok, [TimelineQuery, EntityLookup]}
  end

  defp extra_tools_for_composition("core_5_decoys") do
    {:ok, [TimelineQuery, EntityLookup, KeywordSearch, TopicSummary, GraphTraverse]}
  end

  defp extra_tools_for_composition("scaled_15") do
    {:ok, [
      TimelineQuery,
      EntityLookup,
      KeywordSearch,
      TopicSummary,
      GraphTraverse,
      # Also include some cross-variant tools for maximum confusion
      Variants.SemanticSearchMinimal,
      Variants.SemanticSearchRich,
      Variants.SummarizeMinimal,
      Variants.SummarizeRich,
      Variants.FindConnectionsMinimal,
      Variants.FindConnectionsRich
    ]}
  end

  defp extra_tools_for_composition(unknown) do
    {:error, {:unknown_composition, unknown}}
  end
end

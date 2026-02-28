defmodule Maiden.Melanie.Eval.ActionVariant do
  @moduledoc """
  Parameterized macro for generating tool description variants.

  Creates a module that delegates `schema/0` and `run/2` to a base Action module
  while overriding `name/0` and `description/0` with variant-specific values.

  The generated module satisfies `Jido.AI.ToolAdapter.validate_actions/1`:
  it exports `name/0`, `description/0`, `schema/0`, and `run/2`.

  ## Usage

      defmodule Maiden.Melanie.Eval.Variants.SemanticSearchRich do
        use Maiden.Melanie.Eval.ActionVariant,
          base: Maiden.Melanie.Runtime.Actions.SemanticSearch,
          variant: :rich,
          description: \"""
          Search the knowledge base for relevant notes, cards, events, tasks, and links.
          Returns ranked results with context snippets and relevance scores.
          ...extended description...
          \"""
      end
  """

  defmacro __using__(opts) do
    base = Keyword.fetch!(opts, :base)
    variant = Keyword.fetch!(opts, :variant)
    description = Keyword.fetch!(opts, :description)

    quote do
      @behaviour Jido.Action

      @base_module unquote(base)
      @variant unquote(variant)
      @variant_description unquote(description)

      @doc "Tool name = base name + variant suffix"
      def name do
        "#{@base_module.name()}_#{@variant}"
      end

      @doc "Variant-specific description"
      def description, do: @variant_description

      @doc "Schema delegated from base module"
      defdelegate schema(), to: @base_module

      @doc "Execution delegated to base module"
      defdelegate run(params, context), to: @base_module

      @doc "Parameter validation delegated to base module"
      defdelegate validate_params(params), to: @base_module

      @doc "Output validation delegated to base module"
      defdelegate validate_output(output), to: @base_module

      # Satisfy remaining @behaviour callbacks with noops/delegates
      defdelegate on_before_validate_params(params), to: @base_module
      defdelegate on_after_validate_params(params), to: @base_module
      defdelegate on_before_validate_output(output), to: @base_module
      defdelegate on_after_validate_output(output), to: @base_module
      defdelegate on_after_run(result), to: @base_module
      def on_error(error, params, context, stacktrace) do
        @base_module.on_error(error, params, context, stacktrace)
      end

      @doc "Strict mode delegated if base implements it"
      if function_exported?(@base_module, :strict?, 0) do
        defdelegate strict?(), to: @base_module
      end

      @doc "Returns the variant identifier atom"
      def variant, do: @variant

      @doc "Returns the base module atom"
      def base_module, do: @base_module
    end
  end
end

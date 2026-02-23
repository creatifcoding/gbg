defmodule MyApp.Validators.OrderValidator do
  @moduledoc """
  Cross-runtime payload validator for the Order domain.

  Provenance:
  - Effect Schema feature (TypeScript): canonical domain model and JSON Schema generation.
  - JSON Schema contract semantics: language-neutral interchange format.
  - Elixir validator behavior: Exonerate (primary) with ex_json_schema fallback for runtime resolution.
  - Jido behavior note: this is pre-flight payload validation before Agent cmd/2 and strategy transitions.
  """

  require Exonerate

  @order_schema_path Path.expand("../../../../schemas/order.schema.json", __DIR__)
  @transition_schema_path Path.expand("../../../../schemas/order_transition.schema.json", __DIR__)

  @external_resource @order_schema_path
  @external_resource @transition_schema_path

  # Elixir validator behavior (Exonerate): compile-time generated validator functions.
  Exonerate.function_from_file(:defp, :validate_order_exonerate, "../schemas/order.schema.json", draft: "7")

  Exonerate.function_from_file(
    :defp,
    :validate_transition_exonerate,
    "../schemas/order_transition.schema.json",
    draft: "7"
  )

  # Elixir validator behavior (ex_json_schema): runtime fallback if Exonerate cannot process a schema shape.
  @order_schema_runtime @order_schema_path
                        |> File.read!()
                        |> Jason.decode!()
                        |> ExJsonSchema.Schema.resolve()

  @transition_schema_runtime @transition_schema_path
                             |> File.read!()
                             |> Jason.decode!()
                             |> ExJsonSchema.Schema.resolve()

  @type engine :: :auto | :exonerate | :ex_json_schema

  @spec order_validate(map(), keyword()) :: :ok | {:error, term()}
  def order_validate(payload, opts \\ []) when is_map(payload) do
    validate(payload, :order, Keyword.get(opts, :engine, :auto))
  end

  @spec transition_event_validate(map(), keyword()) :: :ok | {:error, term()}
  def transition_event_validate(payload, opts \\ []) when is_map(payload) do
    validate(payload, :transition, Keyword.get(opts, :engine, :auto))
  end

  defp validate(payload, :order, :exonerate), do: normalize_exonerate(validate_order_exonerate(payload))

  defp validate(payload, :transition, :exonerate),
    do: normalize_exonerate(validate_transition_exonerate(payload))

  defp validate(payload, :order, :ex_json_schema),
    do: normalize_ex_json_schema(ExJsonSchema.Validator.validate(@order_schema_runtime, payload))

  defp validate(payload, :transition, :ex_json_schema),
    do:
      normalize_ex_json_schema(ExJsonSchema.Validator.validate(@transition_schema_runtime, payload))

  defp validate(payload, kind, :auto) do
    try do
      validate(payload, kind, :exonerate)
    rescue
      error ->
        # Fallback path for draft/keyword incompatibility or compile/runtime edges.
        case validate(payload, kind, :ex_json_schema) do
          :ok -> :ok
          {:error, errors} ->
            {:error,
             %{
               validator: :ex_json_schema,
               fallback_from: :exonerate,
               fallback_reason: Exception.message(error),
               errors: errors
             }}
        end
    end
  end

  defp normalize_exonerate(:ok), do: :ok

  defp normalize_exonerate({:error, errors}) do
    {:error, %{validator: :exonerate, errors: errors}}
  end

  defp normalize_ex_json_schema(:ok), do: :ok

  defp normalize_ex_json_schema({:error, errors}) do
    {:error, %{validator: :ex_json_schema, errors: errors}}
  end
end

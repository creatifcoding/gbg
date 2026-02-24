defmodule Maiden.AlarmRuntime.Validators.AlarmValidator do
  @moduledoc """
  Cross-runtime payload validator for the Alarm domain.
  """

  @alarm_schema_path Path.expand("../../../../../schemas/alarm.schema.json", __DIR__)
  @transition_schema_path Path.expand("../../../../../schemas/alarm_transition.schema.json", __DIR__)
  @agent_state_schema_path Path.expand("../../../../../schemas/alarm_agent_state.schema.json", __DIR__)

  @external_resource @alarm_schema_path
  @external_resource @transition_schema_path
  @external_resource @agent_state_schema_path

  @alarm_schema_runtime @alarm_schema_path
                        |> File.read!()
                        |> Jason.decode!()
                        |> ExJsonSchema.Schema.resolve()

  @transition_schema_runtime @transition_schema_path
                             |> File.read!()
                             |> Jason.decode!()
                             |> ExJsonSchema.Schema.resolve()

  @agent_state_schema_runtime @agent_state_schema_path
                              |> File.read!()
                              |> Jason.decode!()
                              |> ExJsonSchema.Schema.resolve()

  @exonerate_compatible false

  @type engine :: :auto | :exonerate | :ex_json_schema

  @spec engine_status() :: %{preferred: atom(), exonerate_compatible: boolean()}
  def engine_status do
    %{
      preferred: if(@exonerate_compatible, do: :exonerate, else: :ex_json_schema),
      exonerate_compatible: @exonerate_compatible
    }
  end

  @spec alarm_validate(map(), keyword()) :: :ok | {:error, term()}
  def alarm_validate(payload, opts \\ []) when is_map(payload) do
    validate(payload, :alarm, Keyword.get(opts, :engine, :auto))
  end

  @spec transition_event_validate(map(), keyword()) :: :ok | {:error, term()}
  def transition_event_validate(payload, opts \\ []) when is_map(payload) do
    validate(payload, :transition, Keyword.get(opts, :engine, :auto))
  end

  @spec agent_state_validate(map(), keyword()) :: :ok | {:error, term()}
  def agent_state_validate(payload, opts \\ []) when is_map(payload) do
    validate(payload, :agent_state, Keyword.get(opts, :engine, :auto))
  end

  defp validate(payload, kind, :auto) do
    if @exonerate_compatible do
      validate(payload, kind, :exonerate)
    else
      validate(payload, kind, :ex_json_schema)
    end
  end

  defp validate(_payload, _kind, :exonerate) do
    {:error,
     %{
       validator: :exonerate,
       reason:
         "Exonerate disabled for current generated schemas; use :ex_json_schema until compatibility normalizer is finalized"
     }}
  end

  defp validate(payload, :alarm, :ex_json_schema),
    do: normalize_ex_json_schema(ExJsonSchema.Validator.validate(@alarm_schema_runtime, payload))

  defp validate(payload, :transition, :ex_json_schema),
    do:
      normalize_ex_json_schema(ExJsonSchema.Validator.validate(@transition_schema_runtime, payload))

  defp validate(payload, :agent_state, :ex_json_schema),
    do:
      normalize_ex_json_schema(ExJsonSchema.Validator.validate(@agent_state_schema_runtime, payload))

  defp normalize_ex_json_schema(:ok), do: :ok

  defp normalize_ex_json_schema({:error, errors}) do
    {:error, %{validator: :ex_json_schema, errors: errors}}
  end
end

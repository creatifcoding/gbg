defmodule Maiden.SensorRuntime.Validators.SensorValidator do
  @moduledoc """
  Elixir validator behavior for Sensor lane.

  Keeps validation deterministic while preserving parity with canonical
  Effect contracts and runtime preflight requirements.
  """

  alias Maiden.SensorRuntime.SensorId

  @sensor_statuses ~w(active calibrating needs_calibration faulted offline decommissioned)

  @sensor_types ~w(
    temperature pressure vibration humidity flow level speed position current voltage power force torque weight ph conductivity other
  )

  @measurement_units ~w(
    celsius fahrenheit kelvin psi bar pascal kpa mm_s in_s g l_min gpm m3_h meters feet mm inches percent rpm ampere volt watt newton nm kg count unitless
  )

  @sensor_actions ~w(
    StartCalibration CompleteCalibration FailCalibration FlagForCalibration MarkFaulted ClearFault TakeOffline BringOnline Decommission
  )

  @timestamp_pattern ~r/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
  @machine_id_pattern ~r/^MCH-[a-zA-Z0-9-]+$/

  @type engine :: :auto

  @spec engine_status() :: %{preferred: :skeleton, exonerate_compatible: false}
  def engine_status do
    %{preferred: :skeleton, exonerate_compatible: false}
  end

  @spec sensor_validate(map(), keyword()) :: :ok | {:error, map()}
  def sensor_validate(payload, _opts \\ []) when is_map(payload) do
    with :ok <- require_binary(payload, :sensor_id, &SensorId.valid?/1),
         :ok <- require_binary(payload, :name, &(String.trim(&1) != "")),
         :ok <- require_member(payload, :status, @sensor_statuses),
         :ok <- require_member(payload, :sensor_type, @sensor_types),
         :ok <- require_member(payload, :unit, @measurement_units),
         :ok <- optional_positive_integer(payload, :sample_rate_ms),
         :ok <- optional_number(payload, :threshold_high),
         :ok <- optional_number(payload, :threshold_critical),
         :ok <- optional_number(payload, :threshold_low),
         :ok <- optional_number(payload, :threshold_critical_low),
         :ok <- optional_binary(payload, :last_calibration_date, &Regex.match?(@timestamp_pattern, &1)),
         :ok <- optional_binary(payload, :next_calibration_date, &Regex.match?(@timestamp_pattern, &1)),
         :ok <- optional_binary(payload, :created_at, &Regex.match?(@timestamp_pattern, &1), required: true),
         :ok <- optional_binary(payload, :updated_at, &Regex.match?(@timestamp_pattern, &1)),
         :ok <- optional_binary(payload, :machine_id, &Regex.match?(@machine_id_pattern, &1)),
         :ok <- optional_map(payload, :metadata, required: true) do
      :ok
    end
  end

  @spec transition_event_validate(map(), keyword()) :: :ok | {:error, map()}
  def transition_event_validate(payload, _opts \\ []) when is_map(payload) do
    with :ok <- require_binary(payload, :sensor_id, &SensorId.valid?/1),
         :ok <- require_member(payload, :from, @sensor_statuses),
         :ok <- require_member(payload, :to, @sensor_statuses),
         :ok <- require_binary(payload, :at, &Regex.match?(@timestamp_pattern, &1)),
         :ok <- optional_member(payload, :action, @sensor_actions) do
      :ok
    end
  end

  @spec agent_state_validate(map(), keyword()) :: :ok | {:error, map()}
  def agent_state_validate(payload, opts \\ []) when is_map(payload) do
    sensor_validate(payload, opts)
  end

  defp require_binary(payload, key, predicate) do
    case fetch(payload, key) do
      value when is_binary(value) ->
        if predicate.(value) do
          :ok
        else
          {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_or_missing}}
        end

      _ ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_or_missing}}
    end
  end

  defp require_member(payload, key, allowed) do
    case fetch(payload, key) do
      value when is_binary(value) ->
        if value in allowed do
          :ok
        else
          {:error,
           %{validator: :skeleton, field: key_name(key), reason: :invalid_enum, allowed: allowed}}
        end

      _ ->
        {:error,
         %{validator: :skeleton, field: key_name(key), reason: :invalid_enum, allowed: allowed}}
    end
  end

  defp optional_member(payload, key, allowed) do
    case fetch(payload, key) do
      nil ->
        :ok

      value when is_binary(value) ->
        if value in allowed do
          :ok
        else
          {:error,
           %{validator: :skeleton, field: key_name(key), reason: :invalid_enum, allowed: allowed}}
        end

      _ ->
        {:error,
         %{validator: :skeleton, field: key_name(key), reason: :invalid_enum, allowed: allowed}}
    end
  end

  defp optional_positive_integer(payload, key) do
    case fetch(payload, key) do
      nil ->
        :ok

      value when is_integer(value) and value > 0 ->
        :ok

      _ ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_integer}}
    end
  end

  defp optional_number(payload, key) do
    case fetch(payload, key) do
      nil ->
        :ok

      value when is_number(value) ->
        :ok

      _ ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_number}}
    end
  end

  defp optional_binary(payload, key, predicate, opts \\ []) do
    required? = Keyword.get(opts, :required, false)

    case fetch(payload, key) do
      nil when required? ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_or_missing}}

      nil ->
        :ok

      value when is_binary(value) ->
        if predicate.(value) do
          :ok
        else
          {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_string}}
        end

      _ ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_string}}
    end
  end

  defp optional_map(payload, key, opts) do
    required? = Keyword.get(opts, :required, false)

    case fetch(payload, key) do
      nil when required? ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_map}}

      nil ->
        :ok

      value when is_map(value) ->
        :ok

      _ ->
        {:error, %{validator: :skeleton, field: key_name(key), reason: :invalid_map}}
    end
  end

  defp fetch(payload, key), do: Map.get(payload, key) || Map.get(payload, key_name(key))

  defp key_name(key) when is_atom(key), do: Atom.to_string(key)
  defp key_name(key), do: key
end

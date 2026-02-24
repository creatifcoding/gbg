defmodule Maiden.EquipmentStateRuntime.Sensors.TransitionSensor do
  @moduledoc """
  Sensor ingress adapter for equipment-state transition events.

  Responsibility:
  - ingest external transition events
  - run preflight validation before signal emission
  - emit Jido signal routed to explicit transition actions
  """

  use Jido.Sensor,
    name: "equipment_state_transition_sensor",
    description: "Converts equipment-state transition events into Jido transition signals",
    schema: Zoi.object(
      %{
        source: Zoi.string() |> Zoi.default("/sensor/equipment-state-transition"),
        emit_rejections: Zoi.boolean() |> Zoi.default(false)
      },
      coerce: true
    )

  alias Maiden.EquipmentStateRuntime.Agent

  @impl true
  def init(config, context) do
    {:ok, %{config: config, context: context}}
  end

  @impl true
  def handle_event({:equipment_state_transition, payload}, state) when is_map(payload) do
    normalized = normalize_payload(payload)
    trace_id = fetch_trace_id(payload)

    case Agent.preflight_transition(normalized) do
      :ok ->
        signal =
          Jido.Signal.new!(
            signal_type(normalized),
            to_action_params(normalized),
            source: state.config.source
          )

        {:ok, state, [{:emit, signal}]}

      {:error, reason} = error ->
        if state.config.emit_rejections do
          rejection_signal =
            Jido.Signal.new!(
              "equipment_state.transition.rejected",
              rejection_payload(normalized, reason, trace_id),
              source: state.config.source
            )

          {:ok, state, [{:emit, rejection_signal}]}
        else
          {:error, {:transition_preflight_failed, error}}
        end
    end
  end

  def handle_event(payload, state) when is_map(payload) do
    handle_event({:equipment_state_transition, payload}, state)
  end

  def handle_event(_event, state), do: {:ok, state}

  defp signal_type(payload) do
    "equipment_state.transition." <> Map.get(payload, "to")
  end

  defp normalize_payload(payload) do
    %{}
    |> put_if_present(payload, "equipment_state_id", :equipment_state_id)
    |> put_if_present(payload, "machine_id", :machine_id)
    |> put_if_present(payload, "from", :from)
    |> put_if_present(payload, "to", :to)
    |> put_if_present(payload, "at", :at)
    |> put_if_present(payload, "reason", :reason)
    |> put_if_present(payload, "operator_id", :operator_id)
    |> put_if_present(payload, "notes", :notes)
  end

  defp put_if_present(acc, payload, key, fallback_atom) do
    case Map.get(payload, key) || Map.get(payload, fallback_atom) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end

  defp to_action_params(payload) do
    %{}
    |> put_action_if_present(payload, :equipment_state_id)
    |> put_action_if_present(payload, :machine_id)
    |> put_action_if_present(payload, :from)
    |> put_action_if_present(payload, :to)
    |> put_action_if_present(payload, :at)
    |> put_action_if_present(payload, :reason)
    |> put_action_if_present(payload, :operator_id)
    |> put_action_if_present(payload, :notes)
  end

  defp rejection_payload(payload, reason, trace_id) do
    %{
      equipment_state_id: Map.get(payload, "equipment_state_id"),
      machine_id: Map.get(payload, "machine_id"),
      from: Map.get(payload, "from"),
      to: Map.get(payload, "to"),
      at: Map.get(payload, "at"),
      reason: Map.get(payload, "reason"),
      attempted_signal: signal_type(payload),
      trace_id: trace_id,
      validator: rejection_validator(reason),
      observed_at: DateTime.utc_now() |> DateTime.to_iso8601(),
      error: reason
    }
  end

  defp fetch_trace_id(payload) do
    Map.get(payload, "trace_id") ||
      Map.get(payload, :trace_id) ||
      "sensor-trace-#{System.unique_integer([:positive])}"
  end

  defp rejection_validator(%{validator: validator}), do: validator
  defp rejection_validator(_), do: :unknown

  defp put_action_if_present(acc, payload, key) do
    case Map.get(payload, Atom.to_string(key)) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end
end

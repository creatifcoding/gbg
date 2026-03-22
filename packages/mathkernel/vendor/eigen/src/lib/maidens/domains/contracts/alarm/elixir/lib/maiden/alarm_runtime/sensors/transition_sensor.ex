defmodule Maiden.AlarmRuntime.Sensors.TransitionSensor do
  @moduledoc """
  Sensor ingress adapter for alarm transition events.

  Responsibility:
  - ingest external transition events
  - run preflight validation before signal emission
  - emit Jido signal routed to explicit transition actions
  """

  use Jido.Sensor,
    name: "alarm_transition_sensor",
    description: "Converts alarm transition events into Jido transition signals",
    schema: Zoi.object(
      %{
        source: Zoi.string() |> Zoi.default("/sensor/alarm-transition"),
        emit_rejections: Zoi.boolean() |> Zoi.default(false)
      },
      coerce: true
    )

  alias Maiden.AlarmRuntime.Agent

  @impl true
  def init(config, context) do
    {:ok, %{config: config, context: context}}
  end

  @impl true
  def handle_event({:alarm_transition, payload}, state) when is_map(payload) do
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
              "alarm.transition.rejected",
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
    handle_event({:alarm_transition, payload}, state)
  end

  def handle_event(_event, state), do: {:ok, state}

  defp signal_type(payload) do
    from = Map.get(payload, "from")
    to = Map.get(payload, "to")

    cond do
      from in ["shelved", "suppressed", "out_of_service"] and
          to in ["unacknowledged", "acknowledged", "cleared"] ->
        "alarm.transition.unshelved"

      true ->
        "alarm.transition." <> to
    end
  end

  defp normalize_payload(payload) do
    %{}
    |> put_if_present(payload, "alarm_id", :alarm_id)
    |> put_if_present(payload, "from", :from)
    |> put_if_present(payload, "to", :to)
    |> put_if_present(payload, "at", :at)
    |> put_if_present(payload, "reason", :reason)
    |> put_if_present(payload, "by", :by)
    |> put_if_present(payload, "shelved_until", :shelved_until)
  end

  defp put_if_present(acc, payload, key, fallback_atom) do
    case Map.get(payload, key) || Map.get(payload, fallback_atom) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end

  defp to_action_params(payload) do
    %{}
    |> put_action_if_present(payload, :alarm_id)
    |> put_action_if_present(payload, :from)
    |> put_action_if_present(payload, :to)
    |> put_action_if_present(payload, :at)
    |> put_action_if_present(payload, :reason)
    |> put_action_if_present(payload, :by)
    |> put_action_if_present(payload, :shelved_until)
  end

  defp rejection_payload(payload, reason, trace_id) do
    %{
      alarm_id: Map.get(payload, "alarm_id"),
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

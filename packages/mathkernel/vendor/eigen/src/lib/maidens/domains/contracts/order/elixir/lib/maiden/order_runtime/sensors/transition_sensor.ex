defmodule Maiden.OrderRuntime.Sensors.TransitionSensor do
  @moduledoc """
  Sensor ingress adapter for order transition events.

  Responsibility:
  - ingest external transition events
  - run preflight validation before signal emission
  - emit Jido signal routed to explicit transition actions
  """

  use Jido.Sensor,
    name: "order_transition_sensor",
    description: "Converts order transition events into Jido transition signals",
    schema: Zoi.object(
      %{
        source: Zoi.string() |> Zoi.default("/sensor/order-transition"),
        emit_rejections: Zoi.boolean() |> Zoi.default(false)
      },
      coerce: true
    )

  alias Maiden.OrderRuntime.Agent

  @impl true
  def init(config, context) do
    {:ok, %{config: config, context: context}}
  end

  @impl true
  def handle_event({:order_transition, payload}, state) when is_map(payload) do
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
              "order.transition.rejected",
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
    handle_event({:order_transition, payload}, state)
  end

  def handle_event(_event, state), do: {:ok, state}

  defp signal_type(payload), do: "order.transition." <> payload["to"]

  defp normalize_payload(payload) do
    %{}
    |> put_if_present(payload, "order_id", :order_id)
    |> put_if_present(payload, "from", :from)
    |> put_if_present(payload, "to", :to)
    |> put_if_present(payload, "at", :at)
    |> put_if_present(payload, "reason", :reason)
  end

  defp put_if_present(acc, payload, key, fallback_atom) do
    case Map.get(payload, key) || Map.get(payload, fallback_atom) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end

  defp to_action_params(payload) do
    %{}
    |> put_action_if_present(payload, :order_id)
    |> put_action_if_present(payload, :from)
    |> put_action_if_present(payload, :to)
    |> put_action_if_present(payload, :at)
    |> put_action_if_present(payload, :reason)
  end

  defp rejection_payload(payload, reason, trace_id) do
    %{
      order_id: Map.get(payload, "order_id"),
      from: Map.get(payload, "from"),
      to: Map.get(payload, "to"),
      at: Map.get(payload, "at"),
      reason: Map.get(payload, "reason"),
      attempted_signal: attempted_signal_type(payload),
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

  defp attempted_signal_type(payload) do
    case Map.get(payload, "to") do
      to when is_binary(to) and to != "" -> "order.transition." <> to
      _ -> "order.transition.unknown"
    end
  end

  defp put_action_if_present(acc, payload, key) do
    case Map.get(payload, Atom.to_string(key)) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end
end

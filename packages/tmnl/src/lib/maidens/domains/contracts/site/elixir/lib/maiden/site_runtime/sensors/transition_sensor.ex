defmodule Maiden.SiteRuntime.Sensors.TransitionSensor do
  @moduledoc """
  Sensor ingress adapter for site transition events.

  Responsibility:
  - ingest external transition events
  - run preflight validation before signal emission
  - emit Jido signals routed to explicit transition actions
  """

  use Jido.Sensor,
    name: "site_transition_sensor",
    description: "Converts site transition events into Jido transition signals",
    schema: Zoi.object(
      %{
        source: Zoi.string() |> Zoi.default("/sensor/site-transition"),
        emit_rejections: Zoi.boolean() |> Zoi.default(false)
      },
      coerce: true
    )

  alias Maiden.SiteRuntime.Agent

  @impl true
  def init(config, context) do
    {:ok, %{config: config, context: context}}
  end

  @impl true
  def handle_event({:site_transition, payload}, state) when is_map(payload) do
    normalized = normalize_payload(payload)
    trace_id = fetch_trace_id(payload)

    case Agent.preflight_transition(normalized) do
      :ok ->
        case signal_type(normalized) do
          {:ok, type} ->
            signal =
              Jido.Signal.new!(
                type,
                to_action_params(normalized),
                source: state.config.source
              )

            {:ok, state, [{:emit, signal}]}

          :error ->
            {:error, {:unknown_transition_signal, normalized}}
        end

      {:error, reason} = error ->
        if state.config.emit_rejections do
          rejection_signal =
            Jido.Signal.new!(
              "site.transition.rejected",
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
    handle_event({:site_transition, payload}, state)
  end

  def handle_event(_event, state), do: {:ok, state}

  defp signal_type(payload) do
    case transition_action(payload) do
      {:ok, "BeginConstruction"} -> {:ok, "site.transition.begin_construction"}
      {:ok, "Commission"} -> {:ok, "site.transition.commission"}
      {:ok, "SeasonalShutdown"} -> {:ok, "site.transition.seasonal_shutdown"}
      {:ok, "Reopen"} -> {:ok, "site.transition.reopen"}
      {:ok, "Close"} -> {:ok, "site.transition.close"}
      {:ok, "Decommission"} -> {:ok, "site.transition.decommission"}
      _ -> :error
    end
  end

  defp transition_action(payload) do
    case {Map.get(payload, "from"), Map.get(payload, "to")} do
      {"planned", "under_construction"} -> {:ok, "BeginConstruction"}
      {"under_construction", "operational"} -> {:ok, "Commission"}
      {"operational", "seasonal_shutdown"} -> {:ok, "SeasonalShutdown"}
      {"seasonal_shutdown", "operational"} -> {:ok, "Reopen"}
      {"operational", "closed"} -> {:ok, "Close"}
      {"closed", "operational"} -> {:ok, "Reopen"}
      {"closed", "decommissioned"} -> {:ok, "Decommission"}
      _ -> :error
    end
  end

  defp normalize_payload(payload) do
    %{}
    |> put_if_present(payload, "site_id", :site_id)
    |> put_if_present(payload, "from", :from)
    |> put_if_present(payload, "to", :to)
    |> put_if_present(payload, "action", :action)
    |> put_if_present(payload, "at", :at)
    |> put_if_present(payload, "reason", :reason)
    |> put_if_present(payload, "initiated_by", :initiated_by)
  end

  defp put_if_present(acc, payload, key, fallback_atom) do
    case Map.get(payload, key) || Map.get(payload, fallback_atom) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end

  defp to_action_params(payload) do
    params =
      %{}
      |> put_action_if_present(payload, :site_id)
      |> put_action_if_present(payload, :from)
      |> put_action_if_present(payload, :to)
      |> put_action_if_present(payload, :at)
      |> put_action_if_present(payload, :reason)
      |> put_action_if_present(payload, :initiated_by)

    case transition_action(payload) do
      {:ok, action} -> Map.put(params, :action, action)
      :error -> params
    end
  end

  defp rejection_payload(payload, reason, trace_id) do
    %{
      site_id: Map.get(payload, "site_id"),
      from: Map.get(payload, "from"),
      to: Map.get(payload, "to"),
      at: Map.get(payload, "at"),
      reason: Map.get(payload, "reason"),
      initiated_by: Map.get(payload, "initiated_by"),
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
    case transition_action(payload) do
      {:ok, "BeginConstruction"} -> "site.transition.begin_construction"
      {:ok, "Commission"} -> "site.transition.commission"
      {:ok, "SeasonalShutdown"} -> "site.transition.seasonal_shutdown"
      {:ok, "Reopen"} -> "site.transition.reopen"
      {:ok, "Close"} -> "site.transition.close"
      {:ok, "Decommission"} -> "site.transition.decommission"
      :error -> "site.transition.unknown"
    end
  end

  defp put_action_if_present(acc, payload, key) do
    case Map.get(payload, Atom.to_string(key)) do
      nil -> acc
      value -> Map.put(acc, key, value)
    end
  end
end

defmodule Maiden.SensorRuntime.Actions.ObserveRejectedTransition do
  @moduledoc """
  Observer action for preflight-rejected sensor transitions.

  Keeps rejection routing explicit while preserving control-module boundaries.
  """

  require Logger

  use Jido.Action,
    name: "observe_rejected_transition",
    description: "Observe preflight-rejected sensor transitions",
    schema: [
      sensor_id: [type: :string],
      from: [type: :string],
      to: [type: :string],
      at: [type: :string],
      action: [type: :string],
      reason: [type: :string],
      initiated_by: [type: :string],
      attempted_signal: [type: :string],
      trace_id: [type: :string],
      validator: [type: :atom],
      observed_at: [type: :string],
      error: [type: :any]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    Logger.warning("sensor.transition.rejected observed", rejection: params)

    metadata =
      context.state[:metadata]
      |> ensure_map()
      |> Map.put("last_rejected_transition", stringify_keys(params))

    {:ok, %{metadata: metadata}}
  end

  def run(_params, _context), do: {:ok, %{}}

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}

  defp stringify_keys(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      normalized_key = if is_atom(key), do: Atom.to_string(key), else: key
      Map.put(acc, normalized_key, stringify_nested(value))
    end)
  end

  defp stringify_nested(map) when is_map(map), do: stringify_keys(map)
  defp stringify_nested(list) when is_list(list), do: Enum.map(list, &stringify_nested/1)
  defp stringify_nested(value), do: value
end

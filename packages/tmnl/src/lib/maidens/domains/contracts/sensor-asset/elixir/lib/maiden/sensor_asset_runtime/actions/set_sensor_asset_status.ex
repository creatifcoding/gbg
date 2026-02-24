defmodule Maiden.SensorAssetRuntime.Actions.SetSensorAssetStatus do
  @moduledoc """
  Generic transition action that updates sensor-asset status when preflight passes.

  Preserves ISA-95 control-module semantics by enforcing sensor identity and legal
  lifecycle transitions before mutating runtime state.
  """

  alias Maiden.SensorAssetRuntime.FSM

  use Jido.Action,
    name: "set_sensor_asset_status",
    description: "Set sensor-asset status for a validated transition",
    schema: [
      sensor_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      action: [type: :string],
      at: [type: :string, required: true],
      reason: [type: :string],
      initiated_by: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    sensor_id = fetch(params, :sensor_id)
    from = fetch(params, :from)
    to = fetch(params, :to)
    action = fetch(params, :action)
    at = fetch(params, :at)

    cond do
      fetch(context.state, :sensor_id) != sensor_id ->
        {:error, "sensor_id mismatch between transition payload and agent state"}

      fetch(context.state, :status) != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      not FSM.legal_transition?(from, to) ->
        {:error, "transition is illegal for sensor-asset FSM"}

      true ->
        metadata =
          context.state
          |> fetch(:metadata)
          |> ensure_map()
          |> Map.put("last_transition", %{
            "from" => from,
            "to" => to,
            "action" => action,
            "at" => at,
            "reason" => fetch(params, :reason),
            "initiated_by" => fetch(params, :initiated_by)
          })

        {:ok, %{status: to, updated_at: at, metadata: metadata}}
    end
  end

  def run(_params, _context), do: {:error, "set_sensor_asset_status requires a transition payload"}

  defp fetch(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end

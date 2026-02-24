defmodule Maiden.SensorAssetRuntime.Actions.ObserveRejectedTransition do
  @moduledoc """
  Observer action for preflight-rejected sensor transition envelopes.

  Retains rejection routing by recording the latest rejected transition in
  sensor metadata while keeping the canonical contract payload untouched.
  """

  require Logger

  use Jido.Action,
    name: "observe_rejected_transition",
    description: "Observe preflight-rejected sensor-asset transitions",
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
    Logger.warning("sensor_asset.transition.rejected observed", rejection: params)

    current_metadata =
      context.state
      |> fetch(:metadata)
      |> ensure_map()

    updated_metadata = Map.put(current_metadata, "last_rejected_transition", params)

    {:ok, %{metadata: updated_metadata}}
  end

  def run(_params, _context), do: {:ok, %{}}

  defp fetch(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end

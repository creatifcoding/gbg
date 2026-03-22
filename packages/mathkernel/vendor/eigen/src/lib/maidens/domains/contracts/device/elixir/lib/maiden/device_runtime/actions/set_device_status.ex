defmodule Maiden.DeviceRuntime.Actions.SetDeviceStatus do
  @moduledoc """
  Generic transition action that updates device status when preflight passes.
  """

  alias Maiden.DeviceRuntime.FSM

  use Jido.Action,
    name: "set_device_status",
    description: "Set device status for a validated transition",
    schema: [
      device_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      action: [type: :any],
      at: [type: :string, required: true],
      reason: [type: :string],
      initiated_by: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    device_id = fetch(params, :device_id)
    from = fetch(params, :from)
    to = fetch(params, :to)
    at = fetch(params, :at)

    cond do
      context.state[:device_id] != device_id ->
        {:error, "device_id mismatch between transition payload and agent state"}

      context.state[:status] != from ->
        {:error, "from state mismatch between transition payload and agent state"}

      not FSM.legal_transition?(from, to) ->
        {:error, "transition is illegal for device FSM"}

      true ->
        metadata =
          context.state[:metadata]
          |> ensure_map()
          |> Map.put("last_transition", %{
            "from" => from,
            "to" => to,
            "action" => fetch(params, :action),
            "at" => at,
            "reason" => fetch(params, :reason),
            "initiated_by" => fetch(params, :initiated_by)
          })

        {:ok,
         %{
           status: to,
           updated_at: at,
           last_command_at: at,
           metadata: metadata
         }}
    end
  end

  def run(_params, _context), do: {:error, "set_device_status requires a transition payload"}

  defp fetch(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))

  defp ensure_map(value) when is_map(value), do: value
  defp ensure_map(_value), do: %{}
end

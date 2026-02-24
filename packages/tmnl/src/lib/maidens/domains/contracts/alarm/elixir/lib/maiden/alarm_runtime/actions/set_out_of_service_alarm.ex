defmodule Maiden.AlarmRuntime.Actions.SetOutOfServiceAlarm do
  @moduledoc """
  Explicit transition action: active -> out_of_service.
  """

  use Jido.Action,
    name: "set_out_of_service_alarm",
    description: "Take an alarm out of service",
    schema: [
      alarm_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string, required: true]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    alarm_id = fetch_param(params, :alarm_id)
    to = fetch_param(params, :to)
    reason = fetch_param(params, :reason)

    cond do
      to != "out_of_service" ->
        {:error, "SetOutOfServiceAlarm requires to=out_of_service"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{state: "out_of_service", suppression_reason: reason}}
    end
  end

  def run(_params, _context), do: {:error, "SetOutOfServiceAlarm requires to=out_of_service"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end

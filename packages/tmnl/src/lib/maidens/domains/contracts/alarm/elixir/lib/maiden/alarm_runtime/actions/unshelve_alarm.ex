defmodule Maiden.AlarmRuntime.Actions.UnshelveAlarm do
  @moduledoc """
  Explicit transition action for returning from shelved/suppressed/out_of_service.
  """

  use Jido.Action,
    name: "unshelve_alarm",
    description: "Return alarm to an active lifecycle state",
    schema: [
      alarm_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      reason: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    alarm_id = fetch_param(params, :alarm_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)

    cond do
      from not in ["shelved", "suppressed", "out_of_service"] ->
        {:error, "UnshelveAlarm requires from in [shelved, suppressed, out_of_service]"}

      to not in ["unacknowledged", "acknowledged", "cleared"] ->
        {:error, "UnshelveAlarm requires to in [unacknowledged, acknowledged, cleared]"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           state: to,
           suppression_reason: nil,
           shelved_until: nil
         }}
    end
  end

  def run(_params, _context),
    do: {:error, "UnshelveAlarm requires from shelved/suppressed/out_of_service"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end

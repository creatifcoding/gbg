defmodule Maiden.AlarmRuntime.Actions.ReopenAlarm do
  @moduledoc """
  Explicit transition action: cleared -> unacknowledged.
  """

  use Jido.Action,
    name: "reopen_alarm",
    description: "Reopen a cleared alarm",
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
    at = fetch_param(params, :at)

    cond do
      from != "cleared" or to != "unacknowledged" ->
        {:error, "ReopenAlarm requires from=cleared and to=unacknowledged"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           state: "unacknowledged",
           triggered_at: at,
           acknowledged_at: nil,
           acknowledged_by: nil,
           cleared_at: nil,
           shelved_until: nil,
           suppression_reason: nil
         }}
    end
  end

  def run(_params, _context),
    do: {:error, "ReopenAlarm requires from=cleared and to=unacknowledged"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end

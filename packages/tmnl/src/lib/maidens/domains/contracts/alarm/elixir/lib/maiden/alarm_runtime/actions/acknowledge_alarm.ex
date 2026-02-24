defmodule Maiden.AlarmRuntime.Actions.AcknowledgeAlarm do
  @moduledoc """
  Explicit transition action: unacknowledged -> acknowledged.
  """

  use Jido.Action,
    name: "acknowledge_alarm",
    description: "Acknowledge an unacknowledged alarm",
    schema: [
      alarm_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      by: [type: :string, required: true]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    alarm_id = fetch_param(params, :alarm_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)
    at = fetch_param(params, :at)
    by = fetch_param(params, :by)

    cond do
      from != "unacknowledged" or to != "acknowledged" ->
        {:error, "AcknowledgeAlarm requires from=unacknowledged and to=acknowledged"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{state: "acknowledged", acknowledged_at: at, acknowledged_by: by}}
    end
  end

  def run(_params, _context),
    do: {:error, "AcknowledgeAlarm requires from=unacknowledged and to=acknowledged"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end

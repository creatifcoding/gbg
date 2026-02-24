defmodule Maiden.AlarmRuntime.Actions.SuppressAlarm do
  @moduledoc """
  Explicit transition action: unacknowledged|acknowledged -> suppressed.
  """

  use Jido.Action,
    name: "suppress_alarm",
    description: "Suppress an active alarm",
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
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)
    reason = fetch_param(params, :reason)

    cond do
      from not in ["unacknowledged", "acknowledged"] or to != "suppressed" ->
        {:error,
         "SuppressAlarm requires to=suppressed and from in [unacknowledged, acknowledged]"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{state: "suppressed", suppression_reason: reason}}
    end
  end

  def run(_params, _context),
    do:
      {:error,
       "SuppressAlarm requires to=suppressed and from in [unacknowledged, acknowledged]"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end

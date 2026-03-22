defmodule Maiden.AlarmRuntime.Actions.ShelveAlarm do
  @moduledoc """
  Explicit transition action: unacknowledged|acknowledged -> shelved.
  """

  use Jido.Action,
    name: "shelve_alarm",
    description: "Shelve an active alarm",
    schema: [
      alarm_id: [type: :string, required: true],
      from: [type: :string, required: true],
      to: [type: :string, required: true],
      at: [type: :string, required: true],
      shelved_until: [type: :string],
      reason: [type: :string]
    ]

  @impl true
  def run(params, context) when is_map(params) do
    alarm_id = fetch_param(params, :alarm_id)
    from = fetch_param(params, :from)
    to = fetch_param(params, :to)
    shelved_until = fetch_param(params, :shelved_until)
    reason = fetch_param(params, :reason)

    cond do
      from not in ["unacknowledged", "acknowledged"] or to != "shelved" ->
        {:error,
         "ShelveAlarm requires to=shelved and from in [unacknowledged, acknowledged]"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok,
         %{
           state: "shelved",
           shelved_until: shelved_until,
           suppression_reason: reason
         }}
    end
  end

  def run(_params, _context),
    do:
      {:error,
       "ShelveAlarm requires to=shelved and from in [unacknowledged, acknowledged]"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end

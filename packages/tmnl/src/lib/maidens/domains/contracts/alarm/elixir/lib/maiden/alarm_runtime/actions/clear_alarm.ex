defmodule Maiden.AlarmRuntime.Actions.ClearAlarm do
  @moduledoc """
  Explicit transition action: acknowledged -> cleared.
  """

  use Jido.Action,
    name: "clear_alarm",
    description: "Clear an acknowledged alarm",
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
      from != "acknowledged" or to != "cleared" ->
        {:error, "ClearAlarm requires from=acknowledged and to=cleared"}

      context.state[:alarm_id] != alarm_id ->
        {:error, "alarm_id mismatch between transition payload and agent state"}

      true ->
        {:ok, %{state: "cleared", cleared_at: at}}
    end
  end

  def run(_params, _context),
    do: {:error, "ClearAlarm requires from=acknowledged and to=cleared"}

  defp fetch_param(params, key), do: Map.get(params, key) || Map.get(params, Atom.to_string(key))
end
